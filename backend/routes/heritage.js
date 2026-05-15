const express = require('express');
const router  = express.Router();

// Ballari + Hampi region heritage sites
const HERITAGE_SITES = [
  {
    id:          'ballari-fort',
    name:        'Ballari Fort',
    nameKannada: 'ಬಳ್ಳಾರಿ ಕೋಟೆ',
    type:        'fort',
    period:      '17th Century',
    dynasty:     'Vijayanagara / Hyder Ali',
    description: `Built during the Vijayanagara Empire and later
      strengthened by Hyder Ali and Tipu Sultan. The fort sits
      atop twin rocky hills and offers panoramic views of Ballari.`,
    location:    { lat: 15.1425, lng: 76.9198 },
    arModel:     'ballari-fort.glb',
    markerImage: 'ballari-fort-marker.png',
    scale:       '0.5 0.5 0.5',
    rotation:    '0 0 0',
    facts: [
      'Two rocky hills — North Fort and South Fort',
      'Contains a mosque, temple and British-era buildings',
      'Declared a protected monument by ASI'
    ]
  },
  {
    id:          'hampi-virupaksha',
    name:        'Virupaksha Temple',
    nameKannada: 'ವಿರೂಪಾಕ್ಷ ದೇವಾಲಯ',
    type:        'temple',
    period:      '7th Century',
    dynasty:     'Vijayanagara Empire',
    description: `One of India's oldest functioning temples dedicated
      to Lord Shiva. The main tower (gopura) rises 49 metres and
      is the focal point of the UNESCO World Heritage Site at Hampi.`,
    location:    { lat: 15.3350, lng: 76.4600 },
    arModel:     'virupaksha.glb',
    markerImage: 'hampi-marker.png',
    scale:       '0.8 0.8 0.8',
    rotation:    '0 180 0',
    facts: [
      '49-metre tall gopura (entrance tower)',
      'UNESCO World Heritage Site since 1986',
      'Active place of worship for over 1300 years'
    ]
  },
  {
    id:          'hampi-stone-chariot',
    name:        'Stone Chariot — Vittala Temple',
    nameKannada: 'ವಿಠ್ಠಲ ದೇವಾಲಯದ ರಥ',
    type:        'monument',
    period:      '15th Century',
    dynasty:     'Vijayanagara Empire',
    description: `The iconic stone chariot of Hampi, located inside
      the Vittala Temple complex. Carved from granite, it is a
      masterpiece of Vijayanagara architecture and appears on
      the Indian 50-rupee note.`,
    location:    { lat: 15.3358, lng: 76.4756 },
    arModel:     'stone-chariot.glb',
    markerImage: 'chariot-marker.png',
    scale:       '0.6 0.6 0.6',
    rotation:    '0 90 0',
    facts: [
      'Appears on the Indian 50-rupee note',
      'Wheels used to rotate before they were cemented',
      'Dedicated to Garuda — vehicle of Lord Vishnu'
    ]
  },
  {
    id:          'daroji-bear-sanctuary',
    name:        'Daroji Bear Sanctuary',
    nameKannada: 'ದರೋಜಿ ಕರಡಿ ಅಭಯಾರಣ್ಯ',
    type:        'sanctuary',
    period:      'Modern',
    dynasty:     'Karnataka Forest Dept (1994)',
    description: `Asia's largest sloth bear sanctuary, home to
      over 120 sloth bears. Located 15km from Hampi, it offers
      jeep safaris and bear watching especially at dawn and dusk.`,
    location:    { lat: 15.3100, lng: 76.5100 },
    arModel:     'bear-sanctuary.glb',
    markerImage: 'daroji-marker.png',
    scale:       '0.4 0.4 0.4',
    rotation:    '0 0 0',
    facts: [
      '120+ sloth bears in natural habitat',
      'Asia\'s largest sloth bear sanctuary',
      'Best visited at dawn or dusk'
    ]
  }
];

// GET all heritage sites
router.get('/sites', (req, res) => {
  res.json(HERITAGE_SITES);
});

// GET single site
router.get('/sites/:id', (req, res) => {
  const site = HERITAGE_SITES.find(s => s.id === req.params.id);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  res.json(site);
});

// GET nearest site to user location
// Query: ?lat=15.14&lng=76.92&radius=50
router.get('/nearest', (req, res) => {
  const { lat, lng, radius = 50 } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng required' });
  }

  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);

  const withDistance = HERITAGE_SITES.map(site => ({
    ...site,
    distance: haversine(
      userLat, userLng,
      site.location.lat, site.location.lng
    )
  }))
  .filter(s => s.distance <= parseFloat(radius))
  .sort((a, b) => a.distance - b.distance);

  res.json(withDistance);
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