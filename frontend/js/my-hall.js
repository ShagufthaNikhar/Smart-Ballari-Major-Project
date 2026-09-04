const BACKEND = window.SB_API;

let myHalls    = [];
let myBookings = [];
let filter     = 'pending';

document.addEventListener('DOMContentLoaded', loadQueue);

// The hall/booking endpoints are token-authenticated. The server decides
// what this user may see and change - this is only the request side of it.
async function authHeaders(extra = {}) {
  const { auth } = await import('./firebase-config.js');
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('You must be logged in.');
  return { ...extra, 'Authorization': `Bearer ${token}` };
}

// ── LOAD ──────────────────────────────────────────────
window.loadQueue = async () => {
  const btn = document.getElementById('mh-refresh');
  btn.disabled = true;

  try {
    const res = await fetch(`${BACKEND}/api/services/halls/mine`, {
      headers: await authHeaders()
    });
    if (!res.ok) throw new Error('Could not load your halls.');

    const data = await res.json();
    myHalls    = data.halls    || [];
    myBookings = data.bookings || [];

    // A hall owner is simply someone who manages at least one hall. If the
    // list is empty this user is not one, so say so rather than showing an
    // empty queue that looks broken.
    if (!myHalls.length) {
      document.getElementById('mh-who').textContent = 'No halls assigned to this account';
      document.getElementById('queue-list').innerHTML = `
        <div class="empty-state">
          <h3>You don't manage any halls</h3>
          <p>This page is for hall custodians. If you should have access,
             ask an administrator to assign a hall to your account.</p>
        </div>`;
      ['s-pending','s-confirmed','s-rejected','s-total']
        .forEach(id => document.getElementById(id).textContent = '0');
      return;
    }

    renderHeader();
    renderStats();
    renderQueue();
  } catch (err) {
    document.getElementById('queue-list').innerHTML =
      `<div class="empty-state"><h3>Couldn't load bookings</h3><p>${esc(err.message)}</p></div>`;
  } finally {
    btn.disabled = false;
  }
};

function renderHeader() {
  const manager = myHalls[0]?.managerName;
  document.getElementById('mh-who').textContent = manager
    ? `Signed in as ${manager}`
    : (localStorage.getItem('userEmail') || '');

  document.getElementById('mh-halls').innerHTML =
    myHalls.map(h => `<span class="hall-pill">🏛️ ${esc(h.name)}</span>`).join('');
}

function renderStats() {
  const n = s => myBookings.filter(b => b.status === s).length;
  document.getElementById('s-pending').textContent   = n('pending');
  document.getElementById('s-confirmed').textContent = n('confirmed');
  document.getElementById('s-rejected').textContent  = n('rejected');
  document.getElementById('s-total').textContent     = myBookings.length;
}

window.setFilter = (f) => {
  filter = f;
  document.querySelectorAll('.filter-btn')
    .forEach(b => b.classList.toggle('active', b.dataset.f === f));
  renderQueue();
};

// ── RENDER ────────────────────────────────────────────
const MODE_LABEL = {
  hourly:   'By the hour',
  halfDay:  'Half day',
  fullDay:  'Full day',
  multiDay: 'Multiple days'
};

function renderQueue() {
  const list = filter === 'all'
    ? myBookings
    : myBookings.filter(b => b.status === filter);

  if (!list.length) {
    document.getElementById('queue-list').innerHTML = `
      <div class="empty-state">
        <h3>Nothing here</h3>
        <p>No ${filter === 'all' ? '' : filter} bookings for your halls.</p>
      </div>`;
    return;
  }

  document.getElementById('queue-list').innerHTML = list.map(b => {
    const when = b.endDate
      ? `${fmtDate(b.date)} → ${fmtDate(b.endDate)}`
      : fmtDate(b.date);

    const addons = (b.selectedAddOns || [])
      .map(a => `<span class="addon-chip">${esc(a.label)}</span>`).join('');

    return `
      <div class="bk-card" id="bk-${b._id}">
        <div class="bk-top">
          <div>
            <div class="bk-event">${esc(b.eventName)}</div>
            <div class="bk-id">${esc(b.bookingId || '')} · ${esc(b.hallName || '')}</div>
          </div>
          <span class="bk-badge st-${esc(b.status)}">${esc(b.status)}</span>
        </div>

        <div class="bk-grid">
          <div class="bk-field"><span>Requested by</span><b>${esc(b.bookedBy || '—')}</b></div>
          <div class="bk-field"><span>Contact</span><b>${esc(b.bookedByEmail || '—')}</b></div>
          <div class="bk-field"><span>Date</span><b>${when}</b></div>
          <div class="bk-field"><span>Time</span><b>${esc(b.startTime || '—')} – ${esc(b.endTime || '—')}</b></div>
          <div class="bk-field"><span>Duration type</span><b>${MODE_LABEL[b.pricingMode] || 'Full day'}</b></div>
          <div class="bk-field"><span>Attendees</span><b>${b.attendees || '—'}</b></div>
          <div class="bk-field"><span>Event type</span><b>${esc(b.eventType || '—')}</b></div>
        </div>

        ${addons ? `<div class="addon-chips">${addons}</div>` : ''}
        ${b.notes ? `<div class="notes-line">📝 ${esc(b.notes)}</div>` : ''}

        <div class="bk-cost">
          <span class="cost-lbl">Estimated charge</span>
          <span class="cost-amt">₹${(b.estimatedCost || 0).toLocaleString('en-IN')}</span>
        </div>

        ${b.status === 'pending' ? `
          <div class="bk-actions">
            <button class="act-btn act-accept" onclick="decide('${b._id}','confirmed')">✓ Accept</button>
            <button class="act-btn act-reject" onclick="decide('${b._id}','rejected')">✕ Reject</button>
          </div>` : ''}
      </div>`;
  }).join('');
}

// ── ACCEPT / REJECT ───────────────────────────────────
window.decide = async (id, status) => {
  const card = document.getElementById(`bk-${id}`);
  const btns = card?.querySelectorAll('.act-btn') || [];
  btns.forEach(b => b.disabled = true);

  try {
    const res = await fetch(`${BACKEND}/api/services/halls/bookings/${id}/status`, {
      method:  'PATCH',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body:    JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Update refused');

    // Update in place so the stats and the current filter stay in sync
    // without a full round trip.
    const b = myBookings.find(x => x._id === id);
    if (b) b.status = status;

    showToast?.(
      status === 'confirmed' ? '✅ Booking accepted' : 'Booking rejected',
      status === 'confirmed' ? 'success' : 'info'
    );
    renderStats();
    renderQueue();
  } catch (err) {
    btns.forEach(b => b.disabled = false);
    showToast?.(err.message, 'error');
  }
};

// ── HELPERS ───────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function esc(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}