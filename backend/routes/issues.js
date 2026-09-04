const express     = require('express');
const router      = express.Router();
const Issue       = require('../models/Issue');
const verifyToken = require('../middleware/verifyToken');
const requireRole = require('../middleware/requireRole');
const { upload, cloudinary } = require('../config/cloudinary');
const { toCitizenView, toPublicView } = require('../serializers/issue');
const { classifyWithTimeout } = require('../config/classifyGuard');
const { DEPARTMENT_KEYS, STATUSES } = require('../config/departments');

const CREATE_ALLOWED = ['title', 'description', 'category', 'location'];

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

const lower = e => (e || '').toLowerCase();

// ── PUBLIC ROUTES ───────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.category && DEPARTMENT_KEYS.includes(req.query.category)) {
      filter.category = req.query.category;
    }
    if (req.query.status) filter.status = req.query.status;

    const issues = await Issue.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(req.query.limit) || 100, 200))
      .lean();

    res.json(issues.map(toPublicView));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/recent', async (req, res) => {
  const issues = await Issue.find().sort({ createdAt: -1 }).limit(10).lean();
  res.json(issues.map(toPublicView));
});

router.get('/stats', async (req, res) => {
  const [total, open, accepted, inProgress, resolved, rejected] = await Promise.all([
    Issue.countDocuments(),
    Issue.countDocuments({ status: { $in: ['open', 'pending'] } }),
    Issue.countDocuments({ status: 'accepted' }),
    Issue.countDocuments({ status: 'in-progress' }),
    Issue.countDocuments({ status: 'resolved' }),
    Issue.countDocuments({ status: 'rejected' })
  ]);
  res.json({ total, open, accepted, inProgress, resolved, rejected });
});

// ── CITIZEN ROUTES ──────────────────────────────────
router.get('/mine', verifyToken, async (req, res) => {
  try {
    const issues = await Issue.find({ reportedBy: lower(req.user.email) })
      .sort({ createdAt: -1 })
      .lean();
    res.json(issues.map(toCitizenView));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/issues/track/:grievanceId
 *
 * Any signed-in user can look up any ticket - citizens are meant to see
 * each other's reports. Auth is still required because grievance IDs are
 * sequential, so an open endpoint would let anyone enumerate the whole
 * collection with a for loop.
 *
 * Your own ticket returns the full citizen view; someone else's returns
 * the public view, which drops the department grievance email.
 * Neither view ever contains the officer's name.
 */
router.get('/track/:grievanceId', verifyToken, async (req, res) => {
  try {
    const issue = await Issue.findOne({
      grievanceId: req.params.grievanceId.toUpperCase()
    }).lean();

    if (!issue) return res.status(404).json({ error: 'Grievance ID not found' });

    const isOwner = issue.reportedBy === lower(req.user.email);
    const view    = isOwner ? toCitizenView(issue) : toPublicView(issue);
    view.isOwner  = isOwner;

    res.json(view);
  } catch (err) {
    console.error(err.stack);
    res.status(400).json({ error: err.message });
  }
});

/** POST /api/issues */
router.post(
  '/',
  verifyToken,
  requireRole('citizen', 'officer', 'admin'),
  upload.single('image'),
  async (req, res) => {
    try {
      const raw = JSON.parse(req.body.data || '{}');
      const issueData = pick(raw, CREATE_ALLOWED);

      if (!issueData.title) {
        return res.status(400).json({ error: 'Title is required.' });
      }
      if (issueData.category && !DEPARTMENT_KEYS.includes(issueData.category)) {
        return res.status(400).json({ error: 'Unknown category.' });
      }

      const text = `${issueData.title}. ${issueData.description || ''}`.trim();
      const ai   = await classifyWithTimeout(text);

      if (ai && ai.category) {
        issueData.aiSuggestedCategory = ai.category;
        issueData.aiConf              = ai.confidence;
        issueData.aiTagged            = ai.engine !== 'keyword-fallback';
        if (!issueData.category) issueData.category = ai.category;
      }

      issueData.reportedBy = lower(req.dbUser.email);

      if (req.file) {
        issueData.imageUrl = req.file.path;
        issueData.imageRef = req.file.filename;
      }

      const issue = new Issue(issueData);
      await issue.save();

      res.status(201).json(toCitizenView(issue));
    } catch (err) {
      console.error(err.stack);
      res.status(400).json({ error: err.message });
    }
  }
);

// ── ADMIN ───────────────────────────────────────────
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ error: 'Not found' });

    if (issue.imageRef) {
      await cloudinary.uploader.destroy(issue.imageRef);
    }
    await Issue.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── ESCALATE ──────────────────────────────────────────
// civic-portal.js has always called this; the route never existed, so the
// button 404'd. Escalation is a real state change, not a flag: it raises
// priority one step and writes a timeline entry the citizen can see.
router.post('/:id/escalate', verifyToken, async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ error: 'Not found' });

    if (['resolved', 'rejected'].includes(issue.status)) {
      return res.status(409).json({
        error: `Cannot escalate a ${issue.status} grievance`
      });
    }

    const LADDER = ['low', 'medium', 'high', 'critical'];
    const at     = LADDER.indexOf(issue.priority || 'medium');

    if (at >= LADDER.length - 1) {
      return res.status(409).json({ error: 'Already at highest priority' });
    }

    issue.priority = LADDER[at + 1];
    issue.timeline.push({
      status:    issue.status,          // escalation does not change status
      message:   `Escalated to ${issue.priority} priority.`,
      updatedBy: req.user.email || 'citizen',
      timestamp: new Date()
    });

    await issue.save();
    res.json({ success: true, priority: issue.priority });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── ADMIN STATUS CHANGE ───────────────────────────────
// dashboard.js (the admin issue table) has always called this and it never
// existed, so every status change from that page 404'd.
//
// Deliberately NOT a duplicate of the officer route: officers are scoped to
// their own department and must accept an issue first, whereas an admin can
// move any grievance. Both go through issue.transitionTo() so the timeline
// and the acceptedAt / resolvedAt stamps stay consistent.
router.patch(
  '/:id/status',
  verifyToken,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { status, note } = req.body;

      if (!STATUSES.includes(status)) {
        return res.status(400).json({
          error: `status must be one of: ${STATUSES.join(', ')}`
        });
      }

      const issue = await Issue.findById(req.params.id);
      if (!issue) return res.status(404).json({ error: 'Not found' });

      issue.transitionTo(status, req.user.email || 'admin', note);
      if (note) issue.officerRemarks = note;
      await issue.save();

      res.json({ success: true, status: issue.status });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

module.exports = router;