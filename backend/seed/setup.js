/**
 * ===================================================================
 *  SAVE THIS AS:   backend/seed/setup.js   (replaces the old one)
 * ===================================================================
 * One-time setup. Idempotent - safe to run more than once.
 *
 *   node seed/setup.js your@email.com
 *
 *   0. Drops stale indexes left behind by the old schema  <-- NEW
 *   1. uid -> firebaseUid
 *   2. role 'user' -> 'citizen', 'municipality' -> 'officer'
 *   3. officers with no department -> 'other'
 *   4. status 'pending' -> 'open'
 *   5. Seeds the grievance counter
 *   6. Promotes the email you pass to admin
 */
require('dotenv').config();
const mongoose = require('mongoose');

const adminEmail = process.argv[2];

// Indexes the current schema does NOT define. Mongoose creates indexes
// but never removes them, so a field renamed in code leaves its unique
// index behind on the collection - and a unique index permits only ONE
// document with a missing value.
const STALE_INDEXES = ['uid_1'];

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI missing from .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const db       = mongoose.connection.db;
  const users    = db.collection('users');
  const issues   = db.collection('issues');
  const counters = db.collection('counters');

  console.log('Connected.\n');

  const roleCounts = await users.aggregate([
    { $group: { _id: '$role', n: { $sum: 1 } } }
  ]).toArray();
  console.log('Current roles:', roleCounts.length
    ? roleCounts.map(r => `${r._id}=${r.n}`).join('  ')
    : '(no users yet)');
  console.log('');

  // ── 0. drop stale indexes ───────────────────────────
  const existingIdx = await users.indexes();
  console.log('0. Indexes on users:', existingIdx.map(i => i.name).join(', '));
  for (const name of STALE_INDEXES) {
    if (existingIdx.some(i => i.name === name)) {
      await users.dropIndex(name);
      console.log(`   dropped stale index: ${name}`);
    }
  }

  // ── 1. uid -> firebaseUid ───────────────────────────
  const uidFix = await users.updateMany(
    { uid: { $exists: true }, firebaseUid: { $exists: false } },
    [{ $set: { firebaseUid: '$uid' } }]
  );
  console.log(`1. uid -> firebaseUid:        ${uidFix.modifiedCount} user(s)`);

  // Remove the dead field entirely so nothing re-creates the index.
  const uidDrop = await users.updateMany(
    { uid: { $exists: true } },
    { $unset: { uid: '' } }
  );
  console.log(`   removed dead uid field:    ${uidDrop.modifiedCount}`);

  // ── 2. role renames ─────────────────────────────────
  const r1 = await users.updateMany({ role: 'user' },         { $set: { role: 'citizen' } });
  const r2 = await users.updateMany({ role: 'municipality' }, { $set: { role: 'officer'  } });
  console.log(`2. role user->citizen:        ${r1.modifiedCount}`);
  console.log(`   role municipality->officer:${r2.modifiedCount}`);

  // ── 3. officers need a department ───────────────────
  const deptFix = await users.updateMany(
    { role: 'officer', $or: [{ department: { $exists: false } }, { department: null }] },
    { $set: { department: 'other' } }
  );
  console.log(`3. officers given a dept:     ${deptFix.modifiedCount}`);

  // ── 4. legacy status ────────────────────────────────
  const statusFix = await issues.updateMany({ status: 'pending' }, { $set: { status: 'open' } });
  console.log(`4. status pending->open:      ${statusFix.modifiedCount} issue(s)`);

  // ── 5. seed grievance counters ──────────────────────
  const existing = await issues.find(
    { grievanceId: { $exists: true, $ne: null } },
    { projection: { grievanceId: 1 } }
  ).toArray();

  const maxPerYear = {};
  for (const doc of existing) {
    const parts = String(doc.grievanceId).split('-');   // SB-2026-00007
    if (parts.length !== 3) continue;
    const n = parseInt(parts[2], 10);
    if (Number.isNaN(n)) continue;
    maxPerYear[parts[1]] = Math.max(maxPerYear[parts[1]] || 0, n);
  }

  const thisYear = String(new Date().getFullYear());
  if (maxPerYear[thisYear] === undefined) maxPerYear[thisYear] = 0;

  for (const [year, max] of Object.entries(maxPerYear)) {
    await counters.updateOne(
      { _id: `issue-${year}` },
      { $max: { seq: max } },          // never lower an existing counter
      { upsert: true }
    );
    console.log(`5. counter issue-${year}:      seq >= ${max}`);
  }

  // ── 6. promote admin ────────────────────────────────
  if (adminEmail) {
    const res = await users.updateOne(
      { email: adminEmail.toLowerCase() },
      { $set: { role: 'admin' }, $unset: { department: '' } }
    );
    console.log(res.matchedCount === 0
      ? `\n6. No user with email ${adminEmail}. Register first, then re-run.`
      : `\n6. ${adminEmail} is now admin.`);
  } else {
    console.log('\n6. No admin email passed:  node seed/setup.js your@email.com');
  }

  const after = await users.aggregate([
    { $group: { _id: '$role', n: { $sum: 1 } } }
  ]).toArray();
  console.log('\nFinal roles:', after.length
    ? after.map(r => `${r._id}=${r.n}`).join('  ')
    : '(no users)');

  await mongoose.disconnect();
  console.log('Done.');
  process.exit(0);
})().catch(err => {
  console.error('\nSetup failed:', err);
  process.exit(1);
});