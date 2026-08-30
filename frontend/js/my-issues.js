import { auth } from "./firebase-config.js";

const BACKEND = 'http://localhost:5000';

const listEl = document.getElementById('issues-list');

// Wait for Firebase auth to resolve before fetching
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    listEl.innerHTML = `
      <div class="empty-state">
        🔒 Please log in to view your reported issues.
      </div>
    `;
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

    const issues = await res.json();
    renderIssues(issues);

  } catch (err) {
    console.error('Failed to load issues:', err);
    listEl.innerHTML = `
      <div class="error-state">
        ⚠️ Could not load your issues. ${escapeHtml(err.message)}
      </div>
    `;
  }
});

function renderIssues(issues) {
  if (!issues || issues.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        You haven't reported any issues yet.
        <br />
        <a href="report.html">📌 Report an Issue</a>
      </div>
    `;
    return;
  }

  listEl.innerHTML = issues.map(issue => `
    <div class="issue-card">
      ${issue.imageUrl
        ? `<img class="issue-thumb" src="${issue.imageUrl}" alt="issue photo" />`
        : `<div class="issue-thumb" style="display:flex;align-items:center;justify-content:center;font-size:1.6rem;">${categoryEmoji(issue.category)}</div>`
      }
      <div class="issue-body">
        <div class="issue-top-row">
          <p class="issue-title">${escapeHtml(issue.title)}</p>
          <span class="issue-gid">${escapeHtml(issue.grievanceId || '')}</span>
        </div>
        <div class="issue-meta">
          <span class="issue-cat">${categoryLabel(issue.category)}</span>
          <span class="issue-status status-${issue.status}">${escapeHtml(issue.status)}</span>
          <span class="issue-date">🕒 ${formatDate(issue.createdAt)}</span>
        </div>
        ${issue.description
          ? `<p class="issue-desc">${escapeHtml(issue.description)}</p>`
          : ''
        }
      </div>
    </div>
  `).join('');
}

function formatDate(dateStr) {
  if (!dateStr) return 'Unknown date';
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, {
    day:    'numeric',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit'
  });
}

function categoryLabel(cat) {
  const map = {
    road: '🛣️ Road', water: '💧 Water',
    electric: '⚡ Electric',
    sanitation: '🗑️ Sanitation', other: '📦 Other'
  };
  return map[cat] || '📦 Other';
}

function categoryEmoji(cat) {
  const map = {
    road: '🛣️', water: '💧', electric: '⚡',
    sanitation: '🗑️', other: '📦'
  };
  return map[cat] || '📦';
}

// Basic HTML escaping since issue content is user-submitted
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}