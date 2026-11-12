/**
 * Seeds the GovtOffice collection directly from verified data — no geojson
 * file needed at runtime. SEED_DATA below holds all 45 offices, now WITH
 * coordinates: 26 exact (Google Plus Code / business listing,
 * coordinatesVerified: true) and 19 address-based approximations flagged
 * coordinatesVerified: false — still real enough to place on a map, just
 * not confirmed to the same precision. Don't upgrade the flag without
 * actually re-verifying that office.
 *
 *   node scripts/importGovtOfficesData.js            # add / update
 *   node scripts/importGovtOfficesData.js --reset    # wipe the collection first
 *
 * Re-running is safe: records are upserted on slug.
 */
require('dotenv').config();
const mongoose    = require('mongoose');
const GovtOffice  = require('../models/GovtOffice');

const SEED_DATA = [
  {
    slug: "deputy-commissioner-office-ballari",
    name: "Deputy Commissioner Office Ballari",
    category: "district_administration",
    type: "District administration",
    address: "Station Road, BSNL Colony, Cowl Bazaar, Ballari 583101",
    phone: "+918392277100",
    placeId: "ChIJAWNb0GYRtzsRYh7Kenfs-hU",
    location: {
      lat: 15.145,
      lng: 76.9255
    },
    locationVerified: true,
    phoneVerified: true,
    coordinatesVerified: false,
    coordinateSource: "Address-based approximation; needs map verification"
  },
  {
    slug: "ballari-city-corporation-office",
    name: "Ballari City Corporation Office",
    category: "municipal_government",
    type: "Municipal corporation",
    address: "Corporation Office, Bangalore Road, near Sri Durga Bakery, Cowl Bazaar, Ballari 583101",
    phone: "+919902373903",
    placeId: "ChIJHSfTWmYRtzsRTyZxFr_Mo6c",
    location: {
      lat: 15.1451,
      lng: 76.9276
    },
    locationVerified: true,
    phoneVerified: true,
    coordinatesVerified: false,
    coordinateSource: "Address-based approximation; needs map verification"
  },
  {
    slug: "ballari-city-corporation-zonal-office-1",
    name: "Ballari City Corporation Zonal Office 1",
    category: "municipal_government",
    type: "Zonal office",
    address: "LIG 255, KHB Colony, Moka Road, Ballari 583103",
    phone: null,
    placeId: "ChIJb-IkotcRtzsRjsg2ibsOLEU",
    location: {
      lat: 15.1579125,
      lng: 76.9442969
    },
    locationVerified: true,
    phoneVerified: false,
    coordinatesVerified: true,
    coordinateSource: "Google Maps Plus Code / web business result"
  },
  {
    slug: "ballari-city-corporation-zone-2",
    name: "Ballari City Corporation Zone-2",
    category: "municipal_government",
    type: "Zonal office",
    address: "BSNL Colony, Cowl Bazaar, Ballari 583101",
    phone: null,
    placeId: "ChIJlbIUeAARtzsRpAbUwM5rruw",
    location: {
      lat: 15.1441125,
      lng: 76.9275469
    },
    locationVerified: true,
    phoneVerified: false,
    coordinatesVerified: true,
    coordinateSource: "Google Maps Plus Code / web business result"
  },
  {
    slug: "thasildar-office",
    name: "Thasildar Office",
    category: "revenue",
    type: "Taluk revenue office",
    address: "Station Road, BSNL Colony, Cowl Bazaar, Ballari 583101",
    phone: null,
    placeId: "ChIJ3cI-lWYRtzsREPmDYl9dK8w",
    location: {
      lat: 15.1446375,
      lng: 76.9254531
    },
    locationVerified: true,
    phoneVerified: false,
    coordinatesVerified: true,
    coordinateSource: "Google Maps Plus Code / web business result"
  },
  {
    slug: "taluka-magistrate-office",
    name: "Taluka Magistrate Office",
    category: "revenue",
    type: "Taluka magistrate office",
    address: "Railway Station Approach Road, BSNL Colony, Cowl Bazaar, Ballari 583101",
    phone: "+918328646668",
    placeId: "ChIJF1fNlWYRtzsRiM8_uFOGP2k",
    location: {
      lat: 15.1447,
      lng: 76.9257
    },
    locationVerified: true,
    phoneVerified: true,
    coordinatesVerified: false,
    coordinateSource: "Address-based approximation; needs map verification"
  },
  {
    slug: "district-sub-registrar-office",
    name: "District Sub Registrar Office",
    category: "registration",
    type: "Sub-registrar office",
    address: "126, Station Road, BSNL Colony, Cowl Bazaar, Ballari 583101",
    phone: "+918392273588",
    placeId: "ChIJLUuXPWERtzsRHFdunShVYWM",
    location: {
      lat: 15.14388,
      lng: 76.9258
    },
    locationVerified: true,
    phoneVerified: true,
    coordinatesVerified: false,
    coordinateSource: "Address-based approximation; needs map verification"
  },
  {
    slug: "district-treasury-office-ballari",
    name: "District Treasury Office, Ballari",
    category: "treasury",
    type: "District treasury",
    address: "Jonnagadla Compound, New Bus Stand Road, BSNL Colony, Cowl Bazaar, Ballari 583101",
    phone: "+918392277412",
    placeId: "ChIJ-XSS0GARtzsR10DFDRdzd80",
    location: {
      lat: 15.1443,
      lng: 76.9215
    },
    locationVerified: true,
    phoneVerified: true,
    coordinatesVerified: false,
    coordinateSource: "Address-based approximation; needs map verification"
  },
  {
    slug: "district-industries-centre",
    name: "District Industries Centre",
    category: "industries",
    type: "District industries office",
    address: "Hospet Road, Narayanappa Compound, Fort, Ballari 583102",
    phone: "+918392242370",
    placeId: "ChIJA2juQ94TtzsRD-_F8zpGWXc",
    location: {
      lat: 15.1414875,
      lng: 76.9141719
    },
    locationVerified: true,
    phoneVerified: true,
    coordinatesVerified: true,
    coordinateSource: "Google Maps Plus Code / web business result"
  },
  {
    slug: "district-employment-exchange-ballari",
    name: "District Employment Exchange, Ballari",
    category: "employment",
    type: "Employment exchange",
    address: "Taluk Office Compound, Station Road, Ballari 583101",
    phone: "+918392273988",
    placeId: "ChIJi3x8mGYRtzsRdIvJnloOYTc",
    location: {
      lat: 15.1447,
      lng: 76.9255
    },
    locationVerified: true,
    phoneVerified: true,
    coordinatesVerified: false,
    coordinateSource: "Address-based approximation; needs map verification"
  },
  {
    slug: "district-health-office",
    name: "District Health Office",
    category: "health",
    type: "District health office",
    address: "Satya Narayana Pete, Ballari 583101",
    phone: "+918392276250",
    placeId: "ChIJYUU6FmkRtzsR33dZZ_9BgrI",
    location: {
      lat: 15.1448875,
      lng: 76.9335469
    },
    locationVerified: true,
    phoneVerified: true,
    coordinatesVerified: true,
    coordinateSource: "Google Maps Plus Code / web business result"
  },
  {
    slug: "ddpi-office-ballari",
    name: "DDPI Office Ballari",
    category: "education_government",
    type: "Deputy Director of Public Instruction",
    address: "Fort, beside Income Tax Office, Narayanappa Compound, Ballari 583104",
    phone: "+918392268239",
    placeId: "ChIJ93I1JdkTtzsRRLDoituXT8k",
    location: {
      lat: 15.1462125,
      lng: 76.9145781
    },
    locationVerified: true,
    phoneVerified: true,
    coordinatesVerified: true,
    coordinateSource: "Google Maps Plus Code / web business result"
  },
  {
    slug: "beo-office-ballari",
    name: "BEO Office, Ballari",
    category: "education_government",
    type: "Block Education Office",
    address: "Narayanappa Compound, Fort, Ballari 583104",
    phone: "+918392266013",
    placeId: "ChIJH5raKtkTtzsR83Zf8C_utaE",
    location: {
      lat: 15.1466375,
      lng: 76.9146406
    },
    locationVerified: true,
    phoneVerified: true,
    coordinatesVerified: true,
    coordinateSource: "Google Maps Plus Code / web business result"
  },
  {
    slug: "social-welfare-office-ambedkar-bhavan",
    name: "Social Welfare Office (Ambedkar Bhavan)",
    category: "social_welfare",
    type: "Social welfare office",
    address: "Hospet Road, Devi Nagar, Ballari 583104",
    phone: null,
    placeId: "ChIJa2Sf5dwTtzsR8MMzadljl3w",
    location: {
      lat: 15.1427875,
      lng: 76.9086719
    },
    locationVerified: true,
    phoneVerified: false,
    coordinatesVerified: true,
    coordinateSource: "Google Maps Plus Code / web business result"
  },
  {
    slug: "district-social-welfare-office",
    name: "District Social Welfare Office",
    category: "social_welfare",
    type: "District social welfare office",
    address: "Narayanappa Compound, Fort, Ballari 583104",
    phone: "+918392267932",
    placeId: "ChIJ8_8p0t4TtzsRgz8ARNSQkoU",
    location: {
      lat: 15.1450125,
      lng: 76.9148281
    },
    locationVerified: true,
    phoneVerified: true,
    coordinatesVerified: true,
    coordinateSource: "Google Maps Plus Code / web business result"
  },
  {
    slug: "deputy-director-women-and-child-development",
    name: "Deputy Director Women and Child Development",
    category: "women_child",
    type: "Women and child development",
    address: "Infantry Road, Ashok Nagar, opposite Devi Nagar, Ballari 583103",
    phone: "+918392266219",
    placeId: "ChIJayCeaX0RtzsRzOh4Y1JLL8M",
    location: {
      lat: 15.1543875,
      lng: 76.9165469
    },
    locationVerified: true,
    phoneVerified: true,
    coordinatesVerified: true,
    coordinateSource: "Google Maps Plus Code / web business result"
  },
  {
    slug: "joint-director-of-agriculture-ballari",
    name: "Joint Director of Agriculture Ballari",
    category: "agriculture",
    type: "Agriculture department",
    address: "Railway Station Area, 20, BSNL Colony, Cowl Bazaar, Ballari 583101",
    phone: null,
    placeId: "ChIJJaSdXOcRtzsRrKaSQjoLwRY",
    location: {
      lat: 15.144,
      lng: 76.922
    },
    locationVerified: true,
    phoneVerified: false,
    coordinatesVerified: false,
    coordinateSource: "Address-based approximation; needs map verification"
  },
  {
    slug: "krushi-kendra-ballari",
    name: "Krushi Kendra Ballari",
    category: "agriculture",
    type: "Agriculture district office",
    address: "BSNL Colony, Cowl Bazaar, Ballari 583101",
    phone: null,
    placeId: "ChIJc_xSwKsRtzsRb2Fldf3BspE",
    location: {
      lat: 15.1447625,
      lng: 76.9263594
    },
    locationVerified: true,
    phoneVerified: false,
    coordinatesVerified: true,
    coordinateSource: "Google Maps Plus Code / web business result"
  },
  {
    slug: "deputy-conservator-of-forest-ballari",
    name: "Deputy Conservator of Forest, Ballari",
    category: "forest",
    type: "Forest department",
    address: "Old Trunk Road, Radio Park Cowl Bazar, Cantonment, Ballari 583104",
    phone: null,
    placeId: "ChIJB8QPm8MTtzsR1HUc3HG0Ug0",
    location: {
      lat: 15.1478,
      lng: 76.8989
    },
    locationVerified: true,
    phoneVerified: false,
    coordinatesVerified: false,
    coordinateSource: "Address-based approximation; needs map verification"
  },
  {
    slug: "working-plan-and-forest-survey-office",
    name: "Working Plan and Forest Survey Office",
    category: "forest",
    type: "Forest survey office",
    address: "Aishwarya Colony, Cantonment, Ballari 583104",
    phone: null,
    placeId: "ChIJaVuMGX0TtzsRH2yPz40UGmU",
    location: {
      lat: 15.1451375,
      lng: 76.9018906
    },
    locationVerified: true,
    phoneVerified: false,
    coordinatesVerified: true,
    coordinateSource: "Google Maps Plus Code / web business result"
  },
  {
    slug: "department-of-mines-and-geology-khanija-bhavana",
    name: "Department of Mines and Geology, Khanija Bhavana",
    category: "mines_geology",
    type: "Mines and geology office",
    address: "Devi Nagar, Ballari 583104",
    phone: null,
    placeId: "ChIJ0fkqSQATtzsR95qHG5f6wW4",
    location: {
      lat: 15.1458625,
      lng: 76.9049531
    },
    locationVerified: true,
    phoneVerified: false,
    coordinatesVerified: true,
    coordinateSource: "Google Maps Plus Code / web business result"
  },
  {
    slug: "directorate-general-of-mines-safety",
    name: "Directorate General of Mines Safety",
    category: "mines_safety",
    type: "Central government mines safety office",
    address: "Tilak Nagar, Cantonment, Ballari 583104",
    phone: "+913262221015",
    placeId: "ChIJA8WhrsgTtzsRjuUMq8REvaI",
    location: {
      lat: 15.1447375,
      lng: 76.8935781
    },
    locationVerified: true,
    phoneVerified: true,
    coordinatesVerified: true,
    coordinateSource: "Google Maps Plus Code / web business result"
  },
  {
    slug: "karnataka-state-pollution-control-board",
    name: "Karnataka State Pollution Control Board",
    category: "environment",
    type: "Pollution control board office",
    address: "4th Cross Road, Kuvempu Nagar, Ballari 583104",
    phone: "+918392240514",
    placeId: "ChIJ7yhiV7ATtzsRLNRkWCz1E44",
    location: {
      lat: 15.1513875,
      lng: 76.8863281
    },
    locationVerified: true,
    phoneVerified: true,
    coordinatesVerified: true,
    coordinateSource: "Google Maps Plus Code / web business result"
  },
  {
    slug: "pwd-sub-division-office",
    name: "PWD Sub Division Office",
    category: "public_works",
    type: "Public Works Department",
    address: "Bijapur Colony, Narayanappa Compound, Fort, Ballari 583104",
    phone: null,
    placeId: "ChIJ98h7qNkTtzsRpHv8wugncog",
    location: {
      lat: 15.1415,
      lng: 76.9144
    },
    locationVerified: true,
    phoneVerified: false,
    coordinatesVerified: false,
    coordinateSource: "Address-based approximation; needs map verification"
  },
  {
    slug: "karnataka-power-transmission-corporation-ltd",
    name: "Karnataka Power Transmission Corporation Ltd.",
    category: "power",
    type: "KPTCL office",
    address: "Near APMC, Bangalore Road, Ballari 583101",
    phone: null,
    placeId: "ChIJd4PnjFgRtzsRt2jtIH7YOVI",
    location: {
      lat: 15.1317375,
      lng: 76.9194844
    },
    locationVerified: true,
    phoneVerified: false,
    coordinatesVerified: true,
    coordinateSource: "Google Maps Plus Code / web business result"
  },
  {
    slug: "food-corporation-of-india",
    name: "Food Corporation of India",
    category: "central_government",
    type: "Food Corporation of India",
    address: "Allipura, Ballari 583104",
    phone: "+918392240047",
    placeId: "ChIJ85os1vsStzsRN7J2Iqqw_Ls",
    location: {
      lat: 15.1677625,
      lng: 76.8662969
    },
    locationVerified: true,
    phoneVerified: true,
    coordinatesVerified: true,
    coordinateSource: "Google Maps Plus Code / web business result"
  },
  {
    slug: "government-of-karnataka-information-public-relations-office",
    name: "Government of Karnataka Information & Public Relations Office",
    category: "information_public_relations",
    type: "Information and Public Relations office",
    address: "Jonnagadla Compound, New Bus Stand Road, BSNL Colony, Cowl Bazaar, Ballari 583101",
    phone: "+918392268810",
    placeId: "ChIJI5lxKWcRtzsRZ2sNFnGn6Fg",
    location: {
      lat: 15.1443,
      lng: 76.9215
    },
    locationVerified: true,
    phoneVerified: true,
    coordinatesVerified: false,
    coordinateSource: "Address-based approximation; needs map verification"
  },
  {
    slug: "karnataka-government-insurance-department-kgid",
    name: "Karnataka Government Insurance Department (KGID)",
    category: "insurance",
    type: "Government insurance office",
    address: "DC Office Compound, BSNL Colony, Cowl Bazaar, Ballari 583101",
    phone: null,
    placeId: "ChIJDVFFZAARtzsRYqwRz-H8b5A",
    location: {
      lat: 15.145,
      lng: 76.9255
    },
    locationVerified: true,
    phoneVerified: false,
    coordinatesVerified: false,
    coordinateSource: "Address-based approximation; needs map verification"
  },
  {
    slug: "esic-office-bellary",
    name: "ESIC Office Bellary",
    category: "labour_social_security",
    type: "Employees' State Insurance office",
    address: "Vijayanagar Colony, Cantonment, Ballari 583102",
    phone: null,
    placeId: "ChIJk7cQtnMTtzsRdld8r7morAE",
    location: {
      lat: 15.1402625,
      lng: 76.8977344
    },
    locationVerified: true,
    phoneVerified: false,
    coordinatesVerified: true,
    coordinateSource: "Google Maps Plus Code / web business result"
  },
  {
    slug: "regional-labour-commissioner-central-ballari",
    name: "Regional Labour Commissioner (Central), Ballari",
    category: "labour",
    type: "Central labour office",
    address: "BUDA Building, opposite Mothi Circle, Cowl Bazaar, Ballari 583102",
    phone: null,
    placeId: "ChIJAbT2PtoRtzsRY88JcWv1xG0",
    location: {
      lat: 15.143,
      lng: 76.921
    },
    locationVerified: true,
    phoneVerified: false,
    coordinatesVerified: false,
    coordinateSource: "Address-based approximation; needs map verification"
  },
  {
    slug: "district-labour-office",
    name: "District Labour Office",
    category: "labour",
    type: "Labour department",
    address: "Ballari, Karnataka 583101",
    phone: "+918392254895",
    placeId: null,
    location: {
      lat: 15.143,
      lng: 76.921
    },
    locationVerified: true,
    phoneVerified: true,
    coordinatesVerified: false,
    coordinateSource: "Address-based approximation; needs map verification"
  },
  {
    slug: "district-librarian-office",
    name: "District Librarian Office",
    category: "library",
    type: "District library administration",
    address: "Ballari, Karnataka 583101",
    phone: "+918392276887",
    placeId: null,
    location: {
      lat: 15.1446,
      lng: 76.9173
    },
    locationVerified: true,
    phoneVerified: true,
    coordinatesVerified: false,
    coordinateSource: "Address-based approximation; needs map verification"
  },
  {
    slug: "city-central-library",
    name: "City Central Library",
    category: "library",
    type: "City central library",
    address: "Ballari, Karnataka 583101",
    phone: "+918392274113",
    placeId: null,
    location: {
      lat: 15.1428125,
      lng: 76.8999219
    },
    locationVerified: true,
    phoneVerified: true,
    coordinatesVerified: true,
    coordinateSource: "Google Maps Plus Code / web business result"
  },
  {
    slug: "karnataka-state-financial-corporation-ksfc",
    name: "Karnataka State Financial Corporation (KSFC)",
    category: "finance",
    type: "State financial corporation",
    address: "Ballari, Karnataka 583101",
    phone: "+918392242105",
    placeId: null,
    location: {
      lat: 15.1414375,
      lng: 76.9147031
    },
    locationVerified: true,
    phoneVerified: true,
    coordinatesVerified: true,
    coordinateSource: "Google Maps Plus Code / web business result"
  },
  {
    slug: "karnataka-housing-board",
    name: "Karnataka Housing Board",
    category: "housing",
    type: "Housing board office",
    address: "Ballari, Karnataka 583101",
    phone: "+918392274517",
    placeId: null,
    location: {
      lat: 15.145,
      lng: 76.927
    },
    locationVerified: true,
    phoneVerified: true,
    coordinatesVerified: false,
    coordinateSource: "Address-based approximation; needs map verification"
  },
  {
    slug: "kridl-ballari",
    name: "KRIDL Ballari",
    category: "infrastructure",
    type: "Karnataka Rural Infrastructure Development office",
    address: "Ballari, Karnataka 583101",
    phone: "+918392240794",
    placeId: null,
    location: {
      lat: 15.1415,
      lng: 76.9144
    },
    locationVerified: true,
    phoneVerified: true,
    coordinatesVerified: false,
    coordinateSource: "Address-based approximation; needs map verification"
  },
  {
    slug: "district-registrar",
    name: "District Registrar",
    category: "registration",
    type: "District registrar office",
    address: "Ballari, Karnataka 583101",
    phone: "+918392273588",
    placeId: null,
    location: {
      lat: 15.1445,
      lng: 76.9255
    },
    locationVerified: true,
    phoneVerified: true,
    coordinatesVerified: false,
    coordinateSource: "Address-based approximation; needs map verification"
  },
  {
    slug: "wakf-board-office",
    name: "Wakf Board Office",
    category: "minority_welfare",
    type: "Wakf Board office",
    address: "Nallacheruvu, Cowl Bazaar, Ballari 583102",
    phone: null,
    placeId: "ChIJNXHBSeMTtzsRNnbBK8gXDNs",
    location: {
      lat: 15.1404125,
      lng: 76.9100781
    },
    locationVerified: true,
    phoneVerified: false,
    coordinatesVerified: true,
    coordinateSource: "Google Maps Plus Code / web business result"
  },
  {
    slug: "e-seva-kendra-district-court-complex-ballari",
    name: "e-Seva Kendra District Court Complex Ballari",
    category: "courts",
    type: "Court citizen service centre",
    address: "Court Road, Satya Narayana Pet, Ballari 583101",
    phone: null,
    placeId: "ChIJBf29e28RtzsRa8zFE2Rj_Dg",
    location: {
      lat: 15.1490166,
      lng: 76.9301034
    },
    locationVerified: true,
    phoneVerified: false,
    coordinatesVerified: true,
    coordinateSource: "Google Maps Plus Code / web business result"
  },
  {
    slug: "district-police-station",
    name: "District Police Station",
    category: "police",
    type: "District police office/station",
    address: "Durgamma Temple Road, Ballari 583103",
    phone: null,
    placeId: "ChIJb3otQ2URtzsRU1Mw3ddKq2E",
    location: {
      lat: 15.1505625,
      lng: 76.9291094
    },
    locationVerified: true,
    phoneVerified: false,
    coordinatesVerified: true,
    coordinateSource: "Google Maps Plus Code / web business result"
  },
  {
    slug: "rural-police-station-ballari",
    name: "Rural Police Station Ballari",
    category: "police",
    type: "Police station",
    address: "Railway Station Approach Road, near Taluk Office, BSNL Colony, Cowl Bazaar, Ballari 583101",
    phone: "+918392276461",
    placeId: "ChIJv0mtwGYRtzsRcXSS1XajHTo",
    location: {
      lat: 15.1447,
      lng: 76.9255
    },
    locationVerified: true,
    phoneVerified: true,
    coordinatesVerified: false,
    coordinateSource: "Address-based approximation; needs map verification"
  },
  {
    slug: "gandhi-nagar-police-station",
    name: "Gandhi Nagar Police Station",
    category: "police",
    type: "Police station",
    address: "Dr RajKumar Road, Satya Narayana Pet, Ballari 583101",
    phone: "+918392272192",
    placeId: "ChIJcSZvvGgRtzsRm3PVO8gWYZc",
    location: {
      lat: 15.1452125,
      lng: 76.9307969
    },
    locationVerified: true,
    phoneVerified: true,
    coordinatesVerified: true,
    coordinateSource: "Google Maps Plus Code / web business result"
  },
  {
    slug: "inspector-general-of-police-ballari-range",
    name: "Inspector General of Police, Ballari Range",
    category: "police",
    type: "Police range office",
    address: "Durgamma Temple, KHB Colony, Ballari 583103",
    phone: null,
    placeId: "ChIJzwa1ZwARtzsRX7cMPwWzl7g",
    location: {
      lat: 15.1506,
      lng: 76.9291
    },
    locationVerified: true,
    phoneVerified: false,
    coordinatesVerified: false,
    coordinateSource: "Address-based approximation; needs map verification"
  },
  {
    slug: "rto-office-ballari",
    name: "RTO Office Ballari",
    category: "transport",
    type: "Regional Transport Office",
    address: "Bellary-Hospet Road, Cantonment, Ballari 583104",
    phone: "+918392240048",
    placeId: "ChIJny85XsYTtzsR1tfPZWwW2KE",
    location: {
      lat: 15.1475125,
      lng: 76.8993594
    },
    locationVerified: true,
    phoneVerified: true,
    coordinatesVerified: true,
    coordinateSource: "Google Maps Plus Code / web business result"
  },
  {
    slug: "taluka-panchayat-ballary",
    name: "Taluka Panchayat Ballary",
    category: "local_government",
    type: "Taluka Panchayat",
    address: "Fort Main Road, Narayanappa Compound, Fort, Ballari 583104",
    phone: null,
    placeId: "ChIJW6-sRd8TtzsR2MYcX0qfgR4",
    location: {
      lat: 15.1446125,
      lng: 76.9172969
    },
    locationVerified: true,
    phoneVerified: false,
    coordinatesVerified: true,
    coordinateSource: "Google Maps Plus Code / web business result"
  }
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  if (process.argv.includes('--reset')) {
    const { deletedCount } = await GovtOffice.deleteMany({});
    console.log(`Reset: removed ${deletedCount} offices`);
  }

  let created = 0, updated = 0;

  for (const doc of SEED_DATA) {
    const res = await GovtOffice.updateOne(
      { slug: doc.slug },
      { $set: doc },
      { upsert: true }
    );
    if (res.upsertedCount) created++; else if (res.modifiedCount) updated++;
  }

  const total = await GovtOffice.countDocuments();
  console.log(`\ncreated ${created}, updated ${updated}, total in DB ${total}`);

  const byCat = await GovtOffice.aggregate([
    { $group: { _id: '$category', n: { $sum: 1 } } }, { $sort: { n: -1 } }
  ]);
  console.log('\nby category:');
  byCat.forEach(r => console.log(`  ${String(r.n).padStart(4)}  ${r._id}`));

  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });