/**
 * Import OpenStreetMap POIs into the Place collection.
 *
 *   node scripts/importPlaces.js            # add / update
 *   node scripts/importPlaces.js --reset    # wipe the collection first
 *
 * Input: data/overpass-export.geojson, produced by overpass-turbo.eu over the
 * box (15.00, 76.30) - (15.42, 77.02), which covers Ballari, Hospet, Hampi,
 * Anegundi and Sandur.
 *
 * Re-running is safe: places are upserted on (osmType, osmId), so refreshing
 * the export updates existing rows instead of duplicating them.
 *
 * LICENCE: OSM data is ODbL. It may be stored and redistributed provided
 * "© OpenStreetMap contributors" is shown wherever it appears. That string is
 * written onto every record.
 */
require('dotenv').config();
const fs       = require('fs');
const path     = require('path');
const mongoose = require('mongoose');
const Place    = require('../models/Place');

const SRC = path.join(__dirname, '..', 'data', 'overpass-export.geojson');

// Town centres, for assigning each POI to the nearest one.
const TOWNS = {
  Hampi:    [15.3352, 76.4600],
  Anegundi: [15.3520, 76.4720],
  Hospet:   [15.2690, 76.3870],
  Sandur:   [15.1000, 76.5500],
  Ballari:  [15.1400, 76.9200]
};

// Names that tell a visitor nothing. OSM uses these as generic labels for
// unidentified structures, and a trip planner offering "Temple" or "Pit" as a
// stop looks broken.
const JUNK = /^(temple|gopura|pit|ram|big|shiva lingas?|carved stone figure|4 pillar structure|watch ?tower|ruins?|mandapa|well|tank|palace ruins|structure|unknown)$/i;

// Already curated in the Monument collection with researched history and a 3D
// model. Importing OSM's thinner version would duplicate them in the UI.
const COVERED = new Set([
  'virupaksha temple', 'stone chariot', 'lotus mahal', 'vijaya vitthala temple'
]);

/**
 * Map OSM tags to a category, a dwell estimate and a rank.
 * rank drives ordering: Hampi has 150+ temples and a day fits about four
 * stops, so a fort has to outrank a roadside shrine.
 */
function classify(t) {
  const { historic: h, tourism: to, leisure: le, natural: na,
          amenity: am, waterway: ww } = t;

  if (h === 'fort' || h === 'city_gate')      return ['monument',   90, 92, h];
  if (h === 'archaeological_site')            return ['monument',   50, 80, h];
  if (['monument','temple','tower','building','memorial','stone'].includes(h))
                                              return ['monument',   45, 74, h];
  if (h === 'ruins')                          return ['monument',   40, 66, h];
  if (h)                                      return ['monument',   40, 60, h];

  if (to === 'museum')                        return ['museum',     60, 82, to];
  if (to === 'viewpoint')                     return ['viewpoint',  30, 78, to];
  if (na === 'peak')                          return ['viewpoint',  45, 70, na];
  if (to === 'zoo')                           return ['family',    120, 72, to];
  if (le === 'water_park')                    return ['family',    180, 64, le];
  if (to === 'attraction')                    return ['attraction', 40, 70, to];
  if (to === 'artwork')                       return ['attraction', 15, 46, to];
  if (to === 'picnic_site')                   return ['attraction', 45, 50, to];
  if (to === 'information')                   return ['information',10, 30, to];

  if (ww === 'waterfall' || na === 'waterfall') return ['nature',   60, 76, 'waterfall'];
  if (na === 'water' || na === 'spring')      return ['nature',     30, 52, na];
  if (na === 'tree')                          return ['nature',     10, 34, na];

  if (le === 'nature_reserve')                return ['park',       90, 68, le];
  if (le === 'park')                          return ['park',       45, 48, le];

  if (am === 'place_of_worship')              return ['temple',     30, 44, am];
  return [null, 0, 0, null];
}

function nearestTown(lat, lng) {
  let best = null, bestD = Infinity;
  for (const [name, [tlat, tlng]] of Object.entries(TOWNS)) {
    const d = Math.hypot(lat - tlat, lng - tlng);
    if (d < bestD) { bestD = d; best = name; }
  }
  return best;
}

(async () => {
  if (!fs.existsSync(SRC)) {
    console.error(`Missing ${SRC}\nExport from overpass-turbo.eu and save it there.`);
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  if (process.argv.includes('--reset')) {
    const { deletedCount } = await Place.deleteMany({});
    console.log(`Reset: removed ${deletedCount} places`);
  }

  const geo = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const feats = geo.features || [];

  const skipped = { unnamed: 0, generic: 0, curated: 0, uncategorised: 0, noCoords: 0 };
  let created = 0, updated = 0;

  for (const f of feats) {
    const t = f.properties || {};
    const name = (t.name || '').trim();

    if (!name)                       { skipped.unnamed++;       continue; }
    if (JUNK.test(name))             { skipped.generic++;       continue; }
    if (COVERED.has(name.toLowerCase())) { skipped.curated++;   continue; }

    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2) { skipped.noCoords++;     continue; }
    const [lng, lat] = coords;

    const [category, visitMinutes, rank, osmTag] = classify(t);
    if (!category)                   { skipped.uncategorised++; continue; }

    // Overpass ids look like "node/123456" in the GeoJSON @id field
    const rawId = t['@id'] || f.id || '';
    const [osmType, osmIdStr] = String(rawId).split('/');
    const osmId = Number(osmIdStr);
    if (!osmType || !Number.isFinite(osmId)) { skipped.noCoords++; continue; }

    const doc = {
      osmType, osmId, name,
      nameKannada: t['name:kn'] || undefined,
      category, osmTag, visitMinutes, rank,
      town: nearestTown(lat, lng),
      location: { lat, lng },
      religion:     t.religion     || undefined,
      denomination: t.denomination || undefined,
      material:     t.material     || undefined,
      address:      t['addr:full'] || t['addr:city'] || undefined,
      wikidata:     t.wikidata     || undefined,
      wikipedia:    t.wikipedia    || undefined
    };

    const res = await Place.updateOne(
      { osmType, osmId },
      { $set: doc },
      { upsert: true }
    );
    if (res.upsertedCount) created++; else if (res.modifiedCount) updated++;
  }

  const total = await Place.countDocuments();
  console.log(`\ncreated ${created}, updated ${updated}, total in DB ${total}`);
  console.log('skipped:', skipped);

  const byTown = await Place.aggregate([
    { $group: { _id: '$town', n: { $sum: 1 } } }, { $sort: { n: -1 } }
  ]);
  console.log('\nby town:');
  byTown.forEach(r => console.log(`  ${String(r.n).padStart(4)}  ${r._id}`));

  const byCat = await Place.aggregate([
    { $group: { _id: '$category', n: { $sum: 1 } } }, { $sort: { n: -1 } }
  ]);
  console.log('\nby category:');
  byCat.forEach(r => console.log(`  ${String(r.n).padStart(4)}  ${r._id}`));

  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });