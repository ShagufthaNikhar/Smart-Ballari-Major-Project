const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');

const verifyToken = require('../middleware/verifyToken');
const requireRole = require('../middleware/requireRole');
const User        = require('../models/User');
const Counter     = require('../models/Counter');

// ── SCHEMAS ───────────────────────────────────────────
const jobSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  company:     { type: String, required: true },
  type:        {
    type: String,
    enum: ['full-time','part-time','contract','internship','government'],
    default: 'full-time'
  },
  sector:      { type: String },
  location:    { type: String, default: 'Ballari' },
  salary:      { type: String },
  experience:  { type: String },
  description: { type: String },
  skills:      [String],
  applyLink:   { type: String },
  applyEmail:  { type: String },
  postedBy:    { type: String },
  isActive:    { type: Boolean, default: true },
  deadline:    { type: Date },
  createdAt:   { type: Date, default: Date.now }
});

const hallSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  area:        { type: String },
  capacity:    { type: Number },
  facilities:  [String],
  pricePerDay: { type: Number },
  contact:     { type: String },
  isActive:    { type: Boolean, default: true },

  // APPROXIMATE coordinates - replace with surveyed values before the demo,
  // same caveat as the placeholder grievance numbers in config/departments.js.
  // Directory venues have none at all: every feature in the source GeoJSON
  // carries geometry: null, so they are listed by address and phone only.
  location: {
    lat: { type: Number },
    lng: { type: Number }
  },

  // Tiered pricing. `pricePerDay` is kept in sync with pricing.fullDay so
  // anything still reading the old field keeps working.
  pricing: {
    hourly:   { type: Number },   // per hour, minimum 2 hours
    halfDay:  { type: Number },   // up to 6 hours
    fullDay:  { type: Number },   // single calendar day
    multiDay: { type: Number }    // per-day rate once 2+ days are booked
  },

  // unit: 'flat' (once), 'perDay', or 'perGuest'
  addOns: [{
    key:   { type: String },
    label: { type: String },
    price: { type: Number },
    unit:  { type: String, enum: ['flat','perDay','perGuest'], default: 'flat' }
  }],

  // ── Directory fields ────────────────────────────────
  // Populated for venues that come from the city directory rather than from
  // the halls Smart Ballari manages itself.
  category:      { type: String },   // banquet_hall, kalyana_mantapa, ...
  categoryLabel: { type: String },
  icon:          { type: String },
  address:       { type: String },
  rating:        { type: Number },   // Google rating, as sourced
  reviewCount:   { type: Number },
  phoneVerified: { type: Boolean, default: false },

  // The source file flags every capacity as an estimate, so the UI has to
  // say so rather than presenting it as a booking guarantee.
  capacityEstimated: { type: Boolean, default: false },
  capacityNote:      { type: String },

  // Shown instead of a rate card when there is no agreed price. The source
  // file ships all four rental_rates slots as null with an explicit note
  // saying not to display them as confirmed prices, so ratesVerified stays
  // false until a real rate is entered.
  currency:      { type: String, default: 'INR' },
  pricingNote:   { type: String },
  pricingStatus: { type: String },
  ratesVerified: { type: Boolean, default: false },

  // Whether the facilities list was confirmed with the venue. Source data
  // ships the same list for every venue, so this is false for all of them.
  amenitiesVerified: { type: Boolean, default: false },

  // 'instant'  = verified rates, full quote + priced booking.
  // 'enquiry'  = no rates. The request goes to the venue, which confirms
  //              availability and price itself. No total is ever shown.
  bookingMode: { type: String, enum: ['instant', 'enquiry'], default: 'enquiry' },

  coordinatesVerified: { type: Boolean, default: false },
  locationVerified:    { type: Boolean, default: false },

  // A market band so the card is never blank. This is NOT a quote and is
  // never copied into `pricing` - it is shown with its own label and always
  // gives way to a real rate the moment one is entered.
  indicativeRate: {
    fullDayMin:  { type: Number },
    fullDayMax:  { type: Number },
    perPlateMin: { type: Number },
    perPlateMax: { type: Number },
    sourced:     { type: Boolean, default: false },
    basis:       { type: String }
  },

  source:   { type: String, enum: ['demo', 'directory'], default: 'demo' },

  // false = listed for discovery only. The quote and booking routes refuse
  // these: the venue has not agreed to take bookings through this app.
  bookable: { type: Boolean, default: true },

  // The custodian of THIS hall. Scoped ownership, the same way an officer
  // is scoped by `department`: being signed in is not enough, you must
  // manage the specific hall a booking belongs to.
  managerUid:  { type: String, index: true },
  managerName: { type: String }
});

const bookingSchema = new mongoose.Schema({
  hallId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Hall' },
  hallName:     { type: String },
  // Written from the verified Firebase token, never from the request body.
  bookedByUid:  { type: String, index: true },
  bookedBy:     { type: String },
  bookedByEmail:{ type: String },
  eventName:    { type: String, required: true },
  eventType:    { type: String },
  date:         { type: Date, required: true },
  startTime:    { type: String },
  endTime:      { type: String },
  attendees:    { type: Number },

  endDate:      { type: Date },                       // multi-day only
  pricingMode:  { type: String, enum: ['hourly','halfDay','fullDay','multiDay'], default: 'fullDay' },
  selectedAddOns: [{ key: String, label: String, price: Number, unit: String }],
  // Always recomputed on the server. A client-sent total is never trusted.
  costBreakdown: [{ label: String, amount: Number }],
  estimatedCost: { type: Number },

  status: {
    type: String,
    enum: ['pending','confirmed','rejected','cancelled'],
    default: 'pending'
  },
  bookingId:    { type: String, unique: true, sparse: true },

  // 'enquiry' = no price was quoted; the venue confirms availability and
  // cost itself. estimatedCost stays null for these, never zero.
  bookingType:  { type: String, enum: ['enquiry', 'confirmed_pricing'], default: 'enquiry' },
  venueContact: { type: String },

  notes:        { type: String },
  createdAt:    { type: Date, default: Date.now }
});

// Auto-generate booking ID.
// Was countDocuments(), which is racy and - more importantly - reuses an ID
// after any booking is deleted, so the next save hits the unique index on
// bookingId and fails with E11000. Same bug models/Issue.js already fixed for
// grievanceId, so use the same atomic per-year Counter.
// NOTE: no `next` parameter. Mongoose 9 does not pass a callback to ASYNC
// middleware - it awaits the returned promise instead. Declaring (next) here
// gives you undefined, and calling it throws "next is not a function", which
// fails every save. models/Issue.js is the reference for the correct shape.
bookingSchema.pre('save', async function () {
  if (this.bookingId) return;
  const year = new Date().getFullYear();
  const seq  = await Counter.next(`booking-${year}`);
  this.bookingId = `BK-${year}-${String(seq).padStart(4, '0')}`;
});

const Job     = mongoose.models.Job     || mongoose.model('Job', jobSchema);
const Hall    = mongoose.models.Hall    || mongoose.model('Hall', hallSchema);
const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

// ── HALLS: seed data + startup backfill ───────────────
// The five civic halls (bookable) and the 20 directory venues from
// ballari_banquet_function_halls.geojson (listed, not bookable) both live in
// config/hallData.js. seedHalls matches on name, so it is safe to re-run.
const { HALL_CATEGORIES, seedHalls } = require('../config/Halldata');
seedHalls(Hall);

// ── PRICING ───────────────────────────────────────────
// Quoted on the server for both the live estimate and the saved booking, so
// the two can never disagree and a client cannot post its own total.
function hoursBetween(startTime, endTime) {
  const [sh, sm] = String(startTime || '09:00').split(':').map(Number);
  const [eh, em] = String(endTime   || '18:00').split(':').map(Number);
  return Math.max(0, ((eh * 60 + em) - (sh * 60 + sm)) / 60);
}

function daysBetween(date, endDate) {
  if (!endDate) return 1;
  const ms = new Date(endDate).setHours(0,0,0,0) - new Date(date).setHours(0,0,0,0);
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

function quote(hall, opts) {
  const { pricingMode = 'fullDay', startTime, endTime, date, endDate,
          attendees = 0, addOnKeys = [] } = opts;

  const p = hall.pricing || {};
  const days  = daysBetween(date, endDate);
  const hours = hoursBetween(startTime, endTime);
  const lines = [];

  if (pricingMode === 'hourly') {
    const billable = Math.max(2, Math.ceil(hours));   // 2 hour minimum
    lines.push({ label: `${billable} hours @ Rs ${p.hourly}/hr`, amount: billable * (p.hourly || 0) });
  } else if (pricingMode === 'halfDay') {
    lines.push({ label: 'Half day (up to 6 hours)', amount: p.halfDay || 0 });
  } else if (pricingMode === 'multiDay') {
    lines.push({ label: `${days} days @ Rs ${p.multiDay}/day`, amount: days * (p.multiDay || 0) });
  } else {
    lines.push({ label: 'Full day', amount: p.fullDay || 0 });
  }

  for (const key of addOnKeys) {
    const a = (hall.addOns || []).find(x => x.key === key);
    if (!a) continue;
    if (a.unit === 'perDay') {
      lines.push({ label: `${a.label} (${days}d)`, amount: a.price * days });
    } else if (a.unit === 'perGuest') {
      const g = Math.max(0, Number(attendees) || 0);
      lines.push({ label: `${a.label} x ${g}`, amount: a.price * g });
    } else {
      lines.push({ label: a.label, amount: a.price });
    }
  }

  return {
    days, hours,
    breakdown: lines,
    total: lines.reduce((sum, l) => sum + l.amount, 0)
  };
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── SEED JOBS ─────────────────────────────────────────
const SAMPLE_JOBS = [
  {
    title:       'Civil Engineer',
    company:     'KPWD Ballari Division',
    type:        'government',
    sector:      'Infrastructure',
    location:    'Ballari',
    salary:      '₹40,000–₹65,000/month',
    experience:  '2–5 years',
    description: 'Site supervision, road and bridge construction management.',
    skills:      ['AutoCAD','Estimation','Project Management'],
    applyEmail:  'kpwd.ballari@karnataka.gov.in',
    deadline:    new Date(Date.now() + 30 * 86400000)
  },
  {
    title:       'Software Developer',
    company:     'JSW Steel IT Division',
    type:        'full-time',
    sector:      'Technology',
    location:    'Tornagallu, Ballari',
    salary:      '₹6–12 LPA',
    experience:  '1–3 years',
    description: 'Full stack development for internal ERP systems.',
    skills:      ['React','Node.js','MongoDB','REST APIs'],
    applyEmail:  'careers@jsw.in',
    deadline:    new Date(Date.now() + 20 * 86400000)
  },
  {
    title:       'Staff Nurse',
    company:     'VIMS Government Hospital',
    type:        'government',
    sector:      'Healthcare',
    location:    'Ballari',
    salary:      '₹25,000–₹40,000/month',
    experience:  '0–2 years',
    description: 'Patient care in general and ICU wards.',
    skills:      ['GNM/B.Sc Nursing','Patient Care','Emergency'],
    applyEmail:  'vims.nursing@karnataka.gov.in',
    deadline:    new Date(Date.now() + 15 * 86400000)
  },
  {
    title:       'Data Analyst Intern',
    company:     'Smart Ballari Tech Hub',
    type:        'internship',
    sector:      'Technology',
    location:    'Ballari (Remote/Hybrid)',
    salary:      '₹8,000–₹12,000 stipend',
    experience:  '0 years (Fresher)',
    description: 'Analyze civic data, build dashboards, support AI models.',
    skills:      ['Python','Excel','SQL','Data Visualization'],
    applyEmail:  'intern@smartballari.in',
    deadline:    new Date(Date.now() + 10 * 86400000)
  },
  {
    title:       'Primary School Teacher',
    company:     'Zilla Panchayat Ballari',
    type:        'government',
    sector:      'Education',
    location:    'Ballari District',
    salary:      '₹28,000–₹44,000/month',
    experience:  '0–1 year',
    description: 'Teaching grades 1–5 in government primary schools.',
    skills:      ['D.Ed/B.Ed','Kannada','Child Psychology'],
    applyEmail:  'zp.ballari@karnataka.gov.in',
    deadline:    new Date(Date.now() + 25 * 86400000)
  },
  {
    title:       'Electrician (ITI)',
    company:     'BESCOM Ballari',
    type:        'full-time',
    sector:      'Utilities',
    location:    'Ballari',
    salary:      '₹18,000–₹28,000/month',
    experience:  '1–3 years',
    description: 'Maintenance of power distribution lines and transformers.',
    skills:      ['ITI Electrician','Transformer Maintenance','Safety'],
    applyEmail:  'bescom.ballari@karnataka.gov.in',
    deadline:    new Date(Date.now() + 18 * 86400000)
  }
];

async function seedJobs() {
  const count = await Job.countDocuments();
  if (count === 0) {
    await Job.insertMany(SAMPLE_JOBS);
    console.log('✅ Jobs seeded');
  }
}
seedJobs();

// ════════════════════════════════════════════════════
// ── ROUTES ───────────────────────────────────────────
// ════════════════════════════════════════════════════

// ── JOBS ──────────────────────────────────────────────

// GET jobs
router.get('/jobs', async (req, res) => {
  try {
    const { type, sector, search } = req.query;
    const filter = { isActive: true };
    if (type)   filter.type   = type;
    if (sector) filter.sector = sector;
    if (search) {
      filter.$or = [
        { title:       { $regex: search, $options: 'i' } },
        { company:     { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { skills:      { $in: [new RegExp(search, 'i')] } }
      ];
    }
    const jobs = await Job.find(filter).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new job — admin + municipality
router.post('/jobs', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    // postedBy comes from the authenticated admin, not the body.
    const { postedBy, ...safe } = req.body;
    const job = await Job.create({
      ...safe,
      postedBy: req.user.email
    });
    res.status(201).json(job);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── HALLS ─────────────────────────────────────────────

// GET halls. Pass ?lat=&lng= to get a `distanceKm` on each hall, sorted
// nearest first - used by the map and the "Near me" button.
// ?search= ?category= ?bookable=true narrow the list.
router.get('/halls', async (req, res) => {
  try {
    const { lat, lng, search, category, bookable } = req.query;

    const query = { isActive: true };
    if (category) query.category = category;
    if (bookable === 'true')  query.bookable = { $ne: false };
    if (bookable === 'false') query.bookable = false;
    if (search) {
      const rx = new RegExp(search, 'i');
      query.$or = [
        { name: rx },
        { area: rx },
        { address: rx },
        { categoryLabel: rx },
        { facilities: { $in: [rx] } }
      ];
    }

    const halls = await Hall.find(query).lean();

    if (lat && lng) {
      const withDist = halls.map(h => ({
        ...h,
        distanceKm: h.location?.lat
          ? +haversineKm(parseFloat(lat), parseFloat(lng), h.location.lat, h.location.lng).toFixed(2)
          : null
      }));
      // Venues with no surveyed coordinates cannot be ranked by distance, so
      // they sort last rather than pretending to be nearby.
      withDist.sort((a, b) =>
        (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
      return res.json(withDist);
    }

    // Bookable halls first, then best-rated venues.
    halls.sort((a, b) =>
      (b.bookable === false ? 0 : 1) - (a.bookable === false ? 0 : 1) ||
      (b.rating ?? 0) - (a.rating ?? 0));

    res.json(halls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Venue types + counts, for the filter dropdown.
// Must stay above any /halls/:id route or Express reads "categories" as an id.
router.get('/halls/categories', async (req, res) => {
  try {
    const rows = await Hall.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    const counts = Object.fromEntries(rows.map(r => [r._id, r.count]));
    const total  = await Hall.countDocuments({ isActive: true });

    res.json({
      total,
      categories: HALL_CATEGORIES.map(c => ({ ...c, count: counts[c.key] || 0 }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH real rates onto a hall. This is how an enquiry venue becomes a
// bookable one: a hall manager phones the venue, enters the four rates, and
// the hall flips to 'instant' with a live quote. Scoped like every other
// hall action - the admin, or the manager of THIS hall.
router.patch('/halls/:id/rates', verifyToken, async (req, res) => {
  try {
    const hall = await Hall.findById(req.params.id);
    if (!hall) return res.status(404).json({ error: 'Hall not found' });

    const dbUser  = await User.findOne({ firebaseUid: req.user.uid });
    const isAdmin = ['admin', 'hall-manager'].includes(dbUser?.role);
    const isOwner = hall.managerUid === req.user.uid;
    if (!isAdmin && !isOwner) return res.status(403).json({ error: 'Forbidden' });

    const { hourly, halfDay, fullDay, multiDay } = req.body || {};
    const rates = { hourly, halfDay, fullDay, multiDay };

    // All four or none. A half-filled rate card produces a quote with silent
    // zeros in it, which is worse than having no rates at all.
    const given = Object.values(rates).filter(v => v !== undefined && v !== null && v !== '');
    if (given.length !== 4) {
      return res.status(400).json({
        error: 'All four rates are required: hourly, halfDay, fullDay, multiDay.'
      });
    }
    if (given.some(v => !(Number(v) > 0))) {
      return res.status(400).json({ error: 'Rates must be positive numbers.' });
    }

    hall.pricing       = {
      hourly:   Number(hourly),
      halfDay:  Number(halfDay),
      fullDay:  Number(fullDay),
      multiDay: Number(multiDay)
    };
    hall.pricePerDay   = hall.pricing.fullDay;
    hall.ratesVerified = true;
    hall.bookingMode   = 'instant';
    hall.pricingNote   = `Rates confirmed with the venue`;
    hall.pricingStatus = `Confirmed by ${dbUser?.email || req.user.email}`;

    await hall.save();
    res.json(hall);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST a price quote. Same function the booking route uses, so the estimate
// the citizen sees and the amount saved on the booking cannot drift apart.
router.post('/halls/:id/quote', async (req, res) => {
  try {
    const hall = await Hall.findById(req.params.id);
    if (!hall) return res.status(404).json({ error: 'Hall not found' });

    // An enquiry venue has no agreed rate card - its source record says
    // "Contact venue". Quoting it would mean inventing a number the venue has
    // never seen and would have to honour. Return the enquiry shape instead
    // of an error: the booking path is still open, just unpriced.
    if (hall.bookingMode === 'enquiry' || !hall.ratesVerified) {
      const band  = hall.indicativeRate || {};
      const heads = Math.max(0, Number(req.body?.attendees) || 0);

      // A range, never a single figure: a single number reads as a quote.
      const guide = [];
      if (band.fullDayMin) {
        guide.push({
          label: 'Hall rental, full day',
          range: [band.fullDayMin, band.fullDayMax]
        });
      }
      if (band.perPlateMin && heads) {
        guide.push({
          label: `Catering, ${heads} guests @ Rs ${band.perPlateMin}-${band.perPlateMax}/plate`,
          range: [band.perPlateMin * heads, band.perPlateMax * heads]
        });
      }

      const total = guide.length
        ? [guide.reduce((a, g) => a + g.range[0], 0),
           guide.reduce((a, g) => a + g.range[1], 0)]
        : null;

      return res.json({
        mode:        'enquiry',
        breakdown:   [],
        total:       null,           // no quoted total exists
        guide,                       // indicative ranges only
        guideTotal:  total,
        guideBasis:  band.basis || '',
        guideSourced: !!band.sourced,
        currency:    hall.currency || 'INR',
        message:     hall.pricingStatus ||
                     'The venue quotes its own rates. Send an enquiry and they will confirm.',
        contact:     hall.contact || null
      });
    }

    res.json({ mode: 'instant', currency: hall.currency || 'INR', ...quote(hall, req.body || {}) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET hall availability for a date
router.get('/halls/:id/availability', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date required' });

    const dayStart = new Date(date);
    const dayEnd   = new Date(date);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const bookings = await Booking.find({
      hallId: req.params.id,
      date:   { $gte: dayStart, $lt: dayEnd },
      status: { $in: ['pending','confirmed'] }
    });

    res.json({
      available: bookings.length === 0,
      bookings:  bookings.length,
      slots:     bookings
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST book a hall
router.post('/halls/book', verifyToken, async (req, res) => {
  try {
    const {
      hallId, eventName, eventType,
      date, startTime, endTime,
      attendees, notes,
      endDate, pricingMode, addOnKeys
    } = req.body;
    // bookedBy / bookedByEmail are deliberately NOT read from the body -
    // they came from the client before, so anyone could book in another
    // person's name. They now come from the verified token.

    if (!hallId || !eventName || !date) {
      return res.status(400).json({
        error: 'hallId, eventName and date required'
      });
    }

    // Fetch and vet the hall BEFORE the double-booking lookup, so a directory
    // venue never leaves a phantom "already booked" trace on a date it knows
    // nothing about.
    const hall = await Hall.findById(hallId);
    if (!hall) return res.status(404).json({ error: 'Hall not found' });

    if (hall.bookable === false) {
      return res.status(400).json({
        error: `${hall.name} is not accepting requests through Smart Ballari.` +
               `${hall.contact ? ` Please call them on ${hall.contact}.` : ''}`,
        contact: hall.contact || null
      });
    }

    const dayStart = new Date(date);
    const dayEnd   = new Date(date);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const existing = await Booking.findOne({
      hallId,
      date:   { $gte: dayStart, $lt: dayEnd },
      status: { $in: ['pending','confirmed'] }
    });

    if (existing) {
      return res.status(409).json({
        error: 'Hall already booked for this date'
      });
    }

    // Priced here, not by the client. The same quote() the estimate uses.
    // An enquiry venue is stored with NO cost at all rather than a zero: a
    // zero reads as free, and the venue has not quoted anything yet.
    const isEnquiry = hall.bookingMode === 'enquiry' || !hall.ratesVerified;

    const q = isEnquiry
      ? { breakdown: [], total: null }
      : quote(hall, {
          pricingMode, startTime, endTime, date, endDate,
          attendees, addOnKeys: Array.isArray(addOnKeys) ? addOnKeys : []
        });

    const chosenAddOns = isEnquiry ? [] : (Array.isArray(addOnKeys) ? addOnKeys : [])
      .map(k => (hall.addOns || []).find(a => a.key === k))
      .filter(Boolean);

    const booking = new Booking({
      hallId,
      hallName:      hall.name,
      bookedByUid:   req.user.uid,
      bookedBy:      req.user.name || req.user.email,
      bookedByEmail: req.user.email,
      eventName,
      eventType,
      date:          new Date(date),
      startTime,
      endTime,
      attendees,
      notes,
      endDate:        endDate ? new Date(endDate) : undefined,
      pricingMode:    ['hourly','halfDay','fullDay','multiDay'].includes(pricingMode)
                        ? pricingMode : 'fullDay',
      selectedAddOns: chosenAddOns,
      costBreakdown:  q.breakdown,
      estimatedCost:  q.total,
      bookingType:    isEnquiry ? 'enquiry' : 'confirmed_pricing',
      venueContact:   hall.contact || null
    });

    await booking.save();
    res.status(201).json(booking);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        error: 'Booking reference collided, please submit again.'
      });
    }
    console.error('halls/book failed:', err);
    res.status(400).json({ error: err.message });
  }
});

// GET my bookings - scoped to the caller's own token.
// Was `?email=` with no auth, so anyone could read anyone's bookings by
// guessing an email address.
router.get('/halls/bookings/mine', verifyToken, async (req, res) => {
  try {
    const bookings = await Booking.find({
      $or: [
        { bookedByUid:   req.user.uid },
        { bookedByEmail: req.user.email }   // rows created before bookedByUid existed
      ]
    }).sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET the halls I manage, plus their bookings. This is the hall owner's
// queue. No new role is needed: you are a hall owner precisely when some
// hall carries your uid in managerUid.
router.get('/halls/mine', verifyToken, async (req, res) => {
  try {
    const halls = await Hall.find({ managerUid: req.user.uid });
    if (!halls.length) return res.json({ halls: [], bookings: [] });

    const bookings = await Booking.find({
      hallId: { $in: halls.map(h => h._id) }
    }).sort({ createdAt: -1 }).limit(100);

    res.json({ halls, bookings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all bookings - admin only. This returns names and email addresses,
// so it was a straight PII dump while it sat unauthenticated.
router.get(
  '/halls/bookings/all',
  verifyToken,
  requireRole('admin'),
  async (req, res) => {
    try {
      const bookings = await Booking.find()
        .sort({ createdAt: -1 })
        .limit(50);
      res.json(bookings);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// PATCH booking status - the manager of that specific hall, or an admin.
router.patch('/halls/bookings/:id/status', verifyToken, async (req, res) => {
  try {
    const { status } = req.body;

    // findByIdAndUpdate does not run enum validators, so any arbitrary
    // string used to be writable straight into `status`.
    if (!['confirmed', 'rejected'].includes(status)) {
      return res.status(400).json({
        error: 'status must be confirmed or rejected'
      });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const hall    = await Hall.findById(booking.hallId);
    const dbUser  = await User.findOne({ firebaseUid: req.user.uid });
    const isAdmin = dbUser?.role === 'admin';
    const isOwner = hall && hall.managerUid === req.user.uid;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    booking.status = status;
    await booking.save();
    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE = cancel. The citizen who booked it, that hall's manager, or an admin.
router.delete('/halls/bookings/:id', verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const hall     = await Hall.findById(booking.hallId);
    const dbUser   = await User.findOne({ firebaseUid: req.user.uid });
    const isAdmin  = dbUser?.role === 'admin';
    const isOwner  = hall && hall.managerUid === req.user.uid;
    const isBooker = booking.bookedByUid   === req.user.uid ||
                     booking.bookedByEmail === req.user.email;

    if (!isAdmin && !isOwner && !isBooker) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    booking.status = 'cancelled';
    await booking.save();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;