const CitizenTrust = require('../models/CitizenTrust');
const Issue        = require('../models/Issue');

// ── BADGE DEFINITIONS ─────────────────────────────────
const BADGES = {
  first_report:    { name: 'First Report',     emoji: '📌', threshold: 1  },
  five_reports:    { name: 'Active Reporter',  emoji: '🌟', threshold: 5  },
  ten_reports:     { name: 'Civic Champion',   emoji: '🏆', threshold: 10 },
  first_resolved:  { name: 'Problem Solver',   emoji: '✅', threshold: 1  },
  trusted:         { name: 'Trusted Citizen',  emoji: '🛡️', threshold: 75 },
  super_voter:     { name: 'Community Voice',  emoji: '👥', threshold: 20 },
  champion:        { name: 'City Champion',    emoji: '🎖️', threshold: 90 }
};

// ── SCORE RULES ───────────────────────────────────────
const SCORE_RULES = {
  report_submitted:    +2,
  report_resolved:     +10,
  upvote_received:     +3,
  downvote_received:   -2,
  report_flagged:      -8,
  vote_given:          +1,
  streak_bonus:        +5    // 3 reports in a week
};

// ── GET OR CREATE TRUST PROFILE ───────────────────────
async function getOrCreate(uid, email) {
  let trust = await CitizenTrust.findOne({ uid });
  if (!trust) {
    trust = await CitizenTrust.create({ uid, email });
  }
  return trust;
}

// ── APPLY SCORE DELTA ─────────────────────────────────
async function applyDelta(uid, email, rule, meta = '') {
  const delta = SCORE_RULES[rule] || 0;
  if (delta === 0) return null;

  const trust = await getOrCreate(uid, email);

  // Clamp score 0–100
  trust.score = Math.max(0, Math.min(100, trust.score + delta));

  // Update activity counts
  if (rule === 'report_submitted')    trust.totalReports++;
  if (rule === 'report_resolved')     trust.resolvedReports++;
  if (rule === 'upvote_received')     trust.upvotesReceived++;
  if (rule === 'flagged')             trust.flaggedReports++;
  if (rule === 'vote_given')          trust.votesGiven++;

  // Log history
  trust.history.push({
    delta,
    reason:    `${rule}${meta ? ': ' + meta : ''}`,
    timestamp: new Date()
  });

  // Keep history to last 20 entries
  if (trust.history.length > 20) {
    trust.history = trust.history.slice(-20);
  }

  trust.updatedAt = new Date();
  await trust.save();

  // Check badges
  await checkBadges(trust);

  return trust;
}

// ── BADGE CHECK ───────────────────────────────────────
async function checkBadges(trust) {
  const earned = trust.badges.map(b => b.id);
  const toAdd  = [];

  if (!earned.includes('first_report') && trust.totalReports >= 1)
    toAdd.push('first_report');
  if (!earned.includes('five_reports') && trust.totalReports >= 5)
    toAdd.push('five_reports');
  if (!earned.includes('ten_reports') && trust.totalReports >= 10)
    toAdd.push('ten_reports');
  if (!earned.includes('first_resolved') && trust.resolvedReports >= 1)
    toAdd.push('first_resolved');
  if (!earned.includes('trusted') && trust.score >= 75)
    toAdd.push('trusted');
  if (!earned.includes('super_voter') && trust.votesGiven >= 20)
    toAdd.push('super_voter');
  if (!earned.includes('champion') && trust.score >= 90)
    toAdd.push('champion');

  if (toAdd.length) {
    toAdd.forEach(id => {
      const badge = BADGES[id];
      trust.badges.push({ id, ...badge });
    });
    await trust.save();
  }

  return toAdd;
}

// ── RECALCULATE ISSUE PRIORITY ─────────────────────────
// Called after every vote
function calculatePriority(issue) {
  const voteScore  = issue.voteScore || 0;
  const trustBoost = (issue.reporterTrustScore || 50) / 100;
  const ageDays    = (Date.now() - new Date(issue.createdAt)) /
                     (1000 * 86400);

  // Score formula: votes + trust + recency
  const score =
    (voteScore  * 2)    +  // vote weight
    (trustBoost * 10)   +  // reporter credibility
    (Math.max(0, 7 - ageDays));  // recency bonus

  if (score >= 20)  return 'critical';
  if (score >= 12)  return 'high';
  if (score >= 5)   return 'medium';
  return 'low';
}

// ── LEADERBOARD ───────────────────────────────────────
async function getLeaderboard(limit = 10) {
  return CitizenTrust.find()
    .sort({ score: -1 })
    .limit(limit)
    .select('email score level badges totalReports resolvedReports');
}

module.exports = {
  getOrCreate, applyDelta,
  calculatePriority, getLeaderboard, BADGES, SCORE_RULES
};