require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Resource = require('../models/Resource');

const resources = [
  // ── GARBAGE TRUCKS ────────────────────────────────
  {
    name: 'GT-01 Gandhi Nagar',
    type: 'garbage-truck',
    status: 'available',
    location: { lat: 15.1394, lng: 76.9214, area: 'Gandhi Nagar' },
    capacity: 100, currentLoad: 0
  },
  {
    name: 'GT-02 Nehru Gunj',
    type: 'garbage-truck',
    status: 'deployed',
    location: { lat: 15.1420, lng: 76.9180, area: 'Nehru Gunj' },
    capacity: 100, currentLoad: 65,
    assignedTo: 'Nehru Gunj'
  },
  {
    name: 'GT-03 Old Town',
    type: 'garbage-truck',
    status: 'available',
    location: { lat: 15.1450, lng: 76.9150, area: 'Old Town' },
    capacity: 100, currentLoad: 0
  },
  {
    name: 'GT-04 KSRTC Area',
    type: 'garbage-truck',
    status: 'maintenance',
    location: { lat: 15.1350, lng: 76.9250, area: 'KSRTC Stand' },
    capacity: 100, currentLoad: 0
  },
  {
    name: 'GT-05 Cantonment',
    type: 'garbage-truck',
    status: 'available',
    location: { lat: 15.1480, lng: 76.9120, area: 'Cantonment' },
    capacity: 100, currentLoad: 0
  },

  // ── AMBULANCES ────────────────────────────────────
  {
    name: 'AMB-01 VIMS',
    type: 'ambulance',
    status: 'available',
    location: { lat: 15.1550, lng: 76.9300, area: 'VIMS' },
    capacity: 2, currentLoad: 0
  },
  {
    name: 'AMB-02 District Hospital',
    type: 'ambulance',
    status: 'deployed',
    location: { lat: 15.1410, lng: 76.9195, area: 'Fort Road' },
    capacity: 2, currentLoad: 1,
    assignedTo: 'Gandhi Nagar'
  },
  {
    name: 'AMB-03 ESI Hospital',
    type: 'ambulance',
    status: 'available',
    location: { lat: 15.1480, lng: 76.9120, area: 'Cantonment' },
    capacity: 2, currentLoad: 0
  },

  // ── WATER TANKERS ─────────────────────────────────
  {
    name: 'WT-01 Main Depot',
    type: 'water-tanker',
    status: 'available',
    location: { lat: 15.1394, lng: 76.9214, area: 'Gandhi Nagar' },
    capacity: 10000, currentLoad: 8000
  },
  {
    name: 'WT-02 Hospet Road',
    type: 'water-tanker',
    status: 'deployed',
    location: { lat: 15.1300, lng: 76.9370, area: 'Hospet Road' },
    capacity: 10000, currentLoad: 3000,
    assignedTo: 'Hospet Road'
  },

  // ── POLICE VANS ───────────────────────────────────
  {
    name: 'PV-01 City Station',
    type: 'police-van',
    status: 'available',
    location: { lat: 15.1395, lng: 76.9230, area: 'City Centre' },
    capacity: 6, currentLoad: 0
  },
  {
    name: 'PV-02 Rural Station',
    type: 'police-van',
    status: 'available',
    location: { lat: 15.1300, lng: 76.9370, area: 'Hospet Road' },
    capacity: 6, currentLoad: 0
  },

  // ── FIRE TRUCKS ───────────────────────────────────
  {
    name: 'FT-01 Main Station',
    type: 'fire-truck',
    status: 'available',
    location: { lat: 15.1430, lng: 76.9160, area: 'Station Road' },
    capacity: 5000, currentLoad: 5000
  }
];

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    await Resource.deleteMany({});
    await Resource.insertMany(resources);
    console.log(`✅ Seeded ${resources.length} resources`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });