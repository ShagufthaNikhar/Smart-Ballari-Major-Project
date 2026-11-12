const BACKEND = window.SB_API;

let allEvents      = [];
let allSpots       = [];
let allAttractions = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadTouristMode();
});

// ── LOAD TOURIST MODE (spots + attractions + events + tips + transport) ──
async function loadTouristMode() {
  try {
    const res  = await fetch(`${BACKEND}/api/lifestyle/tourist-mode`);
    const data = await res.json();

    allSpots       = data.spots;
    allAttractions = data.attractions;
    allEvents      = data.events;

    document.getElementById('tourist-tips').innerHTML =
      data.tips.map(t => `<div class="tourist-tip">${t}</div>`).join('');

    document.getElementById('transport-info').innerHTML = `
      <div style="font-size:0.78rem; color:#64748b;
                  display:flex; flex-direction:column; gap:0.3rem;">
        <div>🚌 From Bangalore: ${data.transport.fromBangalore}</div>
        <div>🚌 From Hubli: ${data.transport.fromHubli}</div>
        <div>🛺 Local: ${data.transport.local}</div>
      </div>
    `;

    renderSpots(allSpots);
    renderAttractions(allAttractions);
    renderEvents(allEvents);
  } catch {
    document.getElementById('spot-cards').innerHTML =
      '<p style="color:#ef4444;">Could not load tourist data.</p>';
    document.getElementById('attraction-cards').innerHTML =
      '<p style="color:#ef4444;">Could not load attractions.</p>';
    document.getElementById('event-cards').innerHTML =
      '<p style="color:#ef4444;">Could not load events.</p>';
  }
}

// ── TOURIST SPOTS ─────────────────────────────────────
function renderSpots(spots) {
  document.getElementById('spot-cards').innerHTML =
    spots.map(s => `
      <div class="spot-card">
        <div class="spot-img">
          ${s.image}
          ${s.arAvailable ? '<div class="ar-badge">📷 AR</div>' : ''}
        </div>
        <div class="spot-body">
          <div class="spot-name">★ ${s.rating} &nbsp; ${s.name}</div>
          <div class="spot-dist">📍 ${s.distance}</div>
          <div class="spot-desc">${s.description}</div>
          <div class="spot-meta">
            <div>🕐 ${s.timing}</div>
            <div>🎟️ ${s.entry}</div>
          </div>
          <div class="spot-tip">💡 ${s.tips}</div>
          <div style="display:flex; gap:0.4rem; margin-top:0.6rem;">
            <button onclick="openMaps(${s.location.lat}, ${s.location.lng}, '${s.name}')"
              class="spot-btn"
              style="background:#f59e0b22; color:#f59e0b; border:1px solid #f59e0b; flex:1;">
              🗺️ Navigate
            </button>
            ${s.arAvailable
              ? `<button onclick="window.open('heritage.html')" class="spot-btn"
                   style="background:#7c3aed22; color:#a78bfa; border:1px solid #7c3aed; flex:1;">
                   📷 AR View
                 </button>`
              : ''}
          </div>
        </div>
      </div>
    `).join('') || '<p style="color:#64748b;">No spots found.</p>';
}

window.setSpotCategory = (cat, el) => {
  el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');

  const filtered = cat ? allSpots.filter(s => s.category === cat) : allSpots;
  renderSpots(filtered);
};

// ── ATTRACTIONS (broader things-to-do list — no coordinates in this
// source, so Directions falls back to an address text search rather than
// a lat/lng pin; see openMaps's fallbackQuery param in app.js) ──────────
function renderAttractions(items) {
  document.getElementById('attraction-cards').innerHTML =
    items.map(a => {
      // Most attractions here have no verified coordinates (see
      // models/Attraction.js) and rely on an address-based maps search.
      // A few — added from a later, coordinate-verified source — do have
      // real lat/lng and get an exact pin instead.
      const directionsCall = a.coordinatesVerified && a.location
        ? `openMaps(${a.location.lat}, ${a.location.lng}, '${a.name.replace(/'/g, "\\'")}')`
        : `openMaps(null, null, '${a.name.replace(/'/g, "\\'")}', '${(a.address || a.name).replace(/'/g, "\\'")}, Ballari, Karnataka')`;

      return `
      <div class="attraction-card">
        <div class="attraction-category-badge">${a.category.replace('_', ' ')}</div>
        <div class="attraction-name">${a.name}</div>
        ${a.rating ? `<div style="color:#f59e0b; font-size:0.78rem; margin-bottom:0.3rem;">★ ${a.rating}${a.reviewCount ? ` (${a.reviewCount})` : ''}</div>` : ''}
        ${a.address ? `<div class="attraction-address">📍 ${a.address}</div>` : ''}
        ${a.openingHours ? `<div class="attraction-address">🕐 ${a.openingHours}</div>` : ''}
        ${a.description ? `<div class="attraction-desc">${a.description}</div>` : ''}
        ${a.verified ? `<div class="attraction-verified">✅ Verified ${a.lastVerified || ''} · ${a.source || ''}</div>` : ''}
        <div style="display:flex; gap:0.4rem; margin-top:0.5rem;">
          <button onclick="${directionsCall}"
            style="padding:0.3rem 0.7rem; background:#38bdf822; color:#38bdf8;
                   border:1px solid #38bdf8; border-radius:6px; cursor:pointer; font-size:0.72rem;">
            🗺️ ${a.coordinatesVerified ? 'Get Directions' : 'Find on Map'}
          </button>
          ${a.phone
            ? `<a href="tel:${a.phone}"
                 style="padding:0.3rem 0.7rem; background:#22c55e22; color:#22c55e;
                        border:1px solid #22c55e; border-radius:6px; text-decoration:none; font-size:0.72rem;">
                 📞 Call
               </a>`
            : ''}
        </div>
      </div>
    `;
    }).join('') || '<p style="color:#64748b;">No results found.</p>';
}

window.setAttractionCategory = (cat, el) => {
  el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');

  const filtered = cat ? allAttractions.filter(a => a.category === cat) : allAttractions;
  renderAttractions(filtered);
};

// ── EVENTS ────────────────────────────────────────────
function renderEvents(events) {
  const typeConfig = {
    cultural: { color: '#7c3aed', emoji: '🎭' },
    festival: { color: '#f59e0b', emoji: '🎉' },
    sports:   { color: '#22c55e', emoji: '🏃' },
    market:   { color: '#38bdf8', emoji: '🛒' },
    business: { color: '#94a3b8', emoji: '💼' }
  };

  document.getElementById('event-cards').innerHTML =
    events.map(e => {
      const cfg = typeConfig[e.type] || { color: '#334155', emoji: '📅' };
      return `
        <div class="event-card" style="--event-color:${cfg.color};">
          <div class="event-type-badge" style="background:${cfg.color}22; color:${cfg.color};">
            ${cfg.emoji} ${e.type}
          </div>
          <div class="event-name">${e.image} ${e.name}</div>
          <div class="event-desc">${e.description}</div>
          <div class="event-detail">
            📅 ${e.startDate}${e.startDate !== e.endDate ? ` – ${e.endDate}` : ''}
          </div>
          <div class="event-detail">🕐 ${e.time}</div>
          <div class="event-detail">📍 ${e.location.name}</div>
          <div class="event-detail">👥 ${e.organizer}</div>
          <div class="event-entry">${e.entry}</div>
          <div style="margin-top:0.6rem; display:flex; gap:0.4rem;">
            <button onclick="openMaps(${e.location.lat}, ${e.location.lng}, '${e.name}')"
              style="padding:0.3rem 0.7rem; background:${cfg.color}22; color:${cfg.color};
                     border:1px solid ${cfg.color}; border-radius:6px; cursor:pointer; font-size:0.72rem;">
              🗺️ View Location
            </button>
          </div>
        </div>
      `;
    }).join('') || '<p style="color:#64748b;">No events found.</p>';
}

window.setEventType = (type, el) => {
  el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');

  const filtered = type ? allEvents.filter(e => e.type === type) : allEvents;
  renderEvents(filtered);
};