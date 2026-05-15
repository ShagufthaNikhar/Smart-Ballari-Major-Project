const BACKEND = 'http://localhost:5000';

// ── PARSE URL PARAMS ───────────────────────────────────
const params  = new URLSearchParams(window.location.search);
const siteId  = params.get('site')  || 'ballari-fort';
const siteName = params.get('name') || 'Heritage Site';
const siteLat  = parseFloat(params.get('lat') || '15.1425');
const siteLng  = parseFloat(params.get('lng') || '76.9198');
const initMode = params.get('mode') || 'gps';

let currentMode = initMode;
let site        = null;
let userLat     = null;
let userLng     = null;
let watchId     = null;

// ── INIT ──────────────────────────────────────────────
window.addEventListener('load', async () => {
  await loadSiteData();
  setupGPS();

  // Show correct AR mode after 2s (camera warmup)
  setTimeout(() => {
    setARMode(currentMode);
    document.getElementById('ar-loading').style.display = 'none';
  }, 2500);
});

// ── LOAD SITE DATA ────────────────────────────────────
async function loadSiteData() {
  try {
    const res = await fetch(`${BACKEND}/api/heritage/sites/${siteId}`);
    site      = await res.json();
  } catch {
    site = {
      name:        siteName,
      nameKannada: '',
      description: 'A historic heritage site of Ballari region.',
      facts:       ['Historical significance', 'Cultural heritage']
    };
  }

  // Fill HUD
  document.getElementById('hud-title').innerText =
    site.name;
  document.getElementById('hud-subtitle').innerText =
    `${site.dynasty || ''} · ${site.period || ''}`;
  document.getElementById('ar-site-name').innerText =
    site.name;
  document.getElementById('ar-site-kn').innerText =
    site.nameKannada || '';
  document.getElementById('ar-site-desc').innerText =
    site.description.slice(0, 120) + '...';
  document.getElementById('ar-site-facts').innerHTML =
    (site.facts || []).slice(0, 2).map(f =>
      `<div class="ar-fact">${f}</div>`
    ).join('');

  // Set AR labels
  const labelEl    = document.getElementById('ar-label');
  const labelSubEl = document.getElementById('ar-label-sub');
  const markerLbl  = document.getElementById('marker-label');

  if (labelEl)    labelEl.setAttribute('value', site.name);
  if (labelSubEl) labelSubEl.setAttribute('value',
    `${site.dynasty} · ${site.period}`);
  if (markerLbl)  markerLbl.setAttribute('value', site.name);
}

// ── GPS SETUP ─────────────────────────────────────────
function setupGPS() {
  if (!navigator.geolocation) {
    document.getElementById('gps-status').innerText =
      '⚠️ GPS not available';
    return;
  }

  watchId = navigator.geolocation.watchPosition(
    ({ coords }) => {
      userLat = coords.latitude;
      userLng = coords.longitude;

      // Update GPS entity position
      updateGPSEntity();

      // Calculate distance
      const dist = haversine(userLat, userLng, siteLat, siteLng);
      updateDistanceDisplay(dist);

      document.getElementById('gps-status').innerText =
        `📡 GPS: ${coords.latitude.toFixed(5)},
         ${coords.longitude.toFixed(5)}
         (±${Math.round(coords.accuracy)}m)`;
    },
    (err) => {
      document.getElementById('gps-status').innerText =
        '⚠️ GPS error — using default location';

      // Fallback to default
      userLat = 15.1394;
      userLng = 76.9214;
      updateGPSEntity();
    },
    {
      enableHighAccuracy: true,
      maximumAge:         0,
      timeout:            10000
    }
  );
}

// ── UPDATE GPS ENTITY ─────────────────────────────────
function updateGPSEntity() {
  const entity     = document.getElementById('heritage-entity');
  const groundRing = document.getElementById('ground-ring');

  if (entity) {
    entity.setAttribute('gps-entity-place',
      `latitude: ${siteLat}; longitude: ${siteLng};`
    );
  }

  if (groundRing) {
    groundRing.setAttribute('gps-entity-place',
      `latitude: ${siteLat}; longitude: ${siteLng};`
    );
  }
}

// ── DISTANCE DISPLAY ──────────────────────────────────
function updateDistanceDisplay(dist) {
  const ring = document.getElementById('dist-ring');
  const km   = document.getElementById('dist-km');

  ring.style.display = 'flex';

  if (dist < 1) {
    km.innerText     = `${Math.round(dist * 1000)}m`;
    ring.style.borderColor = '#22c55e';
    km.style.color   = '#22c55e';
  } else {
    km.innerText     = dist.toFixed(1);
    ring.style.borderColor = dist < 10 ? '#f59e0b' : '#38bdf8';
    km.style.color   = dist < 10 ? '#f59e0b' : '#38bdf8';
  }
}

// ── MODE SWITCH ───────────────────────────────────────
window.setARMode = (mode) => {
  currentMode = mode;

  document.getElementById('mbtn-gps')
    .classList.toggle('active', mode === 'gps');
  document.getElementById('mbtn-marker')
    .classList.toggle('active', mode === 'marker');

  document.getElementById('gps-scene-wrap').style.display =
    mode === 'gps' ? 'block' : 'none';
  document.getElementById('marker-scene-wrap').style.display =
    mode === 'marker' ? 'block' : 'none';

  document.getElementById('loading-msg').innerText =
    mode === 'gps'
      ? 'Finding your location and placing 3D model...'
      : 'Initializing camera for marker detection...';

  if (mode === 'gps') updateGPSEntity();
};

// ── HAVERSINE ─────────────────────────────────────────
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

// Cleanup on exit
window.addEventListener('beforeunload', () => {
  if (watchId) navigator.geolocation.clearWatch(watchId);
});