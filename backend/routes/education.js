/**
 * Smart Ballari — Education service (schools + colleges)
 *
 * Mount in server.js:
 *   const educationRoutes = require('./routes/education');
 *   app.use('/api/services', educationRoutes);
 *
 * Endpoints:
 *   GET /api/services/education?search=&category=&group=&govt=
 *   GET /api/services/education/categories   -> taxonomy tree + live counts
 *   GET /api/services/colleges               -> legacy alias (higher-ed only)
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const DATA_PATH = path.join(__dirname, '..', 'data', 'ballari_education.json');
const INSTITUTIONS = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));

/* ------------------------------------------------------------------ *
 * Taxonomy — the dropdown is generated from this, so add a key here
 * (and tag institutions with it) and the UI picks it up automatically.
 * ------------------------------------------------------------------ */
const TAXONOMY = [
  {
    group: 'school',
    label: 'Schools',
    items: [
      
      { key: 'primary_school',          label: 'Primary School',           icon: '✏️' },
      { key: 'high_school',             label: 'High School',              icon: '🏫' },
      { key: 'cbse_school',             label: 'CBSE School',              icon: '🏫' },
      { key: 'icse_school',             label: 'ICSE / CISCE School',      icon: '🏫' },
      { key: 'government_school',       label: 'Government School',        icon: '🏫' },
      { key: 'private_school',          label: 'Private School',           icon: '🏫' },
      { key: 'residential_school',      label: 'Residential School',       icon: '🏠' }
    ]
  },
  {
    group: 'college',
    label: 'Colleges & Higher Education',
    items: [
      { key: 'pu_college',            label: 'PU College',              icon: '📗' },
      { key: 'degree_college',        label: 'Degree College',          icon: '🎓' },
      { key: 'commerce_college',      label: 'Commerce College',        icon: '📊' },
      { key: 'management_college',    label: 'Management College',      icon: '💼' },
      { key: 'engineering_college',   label: 'Engineering College',     icon: '⚙️' },
      { key: 'medical_college',       label: 'Medical College',         icon: '🏥' },
      { key: 'dental_college',        label: 'Dental College',          icon: '🦷' },
      { key: 'nursing_college',       label: 'Nursing College',         icon: '🩺' },
      { key: 'pharmacy_college',      label: 'Pharmacy College',        icon: '💊' },
      { key: 'law_college',           label: 'Law College',             icon: '⚖️' },
      { key: 'education_bed_college', label: 'Education (B.Ed) College', icon: '📚' },
      { key: 'polytechnic',           label: 'Polytechnic',             icon: '🔧' },
      { key: 'technical_institute',   label: 'Technical Institute',     icon: '🛠️' },
      { key: 'university',            label: 'University',              icon: '🏛️' }
    ]
  }
];

const LABELS = {};
TAXONOMY.forEach(g => g.items.forEach(i => { LABELS[i.key] = i.label; }));

/* ------------------------------------------------------------------ */

function decorate(inst) {
  return {
    ...inst,
    tag_labels: inst.tags.map(t => LABELS[t] || t),
    primary_label: LABELS[inst.primary_tag] || inst.type,
    maps_url: inst.place_id
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(inst.name + ' Ballari')}&query_place_id=${inst.place_id}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(inst.name + ', ' + (inst.address || 'Ballari, Karnataka'))}`
  };
}

function filter({ search = '', category = '', group = '', govt = '' }) {
  const q = String(search).trim().toLowerCase();

  return INSTITUTIONS.filter(inst => {
    if (category && !inst.tags.includes(category)) return false;
    if (group && !inst.groups.includes(group)) return false;
    if (govt === 'true' && !inst.govt) return false;

    if (!q) return true;
    const haystack = [
      inst.name,
      inst.type,
      inst.address,
      inst.area,
      ...inst.tags.map(t => LABELS[t] || t)
    ].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

/* Taxonomy + how many institutions sit under each key */
router.get('/education/categories', (req, res) => {
  const counts = {};
  INSTITUTIONS.forEach(i => i.tags.forEach(t => { counts[t] = (counts[t] || 0) + 1; }));

  res.json({
    total: INSTITUTIONS.length,
    groups: TAXONOMY.map(g => ({
      ...g,
      count: INSTITUTIONS.filter(i => i.groups.includes(g.group)).length,
      items: g.items.map(i => ({ ...i, count: counts[i.key] || 0 }))
    }))
  });
});

router.get('/education', (req, res) => {
  res.json(filter(req.query).map(decorate));
});

router.get('/education/:id', (req, res) => {
  const inst = INSTITUTIONS.find(i => i.id === req.params.id);
  if (!inst) return res.status(404).json({ error: 'Institution not found' });
  res.json(decorate(inst));
});

/* Legacy: old /colleges callers keep working, higher-ed only */
router.get('/colleges', (req, res) => {
  res.json(filter({ ...req.query, group: 'college' }).map(decorate));
});

module.exports = router;