const mongoose = require('mongoose');

// A Recommendation is the system's suggestion: "deploy resource X to
// respond to incident Y". It never changes Resource.status by itself —
// only an admin approval (see routes/resources.js POST /recommendations/:id/approve)
// does that. This keeps "what the system thinks should happen" separate
// from "what actually happened" (Deployment).
const recommendationSchema = new mongoose.Schema({
  incidentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Incident',
    required: true
  },
  // Denormalized display fields so the dashboard doesn't need to populate
  // Incident on every poll — cheap to keep in sync since we rewrite this
  // doc every time syncRecommendationForIncident() runs anyway.
  incidentDisplayId: { type: String },   // e.g. "INC-2026-0004"
  incidentType:       { type: String },
  severity:            { type: String },
  // Free-text location label (the incident's own address, or "lat, lng" if
  // it has none) — NOT a ward. Distance/matching is computed straight from
  // incidentLat/incidentLng below; this field is display-only.
  area:                 { type: String },
  incidentLat:           { type: Number },
  incidentLng:           { type: Number },

  resourceType: { type: String, required: true },
  // Which unit this is when an incident needs more than one of the same
  // type (e.g. 2 casualties -> 2 ambulance recommendations). 0 for the
  // first/only one — most recommendations never go past 0.
  unitIndex: { type: Number, default: 0 },
  recommendedResourceId:   {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resource',
    default: null
  },
  recommendedResourceName: { type: String, default: null },
  distanceKm:               { type: Number, default: null },

  demandScore: { type: Number },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  reason: { type: String },

  status: {
    type: String,
    // pending   — awaiting admin decision
    // approved  — admin approved, resource deployed, see deploymentId
    // rejected  — admin explicitly said no
    // expired   — superseded automatically (incident resolved, resource
    //             taken by another deployment, severity dropped to low, etc.)
    enum: ['pending', 'approved', 'rejected', 'expired'],
    default: 'pending'
  },
  deploymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deployment',
    default: null
  },

  resolvedAt: { type: Date },
  createdAt:  { type: Date, default: Date.now },
  updatedAt:  { type: Date, default: Date.now }
});

// One pending recommendation per incident at a time — this is what makes
// recalculation idempotent instead of piling up duplicates. Enforced in
// code (findOneAndUpdate upsert keyed on incidentId+status:'pending') rather
// than a partial unique index, since a partial-filter unique index needs a
// Mongo-version-specific syntax and the application-level guarantee is
// sufficient for a single-process Node backend.
recommendationSchema.index({ status: 1, priority: 1, createdAt: -1 });
recommendationSchema.index({ incidentId: 1, resourceType: 1, unitIndex: 1, status: 1 });

module.exports = mongoose.model('Recommendation', recommendationSchema);