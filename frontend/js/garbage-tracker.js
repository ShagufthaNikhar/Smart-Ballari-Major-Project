const BACKEND = window.SB_API;

let map;
let markers = [];
let pollTimer = null;
let searchMode = 'ward';   // 'ward' | 'area'
let currentQuery = null;   // ward number or area name, depending on mode

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([loadWards(), loadAreas()]);
});

async function loadWards() {
  try {
    const res = await fetch(`${BACKEND}/api/garbage-tracker/wards`);
    const wards = await res.json();
    const select = document.getElementById('gt-ward-select');
    select.innerHTML = '<option value="">Select your ward…</option>' +
      wards.map(w => `<option value="${w}">Ward ${w}</option>`).join('');
  } catch {
    // leave the placeholder option in place
  }
}

async function loadAreas() {
  try {
    const res = await fetch(`${BACKEND}/api/garbage-tracker/areas`);
    const areas = await res.json();
    const list = document.getElementById('gt-area-list');
    list.innerHTML = areas.map(a => `<option value="${escapeHtml(a.area)}"></option>`).join('');
  } catch {
    // leave the datalist empty — the input still works as free text,
    // it just won't offer suggestions
  }
}

window.setSearchMode = (mode) => {
  searchMode = mode;
  document.getElementById('gt-mode-ward').classList.toggle('active', mode === 'ward');
  document.getElementById('gt-mode-area').classList.toggle('active', mode === 'area');
  document.getElementById('gt-search-ward').style.display = mode === 'ward' ? 'flex' : 'none';
  document.getElementById('gt-search-area').style.display = mode === 'area' ? 'flex' : 'none';
};

function initMapIfNeeded() {
  if (map) return;
  document.getElementById('gt-map').style.display = 'block';
  map = L.map('gt-map').setView([15.1394, 76.9214], 13);
  L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Tiles &copy; Esri', maxZoom: 19, maxNativeZoom: 16 }
  ).addTo(map);
}

const STATUS_LABEL = {
  not_started:    'Not started yet',
  en_route:       'On the way',
  servicing_now:  'Currently here',
  departed:       'Already completed for today',
  not_on_route:   'Does not serve this area today',
  no_route:       'No route data for this truck'
};

window.searchWard = async () => {
  const wardVal = document.getElementById('gt-ward-select').value;
  if (!wardVal) return;
  searchMode = 'ward';
  currentQuery = wardVal;

  if (pollTimer) clearInterval(pollTimer);
  await fetchAndRender();
  pollTimer = setInterval(fetchAndRender, 20000);
};

window.searchArea = async () => {
  const areaVal = document.getElementById('gt-area-input').value.trim();
  if (!areaVal) return;
  searchMode = 'area';
  currentQuery = areaVal;

  if (pollTimer) clearInterval(pollTimer);
  await fetchAndRender();
  pollTimer = setInterval(fetchAndRender, 20000);
};

async function fetchAndRender() {
  const results = document.getElementById('gt-results');
  try {
    const url = searchMode === 'ward'
      ? `${BACKEND}/api/garbage-tracker/ward/${encodeURIComponent(currentQuery)}`
      : `${BACKEND}/api/garbage-tracker/search?area=${encodeURIComponent(currentQuery)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.trucks.length) {
      const label = searchMode === 'ward' ? `Ward ${currentQuery}` : `"${currentQuery}"`;
      results.innerHTML = `<div class="gt-empty">No garbage truck is currently assigned to ${escapeHtml(label)}.</div>`;
      document.getElementById('gt-disclaimer').style.display = 'none';
      return;
    }

    document.getElementById('gt-disclaimer').style.display = 'block';
    renderTrucks(data.trucks);
    renderMap(data.trucks);
  } catch {
    results.innerHTML = `<div class="gt-empty" style="color:#ef4444;">Could not load truck status.</div>`;
  }
}

function renderTrucks(trucks) {
  const results = document.getElementById('gt-results');

  results.innerHTML = trucks.map(t => {
    const label = STATUS_LABEL[t.status] || t.status;
    let detail = '';

    if (t.status === 'en_route' || t.status === 'not_started') {
      detail = t.etaMinutes != null
        ? `Arriving in about ${t.etaMinutes} minute${t.etaMinutes === 1 ? '' : 's'}`
        : (t.startsAt ? `Starts its route at ${t.startsAt}` : '');
    } else if (t.status === 'servicing_now') {
      detail = t.minutesRemaining != null
        ? `Expected to be here for about ${t.minutesRemaining} more minute${t.minutesRemaining === 1 ? '' : 's'}`
        : '';
    } else if (t.status === 'departed') {
      detail = 'Next collection is tomorrow.';
    }

    return `
      <div class="gt-truck-card status-${t.status}">
        <div class="gt-truck-top">
          <div>
            <div class="gt-truck-name">🚛 ${escapeHtml(t.vehicleModel || t.name)}</div>
            <div class="gt-truck-sub">${escapeHtml(t.vehicleNo || '')} · ${escapeHtml(t.division || '')}
              ${t.wetDrySegregation ? ' · Wet/Dry segregated' : ''}</div>
            ${searchMode === 'area' && t.ward != null
              ? `<div class="gt-truck-sub">📍 Ward ${t.ward}${t.area ? ' · ' + escapeHtml(t.area) : ''}</div>`
              : ''}
            ${t.driverName ? `<div class="gt-truck-sub">👤 ${escapeHtml(t.driverName)}${
              t.driverMobile ? ` · <a href="tel:${escapeHtml(t.driverMobile)}" style="color:#38bdf8; text-decoration:none;">📞 ${escapeHtml(t.driverMobile)}</a>` : ''
            }</div>` : ''}
          </div>
        </div>
        <div class="gt-status-text ${t.status}">${label}</div>
        ${detail ? `<div class="gt-status-detail">${detail}</div>` : ''}
        ${searchMode === 'ward' && Array.isArray(t.stopsInWard) && t.stopsInWard.length
          ? `<div class="gt-areas-list">
              <div class="gt-areas-label">Stops in this ward:</div>
              ${t.stopsInWard.map(a => `<div class="gt-area-item">📍 ${escapeHtml(a)}</div>`).join('')}
            </div>`
          : ''}
      </div>`;
  }).join('');
}

function renderMap(trucks) {
  initMapIfNeeded();
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  const withPos = trucks.filter(t => t.currentPosition?.lat != null);
  if (!withPos.length) return;

  withPos.forEach(t => {
    const color = t.status === 'servicing_now' ? '#22c55e'
                : t.status === 'departed' ? '#64748b'
                : '#38bdf8';
    const marker = L.marker([t.currentPosition.lat, t.currentPosition.lng], {
      icon: L.divIcon({
        className: '',
        html: `<div style="background:${color}; border-radius:50%; width:30px; height:30px;
                    display:flex; align-items:center; justify-content:center; font-size:15px;
                    border:2px solid #0f172a; box-shadow:0 2px 8px rgba(0,0,0,0.4);">🚛</div>`,
        iconSize: [30, 30], iconAnchor: [15, 15]
      })
    }).addTo(map).bindPopup(`<b>${escapeHtml(t.vehicleModel || t.name)}</b><br/>${STATUS_LABEL[t.status] || t.status}`);
    markers.push(marker);
  });

  map.fitBounds(withPos.map(t => [t.currentPosition.lat, t.currentPosition.lng]), {
    padding: [60, 60], maxZoom: 15
  });
}

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}