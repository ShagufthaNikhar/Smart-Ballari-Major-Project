// Proves the citizen serializer cannot leak officer identity or internal signals.
const { toCitizenView, toOfficerView } = require('./serializers/issue');

const issue = {
  grievanceId: 'SB-2026-00007',
  title: 'No water supply for 3 days',
  description: 'Ward 12 has had no supply since Monday.',
  category: 'water',
  status: 'in-progress',
  imageUrl: 'https://res.cloudinary.com/x/photo.jpg',
  imageRef: 'smartballari/issues/abc123',
  createdAt: new Date('2026-08-12T09:10:00'),
  updatedAt: new Date('2026-08-14T15:40:00'),
  acceptedAt: new Date('2026-08-13T11:00:00'),
  reportedBy: 'firebase-uid-citizen-1',
  assignedOfficer: { _id: 'off1', name: 'R. Sharma', designation: 'AEE', employeeId: 'SB/WS/44' },
  assignedTo: 'R. Sharma',
  officerRemarks: 'Sharma inspected the valve on 13th.',
  aiConf: 87,
  aiTagged: true,
  flags: 2,
  reporterTrustScore: 73,
  upvotes: ['uid-a', 'uid-b', 'uid-c'],
  downvotes: ['uid-d'],
  voteScore: 2,
  verified: true,
  priority: 'high',
  timeline: [
    { status: 'open',        timestamp: new Date('2026-08-12T09:10:00'), updatedBy: 'firebase-uid-citizen-1', message: 'Issue reported and registered.' },
    { status: 'accepted',    timestamp: new Date('2026-08-13T11:00:00'), updatedBy: 'off1', message: 'Taking this up - R. Sharma' },
    { status: 'in-progress', timestamp: new Date('2026-08-14T15:40:00'), updatedBy: 'off1', message: 'Valve replacement ordered' }
  ]
};

const citizen = toCitizenView(issue);
const blob = JSON.stringify(citizen);

const forbidden = [
  'R. Sharma', 'Sharma', 'AEE', 'SB/WS/44', 'off1',
  'assignedOfficer', 'assignedTo', 'officerRemarks',
  'Valve replacement', 'inspected the valve',
  'uid-a', 'uid-d', 'firebase-uid-citizen-1',
  'reporterTrustScore', 'imageRef', 'abc123',
  'aiConf', 'flags', 'updatedBy'
];
const leaks = forbidden.filter(t => blob.includes(String(t)));

console.log('--- CITIZEN VIEW ---');
console.log(JSON.stringify(citizen, null, 2));
console.log('\n--- LEAK CHECK ---');
console.log(leaks.length === 0
  ? 'PASS - no officer identity or internal signal in citizen payload'
  : 'FAIL - leaked: ' + leaks.join(', '));
console.log('\n--- OFFICER VIEW sees the name ---');
console.log(JSON.stringify(toOfficerView(issue).assignedOfficer));