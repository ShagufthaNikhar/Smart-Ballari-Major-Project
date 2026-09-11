const express     = require('express');
const router      = express.Router();
const Resource    = require('../models/Resource');
const WARD_COORDS = require('../config/wardCoords');
const { simulateTruckPosition, getWardStatus, getAreaStatus } = require('../config/garbageSimulator');

// GET /wards — populates the citizen-facing ward search dropdown.
router.get('/wards', (req, res) => {
  const wards = Object.keys(WARD_COORDS)
    .map(Number)
    .sort((a, b) => a - b);
  res.json(wards);
});

// GET /areas — every real named micro-area across all garbage-truck routes,
// for the area-name search box's autocomplete list. Not deduped: two trucks
// could in principle share a named area, and the search endpoint below
// already handles multiple matches, so no information is lost by leaving
// duplicates in — the frontend datalist just shows the name once either way.
router.get('/areas', async (req, res) => {
  try {
    const trucks = await Resource.find(
      { type: 'garbage-truck' },
      { routeStops: 1 }
    ).lean();

    const seen = new Set();
    const areas = [];
    trucks.forEach(t => {
      (t.routeStops || []).forEach(s => {
        const key = (s.area || '').toLowerCase();
        if (key && !seen.has(key)) {
          seen.add(key);
          areas.push({ area: s.area, ward: s.ward });
        }
      });
    });

    areas.sort((a, b) => a.area.localeCompare(b.area));
    res.json(areas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /search?area=<name> — public. Same idea as /ward/:wardNum, but keyed
// on the real street/locality name instead of a ward number, for citizens
// who know their area but not which ward it's in. Matches case-insensitively
// against the exact stored area name (drawn from the /areas list above, so
// the frontend should be feeding this exact strings via a datalist rather
// than free text — avoids partial-match ambiguity across similarly-named
// areas in different wards).
router.get('/search', async (req, res) => {
  try {
    const areaName = (req.query.area || '').trim();
    if (!areaName) {
      return res.status(400).json({ error: 'area query parameter required' });
    }

    const trucks = await Resource.find({
      type: 'garbage-truck',
      'routeStops.area': { $regex: `^${escapeRegex(areaName)}$`, $options: 'i' }
    });

    if (!trucks.length) {
      return res.json({ area: areaName, trucks: [] });
    }

    const now = new Date();
    const results = trucks.map(truck => {
      const areaStatus = getAreaStatus(truck, areaName, now);
      return {
        resourceId: truck._id,
        name: truck.name,
        vehicleNo: truck.vehicleNo,
        vehicleModel: truck.vehicleModel,
        driverName: truck.driverName || null,
        driverMobile: truck.driverMobile || null,
        division: truck.division,
        wetDrySegregation: truck.wetDrySegregation,
        ...areaStatus
      };
    });

    res.json({ area: areaName, trucks: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /ward/:wardNum — public. "Where is my ward's truck, and when will it
// get here?" A ward can have more than one truck covering it (some source
// rows list multiple wards per vehicle), so this returns an array.
router.get('/ward/:wardNum', async (req, res) => {
  try {
    const wardNum = parseInt(req.params.wardNum, 10);
    if (!Number.isFinite(wardNum)) {
      return res.status(400).json({ error: 'Invalid ward number' });
    }

    const trucks = await Resource.find({
      type: 'garbage-truck',
      wardsServed: wardNum
    });

    if (!trucks.length) {
      return res.json({ ward: wardNum, trucks: [] });
    }

    const now = new Date();
    const results = trucks.map(truck => {
      const wardStatus = getWardStatus(truck, wardNum, now);
      return {
        resourceId: truck._id,
        name: truck.name,
        vehicleNo: truck.vehicleNo,
        vehicleModel: truck.vehicleModel,
        driverName: truck.driverName || null,
        driverMobile: truck.driverMobile || null,
        division: truck.division,
        wetDrySegregation: truck.wetDrySegregation,
        ...wardStatus
      };
    });

    res.json({ ward: wardNum, trucks: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /truck/:id/position — public. Live position for one truck (used to
// keep the map marker moving while a citizen has the page open).
router.get('/truck/:id/position', async (req, res) => {
  try {
    const truck = await Resource.findOne({ _id: req.params.id, type: 'garbage-truck' });
    if (!truck) return res.status(404).json({ error: 'Truck not found' });

    const position = simulateTruckPosition(truck, new Date());
    res.json({
      resourceId: truck._id,
      name: truck.name,
      vehicleNo: truck.vehicleNo,
      ...position
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;