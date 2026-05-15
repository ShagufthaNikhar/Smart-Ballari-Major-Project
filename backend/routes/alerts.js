const express     = require('express');
const router      = express.Router();
const Alert       = require('../models/Alert');
const HistoricalData = require('../models/HistoricalData');
const {
  runRules, autoResolve, getTrends, predict
} = require('../config/ruleEngine');
const verifyToken  = require('../middleware/verifyToken');
const requireRole  = require('../middleware/requireRole');

// GET active alerts — public
router.get('/', async (req, res) => {
  try {
    const { type, severity } = req.query;
    const filter = { isActive: true };
    if (type)     filter.type     = type;
    if (severity) filter.severity = severity;

    const alerts = await Alert.find(filter)
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET alert count by type — for dashboard badges
router.get('/counts', async (req, res) => {
  try {
    const all = await Alert.find({ isActive: true });
    const counts = {
      total:      all.length,
      critical:   all.filter(a => a.severity === 'critical').length,
      warning:    all.filter(a => a.severity === 'warning').length,
      info:       all.filter(a => a.severity === 'info').length,
      water:      all.filter(a => a.type === 'water').length,
      traffic:    all.filter(a => a.type === 'traffic').length,
      power:      all.filter(a => a.type === 'power').length,
      crowd:      all.filter(a => a.type === 'crowd').length,
      surge:      all.filter(a => a.type === 'surge').length
    };
    res.json(counts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST run rules manually — admin only
router.post(
  '/run-rules',
  verifyToken,
  requireRole('admin'),
  async (req, res) => {
    try {
      const newAlerts = await runRules();
      await autoResolve();
      res.json({
        triggered: newAlerts.length,
        alerts:    newAlerts
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET trends — ?type=water&area=Gandhi Nagar&days=7
router.get('/trends', async (req, res) => {
  try {
    const { type, area, days } = req.query;
    if (!type) return res.status(400).json({ error: 'type required' });
    const trend = await getTrends(type, area, parseInt(days) || 7);
    res.json(trend);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET prediction — ?type=water&area=Gandhi Nagar
router.get('/predict', async (req, res) => {
  try {
    const { type, area } = req.query;
    if (!type) return res.status(400).json({ error: 'type required' });
    const prediction = await predict(type, area);
    res.json(prediction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET historical data — ?type=water&area=X&days=7
router.get('/history', async (req, res) => {
  try {
    const { type, area, days } = req.query;
    const filter = { type };
    if (area) filter.area = area;
    filter.timestamp = { $gte: new Date(
      Date.now() - (parseInt(days) || 7) * 86400000
    )};

    const data = await HistoricalData.find(filter)
      .sort({ timestamp: 1 })
      .limit(200);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH resolve alert — admin + municipality
router.patch(
  '/:id/resolve',
  verifyToken,
  requireRole('municipality', 'admin'),
  async (req, res) => {
    try {
      const alert = await Alert.findByIdAndUpdate(
        req.params.id,
        { isActive: false, resolvedAt: new Date() },
        { new: true }
      );
      res.json(alert);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

module.exports = router;