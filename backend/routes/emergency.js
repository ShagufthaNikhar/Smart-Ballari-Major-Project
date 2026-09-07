const express    = require('express');
const router     = express.Router();
const Incident   = require('../models/Incident');
const Responder  = require('../models/Responder');
const Pharmacy  = require('../models/Pharmacy');
const verifyToken  = require('../middleware/verifyToken');
const requireRole  = require('../middleware/requireRole');
const { haversine } = require('../config/busSimulator');
const { dispatch, logDispatch } = require('../config/dispatchAI');

// ── PUBLIC ───────────────────────────────────────────

// GET all responders
router.get('/responders', async (req, res) => {
  try {
    const { type } = req.query;
    const filter   = { isActive: true };
    if (type) filter.type = type;
    const responders = await Responder.find(filter);
    res.json(responders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET nearest responders to a location
// Query: ?lat=15.14&lng=76.92&type=hospital&limit=3
router.get('/nearest', async (req, res) => {
  try {
    const { lat, lng, type, limit = 3 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng required' });
    }

    const filter = { isActive: true };
    if (type) filter.type = type;

    const responders = await Responder.find(filter);

    // Haversine sort
    const sorted = responders
      .map(r => ({
        ...r.toObject(),
        distance: haversine(
          parseFloat(lat), parseFloat(lng),
          r.location.lat, r.location.lng
        )
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, parseInt(limit));

    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET live incidents board
router.get('/incidents', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const incidents = await Incident.find(filter)
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(incidents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single incident by ID
router.get('/incidents/:incidentId', async (req, res) => {
  try {
    const incident = await Incident.findOne({
      incidentId: req.params.incidentId.toUpperCase()
    });
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    res.json(incident);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PROTECTED ─────────────────────────────────────────



// POST new incident — AI dispatch
router.post(
  '/incidents',
  verifyToken,
  requireRole('citizen', 'officer', 'admin'),
  async (req, res) => {
    try {
      // 1. Save incident
      const incident = new Incident({
        ...req.body,
        reportedBy: req.dbUser.email
      });
      await incident.save();

      // 2. AI dispatch
      const dispatched = await dispatch(incident);

      if (dispatched.length > 0) {
        // Assign primary responder
        const primary = dispatched[0];
        incident.assignedTo    = primary.name;
        incident.responderType = primary.dispatchType;
        incident.status        = 'responding';
        await incident.save();

        // Update responder load
        await Promise.all(
          dispatched.map(d =>
            Responder.findByIdAndUpdate(d._id, {
              $inc: { currentLoad: 1 }
            })
          )
        );
      }

      // 3. Log for ML training
      await logDispatch(incident, dispatched);

      res.status(201).json({
        incident,
        dispatched,           // all assigned responders
        nearest: dispatched[0] || null
      });

    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// POST resolve — free up responder load
router.patch(
  '/incidents/:id/status',
  verifyToken,
  requireRole('admin'),
  async (req, res) => {
    try {
      const prev = await Incident.findById(req.params.id);

      const update = {
        status:    req.body.status,
        updatedAt: new Date()
      };
      if (req.body.status === 'resolved') {
        update.resolvedAt = new Date();
      }

      const incident = await Incident.findByIdAndUpdate(
        req.params.id,
        update,
        { new: true }
      );

      // Free up responder load on resolve
      if (req.body.status === 'resolved' && prev.status !== 'resolved') {
        const responder = await Responder.findOne({
          name: prev.assignedTo
        });
        if (responder && responder.currentLoad > 0) {
          await Responder.findByIdAndUpdate(responder._id, {
            $inc: { currentLoad: -1 }
          });
        }
      }

      res.json(incident);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// GET dispatch simulation — test without reporting
// Query: ?lat=15.14&lng=76.92&type=accident&severity=high
router.get('/simulate-dispatch', async (req, res) => {
  try {
    const { lat, lng, type, severity } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng required' });
    }

    const mockIncident = {
      location: {
        coordinates: {
          lat: parseFloat(lat),
          lng: parseFloat(lng)
        }
      },
      type:     type     || 'accident',
      severity: severity || 'medium'
    };

    const dispatched = await dispatch(mockIncident);
    res.json({ dispatched });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── HELPERS ───────────────────────────────────────────
function getResponderType(incidentType) {
  const map = {
    accident: 'hospital',
    medical:  'hospital',
    fire:     'fire',
    crime:    'police',
    flood:    'police',
    other:    'police'
  };
  return map[incidentType] || 'police';
}

async function findNearest(lat, lng, type) {
  const responders = await Responder.find({ isActive: true, type });
  if (!responders.length) return null;

  return responders
    .map(r => ({
      ...r.toObject(),
      distance: haversine(lat, lng, r.location.lat, r.location.lng)
    }))
    .sort((a, b) => a.distance - b.distance)[0];
}

// ── DISPATCH ANALYSIS ─────────────────────────────────
// Powers the dispatch console. Two layers, and they are deliberately
// different in kind:
//
//   FACTS   — nearest units, distance, ETA, current load. Computed by
//             dispatch() from the real Responder records. Never invented.
//   ADVICE  — route guidance, on-scene actions, risk flags. Written by the
//             model from those facts. It is advisory prose, NOT turn-by-turn
//             routing, and the UI labels it as such.
//
// Falls back to rule-based advice when there is no OpenAI key or the call
// fails, so the console never renders empty.
router.get('/incidents/:id/analysis', verifyToken, async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ error: 'Incident not found' });

    // real units, real distances
    const units = await dispatch(incident);
    const facts = units.map(u => ({
      name: u.name,
      type: u.dispatchType,
      phone: u.phone,
      address: u.address,
      distanceKm: u.distance,
      etaMinutes: u.eta,
      load: `${u.currentLoad}/${u.capacity}`
    }));

    const advice = await adviseAI(incident, facts) || adviseByRules(incident, facts);

    // A minor medical complaint usually needs a chemist, not an ambulance.
    // Looked up live and never stored - see the /pharmacies/nearby comment.
    let pharmacies = null;
    if (incident.severity === 'low' && incident.type === 'medical') {
      const c = incident.location?.coordinates;
      if (c && c.lat != null) pharmacies = await findPharmacies(c.lat, c.lng);
    }

    res.json({
      pharmacies,
      incident: {
        id: incident._id,
        incidentId: incident.incidentId,
        type: incident.type,
        severity: incident.severity,
        status: incident.status,
        description: incident.description,
        address: incident.location?.address,
        location: incident.location?.coordinates,
        createdAt: incident.createdAt
      },
      units: facts,
      advice,
      disclaimer: 'Unit names, distances and ETAs are computed from real facility records. ' +
                  'Route and action guidance is advisory text, not turn-by-turn navigation.'
    });
  } catch (err) {
    console.error('analysis failed:', err);
    res.status(500).json({ error: err.message });
  }
});

const RESPONSE_PLAYBOOK = {
  accident: ['Secure the scene and manage traffic flow',
             'Assess casualties and begin triage',
             'Report casualty count and severity to control'],
  medical:  ['Reach the patient and check airway, breathing, circulation',
             'Begin treatment and prepare for transport',
             'Notify the receiving hospital of patient status'],
  fire:     ['Establish a perimeter and identify the point of entry',
             'Confirm evacuation status of the building',
             'Report fire spread and water supply to control'],
  crime:    ['Approach with caution and secure the area',
             'Protect the scene and any evidence',
             'Report the situation and request backup if required'],
  flood:    ['Assess water level and identify safe access',
             'Move people to higher ground',
             'Report trapped persons and access constraints'],
  other:    ['Assess the scene on arrival',
             'Identify and assist anyone affected',
             'Report status to dispatch control']
};

/** Deterministic advice. Always available, always sensible. */
function adviseByRules(incident, facts) {
  const primary = facts[0];
  const critical = ['high', 'critical'].includes(incident.severity);
  return {
    summary: primary
      ? `${primary.name} is nearest at ${primary.distanceKm} km, about ${primary.etaMinutes} minutes out.`
      : 'No active unit of the required type is available.',
    route: primary
      ? `Head for ${primary.address || 'the incident address'}. ` +
        `Straight-line distance is ${primary.distanceKm} km; allow more on city roads.`
      : 'No unit assigned, so no route.',
    onSceneActions: RESPONSE_PLAYBOOK[incident.type] || RESPONSE_PLAYBOOK.other,
    riskFlags: critical
      ? `Severity is ${incident.severity}. Treat as time-critical and confirm arrival with control.`
      : `Severity is ${incident.severity}. Proceed under normal response conditions.`,
    secondaryUnit: facts[1]
      ? `${facts[1].name} is the next nearest at ${facts[1].distanceKm} km, as backup.`
      : 'No second unit available for backup.',
    generatedBy: 'rules'
  };
}

/** Model-written advice, grounded in the real unit facts above. */
async function adviseAI(incident, facts) {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !facts.length) return null;

  const system =
    'You advise an emergency dispatch controller in Ballari, Karnataka. ' +
    'You are given a real incident and the real units already selected by the ' +
    'dispatch system. Do NOT invent units, place names, road names or ETAs — ' +
    'refer only to what you are given. You cannot see a map, so give general ' +
    'approach guidance rather than turn-by-turn directions. Be concise and ' +
    'operational. Reply with JSON only: ' +
    '{"summary":"one sentence","route":"1-2 sentences","onSceneActions":' +
    '["step","step","step"],"riskFlags":"1-2 sentences","secondaryUnit":"1 sentence"}';

  const user =
    `Incident: ${incident.type}, severity ${incident.severity}\n` +
    `Reported: ${incident.description}\n` +
    `Address: ${incident.location?.address || 'not given'}\n\n` +
    `Units assigned by the dispatch system:\n` +
    facts.map(f =>
      `- ${f.name} (${f.type}) — ${f.distanceKm} km, ETA ${f.etaMinutes} min, load ${f.load}`
    ).join('\n');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system },
                   { role: 'user',   content: user }]
      })
    });
    if (!r.ok) { console.error('OpenAI analysis', r.status); return null; }
    const j = await r.json();
    const a = JSON.parse(j.choices?.[0]?.message?.content || '{}');
    if (!a.summary) return null;
    return {
      summary:        String(a.summary).slice(0, 300),
      route:          String(a.route || '').slice(0, 400),
      onSceneActions: Array.isArray(a.onSceneActions)
                        ? a.onSceneActions.slice(0, 5).map(x => String(x).slice(0, 160))
                        : [],
      riskFlags:      String(a.riskFlags || '').slice(0, 400),
      secondaryUnit:  String(a.secondaryUnit || '').slice(0, 250),
      generatedBy:    'ai'
    };
  } catch (err) {
    console.error('OpenAI analysis failed:', err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── NEARBY PHARMACIES ─────────────────────────────────
// For a LOW-severity medical incident, sending an ambulance is the wrong
// answer: what the person usually needs is the nearest chemist.
//
// Reads a local collection - no API key, no billing. OSM has zero pharmacies
// mapped in Ballari, so these coordinates are community-sourced and verified.
router.get('/pharmacies/nearby', verifyToken, async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }
  res.json(await findPharmacies(lat, lng, Number(req.query.limit) || 4));
});

/**
 * Nearest medical stores, for LOW-severity medical incidents where sending an
 * ambulance is the wrong response.
 *
 * LOCATIONS ONLY. The source verified coordinates but explicitly did not
 * verify phone numbers or opening hours, so neither is stored or returned.
 * A guessed phone number in an emergency tool is worse than no phone number:
 * someone dials it and reaches nothing. Directions to a shop that is really
 * there is the honest, useful answer.
 *
 * This used to call Google Places live. It now reads a local collection, so
 * there is no API key, no billing and no per-request cost.
 */
async function findPharmacies(lat, lng, limit = 4) {
  try {
    const all = await Pharmacy.find({ isActive: true }).lean();
    const near = all
      .map(p => ({
        name: p.name,
        brand: p.brand || null,
        address: p.address || null,
        location: p.location,
        distanceKm: +haversineKm(lat, lng, p.location.lat, p.location.lng).toFixed(2)
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, Math.min(Math.max(limit, 1), 10));

    return {
      pharmacies: near,
      // Said plainly so the UI never implies more than we know.
      note: 'Locations only. Opening hours are not recorded \u2014 a shop may be closed. ' +
            'For anything more than a minor issue, dial 108.',
      attribution: 'Pharmacy locations: community-sourced, coordinates verified.',
      count: all.length
    };
  } catch (err) {
    console.error('pharmacy lookup failed:', err.message);
    return { pharmacies: [], unavailable: 'Could not load pharmacies. Dial 108 for medical help.' };
  }
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, rad = d => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = router;