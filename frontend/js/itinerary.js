// ===================================================================
//  Plan a Trip — the Explore module's itinerary builder
//
//  Every stop shown here is a real record from the database. The server
//  hands the model a fixed candidate list and validates every id it returns,
//  so nothing on this page is an invented attraction. The badge above the
//  plan says whether the AI or the rules planner produced it — worth being
//  honest about rather than implying AI when the fallback ran.
// ===================================================================
'use strict';

const IT_API = window.SB_API;

let plan = null;          // the full response from /api/explore/plan
let activeDay = 0;
let itMap = null;
let routeLayer = null;

document.addEventListener('DOMContentLoaded', init);

function esc(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}

async function init() {
  // towns come from the server so the list can never drift from the planner's
  try {
    const res = await fetch(`${IT_API}/api/explore/towns`);
    const towns = await res.json();
    document.getElementById('f-town').innerHTML = towns
      .map(t => `<option value="${esc(t.name)}"${t.name === 'Ballari' ? ' selected' : ''}>${esc(t.name)}</option>`)
      .join('');
  } catch {
    document.getElementById('f-town').innerHTML = '<option>Ballari</option>';
  }

  // segmented controls
  document.querySelectorAll('.seg').forEach(seg => {
    seg.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      seg.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
    });
  });

  // interest chips toggle freely; at least one must stay on
  document.getElementById('f-interests').addEventListener('click', e => {
    const c = e.target.closest('.chip');
    if (!c) return;
    const on = document.querySelectorAll('#f-interests .chip.on');
    if (c.classList.contains('on') && on.length === 1) return;
    c.classList.toggle('on');
  });
}

const segValue = id => document.querySelector(`#${id} button.on`)?.dataset.v;

// ── GENERATE ──────────────────────────────────────────
window.generate = async () => {
  const btn = document.getElementById('go');
  btn.disabled = true;
  btn.textContent = 'Building…';

  const body = {
    days:       Number(document.getElementById('f-days').value),
    startTown:  document.getElementById('f-town').value,
    travelWith: segValue('f-with'),
    pace:       segValue('f-pace'),
    interests:  [...document.querySelectorAll('#f-interests .chip.on')].map(c => c.dataset.v)
  };

  try {
    const res  = await fetch(`${IT_API}/api/explore/plan`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not build an itinerary.');

    plan = data;
    activeDay = 0;
    render();
  } catch (err) {
    document.getElementById('result').innerHTML =
      `<div class="empty"><h3>Couldn't build that trip</h3><p>${esc(err.message)}</p></div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Build my itinerary';
  }
};

// ── RENDER ────────────────────────────────────────────
function render() {
  const stops = plan.plan.reduce((n, d) => n + d.stops.length, 0);
  const badge = plan.generatedBy === 'ai'
    ? `<span class="badge ai">AI-planned</span>`
    : `<span class="badge rules">Rule-based plan</span>`;

  document.getElementById('result').innerHTML = `
    <div class="result-head">
      <div>
        <h3 style="font-size:1.05rem;">${esc(plan.title)}</h3>
        <div style="color:#64748b; font-size:0.78rem; margin-top:0.15rem;">
          ${plan.plan.length} day${plan.plan.length > 1 ? 's' : ''} ·
          ${stops} stops · ${esc(plan.pace)} pace
        </div>
      </div>
      <div style="display:flex; gap:0.4rem; align-items:center; flex-wrap:wrap;">
        ${badge}
        <button class="mini" onclick="saveTrip()">💾 Save</button>
        <button class="mini" onclick="printPlan()">🖨 Print</button>
      </div>
    </div>

    <div class="daytabs" id="daytabs">
      ${plan.plan.map((d, i) => `
        <button class="daytab ${i === 0 ? 'on' : ''}" onclick="showDay(${i})">
          Day ${d.day} · ${esc(d.baseTown)}
        </button>`).join('')}
    </div>

    <div id="route-map"></div>
    <div id="day-body"></div>

    <div class="attrib">
      ${esc(plan.attribution)}<br/>
      Visit times are estimates. Opening hours and ticket prices are not included —
      check locally before travelling.
    </div>`;

  initMap();
  showDay(0);
}

window.showDay = (i) => {
  activeDay = i;
  document.querySelectorAll('.daytab').forEach((t, k) => t.classList.toggle('on', k === i));

  const d = plan.plan[i];
  document.getElementById('day-body').innerHTML = `
    ${d.travelNote ? `<div class="travel-note">🚗 ${esc(d.travelNote)}</div>` : ''}
    <div class="tl">
      ${d.stops.map(s => {
        const maps = `https://www.google.com/maps/search/?api=1&query=${s.location?.lat},${s.location?.lng}`;
        return `
        <div class="stop ${s.kind === 'monument' ? 'mon' : ''}">
          <div class="stop-top">
            <div>
              <div class="stop-name">${esc(s.name)}</div>
              <div class="stop-meta">
                ${esc(s.town)} · ${esc(s.category)} · about ${s.visitMinutes} min
                ${s.kind === 'monument' ? ' · <span style="color:#a78bfa;">heritage site</span>' : ''}
              </div>
            </div>
            ${s.startTime ? `<span class="stop-time">${esc(s.startTime)}</span>` : ''}
          </div>
          ${s.note ? `<div class="stop-note">${esc(s.note)}</div>` : ''}
          <div class="stop-acts">
            <a class="mini" href="${maps}" target="_blank" rel="noopener">🗺 Directions</a>
            ${s.slug ? `<a class="mini ar" href="ar.html?site=${encodeURIComponent(s.slug)}">📱 View in AR</a>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;

  drawRoute(d);
};

// ── MAP ───────────────────────────────────────────────
function initMap() {
  if (itMap) { itMap.remove(); itMap = null; }
  itMap = L.map('route-map').setView([15.25, 76.65], 9);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors', maxZoom: 19
  }).addTo(itMap);
}

function drawRoute(day) {
  if (!itMap) return;
  if (routeLayer) itMap.removeLayer(routeLayer);
  routeLayer = L.layerGroup().addTo(itMap);

  const pts = [];
  day.stops.forEach((s, i) => {
    if (!s.location?.lat) return;
    const p = [s.location.lat, s.location.lng];
    pts.push(p);
    L.marker(p, {
      icon: L.divIcon({
        className: '',
        html: `<div style="width:24px;height:24px;border-radius:50%;
                 background:${s.kind === 'monument' ? '#a78bfa' : '#f59e0b'};
                 color:#0f172a;font-weight:700;font-size:12px;
                 display:grid;place-items:center;border:2px solid #0f172a;">${i + 1}</div>`,
        iconSize: [24, 24], iconAnchor: [12, 12]
      })
    }).addTo(routeLayer).bindPopup(`<b>${esc(s.name)}</b><br/>${esc(s.startTime || '')}`);
  });

  if (pts.length > 1) {
    L.polyline(pts, { color: '#f59e0b', weight: 2, dashArray: '5,6', opacity: 0.8 })
      .addTo(routeLayer);
  }
  if (pts.length) itMap.fitBounds(pts, { padding: [36, 36], maxZoom: 14 });
}

// ── SAVE ──────────────────────────────────────────────
window.saveTrip = async () => {
  if (!plan) return;
  try {
    const { auth } = await import('./firebase-config.js');
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      showToast?.('Sign in to save this trip.', 'warning');
      return;
    }
    const res = await fetch(`${IT_API}/api/explore/trips`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body:    JSON.stringify(plan)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save.');
    showToast?.('Trip saved', 'success');
  } catch (err) {
    showToast?.(err.message, 'error');
  }
};

// ── PRINT ─────────────────────────────────────────────
// A printed plan is genuinely useful on a trip where signal is patchy —
// Kishkinda and parts of Sandur have none.
window.printPlan = () => {
  if (!plan) return;
  const w = window.open('', '_blank', 'width=820,height=1000');
  if (!w) return showToast?.('Allow pop-ups to print.', 'warning');

  w.document.write(`
    <html><head><title>${esc(plan.title)}</title><style>
      body { font-family: system-ui, sans-serif; padding: 36px; color: #0f172a; }
      h1 { font-size: 22px; margin: 0 0 2px; }
      .sub { color: #64748b; font-size: 13px; margin-bottom: 22px; }
      h2 { font-size: 15px; margin: 22px 0 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
      .s { margin: 0 0 10px; padding-left: 62px; position: relative; font-size: 13px; }
      .t { position: absolute; left: 0; font-weight: 700; color: #b45309; }
      .m { color: #64748b; font-size: 11.5px; }
      .n { color: #334155; font-size: 12px; margin-top: 2px; }
      .f { margin-top: 28px; font-size: 10.5px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
    </style></head><body>
      <h1>${esc(plan.title)}</h1>
      <div class="sub">Smart Ballari · ${esc(plan.pace)} pace · ${esc(plan.travelWith)}</div>
      ${plan.plan.map(d => `
        <h2>Day ${d.day} — ${esc(d.baseTown)}</h2>
        ${d.travelNote ? `<div class="m" style="margin-bottom:8px;">${esc(d.travelNote)}</div>` : ''}
        ${d.stops.map(s => `
          <div class="s">
            <span class="t">${esc(s.startTime || '')}</span>
            <b>${esc(s.name)}</b>
            <div class="m">${esc(s.town)} · about ${s.visitMinutes} min</div>
            ${s.note ? `<div class="n">${esc(s.note)}</div>` : ''}
          </div>`).join('')}
      `).join('')}
      <div class="f">${esc(plan.attribution)}<br/>
        Times are estimates. Check opening hours and ticket prices locally.</div>
    </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
};