const Responder      = require('../models/Responder');
const Deployment     = require('../models/Deployment');
const Incident       = require('../models/Incident');
const Recommendation = require('../models/Recommendation');
const { INCIDENT_RESPONDER_MAP, haversine } = require('./dispatchAI');

// Reverse of INCIDENT_RESPONDER_MAP — for a given Responder type, which
// incident types create demand for it. Built from the SAME map dispatchAI.js
// uses for actual dispatch, so Smart Allocation and the auto-dispatch never
// disagree about what an incident needs.
const RESPONDER_INCIDENT_TYPES = {};
Object.entries(INCIDENT_RESPONDER_MAP).forEach(([incType, respTypes]) => {
  respTypes.forEach(respType => {
    RESPONDER_INCIDENT_TYPES[respType] = RESPONDER_INCIDENT_TYPES[respType] || [];
    RESPONDER_INCIDENT_TYPES[respType].push(incType);
  });
});

const SEVERITY_WEIGHT = { low: 5, medium: 15, high: 30, critical: 50 };

// How many units of a given responder type one incident needs. Only
// ambulance scales with casualtyCount right now — a fire or a crime scene
// is still one incident regardless of a headcount, but each injured person
// genuinely needs their own ambulance. Capped so a mistyped casualty count
// doesn't try to dispatch the entire fleet.
const MAX_UNITS_PER_TYPE = 5;
function neededUnits(responderType, incident) {
  if (responderType !== 'ambulance') return 1;
  const count = Number(incident.casualtyCount) || 1;
  return Math.max(1, Math.min(count, MAX_UNITS_PER_TYPE));
}

// How far around an incident counts as "the same area" for clustering —
// e.g. two critical fires 800m apart should raise each other's priority.
const CLUSTER_RADIUS_KM = 3;

// ── EMERGENCY DEMAND (distance-based, no zones) ───────
async function computeEmergencyDemand(lat, lng, responderType, excludeIncidentId = null) {
  const incidentTypes = RESPONDER_INCIDENT_TYPES[responderType] || [];
  if (!incidentTypes.length) return { score: 0, nearbyIncidents: 0 };

  const candidates = await Incident.find({
    type: { $in: incidentTypes },
    status: { $in: ['active', 'responding'] }
  }).select('severity location.coordinates');

  let score = 0;
  let nearbyIncidents = 0;

  candidates.forEach(inc => {
    if (excludeIncidentId && String(inc._id) === String(excludeIncidentId)) return;
    const c = inc.location?.coordinates;
    if (c?.lat == null) return;
    const dist = haversine(lat, lng, c.lat, c.lng);
    if (dist <= CLUSTER_RADIUS_KM) {
      score += SEVERITY_WEIGHT[inc.severity] || 0;
      nearbyIncidents++;
    }
  });

  return { score, nearbyIncidents };
}

// ── PICK BEST RESPONDER ────────────────────────────────
// Nearest available (not-at-capacity) responder of the given type. Simple
// on purpose: distance first, current load as a tiebreaker — this is a
// recommendation an admin reviews, not a fully automated dispatch, so it
// doesn't need dispatchAI's full weighted score.
async function pickBestResponder(lat, lng, responderType, excludeIds = []) {
  const excludeSet = new Set(excludeIds.map(String));
  const candidates = (await Responder.find({ type: responderType, isActive: true }))
    .filter(r => !excludeSet.has(String(r._id)));
  const available = candidates.filter(r => (r.currentLoad || 0) < (r.capacity || 10));
  const pool = available.length ? available : candidates; // fall back to at-capacity ones rather than showing nothing

  let best = null, bestDist = Infinity;
  pool.forEach(r => {
    if (r.location?.lat == null) return;
    const d = haversine(lat, lng, r.location.lat, r.location.lng);
    if (d < bestDist || (d === bestDist && best && r.currentLoad < best.currentLoad)) {
      bestDist = d; best = r;
    }
  });
  if (!best && pool.length) best = pool[0];

  return { responder: best, distanceKm: Number.isFinite(bestDist) ? bestDist : null };
}

// ── APPROVE: DISPATCH A RESPONDER ─────────────────────
// Responders are fixed facilities/companies, not vehicles with a
// status — "deploying" one just means logging that it's now handling this
// incident and bumping its load, mirroring exactly what the ordinary
// dispatch() flow already does in routes/emergency.js on incident creation.
async function dispatchResponder(responderId, target, reason, userId) {
  const responder = await Responder.findById(responderId);
  if (!responder) throw new Error('Responder not found');

  await Responder.findByIdAndUpdate(responderId, { $inc: { currentLoad: 1 } });

  const demand = await computeEmergencyDemand(target.lat, target.lng, responder.type);
  const priority = demand.score > 40 ? 'critical'
                 : demand.score > 20 ? 'high'
                 : demand.score > 8  ? 'medium'
                 : 'low';

  // resourceId historically pointed at a Resource document; it works fine
  // storing a Responder id too since Mongoose only enforces `ref` on
  // populate(), which nothing calls on this field.
  const deployment = await Deployment.create({
    resourceId: responderId,
    resourceName: responder.name,
    resourceType: responder.type,
    area: target.label,
    reason,
    priority,
    demandScore: demand.score,
    createdBy: userId
  });

  recalcActiveRecommendations().catch(err =>
    console.error('recalcActiveRecommendations after dispatch failed:', err.message)
  );

  return { responder, deployment };
}

// ── RECALL: RELEASE A RESPONDER ───────────────────────
// Immediate — a facility isn't "returning", its load just drops.
async function releaseResponder(responderId) {
  const responder = await Responder.findById(responderId);
  if (!responder) throw new Error('Responder not found');

  await Responder.findByIdAndUpdate(responderId, {
    $inc: { currentLoad: (responder.currentLoad || 0) > 0 ? -1 : 0 }
  });

  await Deployment.findOneAndUpdate(
    { resourceId: responderId, status: 'active' },
    { status: 'completed', completedAt: new Date() }
  );

  await recalcActiveRecommendations();
  return responder;
}

// ══════════════════════════════════════════════════════
// ── AUTOMATIC RECOMMENDATION ENGINE ───────────────────
// ══════════════════════════════════════════════════════
// One incident can need SEVERAL responder types at once (e.g. an accident
// needs both police and ambulance) — this creates one Recommendation per
// (incident, responderType) pair, using INCIDENT_RESPONDER_MAP so it never
// diverges from what dispatchAI.js actually dispatches automatically.
async function syncRecommendationForIncident(incidentId) {
  const incident = await Incident.findById(incidentId);
  if (!incident) return [];

  if (incident.status === 'resolved' || incident.severity === 'low') {
    await Recommendation.updateMany(
      { incidentId: incident._id, status: 'pending' },
      { status: 'expired', resolvedAt: new Date(), updatedAt: new Date() }
    );
    return [];
  }

  const coords = incident.location?.coordinates;
  if (coords?.lat == null) return [];

  const neededTypes = INCIDENT_RESPONDER_MAP[incident.type] || [];
  const results = [];

  for (const responderType of neededTypes) {
    const unitsNeeded = neededUnits(responderType, incident);
    const pickedIds = []; // accumulates across units so unit 2 doesn't get the same responder as unit 1

    for (let unitIndex = 0; unitIndex < unitsNeeded; unitIndex++) {
      // Already has an active dispatch for this exact unit slot? No open
      // recommendation needed for it.
      const activeDeployment = await Deployment.findOne({
        incidentId: incident._id, status: 'active', resourceType: responderType, unitIndex
      });
      if (activeDeployment) {
        await Recommendation.updateMany(
          { incidentId: incident._id, resourceType: responderType, unitIndex, status: 'pending' },
          { status: 'expired', resolvedAt: new Date(), updatedAt: new Date() }
        );
        if (activeDeployment.resourceId) pickedIds.push(activeDeployment.resourceId);
        continue;
      }

      // Exclude every responder already tried for THIS incident+type+unit
      // slot, even from a previous run of this function (not just this
      // call's `pickedIds`) — otherwise a responder that already timed out
      // and got escalated away keeps getting picked again every time
      // something elsewhere in the system triggers a resync, fighting the
      // escalation timer forever instead of ever giving up cleanly.
      const priorAttempts = await Deployment.find({
        incidentId: incident._id, resourceType: responderType, unitIndex
      }).select('resourceId');
      const excludeForThisUnit = [...pickedIds, ...priorAttempts.map(d => d.resourceId)];

      const { responder, distanceKm } = await pickBestResponder(
        coords.lat, coords.lng, responderType, excludeForThisUnit
      );
      if (responder) pickedIds.push(responder._id);

      const demand = await computeEmergencyDemand(coords.lat, coords.lng, responderType, incident._id);
      const score = (SEVERITY_WEIGHT[incident.severity] || 0) + demand.score;
      const priority = score > 60 ? 'critical' : score > 30 ? 'high' : score > 10 ? 'medium' : 'low';

      const label = incident.location?.address || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
      const clusterNote = demand.nearbyIncidents > 0
        ? ` ${demand.nearbyIncidents} other nearby incident${demand.nearbyIncidents > 1 ? 's' : ''} also need${demand.nearbyIncidents > 1 ? '' : 's'} ${responderType}.`
        : '';
      const unitLabel = unitsNeeded > 1 ? ` (unit ${unitIndex + 1} of ${unitsNeeded} — ${incident.casualtyCount} people reported affected)` : '';

      const reason = responder
        ? `A ${incident.severity} ${incident.type} incident (${incident.incidentId}) was reported at ${label}. ` +
          `${responder.name} is the nearest suitable ${responderType} responder` +
          `${Number.isFinite(distanceKm) ? `, ${distanceKm.toFixed(2)} km away` : ''}.${unitLabel}${clusterNote}`
        : `A ${incident.severity} ${incident.type} incident (${incident.incidentId}) was reported at ${label}, ` +
          `but no ${responderType} responder is currently on record.${unitLabel}${clusterNote}`;

      const update = {
        incidentId: incident._id,
        incidentDisplayId: incident.incidentId,
        incidentType: incident.type,
        severity: incident.severity,
        area: label,
        incidentLat: coords.lat,
        incidentLng: coords.lng,
        resourceType: responderType,
        unitIndex,
        recommendedResourceId: responder ? responder._id : null,
        recommendedResourceName: responder ? responder.name : null,
        distanceKm: Number.isFinite(distanceKm) ? +distanceKm.toFixed(2) : null,
        demandScore: score,
        priority,
        reason,
        status: 'pending',
        updatedAt: new Date()
      };

      // Critical severity skips the approval queue entirely — dispatch
      // right now, the same way the SOS flow already behaves, instead of
      // sitting in the Allocation tab waiting for a human. Medium/high
      // still need admin/officer approval; low never gets a recommendation
      // at all (handled above).
      if (incident.severity === 'critical' && responder) {
        const result = await dispatchResponder(
          responder._id,
          { lat: coords.lat, lng: coords.lng, label },
          reason,
          'system (auto-critical)'
        );
        result.deployment.incidentId = incident._id;
        result.deployment.unitIndex = unitIndex;
        await result.deployment.save();

        const rec = await Recommendation.findOneAndUpdate(
          { incidentId: incident._id, resourceType: responderType, unitIndex },
          {
            ...update,
            status: 'approved',
            resolvedAt: new Date(),
            deploymentId: result.deployment._id
          },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        results.push(rec);
        continue;
      }

      const rec = await Recommendation.findOneAndUpdate(
        { incidentId: incident._id, resourceType: responderType, unitIndex, status: 'pending' },
        update,
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      results.push(rec);
    }
  }

  return results;
}

async function recalcActiveRecommendations() {
  const incidents = await Incident.find({ status: { $in: ['active', 'responding'] } });
  const results = [];
  for (const inc of incidents) {
    const recs = await syncRecommendationForIncident(inc._id);
    results.push(...recs);
  }
  return results;
}

// ══════════════════════════════════════════════════════
// ── ESCALATION TIMERS ──────────────────────────────────
// ══════════════════════════════════════════════════════
// Called periodically from server.js (every 30s — see that file). Two
// independent checks, both escalating to the next-nearest responder of the
// SAME type, skipping whichever one already failed to respond in time:
//
//   1. CRITICAL dispatches unconfirmed after 2 minutes — the responder was
//      auto-dispatched (see syncRecommendationForIncident) but nobody in
//      the Responder Manager marked it confirmed/en route in time.
//   2. medium/high recommendations still 'pending' (nobody approved or
//      rejected it) after 5 minutes — the system stops waiting for a human
//      and dispatches itself, same as it would have on approval.

const CRITICAL_CONFIRM_TIMEOUT_MS = 2 * 60 * 1000;
const APPROVAL_TIMEOUT_MS         = 5 * 60 * 1000;

async function escalateUnconfirmedCritical() {
  const cutoff = new Date(Date.now() - CRITICAL_CONFIRM_TIMEOUT_MS);

  const stale = await Deployment.find({
    status: 'active',
    confirmedAt: null,
    dispatchedAt: { $lte: cutoff },
    incidentId: { $ne: null }
  });

  const escalated = [];

  for (const dep of stale) {
    const incident = await Incident.findById(dep.incidentId);
    if (!incident || incident.severity !== 'critical' || incident.status === 'resolved') continue;

    // Every responder already tried for this incident+type, so the next
    // pick skips all of them, not just the most recent one.
    const priorAttempts = await Deployment.find({
      incidentId: dep.incidentId, resourceType: dep.resourceType
    }).select('resourceId');
    const excludeIds = priorAttempts.map(d => d.resourceId);

    // Release the unresponsive one (this also completes/cancels below via
    // its own Deployment lookup, but we want a specific cancelReason on
    // THIS deployment, so update it directly rather than through
    // releaseResponder()'s generic path)
    const responderDoc = await Responder.findById(dep.resourceId);
    if (responderDoc && (responderDoc.currentLoad || 0) > 0) {
      await Responder.findByIdAndUpdate(dep.resourceId, { $inc: { currentLoad: -1 } });
    }
    dep.status = 'cancelled';
    dep.cancelReason = 'Unconfirmed within 2 minutes — escalated to next-nearest responder';
    dep.completedAt = new Date();
    await dep.save();

    const coords = incident.location?.coordinates;
    if (!coords?.lat) continue;

    const { responder: next, distanceKm } = await pickBestResponder(
      coords.lat, coords.lng, dep.resourceType, excludeIds
    );
    if (!next) {
      console.warn(`Escalation: no other ${dep.resourceType} responder available for ${incident.incidentId}`);
      continue;
    }

    const label = incident.location?.address || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
    const result = await dispatchResponder(
      next._id,
      { lat: coords.lat, lng: coords.lng, label },
      `Escalated from ${dep.resourceName} (unconfirmed within 2 minutes) for critical ${incident.type} at ${label}.`,
      'system (escalation)'
    );
    result.deployment.incidentId = incident._id;
    result.deployment.unitIndex = dep.unitIndex;
    await result.deployment.save();

    escalated.push({ incidentId: incident._id, from: dep.resourceName, to: next.name, distanceKm });
  }

  return escalated;
}

async function escalateStaleRecommendations() {
  const cutoff = new Date(Date.now() - APPROVAL_TIMEOUT_MS);

  const stale = await Recommendation.find({
    status: 'pending',
    createdAt: { $lte: cutoff },
    recommendedResourceId: { $ne: null }
  });

  const escalated = [];

  for (const rec of stale) {
    try {
      const result = await dispatchResponder(
        rec.recommendedResourceId,
        { lat: rec.incidentLat, lng: rec.incidentLng, label: rec.area },
        `${rec.reason} (auto-approved — no response within 5 minutes)`,
        'system (escalation)'
      );
      result.deployment.incidentId = rec.incidentId;
      result.deployment.unitIndex = rec.unitIndex;
      await result.deployment.save();

      rec.status = 'approved';
      rec.resolvedAt = new Date();
      rec.updatedAt = new Date();
      rec.deploymentId = result.deployment._id;
      await rec.save();

      escalated.push({ recommendationId: rec._id, responder: result.responder.name });
    } catch (err) {
      console.error(`Escalation approve failed for recommendation ${rec._id}:`, err.message);
    }
  }

  return escalated;
}

// Single entry point server.js calls on its timer.
async function checkEscalations() {
  const [critical, pending] = await Promise.all([
    escalateUnconfirmedCritical(),
    escalateStaleRecommendations()
  ]);
  if (critical.length || pending.length) {
    console.log(`[ESCALATION] ${critical.length} critical re-dispatched, ${pending.length} pending auto-approved`);
  }
  return { critical, pending };
}

module.exports = {
  dispatchResponder,
  releaseResponder,
  computeEmergencyDemand,
  syncRecommendationForIncident,
  recalcActiveRecommendations,
  checkEscalations,
  haversine
};