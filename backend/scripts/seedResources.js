// Seeds the Resource collection with Ballari City Corporation's real
// door-to-door (D2D) garbage-truck fleet, extracted from the division-wise
// vehicle list PDF. Run once (or with --reset) to populate real data
// instead of demo/placeholder resources.
//
// Usage:
//   node scripts/seedResources.js            # adds/updates, skips existing
//   node scripts/seedResources.js --reset    # wipes garbage-truck resources first

const mongoose  = require('mongoose');
const Resource  = require('../models/Resource');
const WARD_COORDS = require('../config/wardCoords');
const vehicles  = require('../data/d2dVehicles.json');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smart-ballari';

function parseWards(wardStr) {
  if (!wardStr) return [];
  return wardStr
    .split(/[,\s]+/)
    .map(s => s.trim())
    .filter(s => /^\d+$/.test(s))
    .map(Number);
}

function primaryCoords(wards) {
  const primary = wards[0];
  return WARD_COORDS[String(primary)] || { lat: 15.1394, lng: 76.9214 };
}

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log(`Connected to ${MONGO_URI}`);

  if (process.argv.includes('--reset')) {
    const { deletedCount } = await Resource.deleteMany({ type: 'garbage-truck' });
    console.log(`Removed ${deletedCount} existing garbage-truck resources`);
  }

  let created = 0, skipped = 0;

  for (const v of vehicles) {
    const wards = parseWards(v.ward);
    if (!wards.length) {
      console.warn(`Skipping ${v.vehicle_no} (${v.driver}) — no ward number in source data`);
      skipped++;
      continue;
    }

    const coords = primaryCoords(wards);
    const capacity = parseFloat(v.capacity) || 0;

    const existing = await Resource.findOne({ vehicleNo: v.vehicle_no });
    if (existing) {
      skipped++;
      continue;
    }

    await Resource.create({
      name:         `${v.vehicle_type} — ${v.vehicle_no}`,
      type:         'garbage-truck',
      status:       'available',
      location: {
        lat:  coords.lat,
        lng:  coords.lng,
        area: `Ward ${wards[0]}`
      },
      capacity,          // cu.m, as recorded on the vehicle register
      currentLoad:  0,
      driverName:   v.driver,
      driverMobile: v.mobile || undefined,
      vehicleNo:    v.vehicle_no,
      vehicleModel: v.vehicle_type,
      wetDrySegregation: v.wet_dry === 'Yes',
      division:     v.division,
      wardsServed:  wards
    });
    created++;
  }

  console.log(`Seed complete: ${created} created, ${skipped} skipped (of ${vehicles.length} rows)`);
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});