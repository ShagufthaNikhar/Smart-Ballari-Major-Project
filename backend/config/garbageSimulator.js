const { haversine } = require('./busSimulator');

// ── ASSUMPTIONS (the only two numbers this simulation rests on) ──
// Neither is in the source data — both are placeholders, tune once you
// have real field timing.
const DWELL_MINUTES  = 8;  // minutes spent actively collecting at ONE micro-area stop
                            // (lower than before since routeStops now has several
                            // real stops per ward, not one stop covering the whole ward)
const AVG_SPEED_KMPH = 20; // stop-start city driving between stops, not highway

function parseTimeToday(hhmm, base = new Date()) {
  const [h, m] = (hhmm || '07:00').split(':').map(Number);
  const d = new Date(base);
  d.setHours(h || 7, m || 0, 0, 0);
  return d;
}

// Builds the full day's schedule for one truck: arrival/departure time at
// each real micro-area stop, in the order stored in resource.routeStops
// (reconstructed from the official area list — see models/Resource.js).
function buildSchedule(resource, now = new Date()) {
  // resource may be a live Mongoose document (routeStops is then a
  // DocumentArray of subdocuments) or a plain object — normalize to plain
  // objects so property access is never in doubt.
  const rawStops = typeof resource.toObject === 'function'
    ? resource.toObject().routeStops
    : resource.routeStops;

  const stops = (rawStops || []).filter(s => s.lat != null && s.lng != null);
  if (!stops.length) return null;

  const start = parseTimeToday(resource.dailyStartTime, now);
  let cursor = new Date(start);
  const schedule = [];

  for (let i = 0; i < stops.length; i++) {
    const arrival = new Date(cursor);
    const departure = new Date(arrival.getTime() + DWELL_MINUTES * 60000);
    schedule.push({ ...stops[i], arrival, departure });

    if (i < stops.length - 1) {
      const distanceKm = haversine(
        stops[i].lat, stops[i].lng,
        stops[i + 1].lat, stops[i + 1].lng
      );
      const travelMinutes = (distanceKm / AVG_SPEED_KMPH) * 60;
      cursor = new Date(departure.getTime() + travelMinutes * 60000);
    }
  }

  return { start, schedule };
}

// Current simulated position + status for one truck, right now.
function simulateTruckPosition(resource, now = new Date()) {
  const built = buildSchedule(resource, now);
  if (!built) return { status: 'no_route' };
  const { start, schedule } = built;

  if (now < start) {
    return {
      status: 'not_started',
      startsAt: resource.dailyStartTime,
      currentPosition: { lat: schedule[0].lat, lng: schedule[0].lng }
    };
  }

  for (let i = 0; i < schedule.length; i++) {
    const s = schedule[i];
    if (now >= s.arrival && now < s.departure) {
      return {
        status: 'servicing',
        currentWard: s.ward,
        currentArea: s.area,
        currentPosition: { lat: s.lat, lng: s.lng },
        minutesRemainingHere: Math.round((s.departure - now) / 60000)
      };
    }
    const next = schedule[i + 1];
    if (next && now >= s.departure && now < next.arrival) {
      const frac = (now - s.departure) / (next.arrival - s.departure);
      return {
        status: 'traveling',
        fromArea: s.area,
        toArea: next.area,
        toWard: next.ward,
        currentPosition: {
          lat: s.lat + (next.lat - s.lat) * frac,
          lng: s.lng + (next.lng - s.lng) * frac
        },
        etaToNextStopMinutes: Math.round((next.arrival - now) / 60000)
      };
    }
  }

  const last = schedule[schedule.length - 1];
  return {
    status: 'completed',
    currentPosition: { lat: last.lat, lng: last.lng },
    completedAt: last.departure
  };
}

// Status + ETA for a SPECIFIC ward a citizen is asking about. A ward can
// have several real stops (routeStops), so the "window" for that ward
// spans from the FIRST stop's arrival to the LAST stop's departure.
function getWardStatus(resource, wardNum, now = new Date()) {
  const built = buildSchedule(resource, now);
  if (!built) return { status: 'no_route' };
  const { start, schedule } = built;

  const wardStops = schedule.filter(s => Number(s.ward) === Number(wardNum));
  if (!wardStops.length) return { status: 'not_on_route' };

  // Real stop coordinates (not just names) so the frontend can plot
  // each one and tighten the map's zoom around them — the moves
  // between stops within one ward are often only a few hundred
  // metres, invisible at a city-wide zoom level otherwise.
  const stopsInWard = wardStops.map(s => ({ area: s.area, lat: s.lat, lng: s.lng }));

  const wardArrival   = wardStops[0].arrival;
  const wardDeparture = wardStops[wardStops.length - 1].departure;
  const position = simulateTruckPosition(resource, now);

  if (now < start) {
    return {
      status: 'not_started',
      startsAt: resource.dailyStartTime,
      scheduledArrival: wardArrival,
      etaMinutes: Math.round((wardArrival - now) / 60000),
      currentPosition: position.currentPosition,
      stopsInWard
    };
  }
  if (now < wardArrival) {
    return {
      status: 'en_route',
      etaMinutes: Math.round((wardArrival - now) / 60000),
      scheduledArrival: wardArrival,
      currentPosition: position.currentPosition,
      stopsInWard
    };
  }
  if (now >= wardArrival && now < wardDeparture) {
    return {
      status: 'servicing_now',
      minutesRemaining: Math.round((wardDeparture - now) / 60000),
      currentArea: position.currentArea || null,
      currentPosition: position.currentPosition,
      stopsInWard
    };
  }
  return {
    status: 'departed',
    departedAt: wardDeparture,
    currentPosition: position.currentPosition,
    stopsInWard
  };
}

// Status + ETA for a SPECIFIC named micro-area (e.g. "Siruguppa Main Road")
// a citizen searched for directly, rather than a ward number. More precise
// than getWardStatus when a ward has several stops — this targets the exact
// stop, not the ward's whole arrival-to-departure window.
function getAreaStatus(resource, areaName, now = new Date()) {
  const built = buildSchedule(resource, now);
  if (!built) return { status: 'no_route' };
  const { start, schedule } = built;

  const needle = (areaName || '').trim().toLowerCase();
  const stop = schedule.find(s => (s.area || '').toLowerCase() === needle);
  if (!stop) return { status: 'not_on_route' };

  const position = simulateTruckPosition(resource, now);

  if (now < start) {
    return {
      status: 'not_started',
      startsAt: resource.dailyStartTime,
      scheduledArrival: stop.arrival,
      etaMinutes: Math.round((stop.arrival - now) / 60000),
      currentPosition: position.currentPosition,
      ward: stop.ward,
      area: stop.area
    };
  }
  if (now < stop.arrival) {
    return {
      status: 'en_route',
      etaMinutes: Math.round((stop.arrival - now) / 60000),
      scheduledArrival: stop.arrival,
      currentPosition: position.currentPosition,
      ward: stop.ward,
      area: stop.area
    };
  }
  if (now >= stop.arrival && now < stop.departure) {
    return {
      status: 'servicing_now',
      minutesRemaining: Math.round((stop.departure - now) / 60000),
      currentPosition: { lat: stop.lat, lng: stop.lng },
      ward: stop.ward,
      area: stop.area
    };
  }
  return {
    status: 'departed',
    departedAt: stop.departure,
    currentPosition: position.currentPosition,
    ward: stop.ward,
    area: stop.area
  };
}

module.exports = {
  simulateTruckPosition,
  getWardStatus,
  getAreaStatus,
  DWELL_MINUTES,
  AVG_SPEED_KMPH
};