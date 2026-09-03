// ===================================================================
//  SAVE THIS AS:   backend/routes/me.js
// ===================================================================
const express     = require('express');
const router      = express.Router();
const User        = require('../models/User');
const verifyToken = require('../middleware/verifyToken');
const { DEPARTMENTS } = require('../config/departments');

/**
 * GET /api/me
 * The frontend calls this right after Firebase login and redirects to `home`.
 * The role is authoritative because it comes from MongoDB via a verified
 * token - never from localStorage or a Firebase custom claim.
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const u = await User.findOne({ firebaseUid: req.user.uid });
    if (!u)        return res.status(401).json({ error: 'User not registered' });
    if (!u.active) return res.status(403).json({ error: 'Account disabled' });

    res.json({
      id:    u._id,
      name:  u.name,
      email: u.email,
      role:  u.role,
      department:      u.role === 'officer' ? u.department : undefined,
      departmentLabel: u.role === 'officer' && DEPARTMENTS[u.department]
        ? DEPARTMENTS[u.department].label
        : undefined,
      designation: u.designation,

      // RELATIVE filename, not an absolute path. Every page lives in the
      // same /pages/ folder, so this resolves correctly regardless of what
      // the static server treats as its web root (project root vs frontend/).
      home: u.role === 'admin'   ? 'admin-dashboard.html'
          : u.role === 'officer' ? 'officer-dashboard.html'
          :                        'citizen-dashboard.html'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;