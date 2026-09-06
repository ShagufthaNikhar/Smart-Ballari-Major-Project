// ===================================================================
//  Monument — the data behind the Heritage AR module.
//
//  routes/heritage.js already had a static HERITAGE_SITES array, and the
//  existing ar-view.html reads it through /api/heritage/sites. That array
//  stays exactly where it is and keeps working; this model is the richer,
//  editable record the AR module needs (history, timeline, gallery, audio,
//  3D model URL) and is SEEDED from that array on startup so the two never
//  disagree about which monuments exist.
//
//  Everything the AR page needs is public. Nothing sensitive belongs here.
// ===================================================================
const mongoose = require('mongoose');

const timelineEntrySchema = new mongoose.Schema({
  year:  { type: String, required: true },   // '16th Century', '1769', 'Present day'
  title: { type: String, required: true },
  detail:{ type: String }
}, { _id: false });

const galleryImageSchema = new mongoose.Schema({
  url:     { type: String, required: true },
  caption: { type: String },
  // 'historical' | 'current' | 'architecture' | 'feature'
  kind:    { type: String, default: 'current' }
}, { _id: false });

const monumentSchema = new mongoose.Schema({
  // slug is the public identifier: it is what the QR code encodes and what
  // /api/heritage/monuments/:slug looks up. Never expose _id in QR URLs.
  slug: {
    type: String, required: true, unique: true, lowercase: true, trim: true,
    match: [/^[a-z0-9-]+$/, 'slug may contain only lowercase letters, digits and hyphens']
  },

  name:        { type: String, required: true },
  nameKannada: { type: String },
  type:        { type: String, default: 'monument' },   // fort | temple | sanctuary | monument

  shortDescription: { type: String },   // one line, for the card
  description:      { type: String },   // paragraph, for the detail panel
  history:          { type: String },   // longer narrative

  period:  { type: String },            // '16th Century'
  dynasty: { type: String },
  heritageCategory: { type: String },   // 'ASI protected', 'UNESCO World Heritage', ...

  location: {
    lat:     { type: Number },
    lng:     { type: Number },
    address: { type: String }
  },

  // ── AR assets ──
  // modelUrl is relative to the frontend (e.g. '../models/ballari-fort.glb').
  // usdzUrl is optional: model-viewer can generate USDZ on the fly for iOS
  // Quick Look, so a separate file is only needed if that output disappoints.
  modelUrl:   { type: String },
  usdzUrl:    { type: String },
  modelScale: { type: String, default: '1 1 1' },
  modelCredit:{ type: String },          // provenance - say how the model was made

  // Script for on-device speech synthesis. Preferred over audioUrl: the
  // phone's own voice is far better than anything we can ship, needs no
  // download and works offline. audioUrl stays as the fallback.
  narrationText: { type: String, default: null },

  audioUrl:   { type: String },          // narration, optional
  posterUrl:  { type: String },          // still shown while the model loads

  images:   { type: [galleryImageSchema], default: [] },
  timeline: { type: [timelineEntrySchema], default: [] },
  facts:    { type: [String], default: [] },

  isActive: { type: Boolean, default: true },

  // Anonymous counters only. No user identifiers are stored against a view.
  viewCount:   { type: Number, default: 0 },
  arLaunchCount:{ type: Number, default: 0 }
}, { timestamps: true });

monumentSchema.index({ name: 'text', shortDescription: 'text', description: 'text' });

/** Everything safe to hand to an unauthenticated page (i.e. the QR target). */
monumentSchema.methods.toPublic = function () {
  return {
    slug: this.slug,
    name: this.name,
    nameKannada: this.nameKannada,
    type: this.type,
    shortDescription: this.shortDescription,
    description: this.description,
    history: this.history,
    period: this.period,
    dynasty: this.dynasty,
    heritageCategory: this.heritageCategory,
    location: this.location,
    modelUrl: this.modelUrl,
    usdzUrl: this.usdzUrl,
    modelScale: this.modelScale,
    modelCredit: this.modelCredit,
    narrationText: this.narrationText,
    audioUrl: this.audioUrl,
    posterUrl: this.posterUrl,
    images: this.images,
    timeline: this.timeline,
    facts: this.facts
  };
};

module.exports = mongoose.model('Monument', monumentSchema);