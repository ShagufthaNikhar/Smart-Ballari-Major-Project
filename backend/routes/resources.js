const express    = require('express');
const router     = express.Router();
const Resource   = require('../models/Resource');
const Deployment = require('../models/Deployment');
const {
  generateAllocationPlan,
  autoDeployResource,
  recallResource,
  getHotspots,
  computeDemandScore
} = require('../config/allocationEngine');
const verifyToken  = require('../middleware/verifyToken');
const requireRole  = require('../middleware/requireRole');

// GET all resources
router.get('/', async (req, res) => {
  try {
    const { type, status } = req.query;
    const filter = {};
    if (type)   filter.type   = type;
    if (status) filter.status = status;
    const resources = await Resource.find(filter);
    res.json(resources);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET resource summary counts
router.get('/summary', async (req, res) => {
  try {
    const types = [
      'garbage-truck', 'ambulance',
      'water-tanker',  'police-van', 'fire-truck'
    ];
    const summary = {};

    for (const type of types) {
      summary[type] = {
        available:   await Resource.countDocuments({ type, status: 'available'   }),
        deployed:    await Resource.countDocuments({ type, status: 'deployed'    }),
        maintenance: await Resource.countDocuments({ type, status: 'maintenance' }),
        returning:   await Resource.countDocuments({ type, status: 'returning'   })
      };
    }
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET allocation plan — admin + municipality
router.get(
  '/plan',
  verifyToken,
  requireRole('admin', 'municipality'),
  async (req, res) => {
    try {
      const { type } = req.query;
      const plan = await generateAllocationPlan(type || null);
      res.json(plan);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET hotspots for resource type
router.get('/hotspots', async (req, res) => {
  try {
    const { type } = req.query;
    if (!type) {
      return res.status(400).json({ error: 'type required' });
    }
    const hotspots = await getHotspots(type);
    res.json(hotspots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

// POST deploy resource — admin + municipality
router.post(
  '/deploy',
  verifyToken,
  requireRole('admin', 'municipality'),
  async (req, res) => {
    try {
      const { resourceId, area, reason } = req.body;
      if (!resourceId || !area) {
        return res.status(400).json({
          error: 'resourceId and area required'
        });
      }

      const result = await autoDeployResource(
        resourceId, area, reason, req.dbUser.email
      );
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// POST recall resource
router.post(
  '/recall/:id',
  verifyToken,
  requireRole('admin', 'municipality'),
  async (req, res) => {
    try {
      const resource = await recallResource(req.params.id);
      res.json({ success: true, resource });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// GET demand score for area + type
router.get('/demand', async (req, res) => {
  try {
    const { area, type } = req.query;
    if (!area || !type) {
      return res.status(400).json({ error: 'area and type required' });
    }
    const score = await computeDemandScore(area, type);
    res.json(score);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;