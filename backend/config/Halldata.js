/**
 * Smart Ballari — hall seed data.
 *
 * All 20 halls are real venues from ballari_halls_with_coordinates.geojson.
 * The five demo halls (Town Hall, VIMS Auditorium, District Library Hall,
 * Cantonment Community Hall, KSRTC Convention Centre) have been removed, and
 * seedHalls() deletes them from the database on boot.
 *
 * Booking mode, per hall:
 *
 *   'instant'  — the venue has verified rates in all four rental_rates slots.
 *                Full quote + priced booking, exactly as before.
 *
 *   'enquiry'  — no verified rates. The citizen sends a request, the venue
 *                confirms availability and price on its own line. The app
 *                never shows a total it cannot stand behind, and the booking
 *                stays 'pending' until a hall manager or admin confirms it.
 *
 * Today every venue is 'enquiry', because rental_rates is null across the
 * board. Fill those slots in ballari_halls.json and the hall flips to
 * 'instant' on the next boot — no code change needed.
 */

const fs   = require('fs');
const path = require('path');

const DIRECTORY_HALLS = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'ballari_halls.json'), 'utf-8')
);

// Removed on boot. Kept as a list so the cleanup is explicit and reversible
// rather than a blind deleteMany.
const RETIRED_DEMO_HALLS = [
  'Town Hall Ballari',
  'VIMS Auditorium',
  'District Library Hall',
  'Cantonment Community Hall',
  'KSRTC Convention Centre'
];

const HALL_CATEGORIES = [
  { key: 'banquet_hall',    label: 'Banquet Hall',    icon: '🍽️' },
  { key: 'function_hall',   label: 'Function Hall',   icon: '🎪' },
  { key: 'convention_hall', label: 'Convention Hall', icon: '🏛️' },
  { key: 'wedding_venue',   label: 'Wedding Venue',   icon: '💍' },
  { key: 'kalyana_mantapa', label: 'Kalyana Mantapa', icon: '🛕' },
  { key: 'event_venue',     label: 'Event Venue',     icon: '🎉' }
];

/**
 * Idempotent seed + backfill. Matches on name, so re-running updates rather
 * than duplicating, and an existing database gains the new fields on boot.
 */
async function seedHalls(Hall) {
  try {
    // 1. Retire the demo halls. Any booking that referenced one keeps its
    //    hallName string, so booking history stays readable.
    const removed = await Hall.deleteMany({
      $or: [
        { name: { $in: RETIRED_DEMO_HALLS } },
        { source: 'demo' }
      ]
    });

    // 2. Insert or refresh the real venues.
    let created = 0, updated = 0;

    for (const h of DIRECTORY_HALLS) {
      const existing = await Hall.findOne({ name: h.name });

      if (!existing) {
        await Hall.create(h);
        created++;
        continue;
      }

      Object.assign(existing, {
        category:          h.category,
        categoryLabel:     h.categoryLabel,
        icon:              h.icon,
        area:              h.area,
        address:           h.address,
        contact:           h.contact,
        phoneVerified:     h.phoneVerified,
        rating:            h.rating,
        reviewCount:       h.reviewCount,
        capacity:          h.capacity,
        capacityEstimated: h.capacityEstimated,
        capacityNote:      h.capacityNote,
        facilities:        h.facilities,
        amenitiesVerified: h.amenitiesVerified,
        currency:          h.currency,
        pricingNote:       h.pricingNote,
        pricingStatus:     h.pricingStatus,
        indicativeRate:    h.indicativeRate,
        location:          h.location,
        coordinatesVerified: h.coordinatesVerified,
        locationVerified:  h.locationVerified,
        source:            h.source,
        bookable:          h.bookable
      });

      // Rates a hall manager entered through the app outrank the file's
      // nulls. The file only wins when it actually carries a rate.
      if (h.ratesVerified) {
        existing.pricing       = h.pricing;
        existing.pricePerDay   = h.pricing.fullDay;
        existing.ratesVerified = true;
        existing.bookingMode   = 'instant';
      } else if (!existing.ratesVerified) {
        existing.ratesVerified = false;
        existing.bookingMode   = 'enquiry';
      }

      await existing.save();
      updated++;
    }

    const enquiry = DIRECTORY_HALLS.filter(h => h.bookingMode === 'enquiry').length;
    console.log(
      `Halls: ${removed.deletedCount} demo removed, ${created} created, ` +
      `${updated} updated (${DIRECTORY_HALLS.length} real venues, ${enquiry} enquiry-only)`
    );
  } catch (err) {
    console.error('seedHalls failed:', err.message);
  }
}

module.exports = { DIRECTORY_HALLS, RETIRED_DEMO_HALLS, HALL_CATEGORIES, seedHalls };