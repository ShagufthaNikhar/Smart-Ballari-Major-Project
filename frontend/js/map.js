// ── CONFIG ──────────────────────────────────────────
const BALLARI_CENTER = [15.1394, 76.9214];
const BACKEND = 'http://localhost:5000';

// ── INIT MAP ────────────────────────────────────────
const map = L.map('map').setView(BALLARI_CENTER, 13);

// Base tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 19
}).addTo(map);

// ── CATEGORY CONFIG ─────────────────────────────────
const categoryConfig = {
  road:       { color: '#f59e0b', emoji: '🛣️', layerId: 'layer-road' },
  water:      { color: '#38bdf8', emoji: '💧', layerId: 'layer-water' },
  electric:   { color: '#facc15', emoji: '⚡', layerId: 'layer-electric' },
  sanitation: { color: '#a3e635', emoji: '🗑️', layerId: 'layer-sanitation' },
  other:      { color: '#e2e8f0', emoji: '📦', layerId: 'layer-all' }
};

// ── LAYER GROUPS ────────────────────────────────────
const layers = {
  road:       L.layerGroup().addTo(map),
  water:      L.layerGroup().addTo(map),
  electric:   L.layerGroup().addTo(map),
  sanitation: L.layerGroup().addTo(map),
  other:      L.layerGroup().addTo(map)
};

// ── CUSTOM MARKER ───────────────────────────────────
function makeIcon(category) {
  const cfg = categoryConfig[category] || categoryConfig.other;
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${cfg.color};
      width:32px; height:32px;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      border:2px solid #0f172a;
      display:flex; align-items:center; justify-content:center;
    "><span style="transform:rotate(45deg);font-size:14px;">${cfg.emoji}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -34]
  });
}

// ── LOAD ISSUES FROM BACKEND ─────────────────────────
async function loadIssues() {
  try {
    const res = await fetch(`${BACKEND}/api/issues`);
    const issues = await res.json();
    issues.forEach(issue => addMarker(issue));
  } catch {
    console.warn('Backend not ready — map markers skipped');
  }
}

function addMarker(issue) {
  const { lat, lng } = issue.location.coordinates;
  const cat = issue.category || 'other';
  const layer = layers[cat] || layers.other;

  const marker = L.marker([lat, lng], { icon: makeIcon(cat) });

  // Show image in popup if available
  const imgHtml = issue.imageUrl
    ? `<img src="${issue.imageUrl}"
        style="width:100%; border-radius:6px;
               margin-top:8px; max-height:120px;
               object-fit:cover;" />`
    : '';

  marker.bindPopup(`
    <div style="min-width:210px;">
      <b>${issue.title}</b><br/>
      <span style="color:#64748b;font-size:0.78rem;">
      ${issue.category} • ${issue.status}</span>
      <p style="margin:6px 0;font-size:0.85rem;">
      ${issue.description || ''}
      </p>
      <code style="font-size:0.75rem; color:#38bdf8;">
        ${issue.grievanceId || ''}
      </code>
       ${imgHtml}
      <br/><small>📍 ${issue.location.address || ''}</small>
      <div style="margin-top:8px;">
        <button onclick="window.openDirections(${lat}, ${lng}, '${(issue.title || 'Issue').replace(/'/g, "\\'")}')"
          style="background:#38bdf8;color:#0f172a;border:none;padding:0.4rem 0.8rem;
                 border-radius:6px;font-size:0.78rem;font-weight:600;cursor:pointer;">
          🧭 Directions
        </button>
      </div>
    </div>
  `);

  marker.addTo(layer);
}

// ── GPS LOCATION ─────────────────────────────────────
let gpsMarker = null;
let lastKnownPosition = null; // { lat, lng } — reused as the origin for Directions

document.getElementById('btn-gps').addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert('Geolocation not supported on this device.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      lastKnownPosition = { lat: latitude, lng: longitude };

      // Remove old GPS marker
      if (gpsMarker) map.removeLayer(gpsMarker);

      gpsMarker = L.circleMarker([latitude, longitude], {
        radius: 10,
        fillColor: '#38bdf8',
        color: '#0f172a',
        fillOpacity: 0.9,
        weight: 2
      }).addTo(map).bindPopup('📍 You are here').openPopup();

      map.setView([latitude, longitude], 16);
    },
    () => alert('Could not get your location.')
  );
});

// ── RESET VIEW ────────────────────────────────────────
document.getElementById('btn-reset').addEventListener('click', () => {
  map.setView(BALLARI_CENTER, 13);
});

// ── PIN ISSUE (click on map) ──────────────────────────
let pinMode = false;
let selectedLatLng = null;

document.getElementById('btn-pin').addEventListener('click', () => {
  pinMode = !pinMode;
  const btn = document.getElementById('btn-pin');
  btn.classList.toggle('active', pinMode);
  btn.innerText = pinMode ? '❌ Cancel Pin' : '📌 Pin Issue';
  map.getContainer().style.cursor = pinMode ? 'crosshair' : '';
});

map.on('click', (e) => {
  if (!pinMode) return;
  selectedLatLng = e.latlng;

  // Show modal
  document.getElementById('modal-coords').innerText =
    `📍 Lat: ${e.latlng.lat.toFixed(5)}, Lng: ${e.latlng.lng.toFixed(5)}`;
  document.getElementById('modal-overlay').classList.add('open');

  // Exit pin mode
  pinMode = false;
  document.getElementById('btn-pin').classList.remove('active');
  document.getElementById('btn-pin').innerText = '📌 Pin Issue';
  map.getContainer().style.cursor = '';
});

// ── SUBMIT ISSUE ──────────────────────────────────────
document.getElementById('submit-issue').addEventListener('click', async () => {
  const title    = document.getElementById('issue-title').value.trim();
  const category = document.getElementById('issue-category').value;
  const desc     = document.getElementById('issue-desc').value.trim();

  if (!title || !category) {
    alert('Please fill in title and category.');
    return;
  }

  // Get fresh Firebase token
  const { auth } = await import('./firebase-config.js');
  const token = await auth.currentUser?.getIdToken();

  if (!token) {
    alert('You must be logged in to report an issue.');
    return;
  }

  const payload = {
    title,
    category,
    description: desc,
    location: {
      coordinates: {
        lat: selectedLatLng.lat,
        lng: selectedLatLng.lng
      },
      address: `Lat ${selectedLatLng.lat.toFixed(4)}, Lng ${selectedLatLng.lng.toFixed(4)}`
    },
    status: 'open',
    
  };

  try {
    const res = await fetch(`${BACKEND}/api/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' ,
      'Authorization': `Bearer ${token}` 
    },
      body: JSON.stringify(payload)
    });

    if (res.status === 403) {
      alert('You do not have permission to report issues.');
      return;
    }
    
    const saved = await res.json();
    addMarker(saved);        // Instantly show on map
    closeModal();
  } catch {
    alert('Could not save issue. Is the backend running?');
  }
});

// ── CANCEL MODAL ──────────────────────────────────────
document.getElementById('cancel-modal').addEventListener('click', closeModal);

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.getElementById('issue-title').value = '';
  document.getElementById('issue-category').value = '';
  document.getElementById('issue-desc').value = '';
}

// ── ISSUE LAYER TOGGLES ────────────────────────────────
const layerMap = {
  'layer-road':       layers.road,
  'layer-water':      layers.water,
  'layer-electric':   layers.electric,
  'layer-sanitation': layers.sanitation,
  'layer-all':        layers.other
};

Object.keys(layerMap).forEach(id => {
  document.getElementById(id).addEventListener('change', (e) => {
    if (e.target.checked) map.addLayer(layerMap[id]);
    else map.removeLayer(layerMap[id]);
  });
});

// ══════════════════════════════════════════════════════
// NEARBY PLACES — hospitals, schools, government offices,
// fire stations. Pulled from OpenStreetMap (Overpass API)
// on demand, the first time each checkbox is switched on,
// then cached in a layer group for the rest of the session.
// ══════════════════════════════════════════════════════

// south,west,north,east — roughly Ballari city + surrounds
const BALLARI_BBOX = '15.03,76.83,15.26,77.02';

// Overpass has one free public instance that gets overloaded easily
// (that's the 504 Gateway Timeout) — so we try a short list of mirrors
// in order and use whichever answers first.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter'
];

const POI_TYPES = {
  hospital: { filters: ['amenity=hospital'],                                emoji: '🏥', color: '#ef4444', label: 'Hospital' },
  school:   { filters: ['amenity=school'],                                  emoji: '🏫', color: '#8b5cf6', label: 'School' },
  govt:     { filters: ['office=government'],                               emoji: '🏛️', color: '#0ea5e9', label: 'Government Office' },
  fire:     { filters: ['amenity=fire_station'],                            emoji: '🚒', color: '#f97316', label: 'Fire Station' },
  bank:     { filters: ['amenity=bank'],                                    emoji: '🏦', color: '#22c55e', label: 'Bank' },
  police:   { filters: ['amenity=police'],                                  emoji: '🚓', color: '#3b82f6', label: 'Police Station' },
  bus:      { filters: ['amenity=bus_station'],                             emoji: '🚌', color: '#eab308', label: 'Bus Terminal' },
  park:     { filters: ['leisure=park'],                                    emoji: '🌳', color: '#16a34a', label: 'City Park' },
  temple:   { filters: ['amenity=place_of_worship', 'religion=hindu'],      emoji: '🛕', color: '#f59e0b', label: 'Temple' },
  church:   { filters: ['amenity=place_of_worship', 'religion=christian'],  emoji: '⛪', color: '#a855f7', label: 'Church' },
  masjid:   { filters: ['amenity=place_of_worship', 'religion=muslim'],     emoji: '🕌', color: '#14b8a6', label: 'Masjid' }
};

const poiLayers = {};
const poiLoaded = {};
Object.keys(POI_TYPES).forEach(type => {
  poiLayers[type] = L.layerGroup();
  poiLoaded[type] = false;
});

function makePoiIcon(type) {
  const cfg = POI_TYPES[type];
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${cfg.color};
      width:28px; height:28px;
      border-radius:50%;
      border:2px solid #0f172a;
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 2px 6px rgba(0,0,0,0.4);
    "><span style="font-size:13px;">${cfg.emoji}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16]
  });
}

function addPoiMarker(type, lat, lng, name) {
  const cfg = POI_TYPES[type];
  const marker = L.marker([lat, lng], { icon: makePoiIcon(type) });

  marker.bindPopup(`
    <div style="min-width:190px;">
      <b>${cfg.emoji} ${name}</b><br/>
      <span style="color:#64748b;font-size:0.78rem;">${cfg.label}</span>
      <div style="margin-top:8px;">
        <button onclick="window.openDirections(${lat}, ${lng}, '${name.replace(/'/g, "\\'")}')"
          style="background:#38bdf8;color:#0f172a;border:none;padding:0.4rem 0.8rem;
                 border-radius:6px;font-size:0.78rem;font-weight:600;cursor:pointer;">
          🧭 Directions
        </button>
      </div>
    </div>
  `);

  marker.addTo(poiLayers[type]);
}

async function loadPoiLayer(type) {
  if (poiLoaded[type]) return; // already fetched this session
  poiLoaded[type] = true;

  const cfg = POI_TYPES[type];
  const loadingEl = document.getElementById(`loading-${type}`);
  if (loadingEl) loadingEl.classList.add('show');

  const tagFilters = cfg.filters.map(f => `[${f}]`).join('');
  const query = `
    [out:json][timeout:20];
    (
      node${tagFilters}(${BALLARI_BBOX});
      way${tagFilters}(${BALLARI_BBOX});
    );
    out center;
  `;

  // Try each mirror in turn; each attempt gets its own 12s timeout so a
  // stalled/overloaded server (504) doesn't hang the whole toggle.
  let data = null;
  let lastError = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: query,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) { lastError = new Error(`HTTP ${res.status}`); continue; }
      data = await res.json();
      break; // success — stop trying further mirrors
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      // try next mirror
    }
  }

  if (!data) {
    poiLoaded[type] = false; // allow retry on next toggle
    if (loadingEl) loadingEl.classList.remove('show');
    if (window.showToast) {
      showToast(`${cfg.label}s are taking too long to load — try again in a moment.`, 'error');
    } else {
      console.warn(`Could not load ${type} layer:`, lastError);
    }
    return;
  }

  try {
    data.elements.forEach(el => {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (lat == null || lng == null) return;
      const name = el.tags?.name || cfg.label;
      addPoiMarker(type, lat, lng, name);
    });

    if (!data.elements.length && window.showToast) {
      showToast(`No ${cfg.label.toLowerCase()}s found nearby.`, 'info');
    }
  } finally {
    if (loadingEl) loadingEl.classList.remove('show');
  }
}

Object.keys(POI_TYPES).forEach(type => {
  const checkbox = document.getElementById(`layer-${type}`);
  if (!checkbox) return;
  checkbox.addEventListener('change', async (e) => {
    if (e.target.checked) {
      await loadPoiLayer(type);
      map.addLayer(poiLayers[type]);
    } else {
      map.removeLayer(poiLayers[type]);
    }
  });
});

// ── DIRECTIONS ──────────────────────────────────────────
// Opens Google Maps directions from the user's last known GPS
// position (captured via "📍 My Location") to the given point.
// If we don't have a position yet, ask for one now; if that's
// denied, Google Maps falls back to using the device's location.
window.openDirections = (destLat, destLng, destName) => {
  const dest = `${destLat},${destLng}`;

  const openWithOrigin = (origin) => {
    const originParam = origin ? `&origin=${origin.lat},${origin.lng}` : '';
    window.open(
      `https://www.google.com/maps/dir/?api=1${originParam}&destination=${dest}&travelmode=driving`,
      '_blank'
    );
  };

  if (lastKnownPosition) {
    openWithOrigin(lastKnownPosition);
    return;
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lastKnownPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        openWithOrigin(lastKnownPosition);
      },
      () => openWithOrigin(null) // let Google Maps use the device location itself
    );
    return;
  }

  openWithOrigin(null);
};

// ── START ──────────────────────────────────────────────
loadIssues();