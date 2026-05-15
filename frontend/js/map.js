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
    </div>
  `);
  
  marker.addTo(layer);
}

// ── GPS LOCATION ─────────────────────────────────────
let gpsMarker = null;

document.getElementById('btn-gps').addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert('Geolocation not supported on this device.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;

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
  const { getAuth } = await import(
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'
  );
  const token = await getAuth().currentUser?.getIdToken();

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

// ── LAYER TOGGLES ─────────────────────────────────────
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

// ── START ──────────────────────────────────────────────
loadIssues();