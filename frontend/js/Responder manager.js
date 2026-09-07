// ===================================================================
//  SAVE THIS AS:   frontend/js/responder-manager.js
// ===================================================================
import { guard, apiFetch } from './guard.js';

const PER_PAGE = 10;

let me          = null;
let allResponders = [];
let filtered      = [];
let page          = 1;
let editingId     = null;   // null = "add" mode, otherwise the responder being edited

// ── BOOT ──────────────────────────────────────────────
// Role is checked server-side by /api/me. The API also rejects any
// non-admin call, so this guard is UX only.
// NOTE: swap 'admin' for whatever role string your backend actually
// uses for dispatch-desk staff, same as officer-dashboard.js uses
// guard(['officer']).
me = await guard(['admin', 'responder-manager']);
if (!me) throw new Error('redirecting');

document.getElementById('r-who').textContent  = me.name || me.email;
document.getElementById('r-role').textContent = `🏢 ${me.roleLabel || 'Dispatch Admin'}`;

document.getElementById('r-add').addEventListener('click', () => openDrawer(null));
document.getElementById('f-apply').addEventListener('click', () => { page = 1; loadAll(); });
document.getElementById('f-reset').addEventListener('click', () => {
  document.getElementById('f-type').value   = '';
  document.getElementById('f-active').value = '';
  document.getElementById('f-search').value = '';
  page = 1;
  loadAll();
});
document.getElementById('pg-prev').addEventListener('click', () => changePage(-1));
document.getElementById('pg-next').addEventListener('click', () => changePage(1));
document.getElementById('d-close').addEventListener('click', closeDrawer);
document.getElementById('d-save').addEventListener('click', saveResponder);
document.getElementById('d-delete').addEventListener('click', deleteResponder);
document.getElementById('drawer-overlay').addEventListener('click', e => {
  if (e.target.id === 'drawer-overlay') closeDrawer();
});

await loadAll();

// ── LOAD ──────────────────────────────────────────────
async function loadAll() {
  await Promise.all([loadStats(), loadResponders()]);
}

async function loadStats() {
  try {
    const s = await apiFetch('/api/admin/responders/stats');
    document.getElementById('s-total').textContent    = s.total;
    document.getElementById('s-active').textContent   = s.active;
    document.getElementById('s-capacity').textContent = s.atCapacity;
    document.getElementById('s-avgload').textContent  = `${s.avgLoadPct ?? 0}%`;
  } catch (err) {
    console.error('stats:', err);
  }
}

async function loadResponders() {
  const type   = document.getElementById('f-type').value;
  const active = document.getElementById('f-active').value;

  const qs = new URLSearchParams();
  if (type)   qs.set('type', type);
  if (active) qs.set('active', active);

  const tbody = document.getElementById('responder-table-body');

  try {
    allResponders = await apiFetch(`/api/admin/responders?${qs}`);
    applySearch();
  } catch (err) {
    console.error('responders:', err);
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row"
      style="color:#ef4444;">Could not load responders. ${esc(err.message)}</td></tr>`;
  }
}

function applySearch() {
  const q = document.getElementById('f-search').value.trim().toLowerCase();
  filtered = q
    ? allResponders.filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.address || '').toLowerCase().includes(q))
    : [...allResponders];
  renderTable();
}

// ── TABLE ─────────────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById('responder-table-body');
  const total = Math.ceil(filtered.length / PER_PAGE) || 1;
  if (page > total) page = total;

  const start = (page - 1) * PER_PAGE;
  const slice = filtered.slice(start, start + PER_PAGE);

  if (!slice.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">No responders found.</td></tr>`;
    updatePagination();
    return;
  }

  const typeIcon = { hospital: '🏥', police: '🚔', fire: '🚒' };

  tbody.innerHTML = slice.map(r => {
    const pct      = r.capacity > 0 ? Math.round((r.currentLoad / r.capacity) * 100) : 0;
    const barClass = pct >= 100 ? 'full' : pct >= 70 ? 'high' : '';

    return `
      <tr>
        <td>${esc(r.name)}</td>
        <td><span class="badge badge-${esc(r.type)}">${typeIcon[r.type] || ''} ${esc(r.type)}</span></td>
        <td style="color:#94a3b8;">${esc(r.phone)}</td>
        <td>
          <div class="load-bar-wrap"><div class="load-bar ${barClass}" style="width:${Math.min(pct, 100)}%;"></div></div>
          <div class="load-text">${r.currentLoad}/${r.capacity} &middot; ${pct}%</div>
        </td>
        <td><span class="badge badge-${r.isActive ? 'active' : 'inactive'}">${r.isActive ? 'Active' : 'Inactive'}</span></td>
        <td style="white-space:nowrap;">
          <button class="action-btn btn-edit"   data-act="edit"   data-id="${esc(r._id)}">Edit</button>
          <button class="action-btn btn-toggle" data-act="toggle" data-id="${esc(r._id)}">${r.isActive ? 'Deactivate' : 'Activate'}</button>
          <button class="action-btn btn-delete" data-act="delete" data-id="${esc(r._id)}">Delete</button>
        </td>
      </tr>`;
  }).join('');

  // Event delegation - inline onclick does not work inside an ES module.
  tbody.querySelectorAll('button[data-act]').forEach(btn => {
    btn.addEventListener('click', () => handleAction(btn.dataset.act, btn.dataset.id));
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
async function handleAction(act, id) {
  const responder = allResponders.find(r => r._id === id);
  if (!responder) return;

  if (act === 'edit')   return openDrawer(responder);
  if (act === 'toggle') return toggleActive(responder);
  if (act === 'delete') return deleteById(id, responder.name);
}

async function toggleActive(responder) {
  try {
    await apiFetch(`/api/admin/responders/${responder._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !responder.isActive })
    });
    toast(`${responder.name} ${responder.isActive ? 'deactivated' : 'activated'}`);
    await loadAll();
  } catch (err) {
    toast(err.message, true);
  }
}

async function deleteById(id, name) {
  if (!confirm(`Remove ${name} from the responder directory?`)) return;
  try {
    await apiFetch(`/api/admin/responders/${id}`, { method: 'DELETE' });
    toast(`${name} removed`);
    await loadAll();
  } catch (err) {
    toast(err.message, true);
  }
}

// ── DRAWER (add / edit) ───────────────────────────────
function openDrawer(responder) {
  editingId = responder ? responder._id : null;

  document.getElementById('d-title').textContent = responder ? 'Edit Responder' : 'Add Responder';
  document.getElementById('d-delete').style.display = responder ? 'block' : 'none';

  document.getElementById('fld-name').value      = responder?.name || '';
  document.getElementById('fld-type').value      = responder?.type || 'hospital';
  document.getElementById('fld-phone').value     = responder?.phone || '';
  document.getElementById('fld-address').value   = responder?.address || '';
  document.getElementById('fld-lat').value       = responder?.location?.lat ?? '';
  document.getElementById('fld-lng').value       = responder?.location?.lng ?? '';
  document.getElementById('fld-capacity').value  = responder?.capacity ?? 10;
  document.getElementById('fld-load').value      = responder?.currentLoad ?? 0;
  document.getElementById('fld-isactive').checked  = responder ? responder.isActive  : true;
  document.getElementById('fld-available').checked = responder ? responder.available : true;

  document.getElementById('drawer-overlay').classList.add('open');
}

function closeDrawer() {
  document.getElementById('drawer-overlay').classList.remove('open');
  editingId = null;
}

async function saveResponder() {
  const name = document.getElementById('fld-name').value.trim();
  const phone = document.getElementById('fld-phone').value.trim();
  const lat = parseFloat(document.getElementById('fld-lat').value);
  const lng = parseFloat(document.getElementById('fld-lng').value);

  if (!name)  { toast('Name is required.', true); return; }
  if (!phone) { toast('Phone is required.', true); return; }
  if (isNaN(lat) || isNaN(lng)) { toast('Latitude and longitude are required.', true); return; }

  const payload = {
    name,
    type:        document.getElementById('fld-type').value,
    phone,
    address:     document.getElementById('fld-address').value.trim(),
    location:    { lat, lng },
    capacity:    parseInt(document.getElementById('fld-capacity').value, 10) || 0,
    currentLoad: parseInt(document.getElementById('fld-load').value, 10) || 0,
    isActive:    document.getElementById('fld-isactive').checked,
    available:   document.getElementById('fld-available').checked
  };

  const btn = document.getElementById('d-save');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    if (editingId) {
      await apiFetch(`/api/admin/responders/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      toast(`${name} updated`);
    } else {
      await apiFetch('/api/admin/responders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      toast(`${name} added`);
    }
    closeDrawer();
    await loadAll();
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save';
  }
}

async function deleteResponder() {
  if (!editingId) return;
  const name = document.getElementById('fld-name').value;
  if (!confirm(`Remove ${name} from the responder directory?`)) return;
  try {
    await apiFetch(`/api/admin/responders/${editingId}`, { method: 'DELETE' });
    toast(`${name} removed`);
    closeDrawer();
    await loadAll();
  } catch (err) {
    toast(err.message, true);
  }
}

// ── HELPERS ───────────────────────────────────────────
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