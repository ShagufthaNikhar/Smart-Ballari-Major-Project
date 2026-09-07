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

// Filters for the venue list
const hbFilter = { search: '', category: '', onlyBookable: false };
let hbSearchTimer = null;

const BALLARI   = [15.1394, 76.9214];
let hallMap     = null;
let hallMarkers = {};
let userMarker  = null;
let userPos     = null;      // [lat, lng] once the citizen shares location
let pricingMode = 'fullDay';
let quoteTimer  = null;

document.addEventListener('DOMContentLoaded', async () => {
  initHallMap();
  await hbBuildCategoryFilter();
  hbBindFilters();
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
  let unmapped = 0, approx = 0;

  halls.forEach(h => {
    if (!h.location?.lat) { unmapped++; return; }
    if (h.coordinatesVerified === false) approx++;

    const m = L.marker([h.location.lat, h.location.lng], {
      icon: pinIcon(h.ratesVerified ? '#38bdf8' : '#a78bfa')
    })
      .addTo(hallMap)
      .bindPopup(`
        <b>${hbEsc(h.name)}</b><br/>
        ${hbEsc(h.categoryLabel || '')} &middot; approx. ${h.capacity} seats<br/>
        ${h.rating ? `⭐ ${h.rating} (${h.reviewCount || 0})<br/>` : ''}
        ${h.ratesVerified
          ? `Rs ${(h.pricing?.fullDay ?? 0).toLocaleString('en-IN')}/day`
          : 'Venue quotes its own rates'}
        ${h.distanceKm != null ? `<br/>${h.distanceKm} km away` : ''}
      `);
    m.on('click', () => selectHall(h._id, h.name));
    hallMarkers[h._id] = m;
    pts.push([h.location.lat, h.location.lng]);
  });

  if (userPos) pts.push(userPos);
  if (pts.length) hallMap.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });

  // The source file marks every coordinate coordinates_verified: false, and
  // half of them are rounded to 3 decimals (~110 m). Pins are on the right
  // block, not on the gate — say so rather than implying survey accuracy.
  const note = document.getElementById('map-note');
  if (note) {
    const bits = [];
    if (approx)   bits.push(`${approx} pin${approx === 1 ? '' : 's'} approximate — check the address before travelling`);
    if (unmapped) bits.push(`${unmapped} venue${unmapped === 1 ? '' : 's'} not mapped`);
    note.textContent = bits.join(' · ');
  }
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
      note.textContent = 'Sorted by distance — venues without coordinates last.';
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

// ── FILTERS ───────────────────────────────────────────
async function hbBuildCategoryFilter() {
  const sel = document.getElementById('hall-category');
  if (!sel) return;
  try {
    const res  = await fetch(`${BACKEND}/api/services/halls/categories`);
    const data = await res.json();
    sel.innerHTML = `<option value="">All venue types (${data.total})</option>` +
      data.categories.map(c =>
        `<option value="${c.key}"${c.count ? '' : ' disabled'}>
           ${c.icon} ${hbEsc(c.label)} (${c.count})
         </option>`).join('');
  } catch {
    sel.innerHTML = '<option value="">All venue types</option>';
  }
}

function hbBindFilters() {
  document.getElementById('hall-search')?.addEventListener('input', e => {
    hbFilter.search = e.target.value;
    clearTimeout(hbSearchTimer);
    hbSearchTimer = setTimeout(loadHalls, 200);
  });

  document.getElementById('hall-category')?.addEventListener('change', e => {
    hbFilter.category = e.target.value;
    loadHalls();
  });

  document.getElementById('only-bookable')?.addEventListener('change', e => {
    hbFilter.onlyBookable = e.target.checked;
    loadHalls();
  });
}

// ── HALLS ─────────────────────────────────────────────
async function loadHalls() {
  try {
    const params = new URLSearchParams();
    if (userPos) { params.set('lat', userPos[0]); params.set('lng', userPos[1]); }
    if (hbFilter.search)       params.set('search', hbFilter.search);
    if (hbFilter.category)     params.set('category', hbFilter.category);
    if (hbFilter.onlyBookable) params.set('bookable', 'true');

    const res = await fetch(`${BACKEND}/api/services/halls?${params}`);
    allHalls  = await res.json();
    renderHalls(allHalls);
    drawHallMarkers(allHalls);
  } catch {
    document.getElementById('halls-list').innerHTML =
      '<p style="color:#ef4444;">Could not load venues.</p>';
  }
}

function renderHalls(halls) {
  const list = document.getElementById('halls-list');

  if (!halls.length) {
    list.innerHTML = '<p style="color:#64748b;">No venues match that filter.</p>';
    return;
  }

  list.innerHTML =
    `<div class="hall-group-head">
       ${halls.length} venue${halls.length === 1 ? '' : 's'} in Ballari
       <span>Tap a venue to send an enquiry, or call them directly</span>
     </div>` +
    halls.map(venueCard).join('');
}

function ratingRow(h) {
  if (!h.rating) return '';
  return `<div class="hall-rating">⭐ ${h.rating}${
    h.reviewCount ? ` · ${h.reviewCount.toLocaleString('en-IN')} Google reviews` : ''
  }</div>`;
}

function capacityRow(h) {
  if (!h.capacity) return '';
  return `<div class="hall-cap">👥 ${h.capacityEstimated ? 'Approx. ' : 'Capacity: '}${h.capacity} people${
    h.capacityEstimated ? ' <span class="approx-flag">estimate — confirm with venue</span>' : ''
  }</div>`;
}

// Indicative band. Rendered in a muted style with the basis printed under it,
// deliberately unlike the .rate-grid used for confirmed rates - a citizen
// should be able to tell a guide from a quote at a glance.
function bandBlock(h) {
  const b = h.indicativeRate || {};
  if (!b.fullDayMin) {
    return `<div class="enquiry-note">💬 ${hbEsc(h.pricingNote || 'Contact venue')} —
            the venue confirms availability and price.</div>`;
  }

  return `
    <div class="band-grid">
      <div class="band-chip">
        Hall, full day
        <b>₹${b.fullDayMin.toLocaleString('en-IN')} – ₹${b.fullDayMax.toLocaleString('en-IN')}</b>
      </div>
      <div class="band-chip">
        Catering, per plate
        <b>₹${b.perPlateMin} – ₹${b.perPlateMax}</b>
      </div>
    </div>
    <div class="band-basis">
      ${b.sourced ? '📊' : '≈'} ${hbEsc(b.basis || '')}. The venue sets the actual price.
    </div>`;
}

function venueCard(h) {
  const mapsQuery = h.location?.lat
    ? `${h.location.lat},${h.location.lng}`
    : encodeURIComponent(`${h.name}, ${h.address || 'Ballari, Karnataka'}`);

  return `
    <div class="hall-card" id="hcard-${h._id}" onclick="selectHall('${h._id}', ${JSON.stringify(h.name)})">
      <div class="hall-card-top">
        <div class="hall-name">${hbEsc(h.name)}</div>
        <span class="venue-badge">${h.icon || '🏛️'} ${hbEsc(h.categoryLabel || 'Venue')}</span>
      </div>
      <div class="hall-area">📍 ${hbEsc(h.address || h.area)}</div>
      ${capacityRow(h)}
      ${ratingRow(h)}

      ${h.amenitiesVerified === false
        ? '<div class="facilities-label">Typically offered</div>'
        : ''}
      <div class="facilities-row">
        ${(h.facilities || []).map(f => `<span class="facility-tag">${hbEsc(f)}</span>`).join('')}
      </div>
      ${h.amenitiesVerified === false
        ? '<div class="unverified-note">Not confirmed with the venue — ask when you call.</div>'
        : ''}

      ${h.ratesVerified
        ? `<div class="rate-grid">
             <div class="rate-chip">By hour<b>₹${(h.pricing?.hourly ?? 0).toLocaleString('en-IN')}</b></div>
             <div class="rate-chip">Half day<b>₹${(h.pricing?.halfDay ?? 0).toLocaleString('en-IN')}</b></div>
             <div class="rate-chip">Full day<b>₹${(h.pricing?.fullDay ?? 0).toLocaleString('en-IN')}</b></div>
             <div class="rate-chip">2+ days<b>₹${(h.pricing?.multiDay ?? 0).toLocaleString('en-IN')}/day</b></div>
           </div>`
        : bandBlock(h)}

      <div class="hall-actions">
        <a class="hb-btn" href="https://www.google.com/maps/search/?api=1&query=${mapsQuery}"
           target="_blank" rel="noopener" onclick="event.stopPropagation()">🗺️ Directions</a>
        ${h.contact
          ? `<a class="hb-btn hb-btn-call" href="tel:${hbEsc(h.contact)}"
               onclick="event.stopPropagation()">📞 Call</a>`
          : '<span class="hb-btn hb-btn-disabled">No phone listed</span>'}
      </div>
      ${h.distanceKm != null ? `<div class="hall-price"><span class="dist-pill">${h.distanceKm} km away</span></div>` : ''}
    </div>`;
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
      <span>${hbEsc(a.label)}</span>
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
    box.innerHTML = '<div style="color:#64748b;">Select a venue to continue.</div>';
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

    // No verified rates: show what the venue will do, not a made-up total.
    if (q.mode === 'enquiry' || q.total == null) {
      const rs = n => `₹${Number(n).toLocaleString('en-IN')}`;

      box.innerHTML = `
        <div style="color:#a78bfa; font-weight:600; margin-bottom:0.4rem;">
          Indicative — the venue sets the price
        </div>
        ${(q.guide || []).map(g => `
          <div class="quote-line">
            <span>${hbEsc(g.label)}</span>
            <span>${rs(g.range[0])} – ${rs(g.range[1])}</span>
          </div>`).join('')}
        ${q.guideTotal
          ? `<div class="quote-total" style="color:#a78bfa;">
               <span>Rough range</span>
               <span>${rs(q.guideTotal[0])} – ${rs(q.guideTotal[1])}</span>
             </div>`
          : ''}
        <div style="color:#64748b; font-size:0.7rem; margin-top:0.4rem; line-height:1.45;">
          ${hbEsc(q.guideBasis || '')}${q.guideBasis ? '. ' : ''}Not a quote —
          ${hbEsc(q.message || 'the venue confirms availability and cost.')}
        </div>
        ${q.contact
          ? `<a href="tel:${hbEsc(q.contact)}" style="display:inline-block; margin-top:0.5rem;
               color:#22c55e; font-size:0.78rem; text-decoration:none;">
               📞 ${hbEsc(q.contact)}
             </a>`
          : ''}`;
      return;
    }

    box.innerHTML = `
      ${q.breakdown.map(l => `
        <div class="quote-line">
          <span>${hbEsc(l.label)}</span>
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
    box.innerHTML = '<div style="color:#ef4444;">Could not load pricing.</div>';
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
    showToast('Please select a venue first.', 'warning');
    return;
  }
  if (!isHallAvailable) {
    showToast('Another request already covers that date.', 'error');
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
  btn.innerText = '⏳ Sending...';

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

    const enquiry = data.bookingType === 'enquiry' || data.estimatedCost == null;

    document.getElementById('booking-result').innerHTML = `
      <div style="background:#22c55e22; border:1px solid #22c55e;
                  border-radius:10px; padding:1rem; text-align:center;">
        <div style="color:#22c55e; font-size:1rem; font-weight:bold;">
          ${enquiry ? '✅ Enquiry Sent' : '✅ Booking Submitted!'}
        </div>
        <div style="color:#38bdf8; font-size:1.1rem; letter-spacing:2px; margin:0.4rem 0;">
          ${data.bookingId}
        </div>
        <div style="color:#f1f5f9; font-size:0.85rem; margin:0.3rem 0;">
          ${enquiry
            ? 'The venue will confirm availability and price.'
            : `Estimated: ₹${(data.estimatedCost || 0).toLocaleString('en-IN')}`}
        </div>
        <div style="color:#64748b; font-size:0.78rem;">
          ${enquiry
            ? 'The hall is not reserved until the venue confirms.'
            : 'Status: Pending confirmation from the hall'}
        </div>
        ${enquiry && data.venueContact
          ? `<a href="tel:${hbEsc(data.venueContact)}"
               style="display:inline-block; margin-top:0.6rem; color:#22c55e;
                      font-size:0.8rem; text-decoration:none;">
               📞 Call ${hbEsc(data.venueContact)} to follow up
             </a>`
          : ''}
      </div>
    `;

    showToast(enquiry
      ? `✅ Enquiry sent — ref ${data.bookingId}`
      : `✅ Booking ID: ${data.bookingId}`, 'success');
    btn.innerText = '📩 Send Enquiry';
    btn.disabled  = false;
  } catch (err) {
    showToast(err.message || 'Could not send the enquiry.', 'error');
    btn.innerText = '📩 Send Enquiry';
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
                <div style="font-weight:600; font-size:0.85rem;">${hbEsc(b.eventName)}</div>
                <div style="color:#64748b; font-size:0.72rem;">
                  ${hbEsc(b.hallName)} ·
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

// Local escaper. window.sbEsc is used elsewhere in the app but is not defined
// on every page, and several real venue names carry an apostrophe
// ("King's Palace Convention Hall") which breaks unescaped interpolation.
function hbEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));
}