const BACKEND = window.SB_API;
const BALLARI = [15.1394, 76.9214];

let map;
let sites        = [];
let siteMarkers  = new Map();
let activeSite   = null;
let monuments    = [];      // /api/heritage/monuments — carries slug + hasModel
let activeSlug   = null;
let userLat      = null;
let userLng      = null;

// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initMap();
  await loadSites();
  detectUserLocation();
});

// ── MAP ───────────────────────────────────────────────
function initMap() {
  map = L.map('heritage-map').setView(BALLARI, 10);

  L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }
  ).addTo(map);
}

// ── LOAD SITES ────────────────────────────────────────
async function loadSites() {
  try {
    // /monuments is the AR module's record: it carries the slug the QR code
    // needs, plus hasModel/hasAudio. /sites stays the map's source so the
    // existing marker and popup code is untouched.
    const [sRes, mRes] = await Promise.all([
      fetch(`${BACKEND}/api/heritage/sites`),
      fetch(`${BACKEND}/api/heritage/monuments`)
    ]);
    sites = await sRes.json();
    monuments = mRes.ok ? await mRes.json() : [];
    renderMonumentList();
    renderSiteMarkers(sites);
  } catch {
    document.getElementById('site-list').innerHTML =
      '<p style="color:#ef4444; padding:1rem;">Could not load sites.</p>';
  }
}

// ── MONUMENT CARDS ────────────────────────────────────
const TYPE_CFG = {
  fort:      { color: '#ef4444', label: 'Fort',      icon: '\u{1F3F0}' },
  temple:    { color: '#f59e0b', label: 'Temple',    icon: '\u{1F6D5}' },
  monument:  { color: '#38bdf8', label: 'Monument',  icon: '\u{1F5FF}' },
  sanctuary: { color: '#22c55e', label: 'Sanctuary', icon: '\u{1F43B}' }
};

window.filterMonuments = () => renderMonumentList();

function renderMonumentList() {
  const q = (document.getElementById('mon-search')?.value || '')
              .trim().toLowerCase();

  const list = monuments.filter(m =>
    !q ||
    m.name.toLowerCase().includes(q) ||
    (m.shortDescription || '').toLowerCase().includes(q) ||
    (m.period || '').toLowerCase().includes(q));

  const box = document.getElementById('site-list');

  if (!monuments.length) {
    box.innerHTML = '<p style="color:#64748b; padding:1rem; font-size:0.85rem;">' +
                    'No monuments available.</p>';
    return;
  }
  if (!list.length) {
    box.innerHTML = `<p style="color:#64748b; padding:1rem; font-size:0.85rem;">` +
                    `No monument matches \u201c${esc(q)}\u201d.</p>`;
    return;
  }

  box.innerHTML = list.map(m => {
    const cfg = TYPE_CFG[m.type] || { color: '#94a3b8', label: 'Site', icon: '\u{1F5FF}' };
    const thumb = m.posterUrl
      ? `<img class="mon-thumb" src="${esc(m.posterUrl)}" alt="" loading="lazy" />`
      : `<div class="mon-thumb">${cfg.icon}</div>`;
    return `
      <div class="mon-card" id="card-${esc(m.slug)}" onclick="selectMonument('${esc(m.slug)}')">
        ${thumb}
        <div class="mon-body">
          <b>${esc(m.name)}</b>
          <small>${esc(m.shortDescription || m.period || '')}</small>
          <div class="mon-tags">
            <span class="mon-tag" style="color:${cfg.color}; border-color:${cfg.color}55;">
              ${cfg.label}</span>
            ${m.period ? `<span class="mon-tag">${esc(m.period)}</span>` : ''}
            ${m.hasModel ? '<span class="mon-tag ar">AR ready</span>' : ''}
            ${m.hasAudio ? '<span class="mon-tag">\u{1F399} Audio</span>' : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

function esc(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}

// ── SELECT ────────────────────────────────────────────
window.selectMonument = (slug) => {
  const m = monuments.find(x => x.slug === slug);
  if (!m) return;
  activeSlug = slug;

  document.querySelectorAll('.mon-card').forEach(c => c.classList.remove('active'));
  document.getElementById(`card-${slug}`)?.classList.add('active');

  // keep the existing map behaviour working: /sites uses `id`, not `slug`
  const site = sites.find(s => s.id === slug);
  if (site) { activeSite = site; flyToSite(slug); showDetails(slug); }
  else {
    document.getElementById('dp-title').innerText = m.name;
    document.getElementById('dp-desc').innerText  = m.shortDescription || '';
    document.getElementById('dp-facts').innerHTML = '';
    document.getElementById('detail-panel').classList.add('open');
  }

  const btn = document.getElementById('explore-btn');
  btn.disabled    = !m.hasModel;
  btn.textContent = m.hasModel ? '\u{1F4F1} Explore in AR'
                               : 'No 3D model for this monument yet';

  buildQR(slug, m.name);
};

// ── QR CODE ───────────────────────────────────────────
// The QR only ever encodes a public monument URL. No token, no id, no admin
// route — a printed poster is the least controllable surface in the project.
function arUrlFor(slug) {
  return new URL(`ar.html?site=${encodeURIComponent(slug)}`, location.href).href;
}

function buildQR(slug, name) {
  const panel = document.getElementById('qr-panel');
  const box   = document.getElementById('qr-box');
  const url   = arUrlFor(slug);

  box.innerHTML = '';
  if (typeof QRCode === 'undefined') {
    panel.style.display = 'none';
    return;                       // library blocked — the button still works
  }
  new QRCode(box, {
    text: url, width: 148, height: 148,
    colorDark: '#0f172a', colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });
  document.getElementById('qr-url').textContent = url;
  panel.style.display = '';
}

window.copyARLink = async () => {
  if (!activeSlug) return;
  try {
    await navigator.clipboard.writeText(arUrlFor(activeSlug));
    showToast?.('AR link copied', 'success');
  } catch { showToast?.('Could not copy link', 'error'); }
};

// Printable poster for the demo table.
window.printPoster = () => {
  if (!activeSlug) return;
  const m   = monuments.find(x => x.slug === activeSlug);
  const img = document.querySelector('#qr-box img, #qr-box canvas');
  if (!img) return showToast?.('QR not ready yet', 'warning');

  const src = img.tagName === 'IMG' ? img.src : img.toDataURL();
  const w = window.open('', '_blank', 'width=760,height=980');
  if (!w) return showToast?.('Allow pop-ups to print the poster', 'warning');

  w.document.write(`
    <html><head><title>${esc(m.name)} — Smart Ballari AR</title>
    <style>
      body { font-family: system-ui, sans-serif; text-align:center;
             padding:48px 32px; color:#0f172a; }
      h1 { font-size:30px; margin:0 0 4px; }
      h2 { font-size:15px; font-weight:500; color:#64748b; margin:0 0 28px; }
      img { width:290px; height:290px; }
      ol { display:inline-block; text-align:left; margin:26px auto 0;
           font-size:14px; line-height:1.9; color:#334155; }
      .u { font-size:11px; color:#94a3b8; margin-top:22px; word-break:break-all; }
      .b { margin-top:30px; font-size:12px; color:#94a3b8; }
    </style></head><body>
      <h1>${esc(m.name)}</h1>
      <h2>Smart Ballari \u00b7 Heritage AR</h2>
      <img src="${src}" alt="QR code" />
      <ol>
        <li>Scan this code with your phone camera</li>
        <li>Allow camera access</li>
        <li>Point at a table or the floor</li>
        <li>Tap to place the monument</li>
        <li>Walk around it and explore the history</li>
      </ol>
      <div class="u">${esc(arUrlFor(activeSlug))}</div>
      <div class="b">No app installation required</div>
    </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
};

function renderSiteMarkers(sites) {
  const typeIcon = {
    fort:      '🏰', temple:    '🛕',
    monument:  '🗿', sanctuary: '🌿'
  };

  const typeColor = {
    fort:      '#ef4444', temple:    '#f59e0b',
    monument:  '#38bdf8', sanctuary: '#22c55e'
  };

  sites.forEach(site => {
    const color = typeColor[site.type] || '#94a3b8';
    const icon  = typeIcon[site.type]  || '📍';

    const marker = L.marker(
      [site.location.lat, site.location.lng],
      {
        icon: L.divIcon({
          className: '',
          html: `
            <div style="
              background:${color}22;
              border:2px solid ${color};
              border-radius:50%;
              width:44px; height:44px;
              display:flex; align-items:center;
              justify-content:center;
              font-size:22px;
              box-shadow:0 2px 8px rgba(0,0,0,0.4);
              cursor:pointer;
            ">${icon}</div>
          `,
          iconSize:   [44, 44],
          iconAnchor: [22, 22]
        })
      }
    ).addTo(map);

    marker.bindPopup(buildSitePopup(site));
    marker.on('click', () => selectSite(site.id));
    siteMarkers.set(site.id, marker);
  });
}

function buildSitePopup(site) {
  return `
    <div style="min-width:200px; font-family:sans-serif;">
      <b style="color:#f59e0b;">${site.name}</b><br/>
      <span style="color:#94a3b8; font-size:0.8rem;">
        ${site.nameKannada}
      </span><br/>
      <hr style="border-color:#334155; margin:6px 0;"/>
      <p style="font-size:0.8rem; color:#cbd5e1; margin:4px 0;">
        ${esc((site.description || '').slice(0, 100))}\u2026
      </p>
      <div style="display:flex; gap:6px; margin-top:8px;">
        <button onclick="launchARForSite('${site.id}')"
          style="flex:1; padding:4px 8px; background:#f59e0b;
                 color:#0f172a; border:none; border-radius:6px;
                 cursor:pointer; font-size:0.75rem; font-weight:bold;">
          📷 AR View
        </button>
        <button onclick="showDetails('${site.id}')"
          style="flex:1; padding:4px 8px; background:#334155;
                 color:#f1f5f9; border:none; border-radius:6px;
                 cursor:pointer; font-size:0.75rem;">
          ℹ️ Info
        </button>
      </div>
    </div>
  `;
}

// ── SELECT SITE ───────────────────────────────────────
// Map markers and popups still call selectSite(id). The site `id` and the
// monument `slug` are the same string, so route it through selectMonument
// instead of duplicating the card/QR logic — otherwise clicking a map pin
// would leave the AR button disabled and no QR generated.
window.selectSite = (id) => {
  if (monuments.some(m => m.slug === id)) return selectMonument(id);

  // monument record missing (e.g. seeding not finished) - map still works
  activeSite = sites.find(s => s.id === id);
  if (!activeSite) return;
  flyToSite(id);
  showDetails(id);
};

window.flyToSite = (id) => {
  const site = sites.find(s => s.id === id);
  if (!site) return;
  map.flyTo([site.location.lat, site.location.lng], 16, {
    duration: 1.5
  });
  siteMarkers.get(id)?.openPopup();
};

// ── DETAIL PANEL ──────────────────────────────────────
window.showDetails = (id) => {
  const site = sites.find(s => s.id === id);
  if (!site) return;

  document.getElementById('dp-title').innerText =
    `${site.name} (${site.period})`;
  document.getElementById('dp-desc').innerText = site.description || '';
  document.getElementById('dp-facts').innerHTML =
    (site.facts || []).map(f => `<li>${esc(f)}</li>`).join('');

  document.getElementById('detail-panel').classList.add('open');
};

// ── USER LOCATION ─────────────────────────────────────
function detectUserLocation() {
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      userLat = coords.latitude;
      userLng = coords.longitude;

      // User dot
      L.circleMarker([userLat, userLng], {
        radius: 8, fillColor: '#38bdf8',
        color: '#0f172a', fillOpacity: 1, weight: 2
      }).addTo(map).bindTooltip('📍 You');

      // Find nearest
      findNearest(userLat, userLng);
    },
    () => { /* silent fail */ }
  );
}

async function findNearest(lat, lng) {
  try {
    const res  = await fetch(
      `${BACKEND}/api/heritage/nearest?lat=${lat}&lng=${lng}&radius=200`
    );
    const data = await res.json();
    if (!data.length) return;

    const nearest = data[0];
    document.getElementById('dist-badge').style.display = 'block';
    document.getElementById('nearest-name').innerText   = nearest.name;
    document.getElementById('nearest-dist').innerText   =
      `${nearest.distance.toFixed(1)} km away`;
  } catch { /* silent */ }
}

// ── AR LAUNCHER ───────────────────────────────────────
// ── LAUNCH AR ─────────────────────────────────────────
// One AR path now. The old launchARForSite / launchGPSAR / launchMarkerAR
// all opened ar-view.html (AR.js), which needs either a printed Hiro marker
// or for you to be standing at the monument — the exact thing this module is
// meant to avoid. ar.html is markerless: place it on any table.
window.launchAR = () => {
  const slug = activeSlug || (activeSite && activeSite.id);
  if (!slug) {
    showToast?.('Select a monument first.', 'warning');
    return;
  }
  const m = monuments.find(x => x.slug === slug);
  if (m && !m.hasModel) {
    showToast?.(`${m.name} has no 3D model yet.`, 'warning');
    return;
  }
  window.open(arUrlFor(slug), '_blank');
};