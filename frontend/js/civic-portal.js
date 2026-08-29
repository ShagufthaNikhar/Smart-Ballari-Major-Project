const CP_BACKEND = 'http://localhost:5000';

document.addEventListener('DOMContentLoaded', () => {
  loadCouncillors();
  loadEscalations();
  loadProjects();
});

// ── WARD COUNCILLOR DIRECTORY ─────────────────────────
// Expects GET /api/civic/councillors -> [{ name, ward, area, party, phone }]
async function loadCouncillors() {
  const el = document.getElementById('cp-councillors');
  try {
    const res  = await fetch(`${CP_BACKEND}/api/civic/councillors`);
    const data = await res.json();

    if (!Array.isArray(data) || !data.length) {
      el.innerHTML = '<p class="cp-empty">No councillor data available yet.</p>';
      return;
    }

    el.innerHTML = data.map(c => `
      <div class="cp-councillor-card">
        <div class="cp-avatar">${(c.name || '?').trim().charAt(0).toUpperCase()}</div>
        <div class="cp-councillor-info">
          <div class="name">${escapeHtml(c.name || 'Unknown')}</div>
          <div class="meta">
            Ward ${escapeHtml(c.ward ?? '—')} · ${escapeHtml(c.area || '')}
            ${c.party ? ` · ${escapeHtml(c.party)}` : ''}
          </div>
        </div>
        ${c.phone
          ? `<a class="cp-call-btn" href="tel:${escapeHtml(c.phone)}" title="Call">📞</a>`
          : ''}
      </div>
    `).join('');
  } catch {
    el.innerHTML = '<p class="cp-empty">⚠️ Could not load councillor directory.</p>';
  }
}

// ── GRIEVANCE ESCALATION ──────────────────────────────
// Reuses the existing issues endpoint and filters client-side for
// anything open and pending 7+ days. Adjust the field names below
// (status / createdAt / location.address) if your issues API differs.
async function loadEscalations() {
  const el = document.getElementById('cp-escalations');
  try {
    const res    = await fetch(`${CP_BACKEND}/api/issues`);
    const issues = await res.json();

    const now = Date.now();
    const stale = (Array.isArray(issues) ? issues : [])
      .filter(i => i.status !== 'resolved' && i.status !== 'closed')
      .map(i => {
        const days = i.createdAt
          ? Math.floor((now - new Date(i.createdAt).getTime()) / 86400000)
          : 0;
        return { ...i, daysPending: days };
      })
      .filter(i => i.daysPending >= 7)
      .sort((a, b) => b.daysPending - a.daysPending)
      .slice(0, 6);

    if (!stale.length) {
      el.innerHTML = '<p class="cp-empty">✅ No long-pending grievances right now.</p>';
      return;
    }

    el.innerHTML = stale.map(i => `
      <div class="cp-escalation-row" id="cp-esc-${i._id}">
        <div class="cp-esc-icon">🕐</div>
        <div class="cp-esc-body">
          <div class="title">${escapeHtml(i.title || 'Untitled issue')}</div>
          <div class="meta">
            ${i.daysPending} days pending
            ${i.location?.address ? ` · ${escapeHtml(i.location.address)}` : ''}
          </div>
        </div>
        <button class="cp-escalate-btn" onclick="escalateIssue('${i._id}')">↑ Escalate</button>
      </div>
    `).join('');
  } catch {
    el.innerHTML = '<p class="cp-empty">⚠️ Could not load grievances.</p>';
  }
}

// Expects POST /api/issues/:id/escalate
window.escalateIssue = async (id) => {
  const row = document.getElementById(`cp-esc-${id}`);
  const btn = row?.querySelector('.cp-escalate-btn');
  if (btn) { btn.disabled = true; btn.innerText = 'Escalating...'; }

  try {
    const res = await fetch(`${CP_BACKEND}/api/issues/${id}/escalate`, { method: 'POST' });
    if (!res.ok) throw new Error();
    if (btn) { btn.innerText = '✓ Escalated'; }
    showToast?.('Issue escalated to administration.', 'success');
  } catch {
    if (btn) { btn.disabled = false; btn.innerText = '↑ Escalate'; }
    showToast?.('Could not escalate. Try again.', 'error');
  }
};

// ── BUDGET & DEVELOPMENT PROJECTS ─────────────────────
// Expects GET /api/civic/projects ->
// [{ name, area, category, department, status, percent, spentLakhs, budgetLakhs }]
// status: 'in-progress' | 'delayed' | 'completed' | 'stalled'
async function loadProjects() {
  const el = document.getElementById('cp-projects');
  try {
    const res = await fetch(`${CP_BACKEND}/api/civic/projects`);
    const data = await res.json();

    if (!Array.isArray(data) || !data.length) {
      el.innerHTML = '<p class="cp-empty">No development projects listed yet.</p>';
      return;
    }

    const statusLabel = {
      'in-progress': 'in progress',
      'delayed':     'delayed',
      'completed':   'completed',
      'stalled':     'stalled'
    };
    const statusClass = {
      'in-progress': 'inprogress',
      'delayed':     'delayed',
      'completed':   'completed',
      'stalled':     'stalled'
    };

    el.innerHTML = data.map(p => {
      const cls = statusClass[p.status] || 'inprogress';
      const pct = Math.max(0, Math.min(100, p.percent ?? 0));

      return `
        <div class="cp-project-card">
          <div class="cp-project-top">
            <div>
              <div class="cp-project-name">${escapeHtml(p.name || 'Untitled project')}</div>
              <div class="cp-project-meta">
                ${escapeHtml(p.area || '')}${p.category ? ` · ${escapeHtml(p.category)}` : ''}${p.department ? ` · ${escapeHtml(p.department)}` : ''}
              </div>
            </div>
            <span class="cp-status-badge status-${cls}">${statusLabel[p.status] || p.status}</span>
          </div>

          <div class="cp-progress-track">
            <div class="cp-progress-fill fill-${cls}" style="width:${pct}%;"></div>
          </div>

          <div class="cp-project-footer">
            <span>${pct}% complete</span>
            <span class="amount">
              ₹${(p.spentLakhs ?? 0).toFixed(1)}L / ₹${(p.budgetLakhs ?? 0).toFixed(1)}L
            </span>
          </div>
        </div>
      `;
    }).join('');
  } catch {
    el.innerHTML = '<p class="cp-empty">⚠️ Could not load development projects.</p>';
  }
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}