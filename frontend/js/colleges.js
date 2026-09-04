const BACKEND = window.SB_API;

document.addEventListener('DOMContentLoaded', async () => {
  await loadColleges();
});

window.loadColleges = async () => {
  const search = document.getElementById('college-search')?.value || '';
  const type   = document.getElementById('college-type')?.value   || '';

  try {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (type)   params.set('type', type);

    const res      = await fetch(`${BACKEND}/api/services/colleges?${params}`);
    const colleges = await res.json();
    renderColleges(colleges);
  } catch {
    document.getElementById('college-grid').innerHTML =
      '<p style="color:#ef4444;">Could not load.</p>';
  }
};

function renderColleges(colleges) {
  document.getElementById('college-grid').innerHTML =
    colleges.map(c => `
      <div class="college-card">
        <div class="college-header">
          <div class="college-icon">${c.image}</div>
          <div>
            <div class="college-name">${c.name}</div>
            <div style="margin-top:0.3rem;">
              <span class="college-type">${c.type}</span>
              ${c.govt
                ? `<span style="margin-left:0.3rem; background:#22c55e22;
                               color:#22c55e; border-radius:999px;
                               padding:0.1rem 0.4rem; font-size:0.65rem;
                               font-weight:bold;">GOVT</span>`
                : ''}
            </div>
          </div>
        </div>
        <div class="college-body">
          <div class="college-detail">🏛️ ${c.affiliation}</div>
          <div class="college-detail">📅 Est. ${c.established}</div>
          <div class="college-detail">📍 ${c.address}</div>
          <div class="college-detail">📞 ${c.phone}</div>

          <div class="courses-list">
            ${c.courses.map(cr => `<span class="course-tag">${cr}</span>`).join('')}
          </div>

          <div style="display:flex; flex-wrap:wrap; gap:0.3rem; margin-bottom:0.5rem;">
            ${c.facilities.map(f =>
              `<span style="background:#38bdf811; color:#38bdf8;
                            border-radius:4px; padding:0.1rem 0.4rem;
                            font-size:0.68rem;">
                 ${f}
               </span>`
            ).join('')}
          </div>

          <div class="college-ranking">⭐ ${c.ranking}</div>

          <div style="display:flex; gap:0.5rem; margin-top:0.8rem;">
            <button
              onclick="openMaps(${c.location.lat}, ${c.location.lng}, '${c.name}')"
              style="flex:1; padding:0.4rem; background:#1e293b;
                     border:1px solid #334155; color:#94a3b8;
                     border-radius:6px; cursor:pointer;
                     font-size:0.72rem;">
              🗺️ Directions
            </button>
            ${c.phone
              ? `<a href="tel:${c.phone}"
                   style="flex:1; padding:0.4rem; background:#22c55e22;
                          border:1px solid #22c55e; color:#22c55e;
                          border-radius:6px; text-decoration:none;
                          font-size:0.72rem; text-align:center;">
                   📞 Call
                 </a>`
              : ''}
          </div>
        </div>
      </div>
    `).join('');
}