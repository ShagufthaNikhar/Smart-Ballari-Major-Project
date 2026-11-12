/**
 * Seeds the Attraction collection directly from verified data — no geojson
 * file needed at runtime. SEED_DATA below holds 42 records from the original
 * "things to do" export (Ballari District Administration / Karnataka
 * Tourism, 2026-09-07) plus 1 more from a later, separately-sourced,
 * strictly-verified Infantry Road export (2026-09-13): Max, a shopping mall
 * — the FIRST attraction in this collection with real, verified
 * coordinates (rating/reviewCount/openingHours also added to the schema for
 * it). The other candidate from that Infantry Road source, Hotel Pola
 * Paradise, was already in FoodPlace with the same coordinates — enriched
 * there instead of duplicated here.
 *
 * IMPORTANT: most of the original 42 records still have no verified
 * coordinates (every location below is null unless coordinatesVerified is
 * true) — its own metadata says coordinates are intentionally omitted
 * unless independently verified. Don't fill them in with guesses; the
 * frontend uses an address-based maps search instead of a pin for those.
 *
 *   node scripts/importAttractionsData.js            # add / update
 *   node scripts/importAttractionsData.js --reset    # wipe the collection first
 *
 * Re-running is safe: records are upserted on slug.
 */
require('dotenv').config();
const mongoose    = require('mongoose');
const Attraction  = require('../models/Attraction');

const SEED_DATA = [
  {
    slug: "bellary-fort",
    name: "Bellary Fort",
    category: "tourist_attraction",
    subcategory: "fort",
    address: "Ballari",
    phone: null,
    description: "Historic fort on Ballari Gudda.",
    source: "Ballari District Administration / Karnataka Tourism",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "kumaraswamy-temple-sandur",
    name: "Kumaraswamy Temple, Sandur",
    category: "tourist_attraction",
    subcategory: "temple",
    address: "Sandur, Ballari district",
    phone: null,
    description: "Temple at Krauncha Giri near Sandur.",
    source: "Ballari District Administration / Karnataka Tourism",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "daroji-sloth-bear-sanctuary",
    name: "Daroji Sloth Bear Sanctuary",
    category: "nature",
    subcategory: "wildlife_sanctuary",
    address: "Near Hampi, Ballari district",
    phone: null,
    description: "Sloth bear sanctuary close to Hampi.",
    source: "Ballari District Administration / Karnataka Tourism",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "gudekote-sloth-bear-sanctuary",
    name: "Gudekote Sloth Bear Sanctuary",
    category: "nature",
    subcategory: "wildlife_sanctuary",
    address: "Gudekote, Ballari district",
    phone: null,
    description: "Protected sloth bear habitat.",
    source: "Ballari District Administration / Karnataka Tourism",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "hampi",
    name: "Hampi",
    category: "tourist_attraction",
    subcategory: "unesco_heritage_site",
    address: "Hampi, Vijayanagara district",
    phone: null,
    description: "UNESCO World Heritage Site and former Vijayanagara capital.",
    source: "Ballari District Administration / Karnataka Tourism",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "virupaksha-temple",
    name: "Virupaksha Temple",
    category: "heritage",
    subcategory: "temple",
    address: "Hampi",
    phone: null,
    description: "Major historic temple dedicated to Shiva.",
    source: "Ballari District Administration / Karnataka Tourism",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "vijaya-vittala-temple",
    name: "Vijaya Vittala Temple",
    category: "heritage",
    subcategory: "temple",
    address: "Hampi",
    phone: null,
    description: "Major Vijayanagara-era temple complex.",
    source: "Ballari District Administration / Karnataka Tourism",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "stone-chariot",
    name: "Stone Chariot",
    category: "heritage",
    subcategory: "monument",
    address: "Hampi",
    phone: null,
    description: "Iconic granite chariot at the Vittala temple complex.",
    source: "Ballari District Administration / Karnataka Tourism",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "lotus-mahal",
    name: "Lotus Mahal",
    category: "heritage",
    subcategory: "palace",
    address: "Hampi",
    phone: null,
    description: "Distinctive Vijayanagara-era palace structure.",
    source: "Ballari District Administration / Karnataka Tourism",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "mahanavami-dibba",
    name: "Mahanavami Dibba",
    category: "heritage",
    subcategory: "royal_platform",
    address: "Hampi",
    phone: null,
    description: "Ceremonial royal platform in the Royal Centre.",
    source: "Ballari District Administration / Karnataka Tourism",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "hampi-bazaar",
    name: "Hampi Bazaar",
    category: "shopping",
    subcategory: "heritage_market_street",
    address: "Hampi",
    phone: null,
    description: "Historic market street within the Hampi heritage landscape.",
    source: "Ballari District Administration / Karnataka Tourism",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "kadalekalu-ganesha",
    name: "Kadalekalu Ganesha",
    category: "heritage",
    subcategory: "monument",
    address: "Hampi",
    phone: null,
    description: "Large monolithic Ganesha near Hemakuta Hill.",
    source: "Ballari District Administration / Karnataka Tourism",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "sasivekalu-ganesha",
    name: "Sasivekalu Ganesha",
    category: "heritage",
    subcategory: "monument",
    address: "Hampi",
    phone: null,
    description: "Monolithic Ganesha sculpture near Hemakuta Hill.",
    source: "Ballari District Administration / Karnataka Tourism",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "matanga-hill",
    name: "Matanga Hill",
    category: "nature",
    subcategory: "viewpoint_trekking",
    address: "Hampi",
    phone: null,
    description: "Popular viewpoint for sunrise and sunset.",
    source: "Ballari District Administration / Karnataka Tourism",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "anjanadri-hill",
    name: "Anjanadri Hill",
    category: "nature",
    subcategory: "hill_trekking",
    address: "Anegundi/Hampi region",
    phone: null,
    description: "Hill associated with the Kishkinda/Ramayana tradition.",
    source: "Ballari District Administration / Karnataka Tourism",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "sanganakallu-kupgal",
    name: "Sanganakallu-Kupgal",
    category: "heritage",
    subcategory: "archaeological_site",
    address: "Ballari district",
    phone: null,
    description: "Neolithic archaeological landscape.",
    source: "Ballari District Administration / Karnataka Tourism",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "model-grand-inn",
    name: "Model Grand Inn",
    category: "hotel",
    subcategory: "hotel",
    address: "Mothi Circle, Cowl Bazaar, Ballari, Karnataka 583104",
    phone: "+919743277799",
    description: null,
    source: "Google Business search",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "iroomz-hoysala-residency-bellari-main-residency",
    name: "iroomz Hoysala Residency Bellari main Residency",
    category: "hotel",
    subcategory: "extended_stay_hotel",
    address: "96, Dr RajKumar Rd, Satya Narayana Pet, Ballari, Karnataka 583101",
    phone: null,
    description: null,
    source: "Google Business search",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "zipp-lite-ballari-leela-hotel-banquets",
    name: "Zipp Lite Ballari - Leela Hotel & Banquets",
    category: "hotel",
    subcategory: "hotel",
    address: "SPR Infra, Sri Mani Homes, Opp. Satyanarayana Temple, beside MSR Hospital, Satya Narayana Pet, Ballari, Karnataka 583101",
    phone: null,
    description: null,
    source: "Google Business search",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "dress-circle-shopping-mall-ballari",
    name: "Dress Circle Shopping Mall- Ballari",
    category: "shopping",
    subcategory: "shopping_mall",
    address: "Bangalore Rd, Cowl Bazaar, Ballari, Karnataka 583101",
    phone: "+919346391045",
    description: null,
    source: "Google Business search",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "pakiza-shopping-mall",
    name: "Pakiza Shopping Mall",
    category: "shopping",
    subcategory: "clothing_shopping",
    address: "Old Rayadurg Bus Stand, Bangalore Rd, Cowl Bazaar, Ballari, Karnataka 583101",
    phone: "+919632960096",
    description: null,
    source: "Google Business search",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "allauddin-complex",
    name: "Allauddin Complex",
    category: "shopping",
    subcategory: "shopping_complex",
    address: "Dhobi Street, behind Cowl Bazar, Cowl Bazaar, Ballari, Karnataka 583102",
    phone: null,
    description: null,
    source: "Google Business search",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "qureshi-market",
    name: "Qureshi Market",
    category: "shopping",
    subcategory: "market",
    address: "Shop No 01 Ward No 28, near Beef Butcher Street, Cowl Bazaar, Ballari, Karnataka 583102",
    phone: "+919071020147",
    description: null,
    source: "Google Business search",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "fish-market-bellary",
    name: "Fish Market, Bellary",
    category: "shopping",
    subcategory: "market",
    address: "Radio Park Cowl Bazar, Cowl Bazaar, Ballari, Karnataka 583102",
    phone: null,
    description: null,
    source: "Google Business search",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "krishna-vegetables",
    name: "KRISHNA VEGETABLES",
    category: "shopping",
    subcategory: "vegetable_market",
    address: "APMC Yard, near APMC, Mruthunjaya Nagar, Ballari, Karnataka 583101",
    phone: "+917204387024",
    description: null,
    source: "Google Business search",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "ex-servicemen-colony-public-park",
    name: "Ex-Servicemen Colony Public Park",
    category: "things_to_do",
    subcategory: "park",
    address: "Hosapete-Ballari Main Rd, Radio Park Cowl Bazar, Ballari, Karnataka 583102",
    phone: "+918884920938",
    description: null,
    source: "Google Business search",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "dr-rajkumar-park",
    name: "Dr. Rajkumar Park",
    category: "things_to_do",
    subcategory: "park",
    address: "Station Rd, opposite BSNL Office, Ballari, Karnataka 583101",
    phone: null,
    description: null,
    source: "Google Business search",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "jayanagara-park",
    name: "Jayanagara Park",
    category: "things_to_do",
    subcategory: "park",
    address: "Tilak Nagar, Cantonment, Ballari, Karnataka 583104",
    phone: "+918762529786",
    description: null,
    source: "Google Business search",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "park-tilak-nagar-cantonment",
    name: "Park, Tilak Nagar Cantonment",
    category: "things_to_do",
    subcategory: "park",
    address: "Tilak Nagar, Cantonment, Ballari, Karnataka 583104",
    phone: null,
    description: null,
    source: "Google Business search",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "mincheri-water-falls",
    name: "Mincheri Water Falls",
    category: "nature",
    subcategory: "waterfall",
    address: "Ballari, Karnataka 583102",
    phone: "+918022352828",
    description: null,
    source: "Google Business search",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "select-theater",
    name: "Select Theater",
    category: "entertainment",
    subcategory: "cinema",
    address: "Cowl Bazaar, Ballari, Karnataka 583102",
    phone: null,
    description: null,
    source: "Google Business search",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "radhika-theater",
    name: "Radhika Theater",
    category: "entertainment",
    subcategory: "cinema",
    address: "Wadara Banda, Raghavachari Rd, Old Katte Gudda, Cowl Bazaar, Ballari, Karnataka 583101",
    phone: "+919731527066",
    description: null,
    source: "Google Business search",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "movie-time-sai-cinemas",
    name: "Movie Time & Sai Cinemas",
    category: "entertainment",
    subcategory: "cinema",
    address: "Sanganakkal Road, Old Katte Gudda, Cowl Bazaar, Ballari, Karnataka 583101",
    phone: null,
    description: null,
    source: "Google Business search",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "m-k-function-hall",
    name: "M.K Function Hall",
    category: "events",
    subcategory: "function_hall",
    address: "Jagruthi Nagar, 2nd Cross, Jawari Street, near Bypass Road, Cowl Bazaar, Ballari, Karnataka 583102",
    phone: "+919980954908",
    description: null,
    source: "Google Business search",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "pista-house-pmr-banquet-hall",
    name: "Pista House - PMR Banquet Hall",
    category: "events",
    subcategory: "banquet_hall",
    address: "2nd Gate, Hospet Rd, beside Venkat Kamineni Hospital, Devi Nagar, Ballari, Karnataka 583104",
    phone: "+919966228888",
    description: null,
    source: "Google Business search",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "azhari-tours-ballari",
    name: "Azhari Tours Ballari",
    category: "things_to_do",
    subcategory: "tour_operator",
    address: "Dhobi Street, Cowl Bazar, Ballari, Karnataka 583102",
    phone: "+918660511702",
    description: null,
    source: "Google Business search",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "hampi-utsava-2026",
    name: "Hampi Utsava 2026",
    category: "events",
    subcategory: "heritage_festival",
    address: "Hampi, Vijayanagara district",
    phone: null,
    description: "Vijayanagara heritage festival with folk dance, music, monument lighting and cultural programs.",
    source: "Karnataka Tourism",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "hampi-heritage-walk",
    name: "Hampi Heritage Walk",
    category: "things_to_do",
    subcategory: "heritage_walk",
    address: "Hampi",
    phone: null,
    description: "Explore the heritage landscape on foot.",
    source: "Karnataka Tourism",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "hampi-cycling",
    name: "Hampi Cycling",
    category: "things_to_do",
    subcategory: "cycling",
    address: "Hampi",
    phone: null,
    description: "Cycle through the Hampi ruins.",
    source: "Karnataka Tourism",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "hampi-rock-climbing-bouldering",
    name: "Hampi Rock Climbing / Bouldering",
    category: "things_to_do",
    subcategory: "adventure",
    address: "Hampi",
    phone: null,
    description: "Granite boulders make Hampi a known climbing/bouldering area.",
    source: "Karnataka Tourism",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "hampi-sunrise-sunset-viewpoint",
    name: "Hampi Sunrise / Sunset Viewpoint",
    category: "things_to_do",
    subcategory: "photography",
    address: "Hampi",
    phone: null,
    description: "Sunrise and sunset viewpoints including Matanga Hill.",
    source: "Karnataka Tourism",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "tungabhadra-river-experience",
    name: "Tungabhadra River Experience",
    category: "things_to_do",
    subcategory: "riverfront",
    address: "Hampi/Anegundi",
    phone: null,
    description: "Riverfront sightseeing and cultural experiences.",
    source: "Karnataka Tourism",
    verified: true,
    lastVerified: "2026-09-07",
    coordinatesVerified: false,
    location: null
  },
  {
    slug: "max-infantry-road-bellary",
    name: "Max - Infantry Road, Bellary",
    category: "shopping",
    subcategory: "shopping_mall",
    address: "Ground Floor, 4th Cross, Infantry Road, KHB Colony, Devi Nagar, Ballari, Karnataka 583104",
    phone: "+91 89719 77639",
    description: null,
    rating: 4.5,
    reviewCount: 52,
    openingHours: "11:00-22:00 daily",
    source: "Official Max store page",
    verified: true,
    lastVerified: "2026-09-13",
    coordinatesVerified: true,
    location: { lat: 15.1535501, lng: 76.9061601 }
  }
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  if (process.argv.includes('--reset')) {
    const { deletedCount } = await Attraction.deleteMany({});
    console.log(`Reset: removed ${deletedCount} attractions`);
  }

  let created = 0, updated = 0;

  for (const doc of SEED_DATA) {
    const res = await Attraction.updateOne(
      { slug: doc.slug },
      { $set: doc },
      { upsert: true }
    );
    if (res.upsertedCount) created++; else if (res.modifiedCount) updated++;
  }

  const total = await Attraction.countDocuments();
  console.log(`\ncreated ${created}, updated ${updated}, total in DB ${total}`);

  const byCat = await Attraction.aggregate([
    { $group: { _id: '$category', n: { $sum: 1 } } }, { $sort: { n: -1 } }
  ]);
  console.log('\nby category:');
  byCat.forEach(r => console.log(`  ${String(r.n).padStart(4)}  ${r._id}`));

  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });