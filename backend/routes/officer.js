// ===================================================================
//  SAVE THIS AS:   backend/routes/officer.js
//  Adds evidence upload to the resolve endpoint.
// ===================================================================
const express     = require('express');
const router      = express.Router();
const Issue       = require('../models/Issue');
const verifyToken = require('../middleware/verifyToken');
const requireRole = require('../middleware/requireRole');
const { upload, cloudinary } = require('../config/cloudinary');
const { toOfficerView } = require('../serializers/issue');

// Every route here is officer-only. requireRole sets req.user to the Mongo doc.
router.use(verifyToken, requireRole('officer'));

/**
 * Loads an issue and enforces the department boundary.
 * User.department and Issue.category share the same key set.
 */
async function loadOwnDepartmentIssue(req, res) {
  const issue = await Issue
    .findOne({ grievanceId: req.params.grievanceId.toUpperCase() })
    .populate('assignedOfficer', 'name designation employeeId');

  if (!issue || issue.category !== req.user.department) {
    // 404 not 403 - a 403 would confirm the issue exists and reveal
    // which department handles it.
    res.status(404).json({ error: 'Issue not found.' });
    return null;
  }
  return issue;
}

function isMine(issue, user) {
  return issue.assignedOfficer &&
         String(issue.assignedOfficer._id || issue.assignedOfficer) === String(user._id);
}

/**
 * GET /api/officer/issues
 * Scoped to the officer's own department, always.
 * ?scope=mine | unassigned   ?status=open|accepted|in-progress|resolved
 */
router.get('/issues', async (req, res) => {
  try {
    const query = { category: req.user.department };

    if (req.query.scope === 'mine')       query.assignedOfficer = req.user._id;
    if (req.query.scope === 'unassigned') query.assignedOfficer = null;
    if (req.query.status)                 query.status = req.query.status;

    const issues = await Issue.find(query)
      .populate('assignedOfficer', 'name designation employeeId')
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(req.query.limit) || 100, 200));

    res.json(issues.map(toOfficerView));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/officer/stats - this department only */
router.get('/stats', async (req, res) => {
  try {
    const dept = req.user.department;
    const [open, mine, inProgress, resolved] = await Promise.all([
      Issue.countDocuments({ category: dept, status: { $in: ['open', 'pending'] } }),
      Issue.countDocuments({ category: dept, assignedOfficer: req.user._id,
                             status: { $in: ['accepted', 'in-progress'] } }),
      Issue.countDocuments({ category: dept, status: 'in-progress' }),
      Issue.countDocuments({ category: dept, status: 'resolved' })
    ]);
    res.json({ department: dept, open, assignedToMe: mine, inProgress, resolved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/officer/issues/:grievanceId */
router.get('/issues/:grievanceId', async (req, res) => {
  const issue = await loadOwnDepartmentIssue(req, res);
  if (!issue) return;
  res.json(toOfficerView(issue));
});

/** POST /api/officer/issues/:grievanceId/accept */
router.post('/issues/:grievanceId/accept', async (req, res) => {
  try {
    const issue = await loadOwnDepartmentIssue(req, res);
    if (!issue) return;

    if (issue.assignedOfficer && !isMine(issue, req.user)) {
      return res.status(409).json({ error: 'Already accepted by another officer.' });
    }
    if (!['open', 'pending'].includes(issue.status)) {
      return res.status(409).json({ error: 'Issue is no longer open.' });
    }

    issue.assignedOfficer = req.user._id;
    issue.transitionTo('accepted', req.user.firebaseUid, req.body.note);
    await issue.save();

    await issue.populate('assignedOfficer', 'name designation employeeId');
    res.json(toOfficerView(issue));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** PATCH /api/officer/issues/:grievanceId/status - in-progress or rejected */
router.patch('/issues/:grievanceId/status', async (req, res) => {
  try {
    const { status, note } = req.body;
    if (!['in-progress', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Use /resolve to close an issue.' });
    }

    const issue = await loadOwnDepartmentIssue(req, res);
    if (!issue) return;

    if (!isMine(issue, req.user)) {
      return res.status(403).json({ error: 'Accept the issue before updating it.' });
    }

    issue.transitionTo(status, req.user.firebaseUid, note);
    if (note) issue.officerRemarks = note;
    await issue.save();

    res.json(toOfficerView(issue));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/officer/issues/:grievanceId/resolve
 * Accepts multipart with an optional `evidence` image, or JSON with
 * an `evidenceUrl` already hosted elsewhere.
 */
router.post('/issues/:grievanceId/resolve', upload.single('evidence'), async (req, res) => {
  try {
    // With multipart, text fields arrive as strings on req.body.
    const remarks     = req.body.remarks;
    const evidenceUrl = req.file ? req.file.path : req.body.evidenceUrl;

    const issue = await loadOwnDepartmentIssue(req, res);
    if (!issue) {
      // Clean up the upload we no longer need.
      if (req.file) await cloudinary.uploader.destroy(req.file.filename).catch(() => {});
      return;
    }

    if (!isMine(issue, req.user)) {
      if (req.file) await cloudinary.uploader.destroy(req.file.filename).catch(() => {});
      return res.status(403).json({ error: 'Only the accepting officer can resolve this.' });
    }

    issue.officerRemarks        = remarks;
    issue.resolutionEvidenceUrl = evidenceUrl;
    issue.transitionTo('resolved', req.user.firebaseUid, remarks);
    await issue.save();

    res.json(toOfficerView(issue));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;