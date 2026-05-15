const BACKEND = 'http://localhost:5000';
const role    = localStorage.getItem('userRole');

let map;
let allResources   = [];
let resMarkers     = [];
let hotspotMarkers = [];
let planData       = null;

// ── TYPE CONFIG ───────────────────────────────────────
const TYPE_CFG = {
  'garbage-truck': { icon:'🗑️', color:'#22c55e', label:'Garbage Truck' },
  'ambulance':     { icon:'🚑', color:'#ef4444', label:'Ambulance'     },
  'water-tanker':  { icon:'💧', color:'#38bdf8', label:'Water Tanker'  },
  'police-van':    { icon:'🚔', color:'#7c3aed', label:'Police Van'    },
  'fire-truck':    { icon:'🚒', color:'#f59e0b', label:'Fire Truck'    }
};

// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initMap();
  await refreshAll();
  await loadHotspots();
});

// ── MAP ───────────────────────────────────────────────
function initMap() {
  map = L.map('res-map').setView([15.1394, 76.9214], 13);
  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    { attribution: '© CartoDB', maxZoom: 19 }
  ).addTo(map);
}

// ── REFRESH ALL ───────────────────────────────────────
window.refreshAll = async () => {
  await Promise.allSettled([
    loadSummary(),
    loadResources(),
    loadHotspots()
  ]);
};

// ── SUMMARY ───────────────────────────────────────────
async function loadSummary() {
  try {
    const res  = await fetch(`${BACKEND}/api/resources/summary`);
    const data = await res.json();

    document.getElementById('res-summary').innerHTML =
      Object.entries(TYPE_CFG).map(([type, cfg]) => {
        const counts = data[type] || {};
        const total  = Object.values(counts)
          .reduce((s, v) => s + v, 0);

        return `
          <div class="res-type-card"
            style="--type-color:${cfg.color};"
            onclick="filterByType('${type}')">
            <div class="res-type-icon">${cfg.icon}</div>
            <div class="res-type-name">${cfg.label}</div>
            <div class="res-counts">
              <span class="res-count-pill"
                style="background:#22c55e22; color:#22c55e;">
                ✓ ${counts.available || 0}
              </span>
              <span class="res-count-pill"
                style="background:#38bdf822; color:#38bdf8;">
                ▶ ${counts.deployed || 0}
              </span>
              ${counts.maintenance > 0
                ? `<span class="res-count-pill"
                     style="background:#f59e0b22; color:#f59e0b;">
                     ⚙ ${counts.maintenance}
                   </span>`
                : ''}
            </div>
          </div>
        `;
      }).join('');
  } catch {}
}

// ── LOAD RESOURCES ────────────────────────────────────
async function loadResources() {
  try {
    const res      = await fetch(`${BACKEND}/api/resources`);
    allResources   = await res.json();

    renderResourceTable(allResources);
    renderResourceMarkers(allResources);

    document.getElementById('res-count').innerText =
      `${allResources.length} resources`;
  } catch {}
}

// ── RESOURCE TABLE ────────────────────────────────────
function renderResourceTable(resources) {
  const canAct = ['admin','municipality'].includes(role);
  const tbody  = document.getElementById('res-table-body');

  if (!resources.length) {
    tbody.innerHTML = `<tr><td colspan="6"
      style="text-align:center; color:#64748b; padding:1.5rem;">
      No resources found.</td></tr>`;
    return;
  }

  tbody.innerHTML = resources.map(r => {
    const cfg  = TYPE_CFG[r.type] || {};
    const load = r.capacity > 0
      ? Math.round((r.currentLoad / r.capacity) * 100)
      : 0;

    return `
      <tr>
        <td style="font-weight:500;">${r.name}</td>
        <td>
          <span style="font-size:1rem;">${cfg.icon || '🚗'}</span>
        </td>
        <td>
          <span class="status-pill s-${r.status}">
            ${r.status}
          </span>
        </td>
        <td style="color:#64748b;">
          ${r.assignedTo || r.location?.area || '—'}
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:0.4rem;">
            <div style="width:40px; height:4px;
                        background:#0f172a; border-radius:999px;
                        overflow:hidden;">
              <div style="width:${load}%; height:100%;
                           background:${cfg.color || '#334155'};
                           border-radius:999px;"></div>
            </div>
            <span style="font-size:0.7rem; color:#64748b;">
              ${load}%
            </span>
          </div>
        </td>
        <td>
          ${canAct && r.status === 'deployed'
            ? `<button
                onclick="recallResource('${r._id}')"
                style="padding:0.2rem 0.5rem; background:#ef444422;
                       color:#ef4444; border:1px solid #ef4444;
                       border-radius:4px; cursor:pointer;
                       font-size:0.68rem;">
                ↩ Recall
               </button>`
            : '—'}
        </td>
      </tr>
    `;
  }).join('');
}

// ── RESOURCE MAP MARKERS ──────────────────────────────
function renderResourceMarkers(resources) {
  resMarkers.forEach(m => map.removeLayer(m));
  resMarkers = [];

  resources.forEach(r => {
    if (!r.location?.lat || !r.location?.lng) return;
    const cfg = TYPE_CFG[r.type] || { icon:'🚗', color:'#334155' };

    const statusOpacity = {
      available:   1.0,
      deployed:    0.8,
      maintenance: 0.4,
      returning:   0.6
    };

    const marker = L.marker(
      [r.location.lat, r.location.lng],
      {
        icon: L.divIcon({
          className: '',
          html: `<div style="
            font-size:18px;
            opacity:${statusOpacity[r.status] || 0.8};
            filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));
          ">${cfg.icon}</div>`,
          iconSize:   [22, 22],
          iconAnchor: [11, 11]
        })
      }
    ).addTo(map);

    marker.bindPopup(`
      <div style="min-width:160px;">
        <b>${r.name}</b><br/>
        <span class="status-pill s-${r.status}"
          style="font-size:0.68rem; padding:0.1rem 0.4rem;
                 border-radius:999px; font-weight:bold;">
          ${r.status}
        </span>
        ${r.assignedTo
          ? `<br/><span style="color:#64748b; font-size:0.78rem;">
               📍 ${r.assignedTo}
             </span>`
          : ''}
        <br/>
        <span style="font-size:0.75rem; color:#64748b;">
          Load: ${r.currentLoad}/${r.capacity}
        </span>
      </div>
    `);

    resMarkers.push(marker);
  });
}

// ── HOTSPOTS ──────────────────────────────────────────
window.loadHotspots = async () => {
  const type = document.getElementById('hotspot-type').value;
  const cfg  = TYPE_CFG[type] || { color:'#38bdf8' };

  try {
    const res  = await fetch(
      `${BACKEND}/api/resources/hotspots?type=${type}`
    );
    const data = await res.json();

    const maxScore = Math.max(...data.map(d => d.score), 1);

    document.getElementById('hotspot-body').innerHTML =
      data.map(h => {
        const pct  = Math.round((h.score / maxScore) * 100);
        const prio = h.score > 20 ? '#ef4444'
                   : h.score > 10 ? '#f59e0b'
                   : h.score > 5  ? '#38bdf8'
                   : '#22c55e';
        return `
          <div class="hotspot-row">
            <div style="width:80px; font-size:0.78rem;
                        color:#94a3b8; flex-shrink:0;">
              ${h.area}
            </div>
            <div class="hotspot-bar-bg">
              <div class="hotspot-bar-fill"
                style="width:${pct}%; background:${prio};">
              </div>
            </div>
            <div style="width:32px; text-align:right;
                        font-size:0.75rem; color:${prio};
                        font-weight:bold; flex-shrink:0;">
              ${h.score.toFixed(0)}
            </div>
          </div>
        `;
      }).join('');

    // Draw hotspot circles on map
    hotspotMarkers.forEach(m => map.removeLayer(m));
    hotspotMarkers = [];

    data.forEach(h => {
      if (!h.lat || !h.lng) return;
      const pct   = h.score / maxScore;
      const color = h.score > 20 ? '#ef4444'
                  : h.score > 10 ? '#f59e0b'
                  : h.score > 5  ? '#38bdf8'
                  : '#22c55e';

      const circle = L.circle([h.lat, h.lng], {
        radius:      Math.max(300, pct * 800),
        color:       color,
        fillColor:   color,
        fillOpacity: 0.15,
        weight:      1,
        dashArray:   '4 4'
      })
      .bindTooltip(
        `${h.area}: score ${h.score.toFixed(0)}`
      )
      .addTo(map);

      hotspotMarkers.push(circle);
    });

  } catch {
    document.getElementById('hotspot-body').innerHTML =
      '<p style="color:#ef4444; font-size:0.82rem;">Failed.</p>';
  }
};

// ── GENERATE AI PLAN ──────────────────────────────────
window.generatePlan = async () => {
  const planEl = document.getElementById('plan-body');
  planEl.innerHTML = `
    <p style="color:#64748b; font-size:0.82rem;
              text-align:center; padding:1rem;">
      ⏳ Running allocation engine...
    </p>`;

  const { getAuth } = await import(
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'
  );
  const token = await getAuth().currentUser?.getIdToken();

  try {
    const res  = await fetch(`${BACKEND}/api/resources/plan`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    planData   = await res.json();

    document.getElementById('plan-time').innerText =
      new Date().toLocaleTimeString('en-IN');

    renderPlan(planData);
  } catch {
    planEl.innerHTML =
      '<p style="color:#ef4444; font-size:0.82rem;">Failed to generate plan.</p>';
  }
};

function renderPlan(plan) {
  const planEl = document.getElementById('plan-body');

  if (!plan.length) {
    planEl.innerHTML =
      '<p style="color:#22c55e; font-size:0.82rem; text-align:center;">All resources optimally deployed.</p>';
    return;
  }

  const canDeploy = ['admin','municipality'].includes(role);

  planEl.innerHTML = plan.map(section => {
    const cfg  = TYPE_CFG[section.resourceType] || {};
    const recs = section.recommendations || [];

    return `
      <div class="plan-type-section">
        <div class="plan-type-header">
          <div class="plan-type-title">
            ${cfg.icon || '🚗'} ${cfg.label || section.resourceType}
          </div>
          <div style="font-size:0.72rem; color:#64748b;">
            ✓${section.available} ▶${section.deployed}
          </div>
        </div>
        <div class="plan-summary">${section.summary}</div>

        ${recs.map(rec => `
          <div class="rec-row ${rec.priority}">
            <div class="rec-top">
              <div class="rec-resource">${rec.resource}</div>
              <span class="rec-priority p-${rec.priority}">
                ${rec.priority}
              </span>
            </div>
            <div class="rec-msg">
              → ${rec.toArea}
            </div>
            <div class="rec-score">
              Demand: ${rec.demandScore}
              ${rec.distance
                ? ` · ${rec.distance}km away`
                : ''}
            </div>
            ${canDeploy && rec.action === 'deploy'
              ? `<button class="deploy-btn"
                  onclick="deployResource(
                    '${rec.resourceId}',
                    '${rec.toArea}',
                    '${rec.message.replace(/'/g,"\\'")}')">
                  🚀 Deploy Now
                 </button>`
              : ''}
          </div>
        `).join('')}

        ${!recs.length
          ? `<p style="color:#22c55e; font-size:0.78rem;">
               ✅ No reallocation needed
             </p>`
          : ''}
      </div>
    `;
  }).join('');
}

// ── DEPLOY RESOURCE ───────────────────────────────────
window.deployResource = async (resourceId, area, reason) => {
  const { getAuth } = await import(
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'
  );
  const token = await getAuth().currentUser?.getIdToken();

  try {
    await fetch(`${BACKEND}/api/resources/deploy`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ resourceId, area, reason })
    });

    showToast(`✅ Deployed to ${area}`, 'success');
    await refreshAll();
    await generatePlan();
  } catch {
    showToast('Deployment failed.', 'error');
  }
};

// ── RECALL RESOURCE ───────────────────────────────────
window.recallResource = async (id) => {
  const { getAuth } = await import(
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'
  );
  const token = await getAuth().currentUser?.getIdToken();

  try {
    await fetch(`${BACKEND}/api/resources/recall/${id}`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    showToast('↩ Resource recalled', 'info');
    await refreshAll();
  } catch {
    showToast('Recall failed.', 'error');
  }
};

// ── FILTER ────────────────────────────────────────────
window.filterResources = () => {
  const type   = document.getElementById('filter-type').value;
  const status = document.getElementById('filter-status').value;

  const filtered = allResources.filter(r =>
    (!type   || r.type   === type)   &&
    (!status || r.status === status)
  );
  renderResourceTable(filtered);
};

window.filterByType = (type) => {
  document.getElementById('filter-type').value = type;
  filterResources();
  document.getElementById('hotspot-type').value = type;
  loadHotspots();
};