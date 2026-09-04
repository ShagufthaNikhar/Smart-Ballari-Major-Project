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
  notes:        { type: String },
  createdAt:    { type: Date, default: Date.now }
});

// Auto-generate booking ID.
// Was countDocuments(), which is racy and - more importantly - reuses an ID
// after any booking is deleted, so the next save hits the unique index on
// bookingId and fails with E11000. Same bug models/Issue.js already fixed for
// grievanceId, so use the same atomic per-year Counter.
bookingSchema.pre('save', async function (next) {
  if (this.bookingId) return next();
  try {
    const year = new Date().getFullYear();
    const seq  = await Counter.next(`booking-${year}`);
    this.bookingId = `BK-${year}-${String(seq).padStart(4, '0')}`;
    next();
  } catch (err) {
    next(err);
  }
});

const Job     = mongoose.models.Job     || mongoose.model('Job', jobSchema);
const Hall    = mongoose.models.Hall    || mongoose.model('Hall', hallSchema);
const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

// ── COLLEGES DATA (static) ────────────────────────────
const COLLEGES = [
  {
    id:       'c1',
    name:     'Vijayanagara Institute of Medical Sciences (VIMS)',
    type:     'Medical',
    affiliation:'Rajiv Gandhi University of Health Sciences',
    established: 1963,
    address:  'VIMS Campus, Ballari – 583104',
    phone:    '08392-235555',
    website:  'www.vims.ac.in',
    courses:  ['MBBS','MD','MS','BDS','MDS','B.Sc Nursing'],
    seats:    { MBBS: 150, BDS: 60 },
    facilities:['Hospital','Library','Hostel','Sports'],
    ranking:  'NIRF Top 50 Medical Colleges',
    location: { lat: 15.1550, lng: 76.9300 },
    image:    '🏥',
    govt:     true
  },
  {
    id:       'c2',
    name:     'Bapuji Institute of Engineering & Technology (BIET)',
    type:     'Engineering',
    affiliation:'VTU Belagavi',
    established: 1979,
    address:  'Davangere Road, Ballari – 583101',
    phone:    '08392-274000',
    website:  'www.biet.ac.in',
    courses:  ['B.E (CSE, ECE, ME, Civil, EEE)','M.Tech','MBA','MCA'],
    seats:    { 'B.E': 480, 'M.Tech': 60 },
    facilities:['Library','Hostel','Labs','Sports','Canteen'],
    ranking:  'NAAC A+ Accredited',
    location: { lat: 15.1350, lng: 76.9200 },
    image:    '🎓',
    govt:     false
  },
  {
    id:       'c3',
    name:     'Government First Grade College Ballari',
    type:     'Arts & Science',
    affiliation:'Vijayanagara Sri Krishnadevaraya University',
    established: 1955,
    address:  'Fort Road, Ballari – 583101',
    phone:    '08392-222456',
    website:  '',
    courses:  ['B.A','B.Sc','B.Com','BCA','BBA'],
    seats:    { 'B.A': 200, 'B.Sc': 180, 'B.Com': 120 },
    facilities:['Library','NCC','NSS','Sports'],
    ranking:  'NAAC B+ Accredited',
    location: { lat: 15.1410, lng: 76.9195 },
    image:    '🏫',
    govt:     true
  },
  {
    id:       'c4',
    name:     'Sandur Polytechnic College',
    type:     'Polytechnic',
    affiliation:'DTE Karnataka',
    established: 1966,
    address:  'Sandur, Ballari District – 583119',
    phone:    '08395-260333',
    website:  '',
    courses:  ['Diploma in ME','EEE','Civil','CS','EC'],
    seats:    { Diploma: 240 },
    facilities:['Workshop','Library','Hostel'],
    ranking:  'Government Polytechnic',
    location: { lat: 15.0800, lng: 76.5500 },
    image:    '⚙️',
    govt:     true
  },
  {
    id:       'c5',
    name:     'Ballari Law College',
    type:     'Law',
    affiliation:'Karnataka State Law University',
    established: 1985,
    address:  'Gandhi Nagar, Ballari – 583101',
    phone:    '08392-241789',
    website:  '',
    courses:  ['LLB (3yr)','BA LLB (5yr)','LLM'],
    seats:    { LLB: 60, 'BA LLB': 60 },
    facilities:['Moot Court','Library','Legal Aid Cell'],
    ranking:  'Bar Council Approved',
    location: { lat: 15.1395, lng: 76.9215 },
    image:    '⚖️',
    govt:     false
  }
];

// ── HALLS DATA (static seed) ──────────────────────────
const HALL_DATA = [
  {
    name:        'Town Hall Ballari',
    area:        'Gandhi Nagar',
    capacity:    500,
    facilities:  ['AC','Stage','Projector','Parking','Catering'],
    location:    { lat: 15.1501, lng: 76.9248 },
    pricing:     { hourly: 1200, halfDay: 6500, fullDay: 15000, multiDay: 13000 },
    addOns: [
      { key: 'decor_basic',   label: 'Basic floral decor',        price: 8000,  unit: 'flat' },
      { key: 'decor_premium', label: 'Premium stage + backdrop',  price: 22000, unit: 'flat' },
      { key: 'sound',         label: 'Sound system + operator',   price: 5000,  unit: 'perDay' },
      { key: 'catering',      label: 'Catering (veg, per plate)', price: 260,   unit: 'perGuest' },
      { key: 'generator',     label: 'Backup generator',          price: 3500,  unit: 'perDay' }
    ],
    pricePerDay: 15000,
    contact:     '08392-222100'
  },
  {
    name:        'VIMS Auditorium',
    area:        'VIMS Campus',
    capacity:    800,
    facilities:  ['AC','Stage','Mic','Projector','Parking'],
    location:    { lat: 15.1647, lng: 76.9163 },
    pricing:     { hourly: 1800, halfDay: 9000, fullDay: 20000, multiDay: 17500 },
    addOns: [
      { key: 'decor_basic',   label: 'Basic floral decor',       price: 9000,  unit: 'flat' },
      { key: 'decor_premium', label: 'Premium stage + backdrop', price: 26000, unit: 'flat' },
      { key: 'sound',         label: 'Sound system + operator',  price: 6500,  unit: 'perDay' },
      { key: 'projector',     label: 'Extra LED wall',           price: 12000, unit: 'perDay' }
    ],
    pricePerDay: 20000,
    contact:     '08392-235555'
  },
  {
    name:        'District Library Hall',
    area:        'Fort Road',
    capacity:    150,
    facilities:  ['Projector','Seating','Fan'],
    location:    { lat: 15.1424, lng: 76.9186 },
    pricing:     { hourly: 500, halfDay: 2400, fullDay: 5000, multiDay: 4200 },
    addOns: [
      { key: 'decor_basic', label: 'Basic floral decor',      price: 3000, unit: 'flat' },
      { key: 'sound',       label: 'Sound system + operator', price: 2000, unit: 'perDay' }
    ],
    pricePerDay: 5000,
    contact:     '08392-244100'
  },
  {
    name:        'Cantonment Community Hall',
    area:        'Cantonment',
    capacity:    250,
    facilities:  ['AC','Stage','Parking','Kitchen'],
    location:    { lat: 15.1558, lng: 76.9302 },
    pricing:     { hourly: 750, halfDay: 3800, fullDay: 8000, multiDay: 6800 },
    addOns: [
      { key: 'decor_basic',   label: 'Basic floral decor',        price: 5000,  unit: 'flat' },
      { key: 'decor_premium', label: 'Premium stage + backdrop',  price: 14000, unit: 'flat' },
      { key: 'sound',         label: 'Sound system + operator',   price: 3500,  unit: 'perDay' },
      { key: 'catering',      label: 'Catering (veg, per plate)', price: 210,   unit: 'perGuest' }
    ],
    pricePerDay: 8000,
    contact:     '08392-260222'
  },
  {
    name:        'KSRTC Convention Centre',
    area:        'KSRTC Stand',
    capacity:    300,
    facilities:  ['AC','Stage','Mic','WiFi','Catering'],
    location:    { lat: 15.1479, lng: 76.9271 },
    pricing:     { hourly: 1000, halfDay: 5200, fullDay: 12000, multiDay: 10200 },
    addOns: [
      { key: 'decor_basic',   label: 'Basic floral decor',        price: 6000,  unit: 'flat' },
      { key: 'decor_premium', label: 'Premium stage + backdrop',  price: 18000, unit: 'flat' },
      { key: 'sound',         label: 'Sound system + operator',   price: 4000,  unit: 'perDay' },
      { key: 'catering',      label: 'Catering (veg, per plate)', price: 240,   unit: 'perGuest' }
    ],
    pricePerDay: 12000,
    contact:     '08392-250100'
  }
];

// ── SEED / BACKFILL HALLS ON STARTUP ──────────────────
// The original seed only ran on an empty collection, so an existing database
// would never gain the new location / pricing / addOns fields. This also
// backfills halls that are already there.
async function seedHalls() {
  try {
    const count = await Hall.countDocuments();
    if (count === 0) {
      await Hall.insertMany(HALL_DATA);
      console.log('Halls seeded');
      return;
    }
    let patched = 0;
    for (const h of HALL_DATA) {
      const existing = await Hall.findOne({ name: h.name });
      if (!existing) { await Hall.create(h); patched++; continue; }
      if (!existing.location?.lat || !existing.pricing?.fullDay) {
        existing.location = h.location;
        existing.pricing  = h.pricing;
        existing.addOns   = h.addOns;
        existing.pricePerDay = h.pricing.fullDay;
        await existing.save();
        patched++;
      }
    }
    if (patched) console.log(`Halls backfilled with location/pricing: ${patched}`);
  } catch (err) {
    console.error('seedHalls failed:', err.message);
  }
}
seedHalls();

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

// ── COLLEGES ──────────────────────────────────────────

// GET colleges
router.get('/colleges', (req, res) => {
  const { type, search } = req.query;
  let results = [...COLLEGES];

  if (type)   results = results.filter(c => c.type === type);
  if (search) {
    const q = search.toLowerCase();
    results = results.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.courses.some(cr => cr.toLowerCase().includes(q))
    );
  }

  res.json(results);
});

// GET single college
router.get('/colleges/:id', (req, res) => {
  const college = COLLEGES.find(c => c.id === req.params.id);
  if (!college) return res.status(404).json({ error: 'Not found' });
  res.json(college);
});

// ── HALLS ─────────────────────────────────────────────

// GET halls. Pass ?lat=&lng= to get a `distanceKm` on each hall, sorted
// nearest first - used by the map and the "Near me" button.
router.get('/halls', async (req, res) => {
  try {
    const halls = await Hall.find({ isActive: true }).lean();
    const { lat, lng } = req.query;

    if (lat && lng) {
      const withDist = halls.map(h => ({
        ...h,
        distanceKm: h.location?.lat
          ? +haversineKm(parseFloat(lat), parseFloat(lng), h.location.lat, h.location.lng).toFixed(2)
          : null
      }));
      withDist.sort((a, b) =>
        (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
      return res.json(withDist);
    }

    res.json(halls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST a price quote. Same function the booking route uses, so the estimate
// the citizen sees and the amount saved on the booking cannot drift apart.
router.post('/halls/:id/quote', async (req, res) => {
  try {
    const hall = await Hall.findById(req.params.id);
    if (!hall) return res.status(404).json({ error: 'Hall not found' });
    res.json(quote(hall, req.body || {}));
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

    const hall = await Hall.findById(hallId);
    if (!hall) return res.status(404).json({ error: 'Hall not found' });

    // Priced here, not by the client. The same quote() the estimate uses.
    const q = quote(hall, {
      pricingMode, startTime, endTime, date, endDate,
      attendees, addOnKeys: Array.isArray(addOnKeys) ? addOnKeys : []
    });

    const chosenAddOns = (Array.isArray(addOnKeys) ? addOnKeys : [])
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
      estimatedCost:  q.total
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