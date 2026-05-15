const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');

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
  isActive:    { type: Boolean, default: true }
});

const bookingSchema = new mongoose.Schema({
  hallId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Hall' },
  hallName:     { type: String },
  bookedBy:     { type: String },
  bookedByEmail:{ type: String },
  eventName:    { type: String, required: true },
  eventType:    { type: String },
  date:         { type: Date, required: true },
  startTime:    { type: String },
  endTime:      { type: String },
  attendees:    { type: Number },
  status: {
    type: String,
    enum: ['pending','confirmed','rejected','cancelled'],
    default: 'pending'
  },
  bookingId:    { type: String, unique: true, sparse: true },
  notes:        { type: String },
  createdAt:    { type: Date, default: Date.now }
});

// Auto-generate booking ID
bookingSchema.pre('save', async function (next) {
  if (!this.bookingId) {
    const count = await mongoose.model('Booking').countDocuments();
    this.bookingId = `BK-${new Date().getFullYear()}-${
      String(count + 1).padStart(4, '0')
    }`;
  }
  next();
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
    pricePerDay: 15000,
    contact:     '08392-222100'
  },
  {
    name:        'VIMS Auditorium',
    area:        'VIMS Campus',
    capacity:    800,
    facilities:  ['AC','Stage','Mic','Projector','Parking'],
    pricePerDay: 20000,
    contact:     '08392-235555'
  },
  {
    name:        'District Library Hall',
    area:        'Fort Road',
    capacity:    150,
    facilities:  ['Projector','Seating','Fan'],
    pricePerDay: 5000,
    contact:     '08392-244100'
  },
  {
    name:        'Cantonment Community Hall',
    area:        'Cantonment',
    capacity:    250,
    facilities:  ['AC','Stage','Parking','Kitchen'],
    pricePerDay: 8000,
    contact:     '08392-260222'
  },
  {
    name:        'KSRTC Convention Centre',
    area:        'KSRTC Stand',
    capacity:    300,
    facilities:  ['AC','Stage','Mic','WiFi','Catering'],
    pricePerDay: 12000,
    contact:     '08392-250100'
  }
];

// ── SEED HALLS ON STARTUP ─────────────────────────────
async function seedHalls() {
  const count = await Hall.countDocuments();
  if (count === 0) {
    await Hall.insertMany(HALL_DATA);
    console.log('✅ Halls seeded');
  }
}
seedHalls();

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
router.post('/jobs', async (req, res) => {
  try {
    const job = await Job.create({
      ...req.body,
      postedBy: req.body.postedBy || 'admin'
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

// GET all halls
router.get('/halls', async (req, res) => {
  try {
    const halls = await Hall.find({ isActive: true });
    res.json(halls);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
router.post('/halls/book', async (req, res) => {
  try {
    const {
      hallId, eventName, eventType,
      date, startTime, endTime,
      attendees, notes,
      bookedBy, bookedByEmail
    } = req.body;

    if (!hallId || !eventName || !date) {
      return res.status(400).json({
        error: 'hallId, eventName and date required'
      });
    }

    // Check availability
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
    const booking = new Booking({
      hallId,
      hallName:      hall?.name || 'Hall',
      bookedBy,
      bookedByEmail,
      eventName,
      eventType,
      date:          new Date(date),
      startTime,
      endTime,
      attendees,
      notes
    });

    await booking.save();
    res.status(201).json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET my bookings
router.get('/halls/bookings/mine', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email required' });

    const bookings = await Booking.find({ bookedByEmail: email })
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all bookings — admin
router.get('/halls/bookings/all', async (req, res) => {
  try {
    const bookings = await Booking.find()
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update booking status — admin
router.patch('/halls/bookings/:id/status', async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE cancel booking
router.delete('/halls/bookings/:id', async (req, res) => {
  try {
    await Booking.findByIdAndUpdate(
      req.params.id,
      { status: 'cancelled' }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;