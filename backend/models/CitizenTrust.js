const mongoose = require('mongoose');

const trustSchema = new mongoose.Schema({
  uid:   { type: String, required: true, unique: true },
  email: { type: String, required: true },

  // Score
  score:       { type: Number, default: 50 },   // 0–100
  level:       { type: String, default: 'newcomer' },

  // Activity counts
  totalReports:    { type: Number, default: 0 },
  resolvedReports: { type: Number, default: 0 },
  upvotesReceived: { type: Number, default: 0 },
  flaggedReports:  { type: Number, default: 0 },
  votesGiven:      { type: Number, default: 0 },

  // Badges earned
  badges: [
    {
      id:       String,
      name:     String,
      emoji:    String,
      earnedAt: { type: Date, default: Date.now }
    }
  ],

  // Score history
  history: [
    {
      delta:     Number,
      reason:    String,
      timestamp: { type: Date, default: Date.now }
    }
  ],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Auto-set level from score
trustSchema.pre('save', function (next) {
  const s = this.score;
  this.level =
    s >= 90 ? 'champion'  :
    s >= 75 ? 'trusted'   :
    s >= 60 ? 'active'    :
    s >= 40 ? 'regular'   :
    s >= 20 ? 'newcomer'  : 'unverified';
  next();
});

module.exports = mongoose.model('CitizenTrust', trustSchema);