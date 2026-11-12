const express     = require('express');
const router      = express.Router();
const GovtOffice  = require('../models/GovtOffice');

// GET offices — the page previously used a static 12-entry array with no
// backend. Now backed by Mongo (45 verified offices).
// Query: ?category=police&search=rto
router.get('/offices', async (req, res) => {
  try {
    const { category, search } = req.query;
    const filter = {};

    if (category && category !== 'all') filter.category = category;
    if (search) {
      const q = search.trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { address: { $regex: q, $options: 'i' } },
        { type: { $regex: q, $options: 'i' } }
      ];
    }

    const results = await GovtOffice.find(filter).sort({ name: 1 }).lean();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Could not load government offices' });
  }
});

// GET distinct categories — used to populate the dropdown without shipping
// the whole dataset just to read its category field
router.get('/categories', async (req, res) => {
  try {
    const categories = await GovtOffice.distinct('category');
    res.json(categories.sort());
  } catch (err) {
    res.status(500).json({ error: 'Could not load categories' });
  }
});

// GET nearest offices to a lat/lng — now meaningful since coordinates exist
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, limit = 10 } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });

    const offices = await GovtOffice.find({}).lean();
    const withDist = offices.map(o => ({
      ...o,
      distanceKm: Number(haversine(
        parseFloat(lat), parseFloat(lng),
        o.location.lat, o.location.lng
      ).toFixed(2))
    })).sort((a, b) => a.distanceKm - b.distanceKm);

    res.json(withDist.slice(0, parseInt(limit)));
  } catch (err) {
    res.status(500).json({ error: 'Could not load nearby offices' });
  }
});

function haversine(lat1, lon1, lat2, lon2) {
  const R  = 6371;
  const dL = ((lat2 - lat1) * Math.PI) / 180;
  const dO = ((lon2 - lon1) * Math.PI) / 180;
  const a  =
    Math.sin(dL / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dO / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = router;