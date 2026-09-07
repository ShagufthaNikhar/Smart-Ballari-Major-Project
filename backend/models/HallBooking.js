// ===================================================================
//  SAVE THIS AS:   backend/models/HallBooking.js
// ===================================================================
const mongoose = require('mongoose');

const timelineEntrySchema = new mongoose.Schema({
  status:    { type: String, required: true },
  by:        { type: String },              // firebaseUid of the admin who acted
  message:   { type: String },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const hallBookingSchema = new mongoose.Schema({
  bookingId: { type: String, unique: true, index: true },   // HB-2026-00007

  hallName:      { type: String, required: true },
  requesterName: { type: String, required: true },
  requesterOrg:  { type: String },
  contactPhone:  { type: String },
  contactEmail:  { type: String },

  date:      { type: Date, required: true },
  startTime: { type: String, required: true },   // "14:00"
  endTime:   { type: String, required: true },
  purpose:   { type: String },
  attendees: { type: Number },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  adminNote: { type: String },
  timeline:  [timelineEntrySchema]
}, { timestamps: true });

/** Same pattern as Issue.transitionTo - appends to the audit trail. */
hallBookingSchema.methods.transitionTo = function (status, by, message) {
  this.status = status;
  this.timeline.push({ status, by, message });
};

/**
 * Auto-generates bookingId on first save, reusing the same counters
 * collection and per-year sequence style as grievanceId (see
 * backend/seed/setup.js) so both IDs are consistent across the app.
 */
hallBookingSchema.pre('save', async function (next) {
  if (this.bookingId) return next();

  const year = new Date().getFullYear();
  const Counter = mongoose.connection.collection('counters');
  const result = await Counter.findOneAndUpdate(
    { _id: `hallbooking-${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  const seq = String(result.value.seq).padStart(5, '0');
  this.bookingId = `HB-${year}-${seq}`;
  next();
});

module.exports = mongoose.model('HallBooking', hallBookingSchema);