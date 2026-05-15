const mongoose = require('mongoose');

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

// Auto-generate incident ID
incidentSchema.pre('save', async function (next) {
  if (!this.incidentId) {
    const count = await mongoose.model('Incident').countDocuments();
    const year  = new Date().getFullYear();
    this.incidentId = `INC-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Incident', incidentSchema);