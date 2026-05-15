const mongoose = require('mongoose');

const deploymentSchema = new mongoose.Schema({
  resourceId:   {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resource'
  },
  resourceName: { type: String },
  resourceType: { type: String },
  area:         { type: String, required: true },
  reason:       { type: String },
  priority:     {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  demandScore:  { type: Number },  // AI score
  dispatchedAt: { type: Date, default: Date.now },
  completedAt:  { type: Date },
  createdBy:    { type: String }
});

deploymentSchema.index({ status: 1, dispatchedAt: -1 });
module.exports = mongoose.model('Deployment', deploymentSchema);