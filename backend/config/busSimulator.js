const BusRoute = require('../models/BusRoute');

// In-memory bus state — no DB needed for simulation.
// One bus per route, which alternates ends after each one-way trip
// (with a short dwell at each terminus). This represents "2 buses
// staggered on the route" without ever rendering both at once.
const busStates = new Map();

const AVG_SPEED_KMH   = 25;   // real-world city-bus speed, also used for ETA calc
const SIM_TIME_SCALE  = 6;    // demo speed-up factor (6x) so a route doesn't take 15–20 real minutes to watch
const TICK_SECONDS    = 2;    // must match LIVE_MS in the frontend poller
const KM_PER_TICK     = (AVG_SPEED_KMH * SIM_TIME_SCALE) * (TICK_SECONDS / 3600);
const DWELL_TICKS     = 3;    // ~6s pause at each terminus before heading back

// Haversine distance in km
function haversine(lat1, lon1, lat2, lon2) {
  const R  = 6371;
  const dL = ((lat2 - lat1) * Math.PI) / 180;
  const dO = ((lon2 - lon1) * Math.PI) / 180;
  const a  =
    Math.sin(dL / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dO / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ETA formula: distance / avg speed (25 km/h city bus, real-world pace —
// intentionally NOT scaled by SIM_TIME_SCALE, so displayed ETAs stay meaningful)
function calcETA(distKm) {
  const mins = Math.round((distKm / AVG_SPEED_KMH) * 60);
  if (mins <= 0)  return 'Arriving';
  if (mins === 1) return '1 min';
  return `${mins} mins`;
}

// Interpolate a lat/lng at a given distance-from-origin along a route's
// polyline, using its precomputed cumulative-distance table.
function interpolatePosition(bus, distanceFromOrigin) {
  const { polyline, cum, totalKm } = bus;
  const d = Math.max(0, Math.min(distanceFromOrigin, totalKm));

  let i = 0;
  while (i < cum.length - 2 && cum[i + 1] < d) i++;

  const segStart = cum[i];
  const segEnd   = cum[i + 1] ?? segStart;
  const segLen   = segEnd - segStart;
  const t        = segLen > 0 ? (d - segStart) / segLen : 0;

  const p0 = polyline[i];
  const p1 = polyline[i + 1] ?? p0;

  return {
    lat: p0.lat + (p1.lat - p0.lat) * t,
    lng: p0.lng + (p1.lng - p0.lng) * t
  };
}

// Init one bus per route, with a cumulative-distance table so movement
// can be driven by real km travelled rather than raw polyline point count.
async function initSimulator() {
  const routes = await BusRoute.find({ isActive: true });

  routes.forEach(route => {
    if (!route.polyline || route.polyline.length < 2) return;

    const cum = [0];
    for (let i = 1; i < route.polyline.length; i++) {
      const prev = route.polyline[i - 1];
      const curr = route.polyline[i];
      cum.push(cum[i - 1] + haversine(prev.lat, prev.lng, curr.lat, curr.lng));
    }
    const totalKm = cum[cum.length - 1];
    if (!totalKm) return; // degenerate route, skip

    busStates.set(route.routeNumber, {
      routeNumber:    route.routeNumber,
      routeName:      route.name,
      color:          route.color,
      polyline:       route.polyline,
      stops:          route.stops,
      cum,
      totalKm,
      activeEnd:      'A',   // 'A' = outbound (origin -> destination), 'B' = return leg
      traveledKm:     0,
      dwellTicksLeft: 0,
      lastUpdate:     Date.now()
    });
  });

  console.log(
    `✅ Bus simulator started — ${busStates.size} routes active (1 bus per route, alternating ends)`
  );
}

// Tick — advance each bus by real distance; on reaching a terminus,
// dwell briefly then hand off to the return leg (still the same marker).
function tick() {
  busStates.forEach((bus) => {
    if (bus.dwellTicksLeft > 0) {
      bus.dwellTicksLeft -= 1;
      bus.lastUpdate = Date.now();
      return;
    }

    bus.traveledKm += KM_PER_TICK;

    if (bus.traveledKm >= bus.totalKm) {
      bus.traveledKm    = 0;
      bus.activeEnd      = bus.activeEnd === 'A' ? 'B' : 'A';
      bus.dwellTicksLeft  = DWELL_TICKS;
    }

    bus.lastUpdate = Date.now();
  });
}

// Get current positions of all buses with ETA to each stop
function getBusPositions() {
  const result = [];

  busStates.forEach((bus) => {
    const distanceFromOrigin = bus.activeEnd === 'A'
      ? bus.traveledKm
      : bus.totalKm - bus.traveledKm;

    const pos = interpolatePosition(bus, distanceFromOrigin);

    const stopsWithETA = bus.stops
      .slice()
      .sort((a, b) => a.sequence - b.sequence)
      .map(stop => {
        const dist = haversine(pos.lat, pos.lng, stop.lat, stop.lng);
        return {
          name:     stop.name,
          lat:      stop.lat,
          lng:      stop.lng,
          sequence: stop.sequence,
          distance: dist.toFixed(2),
          eta:      calcETA(dist)
        };
      });

    result.push({
      routeNumber: bus.routeNumber,
      routeName:   bus.routeName,
      color:       bus.color,
      lat:         pos.lat,
      lng:         pos.lng,
      direction:   bus.activeEnd === 'A' ? 'outbound' : 'inbound',
      lastUpdate:  bus.lastUpdate,
      stops:       stopsWithETA
    });
  });

  return result;
}

module.exports = { initSimulator, tick, getBusPositions, haversine, calcETA };