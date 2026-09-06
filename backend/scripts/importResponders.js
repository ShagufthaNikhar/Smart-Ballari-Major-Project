/**
 * Seed the Responder collection.
 *
 *   node scripts/importResponders.js            # add / update
 *   node scripts/importResponders.js --reset    # wipe first
 *
 * Input: data/responders.json — 56 facilities extracted from the Ballari
 * OpenStreetMap export (49 hospitals, 6 police stations, 1 fire station).
 * Clinics, pharmacies, labs and nursing homes were filtered out: they are not
 * emergency responders and would bury the hospitals that are.
 *
 * ── ON PHONE NUMBERS ──────────────────────────────────────────────
 * Exactly ONE facility in the OSM data carries a phone number. For every
 * other record `phone` is the correct NATIONAL emergency number, never an
 * invented per-facility landline:
 *
 *     112  unified emergency number (police, fire, ambulance). Karnataka
 *          launched ERSS-112 in 2019; it works without a SIM or network.
 *     108  ambulance / medical
 *     101  fire and rescue
 *
 * Fabricating those numbers would be worse than leaving them blank — someone
 * in an emergency would dial one and reach nothing.
 *
 * LICENCE: names, addresses and coordinates are OpenStreetMap data (ODbL).
 * "© OpenStreetMap contributors" must be shown wherever they appear.
 */
require('dotenv').config();
const fs        = require('fs');
const path      = require('path');
const mongoose  = require('mongoose');
const Responder = require('../models/Responder');

const SRC = path.join(__dirname, '..', 'data', 'responders.json');

(async () => {
  if (!fs.existsSync(SRC)) {
    console.error(`Missing ${SRC}`);
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  if (process.argv.includes('--reset')) {
    const { deletedCount } = await Responder.deleteMany({});
    console.log(`Reset: removed ${deletedCount} responders`);
  }

  const { responders } = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  let created = 0, updated = 0;
  const counts = { hospital: 0, police: 0, fire: 0 };

  for (const r of responders) {
    // upsert on (name, type) so re-running refreshes rather than duplicates
    const res = await Responder.updateOne(
      { name: r.name, type: r.type },
      {
        $set: {
          name: r.name,
          type: r.type,
          phone: r.phone,
          address: r.address,
          location: r.location,
          capacity: r.capacity,
          isActive: true,
          available: true
        },
        // currentLoad is live dispatch state - never reset it on re-import
        $setOnInsert: { currentLoad: 0 }
      },
      { upsert: true }
    );
    if (res.upsertedCount) created++; else if (res.modifiedCount) updated++;
    counts[r.type]++;
  }

  console.log(`\ncreated ${created}, updated ${updated}`);
  console.log('by type:');
  for (const [k, v] of Object.entries(counts)) console.log(`  ${String(v).padStart(3)}  ${k}`);
  console.log(`\ntotal in DB: ${await Responder.countDocuments()}`);
  console.log('Facility data © OpenStreetMap contributors (ODbL)');
  console.log('Phones are national emergency lines (112 / 108 / 101) unless the facility published its own.');

  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });