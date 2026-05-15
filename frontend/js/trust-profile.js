const BACKEND = 'http://localhost:5000';

const LEVEL_CONFIG = {
  unverified: { color: '#64748b', emoji: '👤' },
  newcomer:   { color: '#94a3b8', emoji: '🌱' },
  regular:    { color: '#38bdf8', emoji: '🙋' },
  active:     { color: '#22c55e', emoji: '⭐' },
  trusted:    { color: '#f59e0b', emoji: '🛡️' },
  champion:   { color: '#7c3aed', emoji: '🏆' }
};

const ALL_BADGES = [
  { id: 'first_report',  emoji: '📌', name: 'First Report'     },
  { id: 'five_reports',  emoji: '🌟', name: 'Active Reporter'  },
  { id: 'ten_reports',   emoji: '🏆', name: 'Civic Champion'   },
  { id: 'first_resolved',emoji: '✅', name: 'Problem Solver'   },
  { id: 'trusted',       emoji: '🛡️', name: 'Trusted Citizen' },
  { id: 'super_voter',   emoji: '👥', name: 'Community Voice'  },
  { id: 'champion',      emoji: '🎖️', name: 'City Champion'  }
];

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([loadProfile(), loadLeaderboard()]);
});

async function loadProfile() {
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

    renderProfile(trust);
  } catch {
    document.getElementById('profile-card').innerHTML =
      '<p style="color:#ef4444;">Could not load profile.</p>';
  }
}

function renderProfile(trust) {
  const cfg = LEVEL_CONFIG[trust.level] || LEVEL_CONFIG.newcomer;

  // Avatar
  document.getElementById('p-avatar').innerText   = cfg.emoji;
  document.getElementById('p-avatar').style.borderColor = cfg.color;
  document.getElementById('p-name').innerText     =
    trust.email?.split('@')[0] || 'Citizen';
  document.getElementById('p-email').innerText    = trust.email;

  // Level badge
  const lvlEl = document.getElementById('p-level');
  lvlEl.innerText          = trust.level;
  lvlEl.style.background   = cfg.color + '22';
  lvlEl.style.color        = cfg.color;
  lvlEl.style.border       = `1px solid ${cfg.color}`;

  // Score ring
  document.getElementById('score-num').innerText = trust.score;
  document.getElementById('score-num').style.color = cfg.color;
  const circumference = 264;
  const offset = circumference - (trust.score / 100) * circumference;
  const arc = document.getElementById('score-arc');
  arc.style.strokeDashoffset = offset;
  arc.style.stroke = cfg.color;

  // Stats
  document.getElementById('s-reports').innerText  = trust.totalReports;
  document.getElementById('s-resolved').innerText = trust.resolvedReports;
  document.getElementById('s-upvotes').innerText  = trust.upvotesReceived;
  document.getElementById('s-votes').innerText    = trust.votesGiven;

  // Badges
  const earned = trust.badges?.map(b => b.id) || [];
  document.getElementById('badges-grid').innerHTML =
    ALL_BADGES.map(b => `
      <div class="badge-item ${earned.includes(b.id) ? 'earned' : ''}">
        <span>${b.emoji}</span>
        <span style="color:${earned.includes(b.id)
          ? '#f59e0b' : '#475569'}">
          ${b.name}
        </span>
      </div>
    `).join('');

  // Score history
  const history = (trust.history || []).slice(-8).reverse();
  document.getElementById('score-history').innerHTML =
    history.length
      ? history.map(h => {
          const isPos = h.delta > 0;
          return `
            <div class="history-item">
              <span class="delta-pill"
                style="background:${isPos ? '#22c55e22' : '#ef444422'};
                       color:${isPos ? '#22c55e' : '#ef4444'};">
                ${isPos ? '+' : ''}${h.delta}
              </span>
              <span style="flex:1; color:#94a3b8;">
                ${h.reason}
              </span>
              <span style="font-size:0.7rem; color:#475569;">
                ${new Date(h.timestamp).toLocaleDateString('en-IN')}
              </span>
            </div>
          `;
        }).join('')
      : '<p style="color:#64748b; font-size:0.82rem;">No activity yet.</p>';
}

async function loadLeaderboard() {
  try {
    const res   = await fetch(`${BACKEND}/api/community/leaderboard`);
    const board = await res.json();

    document.getElementById('leaderboard').innerHTML =
      board.map((entry, i) => {
        const rank   = i + 1;
        const rankCls = rank === 1 ? 'top1'
                      : rank === 2 ? 'top2'
                      : rank === 3 ? 'top3' : '';
        const medal  = rank === 1 ? '🥇' : rank === 2 ? '🥈'
                      : rank === 3 ? '🥉' : rank;
        const cfg    = LEVEL_CONFIG[entry.level] || LEVEL_CONFIG.newcomer;
        const name   = entry.email?.split('@')[0] || 'Citizen';
        const badge  = entry.badges?.[entry.badges.length - 1]?.emoji || '';

        return `
          <div class="leader-row">
            <div class="leader-rank ${rankCls}">${medal}</div>
            <div style="font-size:1rem;">${cfg.emoji}</div>
            <div class="leader-email">
              ${name}
              ${badge
                ? `<span style="font-size:0.75rem;">${badge}</span>`
                : ''}
            </div>
            <div style="font-size:0.75rem; color:#64748b;
                        margin-right:0.5rem;">
              ${entry.totalReports} reports
            </div>
            <div class="leader-score">${entry.score}</div>
          </div>
        `;
      }).join('');
  } catch {}
}