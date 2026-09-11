const mongoose = require('mongoose');

const routeStopSchema = new mongoose.Schema({
  ward: { type: Number, required: true },
  area: { type: String },   // real named micro-area, e.g. "Siruguppa Main Road / Bomb Bazar"
  lat:  { type: Number, required: true },
  lng:  { type: Number, required: true }
}, { _id: false });

const resourceSchema = new mongoose.Schema({
  name:   { type: String, required: true },
  type: {
    type: String,
    enum: ['garbage-truck', 'ambulance', 'police-van',
           'water-tanker', 'fire-truck'],
    required: true
  },
  status: {
    type: String,
    enum: ['available', 'deployed', 'maintenance', 'returning'],
    default: 'available'
  },
  location: {
    lat: { type: Number },
    lng: { type: Number },
    area: { type: String }
  },
  capacity:    { type: Number, default: 100 },
  currentLoad: { type: Number, default: 0   },
  assignedTo:  { type: String },   // area name
  lastDeployed:{ type: Date   },
  createdAt:   { type: Date, default: Date.now },

  // ── D2D fleet metadata (from Ballari City Corporation vehicle list) ──
  driverName:     { type: String },
  driverMobile:   { type: String },
  vehicleNo:      { type: String },
  vehicleModel:   { type: String },   // e.g. "WINNER AUTO", "TRACTOR"
  wetDrySegregation: { type: Boolean },
  division:       { type: String },   // e.g. "1ST DIVISION"
  wardsServed:    [{ type: Number }], // kept for reference/back-compat; routeStops is now the source of truth for simulation

  // Ordered, real named micro-area stops for this truck's daily route —
  // reconstructed from the official area descriptions and precise
  // coordinates (ballari_d2d_vehicle_areas_3decimal.geojson), allocated to
  // this vehicle in original document order and proportioned across its
  // wardsServed. This is what config/garbageSimulator.js actually walks
  // through — far more accurate than a single centroid per ward.
  routeStops: {
    type: [routeStopSchema],
    default: []
  },

  // Daily route start time, e.g. "07:00". Not in the source vehicle-list
  // data (assumption, defaulted at seed time); only meaningful for
  // garbage-truck resources.
  dailyStartTime: { type: String, default: '07:00' }
});

module.exports = mongoose.model('Resource', resourceSchema);