const express   = require('express');
const router    = express.Router();
const FoodPlace = require('../models/FoodPlace');

// ── BALLARI FOOD DATA ─────────────────────────────────
// Was a hand-typed placeholder array. Now backed by the FoodPlace collection
// in Mongo, populated by scripts/importFoodData.js from a verified geojson
// export (restaurants/cafes with real coordinates + ratings; hours/phone/
// cuisine weren't in that source so they're null — fill in by hand or a
// later pass, never invent them). Re-run the script any time
// data/raw/*.geojson updates.

// ── LOCAL EVENTS ──────────────────────────────────────
// STILL PLACEHOLDER DATA — no real source was provided for events, only for
// food/stay. Dates below are shifted to 2026 just so nothing shows as
// already-past; swap this whole array out once you have real event listings.
const LOCAL_EVENTS = [
  {
    id:       'e1',
    name:     'Ballari Utsav 2026',
    type:     'cultural',
    description: 'Annual cultural festival celebrating Ballari heritage with music, dance, and crafts.',
    location: { name: 'Cantonment Ground', lat: 15.1480, lng: 76.9120 },
    startDate: '2026-11-15',
    endDate:   '2026-11-17',
    time:      '5:00 PM – 10:00 PM',
    entry:     'Free',
    organizer: 'Ballari District Administration',
    tags:      ['cultural', 'free', 'family', 'music'],
    image:     '🎭'
  },
  {
    id:       'e2',
    name:     'Gandhi Nagar Weekly Market',
    type:     'market',
    description: 'Largest weekly market in Ballari. Fresh produce, clothes, and handicrafts.',
    location: { name: 'Gandhi Nagar Circle', lat: 15.1394, lng: 76.9214 },
    startDate: 'Every Sunday',
    endDate:   'Every Sunday',
    time:      '6:00 AM – 2:00 PM',
    entry:     'Free',
    organizer: 'BBMP Ballari',
    tags:      ['market', 'weekly', 'shopping', 'food'],
    image:     '🛒'
  },
  {
    id:       'e3',
    name:     'Hampi Heritage Run 5K',
    type:     'sports',
    description: 'Scenic 5K run through Ballari city streets raising awareness about Hampi heritage.',
    location: { name: 'Ballari Fort', lat: 15.1425, lng: 76.9198 },
    startDate: '2026-12-01',
    endDate:   '2026-12-01',
    time:      '6:00 AM – 9:00 AM',
    entry:     '₹150',
    organizer: 'Ballari Sports Authority',
    tags:      ['sports', 'running', 'heritage', 'fitness'],
    image:     '🏃'
  },
  {
    id:       'e4',
    name:     'Dasara Celebrations',
    type:     'festival',
    description: 'Grand Dasara procession through Old Town with decorated elephants and cultural shows.',
    location: { name: 'Old Town', lat: 15.1450, lng: 76.9150 },
    startDate: '2026-10-02',
    endDate:   '2026-10-11',
    time:      'All Day',
    entry:     'Free',
    organizer: 'District Administration',
    tags:      ['festival', 'free', 'religious', 'procession'],
    image:     '🐘'
  },
  {
    id:       'e5',
    name:     'Steel City Startup Summit',
    type:     'business',
    description: 'Annual startup event connecting Ballari entrepreneurs with investors and mentors.',
    location: { name: 'VIMS Auditorium', lat: 15.1550, lng: 76.9300 },
    startDate: '2026-11-20',
    endDate:   '2026-11-21',
    time:      '9:00 AM – 6:00 PM',
    entry:     '₹500',
    organizer: 'Ballari Startup Hub',
    tags:      ['business', 'startup', 'networking', 'tech'],
    image:     '💼'
  }
];

// ── TOURIST SPOTS ─────────────────────────────────────
// STILL PLACEHOLDER-STYLE DATA — no verified source was provided for these
// either (unlike food/stay). Facts (Hampi, Daroji, the dam) are broadly
// correct but ratings/entry fees aren't sourced the way the food data is.
const TOURIST_SPOTS = [
  {
    id:        't1',
    name:      'Ballari Fort',
    category:  'heritage',
    distance:  '2 km from city centre',
    timing:    '9:00 AM – 5:30 PM',
    entry:     '₹15 (Indian) / ₹200 (Foreign)',
    rating:    4.4,
    description: 'Twin-hill fort with panoramic views. Houses historical buildings from the Vijayanagara, Hyder Ali, and British eras.',
    tips:      'Visit early morning for best photos. Wear comfortable shoes.',
    location:  { lat: 15.1425, lng: 76.9198 },
    image:     '🏰',
    arAvailable: true
  },
  {
    id:        't2',
    name:      'Hampi (UNESCO Heritage)',
    category:  'heritage',
    distance:  '74 km from Ballari',
    timing:    '6:00 AM – 6:00 PM',
    entry:     '₹40 (Indian) / ₹600 (Foreign)',
    rating:    4.9,
    description: 'Capital of the Vijayanagara Empire. 500+ monuments including temples, markets, royal enclosures.',
    tips:      'Hire a guide. Carry water. Best in Oct–Feb.',
    location:  { lat: 15.3350, lng: 76.4600 },
    image:     '🛕',
    arAvailable: true
  },
  {
    id:        't3',
    name:      'Daroji Bear Sanctuary',
    category:  'nature',
    distance:  '15 km from Hampi',
    timing:    '6:00 AM – 6:00 PM',
    entry:     '₹200 (Indian) / ₹500 (Foreign)',
    rating:    4.3,
    description: 'Asia\'s largest sloth bear sanctuary. Best sighting time is dusk when bears come to feed.',
    tips:      'Visit at 4 PM for best bear sightings. Binoculars recommended.',
    location:  { lat: 15.3100, lng: 76.5100 },
    image:     '🐻',
    arAvailable: false
  },
  {
    id:        't4',
    name:      'Tungabhadra Dam',
    category:  'nature',
    distance:  '68 km from Ballari',
    timing:    '6:00 AM – 8:00 PM',
    entry:     'Free',
    rating:    4.2,
    description: 'Massive dam on the Tungabhadra river. Garden, boating, and musical fountain in the evening.',
    tips:      'Best visited during monsoon season. Evening musical fountain is a must-see.',
    location:  { lat: 15.2700, lng: 76.3400 },
    image:     '💧',
    arAvailable: false
  },
  {
    id:        't5',
    name:      'Sandur Palace',
    category:  'heritage',
    distance:  '23 km from Ballari',
    timing:    'By appointment',
    entry:     'Contact palace',
    rating:    4.1,
    description: 'Royal palace of the Sandur Kingdom. Houses a museum with artifacts and paintings.',
    tips:      'Call ahead to confirm visiting hours.',
    location:  { lat: 15.0800, lng: 76.5500 },
    image:     '🏯',
    arAvailable: false
  }
];

// ── ROUTES ────────────────────────────────────────────

// GET restaurants
// Query: ?tag=breakfast&cuisine=South Indian&price=₹&search=...
router.get('/food', async (req, res) => {
  try {
    const { tag, cuisine, price, search } = req.query;
    const filter = { category: { $in: ['restaurant', 'cafe'] } };

    if (tag)   filter.tags = tag;
    if (price) filter.priceRange = price;
    if (cuisine) filter.cuisine = { $regex: cuisine, $options: 'i' };
    if (search) {
      const q = search.trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { specialty: { $regex: q, $options: 'i' } },
        { tags: { $regex: q, $options: 'i' } }
      ];
    }

    const results = await FoodPlace.find(filter).lean();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Could not load food data' });
  }
});

// GET events
router.get('/events', (req, res) => {
  const { type } = req.query;
  const results  = type
    ? LOCAL_EVENTS.filter(e => e.type === type)
    : LOCAL_EVENTS;
  res.json(results);
});

// GET tourist spots
router.get('/tourist', (req, res) => {
  const { category } = req.query;
  const results = category
    ? TOURIST_SPOTS.filter(s => s.category === category)
    : TOURIST_SPOTS;
  res.json(results.sort((a, b) => b.rating - a.rating));
});

// GET nearby food (by user lat/lng) — used by the food page's "Near Me" sort
router.get('/food/nearby', async (req, res) => {
  try {
    const { lat, lng, limit = 50 } = req.query;
    const places = await FoodPlace.find({ category: { $in: ['restaurant', 'cafe'] } }).lean();

    if (!lat || !lng) {
      return res.json(places.slice(0, parseInt(limit)));
    }

    const withDist = places.map(r => ({
      ...r,
      distanceKm: Number(haversine(
        parseFloat(lat), parseFloat(lng),
        r.location.lat, r.location.lng
      ).toFixed(2))
    })).sort((a, b) => a.distanceKm - b.distanceKm);

    res.json(withDist.slice(0, parseInt(limit)));
  } catch (err) {
    res.status(500).json({ error: 'Could not load nearby food' });
  }
});

// GET tourist mode package (spots + a few events, shown on the Explore page)
router.get('/tourist-mode', (req, res) => {
  res.json({
    spots:  TOURIST_SPOTS,
    events: LOCAL_EVENTS,
    tips: [
      'Best time to visit: October – February',
      'Carry cash — many local shops are cash only',
      'Hire a local auto for ₹50–₹100/hour',
      'Learn basic Kannada: Dhanyavadagalu = Thank you',
      'Ballari is 1.5 hrs from Hospet by bus'
    ],
    transport: {
      fromBangalore: '6 hrs by bus / 5.5 hrs by train',
      fromHubli:     '3 hrs by bus',
      local:         'Auto-rickshaw, KSRTC city buses'
    }
  });
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