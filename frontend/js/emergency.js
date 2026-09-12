import { auth } from "./firebase-config.js";

const BACKEND  = window.SB_API;
const BALLARI  = [15.1394, 76.9214];

let map;
let incidentMarkers  = new Map();
let responderMarkers = [];
let userMarker       = null;
let selectedSeverity = 'medium';
let allContacts      = [];
let liveInterval     = null;
let allocPollTimer   = null;
// ── AI DISPATCH SIM ───────────────────────────────────
let aiPinMarker    = null;
let aiResultMarkers = [];

// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initMap();
  await loadContacts();
  await loadIncidents();
  startLiveBoard();
  hideAllocationTabForCitizens();
});

// The Allocation tab shows pending dispatch recommendations, priorities,
// and reasoning for ongoing incidents — none of that is citizen-facing
// information, so the tab itself doesn't exist for that role, not just
// the approve/reject buttons inside it (already gated separately via
// `canAct` in renderRecommendations).
function hideAllocationTabForCitizens() {
  const role = localStorage.getItem('userRole');
  if (['admin', 'officer', 'responder-manager'].includes(role)) return;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.getAttribute('onclick') === "switchTab('allocation')") {
      btn.style.display = 'none';
    }
  });
}

// ── MAP ───────────────────────────────────────────────
function initMap() {
  map = L.map('emergency-map').setView(BALLARI, 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  // Single click handler — sets the incident location for BOTH the
  // regular report form and the AI dispatch simulator tab, since
  // they were previously two separate map.on('click') handlers doing
  // overlapping work (and one of them lived outside this function,
  // running before `map` existed at all — that was the crash).
  map.on('click', (e) => {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    // Report form fields
    document.getElementById('inc-lat').value = lat;
    document.getElementById('inc-lng').value = lng;
    document.getElementById('inc-address').value =
      `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const gpsStatus = document.getElementById('inc-gps-status');
    if (gpsStatus) gpsStatus.innerText = '📍 Location pinned from map';

    // Single marker on the map representing the pinned point
    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.circleMarker([lat, lng], {
      radius: 10, fillColor: '#ef4444',
      color: '#0f172a', fillOpacity: 0.9, weight: 2
    }).addTo(map).bindPopup('📍 Incident Location').openPopup();
  });
}

// ── TABS ──────────────────────────────────────────────
window.switchTab = (tab) => {
  document.querySelectorAll('.tab-panel').forEach(p =>
    p.classList.remove('active')
  );
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.remove('active')
  );
  document.getElementById(`tab-${tab}`).classList.add('active');
  event.target.classList.add('active');

  if (tab === 'allocation') {
    loadAllocSummary();
    loadRecommendations();
    if (!allocPollTimer) {
      allocPollTimer = setInterval(() => {
        loadAllocSummary();
        loadRecommendations();
      }, 15000);
    }
  } else if (allocPollTimer) {
    // Only poll while the tab is actually visible — no point hitting the
    // API every 15s for a panel nobody's looking at.
    clearInterval(allocPollTimer);
    allocPollTimer = null;
  }

  if (tab === 'contacts') {
    renderResponderMarkers(decluttedForMap(allContacts));
  } else {
    renderResponderMarkers([]); // clear them off the map on other tabs
  }
};

// ── SEVERITY ──────────────────────────────────────────
window.setSeverity = (level) => {
  selectedSeverity = level;
  document.getElementById('inc-severity').value = level;
  document.querySelectorAll('.sev-btn').forEach(b => {
    b.className = 'sev-btn';
  });
  event.target.className = `sev-btn selected-${level}`;
};

// ── GPS DETECT ────────────────────────────────────────
window.detectIncidentLocation = () => {
  const status = document.getElementById('inc-gps-status');
  status.innerText = '🔍 Detecting...';

  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      document.getElementById('inc-lat').value = coords.latitude;
      document.getElementById('inc-lng').value = coords.longitude;

      try {
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/reverse` +
          `?lat=${coords.latitude}&lon=${coords.longitude}&format=json`
        );
        const data = await res.json();
        document.getElementById('inc-address').value =
          data.display_name || `${coords.latitude}, ${coords.longitude}`;
      } catch {
        document.getElementById('inc-address').value =
          `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
      }

      status.innerText = '✅ Location captured';
      map.setView([coords.latitude, coords.longitude], 15);

      if (userMarker) map.removeLayer(userMarker);
      userMarker = L.circleMarker(
        [coords.latitude, coords.longitude],
        { radius: 10, fillColor: '#ef4444',
          color: '#0f172a', fillOpacity: 0.9, weight: 2 }
      ).addTo(map).bindPopup('📍 Your Location').openPopup();
    },
    () => { status.innerText = '❌ Could not detect. Tap map to pin.'; }
  );
};

// ── SOS ───────────────────────────────────────────────
window.triggerSOS = () => {
  document.getElementById('inc-type').value = 'medical';
  document.getElementById('inc-severity').value = 'critical';
  document.getElementById('inc-desc').value =
    'SOS — Emergency assistance needed immediately!';
  selectedSeverity = 'critical';
  document.querySelectorAll('.sev-btn').forEach(b => {
    b.className = 'sev-btn';
    if (b.innerText.toLowerCase() === 'critical')
      b.className = 'sev-btn selected-critical';
  });

  detectIncidentLocation();
  showToast('📍 Detecting your location for SOS...', 'warning');

  setTimeout(() => submitIncident(), 3000);
};

// ── CASUALTY COUNT FIELD ───────────────────────────────
// Only shown for types where "how many people" actually changes dispatch —
// an accident or fire can have multiple casualties needing separate
// ambulances; a crime report doesn't work the same way.
window.toggleCasualtyField = () => {
  const type = document.getElementById('inc-type').value;
  const row  = document.getElementById('inc-casualty-row');
  row.style.display = ['medical', 'accident', 'fire'].includes(type) ? 'block' : 'none';
};

// ── SUBMIT INCIDENT ───────────────────────────────────
window.submitIncident = async () => {
  const type     = document.getElementById('inc-type').value;
  const desc     = document.getElementById('inc-desc').value.trim();
  const address  = document.getElementById('inc-address').value.trim();
  const lat      = parseFloat(document.getElementById('inc-lat').value);
  const lng      = parseFloat(document.getElementById('inc-lng').value);
  const casualtyCount = parseInt(document.getElementById('inc-casualty-count')?.value, 10) || 1;

  if (!type) { showToast('Select incident type.', 'error'); return; }
  if (!desc) { showToast('Describe the incident.', 'error'); return; }

  const btn = document.getElementById('inc-submit-btn');
  btn.disabled  = true;
  btn.innerText = '⏳ Reporting...';

  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    showToast('You must be logged in.', 'error');
    btn.disabled  = false;
    btn.innerText = '🚨 Report Incident';
    return;
  }

  try {
    const res = await fetch(`${BACKEND}/api/emergency/incidents`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        type,
        severity: selectedSeverity,
        casualtyCount,
        description: desc,
        location: {
          coordinates: {
            lat: lat || BALLARI[0],
            lng: lng || BALLARI[1]
          },
          address: address || 'Ballari'
        }
      })
    });

    const data = await res.json();
    showDispatchModal(data.incident, data.dispatched || (data.nearest ? [data.nearest] : []));
    await loadIncidents();

    // Reset form
    document.getElementById('inc-type').value = '';
    document.getElementById('inc-desc').value = '';
    document.getElementById('inc-address').value = '';
    document.getElementById('inc-casualty-count').value = '1';
    document.getElementById('inc-casualty-row').style.display = 'none';

  } catch {
    showToast('Failed to report incident.', 'error');
  } finally {
    btn.disabled  = false;
    btn.innerText = '🚨 Report Incident';
  }
};

// ── DISPATCH MODAL ────────────────────────────────────
// `dispatched` is the full array from the backend (could be more than one
// unit — e.g. 2 ambulances for 2 casualties, or police+ambulance for an
// accident), not just a single "nearest" pick.
async function showDispatchModal(incident, dispatched) {
  document.getElementById('dispatch-id').innerText = incident.incidentId;

  // Low-severity medical incidents don't get an ambulance dispatched at
  // all (see config/dispatchAI.js's getResponderTypes) — the nearest
  // pharmacy is the intended answer instead. When that's the case,
  // `dispatched` is empty by design, not because dispatch failed, so this
  // needs its own message rather than falling into the generic "no
  // responder" text.
  const isMinorMedical = incident.severity === 'low' && incident.type === 'medical';
  const locationLabel  = incident.location?.address || 'the incident location';

  let respHtml;
  if (dispatched && dispatched.length) {
    respHtml = `<h4>🚑 Dispatched</h4>` + dispatched.map(d => `
      <div style="margin-bottom:0.7rem; padding-bottom:0.7rem; border-bottom:1px solid #334155; text-align:left;">
        <b>${window.sbEsc(d.name)}</b> dispatched to
        <span style="color:#38bdf8;">${window.sbEsc(locationLabel)}</span><br/>
        ${d.phone && d.phone !== 'PLACEHOLDER_PHONE'
          ? `<span style="color:#f59e0b;">📞 ${window.sbEsc(d.phone)}</span><br/>`
          : `<span style="color:#64748b; font-size:0.78rem;">Number not yet verified</span><br/>`}
        <span style="color:#94a3b8; font-size:0.78rem;">
          ${d.distance?.toFixed ? d.distance.toFixed(2) : d.distance} km away
          ${d.eta ? ` &middot; ETA ${window.sbEsc(d.eta)}` : ''}
        </span>
      </div>`).join('');
  } else if (isMinorMedical) {
    respHtml = `<h4 style="color:#38bdf8;">💊 No ambulance needed</h4>
         <p style="color:#94a3b8; font-size:0.82rem;">
           For a minor issue like this, the nearest pharmacy is usually faster
           and more appropriate than an ambulance. See suggestions below.
         </p>`;
  } else {
    respHtml = '<p style="color:#64748b;">No responder available nearby.</p>';
  }

  document.getElementById('dispatch-responder').innerHTML = respHtml;
  document.getElementById('dispatch-modal').classList.add('open');

  if (isMinorMedical) {
    showNearbyPharmacies(incident);
  }

  const coords = incident.location?.coordinates;
  if (dispatched && dispatched.length && coords?.lat != null) {
    // Dotted route lines from the incident to every unit sent, right away —
    // not just when someone later opens the Dispatch tab's analysis.
    drawDispatchLines(dispatched, coords.lat, coords.lng);
    appendNearbyAlternatives(incident, dispatched);
  }
}

// Shows up to 3 nearby responders of each dispatched type that DIDN'T get
// sent — situational awareness ("here's what else was close by"), not
// another dispatch action. Purely informational, appended under the
// dispatched list already rendered above.
async function appendNearbyAlternatives(incident, dispatched) {
  const coords = incident.location?.coordinates;
  if (!coords?.lat) return;

  const dispatchedIds = new Set(dispatched.map(d => String(d._id)));
  const types = [...new Set(dispatched.map(d => d.dispatchType || d.type))];

  const box = document.getElementById('dispatch-responder');
  const slot = document.createElement('div');
  slot.style.cssText = 'margin-top:0.6rem; padding-top:0.6rem; border-top:1px solid #334155; text-align:left;';
  box.appendChild(slot);

  const allAlternatives = [];
  for (const type of types) {
    try {
      const res = await fetch(`${BACKEND}/api/emergency/nearest?lat=${coords.lat}&lng=${coords.lng}&type=${type}&limit=6`);
      const list = await res.json();
      if (Array.isArray(list)) {
        allAlternatives.push(...list.filter(r => !dispatchedIds.has(String(r._id))));
      }
    } catch { /* skip silently, this section is optional */ }
  }

  const top3 = allAlternatives.sort((a, b) => a.distance - b.distance).slice(0, 3);
  if (!top3.length) return;

  slot.innerHTML = `
    <div style="color:#64748b; font-size:0.72rem; text-transform:uppercase; margin-bottom:0.3rem;">
      Also nearby
    </div>
    ${top3.map(r => `
      <div style="font-size:0.78rem; color:#cbd5e1; margin-bottom:0.2rem;">
        ${window.sbEsc(r.name)} <span style="color:#64748b;">&middot; ${r.distance.toFixed(2)} km</span>
      </div>`).join('')}`;
}

// ── NEARBY PHARMACIES (low-severity medical only) ─────
// Looked up live from Google Places and never stored, so this renders into
// the modal after it opens rather than blocking it on a network round trip.
async function showNearbyPharmacies(incident) {
  const box = document.getElementById('dispatch-responder');
  const c = incident.location?.coordinates;
  if (!c || c.lat == null) return;

  const slot = document.createElement('div');
  slot.style.cssText = 'margin-top:0.9rem; padding-top:0.8rem; border-top:1px solid #334155;';
  slot.innerHTML = '<span style="color:#64748b; font-size:0.8rem;">Finding nearby pharmacies\u2026</span>';
  box.appendChild(slot);

  try {
    const { auth } = await import('./firebase-config.js');
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch(
      `${BACKEND}/api/emergency/pharmacies/nearby?lat=${c.lat}&lng=${c.lng}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const data = await res.json();

    if (!data.pharmacies?.length) {
      slot.innerHTML = `<span style="color:#64748b; font-size:0.8rem;">
        ${window.sbEsc(data.unavailable || 'No pharmacies found nearby.')}</span>`;
      return;
    }

    slot.innerHTML = `
      <h4 style="color:#22c55e; font-size:0.9rem; margin-bottom:0.15rem;">
        \u{1F48A} Nearest medical stores
      </h4>
      <p style="color:#64748b; font-size:0.75rem; margin-bottom:0.6rem;">
        For minor treatment you can pick up yourself \u2014 a unit is on its way regardless.
      </p>
      <div class="pharm-grid">
        ${data.pharmacies.slice(0, 4).map(ph => `
          <div class="pharm-card">
            <div class="pharm-top">
              <b>${window.sbEsc(ph.name)}</b>
              <span style="color:#38bdf8; font-size:0.76rem; white-space:nowrap;">
                ${ph.distanceKm} km</span>
            </div>
            ${ph.address ? `<div style="color:#64748b; font-size:0.72rem;">
              ${window.sbEsc(ph.address)}</div>` : ''}
            <a href="https://www.google.com/maps/dir/?api=1&destination=${ph.location.lat},${ph.location.lng}"
               target="_blank" rel="noopener"
               style="color:#f59e0b; font-size:0.76rem; text-decoration:none; margin-top:0.15rem;">
              \u{1F5FA} Directions</a>
          </div>`).join('')}
      </div>
      <p style="color:#475569; font-size:0.68rem; line-height:1.5;
                margin-top:0.6rem; text-align:left;">
        ${window.sbEsc(data.note || '')}
      </p>`;
  } catch {
    slot.innerHTML = '<span style="color:#64748b; font-size:0.8rem;">' +
      'Could not look up pharmacies. Dial 108 if this gets worse.</span>';
  }
}

window.closeDispatch = () => {
  document.getElementById('dispatch-modal').classList.remove('open');
};

// ── LIVE INCIDENT BOARD ───────────────────────────────
function startLiveBoard() {
  liveInterval = setInterval(loadIncidents, 10000);
}

window.loadIncidents = async () => {
  const status = document.getElementById('board-filter').value;
  try {
    const url = status
      ? `${BACKEND}/api/emergency/incidents?status=${status}`
      : `${BACKEND}/api/emergency/incidents`;

    const res       = await fetch(url);
    const incidents = await res.json();

    renderIncidentBoard(incidents);
    renderIncidentMarkers(incidents);
  } catch {
    document.getElementById('incident-list').innerHTML =
      '<p style="color:#ef4444; text-align:center;">Could not load.</p>';
  }
};

function renderIncidentBoard(incidents) {
  const container = document.getElementById('incident-list');

  if (!incidents.length) {
    container.innerHTML =
      '<p style="color:#64748b; text-align:center; padding:2rem;">No incidents.</p>';
    return;
  }

  const typeIcon = {
    accident: '🚗', medical: '🏥',
    fire: '🔥', crime: '🚔',
    flood: '🌊', other: '📦'
  };

  container.innerHTML = incidents.map(inc => `
    <div class="incident-card ${inc.status}" id="ic-${inc._id}"
      onclick="selectIncident('${inc._id}', ${inc.location.coordinates.lat},
               ${inc.location.coordinates.lng})">
      <div class="incident-top">
        <span class="inc-type" style="color:${severityColor(inc.severity)}">
          ${typeIcon[inc.type] || '📦'} ${inc.type}
        </span>
        <span class="inc-severity sev-${inc.severity}">
          ${inc.severity}
        </span>
      </div>
      <div class="inc-desc">${window.sbEsc(inc.description)}</div>
      <div class="inc-meta">
        📍 ${window.sbEsc(inc.location?.address || 'Ballari')} &bull;
        ${timeAgo(new Date(inc.createdAt))}
        ${inc.assignedTo
          ? `<br/>🚑 ${window.sbEsc(inc.assignedTo)}`
          : ''}
      </div>
      <div style="margin-top:0.4rem;">
        <span class="badge badge-${inc.status === 'active'
          ? 'open' : inc.status === 'responding'
          ? 'pending' : 'resolved'}">
          ${inc.status}
        </span>
        <code style="font-size:0.72rem; color:#38bdf8; margin-left:0.5rem;">
          ${inc.incidentId}
        </code>
      </div>
    </div>
  `).join('');
}

// ── INCIDENT MAP MARKERS ──────────────────────────────
function renderIncidentMarkers(incidents) {
  // Clear old
  incidentMarkers.forEach(m => map.removeLayer(m));
  incidentMarkers.clear();

  const typeIcon = {
    accident: '🚗', medical: '🏥',
    fire: '🔥', crime: '🚔',
    flood: '🌊', other: '📦'
  };

  incidents.forEach(inc => {
    const { lat, lng } = inc.location.coordinates;
    if (!lat || !lng) return;

    const color = severityColor(inc.severity);

    const icon = L.divIcon({
      className: '',
      html: `<div style="
        background:${color};
        border-radius:50%;
        width:32px; height:32px;
        display:flex; align-items:center;
        justify-content:center;
        font-size:16px;
        border:2px solid #0f172a;
        box-shadow:0 2px 8px rgba(0,0,0,0.4);
        animation:${inc.status === 'active' ? 'sosPulse 2s infinite' : 'none'};
      ">${typeIcon[inc.type] || '📦'}</div>`,
      iconSize:   [32, 32],
      iconAnchor: [16, 16]
    });

    const marker = L.marker([lat, lng], { icon }).addTo(map);
    marker.bindPopup(`
      <div style="min-width:180px;">
        <b>${typeIcon[inc.type]} ${inc.type}</b>
        <span class="badge badge-${inc.status === 'active'
          ? 'open' : 'pending'}"
          style="margin-left:6px;">
          ${inc.status}
        </span><br/>
        <p style="font-size:0.82rem; margin:6px 0;">
          ${inc.description}
        </p>
        <small style="color:#64748b;">
          📍 ${inc.location?.address || ''}<br/>
          🕐 ${timeAgo(new Date(inc.createdAt))}
        </small>
        ${inc.assignedTo
          ? `<br/><small style="color:#22c55e;">
               🚑 ${window.sbEsc(inc.assignedTo)}
             </small>`
          : ''}
      </div>
    `);

    incidentMarkers.set(inc._id, marker);
  });
}

window.focusIncident = (lat, lng) => {
  map.setView([lat, lng], 16);
};

// ── CONTACTS ──────────────────────────────────────────
// Markers are NOT drawn on page load anymore — with 40+ responders across
// 4 types the map was unreadable before an incident was even reported.
// They're drawn only when the Contacts tab is actually opened (see
// switchTab), and even then capped to a handful per type by default.
async function loadContacts() {
  try {
    const res  = await fetch(`${BACKEND}/api/emergency/responders`);
    allContacts = await res.json();
    renderContacts(allContacts);
  } catch {
    document.getElementById('contacts-list').innerHTML =
      '<p style="color:#ef4444;">Could not load contacts.</p>';
  }
}

// Default view: up to 5 of each type, closest to city centre — a taste of
// what's available, not the entire directory dumped on the map at once.
// "Nearest to me" (already existing) replaces this with a real
// distance-sorted set once the citizen shares their location.
const MAX_MARKERS_PER_TYPE = 5;
function decluttedForMap(contacts) {
  const byType = {};
  contacts.forEach(c => {
    byType[c.type] = byType[c.type] || [];
    byType[c.type].push(c);
  });
  return Object.values(byType).flatMap(list => list.slice(0, MAX_MARKERS_PER_TYPE));
}

window.filterContacts = (type) => {
  document.querySelectorAll('[id^="cf-"]').forEach(b => {
    b.className = 'sev-btn';
  });
  document.getElementById(`cf-${type}`).className =
    'sev-btn selected-high';

  const filtered = type === 'all'
    ? allContacts
    : allContacts.filter(c => c.type === type);
  renderContacts(filtered);
  renderResponderMarkers(decluttedForMap(filtered));

  // Changing the filter re-renders from the unsorted list, so drop the
  // "nearest first" state rather than leaving a stale claim on screen.
  const clear = document.getElementById('near-clear');
  if (clear && clear.style.display !== 'none') {
    clear.style.display = 'none';
    document.getElementById('near-note').textContent =
      'Tap \u201cNearest to me\u201d to sort this list by distance.';
    document.getElementById('near-btn').textContent = '\u{1F4CD} Nearest to me';
  }
};

function renderContacts(contacts) {
  const typeIcon = {
    hospital: '🏥', police: '🚔', fire: '🚒', ambulance: '🚑'
  };

  document.getElementById('contacts-list').innerHTML =
    contacts.map(c => `
      <div class="contact-card">
        <div class="contact-icon">${typeIcon[c.type] || '📞'}</div>
        <div class="contact-info">
          <div class="contact-name">${c.name}${
            c.available === false
              ? ' <span style="color:#ef4444; font-size:0.7rem;">at capacity</span>'
              : ''}</div>
          <div class="contact-addr">${c.address || ''}</div>
          <div class="contact-dist">📞 ${
            c.phone && c.phone !== 'PLACEHOLDER_PHONE' ? c.phone : 'Number not yet verified'
          }${
            c.distance != null
              ? ` &middot; <b style="color:#38bdf8;">${c.distance.toFixed(1)} km away</b>`
              : ''}</div>
        </div>
        ${c.phone && c.phone !== 'PLACEHOLDER_PHONE'
          ? `<a class="call-btn" href="tel:${c.phone}">📞 Call</a>`
          : ''}
      </div>
    `).join('');
}

// ── NEAREST RESPONDERS (/api/emergency/nearest) ───────
// The contacts tab listed every responder in whatever order Mongo returned
// them. In an emergency the only ordering that matters is distance, so this
// asks the server to sort by haversine from the caller's position.
//
// Location is requested on a tap rather than on page load: an emergency page
// that demands GPS before it will show you a phone number is worse than one
// that shows the numbers immediately.
window.findNearestResponders = () => {
  const btn   = document.getElementById('near-btn');
  const note  = document.getElementById('near-note');
  const clear = document.getElementById('near-clear');

  if (!navigator.geolocation) {
    note.textContent = 'This browser does not support location.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Locating...';

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;

      // Which type filter is currently active, so "nearest" respects it.
      const active = document.querySelector('[id^="cf-"].selected-high');
      const type   = active && active.id !== 'cf-all'
        ? active.id.replace('cf-', '')
        : '';

      try {
        const qs  = `lat=${lat}&lng=${lng}&limit=10${type ? `&type=${type}` : ''}`;
        const res = await fetch(`${BACKEND}/api/emergency/nearest?${qs}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not sort by distance.');

        if (!Array.isArray(data) || !data.length) {
          note.textContent = 'No responders found nearby.';
          return;
        }

        renderContacts(data);
        renderResponderMarkers(data);

        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.circleMarker([lat, lng], {
          radius: 7, color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.9
        }).addTo(map).bindPopup('You are here');
        map.setView([lat, lng], 13);

        note.textContent = `Nearest first — closest is ${data[0].distance.toFixed(1)} km away.`;
        clear.style.display = '';
        btn.textContent = 'Recentre on me';
      } catch (err) {
        note.textContent = err.message;
        btn.textContent = 'Nearest to me';
      } finally {
        btn.disabled = false;
      }
    },
    (err) => {
      btn.disabled = false;
      btn.textContent = 'Nearest to me';
      note.textContent = err.code === 1
        ? 'Location denied — showing all responders.'
        : 'Could not get your location — showing all responders.';
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
};

window.clearNearest = () => {
  renderContacts(allContacts);
  renderResponderMarkers(allContacts);
  document.getElementById('near-clear').style.display = 'none';
  document.getElementById('near-note').textContent =
    'Sorted alphabetically — turn on location to sort by distance.';
};

// ── RESPONDER MAP MARKERS ─────────────────────────────
function renderResponderMarkers(responders) {
  responderMarkers.forEach(m => map.removeLayer(m));
  responderMarkers = [];

  const typeIcon  = { hospital: '🏥', police: '🚔', fire: '🚒', ambulance: '🚑' };
  const typeColor = { hospital: '#22c55e', police: '#38bdf8', fire: '#f59e0b', ambulance: '#ef4444' };

  responders.forEach(r => {
    const icon = L.divIcon({
      className: '',
      html: `<div style="
        background:${typeColor[r.type] || '#334155'};
        border-radius:8px;
        padding:3px 7px;
        font-size:13px;
        border:2px solid #0f172a;
        white-space:nowrap;
        box-shadow:0 2px 6px rgba(0,0,0,0.4);
      ">${typeIcon[r.type] || '📍'}</div>`,
      iconSize:   [30, 24],
      iconAnchor: [15, 12]
    });

    const marker = L.marker([r.location.lat, r.location.lng], { icon })
      .addTo(map);

    marker.bindPopup(`
      <div style="min-width:160px;">
        <b>${r.name}</b><br/>
        <small>${r.address || ''}</small><br/>
        ${r.phone && r.phone !== 'PLACEHOLDER_PHONE'
          ? `<a href="tel:${r.phone}" style="color:#22c55e; font-weight:bold;">📞 ${r.phone}</a>`
          : '<small style="color:#64748b;">Number not yet verified</small>'}
      </div>
    `);

    responderMarkers.push(marker);
  });
}

// ── HELPERS ───────────────────────────────────────────
function severityColor(s) {
  return { low:'#22c55e', medium:'#f59e0b',
           high:'#ef4444', critical:'#7c3aed' }[s] || '#64748b';
}

function timeAgo(date) {
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}


// ── DISPATCH CONSOLE ──────────────────────────────────
// The old "AI Dispatch" tab ran the same dispatch() on a made-up incident
// that reporting already runs on a real one. It was deleted and folded in
// here: pick a real incident, see the units actually assigned to it plus the
// advisory analysis.
let selectedIncidentId = null;

window.selectIncident = async (id, lat, lng) => {
  selectedIncidentId = id;
  document.querySelectorAll('.incident-card')
    .forEach(c => c.classList.toggle('selected', c.id === `ic-${id}`));
  focusIncident(lat, lng);
  await loadAnalysis(id);
};

async function loadAnalysis(id) {
  const box = document.getElementById('dispatch-analysis');
  if (!box) return;
  box.innerHTML = '<p style="color:#64748b; font-size:0.8rem;">Loading dispatch analysis\u2026</p>';

  try {
    const { auth } = await import('./firebase-config.js');
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch(`${BACKEND}/api/emergency/incidents/${id}/analysis`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Could not load analysis.');

    renderAnalysis(d);
    const activeUnits = (d.units || []).filter(u => u.status === 'active' && u.location?.lat != null);
    if (activeUnits.length && d.incident?.location) {
      drawDispatchLines(activeUnits, d.incident.location.lat, d.incident.location.lng);
    }
  } catch (err) {
    box.innerHTML = `<p style="color:#ef4444; font-size:0.8rem;">${window.sbEsc(err.message)}</p>`;
  }
}

function renderAnalysis(d) {
  const box = document.getElementById('dispatch-analysis');
  const a = d.advice || {};
  const badge = a.generatedBy === 'ai'
    ? '<span style="color:#a78bfa; font-size:0.68rem;">AI analysis</span>'
    : '<span style="color:#38bdf8; font-size:0.68rem;">rule-based analysis</span>';

  const activeUnits    = (d.units || []).filter(u => u.status === 'active');
  const historyUnits    = (d.units || []).filter(u => u.status !== 'active');
  const hasPending      = d.pending && d.pending.length;
  const hasPharmacies   = d.pharmacies?.pharmacies?.length;

  // One-line status summary at the top — the fastest way to answer
  // "what happened to this incident", before reading anything else.
  let statusLine;
  if (activeUnits.length) {
    statusLine = `<div style="color:#22c55e; font-size:0.82rem; font-weight:600; margin-bottom:0.6rem;">
      ✅ Dispatched — ${activeUnits.length} unit${activeUnits.length > 1 ? 's' : ''} en route</div>`;
  } else if (hasPending) {
    statusLine = `<div style="color:#f59e0b; font-size:0.82rem; font-weight:600; margin-bottom:0.6rem;">
      ⏳ Awaiting approval — ${d.pending.length} recommendation${d.pending.length > 1 ? 's' : ''} pending in the Allocation tab</div>`;
  } else if (hasPharmacies) {
    statusLine = `<div style="color:#38bdf8; font-size:0.82rem; font-weight:600; margin-bottom:0.6rem;">
      💊 No ambulance needed — minor issue, nearby pharmacies suggested below</div>`;
  } else {
    statusLine = `<div style="color:#64748b; font-size:0.82rem; font-weight:600; margin-bottom:0.6rem;">
      No unit dispatched and nothing pending — this incident may have resolved, or no responder was available.</div>`;
  }

  box.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;
                margin-bottom:0.5rem;">
      <b style="font-size:0.86rem;">\u{1F9E0} Incident outcome</b>
      ${badge}
    </div>

    ${statusLine}

    ${a.summary ? `<p style="font-size:0.82rem; color:#cbd5e1; line-height:1.55;
                              margin-bottom:0.7rem;">${window.sbEsc(a.summary)}</p>` : ''}

    <!-- FACTS: real dispatched units, real confirm/ETA status -->
    ${activeUnits.length ? `
      <div style="font-size:0.7rem; color:#64748b; text-transform:uppercase;
                  letter-spacing:0.05em; margin-bottom:0.35rem;">Dispatched — en route</div>
      ${activeUnits.map((u, i) => `
        <div style="background:#0f172a; border:1px solid #334155; border-radius:8px;
                    padding:0.5rem 0.65rem; margin-bottom:0.35rem;">
          <div style="display:flex; justify-content:space-between; gap:0.5rem;">
            <b style="font-size:0.82rem;">${i === 0 ? '\u2b50 ' : ''}${window.sbEsc(u.name)}</b>
            <span style="color:#38bdf8; font-size:0.75rem; white-space:nowrap;">
              ${u.distanceKm != null ? u.distanceKm + ' km' : ''} ${u.eta ? '&middot; ETA ' + window.sbEsc(u.eta) : ''}</span>
          </div>
          <div style="color:#64748b; font-size:0.71rem; margin-top:0.12rem;">
            ${window.sbEsc(u.type)} &middot; load ${window.sbEsc(u.load)}
            &middot; ${u.confirmed
              ? '<span style="color:#22c55e;">✓ confirmed en route</span>'
              : '<span style="color:#f59e0b;">⏳ unconfirmed — will escalate if not confirmed within 2 min</span>'}
            ${u.phone && u.phone !== 'PLACEHOLDER_PHONE' ? ` &middot; <a href="tel:${window.sbEsc(u.phone)}"
              style="color:#f59e0b; text-decoration:none;">\u{1F4DE} ${window.sbEsc(u.phone)}</a>` : ''}
          </div>
        </div>`).join('')}
    ` : ''}

    <!-- PENDING: recommendations awaiting admin/officer approval -->
    ${hasPending ? `
      <div style="font-size:0.7rem; color:#64748b; text-transform:uppercase;
                  letter-spacing:0.05em; margin:0.6rem 0 0.35rem;">Awaiting approval</div>
      ${d.pending.map(p => `
        <div style="background:#0f172a; border:1px solid #f59e0b55; border-radius:8px;
                    padding:0.5rem 0.65rem; margin-bottom:0.35rem;">
          <div style="display:flex; justify-content:space-between; gap:0.5rem;">
            <b style="font-size:0.82rem;">${window.sbEsc(p.recommendedResourceName || 'No responder available')}</b>
            <span style="color:#f59e0b; font-size:0.72rem; text-transform:uppercase;">${window.sbEsc(p.priority)}</span>
          </div>
          <div style="color:#64748b; font-size:0.71rem; margin-top:0.12rem;">
            ${window.sbEsc(p.resourceType)}${p.distanceKm != null ? ' &middot; ' + p.distanceKm + ' km away' : ''}
            &middot; approve in the Allocation tab, or it auto-dispatches in 5 min
          </div>
        </div>`).join('')}
    ` : ''}

    <!-- HISTORY: cancelled/completed deployments for this incident (e.g. an
         escalated critical dispatch that timed out unconfirmed) -->
    ${historyUnits.length ? `
      <div style="font-size:0.7rem; color:#64748b; text-transform:uppercase;
                  letter-spacing:0.05em; margin:0.6rem 0 0.35rem;">History</div>
      ${historyUnits.map(u => `
        <div style="font-size:0.74rem; color:#64748b; margin-bottom:0.25rem;">
          ${u.status === 'cancelled' ? '✕' : '✓'} ${window.sbEsc(u.name)} —
          ${window.sbEsc(u.cancelReason || (u.status === 'completed' ? 'completed' : u.status))}
        </div>`).join('')}
    ` : ''}

    ${!activeUnits.length && !hasPending && a.route ? section('\u{1F5FA} Approach', a.route, '#38bdf8') : ''}
    ${a.onSceneActions?.length ? `
      <div style="margin-top:0.6rem;">
        <div style="color:#22c55e; font-size:0.74rem; font-weight:600;
                    margin-bottom:0.25rem;">\u26A1 On-scene actions</div>
        <ol style="margin:0 0 0 1.1rem; padding:0; color:#cbd5e1;
                   font-size:0.79rem; line-height:1.6;">
          ${a.onSceneActions.map(x => `<li>${window.sbEsc(x)}</li>`).join('')}
        </ol>
      </div>` : ''}
    ${a.riskFlags ? section('\u26A0\uFE0F Risk flags', a.riskFlags, '#f59e0b') : ''}
    ${a.secondaryUnit ? section('\u{1F4E1} Backup', a.secondaryUnit, '#a78bfa') : ''}

    ${d.pharmacies?.pharmacies?.length ? `
      <div style="margin-top:0.7rem; padding-top:0.6rem; border-top:1px solid #334155;">
        <div style="color:#22c55e; font-size:0.74rem; font-weight:600;">
          \u{1F48A} Nearest medical stores</div>
        <p style="color:#64748b; font-size:0.72rem; margin:0.15rem 0 0.4rem;">
          Minor issue \u2014 stores you can walk to.</p>
        ${d.pharmacies.pharmacies.slice(0, 3).map(ph => `
          <div style="font-size:0.78rem; color:#cbd5e1; margin-bottom:0.25rem;">
            ${window.sbEsc(ph.name)}
            <span style="color:#64748b;">${ph.distanceKm} km</span>
            &middot; <a href="https://www.google.com/maps/dir/?api=1&destination=${ph.location.lat},${ph.location.lng}"
               target="_blank" rel="noopener"
               style="color:#f59e0b; text-decoration:none;">directions</a>
          </div>`).join('')}
        <p style="color:#475569; font-size:0.66rem; margin-top:0.3rem;">
          ${window.sbEsc(d.pharmacies.note || '')}</p>
      </div>` : ''}

    <p style="color:#475569; font-size:0.66rem; margin-top:0.7rem; line-height:1.5;">
      ${window.sbEsc(d.disclaimer || '')}
    </p>`;
}

function section(title, body, colour) {
  return `
    <div style="margin-top:0.6rem;">
      <div style="color:${colour}; font-size:0.74rem; font-weight:600;
                  margin-bottom:0.2rem;">${title}</div>
      <p style="color:#cbd5e1; font-size:0.79rem; line-height:1.6; margin:0;">
        ${window.sbEsc(body)}</p>
    </div>`;
}

function drawDispatchLines(dispatched, aiLat, aiLng) {
  // Clear old lines
  aiResultMarkers.forEach(m => map.removeLayer(m));
  aiResultMarkers = [];

  const typeColor = {
    hospital: '#22c55e', police: '#38bdf8', fire: '#f59e0b', ambulance: '#ef4444'
  };

  dispatched.forEach((d, i) => {
    // Line from incident to responder
    const line = L.polyline(
      [
        [aiLat, aiLng],
        [d.location.lat, d.location.lng]
      ],
      {
        color:     typeColor[d.type] || '#334155',
        weight:    2,
        dashArray: '6 6',
        opacity:   0.8
      }
    ).addTo(map);

    // ETA label at midpoint
    const midLat = (aiLat + d.location.lat) / 2;
    const midLng = (aiLng + d.location.lng) / 2;

    const etaLabel = L.marker([midLat, midLng], {
      icon: L.divIcon({
        className: '',
        html: `<div style="
          background:#0f172a;
          border:1px solid ${typeColor[d.type]};
          color:${typeColor[d.type]};
          padding:2px 7px;
          border-radius:6px;
          font-size:11px;
          font-weight:bold;
          white-space:nowrap;
        ">⏱ ${d.eta}</div>`,
        iconSize: [60, 22],
        iconAnchor: [30, 11]
      })
    }).addTo(map);

    aiResultMarkers.push(line, etaLabel);
  });

  // Fit map to show all
  if (dispatched.length && aiLat && aiLng) {
    const allPoints = [
      [aiLat, aiLng],
      ...dispatched.map(d => [d.location.lat, d.location.lng])
    ];
    map.fitBounds(allPoints, { padding: [40, 40] });
  }
}

// ══════════════════════════════════════════════════════
// ── SMART ALLOCATION (merged in from the retired standalone
//    resources.html page) ─────────────────────────────
// ══════════════════════════════════════════════════════
// Emergency-only: recommendations are generated automatically by
// syncRecommendationForIncident() server-side whenever an incident is
// created or its status changes (see routes/emergency.js). This panel
// only reads them and lets an admin approve/reject — no ward/zone
// grouping anywhere, matching is pure straight-line distance from each
// incident's real coordinates to each candidate resource.

const ALLOC_TYPE_CFG = {
  'ambulance': { icon: '🚑', color: '#ef4444', label: 'Ambulance' },
  'police':    { icon: '🚔', color: '#7c3aed', label: 'Police'    },
  'fire':      { icon: '🚒', color: '#f59e0b', label: 'Fire'      }
};

async function loadAllocSummary() {
  try {
    const res = await fetch(`${BACKEND}/api/resources/summary`);
    const data = await res.json();

    document.getElementById('alloc-summary').innerHTML =
      Object.entries(ALLOC_TYPE_CFG).map(([type, cfg]) => {
        const s = data[type] || {};
        return `
          <div class="alloc-type-card" style="--type-color:${cfg.color};">
            <div class="alloc-type-icon">${cfg.icon}</div>
            <div class="alloc-type-name">${cfg.label}</div>
            <div class="alloc-type-counts">
              <b>${s.total || 0}</b> on record &middot; ${s.avgLoadPercent ?? 0}% avg load
            </div>
          </div>`;
      }).join('');
  } catch {
    // leave whatever was there — a summary refresh failing silently is

    // fine, the recommendations list below is the important part
  }
}

async function loadRecommendations() {
  const body = document.getElementById('recommendations-list');
  try {
    const { auth } = await import('./firebase-config.js');
    const token = await auth.currentUser?.getIdToken();

    const res = await fetch(`${BACKEND}/api/resources/recommendations`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Could not load recommendations');
    const recs = await res.json();

    renderRecommendations(recs);
  } catch (err) {
    body.innerHTML = `<p style="color:#ef4444; font-size:0.8rem; text-align:center;">
      ${window.sbEsc(err.message)}</p>`;
  }
}

function renderRecommendations(recs) {
  const body = document.getElementById('recommendations-list');
  const role = localStorage.getItem('userRole');

  if (!recs.length) {
    body.innerHTML = `
      <div class="alloc-quiet">
        <div class="icon">✓</div>
        <div>No critical resource allocation required.</div>
        <p>All current emergency demand is within available capacity.</p>
      </div>`;
    return;
  }

  const canAct = ['admin', 'officer', 'responder-manager'].includes(role);

  body.innerHTML = recs.map(r => {
    const rcfg = ALLOC_TYPE_CFG[r.resourceType] || {};

    return `
      <div class="rec-card priority-${r.priority}">
        <div class="rec-card-top">
          <div>
            <div class="rec-card-title">${window.sbEsc(r.area || 'Unknown location')}</div>
            <div class="rec-card-sub">
              ${window.sbEsc(r.incidentType)} (${window.sbEsc(r.severity)}) &middot; ${window.sbEsc(r.incidentDisplayId || '')}
            </div>
          </div>
          <span class="rec-priority-badge priority-${r.priority}">${r.priority}</span>
        </div>

        <div class="rec-recommended">
          ${r.recommendedResourceName
            ? `${rcfg.icon || '🚗'} <b>${window.sbEsc(r.recommendedResourceName)}</b>
               ${r.distanceKm != null ? ` · ${r.distanceKm} km away` : ''}`
            : `<span style="color:#ef4444;">No ${window.sbEsc((r.resourceType || '').replace('-', ' '))} currently available</span>`}
        </div>

        <div class="rec-reason">${window.sbEsc(r.reason || '')}</div>

        ${canAct ? `
          <div class="rec-actions">
            <button class="rec-approve-btn" ${!r.recommendedResourceId ? 'disabled' : ''}
              onclick="approveRecommendation('${r._id}')">
              ✓ Approve &amp; Deploy
            </button>
            <button class="rec-reject-btn" onclick="rejectRecommendation('${r._id}')">
              ✕ Reject
            </button>
          </div>
        ` : ''}
      </div>`;
  }).join('');
}

window.approveRecommendation = async (id) => {
  try {
    const { auth } = await import('./firebase-config.js');
    const token = await auth.currentUser?.getIdToken();

    const res = await fetch(`${BACKEND}/api/resources/recommendations/${id}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Approve failed');

    showToast?.(
      `🚑 ${data.responder.name} dispatched to ${data.deployment.area}`,
      'success'
    );

    // Draw the route on the map right away, same as an auto-dispatch would.
    if (data.responder?.location && data.recommendation) {
      drawDispatchLines(
        [{
          name: data.responder.name,
          type: data.responder.type,
          location: data.responder.location,
          eta: data.recommendation.distanceKm != null ? `${data.recommendation.distanceKm} km` : ''
        }],
        data.recommendation.incidentLat,
        data.recommendation.incidentLng
      );
    }

    await Promise.all([loadRecommendations(), loadAllocSummary()]);
  } catch (err) {
    showToast?.(err.message, 'error');
  }
};

window.rejectRecommendation = async (id) => {
  try {
    const { auth } = await import('./firebase-config.js');
    const token = await auth.currentUser?.getIdToken();

    const res = await fetch(`${BACKEND}/api/resources/recommendations/${id}/reject`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Reject failed');

    await loadRecommendations();
  } catch (err) {
    showToast?.(err.message, 'error');
  }
};

window.recalcRecommendations = async () => {
  try {
    const { auth } = await import('./firebase-config.js');
    const token = await auth.currentUser?.getIdToken();

    const res = await fetch(`${BACKEND}/api/resources/recommendations/recalculate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Recalculate failed');

    await Promise.all([loadRecommendations(), loadAllocSummary()]);
    showToast?.('Recommendations refreshed', 'info');
  } catch (err) {
    showToast?.(err.message, 'error');
  }
};