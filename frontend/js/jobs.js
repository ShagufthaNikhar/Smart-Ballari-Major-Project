const BACKEND = window.SB_API;

document.addEventListener('DOMContentLoaded', async () => {
  await populateSectorDropdown();
  await loadJobs();
});

async function populateSectorDropdown() {
  try {
    const res = await fetch(`${BACKEND}/api/services/jobs/sectors`);
    const sectors = await res.json();
    const select = document.getElementById('job-sector');
    select.innerHTML =
      '<option value="">All Sectors</option>' +
      sectors.map(s => `<option value="${s}">${s}</option>`).join('');
  } catch {
    // Non-fatal — the dropdown just stays at "All Sectors" if this fails.
  }
}

window.loadJobs = async () => {
  const search = document.getElementById('job-search')?.value || '';
  const type   = document.getElementById('job-type')?.value   || '';
  const sector = document.getElementById('job-sector')?.value || '';

  try {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (type)   params.set('type', type);
    if (sector) params.set('sector', sector);

    const res  = await fetch(`${BACKEND}/api/services/jobs?${params}`);
    const jobs = await res.json();

    document.getElementById('jobs-stats').innerText =
      `${jobs.length} job${jobs.length !== 1 ? 's' : ''} found`;

    renderJobs(jobs);
  } catch {
    document.getElementById('jobs-grid').innerHTML =
      '<p style="color:#ef4444;">Could not load jobs.</p>';
  }
};

function renderJobs(jobs) {
  if (!jobs.length) {
    document.getElementById('jobs-grid').innerHTML =
      `<div style="text-align:center; padding:2rem; color:#64748b;">
         No jobs match your search. Try different filters.
       </div>`;
    return;
  }

  document.getElementById('jobs-grid').innerHTML = jobs.map(j => {
    const daysLeft = j.deadline
      ? Math.ceil((new Date(j.deadline) - Date.now()) / 86400000)
      : null;

    const urgency = daysLeft !== null && daysLeft <= 3
      ? `<span style="color:#ef4444; font-size:0.72rem;">⚠️ ${daysLeft}d left!</span>`
      : daysLeft !== null
      ? `<span style="color:#64748b; font-size:0.72rem;">📅 ${daysLeft}d left</span>`
      : '';

    return `
      <div class="job-card">
        <div class="job-header">
          <div>
            <div class="job-title">${window.sbEsc(j.title)}</div>
            <div class="job-company">${window.sbEsc(j.company)}</div>
          </div>
          <span class="job-type-badge type-${j.type.replace('-','')}">
            ${j.type}
          </span>
        </div>

        <div class="job-meta">
          ${j.salary ? `<span>💰 ${window.sbEsc(j.salary)}</span>` : ''}
          <span>📍 ${window.sbEsc(j.location)}</span>
          ${j.experience ? `<span>🧑‍💼 ${window.sbEsc(j.experience)}</span>` : ''}
          <span>🏢 ${window.sbEsc(j.sector)}</span>
        </div>

        ${j.description ? `<div class="job-desc">${window.sbEsc(j.description)}</div>` : ''}

        ${j.skills && j.skills.length
          ? `<div class="skills-row">${j.skills.map(s => `<span class="skill-tag">${window.sbEsc(s)}</span>`).join('')}</div>`
          : ''}

        <div class="job-footer">
          <div style="display:flex; gap:0.5rem; align-items:center;">
            ${urgency}
          </div>
          <div style="display:flex; gap:0.5rem;">
            ${j.applyLink
              ? `<a href="${j.applyLink}" target="_blank" class="apply-btn">Apply Online →</a>`
              : ''}
            ${j.applyEmail
              ? `<a href="mailto:${j.applyEmail}?subject=Application: ${encodeURIComponent(j.title)}" class="apply-btn">📧 Apply via Email</a>`
              : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}