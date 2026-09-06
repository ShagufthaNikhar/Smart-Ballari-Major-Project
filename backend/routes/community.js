const express     = require('express');
const router      = express.Router();
const Issue       = require('../models/Issue');
const CitizenTrust = require('../models/CitizenTrust');
const verifyToken  = require('../middleware/verifyToken');
const {
  getOrCreate, applyDelta,
  calculatePriority, getLeaderboard
} = require('../config/trustEngine');

// ── VOTE ON ISSUE ─────────────────────────────────────
router.post(
  '/issues/:id/vote',
  verifyToken,
  async (req, res) => {
    try {
      const { vote } = req.body;  // 'up' | 'down' | 'remove'
      const uid      = req.user.uid;
      const email    = req.user.email;

      const issue = await Issue.findById(req.params.id);
      if (!issue) return res.status(404).json({ error: 'Issue not found' });

      // Remove existing vote
      issue.upvotes   = issue.upvotes.filter(u => u !== uid);
      issue.downvotes = issue.downvotes.filter(u => u !== uid);

      // Apply new vote
      if (vote === 'up')   issue.upvotes.push(uid);
      if (vote === 'down') issue.downvotes.push(uid);

      // Recalculate score
      issue.voteScore = issue.upvotes.length - issue.downvotes.length;

      // Auto-verify at threshold
      if (issue.upvotes.length >= 5 && !issue.verified) {
        issue.verified = true;
      }

      // Recalculate priority
      issue.priority = calculatePriority(issue);

      await issue.save();

      // Trust score: voter gets +1
      await applyDelta(uid, email, 'vote_given', issue.title);

      // Trust score: reporter gets upvote/downvote delta
      if (issue.reportedBy && vote !== 'remove') {
        const reporter = await CitizenTrust.findOne({
          email: issue.reportedBy
        });
        if (reporter) {
          await applyDelta(
            reporter.uid, reporter.email,
            vote === 'up' ? 'upvote_received' : 'downvote_received',
            issue.title
          );
        }
      }

      res.json({
        upvotes:   issue.upvotes.length,
        downvotes: issue.downvotes.length,
        voteScore: issue.voteScore,
        verified:  issue.verified,
        priority:  issue.priority,
        userVote:  vote
      });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── GET MY TRUST PROFILE ──────────────────────────────
router.get(
  '/trust/me',
  verifyToken,
  async (req, res) => {
    try {
      const trust = await getOrCreate(
        req.user.uid, req.user.email
      );
      res.json(trust);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── GET LEADERBOARD ───────────────────────────────────
router.get('/leaderboard', async (req, res) => {
  try {
    const board = await getLeaderboard(10);
    res.json(board);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── FLAG ISSUE ────────────────────────────────────────
router.post(
  '/issues/:id/flag',
  verifyToken,
  async (req, res) => {
    try {
      const issue = await Issue.findById(req.params.id);
      if (!issue) return res.status(404).json({ error: 'Not found' });

      // The schema carries flaggedBy specifically to stop repeat flags, but
      // this route used a blind $inc and never looked at it, so one user
      // could flag the same grievance any number of times.
      const uid = req.user.uid;
      if (issue.flaggedBy.includes(uid)) {
        return res.status(409).json({
          error: 'You have already flagged this grievance',
          flags: issue.flags
        });
      }

      issue.flaggedBy.push(uid);
      issue.flags = issue.flaggedBy.length;

      // Three independent flags demotes it for moderator review. It does not
      // close or hide the grievance - the previous comment said "auto-close"
      // but the code only changed priority, so the behaviour is spelled out
      // here instead of being implied.
      if (issue.flags >= 3 && issue.priority !== 'low') {
        issue.priority = 'low';
        issue.timeline.push({
          status:    issue.status,
          message:   'Flagged by multiple citizens - pending moderator review.',
          updatedBy: 'system',
          timestamp: new Date()
        });
      }

      await issue.save();
      res.json({ flags: issue.flags, flagged: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── GET ISSUE VOTES ───────────────────────────────────
router.get(
  '/issues/:id/votes',
  verifyToken,
  async (req, res) => {
    try {
      const issue = await Issue.findById(req.params.id)
        .select('upvotes downvotes voteScore verified priority');

      const uid = req.user.uid;
      res.json({
        upvotes:   issue.upvotes.length,
        downvotes: issue.downvotes.length,
        voteScore: issue.voteScore,
        verified:  issue.verified,
        priority:  issue.priority,
        userVote:  issue.upvotes.includes(uid)   ? 'up'
                 : issue.downvotes.includes(uid) ? 'down'
                 : null
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;