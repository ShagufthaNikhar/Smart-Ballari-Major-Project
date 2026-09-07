// ===================================================================
//  SAVE THIS AS:   backend/routes/hallBookings.js
// ===================================================================
const express     = require('express');
const router      = express.Router();
const HallBooking = require('../models/HallBooking');
const verifyToken = require('../middleware/verifyToken');
const requireRole = require('../middleware/requireRole');

// Every route here is admin-only, same as officer.js is officer-only.
router.use(verifyToken, requireRole('admin', 'hall-manager'));

async function loadBooking(req, res) {
  const booking = await HallBooking.findOne({
    bookingId: req.params.bookingId.toUpperCase()
  });
  if (!booking) {
    res.status(404).json({ error: 'Booking not found.' });
    return null;
  }
  return booking;
}

/**
 * GET /api/admin/hall-bookings
 * ?hall=  ?status=pending|approved|rejected|cancelled  ?date=YYYY-MM-DD
 */
router.get('/', async (req, res) => {
  try {
    const query = {};
    if (req.query.hall)   query.hallName = req.query.hall;
    if (req.query.status) query.status   = req.query.status;
    if (req.query.date) {
      const start = new Date(req.query.date);
      const end   = new Date(start);
      end.setDate(end.getDate() + 1);
      query.date = { $gte: start, $lt: end };
    }

    const bookings = await HallBooking.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(req.query.limit) || 200, 500));

    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/hall-bookings/stats */
router.get('/stats', async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const [pending, approved, rejected, today] = await Promise.all([
      HallBooking.countDocuments({ status: 'pending' }),
      HallBooking.countDocuments({ status: 'approved' }),
      HallBooking.countDocuments({ status: 'rejected' }),
      HallBooking.countDocuments({ date: { $gte: startOfDay, $lt: endOfDay } })
    ]);
    res.json({ pending, approved, rejected, today });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/hall-bookings/:bookingId/approve */
router.post('/:bookingId/approve', async (req, res) => {
  try {
    const booking = await loadBooking(req, res);
    if (!booking) return;

    if (booking.status !== 'pending') {
      return res.status(409).json({ error: 'Only pending bookings can be approved.' });
    }

    if (req.body.note) booking.adminNote = req.body.note;
    booking.transitionTo('approved', req.user.firebaseUid, req.body.note);
    await booking.save();

    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** POST /api/admin/hall-bookings/:bookingId/reject */
router.post('/:bookingId/reject', async (req, res) => {
  try {
    const { note } = req.body;
    if (!note) return res.status(400).json({ error: 'A reason is required to reject a booking.' });

    const booking = await loadBooking(req, res);
    if (!booking) return;

    if (booking.status !== 'pending') {
      return res.status(409).json({ error: 'Only pending bookings can be rejected.' });
    }

    booking.adminNote = note;
    booking.transitionTo('rejected', req.user.firebaseUid, note);
    await booking.save();

    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** POST /api/admin/hall-bookings/:bookingId/cancel - only for already-approved bookings */
router.post('/:bookingId/cancel', async (req, res) => {
  try {
    const booking = await loadBooking(req, res);
    if (!booking) return;

    if (booking.status !== 'approved') {
      return res.status(409).json({ error: 'Only approved bookings can be cancelled.' });
    }

    if (req.body.note) booking.adminNote = req.body.note;
    booking.transitionTo('cancelled', req.user.firebaseUid, req.body.note);
    await booking.save();

    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;