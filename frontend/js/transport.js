const BACKEND    = 'http://localhost:5000';
const BALLARI    = [15.1394, 76.9214];
const LIVE_MS    = 2000;   // poll every 2s

let map;
let allRoutes      = [];
let activeRoute    = null;
let busMarkers     = new Map();
let routeLayer     = null;
let stopMarkers    = [];
let liveInterval   = null;

// ── INIT MAP ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  map = L.map('transport-map').setView(BALLARI, 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  await loadRoutes();
  startLiveTracking();
});

// ── LOAD ROUTES ───────────────────────────────────────
async function loadRoutes() {
  try {
    const res   = await fetch(`${BACKEND}/api/transport/routes`);
    allRoutes   = await res.json();
    renderRouteList(allRoutes);
  } catch {
    document.getElementById('route-list').innerHTML =
      '<p style="color:#ef4444;padding:1rem;">Could not load routes.</p>';
  }
}

// ── RENDER SIDEBAR ────────────────────────────────────
function renderRouteList(routes) {
  const container = document.getElementById('route-list');

  if (!routes.length) {
    container.innerHTML =
      '<p style="color:#64748b;padding:1rem;">No routes found.</p>';
    return;
  }

  container.innerHTML = routes.map(r => `
    <div class="route-card" id="card-${r.routeNumber}"
      style="--route-color:${r.color}"
      onclick="selectRoute('${r.routeNumber}')">
      <div class="route-number"
        style="background:${r.color};">
        ${r.routeNumber}
      </div>
      <div class="route-name">${r.name}</div>
      <div class="route-meta">
        📍 ${r.from} → ${r.to}
      </div>
      <div class="route-freq">
        🕐 Every ${r.frequency} mins &nbsp;|&nbsp;
        ${r.firstBus} – ${r.lastBus}
      </div>
    </div>
  `).join('');
}

// ── SELECT ROUTE ──────────────────────────────────────
async function selectRoute(routeNumber) {
  // Deactivate previous
  document.querySelectorAll('.route-card').forEach(c =>
    c.classList.remove('active')
  );

  const card = document.getElementById(`card-${routeNumber}`);
  if (card) card.classList.add('active');

  // Clear previous route layer + stop markers
  if (routeLayer) map.removeLayer(routeLayer);
  stopMarkers.forEach(m => map.removeLayer(m));
  stopMarkers = [];

  // Fetch full route
  const res   = await fetch(`${BACKEND}/api/transport/routes/${routeNumber}`);
  const route = await res.json();
  activeRoute = route;

  // Draw polyline
  const latlngs = route.polyline.map(p => [p.lat, p.lng]);
  routeLayer = L.polyline(latlngs, {
    color:  route.color,
    weight: 5,
    opacity: 0.8,
    dashArray: null
  }).addTo(map);

  map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });

  // Draw stop markers
  route.stops
    .sort((a, b) => a.sequence - b.sequence)
    .forEach((stop, i) => {
      const isTerminal = i === 0 || i === route.stops.length - 1;
      const marker = L.circleMarker([stop.lat, stop.lng], {
        radius:      isTerminal ? 10 : 7,
        fillColor:   isTerminal ? route.color : '#f1f5f9',
        color:       route.color,
        fillOpacity: 1,
        weight:      2
      }).addTo(map);

      marker.bindTooltip(stop.name, {
        permanent:  false,
        direction: 'top',
        className: 'stop-tooltip'
      });

      stopMarkers.push(marker);
    });

  // Show stop panel
  renderStopPanel(route);
}

// ── STOP PANEL ────────────────────────────────────────
function renderStopPanel(route) {
  const panel = document.getElementById('stop-panel');
  panel.classList.add('open');

  document.getElementById('stop-panel-title').innerText =
    `${route.routeNumber} — Stops (${route.stops.length})`;

  const liveData  = [...busMarkers.values()];
  const thisBus   = liveData.find(b => b.routeNumber === route.routeNumber);

  document.getElementById('stop-list').innerHTML = route.stops
    .sort((a, b) => a.sequence - b.sequence)
    .map((stop, i) => {
      const eta = thisBus?.stops?.[i]?.eta || '—';
      return `
        <div class="stop-item">
          <div class="stop-dot"
            style="background:${route.color}"></div>
          <div>${stop.name}</div>
          <div class="stop-eta">${eta}</div>
        </div>
      `;
    }).join('');
}

// ── LIVE BUS TRACKING ─────────────────────────────────
function startLiveTracking() {
  fetchLive();
  liveInterval = setInterval(fetchLive, LIVE_MS);
}

async function fetchLive() {
  try {
    const res  = await fetch(`${BACKEND}/api/transport/live`);
    const data = await res.json();
    updateBusMarkers(data);

    // Refresh stop ETAs if route selected
    if (activeRoute) {
      const thisBus = data.find(
        b => b.routeNumber === activeRoute.routeNumber
      );
      if (thisBus) refreshStopETAs(thisBus);
    }

  } catch { /* silent fail */ }
}

// ── BUS MARKERS ───────────────────────────────────────
function updateBusMarkers(buses) {
  const seen = new Set();

  buses.forEach(bus => {
    seen.add(bus.routeNumber);

    if (busMarkers.has(bus.routeNumber)) {
      // Smooth move existing marker
      const existing = busMarkers.get(bus.routeNumber);
      existing.marker.setLatLng([bus.lat, bus.lng]);
      existing.routeNumber = bus.routeNumber;
      existing.stops       = bus.stops;
    } else {
      // Create new bus marker
      const icon = makeBusIcon(bus.color, bus.routeNumber);
      const marker = L.marker([bus.lat, bus.lng], { icon })
        .addTo(map);

      marker.bindPopup(() => buildBusPopup(bus));

      busMarkers.set(bus.routeNumber, {
        marker,
        routeNumber: bus.routeNumber,
        stops:       bus.stops
      });
    }
  });

  // Remove stale markers
  busMarkers.forEach((val, key) => {
    if (!seen.has(key)) {
      map.removeLayer(val.marker);
      busMarkers.delete(key);
    }
  });
}

// ── BUS ICON ──────────────────────────────────────────
function makeBusIcon(color, label) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        background:${color};
        color:#0f172a;
        padding:4px 8px;
        border-radius:8px;
        font-size:11px;
        font-weight:bold;
        border:2px solid #0f172a;
        white-space:nowrap;
        box-shadow:0 2px 6px rgba(0,0,0,0.4);
      ">🚍 ${label}</div>`,
    iconSize:   [70, 28],
    iconAnchor: [35, 14]
  });
}

// ── BUS POPUP ─────────────────────────────────────────
function buildBusPopup(bus) {
  const nextStops = (bus.stops || []).slice(0, 3);
  const stopRows  = nextStops.map(s =>
    `<tr>
      <td style="padding:3px 6px;color:#94a3b8;">${s.name}</td>
      <td style="padding:3px 6px;color:#f59e0b;font-weight:bold;">${s.eta}</td>
    </tr>`
  ).join('');

  return `
    <div style="min-width:200px; font-family:sans-serif;">
      <b style="color:#38bdf8;">${bus.routeNumber}</b>
      <span style="color:#64748b; font-size:0.8rem;">
        &nbsp;${bus.direction}
      </span>
      <hr style="border-color:#334155; margin:6px 0;" />
      <table style="width:100%; font-size:0.82rem;">
        <tr>
          <th style="text-align:left; color:#475569;
                     padding:3px 6px;">Stop</th>
          <th style="text-align:left; color:#475569;
                     padding:3px 6px;">ETA</th>
        </tr>
        ${stopRows}
      </table>
    </div>
  `;
}

// ── REFRESH STOP ETAs IN PANEL ─────────────────────────
function refreshStopETAs(bus) {
  const items = document.querySelectorAll('.stop-eta');
  const sorted = (bus.stops || []).sort((a, b) => a.sequence - b.sequence);
  items.forEach((el, i) => {
    if (sorted[i]) el.innerText = sorted[i].eta;
  });
}

// ── ROUTE SEARCH FILTER ───────────────────────────────
window.filterRoutes = () => {
  const q = document.getElementById('route-search')
    .value.toLowerCase();
  const filtered = allRoutes.filter(r =>
    r.name.toLowerCase().includes(q)       ||
    r.routeNumber.toLowerCase().includes(q)||
    r.from.toLowerCase().includes(q)       ||
    r.to.toLowerCase().includes(q)         ||
    r.stops.some(s => s.name.toLowerCase().includes(q))
  );
  renderRouteList(filtered);
};