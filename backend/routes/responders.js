// ===================================================================
//  SAVE THIS AS:   backend/routes/responders.js
// ===================================================================
const express     = require('express');
const router      = express.Router();
const Responder   = require('../models/Responder');
const verifyToken = require('../middleware/verifyToken');
const requireRole = require('../middleware/requireRole');

// Every route here is admin-only, same as officer.js is officer-only.
router.use(verifyToken, requireRole('admin', 'responder-manager'));

/**
 * GET /api/admin/responders
 * ?type=hospital|police|fire  ?active=true|false  ?search=
 */
router.get('/', async (req, res) => {
  try {
    const query = {};
    if (req.query.type) query.type = req.query.type;
    if (req.query.active !== undefined && req.query.active !== '') {
      query.isActive = req.query.active === 'true';
    }
    if (req.query.search) {
      const re = new RegExp(req.query.search, 'i');
      query.$or = [{ name: re }, { address: re }];
    }

    const responders = await Responder.find(query).sort({ name: 1 });
    res.json(responders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/responders/stats */
router.get('/stats', async (req, res) => {
  try {
    const [total, active, atCapacity, all] = await Promise.all([
      Responder.countDocuments({}),
      Responder.countDocuments({ isActive: true }),
      Responder.countDocuments({ $expr: { $gte: ['$currentLoad', '$capacity'] } }),
      Responder.find({}, 'capacity currentLoad')
    ]);

    const loadPcts = all
      .filter(r => r.capacity > 0)
      .map(r => r.currentLoad / r.capacity);
    const avgLoadPct = loadPcts.length
      ? Math.round((loadPcts.reduce((a, b) => a + b, 0) / loadPcts.length) * 100)
      : 0;

    res.json({ total, active, atCapacity, avgLoadPct });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/responders */
router.post('/', async (req, res) => {
  try {
    const responder = await Responder.create(req.body);
    res.status(201).json(responder);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** PATCH /api/admin/responders/:id - full edit or a quick isActive toggle */
router.patch('/:id', async (req, res) => {
  try {
    const responder = await Responder.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!responder) return res.status(404).json({ error: 'Responder not found.' });
    res.json(responder);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** DELETE /api/admin/responders/:id */
router.delete('/:id', async (req, res) => {
  try {
    const responder = await Responder.findByIdAndDelete(req.params.id);
    if (!responder) return res.status(404).json({ error: 'Responder not found.' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;