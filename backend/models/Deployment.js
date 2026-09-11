const mongoose = require('mongoose');

const deploymentSchema = new mongoose.Schema({
  resourceId:   {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resource'
  },
  resourceName: { type: String },
  resourceType: { type: String },
  // Which unit this deployment is, when an incident needed more than one
  // of the same type (multi-casualty ambulance dispatch). 0 for the only/
  // first unit — most deployments never go past 0.
  unitIndex: { type: Number, default: 0 },
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

  // Optional link back to the Incident this deployment is responding to.
  // null for ordinary non-emergency deployments (e.g. a routine garbage
  // truck reallocation) — only emergency-recommendation-approved
  // deployments set this. Lets both sides ask:
  //   "which resource is responding to this incident?" (Incident -> here)
  //   "which incident caused this deployment?"          (here -> Incident)
  incidentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Incident',
    default: null
  },

  // Set when an admin/officer marks this dispatch as confirmed/en route
  // via the Responder Manager's Confirm button — see routes/responders.js
  // POST /:id/confirm. null means still unconfirmed. Checked by
  // config/allocationEngine.js's escalation timer: a CRITICAL dispatch
  // unconfirmed for more than 2 minutes gets escalated to the next-nearest
  // responder of the same type.
  confirmedAt: { type: Date, default: null },

  // Set by the escalation timer when this deployment was cancelled for
  // timing out unconfirmed (rather than completed normally) — lets the
  // admin see WHY a deployment ended without digging through logs.
  cancelReason: { type: String, default: null },

  dispatchedAt: { type: Date, default: Date.now },
  completedAt:  { type: Date },
  createdBy:    { type: String }
});

deploymentSchema.index({ status: 1, dispatchedAt: -1 });
deploymentSchema.index({ incidentId: 1, status: 1 });

module.exports = mongoose.model('Deployment', deploymentSchema);