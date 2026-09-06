// ===================================================================
//  /api/explore — the tourism module
//
//  The itinerary builder's guiding rule: THE MODEL NEVER INVENTS A PLACE.
//  We fetch real candidates from the Place and Monument collections, hand
//  the model that list, and ask it only to SELECT and SEQUENCE them by id.
//  Every id that comes back is checked against the database and silently
//  dropped if it does not resolve. A hallucinated attraction therefore
//  cannot reach the user.
//
//  If OPENAI_API_KEY is absent, or the call fails, or the response is
//  unusable, planning falls back to a deterministic rules planner. The
//  feature keeps working with no key and no credit — which matters for a
//  demo far more than the quality difference does.
// ===================================================================
const express  = require('express');
const router   = express.Router();

const Place    = require('../models/Place');
const Monument = require('../models/Monument');
const Trip     = require('../models/Trip');
const verifyToken = require('../middleware/verifyToken');

const OPENAI_KEY   = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Towns the planner knows about, with rough drive times between them.
// Minutes, one way, by road. Approximate — used to warn about travel load,
// not to give directions.
const TOWNS = {
  Ballari:  { lat: 15.1400, lng: 76.9200 },
  Hospet:   { lat: 15.2690, lng: 76.3870 },
  Hampi:    { lat: 15.3352, lng: 76.4600 },
  Anegundi: { lat: 15.3520, lng: 76.4720 },
  Sandur:   { lat: 15.1000, lng: 76.5500 }
};
const DRIVE = {
  'Ballari-Hospet': 75, 'Ballari-Hampi': 90, 'Ballari-Anegundi': 105,
  'Ballari-Sandur': 60, 'Hospet-Hampi': 25,  'Hospet-Anegundi': 45,
  'Hospet-Sandur': 90,  'Hampi-Anegundi': 30, 'Hampi-Sandur': 110,
  'Anegundi-Sandur': 120
};
const driveMinutes = (a, b) =>
  a === b ? 0 : (DRIVE[`${a}-${b}`] ?? DRIVE[`${b}-${a}`] ?? 90);

const PACE = { relaxed: 3, balanced: 4, packed: 6 };   // stops per day

const INTEREST_CATEGORIES = {
  heritage: ['monument', 'museum'],
  temples:  ['temple', 'monument'],
  nature:   ['nature', 'viewpoint', 'park'],
  views:    ['viewpoint', 'nature'],
  family:   ['family', 'park', 'attraction'],
  photo:    ['viewpoint', 'monument', 'nature']
};

// ── REFERENCE DATA ────────────────────────────────────
router.get('/towns', (req, res) => {
  res.json(Object.keys(TOWNS).map(name => ({ name, ...TOWNS[name] })));
});

// Browse the catalogue. Used by the "Things to do" listing.
router.get('/places', async (req, res) => {
  try {
    const { town, category, q, limit } = req.query;
    const filter = { isActive: true };
    if (town) filter.town = town;
    if (category) filter.category = category;
    if (q) filter.name = new RegExp(String(q).slice(0, 60)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const places = await Place.find(filter)
      .sort({ rank: -1, name: 1 })
      .limit(Math.min(Number(limit) || 60, 200));

    res.json({
      places: places.map(p => p.toPublic()),
      attribution: '© OpenStreetMap contributors (ODbL)'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CANDIDATE GATHERING ───────────────────────────────
/**
 * Everything the planner is allowed to choose from. Monuments come first and
 * carry a rank bonus: they are the curated sights with real history, images
 * and AR, so a trip that misses them is a worse trip.
 */
async function gatherCandidates({ towns, interests, limitPerTown = 18 }) {
  const cats = interests.length
    ? [...new Set(interests.flatMap(i => INTEREST_CATEGORIES[i] || []))]
    : null;

  const monuments = await Monument.find({ isActive: true }).lean();
  const monCands = monuments.map(m => ({
    id: String(m._id),
    kind: 'monument',
    slug: m.slug,
    name: m.name,
    town: nearestTown(m.location?.lat, m.location?.lng),
    category: m.type === 'fort' ? 'monument' : (m.type || 'monument'),
    lat: m.location?.lat,
    lng: m.location?.lng,
    visitMinutes: 75,
    rank: 95,
    why: m.shortDescription || ''
  })).filter(c => towns.includes(c.town));

  const placeFilter = { isActive: true, town: { $in: towns } };
  if (cats) placeFilter.category = { $in: cats };

  const perTown = await Promise.all(towns.map(t =>
    Place.find({ ...placeFilter, town: t })
      .sort({ rank: -1 })
      .limit(limitPerTown)
      .lean()
  ));

  const placeCands = perTown.flat().map(p => ({
    id: String(p._id),
    kind: 'place',
    name: p.name,
    town: p.town,
    category: p.category,
    lat: p.location.lat,
    lng: p.location.lng,
    visitMinutes: p.visitMinutes,
    rank: p.rank,
    why: ''
  }));

  return [...monCands, ...placeCands];
}

function nearestTown(lat, lng) {
  if (lat == null) return 'Ballari';
  let best = 'Ballari', bd = Infinity;
  for (const [n, c] of Object.entries(TOWNS)) {
    const d = Math.hypot(lat - c.lat, lng - c.lng);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

// ── RULES PLANNER (always available) ──────────────────
/**
 * Deterministic fallback. Groups candidates by town, gives each day one base
 * town, and fills it with the highest-ranked stops that fit the pace.
 * Not clever, but it always produces a coherent, real itinerary.
 */
function planByRules(cands, { days, pace, startTown }) {
  const perDay = PACE[pace] || 4;

  // order towns by how much there is to see, keeping the start town first
  const byTown = {};
  for (const c of cands) (byTown[c.town] ||= []).push(c);
  for (const t of Object.keys(byTown)) byTown[t].sort((a, b) => b.rank - a.rank);

  const towns = Object.keys(byTown)
    .sort((a, b) => byTown[b].length - byTown[a].length);
  if (towns.includes(startTown)) {
    towns.splice(towns.indexOf(startTown), 1);
    towns.unshift(startTown);
  }

  const plan = [];
  let prevTown = startTown;
  for (let d = 0; d < days; d++) {
    const town = towns[d % towns.length];
    const pool = byTown[town] || [];
    const picks = pool.splice(0, perDay);
    if (!picks.length) continue;

    let clock = 9 * 60 + (driveMinutes(prevTown, town) > 40 ? 60 : 0);
    const stops = picks.map(c => {
      const startTime = `${String(Math.floor(clock / 60)).padStart(2, '0')}:${String(clock % 60).padStart(2, '0')}`;
      clock += c.visitMinutes + 20;                     // 20 min hop between stops
      return { ...c, startTime };
    });

    const drive = driveMinutes(prevTown, town);
    plan.push({
      day: d + 1,
      title: `${town}`,
      baseTown: town,
      stops,
      travelNote: drive ? `About ${drive} minutes by road from ${prevTown}.` : ''
    });
    prevTown = town;
  }
  return plan;
}

// ── AI PLANNER ────────────────────────────────────────
async function planByAI(cands, opts) {
  if (!OPENAI_KEY) return null;

  // The model sees ONLY these ids. It cannot introduce a place that is not
  // in this list, and anything it does invent is dropped on validation.
  const menu = cands.map(c =>
    `${c.id}|${c.kind}|${c.town}|${c.category}|${c.visitMinutes}min|${c.name}`
  ).join('\n');

  const system =
    'You plan day trips around Ballari and Hampi, Karnataka. ' +
    'You will be given a fixed list of real places, one per line, as ' +
    'id|kind|town|category|duration|name. ' +
    'Choose from that list ONLY. Never invent a place, and never output an id ' +
    'that is not in the list. Group each day around ONE town to limit driving. ' +
    'Open with the strongest sight of the day. Respond with JSON only, no prose, ' +
    'in this exact shape: ' +
    '{"days":[{"day":1,"title":"short title","baseTown":"Town",' +
    '"stops":[{"id":"<id from the list>","startTime":"09:30",' +
    '"note":"one short sentence on why this stop"}],' +
    '"travelNote":"one short line about getting there"}]}';

  const user =
    `Trip length: ${opts.days} day(s)\n` +
    `Starting from: ${opts.startTown}\n` +
    `Travelling as: ${opts.travelWith}\n` +
    `Pace: ${opts.pace} (about ${PACE[opts.pace] || 4} stops per day)\n` +
    `Interests: ${opts.interests.join(', ') || 'general sightseeing'}\n\n` +
    `Available places:\n${menu}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user',   content: user }
        ]
      })
    });
    if (!res.ok) {
      console.error('OpenAI', res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) return null;
    return JSON.parse(text);
  } catch (err) {
    console.error('OpenAI planning failed:', err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Turn the model's answer into a plan of real records.
 * Any id we cannot resolve is discarded, so hallucinations vanish rather
 * than reaching the user. Returns null if too little survives to be useful.
 */
function materialise(aiPlan, cands) {
  const byId = new Map(cands.map(c => [c.id, c]));
  const days = [];
  let kept = 0, dropped = 0;

  for (const d of aiPlan?.days || []) {
    const stops = [];
    for (const s of d.stops || []) {
      const c = byId.get(String(s.id));
      if (!c) { dropped++; continue; }          // invented or malformed id
      stops.push({
        kind: c.kind, refId: c.id, slug: c.slug, name: c.name,
        town: c.town, category: c.category,
        location: { lat: c.lat, lng: c.lng },
        startTime: typeof s.startTime === 'string' ? s.startTime.slice(0, 5) : undefined,
        visitMinutes: c.visitMinutes,
        note: typeof s.note === 'string' ? s.note.slice(0, 200) : ''
      });
      kept++;
    }
    if (stops.length) {
      days.push({
        day: Number(d.day) || days.length + 1,
        title: String(d.title || stops[0].town).slice(0, 80),
        baseTown: String(d.baseTown || stops[0].town).slice(0, 40),
        stops,
        travelNote: String(d.travelNote || '').slice(0, 200)
      });
    }
  }
  if (dropped) console.warn(`planner: dropped ${dropped} unresolvable id(s), kept ${kept}`);
  return days.length ? days : null;
}

// ── PLAN ──────────────────────────────────────────────
router.post('/plan', async (req, res) => {
  try {
    const days       = Math.min(Math.max(Number(req.body.days) || 1, 1), 7);
    const pace       = ['relaxed','balanced','packed'].includes(req.body.pace)
                        ? req.body.pace : 'balanced';
    const startTown  = TOWNS[req.body.startTown] ? req.body.startTown : 'Ballari';
    const travelWith = ['solo','couple','family','friends'].includes(req.body.travelWith)
                        ? req.body.travelWith : 'family';
    const interests  = Array.isArray(req.body.interests)
                        ? req.body.interests.filter(i => INTEREST_CATEGORIES[i]).slice(0, 6)
                        : [];

    // A one-day trip should not send someone across the district and back.
    const reachable = Object.keys(TOWNS).filter(t =>
      driveMinutes(startTown, t) <= (days === 1 ? 95 : 130));
    const towns = reachable.length ? reachable : [startTown];

    const cands = await gatherCandidates({ towns, interests });
    if (!cands.length) {
      return res.status(409).json({
        error: 'No places found for those interests. Try widening them.'
      });
    }

    const opts = { days, pace, startTown, travelWith, interests };
    const ai       = await planByAI(cands, opts);
    const aiPlan   = ai ? materialise(ai, cands) : null;   // validate once
    const plan     = aiPlan || planByRules(cands, opts);
    const generatedBy = aiPlan ? 'ai' : 'rules';

    res.json({
      title: `${days} day${days > 1 ? 's' : ''} around ${startTown}`,
      days, pace, startTown, travelWith, interests,
      plan,
      generatedBy,
      model: generatedBy === 'ai' ? OPENAI_MODEL : null,
      attribution: 'Places © OpenStreetMap contributors (ODbL). Heritage content by Smart Ballari.'
    });
  } catch (err) {
    console.error('plan failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── SAVE / LOAD ───────────────────────────────────────
router.post('/trips', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    if (!Array.isArray(b.plan) || !b.plan.length) {
      return res.status(400).json({ error: 'plan is required' });
    }
    const trip = await Trip.create({
      uid: req.user.uid,
      email: req.user.email,
      title: String(b.title || 'My trip').slice(0, 120),
      days: Math.min(Math.max(Number(b.days) || 1, 1), 7),
      interests: Array.isArray(b.interests) ? b.interests.slice(0, 6) : [],
      pace: b.pace, startTown: b.startTown, travelWith: b.travelWith,
      plan: b.plan,
      generatedBy: b.generatedBy === 'ai' ? 'ai' : 'rules',
      shareId: Math.random().toString(36).slice(2, 10)
    });
    res.status(201).json(trip.toPublic());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/trips/mine', verifyToken, async (req, res) => {
  try {
    const trips = await Trip.find({ uid: req.user.uid }).sort({ createdAt: -1 }).limit(30);
    res.json(trips.map(t => t.toPublic()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public share link. No auth: the whole point is sending it to someone.
router.get('/trips/shared/:shareId', async (req, res) => {
  try {
    const trip = await Trip.findOne({ shareId: String(req.params.shareId).slice(0, 16) });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json(trip.toPublic());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/trips/:id', verifyToken, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Not found' });
    if (trip.uid !== req.user.uid) return res.status(403).json({ error: 'Forbidden' });
    await trip.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;