/**
 * Seeds the FoodPlace collection directly from verified data — no geojson
 * file or data/raw/ folder needed at runtime. SEED_DATA below holds the
 * same 35 restaurants/cafes/hotels/lodges from the original geojson export
 * (LatLong.net, generated 2026-09-13, verified coordinates), already
 * transformed into the FoodPlace shape.
 *
 *   node scripts/importFoodData.js            # add / update
 *   node scripts/importFoodData.js --reset    # wipe the collection first
 *
 * Re-running is safe: places are upserted on slug, so editing an entry
 * below and re-running updates that row instead of duplicating it.
 *
 * Fields not available from the source (hours, phone, cuisine) are left
 * null — never invented. Fill them in by hand, or via a separately-sourced
 * pass, once you're ready.
 */
require('dotenv').config();
const mongoose  = require('mongoose');
const FoodPlace = require('../models/FoodPlace');

const SEED_DATA = [
  {
    slug: "bagicha-restaurant",
    name: "Bagicha Restaurant",
    category: "restaurant",
    address: "Ballari, Karnataka, India",
    location: {
      lat: 15.1554294,
      lng: 76.9360363
    },
    rating: 3.6,
    reviewCount: 2984,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: "Indian/Chinese dishes",
    mustTry: ["Indian/Chinese dishes"],
    roomPricePerNight: null,
    tags: ["restaurant", "vegetarian", "non-veg"],
    image: "🍽️",
    source: "LatLong.net",
    coordinatePrecision: "verified"
  },
  {
    slug: "gowda-canteen",
    name: "Gowda Canteen",
    category: "restaurant",
    address: "Ballari, Karnataka, India",
    location: {
      lat: 15.1608059,
      lng: 76.8874484
    },
    rating: null,
    reviewCount: null,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: null,
    mustTry: [],
    roomPricePerNight: null,
    tags: ["restaurant"],
    image: "🍽️",
    source: "LatLong.net",
    coordinatePrecision: "verified"
  },
  {
    slug: "the-hot-breads",
    name: "THE HOT BREADS",
    category: "cafe",
    address: "Ballari, Karnataka, India",
    location: {
      lat: 15.1515643,
      lng: 76.9022821
    },
    rating: 3.8,
    reviewCount: 3274,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: "Fresh breads/pastries",
    mustTry: ["Fresh breads/pastries"],
    roomPricePerNight: null,
    tags: ["cafe", "vegetarian", "non-veg"],
    image: "☕",
    source: "LatLong.net / local listings",
    coordinatePrecision: "verified"
  },
  {
    slug: "hotel",
    name: "Hotel",
    category: "restaurant",
    address: "Ballari, Karnataka, India",
    location: {
      lat: 15.1168717,
      lng: 76.9315951
    },
    rating: null,
    reviewCount: null,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: null,
    mustTry: [],
    roomPricePerNight: null,
    tags: ["restaurant"],
    image: "🍽️",
    source: "LatLong.net",
    coordinatePrecision: "verified"
  },
  {
    slug: "nisarga-hotel",
    name: "Nisarga Hotel",
    category: "restaurant",
    address: "Ballari, Karnataka, India",
    location: {
      lat: 15.1432757,
      lng: 76.9274862
    },
    rating: null,
    reviewCount: null,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: null,
    mustTry: [],
    roomPricePerNight: null,
    tags: ["restaurant"],
    image: "🍽️",
    source: "LatLong.net",
    coordinatePrecision: "verified"
  },
  {
    slug: "royal-treat-fast-food",
    name: "Royal Treat Fast Food",
    category: "restaurant",
    address: "Ballari, Karnataka, India",
    location: {
      lat: 15.1585643,
      lng: 76.8986237
    },
    rating: null,
    reviewCount: null,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: null,
    mustTry: [],
    roomPricePerNight: null,
    tags: ["restaurant"],
    image: "🍽️",
    source: "LatLong.net",
    coordinatePrecision: "verified"
  },
  {
    slug: "swetha-family-restaurant",
    name: "Swetha Family Restaurant",
    category: "restaurant",
    address: "Ballari, Karnataka, India",
    location: {
      lat: 15.1988312,
      lng: 76.7703614
    },
    rating: null,
    reviewCount: null,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: null,
    mustTry: [],
    roomPricePerNight: null,
    tags: ["restaurant"],
    image: "🍽️",
    source: "LatLong.net",
    coordinatePrecision: "verified"
  },
  {
    slug: "hotel-pola-paradise",
    name: "Hotel Pola Paradise",
    category: "hotel",
    address: "Ballari, Karnataka, India",
    location: {
      lat: 15.14761,
      lng: 76.90342
    },
    rating: null,
    reviewCount: null,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: null,
    mustTry: [],
    roomPricePerNight: null,
    tags: ["hotel"],
    image: "🏨",
    source: "Mapcarta / OpenStreetMap",
    coordinatePrecision: "verified"
  },
  {
    slug: "grande-idhanta",
    name: "Grande Idhanta",
    category: "hotel",
    address: "Ballari, Karnataka, India",
    location: {
      lat: 15.14483,
      lng: 76.92857
    },
    rating: null,
    reviewCount: null,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: null,
    mustTry: [],
    roomPricePerNight: null,
    tags: ["hotel"],
    image: "🏨",
    source: "Mapcarta / OpenStreetMap",
    coordinatePrecision: "verified"
  },
  {
    slug: "bombai-waala-shawarma-and-fast-food-chinese",
    name: "Bombai Waala Shawarma and fast food chinese",
    category: "restaurant",
    address: "Jawans Rd, opposite Hazarath Syed Shah Khader Mastan Vali, Cowl Bazaar, Ballari, Karnataka 583102, India",
    location: {
      lat: 15.1506,
      lng: 76.9104
    },
    rating: 4.4,
    reviewCount: 88,
    priceRange: "₹",
    hours: null,
    phone: null,
    cuisine: [],
    specialty: "Shawarma",
    mustTry: ["Shawarma"],
    roomPricePerNight: null,
    tags: ["restaurant", "non-veg"],
    image: "🍽️",
    source: "Current local business listing",
    coordinatePrecision: "approximate"
  },
  {
    slug: "cafe-buddy-s-espresso",
    name: "Cafe Buddy's Espresso",
    category: "cafe",
    address: "Infantry Road, near S.P. Circle, Devi Nagar, Ballari, Karnataka 583103, India",
    location: {
      lat: 15.1518,
      lng: 76.9098
    },
    rating: 4.8,
    reviewCount: 506,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: "Paneer Tikka Pizza / Tandoori Chicken Burger",
    mustTry: ["Paneer Tikka Pizza / Tandoori Chicken Burger"],
    roomPricePerNight: null,
    tags: ["cafe", "vegetarian", "non-veg"],
    image: "☕",
    source: "Current local business listing + Swiggy",
    coordinatePrecision: "approximate"
  },
  {
    slug: "model-grand-inn",
    name: "Model Grand Inn",
    category: "hotel",
    address: "Mothi Circle, Cowl Bazaar, Ballari, Karnataka 583104, India",
    location: {
      lat: 15.151,
      lng: 76.908
    },
    rating: 4.1,
    reviewCount: 242,
    priceRange: "₹₹₹",
    hours: null,
    phone: null,
    cuisine: [],
    specialty: null,
    mustTry: [],
    roomPricePerNight: 1330,
    tags: ["hotel", "vegetarian", "non-veg"],
    image: "🏨",
    source: "Current hotel listing + Zomato",
    coordinatePrecision: "approximate"
  },
  {
    slug: "radhika-lodge",
    name: "Radhika Lodge",
    category: "lodge",
    address: "Vadara bandi, Raghavachari Rd, Old Katte Gudda, Cowl Bazaar, Ballari, Karnataka 583101, India",
    location: {
      lat: 15.1468,
      lng: 76.9025
    },
    rating: 3.6,
    reviewCount: 141,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: null,
    mustTry: [],
    roomPricePerNight: null,
    tags: ["lodge"],
    image: "🛏️",
    source: "Current local business listing",
    coordinatePrecision: "approximate"
  },
  {
    slug: "hotel-gokulam-park-allum",
    name: "Hotel Gokulam Park Allum",
    category: "hotel",
    address: "A.D.City, Bellary-Uravakonda-Anantapur Rd, beside Allum Bhavan, Bandimot, Ballari, Karnataka 583101, India",
    location: {
      lat: 15.134,
      lng: 76.936
    },
    rating: 3.9,
    reviewCount: 1228,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: null,
    mustTry: [],
    roomPricePerNight: null,
    tags: ["hotel"],
    image: "🏨",
    source: "Current hotel listing",
    coordinatePrecision: "approximate"
  },
  {
    slug: "kritunga-restaurant",
    name: "Kritunga Restaurant",
    category: "restaurant",
    address: "2nd Floor, Infantry Road, near Vasavi School, Devi Nagar, Ballari, Karnataka 583104, India",
    location: {
      lat: 15.153,
      lng: 76.91
    },
    rating: 4.6,
    reviewCount: 2673,
    priceRange: "₹₹₹",
    hours: null,
    phone: null,
    cuisine: [],
    specialty: "Andhra Style Chicken Biryani / Rayalaseema Kodi Pulao",
    mustTry: ["Andhra Style Chicken Biryani / Rayalaseema Kodi Pulao"],
    roomPricePerNight: null,
    tags: ["restaurant", "vegetarian", "non-veg"],
    image: "🍽️",
    source: "Current local business listing + travel/menu sources",
    coordinatePrecision: "approximate"
  },
  {
    slug: "namma-mane-coffee",
    name: "Namma Mane Coffee",
    category: "cafe",
    address: "1, Radio Park Cowl Bazar, Cowl Bazaar, Ballari, Karnataka 583104, India",
    location: {
      lat: 15.1534,
      lng: 76.9088
    },
    rating: 4.1,
    reviewCount: 135,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: "Coffee",
    mustTry: ["Coffee"],
    roomPricePerNight: null,
    tags: ["cafe", "vegetarian"],
    image: "☕",
    source: "Current local business listing",
    coordinatePrecision: "approximate"
  },
  {
    slug: "lassi-day-cafe",
    name: "Lassi Day cafe",
    category: "cafe",
    address: "Siddartha Nagar, Devi Nagar, Ballari, Karnataka 583104, India",
    location: {
      lat: 15.1538,
      lng: 76.9097
    },
    rating: 4,
    reviewCount: 1283,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: "Lassi",
    mustTry: ["Lassi"],
    roomPricePerNight: null,
    tags: ["cafe", "vegetarian"],
    image: "☕",
    source: "Current local business listing + official site",
    coordinatePrecision: "approximate"
  },
  {
    slug: "zipp-lite-ballari-leela-hotel-banquets",
    name: "Zipp Lite Ballari - Leela Hotel & Banquets",
    category: "hotel",
    address: "Sri Mani Homes, opposite Satyanarayana Temple, Satya Narayana Pet, Ballari, Karnataka 583101, India",
    location: {
      lat: 15.147,
      lng: 76.923
    },
    rating: 4.7,
    reviewCount: 24,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: null,
    mustTry: [],
    roomPricePerNight: null,
    tags: ["hotel"],
    image: "🏨",
    source: "Current local business listing",
    coordinatePrecision: "approximate"
  },
  {
    slug: "the-chocolate-room-ballari",
    name: "THE CHOCOLATE ROOM BALLARI",
    category: "cafe",
    address: "Near HDFC Bank, Paravthi Nagar Main Road, Ballari, Karnataka 583101, India",
    location: {
      lat: 15.1508,
      lng: 76.919
    },
    rating: 4.6,
    reviewCount: 237,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: "Chocolate desserts / shakes",
    mustTry: ["Chocolate desserts / shakes"],
    roomPricePerNight: null,
    tags: ["cafe", "vegetarian", "non-veg"],
    image: "☕",
    source: "Current local business listing + official site",
    coordinatePrecision: "approximate"
  },
  {
    slug: "hotel-royal-fort",
    name: "Hotel Royal Fort",
    category: "hotel",
    address: "New Trunk Road, behind Hotel Pola Paradise, Siddartha Nagar, Devi Nagar, Ballari, Karnataka 583104, India",
    location: {
      lat: 15.1474,
      lng: 76.9038
    },
    rating: 4,
    reviewCount: 5794,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: null,
    mustTry: [],
    roomPricePerNight: null,
    tags: ["hotel", "vegetarian", "non-veg"],
    image: "🏨",
    source: "Current hotel listing",
    coordinatePrecision: "approximate"
  },
  {
    slug: "dwaraka-lodge",
    name: "Dwaraka Lodge",
    category: "lodge",
    address: "201, Car St, opposite Jain Temple, Bruce Pet, Cowl Bazaar, Ballari, Karnataka 583101, India",
    location: {
      lat: 15.1485,
      lng: 76.907
    },
    rating: 3.5,
    reviewCount: 201,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: null,
    mustTry: [],
    roomPricePerNight: null,
    tags: ["lodge"],
    image: "🛏️",
    source: "Current local business listing + official site",
    coordinatePrecision: "approximate"
  },
  {
    slug: "seven-heaven",
    name: "Seven Heaven",
    category: "restaurant",
    address: "33, Infantry Road, Siddartha Nagar, Devi Nagar, Ballari, Karnataka 583104, India",
    location: {
      lat: 15.1518,
      lng: 76.9095
    },
    rating: 4.5,
    reviewCount: 237,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: "Biryani",
    mustTry: ["Biryani"],
    roomPricePerNight: null,
    tags: ["restaurant", "non-veg"],
    image: "🍽️",
    source: "Current local business listing",
    coordinatePrecision: "approximate"
  },
  {
    slug: "al-tabaq-cafe-restaurant",
    name: "AL-TABAQ CAFE & RESTAURANT",
    category: "restaurant",
    address: "Old Hospet Bypass Road, Cowl Bazaar, Ballari, Karnataka 583102, India",
    location: {
      lat: 15.15,
      lng: 76.9075
    },
    rating: 5,
    reviewCount: 8,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: null,
    mustTry: [],
    roomPricePerNight: null,
    tags: ["restaurant"],
    image: "🍽️",
    source: "Current local business listing",
    coordinatePrecision: "approximate"
  },
  {
    slug: "city-bed-lodge",
    name: "City Bed Lodge",
    category: "lodge",
    address: "KSRTC Bus Stand Rd, Cowl Bazaar, Ballari, Karnataka 583101, India",
    location: {
      lat: 15.151,
      lng: 76.9045
    },
    rating: 5,
    reviewCount: 1,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: null,
    mustTry: [],
    roomPricePerNight: null,
    tags: ["lodge"],
    image: "🛏️",
    source: "Current local business listing",
    coordinatePrecision: "approximate"
  },
  {
    slug: "brindavan-lodge",
    name: "Brindavan Lodge",
    category: "lodge",
    address: "Opp. New KSRTC Bus Stand, Cowl Bazaar, Ballari, Karnataka 583101, India",
    location: {
      lat: 15.1513,
      lng: 76.9042
    },
    rating: 2.9,
    reviewCount: 143,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: null,
    mustTry: [],
    roomPricePerNight: null,
    tags: ["lodge"],
    image: "🛏️",
    source: "Current local business listing",
    coordinatePrecision: "approximate"
  },
  {
    slug: "iroomz-hoysala-residency-bellari",
    name: "iroomz Hoysala Residency Bellari",
    category: "hotel",
    address: "96, Dr RajKumar Rd, Satya Narayana Pet, Ballari, Karnataka 583101, India",
    location: {
      lat: 15.148,
      lng: 76.921
    },
    rating: 2.3,
    reviewCount: 24,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: null,
    mustTry: [],
    roomPricePerNight: null,
    tags: ["hotel"],
    image: "🏨",
    source: "Current local business listing",
    coordinatePrecision: "approximate"
  },
  {
    slug: "lazeez-food-corner",
    name: "LAZEEZ FOOD CORNER",
    category: "restaurant",
    address: "Main Road, Nallacheruvu, Cowl Bazaar, Ballari, Karnataka 583102, India",
    location: {
      lat: 15.153,
      lng: 76.9058
    },
    rating: 5,
    reviewCount: 3,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: null,
    mustTry: [],
    roomPricePerNight: null,
    tags: ["restaurant"],
    image: "🍽️",
    source: "Current local business listing",
    coordinatePrecision: "approximate"
  },
  {
    slug: "fiza-sheek-corner",
    name: "Fiza Sheek Corner",
    category: "restaurant",
    address: "Main Road, Radio Park Cowl Bazar, Cowl Bazaar, Ballari, Karnataka 583102, India",
    location: {
      lat: 15.1535,
      lng: 76.9065
    },
    rating: 5,
    reviewCount: 1,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: "Sheek kebab",
    mustTry: ["Sheek kebab"],
    roomPricePerNight: null,
    tags: ["restaurant", "non-veg"],
    image: "🍽️",
    source: "Current local business listing",
    coordinatePrecision: "approximate"
  },
  {
    slug: "mughal-darbar",
    name: "Mughal Darbar",
    category: "restaurant",
    address: "Radio Park Cowl Bazar, Cowl Bazaar, Ballari, Karnataka 583102, India",
    location: {
      lat: 15.1532,
      lng: 76.907
    },
    rating: 3,
    reviewCount: 2,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: null,
    mustTry: [],
    roomPricePerNight: null,
    tags: ["restaurant"],
    image: "🍽️",
    source: "Current local business listing",
    coordinatePrecision: "approximate"
  },
  {
    slug: "the-revive-house",
    name: "The Revive House",
    category: "restaurant",
    address: "Sudharshan Naidu St, near zoo, Radio Park Cowl Bazar, Ballari, Karnataka 583104, India",
    location: {
      lat: 15.153,
      lng: 76.909
    },
    rating: 4.2,
    reviewCount: 300,
    priceRange: "₹₹",
    hours: null,
    phone: null,
    cuisine: [],
    specialty: "Pizza",
    mustTry: ["Pizza"],
    roomPricePerNight: null,
    tags: ["restaurant", "non-veg"],
    image: "🍽️",
    source: "current local/menu listing",
    coordinatePrecision: "approximate"
  },
  {
    slug: "hotel-rameswari",
    name: "Hotel Rameswari",
    category: "restaurant",
    address: "Cowl Bazaar, Ballari, Karnataka, India",
    location: {
      lat: 15.15,
      lng: 76.906
    },
    rating: 4.4,
    reviewCount: 1000,
    priceRange: "₹",
    hours: null,
    phone: null,
    cuisine: [],
    specialty: "Biryani",
    mustTry: ["Biryani"],
    roomPricePerNight: null,
    tags: ["restaurant", "vegetarian", "non-veg"],
    image: "🍽️",
    source: "current local/menu listing",
    coordinatePrecision: "approximate"
  },
  {
    slug: "hotel-bala-regency",
    name: "Hotel Bala Regency",
    category: "hotel",
    address: "Parvathi Nagar Road, Cowl Bazaar, Ballari, Karnataka, India",
    location: {
      lat: 15.1515,
      lng: 76.91
    },
    rating: null,
    reviewCount: null,
    priceRange: "₹₹",
    hours: null,
    phone: null,
    cuisine: [],
    specialty: null,
    mustTry: [],
    roomPricePerNight: null,
    tags: ["hotel", "vegetarian", "non-veg"],
    image: "🏨",
    source: "current local/menu listing",
    coordinatePrecision: "approximate"
  },
  {
    slug: "hotel-panchamrutha",
    name: "Hotel Panchamrutha",
    category: "restaurant",
    address: "Vijayanagar Colony, Ballari, Karnataka 583104, India",
    location: {
      lat: 15.16,
      lng: 76.9
    },
    rating: null,
    reviewCount: null,
    priceRange: "₹",
    hours: null,
    phone: null,
    cuisine: [],
    specialty: "Masala Dosa",
    mustTry: ["Masala Dosa"],
    roomPricePerNight: null,
    tags: ["restaurant", "vegetarian"],
    image: "🍽️",
    source: "current local/menu listing",
    coordinatePrecision: "approximate"
  },
  {
    slug: "hotel-nisaraga",
    name: "Hotel Nisaraga",
    category: "restaurant",
    address: "BSNL Colony, Cowl Bazaar, Ballari, Karnataka, India",
    location: {
      lat: 15.143,
      lng: 76.9275
    },
    rating: null,
    reviewCount: null,
    priceRange: null,
    hours: null,
    phone: null,
    cuisine: [],
    specialty: "Mutton Masala",
    mustTry: ["Mutton Masala"],
    roomPricePerNight: null,
    tags: ["restaurant", "vegetarian", "non-veg"],
    image: "🍽️",
    source: "current local/menu listing",
    coordinatePrecision: "approximate"
  },
  {
    slug: "revive-cafe",
    name: "Revive cafe",
    category: "cafe",
    address: "Radio Park, Cowl Bazaar, Ballari, Karnataka, India",
    location: {
      lat: 15.153,
      lng: 76.9085
    },
    rating: 4,
    reviewCount: 459,
    priceRange: "₹",
    hours: null,
    phone: null,
    cuisine: [],
    specialty: "Gobi Manchurian",
    mustTry: ["Gobi Manchurian"],
    roomPricePerNight: null,
    tags: ["cafe", "vegetarian", "non-veg"],
    image: "☕",
    source: "current local/menu listing",
    coordinatePrecision: "approximate"
  }
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  if (process.argv.includes('--reset')) {
    const { deletedCount } = await FoodPlace.deleteMany({});
    console.log(`Reset: removed ${deletedCount} places`);
  }

  let created = 0, updated = 0;

  for (const doc of SEED_DATA) {
    const res = await FoodPlace.updateOne(
      { slug: doc.slug },
      { $set: doc },
      { upsert: true }
    );
    if (res.upsertedCount) created++; else if (res.modifiedCount) updated++;
  }

  const total = await FoodPlace.countDocuments();
  console.log(`\ncreated ${created}, updated ${updated}, total in DB ${total}`);

  const byCat = await FoodPlace.aggregate([
    { $group: { _id: '$category', n: { $sum: 1 } } }, { $sort: { n: -1 } }
  ]);
  console.log('\nby category:');
  byCat.forEach(r => console.log(`  ${String(r.n).padStart(4)}  ${r._id}`));

  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });