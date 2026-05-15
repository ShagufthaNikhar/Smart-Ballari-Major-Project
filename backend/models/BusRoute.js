const mongoose = require('mongoose');

const busRouteSchema = new mongoose.Schema({
  routeNumber: { type: String, required: true, unique: true },
  name:        { type: String, required: true },
  from:        { type: String, required: true },
  to:          { type: String, required: true },
  stops: [
    {
      name:     { type: String },
      lat:      { type: Number },
      lng:      { type: Number },
      sequence: { type: Number }
    }
  ],
  // Full polyline coordinates for replay
  polyline: [
    {
      lat: { type: Number },
      lng: { type: Number }
    }
  ],
  frequency:   { type: Number, default: 20 }, // mins between buses
  firstBus:    { type: String, default: '06:00' },
  lastBus:     { type: String, default: '22:00' },
  isActive:    { type: Boolean, default: true },
  color:       { type: String, default: '#38bdf8' }
});

module.exports = mongoose.model('BusRoute', busRouteSchema);