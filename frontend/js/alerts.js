const BACKEND = 'http://localhost:5000';
const role    = localStorage.getItem('userRole');

let allAlerts     = [];
let activeFilter  = '';

// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (role === 'admin') {
    document.getElementById('run-rules-btn').style.display = 'block';
  }

  await refreshAlerts();
  await loadTrends();

  // Auto-refresh every 2 mins
  setInterval(refreshAlerts, 2 * 60 * 1000);
});

// ── LOAD ALERTS ───────────────────────────────────────
window.refreshAlerts = async () => {
  try {
    const [alertRes, countRes] = await Promise.all([
      fetch(`${BACKEND}/api/alerts`),
      fetch(`${BACKEND}/api/alerts/counts`)
    ]);

    allAlerts        = await alertRes.json();
    const counts     = await countRes.json();

    // Update pills
    document.getElementById('cnt-critical').innerText = counts.critical;
    document.getElementById('cnt-warning').innerText  = counts.warning;
    document.getElementById('cnt-info').innerText     = counts.info;
    document.getElementById('cnt-total').innerText    = counts.total;

    renderAlerts(allAlerts);

  } catch {
    document.getElementById('alert-list').innerHTML =
      '<p style="color:#ef4444; text-align:center;">Could not load alerts.</p>';
  }
};

// ── FILTER ────────────────────────────────────────────
window.filterAlerts = (severity) => {
  activeFilter = severity;

  document.querySelectorAll('.summary-pill').forEach(p =>
    p.classList.remove('active')
  );
  event.target.closest('.summary-pill').classList.add('active');

  const filtered = severity
    ? allAlerts.filter(a => a.severity === severity)
    : allAlerts;
  renderAlerts(filtered);
};

// ── RENDER ────────────────────────────────────────────
function renderAlerts(alerts) {
  const container = document.getElementById('alert-list');

  if (!alerts.length) {
    container.innerHTML = `
      <div class="no-alerts">
        <div class="icon">✅</div>
        <h3>All Clear</h3>
        <p style="color:#64748b; font-size:0.85rem;">
          No active alerts for selected filter.
        </p>
      </div>`;
    return;
  }

  const typeIcon = {
    water:      '💧',
    traffic:    '🚦',
    power:      '⚡',
    crowd:      '👥',
    sanitation: '🗑️',
    surge:      '🚨'
  };

  const canResolve = role === 'admin';

  container.innerHTML = alerts.map(a => {
    const ago = timeAgo(new Date(a.createdAt));
    return `
      <div class="alert-card ${a.severity}" id="alert-${a._id}">
        <div class="alert-top">
          <div class="alert-title">
            ${typeIcon[a.type] || '📋'} ${a.title}
          </div>
          <span class="alert-sev sev-${a.severity}">
            ${a.severity}
          </span>
        </div>

        <div class="alert-msg">${a.message}</div>

        <div class="alert-metric">
          ${a.value !== undefined
            ? `<div class="metric-item">
                 Value: <b>${a.value}</b>
               </div>`
            : ''}
          ${a.threshold !== undefined
            ? `<div class="metric-item">
                 Threshold: <b>${a.threshold}</b>
               </div>`
            : ''}
          ${a.area
            ? `<div class="metric-item">
                 Area: <b>${a.area}</b>
               </div>`
            : ''}
        </div>

        <div class="alert-meta">
          <span>
            🕐 ${ago} &bull; Rule: ${a.triggeredBy}
          </span>
          ${canResolve
            ? `<button class="resolve-btn"
                onclick="resolveAlert('${a._id}')">
                ✓ Resolve
               </button>`
            : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ── RESOLVE ALERT ─────────────────────────────────────
window.resolveAlert = async (id) => {
  const { auth } = await import('./firebase-config.js');
  const token = await auth.currentUser?.getIdToken();

  try {
    await fetch(`${BACKEND}/api/alerts/${id}/resolve`, {
      method:  'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    document.getElementById(`alert-${id}`)?.remove();
    showToast('✅ Alert resolved', 'success');
    await refreshAlerts();
  } catch {
    showToast('Could not resolve alert.', 'error');
  }
};

// ── RUN RULES ─────────────────────────────────────────
window.runRules = async () => {
  const btn = document.getElementById('run-rules-btn');
  btn.innerText = '⏳ Running...';
  btn.disabled  = true;

  const { auth } = await import('./firebase-config.js');
  const token = await auth.currentUser?.getIdToken();

  try {
    const res  = await fetch(`${BACKEND}/api/alerts/run-rules`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    showToast(
      `⚙️ Rules run: ${data.triggered} new alert(s)`,
      data.triggered > 0 ? 'warning' : 'success'
    );

    await refreshAlerts();
  } catch {
    showToast('Could not run rules.', 'error');
  } finally {
    btn.innerText = '⚙️ Run Rules Now';
    btn.disabled  = false;
  }
};

// ── PREDICT ───────────────────────────────────────────
window.runPredict = async () => {
  const type = document.getElementById('pred-type').value;
  const area = document.getElementById('pred-area').value;
  const el   = document.getElementById('predict-result');

  el.innerHTML =
    '<p style="color:#64748b; font-size:0.82rem;">🔮 Predicting...</p>';

  try {
    const url = `${BACKEND}/api/alerts/predict?type=${type}` +
                (area ? `&area=${encodeURIComponent(area)}` : '');
    const res  = await fetch(url);
    const data = await res.json();

    if (!data) {
      el.innerHTML =
        '<p style="color:#64748b;">Not enough data yet.</p>';
      return;
    }

    const trendColor = {
      increasing: '#ef4444',
      decreasing: '#22c55e',
      stable:     '#f59e0b'
    };

    const trendArrow = {
      increasing: '📈', decreasing: '📉', stable: '➡️'
    };

    el.innerHTML = `
      <div class="predict-text">${data.prediction}</div>

      <div class="trend-row">
        <span class="trend-arrow">${trendArrow[data.trend]}</span>
        <span style="color:${trendColor[data.trend]}; font-weight:bold;">
          ${data.trend}
        </span>
        <span style="color:#64748b;">
          (avg: ${data.avg})
        </span>
      </div>

      <div class="predict-conf">
        <span>Confidence</span>
        <div class="conf-mini-bar">
          <div class="conf-mini-fill"
            style="width:${data.confidence}%"></div>
        </div>
        <span>${data.confidence}%</span>
      </div>

      <div class="predict-action">
        💡 ${data.action}
      </div>
    `;
  } catch {
    el.innerHTML =
      '<p style="color:#ef4444; font-size:0.82rem;">Prediction failed.</p>';
  }
};

// ── TRENDS ────────────────────────────────────────────
async function loadTrends() {
  const types = [
    { type: 'water',   label: '💧 Water Pressure', unit: 'bar'      },
    { type: 'traffic', label: '🚦 Traffic',         unit: 'veh/hr'   },
    { type: 'power',   label: '⚡ Power Outages',   unit: '/day'     },
    { type: 'crowd',   label: '👥 Crowd',            unit: 'people'   }
  ];

  const el = document.getElementById('trend-list');
  const rows = [];

  for (const t of types) {
    try {
      const res  = await fetch(
        `${BACKEND}/api/alerts/trends?type=${t.type}&days=7`
      );
      const data = await res.json();
      if (!data) continue;

      const trendColor = {
        increasing: '#ef4444',
        decreasing: '#22c55e',
        stable:     '#f59e0b'
      };

      const trendArrow = {
        increasing: '↑', decreasing: '↓', stable: '→'
      };

      rows.push(`
        <div style="display:flex; justify-content:space-between;
                    align-items:center; padding:0.5rem 0;
                    border-bottom:1px solid #334155; font-size:0.82rem;">
          <span>${t.label}</span>
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span style="color:#94a3b8;">
              avg ${data.avg.toFixed(1)} ${t.unit}
            </span>
            <span style="color:${trendColor[data.trend]};
                         font-weight:bold;">
              ${trendArrow[data.trend]} ${data.trend}
            </span>
          </div>
        </div>
      `);
    } catch { continue; }
  }

  el.innerHTML = rows.join('') ||
    '<p style="color:#64748b; font-size:0.82rem;">No trend data.</p>';
}

// ── HELPER ────────────────────────────────────────────
function timeAgo(date) {
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}