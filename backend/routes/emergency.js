const express    = require('express');
const router     = express.Router();
const Incident   = require('../models/Incident');
const Responder  = require('../models/Responder');
const Pharmacy  = require('../models/Pharmacy');
const Deployment = require('../models/Deployment');
const Recommendation = require('../models/Recommendation');
const verifyToken  = require('../middleware/verifyToken');
const requireRole  = require('../middleware/requireRole');
const { haversine, estimateETA, dispatch, logDispatch } = require('../config/dispatchAI');
const { syncRecommendationForIncident, releaseResponder } = require('../config/allocationEngine');

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

// GET the active mobile-resource deployment linked to an incident, if any.
// This is what the Emergency page's "Assigned Resource" block reads —
// separate from the fixed-facility Responder shown via /analysis, since a
// Deployment here means an actual Resource (ambulance/fire-truck/etc.) was
// approved and dispatched through the Smart Allocation recommendation flow.
router.get('/incidents/:id/deployment', async (req, res) => {
  try {
    const deployment = await Deployment.findOne({
      incidentId: req.params.id,
      status: 'active'
    });
    res.json(deployment || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PROTECTED ─────────────────────────────────────────

// POST new incident — dispatch now goes ENTIRELY through the allocation
// engine (config/allocationEngine.js), not the old immediate dispatchAI.js
// call. That old path dispatched every incident instantly regardless of
// severity, never created a Deployment record, and could double-dispatch
// on top of the allocation engine's own critical auto-dispatch. Now there's
// exactly one system: critical -> dispatched instantly (still trackable),
// medium/high -> sits pending for admin/officer approval, low -> nothing
// (pharmacy suggestion handles low medical separately).
router.post(
  '/incidents',
  verifyToken,
  requireRole('citizen', 'officer', 'admin'),
  async (req, res) => {
    try {
      const incident = new Incident({
        ...req.body,
        reportedBy: req.dbUser.email
      });
      await incident.save();

      // Awaited (not fire-and-forget) because the response needs to know
      // what actually happened — critical incidents dispatch synchronously
      // here, and the citizen-facing modal needs those results immediately.
      let recs = [];
      try {
        recs = await syncRecommendationForIncident(incident._id);
      } catch (err) {
        console.error('syncRecommendationForIncident (create) failed:', err.message);
      }

      // Only recs that got auto-approved (critical) actually dispatched
      // something — everything else is sitting pending for a human.
      const approved = recs.filter(r => r.status === 'approved' && r.recommendedResourceId);

      const dispatched = [];
      for (const rec of approved) {
        const responder = await Responder.findById(rec.recommendedResourceId);
        if (!responder) continue;
        dispatched.push({
          _id: responder._id,
          name: responder.name,
          phone: responder.phone,
          address: responder.address,
          location: responder.location,
          type: responder.type,
          dispatchType: responder.type,
          distance: rec.distanceKm,
          eta: estimateETA(rec.distanceKm || 0)
        });
      }

      // Backward-compat display fields on the incident itself, only
      // meaningful when something was actually auto-dispatched (critical).
      if (dispatched.length) {
        incident.assignedTo    = dispatched[0].name;
        incident.responderType = dispatched[0].type;
        incident.status        = 'responding';
        await incident.save();

        logDispatch(incident, dispatched).catch(() => {});
      }

      res.status(201).json({
        incident,
        dispatched,
        nearest: dispatched[0] || null,
        pendingApprovalCount: recs.filter(r => r.status === 'pending').length
      });

    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// PATCH incident status — release ALL active deployments for this
// incident on resolve (not just a single by-name lookup, since one
// incident can now have several units dispatched — multiple ambulances
// for multiple casualties, police + ambulance for an accident, etc.),
// resync recommendations.
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

      if (req.body.status === 'resolved' && prev.status !== 'resolved') {
        const activeDeployments = await Deployment.find({
          incidentId: incident._id, status: 'active'
        });
        for (const dep of activeDeployments) {
          try {
            await releaseResponder(dep.resourceId);
          } catch (err) {
            console.error(`Release failed for deployment ${dep._id}:`, err.message);
          }
        }
      }

      // Status change (active <-> responding <-> resolved) can change
      // whether a recommendation should exist for this incident - resync.
      syncRecommendationForIncident(incident._id).catch(err =>
        console.error('syncRecommendationForIncident (status) failed:', err.message)
      );

      res.json(incident);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// PATCH mark an incident as seen by a manager — a read-receipt only,
// completely separate from dispatch/approval/status. Any of the three
// roles that work with incidents can mark it.
router.patch(
  '/incidents/:id/seen',
  verifyToken,
  requireRole('admin', 'officer', 'responder-manager'),
  async (req, res) => {
    try {
      const incident = await Incident.findByIdAndUpdate(
        req.params.id,
        { seenByManager: true, seenAt: new Date(), seenBy: req.dbUser.email },
        { new: true }
      );
      if (!incident) return res.status(404).json({ error: 'Incident not found' });
      res.json(incident);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// GET dispatch simulation — test without reporting
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

// Numeric minutes (for advice-text generation) matching the same formula
// dispatchAI.js's estimateETA() uses internally, just not pre-formatted
// into a display string.
function etaMinutesFromDistance(distKm) {
  if (distKm == null) return null;
  const BASE_SPEED = 40; // km/h for emergency vehicles
  return Math.max(1, Math.round((distKm / BASE_SPEED) * 60));
}

// ── DISPATCH ANALYSIS ─────────────────────────────────
// Shows what ACTUALLY happened to this incident, not a hypothetical
// recompute: real Deployment records (dispatched, with confirm status and
// ETA) for critical incidents already sent out, real pending
// Recommendations for medium/high still awaiting admin/officer approval,
// and the pharmacy suggestion for low-severity medical.
// ── LIGHTWEIGHT OUTCOME (no AI call) ──────────────────
// Same status data as /analysis (dispatched units + confirm state,
// pending recommendations, pharmacy count) but WITHOUT calling adviseAI —
// that costs an OpenAI request per call, and Responder Manager's incident
// list polls every incident's outcome every 20s. Bulk polling uses this;
// /analysis (with the AI-written advisory text) is only called when a
// user actually expands one specific incident's detail view.
router.get('/incidents/:id/outcome', verifyToken, async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ error: 'Incident not found' });

    const coords = incident.location?.coordinates;
    const deployments = await Deployment.find({ incidentId: incident._id })
      .sort({ dispatchedAt: -1 });

    const units = [];
    for (const dep of deployments) {
      const responder = await Responder.findById(dep.resourceId);
      let distanceKm = null;
      if (responder?.location?.lat != null && coords?.lat != null) {
        distanceKm = haversine(coords.lat, coords.lng, responder.location.lat, responder.location.lng);
      }
      units.push({
        resourceId: dep.resourceId,
        name: dep.resourceName,
        type: dep.resourceType,
        distanceKm: distanceKm != null ? +distanceKm.toFixed(2) : null,
        eta: distanceKm != null ? estimateETA(distanceKm) : null,
        status: dep.status,
        confirmed: !!dep.confirmedAt
      });
    }

    const pendingCount = await Recommendation.countDocuments({
      incidentId: incident._id, status: 'pending'
    });

    let pharmacyCount = 0;
    if (incident.severity === 'low' && incident.type === 'medical' && coords?.lat != null) {
      const p = await findPharmacies(coords.lat, coords.lng);
      pharmacyCount = p.pharmacies?.length || 0;
    }

    res.json({ units, pendingCount, pharmacyCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/incidents/:id/analysis', verifyToken, async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ error: 'Incident not found' });

    const coords = incident.location?.coordinates;

    // Real dispatch history for this incident — active AND completed/
    // cancelled, so you can see the full story (e.g. an escalated critical
    // dispatch shows the original attempt as 'cancelled' plus the new one).
    const deployments = await Deployment.find({ incidentId: incident._id })
      .sort({ dispatchedAt: -1 });

    const units = [];
    for (const dep of deployments) {
      const responder = await Responder.findById(dep.resourceId);
      let distanceKm = null;
      if (responder?.location?.lat != null && coords?.lat != null) {
        distanceKm = haversine(coords.lat, coords.lng, responder.location.lat, responder.location.lng);
      }
      units.push({
        resourceId: dep.resourceId,
        name: dep.resourceName,
        type: dep.resourceType,
        phone: responder?.phone || null,
        location: responder?.location || null,
        distanceKm: distanceKm != null ? +distanceKm.toFixed(2) : null,
        eta: distanceKm != null ? estimateETA(distanceKm) : null,
        etaMinutes: etaMinutesFromDistance(distanceKm),
        load: responder ? `${responder.currentLoad}/${responder.capacity}` : 'n/a',
        status: dep.status,           // active | completed | cancelled
        confirmed: !!dep.confirmedAt,
        confirmedAt: dep.confirmedAt,
        dispatchedAt: dep.dispatchedAt,
        cancelReason: dep.cancelReason
      });
    }

    // Still awaiting admin/officer approval (medium/high)
    const pendingRecs = await Recommendation.find({
      incidentId: incident._id, status: 'pending'
    });
    const pending = pendingRecs.map(r => ({
      id: r._id,
      resourceType: r.resourceType,
      recommendedResourceName: r.recommendedResourceName,
      distanceKm: r.distanceKm,
      priority: r.priority,
      reason: r.reason
    }));

    let pharmacies = null;
    if (incident.severity === 'low' && incident.type === 'medical') {
      if (coords && coords.lat != null) pharmacies = await findPharmacies(coords.lat, coords.lng);
    }

    const advice = await adviseAI(incident, units) || adviseByRules(incident, units);

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
      units,
      pending,
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
router.get('/pharmacies/nearby', verifyToken, async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }
  res.json(await findPharmacies(lat, lng, Number(req.query.limit) || 4));
});

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