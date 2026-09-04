const BACKEND = window.SB_API;

let map;
let mapLayers = { issues: [], buses: [], responders: [] };
let refreshTimer;
let pulse = null;

// ── MODULES CONFIG ────────────────────────────────────
const MODULES = [
  { name: 'Issue Map',     icon: '🗺️', href: 'map.html',           status: 'live' },
  { name: 'Issue Manager', icon: '⚙️', href: 'dashboard.html',     status: 'live' },
  { name: 'User Management', icon: '👥', href: 'users.html',      status: 'live' },
  { name: 'Report Form',   icon: '📌', href: 'report.html',        status: 'live' },
  { name: 'Voice Report',  icon: '🎙️', href: 'voice-report.html', status: 'live' },
  { name: 'Tracker',       icon: '🔍', href: 'tracker.html',       status: 'live' },
  { name: 'Transport',     icon: '🚍', href: 'transport.html',     status: 'live' },
  { name: 'Emergency',     icon: '🚨', href: 'emergency.html',     status: 'live' },
  { name: 'Crowd Intel',   icon: '👥', href: 'crowd.html',         status: 'live' },
  { name: 'Alerts',        icon: '🔮', href: 'alerts.html',        status: 'live' },
  { name: 'Satellite',     icon: '🛰️', href: 'satellite.html',    status: 'live' },
  { name: 'Digital Twin',  icon: '🏙️', href: 'digital-twin.html', status: 'live' },
  { name: 'Heritage AR',   icon: '🏰', href: 'heritage.html',      status: 'live' },
  { name: 'Resources',     icon: '⚡', href: 'resources.html',     status: 'live' },
  { name: 'AI Assistant',  icon: '🤖', href: 'assistant.html',     status: 'live' },
  { name: 'Lifestyle',     icon: '🌆', href: 'lifestyle.html',     status: 'live' },
  { name: 'Services',      icon: '💼', href: 'services.html',      status: 'live' },
  { name: 'Trust Scores',  icon: '🛡️', href: 'trust-profile.html',status: 'live' }
];

// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Guard: admin only
  const role = localStorage.getItem('userRole');
  if (role !== 'admin') {
    window.location.href = 'citizen-dashboard.html';
    return;
  }

  initMap();
  renderModules();
  await loadAll();

  // Auto-refresh every 30s
  refreshTimer = setInterval(loadAll, 30000);
});

// ── LOAD ALL ──────────────────────────────────────────
window.loadAll = async () => {
  try {
    const res  = await fetch(`${BACKEND}/api/integration/city-pulse`);
    const data = await res.json();
    renderAll(data);
  } catch (err) {
    console.error('Pulse error:', err);
  }
};

// ── RENDER ALL ────────────────────────────────────────
function renderAll(data) {
  renderHealth(data.health);
  renderKPIs(data);
  renderTrend(data.issues.trend);
  renderCategories(data.issues.categories);
  renderCrowd(data.crowd);
  renderLiveFeed(data);
  renderDeployments(data.resources.deployments);
  renderCriticalIssues(data.issues.recent);
  renderMapData(data);
  updateSidebarBadges(data);
}

// ── HEALTH ────────────────────────────────────────────
function renderHealth(health) {
  const pill = document.getElementById('health-pill');
  pill.style.setProperty('--hcolor', health.color);
  document.getElementById('health-score').innerText  = health.score;
  document.getElementById('health-label').innerText  = health.label;
}

// ── KPIs ──────────────────────────────────────────────
function renderKPIs(data) {
  document.getElementById('k-open').innerText      = data.issues.open;
  document.getElementById('k-alerts').innerText    = data.alerts.active;
  document.getElementById('k-incidents').innerText = data.emergency.activeIncidents;
  document.getElementById('k-resolved').innerText  = data.issues.resolvedToday;
  document.getElementById('k-resources').innerText = data.resources.available;
  document.getElementById('k-buses').innerText     = data.transport.activeBuses;
  document.getElementById('k-citizens').innerText  = data.community.totalCitizens;
  document.getElementById('k-rate').innerText      = data.resolutionRate + '%';
}

// ── 7-DAY TREND ───────────────────────────────────────
function renderTrend(trend) {
  if (!trend?.length) return;

  const maxVal = Math.max(...trend.map(t => t.reported), 1);
  const chart  = document.getElementById('trend-chart');
  const labels = document.getElementById('trend-labels');

  chart.innerHTML = trend.map(t => {
    const rPct = Math.max((t.reported / maxVal) * 100, 4);
    const resPct = Math.max((t.resolved / maxVal) * 100, 0);
    return `
      <div style="flex:1; display:flex; flex-direction:column;
                  align-items:center; gap:2px; justify-content:flex-end;
                  height:100%;">
        <div class="trend-bar"
          style="height:${rPct}%; background:#ef444466; width:100%;"
          title="${t.date}: ${t.reported} reported"></div>
        <div class="trend-bar"
          style="height:${resPct}%; background:#22c55e;
                 width:60%; margin-top:-${resPct}px; position:relative;
                 bottom:0;"
          title="${t.date}: ${t.resolved} resolved"></div>
      </div>
    `;
  }).join('');

  labels.innerHTML = trend.map(t =>
    `<span>${t.date.split(' ')[0]}</span>`
  ).join('');
}

// ── CATEGORIES ────────────────────────────────────────
function renderCategories(cats) {
  const catConfig = {
    road:       { emoji: '🛣️', color: '#f59e0b' },
    water:      { emoji: '💧', color: '#38bdf8' },
    electric:   { emoji: '⚡', color: '#facc15' },
    sanitation: { emoji: '🗑️', color: '#a3e635' },
    other:      { emoji: '📦', color: '#94a3b8' }
  };

  const maxCount = Math.max(...cats.map(c => c.count), 1);
  const el = document.getElementById('category-breakdown');

  el.innerHTML = cats.map(c => {
    const cfg = catConfig[c._id] || { emoji:'📦', color:'#334155' };
    const pct = Math.round((c.count / maxCount) * 100);
    return `
      <div class="cat-row">
        <span>${cfg.emoji}</span>
        <span class="cat-name">${c._id}</span>
        <div class="cat-bar-bg">
          <div class="cat-bar-fill"
            style="width:${pct}%; background:${cfg.color};"></div>
        </div>
        <span class="cat-count" style="color:${cfg.color};">
          ${c.count}
        </span>
      </div>
    `;
  }).join('') || '<p style="color:#64748b; font-size:0.82rem;">No data.</p>';
}

// ── CROWD SNAPSHOT ────────────────────────────────────
function renderCrowd(crowd) {
  if (crowd.surgingAreas > 0) {
    document.getElementById('surge-indicator').innerHTML =
      `<span style="color:#ef4444; animation:pulse 1.5s infinite;">
         🚨 ${crowd.surgingAreas} surging
       </span>`;
  }

  const el = document.getElementById('crowd-snapshot');
  el.innerHTML = (crowd.areas || []).slice(0, 5).map(a => `
    <div style="display:flex; align-items:center; gap:0.6rem;
                padding:0.35rem 0; font-size:0.78rem;
                border-bottom:1px solid #1e293b;">
      <div style="width:8px; height:8px; border-radius:50%;
                  background:${a.color}; flex-shrink:0;"></div>
      <span style="flex:1; color:#94a3b8;">${a.name}</span>
      <span style="color:${a.color}; font-weight:bold;">
        ${a.densityLabel}
      </span>
      <span style="color:#64748b; font-size:0.7rem;">
        ~${a.count?.toLocaleString()}
      </span>
    </div>
  `).join('') || '<p style="color:#64748b; font-size:0.82rem;">No data.</p>';
}

// ── LIVE FEED ─────────────────────────────────────────
function renderLiveFeed(data) {
  const feed = [];
  const now  = Date.now();

  // Recent issues
  (data.issues.recent || []).forEach(i => {
    feed.push({
      dot:   '#ef4444',
      text:  `New issue: ${i.title} [${i.category}]`,
      time:  timeAgo(new Date(i.createdAt)),
      ts:    new Date(i.createdAt).getTime()
    });
  });

  // Deployments
  (data.resources.deployments || []).forEach(d => {
    feed.push({
      dot:  '#38bdf8',
      text: `${d.resourceName} deployed to ${d.area}`,
      time: timeAgo(new Date(d.dispatchedAt)),
      ts:   new Date(d.dispatchedAt).getTime()
    });
  });

  // Buses
  if (data.transport.activeBuses > 0) {
    feed.push({
      dot:  '#a78bfa',
      text: `${data.transport.activeBuses} buses active on city routes`,
      time: 'Live',
      ts:   now
    });
  }

  // Crowd surge
  if (data.crowd.surgingAreas > 0) {
    feed.push({
      dot:  '#f59e0b',
      text: `Crowd surge in: ${data.crowd.hotspots.join(', ')}`,
      time: 'Now',
      ts:   now + 1
    });
  }

  // Sort by most recent
  feed.sort((a, b) => b.ts - a.ts);

  document.getElementById('live-feed').innerHTML =
    feed.slice(0, 12).map(f => `
      <div class="feed-item">
        <div class="feed-dot" style="background:${f.dot};"></div>
        <span class="feed-text">${f.text}</span>
        <span class="feed-time">${f.time}</span>
      </div>
    `).join('') ||
    '<p style="color:#64748b; font-size:0.82rem;">No activity.</p>';
}

// ── DEPLOYMENTS ───────────────────────────────────────
function renderDeployments(deps) {
  const typeIcon = {
    'garbage-truck': '🗑️', 'ambulance': '🚑',
    'water-tanker': '💧', 'police-van': '🚔', 'fire-truck': '🚒'
  };

  document.getElementById('deployments-list').innerHTML =
    deps?.length
      ? deps.map(d => `
          <div style="display:flex; align-items:center; gap:0.7rem;
                      padding:0.5rem 0; border-bottom:1px solid #1e293b;
                      font-size:0.78rem;">
            <span style="font-size:1rem;">
              ${typeIcon[d.resourceType] || '🚗'}
            </span>
            <div style="flex:1;">
              <div style="font-weight:600;">${d.resourceName}</div>
              <div style="color:#64748b; font-size:0.7rem;">
                📍 ${d.area}
              </div>
            </div>
            <span style="font-size:0.68rem; padding:0.15rem 0.45rem;
                         border-radius:999px; font-weight:bold;
                         background:${d.priority==='critical'
                           ? '#ef444422' : '#f59e0b22'};
                         color:${d.priority==='critical'
                           ? '#ef4444' : '#f59e0b'};">
              ${d.priority}
            </span>
          </div>
        `).join('')
      : '<p style="color:#64748b; font-size:0.82rem;">No active deployments.</p>';
}

// ── CRITICAL ISSUES ───────────────────────────────────
function renderCriticalIssues(issues) {
  const catIcon = {
    road:'🛣️', water:'💧', electric:'⚡',
    sanitation:'🗑️', other:'📦'
  };

  document.getElementById('critical-issues').innerHTML =
    issues?.length
      ? issues.map(i => `
          <div style="display:flex; align-items:flex-start; gap:0.6rem;
                      padding:0.5rem 0; border-bottom:1px solid #1e293b;
                      font-size:0.78rem; cursor:pointer;"
            onclick="window.location.href='tracker.html?id=${i.grievanceId||''}'">
            <span>${catIcon[i.category] || '📦'}</span>
            <div style="flex:1;">
              <div style="font-weight:600; color:#f1f5f9;">
                ${i.title}
              </div>
              <div style="color:#64748b; font-size:0.7rem;">
                ${timeAgo(new Date(i.createdAt))}
                · votes: ${i.voteScore || 0}
              </div>
            </div>
            <span style="font-size:0.68rem; padding:0.15rem 0.4rem;
                         border-radius:999px; background:#ef444422;
                         color:#ef4444; flex-shrink:0;">
              ${i.status}
            </span>
          </div>
        `).join('')
      : '<p style="color:#64748b; font-size:0.82rem;">No critical issues.</p>';
}

// ── MAP ───────────────────────────────────────────────
function initMap() {
  map = L.map('admin-map', { zoomControl: false })
    .setView([15.1394, 76.9214], 13);

  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    { attribution: '© CartoDB', maxZoom: 19 }
  ).addTo(map);
}

function renderMapData(data) {
  // Clear layers
  Object.values(mapLayers).forEach(arr => {
    arr.forEach(m => map.removeLayer(m));
  });
  mapLayers = { issues: [], buses: [], responders: [] };

  // Issue markers
  (data.issues.recent || []).forEach(i => {
    if (!i.location?.coordinates?.lat) return;
    const m = L.circleMarker(
      [i.location.coordinates.lat, i.location.coordinates.lng],
      { radius: 6, fillColor: '#ef4444',
        color: '#0f172a', fillOpacity: 0.85, weight: 1 }
    ).addTo(map).bindTooltip(i.title, { direction:'top' });
    mapLayers.issues.push(m);
  });

  // Bus markers
  (data.transport.buses || []).forEach(b => {
    if (!b.lat || !b.lng) return;
    const m = L.marker([b.lat, b.lng], {
      icon: L.divIcon({
        className: '',
        html: `<div style="background:${b.color || '#38bdf8'};
          color:#0f172a; padding:2px 5px; border-radius:6px;
          font-size:10px; font-weight:bold;">
          🚍 ${b.routeNumber}
        </div>`,
        iconSize: [60, 22], iconAnchor: [30, 11]
      })
    }).addTo(map);
    mapLayers.buses.push(m);
  });
}

// ── SIDEBAR BADGES ────────────────────────────────────
function updateSidebarBadges(data) {
  document.getElementById('sb-open').innerText     = data.issues.open;
  document.getElementById('sb-alerts').innerText   = data.alerts.active;
  document.getElementById('sb-incidents').innerText = data.emergency.activeIncidents;
}

// ── MODULE GRID ───────────────────────────────────────
function renderModules() {
  document.getElementById('module-grid').innerHTML =
    MODULES.map(m => `
      <a href="${m.href}" class="module-card">
        <span class="module-icon">${m.icon}</span>
        <div class="module-info">
          <div class="module-name">${m.name}</div>
          <div class="module-status">● ${m.status}</div>
        </div>
      </a>
    `).join('');
}

// ── RUN ALL SYSTEMS ───────────────────────────────────
window.runAllSystems = async () => {
  const btn = document.querySelector('.run-btn');
  btn.innerText = '⏳ Running...';
  btn.disabled  = true;

  try {
    const { auth } = await import('./firebase-config.js');
    const token = await auth.currentUser?.getIdToken();

    const res  = await fetch(`${BACKEND}/api/integration/run-all`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Run refused');
    const data = await res.json();

    showToast(
      `✅ Systems run: ${data.newAlerts} alerts, ${data.newSurges} surges`,
      'success'
    );
    await loadAll();
  } catch {
    showToast('System run failed.', 'error');
  } finally {
    btn.innerText = '⚙️ Run All Systems';
    btn.disabled  = false;
  }
};

function timeAgo(date) {
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}