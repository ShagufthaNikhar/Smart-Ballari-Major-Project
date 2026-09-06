const mongoose = require('mongoose');

/**
 * A point of interest for the Explore module.
 *
 * Source is OpenStreetMap via Overpass. That matters legally: OSM is ODbL,
 * so this data CAN be stored in our own database as long as we credit
 * "© OpenStreetMap contributors" wherever it is shown. Google Places data
 * cannot be stored this way - its terms only permit caching the place_id -
 * so Places stays a live lookup and never lands in this collection.
 *
 * These are the supporting cast for the itinerary builder. The six curated
 * monuments in the Monument collection are the headline sights and are
 * deliberately NOT duplicated here; the importer skips them by name.
 */
const placeSchema = new mongoose.Schema({
  // OSM identity, so a re-import updates rather than duplicates
  osmType: { type: String, enum: ['node', 'way', 'relation'], required: true },
  osmId:   { type: Number, required: true },

  name:        { type: String, required: true, trim: true },
  nameKannada: { type: String },

  // Coarse bucket the itinerary builder plans against
  category: {
    type: String, required: true, index: true,
    enum: ['monument','temple','museum','viewpoint','park',
           'nature','attraction','family','information']
  },
  // The raw OSM tag it came from, kept so we can reclassify later
  osmTag: { type: String },

  town: { type: String, index: true },   // Hampi | Hospet | Sandur | Ballari | Anegundi

  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },

  // Rough dwell time in minutes. Used to fit stops into a day; it is an
  // estimate from the category, not a measured figure.
  visitMinutes: { type: Number, default: 30 },

  // 0-100. Drives ordering when a town has 150 temples and a day has room
  // for four stops. Higher = more likely to interest a visitor.
  rank: { type: Number, default: 50, index: true },

  religion:    { type: String },
  denomination:{ type: String },
  material:    { type: String },
  address:     { type: String },
  wikidata:    { type: String },
  wikipedia:   { type: String },

  attribution: { type: String, default: '© OpenStreetMap contributors (ODbL)' },
  isActive:    { type: Boolean, default: true }
}, { timestamps: true });

placeSchema.index({ osmType: 1, osmId: 1 }, { unique: true });
placeSchema.index({ town: 1, category: 1, rank: -1 });

placeSchema.methods.toPublic = function () {
  return {
    id: this._id,
    name: this.name,
    nameKannada: this.nameKannada,
    category: this.category,
    town: this.town,
    location: this.location,
    visitMinutes: this.visitMinutes,
    religion: this.religion,
    address: this.address,
    wikipedia: this.wikipedia,
    attribution: this.attribution
  };
};

module.exports = mongoose.model('Place', placeSchema);