const MU_BACKEND = 'http://localhost:5000';

// Placeholder area list — swap for a real API-driven list once you have
// one (e.g. GET /api/areas), or trim/extend this to your actual localities.
const MU_AREAS = [
  'Gandhinagar',
  'Cowl Bazaar',
  'Station Road',
  'Patel Nagar',
  'Cantonment',
  'Hospet Road',
  'Old City',
  'Fort Area',
  'Industrial Area'
];

// These two are "reset" entries in the dropdown itself — picking either
// clears the area filter rather than filtering to a specific place.
const MU_RESET_VALUES = ['All Areas', 'All Wards'];

let muMode      = 'all';   // 'all' | 'area' — now purely cosmetic (which toggle looks active)
let muCategory  = 'all';
let muAllUpdates = [];     // full unfiltered list from the backend

const MU_TYPE_ICON = {
  water:        '💧',
  power:        '⚡',
  waste:        '🗑️',
  roads:        '🚧',
  events:       '📅',
  announcement: '📢'
};

document.addEventListener('DOMContentLoaded', () => {
  populateAreaDropdown();
  loadUpdates();
});

function populateAreaDropdown() {
  const select = document.getElementById('mu-area-select');
  const options = ['All Areas', ...MU_AREAS, 'All Wards'];
  select.innerHTML = options.map(a => `<option value="${a}">${a}</option>`).join('');
}

// The dropdown now filters regardless of which toggle is active — the
// toggle just switches which button looks selected. Clicking "All Updates"
// also resets the dropdown back to "All Areas" for a clean slate; clicking
// "Area-wise" leaves whatever's currently selected in place.
window.setMode = (mode) => {
  muMode = mode;
  document.getElementById('mu-mode-all').classList.toggle('active', mode === 'all');
  document.getElementById('mu-mode-area').classList.toggle('active', mode === 'area');

  if (mode === 'all') {
    document.getElementById('mu-area-select').value = 'All Areas';
  }

  applyFilters();
};

window.setCategory = (cat) => {
  muCategory = cat;
  document.querySelectorAll('.mu-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.cat === cat);
  });
  applyFilters();
};

async function loadUpdates() {
  const list = document.getElementById('mu-list');
  list.innerHTML = '<p class="mu-loading">Loading updates...</p>';

  try {
    const res = await fetch(`${MU_BACKEND}/api/updates`);
    const data = await res.json();
    muAllUpdates = Array.isArray(data) ? data : [];
    applyFilters();
  } catch {
    list.innerHTML = '<p class="mu-empty">⚠️ Could not load updates. Check that the backend is running.</p>';
  }
}

window.applyFilters = () => {
  const list = document.getElementById('mu-list');
  if (!muAllUpdates.length && list.querySelector('.mu-loading')) return; // still loading

  const searchTerm = (document.getElementById('mu-search-input').value || '').trim().toLowerCase();
  const selectedArea = document.getElementById('mu-area-select').value;
  const areaFilterActive = selectedArea && !MU_RESET_VALUES.includes(selectedArea);

  let filtered = muAllUpdates.filter(u => {
    if (muCategory !== 'all' && u.type !== muCategory) return false;
    if (areaFilterActive && u.area !== selectedArea) return false;
    if (searchTerm) {
      const haystack = `${u.title || ''} ${u.description || ''}`.toLowerCase();
      if (!haystack.includes(searchTerm)) return false;
    }
    return true;
  });

  renderList(filtered);
};

function renderList(updates) {
  const list = document.getElementById('mu-list');

  if (!updates.length) {
    list.innerHTML = '<p class="mu-empty">No updates match your filters right now.</p>';
    return;
  }

  list.innerHTML = updates.map(u => `
    <div class="mu-card">
      <div class="mu-card-icon type-${u.type || 'announcement'}">
        ${MU_TYPE_ICON[u.type] || '📢'}
      </div>
      <div class="mu-card-body">
        <div class="mu-card-title-row">
          <h4>${escapeHtml(u.title || 'Untitled update')}</h4>
          ${u.status ? `<span class="mu-status ${u.status}">${escapeHtml(u.status)}</span>` : ''}
        </div>
        <p class="mu-card-desc">${escapeHtml(u.description || '')}</p>
        <div class="mu-card-meta">
          ${u.area ? `<span>📍 ${escapeHtml(u.area)}</span>` : ''}
          ${u.createdAt ? `<span>${new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}