/**
 * Seed the Pharmacy collection.
 *
 *   node scripts/importPharmacies.js            # add / update
 *   node scripts/importPharmacies.js --reset    # wipe first
 *
 * Input: data/pharmacies.json — 10 Ballari medical stores with verified
 * coordinates (7 decimal places, all inside the city, one landing 25 m from
 * where Google places the same branch).
 *
 * Locations only. The source marked phone and address as UNVERIFIED, so
 * neither is imported and the schema has no field for them.
 */
require('dotenv').config();
const fs       = require('fs');
const path     = require('path');
const mongoose = require('mongoose');
const Pharmacy = require('../models/Pharmacy');

const SRC = path.join(__dirname, '..', 'data', 'pharmacies.json');

(async () => {
  if (!fs.existsSync(SRC)) { console.error(`Missing ${SRC}`); process.exit(1); }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  if (process.argv.includes('--reset')) {
    const { deletedCount } = await Pharmacy.deleteMany({});
    console.log(`Reset: removed ${deletedCount} pharmacies`);
  }

  const { pharmacies } = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  let created = 0, updated = 0;

  for (const p of pharmacies) {
    const res = await Pharmacy.updateOne(
      { name: p.name, 'location.lat': p.location.lat, 'location.lng': p.location.lng },
      { $set: { ...p, isActive: true } },
      { upsert: true }
    );
    if (res.upsertedCount) created++; else if (res.modifiedCount) updated++;
  }

  console.log(`\ncreated ${created}, updated ${updated}`);
  console.log(`total in DB: ${await Pharmacy.countDocuments()}`);
  console.log('Locations only — no phone numbers or opening hours are stored.');
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });