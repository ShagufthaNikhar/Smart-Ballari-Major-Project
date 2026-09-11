// Single combined seed for the full emergency-services directory:
// hospitals, police, fire, ambulance (Responder collection) AND
// pharmacies (Pharmacy collection — separate on purpose, see below).
//
// Replaces: importResponders.js + seedEmergencyResponders.js + any
// separate pharmacy seed you may have had. Run this one script instead.
//
// ── RESPONDER SOURCES ─────────────────────────────────────────────
//   - Ballari OpenStreetMap export: 49 hospitals, 6 police, 1 fire station
//     (phone is the real number if OSM had one, otherwise the correct
//     national emergency line: 112 unified / 108 ambulance / 101 fire)
//   - ballari_ambulance_fire_services_with_numbers.geojson: 11 ambulance
//     companies + 10 more fire-related entries, most with real numbers
//   DEDUPED: OSM's generic "Ballari Fire Station" (phone: 101) and the
//   other file's "Fire Station - Infantry Road / Housing Board Colony"
//   (phone: 08392266001) sit ~50m apart — the same building. Kept the
//   one with a real number.
//
// ── PHARMACIES ARE DELIBERATELY A SEPARATE COLLECTION ──────────────
// Not Responder documents. A pharmacy is never dispatched, never has a
// currentLoad/capacity, and nobody "confirms" one is en route — it just
// sits there. It exists purely for the low-severity-medical suggestion
// in routes/emergency.js's findPharmacies(). Combining the SEED SCRIPT
// is just convenience; the DATA stays split because the two things mean
// different things.
//
// LICENCE: hospital/police/1-fire records are OpenStreetMap data (ODbL) —
// "© OpenStreetMap contributors" must be shown wherever displayed.
//
// Run with:  node scripts/seedAllResponders.js
// Safe to re-run: everything upserts, nothing is ever duplicated.

require('dotenv').config();
const mongoose  = require('mongoose');
const Responder = require('../models/Responder');
const Pharmacy  = require('../models/Pharmacy');

const RESPONDER_ROWS = [
  {
    "name": "Sudha Cross Police Station",
    "type": "police",
    "category": null,
    "phone": "112",
    "address": "Ballari",
    "lat": 15.151467,
    "lng": 76.900829,
    "capacity": 12
  },
  {
    "name": "Bellary Rural Police Station",
    "type": "police",
    "category": null,
    "phone": "112",
    "address": "Ballari",
    "lat": 15.144562,
    "lng": 76.925315,
    "capacity": 12
  },
  {
    "name": "Police Station",
    "type": "police",
    "category": null,
    "phone": "91-8392-272022",
    "address": "Brucepettah",
    "lat": 15.138093,
    "lng": 76.925086,
    "capacity": 12
  },
  {
    "name": "Dwaraka Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "D No. 38/Xviii, B. M. A. / Noka Road, Gandhi Nagar",
    "lat": 15.154447,
    "lng": 76.941134,
    "capacity": 30
  },
  {
    "name": "M S R Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "S N Pet Main Road",
    "lat": 15.150698,
    "lng": 76.936735,
    "capacity": 30
  },
  {
    "name": "Cs Multispeciality Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "1 St Cross Gandhi Nagar",
    "lat": 15.152399,
    "lng": 76.934693,
    "capacity": 30
  },
  {
    "name": "Sanjeevini Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Kappagal Road",
    "lat": 15.154157,
    "lng": 76.930876,
    "capacity": 30
  },
  {
    "name": "Venkat Kamineni Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Hospital Road,Radio Park Railway Road,Contonment",
    "lat": 15.144307,
    "lng": 76.906795,
    "capacity": 30
  },
  {
    "name": "St Mary's Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "O P D Road Cantonment",
    "lat": 15.154182,
    "lng": 76.900873,
    "capacity": 30
  },
  {
    "name": "Aparna Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Opp Opd Bus Stand Behind Ahaar Hotel, Contonment",
    "lat": 15.155344,
    "lng": 76.90022,
    "capacity": 30
  },
  {
    "name": "Dr. S. K. Panduranga Rao Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "3Road Cross, Satyanarayana Pet",
    "lat": 15.148969,
    "lng": 76.935904,
    "capacity": 30
  },
  {
    "name": "Sree Thirumala Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "OppositeMaddikere Bheemaiah School, Sontha Linganna Colony, Gandhi Nagar",
    "lat": 15.158788,
    "lng": 76.937816,
    "capacity": 30
  },
  {
    "name": "Sri Danamma Super Speciality Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Opp; Old Bus Stand, Royal Circle",
    "lat": 15.145481,
    "lng": 76.929298,
    "capacity": 30
  },
  {
    "name": "R K Hospital, Ballari",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Satyanarayana Pet Main Road",
    "lat": 15.148685,
    "lng": 76.935242,
    "capacity": 30
  },
  {
    "name": "Adarsh Heart Care Centre Pvt Ltd",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Opposite Old K.S.R.T.C. Bus Stand, Ward No.16, Sangeetha Complex, Behind Shyamala Lodge, Kolachalam Compound",
    "lat": 15.146461,
    "lng": 76.928824,
    "capacity": 30
  },
  {
    "name": "Vijay Nagaraj Super Speciality Eye Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Zam Zam Plaza, Sudha Cross, Cantonment",
    "lat": 15.154256,
    "lng": 76.899938,
    "capacity": 30
  },
  {
    "name": "Ufwc Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Near Radio Park, Ward No 25 Near Radio Park",
    "lat": 15.141045,
    "lng": 76.901602,
    "capacity": 30
  },
  {
    "name": "Vijaynagar Institute Of Medical Science Hospital, Ballari",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Opd Compound, Ballari, Medical College",
    "lat": 15.155818,
    "lng": 76.898437,
    "capacity": 30
  },
  {
    "name": "Asha Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Housing Board Colony, Cantonment, Ballari",
    "lat": 15.154727,
    "lng": 76.899461,
    "capacity": 30
  },
  {
    "name": "Janani Hospital and Fetal Medical Centre",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Sri Durga Tower, Kappagal Road, Ballari",
    "lat": 15.153352,
    "lng": 76.930918,
    "capacity": 30
  },
  {
    "name": "A R Gastro and Liver Centre",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Ballari",
    "lat": 15.154511,
    "lng": 76.928625,
    "capacity": 30
  },
  {
    "name": "Arunodaya Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Bhuvanagiri Colony, Ashok Nagar, Ballari",
    "lat": 15.159851,
    "lng": 76.91566,
    "capacity": 30
  },
  {
    "name": "K S M Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Parvathi Nagar, Ballari",
    "lat": 15.153661,
    "lng": 76.927232,
    "capacity": 30
  },
  {
    "name": "Navodaya Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Adjacent to Railway underpass, Nallacheruvu Ballari",
    "lat": 15.139797,
    "lng": 76.917719,
    "capacity": 30
  },
  {
    "name": "Sai City Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "KHB Colony, Gandhi Nagar, Ballari",
    "lat": 15.152424,
    "lng": 76.934889,
    "capacity": 30
  },
  {
    "name": "Usha Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Jawans Road, Cowl Bazaar, Ballari",
    "lat": 15.137439,
    "lng": 76.902446,
    "capacity": 30
  },
  {
    "name": "Kulkarni Eye Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "KHB Colony, Sidiginamola, Ballari",
    "lat": 15.154359,
    "lng": 76.934942,
    "capacity": 30
  },
  {
    "name": "Government Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Talur Road, Parvathi Nagar, Ballari",
    "lat": 15.153273,
    "lng": 76.925272,
    "capacity": 30
  },
  {
    "name": "Shashidar Reddy Children Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Bhagath Singh Nagar, Gandhi Nagar, Ballari",
    "lat": 15.155353,
    "lng": 76.930702,
    "capacity": 30
  },
  {
    "name": "Dr. Vijay Nagraj Eye Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Housing Board Colony, Cantonment, Ballari",
    "lat": 15.154948,
    "lng": 76.900163,
    "capacity": 30
  },
  {
    "name": "Chiranjeevi Newborn and Child Health Centre",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Satya Narayana Pet, Ballari",
    "lat": 15.149046,
    "lng": 76.935449,
    "capacity": 30
  },
  {
    "name": "Ballari Hrudayal & Superspeciality Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Bhagath Singh Nagar, Gandhi Nagar, Ballari",
    "lat": 15.156479,
    "lng": 76.927909,
    "capacity": 30
  },
  {
    "name": "S. R. Multi Speciality Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Hospet Road, Cantonment, Ballari",
    "lat": 15.146718,
    "lng": 76.904147,
    "capacity": 30
  },
  {
    "name": "Shavi Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "KHB Colony, Tekur Compound, Gandhi Nagar, Ballari",
    "lat": 15.153405,
    "lng": 76.931718,
    "capacity": 30
  },
  {
    "name": "Ballari Neuro Centre",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Moka Road, KHB Colony, Tekur Compound, Gandhi Nagar, Ballari",
    "lat": 15.155882,
    "lng": 76.937255,
    "capacity": 30
  },
  {
    "name": "Sarvodaya Urocare and Pediatric Centre",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Parvathi Nagar, Ballari",
    "lat": 15.154513,
    "lng": 76.927743,
    "capacity": 30
  },
  {
    "name": "Gouse Women Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Bruce Pet, Old Katte Gudda, Cowl Bazaar, Ballari",
    "lat": 15.14425,
    "lng": 76.933,
    "capacity": 30
  },
  {
    "name": "Sunshine Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Ashok Nagar, Vidya Nagar, Ballari",
    "lat": 15.158188,
    "lng": 76.899856,
    "capacity": 30
  },
  {
    "name": "Sanjana Eye Diabetes Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "KHB Colony, Tekur Compound, Gandhi Nagar, Ballari",
    "lat": 15.155536,
    "lng": 76.93635,
    "capacity": 30
  },
  {
    "name": "Yashfeen Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Jawans Road, Cowl Bazaar, Ballari",
    "lat": 15.137543,
    "lng": 76.897941,
    "capacity": 30
  },
  {
    "name": "Pavan Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Talur Road, Ballari",
    "lat": 15.159182,
    "lng": 76.927086,
    "capacity": 30
  },
  {
    "name": "Mother's Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Cowl Bazaar, Ballari",
    "lat": 15.138911,
    "lng": 76.896572,
    "capacity": 30
  },
  {
    "name": "Indira Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Court Road, Satya Narayana Pet, Ballari",
    "lat": 15.14848,
    "lng": 76.929661,
    "capacity": 30
  },
  {
    "name": "BMC Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Siddartha Nagar, Devi Nagar, Ballari",
    "lat": 15.15129,
    "lng": 76.902384,
    "capacity": 30
  },
  {
    "name": "Ballari Hrudayalaya & Superspciality Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Near Bala Bharati, KHB Colony, Gandhi Nagar, Ballari, Karnataka",
    "lat": 15.154497,
    "lng": 76.93883,
    "capacity": 30
  },
  {
    "name": "Thyrocare Kolachalam Compound",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "1ST FLOOR NMG COMPLEX ,OPP OLD KSRTC BUSSTAND KOLACHALAM COMPOUND, Satya Narayana Pet, Ballari, Karnataka",
    "lat": 15.145839,
    "lng": 76.928944,
    "capacity": 30
  },
  {
    "name": "Taranath Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Ballari",
    "lat": 15.140714,
    "lng": 76.949342,
    "capacity": 30
  },
  {
    "name": "Nehru Colony Outpost",
    "type": "police",
    "category": null,
    "phone": "112",
    "address": "Nehru Colony 2nd Cross",
    "lat": 15.152605,
    "lng": 76.942708,
    "capacity": 12
  },
  {
    "name": "Government Maternity Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Ballari",
    "lat": 15.152343,
    "lng": 76.932334,
    "capacity": 30
  },
  {
    "name": "Dr Kulkarni Eye Hospital",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Gopal Swamy ( Moka) Road,Gandhinagar",
    "lat": 15.15436,
    "lng": 76.934968,
    "capacity": 30
  },
  {
    "name": "Wellesley Tuberculosis Hospital.",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Government Wellesley Tuberculosis Hospital, Ramanjaneya Nagar, Ballari, Karnataka",
    "lat": 15.141556,
    "lng": 76.890117,
    "capacity": 30
  },
  {
    "name": "FPAI",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Ballari",
    "lat": 15.138409,
    "lng": 76.918524,
    "capacity": 30
  },
  {
    "name": "Gandhi Nagar Police Station",
    "type": "police",
    "category": null,
    "phone": "112",
    "address": "Ballari",
    "lat": 15.14519,
    "lng": 76.930732,
    "capacity": 12
  },
  {
    "name": "DRP Parade Grounds",
    "type": "police",
    "category": null,
    "phone": "112",
    "address": "Ballari",
    "lat": 15.148903,
    "lng": 76.933999,
    "capacity": 12
  },
  {
    "name": "District Hospital, Ballari",
    "type": "hospital",
    "category": null,
    "phone": "108",
    "address": "Beside Municipal College, Ballari, District Hospital Compound",
    "lat": 15.144391,
    "lng": 76.934679,
    "capacity": 30
  },
  {
    "name": "GOPI HI-TECH AMBULANCE",
    "type": "ambulance",
    "category": null,
    "phone": "09483733333",
    "address": "Ballari, Karnataka",
    "lat": 15.153,
    "lng": 76.925,
    "capacity": 10
  },
  {
    "name": "Nusrath hi tech ambulance service - Ashok Nagar",
    "type": "ambulance",
    "category": null,
    "phone": "09901694838",
    "address": "Ballari, Karnataka",
    "lat": 15.158,
    "lng": 76.9,
    "capacity": 10
  },
  {
    "name": "Nusrath hi tech ambulance - Infantry Road",
    "type": "ambulance",
    "category": null,
    "phone": "09901694838",
    "address": "Ballari, Karnataka",
    "lat": 15.154,
    "lng": 76.912,
    "capacity": 10
  },
  {
    "name": "STAR ambulance ballary Karnataka",
    "type": "ambulance",
    "category": null,
    "phone": "09449002991",
    "address": "Ballari, Karnataka",
    "lat": 15.153,
    "lng": 76.897,
    "capacity": 10
  },
  {
    "name": "K K ambulance ballari",
    "type": "ambulance",
    "category": null,
    "phone": "09480363565",
    "address": "Ballari, Karnataka",
    "lat": 15.157,
    "lng": 76.933,
    "capacity": 10
  },
  {
    "name": "Global High-Tech Ambulance",
    "type": "ambulance",
    "category": null,
    "phone": "102",
    "address": "Ballari, Karnataka",
    "lat": 15.146,
    "lng": 76.948,
    "capacity": 10
  },
  {
    "name": "Khalid ambulance service",
    "type": "ambulance",
    "category": null,
    "phone": "08886157500",
    "address": "Ballari, Karnataka",
    "lat": 15.153,
    "lng": 76.897,
    "capacity": 10
  },
  {
    "name": "Taj Ambulance Service",
    "type": "ambulance",
    "category": null,
    "phone": "102",
    "address": "Ballari, Karnataka",
    "lat": 15.151,
    "lng": 76.901,
    "capacity": 10
  },
  {
    "name": "Bajarangi ambulance service",
    "type": "ambulance",
    "category": null,
    "phone": "09148761354",
    "address": "Ballari, Karnataka",
    "lat": 15.16,
    "lng": 76.91,
    "capacity": 10
  },
  {
    "name": "Thirumala HI-TECH Ambulance",
    "type": "ambulance",
    "category": null,
    "phone": "09108070551",
    "address": "Ballari, Karnataka",
    "lat": 15.144,
    "lng": 76.942,
    "capacity": 10
  },
  {
    "name": "NATIONA HI-TECH AMBULANCE SERVICE",
    "type": "ambulance",
    "category": null,
    "phone": "102",
    "address": "Ballari, Karnataka",
    "lat": 15.154,
    "lng": 76.912,
    "capacity": 10
  },
  {
    "name": "Fire Station - Infantry Road / Housing Board Colony",
    "type": "fire",
    "category": null,
    "phone": "08392266001",
    "address": "Ballari, Karnataka",
    "lat": 15.155,
    "lng": 76.913,
    "capacity": 10
  },
  {
    "name": "Fire engine Station office - Kurugodu",
    "type": "fire",
    "category": null,
    "phone": "08393263301",
    "address": "Ballari, Karnataka",
    "lat": 15.342,
    "lng": 76.848,
    "capacity": 10
  },
  {
    "name": "Sunshine Safety Solution",
    "type": "fire",
    "category": "fire_protection_service",
    "phone": "101",
    "address": "Ballari, Karnataka",
    "lat": 15.148,
    "lng": 76.919,
    "capacity": 10
  },
  {
    "name": "Harsha Fire Services",
    "type": "fire",
    "category": "fire_protection_equipment_supplier",
    "phone": "101",
    "address": "Ballari, Karnataka",
    "lat": 15.156,
    "lng": 76.938,
    "capacity": 10
  },
  {
    "name": "New Fire Services office - Kodalu",
    "type": "fire",
    "category": null,
    "phone": "101",
    "address": "Ballari, Karnataka",
    "lat": 15.167,
    "lng": 76.676,
    "capacity": 10
  },
  {
    "name": "Ajay Fire & Safety",
    "type": "fire",
    "category": "fire_protection_service",
    "phone": "101",
    "address": "Ballari, Karnataka",
    "lat": 15.154,
    "lng": 76.888,
    "capacity": 10
  },
  {
    "name": "Kargil Security Force",
    "type": "fire",
    "category": "security_service",
    "phone": "101",
    "address": "Ballari, Karnataka",
    "lat": 15.157,
    "lng": 76.928,
    "capacity": 10
  },
  {
    "name": "EMPIRE SAFETY AND FIRE SERVICES",
    "type": "fire",
    "category": "fire_protection_equipment_supplier",
    "phone": "101",
    "address": "Ballari, Karnataka",
    "lat": 15.131,
    "lng": 76.906,
    "capacity": 10
  },
  {
    "name": "Unique Fire Guards",
    "type": "fire",
    "category": "fire_protection_equipment_supplier",
    "phone": "09844759994",
    "address": "Ballari, Karnataka",
    "lat": 15.156,
    "lng": 76.937,
    "capacity": 10
  },
  {
    "name": "AP FIRE AND SAFETY SOLUTIONS",
    "type": "fire",
    "category": "fire_protection_equipment_supplier",
    "phone": "08818845622",
    "address": "Ballari, Karnataka",
    "lat": 15.157,
    "lng": 76.943,
    "capacity": 10
  }
];
const PHARMACY_ROWS  = [
  {
    "name": "Apollo Pharmacy",
    "brand": "Apollo Pharmacy",
    "address": null,
    "lat": 15.1436536,
    "lng": 76.9280523,
    "locationVerified": true,
    "coordinateSource": "SmartScraper public Bellary pharmacy sample, updated April 1 2026"
  },
  {
    "name": "Apolo Pharmacy",
    "brand": "Apollo Pharmacy",
    "address": null,
    "lat": 15.1393932,
    "lng": 76.9214428,
    "locationVerified": true,
    "coordinateSource": "SmartScraper public Bellary pharmacy sample, updated April 1 2026"
  },
  {
    "name": "Sanjay Medical",
    "brand": null,
    "address": null,
    "lat": 15.1517695,
    "lng": 76.9302462,
    "locationVerified": true,
    "coordinateSource": "SmartScraper public Bellary pharmacy sample, updated April 1 2026"
  },
  {
    "name": "Vandana Medical",
    "brand": null,
    "address": null,
    "lat": 15.1475327,
    "lng": 76.9287875,
    "locationVerified": true,
    "coordinateSource": "SmartScraper public Bellary pharmacy sample, updated April 1 2026"
  },
  {
    "name": "Shri Vijay Mahanteshwara Madicals",
    "brand": null,
    "address": null,
    "lat": 15.1371763,
    "lng": 76.9309326,
    "locationVerified": true,
    "coordinateSource": "SmartScraper public Bellary pharmacy sample, updated April 1 2026"
  },
  {
    "name": "SHREE VEERESHWARA KRUPA MEDICAL & GENERAL STORES",
    "brand": null,
    "address": null,
    "lat": 15.1376574,
    "lng": 76.9309312,
    "locationVerified": true,
    "coordinateSource": "SmartScraper public Bellary pharmacy sample, updated April 1 2026"
  },
  {
    "name": "Prashanth Medical Stores",
    "brand": null,
    "address": null,
    "lat": 15.1408601,
    "lng": 76.9252603,
    "locationVerified": true,
    "coordinateSource": "SmartScraper public Bellary pharmacy sample, updated April 1 2026"
  },
  {
    "name": "Jyothi Medical And General Stores",
    "brand": null,
    "address": null,
    "lat": 15.151081,
    "lng": 76.9373772,
    "locationVerified": true,
    "coordinateSource": "SmartScraper public Bellary pharmacy sample, updated April 1 2026"
  },
  {
    "name": "MedPlus Gandhi Nagar",
    "brand": "MedPlus",
    "address": null,
    "lat": 15.1537848,
    "lng": 76.9393932,
    "locationVerified": true,
    "coordinateSource": "SmartScraper public Bellary pharmacy sample, updated April 1 2026"
  },
  {
    "name": "Shree Ramdev Medical And General Store",
    "brand": null,
    "address": null,
    "lat": 15.1342352,
    "lng": 76.9222122,
    "locationVerified": true,
    "coordinateSource": "SmartScraper public Bellary pharmacy sample, updated April 1 2026"
  }
];

async function seedResponders() {
  let created = 0, updated = 0;
  const counts = {};

  for (const row of RESPONDER_ROWS) {
    const doc = {
      name: row.name,
      type: row.type,
      category: row.category || undefined,
      phone: row.phone,
      address: row.address,
      location: { lat: row.lat, lng: row.lng },
      capacity: row.capacity || 10,
      isActive: true
    };

    const result = await Responder.findOneAndUpdate(
      { name: row.name, type: row.type },
      doc,
      { upsert: true, new: true, rawResult: true }
    );

    if (result.lastErrorObject?.updatedExisting) updated++;
    else created++;
    counts[row.type] = (counts[row.type] || 0) + 1;
  }

  console.log(`Responders — Created: ${created}, Updated: ${updated}`);
  console.log('By type:');
  for (const [type, count] of Object.entries(counts)) {
    console.log(`  ${String(count).padStart(3)}  ${type}`);
  }
}

async function seedPharmacies() {
  let created = 0, updated = 0;

  for (const row of PHARMACY_ROWS) {
    const doc = {
      name: row.name,
      brand: row.brand || null,
      address: row.address || null,
      location: { lat: row.lat, lng: row.lng },
      locationVerified: row.locationVerified ?? false,
      coordinateSource: row.coordinateSource,
      isActive: true
    };

    const result = await Pharmacy.findOneAndUpdate(
      { name: row.name, 'location.lat': row.lat, 'location.lng': row.lng },
      doc,
      { upsert: true, new: true, rawResult: true }
    );

    if (result.lastErrorObject?.updatedExisting) updated++;
    else created++;
  }

  console.log(`Pharmacies — Created: ${created}, Updated: ${updated}`);
}

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Seeding full emergency-services directory...\n');

  await seedResponders();
  console.log('');
  await seedPharmacies();

  console.log('\nFacility data (hospital/police/1 fire) \u00A9 OpenStreetMap contributors (ODbL).');
  console.log('Pharmacy phone numbers and opening hours are deliberately not stored — locations only, unverified beyond coordinates.');

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
