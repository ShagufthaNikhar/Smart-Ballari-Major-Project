const express = require('express');
const router  = express.Router();

const Monument    = require('../models/Monument');
const verifyToken = require('../middleware/verifyToken');
const requireRole = require('../middleware/requireRole');

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
    id:          'hampi-lotus-mahal',
    name:        'Lotus Mahal',
    nameKannada: 'ಕಮಲ ಮಹಲ್',
    type:        'monument',
    period:      '16th century CE',
    dynasty:     'Vijayanagara Empire',
    description: 'Two-storeyed pavilion in the Zenana Enclosure at Hampi, '
               + 'named for its lotus-like form and known for its fusion of '
               + 'Deccan Sultanate arches with Vijayanagara towers.',
    location:    { lat: 15.3316, lng: 76.4727 },
    facts: [
      'Also called Kamal Mahal and Chitrangini Mahal',
      'Nine interlocking pyramidal towers crowned with lotus-bud finials',
      'One of the few buildings at Hampi left largely undamaged in 1565'
    ],
    scale: '1 1 1'
  },
  {
    id:          'hampi-narasimha',
    name:        'Lakshmi Narasimha Statue',
    nameKannada: 'ಲಕ್ಷ್ಮೀ ನರಸಿಂಹ',
    type:        'monument',
    period:      '1528 CE',
    dynasty:     'Vijayanagara Empire',
    description: 'The largest monolithic statue at Hampi: Vishnu in his '
               + 'man-lion form, seated on the coils of the seven-headed '
               + 'serpent Adisesha.',
    location:    { lat: 15.3339, lng: 76.4589 },
    facts: [
      'Largest monolith at Hampi at 6.7 metres tall',
      'Carved from a single rock in 1528 CE',
      'Commonly called Ugra Narasimha because of the damaged face'
    ],
    scale: '1 1 1'
  },
  {
    id:          'hampi-stone-elephant',
    name:        'Stone Elephant, Hampi',
    nameKannada: 'ಹಂಪಿ ಕಲ್ಲಿನ ಆನೆ',
    type:        'monument',
    period:      'Vijayanagara period',
    dynasty:     'Vijayanagara Empire',
    description: 'A damaged stone elephant among the Hampi ruins, of the kind '
               + 'carved to flank temple stairways and gateways across the '
               + 'Vijayanagara capital.',
    // TODO: replace with the coordinates of the specific statue once identified.
    // These point at the Hampi ruins generally, not at this sculpture.
    location:    { lat: 15.3350, lng: 76.4600 },
    facts: [
      'Elephants flank stairways and gateways throughout Hampi',
      'Many were damaged when the capital was sacked in 1565',
      'Carved from the local granite the whole site is built from'
    ],
    scale: '1 1 1'
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


// ═══════════════════════════════════════════════════════════════════
//  MONUMENTS — the Heritage AR module
//
//  The /sites routes above are unchanged and still serve ar-view.html.
//  These are the richer records the AR page needs. On startup the
//  collection is seeded from HERITAGE_SITES so both describe the same
//  monuments, then edited independently through the admin routes.
// ═══════════════════════════════════════════════════════════════════

// Content that is genuinely known about Ballari Fort. Written out here rather
// than left blank because a demo with empty history panels shows nothing.
// Sources: Karnataka Tourism, Ballari district administration, Wikipedia.
const MONUMENT_SEED = {
  'ballari-fort': {
    shortDescription: 'Vijayanagara-era hill fort on the monolithic Ballari Gudda.',
    heritageCategory: 'ASI protected monument',
    history: `Bellary Fort stands on Ballari Gudda, a monolithic granite hill
      rising abruptly from the plains. It was built in two parts. The Upper
      Fort, a polygonal citadel at the summit, was raised in the 16th century
      by Hanumappa Nayaka, a feudatory of the Vijayanagara Empire, and became
      the residence of the Hande family. In 1769 Hyder Ali took the fort and
      had it renovated, commissioning a French engineer who also built the
      Lower Fort at the eastern base. Legend holds that the engineer was hanged
      at the east gate for overlooking that the neighbouring Kumbara Gudda
      stood taller, compromising the fort's command of the terrain. His grave,
      dated 1769, is still pointed out near the gate. After Tipu Sultan's
      defeat in the Third Anglo-Mysore War the district passed to the Nizam,
      and later to the British, who classed it a first-class fort.`,
    location: { lat: 15.1425, lng: 76.9198, address: 'Ballari Gudda (Fort Hill), Ballari, Karnataka' },
    modelUrl:   '../models/ballari-fort.glb',
    modelScale: '1 1 1',
    modelCredit: 'Schematic 3D reconstruction based on the documented fort plan. '
               + 'Not a survey-accurate or photogrammetric model.',
    posterUrl:  '../images/fort-overview.jpg',
    // Renders of OUR OWN reconstruction, not photographs of the fort. Every
    // caption says so - passing a render off as a photograph would be a
    // misrepresentation, and using someone else's photo would be a licensing
    // problem. Replace these with your own photographs when you have them.
    images: [
      { url: '../images/fort-overview.jpg',   kind: 'architecture',
        caption: 'Reconstruction: the fort seen from the south-east, upper fort on the summit' },
      { url: '../images/fort-lower-gate.jpg', kind: 'architecture',
        caption: 'Reconstruction: the Lower Fort at the eastern base, with the Kote Anjaneya temple beyond the east gate' },
      { url: '../images/fort-north.jpg',      kind: 'architecture',
        caption: 'Reconstruction: the longer northern flank of Ballari Gudda' },
      { url: '../images/fort-plan.jpg',       kind: 'detail',
        caption: 'Reconstruction: plan view showing both fortified circuits and the rock-cut ascent' }
    ],
    // Read aloud by the phone's own speech synthesis. Numerals are left as
    // digits because on-device voices pronounce them correctly, unlike the
    // espeak fallback the MP3 was made with.
    narrationText:
      'Welcome to Ballari Fort, in Ballari, Karnataka. '
      + 'The fort stands on Ballari Gudda, a single mass of granite rising abruptly from the surrounding plains, and it was built in two parts. '
      + 'The Upper Fort, at the summit, was raised in the 16th century by Hanumappa Nayaka, a feudatory of the Vijayanagara Empire. '
      + 'It is polygonal, with a single entrance, and holds a citadel, a temple, cisterns cut into the rock, and cells for soldiers. '
      + 'In 1769, Hyder Ali took the fort and had it renovated. He commissioned a French engineer, who also built the Lower Fort at the eastern base of the rock. '
      + 'That lower fort is ringed by ramparts with numerous bastions, a deep ditch, and two gateways, one to the east and one to the west. '
      + 'Legend holds that the engineer was hanged at the east gate, for overlooking that the neighbouring Kumbara Gudda stood taller, and so commanded the fort. '
      + 'A grave dated 1769 is still pointed out near that gate. '
      + 'Just outside the eastern gate stands the Kote Anjaneya temple, dedicated to Hanuman. '
      + 'After the defeat of Tipu Sultan in the Third Anglo-Mysore War, the district passed to the Nizam, and later to the British, who classed this a first class fort. '
      + 'Today the fort is a protected monument, open to the public, and lit in the evenings above the city of Ballari.',
    audioUrl:   '../audio/ballari-fort-guide.mp3',
    timeline: [
      { year: '16th Century', title: 'Upper Fort built',
        detail: 'Raised by Hanumappa Nayaka, a feudatory of the Vijayanagara Empire, as a citadel on the summit.' },
      { year: '1678', title: 'Shivaji passes through',
        detail: 'The Maratha ruler passed by the fort during a campaign; it was later restored on payment of tribute.' },
      { year: '1769', title: 'Hyder Ali takes the fort',
        detail: 'Renovated with a French engineer, who also built the bastioned Lower Fort at the eastern base.' },
      { year: 'Late 18th C.', title: 'Anglo-Mysore Wars',
        detail: "After Tipu Sultan's defeat the district passed to the Nizam, and subsequently to the British." },
      { year: 'Present day', title: 'Protected monument',
        detail: 'Maintained as a heritage site, open to the public, illuminated on evenings and holidays.' }
    ],
    facts: [
      'Built on a monolithic granite hill, Ballari Gudda',
      'Upper Fort citadel stands at roughly 1,976 ft',
      'Lower Fort is about 0.8 km across with two gates, east and west',
      'Kote Anjaneya Temple stands just outside the eastern gate'
    ]
  },

  'hampi-virupaksha': {
    shortDescription: 'Continuously in worship since about the 7th century \u2014 the one Hampi temple never abandoned.',
    heritageCategory: 'UNESCO World Heritage Site (Group of Monuments at Hampi)',
    history: `The Virupaksha temple stands on the south bank of the Tungabhadra and is
      dedicated to Virupaksha, a form of Shiva, worshipped here alongside Pampa, the
      goddess associated with the river. Its history runs unbroken from about the 7th
      century, which makes it older than the Vijayanagara capital that grew up around
      it: inscriptions referring to Shiva survive from the 9th and 10th centuries.
      What began as a modest shrine was enlarged under the Chalukyas and Hoysalas and
      then greatly expanded under Vijayanagara rule, when Lakkan Dandesha, a chieftain
      under Deva Raya II, built the large temple structure. Krishnadevaraya was its
      most significant patron; an inscription on a stone plaque beside the pillared
      hall records that he commissioned the central pillared hall and the eastern
      gateway in 1510 to mark his accession. That eastern gopura rises nine tiers to
      about 50 metres. When the capital was sacked in 1565 and the city abandoned,
      worship here did not stop. The Virupaksha-Pampa sect continued, and the temple
      is the one major structure at Hampi that has remained in continuous use rather
      than becoming a ruin. Its broken north and east towers were restored in the
      early 19th century, and ceiling paintings from the 14th to 16th centuries
      survive inside.`,
    timeline: [
      { year: 'c. 7th century', title: 'The Virupaksha-Pampa shrine',
        detail: 'A modest sanctuary is established on the bank of the Tungabhadra, long before the Vijayanagara capital exists.' },
      { year: '9th\u201310th century', title: 'Earliest surviving inscriptions',
        detail: 'Inscriptions referring to Shiva confirm worship at the site.' },
      { year: '15th century', title: 'Expanded under Deva Raya II',
        detail: 'Lakkan Dandesha, a chieftain under Deva Raya II, builds the large temple structure around the older shrine.' },
      { year: '1510', title: 'Krishnadevaraya\u2019s additions',
        detail: 'The central pillared hall and the nine-tiered eastern gopura are commissioned to mark his accession, recorded on a plaque beside the hall.' },
      { year: '1565', title: 'The capital falls, worship continues',
        detail: 'Vijayanagara is sacked and abandoned, but the Virupaksha-Pampa sect keeps the temple in use \u2014 alone among Hampi\u2019s major temples.' },
      { year: '19th century', title: 'Towers restored',
        detail: 'The broken north and east gopuras are repaired in a major programme of restoration.' }
    ],
    facts: [
      'In continuous worship for roughly 1,300 years',
      'The eastern gopura has nine tiers and rises about 50 metres',
      'Ceiling paintings survive from the 14th to 16th centuries',
      'The only major Hampi temple never abandoned after 1565'
    ],
    narrationText:
      'This is the Virupaksha temple at Hampi, on the south bank of the Tungabhadra river. '
      + 'It is dedicated to Virupaksha, a form of Shiva, worshipped here alongside Pampa, the goddess associated with the river. '
      + 'Its history runs unbroken from about the 7th century, which makes it older than the Vijayanagara capital that grew up around it. Inscriptions referring to Shiva survive from the 9th and 10th centuries. '
      + 'What began as a modest shrine was enlarged under the Chalukyas and the Hoysalas, and then greatly expanded under Vijayanagara rule, when Lakkan Dandesha, a chieftain under Deva Raya II, built the large temple structure. '
      + 'Krishnadevaraya was its most important patron. An inscription on a stone plaque beside the pillared hall records that he commissioned the central hall and the eastern gateway in 1510, to mark his accession. That eastern tower rises nine tiers, to about 50 metres. '
      + 'When the capital was sacked in 1565 and the city abandoned, worship here did not stop. The Virupaksha-Pampa sect continued, and this is the one major structure at Hampi that has remained in use rather than becoming a ruin. It has been a place of worship for roughly thirteen hundred years.',
    modelUrl:   '../models/hampi-virupaksha.glb',
    // Low-poly architectural model with flat colour materials and no textures,
    // unlike the photogrammetry scans used for the other monuments. The
    // surrounding terrain, boulders and trees were stripped so only the temple
    // complex remains.
    modelCredit: 'MODEL_CREDIT_PLACEHOLDER'
  },

  'hampi-stone-chariot': {
    shortDescription: 'Stone shrine carved as a temple chariot, in the Vijaya Vittala complex.',
    heritageCategory: 'UNESCO World Heritage Site (Group of Monuments at Hampi)',
    history: `The stone chariot stands in the courtyard of the Vijaya Vittala temple
      complex at Hampi, facing the shrine of Garuda to whom it is dedicated. Though
      it reads as a single carved block, it was built from granite blocks fitted
      together, with the joins concealed beneath the carving. It takes the form of a
      processional temple chariot, or ratha, of the kind drawn through the streets
      during festivals, with a plinth carved in relief, four wheels on axles, and a
      shrine above. The wheels were once able to turn; they were later fixed in place
      to prevent damage from visitors. Two elephants stand at the front, though these
      were placed later and replaced an original pair of horses, the remains of which
      can still be seen behind them. The chariot is among the most recognised images
      of Vijayanagara architecture and appears on the Indian fifty rupee note.`,
    timeline: [
      { year: '15th century', title: 'Vijaya Vittala complex begun',
        detail: 'The temple complex is developed under the Vijayanagara rulers as a major centre of worship.' },
      { year: 'c. 1500s', title: 'Chariot built under Krishnadevaraya',
        detail: 'The stone chariot is raised in the courtyard, dedicated to Garuda, the mount of Vishnu.' },
      { year: 'Later period', title: 'Horses replaced by elephants',
        detail: 'The original pair of horses at the front is replaced by elephants; traces of the horses remain behind them.' },
      { year: '1986', title: 'Inscribed as a World Heritage Site',
        detail: 'The Group of Monuments at Hampi is added to the UNESCO World Heritage list.' },
      { year: 'Present day', title: 'Wheels fixed, chariot conserved',
        detail: 'The wheels, once free to rotate, are secured to prevent damage. The chariot appears on the fifty rupee note.' }
    ],
    modelUrl:   '../models/hampi-stone-chariot.glb',
    modelCredit: 'MODEL_CREDIT_PLACEHOLDER',
    narrationText:
      'This is the stone chariot at Hampi, in the courtyard of the Vijaya Vittala temple complex. '
      + 'It is a shrine carved in the form of a processional temple chariot, dedicated to Garuda, the mount of Vishnu, whose shrine it faces. '
      + 'Although it appears to be carved from a single rock, it was assembled from granite blocks, with the joins hidden beneath the carving. '
      + 'The plinth is carved in relief, and four stone wheels sit on axles. Those wheels could once be turned; they were later fixed in place to protect them. '
      + 'Two elephants stand at the front. They were added later, replacing an original pair of horses, whose remains can still be seen behind them. '
      + 'The chariot was built in the 16th century, during the reign of Krishnadevaraya, and is one of the most recognised images of Vijayanagara architecture. '
      + 'It appears today on the Indian fifty rupee note. Hampi was inscribed as a UNESCO World Heritage Site in 1986.'
  },

  'hampi-lotus-mahal': {
    shortDescription: 'Lotus-shaped pavilion in Hampi\u2019s Zenana Enclosure, fusing Islamic arches with Vijayanagara towers.',
    heritageCategory: 'UNESCO World Heritage Site (Group of Monuments at Hampi)',
    history: `The Lotus Mahal stands inside the Zenana Enclosure, a walled compound in
      Hampi\u2019s Royal Centre. It is a two-storeyed pavilion of recessed arched
      openings, topped by a pyramidal roof worked into nine interlocking towers
      crowned with lotus-bud finials, and its name comes from that lotus-like form.
      The building is unusual at Hampi: the lobed arches and plaster work follow
      Deccan Sultanate models, while the curved eaves and pyramidal towers are drawn
      from temple architecture, producing a fusion found almost nowhere else in South
      India. What it was actually used for is genuinely unknown. No inscription names
      it and no medieval account describes it. Early British maps of 1799 label it a
      council chamber; it is popularly described as a retreat for the royal women,
      while the small doorway linking the enclosure to the elephant stables has been
      read as evidence against that. When Vijayanagara was sacked in 1565 and
      abandoned, the Lotus Mahal was among the very few structures to survive largely
      intact.`,
    timeline: [
      { year: '16th century', title: 'Built in the Royal Centre',
        detail: 'Raised inside the walled Zenana Enclosure, near the Hazara Rama temple and the elephant stables.' },
      { year: 'Vijayanagara period', title: 'Purpose unrecorded',
        detail: 'No inscription or contemporary account records what the building was for.' },
      { year: '1565', title: 'Survives the sack of Vijayanagara',
        detail: 'The capital is destroyed by the Deccan sultanates and abandoned; the Lotus Mahal is left largely undamaged.' },
      { year: '1799', title: 'Mapped as a council chamber',
        detail: 'Early British surveys of the site label the pavilion a council chamber rather than a residence.' },
      { year: '1986', title: 'Inscribed as a World Heritage Site',
        detail: 'The Group of Monuments at Hampi is added to the UNESCO World Heritage list.' }
    ],
    facts: [
      'Also called Kamal Mahal and Chitrangini Mahal',
      'Nine pyramidal towers with lotus-bud finials over two storeys of arches',
      'Lobed Sultanate arches combined with Vijayanagara curved eaves',
      'Its original function is not recorded anywhere'
    ],
    modelUrl:   '../models/hampi-lotus-mahal.glb',
    modelCredit: 'MODEL_CREDIT_PLACEHOLDER',
    narrationText:
      'This is the Lotus Mahal, in the Zenana Enclosure at Hampi. '
      + 'It is a two-storeyed pavilion of recessed arched openings, topped by a pyramidal roof worked into nine interlocking towers, each crowned with a lotus-bud finial. Its name comes from that lotus-like form. '
      + 'The building is unusual for Hampi. Its lobed arches and plaster work follow Deccan Sultanate models, while the curved eaves and pyramidal towers come from temple architecture. The combination is found almost nowhere else in South India. '
      + 'What the building was used for is genuinely unknown. No inscription names it, and no medieval account describes it. British maps of 1799 label it a council chamber. It is popularly described as a retreat for the royal women of the court, though a small doorway connecting the enclosure to the elephant stables has been read as evidence against that. '
      + 'When Vijayanagara was sacked in 1565 and abandoned, the Lotus Mahal was one of the very few buildings left standing largely intact. It is also known as the Kamal Mahal, or the Chitrangini Mahal.'
  },

  'hampi-narasimha': {
    shortDescription: 'The largest monolith at Hampi \u2014 Vishnu as Narasimha, carved from a single rock in 1528.',
    heritageCategory: 'UNESCO World Heritage Site (Group of Monuments at Hampi)',
    history: `The Lakshmi Narasimha statue stands south of the Krishna temple at Hampi
      and is the largest monolithic sculpture at the site, 6.7 metres tall and carved
      from a single block of granite. A lithic record beside it states that it was
      consecrated in 1528 during the reign of Krishnadevaraya. It shows Vishnu in his
      fourth incarnation, the man-lion Narasimha, seated cross-legged in a yoga
      posture with a band supporting the knees, on the coils of Adisesha, whose seven
      hoods rise above his head. The statue is often called Ugra Narasimha, the
      wrathful form, on account of the protruding eyes and fierce expression. That
      name may be a consequence of the damage rather than the original intent: a
      smaller figure of the goddess Lakshmi once sat on his left lap, and her hand can
      still be seen resting on his back, which indicates the sculpture was made as a
      Lakshmi Narasimha. The statue was broken during the sack of Vijayanagara by the
      Deccan sultanates in 1565. Its four arms were shattered and the figure of Lakshmi
      was detached; the damaged Lakshmi is now held in the Archaeological Museum at
      Kamalapura. The roof of the chamber that once enclosed the statue is also gone,
      which has exposed it to weathering.`,
    timeline: [
      { year: '1528', title: 'Carved and consecrated',
        detail: 'A lithic record beside the statue records its consecration under Krishnadevaraya.' },
      { year: 'Vijayanagara period', title: 'Worshipped as Lakshmi Narasimha',
        detail: 'Lakshmi is seated on the left lap of the deity, within a roofed chamber.' },
      { year: '1565', title: 'Damaged in the sack of Vijayanagara',
        detail: 'The arms are broken and the figure of Lakshmi is detached during the destruction of the capital.' },
      { year: 'Later', title: 'Lakshmi moved to the museum',
        detail: 'The damaged figure is recovered and placed in the Archaeological Museum at Kamalapura. Her hand remains on Narasimha\u2019s back.' },
      { year: 'Present day', title: 'Hampi\u2019s largest monolith',
        detail: 'The statue stands roofless and weathered, among the most visited monuments at the site.' }
    ],
    facts: [
      'Largest monolithic sculpture at Hampi, 6.7 metres tall',
      'Seated on the coils of the seven-headed serpent Adisesha',
      'Lakshmi\u2019s surviving hand rests on Narasimha\u2019s back',
      'The original four arms held a conch, discus, mace and lotus'
    ],
    modelUrl:   '../models/hampi-narasimha.glb',
    modelCredit: 'MODEL_CREDIT_PLACEHOLDER',
    narrationText:
      'This is the Lakshmi Narasimha statue at Hampi, the largest monolithic sculpture at the site. '
      + 'It stands 6.7 metres tall, carved from a single block of granite. An inscribed slab beside it records that it was consecrated in 1528, during the reign of Krishnadevaraya. '
      + 'It shows Vishnu in his fourth incarnation, the man-lion Narasimha, seated cross-legged in a yoga posture with a band supporting the knees, on the coils of the serpent Adisesha, whose seven hoods rise above his head. '
      + 'The statue is often called Ugra Narasimha, the wrathful form, because of its protruding eyes and fierce expression. That name may be a result of the damage rather than the original intent. A smaller figure of the goddess Lakshmi once sat on his left lap, and her hand can still be seen resting on his back. '
      + 'The statue was broken during the sack of Vijayanagara by the Deccan sultanates in 1565. Its arms were shattered, and the figure of Lakshmi was detached. She is now kept in the Archaeological Museum at Kamalapura. '
      + 'The chamber that once roofed the statue is gone, and it has stood exposed to the weather ever since.'
  },

  'hampi-stone-elephant': {
    shortDescription: 'A damaged stone elephant among the Hampi ruins.',
    heritageCategory: 'UNESCO World Heritage Site (Group of Monuments at Hampi)',
    // NOTE: this text is deliberately general. The particular statue this model
    // was scanned from has not been identified, so nothing here claims a specific
    // temple, patron or date. If you identify it, replace this entry and the
    // coordinates in HERITAGE_SITES with the real details.
    history: `Elephants are carved throughout Hampi. They flank the stairways of
      temple mandapas, guard gateways, appear along balustrades, and are worked into
      the relief friezes that run around plinths such as those of the Hazara Rama
      temple. In Vijayanagara the elephant was both a royal and a sacred animal:
      the empire maintained war elephants, housed near the Zenana Enclosure in the
      range of domed chambers still known as the elephant stables, and the animal
      recurs in temple sculpture as a symbol of strength and auspiciousness. Much of
      this sculpture was damaged when the capital was sacked by the Deccan sultanates
      in 1565 and the city was abandoned. Broken elephants, missing trunks and
      severed limbs are a common sight across the site, and are part of why Hampi
      reads as a ruined city rather than a preserved one. This particular statue has
      not been matched to a documented monument.`,
    timeline: [
      { year: '14th\u201316th century', title: 'Vijayanagara capital built',
        detail: 'Temples, gateways and enclosures across the site are carved from local granite, with elephants a recurring motif.' },
      { year: 'Vijayanagara period', title: 'Elephants in royal and sacred use',
        detail: 'War elephants are stabled near the Zenana Enclosure; the animal appears throughout temple sculpture.' },
      { year: '1565', title: 'The capital is sacked',
        detail: 'Vijayanagara falls to the Deccan sultanates and is abandoned. Much of its sculpture is deliberately damaged.' },
      { year: '1986', title: 'Inscribed as a World Heritage Site',
        detail: 'The Group of Monuments at Hampi is added to the UNESCO World Heritage list.' }
    ],
    modelUrl:   '../models/hampi-elephant.glb',
    modelCredit: 'MODEL_CREDIT_PLACEHOLDER',
    narrationText:
      'This is a stone elephant among the ruins at Hampi. '
      + 'Elephants are carved throughout the site. They flank the stairways of temple halls, guard gateways, run along balustrades, and appear in the relief friezes around temple plinths. '
      + 'In the Vijayanagara empire the elephant was both a royal and a sacred animal. War elephants were kept near the Zenana Enclosure, in the range of domed chambers still known as the elephant stables, and the animal recurs in temple sculpture as a symbol of strength. '
      + 'Much of that sculpture was damaged when the capital was sacked by the Deccan sultanates in 1565, and the city was abandoned. Broken elephants, missing trunks and severed limbs are a common sight at Hampi, and are part of why the place reads as a ruined city rather than a preserved one.'
  }
};


let monumentsReady = false;

async function seedMonuments() {
  try {
    for (const site of HERITAGE_SITES) {
      const extra = MONUMENT_SEED[site.id] || {};
      const existing = await Monument.findOne({ slug: site.id });
      if (existing) continue;                       // never clobber admin edits

      await Monument.create({
        slug: site.id,
        name: site.name,
        nameKannada: site.nameKannada,
        type: site.type,
        description: (site.description || '').replace(/\s+/g, ' ').trim(),
        period: site.period,
        dynasty: site.dynasty,
        facts: site.facts || [],
        location: { lat: site.location?.lat, lng: site.location?.lng },
        modelScale: site.scale || '1 1 1',
        ...extra
      });
    }
    monumentsReady = true;
    console.log('Monuments seeded');
  } catch (err) {
    console.error('seedMonuments failed:', err.message);
  }
}
seedMonuments();

// A slug is the only thing a QR code carries, so validate its shape before it
// ever reaches a query.
const SLUG_RE = /^[a-z0-9-]{1,64}$/;

// GET /api/heritage/monuments        list for the cards + search
router.get('/monuments', async (req, res) => {
  try {
    const { q } = req.query;
    const filter = { isActive: true };
    if (q) {
      const safe = String(q).slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name:             { $regex: safe, $options: 'i' } },
        { shortDescription: { $regex: safe, $options: 'i' } },
        { period:           { $regex: safe, $options: 'i' } }
      ];
    }
    const list = await Monument.find(filter).sort({ name: 1 });
    res.json(list.map(m => ({
      slug: m.slug, name: m.name, nameKannada: m.nameKannada, type: m.type,
      shortDescription: m.shortDescription || (m.description || '').slice(0, 110),
      period: m.period, location: m.location,
      posterUrl: m.posterUrl,
      hasModel: Boolean(m.modelUrl),
      hasAudio: Boolean(m.audioUrl)
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/heritage/monuments/:slug  full public record
router.get('/monuments/:slug', async (req, res) => {
  try {
    if (!SLUG_RE.test(req.params.slug)) {
      return res.status(400).json({ error: 'Invalid monument identifier' });
    }
    const m = await Monument.findOne({ slug: req.params.slug, isActive: true });
    if (!m) return res.status(404).json({ error: 'Monument not found' });
    res.json(m.toPublic());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/heritage/monuments/:slug/ar   the minimum the AR page needs first
router.get('/monuments/:slug/ar', async (req, res) => {
  try {
    if (!SLUG_RE.test(req.params.slug)) {
      return res.status(400).json({ error: 'Invalid monument identifier' });
    }
    const m = await Monument.findOne({ slug: req.params.slug, isActive: true });
    if (!m) return res.status(404).json({ error: 'Monument not found' });
    if (!m.modelUrl) {
      return res.status(409).json({ error: 'No 3D model available for this monument yet' });
    }
    res.json({
      slug: m.slug, name: m.name, nameKannada: m.nameKannada,
      modelUrl: m.modelUrl, usdzUrl: m.usdzUrl,
      modelScale: m.modelScale, modelCredit: m.modelCredit,
      posterUrl: m.posterUrl, audioUrl: m.audioUrl, narrationText: m.narrationText,
      location: m.location
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/heritage/monuments/:slug/view   anonymous counter
// Records NOTHING about who viewed - just increments a number, so it can feed
// a "most viewed monument" tile without collecting personal data.
router.post('/monuments/:slug/view', async (req, res) => {
  try {
    if (!SLUG_RE.test(req.params.slug)) {
      return res.status(400).json({ error: 'Invalid monument identifier' });
    }
    const field = req.body?.ar ? 'arLaunchCount' : 'viewCount';
    await Monument.updateOne({ slug: req.params.slug }, { $inc: { [field]: 1 } });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── ADMIN ─────────────────────────────────────────────
// Heritage management. Same guard shape as the rest of the admin surface.
router.get('/admin/monuments', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const list = await Monument.find().sort({ name: 1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/monuments', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const m = await Monument.create(req.body);
    res.status(201).json(m);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/admin/monuments/:slug', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    // slug is the public identity and is baked into printed QR codes, so it
    // is not editable through this route.
    const { slug, _id, viewCount, arLaunchCount, ...safe } = req.body;
    const m = await Monument.findOneAndUpdate(
      { slug: req.params.slug }, safe, { new: true, runValidators: true }
    );
    if (!m) return res.status(404).json({ error: 'Monument not found' });
    res.json(m);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/admin/monuments/:slug', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const m = await Monument.findOneAndUpdate(
      { slug: req.params.slug }, { isActive: false }, { new: true }
    );
    if (!m) return res.status(404).json({ error: 'Monument not found' });
    res.json({ success: true });   // soft delete - printed QR codes stay valid
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/admin/analytics', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const list = await Monument.find({}, 'slug name viewCount arLaunchCount')
      .sort({ viewCount: -1 });
    res.json({
      monuments: list,
      totalViews:     list.reduce((s, m) => s + (m.viewCount || 0), 0),
      totalArLaunches:list.reduce((s, m) => s + (m.arLaunchCount || 0), 0),
      mostViewed:     list[0]?.name || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;