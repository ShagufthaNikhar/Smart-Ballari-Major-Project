const BACKEND  = window.SB_API;
const BALLARI  = [15.1394, 76.9214];

// Road-closure simulation is admin-only. Everything else on this page
// (map, all layers, shadow analysis, weather, snapshot, issue reporting,
// nearby places) is open to every logged-in role.
const SB_IS_ADMIN = localStorage.getItem('userRole') === 'admin';

// ── SHARED STATE ──────────────────────────────────────
let map;
let tileLayer;
let simPin        = null;
let simPinLatLng  = null;

let layerState = {
  issues: true, traffic: false, pollution: false, crowd: false, shadow: false,
  heat: false, rain: false, flood: false, wind: false
};
let layerGroups = {};

let simLayers    = [];
let snapshot     = null;

// ── TILE CONFIGS ───────────────────────────────────────
const TILES = {
  street: {
    url:   'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr:  '© OpenStreetMap'
  },
  satellite: {
    url:   'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr:  '© Esri'
  },
  dark: {
    url:   'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attr:  '&copy; Esri'
  },
  topo: {
    url:   'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attr:  '© OpenTopoMap'
  }
};

// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  applyRoleVisibility();
  initMap();
  await loadSnapshot();
  renderIssueLayer();
  await loadAll();
  setInterval(loadAll, 10 * 60 * 1000);
});

// ── ROLE-BASED UI ─────────────────────────────────────
function applyRoleVisibility() {
  if (SB_IS_ADMIN) return;
  document.getElementById('admin-road-sim')?.remove();
  document.getElementById('vbtn-sim')?.remove();
}

// ── MAP INIT ────────────────────────────────────────────
function initMap() {
  map = L.map('combo-map', { zoomControl: true })
    .setView(BALLARI, 14);

  tileLayer = L.tileLayer(TILES.street.url, {
    attribution: TILES.street.attr,
    maxZoom: 19
  }).addTo(map);

  Object.keys(layerState).forEach(k => {
    layerGroups[k] = L.layerGroup();
  });

  layerGroups.issues.addTo(map);

  map.on('click', (e) => {
    simPinLatLng = e.latlng;
    if (simPin) map.removeLayer(simPin);
    simPin = L.marker([e.latlng.lat, e.latlng.lng], {
      icon: L.divIcon({
        className: '',
        html: `<div style="font-size:24px;">📍</div>`,
        iconSize: [24,24], iconAnchor: [12,24]
      })
    }).addTo(map)
      .bindTooltip('Simulation point', { direction:'top' });
  });
}

// ── TILE SWITCH ─────────────────────────────────────────
window.setTile = (type) => {
  document.querySelectorAll('.tile-btn').forEach(b =>
    b.classList.remove('active')
  );
  event.target.classList.add('active');

  if (tileLayer) map.removeLayer(tileLayer);
  const cfg = TILES[type];
  tileLayer = L.tileLayer(cfg.url, {
    attribution: cfg.attr, maxZoom: 19
  }).addTo(map);
};

// ── LOAD SNAPSHOT ───────────────────────────────────────
async function loadSnapshot() {
  try {
    const res = await fetch(`${BACKEND}/api/twin/snapshot`);
    snapshot  = await res.json();

    document.getElementById('info-issues').innerText =
      snapshot.issues.length;
    document.getElementById('info-alerts').innerText =
      snapshot.alerts.length;

    document.getElementById('twin-stats').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:0.3rem;">
        <div style="display:flex;justify-content:space-between;">
          <span>Open Issues</span>
          <b style="color:#ef4444;">${snapshot.issues.length}</b>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span>Active Alerts</span>
          <b style="color:#f59e0b;">${snapshot.alerts.length}</b>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span>Traffic Records</span>
          <b style="color:#38bdf8;">${snapshot.traffic.length}</b>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span>Water Records</span>
          <b style="color:#22c55e;">${snapshot.water.length}</b>
        </div>
      </div>
    `;
  } catch {
    document.getElementById('twin-stats').innerHTML =
      '<p style="color:#ef4444;">Could not load snapshot.</p>';
  }
}

// ── LAYER TOGGLE ──────────────────────────────────────
window.toggleLayer = async (key) => {
  layerState[key] = !layerState[key];
  const btn = document.getElementById(`lyr-${key}`);
  btn.classList.toggle('on', layerState[key]);

  if (layerState[key]) {
    await renderLayer(key);
    map.addLayer(layerGroups[key]);
  } else {
    map.removeLayer(layerGroups[key]);
  }

  const count = Object.values(layerState).filter(Boolean).length;
  const infoLayers = document.getElementById('info-layers');
  if (infoLayers) infoLayers.innerText = count;
};

async function renderLayer(key) {
  layerGroups[key].clearLayers();

  switch (key) {
    case 'issues':    renderIssueLayer();          break;
    case 'traffic':   renderTrafficLayer();        break;
    case 'pollution': renderPollutionLayer();      break;
    case 'crowd':     renderCrowdLayer();          break;
    case 'shadow':    await renderShadowLayer();   break;
    case 'heat':      await renderHeatLayer();     break;
    case 'rain':      await renderRainLayer();     break;
    case 'flood':     await renderFloodLayer();    break;
    case 'wind':      await renderWindLayer();     break;
  }
}

// ── ISSUE LAYER ───────────────────────────────────────
function renderIssueLayer() {
  if (!snapshot) return;
  layerGroups.issues.clearLayers();

  const catColor = {
    road:'#f59e0b', water:'#38bdf8',
    electric:'#facc15', sanitation:'#a3e635', other:'#94a3b8'
  };

  snapshot.issues.forEach(issue => {
    const { lat, lng } = issue.location?.coordinates || {};
    if (!lat || !lng) return;
    const color = catColor[issue.category] || '#94a3b8';

    L.circleMarker([lat, lng], {
      radius: 7, fillColor: color,
      color: '#0f172a', fillOpacity: 0.85, weight: 1.5
    })
    .bindTooltip(`${window.sbEsc(issue.title)}<br/>${issue.category}`, {
      direction: 'top'
    })
    .addTo(layerGroups.issues);
  });
}

// ── TRAFFIC HEAT LAYER ────────────────────────────────
function renderTrafficLayer() {
  const hotspots = [
    { lat:15.1394, lng:76.9214, intensity:0.9, label:'Gandhi Nagar' },
    { lat:15.1350, lng:76.9250, intensity:0.8, label:'KSRTC Stand'  },
    { lat:15.1420, lng:76.9180, intensity:0.6, label:'Nehru Gunj'   },
    { lat:15.1480, lng:76.9120, intensity:0.4, label:'Cantonment'   },
    { lat:15.1300, lng:76.9370, intensity:0.7, label:'Hospet Road'  }
  ];

  hotspots.forEach(h => {
    const color = h.intensity > 0.7
      ? '#ef4444' : h.intensity > 0.4 ? '#f59e0b' : '#22c55e';

    L.circle([h.lat, h.lng], {
      radius:      h.intensity * 400,
      color:       color,
      fillColor:   color,
      fillOpacity: 0.25,
      weight:      1
    })
    .bindTooltip(`🚦 ${h.label}: ${Math.round(h.intensity*100)}%`)
    .addTo(layerGroups.traffic);
  });
}

// ── POLLUTION LAYER ───────────────────────────────────
function renderPollutionLayer() {
  const zones = [
    { lat:15.1394, lng:76.9214, aqi:3, label:'Gandhi Nagar - Moderate' },
    { lat:15.1350, lng:76.9250, aqi:2, label:'KSRTC Stand - Fair'      },
    { lat:15.1480, lng:76.9120, aqi:4, label:'Cantonment - Poor'       },
    { lat:15.1420, lng:76.9180, aqi:2, label:'Nehru Gunj - Fair'       }
  ];

  const aqiColor = {
    1:'#22c55e', 2:'#84cc16',
    3:'#f59e0b', 4:'#ef4444', 5:'#7c3aed'
  };

  zones.forEach(z => {
    const color = aqiColor[z.aqi] || '#334155';
    L.circle([z.lat, z.lng], {
      radius:      350,
      color:       color,
      fillColor:   color,
      fillOpacity: 0.2,
      weight:      1,
      dashArray:   '4 4'
    })
    .bindTooltip(`💨 ${z.label}`)
    .addTo(layerGroups.pollution);
  });
}

// ── CROWD LAYER ───────────────────────────────────────
function renderCrowdLayer() {
  const areas = [
    { lat:15.1394, lng:76.9214, count:2800, color:'#ef4444' },
    { lat:15.1350, lng:76.9250, count:2000, color:'#f59e0b' },
    { lat:15.1420, lng:76.9180, count:900,  color:'#22c55e' },
    { lat:15.1480, lng:76.9120, count:600,  color:'#22c55e' },
    { lat:15.1450, lng:76.9150, count:1200, color:'#f59e0b' }
  ];

  areas.forEach(a => {
    L.circle([a.lat, a.lng], {
      radius:      Math.max(150, a.count / 8),
      color:       a.color,
      fillColor:   a.color,
      fillOpacity: 0.2,
      weight:      1
    })
    .bindTooltip(`👥 ~${a.count.toLocaleString()} people`)
    .addTo(layerGroups.crowd);
  });
}

// ── SHADOW LAYER ───────────────────────────────────────
async function renderShadowLayer() {
  try {
    const res  = await fetch(
      `${BACKEND}/api/twin/shadow?lat=${BALLARI[0]}&lng=${BALLARI[1]}`
    );
    const data = await res.json();

    data.grid.forEach(cell => {
      const color = cell.exposure === 'shaded'   ? '#22c55e'
        : cell.exposure === 'partial' ? '#f59e0b'
        : '#ef4444';

      L.rectangle(
        [
          [cell.lat - 0.0015, cell.lng - 0.0015],
          [cell.lat + 0.0015, cell.lng + 0.0015]
        ],
        {
          color:       color,
          fillColor:   color,
          fillOpacity: 0.18,
          weight:      0
        }
      ).addTo(layerGroups.shadow);
    });

    data.suggestions.forEach(s => {
      L.marker([s.lat, s.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="font-size:18px;" title="${s.suggestion}">
            🌳
          </div>`,
          iconSize: [20,20], iconAnchor:[10,10]
        })
      })
      .bindPopup(`
        <b>${s.suggestion}</b><br/>
        Priority: ${s.priority}<br/>
        ${s.benefit}
      `)
      .addTo(layerGroups.shadow);
    });

  } catch {
    showToast('Shadow analysis failed.', 'error');
  }
}

// ── HEAT LAYER ────────────────────────────────────────
async function renderHeatLayer() {
  try {
    const res  = await fetch(`${BACKEND}/api/weather/heatmap`);
    const data = await res.json();

    const levelColor = {
      extreme:  '#ef4444',
      high:     '#f59e0b',
      moderate: '#facc15',
      normal:   '#22c55e'
    };

    data.zones.forEach(zone => {
      const color = levelColor[zone.level] || '#334155';

      L.circle([zone.lat, zone.lng], {
        radius:      600,
        color:       color,
        fillColor:   color,
        fillOpacity: 0.25,
        weight:      1
      })
      .bindTooltip(
        `🌡️ ${zone.label}: ${zone.temp}°C (${zone.level})`
      )
      .addTo(layerGroups.heat);

      L.marker([zone.lat, zone.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="
            background:${color}22;
            border:1px solid ${color};
            border-radius:6px;
            padding:2px 6px;
            font-size:10px;
            color:${color};
            font-weight:bold;
            white-space:nowrap;
          ">${zone.temp}°C</div>`,
          iconSize:   [50, 20],
          iconAnchor: [25, 10]
        })
      }).addTo(layerGroups.heat);
    });
  } catch {}
}

// ── RAIN LAYER ────────────────────────────────────────
async function renderRainLayer() {
  try {
    const res  = await fetch(`${BACKEND}/api/weather/forecast`);
    const data = await res.json();

    const rainTile = L.tileLayer(
      `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${getOWMKey()}`,
      { opacity: 0.6, maxZoom: 19 }
    );

    const lat = BALLARI[0];
    const lng  = BALLARI[1];

    const maxPop = Math.max(
      ...data.forecast.slice(0, 4).map(f => f.pop || 0)
    );
    const maxRain = Math.max(
      ...data.forecast.slice(0, 4).map(f => f.rain_3h || 0)
    );

    if (maxPop > 20) {
      L.circle([lat, lng], {
        radius:      2000,
        color:       '#38bdf8',
        fillColor:   '#38bdf8',
        fillOpacity: Math.min(maxPop / 100, 0.4),
        weight:      1
      })
      .bindTooltip(
        `🌧️ Rain probability: ${maxPop}%\n` +
        `Expected: ${maxRain.toFixed(1)}mm`
      )
      .addTo(layerGroups.rain);
    }

    [
      [lat + 0.01, lng - 0.01],
      [lat - 0.01, lng + 0.01],
      [lat + 0.015, lng + 0.01]
    ].forEach(pos => {
      L.marker(pos, {
        icon: L.divIcon({
          className: '',
          html: `<div style="font-size:20px; opacity:0.7;">🌧️</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
      }).addTo(layerGroups.rain);
    });

  } catch {}
}

// ── FLOOD LAYER ───────────────────────────────────────
async function renderFloodLayer() {
  try {
    const res  = await fetch(`${BACKEND}/api/weather/flood-risk`);
    const data = await res.json();

    const riskColor = {
      low:      '#22c55e',
      moderate: '#f59e0b',
      high:     '#ef4444',
      critical: '#7c3aed'
    };

    data.zones.forEach(zone => {
      const color = riskColor[zone.risk] || '#334155';

      L.circle([zone.lat, zone.lng], {
        radius:      500,
        color:       color,
        fillColor:   color,
        fillOpacity: 0.3,
        weight:      2,
        dashArray:   '6 4'
      })
      .bindPopup(`
        <div style="min-width:160px;">
          <b style="color:${color};">🌊 ${zone.name}</b><br/>
          <span style="font-size:0.8rem; color:#94a3b8;">
            Risk Level:
            <b style="color:${color};">${zone.risk.toUpperCase()}</b>
          </span><br/>
          <span style="font-size:0.78rem; color:#64748b;">
            ⚠️ ${zone.reason}
          </span>
        </div>
      `)
      .addTo(layerGroups.flood);

      L.marker([zone.lat, zone.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="font-size:18px;">🌊</div>`,
          iconSize:   [20, 20],
          iconAnchor: [10, 10]
        })
      }).addTo(layerGroups.flood);
    });
  } catch {}
}

// ── WIND LAYER ────────────────────────────────────────
async function renderWindLayer() {
  try {
    const res  = await fetch(`${BACKEND}/api/weather/current`);
    const data = await res.json();

    const locations = [
      [15.1394, 76.9214],
      [15.1450, 76.9150],
      [15.1350, 76.9280],
      [15.1480, 76.9120]
    ];

    locations.forEach(([lat, lng]) => {
      const rotation = data.wind_deg || 0;
      L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="
            font-size:22px;
            transform:rotate(${rotation}deg);
            opacity:0.85;
          ">➤</div>`,
          iconSize:   [24, 24],
          iconAnchor: [12, 12]
        })
      })
      .bindTooltip(
        `💨 ${data.wind_speed} m/s · ${data.wind_deg}°`
      )
      .addTo(layerGroups.wind);
    });
  } catch {}
}

function getOWMKey() {
  return 'YOUR_OWM_KEY';
}

// ── VIEW SWITCHER ─────────────────────────────────────
window.activateView = (view) => {
  if (view === 'sim' && !SB_IS_ADMIN) return;

  document.querySelectorAll('.view-btn').forEach(b =>
    b.classList.remove('active')
  );
  document.getElementById(`vbtn-${view}`)?.classList.add('active');
  document.getElementById('info-mode').innerText = view.toUpperCase();

  if (view === 'shadow') {
    layerState.shadow = true;
    document.getElementById('lyr-shadow').classList.add('on');
    renderLayer('shadow');
    map.addLayer(layerGroups.shadow);
  }

  if (view === 'sim') {
    showToast('Click any point on the map to set simulation location', 'info');
  }
};

// ── ROAD CLOSURE SIM (admin only) ─────────────────────
window.simulateRoadClosure = async () => {
  if (!SB_IS_ADMIN) {
    showToast('Admins only.', 'error');
    return;
  }

  if (!simPinLatLng) {
    showToast('Click map to set simulation point first.', 'warning');
    return;
  }

  const name   = document.getElementById('sim-name').value ||
                 'Selected Road';
  const radius = parseFloat(document.getElementById('sim-radius').value) || 0.5;

  showToast('⏳ Running simulation...', 'info');

  try {
    const { auth } = await import('./firebase-config.js');
    const token = await auth.currentUser?.getIdToken();

    const res  = await fetch(`${BACKEND}/api/twin/simulate/road-closure`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        lat:    simPinLatLng.lat,
        lng:    simPinLatLng.lng,
        radius, name
      })
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Simulation failed.');
    }

    const data = await res.json();
    renderSimResult(data);
  } catch (err) {
    showToast(err.message || 'Simulation failed.', 'error');
  }
};

function renderSimResult(data) {
  simLayers.forEach(l => map.removeLayer(l));
  simLayers = [];

  const sevColor = { high:'#ef4444', medium:'#f59e0b', low:'#22c55e' };

  data.impactZones.forEach(zone => {
    const circle = L.circle([zone.lat, zone.lng], {
      radius:      zone.radius,
      color:       sevColor[zone.severity],
      fillColor:   sevColor[zone.severity],
      fillOpacity: 0.15,
      weight:      2,
      dashArray:   '6 4'
    })
    .bindTooltip(zone.label)
    .addTo(map);
    simLayers.push(circle);
  });

  data.alternates.forEach(route => {
    const coords = route.coords.map(c => [c.lat, c.lng]);
    const line = L.polyline(coords, {
      color:  '#22c55e',
      weight: 3,
      dashArray: '8 4'
    })
    .bindTooltip(`${route.name} (${route.delay})`)
    .addTo(map);
    simLayers.push(line);
  });

  const isHigh = data.affected > 5;
  const overlay = document.getElementById('sim-overlay');
  overlay.classList.add('show');

  document.getElementById('sim-overlay-body').innerHTML = `
    <div style="margin-bottom:0.5rem;">
      <span class="impact-badge impact-${isHigh ? 'high' : 'medium'}">
        ${data.recommendation.split(' — ')[0]}
      </span>
    </div>
    <div style="font-size:0.78rem; color:#94a3b8; margin-bottom:0.5rem;">
      ${data.recommendation}
    </div>
    <div style="font-size:0.75rem; color:#64748b;">
      📌 Affected issues nearby: <b style="color:#f1f5f9;">
        ${data.affected}
      </b>
    </div>
    <div style="margin-top:0.5rem;">
      ${data.alternates.map(r => `
        <div style="font-size:0.75rem; color:#22c55e; margin-top:0.2rem;">
          ↪ ${r.name} ${r.delay}
        </div>
      `).join('')}
    </div>
  `;

  showToast(
    `🚧 Simulation: ${data.affected} issues affected`, 'warning'
  );
}

// ── SHADOW ANALYSIS ───────────────────────────────────
window.runShadowAnalysis = async () => {
  showToast('🌳 Running shadow analysis...', 'info');

  layerState.shadow = true;
  document.getElementById('lyr-shadow').classList.add('on');
  map.addLayer(layerGroups.shadow);
  renderLayer('shadow');

  activateView('shadow');
};

// ── CLEAR SIM ─────────────────────────────────────────
window.clearSimulation = () => {
  simLayers.forEach(l => map.removeLayer(l));
  simLayers = [];
  if (simPin) { map.removeLayer(simPin); simPin = null; }
  simPinLatLng = null;
  document.getElementById('sim-overlay').classList.remove('show');
  document.getElementById('sim-result-panel').classList.remove('show');
  showToast('Simulation cleared.', 'info');
};

// ── LOAD ALL (weather widgets) ─────────────────────────
window.loadAll = async () => {
  document.getElementById('updated-time').innerText =
    new Date().toLocaleTimeString('en-IN');

  await Promise.allSettled([
    loadCurrentWeather(),
    loadForecast(),
    loadWeatherAlerts(),
    loadFloodRisk()
  ]);
};

// ── CURRENT WEATHER ───────────────────────────────────
async function loadCurrentWeather() {
  try {
    const res  = await fetch(`${BACKEND}/api/weather/current`);
    const data = await res.json();

    const iconMap = {
      '01d':'☀️','01n':'🌙','02d':'⛅','02n':'⛅',
      '03d':'☁️','03n':'☁️','04d':'☁️','04n':'☁️',
      '09d':'🌧️','10d':'🌦️','11d':'⛈️','13d':'❄️',
      '50d':'🌫️'
    };
    const icon = iconMap[data.icon] || '🌤️';

    const heatColor = data.temp > 44 ? '#ef4444'
      : data.temp > 40 ? '#f59e0b'
      : data.temp > 36 ? '#facc15'
      : '#38bdf8';

    document.getElementById('current-weather').innerHTML = `
      <div class="weather-big">
        <div class="weather-icon-big">${icon}</div>
        <div>
          <div class="weather-temp-big"
            style="color:${heatColor};">
            ${data.temp}°C
          </div>
          <div class="weather-feels">
            Feels like ${data.feels_like}°C
          </div>
          <div style="color:#94a3b8; font-size:0.8rem;
                      text-transform:capitalize;">
            ${data.description}
          </div>
        </div>
      </div>
      <div class="weather-grid">
        <div class="weather-stat">
          <div class="wlbl">💧 Humidity</div>
          <div class="wval">${data.humidity}%</div>
        </div>
        <div class="weather-stat">
          <div class="wlbl">💨 Wind</div>
          <div class="wval">${data.wind_speed} m/s</div>
        </div>
        <div class="weather-stat">
          <div class="wlbl">👁️ Visibility</div>
          <div class="wval">${data.visibility} km</div>
        </div>
        <div class="weather-stat">
          <div class="wlbl">🌧️ Rain 1h</div>
          <div class="wval">${data.rain_1h} mm</div>
        </div>
        <div class="weather-stat">
          <div class="wlbl">☁️ Clouds</div>
          <div class="wval">${data.clouds}%</div>
        </div>
        <div class="weather-stat">
          <div class="wlbl">📊 Pressure</div>
          <div class="wval">${data.pressure} hPa</div>
        </div>
      </div>
    `;
  } catch {
    document.getElementById('current-weather').innerHTML =
      '<p style="color:#ef4444; font-size:0.82rem;">Failed to load.</p>';
  }
}

// ── FORECAST ──────────────────────────────────────────
async function loadForecast() {
  try {
    const res  = await fetch(`${BACKEND}/api/weather/forecast`);
    const data = await res.json();

    const iconMap = {
      '01d':'☀️','01n':'🌙','02d':'⛅','03d':'☁️',
      '09d':'🌧️','10d':'🌦️','11d':'⛈️','50d':'🌫️'
    };

    const strip = document.getElementById('forecast-strip');
    strip.innerHTML = data.forecast.slice(0, 8).map(f => {
      const time = new Date(f.time).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit'
      });
      const icon = iconMap[f.icon] || '🌤️';

      return `
        <div class="fc-item">
          <div class="fc-time">${time}</div>
          <div class="fc-icon">${icon}</div>
          <div class="fc-temp">${f.temp}°</div>
          ${f.rain_3h > 0
            ? `<div class="fc-rain">${f.rain_3h}mm</div>`
            : ''}
          ${f.pop > 30
            ? `<div class="fc-pop">💧${f.pop}%</div>`
            : ''}
        </div>
      `;
    }).join('');
  } catch {}
}

// ── WEATHER ALERTS ────────────────────────────────────
async function loadWeatherAlerts() {
  try {
    const res  = await fetch(`${BACKEND}/api/weather/alerts`);
    const data = await res.json();

    const el = document.getElementById('weather-alerts');

    if (!data.alerts?.length) {
      el.innerHTML = `
        <div style="color:#22c55e; font-size:0.85rem;
                    padding:0.5rem; text-align:center;">
          ✅ No weather alerts
        </div>`;
      return;
    }

    el.innerHTML = data.alerts.map(a => `
      <div class="weather-alert alert-${a.type}">
        <div class="alert-title">${window.sbEsc(a.title)}</div>
        <div class="alert-msg">${window.sbEsc(a.message)}</div>
        <span class="alert-value">
          ${a.value} ${a.unit}
        </span>
      </div>
    `).join('');

    if (data.alerts.some(a => a.type === 'flood')) {
      if (!layerState.flood) toggleLayer('flood');
    }

    if (data.alerts.some(a => a.type === 'heat')) {
      if (!layerState.heat) toggleLayer('heat');
    }

    const critical = data.alerts.filter(a => a.severity === 'critical');
    critical.forEach(a => showToast(a.title, 'error'));

  } catch {
    document.getElementById('weather-alerts').innerHTML =
      '<p style="color:#ef4444; font-size:0.82rem;">Failed.</p>';
  }
}

// ── FLOOD RISK ────────────────────────────────────────
async function loadFloodRisk() {
  try {
    const res  = await fetch(`${BACKEND}/api/weather/flood-risk`);
    const data = await res.json();

    const riskColor = {
      low:      '#22c55e',
      moderate: '#f59e0b',
      high:     '#ef4444',
      critical: '#7c3aed'
    };

    const color = riskColor[data.riskLevel] || '#334155';

    document.getElementById('flood-summary').innerHTML = `
      <div style="display:flex; justify-content:space-between;
                  align-items:center; margin-bottom:0.6rem;">
        <span style="font-size:0.85rem;">72h Rainfall</span>
        <b style="color:${color};">${data.total72h} mm</b>
      </div>
      <div style="display:flex; align-items:center; gap:0.5rem;
                  margin-bottom:0.8rem;">
        <div style="flex:1; background:#1e293b; border-radius:999px;
                    height:6px; overflow:hidden;">
          <div style="width:${Math.min((data.total72h/100)*100, 100)}%;
                      height:100%; background:${color};
                      border-radius:999px; transition:width 0.8s;"></div>
        </div>
        <span style="font-size:0.75rem; color:${color};
                     font-weight:bold; text-transform:uppercase;">
          ${data.riskLevel}
        </span>
      </div>
      ${data.zones.map(z => `
        <div style="display:flex; justify-content:space-between;
                    padding:0.35rem 0; border-bottom:1px solid #1e293b;
                    font-size:0.78rem;">
          <span style="color:#94a3b8;">📍 ${z.name}</span>
          <span style="color:${riskColor[z.risk] || '#334155'};
                       font-weight:bold;">
            ${z.risk}
          </span>
        </div>
      `).join('')}
    `;
  } catch {}
}

// ══════════════════════════════════════════════════════════════════
// map.js content — issue reporting, POI nearby-places, GPS, pin-issue,
// directions. Reuses the shared `map`, `BACKEND`, `BALLARI` above.
// ══════════════════════════════════════════════════════════════════

const BALLARI_CENTER = [15.1394, 76.9214];

const categoryConfig = {
  road:       { color: '#f59e0b', emoji: '🛣️', layerId: 'layer-road' },
  water:      { color: '#38bdf8', emoji: '💧', layerId: 'layer-water' },
  electric:   { color: '#facc15', emoji: '⚡', layerId: 'layer-electric' },
  sanitation: { color: '#a3e635', emoji: '🗑️', layerId: 'layer-sanitation' },
  other:      { color: '#e2e8f0', emoji: '📦', layerId: 'layer-all' }
};

const layers = {
  road:       L.layerGroup().addTo(map),
  water:      L.layerGroup().addTo(map),
  electric:   L.layerGroup().addTo(map),
  sanitation: L.layerGroup().addTo(map),
  other:      L.layerGroup().addTo(map)
};

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

  const imgHtml = issue.imageUrl
    ? `<img src="${issue.imageUrl}"
        style="width:100%; border-radius:6px;
               margin-top:8px; max-height:120px;
               object-fit:cover;" />`
    : '';

  marker.bindPopup(`
    <div style="min-width:210px;">
      <b>${window.sbEsc(issue.title)}</b><br/>
      <span style="color:#64748b;font-size:0.78rem;">
      ${issue.category} • ${issue.status}</span>
      <p style="margin:6px 0;font-size:0.85rem;">
      ${issue.description || ''}
      </p>
      <code style="font-size:0.75rem; color:#38bdf8;">
        ${issue.grievanceId || ''}
      </code>
       ${imgHtml}
      <br/><small>📍 ${window.sbEsc(issue.location.address || '')}</small>
      <div style="margin-top:8px;">
        <button onclick="window.openDirections(${lat}, ${lng}, '${window.sbEsc((issue.title || 'Issue').replace(/'/g, "\\'"))}')"
          style="background:#38bdf8;color:#0f172a;border:none;padding:0.4rem 0.8rem;
                 border-radius:6px;font-size:0.78rem;font-weight:600;cursor:pointer;">
          🧭 Directions
        </button>
      </div>
    </div>
  `);

  marker.addTo(layer);
}

let gpsMarker = null;
let lastKnownPosition = null;

document.getElementById('btn-gps').addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert('Geolocation not supported on this device.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      lastKnownPosition = { lat: latitude, lng: longitude };

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

document.getElementById('btn-reset').addEventListener('click', () => {
  map.setView(BALLARI_CENTER, 13);
});

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

  document.getElementById('modal-coords').innerText =
    `📍 Lat: ${e.latlng.lat.toFixed(5)}, Lng: ${e.latlng.lng.toFixed(5)}`;
  document.getElementById('modal-overlay').classList.add('open');

  pinMode = false;
  document.getElementById('btn-pin').classList.remove('active');
  document.getElementById('btn-pin').innerText = '📌 Pin Issue';
  map.getContainer().style.cursor = '';
});

document.getElementById('submit-issue').addEventListener('click', async () => {
  const title    = document.getElementById('issue-title').value.trim();
  const category = document.getElementById('issue-category').value;
  const desc     = document.getElementById('issue-desc').value.trim();

  if (!title || !category) {
    alert('Please fill in title and category.');
    return;
  }

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
    addMarker(saved);
    closeModal();
  } catch {
    alert('Could not save issue. Is the backend running?');
  }
});

document.getElementById('cancel-modal').addEventListener('click', closeModal);

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.getElementById('issue-title').value = '';
  document.getElementById('issue-category').value = '';
  document.getElementById('issue-desc').value = '';
}

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

const BALLARI_BBOX = '15.03,76.83,15.26,77.02';

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
  if (poiLoaded[type]) return;
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
      break;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
    }
  }

  if (!data) {
    poiLoaded[type] = false;
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
      () => openWithOrigin(null)
    );
    return;
  }

  openWithOrigin(null);
};

loadIssues();

// ══════════════════════════════════════════════════════════════════
// LEGEND TOGGLES — the only new code in this file. Converts the
// Weather Map legend and Shadow legend from always-visible blocks
// into click-to-reveal popovers, as requested. Pure UI, no feature
// change: same legend content as before, just shown on demand.
// ══════════════════════════════════════════════════════════════════
window.toggleMapLegend = () => {
  document.getElementById('map-legend')?.classList.toggle('show');
};

window.toggleShadowLegend = () => {
  document.getElementById('shadow-legend-pop')?.classList.toggle('show');
};