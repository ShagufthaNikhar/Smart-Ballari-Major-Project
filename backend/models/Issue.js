// ===================================================================
//  SAVE THIS AS:   backend/models/Issue.js
//  This is the MONGOOSE MODEL. It must start with require('mongoose').
// ===================================================================
const mongoose = require('mongoose');
const Counter = require('./Counter');
const { DEPARTMENT_KEYS, STATUSES } = require('../config/departments');

// One entry per status change. `message` and `updatedBy` are INTERNAL -
// the citizen serializer keeps only `status` and `timestamp`.
const statusEventSchema = new mongoose.Schema({
  status:    { type: String, enum: STATUSES, required: true },
  message:   { type: String },
  updatedBy: { type: String },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const issueSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String },

  category: {
    type: String,
    enum: DEPARTMENT_KEYS,          // road | water | electric | sanitation | other
    default: 'other',
    index: true
  },

  status: {
    type: String,
    enum: STATUSES,                 // open | pending | accepted | in-progress | resolved | rejected
    default: 'open',
    index: true
  },

  location: {
    coordinates: { lat: Number, lng: Number },
    address: { type: String }
  },

  imageUrl: { type: String },
  imageRef: { type: String },       // Cloudinary public_id - INTERNAL

  reportedBy: { type: String, index: true },   // citizen's email

  // ── OFFICER ASSIGNMENT (internal - never in the citizen payload) ──
  assignedOfficer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedTo:      { type: String },   // DEPRECATED legacy string, kept for old rows
  officerRemarks:  { type: String },
  acceptedAt:      { type: Date },
  resolvedAt:      { type: Date },
  resolutionEvidenceUrl: { type: String },

  grievanceId: { type: String, unique: true, index: true },   // SB-2026-00007

  timeline: { type: [statusEventSchema], default: [] },

  flags:     { type: Number, default: 0 },        // moderation - internal
  flaggedBy: { type: [String], default: [] },     // UIDs - prevents repeat flags

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },

  aiTagged: { type: Boolean, default: false },
  aiConf:   { type: Number },                     // percentage 0-100 - internal

  // What the server-side classifier suggested, kept separate from `category`
  // because the client picks the final value. Disagreement = reroute candidate.
  aiSuggestedCategory: { type: String },

  upvotes:   { type: [String], default: [] },     // UIDs - counts only leave the server
  downvotes: { type: [String], default: [] },     // UIDs - counts only leave the server
  voteScore: { type: Number, default: 0 },
  verified:  { type: Boolean, default: false },

  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },

  reporterTrustScore: { type: Number, default: 50 }   // internal
});

issueSchema.index({ category: 1, status: 1, createdAt: -1 });

// SB-YYYY-NNNNN  e.g. SB-2026-00007
const TICKET_PREFIX = 'SB';
const TICKET_PAD = 5;

function formatGrievanceId(year, seq) {
  return `${TICKET_PREFIX}-${year}-${String(seq).padStart(TICKET_PAD, '0')}`;
}

issueSchema.pre('save', async function () {
  if (!this.grievanceId) {
    // Atomic per-year counter. countDocuments() was racy and reused IDs
    // after any deletion.
    const year = new Date().getFullYear();
    const seq  = await Counter.next(`issue-${year}`);
    this.grievanceId = formatGrievanceId(year, seq);
  }

  if (this.isNew && this.timeline.length === 0) {
    this.timeline.push({
      status:    'open',
      message:   'Issue reported and registered.',
      updatedBy: this.reportedBy || 'citizen',
      timestamp: new Date()
    });
  }

  this.updatedAt = new Date();
});

/**
 * Records a status change. Always use this instead of setting `status`
 * directly, so the timeline never drifts out of sync with the status.
 */
issueSchema.methods.transitionTo = function (status, actorUid, message) {
  this.status = status;
  this.timeline.push({ status, message, updatedBy: actorUid, timestamp: new Date() });
  if (status === 'accepted' && !this.acceptedAt) this.acceptedAt = new Date();
  if (status === 'resolved') this.resolvedAt = new Date();
  return this;
};

const Issue = mongoose.model('Issue', issueSchema);
Issue.formatGrievanceId = formatGrievanceId;
module.exports = Issue;