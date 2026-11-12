/**
 * Job Portal listings — was referenced by js/jobs.js (fetches
 * /api/services/jobs) but had no model or route backing it at all.
 * Named VerifiedJob (not Job) because routes/services.js already has its own
 * Job model for something else — this avoids an OverwriteModelError from
 * two different schemas both being registered as 'Job'.
 *
 * Populated by scripts/importJobsData.js from a verified 19-job export
 * (source: Indeed listings + official company careers pages, checked
 * 2026-09-07).
 *
 * Field names here mostly mirror the source (job_title, employer,
 * employment_type, application_url...) rather than the frontend's
 * (title, company, type, applyLink...) — the route normalizes between the
 * two so js/jobs.js needs no changes. See routes/jobs.js's toFrontendShape().
 */
const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  slug:  { type: String, required: true, unique: true },

  jobTitle:       { type: String, required: true },
  employer:       { type: String, required: true },
  location:       String,
  category:       String,  // raw source category, e.g. 'banking_finance'
  employmentType: String,  // 'full_time' | 'internship/fresher/student' (source's own values)
  experience:     { type: String, default: null },
  qualification:  { type: String, default: null },
  salary:         { type: String, default: null },

  source:               String, // e.g. 'Indeed'
  applicationUrl:        { type: String, default: null },
  officialCompanyCareers: { type: String, default: null },
  applyEmail:            { type: String, default: null }, // not in this source; kept for a future one that has it

  status:        String, // e.g. 'active_listing'
  verifiedAt:    String, // e.g. '2026-09-07'
  deadline:      { type: Date, default: null }, // not in this source — null until a source provides one

  jobVerified:            { type: Boolean, default: false },
  locationVerified:       { type: Boolean, default: false },
  applicationLinkVerified: { type: Boolean, default: false },
  verificationNote:       { type: String, default: null }
}, { timestamps: true });

jobSchema.index({ category: 1 });
jobSchema.index({ employmentType: 1 });

module.exports = mongoose.model('VerifiedJob', jobSchema);