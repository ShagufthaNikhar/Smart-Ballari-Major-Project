require('dotenv').config({
  path: require('path').resolve(__dirname, '../.env')
});
const mongoose  = require('mongoose');
const BusRoute  = require('../models/BusRoute');

const routes = [
  {
    routeNumber: 'BLR-01',
    name:        'Gandhi Nagar → Railway Station',
    from:        'Gandhi Nagar Circle',
    to:          'Ballari Railway Station',
    color:       '#38bdf8',
    frequency:   15,
    firstBus:    '05:30',
    lastBus:     '22:30',
    stops: [
      { name: 'Gandhi Nagar Circle',    lat: 15.1394, lng: 76.9214, sequence: 1 },
      { name: 'Nehru Gunj',             lat: 15.1420, lng: 76.9180, sequence: 2 },
      { name: 'Old Town Bus Stop',      lat: 15.1450, lng: 76.9150, sequence: 3 },
      { name: 'Cantonment',             lat: 15.1480, lng: 76.9120, sequence: 4 },
      { name: 'Ballari Railway Station',lat: 15.1510, lng: 76.9090, sequence: 5 }
    ],
    polyline: [
      { lat: 15.1394, lng: 76.9214 },
      { lat: 15.1400, lng: 76.9205 },
      { lat: 15.1408, lng: 76.9195 },
      { lat: 15.1420, lng: 76.9180 },
      { lat: 15.1433, lng: 76.9168 },
      { lat: 15.1445, lng: 76.9155 },
      { lat: 15.1450, lng: 76.9150 },
      { lat: 15.1460, lng: 76.9138 },
      { lat: 15.1470, lng: 76.9128 },
      { lat: 15.1480, lng: 76.9120 },
      { lat: 15.1492, lng: 76.9108 },
      { lat: 15.1500, lng: 76.9098 },
      { lat: 15.1510, lng: 76.9090 }
    ]
  },
  {
    routeNumber: 'BLR-02',
    name:        'KSRTC Stand → Hospet Road',
    from:        'KSRTC Bus Stand',
    to:          'Hospet Road Junction',
    color:       '#a855f7',
    frequency:   20,
    firstBus:    '06:00',
    lastBus:     '21:00',
    stops: [
      { name: 'KSRTC Bus Stand',        lat: 15.1350, lng: 76.9250, sequence: 1 },
      { name: 'City Market',            lat: 15.1330, lng: 76.9280, sequence: 2 },
      { name: 'Sandur Road Cross',      lat: 15.1310, lng: 76.9320, sequence: 3 },
      { name: 'Hospet Road Junction',   lat: 15.1280, lng: 76.9370, sequence: 4 }
    ],
    polyline: [
      { lat: 15.1350, lng: 76.9250 },
      { lat: 15.1344, lng: 76.9260 },
      { lat: 15.1338, lng: 76.9268 },
      { lat: 15.1330, lng: 76.9280 },
      { lat: 15.1322, lng: 76.9292 },
      { lat: 15.1316, lng: 76.9305 },
      { lat: 15.1310, lng: 76.9320 },
      { lat: 15.1298, lng: 76.9342 },
      { lat: 15.1288, lng: 76.9358 },
      { lat: 15.1280, lng: 76.9370 }
    ]
  },
  {
    routeNumber: 'BLR-03',
    name:        'Medical College → Tekkalakote',
    from:        'VIMS Medical College',
    to:          'Tekkalakote',
    color:       '#f59e0b',
    frequency:   30,
    firstBus:    '07:00',
    lastBus:     '20:00',
    stops: [
      { name: 'VIMS Medical College',   lat: 15.1550, lng: 76.9300, sequence: 1 },
      { name: 'Nandihalli Cross',       lat: 15.1530, lng: 76.9340, sequence: 2 },
      { name: 'Kappagallu',             lat: 15.1500, lng: 76.9390, sequence: 3 },
      { name: 'Tekkalakote',            lat: 15.1460, lng: 76.9450, sequence: 4 }
    ],
    polyline: [
      { lat: 15.1550, lng: 76.9300 },
      { lat: 15.1545, lng: 76.9312 },
      { lat: 15.1538, lng: 76.9325 },
      { lat: 15.1530, lng: 76.9340 },
      { lat: 15.1520, lng: 76.9355 },
      { lat: 15.1510, lng: 76.9370 },
      { lat: 15.1500, lng: 76.9390 },
      { lat: 15.1485, lng: 76.9415 },
      { lat: 15.1470, lng: 76.9435 },
      { lat: 15.1460, lng: 76.9450 }
    ]
  }
];

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    await BusRoute.deleteMany({});
    await BusRoute.insertMany(routes);
    console.log('✅ Bus routes seeded!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });