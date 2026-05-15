const BACKEND      = 'http://localhost:5000';
const REFRESH_MS   = 5 * 60 * 1000;   // auto-refresh every 5 mins
let   refreshTimer = null;

// ── BOOT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadAll();
  startAutoRefresh();
});

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    loadAll();
    showToast('🔄 Dashboard refreshed', 'info');
  }, REFRESH_MS);
}

// ── LOAD ALL ──────────────────────────────────────────
async function loadAll() {
  document.getElementById('last-update-time').innerText =
    new Date().toLocaleTimeString('en-IN');


    // Load dispatch stats
async function loadDispatchStats() {
  try {
    const res  = await fetch(`${BACKEND}/api/emergency/incidents`);
    const data = await res.json();
    const count = data.length;

    document.getElementById('dispatch-count').innerText = count;

    const TARGET = 500;
    const pct    = Math.min(Math.round((count / TARGET) * 100), 100);
    document.getElementById('ml-progress-pct').innerText = `${pct}%`;
    document.getElementById('ml-progress-bar').style.width = `${pct}%`;
  } catch {}
}

async function loadAlertBadge() {
  try {
    const res    = await fetch(`${BACKEND}/api/alerts/counts`);
    const counts = await res.json();

    document.getElementById('s-total').innerText = counts.total || 0;

    if (counts.critical > 0) {
      showToast(
        `🚨 ${counts.critical} critical alert(s) active!`, 'error'
      );
    }
  } catch {}
}

async function loadWeatherWidget() {
  try {
    const res  = await fetch(`${BACKEND}/api/weather/current`);
    const data = await res.json();
    const res2 = await fetch(`${BACKEND}/api/weather/alerts`);
    const alertData = await res2.json();

    const criticalAlerts = alertData.alerts?.filter(
      a => a.severity === 'critical'
    ) || [];

    document.getElementById('weather-widget').innerHTML = `
      <div style="display:flex; align-items:center;
                  gap:0.8rem; margin-bottom:0.8rem;">
        <span style="font-size:2rem;">
          ${data.temp > 40 ? '🔥' : data.rain_1h > 0 ? '🌧️' : '☀️'}
        </span>
        <div>
          <div style="font-size:1.4rem; font-weight:bold;
                      color:${data.temp > 40 ? '#ef4444' : '#38bdf8'};">
            ${data.temp}°C
          </div>
          <div style="font-size:0.75rem; color:#64748b;
                      text-transform:capitalize;">
            ${data.description}
          </div>
        </div>
      </div>
      ${criticalAlerts.length > 0
        ? criticalAlerts.map(a => `
          <div style="background:#ef444422; border:1px solid #ef4444;
                      border-radius:8px; padding:0.5rem 0.7rem;
                      font-size:0.78rem; color:#fca5a5;
                      margin-bottom:0.4rem;">
            ${a.title}
          </div>`).join('')
        : `<div style="color:#22c55e; font-size:0.78rem;">
             ✅ No weather alerts
           </div>`}
      <a href="satellite.html"
        style="display:block; text-align:center;
               margin-top:0.6rem; font-size:0.75rem;
               color:#38bdf8; text-decoration:none;">
        View Satellite Map →
      </a>
    `;
  } catch {}
}

// Add to loadAll():
loadAlertBadge();
loadDispatchStats();
  await Promise.allSettled([
    loadWeather(),
    loadAQI(),
    loadStats(),
    loadTraffic(),
    loadAlerts(),
    loadAlertBadge(),
loadDispatchStats()
  ]);
}

// ── WEATHER ───────────────────────────────────────────
async function loadWeather() {
  try {
    const res  = await fetch(`${BACKEND}/api/city/weather`);
    const data = await res.json();

    const iconMap = {
      '01d':'☀️','01n':'🌙','02d':'⛅','02n':'⛅',
      '03d':'☁️','03n':'☁️','04d':'☁️','04n':'☁️',
      '09d':'🌧️','09n':'🌧️','10d':'🌦️','10n':'🌦️',
      '11d':'⛈️','11n':'⛈️','13d':'❄️','50d':'🌫️'
    };
    const icon = iconMap[data.icon] || '🌤️';

    document.getElementById('weather-content').innerHTML = `
      <div class="weather-main">
        <div class="weather-icon">${icon}</div>
        <div>
          <div class="weather-temp">
            ${data.temp}°<span>C</span>
          </div>
          <div style="color:#64748b; font-size:0.82rem;">
            Feels like ${data.feels_like}°C
          </div>
        </div>
      </div>
      <div class="weather-desc">${data.description}</div>
      <div class="weather-grid">
        <div class="weather-stat">
          <div class="val">${data.humidity}%</div>
          <div class="lbl">Humidity</div>
        </div>
        <div class="weather-stat">
          <div class="val">${data.wind} m/s</div>
          <div class="lbl">Wind</div>
        </div>
        <div class="weather-stat">
          <div class="val">${data.visibility} km</div>
          <div class="lbl">Visibility</div>
        </div>
      </div>
    `;
  } catch {
    document.getElementById('weather-content').innerHTML =
      '<p style="color:#ef4444; font-size:0.85rem;">⚠️ Could not load weather.</p>';
  }
}

// ── AQI ───────────────────────────────────────────────
async function loadAQI() {
  try {
    const res  = await fetch(`${BACKEND}/api/city/aqi`);
    const data = await res.json();

    const pct = (data.aqi / 5) * 100;

    document.getElementById('aqi-content').innerHTML = `
      <div class="aqi-number" style="color:${data.color}">
        ${data.aqi}
        <span style="font-size:1rem; color:${data.color};">
          ${data.label}
        </span>
      </div>
      <div class="aqi-bar-wrap">
        <div class="aqi-bar"
          style="width:${pct}%; background:${data.color};">
        </div>
      </div>
      <div class="aqi-components">
        <div class="aqi-comp">
          <span>PM2.5</span> <b>${data.pm2_5} μg/m³</b>
        </div>
        <div class="aqi-comp">
          <span>PM10</span> <b>${data.pm10} μg/m³</b>
        </div>
        <div class="aqi-comp">
          <span>CO</span> <b>${data.co} μg/m³</b>
        </div>
        <div class="aqi-comp">
          <span>NO₂</span> <b>${data.no2} μg/m³</b>
        </div>
      </div>
    `;
  } catch {
    document.getElementById('aqi-content').innerHTML =
      '<p style="color:#ef4444; font-size:0.85rem;">⚠️ Could not load AQI.</p>';
  }
}

// ── STATS ─────────────────────────────────────────────
async function loadStats() {
  try {
    const res  = await fetch(`${BACKEND}/api/issues/stats`);
    const data = await res.json();

    const resolved_pct = data.total
      ? Math.round((data.resolved / data.total) * 100) : 0;

    document.getElementById('stats-content').innerHTML = `
      <div class="stat-row">
        <span class="label">🔴 Open Issues</span>
        <span class="value" style="color:#ef4444">${data.open}</span>
      </div>
      <div class="stat-row">
        <span class="label">🟡 In Progress</span>
        <span class="value" style="color:#f59e0b">${data.pending ?? 0}</span>
      </div>
      <div class="stat-row">
        <span class="label">🟢 Resolved</span>
        <span class="value" style="color:#22c55e">${data.resolved}</span>
      </div>
      <div class="stat-row">
        <span class="label">📊 Total Reported</span>
        <span class="value">${data.total}</span>
      </div>
      <div style="margin-top:0.8rem;">
        <div style="display:flex; justify-content:space-between;
                    font-size:0.78rem; color:#64748b; margin-bottom:0.3rem;">
          <span>Resolution Rate</span>
          <span>${resolved_pct}%</span>
        </div>
        <div style="background:#0f172a; border-radius:999px;
                    height:6px; overflow:hidden;">
          <div style="width:${resolved_pct}%; height:100%;
                      background:#22c55e; border-radius:999px;
                      transition: width 0.8s ease;">
          </div>
        </div>
      </div>
    `;
  } catch {
    document.getElementById('stats-content').innerHTML =
      '<p style="color:#ef4444; font-size:0.85rem;">⚠️ Could not load stats.</p>';
  }
}

// ── TRAFFIC (dummy → real later) ──────────────────────
function loadTraffic() {
  const spots = [
    { name: 'Gandhi Nagar Circle',    status: 'Heavy',    color: '#ef4444' },
    { name: 'Nehru Gunj',             status: 'Moderate', color: '#f59e0b' },
    { name: 'KSRTC Bus Stand Road',   status: 'Heavy',    color: '#ef4444' },
    { name: 'Hospet Road Junction',   status: 'Clear',    color: '#22c55e' },
    { name: 'Cantonment Area',        status: 'Moderate', color: '#f59e0b' }
  ];

  document.getElementById('traffic-content').innerHTML = `
    <div class="traffic-list">
      ${spots.map(s => `
        <div class="traffic-item">
          <div class="traffic-dot" style="background:${s.color}"></div>
          <div class="traffic-name">${s.name}</div>
          <div class="traffic-status" style="color:${s.color}">
            ${s.status}
          </div>
        </div>
      `).join('')}
    </div>
    <p style="color:#334155; font-size:0.72rem; margin-top:0.8rem; text-align:right;">
      * Simulated — real GPS feed in Phase 3
    </p>
  `;
}

// ── LIVE ALERTS ───────────────────────────────────────
async function loadAlerts() {
  try {
    // Pull recent critical issues as alerts
    const res    = await fetch(`${BACKEND}/api/issues/recent`);
    const issues = await res.json();

    const critical = issues
      .filter(i => i.status === 'open')
      .slice(0, 4);

    const categoryIcon = {
      road: '🛣️', water: '💧',
      electric: '⚡', sanitation: '🗑️', other: '📦'
    };

    if (!critical.length) {
      document.getElementById('alerts-content').innerHTML =
        '<p style="color:#22c55e; font-size:0.88rem;">✅ No critical alerts right now.</p>';
      return;
    }

    document.getElementById('alerts-content').innerHTML =
      critical.map(i => {
        const ago = timeAgo(new Date(i.createdAt));
        return `
          <div class="alert-item">
            <div class="alert-icon">
              ${categoryIcon[i.category] || '📦'}
            </div>
            <div>
              <div class="alert-text">${i.title}</div>
              <div style="font-size:0.78rem; color:#64748b;">
                📍 ${i.location?.address || 'Ballari'}
              </div>
              <div class="alert-time">${ago}</div>
            </div>
            <a href="tracker.html?id=${i.grievanceId}"
              style="margin-left:auto; font-size:0.78rem;
                     color:#38bdf8; text-decoration:none;
                     white-space:nowrap;">
              Track →
            </a>
          </div>
        `;
      }).join('');

  } catch {
    document.getElementById('alerts-content').innerHTML =
      '<p style="color:#ef4444; font-size:0.85rem;">⚠️ Could not load alerts.</p>';
  }
}

async function loadCrowdWidget() {
  try {
    const res  = await fetch(`${BACKEND}/api/crowd/live`);
    const data = await res.json();

    const surge = data.filter(
      a => a.density === 'high' || a.density === 'critical'
    );

    document.getElementById('crowd-widget').innerHTML = `
      <div style="display:flex; flex-direction:column; gap:0.5rem;">
        ${data.slice(0, 4).map(a => `
          <div style="display:flex; justify-content:space-between;
                      align-items:center; padding:0.5rem;
                      background:#0f172a; border-radius:8px;
                      font-size:0.82rem;">
            <span>${a.name}</span>
            <span style="color:${a.color}; font-weight:bold;">
              ${a.densityLabel}
              · ${a.count.toLocaleString()}
            </span>
          </div>
        `).join('')}
        ${surge.length > 0
          ? `<a href="crowd.html"
               style="color:#ef4444; font-size:0.78rem;
                      text-align:center; margin-top:0.3rem;">
               🚨 ${surge.length} area(s) surging →
             </a>`
          : `<p style="color:#22c55e; font-size:0.78rem;
                       text-align:center; margin-top:0.3rem;">
               ✅ All areas normal
             </p>`}
      </div>
    `;
  } catch {}
}

// ── TIME AGO HELPER ───────────────────────────────────
function timeAgo(date) {
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60)     return `${diff}s ago`;
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}