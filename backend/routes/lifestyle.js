const express = require('express');
const router  = express.Router();

// ── BALLARI FOOD DATA ─────────────────────────────────
const RESTAURANTS = [
  {
    id:       'r1',
    name:     'Hotel Nalapaka',
    type:     'restaurant',
    cuisine:  ['Karnataka', 'South Indian'],
    specialty:'Jolada Rotti + Enne Gai',
    address:  'Gandhi Nagar, Ballari',
    location: { lat: 15.1398, lng: 76.9218 },
    rating:   4.3,
    priceRange: '₹',
    hours:    '7:00 AM – 10:00 PM',
    phone:    '08392-241234',
    tags:     ['local', 'breakfast', 'vegetarian', 'authentic'],
    image:    '🍱',
    mustTry:  ['Jolada Rotti', 'Enne Gai', 'Shenga Chutney']
  },
  {
    id:       'r2',
    name:     'Kamat Hotel',
    type:     'restaurant',
    cuisine:  ['South Indian', 'Tiffin'],
    specialty:'Idli + Filter Coffee',
    address:  'Nehru Gunj, Ballari',
    location: { lat: 15.1422, lng: 76.9182 },
    rating:   4.1,
    priceRange: '₹',
    hours:    '6:30 AM – 11:00 PM',
    phone:    '08392-242000',
    tags:     ['breakfast', 'coffee', 'vegetarian', 'budget'],
    image:    '☕',
    mustTry:  ['Filter Coffee', 'Masala Dosa', 'Vada']
  },
  {
    id:       'r3',
    name:     'Hampi Garden Restaurant',
    type:     'restaurant',
    cuisine:  ['Multi-cuisine', 'Continental'],
    specialty:'Hampi Thali',
    address:  'Hospet Road, Ballari',
    location: { lat: 15.1305, lng: 76.9375 },
    rating:   4.5,
    priceRange: '₹₹',
    hours:    '11:00 AM – 11:00 PM',
    phone:    '08392-243567',
    tags:     ['lunch', 'dinner', 'family', 'thali', 'tourist'],
    image:    '🍽️',
    mustTry:  ['Hampi Thali', 'Neer Dosa', 'Kesari Bath']
  },
  {
    id:       'r4',
    name:     'Biryani House',
    type:     'restaurant',
    cuisine:  ['Biryani', 'North Karnataka'],
    specialty:'Ballari Dum Biryani',
    address:  'Old Town, Ballari',
    location: { lat: 15.1452, lng: 76.9155 },
    rating:   4.4,
    priceRange: '₹₹',
    hours:    '12:00 PM – 11:00 PM',
    phone:    '08392-244890',
    tags:     ['lunch', 'dinner', 'biryani', 'non-veg'],
    image:    '🍛',
    mustTry:  ['Dum Biryani', 'Mutton Curry', 'Raita']
  },
  {
    id:       'r5',
    name:     'Tungabhadra Juice Center',
    type:     'cafe',
    cuisine:  ['Juices', 'Snacks', 'Chaat'],
    specialty:'Fresh Sugarcane Juice',
    address:  'KSRTC Stand Area, Ballari',
    location: { lat: 15.1352, lng: 76.9252 },
    rating:   4.2,
    priceRange: '₹',
    hours:    '8:00 AM – 9:00 PM',
    phone:    '',
    tags:     ['snacks', 'juice', 'street food', 'budget'],
    image:    '🥤',
    mustTry:  ['Sugarcane Juice', 'Mirchi Bajji', 'Pani Puri']
  },
  {
    id:       'r6',
    name:     'Sree Venkateshwara Mess',
    type:     'mess',
    cuisine:  ['Karnataka', 'Home-style'],
    specialty:'Full Meals',
    address:  'Cantonment, Ballari',
    location: { lat: 15.1482, lng: 76.9122 },
    rating:   4.0,
    priceRange: '₹',
    hours:    '7:00 AM – 10:00 PM',
    phone:    '08392-260111',
    tags:     ['meals', 'vegetarian', 'budget', 'homestyle'],
    image:    '🍚',
    mustTry:  ['Full Meals', 'Sambar Rice', 'Curd Rice']
  },
  {
    id:       'r7',
    name:     'Café Hampi Heights',
    type:     'cafe',
    cuisine:  ['Café', 'Continental', 'Bakery'],
    specialty:'Cold Coffee + Sandwiches',
    address:  'Gandhi Nagar, Ballari',
    location: { lat: 15.1396, lng: 76.9220 },
    rating:   4.3,
    priceRange: '₹₹',
    hours:    '9:00 AM – 10:00 PM',
    phone:    '08392-241999',
    tags:     ['cafe', 'coffee', 'wifi', 'snacks', 'youth'],
    image:    '☕',
    mustTry:  ['Cold Coffee', 'Club Sandwich', 'Chocolate Cake']
  },
  {
    id:       'r8',
    name:     'Darshini Fast Food',
    type:     'fastfood',
    cuisine:  ['Fast Food', 'South Indian'],
    specialty:'Quick Bites',
    address:  'Nehru Gunj, Ballari',
    location: { lat: 15.1424, lng: 76.9184 },
    rating:   3.9,
    priceRange: '₹',
    hours:    '8:00 AM – 10:00 PM',
    phone:    '',
    tags:     ['quick', 'budget', 'takeaway', 'breakfast'],
    image:    '🥙',
    mustTry:  ['Upma', 'Poha', 'Tea']
  }
];

// ── LOCAL EVENTS ──────────────────────────────────────
const LOCAL_EVENTS = [
  {
    id:       'e1',
    name:     'Ballari Utsav 2025',
    type:     'cultural',
    description: 'Annual cultural festival celebrating Ballari heritage with music, dance, and crafts.',
    location: { name: 'Cantonment Ground', lat: 15.1480, lng: 76.9120 },
    startDate: '2025-11-15',
    endDate:   '2025-11-17',
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
    startDate: '2025-12-01',
    endDate:   '2025-12-01',
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
    startDate: '2025-10-02',
    endDate:   '2025-10-11',
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
    startDate: '2025-11-20',
    endDate:   '2025-11-21',
    time:      '9:00 AM – 6:00 PM',
    entry:     '₹500',
    organizer: 'Ballari Startup Hub',
    tags:      ['business', 'startup', 'networking', 'tech'],
    image:     '💼'
  }
];

// ── TOURIST SPOTS ─────────────────────────────────────
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
// Query: ?tag=breakfast&cuisine=South Indian&price=₹
router.get('/food', (req, res) => {
  const { tag, cuisine, price, search } = req.query;
  let results = [...RESTAURANTS];

  if (tag)    results = results.filter(r => r.tags.includes(tag));
  if (price)  results = results.filter(r => r.priceRange === price);
  if (search) {
    const q = search.toLowerCase();
    results = results.filter(r =>
      r.name.toLowerCase().includes(q)    ||
      r.specialty.toLowerCase().includes(q)||
      r.tags.some(t => t.includes(q))
    );
  }
  if (cuisine) {
    results = results.filter(r =>
      r.cuisine.some(c => c.toLowerCase().includes(cuisine.toLowerCase()))
    );
  }

  res.json(results);
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

// GET nearby food (by user lat/lng)
router.get('/food/nearby', (req, res) => {
  const { lat, lng, limit = 5 } = req.query;
  if (!lat || !lng) {
    return res.json(RESTAURANTS.slice(0, parseInt(limit)));
  }

  const withDist = RESTAURANTS.map(r => ({
    ...r,
    distance: haversine(
      parseFloat(lat), parseFloat(lng),
      r.location.lat, r.location.lng
    )
  })).sort((a, b) => a.distance - b.distance);

  res.json(withDist.slice(0, parseInt(limit)));
});

// GET tourist mode package
router.get('/tourist-mode', (req, res) => {
  res.json({
    spots:       TOURIST_SPOTS,
    restaurants: RESTAURANTS.filter(r => r.tags.includes('tourist')),
    events:      LOCAL_EVENTS.slice(0, 3),
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