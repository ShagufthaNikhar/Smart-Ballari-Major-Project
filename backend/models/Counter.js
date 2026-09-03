const mongoose = require('mongoose');

// Atomic sequence generator. Counter _id is per-year ("issue-2026") so
// grievance numbering restarts each January, matching SB-YYYY-NNNNN.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

counterSchema.statics.next = async function (name) {
  const doc = await this.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true }
  );
  return doc.seq;
};

module.exports = mongoose.model('Counter', counterSchema);