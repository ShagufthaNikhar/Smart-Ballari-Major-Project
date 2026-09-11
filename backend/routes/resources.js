const express    = require('express');
const router     = express.Router();
const Responder  = require('../models/Responder');
const Deployment = require('../models/Deployment');
const Recommendation = require('../models/Recommendation');
const {
  dispatchResponder,
  releaseResponder,
  recalcActiveRecommendations
} = require('../config/allocationEngine');
const verifyToken  = require('../middleware/verifyToken');
const requireRole  = require('../middleware/requireRole');

// GET responder summary — ambulance/police/fire only (the types Smart
// Allocation actually recommends from). No "available/deployed" concept
// here since these are fixed facilities, not movable vehicles — load is
// the meaningful number instead.
router.get('/summary', async (req, res) => {
  try {
    const types = ['ambulance', 'police', 'fire'];
    const summary = {};

    for (const type of types) {
      const responders = await Responder.find({ type, isActive: true }, 'capacity currentLoad');
      const total = responders.length;
      const totalCapacity = responders.reduce((s, r) => s + (r.capacity || 0), 0);
      const totalLoad = responders.reduce((s, r) => s + (r.currentLoad || 0), 0);
      summary[type] = {
        total,
        avgLoadPercent: totalCapacity > 0 ? Math.round((totalLoad / totalCapacity) * 100) : 0
      };
    }
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════
// ── AUTOMATIC RECOMMENDATIONS ─────────────────────────
// ══════════════════════════════════════════════════════
router.get(
  '/recommendations',
  verifyToken,
  requireRole('admin', 'officer', 'responder-manager'),
  async (req, res) => {
    try {
      const recs = await Recommendation.find({ status: 'pending' })
        .sort({ createdAt: -1 });
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      recs.sort((a, b) => order[a.priority] - order[b.priority]);
      res.json(recs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.post(
  '/recommendations/:id/approve',
  verifyToken,
  requireRole('admin', 'officer', 'responder-manager'),
  async (req, res) => {
    try {
      const rec = await Recommendation.findById(req.params.id);
      if (!rec) return res.status(404).json({ error: 'Recommendation not found' });
      if (rec.status !== 'pending') {
        return res.status(400).json({ error: `Recommendation already ${rec.status}` });
      }
      if (!rec.recommendedResourceId) {
        return res.status(400).json({
          error: 'No responder on record to dispatch for this recommendation'
        });
      }

      const result = await dispatchResponder(
        rec.recommendedResourceId,
        { lat: rec.incidentLat, lng: rec.incidentLng, label: rec.area },
        rec.reason,
        req.dbUser.email
      );

      result.deployment.incidentId = rec.incidentId;
      result.deployment.unitIndex = rec.unitIndex;
      await result.deployment.save();

      rec.status      = 'approved';
      rec.resolvedAt   = new Date();
      rec.updatedAt     = new Date();
      rec.deploymentId = result.deployment._id;
      await rec.save();

      res.json({
        recommendation: rec,
        deployment: result.deployment,
        responder: result.responder
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

router.post(
  '/recommendations/:id/reject',
  verifyToken,
  requireRole('admin', 'officer', 'responder-manager'),
  async (req, res) => {
    try {
      const rec = await Recommendation.findByIdAndUpdate(
        req.params.id,
        { status: 'rejected', resolvedAt: new Date(), updatedAt: new Date() },
        { new: true }
      );
      if (!rec) return res.status(404).json({ error: 'Recommendation not found' });
      res.json(rec);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

router.post(
  '/recommendations/recalculate',
  verifyToken,
  requireRole('admin', 'officer', 'responder-manager'),
  async (req, res) => {
    try {
      const recs = await recalcActiveRecommendations();
      res.json({ recalculated: recs.length, recommendations: recs });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET active deployments
router.get('/deployments', async (req, res) => {
  try {
    const deps = await Deployment.find({ status: 'active' })
      .sort({ dispatchedAt: -1 })
      .limit(20);
    res.json(deps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST release a responder — ends its active deployment, drops its load.
// Named "recall" in the URL for continuity with earlier admin tooling,
// but see releaseResponder(): it's immediate, no vehicle-return delay.
router.post(
  '/recall/:id',
  verifyToken,
  requireRole('admin', 'officer', 'responder-manager'),
  async (req, res) => {
    try {
      const responder = await releaseResponder(req.params.id);
      res.json({ success: true, responder });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

module.exports = router;