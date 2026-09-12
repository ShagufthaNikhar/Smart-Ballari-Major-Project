/**
 * A single collection for both food (restaurant/cafe) and stay
 * (hotel/lodge/resort/villa) places — mirrors how models/Place.js keeps
 * monuments, viewpoints, and parks together under one `category` field
 * instead of splitting into separate collections/files per type.
 *
 * Populated by scripts/importFoodData.js from a geojson export. Records are
 * upserted on `slug`, so re-running the import after a refreshed export
 * updates existing rows instead of duplicating them.
 */
const mongoose = require('mongoose');

const foodPlaceSchema = new mongoose.Schema({
  slug:     { type: String, required: true, unique: true }, // stable id, derived from name
  name:     { type: String, required: true },
  category: { type: String, required: true, enum: ['restaurant', 'cafe', 'hotel', 'lodge', 'resort', 'villa'] },

  address:  String,
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },

  rating:      { type: Number, default: null }, // null = not verified — never invented
  reviewCount: { type: Number, default: null },
  priceRange:  { type: String, default: null }, // '₹' | '₹₹' | '₹₹₹', bucketed from raw cost
  hours:       { type: String, default: null }, // not in the current source
  phone:       { type: String, default: null }, // not in the current source

  // food-only fields (unused/empty for hotel/lodge docs)
  cuisine:   { type: [String], default: [] },
  specialty: { type: String, default: null },
  mustTry:   { type: [String], default: [] },

  // stay-only field (unused for restaurant/cafe docs)
  roomPricePerNight: { type: Number, default: null },

  tags:  { type: [String], default: [] },
  image: { type: String, default: '📍' },

  source:              String, // provenance of the data, e.g. "LatLong.net"
  coordinatePrecision: String  // "verified" | "approximate"
}, { timestamps: true });

foodPlaceSchema.index({ category: 1 });
foodPlaceSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('FoodPlace', foodPlaceSchema);