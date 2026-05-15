const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['water', 'traffic', 'power', 'crowd', 'sanitation', 'surge'],
    required: true
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'warning'
  },
  title:       { type: String, required: true },
  message:     { type: String, required: true },
  area:        { type: String },
  isActive:    { type: Boolean, default: true },
  triggeredBy: { type: String },   // rule name that fired
  value:       { type: Number },   // actual metric value
  threshold:   { type: Number },   // rule threshold
  resolvedAt:  { type: Date },
  createdAt:   { type: Date, default: Date.now }
});

alertSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model('Alert', alertSchema);