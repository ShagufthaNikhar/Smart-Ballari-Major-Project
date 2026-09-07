/* Smart Ballari — Education (schools + colleges)
   Data: backend/data/ballari_education.json via /api/services/education      */

const BACKEND = window.SB_API;

const state = { search: '', category: '', group: '' };
let searchTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
  await buildCategoryDropdown();
  bindControls();
  loadEducation();
});

/* ---------- controls ---------- */

function bindControls() {
  const input = document.getElementById('edu-search');
  input?.addEventListener('input', e => {
    state.search = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadEducation, 200);
  });

  document.getElementById('edu-category')?.addEventListener('change', e => {
    state.category = e.target.value;
    loadEducation();
  });

  document.querySelectorAll('.edu-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.edu-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.group = btn.dataset.group;
      // a school filter makes no sense on the colleges tab and vice versa
      const sel = document.getElementById('edu-category');
      if (state.group && sel) {
        const opt = sel.selectedOptions[0];
        if (opt && opt.dataset.group && opt.dataset.group !== state.group) {
          sel.value = '';
          state.category = '';
        }
      }
      loadEducation();
    });
  });
}

/* ---------- dropdown built from the backend taxonomy ---------- */

async function buildCategoryDropdown() {
  const sel = document.getElementById('edu-category');
  if (!sel) return;

  try {
    const res = await fetch(`${BACKEND}/api/services/education/categories`);
    const data = await res.json();

    let html = `<option value="">All Types (${data.total})</option>`;
    data.groups.forEach(g => {
      html += `<optgroup label="${esc(g.label)}">`;
      g.items.forEach(i => {
        html += `<option value="${i.key}" data-group="${g.group}"${i.count ? '' : ' disabled'}>
                   ${i.icon} ${esc(i.label)} (${i.count})
                 </option>`;
      });
      html += `</optgroup>`;
    });
    sel.innerHTML = html;
  } catch {
    sel.innerHTML = '<option value="">All Types</option>';
  }
}

/* ---------- data ---------- */

window.loadEducation = async () => {
  const grid = document.getElementById('edu-grid');
  try {
    const params = new URLSearchParams();
    if (state.search)   params.set('search', state.search);
    if (state.category) params.set('category', state.category);
    if (state.group)    params.set('group', state.group);

    const res = await fetch(`${BACKEND}/api/services/education?${params}`);
    render(await res.json());
  } catch {
    grid.innerHTML = '<p style="color:#ef4444;">Could not load education data.</p>';
  }
};

function render(list) {
  const grid  = document.getElementById('edu-grid');
  const count = document.getElementById('edu-count');

  count.textContent = list.length
    ? `${list.length} institution${list.length === 1 ? '' : 's'}`
    : '';

  if (!list.length) {
    grid.innerHTML = '<p style="color:#64748b;">No institutions match that filter.</p>';
    return;
  }

  grid.innerHTML = list.map(card).join('');
}

function card(inst) {
  const chips = inst.tag_labels
    .filter(l => l !== inst.primary_label)
    .map(l => `<span class="edu-chip">${esc(l)}</span>`)
    .join('');

  const rating = inst.rating
    ? `<div class="edu-rating">⭐ ${inst.rating}${inst.review_count ? ` · ${inst.review_count} reviews` : ''}</div>`
    : '';

  const phone = inst.phone
    ? `<div class="edu-detail">📞 ${esc(inst.phone)}</div>`
    : '';

  const callBtn = inst.phone
    ? `<a class="edu-btn edu-btn-call" href="tel:${esc(inst.phone)}">📞 Call</a>`
    : '';

  return `
    <div class="edu-card">
      <div class="edu-header">
        <div class="edu-icon">${inst.icon}</div>
        <div>
          <div class="edu-name">${esc(inst.name)}</div>
          <div style="margin-top:0.3rem;">
            <span class="edu-type">${esc(inst.primary_label)}</span>
            ${inst.govt ? '<span class="edu-govt">GOVT</span>' : ''}
          </div>
        </div>
      </div>
      <div class="edu-body">
        <div class="edu-detail">📍 ${esc(inst.address || 'Ballari, Karnataka')}</div>
        ${phone}
        <div class="edu-detail">🏷️ ${esc(cap(inst.type))}</div>
        ${chips ? `<div class="edu-chips">${chips}</div>` : ''}
        ${rating}
        <div class="edu-actions">
          <a class="edu-btn" href="${inst.maps_url}" target="_blank" rel="noopener">🗺️ Directions</a>
          ${callBtn}
        </div>
      </div>
    </div>`;
}

/* ---------- helpers ---------- */

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));
}

const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');