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

  // How many people are affected/injured — drives multi-unit ambulance
  // dispatch (see config/allocationEngine.js's neededUnits()). Optional on
  // purpose: most incidents don't need it (a single fire or crime report
  // is one incident regardless of a headcount), so it only actually
  // changes anything for medical/accident/fire types. Defaults to 1.
  casualtyCount: { type: Number, default: 1, min: 1, max: 20 },

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

  // Lightweight acknowledgment — a manager marking "I've seen this",
  // separate from dispatch/approval entirely. Doesn't affect any workflow,
  // just visibility.
  seenByManager: { type: Boolean, default: false },
  seenAt:         { type: Date, default: null },
  seenBy:          { type: String, default: null },

  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now }
});

incidentSchema.pre('save', async function () {
  if (this.incidentId) return;
  const year = new Date().getFullYear();
  const seq  = await Counter.next(`incident-${year}`);
  this.incidentId = `INC-${year}-${String(seq).padStart(4, '0')}`;
});

module.exports = mongoose.model('Incident', incidentSchema);