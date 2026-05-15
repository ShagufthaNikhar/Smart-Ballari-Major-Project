const mongoose = require('mongoose');

const updateSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String, required: true },
  area: {
    type: String,
    enum: ['ballari-city', 'hospet', 'siruguppa', 'sandur', 'kudligi', 'all'],
    default: 'all'
  },
  type: {
    type: String,
    enum: ['notice', 'maintenance', 'emergency', 'event'],
    default: 'notice'
  },
  isActive:   { type: Boolean, default: true },
  postedBy:   { type: String },             // municipality user email
  expiresAt:  { type: Date },               // optional expiry
  createdAt:  { type: Date, default: Date.now }
});

module.exports = mongoose.model('MunicipalityUpdate', updateSchema);