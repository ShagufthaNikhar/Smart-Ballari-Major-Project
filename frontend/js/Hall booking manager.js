// ===================================================================
//  SAVE THIS AS:   frontend/js/hall-booking-manager.js
// ===================================================================
import { guard, apiFetch } from './guard.js';

const PER_PAGE = 10;

let me        = null;
let allBookings = [];
let filtered    = [];
let page        = 1;
let current     = null;   // booking open in the drawer

// ── BOOT ──────────────────────────────────────────────
// Role is checked server-side by /api/me. The API also rejects any
// non-admin call, so this guard is UX only.
// NOTE: swap 'admin' for whatever role string your backend actually
// uses for hall-booking staff (e.g. 'hall-admin'), same as
// officer-dashboard.js uses guard(['officer']).
me = await guard(['admin', 'hall-manager']);
if (!me) throw new Error('redirecting');

document.getElementById('h-who').textContent  = me.name || me.email;
document.getElementById('h-role').textContent = `🏢 ${me.roleLabel || 'Hall Booking Admin'}`;

document.getElementById('h-refresh').addEventListener('click', loadAll);
document.getElementById('f-apply').addEventListener('click', () => { page = 1; loadAll(); });
document.getElementById('f-reset').addEventListener('click', () => {
  document.getElementById('f-hall').value   = '';
  document.getElementById('f-status').value = '';
  document.getElementById('f-date').value   = '';
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
  await Promise.all([loadStats(), loadBookings()]);
}

async function loadStats() {
  try {
    const s = await apiFetch('/api/admin/hall-bookings/stats');
    document.getElementById('s-pending').textContent  = s.pending;
    document.getElementById('s-approved').textContent = s.approved;
    document.getElementById('s-rejected').textContent = s.rejected;
    document.getElementById('s-today').textContent    = s.today;
  } catch (err) {
    console.error('stats:', err);
  }
}

async function loadBookings() {
  const hall   = document.getElementById('f-hall').value;
  const status = document.getElementById('f-status').value;
  const date   = document.getElementById('f-date').value;

  const qs = new URLSearchParams();
  if (hall)   qs.set('hall', hall);
  if (status) qs.set('status', status);
  if (date)   qs.set('date', date);

  const tbody = document.getElementById('booking-table-body');

  try {
    allBookings = await apiFetch(`/api/admin/hall-bookings?${qs}`);
    populateHallFilter();
    applySearch();
  } catch (err) {
    console.error('bookings:', err);
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row"
      style="color:#ef4444;">Could not load bookings. ${esc(err.message)}</td></tr>`;
  }
}

function populateHallFilter() {
  const select = document.getElementById('f-hall');
  const current = select.value;
  const halls = [...new Set(allBookings.map(b => b.hallName).filter(Boolean))].sort();

  select.innerHTML = '<option value="">All Halls</option>' +
    halls.map(h => `<option value="${esc(h)}">${esc(h)}</option>`).join('');
  select.value = current;
}

function applySearch() {
  const q = document.getElementById('f-search').value.trim().toLowerCase();
  filtered = q
    ? allBookings.filter(b =>
        (b.bookingId || '').toLowerCase().includes(q) ||
        (b.requesterName || '').toLowerCase().includes(q))
    : [...allBookings];
  renderTable();
}

// ── TABLE ─────────────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById('booking-table-body');
  const total = Math.ceil(filtered.length / PER_PAGE) || 1;
  if (page > total) page = total;

  const start = (page - 1) * PER_PAGE;
  const slice = filtered.slice(start, start + PER_PAGE);

  if (!slice.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">No bookings found.</td></tr>`;
    updatePagination();
    return;
  }

  tbody.innerHTML = slice.map(b => {
    const canDecide = b.status === 'pending';
    const canCancel = b.status === 'approved';

    return `
      <tr>
        <td class="bid">${esc(b.bookingId)}</td>
        <td>${esc(b.hallName)}</td>
        <td>${esc(b.requesterName)}</td>
        <td style="color:#64748b; font-size:0.82rem;">${fmtDateTimeRange(b)}</td>
        <td><span class="badge badge-${esc(b.status)}">${esc(b.status)}</span></td>
        <td style="white-space:nowrap;">
          <button class="action-btn btn-view"    data-act="view"    data-bid="${esc(b.bookingId)}">👁</button>
          <button class="action-btn btn-approve" data-act="approve" data-bid="${esc(b.bookingId)}" ${canDecide ? '' : 'disabled'}>Approve</button>
          <button class="action-btn btn-reject"  data-act="reject"  data-bid="${esc(b.bookingId)}" ${canDecide ? '' : 'disabled'}>Reject</button>
          <button class="action-btn btn-cancel"  data-act="cancel"  data-bid="${esc(b.bookingId)}" ${canCancel ? '' : 'disabled'}>Cancel</button>
        </td>
      </tr>`;
  }).join('');

  // Event delegation - inline onclick does not work inside an ES module.
  tbody.querySelectorAll('button[data-act]').forEach(btn => {
    btn.addEventListener('click', () => handleAction(btn.dataset.act, btn.dataset.bid));
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
async function handleAction(act, bid) {
  const booking = allBookings.find(b => b.bookingId === bid);
  if (!booking) return;

  if (act === 'view')    return openDrawer(booking);
  if (act === 'approve') return openDrawer(booking, 'approve');
  if (act === 'reject')  return openDrawer(booking, 'reject');
  if (act === 'cancel')  return doCancel(bid);
}

async function doApprove(bid, note) {
  try {
    await apiFetch(`/api/admin/hall-bookings/${bid}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    });
    toast(`Approved ${bid}`);
    closeDrawer();
    await loadAll();
  } catch (err) {
    toast(err.message, true);
  }
}

async function doReject(bid, note) {
  if (!note) { toast('Add a reason for rejecting.', true); return; }
  try {
    await apiFetch(`/api/admin/hall-bookings/${bid}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    });
    toast(`Rejected ${bid}`);
    closeDrawer();
    await loadAll();
  } catch (err) {
    toast(err.message, true);
  }
}

async function doCancel(bid) {
  const note = prompt('Reason for cancelling this approved booking:') || '';
  try {
    await apiFetch(`/api/admin/hall-bookings/${bid}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    });
    toast(`${bid} cancelled`);
    await loadAll();
  } catch (err) {
    toast(err.message, true);
  }
}

// ── DRAWER ────────────────────────────────────────────
function openDrawer(booking, focusAction = null) {
  current = booking;

  document.getElementById('d-title').textContent     = booking.hallName;
  document.getElementById('d-bid').textContent        = booking.bookingId;
  document.getElementById('d-status').textContent     = booking.status;
  document.getElementById('d-hall').textContent       = booking.hallName;
  document.getElementById('d-datetime').textContent   = fmtDateTimeRange(booking);
  document.getElementById('d-purpose').textContent    = booking.purpose || '—';
  document.getElementById('d-attendees').textContent  = booking.attendees ?? '—';
  document.getElementById('d-requester').textContent  =
    `${booking.requesterName}${booking.requesterOrg ? ' · ' + booking.requesterOrg : ''}`;
  document.getElementById('d-contact').textContent    =
    [booking.contactPhone, booking.contactEmail].filter(Boolean).join(' · ') || '—';

  const noteWrap = document.getElementById('d-note-wrap');
  if (booking.adminNote) {
    document.getElementById('d-note').textContent = booking.adminNote;
    noteWrap.style.display = 'block';
  } else {
    noteWrap.style.display = 'none';
  }

  document.getElementById('d-timeline').innerHTML =
    (booking.timeline || []).map(e => `
      <li>
        ${esc(e.status)}
        <span class="tl-when">${fmtDateTime(e.timestamp)}</span>
        ${e.message ? `<span class="tl-msg">${esc(e.message)}</span>` : ''}
      </li>`).join('') || '<li>No history.</li>';

  renderDrawerActions(booking, focusAction);
  document.getElementById('drawer-overlay').classList.add('open');
}

function renderDrawerActions(booking, focusAction) {
  const box = document.getElementById('d-actions');
  const bid = booking.bookingId;

  if (['approved', 'rejected', 'cancelled'].includes(booking.status)) {
    box.innerHTML = `<p style="color:#64748b; font-size:0.82rem;">This request is closed.</p>`;
    return;
  }

  box.innerHTML = `
    <label style="display:block; color:#94a3b8; font-size:0.75rem; margin-bottom:0.3rem;">
      Remarks (required to reject, optional to approve)
    </label>
    <textarea id="a-note" rows="3" placeholder="Add a note…"></textarea>
    <button class="action-btn btn-approve" id="a-approve"
      style="padding:0.6rem 1.2rem; width:100%; margin-bottom:0.5rem;">Approve</button>
    <button class="action-btn btn-reject" id="a-reject"
      style="padding:0.6rem 1.2rem; width:100%;">Reject</button>`;

  document.getElementById('a-approve').addEventListener('click', () =>
    doApprove(bid, document.getElementById('a-note').value.trim()));
  document.getElementById('a-reject').addEventListener('click', () =>
    doReject(bid, document.getElementById('a-note').value.trim()));

  if (focusAction) document.getElementById('a-note').focus();
}

function closeDrawer() {
  document.getElementById('drawer-overlay').classList.remove('open');
  current = null;
}

// ── HELPERS ───────────────────────────────────────────
function fmtDateTimeRange(b) {
  if (!b.date) return '—';
  const dt = new Date(b.date);
  const dateStr = isNaN(dt) ? b.date : dt.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
  const timeStr = (b.startTime && b.endTime) ? `${b.startTime}–${b.endTime}` : '';
  return timeStr ? `${dateStr}, ${timeStr}` : dateStr;
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