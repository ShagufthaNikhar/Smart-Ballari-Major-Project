/**
 * Government office directory — was a static 12-entry array baked directly
 * into js/govt-offices.js with no backend at all. Now backed by Mongo,
 * populated by scripts/importGovtOfficesData.js.
 *
 * COORDINATE PRECISION: every office now has a location, but the two prior
 * imports of this dataset had none — this "strictly verified" version adds
 * them, split into two tiers:
 *   - coordinatesVerified: true  (26 of 45) — from a Google Maps Plus Code
 *     or business listing, safe to use as an exact pin.
 *   - coordinatesVerified: false (19 of 45) — an address-based approximation
 *     the source itself flags as "needs map verification". Still shown on
 *     the map, but the frontend marks these so a user doesn't mistake an
 *     estimate for a confirmed pin.
 * `placeId` (from Google) remains the most precise option for directions
 * when present, regardless of coordinatesVerified.
 */
const mongoose = require('mongoose');

const govtOfficeSchema = new mongoose.Schema({
  slug:     { type: String, required: true, unique: true },
  name:     { type: String, required: true },
  category: { type: String, required: true }, // e.g. 'police', 'revenue', 'municipal_government'
  type:     String,                            // human-readable office type, e.g. 'Taluk revenue office'

  address: String,
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },

  phone:   { type: String, default: null },
  placeId: { type: String, default: null }, // Google Place ID — most precise option for directions when present

  locationVerified:    { type: Boolean, default: false }, // address confirmed
  phoneVerified:        { type: Boolean, default: false },
  coordinatesVerified:  { type: Boolean, default: false }, // true = exact (Plus Code/listing), false = address-based approximation
  coordinateSource:     { type: String, default: null }
}, { timestamps: true });

govtOfficeSchema.index({ category: 1 });
govtOfficeSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('GovtOffice', govtOfficeSchema);