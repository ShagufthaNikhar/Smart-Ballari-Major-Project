const BACKEND  = 'http://localhost:5000';
const BALLARI  = [15.1394, 76.9214];

let map;
let incidentMarkers  = new Map();
let responderMarkers = [];
let userMarker       = null;
let selectedSeverity = 'medium';
let allContacts      = [];
let liveInterval     = null;
// ── AI DISPATCH SIM ───────────────────────────────────
let aiPinMarker    = null;
let aiResultMarkers = [];
let aiLat = null;
let aiLng = null;

// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initMap();
  await loadContacts();
  await loadIncidents();
  startLiveBoard();
});

// ── MAP ───────────────────────────────────────────────
function initMap() {
  map = L.map('emergency-map').setView(BALLARI, 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  // Click to set incident location
  map.on('click', (e) => {
    document.getElementById('inc-lat').value = e.latlng.lat;
    document.getElementById('inc-lng').value = e.latlng.lng;
    document.getElementById('inc-address').value =
      `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
    document.getElementById('inc-gps-status').innerText =
      '📍 Location pinned from map';

    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.circleMarker([e.latlng.lat, e.latlng.lng], {
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

// ── SUBMIT INCIDENT ───────────────────────────────────
window.submitIncident = async () => {
  const type     = document.getElementById('inc-type').value;
  const desc     = document.getElementById('inc-desc').value.trim();
  const address  = document.getElementById('inc-address').value.trim();
  const lat      = parseFloat(document.getElementById('inc-lat').value);
  const lng      = parseFloat(document.getElementById('inc-lng').value);

  if (!type) { showToast('Select incident type.', 'error'); return; }
  if (!desc) { showToast('Describe the incident.', 'error'); return; }

  const btn = document.getElementById('inc-submit-btn');
  btn.disabled  = true;
  btn.innerText = '⏳ Reporting...';

  const { getAuth } = await import(
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'
  );
  const token = await getAuth().currentUser?.getIdToken();
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
    showDispatchModal(data.incident, data.nearest);
    await loadIncidents();

    // Reset form
    document.getElementById('inc-type').value = '';
    document.getElementById('inc-desc').value = '';
    document.getElementById('inc-address').value = '';

  } catch {
    showToast('Failed to report incident.', 'error');
  } finally {
    btn.disabled  = false;
    btn.innerText = '🚨 Report Incident';
  }
};

// ── DISPATCH MODAL ────────────────────────────────────
function showDispatchModal(incident, nearest) {
  document.getElementById('dispatch-id').innerText = incident.incidentId;

  const respHtml = nearest
    ? `<h4>🚑 Dispatched</h4>
       <b>${nearest.name}</b><br/>
       <span style="color:#64748b; font-size:0.82rem;">
         ${nearest.address}
       </span><br/>
       <span style="color:#f59e0b;">
         📞 ${nearest.phone}
       </span><br/>
       <span style="color:#94a3b8; font-size:0.78rem;">
         Distance: ${nearest.distance?.toFixed(2)} km away
       </span>`
    : '<p style="color:#64748b;">No responder available nearby.</p>';

  document.getElementById('dispatch-responder').innerHTML = respHtml;
  document.getElementById('dispatch-modal').classList.add('open');
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
    <div class="incident-card ${inc.status}"
      onclick="focusIncident(${inc.location.coordinates.lat},
               ${inc.location.coordinates.lng})">
      <div class="incident-top">
        <span class="inc-type" style="color:${severityColor(inc.severity)}">
          ${typeIcon[inc.type] || '📦'} ${inc.type}
        </span>
        <span class="inc-severity sev-${inc.severity}">
          ${inc.severity}
        </span>
      </div>
      <div class="inc-desc">${inc.description}</div>
      <div class="inc-meta">
        📍 ${inc.location?.address || 'Ballari'} &bull;
        ${timeAgo(new Date(inc.createdAt))}
        ${inc.assignedTo
          ? `<br/>🚑 ${inc.assignedTo}`
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
               🚑 ${inc.assignedTo}
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
async function loadContacts() {
  try {
    const res  = await fetch(`${BACKEND}/api/emergency/responders`);
    allContacts = await res.json();
    renderContacts(allContacts);
    renderResponderMarkers(allContacts);
  } catch {
    document.getElementById('contacts-list').innerHTML =
      '<p style="color:#ef4444;">Could not load contacts.</p>';
  }
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
};

function renderContacts(contacts) {
  const typeIcon = {
    hospital: '🏥', police: '🚔', fire: '🚒'
  };

  document.getElementById('contacts-list').innerHTML =
    contacts.map(c => `
      <div class="contact-card">
        <div class="contact-icon">${typeIcon[c.type] || '📞'}</div>
        <div class="contact-info">
          <div class="contact-name">${c.name}</div>
          <div class="contact-addr">${c.address || ''}</div>
          <div class="contact-dist">📞 ${c.phone}</div>
        </div>
        <a class="call-btn" href="tel:${c.phone}">📞 Call</a>
      </div>
    `).join('');
}

// ── RESPONDER MAP MARKERS ─────────────────────────────
function renderResponderMarkers(responders) {
  responderMarkers.forEach(m => map.removeLayer(m));
  responderMarkers = [];

  const typeIcon  = { hospital: '🏥', police: '🚔', fire: '🚒' };
  const typeColor = { hospital: '#22c55e', police: '#38bdf8', fire: '#f59e0b' };

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
        <a href="tel:${r.phone}"
          style="color:#22c55e; font-weight:bold;">
          📞 ${r.phone}
        </a>
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

// Override map click when on AI tab
map.on('click', (e) => {
  // Always update AI lat/lng
  aiLat = e.latlng.lat;
  aiLng = e.latlng.lng;
  document.getElementById('ai-lat').innerText = aiLat.toFixed(5);
  document.getElementById('ai-lng').innerText = aiLng.toFixed(5);

  // Show pin
  if (aiPinMarker) map.removeLayer(aiPinMarker);
  aiPinMarker = L.circleMarker([aiLat, aiLng], {
    radius: 12, fillColor: '#7c3aed',
    color: '#0f172a', fillOpacity: 0.85, weight: 2
  }).addTo(map).bindTooltip('📍 Incident Point', { permanent: false });

  // Also update report form location
  document.getElementById('inc-lat').value     = aiLat;
  document.getElementById('inc-lng').value     = aiLng;
  document.getElementById('inc-address').value =
    `${aiLat.toFixed(5)}, ${aiLng.toFixed(5)}`;
});

window.runDispatchSim = async () => {
  if (!aiLat || !aiLng) {
    showToast('Click on the map to set incident location.', 'warning');
    return;
  }

  const type     = document.getElementById('ai-type').value;
  const severity = document.getElementById('ai-severity').value;

  const resultsEl = document.getElementById('ai-results');
  resultsEl.innerHTML =
    '<p style="color:#64748b; text-align:center; padding:1rem;">⏳ Running AI dispatch...</p>';

  try {
    const res  = await fetch(
      `${BACKEND}/api/emergency/simulate-dispatch` +
      `?lat=${aiLat}&lng=${aiLng}&type=${type}&severity=${severity}`
    );
    const data = await res.json();
    renderDispatchResults(data.dispatched);
    drawDispatchLines(data.dispatched);
  } catch {
    resultsEl.innerHTML =
      '<p style="color:#ef4444; text-align:center;">Dispatch failed.</p>';
  }
};

function renderDispatchResults(dispatched) {
  const el = document.getElementById('ai-results');

  if (!dispatched.length) {
    el.innerHTML =
      '<p style="color:#ef4444; text-align:center; padding:1rem;">No available responders.</p>';
    return;
  }

  const typeIcon  = { hospital: '🏥', police: '🚔', fire: '🚒' };
  const typeColor = { hospital: '#22c55e', police: '#38bdf8', fire: '#f59e0b' };

  el.innerHTML = `
    <p style="color:#94a3b8; font-size:0.78rem; margin-bottom:0.8rem;">
      ${dispatched.length} responder(s) identified:
    </p>
    ${dispatched.map((d, i) => `
      <div style="background:#0f172a; border-radius:10px;
                  padding:0.85rem 1rem; margin-bottom:0.6rem;
                  border-left:3px solid ${typeColor[d.type] || '#334155'};">
        <div style="display:flex; justify-content:space-between;
                    align-items:center; margin-bottom:0.3rem;">
          <span style="font-weight:bold; font-size:0.88rem;">
            ${typeIcon[d.type]} ${d.name}
          </span>
          <span style="font-size:0.72rem; background:#1e293b;
                       padding:0.15rem 0.5rem; border-radius:999px;
                       color:#94a3b8;">
            #${i + 1}
          </span>
        </div>
        <div style="font-size:0.78rem; color:#64748b; margin-bottom:0.5rem;">
          ${d.address || ''}
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr;
                    gap:0.4rem; font-size:0.78rem;">
          <div style="background:#1e293b; border-radius:6px;
                      padding:0.4rem; text-align:center;">
            <div style="color:#38bdf8; font-weight:bold;">
              ${d.distance} km
            </div>
            <div style="color:#64748b;">Distance</div>
          </div>
          <div style="background:#1e293b; border-radius:6px;
                      padding:0.4rem; text-align:center;">
            <div style="color:#f59e0b; font-weight:bold;">${d.eta}</div>
            <div style="color:#64748b;">ETA</div>
          </div>
          <div style="background:#1e293b; border-radius:6px;
                      padding:0.4rem; text-align:center;">
            <div style="color:#a78bfa; font-weight:bold;">
              ${d.score}
            </div>
            <div style="color:#64748b;">Score</div>
          </div>
        </div>
        <div style="margin-top:0.5rem; font-size:0.75rem; color:#64748b;">
          Load: ${d.currentLoad}/${d.capacity} &nbsp;|&nbsp;
          📞 ${d.phone}
        </div>
      </div>
    `).join('')}

    <div style="margin-top:0.8rem; background:#0f172a;
                border-radius:8px; padding:0.7rem;
                border:1px dashed #334155; font-size:0.75rem;
                color:#475569;">
      <b style="color:#7c3aed;">🧠 ML Upgrade Path</b><br/>
      Current: Haversine distance + load penalty scoring<br/>
      Future: k-NN trained on ${
        Math.floor(Math.random() * 500) + 100
      } historical dispatches
    </div>
  `;
}

// ── DRAW LINES FROM INCIDENT TO RESPONDERS ─────────────
function drawDispatchLines(dispatched) {
  // Clear old lines
  aiResultMarkers.forEach(m => map.removeLayer(m));
  aiResultMarkers = [];

  const typeColor = {
    hospital: '#22c55e', police: '#38bdf8', fire: '#f59e0b'
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