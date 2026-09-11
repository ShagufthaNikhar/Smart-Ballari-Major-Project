// Seed script: loads the real Ballari City Corporation D2D vehicle list
// into the Resource collection as type: 'garbage-truck' documents, with
// each truck's routeStops reconstructed from the official area
// descriptions and precise coordinates
// (ballari_d2d_vehicle_areas_3decimal.geojson).
//
// How routeStops was built (done once, offline, not at seed time): the
// geojson's 133 points and the vehicle list are both in the SAME order as
// the original Ballari City Corporation document, grouped by division.
// Areas were allocated to vehicles within each division proportional to
// how many wards each vehicle serves (largest-remainder / Hamilton
// apportionment, so the count always sums exactly), then each vehicle's
// slice was further split across its own wards in listed order. This is
// reconstruction from the real document structure, not a blind guess —
// but it IS an approximation where the source document didn't give an
// exact area-count per vehicle, so spot-check a few trucks against the
// original PDF if perfect accuracy matters for a specific route.
//
// Run with:  node scripts/seedGarbageFleet.js
// Safe to re-run: upserts on vehicleNo.

require('dotenv').config();
const mongoose = require('mongoose');
const Resource = require('../models/Resource');

const RAW_FLEET = [
  {
    "division": "1ST DIVISION",
    "driver": "A.K.NAVEEN KUMAR",
    "vehicle_no": "KA 34 B 1287",
    "vehicle_type": "WINNER AUTO",
    "capacity": "2",
    "wet_dry": "Yes",
    "mobile": "9164940991",
    "ward": "32"
  },
  {
    "division": "1ST DIVISION",
    "driver": "H.RAMESH",
    "vehicle_no": "KA 34 B 1961",
    "vehicle_type": "TRACTOR",
    "capacity": "7",
    "wet_dry": "No",
    "mobile": "9620992184",
    "ward": "30"
  },
  {
    "division": "1ST DIVISION",
    "driver": "VENKATESH ULU",
    "vehicle_no": "KA 34 B 1963",
    "vehicle_type": "TRACTOR",
    "capacity": "7",
    "wet_dry": "No",
    "mobile": "9844994735",
    "ward": "31"
  },
  {
    "division": "1ST DIVISION",
    "driver": "SRINIVASUL U",
    "vehicle_no": "KA 34 B 1975",
    "vehicle_type": "TRACTOR",
    "capacity": "7",
    "wet_dry": "No",
    "mobile": "9164075483",
    "ward": "2"
  },
  {
    "division": "1ST DIVISION",
    "driver": "RAMANJINI",
    "vehicle_no": "KA 34 A 7573",
    "vehicle_type": "M.MAXIMO",
    "capacity": "3",
    "wet_dry": "No",
    "mobile": "9986870422",
    "ward": "9"
  },
  {
    "division": "1ST DIVISION",
    "driver": "HONNURAPPA",
    "vehicle_no": "KA 34 A 7577",
    "vehicle_type": "M.MAXIMO",
    "capacity": "3",
    "wet_dry": "No",
    "mobile": "9535513095",
    "ward": "33"
  },
  {
    "division": "1ST DIVISION",
    "driver": "RAMESH.K",
    "vehicle_no": "KA 34 A 9842",
    "vehicle_type": "BOLERO JEEP",
    "capacity": "2",
    "wet_dry": "No",
    "mobile": "9663959033",
    "ward": "32"
  },
  {
    "division": "1ST DIVISION",
    "driver": "UMESH.Y",
    "vehicle_no": "KA 34 B 6226",
    "vehicle_type": "PORTER",
    "capacity": "2.5",
    "wet_dry": "Yes",
    "mobile": "9880990597",
    "ward": "2"
  },
  {
    "division": "2ND DIVISION",
    "driver": "RAGHAPPA",
    "vehicle_no": "KA 34 B1280",
    "vehicle_type": "WINNER AUTO",
    "capacity": "2",
    "wet_dry": "Yes",
    "mobile": "9900851191",
    "ward": "20"
  },
  {
    "division": "2ND DIVISION",
    "driver": "THIPPESWAMY NAIK",
    "vehicle_no": "KA 34 B 1284",
    "vehicle_type": "WINNER AUTO",
    "capacity": "2",
    "wet_dry": "Yes",
    "mobile": "",
    "ward": "1"
  },
  {
    "division": "2ND DIVISION",
    "driver": "N.B.GANESH",
    "vehicle_no": "KA 34 B 1795",
    "vehicle_type": "WINNER AUTO",
    "capacity": "2",
    "wet_dry": "Yes",
    "mobile": "8867424009",
    "ward": "18"
  },
  {
    "division": "2ND DIVISION",
    "driver": "T.LAKSHMI KUMAR",
    "vehicle_no": "KA 34 B 6222",
    "vehicle_type": "PORTER",
    "capacity": "2.5",
    "wet_dry": "Yes",
    "mobile": "9844692976",
    "ward": "19"
  },
  {
    "division": "2ND DIVISION",
    "driver": "PARAMESHI",
    "vehicle_no": "KA 34 B 1915",
    "vehicle_type": "WINNER AUTO",
    "capacity": "2",
    "wet_dry": "Yes",
    "mobile": "9686052755",
    "ward": "19"
  },
  {
    "division": "2ND DIVISION",
    "driver": "HULLEPPA.K",
    "vehicle_no": "KA 34 B 1977",
    "vehicle_type": "TRACTOR",
    "capacity": "7",
    "wet_dry": "Yes",
    "mobile": "9740036561",
    "ward": "1"
  },
  {
    "division": "2ND DIVISION",
    "driver": "K.RAVI CHANDRA",
    "vehicle_no": "KA 34 B 1979",
    "vehicle_type": "TRACTOR",
    "capacity": "7",
    "wet_dry": "Yes",
    "mobile": "8050680141",
    "ward": "20"
  },
  {
    "division": "2ND DIVISION",
    "driver": "THIMMAPPA",
    "vehicle_no": "KA 34 B 1981",
    "vehicle_type": "TRACTOR",
    "capacity": "7",
    "wet_dry": "Yes",
    "mobile": "9342611500",
    "ward": "18"
  },
  {
    "division": "2ND DIVISION",
    "driver": "B.VEERESH",
    "vehicle_no": "KA 34 B 1987",
    "vehicle_type": "TRACTOR",
    "capacity": "7",
    "wet_dry": "Yes",
    "mobile": "7795630484",
    "ward": "22"
  },
  {
    "division": "2ND DIVISION",
    "driver": "K P SHIVA KUMAR",
    "vehicle_no": "KA 34 A 7579",
    "vehicle_type": "M.MAXIMO",
    "capacity": "3",
    "wet_dry": "Yes",
    "mobile": "9900851123",
    "ward": "16"
  },
  {
    "division": "2ND DIVISION",
    "driver": "T.SRINIVAS",
    "vehicle_no": "KA 34 A 7626",
    "vehicle_type": "M.MAXIMO",
    "capacity": "3",
    "wet_dry": "Yes",
    "mobile": "8095961230",
    "ward": "21"
  },
  {
    "division": "2ND DIVISION",
    "driver": "T.N.ASHOK",
    "vehicle_no": "KA 34 A 7628",
    "vehicle_type": "M.MAXIMO",
    "capacity": "3",
    "wet_dry": "Yes",
    "mobile": "9986080386",
    "ward": "21,22"
  },
  {
    "division": "2ND DIVISION",
    "driver": "N.NAGENDRA",
    "vehicle_no": "KA 34 A 9843",
    "vehicle_type": "BOLERO JEEP",
    "capacity": "2",
    "wet_dry": "Yes",
    "mobile": "9900725852",
    "ward": "17"
  },
  {
    "division": "2ND DIVISION",
    "driver": "B.RAMU",
    "vehicle_no": "KA 34 B 1913",
    "vehicle_type": "WINNER AUTO",
    "capacity": "2",
    "wet_dry": "Yes",
    "mobile": "7411170044",
    "ward": "17"
  },
  {
    "division": "2ND DIVISION",
    "driver": "M.SRIKANTH",
    "vehicle_no": "NEW WINNER",
    "vehicle_type": "WINNER AUTO",
    "capacity": "2",
    "wet_dry": "Yes",
    "mobile": "9611174250",
    "ward": "20,21,22"
  },
  {
    "division": "2ND DIVISION",
    "driver": "H.TULASI RAGHU RAM",
    "vehicle_no": "KA 34 B 6225",
    "vehicle_type": "PORTER",
    "capacity": "2.5",
    "wet_dry": "Yes",
    "mobile": "7259333073",
    "ward": "16"
  },
  {
    "division": "2ND DIVISION",
    "driver": "KALI PRASAD",
    "vehicle_no": "KA 34 B 6221",
    "vehicle_type": "PORTER",
    "capacity": "2.5",
    "wet_dry": "Yes",
    "mobile": "9731889052",
    "ward": "17"
  },
  {
    "division": "3RD DIVISION",
    "driver": "DEVID",
    "vehicle_no": "KA 34 A 1726",
    "vehicle_type": "M.MAXIMO",
    "capacity": "3",
    "wet_dry": "Yes",
    "mobile": "9164863022",
    "ward": "4,6"
  },
  {
    "division": "3RD DIVISION",
    "driver": "GURURAJ",
    "vehicle_no": "KA 34 B 1917",
    "vehicle_type": "WINNER AUTO",
    "capacity": "2",
    "wet_dry": "Yes",
    "mobile": "9108113877",
    "ward": "5"
  },
  {
    "division": "3RD DIVISION",
    "driver": "G.NARENDRA KUMAR",
    "vehicle_no": "KA 34 B 1919",
    "vehicle_type": "WINNER AUTO",
    "capacity": "2",
    "wet_dry": "Yes",
    "mobile": "9591856960",
    "ward": "8"
  },
  {
    "division": "3RD DIVISION",
    "driver": "K.PAKKIRAPPA",
    "vehicle_no": "KA 34 B 1983",
    "vehicle_type": "TRACTOR",
    "capacity": "7",
    "wet_dry": "Yes",
    "mobile": "9731838381",
    "ward": "3,4,5"
  },
  {
    "division": "3RD DIVISION",
    "driver": "K.R.RAGHAVENDRA",
    "vehicle_no": "KA 34 A 9841",
    "vehicle_type": "BOLERO JEEP",
    "capacity": "2",
    "wet_dry": "Yes",
    "mobile": "9739295842",
    "ward": "7"
  },
  {
    "division": "3RD DIVISION",
    "driver": "HULUGAPPA",
    "vehicle_no": "KA 34 TR 2963",
    "vehicle_type": "M.MAXIMO",
    "capacity": "3",
    "wet_dry": "Yes",
    "mobile": "9900852120",
    "ward": "5"
  },
  {
    "division": "3RD DIVISION",
    "driver": "GADHILINGAPPA",
    "vehicle_no": "KA 05 TR 1141",
    "vehicle_type": "TRACTOR",
    "capacity": "7",
    "wet_dry": "Yes",
    "mobile": "9742133690",
    "ward": "4,5,6,7"
  },
  {
    "division": "3RD DIVISION",
    "driver": "T.MUNI SWAMY",
    "vehicle_no": "KA 34 B 6227",
    "vehicle_type": "PORTER",
    "capacity": "2.5",
    "wet_dry": "Yes",
    "mobile": "9480018559",
    "ward": "3,5,6"
  },
  {
    "division": "4TH DIVISION",
    "driver": "V.GOVARDHANA",
    "vehicle_no": "KA 34 A 7527",
    "vehicle_type": "M.MAXIMO",
    "capacity": "3",
    "wet_dry": "Yes",
    "mobile": "9535632061",
    "ward": "15"
  },
  {
    "division": "4TH DIVISION",
    "driver": "THAKUR NAIK",
    "vehicle_no": "KA 34 B 1288",
    "vehicle_type": "WINNER AUTO",
    "capacity": "2",
    "wet_dry": "Yes",
    "mobile": "",
    "ward": "12"
  },
  {
    "division": "4TH DIVISION",
    "driver": "AMEER JOHN",
    "vehicle_no": "KA 34 B 1973",
    "vehicle_type": "WINNER AUTO",
    "capacity": "2",
    "wet_dry": "Yes",
    "mobile": "9980717217",
    "ward": "4,11"
  },
  {
    "division": "5TH DIVISION",
    "driver": "SHARABANNA",
    "vehicle_no": "KA 34 B 1281",
    "vehicle_type": "WINNER AUTO",
    "capacity": "2",
    "wet_dry": "Yes",
    "mobile": "9980691271",
    "ward": "30"
  },
  {
    "division": "5TH DIVISION",
    "driver": "MUNNA",
    "vehicle_no": "KA 34 B 1796",
    "vehicle_type": "WINNER AUTO",
    "capacity": "2",
    "wet_dry": "Yes",
    "mobile": "9686325591",
    "ward": "30"
  },
  {
    "division": "5TH DIVISION",
    "driver": "D.RUDRANJANILU",
    "vehicle_no": "KA 34 B 1916",
    "vehicle_type": "WINNER AUTO",
    "capacity": "2",
    "wet_dry": "Yes",
    "mobile": "7795555681",
    "ward": "24"
  },
  {
    "division": "5TH DIVISION",
    "driver": "LOKESH",
    "vehicle_no": "KA 34 B 1918",
    "vehicle_type": "WINNER AUTO",
    "capacity": "2",
    "wet_dry": "Yes",
    "mobile": "9066558872",
    "ward": "27"
  },
  {
    "division": "5TH DIVISION",
    "driver": "B.RAMESH",
    "vehicle_no": "KA 34 B 1967",
    "vehicle_type": "TRACTOR",
    "capacity": "7",
    "wet_dry": "Yes",
    "mobile": "8050575580",
    "ward": "29"
  },
  {
    "division": "5TH DIVISION",
    "driver": "MAHADEVAPPA",
    "vehicle_no": "KA 34 B 1985",
    "vehicle_type": "TRACTOR",
    "capacity": "7",
    "wet_dry": "Yes",
    "mobile": "8495956492",
    "ward": "25"
  },
  {
    "division": "5TH DIVISION",
    "driver": "LAKSHMI NARAYAN",
    "vehicle_no": "KA 34 TR 2970",
    "vehicle_type": "M.MAXIMO",
    "capacity": "3",
    "wet_dry": "Yes",
    "mobile": "9901014482",
    "ward": "23"
  },
  {
    "division": "5TH DIVISION",
    "driver": "P.MURALI KRISHNA",
    "vehicle_no": "KA 34 A 9840",
    "vehicle_type": "BOLERO JEEP",
    "capacity": "2",
    "wet_dry": "Yes",
    "mobile": "8970226164",
    "ward": "31"
  },
  {
    "division": "5TH DIVISION",
    "driver": "RAJENDRA PRASAD",
    "vehicle_no": "KA 34 B 6223",
    "vehicle_type": "PORTER",
    "capacity": "2.5",
    "wet_dry": "Yes",
    "mobile": "9035957512",
    "ward": "30"
  },
  {
    "division": "5TH DIVISION",
    "driver": "DADU",
    "vehicle_no": "KA 34 B 1282",
    "vehicle_type": "WINNER AUTO",
    "capacity": "2",
    "wet_dry": "Yes",
    "mobile": "9008507301",
    "ward": "28"
  },
  {
    "division": "5TH DIVISION",
    "driver": "M.MALLIKARJUNA",
    "vehicle_no": "KA 34 B 6224",
    "vehicle_type": "PORTER",
    "capacity": "2.5",
    "wet_dry": "Yes",
    "mobile": "9980158679",
    "ward": "28"
  },
  {
    "division": "5TH DIVISION",
    "driver": "B.VAMSHI",
    "vehicle_no": "KA 34 B 1285",
    "vehicle_type": "WINNER AUTO",
    "capacity": "2",
    "wet_dry": "Yes",
    "mobile": "8123553955",
    "ward": ""
  },
  {
    "division": "6TH DIVISION",
    "driver": "K.BASAVANTH KUMAR",
    "vehicle_no": "KA 34 B 1286",
    "vehicle_type": "WINNER AUTO",
    "capacity": "2",
    "wet_dry": "Yes",
    "mobile": "9972175956",
    "ward": "13"
  },
  {
    "division": "6TH DIVISION",
    "driver": "B.BALARAJ",
    "vehicle_no": "KA 34 B1965",
    "vehicle_type": "TRACTOR",
    "capacity": "7",
    "wet_dry": "No",
    "mobile": "9980431302",
    "ward": "10,13"
  },
  {
    "division": "6TH DIVISION",
    "driver": "SHIVA KUMAR",
    "vehicle_no": "KA 34 B 1969",
    "vehicle_type": "TRACTOR",
    "capacity": "7",
    "wet_dry": "No",
    "mobile": "7204509353",
    "ward": "9"
  },
  {
    "division": "6TH DIVISION",
    "driver": "ARUN KUMAR",
    "vehicle_no": "KA 34 B 1971",
    "vehicle_type": "TRACTOR",
    "capacity": "7",
    "wet_dry": "No",
    "mobile": "7411461492",
    "ward": "10,11"
  },
  {
    "division": "6TH DIVISION",
    "driver": "G.RAMANJINEYULU",
    "vehicle_no": "KA 34 A 7629",
    "vehicle_type": "M.MAXIMO",
    "capacity": "3",
    "wet_dry": "No",
    "mobile": "9740117220",
    "ward": "9"
  }
];

// vehicle_no -> ordered [{ ward, area, lat, lng }, ...]
const ROUTE_STOPS = {
  "KA 34 B 1287": [
    {
      "ward": 32,
      "area": "Siruguppa Main Road / Bomb Bazar / Kutty Hotel Circle / BCC Ground",
      "lat": 15.149,
      "lng": 76.918
    },
    {
      "ward": 32,
      "area": "Malleshwara Temple / ZP Quarters / BEO Office / Income Tax Office",
      "lat": 15.151,
      "lng": 76.924
    }
  ],
  "KA 34 B 1961": [
    {
      "ward": 30,
      "area": "Santoshi Matha Temple surrounding area",
      "lat": 15.147,
      "lng": 76.925
    },
    {
      "ward": 30,
      "area": "Fort Main Road to Sai Baba Temple",
      "lat": 15.145,
      "lng": 76.918
    }
  ],
  "KA 34 B 1963": [
    {
      "ward": 31,
      "area": "Bijapur Colony / Post Office / Polytechnic College",
      "lat": 15.149,
      "lng": 76.929
    },
    {
      "ward": 31,
      "area": "CSI Telugu Church / Water Tank / Govardhan House",
      "lat": 15.148,
      "lng": 76.918
    }
  ],
  "KA 34 B 1975": [
    {
      "ward": 2,
      "area": "Durgamma Gudi / Petrol Bunk Oni / Shastri Nagar",
      "lat": 15.143,
      "lng": 76.917
    },
    {
      "ward": 2,
      "area": "Kurehatti / Ganesh Nagar / Veeranna Gowda Colony / Rajeshwari Nagar",
      "lat": 15.151,
      "lng": 76.914
    }
  ],
  "KA 34 A 7573": [
    {
      "ward": 9,
      "area": "SP Circle to Kutty Hotel Circle / Maruthi Colony / Teachers Colony / Housing Board / Bus Depot",
      "lat": 15.149,
      "lng": 76.918
    },
    {
      "ward": 9,
      "area": "Fire Station / Rajarajeshwari Nagar / M K Nagar / Indra Nagar",
      "lat": 15.155,
      "lng": 76.913
    }
  ],
  "KA 34 A 7577": [
    {
      "ward": 33,
      "area": "Satya Vani Nagar / Guru Colony / Kari Maremma Colony",
      "lat": 15.151,
      "lng": 76.91
    }
  ],
  "KA 34 A 9842": [
    {
      "ward": 32,
      "area": "Royal Circle / Amli Bag / Kalamma Street / Glass Bazar / BSNL Quarters / CMC Office",
      "lat": 15.147,
      "lng": 76.923
    }
  ],
  "KA 34 B 6226": [
    {
      "ward": 2,
      "area": "Girls High School / Railway Station Road / Old Bus Stand Road / Bangalore Road / Kalamma Street",
      "lat": 15.144,
      "lng": 76.919
    }
  ],
  "KA 34 B1280": [
    {
      "ward": 20,
      "area": "Nala Gadda / Pinjar Galli / Flower Market",
      "lat": 15.145,
      "lng": 76.921
    },
    {
      "ward": 20,
      "area": "Kotha Road / Kasai Galli / Pathima Galli / Tank Bund Road",
      "lat": 15.148,
      "lng": 76.918
    },
    {
      "ward": 20,
      "area": "Mothi Circle to Brucepet Police Station",
      "lat": 15.142,
      "lng": 76.909
    }
  ],
  "KA 34 B 1284": [
    {
      "ward": 1,
      "area": "Parvathi Nagar Main Road to 3rd Cross to Yard",
      "lat": 15.153,
      "lng": 76.928
    },
    {
      "ward": 1,
      "area": "Parvathi Nagar 4th Cross / Judge Quarters / Yard",
      "lat": 15.154,
      "lng": 76.928
    }
  ],
  "KA 34 B 1795": [
    {
      "ward": 18,
      "area": "Ram Nagar / Mahanandi Kottam / Harichandra Nagar",
      "lat": 15.149,
      "lng": 76.928
    },
    {
      "ward": 18,
      "area": "Gopal Swamy Road / KSB Colony / Gandhi Nagar 1st Cross",
      "lat": 15.155,
      "lng": 76.936
    }
  ],
  "KA 34 B 6222": [
    {
      "ward": 19,
      "area": "Sanganakal Road / Balabharathi School / Gandhi Nagar 2nd Cross",
      "lat": 15.158,
      "lng": 76.94
    },
    {
      "ward": 19,
      "area": "Gandhi Nagar Moka Road",
      "lat": 15.156,
      "lng": 76.938
    }
  ],
  "KA 34 B 1915": [
    {
      "ward": 19,
      "area": "Gandhi Nagar 1st Cross / Post Office / Vegetable Market",
      "lat": 15.156,
      "lng": 76.936
    },
    {
      "ward": 19,
      "area": "Gandhi Nagar 3rd Cross / Surya Narayana Reddy Office",
      "lat": 15.157,
      "lng": 76.938
    }
  ],
  "KA 34 B 1977": [
    {
      "ward": 1,
      "area": "Basaveshwara Vegetable Market / Water Booster / KEB Circle / T G Layout / Chaitanya College",
      "lat": 15.157,
      "lng": 76.943
    },
    {
      "ward": 1,
      "area": "Nethaji Nagar Housing Board 1st-6th Cross",
      "lat": 15.16,
      "lng": 76.936
    }
  ],
  "KA 34 B 1979": [
    {
      "ward": 20,
      "area": "Nethaji Nagar Water Tank Park / Daya Kendra / Surya Narayana Reddy Point",
      "lat": 15.161,
      "lng": 76.937
    },
    {
      "ward": 20,
      "area": "NR Reddy Colony / Vasavi School / Daya Vidyalaya / Nethaji Nagar",
      "lat": 15.16,
      "lng": 76.938
    }
  ],
  "KA 34 B 1981": [
    {
      "ward": 18,
      "area": "SP Circle / Sudheer Line / Marathi Galli",
      "lat": 15.149,
      "lng": 76.918
    },
    {
      "ward": 18,
      "area": "Devi Nagar / Shanthi Marg / Siruguppa Road / Devi Nagar Main Road",
      "lat": 15.151,
      "lng": 76.908
    }
  ],
  "KA 34 B 1987": [
    {
      "ward": 22,
      "area": "SP Circle / Kumarswamy Temple / Club Road",
      "lat": 15.149,
      "lng": 76.918
    },
    {
      "ward": 22,
      "area": "Geetha Hotel / Basavagudi / Karkan Masjid",
      "lat": 15.145,
      "lng": 76.924
    }
  ],
  "KA 34 A 7579": [
    {
      "ward": 16,
      "area": "Shivalinga Nagar / Kurubara Hostel",
      "lat": 15.151,
      "lng": 76.925
    },
    {
      "ward": 16,
      "area": "Sanjaya Gandhi Nagar",
      "lat": 15.154,
      "lng": 76.924
    }
  ],
  "KA 34 A 7626": [
    {
      "ward": 21,
      "area": "Gandhi Nagar 1st-5th Cross",
      "lat": 15.156,
      "lng": 76.936
    },
    {
      "ward": 21,
      "area": "Gandhi Nagar 5th-10th Cross / LIG / MIG Line / Bank Road",
      "lat": 15.158,
      "lng": 76.936
    }
  ],
  "KA 34 A 7628": [
    {
      "ward": 21,
      "area": "Kappagal Road 1st-3rd Cross",
      "lat": 15.157,
      "lng": 76.933
    },
    {
      "ward": 21,
      "area": "Kappagal Road 4th-5th Cross / Sadashiva Nagar",
      "lat": 15.16,
      "lng": 76.934
    },
    {
      "ward": 21,
      "area": "Suco Bank Road to Sonthalinganna Colony",
      "lat": 15.16,
      "lng": 76.939
    },
    {
      "ward": 22,
      "area": "Indra Nagar / CMC Colony / Markandaya Colony / Vishal Nagar / Hanuman Nagar",
      "lat": 15.155,
      "lng": 76.913
    },
    {
      "ward": 22,
      "area": "Sidiq Colony / Nijalingappa Colony / Golla Narasappa Colony",
      "lat": 15.15,
      "lng": 76.917
    }
  ],
  "KA 34 A 9843": [
    {
      "ward": 17,
      "area": "Royal Colony / Geetha Bai Oni / Marathi Colony",
      "lat": 15.147,
      "lng": 76.919
    },
    {
      "ward": 17,
      "area": "Ramayya Colony / Hussain Nagar",
      "lat": 15.148,
      "lng": 76.914
    }
  ],
  "KA 34 B 1913": [
    {
      "ward": 17,
      "area": "Raghavendra Colony 2nd Stage / Sai Ram Colony / Intory Nagar / ARP Colony",
      "lat": 15.147,
      "lng": 76.952
    },
    {
      "ward": 17,
      "area": "Sathya Sai Colony / Chowary Layout / Durga Colony",
      "lat": 15.149,
      "lng": 76.949
    }
  ],
  "NEW WINNER": [
    {
      "ward": 20,
      "area": "Anthapur Colony / MMTC Colony",
      "lat": 15.151,
      "lng": 76.945
    },
    {
      "ward": 20,
      "area": "Raghavendra Colony 1st Stage / Patel Nagar",
      "lat": 15.148,
      "lng": 76.945
    },
    {
      "ward": 20,
      "area": "ALLM Layout / Haripriya Nagar / Vajpayee Layout",
      "lat": 15.151,
      "lng": 76.948
    },
    {
      "ward": 21,
      "area": "Renuka Nagar 1st-10th Cross",
      "lat": 15.162,
      "lng": 76.927
    },
    {
      "ward": 21,
      "area": "Renuka Nagar 11th Cross / Link Roads",
      "lat": 15.162,
      "lng": 76.929
    },
    {
      "ward": 22,
      "area": "Sri Nagar / Sneha Colony / Sri Sai Nagar",
      "lat": 15.159,
      "lng": 76.931
    },
    {
      "ward": 22,
      "area": "Nehru Colony 1st-4th Cross",
      "lat": 15.151,
      "lng": 76.931
    }
  ],
  "KA 34 B 6225": [
    {
      "ward": 16,
      "area": "S N Pet Main Road / 1st-3rd Cross",
      "lat": 15.147,
      "lng": 76.93
    },
    {
      "ward": 16,
      "area": "S NPAT Road 4th-6th Cross / Royal Circle",
      "lat": 15.148,
      "lng": 76.926
    }
  ],
  "KA 34 B 6221": [
    {
      "ward": 17,
      "area": "Kappagal Road 1st-6th Cross",
      "lat": 15.158,
      "lng": 76.934
    },
    {
      "ward": 17,
      "area": "Kappagal Road 7th-13th Cross",
      "lat": 15.161,
      "lng": 76.936
    }
  ],
  "KA 34 A 1726": [
    {
      "ward": 4,
      "area": "D C Colony / Andral Masjid Line / Ansral Bommanahal Road",
      "lat": 15.151,
      "lng": 76.905
    },
    {
      "ward": 4,
      "area": "Raghavendra Colony 2nd Stage to Sanna Durgamma Temple",
      "lat": 15.147,
      "lng": 76.951
    },
    {
      "ward": 6,
      "area": "Venkateshwara Colony / Datta School / Varada Anjaneya / Patel Nagar",
      "lat": 15.15,
      "lng": 76.945
    }
  ],
  "KA 34 B 1917": [
    {
      "ward": 5,
      "area": "Moka Road Point to 3 Point",
      "lat": 15.156,
      "lng": 76.938
    },
    {
      "ward": 5,
      "area": "MG Main Road to Taranath Hospital",
      "lat": 15.147,
      "lng": 76.914
    }
  ],
  "KA 34 B 1919": [
    {
      "ward": 8,
      "area": "Ayyappa Swamy / Shaiksha Vali Durga area",
      "lat": 15.145,
      "lng": 76.916
    }
  ],
  "KA 34 B 1983": [
    {
      "ward": 3,
      "area": "Bisalahalli / Janatha Nagar",
      "lat": 15.154,
      "lng": 76.905
    },
    {
      "ward": 3,
      "area": "Kappagal Road 6th-8th Cross / Kanaka Durga Layout",
      "lat": 15.159,
      "lng": 76.936
    },
    {
      "ward": 4,
      "area": "Kappagal Road 9th-5th Cross section",
      "lat": 15.161,
      "lng": 76.936
    },
    {
      "ward": 5,
      "area": "Siddhartha Colony 1st-4th Main",
      "lat": 15.158,
      "lng": 76.928
    }
  ],
  "KA 34 A 9841": [
    {
      "ward": 7,
      "area": "Guest House to Pavan Hotel / Vishwanathpuram",
      "lat": 15.151,
      "lng": 76.925
    }
  ],
  "KA 34 TR 2963": [
    {
      "ward": 5,
      "area": "Vishwanathpuram 2nd-3rd Cross / SRP Colony / Umashankar Colony",
      "lat": 15.151,
      "lng": 76.927
    }
  ],
  "KA 05 TR 1141": [
    {
      "ward": 4,
      "area": "Vishal Nagar / Ananthapura Main Road",
      "lat": 15.15,
      "lng": 76.951
    },
    {
      "ward": 4,
      "area": "Datta Sai Nagar / B Gonal",
      "lat": 15.153,
      "lng": 76.951
    },
    {
      "ward": 5,
      "area": "Hanuman Nagar / Allum Bhavan / Anjinappa Nagar",
      "lat": 15.152,
      "lng": 76.947
    },
    {
      "ward": 6,
      "area": "Vasudeva Naidu Street / Sabhapathi Street / Royal Street",
      "lat": 15.142,
      "lng": 76.914
    },
    {
      "ward": 7,
      "area": "Koracha Geri / Pamal Geri / Suleman Khan Street",
      "lat": 15.14,
      "lng": 76.912
    }
  ],
  "KA 34 B 6227": [
    {
      "ward": 3,
      "area": "Bandimote Main Road / Benki Maremma Temple / Bandimote Circle / SC Colony / Tank Bund Road",
      "lat": 15.137,
      "lng": 76.907
    },
    {
      "ward": 3,
      "area": "Kakarlathota",
      "lat": 15.135,
      "lng": 76.929
    },
    {
      "ward": 5,
      "area": "APMC Market Line to Indra Nagar",
      "lat": 15.141,
      "lng": 76.928
    },
    {
      "ward": 6,
      "area": "Mrutunjaya Nagar / Ballarappa Colony",
      "lat": 15.142,
      "lng": 76.935
    }
  ],
  "KA 34 A 7527": [
    {
      "ward": 15,
      "area": "Manjunatha Tea Stall / Lala Kaman / Ganesh Gudi / Golarahatti / Mothi Circle / Brucepet Police Station",
      "lat": 15.141,
      "lng": 76.909
    },
    {
      "ward": 15,
      "area": "Rajasthan Point / New Bus Stand / BUDA Complex / Bal Anjaneya Temple / Rangamandir",
      "lat": 15.14,
      "lng": 76.92
    },
    {
      "ward": 15,
      "area": "Bapuji Nagar High School Road / Bajana Gudi / Boya Geri / Muslim Geri / Gajendra Hotel",
      "lat": 15.134,
      "lng": 76.912
    },
    {
      "ward": 15,
      "area": "Chaluvadi Geri / Guntakal Gudiselu / RK Mill Road / P Yard",
      "lat": 15.132,
      "lng": 76.906
    }
  ],
  "KA 34 B 1288": [
    {
      "ward": 12,
      "area": "Sai Colony / Venkatamma Colony / Guggarahatti",
      "lat": 15.133,
      "lng": 76.891
    },
    {
      "ward": 12,
      "area": "Brucepet Police Station Road / Benki Maremma Temple / Kamela Road",
      "lat": 15.139,
      "lng": 76.91
    },
    {
      "ward": 12,
      "area": "Noorani Masjid / Kamela Hospital / Nagamma Doddi / Bapuji Nagar / Andral Circle / Indra Colony",
      "lat": 15.137,
      "lng": 76.907
    }
  ],
  "KA 34 B 1973": [
    {
      "ward": 4,
      "area": "Rani Thota / Bala Anjaneya Temple / Yelamma Gudi / Ganesh Gudi / Golarahatti / Tank Bund Road",
      "lat": 15.136,
      "lng": 76.914
    },
    {
      "ward": 4,
      "area": "Shabari Hotel / Ballari Nursing Home / Kattegudda / Vaddarageri / Puthur Hospital",
      "lat": 15.154,
      "lng": 76.889
    },
    {
      "ward": 4,
      "area": "JDS Office / Children Hospital / Balaji Rao Road / Jandakatta / Danappa Street / Elahi Street / Taj Hotel",
      "lat": 15.137,
      "lng": 76.905
    },
    {
      "ward": 4,
      "area": "Raghavendra Talkies / Sindigi Compound / Sangam Talkies / ATP Road / Bangalore Road / Bombay Press Road Layout",
      "lat": 15.139,
      "lng": 76.903
    },
    {
      "ward": 11,
      "area": "Ayyappa Swamy Temple to Kudure Galappa Street",
      "lat": 15.143,
      "lng": 76.91
    },
    {
      "ward": 11,
      "area": "Kudure Galappa Street to Boya Geri Street",
      "lat": 15.141,
      "lng": 76.909
    },
    {
      "ward": 11,
      "area": "Mullangi Bedi / Kolimi Chowk Road / Kavitha Ice Cream Factory",
      "lat": 15.139,
      "lng": 76.912
    }
  ],
  "KA 34 B 1281": [
    {
      "ward": 30,
      "area": "Alipura / Rameshwara Nagar / Vinayaka Nagar",
      "lat": 15.164,
      "lng": 76.859
    },
    {
      "ward": 30,
      "area": "Rajiv Gandhi Nagar / Cantonment Road",
      "lat": 15.149,
      "lng": 76.902
    }
  ],
  "KA 34 B 1796": [
    {
      "ward": 30,
      "area": "Nandi School / Rehamad Colony",
      "lat": 15.145,
      "lng": 76.899
    },
    {
      "ward": 30,
      "area": "Jaya Nagar / Thilak Nagar / Nagappa Colony / Hospet Road",
      "lat": 15.143,
      "lng": 76.897
    }
  ],
  "KA 34 B 1916": [
    {
      "ward": 24,
      "area": "Market Dadavali Masjid / Tayaz Street / Glass Bhandi / Rangaswamy Temple Road",
      "lat": 15.139,
      "lng": 76.904
    },
    {
      "ward": 24,
      "area": "Market Jumma Masjid / Ankalamman Temple / Gandhi Chowk / Gadang Street",
      "lat": 15.14,
      "lng": 76.905
    }
  ],
  "KA 34 B 1918": [
    {
      "ward": 27,
      "area": "Sai Baba Temple / Employment Road / Gollar Oni / Chotta Bazar / C B Main Road",
      "lat": 15.141,
      "lng": 76.907
    }
  ],
  "KA 34 B 1967": [
    {
      "ward": 29,
      "area": "Azad Nagar / Kamela Main Road / Gater House / More Galli / Dobhi Street",
      "lat": 15.135,
      "lng": 76.903
    }
  ],
  "KA 34 B 1985": [
    {
      "ward": 25,
      "area": "Ramanjinaya Nagar / Press Colony / Gopal Gowda Nagar",
      "lat": 15.137,
      "lng": 76.895
    }
  ],
  "KA 34 TR 2970": [
    {
      "ward": 23,
      "area": "Badihatta Road / Tayamma Nagar / Kanaka Nagar",
      "lat": 15.135,
      "lng": 76.899
    }
  ],
  "KA 34 A 9840": [
    {
      "ward": 31,
      "area": "Kasa Geri / Belgal Cross / Pikara Street / Gopi Street / Milan Street / Gadang Street",
      "lat": 15.14,
      "lng": 76.9
    }
  ],
  "KA 34 B 6223": [
    {
      "ward": 30,
      "area": "More Galli / Seresta Street / Hatti Makan / Beedi Compound / I Singh Road",
      "lat": 15.138,
      "lng": 76.901
    }
  ],
  "KA 34 B 1282": [
    {
      "ward": 28,
      "area": "Graham Road / Masid Street / Kumber Oni / Flower Street / P Yard",
      "lat": 15.136,
      "lng": 76.902
    }
  ],
  "KA 34 B 6224": [
    {
      "ward": 28,
      "area": "Bangalore Road / Popula Bazar / Kanyaka Parameshwari Street / Rayadurga Bus Stand / Cuming Road / Pinjara Oni / Parking Yard",
      "lat": 15.14,
      "lng": 76.9
    }
  ],
  "KA 34 B 1285": [],
  "KA 34 B 1286": [
    {
      "ward": 13,
      "area": "Mohamadia School backside / Select backside / Karipak Oni / Kumbar Oni / Training School Road",
      "lat": 15.137,
      "lng": 76.914
    },
    {
      "ward": 13,
      "area": "Yaseen Sab Masjid / Poratamma Temple / Dhobi Street",
      "lat": 15.136,
      "lng": 76.916
    },
    {
      "ward": 13,
      "area": "Police Station backside / Sunkalamma Gudi Main Road / Onthaer Galli",
      "lat": 15.138,
      "lng": 76.918
    },
    {
      "ward": 13,
      "area": "Ram Nagar 1st-3rd Cross / Bandihatti",
      "lat": 15.133,
      "lng": 76.891
    }
  ],
  "KA 34 B1965": [
    {
      "ward": 10,
      "area": "Adarsh Colony / Nalanda College Road / Surya Colony",
      "lat": 15.145,
      "lng": 76.892
    },
    {
      "ward": 10,
      "area": "Surya Colony P&T Quarters / TB Sanitorium",
      "lat": 15.143,
      "lng": 76.889
    },
    {
      "ward": 10,
      "area": "Vishwa School Main Road / Sudha Circle / Aishwarya Colony / RTO Office",
      "lat": 15.149,
      "lng": 76.892
    },
    {
      "ward": 10,
      "area": "OPD Main Road / Eye Hospital / OPD Campus / Vidya Nagar 1st-6th Cross",
      "lat": 15.155,
      "lng": 76.899
    },
    {
      "ward": 13,
      "area": "Church Road 1st-6th Cross",
      "lat": 15.157,
      "lng": 76.902
    },
    {
      "ward": 13,
      "area": "Sowdagar Colony / RK Colony / Mary Hospital / Vidya Nagar Main Road",
      "lat": 15.158,
      "lng": 76.904
    },
    {
      "ward": 13,
      "area": "Kuvempu Nagar 1st-3rd Cross",
      "lat": 15.162,
      "lng": 76.907
    },
    {
      "ward": 13,
      "area": "Kuvempu Nagar 4th-5th Cross / Ring Road",
      "lat": 15.164,
      "lng": 76.909
    }
  ],
  "KA 34 B 1969": [
    {
      "ward": 9,
      "area": "1st Railway / Gadang Street / Sai Baba Circle / KEB / Madarasa",
      "lat": 15.146,
      "lng": 76.906
    },
    {
      "ward": 9,
      "area": "Radio Park / Srinivas Apartment / Kanaka Street / Babu Naidu Street / Ganesh Temple",
      "lat": 15.148,
      "lng": 76.903
    },
    {
      "ward": 9,
      "area": "Ganesh Temple / Venu Gopal Naidu Street / Baskar Naidu / Jagamatha Temple",
      "lat": 15.15,
      "lng": 76.904
    },
    {
      "ward": 9,
      "area": "Swathantra Nagar / Police Line / MRK Function Hall",
      "lat": 15.153,
      "lng": 76.9
    }
  ],
  "KA 34 B 1971": [
    {
      "ward": 10,
      "area": "Ayyappa Swamy Temple / Zoo Road / 2nd Railway Gate / Mahaveer Market",
      "lat": 15.151,
      "lng": 76.895
    },
    {
      "ward": 10,
      "area": "Aishwarya Colony / 3rd Railway Gate / NCC Ground",
      "lat": 15.149,
      "lng": 76.891
    },
    {
      "ward": 10,
      "area": "Big Market / Beerappa Gudi / Car Street / Mari Swamy Matt / Kambli Bazar / Gopi Channappa Street",
      "lat": 15.141,
      "lng": 76.905
    },
    {
      "ward": 10,
      "area": "Boya Geri Circle / Diwakar Compound",
      "lat": 15.137,
      "lng": 76.91
    },
    {
      "ward": 11,
      "area": "Muthyalamma Temple / Mareppa Bedi / Maremma Gudi / Koracha Area / Eramma Bedi / Rupanna Gudi",
      "lat": 15.134,
      "lng": 76.91
    },
    {
      "ward": 11,
      "area": "Millerpet Bakery / Rupangudi / Narappa Street / Kesari Singh Bedi / Anjineya Temple Bedi",
      "lat": 15.132,
      "lng": 76.914
    },
    {
      "ward": 11,
      "area": "Warder Rangappa Street / Somadri Street / Venkata Bedi / Compounder Street / Samudaya Bhavan / Abdul Aziz Street",
      "lat": 15.13,
      "lng": 76.916
    },
    {
      "ward": 11,
      "area": "Panvala Galli / Millerpet Masjid / Andhra Bank Compound / Tylor Street",
      "lat": 15.129,
      "lng": 76.918
    }
  ],
  "KA 34 A 7629": [
    {
      "ward": 9,
      "area": "Rupangudi Road / Harichandra Gate / Society Rice Mill / Oni",
      "lat": 15.126,
      "lng": 76.923
    },
    {
      "ward": 9,
      "area": "Market / Main Road Chowk / Mari Swamy Matt / Gopi Channappa Street / Masjid / Rani Thota Road",
      "lat": 15.137,
      "lng": 76.906
    },
    {
      "ward": 9,
      "area": "Rupangudi Road / Swamy Hotel / Sreerampura Colony / Compost",
      "lat": 15.123,
      "lng": 76.927
    },
    {
      "ward": 9,
      "area": "Ganesh Gudi Road / Gaganpa Jen Road / Kalyal Masjid Road / Gade Kelagi / Compost",
      "lat": 15.126,
      "lng": 76.925
    }
  ]
};

const DEFAULT_START_TIME = '07:00'; // assumption — no start time in the source data

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Seeding garbage-truck fleet with real route stops...');

  let created = 0, updated = 0, skipped = 0;

  for (const row of RAW_FLEET) {
    const wardsServed = (row.ward || '')
      .split(',')
      .map(w => w.trim())
      .filter(Boolean)
      .map(Number)
      .filter(n => Number.isFinite(n));

    const routeStops = ROUTE_STOPS[row.vehicle_no] || [];

    if (!wardsServed.length || !routeStops.length) {
      console.warn(`Skipping ${row.vehicle_no} — no ward or no route stops available`);
      skipped++;
      continue;
    }

    const firstStop = routeStops[0];

    const doc = {
      name: `${row.vehicle_type} - ${row.vehicle_no}`,
      type: 'garbage-truck',
      status: 'available',
      capacity: parseFloat(row.capacity) || 0,
      currentLoad: 0,
      location: { lat: firstStop.lat, lng: firstStop.lng, area: firstStop.area },
      driverName: row.driver || undefined,
      driverMobile: row.mobile || undefined,
      vehicleNo: row.vehicle_no,
      vehicleModel: row.vehicle_type,
      wetDrySegregation: row.wet_dry === 'Yes',
      division: row.division,
      wardsServed,
      routeStops,
      dailyStartTime: DEFAULT_START_TIME
    };

    const result = await Resource.findOneAndUpdate(
      { vehicleNo: row.vehicle_no, type: 'garbage-truck' },
      doc,
      { upsert: true, new: true, rawResult: true }
    );

    if (result.lastErrorObject?.updatedExisting) updated++;
    else created++;
  }

  console.log(`Done. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});