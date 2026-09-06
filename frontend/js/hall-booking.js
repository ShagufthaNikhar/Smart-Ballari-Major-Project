const BACKEND   = window.SB_API;
const userEmail = localStorage.getItem('userEmail') || '';

// The hall/booking endpoints are authenticated now: the server takes the
// booker's identity from the token instead of trusting the request body.
async function authHeaders(extra = {}) {
  const { auth } = await import('./firebase-config.js');
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('You must be logged in.');
  return { ...extra, 'Authorization': `Bearer ${token}` };
}

let allHalls        = [];
let selectedHallId   = null;
let isHallAvailable  = false;

const BALLARI   = [15.1394, 76.9214];
let hallMap     = null;
let hallMarkers = {};
let userMarker  = null;
let userPos     = null;      // [lat, lng] once the citizen shares location
let pricingMode = 'fullDay';
let quoteTimer  = null;

document.addEventListener('DOMContentLoaded', async () => {
  initHallMap();
  await loadHalls();
});

// ── MAP ───────────────────────────────────────────────
function initHallMap() {
  if (!document.getElementById('hall-map')) return;
  hallMap = L.map('hall-map').setView(BALLARI, 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(hallMap);
}

function pinIcon(colour) {
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;
                       background:${colour};border:2px solid #0f172a;
                       box-shadow:0 0 0 2px ${colour}66;"></div>`,
    iconSize: [16, 16], iconAnchor: [8, 8]
  });
}

function drawHallMarkers(halls) {
  if (!hallMap) return;
  Object.values(hallMarkers).forEach(m => hallMap.removeLayer(m));
  hallMarkers = {};

  const pts = [];
  halls.forEach(h => {
    if (!h.location?.lat) return;   // hall has no surveyed coordinates yet
    const m = L.marker([h.location.lat, h.location.lng], { icon: pinIcon('#38bdf8') })
      .addTo(hallMap)
      .bindPopup(`
        <b>${h.name}</b><br/>
        ${h.area} &middot; ${h.capacity} seats<br/>
        Rs ${(h.pricing?.fullDay ?? h.pricePerDay ?? 0).toLocaleString('en-IN')}/day
        ${h.distanceKm != null ? `<br/>${h.distanceKm} km away` : ''}
      `);
    m.on('click', () => selectHall(h._id, h.name));
    hallMarkers[h._id] = m;
    pts.push([h.location.lat, h.location.lng]);
  });

  if (userPos) pts.push(userPos);
  if (pts.length) hallMap.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
}

// ── GEOLOCATION ───────────────────────────────────────
window.findNearMe = () => {
  const btn  = document.getElementById('near-btn');
  const note = document.getElementById('geo-note');

  if (!navigator.geolocation) {
    note.textContent = 'This browser does not support location.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Locating...';
  note.textContent = 'Waiting for permission...';

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      userPos = [pos.coords.latitude, pos.coords.longitude];

      if (userMarker) hallMap.removeLayer(userMarker);
      userMarker = L.marker(userPos, { icon: pinIcon('#22c55e') })
        .addTo(hallMap).bindPopup('You are here');

      await loadHalls();                    // re-fetch, now sorted by distance
      btn.disabled = false;
      btn.textContent = 'Recentre on me';
      note.textContent = 'Sorted by distance from you.';
    },
    (err) => {
      btn.disabled = false;
      btn.textContent = 'Halls near me';
      note.textContent = err.code === 1
        ? 'Location permission denied - showing all halls.'
        : 'Could not get your location - showing all halls.';
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
};

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
    const qs  = userPos ? `?lat=${userPos[0]}&lng=${userPos[1]}` : '';
    const res = await fetch(`${BACKEND}/api/services/halls${qs}`);
    allHalls  = await res.json();
    renderHalls(allHalls);
    drawHallMarkers(allHalls);
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
        <div class="rate-grid">
          <div class="rate-chip">By hour<b>₹${(h.pricing?.hourly ?? 0).toLocaleString('en-IN')}</b></div>
          <div class="rate-chip">Half day<b>₹${(h.pricing?.halfDay ?? 0).toLocaleString('en-IN')}</b></div>
          <div class="rate-chip">Full day<b>₹${(h.pricing?.fullDay ?? h.pricePerDay ?? 0).toLocaleString('en-IN')}</b></div>
          <div class="rate-chip">2+ days<b>₹${(h.pricing?.multiDay ?? 0).toLocaleString('en-IN')}/day</b></div>
        </div>
        <div class="hall-price">
          📞 ${h.contact}
          ${h.distanceKm != null ? `&nbsp;·&nbsp; <span class="dist-pill">${h.distanceKm} km</span>` : ''}
        </div>
      </div>
    `).join('');
}

window.selectHall = (id, name) => {
  selectedHallId = id;
  document.querySelectorAll('.hall-card').forEach(c => c.classList.remove('selected'));
  document.getElementById(`hcard-${id}`)?.classList.add('selected');
  document.getElementById('selected-hall-name').innerText = name;

  renderAddOns();
  refreshQuote();
  hallMarkers[id]?.openPopup();

  const date = document.getElementById('ev-date').value;
  if (date) checkAvailability();
};

// ── PRICING ───────────────────────────────────────────
window.setMode = (mode) => {
  pricingMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === mode));
  document.getElementById('enddate-field').style.display =
    mode === 'multiDay' ? 'block' : 'none';
  refreshQuote();
};

function selectedAddOnKeys() {
  return [...document.querySelectorAll('.addon-check:checked')].map(c => c.value);
}

function renderAddOns() {
  const hall = allHalls.find(h => h._id === selectedHallId);
  const box  = document.getElementById('addons-field');
  const list = document.getElementById('addons-list');
  if (!hall || !hall.addOns?.length) { box.style.display = 'none'; return; }

  const unitLabel = { flat: 'one-time', perDay: 'per day', perGuest: 'per guest' };
  box.style.display = 'block';
  list.innerHTML = hall.addOns.map(a => `
    <label class="addon-row">
      <input type="checkbox" class="addon-check" value="${a.key}" onchange="refreshQuote()" />
      <span>${a.label}</span>
      <span class="addon-price">₹${a.price.toLocaleString('en-IN')}
        <span class="addon-unit">${unitLabel[a.unit] || ''}</span>
      </span>
    </label>
  `).join('');
}

// Debounced so typing an attendee count does not fire a request per keystroke.
window.refreshQuote = () => {
  clearTimeout(quoteTimer);
  quoteTimer = setTimeout(fetchQuote, 250);
};

async function fetchQuote() {
  const box = document.getElementById('quote-box');
  if (!selectedHallId) {
    box.innerHTML = '<div style="color:#64748b;">Select a hall to see pricing.</div>';
    return;
  }

  const body = {
    pricingMode,
    startTime: document.getElementById('ev-start').value,
    endTime:   document.getElementById('ev-end').value,
    date:      document.getElementById('ev-date').value || new Date().toISOString(),
    endDate:   document.getElementById('ev-enddate').value || null,
    attendees: document.getElementById('ev-attendees').value || 0,
    addOnKeys: selectedAddOnKeys()
  };

  try {
    const res = await fetch(`${BACKEND}/api/services/halls/${selectedHallId}/quote`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });
    const q = await res.json();
    if (!res.ok) throw new Error(q.error);

    box.innerHTML = `
      ${q.breakdown.map(l => `
        <div class="quote-line">
          <span>${l.label}</span>
          <span>₹${l.amount.toLocaleString('en-IN')}</span>
        </div>`).join('')}
      <div class="quote-total">
        <span>Estimated total</span>
        <span>₹${q.total.toLocaleString('en-IN')}</span>
      </div>
      <div style="color:#64748b; font-size:0.7rem; margin-top:0.35rem;">
        Indicative only. Confirmed by the hall on approval.
      </div>`;
  } catch {
    box.innerHTML = '<div style="color:#ef4444;">Could not price this booking.</div>';
  }
}

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
    // bookedBy / bookedByEmail removed - the server reads them from the token.
    pricingMode,
    endDate:       document.getElementById('ev-enddate').value || null,
    addOnKeys:     selectedAddOnKeys()
    // No total is sent: the server re-runs the same quote() it used above.
  };

  try {
    const res  = await fetch(`${BACKEND}/api/services/halls/book`, {
      method:  'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
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
        <div style="color:#f1f5f9; font-size:0.85rem; margin:0.3rem 0;">
          Estimated: ₹${(data.estimatedCost || 0).toLocaleString('en-IN')}
        </div>
        <div style="color:#64748b; font-size:0.78rem;">
          Status: Pending confirmation from the hall
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
    const res  = await fetch(`${BACKEND}/api/services/halls/bookings/mine`, {
      headers: await authHeaders()
    });
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
                <div style="font-weight:600; font-size:0.85rem;">${window.sbEsc(b.eventName)}</div>
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
    const res = await fetch(`${BACKEND}/api/services/halls/bookings/${id}`, {
      method:  'DELETE',
      headers: await authHeaders()
    });
    if (!res.ok) throw new Error('Cancel refused');
    showToast('Booking cancelled.', 'info');
    await loadMyBookings();
  } catch {
    showToast('Could not cancel.', 'error');
  }
};