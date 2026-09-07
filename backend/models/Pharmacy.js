const mongoose = require('mongoose');

/**
 * A medical store, shown for LOW-severity medical incidents where an
 * ambulance is the wrong response.
 *
 * LOCATIONS ONLY, and that is deliberate. The source data verified
 * coordinates but explicitly did NOT verify phone numbers or addresses
 * (`phone_verified: false`, `dispatch_ready: false`). So this schema has no
 * phone and no opening-hours field: there is nowhere for an unverified
 * contact detail to be stored, and therefore nowhere for an invented one to
 * creep in later.
 *
 * Someone with a minor injury wants to know where to walk. Handing them a
 * guessed phone number, or claiming a shop is open at 2am on unchecked data,
 * is the kind of error that sends a person across town for nothing.
 */
const pharmacySchema = new mongoose.Schema({
  name:    { type: String, required: true, trim: true },
  brand:   { type: String, default: null },
  address: { type: String, default: null },

  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },

  locationVerified: { type: Boolean, default: false },
  coordinateSource: { type: String },

  isActive: { type: Boolean, default: true }
}, { timestamps: true });

pharmacySchema.index({ name: 1, 'location.lat': 1, 'location.lng': 1 }, { unique: true });

module.exports = mongoose.model('Pharmacy', pharmacySchema);