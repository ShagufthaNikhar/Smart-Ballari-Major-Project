const BACKEND      = window.SB_API;
const REFRESH_MS   = 5 * 60 * 1000;   // auto-refresh every 5 mins
let   refreshTimer = null;

// ── BOOT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadAll();
  startAutoRefresh();
});

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(loadAll, REFRESH_MS);
}

// ── LOAD ALL ──────────────────────────────────────────
async function loadAll() {
  const stamp = document.getElementById('last-update-time');
  if (stamp) stamp.innerText = new Date().toLocaleTimeString('en-IN');

  await Promise.allSettled([
    loadWeather(),
    loadAQI(),
    loadStats(),
    loadAlerts(),
    loadAlertBadge(),
    loadDispatchStats()
  ]);
}

// ── AI DISPATCH ENGINE STATS ──────────────────────────
async function loadDispatchStats() {
  try {
    const res  = await fetch(`${BACKEND}/api/emergency/incidents`);
    if (!res.ok) throw new Error(`incidents returned ${res.status}`);
    const data = await res.json();
    const count = Array.isArray(data) ? data.length : 0;

    document.getElementById('dispatch-count').innerText = count;

    const TARGET = 500;
    const pct    = Math.min(Math.round((count / TARGET) * 100), 100);
    document.getElementById('ml-progress-pct').innerText  = `${pct}%`;
    document.getElementById('ml-progress-bar').style.width = `${pct}%`;
  } catch (err) {
    console.warn('[dashboard] dispatch stats:', err.message);
  }
}

// ── CRITICAL ALERT TOAST ──────────────────────────────
async function loadAlertBadge() {
  try {
    const res    = await fetch(`${BACKEND}/api/alerts/counts`);
    if (!res.ok) throw new Error(`alert counts returned ${res.status}`);
    const counts = await res.json();

    if (counts.critical > 0) {
      showToast?.(`🚨 ${counts.critical} critical alert(s) active!`, 'error');
    }
  } catch (err) {
    console.warn('[dashboard] alert counts:', err.message);
  }
}

// ── WEATHER ───────────────────────────────────────────
async function loadWeather() {
  try {
    const res  = await fetch(`${BACKEND}/api/city/weather`);
    if (!res.ok) throw new Error(`weather returned ${res.status}`);
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
  } catch (err) {
    console.warn('[dashboard] weather:', err.message);
    document.getElementById('weather-content').innerHTML =
      '<p style="color:#ef4444; font-size:0.85rem;">⚠️ Could not load weather.</p>';
  }
}

// ── AQI ───────────────────────────────────────────────
async function loadAQI() {
  try {
    const res  = await fetch(`${BACKEND}/api/city/aqi`);
    if (!res.ok) throw new Error(`aqi returned ${res.status}`);
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
  } catch (err) {
    console.warn('[dashboard] aqi:', err.message);
    document.getElementById('aqi-content').innerHTML =
      '<p style="color:#ef4444; font-size:0.85rem;">⚠️ Could not load AQI.</p>';
  }
}

// ── ISSUE STATS ───────────────────────────────────────
async function loadStats() {
  try {
    const res  = await fetch(`${BACKEND}/api/issues/stats`);
    if (!res.ok) throw new Error(`stats returned ${res.status}`);
    const data = await res.json();

    const resolved_pct = data.total
      ? Math.round((data.resolved / data.total) * 100) : 0;

    document.getElementById('stats-content').innerHTML = `
      <div class="stat-row">
        <span class="label">🔴 Open Issues</span>
        <span class="value" style="color:#ef4444">${data.open ?? 0}</span>
      </div>
      <div class="stat-row">
        <span class="label">🟡 In Progress</span>
        <span class="value" style="color:#f59e0b">${data.pending ?? 0}</span>
      </div>
      <div class="stat-row">
        <span class="label">🟢 Resolved</span>
        <span class="value" style="color:#22c55e">${data.resolved ?? 0}</span>
      </div>
      <div class="stat-row">
        <span class="label">📊 Total Reported</span>
        <span class="value">${data.total ?? 0}</span>
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
  } catch (err) {
    console.warn('[dashboard] stats:', err.message);
    document.getElementById('stats-content').innerHTML =
      '<p style="color:#ef4444; font-size:0.85rem;">⚠️ Could not load stats.</p>';
  }
}

// ── LIVE ALERTS ───────────────────────────────────────
async function loadAlerts() {
  try {
    const res    = await fetch(`${BACKEND}/api/issues/recent`);
    if (!res.ok) throw new Error(`recent returned ${res.status}`);
    const issues = await res.json();
    if (!Array.isArray(issues)) throw new Error('recent did not return an array');

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
              <div class="alert-text">${window.sbEsc(i.title)}</div>
              <div style="font-size:0.78rem; color:#64748b;">
                📍 ${window.sbEsc(i.location?.address || 'Ballari')}
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

  } catch (err) {
    console.warn('[dashboard] alerts:', err.message);
    document.getElementById('alerts-content').innerHTML =
      '<p style="color:#ef4444; font-size:0.85rem;">⚠️ Could not load alerts.</p>';
  }
}

// ── TIME AGO HELPER ───────────────────────────────────
function timeAgo(date) {
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60)     return `${diff}s ago`;
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}