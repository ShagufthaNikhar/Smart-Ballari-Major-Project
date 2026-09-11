const ALERTS_BACKEND = window.SB_API;

let allAlerts     = [];
let activeFilter   = '';
const isAdmin       = localStorage.getItem('userRole') === 'admin';

document.addEventListener('DOMContentLoaded', () => {
  if (isAdmin) {
    document.getElementById('create-alert-card').style.display = 'block';
  }
  loadAlerts();
});

// ── LOAD + COUNTS ──────────────────────────────────────
async function loadAlerts() {
  const list = document.getElementById('alert-list');
  try {
    const [alertsRes, countsRes] = await Promise.all([
      fetch(`${ALERTS_BACKEND}/api/alerts`),
      fetch(`${ALERTS_BACKEND}/api/alerts/counts`)
    ]);
    allAlerts = await alertsRes.json();
    const counts = await countsRes.json();

    document.getElementById('cnt-total').innerText    = counts.total    ?? 0;
    document.getElementById('cnt-critical').innerText = counts.critical ?? 0;
    document.getElementById('cnt-warning').innerText  = counts.warning  ?? 0;
    document.getElementById('cnt-info').innerText     = counts.info     ?? 0;

    renderAlerts();
  } catch (err) {
    console.error('Load alerts failed:', err.message);
    list.innerHTML = '<p style="color:#ef4444; text-align:center; padding:2rem;">⚠️ Could not load alerts.</p>';
  }
}

window.refreshAlerts = loadAlerts;

// ── FILTER ─────────────────────────────────────────────
window.filterAlerts = (severity) => {
  activeFilter = severity;
  document.querySelectorAll('.summary-pill').forEach(pill => {
    pill.classList.remove('active');
  });
  event.currentTarget.classList.add('active');
  renderAlerts();
};

// ── RENDER ─────────────────────────────────────────────
function renderAlerts() {
  const list = document.getElementById('alert-list');
  const filtered = activeFilter
    ? allAlerts.filter(a => a.severity === activeFilter)
    : allAlerts;

  if (!filtered.length) {
    list.innerHTML = `
      <div class="no-alerts">
        <div class="icon">✅</div>
        <p>No alerts right now.</p>
      </div>`;
    return;
  }

  list.innerHTML = filtered.map(a => `
    <div class="alert-card ${a.severity}">
      <div class="alert-top">
        <div class="alert-title">${escapeHtml(a.title)}</div>
        <span class="alert-sev sev-${a.severity}">${a.severity}</span>
      </div>
      <p class="alert-msg">${escapeHtml(a.message)}</p>
      <div class="alert-meta">
        <span>${a.area ? '📍 ' + escapeHtml(a.area) : '🌐 City-wide'} · ${timeAgo(new Date(a.createdAt))}</span>
        ${isAdmin ? `<button class="resolve-btn" onclick="resolveAlert('${a._id}')">Resolve</button>` : ''}
      </div>
    </div>
  `).join('');
}

// ── CREATE (admin) ─────────────────────────────────────
window.submitAlert = async () => {
  const btn    = document.getElementById('ca-submit-btn');
  const status = document.getElementById('ca-status');

  const type     = document.getElementById('ca-type').value;
  const severity = document.getElementById('ca-severity').value;
  const title    = document.getElementById('ca-title').value.trim();
  const area     = document.getElementById('ca-area').value.trim();
  const message  = document.getElementById('ca-message').value.trim();

  if (!title || !message) {
    status.textContent = 'Title and message are required.';
    status.className = 'ca-status error';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Posting...';
  status.textContent = '';

  try {
    const { auth } = await import('./firebase-config.js');
    const token = await auth.currentUser?.getIdToken();

    const res = await fetch(`${ALERTS_BACKEND}/api/alerts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ type, severity, title, message, area: area || undefined })
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `Request failed: ${res.status}`);
    }

    document.getElementById('ca-title').value = '';
    document.getElementById('ca-area').value = '';
    document.getElementById('ca-message').value = '';
    status.textContent = 'Alert posted.';
    status.className = 'ca-status success';

    await loadAlerts();
  } catch (err) {
    status.textContent = err.message;
    status.className = 'ca-status error';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Post Alert';
  }
};

// ── RESOLVE (admin) ─────────────────────────────────────
window.resolveAlert = async (id) => {
  try {
    const { auth } = await import('./firebase-config.js');
    const token = await auth.currentUser?.getIdToken();

    const res = await fetch(`${ALERTS_BACKEND}/api/alerts/${id}/resolve`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Resolve failed');
    await loadAlerts();
  } catch (err) {
    console.error('Resolve alert failed:', err.message);
  }
};

// ── HELPERS ─────────────────────────────────────────────
function timeAgo(date) {
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}