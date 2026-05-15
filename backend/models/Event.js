const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  type: {
    type: String,
    enum: ['festival', 'market', 'political', 'sports', 'religious', 'other'],
    default: 'other'
  },
  area:        { type: String, required: true },
  location: {
    lat: { type: Number },
    lng: { type: Number }
  },
  expectedCrowd: { type: Number, default: 500 },  // people
  startTime:   { type: Date, required: true },
  endTime:     { type: Date, required: true },
  status: {
    type: String,
    enum: ['upcoming', 'active', 'ended'],
    default: 'upcoming'
  },
  surgeTriggered:   { type: Boolean, default: false },
  createdBy:        { type: String },
  createdAt:        { type: Date, default: Date.now }
});

eventSchema.index({ startTime: 1, status: 1 });
module.exports = mongoose.model('Event', eventSchema);