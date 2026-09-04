// ===================================================================
//  SAVE THIS AS:   frontend/js/officer-dashboard.js
// ===================================================================
import { guard, apiFetch } from './guard.js';
import { auth } from './firebase-config.js';

const BACKEND  = window.SB_API;
const PER_PAGE = 10;

let me       = null;
let allIssues = [];
let filtered  = [];
let page      = 1;
let current   = null;   // issue open in the drawer

// ── BOOT ──────────────────────────────────────────────
// Role is checked server-side by /api/me. The API also rejects any
// non-officer call, so this guard is UX only.
me = await guard(['officer']);
if (!me) throw new Error('redirecting');

document.getElementById('o-who').textContent  = me.name || me.email;
document.getElementById('o-dept').textContent = `🏢 ${me.departmentLabel || me.department}`;

document.getElementById('o-refresh').addEventListener('click', loadAll);
document.getElementById('f-apply').addEventListener('click', () => { page = 1; loadAll(); });
document.getElementById('f-reset').addEventListener('click', () => {
  document.getElementById('f-scope').value  = '';
  document.getElementById('f-status').value = '';
  document.getElementById('f-search').value = '';
  page = 1;
  loadAll();
});
document.getElementById('pg-prev').addEventListener('click', () => changePage(-1));
document.getElementById('pg-next').addEventListener('click', () => changePage(1));
document.getElementById('d-close').addEventListener('click', closeDrawer);
document.getElementById('drawer-overlay').addEventListener('click', e => {
  if (e.target.id === 'drawer-overlay') closeDrawer();
});

await loadAll();

// ── LOAD ──────────────────────────────────────────────
async function loadAll() {
  await Promise.all([loadStats(), loadIssues()]);
}

async function loadStats() {
  try {
    const s = await apiFetch('/api/officer/stats');
    document.getElementById('s-open').textContent = s.open;
    document.getElementById('s-mine').textContent = s.assignedToMe;
    document.getElementById('s-prog').textContent = s.inProgress;
    document.getElementById('s-res').textContent  = s.resolved;
  } catch (err) {
    console.error('stats:', err);
  }
}

async function loadIssues() {
  const scope  = document.getElementById('f-scope').value;
  const status = document.getElementById('f-status').value;

  const qs = new URLSearchParams();
  if (scope)  qs.set('scope', scope);
  if (status) qs.set('status', status);

  const tbody = document.getElementById('issue-table-body');

  try {
    allIssues = await apiFetch(`/api/officer/issues?${qs}`);
    applySearch();
  } catch (err) {
    console.error('issues:', err);
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row"
      style="color:#ef4444;">Could not load issues. ${esc(err.message)}</td></tr>`;
  }
}

function applySearch() {
  const q = document.getElementById('f-search').value.trim().toLowerCase();
  filtered = q
    ? allIssues.filter(i =>
        (i.title || '').toLowerCase().includes(q) ||
        (i.grievanceId || '').toLowerCase().includes(q))
    : [...allIssues];
  renderTable();
}

// ── TABLE ─────────────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById('issue-table-body');
  const total = Math.ceil(filtered.length / PER_PAGE) || 1;
  if (page > total) page = total;

  const start = (page - 1) * PER_PAGE;
  const slice = filtered.slice(start, start + PER_PAGE);

  if (!slice.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">No issues found.</td></tr>`;
    updatePagination();
    return;
  }

  tbody.innerHTML = slice.map(i => {
    const mine     = isMine(i);
    const canAcc   = ['open', 'pending'].includes(i.status) && !i.assignedOfficer;
    const canProg  = mine && i.status === 'accepted';
    const canRes   = mine && ['accepted', 'in-progress'].includes(i.status);

    return `
      <tr>
        <td class="gid">${esc(i.grievanceId)}</td>
        <td>${esc(i.title)}${mine ? '<span class="mine-tag">mine</span>' : ''}</td>
        <td><span class="badge badge-${esc(i.status)}">${esc(i.status)}</span></td>
        <td style="color:#94a3b8; font-size:0.8rem;">${esc(i.priority || '—')}</td>
        <td style="color:#64748b; font-size:0.82rem;">${fmtDate(i.reportedAt)}</td>
        <td style="white-space:nowrap;">
          <button class="action-btn btn-view"     data-act="view"     data-gid="${esc(i.grievanceId)}">👁</button>
          <button class="action-btn btn-accept"   data-act="accept"   data-gid="${esc(i.grievanceId)}" ${canAcc  ? '' : 'disabled'}>Accept</button>
          <button class="action-btn btn-progress" data-act="progress" data-gid="${esc(i.grievanceId)}" ${canProg ? '' : 'disabled'}>Start</button>
          <button class="action-btn btn-resolve"  data-act="resolve"  data-gid="${esc(i.grievanceId)}" ${canRes  ? '' : 'disabled'}>Resolve</button>
        </td>
      </tr>`;
  }).join('');

  // Event delegation - inline onclick does not work inside an ES module.
  tbody.querySelectorAll('button[data-act]').forEach(btn => {
    btn.addEventListener('click', () => handleAction(btn.dataset.act, btn.dataset.gid));
  });

  updatePagination();
}

function updatePagination() {
  const total = Math.ceil(filtered.length / PER_PAGE) || 1;
  document.getElementById('pg-info').textContent = `Page ${page} / ${total}`;
  document.getElementById('pg-prev').disabled = page === 1;
  document.getElementById('pg-next').disabled = page === total;
}

function changePage(dir) {
  const total = Math.ceil(filtered.length / PER_PAGE) || 1;
  page = Math.min(Math.max(page + dir, 1), total);
  renderTable();
}

// ── ACTIONS ───────────────────────────────────────────
async function handleAction(act, gid) {
  const issue = allIssues.find(i => i.grievanceId === gid);
  if (!issue) return;

  if (act === 'view')     return openDrawer(issue);
  if (act === 'accept')   return doAccept(gid);
  if (act === 'progress') return doProgress(gid);
  if (act === 'resolve')  return openDrawer(issue, true);
}

async function doAccept(gid) {
  try {
    await apiFetch(`/api/officer/issues/${gid}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'Accepted by department' })
    });
    toast(`Accepted ${gid}`);
    await loadAll();
  } catch (err) {
    toast(err.message, true);
  }
}

async function doProgress(gid) {
  const note = prompt('Add a note for the work log (optional):') || '';
  try {
    await apiFetch(`/api/officer/issues/${gid}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in-progress', note })
    });
    toast(`${gid} marked in progress`);
    await loadAll();
    closeDrawer();
  } catch (err) {
    toast(err.message, true);
  }
}

/** Resolve uses multipart so an evidence photo can be attached. */
async function doResolve(gid) {
  const remarks = document.getElementById('r-remarks').value.trim();
  const file    = document.getElementById('r-evidence').files[0];
  const btn     = document.getElementById('r-submit');

  if (!remarks) { toast('Add resolution remarks.', true); return; }

  btn.disabled = true;
  btn.textContent = 'Resolving…';

  const fd = new FormData();
  fd.append('remarks', remarks);
  if (file) fd.append('evidence', file);

  try {
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(`${BACKEND}/api/officer/issues/${gid}/resolve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },   // no Content-Type: the browser sets the multipart boundary
      body: fd
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Server responded ${res.status}`);
    }
    toast(`${gid} resolved`);
    closeDrawer();
    await loadAll();
  } catch (err) {
    toast(err.message, true);
    btn.disabled = false;
    btn.textContent = 'Mark Resolved';
  }
}

// ── DRAWER ────────────────────────────────────────────
function openDrawer(issue, focusResolve = false) {
  current = issue;

  document.getElementById('d-title').textContent    = issue.title;
  document.getElementById('d-gid').textContent      = issue.grievanceId;
  document.getElementById('d-status').textContent   = issue.status;
  document.getElementById('d-priority').textContent = issue.priority || '—';
  document.getElementById('d-desc').textContent     = issue.description || '—';
  document.getElementById('d-loc').textContent      = issue.location?.address || '—';

  const o = issue.assignedOfficer;
  document.getElementById('d-officer').textContent = o
    ? `${o.name}${o.designation ? ' · ' + o.designation : ''}${isMine(issue) ? ' (you)' : ''}`
    : 'Unassigned';

  const lat = issue.location?.coordinates?.lat;
  const lng = issue.location?.coordinates?.lng;
  document.getElementById('d-map-link').href =
    lat ? `https://maps.google.com/?q=${lat},${lng}` : '#';
  document.getElementById('d-map-link').style.display = lat ? 'block' : 'none';

  togglePhoto('d-photo-wrap',    'd-photo',    issue.imageUrl);
  togglePhoto('d-evidence-wrap', 'd-evidence', issue.resolutionEvidenceUrl);

  document.getElementById('d-timeline').innerHTML =
    (issue.timeline || []).map(e => `
      <li>
        ${esc(e.status)}
        <span class="tl-when">${fmtDateTime(e.timestamp)}</span>
        ${e.message ? `<span class="tl-msg">${esc(e.message)}</span>` : ''}
      </li>`).join('') || '<li>No history.</li>';

  renderDrawerActions(issue, focusResolve);
  document.getElementById('drawer-overlay').classList.add('open');
}

function renderDrawerActions(issue, focusResolve) {
  const box  = document.getElementById('d-actions');
  const mine = isMine(issue);
  const gid  = issue.grievanceId;

  if (['resolved', 'rejected'].includes(issue.status)) {
    box.innerHTML = `<p style="color:#64748b; font-size:0.82rem;">This issue is closed.</p>`;
    return;
  }

  if (!issue.assignedOfficer) {
    box.innerHTML = `<button class="action-btn btn-accept" id="a-accept"
      style="padding:0.6rem 1.2rem;">Accept this issue</button>`;
    document.getElementById('a-accept').addEventListener('click', () => doAccept(gid));
    return;
  }

  if (!mine) {
    box.innerHTML = `<p style="color:#64748b; font-size:0.82rem;">
      Another officer in your department has accepted this.</p>`;
    return;
  }

  box.innerHTML = `
    ${issue.status === 'accepted'
      ? `<button class="action-btn btn-progress" id="a-progress"
           style="padding:0.6rem 1.2rem; margin-bottom:0.8rem;">Mark In Progress</button>`
      : ''}
    <label style="display:block; color:#94a3b8; font-size:0.75rem; margin-bottom:0.3rem;">
      Resolution remarks
    </label>
    <textarea id="r-remarks" rows="3" placeholder="What was done to fix this?"></textarea>
    <label style="display:block; color:#94a3b8; font-size:0.75rem; margin-bottom:0.3rem;">
      Evidence photo (optional)
    </label>
    <input type="file" id="r-evidence" accept="image/*" />
    <button class="action-btn btn-resolve" id="r-submit"
      style="padding:0.6rem 1.2rem; width:100%;">Mark Resolved</button>
    <p style="color:#475569; font-size:0.72rem; margin-top:0.6rem;">
      Remarks are internal. The citizen sees only the status change and its time.
    </p>`;

  document.getElementById('a-progress')?.addEventListener('click', () => doProgress(gid));
  document.getElementById('r-submit').addEventListener('click', () => doResolve(gid));
  if (focusResolve) document.getElementById('r-remarks').focus();
}

function togglePhoto(wrapId, imgId, url) {
  const wrap = document.getElementById(wrapId);
  if (url) {
    document.getElementById(imgId).src = url;
    wrap.style.display = 'block';
  } else {
    wrap.style.display = 'none';
  }
}

function closeDrawer() {
  document.getElementById('drawer-overlay').classList.remove('open');
  current = null;
}

// ── HELPERS ───────────────────────────────────────────
function isMine(issue) {
  return issue.assignedOfficer && String(issue.assignedOfficer.id) === String(me.id);
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? '—' : dt.toLocaleDateString('en-IN');
}

function fmtDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt) ? '' : dt.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  });
}

function esc(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}

function toast(msg, isError = false) {
  if (typeof window.showToast === 'function') {
    window.showToast(msg, isError ? 'error' : 'success');
  } else {
    alert(msg);
  }
}