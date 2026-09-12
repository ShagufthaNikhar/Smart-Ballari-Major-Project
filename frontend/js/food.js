const BACKEND = window.SB_API;

let allFood      = [];
let foodTag      = '';
let nearMeActive = false;
let userCoords   = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadFood();
});

// ── LOAD FOOD (plain list, no location) ──────────────
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

// ── LOAD FOOD SORTED BY DISTANCE FROM THE DEVICE ─────
async function loadNearMe() {
  const btn = document.getElementById('near-me-btn');
  btn.disabled = true;
  btn.textContent = '📍 Locating...';

  if (!navigator.geolocation) {
    showToast?.('Your browser does not support location.', 'error');
    resetNearMeBtn();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      try {
        const url = `${BACKEND}/api/lifestyle/food/nearby?lat=${userCoords.lat}&lng=${userCoords.lng}&limit=50`;
        const res = await fetch(url);
        allFood   = await res.json();
        renderFood(applyTagAndSearch(allFood));
      } catch {
        showToast?.('Could not load nearby food.', 'error');
      }
      btn.disabled = false;
      btn.textContent = '📍 Near Me ✓';
      btn.classList.add('active');
    },
    () => {
      showToast?.('Location permission denied.', 'warning');
      resetNearMeBtn();
    }
  );
}

function resetNearMeBtn() {
  const btn = document.getElementById('near-me-btn');
  btn.disabled = false;
  btn.textContent = '📍 Near Me';
  btn.classList.remove('active');
}

window.toggleNearMe = () => {
  nearMeActive = !nearMeActive;
  if (nearMeActive) {
    loadNearMe();
  } else {
    userCoords = null;
    resetNearMeBtn();
    loadFood(foodTag, document.getElementById('food-search').value);
  }
};

function applyTagAndSearch(items) {
  let results = [...items];
  if (foodTag) results = results.filter(r => r.tags.includes(foodTag));
  const search = document.getElementById('food-search').value.toLowerCase();
  if (search) {
    results = results.filter(r =>
      r.name.toLowerCase().includes(search) ||
      (r.specialty && r.specialty.toLowerCase().includes(search)) ||
      r.tags.some(t => t.includes(search))
    );
  }
  return results;
}

// ── RENDER ────────────────────────────────────────────
function renderFood(items) {
  document.getElementById('food-cards').innerHTML =
    items.map(r => `
      <div class="food-card">
        <div class="food-card-img">${r.image}</div>
        <div class="food-card-body">
          <div class="food-name">${r.name}</div>
          <div class="food-address">${r.address || ''}</div>
          ${r.specialty ? `<div class="food-specialty">⭐ ${r.specialty}</div>` : ''}
          <div class="food-meta">
            ${r.rating ? `<span class="food-rating">★ ${r.rating}</span>` : `<span style="color:#64748b;">No rating yet</span>`}
            ${r.priceRange ? `<span class="food-price">${r.priceRange}</span>` : ''}
            ${typeof r.distanceKm === 'number' ? `<span class="food-distance">📍 ${r.distanceKm} km</span>` : ''}
          </div>
          ${r.mustTry && r.mustTry.length
            ? `<div class="must-try">${r.mustTry.map(t => `<span class="must-try-tag">${t}</span>`).join('')}</div>`
            : ''}
          <div style="margin-top:0.6rem; display:flex; gap:0.4rem;">
            <button onclick="openMaps(${r.location.lat}, ${r.location.lng}, '${r.name}')"
              style="padding:0.3rem 0.7rem; background:#38bdf822; color:#38bdf8;
                     border:1px solid #38bdf8; border-radius:6px; cursor:pointer; font-size:0.72rem;">
              🗺️ Directions
            </button>
            ${r.phone
              ? `<a href="tel:${r.phone}"
                   style="padding:0.3rem 0.7rem; background:#22c55e22; color:#22c55e;
                          border:1px solid #22c55e; border-radius:6px; text-decoration:none; font-size:0.72rem;">
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
  document.querySelectorAll('#tag-chips .chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderFood(applyTagAndSearch(allFood));
};

window.filterFood = () => {
  if (nearMeActive) {
    renderFood(applyTagAndSearch(allFood));
  } else {
    loadFood(foodTag, document.getElementById('food-search').value);
  }
};