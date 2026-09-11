const Responder = require('../models/Responder');
const Incident  = require('../models/Incident');

// ── HAVERSINE ─────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R  = 6371;
  const dL = ((lat2 - lat1) * Math.PI) / 180;
  const dO = ((lon2 - lon1) * Math.PI) / 180;
  const a  =
    Math.sin(dL / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dO / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── SEVERITY WEIGHT ───────────────────────────────────
// Higher severity = more responders dispatched
const SEVERITY_CONFIG = {
  low:      { count: 1, speedFactor: 1.0 },
  medium:   { count: 1, speedFactor: 1.2 },
  high:     { count: 2, speedFactor: 1.5 },
  critical: { count: 3, speedFactor: 2.0 }
};

// ── INCIDENT → RESPONDER TYPE MAP ─────────────────────
// 'hospital' swapped for the new 'ambulance' type where the incident needs
// a vehicle dispatched to the scene, not a fixed facility. 'flood' no
// longer also pulls 'fire' — flood response is police-led here (water
// rescue via fire trucks can be added back later if you want that).
const INCIDENT_RESPONDER_MAP = {
  accident: ['police', 'ambulance'],
  medical:  ['ambulance'],
  fire:     ['fire', 'ambulance'],
  crime:    ['police'],
  flood:    ['police'],
  other:    ['police']
};

// Low-severity medical (a minor cut, a small wound) doesn't need an
// ambulance dispatched — routes/emergency.js already shows a nearby-
// pharmacy suggestion for exactly this combination
// (severity:'low' && type:'medical'), so sending a real ambulance on top
// of that wastes a unit that a genuine emergency might need. This is the
// one exception to INCIDENT_RESPONDER_MAP; everything else still dispatches
// normally regardless of severity (severity only affects HOW MANY units,
// via SEVERITY_CONFIG below, not WHETHER any go out).
function getResponderTypes(incident) {
  if (incident.type === 'medical' && incident.severity === 'low') return [];
  return INCIDENT_RESPONDER_MAP[incident.type] || ['police'];
}

// ── ETA ESTIMATE ──────────────────────────────────────
function estimateETA(distKm, speedFactor = 1.0) {
  const BASE_SPEED = 40; // km/h for emergency vehicles
  const speed      = BASE_SPEED * speedFactor;
  const mins       = Math.round((distKm / speed) * 60);
  if (mins <= 1) return '< 1 min';
  return `${mins} min`;
}

// ── SCORE RESPONDER ───────────────────────────────────
// ML STUB — replace this function with trained model later
// Current: weighted score = distance + load penalty
function scoreResponder(responder, distKm, severityFactor) {
  const DISTANCE_WEIGHT = 0.7;
  const LOAD_WEIGHT     = 0.3;

  const loadRatio = responder.capacity > 0
    ? responder.currentLoad / responder.capacity
    : 0;

  const score =
    (distKm * DISTANCE_WEIGHT) +
    (loadRatio * 10 * LOAD_WEIGHT);

  return parseFloat(score.toFixed(4));

  /*
  ── ML REPLACEMENT (future) ──────────────────────────
  When ready, replace above with:

  const features = [
    distKm,
    loadRatio,
    responder.available ? 0 : 1,
    severityFactor,
    timeOfDay() / 24,     // 0–1 normalized hour
    isRushHour() ? 1 : 0
  ];

  return await callMLModel('/api/ml/dispatch-score', features);
  ─────────────────────────────────────────────────── */
}

// ── MAIN DISPATCH FUNCTION ────────────────────────────
async function dispatch(incident) {
  const { lat, lng } = incident.location.coordinates;
  const severity     = incident.severity || 'medium';
  const config       = SEVERITY_CONFIG[severity];
  const respTypes    = getResponderTypes(incident);

  const results = [];

  for (const respType of respTypes) {
    // Fetch all active responders of this type
    const responders = await Responder.find({
      isActive: true,
      type:     respType
    });

    if (!responders.length) continue;

    // Score each responder
    const scored = responders.map(r => {
      const dist  = haversine(lat, lng, r.location.lat, r.location.lng);
      const score = scoreResponder(r, dist, config.speedFactor);
      const eta   = estimateETA(dist, config.speedFactor);

      return {
        ...r.toObject(),
        distance: parseFloat(dist.toFixed(2)),
        eta,
        score,
        dispatchType: respType
      };
    });

    // Sort by score ascending (lower = better) — EXCEPT for fire, where a
    // genuine fire_station always outranks any other fire-tagged listing
    // (equipment supplier, security service) regardless of distance. Real
    // firefighting capability matters more than a few extra hundred metres.
    if (respType === 'fire') {
      scored.sort((a, b) => {
        const aStation = a.category === 'fire_station' ? 0 : 1;
        const bStation = b.category === 'fire_station' ? 0 : 1;
        if (aStation !== bStation) return aStation - bStation;
        return a.score - b.score;
      });
    } else {
      scored.sort((a, b) => a.score - b.score);
    }

    // Pick top N based on severity
    const topN = scored.slice(0, config.count);
    results.push(...topN);
  }

  return results;
}

// ── ML READINESS STUB ─────────────────────────────────
async function callMLModel(endpoint, features) {
  /*
  const res = await fetch(`http://localhost:8000${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ features })
  });
  const { score } = await res.json();
  return score;
  */
  throw new Error('ML model not yet deployed — using Haversine fallback');
}

// ── HISTORY LOGGER (for future ML training data) ──────
async function logDispatch(incident, dispatched) {
  const logEntry = {
    timestamp:     new Date().toISOString(),
    incidentId:    incident.incidentId,
    incidentType:  incident.type,
    severity:      incident.severity,
    lat:           incident.location.coordinates.lat,
    lng:           incident.location.coordinates.lng,
    dispatched:    dispatched.map(d => ({
      responderId: d._id,
      type:        d.type,
      distance:    d.distance,
      eta:         d.eta,
      score:       d.score
    }))
  };

  console.log('[DISPATCH LOG]', JSON.stringify(logEntry));

  /*
  ── Save to DB for ML training (future) ─────────────
  await DispatchLog.create(logEntry);
  ─────────────────────────────────────────────────── */
}

module.exports = { dispatch, logDispatch, haversine, estimateETA, INCIDENT_RESPONDER_MAP };