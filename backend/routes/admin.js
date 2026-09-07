const express     = require('express');
const router      = express.Router();
const Issue       = require('../models/Issue');
const User        = require('../models/User');
const verifyToken = require('../middleware/verifyToken');
const requireRole = require('../middleware/requireRole');
const { toAdminView } = require('../serializers/issue');
const { DEPARTMENTS, DEPARTMENT_KEYS } = require('../config/departments');

router.use(verifyToken, requireRole('admin'));

/** GET /api/admin/issues - every issue, all departments */
router.get('/issues', async (req, res) => {
  try {
    const query = {};
    if (req.query.category) query.category = req.query.category;
    if (req.query.status)   query.status   = req.query.status;

    const issues = await Issue.find(query)
      .populate('assignedOfficer', 'name designation employeeId')
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(req.query.limit) || 200, 500));

    // reportedBy is an email string, not a ref, so resolve reporters in one pass.
    const emails    = [...new Set(issues.map(i => i.reportedBy).filter(Boolean))];
    const reporters = await User.find({ email: { $in: emails } })
                                .select('name email phone').lean();
    const byEmail = Object.fromEntries(reporters.map(r => [r.email, r]));

    res.json(issues.map(i => toAdminView(i, byEmail[i.reportedBy])));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/officers - with current workload */
router.get('/officers', async (req, res) => {
  try {
    const filter = { role: 'officer' };
    if (req.query.department) filter.department = req.query.department;

    const officers = await User.find(filter)
      .select('name email phone department designation employeeId active')
      .sort({ department: 1, name: 1 });

    const load = await Issue.aggregate([
      { $match: { status: { $in: ['accepted', 'in-progress'] }, assignedOfficer: { $ne: null } } },
      { $group: { _id: '$assignedOfficer', open: { $sum: 1 } } }
    ]);
    const loadMap = Object.fromEntries(load.map(l => [String(l._id), l.open]));

    res.json(officers.map(o => ({
      ...o.toObject(),
      departmentLabel: DEPARTMENTS[o.department] ? DEPARTMENTS[o.department].label : o.department,
      openIssues: loadMap[String(o._id)] || 0
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/departments */
router.get('/departments', (req, res) => res.json(Object.values(DEPARTMENTS)));

/** POST /api/admin/issues/:grievanceId/assign */
router.post('/issues/:grievanceId/assign', async (req, res) => {
  try {
    const { officerId } = req.body;

    const issue = await Issue.findOne({ grievanceId: req.params.grievanceId.toUpperCase() });
    if (!issue) return res.status(404).json({ error: 'Issue not found.' });

    const officer = await User.findById(officerId);
    if (!officer || officer.role !== 'officer') {
      return res.status(400).json({ error: 'Not a valid officer account.' });
    }
    if (officer.department !== issue.category) {
      return res.status(400).json({
        error: 'Officer belongs to a different department. Reroute the issue first.'
      });
    }

    issue.assignedOfficer = officer._id;
    if (['open', 'pending'].includes(issue.status)) {
      issue.transitionTo('accepted', req.user.firebaseUid, 'Assigned by admin');
    }
    await issue.save();

    await issue.populate('assignedOfficer', 'name designation employeeId');
    res.json(toAdminView(issue));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** POST /api/admin/issues/:grievanceId/reroute - fix a misclassified issue */
router.post('/issues/:grievanceId/reroute', async (req, res) => {
  try {
    const { category } = req.body;
    if (!DEPARTMENT_KEYS.includes(category)) {
      return res.status(400).json({ error: 'Unknown category.' });
    }

    const issue = await Issue.findOne({ grievanceId: req.params.grievanceId.toUpperCase() });
    if (!issue) return res.status(404).json({ error: 'Issue not found.' });

    issue.category        = category;
    issue.assignedOfficer = null;      // previous officer loses access immediately
    issue.transitionTo('open', req.user.firebaseUid, 'Rerouted by admin');
    await issue.save();

    res.json(toAdminView(issue));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** GET /api/admin/stats */
router.get('/stats', async (req, res) => {
  try {
    const [byStatus, byCategory, resolution] = await Promise.all([
      Issue.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Issue.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
      Issue.aggregate([
        { $match: { resolvedAt: { $ne: null } } },
        { $group: { _id: null, avgMs: { $avg: { $subtract: ['$resolvedAt', '$createdAt'] } } } }
      ])
    ]);

    const avgMs = resolution[0] ? resolution[0].avgMs : 0;

    res.json({
      total: byStatus.reduce((s, x) => s + x.count, 0),
      byStatus: Object.fromEntries(byStatus.map(x => [x._id, x.count])),
      byDepartment: byCategory.map(d => ({
        key:   d._id,
        label: DEPARTMENTS[d._id] ? DEPARTMENTS[d._id].label : d._id,
        count: d.count
      })),
      avgResolutionHours: avgMs ? Number((avgMs / 3600000).toFixed(1)) : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PATCH /api/admin/users/:id/role - promote or demote */
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role, department, designation, employeeId } = req.body;
    if (!['citizen', 'officer', 'admin','hall-manager', 'responder-manager'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }
    if (role === 'officer' && !DEPARTMENT_KEYS.includes(department)) {
      return res.status(400).json({ error: 'An officer needs a valid department.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // An admin must not be able to demote themselves out of the admin module.
    if (String(user._id) === String(req.user._id) && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot change your own role.' });
    }

    user.role = role;
    if (role === 'officer') {
      user.department  = department;
      user.designation = designation;
      user.employeeId  = employeeId;
    }
    await user.save();

    res.json({ id: user._id, name: user.name, role: user.role, department: user.department });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** GET /api/admin/users */
router.get('/users', async (req, res) => {
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  const users = await User.find(filter)
    .select('name email phone role department designation employeeId active createdAt')
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(req.query.limit) || 200, 500));
  res.json(users);
});

module.exports = router;