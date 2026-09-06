const BACKEND  = window.SB_API;
const BALLARI  = [15.1394, 76.9214];

let map;
let tileLayer;
let satLayers   = {};
let layerState  = {
  heat: false, rain: false, flood: false, wind: false
};

// ── TILE CONFIGS ──────────────────────────────────────
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
  initMap();
  await loadAll();
  setInterval(loadAll, 10 * 60 * 1000);
});

// ── MAP ───────────────────────────────────────────────
function initMap() {
  map = L.map('sat-map').setView(BALLARI, 13);

  tileLayer = L.tileLayer(TILES.street.url, {
    attribution: TILES.street.attr,
    maxZoom: 19
  }).addTo(map);

  // Init layer groups
  Object.keys(layerState).forEach(k => {
    satLayers[k] = L.layerGroup();
  });
}

// ── TILE SWITCH ───────────────────────────────────────
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

// ── LOAD ALL ──────────────────────────────────────────
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

    // Auto-load flood layer if flood alert
    if (data.alerts.some(a => a.type === 'flood')) {
      if (!layerState.flood) toggleSatLayer('flood');
    }

    // Auto-load heat layer if heat alert
    if (data.alerts.some(a => a.type === 'heat')) {
      if (!layerState.heat) toggleSatLayer('heat');
    }

    // Show toast for critical
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

// ── LAYER TOGGLE ──────────────────────────────────────
window.toggleSatLayer = async (key) => {
  layerState[key] = !layerState[key];
  const pill = document.getElementById(`lyr-${key}`);
  pill.classList.toggle('on', layerState[key]);

  satLayers[key].clearLayers();

  if (layerState[key]) {
    await renderSatLayer(key);
    map.addLayer(satLayers[key]);
  } else {
    map.removeLayer(satLayers[key]);
  }
};

async function renderSatLayer(key) {
  switch (key) {
    case 'heat':  await renderHeatLayer();  break;
    case 'rain':  await renderRainLayer();  break;
    case 'flood': await renderFloodLayer(); break;
    case 'wind':  await renderWindLayer();  break;
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
      .addTo(satLayers.heat);

      // Label
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
      }).addTo(satLayers.heat);
    });
  } catch {}
}

// ── RAIN LAYER ────────────────────────────────────────
async function renderRainLayer() {
  try {
    const res  = await fetch(`${BACKEND}/api/weather/forecast`);
    const data = await res.json();

    // Use OpenWeatherMap rain tile layer
    const rainTile = L.tileLayer(
      `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${getOWMKey()}`,
      { opacity: 0.6, maxZoom: 19 }
    );

    // Fallback: draw rain probability circles from forecast
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
      .addTo(satLayers.rain);
    }

    // Rain drop markers
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
      }).addTo(satLayers.rain);
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
      .addTo(satLayers.flood);

      // Flood zone label
      L.marker([zone.lat, zone.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="font-size:18px;">🌊</div>`,
          iconSize:   [20, 20],
          iconAnchor: [10, 10]
        })
      }).addTo(satLayers.flood);
    });
  } catch {}
}

// ── WIND LAYER ────────────────────────────────────────
async function renderWindLayer() {
  try {
    const res  = await fetch(`${BACKEND}/api/weather/current`);
    const data = await res.json();

    // Draw wind arrows at key locations
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
      .addTo(satLayers.wind);
    });
  } catch {}
}

// ── HELPER ────────────────────────────────────────────
function getOWMKey() {
  // Key exposed client-side only for tile layer
  // For production move to backend proxy
  return 'YOUR_OWM_KEY';
}