const mongoose = require('mongoose');

const responderSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  type:     {
    type: String,
    enum: ['hospital', 'police', 'fire'],
    required: true
  },
  phone:    { type: String, required: true },
  address:  { type: String },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  isActive:    { type: Boolean, default: true },
  available:   { type: Boolean, default: true },
  capacity:    { type: Number, default: 10 },
  currentLoad: { type: Number, default: 0 }
});

module.exports = mongoose.model('Responder', responderSchema);