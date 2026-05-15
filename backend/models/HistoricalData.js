const mongoose = require('mongoose');

const historicalSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['water', 'traffic', 'power', 'crowd', 'sanitation'],
    required: true
  },
  area:      { type: String, required: true },
  value:     { type: Number, required: true },  // metric value
  unit:      { type: String },                  // e.g. 'pressure', 'vehicles/hr'
  timestamp: { type: Date, default: Date.now },
  metadata:  { type: Object, default: {} }
});

// Index for fast time-range queries
historicalSchema.index({ type: 1, area: 1, timestamp: -1 });

module.exports = mongoose.model('HistoricalData', historicalSchema);