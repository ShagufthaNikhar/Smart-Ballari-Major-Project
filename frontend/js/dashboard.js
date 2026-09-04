const BACKEND = window.SB_API;
const role = localStorage.getItem('userRole');

let allIssues = [];
let filtered  = [];
let page      = 1;
const PER_PAGE = 10;

// ── INIT ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

  // Title by role
  document.getElementById('dash-title').innerText =
    role === 'admin' ? '⚙️ Admin Dashboard' : '🏛️ Municipality Dashboard';

  // Show export only for admin
  if (role === 'admin') {
    document.getElementById('admin-export').style.display = 'block';
  }

  await loadIssues();
  await loadStats();
});

// ── LOAD ISSUES ───────────────────────────────────────
async function loadIssues() {
  try {
    const res = await fetch(`${BACKEND}/api/issues`);
    allIssues = await res.json();
    filtered  = [...allIssues];
    renderTable();
  } catch {
    document.getElementById('issue-table-body').innerHTML =
      `<tr><td colspan="7" style="text-align:center;color:#ef4444;padding:2rem;">
        ❌ Could not load issues. Is backend running?
      </td></tr>`;
  }
}

// ── LOAD STATS ────────────────────────────────────────
async function loadStats() {
  try {
    const res  = await fetch(`${BACKEND}/api/issues/stats`);
    const data = await res.json();
    document.getElementById('s-open').innerText     = data.open     ?? 0;
    document.getElementById('s-pending').innerText  = data.pending  ?? 0;
    document.getElementById('s-resolved').innerText = data.resolved ?? 0;
    document.getElementById('s-total').innerText    = data.total    ?? 0;
  } catch {}
}

// ── RENDER TABLE ──────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById('issue-table-body');
  const start = (page - 1) * PER_PAGE;
  const slice = filtered.slice(start, start + PER_PAGE);

  if (!slice.length) {
    tbody.innerHTML = `<tr><td colspan="7"
      style="text-align:center;color:#64748b;padding:2rem;">
      No issues found.</td></tr>`;
    updatePagination();
    return;
  }

  tbody.innerHTML = slice.map((issue, i) => {
    const num  = start + i + 1;
    const date = new Date(issue.createdAt).toLocaleDateString('en-IN');
    const canDelete = role === 'admin';

    return `
      <tr>
        <td>${num}</td>
        <td>${issue.title}</td>
        <td>${categoryLabel(issue.category)}</td>
        <td><span class="badge badge-${issue.status}">${issue.status}</span></td>
        <td style="color:#94a3b8;font-size:0.82rem;">${issue.reportedBy || '—'}</td>
        <td style="color:#64748b;font-size:0.82rem;">${date}</td>
        <td>
          <button class="action-btn btn-view"
            onclick="openDrawer('${issue._id}')">👁 View</button>
          ${issue.status !== 'pending'
            ? `<button class="action-btn btn-pending"
                onclick="updateStatus('${issue._id}','pending')">⏳</button>`
            : ''}
          ${issue.status !== 'resolved'
            ? `<button class="action-btn btn-resolve"
                onclick="updateStatus('${issue._id}','resolved')">✅</button>`
            : ''}
          ${canDelete
            ? `<button class="action-btn btn-delete"
                onclick="deleteIssue('${issue._id}')">🗑</button>`
            : ''}
        </td>
      </tr>
    `;
  }).join('');

  updatePagination();
}

// ── PAGINATION ────────────────────────────────────────
function updatePagination() {
  const total = Math.ceil(filtered.length / PER_PAGE) || 1;
  document.getElementById('pg-info').innerText  = `Page ${page} / ${total}`;
  document.getElementById('pg-prev').disabled   = page === 1;
  document.getElementById('pg-next').disabled   = page === total;
}

function changePage(dir) {
  const total = Math.ceil(filtered.length / PER_PAGE);
  page = Math.min(Math.max(page + dir, 1), total);
  renderTable();
}

// ── FILTERS ───────────────────────────────────────────
function applyFilters() {
  const status   = document.getElementById('f-status').value;
  const category = document.getElementById('f-category').value;
  const search   = document.getElementById('f-search').value.toLowerCase();

  filtered = allIssues.filter(i => {
    const matchStatus   = !status   || i.status === status;
    const matchCategory = !category || i.category === category;
    const matchSearch   = !search   || i.title.toLowerCase().includes(search);
    return matchStatus && matchCategory && matchSearch;
  });

  page = 1;
  renderTable();
}

function resetFilters() {
  document.getElementById('f-status').value   = '';
  document.getElementById('f-category').value = '';
  document.getElementById('f-search').value   = '';
  filtered = [...allIssues];
  page = 1;
  renderTable();
}

// ── UPDATE STATUS ─────────────────────────────────────
async function updateStatus(id, status) {
  const token = await getToken();
  try {
    const res=await fetch(`${BACKEND}/api/issues/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' ,'Authorization': `Bearer ${token}`
    },
      body: JSON.stringify({ status })
    });

    // 2. Send email notification
    await fetch(`${BACKEND}/api/notify/status-update`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ issueId: id, status })
    });
    showToast(`✅ Status updated to "${status}"`, 'success');
    await loadIssues();
    await loadStats();
  } catch {
     showToast('Could not update status.', 'error');
  }
}

// ── DELETE ISSUE (admin only) ─────────────────────────
async function deleteIssue(id) {
  if (!confirm('Delete this issue permanently?')) return;
  const token = await getToken();
  try {
    const res = await fetch(`${BACKEND}/api/issues/${id}`, {
       method: 'DELETE',
       headers: { 'Authorization': `Bearer ${token}`}
     });
    if (res.status === 403) { alert('Admin only.'); return; }
    await loadIssues();
    await loadStats();
  } catch {
    alert('Could not delete issue.');
  }
}

// ── DETAIL DRAWER ─────────────────────────────────────
function openDrawer(id) {
  const issue = allIssues.find(i => i._id === id);
  if (!issue) return;

  document.getElementById('d-title').innerText    = issue.title;
  document.getElementById('d-category').innerText = categoryLabel(issue.category);
  document.getElementById('d-status').innerText   = issue.status;
  document.getElementById('d-desc').innerText     = issue.description || '—';
  document.getElementById('d-loc').innerText      = issue.location?.address || '—';
  document.getElementById('d-by').innerText       = issue.reportedBy || '—';
  document.getElementById('d-date').innerText     =
    new Date(issue.createdAt).toLocaleString('en-IN');

  const lat = issue.location?.coordinates?.lat;
  const lng = issue.location?.coordinates?.lng;
  document.getElementById('d-coords').innerText =
    lat ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : '—';
  document.getElementById('d-map-link').href =
    lat ? `https://maps.google.com/?q=${lat},${lng}` : '#';

  document.getElementById('drawer-overlay').classList.add('open');
}

function closeDrawer() {
  document.getElementById('drawer-overlay').classList.remove('open');
}

document.getElementById('drawer-overlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('drawer-overlay')) closeDrawer();
});

// ── EXPORT CSV (admin only) ───────────────────────────
function exportCSV() {
  const headers = ['Title','Category','Status','Reported By','Date','Lat','Lng'];
  const rows = filtered.map(i => [
    `"${i.title}"`,
    i.category,
    i.status,
    i.reportedBy || '',
    new Date(i.createdAt).toLocaleDateString('en-IN'),
    i.location?.coordinates?.lat || '',
    i.location?.coordinates?.lng || ''
  ]);

  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'smart-ballari-issues.csv';
  a.click();
}

// ── HELPERS ───────────────────────────────────────────
function categoryLabel(cat) {
  const map = {
    road: '🛣️ Road', water: '💧 Water',
    electric: '⚡ Electric', sanitation: '🗑️ Sanitation', other: '📦 Other'
  };
  return map[cat] || cat;
}

// Add this helper at the bottom of dashboard.js
async function getToken() {
  const { auth } = await import('./firebase-config.js');
  return await auth.currentUser?.getIdToken();
}

// Show post section for admins
if (role === 'admin') {
  document.getElementById('post-update-section').style.display = 'block';
}

async function postUpdate() {
  const title = document.getElementById('u-title').value.trim();
  const desc  = document.getElementById('u-desc').value.trim();
  const area  = document.getElementById('u-area').value;
  const type  = document.getElementById('u-type').value;

  if (!title || !desc) { alert('Fill in title and description.'); return; }

  const token = await getToken();
  try {
    const res = await fetch(`${BACKEND}/api/updates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ title, description: desc, area, type })
    });
    if (res.ok) {
      showToast('✅ Update posted successfully!', 'success');
      document.getElementById('u-title').value = '';
      document.getElementById('u-desc').value  = '';
    }
  } catch {
    showToast('❌ Failed to post update', 'error');
  }
}