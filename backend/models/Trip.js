const mongoose = require('mongoose');

/**
 * A generated day-by-day itinerary.
 *
 * Stops reference real records only: either a Monument (the six curated
 * heritage sites) or a Place (OSM-sourced POIs). Nothing here is free text
 * invented by a model — the planner picks from the database and every id is
 * re-validated before a trip is saved. See routes/explore.js.
 */
const stopSchema = new mongoose.Schema({
  kind:    { type: String, enum: ['monument', 'place'], required: true },
  refId:   { type: mongoose.Schema.Types.ObjectId, required: true },
  slug:    { type: String },            // monuments only, for the AR deep link
  name:    { type: String, required: true },
  town:    { type: String },
  category:{ type: String },
  location:{ lat: Number, lng: Number },

  startTime:    { type: String },       // '09:30'
  visitMinutes: { type: Number, default: 45 },
  // One line on why this stop is here. Written by the planner, about a place
  // that definitely exists.
  note:         { type: String }
}, { _id: false });

const daySchema = new mongoose.Schema({
  day:     { type: Number, required: true },
  title:   { type: String },
  baseTown:{ type: String },
  stops:   { type: [stopSchema], default: [] },
  travelNote: { type: String }
}, { _id: false });

const tripSchema = new mongoose.Schema({
  // Anonymous trips are allowed: a visitor should be able to plan without
  // signing up. uid is set only when the caller was authenticated.
  uid:   { type: String, index: true, default: null },
  email: { type: String, default: null },

  title:    { type: String, required: true },
  days:     { type: Number, required: true, min: 1, max: 7 },
  interests:{ type: [String], default: [] },
  pace:     { type: String, enum: ['relaxed', 'balanced', 'packed'], default: 'balanced' },
  startTown:{ type: String, default: 'Ballari' },
  travelWith:{ type: String, enum: ['solo','couple','family','friends'], default: 'family' },

  plan: { type: [daySchema], default: [] },

  // 'ai' when the model produced the selection, 'rules' when the deterministic
  // fallback did. Surfaced in the UI so nobody mistakes one for the other.
  generatedBy: { type: String, enum: ['ai', 'rules'], default: 'rules' },
  model:       { type: String },

  shareId: { type: String, unique: true, sparse: true, index: true },
  attribution: {
    type: String,
    default: 'Places © OpenStreetMap contributors (ODbL). Heritage content by Smart Ballari.'
  }
}, { timestamps: true });

tripSchema.methods.toPublic = function () {
  return {
    id: this._id,
    shareId: this.shareId,
    title: this.title,
    days: this.days,
    interests: this.interests,
    pace: this.pace,
    startTown: this.startTown,
    travelWith: this.travelWith,
    plan: this.plan,
    generatedBy: this.generatedBy,
    attribution: this.attribution,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('Trip', tripSchema);