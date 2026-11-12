const express = require('express');
const router  = express.Router();
const VerifiedJob = require('../models/VerifiedJob');

// js/jobs.js was already written against a specific shape (title, company,
// type, sector, applyLink, skills[], etc.) that this source doesn't use
// directly (job_title, employer, employment_type, category,
// application_url — no skills array at all). Normalize here so the
// frontend needs no changes.
function toFrontendShape(j) {
  const type =
    j.employmentType === 'full_time' ? 'full-time' :
    j.employmentType?.startsWith('internship') ? 'internship' :
    j.employmentType || 'full-time';

  // No description field in the source — build a short one from what is
  // there instead of leaving it null (the frontend renders it unguarded).
  const descParts = [];
  if (j.qualification) descParts.push(`Qualification: ${j.qualification}`);
  if (j.experience)    descParts.push(`Experience: ${j.experience}`);
  if (!j.jobVerified)  descParts.push('⚠️ Listing not independently verified');

  return {
    title:       j.jobTitle,
    company:     j.employer,
    type,
    salary:      j.salary,
    location:    j.location,
    experience:  j.experience,
    // Human-readable sector label derived from the raw category
    // ('banking_finance' -> 'Banking Finance') since the source has no
    // separate sector field.
    sector:      (j.category || 'General').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    description: descParts.join(' · '),
    skills:      [], // not in this source
    applyLink:   j.applicationUrl,
    applyEmail:  j.applyEmail,
    deadline:    j.deadline
  };
}

// GET jobs — mounted at /api/services, so this is /api/services/jobs
// Query: ?search=&type=full-time&sector=Banking%20Finance
router.get('/jobs', async (req, res) => {
  try {
    const { search, type, sector } = req.query;
    const filter = {};

    if (type) {
      filter.employmentType = type === 'full-time' ? 'full_time'
        : type === 'internship' ? { $regex: '^internship' }
        : type;
    }
    if (search) {
      const q = search.trim();
      filter.$or = [
        { jobTitle: { $regex: q, $options: 'i' } },
        { employer: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } }
      ];
    }

    let jobs = await VerifiedJob.find(filter).sort({ jobTitle: 1 }).lean();
    let mapped = jobs.map(toFrontendShape);

    // sector is a derived label, not a stored field, so filter after mapping
    if (sector) mapped = mapped.filter(j => j.sector.toLowerCase() === sector.toLowerCase());

    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: 'Could not load jobs' });
  }
});

// GET distinct sector labels — used to populate the sector dropdown with
// values that actually exist in this data, instead of a hardcoded list
router.get('/jobs/sectors', async (req, res) => {
  try {
    const categories = await VerifiedJob.distinct('category');
    const sectors = categories
      .map(c => (c || 'General').replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()))
      .sort();
    res.json(sectors);
  } catch (err) {
    res.status(500).json({ error: 'Could not load sectors' });
  }
});

module.exports = router;