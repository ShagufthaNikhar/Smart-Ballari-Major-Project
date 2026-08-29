const BACKEND   = 'http://localhost:5000';
const userEmail = localStorage.getItem('userEmail') || '';

let allHalls        = [];
let selectedHallId   = null;
let isHallAvailable  = false;

document.addEventListener('DOMContentLoaded', async () => {
  await loadHalls();
});

// ── SUB-TAB SWITCH (Book a Hall / My Bookings) ────────
window.setHbTab = async (tab) => {
  document.getElementById('panel-book').style.display =
    tab === 'book' ? 'block' : 'none';
  document.getElementById('panel-mybookings').style.display =
    tab === 'mybookings' ? 'block' : 'none';

  document.getElementById('hb-tab-book').classList.toggle('active', tab === 'book');
  document.getElementById('hb-tab-mine').classList.toggle('active', tab === 'mybookings');

  if (tab === 'mybookings') await loadMyBookings();
};

// ── HALLS ─────────────────────────────────────────────
async function loadHalls() {
  try {
    const res = await fetch(`${BACKEND}/api/services/halls`);
    allHalls  = await res.json();
    renderHalls(allHalls);
  } catch {}
}

function renderHalls(halls) {
  document.getElementById('halls-list').innerHTML =
    halls.map(h => `
      <div class="hall-card" id="hcard-${h._id}" onclick="selectHall('${h._id}', '${h.name}')">
        <div class="hall-name">${h.name}</div>
        <div class="hall-area">📍 ${h.area}</div>
        <div class="hall-cap">👥 Capacity: ${h.capacity} people</div>
        <div class="facilities-row">
          ${h.facilities.map(f => `<span class="facility-tag">✓ ${f}</span>`).join('')}
        </div>
        <div class="hall-price">
          ₹${h.pricePerDay.toLocaleString()} / day
          &nbsp;·&nbsp; 📞 ${h.contact}
        </div>
      </div>
    `).join('');
}

window.selectHall = (id, name) => {
  selectedHallId = id;
  document.querySelectorAll('.hall-card').forEach(c => c.classList.remove('selected'));
  document.getElementById(`hcard-${id}`)?.classList.add('selected');
  document.getElementById('selected-hall-name').innerText = name;

  const date = document.getElementById('ev-date').value;
  if (date) checkAvailability();
};

window.checkAvailability = async () => {
  const date = document.getElementById('ev-date').value;
  if (!date || !selectedHallId) return;

  const el = document.getElementById('avail-status');
  el.innerHTML = '<p style="color:#64748b; font-size:0.78rem;">Checking...</p>';

  try {
    const res  = await fetch(`${BACKEND}/api/services/halls/${selectedHallId}/availability?date=${date}`);
    const data = await res.json();

    isHallAvailable = data.available;

    el.innerHTML = data.available
      ? `<div class="avail-badge avail-yes">✅ Available on this date</div>`
      : `<div class="avail-badge avail-no">❌ Already booked on this date</div>`;
  } catch {
    el.innerHTML = '';
  }
};

window.submitBooking = async () => {
  if (!selectedHallId) {
    showToast('Please select a hall first.', 'warning');
    return;
  }
  if (!isHallAvailable) {
    showToast('Hall not available on selected date.', 'error');
    return;
  }

  const eventName = document.getElementById('ev-name').value.trim();
  const date      = document.getElementById('ev-date').value;

  if (!eventName || !date) {
    showToast('Event name and date are required.', 'error');
    return;
  }

  const btn = document.getElementById('book-btn');
  btn.disabled  = true;
  btn.innerText = '⏳ Submitting...';

  const payload = {
    hallId:        selectedHallId,
    eventName,
    eventType:     document.getElementById('ev-type').value,
    date,
    startTime:     document.getElementById('ev-start').value,
    endTime:       document.getElementById('ev-end').value,
    attendees:     document.getElementById('ev-attendees').value,
    notes:         document.getElementById('ev-notes').value,
    bookedBy:      userEmail.split('@')[0] || 'Citizen',
    bookedByEmail: userEmail
  };

  try {
    const res  = await fetch(`${BACKEND}/api/services/halls/book`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error);

    document.getElementById('booking-result').innerHTML = `
      <div style="background:#22c55e22; border:1px solid #22c55e;
                  border-radius:10px; padding:1rem; text-align:center;">
        <div style="color:#22c55e; font-size:1rem; font-weight:bold;">
          ✅ Booking Submitted!
        </div>
        <div style="color:#38bdf8; font-size:1.1rem; letter-spacing:2px; margin:0.4rem 0;">
          ${data.bookingId}
        </div>
        <div style="color:#64748b; font-size:0.78rem;">
          Status: Pending confirmation from administration
        </div>
      </div>
    `;

    showToast(`✅ Booking ID: ${data.bookingId}`, 'success');
    btn.innerText = '📅 Submit Booking Request';
    btn.disabled  = false;
  } catch (err) {
    showToast(err.message || 'Booking failed.', 'error');
    btn.innerText = '📅 Submit Booking Request';
    btn.disabled  = false;
  }
};

// ── MY BOOKINGS ───────────────────────────────────────
async function loadMyBookings() {
  if (!userEmail) {
    document.getElementById('my-bookings-list').innerHTML =
      '<p style="color:#64748b;">Log in to see your bookings.</p>';
    return;
  }

  try {
    const res  = await fetch(`${BACKEND}/api/services/halls/bookings/mine?email=${userEmail}`);
    const data = await res.json();

    if (!data.length) {
      document.getElementById('my-bookings-list').innerHTML =
        `<div style="text-align:center; padding:2rem; color:#64748b;">
           No bookings yet. Book a hall from the "Book a Hall" tab.
         </div>`;
      return;
    }

    document.getElementById('my-bookings-list').innerHTML = `
      <div style="background:#1e293b; border-radius:14px; border:1px solid #334155; overflow:hidden;">
        <div style="padding:0.8rem 1rem; background:#0f172a; font-size:0.78rem;
                    color:#64748b; border-bottom:1px solid #334155;">
          ${data.length} booking(s)
        </div>
        <div style="padding:0 1rem;">
          ${data.map(b => `
            <div class="booking-row">
              <span class="b-status bs-${b.status}">${b.status}</span>
              <div style="flex:1;">
                <div style="font-weight:600; font-size:0.85rem;">${b.eventName}</div>
                <div style="color:#64748b; font-size:0.72rem;">
                  ${b.hallName} ·
                  ${new Date(b.date).toLocaleDateString('en-IN')} ·
                  ${b.startTime}–${b.endTime}
                </div>
              </div>
              <div style="font-size:0.72rem; color:#38bdf8;">${b.bookingId}</div>
              ${b.status === 'pending'
                ? `<button onclick="cancelBooking('${b._id}')"
                     style="padding:0.2rem 0.5rem; background:#ef444422;
                            color:#ef4444; border:1px solid #ef4444;
                            border-radius:4px; cursor:pointer;
                            font-size:0.68rem;">
                     Cancel
                   </button>`
                : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch {
    document.getElementById('my-bookings-list').innerHTML =
      '<p style="color:#ef4444;">Failed to load bookings.</p>';
  }
}

window.cancelBooking = async (id) => {
  if (!confirm('Cancel this booking?')) return;
  try {
    await fetch(`${BACKEND}/api/services/halls/bookings/${id}`, { method: 'DELETE' });
    showToast('Booking cancelled.', 'info');
    await loadMyBookings();
  } catch {
    showToast('Could not cancel.', 'error');
  }
};