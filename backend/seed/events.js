require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose      = require('mongoose');
const Event         = require('../models/Event');
const CrowdReading  = require('../models/CrowdReading');

function hoursFromNow(h) {
  return new Date(Date.now() + h * 3600 * 1000);
}

function daysFromNow(d, h = 9) {
  const dt = new Date();
  dt.setDate(dt.getDate() + d);
  dt.setHours(h, 0, 0, 0);
  return dt;
}

function daysAgo(d) {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  return dt;
}

const events = [
  // ── ACTIVE NOW ───────────────────────────────────────
  {
    name:          'Gandhi Nagar Weekly Market',
    type:          'market',
    area:          'Gandhi Nagar',
    location:      { lat: 15.1394, lng: 76.9214 },
    expectedCrowd: 3500,
    startTime:     hoursFromNow(-2),
    endTime:       hoursFromNow(4),
    status:        'active'
  },
  {
    name:          'KSRTC Pilgrim Bus Service',
    type:          'religious',
    area:          'KSRTC Stand',
    location:      { lat: 15.1350, lng: 76.9250 },
    expectedCrowd: 2000,
    startTime:     hoursFromNow(-1),
    endTime:       hoursFromNow(6),
    status:        'active'
  },

  // ── UPCOMING ─────────────────────────────────────────
  {
    name:          'Ballari Utsav Cultural Festival',
    type:          'festival',
    area:          'Cantonment Ground',
    location:      { lat: 15.1480, lng: 76.9120 },
    expectedCrowd: 8000,
    startTime:     daysFromNow(1, 17),
    endTime:       daysFromNow(1, 22),
    status:        'upcoming'
  },
  {
    name:          'District Sports Meet',
    type:          'sports',
    area:          'Gandhi Nagar',
    location:      { lat: 15.1400, lng: 76.9200 },
    expectedCrowd: 4000,
    startTime:     daysFromNow(2, 9),
    endTime:       daysFromNow(2, 18),
    status:        'upcoming'
  },
  {
    name:          'Nehru Gunj Vegetable Market',
    type:          'market',
    area:          'Nehru Gunj',
    location:      { lat: 15.1420, lng: 76.9180 },
    expectedCrowd: 1800,
    startTime:     daysFromNow(3, 6),
    endTime:       daysFromNow(3, 13),
    status:        'upcoming'
  },

  // ── PAST ─────────────────────────────────────────────
  {
    name:          'Dasara Procession',
    type:          'festival',
    area:          'Old Town',
    location:      { lat: 15.1450, lng: 76.9150 },
    expectedCrowd: 12000,
    startTime:     daysAgo(5),
    endTime:       new Date(daysAgo(5).getTime() + 6 * 3600000),
    status:        'ended'
  },
  {
    name:          'Political Rally — MG Road',
    type:          'political',
    area:          'Hospet Road',
    location:      { lat: 15.1300, lng: 76.9370 },
    expectedCrowd: 6000,
    startTime:     daysAgo(10),
    endTime:       new Date(daysAgo(10).getTime() + 4 * 3600000),
    status:        'ended'
  }
];

// Simulate 30 days of crowd readings per area
const areas = [
  'Gandhi Nagar', 'KSRTC Stand', 'Nehru Gunj',
  'Cantonment', 'Old Town', 'Hospet Road'
];

const readings = [];
for (let d = 30; d >= 0; d--) {
  for (const area of areas) {
    // Market day spike every Sun + Wed
    const date = new Date();
    date.setDate(date.getDate() - d);
    const dow = date.getDay();
    const isMarket  = (dow === 0 || dow === 3);
    const isFestive = d <= 5 && area === 'Old Town'; // Dasara

    const base  = isMarket ? 2800 : isFestive ? 5000 : 700;
    const count = Math.floor(base + Math.random() * 600 - 300);

    readings.push({
      area,
      count,
      density: densityLevel(count),
      source:  'rule',
      timestamp: new Date(date.setHours(
        [10, 14, 18][Math.floor(Math.random() * 3)], 0, 0, 0
      ))
    });
  }
}

function densityLevel(count) {
  if (count > 5000) return 'critical';
  if (count > 2500) return 'high';
  if (count > 1000) return 'moderate';
  return 'low';
}

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    await Event.deleteMany({});
    await CrowdReading.deleteMany({});
    const savedEvents = await Event.insertMany(events);
    await CrowdReading.insertMany(readings);
    console.log(`✅ Seeded ${savedEvents.length} events`);
    console.log(`✅ Seeded ${readings.length} crowd readings`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });