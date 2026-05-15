const BACKEND = 'http://localhost:5000';

let allFood     = [];
let allEvents   = [];
let allSpots    = [];
let map         = null;
let mapMarkers  = [];
let activeMode  = 'food';
let foodTag     = '';
let eventType   = '';
let spotCat     = '';

// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([loadFood(), loadEvents(), loadTourist()]);
});

// ── MODE SWITCHER ─────────────────────────────────────
window.setMode = (mode) => {
  activeMode = mode;

  document.querySelectorAll('.mode-btn').forEach(b =>
    b.classList.remove('active')
  );
  event.target.classList.add('active');

  ['food','events','tourist','map'].forEach(m => {
    document.getElementById(`panel-${m}`).style.display =
      m === mode ? 'block' : 'none';
  });

  if (mode === 'map' && !map) initMap();
};

// ── LOAD FOOD ─────────────────────────────────────────
async function loadFood(tag = '', search = '') {
  try {
    let url = `${BACKEND}/api/lifestyle/food`;
    const p = [];
    if (tag)    p.push(`tag=${encodeURIComponent(tag)}`);
    if (search) p.push(`search=${encodeURIComponent(search)}`);
    if (p.length) url += '?' + p.join('&');

    const res = await fetch(url);
    allFood   = await res.json();
    renderFood(allFood);
  } catch {
    document.getElementById('food-cards').innerHTML =
      '<p style="color:#ef4444;">Could not load food data.</p>';
  }
}

function renderFood(items) {
  document.getElementById('food-cards').innerHTML =
    items.map(r => `
      <div class="food-card">
        <div class="food-card-img">${r.image}</div>
        <div class="food-card-body">
          <div class="food-name">${r.name}</div>
          <div class="food-cuisine">${r.cuisine.join(' · ')}</div>
          <div class="food-specialty">⭐ ${r.specialty}</div>
          <div class="food-meta">
            <span class="food-rating">★ ${r.rating}</span>
            <span class="food-price">${r.priceRange}</span>
            <span class="food-hours">🕐 ${r.hours.split(' – ')[0]}</span>
          </div>
          <div class="must-try">
            ${r.mustTry.map(t =>
              `<span class="must-try-tag">${t}</span>`
            ).join('')}
          </div>
          ${r.phone
            ? `<div style="margin-top:0.5rem; font-size:0.72rem;
                           color:#64748b;">
                 📞 ${r.phone}
               </div>`
            : ''}
          <div style="margin-top:0.6rem; display:flex; gap:0.4rem;">
            <button onclick="openMaps(${r.location.lat},
              ${r.location.lng}, '${r.name}')"
              style="padding:0.3rem 0.7rem; background:#38bdf822;
                     color:#38bdf8; border:1px solid #38bdf8;
                     border-radius:6px; cursor:pointer;
                     font-size:0.72rem;">
              🗺️ Directions
            </button>
            ${r.phone
              ? `<a href="tel:${r.phone}"
                   style="padding:0.3rem 0.7rem; background:#22c55e22;
                          color:#22c55e; border:1px solid #22c55e;
                          border-radius:6px; text-decoration:none;
                          font-size:0.72rem;">
                   📞 Call
                 </a>`
              : ''}
          </div>
        </div>
      </div>
    `).join('') || '<p style="color:#64748b;">No results found.</p>';
}

window.setFoodTag = (tag, el) => {
  foodTag = tag;
  document.querySelectorAll('#panel-food .chip').forEach(c =>
    c.classList.remove('active')
  );
  el.classList.add('active');
  loadFood(tag, document.getElementById('food-search').value);
};

window.filterFood = () => {
  const search = document.getElementById('food-search').value;
  loadFood(foodTag, search);
};

// ── LOAD EVENTS ───────────────────────────────────────
async function loadEvents(type = '') {
  try {
    const url = `${BACKEND}/api/lifestyle/events` +
                (type ? `?type=${type}` : '');
    const res  = await fetch(url);
    allEvents  = await res.json();
    renderEvents(allEvents);
  } catch {}
}

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
      const cfg = typeConfig[e.type] || { color:'#334155', emoji:'📅' };
      return `
        <div class="event-card"
          style="--event-color:${cfg.color};">
          <div class="event-type-badge"
            style="background:${cfg.color}22; color:${cfg.color};">
            ${cfg.emoji} ${e.type}
          </div>
          <div class="event-name">${e.image} ${e.name}</div>
          <div class="event-desc">${e.description}</div>
          <div class="event-detail">
            📅 ${e.startDate}
            ${e.startDate !== e.endDate ? ` – ${e.endDate}` : ''}
          </div>
          <div class="event-detail">🕐 ${e.time}</div>
          <div class="event-detail">📍 ${e.location.name}</div>
          <div class="event-detail">👥 ${e.organizer}</div>
          <div class="event-entry">${e.entry}</div>
          <div style="margin-top:0.6rem; display:flex; gap:0.4rem;">
            <button onclick="openMaps(${e.location.lat},
              ${e.location.lng}, '${e.name}')"
              style="padding:0.3rem 0.7rem; background:${cfg.color}22;
                     color:${cfg.color}; border:1px solid ${cfg.color};
                     border-radius:6px; cursor:pointer;
                     font-size:0.72rem;">
              🗺️ View Location
            </button>
          </div>
        </div>
      `;
    }).join('') ||
    '<p style="color:#64748b;">No events found.</p>';
}

window.setEventType = (type, el) => {
  eventType = type;
  document.querySelectorAll('#panel-events .chip').forEach(c =>
    c.classList.remove('active')
  );
  el.classList.add('active');
  loadEvents(type);
};

// ── LOAD TOURIST ──────────────────────────────────────
async function loadTourist(cat = '') {
  try {
    const res  = await fetch(`${BACKEND}/api/lifestyle/tourist-mode`);
    const data = await res.json();

    allSpots = data.spots;

    // Tips
    document.getElementById('tourist-tips').innerHTML =
      data.tips.map(t =>
        `<div class="tourist-tip">${t}</div>`
      ).join('');

    // Transport info
    document.getElementById('transport-info').innerHTML = `
      <div style="font-size:0.78rem; color:#64748b;
                  display:flex; flex-direction:column; gap:0.3rem;">
        <div>🚌 From Bangalore: ${data.transport.fromBangalore}</div>
        <div>🚌 From Hubli: ${data.transport.fromHubli}</div>
        <div>🛺 Local: ${data.transport.local}</div>
      </div>
    `;

    renderSpots(allSpots);
  } catch {}
}

function renderSpots(spots) {
  document.getElementById('spot-cards').innerHTML =
    spots.map(s => `
      <div class="spot-card">
        <div class="spot-img">
          ${s.image}
          ${s.arAvailable
            ? '<div class="ar-badge">📷 AR</div>'
            : ''}
        </div>
        <div class="spot-body">
          <div class="spot-name">
            ★ ${s.rating} &nbsp; ${s.name}
          </div>
          <div class="spot-dist">📍 ${s.distance}</div>
          <div class="spot-desc">${s.description}</div>
          <div class="spot-meta">
            <div>🕐 ${s.timing}</div>
            <div>🎟️ ${s.entry}</div>
          </div>
          <div class="spot-tip">💡 ${s.tips}</div>
          <div style="display:flex; gap:0.4rem; margin-top:0.6rem;">
            <button onclick="openMaps(${s.location.lat},
              ${s.location.lng}, '${s.name}')"
              class="spot-btn"
              style="background:#f59e0b22; color:#f59e0b;
                     border:1px solid #f59e0b; flex:1;">
              🗺️ Navigate
            </button>
            ${s.arAvailable
              ? `<button onclick="window.open('heritage.html')"
                   class="spot-btn"
                   style="background:#7c3aed22; color:#a78bfa;
                          border:1px solid #7c3aed; flex:1;">
                   📷 AR View
                 </button>`
              : ''}
          </div>
        </div>
      </div>
    `).join('');
}

window.setSpotCategory = (cat, el) => {
  spotCat = cat;
  document.querySelectorAll('#panel-tourist .chip').forEach(c =>
    c.classList.remove('active')
  );
  el.classList.add('active');

  const filtered = cat
    ? allSpots.filter(s => s.category === cat)
    : allSpots;
  renderSpots(filtered);
};

// ── MAP VIEW ──────────────────────────────────────────
function initMap() {
  map = L.map('lifestyle-map').setView([15.1394, 76.9214], 13);
  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    { attribution: '© CartoDB', maxZoom: 19 }
  ).addTo(map);

  setMapLayer('food');
}

window.setMapLayer = (layer, el) => {
  if (el) {
    document.querySelectorAll('#map-filter-chips .chip').forEach(c =>
      c.classList.remove('active')
    );
    el.classList.add('active');
  }

  mapMarkers.forEach(m => map?.removeLayer(m));
  mapMarkers = [];

  const items = layer === 'food'    ? allFood.map(r => ({
      lat: r.location.lat, lng: r.location.lng,
      name: r.name, icon: r.image,
      detail: `${r.specialty} · ★ ${r.rating} · ${r.priceRange}`
    }))
    : layer === 'events' ? allEvents
        .filter(e => e.location.lat)
        .map(e => ({
          lat: e.location.lat, lng: e.location.lng,
          name: e.name, icon: e.image,
          detail: `${e.startDate} · ${e.entry}`
        }))
    : layer === 'tourist' ? allSpots.map(s => ({
        lat: s.location.lat, lng: s.location.lng,
        name: s.name, icon: s.image,
        detail: `${s.distance} · ★ ${s.rating}`
      }))
    : [
        ...allFood.map(r => ({
          lat: r.location.lat, lng: r.location.lng,
          name: r.name, icon: r.image,
          detail: r.specialty
        })),
        ...allSpots.map(s => ({
          lat: s.location.lat, lng: s.location.lng,
          name: s.name, icon: s.image,
          detail: s.distance
        }))
      ];

  items.forEach(item => {
    if (!item.lat || !item.lng) return;
    const marker = L.marker([item.lat, item.lng], {
      icon: L.divIcon({
        className: '',
        html: `<div style="font-size:22px;
          filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));">
          ${item.icon}
        </div>`,
        iconSize:   [26, 26],
        iconAnchor: [13, 13]
      })
    }).addTo(map);

    marker.on('click', () => {
      document.getElementById('map-detail').innerHTML = `
        <div style="font-size:0.85rem;">
          <b>${item.name}</b><br/>
          <span style="color:#64748b; font-size:0.78rem;">
            ${item.detail}
          </span><br/>
          <button onclick="openMaps(${item.lat},${item.lng},
            '${item.name}')"
            style="margin-top:0.5rem; padding:0.3rem 0.7rem;
                   background:#38bdf8; color:#0f172a; border:none;
                   border-radius:6px; cursor:pointer;
                   font-size:0.72rem; font-weight:bold;">
            🗺️ Navigate
          </button>
        </div>
      `;
    });

    mapMarkers.push(marker);
  });
};

// ── HELPERS ───────────────────────────────────────────
window.openMaps = (lat, lng, name) => {
  window.open(
    `https://maps.google.com/?q=${lat},${lng}&label=${encodeURIComponent(name)}`,
    '_blank'
  );
};