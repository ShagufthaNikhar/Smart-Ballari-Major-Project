require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose       = require('mongoose');
const HistoricalData = require('../models/HistoricalData');

// Generate past 30 days of data
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function randomBetween(min, max) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

const areas = [
  'Gandhi Nagar', 'Nehru Gunj', 'Cantonment',
  'KSRTC Stand', 'Hospet Road', 'Old Town'
];

const records = [];

// ── WATER PRESSURE (normal: 3–5 bar, low: <2.5) ──────
for (let day = 30; day >= 0; day--) {
  for (const area of areas) {
    // Simulate weekly pattern — lower on weekends
    const isWeekend = new Date(daysAgo(day)).getDay() % 6 === 0;
    const base      = isWeekend ? 2.2 : 3.8;

    records.push({
      type:      'water',
      area,
      value:     randomBetween(base - 0.8, base + 1.2),
      unit:      'bar',
      timestamp: daysAgo(day),
      metadata:  { source: 'sensor-sim' }
    });
  }
}

// ── TRAFFIC DENSITY (vehicles/hr — peak: 7-9am, 5-8pm) ─
for (let day = 30; day >= 0; day--) {
  // Morning peak
  records.push({
    type:      'traffic',
    area:      'Gandhi Nagar',
    value:     randomBetween(800, 1200),
    unit:      'vehicles/hr',
    timestamp: new Date(daysAgo(day).setHours(8, 0, 0)),
    metadata:  { period: 'morning-peak' }
  });

  // Evening peak
  records.push({
    type:      'traffic',
    area:      'KSRTC Stand',
    value:     randomBetween(900, 1400),
    unit:      'vehicles/hr',
    timestamp: new Date(daysAgo(day).setHours(18, 0, 0)),
    metadata:  { period: 'evening-peak' }
  });

  // Off-peak
  records.push({
    type:      'traffic',
    area:      'Nehru Gunj',
    value:     randomBetween(200, 500),
    unit:      'vehicles/hr',
    timestamp: new Date(daysAgo(day).setHours(14, 0, 0)),
    metadata:  { period: 'off-peak' }
  });
}

// ── POWER OUTAGE FREQUENCY ────────────────────────────
for (let day = 30; day >= 0; day--) {
  for (const area of ['Old Town', 'Cantonment']) {
    records.push({
      type:      'power',
      area,
      value:     randomBetween(0, 3),   // outages per day
      unit:      'outages/day',
      timestamp: daysAgo(day),
      metadata:  { source: 'complaints' }
    });
  }
}

// ── CROWD DENSITY (events, markets) ──────────────────
for (let day = 30; day >= 0; day--) {
  const dow = new Date(daysAgo(day)).getDay();
  const isMarketDay = dow === 0 || dow === 3; // Sun + Wed

  records.push({
    type:      'crowd',
    area:      'KSRTC Stand',
    value:     isMarketDay
      ? randomBetween(2000, 4000)
      : randomBetween(500, 1200),
    unit:      'people',
    timestamp: daysAgo(day),
    metadata:  { marketDay: isMarketDay }
  });
}

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    await HistoricalData.deleteMany({});
    await HistoricalData.insertMany(records);
    console.log(`✅ Seeded ${records.length} historical records`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });