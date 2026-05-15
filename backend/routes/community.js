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
      const issue = await Issue.findByIdAndUpdate(
        req.params.id,
        { $inc: { flags: 1 } },
        { new: true }
      );

      // Auto-close if 3+ flags
      if ((issue.flags || 0) >= 3) {
        issue.status = 'open';
        issue.priority = 'low';
        await issue.save();
      }

      res.json({ flags: issue.flags || 0 });
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