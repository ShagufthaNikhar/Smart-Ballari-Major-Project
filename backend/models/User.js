const mongoose = require('mongoose');
const { DEPARTMENT_KEYS } = require('../config/departments');

const userSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true, index: true },
  name:        { type: String, required: true },
  email:       { type: String, required: true, lowercase: true, trim: true },
  phone:       { type: String },

  role: {
    type: String,
    enum: ['citizen', 'officer', 'admin'],
    default: 'citizen',
    index: true
  },

  // Officers only.
  department:  { type: String, enum: DEPARTMENT_KEYS, default: undefined },
  designation: { type: String },
  employeeId:  { type: String },

  active: { type: Boolean, default: true }
}, { timestamps: true });

// An officer with no department must not exist - otherwise the department
// filter in the officer routes would match nothing, or worse, everything.
userSchema.pre('validate', function (next) {
  if (this.role === 'officer' && !this.department) {
    return next(new Error('An officer account must have a department.'));
  }
  if (this.role !== 'officer') this.department = undefined;
  next();
});

module.exports = mongoose.model('User', userSchema);