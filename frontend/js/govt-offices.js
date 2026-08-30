// Static reference data — government office directories don't change
// often enough to need a backend round-trip, so this lives client-side.
// Two corrections vs. the original mockup, cross-checked against
// official sources (ballari.nic.in and the RTO's own listing):
//   - Deputy Commissioner's Office phone: 08392-277100 (was 08392-240111)
//   - RTO Office phone: 08392-240048 (was 08392-244333)
// Everything else here is unverified beyond the original reference —
// double-check before publishing, government office numbers do change.
const GOVT_OFFICES = [
  {
    name: 'Forest Department Office Ballari',
    category: 'Forest',
    categoryLabel: 'Forest Office',
    icon: '🌿',
    color: '#22c55e',
    desc: 'Forest conservation, wildlife protection and timber permits.',
    address: 'Deputy Conservator of Forests, Forest Department Office, Hampi Road, Ballari',
    hours: 'Mon–Sat: 10:00 AM – 5:30 PM',
    phone: '08392-244422'
  },
  {
    name: 'MESCOM Office Ballari',
    category: 'Electricity',
    categoryLabel: 'Electricity Office',
    icon: '⚡',
    color: '#f59e0b',
    desc: 'Electricity supply, new connections and power-related services.',
    address: 'Mangalore Electricity Supply Company (MESCOM), Hampi Road, Ballari',
    hours: 'Mon–Sat: 9:00 AM – 5:30 PM',
    phone: '1912'
  },
  {
    name: 'Ballari City Municipal Corporation',
    category: 'Municipal',
    categoryLabel: 'Municipal Office',
    icon: '🏛️',
    color: '#0ea5e9',
    desc: 'Civic administration, property tax, and urban services for Ballari city.',
    address: 'Gadigichennappa Circle (Royal Circle), Ballari',
    hours: 'Mon–Sat: 10:00 AM – 5:30 PM',
    phone: '08392-273479',
    website: 'http://ballaricity.mrc.gov.in'
  },
  {
    name: 'Ballari Head Post Office',
    category: 'Post Office',
    categoryLabel: 'Post Office',
    icon: '✉️',
    color: '#ef4444',
    desc: 'Head post office for Ballari city and district.',
    address: 'Head Post Office, Gandhi Nagar, Ballari',
    hours: 'Mon–Sat: 9:00 AM – 6:00 PM',
    phone: '08392-250221'
  },
  {
    name: "Tahsildar's Office Ballari",
    category: 'Revenue',
    categoryLabel: 'Taluk Office',
    icon: '🏛️',
    color: '#22c55e',
    desc: 'Revenue administration, land records and certificates at taluk level.',
    address: "Tahsildar's Office, DC Office Complex, Ballari",
    hours: 'Mon–Sat: 10:00 AM – 5:30 PM',
    phone: '08392-240222'
  },
  {
    name: "Deputy Commissioner's Office",
    category: 'Commissioner',
    categoryLabel: 'Commissioner Office',
    icon: '🏢',
    color: '#a78bfa',
    desc: 'District administration headquarters for Ballari district.',
    address: 'DC Office, Opposite Railway Station, Ballari – 583101',
    hours: 'Mon–Sat: 10:00 AM – 5:30 PM',
    phone: '08392-277100',
    website: 'https://ballari.nic.in'
  },
  {
    name: 'RTO Office Ballari',
    category: 'RTO',
    categoryLabel: 'RTO Office',
    icon: '🚗',
    color: '#f97316',
    desc: 'Vehicle registration, driving licenses and transport permits.',
    address: 'Regional Transport Office, Bellary–Hospet Road, Cantonment, Ballari – 583103',
    hours: 'Mon–Sat: 9:00 AM – 5:30 PM',
    phone: '08392-240048',
    website: 'https://transport.karnataka.gov.in'
  },
  {
    name: 'Superintendent of Police Office',
    category: 'Police',
    categoryLabel: 'Police Office',
    icon: '🛡️',
    color: '#38bdf8',
    desc: 'District police administration and law enforcement headquarters.',
    address: 'Office of the Superintendent of Police, SP Office Road, Ballari',
    hours: '24×7',
    phone: '08392-244666'
  },
  {
    name: 'Passport Seva Kendra Ballari',
    category: 'Passport',
    categoryLabel: 'Passport Office',
    icon: '📘',
    color: '#38bdf8',
    desc: 'Passport application, renewal and verification services.',
    address: 'Passport Seva Kendra, 1st Floor, Vasavi Towers, TB Road, Camp Area, Ballari',
    hours: 'Mon–Fri: 9:00 AM – 5:00 PM',
    phone: '1800-258-1800',
    website: 'https://www.passportindia.gov.in'
  },
  {
    name: 'District & Sessions Court Ballari',
    category: 'Court',
    categoryLabel: 'Court',
    icon: '⚖️',
    color: '#1e293b',
    desc: 'Principal civil and criminal court for Ballari district.',
    address: 'District & Sessions Court Complex, Court Road, Ballari',
    hours: 'Mon–Fri: 10:00 AM – 5:00 PM',
    phone: '08392-244555'
  },
  {
    name: 'BSNL Office Ballari',
    category: 'BSNL',
    categoryLabel: 'BSNL Office',
    icon: '📞',
    color: '#6366f1',
    desc: 'Telecom services, landline, broadband and mobile connections.',
    address: 'BSNL General Manager Office, Gandhi Nagar, Ballari',
    hours: 'Mon–Sat: 9:00 AM – 6:00 PM',
    phone: '08392-246700'
  },
  {
    name: 'Ballari Water Supply Division',
    category: 'Water Board',
    categoryLabel: 'Water Board Office',
    icon: '💧',
    color: '#0ea5e9',
    desc: 'Drinking water supply, water tax and pipeline connections.',
    address: 'Water Supply Division, City Municipal Corporation, Ballari',
    hours: 'Mon–Sat: 10:00 AM – 5:30 PM',
    phone: '08392-242222'
  }
];

document.addEventListener('DOMContentLoaded', () => {
  populateCategoryDropdown();
  renderOffices();
});

function populateCategoryDropdown() {
  const select = document.getElementById('go-category-select');
  const categories = [...new Set(GOVT_OFFICES.map(o => o.category))].sort();
  select.innerHTML =
    '<option value="all">All Offices</option>' +
    categories.map(c => `<option value="${c}">${c}</option>`).join('');
}

window.renderOffices = () => {
  const search   = (document.getElementById('go-search-input').value || '').trim().toLowerCase();
  const category = document.getElementById('go-category-select').value;

  const filtered = GOVT_OFFICES.filter(o => {
    if (category !== 'all' && o.category !== category) return false;
    if (search) {
      const haystack = `${o.name} ${o.address} ${o.categoryLabel}`.toLowerCase();
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

  grid.innerHTML = filtered.map(o => `
    <div class="go-card">
      <div class="go-card-top">
        <div class="go-icon" style="background:${o.color};">${o.icon}</div>
        <div class="go-card-title">
          <h4>${escapeHtml(o.name)}</h4>
          <span class="go-cat-badge">${escapeHtml(o.categoryLabel)}</span>
        </div>
      </div>

      <p class="go-desc">${escapeHtml(o.desc)}</p>

      <div class="go-detail">📍 <span>${escapeHtml(o.address)}</span></div>
      <div class="go-detail">🕒 <span>${escapeHtml(o.hours)}</span></div>
      <div class="go-detail">
        📞 <a href="tel:${o.phone.replace(/[^\d]/g, '')}">${escapeHtml(o.phone)}</a>
      </div>
      ${o.website
        ? `<div class="go-detail">🌐 <a href="${o.website}" target="_blank" rel="noopener">${escapeHtml(o.website.replace('https://', '').replace('http://', ''))}</a></div>`
        : ''}

      <a class="go-directions-btn" target="_blank" rel="noopener"
         href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.name + ', ' + o.address)}">
        📍 Get Directions
      </a>
    </div>
  `).join('');
};

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}