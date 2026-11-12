const BACKEND = window.SB_API;

let allOffices = [];

// Category → icon/color. The source data doesn't carry these (unlike the
// old hand-curated array), so this is a lookup by category key with a
// generic fallback for anything not listed.
const CATEGORY_STYLE = {
  district_administration:       { icon: '🏢', color: '#a78bfa' },
  municipal_government:          { icon: '🏛️', color: '#0ea5e9' },
  local_government:              { icon: '🏛️', color: '#0ea5e9' },
  revenue:                       { icon: '🏛️', color: '#22c55e' },
  registration:                  { icon: '📜', color: '#f59e0b' },
  education_government:          { icon: '🎓', color: '#38bdf8' },
  social_welfare:                { icon: '🤝', color: '#22c55e' },
  women_child:                   { icon: '🤝', color: '#ec4899' },
  agriculture:                   { icon: '🌾', color: '#84cc16' },
  forest:                        { icon: '🌿', color: '#22c55e' },
  environment:                   { icon: '♻️', color: '#22c55e' },
  labour:                        { icon: '🛠️', color: '#f97316' },
  labour_social_security:        { icon: '🛠️', color: '#f97316' },
  library:                       { icon: '📚', color: '#6366f1' },
  treasury:                      { icon: '💰', color: '#f59e0b' },
  finance:                       { icon: '💰', color: '#f59e0b' },
  insurance:                     { icon: '🛡️', color: '#38bdf8' },
  industries:                    { icon: '🏭', color: '#94a3b8' },
  employment:                    { icon: '💼', color: '#38bdf8' },
  health:                        { icon: '🏥', color: '#ef4444' },
  mines_geology:                 { icon: '⛏️', color: '#94a3b8' },
  mines_safety:                  { icon: '⛏️', color: '#94a3b8' },
  public_works:                  { icon: '🚧', color: '#f59e0b' },
  power:                         { icon: '⚡', color: '#f59e0b' },
  central_government:            { icon: '🏛️', color: '#a78bfa' },
  information_public_relations:  { icon: '📰', color: '#38bdf8' },
  housing:                       { icon: '🏘️', color: '#0ea5e9' },
  infrastructure:                { icon: '🏗️', color: '#94a3b8' },
  minority_welfare:               { icon: '🤝', color: '#22c55e' },
  courts:                        { icon: '⚖️', color: '#1e293b' },
  police:                        { icon: '🛡️', color: '#38bdf8' },
  transport:                     { icon: '🚗', color: '#f97316' }
};
const DEFAULT_STYLE = { icon: '🏛️', color: '#38bdf8' };

function categoryLabel(category) {
  return category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadOffices();
});

async function loadOffices() {
  try {
    const res = await fetch(`${BACKEND}/api/govt-offices/offices`);
    allOffices = await res.json();
    populateCategoryDropdown();
    renderOffices();
  } catch {
    document.getElementById('go-grid').innerHTML =
      '<p class="go-empty">Could not load government offices.</p>';
  }
}

function populateCategoryDropdown() {
  const select = document.getElementById('go-category-select');
  const categories = [...new Set(allOffices.map(o => o.category))].sort();
  select.innerHTML =
    '<option value="all">All Offices</option>' +
    categories.map(c => `<option value="${c}">${categoryLabel(c)}</option>`).join('');
}

window.renderOffices = () => {
  const search   = (document.getElementById('go-search-input').value || '').trim().toLowerCase();
  const category = document.getElementById('go-category-select').value;

  const filtered = allOffices.filter(o => {
    if (category !== 'all' && o.category !== category) return false;
    if (search) {
      const haystack = `${o.name} ${o.address || ''} ${o.type || ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  document.getElementById('go-count').innerText =
    `${filtered.length} office${filtered.length !== 1 ? 's' : ''} found`;

  const grid = document.getElementById('go-grid');

  if (!filtered.length) {
    grid.innerHTML = '<p class="go-empty">No offices match your search.</p>';
    return;
  }

  grid.innerHTML = filtered.map(o => {
    const style = CATEGORY_STYLE[o.category] || DEFAULT_STYLE;

    // Precision order: an exact, verified lat/lng is the best pin. A
    // place_id is next best (Google resolves it precisely even without
    // coordinates on our end). Plain address text search is the fallback.
    const directionsUrl =
      (o.coordinatesVerified && o.location)
        ? `https://www.google.com/maps/search/?api=1&query=${o.location.lat},${o.location.lng}`
        : o.placeId
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.name)}&query_place_id=${o.placeId}`
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.name + ', ' + (o.address || 'Ballari, Karnataka'))}`;

    return `
      <div class="go-card">
        <div class="go-card-top">
          <div class="go-icon" style="background:${style.color};">${style.icon}</div>
          <div class="go-card-title">
            <h4>${escapeHtml(o.name)}</h4>
            <span class="go-cat-badge">${escapeHtml(o.type || categoryLabel(o.category))}</span>
          </div>
        </div>

        ${o.address ? `<div class="go-detail">📍 <span>${escapeHtml(o.address)}</span></div>` : ''}
        ${o.phone ? `<div class="go-detail">📞 <a href="tel:${o.phone.replace(/[^\d]/g, '')}">${escapeHtml(o.phone)}</a></div>` : ''}
        ${!o.phoneVerified && o.phone ? `<div class="go-detail" style="color:#f59e0b;">⚠️ Phone not independently verified</div>` : ''}
        ${!o.coordinatesVerified ? `<div class="go-detail" style="color:#f59e0b;">⚠️ Approximate location — not map-verified</div>` : ''}

        <a class="go-directions-btn" target="_blank" rel="noopener" href="${directionsUrl}">
          📍 Get Directions
        </a>
      </div>
    `;
  }).join('');
};

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}