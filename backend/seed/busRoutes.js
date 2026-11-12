require('dotenv').config({
  path: require('path').resolve(__dirname, '../.env')
});
const mongoose  = require('mongoose');
const BusRoute  = require('../models/BusRoute');

// ─────────────────────────────────────────────────────────────────
// Stops sourced from the cross-verified 3-decimal GeoJSON; polylines
// sourced from the main-road-corridor GeoJSON
// (Ballari_7_Routes_Main_Road_Corridor_3_Decimal.geojson), which
// shapes each route along documented Ballari road corridors instead
// of straight stop-to-stop lines. Not turn-by-turn GPS geometry —
// a routing engine / road-snap would still be needed for that.
// frequency / firstBus / lastBus are ESTIMATES for a mid-size city
// bus service (20–30 min headway, ~06:00–21:30 service window) —
// swap these for real BMTC/KSRTC-equivalent timetable figures for
// Ballari city buses as soon as you have them.
// Each route alternates a single simulated bus between its two ends
// (handled in busSimulator.js), matching the "(1)"/"(2)" bus counts
// without ever showing 2 markers on the same route at once.
// ─────────────────────────────────────────────────────────────────

const routes = [
  {
    routeNumber: 'SB-01',
    name:        'SP Circle - BITM',
    from:        'SP Circle',
    to:          'BITM',
    color:       '#38bdf8',
    frequency:   20,
    firstBus:    '06:00',
    lastBus:     '21:30',
    stops: [
      { name: 'SP Circle',        lat: 15.152, lng: 76.938, sequence: 1 },
      { name: 'Royal Circle',     lat: 15.145, lng: 76.928, sequence: 2 },
      { name: 'Mothi Circle',     lat: 15.145, lng: 76.925, sequence: 3 },
      { name: 'Ranga Mandir',     lat: 15.139, lng: 76.921, sequence: 4 },
      { name: '1st Gate',         lat: 15.142, lng: 76.91,  sequence: 5 },
      { name: 'Select Talkies',   lat: 15.14,  lng: 76.906, sequence: 6 },
      { name: 'Cowl Bazar Police Station', lat: 15.137, lng: 76.899, sequence: 7 },
      { name: 'Beef Street',      lat: 15.137, lng: 76.898, sequence: 8 },
      { name: 'Kunitha Masjid',   lat: 15.137, lng: 76.899, sequence: 9 },
      { name: 'Belgal Cross',     lat: 15.14,  lng: 76.902, sequence: 10 },
      { name: 'TB Sanatorium',    lat: 15.147, lng: 76.895, sequence: 11 },
      { name: 'Tilak Nagar',      lat: 15.148, lng: 76.894, sequence: 12 },
      { name: 'Kuvempu Nagar',    lat: 15.154, lng: 76.88,  sequence: 13 },
      { name: 'Allipur',          lat: 15.164, lng: 76.859, sequence: 14 },
      { name: 'BITM',             lat: 15.166, lng: 76.851, sequence: 15 }
    ],
    polyline: [
      { lat: 15.152, lng: 76.938 },
      { lat: 15.15,  lng: 76.934 },
      { lat: 15.145, lng: 76.928 },
      { lat: 15.145, lng: 76.925 },
      { lat: 15.143, lng: 76.922 },
      { lat: 15.141, lng: 76.918 },
      { lat: 15.14,  lng: 76.914 },
      { lat: 15.142, lng: 76.91 },
      { lat: 15.14,  lng: 76.906 },
      { lat: 15.139, lng: 76.902 },
      { lat: 15.137, lng: 76.899 },
      { lat: 15.137, lng: 76.898 },
      { lat: 15.137, lng: 76.899 },
      { lat: 15.139, lng: 76.901 },
      { lat: 15.14,  lng: 76.902 },
      { lat: 15.143, lng: 76.899 },
      { lat: 15.146, lng: 76.896 },
      { lat: 15.148, lng: 76.895 },
      { lat: 15.151, lng: 76.891 },
      { lat: 15.153, lng: 76.886 },
      { lat: 15.154, lng: 76.881 },
      { lat: 15.157, lng: 76.875 },
      { lat: 15.16,  lng: 76.868 },
      { lat: 15.164, lng: 76.859 },
      { lat: 15.165, lng: 76.855 },
      { lat: 15.166, lng: 76.851 }
    ]
  },
  {
    routeNumber: 'SB-02',
    name:        'SP Circle - Bandihatti',
    from:        'SP Circle',
    to:          'Bandihatti',
    color:       '#a855f7',
    frequency:   25,
    firstBus:    '06:00',
    lastBus:     '21:00',
    stops: [
      { name: 'SP Circle',        lat: 15.152, lng: 76.938, sequence: 1 },
      { name: 'Royal Circle',     lat: 15.145, lng: 76.928, sequence: 2 },
      { name: 'Mothi Circle',     lat: 15.145, lng: 76.925, sequence: 3 },
      { name: 'Ranga Mandir',     lat: 15.139, lng: 76.921, sequence: 4 },
      { name: '1st Gate',         lat: 15.142, lng: 76.91,  sequence: 5 },
      { name: 'Select Talkies',   lat: 15.14,  lng: 76.906, sequence: 6 },
      { name: 'Cowl Bazar Police Station', lat: 15.137, lng: 76.899, sequence: 7 },
      { name: 'Beef Street',      lat: 15.137, lng: 76.898, sequence: 8 },
      { name: 'Kunitha Masjid',   lat: 15.137, lng: 76.899, sequence: 9 },
      { name: 'Pinchanwadi Masjid Circle', lat: 15.134, lng: 76.892, sequence: 10 },
      { name: 'Kendriya Vidyalaya', lat: 15.135, lng: 76.893, sequence: 11 },
      { name: 'Bandihatti Circle', lat: 15.133, lng: 76.889, sequence: 12 },
      { name: 'Bandihatti',       lat: 15.134, lng: 76.889, sequence: 13 }
    ],
    polyline: [
      { lat: 15.152, lng: 76.938 },
      { lat: 15.15,  lng: 76.934 },
      { lat: 15.145, lng: 76.928 },
      { lat: 15.145, lng: 76.925 },
      { lat: 15.143, lng: 76.922 },
      { lat: 15.141, lng: 76.918 },
      { lat: 15.14,  lng: 76.914 },
      { lat: 15.142, lng: 76.91 },
      { lat: 15.14,  lng: 76.906 },
      { lat: 15.139, lng: 76.902 },
      { lat: 15.137, lng: 76.899 },
      { lat: 15.137, lng: 76.898 },
      { lat: 15.137, lng: 76.899 },
      { lat: 15.136, lng: 76.897 },
      { lat: 15.135, lng: 76.894 },
      { lat: 15.134, lng: 76.892 },
      { lat: 15.135, lng: 76.893 },
      { lat: 15.135, lng: 76.891 },
      { lat: 15.133, lng: 76.889 },
      { lat: 15.133, lng: 76.888 },
      { lat: 15.134, lng: 76.889 }
    ]
  },
  {
    routeNumber: 'SB-03',
    name:        'SP Circle - Trauma Care Centre',
    from:        'SP Circle',
    to:          'Trauma Care Centre',
    color:       '#f59e0b',
    frequency:   30,
    firstBus:    '06:30',
    lastBus:     '20:30',
    stops: [
      { name: 'SP Circle',        lat: 15.152, lng: 76.938, sequence: 1 },
      { name: 'Royal Circle',     lat: 15.145, lng: 76.928, sequence: 2 },
      { name: 'Mothi Circle',     lat: 15.145, lng: 76.925, sequence: 3 },
      { name: 'Ranga Mandir',     lat: 15.139, lng: 76.921, sequence: 4 },
      { name: '1st Gate',         lat: 15.142, lng: 76.91,  sequence: 5 },
      { name: 'Select Talkies',   lat: 15.14,  lng: 76.906, sequence: 6 },
      { name: 'Cowl Bazar Police Station', lat: 15.137, lng: 76.899, sequence: 7 },
      { name: 'Beef Street',      lat: 15.137, lng: 76.898, sequence: 8 },
      { name: 'Kunitha Masjid',   lat: 15.137, lng: 76.899, sequence: 9 },
      { name: 'Belgal Cross',     lat: 15.14,  lng: 76.902, sequence: 10 },
      { name: 'TB Hospital',      lat: 15.151, lng: 76.897, sequence: 11 },
      { name: 'Trauma Care Centre', lat: 15.155, lng: 76.899, sequence: 12 }
    ],
    polyline: [
      { lat: 15.152, lng: 76.938 },
      { lat: 15.15,  lng: 76.934 },
      { lat: 15.145, lng: 76.928 },
      { lat: 15.145, lng: 76.925 },
      { lat: 15.143, lng: 76.922 },
      { lat: 15.141, lng: 76.918 },
      { lat: 15.14,  lng: 76.914 },
      { lat: 15.142, lng: 76.91 },
      { lat: 15.14,  lng: 76.906 },
      { lat: 15.139, lng: 76.902 },
      { lat: 15.137, lng: 76.899 },
      { lat: 15.137, lng: 76.898 },
      { lat: 15.137, lng: 76.899 },
      { lat: 15.139, lng: 76.901 },
      { lat: 15.14,  lng: 76.902 },
      { lat: 15.144, lng: 76.9 },
      { lat: 15.148, lng: 76.898 },
      { lat: 15.151, lng: 76.897 },
      { lat: 15.155, lng: 76.899 }
    ]
  },
  {
    routeNumber: 'SB-04',
    name:        'OPD - Bisalahalli',
    from:        'OPD',
    to:          'Bisalahalli',
    color:       '#22c55e',
    frequency:   25,
    firstBus:    '06:00',
    lastBus:     '21:00',
    stops: [
      { name: 'OPD',              lat: 15.155, lng: 76.899, sequence: 1 },
      { name: '2nd Gate',         lat: 15.145, lng: 76.905, sequence: 2 },
      { name: '1st Gate',         lat: 15.142, lng: 76.91,  sequence: 3 },
      { name: 'Mothi Circle',     lat: 15.145, lng: 76.925, sequence: 4 },
      { name: 'Royal Circle',     lat: 15.145, lng: 76.928, sequence: 5 },
      { name: 'Rajkumar Road',    lat: 15.145, lng: 76.929, sequence: 6 },
      { name: 'MG Road',          lat: 15.145, lng: 76.938, sequence: 7 },
      { name: 'Auto Nagar',       lat: 15.142, lng: 76.949, sequence: 8 },
      { name: 'Janta Nagar',      lat: 15.14,  lng: 76.958, sequence: 9 },
      { name: 'Bisalahalli',      lat: 15.14,  lng: 76.974, sequence: 10 }
    ],
    polyline: [
      { lat: 15.155, lng: 76.899 },
      { lat: 15.153, lng: 76.901 },
      { lat: 15.15,  lng: 76.903 },
      { lat: 15.146, lng: 76.905 },
      { lat: 15.144, lng: 76.907 },
      { lat: 15.142, lng: 76.91 },
      { lat: 15.141, lng: 76.914 },
      { lat: 15.142, lng: 76.918 },
      { lat: 15.143, lng: 76.922 },
      { lat: 15.145, lng: 76.925 },
      { lat: 15.145, lng: 76.928 },
      { lat: 15.145, lng: 76.929 },
      { lat: 15.145, lng: 76.933 },
      { lat: 15.145, lng: 76.938 },
      { lat: 15.145, lng: 76.942 },
      { lat: 15.144, lng: 76.946 },
      { lat: 15.142, lng: 76.949 },
      { lat: 15.141, lng: 76.953 },
      { lat: 15.14,  lng: 76.958 },
      { lat: 15.14,  lng: 76.963 },
      { lat: 15.14,  lng: 76.968 },
      { lat: 15.14,  lng: 76.974 }
    ]
  },
  {
    routeNumber: 'SB-05',
    name:        'OPD - Hussain Nagar',
    from:        'OPD',
    to:          'Hussain Nagar',
    color:       '#ef4444',
    frequency:   20,
    firstBus:    '06:00',
    lastBus:     '21:30',
    stops: [
      { name: 'OPD',              lat: 15.155, lng: 76.899, sequence: 1 },
      { name: '2nd Gate',         lat: 15.145, lng: 76.905, sequence: 2 },
      { name: '1st Gate',         lat: 15.142, lng: 76.91,  sequence: 3 },
      { name: 'Government Polytechnic', lat: 15.142, lng: 76.912, sequence: 4 },
      { name: 'Mothi Circle',     lat: 15.145, lng: 76.925, sequence: 5 },
      { name: 'Railway Station',  lat: 15.146, lng: 76.924, sequence: 6 },
      { name: 'Royal Circle',     lat: 15.145, lng: 76.928, sequence: 7 },
      { name: 'Municipal',        lat: 15.146, lng: 76.929, sequence: 8 },
      { name: 'MG Road',          lat: 15.145, lng: 76.938, sequence: 9 },
      { name: 'Hussain Nagar',    lat: 15.146, lng: 76.942, sequence: 10 }
    ],
    polyline: [
      { lat: 15.155, lng: 76.899 },
      { lat: 15.153, lng: 76.901 },
      { lat: 15.15,  lng: 76.903 },
      { lat: 15.146, lng: 76.905 },
      { lat: 15.144, lng: 76.907 },
      { lat: 15.142, lng: 76.91 },
      { lat: 15.142, lng: 76.912 },
      { lat: 15.141, lng: 76.914 },
      { lat: 15.142, lng: 76.918 },
      { lat: 15.143, lng: 76.922 },
      { lat: 15.146, lng: 76.924 },
      { lat: 15.145, lng: 76.925 },
      { lat: 15.145, lng: 76.928 },
      { lat: 15.146, lng: 76.929 },
      { lat: 15.145, lng: 76.933 },
      { lat: 15.145, lng: 76.938 },
      { lat: 15.146, lng: 76.942 }
    ]
  },
  {
    routeNumber: 'SB-06',
    name:        'SP Circle - Prashanth Nagar',
    from:        'SP Circle',
    to:          'Prashanth Nagar',
    color:       '#eab308',
    frequency:   30,
    firstBus:    '06:30',
    lastBus:     '20:30',
    stops: [
      { name: 'SP Circle',        lat: 15.152, lng: 76.938, sequence: 1 },
      { name: 'Royal Circle',     lat: 15.145, lng: 76.928, sequence: 2 },
      { name: 'Mothi Circle',     lat: 15.145, lng: 76.925, sequence: 3 },
      { name: 'Ranga Mandir',     lat: 15.139, lng: 76.921, sequence: 4 },
      { name: '1st Gate',         lat: 15.142, lng: 76.91,  sequence: 5 },
      { name: '2nd Gate',         lat: 15.145, lng: 76.905, sequence: 6 },
      { name: 'Radio Park',       lat: 15.14,  lng: 76.902, sequence: 7 },
      { name: 'Belgal Cross',     lat: 15.14,  lng: 76.902, sequence: 8 },
      { name: 'Ramjeneya Nagar',  lat: 15.143, lng: 76.895, sequence: 9 },
      { name: 'Prashanth Nagar',  lat: 15.149, lng: 76.894, sequence: 10 }
    ],
    polyline: [
      { lat: 15.152, lng: 76.938 },
      { lat: 15.15,  lng: 76.934 },
      { lat: 15.145, lng: 76.928 },
      { lat: 15.145, lng: 76.925 },
      { lat: 15.143, lng: 76.922 },
      { lat: 15.141, lng: 76.918 },
      { lat: 15.14,  lng: 76.914 },
      { lat: 15.142, lng: 76.91 },
      { lat: 15.14,  lng: 76.906 },
      { lat: 15.14,  lng: 76.903 },
      { lat: 15.14,  lng: 76.902 },
      { lat: 15.141, lng: 76.901 },
      { lat: 15.143, lng: 76.899 },
      { lat: 15.145, lng: 76.897 },
      { lat: 15.147, lng: 76.895 },
      { lat: 15.149, lng: 76.894 }
    ]
  },
  {
    routeNumber: 'SB-07',
    name:        'New Bus Stand - Sanganakallu',
    from:        'New Bus Stand',
    to:          'Sanganakallu',
    color:       '#06b6d4',
    frequency:   30,
    firstBus:    '06:00',
    lastBus:     '20:00',
    stops: [
      { name: 'New Bus Stand',    lat: 15.137, lng: 76.919, sequence: 1 },
      { name: 'Mothi Circle',     lat: 15.145, lng: 76.925, sequence: 2 },
      { name: 'Royal Circle',     lat: 15.145, lng: 76.928, sequence: 3 },
      { name: 'SP Circle',        lat: 15.152, lng: 76.938, sequence: 4 },
      { name: 'Durgamma Temple',  lat: 15.151, lng: 76.929, sequence: 5 },
      { name: 'KEB Circle',       lat: 15.158, lng: 76.949, sequence: 6 },
      { name: 'Kshatragudi',      lat: 15.164, lng: 76.956, sequence: 7 },
      { name: 'Sanganakallu',     lat: 15.174, lng: 76.967, sequence: 8 }
    ],
    polyline: [
      { lat: 15.137, lng: 76.919 },
      { lat: 15.14,  lng: 76.921 },
      { lat: 15.142, lng: 76.923 },
      { lat: 15.145, lng: 76.925 },
      { lat: 15.145, lng: 76.928 },
      { lat: 15.147, lng: 76.932 },
      { lat: 15.15,  lng: 76.936 },
      { lat: 15.152, lng: 76.938 },
      { lat: 15.154, lng: 76.936 },
      { lat: 15.156, lng: 76.94 },
      { lat: 15.158, lng: 76.944 },
      { lat: 15.158, lng: 76.949 },
      { lat: 15.16,  lng: 76.952 },
      { lat: 15.164, lng: 76.956 },
      { lat: 15.167, lng: 76.96 },
      { lat: 15.17,  lng: 76.964 },
      { lat: 15.174, lng: 76.967 }
    ]
  }
];

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    await BusRoute.deleteMany({});
    await BusRoute.insertMany(routes);
    console.log(`✅ ${routes.length} real Ballari bus routes seeded!`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });