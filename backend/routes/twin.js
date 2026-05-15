const express  = require('express');
const router   = express.Router();
const Issue    = require('../models/Issue');
const HistoricalData = require('../models/HistoricalData');
const Alert    = require('../models/Alert');

// GET full city snapshot for twin
router.get('/snapshot', async (req, res) => {
  try {
    const [issues, alerts, traffic, water] = await Promise.all([
      Issue.find({ status: { $ne: 'resolved' } })
        .select('title category status location createdAt'),
      Alert.find({ isActive: true })
        .select('type severity title area'),
      HistoricalData.find({ type: 'traffic' })
        .sort({ timestamp: -1 }).limit(20),
      HistoricalData.find({ type: 'water' })
        .sort({ timestamp: -1 }).limit(20)
    ]);

    res.json({ issues, alerts, traffic, water });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST simulate road closure
// Body: { lat, lng, radius, name }
router.post('/simulate/road-closure', async (req, res) => {
  try {
    const { lat, lng, radius = 0.5, name } = req.body;

    // Find issues near closure
    const affected = await Issue.find({
      'location.coordinates.lat': {
        $gte: lat - 0.01, $lte: lat + 0.01
      },
      'location.coordinates.lng': {
        $gte: lng - 0.01, $lte: lng + 0.01
      }
    });

    // Simulate traffic impact
    const impactZones = generateImpactZones(lat, lng, radius);
    const alternates  = generateAlternateRoutes(lat, lng);

    res.json({
      closure: { lat, lng, radius, name },
      affected: affected.length,
      impactZones,
      alternates,
      recommendation: affected.length > 5
        ? 'HIGH IMPACT — deploy traffic police + notify KSRTC'
        : 'MODERATE — update signage only'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET shadow analysis for area
router.get('/shadow', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const hour = new Date().getHours();

    // Sun angle approximation for Ballari (15°N lat)
    const sunAzimuth  = calculateSunAzimuth(hour);
    const sunElevation = calculateSunElevation(hour);

    // Generate grid of shadow values
    const grid = generateShadowGrid(
      parseFloat(lat) || 15.1394,
      parseFloat(lng) || 76.9214,
      sunAzimuth,
      sunElevation
    );

    // Tree planting suggestions
    const suggestions = generateTreeSuggestions(grid);

    res.json({
      hour,
      sunAzimuth,
      sunElevation,
      grid,
      suggestions
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── HELPERS ───────────────────────────────────────────
function generateImpactZones(lat, lng, radius) {
  return [
    {
      id:       'primary',
      lat,
      lng,
      radius:   radius * 1000,
      severity: 'high',
      label:    'Primary Closure Zone'
    },
    {
      id:       'secondary',
      lat:      lat + 0.005,
      lng:      lng + 0.005,
      radius:   radius * 800,
      severity: 'medium',
      label:    'Congestion Spillover'
    },
    {
      id:       'tertiary',
      lat:      lat - 0.004,
      lng:      lng - 0.004,
      radius:   radius * 600,
      severity: 'low',
      label:    'Minor Delay Zone'
    }
  ];
}

function generateAlternateRoutes(lat, lng) {
  return [
    {
      name:  'Via Nehru Gunj',
      delay: '+8 mins',
      coords: [
        { lat: lat + 0.008, lng: lng - 0.005 },
        { lat: lat + 0.012, lng: lng + 0.002 }
      ]
    },
    {
      name:  'Via Cantonment Road',
      delay: '+12 mins',
      coords: [
        { lat: lat - 0.006, lng: lng + 0.008 },
        { lat: lat - 0.010, lng: lng + 0.012 }
      ]
    }
  ];
}

function calculateSunAzimuth(hour) {
  // Simplified: sun rises East (90°), sets West (270°)
  return 90 + (hour - 6) * (180 / 12);
}

function calculateSunElevation(hour) {
  // Peak at noon (~75° for Ballari 15°N)
  const peak = 75;
  const diff = Math.abs(hour - 12);
  return Math.max(0, peak - diff * 8);
}

function generateShadowGrid(lat, lng, azimuth, elevation) {
  const grid   = [];
  const steps  = 6;
  const step   = 0.003;

  for (let i = -steps; i <= steps; i++) {
    for (let j = -steps; j <= steps; j++) {
      const shade = Math.max(0, Math.min(1,
        0.5 + 0.5 * Math.sin((i + j + azimuth / 90) * 0.8)
        - (elevation / 150)
      ));

      grid.push({
        lat:   lat + i * step,
        lng:   lng + j * step,
        shade: parseFloat(shade.toFixed(2)),
        exposure: shade < 0.3 ? 'shaded'
          : shade < 0.6 ? 'partial'
          : 'full-sun'
      });
    }
  }

  return grid;
}

function generateTreeSuggestions(grid) {
  return grid
    .filter(g => g.exposure === 'full-sun')
    .slice(0, 5)
    .map((g, i) => ({
      id:          i + 1,
      lat:         g.lat,
      lng:         g.lng,
      suggestion:  'Plant shade tree (Peepal / Neem)',
      priority:    g.shade > 0.8 ? 'High' : 'Medium',
      benefit:     `Reduces heat by ~3°C in ${Math.round(g.shade * 30)}m radius`
    }));
}

module.exports = router;