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
  createdAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('Resource', resourceSchema);