// ===================================================================
//  SAVE THIS AS:   frontend/js/hall-booking-manager.js
// ===================================================================
//
//  Changes from the first draft, all forced by the actual schema:
//
//  * Status is 'confirmed', not 'approved'. The Booking enum is
//    pending / confirmed / rejected / cancelled. Adding 'approved' would
//    have meant a migration for no gain.
//  * Field names: requesterName/eventName/attendees come from the API's
//    serializer now, which maps bookedBy / eventName / bookedByEmail.
//  * Enquiry bookings carry no cost. estimatedCost is null, never zero,
//    so the UI says "venue quotes" rather than printing Rs 0.
//  * Cancel takes a reason through the drawer instead of prompt().

import { guard, apiFetch } from './guard.js';

const PER_PAGE = 10;

let me          = null;
let allBookings = [];
let filtered    = [];
let page        = 1;
let current     = null;   // booking open in the drawer

// ── BOOT ──────────────────────────────────────────────
// Role is checked server-side by /api/me and again by requireRole on every
// endpoint. This guard is UX only — it stops a citizen landing on an empty
// table they have no permission to fill.
me = await guard(['admin', 'hall-manager']);
if (!me) throw new Error('redirecting');

document.getElementById('h-who').textContent  = me.name || me.email;
document.getElementById('h-role').textContent =
  me.role === 'admin' ? '⚙️ Admin' : '🏢 Hall Manager';

document.getElementById('h-refresh').addEventListener('click', loadAll);
document.getElementById('f-apply').addEventListener('click', () => { page = 1; loadAll(); });
document.getElementById('f-search').addEventListener('input', () => { page = 1; applySearch(); });
document.getElementById('f-reset').addEventListener('click', () => {
  ['f-hall', 'f-status', 'f-date', 'f-search'].forEach(id => {
    document.getElementById(id).value = '';
  });
  page = 1;
  loadAll();
});
document.getElementById('pg-prev').addEventListener('click', () => changePage(-1));
document.getElementById('pg-next').addEventListener('click', () => changePage(1));
document.getElementById('d-close').addEventListener('click', closeDrawer);
document.getElementById('drawer-overlay').addEventListener('click', e => {
  if (e.target.id === 'drawer-overlay') closeDrawer();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDrawer();
});

await loadAll();

// ── LOAD ──────────────────────────────────────────────
async function loadAll() {
  await Promise.all([loadStats(), loadBookings()]);
}

async function loadStats() {
  try {
    const s = await apiFetch('/api/admin/hall-bookings/stats');
    document.getElementById('s-pending').textContent   = s.pending;
    document.getElementById('s-confirmed').textContent = s.confirmed;
    document.getElementById('s-rejected').textContent  = s.rejected;
    document.getElementById('s-today').textContent     = s.today;
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
  const keep   = select.value;
  const halls  = [...new Set(allBookings.map(b => b.hallName).filter(Boolean))].sort();

  select.innerHTML = '<option value="">All Halls</option>' +
    halls.map(h => `<option value="${esc(h)}">${esc(h)}</option>`).join('');
  select.value = keep;
}

function applySearch() {
  const q = document.getElementById('f-search').value.trim().toLowerCase();
  filtered = q
    ? allBookings.filter(b =>
        (b.bookingId     || '').toLowerCase().includes(q) ||
        (b.requesterName || '').toLowerCase().includes(q) ||
        (b.eventName     || '').toLowerCase().includes(q))
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
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">No requests found.</td></tr>`;
    updatePagination();
    return;
  }

  tbody.innerHTML = slice.map(b => {
    const canDecide = b.status === 'pending';
    const canCancel = ['pending', 'confirmed'].includes(b.status);

    return `
      <tr>
        <td class="bid">
          ${esc(b.bookingId)}
          ${b.bookingType === 'enquiry' ? '<span class="tag-enq">ENQUIRY</span>' : ''}
        </td>
        <td>
          ${esc(b.hallName)}
          <div class="sub">${esc(b.eventName || '')}</div>
        </td>
        <td>
          ${esc(b.requesterName)}
          <div class="sub">${esc(b.requesterEmail || '')}</div>
        </td>
        <td style="color:#64748b; font-size:0.82rem;">${fmtDateTimeRange(b)}</td>
        <td><span class="badge badge-${esc(b.status)}">${esc(b.status)}</span></td>
        <td style="white-space:nowrap;">
          <button class="action-btn btn-view"    data-act="view"    data-bid="${esc(b.bookingId)}">👁</button>
          <button class="action-btn btn-approve" data-act="approve" data-bid="${esc(b.bookingId)}" ${canDecide ? '' : 'disabled'}>Confirm</button>
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
  document.getElementById('pg-info').textContent = `Page ${page} / ${total} · ${filtered.length} request(s)`;
  document.getElementById('pg-prev').disabled = page === 1;
  document.getElementById('pg-next').disabled = page === total;
}

function changePage(dir) {
  const total = Math.ceil(filtered.length / PER_PAGE) || 1;
  page = Math.min(Math.max(page + dir, 1), total);
  renderTable();
}

// ── ACTIONS ───────────────────────────────────────────
function handleAction(act, bid) {
  const booking = allBookings.find(b => b.bookingId === bid);
  if (!booking) return;
  openDrawer(booking, act === 'view' ? null : act);
}

async function decide(path, bid, note, verb) {
  try {
    await apiFetch(`/api/admin/hall-bookings/${bid}/${path}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ note })
    });
    toast(`${bid} ${verb}`);
    closeDrawer();
    await loadAll();
  } catch (err) {
    toast(err.message, true);
  }
}

// ── DRAWER ────────────────────────────────────────────
function openDrawer(booking, focusAction = null) {
  current = booking;

  const money = booking.estimatedCost != null
    ? `₹${Number(booking.estimatedCost).toLocaleString('en-IN')}`
    : 'Quoted by the venue';

  document.getElementById('d-title').textContent    = booking.hallName;
  document.getElementById('d-bid').textContent       = booking.bookingId;
  document.getElementById('d-status').textContent    = booking.status;
  document.getElementById('d-hall').textContent      =
    `${booking.hallName}${booking.venueContact ? ' · ' + booking.venueContact : ''}`;
  document.getElementById('d-datetime').textContent  = fmtDateTimeRange(booking);
  document.getElementById('d-purpose').textContent   =
    `${booking.eventName || '—'}${booking.eventType ? ` (${booking.eventType})` : ''}`;
  document.getElementById('d-attendees').textContent = booking.attendees ?? '—';
  document.getElementById('d-cost').textContent      = money;
  document.getElementById('d-requester').textContent = booking.requesterName || '—';
  document.getElementById('d-contact').textContent   =
    [booking.requesterPhone, booking.requesterEmail].filter(Boolean).join(' · ') || '—';

  const citizenNote = document.getElementById('d-citizen-note-wrap');
  if (booking.notes) {
    document.getElementById('d-citizen-note').textContent = booking.notes;
    citizenNote.style.display = 'block';
  } else {
    citizenNote.style.display = 'none';
  }

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
        <span class="tl-when">${fmtDateTime(e.timestamp)}${e.by ? ' · ' + esc(e.by) : ''}</span>
        ${e.message ? `<span class="tl-msg">${esc(e.message)}</span>` : ''}
      </li>`).join('') || '<li>No history.</li>';

  renderDrawerActions(booking, focusAction);
  document.getElementById('drawer-overlay').classList.add('open');
}

function renderDrawerActions(booking, focusAction) {
  const box = document.getElementById('d-actions');
  const bid = booking.bookingId;

  if (['rejected', 'cancelled'].includes(booking.status)) {
    box.innerHTML = `<p style="color:#64748b; font-size:0.82rem;">
      This request is closed${booking.decidedBy ? ` — ${esc(booking.decidedBy)}` : ''}.</p>`;
    return;
  }

  // An enquiry is not ours to confirm. Confirming one records that a human
  // rang the venue and they said yes, so the note prompt says so.
  const enquiry = booking.bookingType === 'enquiry';

  const confirmBtn = booking.status === 'pending'
    ? `<button class="action-btn btn-approve" id="a-approve"
         style="padding:0.6rem 1.2rem; width:100%; margin-bottom:0.5rem;">
         ${enquiry ? 'Confirm — venue accepted' : 'Confirm booking'}
       </button>
       <button class="action-btn btn-reject" id="a-reject"
         style="padding:0.6rem 1.2rem; width:100%; margin-bottom:0.5rem;">Reject</button>`
    : '';

  box.innerHTML = `
    ${enquiry ? `<p style="color:#a78bfa; font-size:0.78rem; margin-bottom:0.6rem;">
        This venue handles its own bookings. Only confirm after the venue has
        agreed the date on the phone.
      </p>` : ''}
    <label style="display:block; color:#94a3b8; font-size:0.75rem; margin-bottom:0.3rem;">
      Remarks (required to reject or cancel)
    </label>
    <textarea id="a-note" rows="3" placeholder="e.g. Spoke to the venue, date is free…"></textarea>
    ${confirmBtn}
    <button class="action-btn btn-cancel" id="a-cancel"
      style="padding:0.6rem 1.2rem; width:100%;">Cancel request</button>`;

  const note = () => document.getElementById('a-note').value.trim();

  document.getElementById('a-approve')?.addEventListener('click', () =>
    decide('approve', bid, note(), 'confirmed'));
  document.getElementById('a-reject')?.addEventListener('click', () => {
    if (!note()) return toast('Add a reason for rejecting.', true);
    decide('reject', bid, note(), 'rejected');
  });
  document.getElementById('a-cancel').addEventListener('click', () => {
    if (!note()) return toast('Add a reason for cancelling.', true);
    decide('cancel', bid, note(), 'cancelled');
  });

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
  const endStr = b.endDate
    ? ` – ${new Date(b.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
    : '';
  const timeStr = (b.startTime && b.endTime) ? `${b.startTime}–${b.endTime}` : '';
  return timeStr ? `${dateStr}${endStr}, ${timeStr}` : `${dateStr}${endStr}`;
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