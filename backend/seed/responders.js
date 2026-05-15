require('dotenv').config({
  path: require('path').resolve(__dirname, '../.env')
});
const mongoose   = require('mongoose');
const Responder  = require('../models/Responder');

const responders = [
  // ── HOSPITALS ──
  {
    name:    'VIMS Government Hospital',
    type:    'hospital',
    phone:   '08392-235555',
    address: 'VIMS Campus, Ballari',
    location: { lat: 15.1550, lng: 76.9300 }
  },
  {
    name:    'District Hospital Ballari',
    type:    'hospital',
    phone:   '08392-255100',
    address: 'Fort Road, Ballari',
    location: { lat: 15.1410, lng: 76.9195 }
  },
  {
    name:    'ESI Hospital Ballari',
    type:    'hospital',
    phone:   '08392-260123',
    address: 'Cantonment, Ballari',
    location: { lat: 15.1480, lng: 76.9120 }
  },

  // ── POLICE ──
  {
    name:    'Ballari City Police Station',
    type:    'police',
    phone:   '08392-222100',
    address: 'Police Station Road, Ballari',
    location: { lat: 15.1395, lng: 76.9230 }
  },
  {
    name:    'Ballari Rural Police Station',
    type:    'police',
    phone:   '08392-244100',
    address: 'Hospet Road, Ballari',
    location: { lat: 15.1300, lng: 76.9370 }
  },
  {
    name:    'Traffic Police HQ Ballari',
    type:    'police',
    phone:   '08392-233200',
    address: 'Gandhi Nagar, Ballari',
    location: { lat: 15.1394, lng: 76.9214 }
  },

  // ── FIRE ──
  {
    name:    'Ballari Fire Station',
    type:    'fire',
    phone:   '101',
    address: 'Station Road, Ballari',
    location: { lat: 15.1430, lng: 76.9160 }
  },
  {
    name:    'Hospet Road Fire Post',
    type:    'fire',
    phone:   '08392-241101',
    address: 'Hospet Road, Ballari',
    location: { lat: 15.1290, lng: 76.9360 }
  }
];

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    await Responder.deleteMany({});
    await Responder.insertMany(responders);
    console.log('✅ Responders seeded!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });