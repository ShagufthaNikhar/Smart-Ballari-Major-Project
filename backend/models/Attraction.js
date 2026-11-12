/**
 * Covers everything from the "things to do" geojson that isn't already a
 * FoodPlace: heritage sites, nature spots, shopping, hotels, entertainment,
 * events venues, and general things-to-do (walks, cycling, viewpoints).
 *
 * COORDINATES: the original 42-record import had none (source explicitly
 * left them null pending verification). A later, separately-sourced import
 * (Infantry Road, strictly-verified) added the first entries with real
 * lat/lng — `location` stays nullable so both kinds coexist; check
 * `coordinatesVerified` before trusting a pin over the address-based maps
 * fallback (see openMaps's fallbackQuery param in app.js).
 *
 * Populated by scripts/importAttractionsData.js. Records are upserted on
 * `slug`, same pattern as FoodPlace and Place.
 */
const mongoose = require('mongoose');

const attractionSchema = new mongoose.Schema({
  slug:        { type: String, required: true, unique: true },
  name:        { type: String, required: true },
  category:    { type: String, required: true }, // tourist_attraction | heritage | nature | shopping | hotel | entertainment | events | things_to_do
  subcategory: String,

  address: String,
  location: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null }
  },

  phone:       { type: String, default: null },
  description: { type: String, default: null },

  // Not present in the original 42-record source; added for later imports
  // (e.g. Infantry Road) that do have them
  rating:       { type: Number, default: null },
  reviewCount:  { type: Number, default: null },
  openingHours: { type: String, default: null },

  source:              String,
  verified:            { type: Boolean, default: false },
  lastVerified:        String,  // e.g. "2026-09-07"
  coordinatesVerified: { type: Boolean, default: false }
}, { timestamps: true });

attractionSchema.index({ category: 1 });
attractionSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Attraction', attractionSchema);