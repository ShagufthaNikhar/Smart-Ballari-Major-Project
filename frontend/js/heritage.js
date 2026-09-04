const BACKEND = window.SB_API;
const BALLARI = [15.1394, 76.9214];

let map;
let sites        = [];
let siteMarkers  = new Map();
let activeSite   = null;
let userLat      = null;
let userLng      = null;

// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initMap();
  await loadSites();
  detectUserLocation();
});

// ── MAP ───────────────────────────────────────────────
function initMap() {
  map = L.map('heritage-map').setView(BALLARI, 10);

  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    { attribution: '© CartoDB', maxZoom: 19 }
  ).addTo(map);
}

// ── LOAD SITES ────────────────────────────────────────
async function loadSites() {
  try {
    const res = await fetch(`${BACKEND}/api/heritage/sites`);
    sites     = await res.json();
    renderSiteList(sites);
    renderSiteMarkers(sites);
  } catch {
    document.getElementById('site-list').innerHTML =
      '<p style="color:#ef4444; padding:1rem;">Could not load sites.</p>';
  }
}

// ── SITE LIST ─────────────────────────────────────────
function renderSiteList(sites) {
  const typeConfig = {
    fort:      { color: '#ef4444', label: 'Fort'       },
    temple:    { color: '#f59e0b', label: 'Temple'     },
    monument:  { color: '#38bdf8', label: 'Monument'   },
    sanctuary: { color: '#22c55e', label: 'Sanctuary'  }
  };

  document.getElementById('site-list').innerHTML =
    sites.map(site => {
      const cfg = typeConfig[site.type] || { color:'#94a3b8', label:'Site' };
      return `
        <div class="site-card" id="card-${site.id}"
          onclick="selectSite('${site.id}')">

          <div class="site-type-badge"
            style="background:${cfg.color}22; color:${cfg.color};">
            ${cfg.label}
          </div>

          <div class="site-name">${site.name}</div>
          <div class="site-name-kn">${site.nameKannada}</div>
          <div class="site-period">
            🏛️ ${site.dynasty} &bull; ${site.period}
          </div>

          <div class="site-btns">
            <button class="site-btn"
              style="background:#f59e0b22; color:#f59e0b;"
              onclick="event.stopPropagation();
                       flyToSite('${site.id}')">
              🗺️ Map
            </button>
            <button class="site-btn"
              style="background:#7c3aed22; color:#a78bfa;"
              onclick="event.stopPropagation();
                       launchARForSite('${site.id}')">
              📷 AR View
            </button>
            <button class="site-btn"
              style="background:#38bdf822; color:#38bdf8;"
              onclick="event.stopPropagation();
                       showDetails('${site.id}')">
              ℹ️ Info
            </button>
          </div>
        </div>
      `;
    }).join('');
}

// ── MAP MARKERS ───────────────────────────────────────
function renderSiteMarkers(sites) {
  const typeIcon = {
    fort:      '🏰', temple:    '🛕',
    monument:  '🗿', sanctuary: '🌿'
  };

  const typeColor = {
    fort:      '#ef4444', temple:    '#f59e0b',
    monument:  '#38bdf8', sanctuary: '#22c55e'
  };

  sites.forEach(site => {
    const color = typeColor[site.type] || '#94a3b8';
    const icon  = typeIcon[site.type]  || '📍';

    const marker = L.marker(
      [site.location.lat, site.location.lng],
      {
        icon: L.divIcon({
          className: '',
          html: `
            <div style="
              background:${color}22;
              border:2px solid ${color};
              border-radius:50%;
              width:44px; height:44px;
              display:flex; align-items:center;
              justify-content:center;
              font-size:22px;
              box-shadow:0 2px 8px rgba(0,0,0,0.4);
              cursor:pointer;
            ">${icon}</div>
          `,
          iconSize:   [44, 44],
          iconAnchor: [22, 22]
        })
      }
    ).addTo(map);

    marker.bindPopup(buildSitePopup(site));
    marker.on('click', () => selectSite(site.id));
    siteMarkers.set(site.id, marker);
  });
}

function buildSitePopup(site) {
  return `
    <div style="min-width:200px; font-family:sans-serif;">
      <b style="color:#f59e0b;">${site.name}</b><br/>
      <span style="color:#94a3b8; font-size:0.8rem;">
        ${site.nameKannada}
      </span><br/>
      <hr style="border-color:#334155; margin:6px 0;"/>
      <p style="font-size:0.8rem; color:#cbd5e1; margin:4px 0;">
        ${site.description.slice(0, 100)}...
      </p>
      <div style="display:flex; gap:6px; margin-top:8px;">
        <button onclick="launchARForSite('${site.id}')"
          style="flex:1; padding:4px 8px; background:#f59e0b;
                 color:#0f172a; border:none; border-radius:6px;
                 cursor:pointer; font-size:0.75rem; font-weight:bold;">
          📷 AR View
        </button>
        <button onclick="showDetails('${site.id}')"
          style="flex:1; padding:4px 8px; background:#334155;
                 color:#f1f5f9; border:none; border-radius:6px;
                 cursor:pointer; font-size:0.75rem;">
          ℹ️ Info
        </button>
      </div>
    </div>
  `;
}

// ── SELECT SITE ───────────────────────────────────────
window.selectSite = (id) => {
  activeSite = sites.find(s => s.id === id);
  if (!activeSite) return;

  document.querySelectorAll('.site-card').forEach(c =>
    c.classList.remove('active')
  );
  document.getElementById(`card-${id}`)?.classList.add('active');

  flyToSite(id);
  showDetails(id);
};

window.flyToSite = (id) => {
  const site = sites.find(s => s.id === id);
  if (!site) return;
  map.flyTo([site.location.lat, site.location.lng], 16, {
    duration: 1.5
  });
  siteMarkers.get(id)?.openPopup();
};

// ── DETAIL PANEL ──────────────────────────────────────
window.showDetails = (id) => {
  const site = sites.find(s => s.id === id);
  if (!site) return;

  document.getElementById('dp-title').innerText =
    `${site.name} (${site.period})`;
  document.getElementById('dp-desc').innerText =
    site.description;
  document.getElementById('dp-facts').innerHTML =
    site.facts.map(f => `<li>${f}</li>`).join('');

  document.getElementById('detail-panel').classList.add('open');
};

// ── USER LOCATION ─────────────────────────────────────
function detectUserLocation() {
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      userLat = coords.latitude;
      userLng = coords.longitude;

      // User dot
      L.circleMarker([userLat, userLng], {
        radius: 8, fillColor: '#38bdf8',
        color: '#0f172a', fillOpacity: 1, weight: 2
      }).addTo(map).bindTooltip('📍 You');

      // Find nearest
      findNearest(userLat, userLng);
    },
    () => { /* silent fail */ }
  );
}

async function findNearest(lat, lng) {
  try {
    const res  = await fetch(
      `${BACKEND}/api/heritage/nearest?lat=${lat}&lng=${lng}&radius=200`
    );
    const data = await res.json();
    if (!data.length) return;

    const nearest = data[0];
    document.getElementById('dist-badge').style.display = 'block';
    document.getElementById('nearest-name').innerText   = nearest.name;
    document.getElementById('nearest-dist').innerText   =
      `${nearest.distance.toFixed(1)} km away`;
  } catch { /* silent */ }
}

// ── AR LAUNCHER ───────────────────────────────────────
window.launchARForSite = (id) => {
  const site = sites.find(s => s.id === id);
  if (!site) return;
  activeSite = site;

  // Open AR page with site context
  const params = new URLSearchParams({
    site: site.id,
    name: site.name,
    lat:  site.location.lat,
    lng:  site.location.lng,
    mode: 'gps'
  });

  window.open(`ar-view.html?${params}`, '_blank');
};

window.launchGPSAR = () => {
  if (!activeSite) {
    showToast('Select a heritage site first.', 'warning');
    return;
  }
  launchARForSite(activeSite.id);
};

window.launchMarkerAR = () => {
  if (!activeSite) {
    showToast('Select a heritage site first.', 'warning');
    return;
  }

  const params = new URLSearchParams({
    site: activeSite.id,
    name: activeSite.name,
    mode: 'marker'
  });
  window.open(`ar-view.html?${params}`, '_blank');
};