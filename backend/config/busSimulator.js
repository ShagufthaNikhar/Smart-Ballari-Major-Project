const BusRoute = require('../models/BusRoute');

// In-memory bus state — no DB needed for simulation
const busStates = new Map();

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

// ETA formula: distance / avg speed (25 km/h city bus)
function calcETA(distKm) {
  const AVG_SPEED = 25;
  const mins = Math.round((distKm / AVG_SPEED) * 60);
  if (mins <= 0)  return 'Arriving';
  if (mins === 1) return '1 min';
  return `${mins} mins`;
}

// Init one bus per route
async function initSimulator() {
  const routes = await BusRoute.find({ isActive: true });

  routes.forEach(route => {
    if (!route.polyline.length) return;

    busStates.set(route.routeNumber, {
      routeNumber: route.routeNumber,
      routeName:   route.name,
      color:       route.color,
      polyline:    route.polyline,
      stops:       route.stops,
      // Start at random point in route for realism
      pointIndex:  Math.floor(Math.random() * route.polyline.length),
      direction:   1,       // 1 = forward, -1 = reverse
      speed:       0.0004,  // degrees per tick (simulate ~25km/h)
      lastUpdate:  Date.now()
    });
  });

  console.log(`✅ Bus simulator started — ${busStates.size} buses active`);
}

// Tick — advance each bus one step along polyline
function tick() {
  busStates.forEach((bus, key) => {
    const next = bus.pointIndex + bus.direction;

    // Reverse at endpoints
    if (next >= bus.polyline.length || next < 0) {
      bus.direction *= -1;
    }

    bus.pointIndex += bus.direction;
    bus.lastUpdate  = Date.now();
    busStates.set(key, bus);
  });
}

// Get current positions of all buses with ETA to each stop
function getBusPositions() {
  const result = [];

  busStates.forEach((bus) => {
    const pos = bus.polyline[bus.pointIndex];
    if (!pos) return;

    // Calculate ETA to each stop
    const stopsWithETA = bus.stops
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
      direction:   bus.direction === 1 ? 'outbound' : 'inbound',
      lastUpdate:  bus.lastUpdate,
      stops:       stopsWithETA
    });
  });

  return result;
}

module.exports = { initSimulator, tick, getBusPositions, haversine, calcETA };