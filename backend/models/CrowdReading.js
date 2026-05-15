const mongoose = require('mongoose');

const crowdReadingSchema = new mongoose.Schema({
  area:      { type: String, required: true },
  count:     { type: Number, required: true },   // estimated people
  density: {
    type: String,
    enum: ['low', 'moderate', 'high', 'critical'],
    default: 'low'
  },
  source: {
    type: String,
    enum: ['sensor', 'event', 'rule', 'manual', 'predicted'],
    default: 'rule'
  },
  eventId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  timestamp: { type: Date, default: Date.now }
});

crowdReadingSchema.index({ area: 1, timestamp: -1 });
module.exports = mongoose.model('CrowdReading', crowdReadingSchema);