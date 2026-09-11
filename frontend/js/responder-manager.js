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

document.getElementById('inc-refresh').addEventListener('click', loadIncidents);

await loadAll();
await loadIncidents();

// Live dispatches can be confirmed at any moment, and the 2-minute
// escalation timer is running server-side regardless of whether this page
// is open — refresh periodically so the Confirm button / "unconfirmed"
// state doesn't go stale while someone's looking at this table.
setInterval(loadAll, 20000);
setInterval(loadIncidents, 20000);

// ══════════════════════════════════════════════════════
// ── RECENT INCIDENTS — what got reported, what happened ─
// ══════════════════════════════════════════════════════
// This page previously only showed responders and their current load —
// nothing tied that back to the actual incidents driving it. Reuses the
// same GET /:id/analysis endpoint Emergency's Dispatch tab uses, so the
// outcome logic (dispatched+ETA / awaiting approval / pharmacy suggestion)
// never has to be maintained in two places.
const lightOutcomeCache = new Map(); // status-only, refreshed every poll
const fullAnalysisCache  = new Map(); // AI advice included, fetched lazily on expand

async function loadIncidents() {
  const container = document.getElementById('incidents-list');
  try {
    const incidents = await apiFetch('/api/emergency/incidents');
    renderIncidentsList((incidents || []).slice(0, 15));
  } catch (err) {
    container.innerHTML = `<div class="empty-row" style="color:#ef4444;">Could not load incidents.</div>`;
  }
}

function renderIncidentsList(incidents) {
  const container = document.getElementById('incidents-list');
  if (!incidents.length) {
    container.innerHTML = '<div class="empty-row">No incidents reported yet.</div>';
    return;
  }

  container.innerHTML = incidents.map(inc => `
    <div class="inc-card sev-${esc(inc.severity)}" data-id="${esc(inc._id)}">
      <div class="inc-card-top">
        <span class="inc-card-type">${esc(inc.type)}</span>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <button class="inc-seen-btn ${inc.seenByManager ? 'seen' : ''}"
            data-id="${esc(inc._id)}" onclick="event.stopPropagation(); toggleSeen('${esc(inc._id)}')">
            ${inc.seenByManager ? '✓ Seen' : '👁 Mark seen'}
          </button>
          <span class="inc-card-sev">${esc(inc.severity)}</span>
        </div>
      </div>
      <div class="inc-card-desc">${esc(inc.description)}</div>
      <div class="inc-card-meta">
        📍 ${esc(inc.location?.address || 'Ballari')} &middot;
        ${timeAgo(new Date(inc.createdAt))} &middot; ${esc(inc.incidentId)}
      </div>
      <div class="inc-outcome" id="outcome-${esc(inc._id)}">Loading outcome…</div>
      <div class="inc-detail" id="detail-${esc(inc._id)}"></div>
    </div>
  `).join('');

  container.querySelectorAll('.inc-card').forEach(card => {
    card.addEventListener('click', () => toggleIncidentDetail(card.dataset.id));
  });

  // Cheap status-only call for every card, safe to do on every poll —
  // never calls OpenAI. The full AI-advice analysis is fetched separately,
  // only for a card the user actually expands (see toggleIncidentDetail).
  incidents.forEach(inc => loadOutcome(inc._id));
}

async function loadOutcome(id) {
  const el = document.getElementById(`outcome-${id}`);
  try {
    const d = await apiFetch(`/api/emergency/incidents/${id}/outcome`);
    lightOutcomeCache.set(id, d);
    if (!el) return;

    const active     = (d.units || []).filter(u => u.status === 'active');
    const pendingCount = d.pendingCount || 0;
    const pharmacyCount = d.pharmacyCount || 0;

    if (active.length) {
      el.className = 'inc-outcome dispatched';
      el.textContent = `✅ Dispatched: ${active[0].name}` +
        `${active[0].eta ? ' · ETA ' + active[0].eta : ''}` +
        `${active.length > 1 ? ` (+${active.length - 1} more)` : ''}`;
    } else if (pendingCount) {
      el.className = 'inc-outcome pending';
      el.textContent = `⏳ Awaiting approval — ${pendingCount} recommendation${pendingCount > 1 ? 's' : ''} pending`;
    } else if (pharmacyCount) {
      el.className = 'inc-outcome pharmacy';
      el.textContent = `💊 No ambulance needed — ${pharmacyCount} nearby pharmacies suggested`;
    } else {
      el.className = 'inc-outcome none';
      el.textContent = 'No unit dispatched and nothing pending';
    }
  } catch (err) {
    if (el) { el.className = 'inc-outcome none'; el.textContent = 'Could not load outcome'; }
  }
}

async function toggleIncidentDetail(id) {
  const detail = document.getElementById(`detail-${id}`);
  if (!detail) return;
  const isOpen = detail.classList.contains('open');
  detail.classList.toggle('open', !isOpen);
  if (!isOpen) {
    // Full analysis (with AI advisory text) is only fetched here, on
    // actually opening a card — not for all 15 cards on every 20s poll.
    // Cached after the first fetch so re-toggling open/closed doesn't
    // re-hit OpenAI every time either.
    if (!fullAnalysisCache.has(id)) {
      detail.innerHTML = '<div style="color:#64748b;">Loading…</div>';
      try {
        const d = await apiFetch(`/api/emergency/incidents/${id}/analysis`);
        fullAnalysisCache.set(id, d);
      } catch (err) {
        detail.innerHTML = `<div style="color:#ef4444;">${esc(err.message)}</div>`;
        return;
      }
    }
    renderIncidentDetail(id);
  }
}

function renderIncidentDetail(id) {
  const detail = document.getElementById(`detail-${id}`);
  const d = fullAnalysisCache.get(id);
  if (!detail) return;
  if (!d) { detail.innerHTML = '<div style="color:#64748b;">Loading…</div>'; return; }

  const active     = (d.units || []).filter(u => u.status === 'active');
  const pending     = d.pending || [];
  const pharmacies   = d.pharmacies?.pharmacies || [];

  let html = '';

  active.forEach(u => {
    html += `
      <div class="inc-detail-row">
        <div class="inc-detail-label">Dispatched</div>
        <b>${esc(u.name)}</b>
        ${u.distanceKm != null ? ` &middot; ${u.distanceKm} km` : ''}
        ${u.eta ? ` &middot; ETA ${esc(u.eta)}` : ''}<br/>
        ${u.confirmed
          ? '<span style="color:#22c55e;">✓ confirmed en route</span>'
          : `<span style="color:#f59e0b;">⏳ unconfirmed — escalates within 2 minutes if not confirmed</span>
             <div style="margin-top:0.4rem;">
               <button class="action-btn" style="background:#22c55e; color:#0f172a;"
                 onclick="confirmDispatch({_id:'${esc(u.resourceId)}', name:'${esc(u.name).replace(/'/g, "\\'")}'}, '${esc(id)}')">
                 ✓ Confirm now
               </button>
             </div>`}
      </div>`;
  });

  pending.forEach(p => {
    html += `
      <div class="inc-detail-row">
        <div class="inc-detail-label">Awaiting approval</div>
        <b>${esc(p.recommendedResourceName || 'No responder available')}</b>
        &middot; ${esc(p.resourceType)}${p.distanceKm != null ? ` · ${p.distanceKm} km` : ''}<br/>
        <span style="color:#64748b;">${esc(p.reason || '')}</span>
        ${p.id ? `
          <div style="display:flex; gap:0.4rem; margin-top:0.5rem;">
            <button class="action-btn" style="background:#22c55e; color:#0f172a; flex:1;"
              onclick="approveRecommendationFromCard('${esc(p.id)}', '${esc(id)}')">
              ✓ Approve &amp; Dispatch
            </button>
            <button class="action-btn" style="background:#ef444422; color:#ef4444; flex:1;"
              onclick="rejectRecommendationFromCard('${esc(p.id)}', '${esc(id)}')">
              ✕ Reject
            </button>
          </div>` : ''}
      </div>`;
  });

  if (pharmacies.length) {
    html += `
      <div class="inc-detail-row">
        <div class="inc-detail-label">Nearby pharmacies (no ambulance needed)</div>
        ${pharmacies.slice(0, 4).map(ph =>
          `${esc(ph.name)} <span style="color:#64748b;">(${ph.distanceKm} km)</span>`
        ).join('<br/>')}
      </div>`;
  }

  detail.innerHTML = html || '<div style="color:#64748b;">No dispatch, approval, or pharmacy data for this incident.</div>';
}

function timeAgo(date) {
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── SEEN (lightweight acknowledgment, unrelated to dispatch) ─────────
window.toggleSeen = async (incidentId) => {
  try {
    await apiFetch(`/api/emergency/incidents/${incidentId}/seen`, { method: 'PATCH' });
    const btn = document.querySelector(`.inc-seen-btn[data-id="${incidentId}"]`);
    if (btn) { btn.classList.add('seen'); btn.textContent = '✓ Seen'; }
  } catch (err) {
    toast(err.message, true);
  }
};

// After any action that changes an incident's dispatch state (approve,
// reject, confirm), the cached full analysis is stale — refetch it so the
// expanded detail view (if open) shows the new state, not the old one.
async function refreshIncidentDetail(incidentId) {
  fullAnalysisCache.delete(incidentId);
  await loadOutcome(incidentId);
  const detail = document.getElementById(`detail-${incidentId}`);
  if (detail && detail.classList.contains('open')) {
    try {
      const d = await apiFetch(`/api/emergency/incidents/${incidentId}/analysis`);
      fullAnalysisCache.set(incidentId, d);
      renderIncidentDetail(incidentId);
    } catch { /* outcome line still updated above even if this fails */ }
  }
}

// ── APPROVE / REJECT (medium/high recommendations) ───────────────────
window.approveRecommendationFromCard = async (recId, incidentId) => {
  try {
    const data = await apiFetch(`/api/resources/recommendations/${recId}/approve`, { method: 'POST' });
    toast(`${data.responder.name} dispatched to ${data.deployment.area}`);
    await refreshIncidentDetail(incidentId);
    await loadAll(); // responder load/status just changed
  } catch (err) {
    toast(err.message, true);
  }
};

window.rejectRecommendationFromCard = async (recId, incidentId) => {
  try {
    await apiFetch(`/api/resources/recommendations/${recId}/reject`, { method: 'POST' });
    toast('Recommendation rejected');
    await refreshIncidentDetail(incidentId);
  } catch (err) {
    toast(err.message, true);
  }
};

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
    tbody.innerHTML = `<tr><td colspan="7" class="empty-row"
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
    tbody.innerHTML = `<tr><td colspan="7" class="empty-row">No responders found.</td></tr>`;
    updatePagination();
    return;
  }

  const typeIcon = { hospital: '🏥', police: '🚔', fire: '🚒', ambulance: '🚑' };

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
        <td>${dispatchCell(r)}</td>
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

// Dispatch status + Confirm button. No active deployment -> just a dash.
// Confirmed -> a quiet green checkmark. Unconfirmed -> the actual action.
function dispatchCell(r) {
  const dep = r.activeDeployment;
  if (!dep) return '<span style="color:#475569; font-size:0.78rem;">—</span>';

  if (dep.confirmedAt) {
    return `<span style="color:#22c55e; font-size:0.78rem;">✓ En route</span>`;
  }

  return `
    <div style="display:flex; flex-direction:column; gap:0.3rem;">
      <span style="color:#f59e0b; font-size:0.74rem;">⏳ Unconfirmed</span>
      <button class="action-btn" data-act="confirm" data-id="${esc(r._id)}"
        style="background:#22c55e; color:#0f172a;">
        ✓ Confirm
      </button>
    </div>`;
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

  if (act === 'edit')    return openDrawer(responder);
  if (act === 'toggle')  return toggleActive(responder);
  if (act === 'delete')  return deleteById(id, responder.name);
  if (act === 'confirm') return window.confirmDispatch(responder);
}

// Exposed on window: originally only called internally via the table's
// data-act event delegation, but the incident-detail panel's "Confirm now"
// button (renderIncidentDetail) uses a plain inline onclick, which needs
// this on window to work inside an ES module.
//
// incidentId is optional — passed when called from an incident-detail
// panel so THAT specific card's outcome/detail redraws immediately
// instead of waiting for the next 20s poll to notice the change.
window.confirmDispatch = async function confirmDispatch(responder, incidentId) {
  try {
    await apiFetch(`/api/admin/responders/${responder._id}/confirm`, { method: 'POST' });
    toast(`${responder.name} marked en route`);
    await loadAll();
    if (incidentId) {
      await refreshIncidentDetail(incidentId);
    }
  } catch (err) {
    toast(err.message, true);
  }
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