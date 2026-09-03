import { auth } from "./firebase-config.js";

const BACKEND = 'http://localhost:5000';
const listEl  = document.getElementById('issues-list');

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    listEl.innerHTML = `<div class="empty-state">🔒 Please log in to view your reported issues.</div>`;
    return;
  }

  try {
    const token = await user.getIdToken();
    const res = await fetch(`${BACKEND}/api/issues/mine`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `Server responded ${res.status}`);
    }

    renderIssues(await res.json());
  } catch (err) {
    console.error('Failed to load issues:', err);
    listEl.innerHTML = `<div class="error-state">⚠️ Could not load your issues. ${escapeHtml(err.message)}</div>`;
  }
});

function renderIssues(issues) {
  if (!issues || issues.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        You haven't reported any issues yet.<br />
        <a href="report.html">📌 Report an Issue</a>
      </div>`;
    return;
  }

  listEl.innerHTML = issues.map(cardHtml).join('');
}

function cardHtml(issue) {
  // Field names come from toCitizenView: grievanceId, department, statusLabel,
  // reportedAt, lastUpdated, timeline[], departmentGrievanceContact.
  // There is deliberately no officer name in this payload.
  return `
    <div class="issue-card">
      ${issue.imageUrl
        ? `<img class="issue-thumb" src="${escapeAttr(issue.imageUrl)}" alt="issue photo" />`
        : `<div class="issue-thumb" style="display:flex;align-items:center;justify-content:center;font-size:1.6rem;">${categoryEmoji(issue.category)}</div>`}

      <div class="issue-body">
        <div class="issue-top-row">
          <p class="issue-title">${escapeHtml(issue.title)}</p>
          <span class="issue-gid">${escapeHtml(issue.grievanceId || '')}</span>
        </div>

        <div class="issue-meta">
          <span class="issue-cat">🏢 ${escapeHtml(issue.department || '')}</span>
          <span class="issue-status status-${escapeAttr(issue.status)}">${escapeHtml(issue.statusLabel || issue.status)}</span>
          <span class="issue-date">🕒 ${formatDate(issue.lastUpdated || issue.reportedAt)}</span>
        </div>

        ${issue.description ? `<p class="issue-desc">${escapeHtml(issue.description)}</p>` : ''}

        ${timelineHtml(issue.timeline)}

        ${issue.departmentGrievanceContact ? `
          <div class="issue-helpline">
            <span class="helpline-label">Need help?</span>
            <span class="helpline-dept">${escapeHtml(issue.department)} Grievance Helpline</span>
            <a class="helpline-number" href="tel:${escapeAttr(issue.departmentGrievanceContact)}">
              ☎ ${escapeHtml(issue.departmentGrievanceContact)}
            </a>
          </div>` : ''}
      </div>
    </div>`;
}

function timelineHtml(timeline) {
  if (!timeline || timeline.length === 0) return '';
  return `
    <ol class="issue-timeline">
      ${timeline.map((e, i) => `
        <li class="tl-step ${i === timeline.length - 1 ? 'tl-current' : 'tl-done'}">
          <span class="tl-dot"></span>
          <span class="tl-label">${escapeHtml(e.label || e.status)}</span>
          <span class="tl-time">${formatDate(e.at)}</span>
        </li>`).join('')}
    </ol>`;
}

function formatDate(dateStr) {
  if (!dateStr) return 'Unknown date';
  const d = new Date(dateStr);
  if (isNaN(d)) return 'Unknown date';
  return d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function categoryEmoji(cat) {
  return { road: '🛣️', water: '💧', electric: '⚡', sanitation: '🗑️', other: '📦' }[cat] || '📦';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// For values placed inside HTML attributes (src, href, class).
function escapeAttr(str) {
  return String(str ?? '').replace(/["'<>&]/g, c =>
    ({ '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}