const MU_BACKEND = window.SB_API;

// Scoped to Ballari city only for now. When you're ready to bring in the
// other talukas, just add more entries here — each `value` must exactly
// match the `area` enum in models/MunicipalityUpdate.js
// ('ballari-city' | 'hospet' | 'siruguppa' | 'sandur' | 'kudligi' | 'all').
const MU_AREAS = [
  { value: 'ballari-city', label: 'Ballari City' }
];

// 'all' is the schema's own value for "applies everywhere" — an update
// posted with area:'all' should show under every area filter, so we use
// 'all' itself as the dropdown's reset option rather than a separate string.
const MU_RESET_VALUE = 'all';

let muMode       = 'all';   // 'all' | 'area' — cosmetic toggle state only
let muCategory   = 'all';
let muAllUpdates = [];      // full unfiltered list from the backend

// Must match the `type` enum in models/MunicipalityUpdate.js exactly.
const MU_TYPE_ICON = {
  notice:      '📢',
  maintenance: '🚧',
  emergency:   '🚨',
  event:       '📅'
};

document.addEventListener('DOMContentLoaded', () => {
  populateAreaDropdown();
  loadUpdates();
});

function populateAreaDropdown() {
  const select = document.getElementById('mu-area-select');
  const options = [{ value: 'all', label: 'All Areas' }, ...MU_AREAS];
  select.innerHTML = options
    .map(a => `<option value="${a.value}">${a.label}</option>`)
    .join('');
}

// The dropdown filters regardless of which toggle is active — the toggle
// just switches which button looks selected. Clicking "All Updates" also
// resets the dropdown back to "All Areas" for a clean slate; clicking
// "Area-wise" leaves whatever's currently selected in place.
window.setMode = (mode) => {
  muMode = mode;
  document.getElementById('mu-mode-all').classList.toggle('active', mode === 'all');
  document.getElementById('mu-mode-area').classList.toggle('active', mode === 'area');

  if (mode === 'all') {
    document.getElementById('mu-area-select').value = MU_RESET_VALUE;
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

  const searchTerm   = (document.getElementById('mu-search-input').value || '').trim().toLowerCase();
  const selectedArea = document.getElementById('mu-area-select').value;
  const areaFilterActive = selectedArea && selectedArea !== MU_RESET_VALUE;

  let filtered = muAllUpdates.filter(u => {
    if (muCategory !== 'all' && u.type !== muCategory) return false;
    // an update tagged area:'all' should always pass, regardless of the selected area
    if (areaFilterActive && u.area !== selectedArea && u.area !== 'all') return false;
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
      <div class="mu-card-icon type-${u.type || 'notice'}">
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