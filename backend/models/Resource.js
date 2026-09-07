const mongoose = require('mongoose');

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
  // Optional on purpose: only garbage-truck resources sourced from the
  // real municipal register populate these. Nothing else in the schema
  // changes, so existing frontend/table code keeps working unmodified.
  driverName:     { type: String },
  driverMobile:   { type: String },
  vehicleNo:      { type: String },
  vehicleModel:   { type: String },   // e.g. "WINNER AUTO", "TRACTOR"
  wetDrySegregation: { type: Boolean },
  division:       { type: String },   // e.g. "1ST DIVISION"
  wardsServed:    [{ type: Number }]  // a vehicle can cover more than one ward
});

module.exports = mongoose.model('Resource', resourceSchema);