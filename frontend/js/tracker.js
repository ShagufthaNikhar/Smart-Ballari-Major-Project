const BACKEND = 'http://localhost:5000';
let currentIssue = null;

// ── SEARCH ────────────────────────────────────────────
document.getElementById('track-btn').addEventListener('click', trackIssue);
document.getElementById('gid-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') trackIssue();
});

// Auto-fill from URL ?id=SB-2024-00042
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const id     = params.get('id');
  if (id) {
    document.getElementById('gid-input').value = id;
    trackIssue();
  }
});

async function trackIssue() {
  const gid = document.getElementById('gid-input').value.trim().toUpperCase();
  if (!gid) { alert('Enter a Grievance ID.'); return; }

  const btn = document.getElementById('track-btn');
  btn.innerText = '⏳';
  btn.disabled  = true;

  // Hide previous results
  document.getElementById('result-card').style.display  = 'none';
  document.getElementById('not-found').style.display    = 'none';

  try {
    const res = await fetch(`${BACKEND}/api/issues/track/${gid}`);

    if (!res.ok) {
      document.getElementById('not-found').style.display = 'block';
      return;
    }

    const issue  = await res.json();
    currentIssue = issue;
    renderResult(issue);

  } catch {
    document.getElementById('not-found').style.display = 'block';
  } finally {
    btn.innerText = 'Track';
    btn.disabled  = false;
  }
}

// ── RENDER RESULT ─────────────────────────────────────
function renderResult(issue) {

  // Basic info
  document.getElementById('r-title').innerText =
    issue.title;
  document.getElementById('r-gid').innerText =
    issue.grievanceId;
  document.getElementById('r-category').innerText =
    categoryLabel(issue.category);
  document.getElementById('r-reported').innerText =
    issue.reportedBy || '—';
  document.getElementById('r-location').innerText =
    issue.location?.address || '—';
  document.getElementById('r-date').innerText =
    new Date(issue.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  document.getElementById('r-desc').innerText =
    issue.description || 'No description provided.';

  // Status badge
  const badge = document.getElementById('r-status-badge');
  badge.innerText  = issue.status;
  badge.className  = `badge badge-${issue.status.replace('-','')}`;

  // Image
  const img = document.getElementById('r-image');
  if (issue.imageUrl) {
    img.src           = issue.imageUrl;
    img.style.display = 'block';
  } else {
    img.style.display = 'none';
  }

  // Stepper
  renderStepper(issue.status);

  // Timeline
  renderTimeline(issue.timeline || []);

  // Show card
  document.getElementById('result-card').style.display = 'block';
}

// ── STEPPER ───────────────────────────────────────────
function renderStepper(status) {
  const steps = ['open', 'in-progress', 'resolved'];
  const idx   = steps.indexOf(status);

  const stepEls = {
    'open':        document.getElementById('step-open'),
    'in-progress': document.getElementById('step-in-progress'),
    'resolved':    document.getElementById('step-resolved')
  };
  const lines = [
    document.getElementById('line-1'),
    document.getElementById('line-2')
  ];

  // Reset
  Object.values(stepEls).forEach(el => {
    el.classList.remove('done', 'active');
  });
  lines.forEach(l => l.classList.remove('done'));

  // Apply
  steps.forEach((step, i) => {
    if (i < idx)  stepEls[step].classList.add('done');
    if (i === idx) stepEls[step].classList.add('active');
  });

  if (idx >= 1) lines[0].classList.add('done');
  if (idx >= 2) lines[1].classList.add('done');
}

// ── TIMELINE ──────────────────────────────────────────
function renderTimeline(events) {
  const container = document.getElementById('timeline');

  if (!events.length) {
    container.innerHTML =
      '<p style="color:#64748b; font-size:0.85rem;">No timeline entries yet.</p>';
    return;
  }

  // Show newest first
  const sorted = [...events].reverse();

  container.innerHTML = sorted.map(e => {
    const cls  = `tl-${e.status?.replace('-', '') === 'inprogress'
      ? 'in-progress' : e.status}`;
    const date = new Date(e.timestamp).toLocaleString('en-IN', {
      day: 'numeric', month: 'short',
      year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    return `
      <div class="tl-item ${cls}">
        <div class="tl-dot"></div>
        <div class="tl-status">${statusLabel(e.status)}</div>
        <div class="tl-message">${e.message}</div>
        <div class="tl-meta">
          ${e.updatedBy || 'System'} &bull; ${date}
        </div>
      </div>
    `;
  }).join('');
}

// ── SHARE + COPY ──────────────────────────────────────
window.copyGID = () => {
  navigator.clipboard.writeText(currentIssue?.grievanceId || '');
  showToast('📋 Grievance ID copied!', 'success');
};

window.shareIssue = () => {
  const url = `${window.location.origin}/pages/tracker.html` +
              `?id=${currentIssue?.grievanceId}`;
  if (navigator.share) {
    navigator.share({
      title: `Grievance ${currentIssue?.grievanceId}`,
      text:  `Track civic issue: ${currentIssue?.title}`,
      url
    });
  } else {
    navigator.clipboard.writeText(url);
    showToast('🔗 Link copied to clipboard!', 'success');
  }
};

// ── HELPERS ───────────────────────────────────────────
function categoryLabel(cat) {
  const map = {
    road: '🛣️ Road', water: '💧 Water',
    electric: '⚡ Electric',
    sanitation: '🗑️ Sanitation', other: '📦 Other'
  };
  return map[cat] || cat;
}

function statusLabel(status) {
  const map = {
    'open':        '📋 Reported',
    'in-progress': '⚙️ In Progress',
    'resolved':    '✅ Resolved'
  };
  return map[status] || status;
}