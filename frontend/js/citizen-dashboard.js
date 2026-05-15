const BACKEND   = 'http://localhost:5000';
const userEmail = localStorage.getItem('userEmail') || '';

const LEVEL_CFG = {
  unverified: { color:'#64748b', emoji:'👤' },
  newcomer:   { color:'#94a3b8', emoji:'🌱' },
  regular:    { color:'#38bdf8', emoji:'🙋' },
  active:     { color:'#22c55e', emoji:'⭐' },
  trusted:    { color:'#f59e0b', emoji:'🛡️' },
  champion:   { color:'#7c3aed', emoji:'🏆' }
};

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([
    loadCitizenPulse(),
    loadTrustProfile()
  ]);
  // Auto-refresh every 60s
  setInterval(loadCitizenPulse, 60000);
});

// ── CITIZEN PULSE ─────────────────────────────────────
async function loadCitizenPulse() {
  try {
    const res  = await fetch(
      `${BACKEND}/api/integration/citizen-pulse?email=${userEmail}`
    );
    const data = await res.json();

    renderMyIssues(data.myIssues);
    renderAlerts(data.alerts);
    renderBuses(data.buses);
    renderCrowd(data.crowd);
  } catch {}
}

// ── TRUST PROFILE ─────────────────────────────────────
async function loadTrustProfile() {
  try {
    const { getAuth } = await import(
      'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'
    );
    const token = await getAuth().currentUser?.getIdToken();
    if (!token) return;

    const res   = await fetch(`${BACKEND}/api/community/trust/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const trust = await res.json();

    const cfg = LEVEL_CFG[trust.level] || LEVEL_CFG.newcomer;

    document.getElementById('ch-avatar').innerText = cfg.emoji;
    document.getElementById('ch-avatar').style.setProperty(
      '--lcolor', cfg.color
    );
    document.getElementById('ch-name').innerText  =
      trust.email?.split('@')[0] || 'Citizen';
    document.getElementById('ch-level').innerText =
      `Level: ${trust.level} · ${trust.badges?.length || 0} badges earned`;
    document.getElementById('ch-score').innerText = trust.score;
    document.getElementById('ch-score').style.setProperty(
      '--lcolor', cfg.color
    );
    document.getElementById('ch-reports').innerText =
      `${trust.totalReports} reports submitted`;

    // Show badges
    document.getElementById('ch-badges').innerHTML =
      (trust.badges || []).map(b =>
        `<span class="badge-mini">${b.emoji} ${b.name}</span>`
      ).join('');
  } catch {}
}

// ── RENDER MY ISSUES ──────────────────────────────────
function renderMyIssues(issues) {
  const catIcon = {
    road:'🛣️', water:'💧', electric:'⚡',
    sanitation:'🗑️', other:'📦'
  };

  const el = document.getElementById('my-issues-list');

  if (!issues?.length) {
    el.innerHTML = `
      <div class="empty-state">
        No issues reported yet.<br/>
        <a href="report.html"
          style="color:#38bdf8; text-decoration:none;">
          Report your first issue →
        </a>
      </div>
    `;
    return;
  }

  el.innerHTML = issues.map(i => `
    <div class="my-issue-row"
      onclick="window.location.href='tracker.html?id=${i.grievanceId||''}'">
      <span>${catIcon[i.category] || '📦'}</span>
      <div style="flex:1;">
        <div style="font-weight:500; font-size:0.8rem; color:#f1f5f9;">
          ${i.title}
        </div>
        <div style="color:#64748b; font-size:0.7rem;">
          ${i.grievanceId || '—'} ·
          ${timeAgo(new Date(i.createdAt))}
        </div>
      </div>
      <span style="font-size:0.68rem; padding:0.15rem 0.4rem;
                   border-radius:999px; flex-shrink:0;
                   background:${i.status==='resolved'
                     ? '#22c55e22' : '#ef444422'};
                   color:${i.status==='resolved'
                     ? '#22c55e' : '#ef4444'};">
        ${i.status}
      </span>
    </div>
  `).join('');
}

// ── RENDER ALERTS ─────────────────────────────────────
function renderAlerts(alerts) {
  const el = document.getElementById('city-alerts-list');

  if (!alerts?.length) {
    el.innerHTML =
      '<div class="empty-state">✅ No active alerts. City is safe.</div>';
    return;
  }

  const sevColor = {
    critical:'#ef4444', warning:'#f59e0b', info:'#38bdf8'
  };

  el.innerHTML = alerts.map(a => `
    <div class="alert-item-c">
      <div style="width:6px; height:6px; border-radius:50%;
                  background:${sevColor[a.severity]};
                  flex-shrink:0; margin-top:5px;">
      </div>
      <div style="flex:1;">
        <div style="font-size:0.8rem; font-weight:500; color:#f1f5f9;">
          ${a.title}
        </div>
        <div style="font-size:0.72rem; color:#64748b;">
          ${a.area || 'City-wide'} ·
          <span style="color:${sevColor[a.severity]};">
            ${a.severity}
          </span>
        </div>
      </div>
    </div>
  `).join('');
}

// ── RENDER BUSES ──────────────────────────────────────
function renderBuses(buses) {
  const el = document.getElementById('live-buses-list');

  if (!buses?.length) {
    el.innerHTML =
      '<div class="empty-state">No live buses right now.</div>';
    return;
  }

  el.innerHTML = buses.map(b => `
    <div class="bus-item">
      <div style="background:${b.color}; color:#0f172a;
                  padding:2px 7px; border-radius:6px;
                  font-size:0.72rem; font-weight:bold;
                  flex-shrink:0;">
        ${b.routeNumber}
      </div>
      <div style="flex:1; font-size:0.78rem; color:#94a3b8;">
        ${b.routeName}
      </div>
      <div style="font-size:0.7rem; color:#64748b;">
        ${b.direction}
      </div>
    </div>
  `).join('');
}

// ── RENDER CROWD ──────────────────────────────────────
function renderCrowd(areas) {
  const el = document.getElementById('crowd-density-list');

  if (!areas?.length) {
    el.innerHTML = '<div class="empty-state">No crowd data.</div>';
    return;
  }

  el.innerHTML = areas.map(a => `
    <div style="display:flex; align-items:center; gap:0.6rem;
                padding:0.4rem 0; border-bottom:1px solid #1e293b;
                font-size:0.78rem;">
      <div style="width:8px; height:8px; border-radius:50%;
                  background:${a.color}; flex-shrink:0;"></div>
      <span style="flex:1; color:#94a3b8;">${a.name}</span>
      <span style="color:${a.color}; font-weight:bold;
                   font-size:0.72rem;">
        ${a.densityLabel}
      </span>
    </div>
  `).join('');
}

function timeAgo(date) {
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}