const BACKEND  = 'http://localhost:5000';
const userEmail = localStorage.getItem('userEmail') || '';
const role      = localStorage.getItem('userRole')  || 'user';

let allHalls       = [];
let selectedHallId = null;
let isHallAvailable = false;

// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadJobs();
});

// ── TAB SWITCH ────────────────────────────────────────
window.setTab = async (tab) => {
  ['jobs','colleges','halls','mybookings'].forEach(t => {
    document.getElementById(`panel-${t}`).style.display =
      t === tab ? 'block' : 'none';
  });

  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.remove('active')
  );
  event.target.classList.add('active');

  if (tab === 'jobs')       await loadJobs();
  if (tab === 'colleges')   await loadColleges();
  if (tab === 'halls')      await loadHalls();
  if (tab === 'mybookings') await loadMyBookings();
};

// ══════════════════════════════════════════════════════
// ── JOBS ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════

window.loadJobs = async () => {
  const search = document.getElementById('job-search')?.value || '';
  const type   = document.getElementById('job-type')?.value   || '';
  const sector = document.getElementById('job-sector')?.value || '';

  try {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (type)   params.set('type', type);
    if (sector) params.set('sector', sector);

    const res  = await fetch(
      `${BACKEND}/api/services/jobs?${params}`
    );
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
      ? `<span style="color:#ef4444; font-size:0.72rem;">
           ⚠️ ${daysLeft}d left!
         </span>`
      : daysLeft !== null
      ? `<span style="color:#64748b; font-size:0.72rem;">
           📅 ${daysLeft}d left
         </span>`
      : '';

    return `
      <div class="job-card">
        <div class="job-header">
          <div>
            <div class="job-title">${j.title}</div>
            <div class="job-company">${j.company}</div>
          </div>
          <span class="job-type-badge type-${j.type.replace('-','')}">
            ${j.type}
          </span>
        </div>

        <div class="job-meta">
          ${j.salary
            ? `<span>💰 ${j.salary}</span>` : ''}
          <span>📍 ${j.location}</span>
          ${j.experience
            ? `<span>🧑‍💼 ${j.experience}</span>` : ''}
          <span>🏢 ${j.sector}</span>
        </div>

        <div class="job-desc">${j.description}</div>

        <div class="skills-row">
          ${j.skills.map(s =>
            `<span class="skill-tag">${s}</span>`
          ).join('')}
        </div>

        <div class="job-footer">
          <div style="display:flex; gap:0.5rem; align-items:center;">
            ${urgency}
          </div>
          <div style="display:flex; gap:0.5rem;">
            ${j.applyLink
              ? `<a href="${j.applyLink}" target="_blank"
                   class="apply-btn">Apply Online →</a>`
              : ''}
            ${j.applyEmail
              ? `<a href="mailto:${j.applyEmail}?subject=Application: ${j.title}"
                   class="apply-btn">📧 Apply via Email</a>`
              : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ══════════════════════════════════════════════════════
// ── COLLEGES ──────────────────────────────────────────
// ══════════════════════════════════════════════════════

window.loadColleges = async () => {
  const search = document.getElementById('college-search')?.value || '';
  const type   = document.getElementById('college-type')?.value   || '';

  try {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (type)   params.set('type', type);

    const res      = await fetch(
      `${BACKEND}/api/services/colleges?${params}`
    );
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
          <div class="college-detail">
            🏛️ ${c.affiliation}
          </div>
          <div class="college-detail">
            📅 Est. ${c.established}
          </div>
          <div class="college-detail">
            📍 ${c.address}
          </div>
          <div class="college-detail">
            📞 ${c.phone}
          </div>

          <div class="courses-list">
            ${c.courses.map(cr =>
              `<span class="course-tag">${cr}</span>`
            ).join('')}
          </div>

          <div style="display:flex; flex-wrap:wrap; gap:0.3rem;
                      margin-bottom:0.5rem;">
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
              onclick="openMaps(${c.location.lat},
                ${c.location.lng},'${c.name}')"
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

// ══════════════════════════════════════════════════════
// ── HALLS ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════

async function loadHalls() {
  try {
    const res  = await fetch(`${BACKEND}/api/services/halls`);
    allHalls   = await res.json();
    renderHalls(allHalls);
  } catch {}
}

function renderHalls(halls) {
  document.getElementById('halls-list').innerHTML =
    halls.map(h => `
      <div class="hall-card" id="hcard-${h._id}"
        onclick="selectHall('${h._id}', '${h.name}')">
        <div class="hall-name">${h.name}</div>
        <div class="hall-area">📍 ${h.area}</div>
        <div class="hall-cap">👥 Capacity: ${h.capacity} people</div>
        <div class="facilities-row">
          ${h.facilities.map(f =>
            `<span class="facility-tag">✓ ${f}</span>`
          ).join('')}
        </div>
        <div class="hall-price">
          ₹${h.pricePerDay.toLocaleString()} / day
          &nbsp;·&nbsp; 📞 ${h.contact}
        </div>
      </div>
    `).join('');
}

window.selectHall = (id, name) => {
  selectedHallId = id;
  document.querySelectorAll('.hall-card').forEach(c =>
    c.classList.remove('selected')
  );
  document.getElementById(`hcard-${id}`)?.classList.add('selected');
  document.getElementById('selected-hall-name').innerText = name;

  // Re-check availability if date already set
  const date = document.getElementById('ev-date').value;
  if (date) checkAvailability();
};

window.checkAvailability = async () => {
  const date = document.getElementById('ev-date').value;
  if (!date || !selectedHallId) return;

  const el = document.getElementById('avail-status');
  el.innerHTML =
    '<p style="color:#64748b; font-size:0.78rem;">Checking...</p>';

  try {
    const res  = await fetch(
      `${BACKEND}/api/services/halls/${selectedHallId}/availability?date=${date}`
    );
    const data = await res.json();

    isHallAvailable = data.available;

    el.innerHTML = data.available
      ? `<div class="avail-badge avail-yes">✅ Available on this date</div>`
      : `<div class="avail-badge avail-no">
           ❌ Already booked on this date
         </div>`;
  } catch {
    el.innerHTML = '';
  }
};

window.submitBooking = async () => {
  if (!selectedHallId) {
    showToast('Please select a hall first.', 'warning');
    return;
  }

  if (!isHallAvailable) {
    showToast('Hall not available on selected date.', 'error');
    return;
  }

  const eventName = document.getElementById('ev-name').value.trim();
  const date      = document.getElementById('ev-date').value;

  if (!eventName || !date) {
    showToast('Event name and date are required.', 'error');
    return;
  }

  const btn = document.getElementById('book-btn');
  btn.disabled  = true;
  btn.innerText = '⏳ Submitting...';

  const payload = {
    hallId:        selectedHallId,
    eventName,
    eventType:     document.getElementById('ev-type').value,
    date,
    startTime:     document.getElementById('ev-start').value,
    endTime:       document.getElementById('ev-end').value,
    attendees:     document.getElementById('ev-attendees').value,
    notes:         document.getElementById('ev-notes').value,
    bookedBy:      userEmail.split('@')[0] || 'Citizen',
    bookedByEmail: userEmail
  };

  try {
    const res  = await fetch(`${BACKEND}/api/services/halls/book`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error);

    document.getElementById('booking-result').innerHTML = `
      <div style="background:#22c55e22; border:1px solid #22c55e;
                  border-radius:10px; padding:1rem; text-align:center;">
        <div style="color:#22c55e; font-size:1rem; font-weight:bold;">
          ✅ Booking Submitted!
        </div>
        <div style="color:#38bdf8; font-size:1.1rem;
                    letter-spacing:2px; margin:0.4rem 0;">
          ${data.bookingId}
        </div>
        <div style="color:#64748b; font-size:0.78rem;">
          Status: Pending confirmation from administration
        </div>
      </div>
    `;

    showToast(`✅ Booking ID: ${data.bookingId}`, 'success');
    btn.innerText = '📅 Submit Booking Request';
    btn.disabled  = false;
  } catch (err) {
    showToast(err.message || 'Booking failed.', 'error');
    btn.innerText = '📅 Submit Booking Request';
    btn.disabled  = false;
  }
};

// ── MY BOOKINGS ───────────────────────────────────────
async function loadMyBookings() {
  if (!userEmail) {
    document.getElementById('my-bookings-list').innerHTML =
      '<p style="color:#64748b;">Log in to see your bookings.</p>';
    return;
  }

  try {
    const res  = await fetch(
      `${BACKEND}/api/services/halls/bookings/mine?email=${userEmail}`
    );
    const data = await res.json();

    if (!data.length) {
      document.getElementById('my-bookings-list').innerHTML =
        `<div style="text-align:center; padding:2rem; color:#64748b;">
           No bookings yet. Book a hall from the Hall Booking tab.
         </div>`;
      return;
    }

    document.getElementById('my-bookings-list').innerHTML = `
      <div style="background:#1e293b; border-radius:14px;
                  border:1px solid #334155; overflow:hidden;">
        <div style="padding:0.8rem 1rem; background:#0f172a;
                    font-size:0.78rem; color:#64748b;
                    border-bottom:1px solid #334155;">
          ${data.length} booking(s)
        </div>
        <div style="padding:0 1rem;">
          ${data.map(b => `
            <div class="booking-row">
              <span class="b-status bs-${b.status}">
                ${b.status}
              </span>
              <div style="flex:1;">
                <div style="font-weight:600; font-size:0.85rem;">
                  ${b.eventName}
                </div>
                <div style="color:#64748b; font-size:0.72rem;">
                  ${b.hallName} ·
                  ${new Date(b.date).toLocaleDateString('en-IN')} ·
                  ${b.startTime}–${b.endTime}
                </div>
              </div>
              <div style="font-size:0.72rem; color:#38bdf8;">
                ${b.bookingId}
              </div>
              ${b.status === 'pending'
                ? `<button onclick="cancelBooking('${b._id}')"
                     style="padding:0.2rem 0.5rem; background:#ef444422;
                            color:#ef4444; border:1px solid #ef4444;
                            border-radius:4px; cursor:pointer;
                            font-size:0.68rem;">
                     Cancel
                   </button>`
                : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch {
    document.getElementById('my-bookings-list').innerHTML =
      '<p style="color:#ef4444;">Failed to load bookings.</p>';
  }
}

window.cancelBooking = async (id) => {
  if (!confirm('Cancel this booking?')) return;
  try {
    await fetch(`${BACKEND}/api/services/halls/bookings/${id}`, {
      method: 'DELETE'
    });
    showToast('Booking cancelled.', 'info');
    await loadMyBookings();
  } catch {
    showToast('Could not cancel.', 'error');
  }
};

// ── HELPER ────────────────────────────────────────────
window.openMaps = (lat, lng, name) => {
  window.open(
    `https://maps.google.com/?q=${lat},${lng}` +
    `&label=${encodeURIComponent(name)}`,
    '_blank'
  );
};