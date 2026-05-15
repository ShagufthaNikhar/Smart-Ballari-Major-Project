const BACKEND  = 'http://localhost:5000';
const BALLARI  = [15.1394, 76.9214];

let map;
let simPin        = null;
let simPinLatLng  = null;
let layerState    = {
  issues: true, traffic: false,
  pollution: false, crowd: false, shadow: false
};
let layerGroups   = {};
let simLayers     = [];
let shadowLayers  = [];
let threeScene    = null;
let snapshot      = null;

// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initMap();
  await loadSnapshot();
  renderIssueLayer();
});

// ── MAP INIT ──────────────────────────────────────────
function initMap() {
  map = L.map('twin-map', { zoomControl: true })
    .setView(BALLARI, 14);

  // Dark tile
  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    { attribution: '© CartoDB', maxZoom: 19 }
  ).addTo(map);

  // Init layer groups
  ['issues','traffic','pollution','crowd','shadow'].forEach(k => {
    layerGroups[k] = L.layerGroup();
  });

  layerGroups.issues.addTo(map);  // issues on by default

  // Map click → set sim pin
  map.on('click', (e) => {
    simPinLatLng = e.latlng;
    if (simPin) map.removeLayer(simPin);
    simPin = L.marker([e.latlng.lat, e.latlng.lng], {
      icon: L.divIcon({
        className: '',
        html: `<div style="font-size:24px;">📍</div>`,
        iconSize: [24,24], iconAnchor: [12,24]
      })
    }).addTo(map)
      .bindTooltip('Simulation point', { direction:'top' });
  });
}

// ── LOAD SNAPSHOT ─────────────────────────────────────
async function loadSnapshot() {
  try {
    const res = await fetch(`${BACKEND}/api/twin/snapshot`);
    snapshot  = await res.json();

    document.getElementById('info-issues').innerText =
      snapshot.issues.length;
    document.getElementById('info-alerts').innerText =
      snapshot.alerts.length;

    document.getElementById('twin-stats').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:0.3rem;">
        <div style="display:flex;justify-content:space-between;">
          <span>Open Issues</span>
          <b style="color:#ef4444;">${snapshot.issues.length}</b>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span>Active Alerts</span>
          <b style="color:#f59e0b;">${snapshot.alerts.length}</b>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span>Traffic Records</span>
          <b style="color:#38bdf8;">${snapshot.traffic.length}</b>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span>Water Records</span>
          <b style="color:#22c55e;">${snapshot.water.length}</b>
        </div>
      </div>
    `;
  } catch {
    document.getElementById('twin-stats').innerHTML =
      '<p style="color:#ef4444;">Could not load snapshot.</p>';
  }
}

// ── LAYER TOGGLE ──────────────────────────────────────
window.toggleLayer = (key) => {
  layerState[key] = !layerState[key];
  const btn = document.getElementById(`lyr-${key}`);
  btn.classList.toggle('on', layerState[key]);

  if (layerState[key]) {
    renderLayer(key);
    map.addLayer(layerGroups[key]);
  } else {
    map.removeLayer(layerGroups[key]);
  }

  const count = Object.values(layerState).filter(Boolean).length;
  document.getElementById('info-layers').innerText = count;
};

function renderLayer(key) {
  layerGroups[key].clearLayers();

  switch (key) {
    case 'issues':    renderIssueLayer();    break;
    case 'traffic':   renderTrafficLayer();  break;
    case 'pollution': renderPollutionLayer();break;
    case 'crowd':     renderCrowdLayer();    break;
    case 'shadow':    renderShadowLayer();   break;
  }
}

// ── ISSUE LAYER ───────────────────────────────────────
function renderIssueLayer() {
  if (!snapshot) return;
  layerGroups.issues.clearLayers();

  const catColor = {
    road:'#f59e0b', water:'#38bdf8',
    electric:'#facc15', sanitation:'#a3e635', other:'#94a3b8'
  };

  snapshot.issues.forEach(issue => {
    const { lat, lng } = issue.location?.coordinates || {};
    if (!lat || !lng) return;
    const color = catColor[issue.category] || '#94a3b8';

    L.circleMarker([lat, lng], {
      radius: 7, fillColor: color,
      color: '#0f172a', fillOpacity: 0.85, weight: 1.5
    })
    .bindTooltip(`${issue.title}<br/>${issue.category}`, {
      direction: 'top'
    })
    .addTo(layerGroups.issues);
  });
}

// ── TRAFFIC HEAT LAYER ────────────────────────────────
function renderTrafficLayer() {
  const hotspots = [
    { lat:15.1394, lng:76.9214, intensity:0.9, label:'Gandhi Nagar' },
    { lat:15.1350, lng:76.9250, intensity:0.8, label:'KSRTC Stand'  },
    { lat:15.1420, lng:76.9180, intensity:0.6, label:'Nehru Gunj'   },
    { lat:15.1480, lng:76.9120, intensity:0.4, label:'Cantonment'   },
    { lat:15.1300, lng:76.9370, intensity:0.7, label:'Hospet Road'  }
  ];

  hotspots.forEach(h => {
    const color = h.intensity > 0.7
      ? '#ef4444' : h.intensity > 0.4 ? '#f59e0b' : '#22c55e';

    L.circle([h.lat, h.lng], {
      radius:      h.intensity * 400,
      color:       color,
      fillColor:   color,
      fillOpacity: 0.25,
      weight:      1
    })
    .bindTooltip(`🚦 ${h.label}: ${Math.round(h.intensity*100)}%`)
    .addTo(layerGroups.traffic);
  });
}

// ── POLLUTION LAYER ───────────────────────────────────
function renderPollutionLayer() {
  const zones = [
    { lat:15.1394, lng:76.9214, aqi:3, label:'Gandhi Nagar - Moderate' },
    { lat:15.1350, lng:76.9250, aqi:2, label:'KSRTC Stand - Fair'      },
    { lat:15.1480, lng:76.9120, aqi:4, label:'Cantonment - Poor'       },
    { lat:15.1420, lng:76.9180, aqi:2, label:'Nehru Gunj - Fair'       }
  ];

  const aqiColor = {
    1:'#22c55e', 2:'#84cc16',
    3:'#f59e0b', 4:'#ef4444', 5:'#7c3aed'
  };

  zones.forEach(z => {
    const color = aqiColor[z.aqi] || '#334155';
    L.circle([z.lat, z.lng], {
      radius:      350,
      color:       color,
      fillColor:   color,
      fillOpacity: 0.2,
      weight:      1,
      dashArray:   '4 4'
    })
    .bindTooltip(`💨 ${z.label}`)
    .addTo(layerGroups.pollution);
  });
}

// ── CROWD LAYER ───────────────────────────────────────
function renderCrowdLayer() {
  const areas = [
    { lat:15.1394, lng:76.9214, count:2800, color:'#ef4444' },
    { lat:15.1350, lng:76.9250, count:2000, color:'#f59e0b' },
    { lat:15.1420, lng:76.9180, count:900,  color:'#22c55e' },
    { lat:15.1480, lng:76.9120, count:600,  color:'#22c55e' },
    { lat:15.1450, lng:76.9150, count:1200, color:'#f59e0b' }
  ];

  areas.forEach(a => {
    L.circle([a.lat, a.lng], {
      radius:      Math.max(150, a.count / 8),
      color:       a.color,
      fillColor:   a.color,
      fillOpacity: 0.2,
      weight:      1
    })
    .bindTooltip(`👥 ~${a.count.toLocaleString()} people`)
    .addTo(layerGroups.crowd);
  });
}

// ── SHADOW LAYER ──────────────────────────────────────
async function renderShadowLayer() {
  try {
    const res  = await fetch(
      `${BACKEND}/api/twin/shadow?lat=${BALLARI[0]}&lng=${BALLARI[1]}`
    );
    const data = await res.json();

    data.grid.forEach(cell => {
      const color = cell.exposure === 'shaded'   ? '#22c55e'
        : cell.exposure === 'partial' ? '#f59e0b'
        : '#ef4444';

      L.rectangle(
        [
          [cell.lat - 0.0015, cell.lng - 0.0015],
          [cell.lat + 0.0015, cell.lng + 0.0015]
        ],
        {
          color:       color,
          fillColor:   color,
          fillOpacity: 0.18,
          weight:      0
        }
      ).addTo(layerGroups.shadow);
    });

    // Tree planting markers
    data.suggestions.forEach(s => {
      L.marker([s.lat, s.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="font-size:18px;" title="${s.suggestion}">
            🌳
          </div>`,
          iconSize: [20,20], iconAnchor:[10,10]
        })
      })
      .bindPopup(`
        <b>${s.suggestion}</b><br/>
        Priority: ${s.priority}<br/>
        ${s.benefit}
      `)
      .addTo(layerGroups.shadow);
    });

  } catch {
    showToast('Shadow analysis failed.', 'error');
  }
}

// ── 3D VIEW ───────────────────────────────────────────
function init3DView() {
  const canvas = document.getElementById('three-canvas');
  canvas.style.display = 'block';

  const W = canvas.clientWidth;
  const H = canvas.clientHeight;

  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: true, antialias: true
  });
  renderer.setSize(W, H);
  renderer.setPixelRatio(window.devicePixelRatio);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
  camera.position.set(0, 15, 25);
  camera.lookAt(0, 0, 0);

  // Lights
  scene.add(new THREE.AmbientLight(0x1e293b, 1.5));
  const sun = new THREE.DirectionalLight(0x38bdf8, 1.2);
  sun.position.set(10, 20, 10);
  scene.add(sun);

  // Ground plane
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshLambertMaterial({ color: 0x0f172a })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Grid
  scene.add(new THREE.GridHelper(40, 20, 0x1e293b, 0x1e293b));

  // Generate city blocks
  const buildings = generateBuildings();
  buildings.forEach(b => scene.add(b));

  // Issue markers (colored cylinders)
  if (snapshot) {
    snapshot.issues.slice(0, 20).forEach((issue, i) => {
      const catColor = {
        road: 0xf59e0b, water: 0x38bdf8,
        electric: 0xfacc15, sanitation: 0xa3e635
      };
      const color = catColor[issue.category] || 0x94a3b8;

      const marker = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 2, 8),
        new THREE.MeshLambertMaterial({ color })
      );
      marker.position.set(
        (i % 8) * 3 - 12,
        1,
        Math.floor(i / 8) * 3 - 6
      );
      scene.add(marker);
    });
  }

  // Animate
  let frame;
  function animate() {
    frame = requestAnimationFrame(animate);
    scene.rotation.y += 0.003;
    renderer.render(scene, camera);
  }
  animate();

  threeScene = { renderer, scene, camera, frame };
}

function generateBuildings() {
  const buildings = [];
  const cols = [0x1e3a5f, 0x1e293b, 0x0f2a3f, 0x172a4a];

  for (let i = 0; i < 30; i++) {
    const h = Math.random() * 4 + 1;
    const w = Math.random() * 1.5 + 0.5;

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, w),
      new THREE.MeshLambertMaterial({
        color: cols[Math.floor(Math.random() * cols.length)]
      })
    );

    mesh.position.set(
      Math.random() * 30 - 15,
      h / 2,
      Math.random() * 30 - 15
    );
    buildings.push(mesh);
  }

  return buildings;
}

function stop3DView() {
  if (threeScene?.frame) {
    cancelAnimationFrame(threeScene.frame);
  }
  document.getElementById('three-canvas').style.display = 'none';
}

// ── VIEW SWITCHER ─────────────────────────────────────
window.activateView = (view) => {
  document.querySelectorAll('.view-btn').forEach(b =>
    b.classList.remove('active')
  );
  document.getElementById(`vbtn-${view}`)?.classList.add('active');
  document.getElementById('info-mode').innerText = view.toUpperCase();

  if (view === '3d') {
    init3DView();
  } else {
    stop3DView();
  }

  if (view === 'shadow') {
    layerState.shadow = true;
    document.getElementById('lyr-shadow').classList.add('on');
    renderLayer('shadow');
    map.addLayer(layerGroups.shadow);
  }

  if (view === 'sim') {
    showToast('Click any point on the map to set simulation location', 'info');
  }
};

window.setView = (mode) => {
  if (mode === '3d') { activateView('3d'); }
  else               { activateView('map'); stop3DView(); }
};

// ── ROAD CLOSURE SIM ──────────────────────────────────
window.simulateRoadClosure = async () => {
  if (!simPinLatLng) {
    showToast('Click map to set simulation point first.', 'warning');
    return;
  }

  const name   = document.getElementById('sim-name').value ||
                 'Selected Road';
  const radius = parseFloat(document.getElementById('sim-radius').value) || 0.5;

  showToast('⏳ Running simulation...', 'info');

  try {
    const res  = await fetch(`${BACKEND}/api/twin/simulate/road-closure`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat:    simPinLatLng.lat,
        lng:    simPinLatLng.lng,
        radius, name
      })
    });
    const data = await res.json();
    renderSimResult(data);
  } catch {
    showToast('Simulation failed.', 'error');
  }
};

function renderSimResult(data) {
  // Clear previous sim layers
  simLayers.forEach(l => map.removeLayer(l));
  simLayers = [];

  // Draw impact zones
  const sevColor = { high:'#ef4444', medium:'#f59e0b', low:'#22c55e' };

  data.impactZones.forEach(zone => {
    const circle = L.circle([zone.lat, zone.lng], {
      radius:      zone.radius,
      color:       sevColor[zone.severity],
      fillColor:   sevColor[zone.severity],
      fillOpacity: 0.15,
      weight:      2,
      dashArray:   '6 4'
    })
    .bindTooltip(zone.label)
    .addTo(map);
    simLayers.push(circle);
  });

  // Draw alternate routes
  data.alternates.forEach(route => {
    const coords = route.coords.map(c => [c.lat, c.lng]);
    const line = L.polyline(coords, {
      color:  '#22c55e',
      weight: 3,
      dashArray: '8 4'
    })
    .bindTooltip(`${route.name} (${route.delay})`)
    .addTo(map);
    simLayers.push(line);
  });

  // Show overlay
  const isHigh = data.affected > 5;
  const overlay = document.getElementById('sim-overlay');
  overlay.classList.add('show');

  document.getElementById('sim-overlay-body').innerHTML = `
    <div style="margin-bottom:0.5rem;">
      <span class="impact-badge impact-${isHigh ? 'high' : 'medium'}">
        ${data.recommendation.split(' — ')[0]}
      </span>
    </div>
    <div style="font-size:0.78rem; color:#94a3b8; margin-bottom:0.5rem;">
      ${data.recommendation}
    </div>
    <div style="font-size:0.75rem; color:#64748b;">
      📌 Affected issues nearby: <b style="color:#f1f5f9;">
        ${data.affected}
      </b>
    </div>
    <div style="margin-top:0.5rem;">
      ${data.alternates.map(r => `
        <div style="font-size:0.75rem; color:#22c55e; margin-top:0.2rem;">
          ↪ ${r.name} ${r.delay}
        </div>
      `).join('')}
    </div>
  `;

  showToast(
    `🚧 Simulation: ${data.affected} issues affected`, 'warning'
  );
}

// ── SHADOW ANALYSIS ───────────────────────────────────
window.runShadowAnalysis = async () => {
  const lat = simPinLatLng?.lat || BALLARI[0];
  const lng = simPinLatLng?.lng || BALLARI[1];

  showToast('🌳 Running shadow analysis...', 'info');

  // Enable shadow layer
  layerState.shadow = true;
  document.getElementById('lyr-shadow').classList.add('on');
  map.addLayer(layerGroups.shadow);
  renderLayer('shadow');

  activateView('shadow');
};

// ── CLEAR SIM ─────────────────────────────────────────
window.clearSimulation = () => {
  simLayers.forEach(l => map.removeLayer(l));
  simLayers = [];
  if (simPin) { map.removeLayer(simPin); simPin = null; }
  simPinLatLng = null;
  document.getElementById('sim-overlay').classList.remove('show');
  document.getElementById('sim-result-panel').classList.remove('show');
  showToast('Simulation cleared.', 'info');
};