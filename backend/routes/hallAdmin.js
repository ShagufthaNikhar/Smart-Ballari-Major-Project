/**
 * Smart Ballari — Hall Booking Manager API
 *
 * SAVE AS: backend/routes/hallAdmin.js
 *
 * Mount in server.js ABOVE the /api/admin line:
 *   app.use('/api/admin/hall-bookings', require('./routes/hallAdmin'));
 *   app.use('/api/admin',              require('./routes/admin'));
 *
 * Order matters. routes/admin.js gates its whole file with
 * requireRole('admin'), so a hall-manager hitting /api/admin/hall-bookings
 * would be 403'd before reaching anything. Mounting the more specific path
 * first means Express matches it first and this file's own role gate applies.
 *
 * Scope: admin and hall-manager see every hall booking. A hall-manager is
 * scoped to the hall-booking tool, not to one hall — per-hall ownership is a
 * separate thing and still lives on /api/services/halls/mine via managerUid.
 */

const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');

const verifyToken = require('../middleware/verifyToken');
const requireRole = require('../middleware/requireRole');
const User        = require('../models/User');

// The Booking and Hall schemas are declared inside routes/services.js. If this
// router is mounted first, those models are not registered yet, so pull that
// file in explicitly. require() is cached, so this is a no-op when server.js
// mounts services later.
require('./services');
const Booking = mongoose.model('Booking');
const Hall    = mongoose.model('Hall');

router.use(verifyToken, requireRole('admin', 'hall-manager'));

/* ------------------------------------------------------------------ *
 * Serializer
 *
 * The DB uses bookedBy / bookedByEmail / eventName. Everything the manager
 * UI needs is assembled here so the frontend never guesses at field names.
 * Status values are the schema's own — pending / confirmed / rejected /
 * cancelled. There is no 'approved'.
 * ------------------------------------------------------------------ */
function toManagerView(b, requester, hall) {
  return {
    id:            b._id,
    bookingId:     b.bookingId,
    status:        b.status,

    hallName:      b.hallName,
    hallId:        b.hallId,
    venueContact:  b.venueContact || hall?.contact || null,
    venueAddress:  hall?.address || null,

    requesterName:  b.bookedBy || requester?.name || '—',
    requesterEmail: b.bookedByEmail || requester?.email || null,
    requesterPhone: requester?.phone || null,

    eventName:  b.eventName,
    eventType:  b.eventType,
    attendees:  b.attendees,

    date:      b.date,
    endDate:   b.endDate,
    startTime: b.startTime,
    endTime:   b.endTime,

    // An enquiry has no quoted cost. estimatedCost is null, never zero.
    bookingType:   b.bookingType || 'enquiry',
    estimatedCost: b.estimatedCost,

    notes:     b.notes,
    adminNote: b.adminNote,
    decidedBy: b.decidedBy,
    decidedAt: b.decidedAt,
    timeline:  b.timeline || [],
    createdAt: b.createdAt
  };
}

/** Resolve requester profiles for a page of bookings in one query. */
async function withRequesters(bookings) {
  const emails = [...new Set(bookings.map(b => b.bookedByEmail).filter(Boolean))];
  const uids   = [...new Set(bookings.map(b => b.bookedByUid).filter(Boolean))];
  const hallIds = [...new Set(bookings.map(b => String(b.hallId)).filter(Boolean))];

  const [users, halls] = await Promise.all([
    User.find({ $or: [{ email: { $in: emails } }, { firebaseUid: { $in: uids } }] })
        .select('name email phone firebaseUid').lean(),
    Hall.find({ _id: { $in: hallIds } }).select('contact address').lean()
  ]);

  const byEmail = Object.fromEntries(users.map(u => [u.email, u]));
  const byUid   = Object.fromEntries(users.map(u => [u.firebaseUid, u]));
  const byHall  = Object.fromEntries(halls.map(h => [String(h._id), h]));

  return bookings.map(b => toManagerView(
    b,
    byUid[b.bookedByUid] || byEmail[b.bookedByEmail],
    byHall[String(b.hallId)]
  ));
}

/**
 * Append to the audit trail. Field names match the schema in services.js
 * (status / message / by / timestamp) and the manager UI, which reads
 * e.timestamp.
 */
function logTimeline(booking, status, actor, message) {
  booking.timeline = booking.timeline || [];
  booking.timeline.push({
    status,
    message:   message || '',
    by:        actor?.email || actor?.name || 'system',
    timestamp: new Date()
  });
}

/* ── STATS ────────────────────────────────────────── */
router.get('/stats', async (req, res) => {
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end   = new Date(start); end.setDate(end.getDate() + 1);

    const [byStatus, today] = await Promise.all([
      Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Booking.countDocuments({
        date:   { $gte: start, $lt: end },
        status: { $in: ['pending', 'confirmed'] }
      })
    ]);

    const counts = Object.fromEntries(byStatus.map(s => [s._id, s.count]));

    res.json({
      pending:   counts.pending   || 0,
      confirmed: counts.confirmed || 0,
      rejected:  counts.rejected  || 0,
      cancelled: counts.cancelled || 0,
      today
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── LIST ─────────────────────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const { hall, status, date } = req.query;
    const query = {};

    if (hall)   query.hallName = hall;
    if (status) query.status   = status;
    if (date) {
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end   = new Date(start); end.setDate(end.getDate() + 1);
      query.date = { $gte: start, $lt: end };
    }

    const bookings = await Booking.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(req.query.limit) || 200, 500))
      .lean();

    res.json(await withRequesters(bookings));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── SINGLE ───────────────────────────────────────── */
router.get('/:bookingId', async (req, res) => {
  try {
    const b = await Booking.findOne({ bookingId: req.params.bookingId }).lean();
    if (!b) return res.status(404).json({ error: 'Booking not found.' });
    const [view] = await withRequesters([b]);
    res.json(view);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── DECISIONS ────────────────────────────────────── */

/**
 * Shared handler. `from` is the set of statuses the booking may currently be
 * in — findOneAndUpdate on status is not used because the timeline needs the
 * previous document, but the status guard still prevents double-deciding a
 * booking two managers opened at once.
 */
async function decide(req, res, { to, from, requireNote, verb }) {
  try {
    const note = (req.body?.note || '').trim();
    if (requireNote && !note) {
      return res.status(400).json({ error: `A reason is required to ${verb} a request.` });
    }

    const booking = await Booking.findOne({ bookingId: req.params.bookingId });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

    if (!from.includes(booking.status)) {
      return res.status(409).json({
        error: `This request is already ${booking.status} and cannot be ${to}.`
      });
    }

    booking.status    = to;
    booking.decidedBy = req.user.email || req.user.name;
    booking.decidedAt = new Date();
    if (note) booking.adminNote = note;
    logTimeline(booking, to, req.user, note);
    await booking.save();

    const [view] = await withRequesters([booking.toObject()]);
    res.json(view);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/**
 * Approving an ENQUIRY is not the same as approving a priced booking. The
 * venue, not Smart Ballari, decides whether the date is free — so a manager
 * approving one is recording "I called them and they said yes", which is why
 * the note matters more here than on a priced hall.
 */
router.post('/:bookingId/approve', (req, res) =>
  decide(req, res, { to: 'confirmed', from: ['pending'], requireNote: false, verb: 'approve' }));

router.post('/:bookingId/reject', (req, res) =>
  decide(req, res, { to: 'rejected', from: ['pending'], requireNote: true, verb: 'reject' }));

router.post('/:bookingId/cancel', (req, res) =>
  decide(req, res, { to: 'cancelled', from: ['pending', 'confirmed'], requireNote: true, verb: 'cancel' }));

module.exports = router;