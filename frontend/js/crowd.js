const BACKEND = window.SB_API;
const role    = localStorage.getItem('userRole');

let map;
let crowdMarkers   = [];
let eventMarkers   = [];
let liveData       = [];
let refreshTimer   = null;

// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initMap();

  if (role === 'admin' || role === 'officer') {
    document.getElementById('surge-btn').style.display    = 'block';
    document.getElementById('add-event-wrap').style.display = 'block';
  }

  await refreshAll();

  // Auto-refresh every 60s
  refreshTimer = setInterval(refreshAll, 60 * 1000);
});

// ── MAP ───────────────────────────────────────────────
function initMap() {
  map = L.map('crowd-map').setView([15.1394, 76.9214], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors', maxZoom: 19
  }).addTo(map);
}

// ── REFRESH ALL ───────────────────────────────────────
window.refreshAll = async () => {
  await Promise.allSettled([
    loadLiveCrowd(),
    loadPredictions(),
    loadEvents(),
    loadHistory()
  ]);
};

// ── LIVE CROWD ────────────────────────────────────────
async function loadLiveCrowd() {
  try {
    const res = await fetch(`${BACKEND}/api/crowd/live`);
    liveData  = await res.json();

    renderDensityCards(liveData);
    renderCrowdMap(liveData);
    checkForSurge(liveData);
  } catch {
    document.getElementById('density-cards').innerHTML =
      '<p style="color:#ef4444;">Could not load crowd data.</p>';
  }
}

// ── DENSITY CARDS ─────────────────────────────────────
function renderDensityCards(data) {
  // Show top 6 areas
  document.getElementById('density-cards').innerHTML =
    data.slice(0, 6).map(area => {
      const maxCount = 6000;
      const pct      = Math.min((area.count / maxCount) * 100, 100);

      return `
        <div class="density-card"
          style="--density-color:${area.color}">
          <h4>${area.name}</h4>
          <div class="density-count">
            ${area.count.toLocaleString()}
          </div>
          <div class="density-label">${area.densityLabel}</div>
          <div class="density-bar-wrap">
            <div class="density-bar"
              style="width:${pct}%"></div>
          </div>
          ${area.activeEvent
            ? `<div class="density-event">
                 🎉 ${area.activeEvent}
               </div>`
            : ''}
        </div>
      `;
    }).join('');
}

// ── CROWD MAP ─────────────────────────────────────────
function renderCrowdMap(data) {
  crowdMarkers.forEach(m => map.removeLayer(m));
  crowdMarkers = [];

  data.forEach(area => {
    if (!area.lat || !area.lng) return;

    // Circle scaled to count
    const radius  = Math.max(200, Math.min(area.count / 5, 800));
    const circle  = L.circle([area.lat, area.lng], {
      radius,
      color:       area.color,
      fillColor:   area.color,
      fillOpacity: 0.3,
      weight:      2
    }).addTo(map);

    // Label marker
    const label = L.marker([area.lat, area.lng], {
      icon: L.divIcon({
        className: '',
        html: `<div style="
          background:${area.color}22;
          border:2px solid ${area.color};
          border-radius:10px;
          padding:4px 8px;
          font-size:11px;
          font-weight:bold;
          color:${area.color};
          white-space:nowrap;
          box-shadow:0 2px 8px rgba(0,0,0,0.3);
        ">
          👥 ${area.count.toLocaleString()}
          <span style="color:#94a3b8; font-weight:normal;">
            · ${area.densityLabel}
          </span>
        </div>`,
        iconSize:   [120, 30],
        iconAnchor: [60, 15]
      })
    }).addTo(map);

    label.bindPopup(`
      <div style="min-width:180px;">
        <b>${area.name}</b><br/>
        <span style="color:${area.color}; font-weight:bold;">
          ${area.densityLabel} density
        </span><br/>
        <span style="color:#64748b; font-size:0.82rem;">
          ~${area.count.toLocaleString()} people
        </span>
        ${area.activeEvent
          ? `<br/><span style="color:#f59e0b; font-size:0.78rem;">
               🎉 ${area.activeEvent}
             </span>`
          : ''}
      </div>
    `);

    crowdMarkers.push(circle, label);
  });
}

// ── SURGE CHECK ───────────────────────────────────────
function checkForSurge(data) {
  const surgeAreas = data.filter(
    a => a.density === 'high' || a.density === 'critical'
  );

  const banner = document.getElementById('surge-banner');
  if (surgeAreas.length > 0) {
    banner.style.display = 'block';
    document.getElementById('surge-banner-msg').innerText =
      `High density in: ${surgeAreas.map(a => a.name).join(', ')}.
       Transport and emergency services should be alerted.`;
  } else {
    banner.style.display = 'none';
  }
}

window.dismissSurge = () => {
  document.getElementById('surge-banner').style.display = 'none';
};

// ── PREDICTIONS ───────────────────────────────────────
async function loadPredictions() {
  try {
    const res   = await fetch(`${BACKEND}/api/crowd/predict`);
    const preds = await res.json();

    // Sort by predicted count desc
    preds.sort((a, b) => b.predicted - a.predicted);

    const el = document.getElementById('pred-list');
    if (!preds.length) {
      el.innerHTML =
        '<p style="color:#64748b; font-size:0.82rem;">No predictions available.</p>';
      return;
    }

    el.innerHTML = preds.slice(0, 6).map(p => `
      <div class="pred-row">
        <div class="pred-area">
          ${p.area}
          ${p.eventName
            ? `<div style="color:#f59e0b; font-size:0.72rem;">
                 🎉 ${p.eventName.slice(0, 20)}
               </div>`
            : ''}
        </div>
        <div class="pred-count">
          ~${p.predicted.toLocaleString()}
        </div>
        <span class="pred-badge"
          style="background:${p.color}22; color:${p.color};">
          ${p.densityLabel}
        </span>
      </div>
    `).join('');

    // Show event markers on map
    renderEventMarkers(
      preds.filter(p => p.location && p.eventName)
    );

  } catch {
    document.getElementById('pred-list').innerHTML =
      '<p style="color:#ef4444; font-size:0.82rem;">Failed.</p>';
  }
}

// ── EVENT MARKERS ─────────────────────────────────────
function renderEventMarkers(events) {
  eventMarkers.forEach(m => map.removeLayer(m));
  eventMarkers = [];

  events.forEach(e => {
    if (!e.location?.lat) return;
    const marker = L.marker([e.location.lat, e.location.lng], {
      icon: L.divIcon({
        className: '',
        html: `<div style="
          font-size:20px;
          filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));
        ">🎉</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })
    }).addTo(map);

    marker.bindTooltip(
      `${e.eventName}<br/>~${e.predicted.toLocaleString()} people`,
      { direction: 'top' }
    );

    eventMarkers.push(marker);
  });
}

// ── EVENTS LIST ───────────────────────────────────────
async function loadEvents() {
  try {
    const res    = await fetch(
      `${BACKEND}/api/crowd/events?status=upcoming`
    );
    const events = await res.json();
    const el     = document.getElementById('event-list');

    const typeIcon = {
      festival:'🎉', market:'🛒', political:'📢',
      sports:'⚽', religious:'🕌', other:'📦'
    };

    if (!events.length) {
      el.innerHTML =
        '<p style="color:#64748b; font-size:0.82rem;">No upcoming events.</p>';
      return;
    }

    el.innerHTML = events.slice(0, 5).map(e => `
      <div class="event-item">
        <div class="event-name">
          ${typeIcon[e.type] || '📦'} ${e.name}
        </div>
        <div class="event-meta">
          📍 ${e.area} &bull;
          ${new Date(e.startTime).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
          })}
        </div>
        <span class="event-crowd">
          👥 ${e.expectedCrowd.toLocaleString()} expected
        </span>
      </div>
    `).join('');

  } catch {
    document.getElementById('event-list').innerHTML =
      '<p style="color:#ef4444; font-size:0.82rem;">Failed.</p>';
  }
}

// ── ADD EVENT ─────────────────────────────────────────
window.toggleAddEvent = () => {
  const form = document.getElementById('add-event-form');
  form.style.display =
    form.style.display === 'flex' ? 'none' : 'flex';
};

window.submitEvent = async () => {
  const name   = document.getElementById('ev-name').value.trim();
  const type   = document.getElementById('ev-type').value;
  const area   = document.getElementById('ev-area').value;
  const crowd  = parseInt(document.getElementById('ev-crowd').value);
  const start  = document.getElementById('ev-start').value;
  const end    = document.getElementById('ev-end').value;

  if (!name || !start || !end || !crowd) {
    showToast('Fill all event fields.', 'error'); return;
  }

  const { auth } = await import('./firebase-config.js');
  const token = await auth.currentUser?.getIdToken();

  try {
    await fetch(`${BACKEND}/api/crowd/events`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name, type, area,
        expectedCrowd: crowd,
        startTime:     new Date(start),
        endTime:       new Date(end)
      })
    });

    showToast('✅ Event added!', 'success');
    document.getElementById('add-event-form').style.display = 'none';
    await loadEvents();
    await loadPredictions();
  } catch {
    showToast('Failed to add event.', 'error');
  }
};

// ── SURGE DETECT ──────────────────────────────────────
window.runSurgeDetect = async () => {
  const btn = document.getElementById('surge-btn');
  btn.innerText = '⏳...';
  btn.disabled  = true;

  const { auth } = await import('./firebase-config.js');
  const token = await auth.currentUser?.getIdToken();

  try {
    const res  = await fetch(`${BACKEND}/api/crowd/detect-surge`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    showToast(
      data.triggered > 0
        ? `🚨 ${data.triggered} surge alert(s) fired!`
        : '✅ No surge detected',
      data.triggered > 0 ? 'warning' : 'success'
    );

    await refreshAll();
  } catch {
    showToast('Surge detection failed.', 'error');
  } finally {
    btn.innerText = '🚨 Detect Surge';
    btn.disabled  = false;
  }
};

// ── HISTORY CHART ─────────────────────────────────────
window.loadHistory = async () => {
  const area = document.getElementById('chart-area').value;
  const days = document.getElementById('chart-days').value;

  try {
    const res  = await fetch(
      `${BACKEND}/api/crowd/history?area=${encodeURIComponent(area)}&days=${days}`
    );
    const data = await res.json();

    renderBarChart(data);
  } catch {
    document.getElementById('bar-chart').innerHTML =
      '<p style="color:#64748b;">No history data.</p>';
  }
};

function renderBarChart(data) {
  if (!data.length) {
    document.getElementById('bar-chart').innerHTML =
      '<p style="color:#64748b; font-size:0.82rem; text-align:center;">No data</p>';
    return;
  }

  const maxCount = Math.max(...data.map(d => d.count));
  const chartEl  = document.getElementById('bar-chart');
  const labelEl  = document.getElementById('chart-labels');

  const densityColor = {
    low:      '#22c55e',
    moderate: '#f59e0b',
    high:     '#ef4444',
    critical: '#7c3aed'
  };

  chartEl.innerHTML = data.map(d => {
    const pct   = Math.max((d.count / maxCount) * 100, 4);
    const color = densityColor[d.density] || '#334155';
    const date  = new Date(d.timestamp).toLocaleDateString('en-IN',{
      day:'numeric', month:'short'
    });
    return `
      <div class="bar-chart-bar"
        style="height:${pct}%; background:${color};"
        title="${date}: ${d.count.toLocaleString()} people · ${d.density}">
      </div>
    `;
  }).join('');

  // Labels (every 5th)
  labelEl.innerHTML = data.map((d, i) => {
    const date = new Date(d.timestamp).toLocaleDateString('en-IN',{
      day:'numeric', month:'short'
    });
    return `<span>${i % 5 === 0 ? date : ''}</span>`;
  }).join('');
}