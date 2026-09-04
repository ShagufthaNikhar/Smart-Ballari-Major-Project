// ===================================================================
//  SAVE THIS AS:   frontend/js/tracker.js
// ===================================================================
import { auth } from './firebase-config.js';

const BACKEND = window.SB_API;
let currentIssue = null;

// Four steps, matching the officer workflow.
const STEPS = ['reported', 'accepted', 'in-progress', 'resolved'];

// Which step a given status lights up.
const STATUS_STEP = {
  open:          0,
  pending:       0,
  accepted:      1,
  'in-progress': 2,
  resolved:      3,
  rejected:      -1     // handled separately
};

// ── EVENTS ────────────────────────────────────────────
document.getElementById('track-btn').addEventListener('click', trackIssue);
document.getElementById('gid-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') trackIssue();
});
document.getElementById('copy-btn').addEventListener('click', copyGID);
document.getElementById('share-btn').addEventListener('click', shareIssue);

// Auto-fill from URL ?id=SB-2026-00008
window.addEventListener('DOMContentLoaded', () => {
  const id = new URLSearchParams(window.location.search).get('id');
  if (id) {
    document.getElementById('gid-input').value = id;
    trackIssue();
  }
});

// ── TRACK ─────────────────────────────────────────────
async function trackIssue() {
  const gid = document.getElementById('gid-input').value.trim().toUpperCase();
  if (!gid) { alert('Enter a Grievance ID.'); return; }

  const btn = document.getElementById('track-btn');
  btn.textContent = '⏳';
  btn.disabled = true;

  document.getElementById('result-card').style.display = 'none';
  document.getElementById('not-found').style.display   = 'none';

  try {
    // Auth is required: grievance IDs are sequential, so an open lookup
    // would let anyone walk the whole collection.
    const user = auth.currentUser || await new Promise(r => {
      const un = auth.onAuthStateChanged(u => { un(); r(u); });
    });

    if (!user) {
      showNotFound('🔒 Please log in to track a grievance.');
      return;
    }

    const token = await user.getIdToken();
    const res = await fetch(`${BACKEND}/api/issues/track/${gid}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      showNotFound(res.status === 404
        ? '❌ No issue found with that Grievance ID. Please check and try again.'
        : '⚠️ Could not load that grievance right now.');
      return;
    }

    currentIssue = await res.json();
    renderResult(currentIssue);

  } catch (err) {
    console.error(err);
    showNotFound('⚠️ Could not reach the server.');
  } finally {
    btn.textContent = 'Track';
    btn.disabled = false;
  }
}

function showNotFound(msg) {
  const el = document.getElementById('not-found');
  el.textContent = msg;
  el.style.display = 'block';
}

// ── RENDER ────────────────────────────────────────────
function renderResult(issue) {
  setText('r-title',    issue.title);
  setText('r-gid',      issue.grievanceId);
  setText('r-category', categoryLabel(issue.category));
  setText('r-location', issue.location?.address || '—');
  setText('r-desc',     issue.description || 'No description provided.');

  // Department, not the officer. The payload has no officer name in it.
  setText('r-department', issue.department || '—');
  setText('r-date',       fmtDate(issue.reportedAt));
  setText('r-updated',    fmtDateTime(issue.lastUpdated));

  const badge = document.getElementById('r-status-badge');
  badge.textContent = issue.statusLabel || issue.status;
  badge.className   = `badge badge-${issue.status}`;

  const img = document.getElementById('r-image');
  if (issue.imageUrl) {
    img.src = issue.imageUrl;
    img.style.display = 'block';
  } else {
    img.style.display = 'none';
  }

  renderStepper(issue.status);
  renderTimeline(issue.timeline || []);
  renderHelpline(issue);

  const lat = issue.location?.coordinates?.lat;
  const lng = issue.location?.coordinates?.lng;
  const mapLink = document.getElementById('map-link');
  mapLink.href = lat ? `https://maps.google.com/?q=${lat},${lng}` : 'map.html';

  document.getElementById('result-card').style.display = 'block';
}

// ── STEPPER ───────────────────────────────────────────
function renderStepper(status) {
  const idx = STATUS_STEP[status] ?? 0;

  STEPS.forEach((step, i) => {
    const el = document.getElementById(`step-${step}`);
    if (!el) return;
    el.classList.remove('done', 'active');
    if (idx >= 0) {
      if (i < idx)  el.classList.add('done');
      if (i === idx) el.classList.add('active');
    }
  });

  for (let i = 1; i <= 3; i++) {
    const line = document.getElementById(`line-${i}`);
    if (!line) continue;
    line.classList.toggle('done', idx >= i);
  }

  // 'rejected' is not a step on the happy path - call it out instead.
  const rej = document.getElementById('rejected-note');
  if (rej) rej.style.display = status === 'rejected' ? 'block' : 'none';
}

// ── TIMELINE ──────────────────────────────────────────
function renderTimeline(events) {
  const container = document.getElementById('timeline');

  if (!events.length) {
    container.innerHTML =
      '<p style="color:#64748b; font-size:0.85rem;">No timeline entries yet.</p>';
    return;
  }

  // Newest first. Each entry carries status + timestamp only - the
  // officer who made the change and their internal note are not in
  // this payload by design.
  container.innerHTML = [...events].reverse().map(e => `
    <div class="tl-item tl-${esc(e.status)}">
      <div class="tl-dot"></div>
      <div class="tl-status">${esc(e.label || e.status)}</div>
      <div class="tl-meta">${fmtDateTime(e.at)}</div>
    </div>
  `).join('');
}

// ── HELPLINE ──────────────────────────────────────────
function renderHelpline(issue) {
  const box = document.getElementById('helpline-box');
  if (!box) return;

  if (!issue.departmentGrievanceContact) {
    box.style.display = 'none';
    return;
  }

  box.innerHTML = `
    <span class="hl-label">Need help?</span>
    <span class="hl-dept">${esc(issue.department)} Grievance Helpline</span>
    <a class="hl-number" href="tel:${esc(issue.departmentGrievanceContact)}">
      ☎ ${esc(issue.departmentGrievanceContact)}
    </a>`;
  box.style.display = 'flex';
}

// ── SHARE + COPY ──────────────────────────────────────
function copyGID() {
  navigator.clipboard.writeText(currentIssue?.grievanceId || '');
  toast('📋 Grievance ID copied!');
}

function shareIssue() {
  // Build from the current path, not origin - the app may be served
  // from a subfolder rather than the web root.
  const url = `${location.origin}${location.pathname}?id=${currentIssue?.grievanceId}`;
  if (navigator.share) {
    navigator.share({
      title: `Grievance ${currentIssue?.grievanceId}`,
      text:  `Track civic issue: ${currentIssue?.title}`,
      url
    }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url);
    toast('🔗 Link copied to clipboard!');
  }
}

// ── HELPERS ───────────────────────────────────────────
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? '—';
}

function categoryLabel(cat) {
  return {
    road: '🛣️ Road', water: '💧 Water', electric: '⚡ Electric',
    sanitation: '🗑️ Sanitation', other: '📦 Other'
  }[cat] || cat || '—';
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? '—' : dt.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function fmtDateTime(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? '—' : dt.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function esc(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}

function toast(msg) {
  if (typeof window.showToast === 'function') window.showToast(msg, 'success');
  else console.log(msg);
}