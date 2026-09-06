const BACKEND   = window.SB_API;
const userEmail = localStorage.getItem('userEmail') || '';

const FB_VERSION = '10.12.0';   // must match js/firebase-config.js

const LEVEL_CFG = {
  unverified: { color:'#64748b', emoji:'👤' },
  newcomer:   { color:'#94a3b8', emoji:'🌱' },
  regular:    { color:'#38bdf8', emoji:'🙋' },
  active:     { color:'#22c55e', emoji:'⭐' },
  trusted:    { color:'#f59e0b', emoji:'🛡️' },
  champion:   { color:'#7c3aed', emoji:'🏆' }
};

// Icons for the "Recently Visited" list — keys are real page filenames
const PAGE_ICON = {
  'home.html':                  '🏠',
  'map.html':                   '🗺️',
  'report.html':                '📌',
  'my-issues.html':             '📋',
  'tracker.html':               '🔍',
  'services.html':              '💼',
  'civic-portal.html':          '🏛️',
  'govt-offices.html':          '🏢',
  'jobs.html':                  '💼',
  'colleges.html':              '🎓',
  'hall-booking.html':          '🏛️',
  'municipality-updates.html':  '📢',
  'voice-report.html':          '🎙️',
  'assistant.html':             '🤖',
  'resources.html':             '⚡',
  'alerts.html':                '🔮',
  'crowd.html':                 '👥',
  'satellite.html':             '🛰️',
  'emergency.html':             '🚨',
  'city-dashboard.html':        '🏙️',
  'transport.html':             '🚍',
  'heritage.html':              '🏰',
  'lifestyle.html':             '🌆'
};

document.addEventListener('DOMContentLoaded', () => {
  loadMyIssues();
  loadTrustProfile();
  renderHistory();

  document.getElementById('ch-clear-history')
    ?.addEventListener('click', () => {
      localStorage.removeItem('sb-visits');
      renderHistory();
    });

  setInterval(loadMyIssues, 60000);
});

// ── MY ISSUES ─────────────────────────────────────────
async function loadMyIssues() {
  const el = document.getElementById('my-issues-list');
  try {
    const res = await fetch(
      `${BACKEND}/api/integration/citizen-pulse?email=${encodeURIComponent(userEmail)}`
    );
    if (!res.ok) throw new Error(`citizen-pulse returned ${res.status}`);
    const data = await res.json();
    renderMyIssues(data.myIssues);
  } catch (err) {
    console.error('[dashboard] issues failed:', err);
    el.innerHTML =
      '<div class="empty-state">Could not load your issues. Is the backend running?</div>';
  }
}

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
        <a href="report.html" style="color:#38bdf8; text-decoration:none;">
          Report your first issue →
        </a>
      </div>`;
    return;
  }

  el.innerHTML = issues.map(i => `
    <div class="my-issue-row"
      onclick="window.location.href='tracker.html?id=${i.grievanceId || ''}'">
      <span>${catIcon[i.category] || '📦'}</span>
      <div style="flex:1; min-width:0;">
        <div style="font-weight:500; font-size:0.8rem; color:#f1f5f9;">
          ${window.sbEsc(i.title)}
        </div>
        <div style="color:#64748b; font-size:0.7rem;">
          ${i.grievanceId || '—'} · ${timeAgo(new Date(i.createdAt))}
        </div>
      </div>
      <span style="font-size:0.68rem; padding:0.15rem 0.4rem;
                   border-radius:999px; flex-shrink:0;
                   background:${i.status === 'resolved' ? '#22c55e22' : '#ef444422'};
                   color:${i.status === 'resolved' ? '#22c55e' : '#ef4444'};">
        ${i.status}
      </span>
    </div>`).join('');
}

// ── TRUST PROFILE ─────────────────────────────────────
// Firebase restores the session asynchronously, so currentUser is
// usually null right at DOMContentLoaded. Wait for onAuthStateChanged.
function waitForUser(auth, onAuthStateChanged, timeout = 6000) {
  return new Promise(resolve => {
    if (auth.currentUser) return resolve(auth.currentUser);
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; if (unsub) unsub(); resolve(null); }
    }, timeout);
    const unsub = onAuthStateChanged(auth, user => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      unsub();
      resolve(user);
    });
  });
}

async function loadTrustProfile() {
  try {
    // Reuse the exact app/auth instance that js/auth.js signs in with.
    const [{ auth }, { onAuthStateChanged }] = await Promise.all([
      import('./firebase-config.js'),
      import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-auth.js`)
    ]);

    const user = await waitForUser(auth, onAuthStateChanged);
    if (!user) throw new Error('No signed-in Firebase user');

    const token = await user.getIdToken();
    const res = await fetch(`${BACKEND}/api/community/trust/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`trust/me returned ${res.status}`);

    renderTrust(await res.json(), user.email);
  } catch (err) {
    console.warn('[dashboard] trust profile failed:', err.message);
    renderTrustFallback();
  }
}

function renderTrust(trust, email) {
  const cfg = LEVEL_CFG[trust.level] || LEVEL_CFG.newcomer;

  const avatar = document.getElementById('ch-avatar');
  avatar.innerText = cfg.emoji;
  avatar.style.setProperty('--lcolor', cfg.color);

  document.getElementById('ch-name').innerText =
    (trust.email || email || userEmail).split('@')[0] || 'Citizen';

  document.getElementById('ch-level').innerText =
    `Level: ${trust.level} · ${trust.badges?.length || 0} badges earned`;

  const score = document.getElementById('ch-score');
  score.innerText = trust.score ?? 0;
  score.style.setProperty('--lcolor', cfg.color);

  document.getElementById('ch-reports').innerText =
    `${trust.totalReports ?? 0} reports submitted`;

  document.getElementById('ch-badges').innerHTML =
    (trust.badges || []).map(b =>
      `<span class="badge-mini">${b.emoji} ${b.name}</span>`
    ).join('');
}

function renderTrustFallback() {
  document.getElementById('ch-name').innerText =
    userEmail.split('@')[0] || 'Citizen';
  document.getElementById('ch-level').innerText = userEmail
    ? 'Trust profile unavailable — see console for the reason'
    : 'Sign in to see your trust score';
  document.getElementById('ch-score').innerText = '—';
  document.getElementById('ch-reports').innerText = '— reports';
}

// ── RECENTLY VISITED ──────────────────────────────────
// Data is written by trackVisit() in app.js on every page load.
function renderHistory() {
  const el = document.getElementById('visit-history-list');

  let visits = [];
  try {
    visits = JSON.parse(localStorage.getItem('sb-visits') || '[]');
  } catch (err) {
    visits = [];
  }
  if (!Array.isArray(visits)) visits = [];

  if (!visits.length) {
    el.innerHTML =
      '<div class="empty-state">Nothing visited yet.<br/>Pages you open will show up here.</div>';
    return;
  }

  el.innerHTML = '<div class="link-stack">' + visits.slice(0, 6).map(v => {
    const icon  = PAGE_ICON[v.page] || '📄';
    const label = v.title || v.page;
    return `
      <a class="link-row" href="${v.page}">
        ${icon} ${label}
        <span class="when">${timeAgo(new Date(v.ts))}</span>
      </a>`;
  }).join('') + '</div>';
}

function timeAgo(date) {
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}