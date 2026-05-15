const express      = require('express');
const router       = express.Router();
const Update       = require('../models/MunicipalityUpdate');
const verifyToken  = require('../middleware/verifyToken');
const requireRole  = require('../middleware/requireRole');

// GET all active updates — public
// Optional query: ?area=hospet
router.get('/', async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.area && req.query.area !== 'all') {
      filter.area = { $in: [req.query.area, 'all'] };
    }
    const updates = await Update.find(filter).sort({ createdAt: -1 });
    res.json(updates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new update — municipality + admin only
router.post(
  '/',
  verifyToken,
  requireRole('municipality', 'admin'),
  async (req, res) => {
    try {
      const update = await Update.create({
        ...req.body,
        postedBy: req.dbUser.email
      });
      res.status(201).json(update);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// PATCH deactivate update — municipality + admin
router.patch(
  '/:id/deactivate',
  verifyToken,
  requireRole('municipality', 'admin'),
  async (req, res) => {
    try {
      const update = await Update.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true }
      );
      res.json(update);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// DELETE — admin only
router.delete(
  '/:id',
  verifyToken,
  requireRole('admin'),
  async (req, res) => {
    try {
      await Update.findByIdAndDelete(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

module.exports = router;