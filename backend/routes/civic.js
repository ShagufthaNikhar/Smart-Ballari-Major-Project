// ===================================================================
//  /api/civic — ward councillors and public development projects
//
//  civic-portal.js has called these two endpoints since it was written, but
//  no router was ever mounted, so the Civic Services Portal loaded with an
//  empty councillor directory and an empty project list.
//
//  Static data, like routes/heritage.js and the colleges list in
//  routes/services.js. There is no admin UI to edit these yet, so they live
//  in the file rather than in Mongo.
//
//  IMPORTANT: the councillor names, wards, parties and phone numbers below
//  are PLACEHOLDERS invented for the demo, in the same spirit as the
//  placeholder helpline numbers in config/departments.js. Replace them with
//  the real Ballari City Corporation ward list before this is shown as
//  factual, and never present invented councillor names as real people.
// ===================================================================
const express = require('express');
const router  = express.Router();

const COUNCILLORS = [
  { name: 'Ward 12 Councillor',  ward: 12, area: 'Gandhi Nagar',   party: '—', phone: '08392-222112' },
  { name: 'Ward 15 Councillor',  ward: 15, area: 'Cantonment',     party: '—', phone: '08392-222115' },
  { name: 'Ward 18 Councillor',  ward: 18, area: 'Fort Road',      party: '—', phone: '08392-222118' },
  { name: 'Ward 21 Councillor',  ward: 21, area: 'Cowl Bazaar',    party: '—', phone: '08392-222121' },
  { name: 'Ward 24 Councillor',  ward: 24, area: 'Bapuji Nagar',   party: '—', phone: '08392-222124' },
  { name: 'Ward 27 Councillor',  ward: 27, area: 'Moka Road',      party: '—', phone: '08392-222127' },
  { name: 'Ward 30 Councillor',  ward: 30, area: 'Sanjay Gandhi Nagar', party: '—', phone: '08392-222130' },
  { name: 'Ward 33 Councillor',  ward: 33, area: 'Satyanarayana Peta', party: '—', phone: '08392-222133' }
];

// status must be one of: in-progress | delayed | completed | stalled
// (civic-portal.js maps exactly these four to its badge + bar colours)
const PROJECTS = [
  {
    name: 'Cowl Bazaar road resurfacing', area: 'Cowl Bazaar',
    category: 'Roads', department: 'Public Works',
    status: 'in-progress', percent: 62, spentLakhs: 48.5, budgetLakhs: 78.0
  },
  {
    name: 'Ward 15 underground drainage', area: 'Cantonment',
    category: 'Sanitation', department: 'Sanitation',
    status: 'delayed', percent: 34, spentLakhs: 41.2, budgetLakhs: 120.0
  },
  {
    name: 'Fort Road heritage lighting', area: 'Fort Road',
    category: 'Heritage', department: 'Tourism',
    status: 'in-progress', percent: 78, spentLakhs: 22.4, budgetLakhs: 29.0
  },
  {
    name: 'Gandhi Nagar water pipeline replacement', area: 'Gandhi Nagar',
    category: 'Water Supply', department: 'Water Board',
    status: 'completed', percent: 100, spentLakhs: 95.6, budgetLakhs: 98.0
  },
  {
    name: 'Moka Road storm water drain', area: 'Moka Road',
    category: 'Sanitation', department: 'Public Works',
    status: 'stalled', percent: 18, spentLakhs: 14.0, budgetLakhs: 76.5
  },
  {
    name: 'Bapuji Nagar streetlight LED conversion', area: 'Bapuji Nagar',
    category: 'Electrical', department: 'Electricity',
    status: 'in-progress', percent: 55, spentLakhs: 18.7, budgetLakhs: 34.0
  },
  {
    name: 'Ward 30 community park restoration', area: 'Sanjay Gandhi Nagar',
    category: 'Parks', department: 'Horticulture',
    status: 'delayed', percent: 41, spentLakhs: 12.3, budgetLakhs: 30.0
  },
  {
    name: 'Bus stand approach road widening', area: 'KSRTC Stand',
    category: 'Roads', department: 'Public Works',
    status: 'completed', percent: 100, spentLakhs: 143.8, budgetLakhs: 150.0
  }
];

// GET /api/civic/councillors -> [{ name, ward, area, party, phone }]
router.get('/councillors', (req, res) => {
  const { ward, area } = req.query;
  let list = COUNCILLORS;

  if (ward) list = list.filter(c => String(c.ward) === String(ward));
  if (area) list = list.filter(c =>
    c.area.toLowerCase().includes(String(area).toLowerCase()));

  res.json(list);
});

// GET /api/civic/projects -> [{ name, area, category, department,
//                              status, percent, spentLakhs, budgetLakhs }]
router.get('/projects', (req, res) => {
  const { status, area } = req.query;
  let list = PROJECTS;

  if (status) list = list.filter(p => p.status === status);
  if (area)   list = list.filter(p =>
    p.area.toLowerCase().includes(String(area).toLowerCase()));

  res.json(list);
});

// GET /api/civic/summary -> spend roll-up, handy for dashboards
router.get('/summary', (req, res) => {
  const budget = PROJECTS.reduce((s, p) => s + p.budgetLakhs, 0);
  const spent  = PROJECTS.reduce((s, p) => s + p.spentLakhs, 0);

  res.json({
    totalProjects: PROJECTS.length,
    byStatus: PROJECTS.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {}),
    budgetLakhs: +budget.toFixed(1),
    spentLakhs:  +spent.toFixed(1),
    utilisation: +((spent / budget) * 100).toFixed(1),
    councillors: COUNCILLORS.length
  });
});

module.exports = router;