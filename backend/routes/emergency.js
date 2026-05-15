const express    = require('express');
const router     = express.Router();
const Incident   = require('../models/Incident');
const Responder  = require('../models/Responder');
const verifyToken  = require('../middleware/verifyToken');
const requireRole  = require('../middleware/requireRole');
const { haversine } = require('../config/busSimulator');
const { dispatch, logDispatch } = require('../config/dispatchAI');

// ── PUBLIC ───────────────────────────────────────────

// GET all responders
router.get('/responders', async (req, res) => {
  try {
    const { type } = req.query;
    const filter   = { isActive: true };
    if (type) filter.type = type;
    const responders = await Responder.find(filter);
    res.json(responders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET nearest responders to a location
// Query: ?lat=15.14&lng=76.92&type=hospital&limit=3
router.get('/nearest', async (req, res) => {
  try {
    const { lat, lng, type, limit = 3 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng required' });
    }

    const filter = { isActive: true };
    if (type) filter.type = type;

    const responders = await Responder.find(filter);

    // Haversine sort
    const sorted = responders
      .map(r => ({
        ...r.toObject(),
        distance: haversine(
          parseFloat(lat), parseFloat(lng),
          r.location.lat, r.location.lng
        )
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, parseInt(limit));

    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET live incidents board
router.get('/incidents', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const incidents = await Incident.find(filter)
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(incidents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single incident by ID
router.get('/incidents/:incidentId', async (req, res) => {
  try {
    const incident = await Incident.findOne({
      incidentId: req.params.incidentId.toUpperCase()
    });
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    res.json(incident);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PROTECTED ─────────────────────────────────────────



// POST new incident — AI dispatch
router.post(
  '/incidents',
  verifyToken,
  requireRole('user', 'municipality', 'admin'),
  async (req, res) => {
    try {
      // 1. Save incident
      const incident = new Incident({
        ...req.body,
        reportedBy: req.dbUser.email
      });
      await incident.save();

      // 2. AI dispatch
      const dispatched = await dispatch(incident);

      if (dispatched.length > 0) {
        // Assign primary responder
        const primary = dispatched[0];
        incident.assignedTo    = primary.name;
        incident.responderType = primary.dispatchType;
        incident.status        = 'responding';
        await incident.save();

        // Update responder load
        await Promise.all(
          dispatched.map(d =>
            Responder.findByIdAndUpdate(d._id, {
              $inc: { currentLoad: 1 }
            })
          )
        );
      }

      // 3. Log for ML training
      await logDispatch(incident, dispatched);

      res.status(201).json({
        incident,
        dispatched,           // all assigned responders
        nearest: dispatched[0] || null
      });

    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// POST resolve — free up responder load
router.patch(
  '/incidents/:id/status',
  verifyToken,
  requireRole('municipality', 'admin'),
  async (req, res) => {
    try {
      const prev = await Incident.findById(req.params.id);

      const update = {
        status:    req.body.status,
        updatedAt: new Date()
      };
      if (req.body.status === 'resolved') {
        update.resolvedAt = new Date();
      }

      const incident = await Incident.findByIdAndUpdate(
        req.params.id,
        update,
        { new: true }
      );

      // Free up responder load on resolve
      if (req.body.status === 'resolved' && prev.status !== 'resolved') {
        const responder = await Responder.findOne({
          name: prev.assignedTo
        });
        if (responder && responder.currentLoad > 0) {
          await Responder.findByIdAndUpdate(responder._id, {
            $inc: { currentLoad: -1 }
          });
        }
      }

      res.json(incident);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// GET dispatch simulation — test without reporting
// Query: ?lat=15.14&lng=76.92&type=accident&severity=high
router.get('/simulate-dispatch', async (req, res) => {
  try {
    const { lat, lng, type, severity } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng required' });
    }

    const mockIncident = {
      location: {
        coordinates: {
          lat: parseFloat(lat),
          lng: parseFloat(lng)
        }
      },
      type:     type     || 'accident',
      severity: severity || 'medium'
    };

    const dispatched = await dispatch(mockIncident);
    res.json({ dispatched });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── HELPERS ───────────────────────────────────────────
function getResponderType(incidentType) {
  const map = {
    accident: 'hospital',
    medical:  'hospital',
    fire:     'fire',
    crime:    'police',
    flood:    'police',
    other:    'police'
  };
  return map[incidentType] || 'police';
}

async function findNearest(lat, lng, type) {
  const responders = await Responder.find({ isActive: true, type });
  if (!responders.length) return null;

  return responders
    .map(r => ({
      ...r.toObject(),
      distance: haversine(lat, lng, r.location.lat, r.location.lng)
    }))
    .sort((a, b) => a.distance - b.distance)[0];
}

module.exports = router;