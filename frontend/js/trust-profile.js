const BACKEND = 'http://localhost:5000';

const FB_VERSION = '10.12.0';   // must match js/firebase-config.js

const LEVEL_CONFIG = {
  unverified: { color: '#64748b', emoji: '👤' },
  newcomer:   { color: '#94a3b8', emoji: '🌱' },
  regular:    { color: '#38bdf8', emoji: '🙋' },
  active:     { color: '#22c55e', emoji: '⭐' },
  trusted:    { color: '#f59e0b', emoji: '🛡️' },
  champion:   { color: '#7c3aed', emoji: '🏆' }
};

const ALL_BADGES = [
  { id: 'first_report',   emoji: '📌', name: 'First Report'    },
  { id: 'five_reports',   emoji: '🌟', name: 'Active Reporter' },
  { id: 'ten_reports',    emoji: '🏆', name: 'Civic Champion'  },
  { id: 'first_resolved', emoji: '✅', name: 'Problem Solver'  },
  { id: 'trusted',        emoji: '🛡️', name: 'Trusted Citizen' },
  { id: 'super_voter',    emoji: '👥', name: 'Community Voice' },
  { id: 'champion',       emoji: '🎖️', name: 'City Champion'   }
];

document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  loadLeaderboard();
});

// Escape anything that came from a user before putting it in innerHTML
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── AUTH ──────────────────────────────────────────────
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

async function getIdToken() {
  // Reuse the exact app/auth instance that js/auth.js signs in with.
  const [{ auth }, { onAuthStateChanged }] = await Promise.all([
    import('./firebase-config.js'),
    import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-auth.js`)
  ]);

  const user = await waitForUser(auth, onAuthStateChanged);
  if (!user) throw new Error('No signed-in Firebase user');

  return user.getIdToken();
}

// ── PROFILE ───────────────────────────────────────────
async function loadProfile() {
  try {
    const token = await getIdToken();

    const res = await fetch(`${BACKEND}/api/community/trust/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`trust/me returned ${res.status}`);

    renderProfile(await res.json());
  } catch (err) {
    console.error('[trust-profile] load failed:', err.message);
    showProfileError(err.message);
  }
}

function showProfileError(msg) {
  document.getElementById('p-name').innerText  = 'Profile unavailable';
  document.getElementById('p-email').innerText = msg;
  document.getElementById('p-level').innerText = '—';
  document.getElementById('badges-grid').innerHTML =
    '<p style="color:#64748b; font-size:0.82rem;">Sign in to see your badges.</p>';
  document.getElementById('score-history').innerHTML =
    '<p style="color:#64748b; font-size:0.82rem;">No history to show.</p>';
}

function renderProfile(trust) {
  const cfg = LEVEL_CONFIG[trust.level] || LEVEL_CONFIG.newcomer;
  const score = Number(trust.score) || 0;

  // Avatar + name
  const avatar = document.getElementById('p-avatar');
  avatar.innerText = cfg.emoji;
  avatar.style.borderColor = cfg.color;

  document.getElementById('p-name').innerText =
    trust.email?.split('@')[0] || 'Citizen';
  document.getElementById('p-email').innerText = trust.email || '—';

  // Level badge
  const lvlEl = document.getElementById('p-level');
  lvlEl.innerText        = trust.level || 'unknown';
  lvlEl.style.background = cfg.color + '22';
  lvlEl.style.color      = cfg.color;
  lvlEl.style.border     = `1px solid ${cfg.color}`;

  // Score ring (r=42 -> circumference ~264)
  const numEl = document.getElementById('score-num');
  numEl.innerText   = score;
  numEl.style.color = cfg.color;

  const circumference = 264;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const arc = document.getElementById('score-arc');
  arc.style.strokeDashoffset = circumference - pct * circumference;
  arc.style.stroke = cfg.color;

  // Stats — default to 0 so nothing renders as "undefined"
  document.getElementById('s-reports').innerText  = trust.totalReports     ?? 0;
  document.getElementById('s-resolved').innerText = trust.resolvedReports  ?? 0;
  document.getElementById('s-upvotes').innerText  = trust.upvotesReceived  ?? 0;
  document.getElementById('s-votes').innerText    = trust.votesGiven       ?? 0;

  // Badges
  const earned = (trust.badges || []).map(b => b.id);
  document.getElementById('badges-grid').innerHTML =
    ALL_BADGES.map(b => `
      <div class="badge-item ${earned.includes(b.id) ? 'earned' : ''}">
        <span>${b.emoji}</span>
        <span style="color:${earned.includes(b.id) ? '#f59e0b' : '#475569'}">
          ${b.name}
        </span>
      </div>`).join('');

  // Score history (newest first)
  const history = (Array.isArray(trust.history) ? trust.history : [])
    .slice(-8).reverse();

  document.getElementById('score-history').innerHTML = history.length
    ? history.map(h => {
        const isPos = h.delta > 0;
        return `
          <div class="history-item">
            <span class="delta-pill"
              style="background:${isPos ? '#22c55e22' : '#ef444422'};
                     color:${isPos ? '#22c55e' : '#ef4444'};">
              ${isPos ? '+' : ''}${h.delta}
            </span>
            <span style="flex:1; color:#94a3b8;">${esc(h.reason)}</span>
            <span style="font-size:0.7rem; color:#475569;">
              ${new Date(h.timestamp).toLocaleDateString('en-IN')}
            </span>
          </div>`;
      }).join('')
    : '<p style="color:#64748b; font-size:0.82rem;">No activity yet.</p>';
}

// ── LEADERBOARD ───────────────────────────────────────
async function loadLeaderboard() {
  const el = document.getElementById('leaderboard');
  try {
    const res = await fetch(`${BACKEND}/api/community/leaderboard`);
    if (!res.ok) throw new Error(`leaderboard returned ${res.status}`);

    const board = await res.json();
    if (!Array.isArray(board)) {
      throw new Error('leaderboard did not return an array');
    }
    if (!board.length) {
      el.innerHTML =
        '<p style="color:#64748b; font-size:0.82rem;">No citizens ranked yet.</p>';
      return;
    }

    el.innerHTML = board.map((entry, i) => {
      const rank    = i + 1;
      const rankCls = rank === 1 ? 'top1'
                    : rank === 2 ? 'top2'
                    : rank === 3 ? 'top3' : '';
      const medal   = rank === 1 ? '🥇'
                    : rank === 2 ? '🥈'
                    : rank === 3 ? '🥉' : rank;
      const cfg     = LEVEL_CONFIG[entry.level] || LEVEL_CONFIG.newcomer;
      const name    = entry.email?.split('@')[0] || 'Citizen';
      const badge   = entry.badges?.[entry.badges.length - 1]?.emoji || '';

      return `
        <div class="leader-row">
          <div class="leader-rank ${rankCls}">${medal}</div>
          <div style="font-size:1rem;">${cfg.emoji}</div>
          <div class="leader-email">
            ${esc(name)}
            ${badge ? `<span style="font-size:0.75rem;">${badge}</span>` : ''}
          </div>
          <div style="font-size:0.75rem; color:#64748b; margin-right:0.5rem;">
            ${entry.totalReports ?? 0} reports
          </div>
          <div class="leader-score">${entry.score ?? 0}</div>
        </div>`;
    }).join('');
  } catch (err) {
    console.error('[trust-profile] leaderboard failed:', err.message);
    el.innerHTML =
      '<p style="color:#64748b; font-size:0.82rem;">Could not load the leaderboard.</p>';
  }
}