const express    = require('express');
const router     = express.Router();
const Event      = require('../models/Event');
const CrowdReading = require('../models/CrowdReading');
const {
  predictCrowd, detectSurge, getLiveCrowd
} = require('../config/crowdEngine');
const verifyToken  = require('../middleware/verifyToken');
const requireRole  = require('../middleware/requireRole');

// GET live crowd snapshot
router.get('/live', async (req, res) => {
  try {
    const snapshot = await getLiveCrowd();
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET crowd predictions next 24h
router.get('/predict', async (req, res) => {
  try {
    const { area } = req.query;
    const predictions = await predictCrowd(area || null);
    res.json(predictions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all events
router.get('/events', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const events = await Event.find(filter)
      .sort({ startTime: 1 })
      .limit(20);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST run surge detection manually
router.post(
  '/detect-surge',
  verifyToken,
  requireRole('admin'),
  async (req, res) => {
    try {
      const alerts = await detectSurge();
      res.json({ triggered: alerts.length, alerts });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// POST add event — municipality + admin
router.post(
  '/events',
  verifyToken,
  requireRole('admin'),
  async (req, res) => {
    try {
      const event = await Event.create({
        ...req.body,
        createdBy: req.dbUser.email
      });
      res.status(201).json(event);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// PATCH update event status
router.patch(
  '/events/:id/status',
  verifyToken,
  requireRole('admin'),
  async (req, res) => {
    try {
      const event = await Event.findByIdAndUpdate(
        req.params.id,
        { status: req.body.status },
        { new: true }
      );
      res.json(event);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);
// GET crowd history for chart
// ?area=Gandhi Nagar&days=7
router.get('/history', async (req, res) => {
  try {
    const { area, days } = req.query;
    const filter = {};
    if (area) filter.area = area;
    filter.timestamp = {
      $gte: new Date(Date.now() - (parseInt(days)||7) * 86400000)
    };

    const data = await CrowdReading.find(filter)
      .sort({ timestamp: 1 })
      .limit(300);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;