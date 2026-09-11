const mongoose = require('mongoose');

const responderSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  type:     {
    type: String,
    enum: ['hospital', 'police', 'fire', 'ambulance'],
    required: true
  },
  // Only meaningful for type:'fire' right now — distinguishes a genuine
  // fire_station from other fire-tagged listings (equipment suppliers,
  // security services) sourced from the same geojson. dispatchAI.js
  // prefers category:'fire_station' first for actual fire incidents and
  // only falls back to the rest if no real station is close enough.
  category: { type: String },

  // Made optional: the seeded fire/ambulance data has no phone numbers yet
  // (source geojson doesn't include them). PLACEHOLDER_PHONE marks these
  // clearly as "not yet verified" rather than silently showing a blank —
  // update with a real number as you get it, then this can go back to
  // required once every responder actually has one.
  phone:    { type: String, default: 'PLACEHOLDER_PHONE' },

  address:  { type: String },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  isActive:    { type: Boolean, default: true },
  available:   { type: Boolean, default: true },
  capacity:    { type: Number, default: 10 },
  currentLoad: { type: Number, default: 0 },

  // How precise the source coordinate is — carried over from the geojson's
  // location_accuracy field so low-confidence pins can be flagged/reviewed
  // later rather than treated as verified.
  locationAccuracy: { type: String }
});

module.exports = mongoose.model('Responder', responderSchema);