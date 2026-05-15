const express   = require('express');
const router    = express.Router();
const BusRoute  = require('../models/BusRoute');
const verifyToken = require('../middleware/verifyToken');
const requireRole = require('../middleware/requireRole');


// GET all active routes
router.get('/routes', async (req, res) => {
  try {
    const routes = await BusRoute.find({ isActive: true });
    res.json(routes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single route by number
router.get('/routes/:routeNumber', async (req, res) => {
  try {
    const route = await BusRoute.findOne({
      routeNumber: req.params.routeNumber.toUpperCase()
    });
    if (!route) return res.status(404).json({ error: 'Route not found' });
    res.json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add route — admin only
router.post(
  '/routes',
  verifyToken,
  requireRole('admin'),
  async (req, res) => {
    try {
      const route = await BusRoute.create(req.body);
      res.status(201).json(route);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// PATCH toggle active — admin only
router.patch(
  '/routes/:id/toggle',
  verifyToken,
  requireRole('admin'),
  async (req, res) => {
    try {
      const route = await BusRoute.findById(req.params.id);
      route.isActive = !route.isActive;
      await route.save();
      res.json(route);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

const {
  getBusPositions,
  haversine,
  calcETA
} = require('../config/busSimulator');

// GET live bus positions — public
router.get('/live', (req, res) => {
  try {
    const positions = getBusPositions();
    res.json(positions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ETA for a specific stop given user lat/lng
// Query: ?lat=15.14&lng=76.92&routeNumber=BLR-01
router.get('/eta', (req, res) => {
  try {
    const { lat, lng, routeNumber } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng required' });
    }

    const positions = getBusPositions();
    const filtered  = routeNumber
      ? positions.filter(b => b.routeNumber === routeNumber)
      : positions;

    const results = filtered.map(bus => {
      const distToBus = haversine(
        parseFloat(lat), parseFloat(lng),
        bus.lat, bus.lng
      );

      // Nearest stop to user
      const nearestStop = bus.stops.reduce((best, stop) => {
        const d = haversine(
          parseFloat(lat), parseFloat(lng),
          stop.lat, stop.lng
        );
        return d < best.dist ? { stop, dist: d } : best;
      }, { stop: null, dist: Infinity });

      return {
        routeNumber:  bus.routeNumber,
        routeName:    bus.routeName,
        color:        bus.color,
        busLat:       bus.lat,
        busLng:       bus.lng,
        distanceToBus: distToBus.toFixed(2),
        etaToBus:     calcETA(distToBus),
        nearestStop:  nearestStop.stop?.name || '—',
        direction:    bus.direction
      };
    });

    // Sort by distance
    results.sort((a, b) => a.distanceToBus - b.distanceToBus);
    res.json(results);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;