// Keys MUST match the `category` enum in models/Issue.js exactly.
// Issue enum: road | water | electric | sanitation | other
//
// The grievance numbers are PLACEHOLDERS - replace with real Ballari City
// Corporation department lines before the demo. Never an individual's mobile.

const DEPARTMENTS = {
  road: {
    key: 'road',
    label: 'Roads & Infrastructure',
    grievanceContact: '1800-XXX-XXXX',
    grievanceEmail: 'roads.grievance@smartballari.gov.in'
  },
  water: {
    key: 'water',
    label: 'Water Supply',
    grievanceContact: '1800-XXX-XXXX',
    grievanceEmail: 'water.grievance@smartballari.gov.in'
  },
  electric: {
    key: 'electric',
    label: 'Electricity & Street Lighting',
    grievanceContact: '1800-XXX-XXXX',
    grievanceEmail: 'electricity.grievance@smartballari.gov.in'
  },
  sanitation: {
    key: 'sanitation',
    label: 'Sanitation & Waste',
    grievanceContact: '1800-XXX-XXXX',
    grievanceEmail: 'sanitation.grievance@smartballari.gov.in'
  },
  other: {
    key: 'other',
    label: 'General Grievances',
    grievanceContact: '1800-XXX-XXXX',
    grievanceEmail: 'grievance@smartballari.gov.in'
  }
};

const DEPARTMENT_KEYS = Object.keys(DEPARTMENTS);

// 'pending' is retained only so pre-existing rows still validate.
// New issues start at 'open'.
const STATUSES = ['open', 'pending', 'accepted', 'in-progress', 'resolved', 'rejected'];

// Citizen-facing wording. 'accepted' says "by the department" and never
// names a person - that is the whole point.
const STATUS_LABELS = {
  open:          'Reported - awaiting department review',
  pending:       'Reported - awaiting department review',
  accepted:      'Accepted by department',
  'in-progress': 'In Progress',
  resolved:      'Resolved',
  rejected:      'Closed - not actionable'
};

module.exports = { DEPARTMENTS, DEPARTMENT_KEYS, STATUSES, STATUS_LABELS };