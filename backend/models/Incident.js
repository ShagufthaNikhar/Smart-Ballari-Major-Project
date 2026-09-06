const mongoose = require('mongoose');
const Counter  = require('./Counter');

const incidentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['accident', 'fire', 'medical', 'crime', 'flood', 'other'],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  description: { type: String, required: true },
  location: {
    coordinates: { lat: Number, lng: Number },
    address:     { type: String }
  },
  status: {
    type: String,
    enum: ['active', 'responding', 'resolved'],
    default: 'active'
  },
  reportedBy:  { type: String },
  assignedTo:  { type: String },   // responder email
  responderType: { type: String }, // 'hospital' | 'police' | 'fire'
  incidentId:  { type: String, unique: true, sparse: true },
  resolvedAt:  { type: Date },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now }
});

// Auto-generate incident ID.
// Two fixes here: no `next` parameter (Mongoose 9 awaits async middleware and
// passes no callback, so next() threw and every incident save failed), and an
// atomic Counter instead of countDocuments(), which reused IDs after any
// deletion. Both match what models/Issue.js already does for grievanceId.
incidentSchema.pre('save', async function () {
  if (this.incidentId) return;
  const year = new Date().getFullYear();
  const seq  = await Counter.next(`incident-${year}`);
  this.incidentId = `INC-${year}-${String(seq).padStart(4, '0')}`;
});

module.exports = mongoose.model('Incident', incidentSchema);