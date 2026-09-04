// NOTE: app.js is loaded as a classic script on every page, so anything
// declared at top level here shares the global lexical scope with that page's
// own script. Generic names like BACKEND collide and throw
// "Identifier 'BACKEND' has already been declared", which kills the page
// script entirely. Everything app.js owns is prefixed SB_ for that reason.
const SB_API = 'http://localhost:5000';

// ---------------------------------------------------------------
// PAGE ACCESS
//
// Roles are exactly the three the backend enum allows: citizen, officer,
// admin. Every page that loads app.js requires a login; these lists are the
// pages that additionally require a particular role.
//
// This is a UX guard, not a security boundary - it stops someone landing on
// an empty dashboard they can't populate. The real enforcement is the 403
// from the API, which is why it is safe for this to run in the browser.
// ---------------------------------------------------------------
const SB_ADMIN_ONLY   = ['dashboard.html', 'admin-dashboard.html', 'satellite.html', 'users.html'];
const SB_OFFICER_ONLY = ['officer-dashboard.html'];
const SB_STAFF_ONLY   = ['crowd.html'];              // officer or admin

function sbCurrentPage() {
  return window.location.pathname.split('/').pop();
}

/**
 * Verifies the session against the server.
 *
 * The old version read `localStorage.getItem('userRole')` and trusted it, so
 * `localStorage.setItem('userRole','admin')` in devtools was enough to open
 * the admin dashboard. The role now comes from GET /api/me via a verified
 * Firebase token, exactly like guard.js does for the officer module.
 *
 * The navbar is still drawn immediately from the cached role so the page
 * doesn't sit blank waiting on a round trip. If the server disagrees, the
 * cache is corrected and the navbar is redrawn.
 */
async function sbVerifySession() {
  const page = sbCurrentPage();

  try {
    const { auth } = await import('./firebase-config.js');

    // currentUser is usually still null this early, so wait for the first
    // auth state callback instead.
    const user = await new Promise(resolve => {
      const unsub = auth.onAuthStateChanged(u => { unsub(); resolve(u); });
    });

    if (!user) {
      window.location.replace('login.html');
      return;
    }

    const token = await user.getIdToken();
    const res   = await fetch(`${SB_API}/api/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {                    // not registered, or account disabled
      window.location.replace('login.html');
      return;
    }

    const me = await res.json();

    // The server's answer wins over whatever was cached at login time.
    if (localStorage.getItem('userRole') !== me.role) {
      localStorage.setItem('userRole',  me.role);
      localStorage.setItem('userEmail', me.email);
      localStorage.setItem('userName',  me.name || '');
      buildNav();
    }

    const denied =
      (SB_ADMIN_ONLY.includes(page)   && me.role !== 'admin') ||
      (SB_OFFICER_ONLY.includes(page) && me.role !== 'officer') ||
      (SB_STAFF_ONLY.includes(page)   && !['admin', 'officer'].includes(me.role));

    if (denied) window.location.replace(me.home);
  } catch {
    // Network or Firebase failure. Deliberately fails open: the API still
    // rejects every unauthorised call, so the worst case is an empty page
    // rather than a user locked out of the whole site by a flaky connection.
  }
}

// Check auth on every page
function getUser() {
  return {
    role: localStorage.getItem('userRole'),
    email: localStorage.getItem('userEmail')
  };
}

async function logout() {
  // Clearing localStorage alone leaves the Firebase session alive, so the
  // next page load silently signs the user back in. Sign out properly.
  try {
    const { auth } = await import('./firebase-config.js');
    await auth.signOut();
  } catch (err) {
    console.warn('[logout] Firebase sign-out skipped:', err.message);
  }
  localStorage.clear();
  sessionStorage.removeItem('sb-manages-hall');
  window.location.href = 'login.html';
}

// ---------------------------------------------------------------
// VISIT TRACKER — records every page the user opens so the citizen
// dashboard can show "Recently Visited". Stored in localStorage
// under 'sb-visits', newest first, capped at 10 entries.
// ---------------------------------------------------------------
const VISIT_SKIP = [
  '', 'index.html', 'login.html',
  'citizen-dashboard.html', 'admin-dashboard.html'
];

function trackVisit() {
  const page = window.location.pathname.split('/').pop();
  if (VISIT_SKIP.includes(page)) return;

  let visits = [];
  try {
    visits = JSON.parse(localStorage.getItem('sb-visits') || '[]');
  } catch (err) {
    visits = [];
  }
  if (!Array.isArray(visits)) visits = [];

  // Clean page title as a fallback label ("Smart Ballari — Map" -> "Map")
  const title = (document.title || page)
    .replace(/^Smart Ballari\s*[—–-]\s*/i, '')
    .trim();

  visits = visits.filter(v => v && v.page !== page); // drop older entry
  visits.unshift({ page, title, ts: Date.now() });   // newest first

  localStorage.setItem('sb-visits', JSON.stringify(visits.slice(0, 10)));
}

// ---------------------------------------------------------------
// Nav structure — grouped into dropdowns instead of one flat row.
// Order: Home, Map, Report, Services, Tools, Emergency, City, Dashboard
// ---------------------------------------------------------------
function getNavStructure(role) {
  const dashboardLink =
    role === 'admin'
      ? { label: '⚙️ Admin', href: 'admin-dashboard.html' }
      : role === 'officer'
      ? { label: '👮 Officer Desk', href: 'officer-dashboard.html' }
      : { label: '📊 Dashboard', href: 'citizen-dashboard.html' };

  const structure = [
    { label: '🏠 Home', href: 'home.html' },
    { label: '🗺️ Map', href: 'map.html' },

    { type: 'dropdown', label: '📌 Report', items: [
      { label: 'Report Issue', href: 'report.html' },
      { label: 'My Issues', href: 'my-issues.html' },
      { label: 'Track Issue', href: 'tracker.html' }
    ]},

    { type: 'dropdown', label: '💼 Services', items: [
      { label: 'All Services', href: 'services.html' },
      { label: '🏛️ Civic Services Portal', href: 'civic-portal.html' },
      { label: '🏢 Government Offices', href: 'govt-offices.html' },
      { label: '💼 Job Portal', href: 'jobs.html' },
      { label: '🎓 Colleges', href: 'colleges.html' },
      { label: '🏛️ Hall Booking', href: 'hall-booking.html' },
      { label: '🏛️ Municipality Updates', href: 'municipality-updates.html' }
    ]},

    { type: 'dropdown', label: '🛠️ Tools', items: [
      { label: '🎙️ Voice Report', href: 'voice-report.html' },
      { label: '🤖 Assistant', href: 'assistant.html' },
      { label: '⚡ Resources', href: 'resources.html' },
      { label: '🔮 Alerts', href: 'alerts.html' },
      ...(role !== 'citizen' ? [{ label: '👥 Crowd', href: 'crowd.html' }] : []),
      ...(role === 'admin'
        ? [{ label: '🛰️ Satellite', href: 'satellite.html' }]
        : [])
    ]},

    { label: '🚨 Emergency', href: 'emergency.html', className: 'nav-link-alert' },

    { type: 'dropdown', label: '🏙️ City', items: [
      { label: 'City Dashboard', href: 'city-dashboard.html' },
      { label: 'Transport', href: 'transport.html' },
      { label: 'Heritage', href: 'heritage.html' },
      { label: 'Lifestyle', href: 'lifestyle.html' }
    ]},

    dashboardLink,

    // User management is the only way to create an officer, so it gets its
    // own top-level entry rather than hiding in a dropdown.
    ...(role === 'admin'
      ? [{ label: '👥 Users', href: 'users.html' }]
      : [])
  ];

  return structure;
}

function buildNav() {
  const { role, email } = getUser();
  if (!role) { window.location.href = 'login.html'; return; }

  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  const structure = getNavStructure(role);

  const renderItem = (item) => {
    if (item.type === 'dropdown') {
      return `
        <div class="nav-dropdown">
          <button type="button" class="nav-dropdown-toggle">
            ${item.label} <span class="caret">▾</span>
          </button>
          <div class="nav-dropdown-menu">
            ${item.items.map(sub => `<a href="${sub.href}">${sub.label}</a>`).join('')}
          </div>
        </div>
      `;
    }
    return `<a href="${item.href}" class="${item.className || ''}">${item.label}</a>`;
  };

  navbar.innerHTML = `
    <div class="nav-brand">🏙️ Smart Ballari</div>
    <div class="nav-links">
      ${structure.map(renderItem).join('')}
    </div>
    <div class="nav-user">
      <span class="role-badge role-${role}">${role}</span>
      <span class="nav-email">${email}</span>
      <button onclick="logout()">Logout</button>
    </div>
  `;

  initDropdowns(navbar);
  sbMaybeAddHallOwnerLink(navbar);
}

// ---------------------------------------------------------------
// HALL OWNER LINK - shown only to people who actually manage a hall.
//
// Hall ownership is not a role in the User enum, it is a managerUid on the
// hall itself (the same way an officer is scoped by department). So there is
// nothing in localStorage to check and we have to ask the server. The answer
// is cached in sessionStorage so this costs ONE request per browser session,
// not one per page load.
// ---------------------------------------------------------------
async function sbMaybeAddHallOwnerLink(navbar) {
  const CACHE = 'sb-manages-hall';
  const cached = sessionStorage.getItem(CACHE);

  if (cached === 'no') return;
  if (cached === 'yes') { sbInjectHallLink(navbar); return; }

  try {
    const { auth } = await import('./firebase-config.js');

    // currentUser is often still null at DOMContentLoaded, so wait for the
    // first auth state callback rather than firing an anonymous request.
    const user = await new Promise(resolve => {
      const unsub = auth.onAuthStateChanged(u => { unsub(); resolve(u); });
    });
    if (!user) return;

    const token = await user.getIdToken();
    const res   = await fetch(`${SB_API}/api/services/halls/mine`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;

    const data = await res.json();
    const owns = Array.isArray(data.halls) && data.halls.length > 0;
    sessionStorage.setItem(CACHE, owns ? 'yes' : 'no');
    if (owns) sbInjectHallLink(navbar);
  } catch {
    // Never let this break the navbar - it is an extra link, not a gate.
  }
}

function sbInjectHallLink(navbar) {
  if (navbar.querySelector('[data-hall-owner]')) return;
  const links = navbar.querySelector('.nav-links');
  if (!links) return;

  const a = document.createElement('a');
  a.href = 'my-hall.html';
  a.dataset.hallOwner = '1';
  a.textContent = '\u{1F3DB}\uFE0F My Hall';
  links.appendChild(a);
}

// Click-based dropdown toggling (works on touch + desktop, no hover reliance)
function initDropdowns(navbar) {
  const dropdowns = navbar.querySelectorAll('.nav-dropdown');

  dropdowns.forEach(dd => {
    const toggle = dd.querySelector('.nav-dropdown-toggle');
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dd.classList.contains('open');
      dropdowns.forEach(other => other.classList.remove('open'));
      if (!isOpen) dd.classList.add('open');
    });
  });

  document.addEventListener('click', () => {
    dropdowns.forEach(dd => dd.classList.remove('open'));
  });
}

// Inject nav styles once (keeps this self-contained, same pattern as
// the toast/assistant-button style injection below)
function injectNavStyles() {
  if (document.getElementById('smart-ballari-nav-styles')) return;

  const style = document.createElement('style');
  style.id = 'smart-ballari-nav-styles';
  style.innerText = `
    #navbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.6rem 1.2rem;
      background: #0f172a;
      border-bottom: 1px solid #1e293b;
      flex-wrap: wrap;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .nav-brand {
      font-weight: 700;
      color: #38bdf8;
      white-space: nowrap;
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      flex-wrap: wrap;
    }
    .nav-links > a {
      color: #cbd5e1;
      text-decoration: none;
      font-size: 0.88rem;
      padding: 0.45rem 0.7rem;
      border-radius: 8px;
      white-space: nowrap;
      transition: background 0.15s, color 0.15s;
    }
    .nav-links > a:hover {
      background: #1e293b;
      color: #38bdf8;
    }
    .nav-link-alert {
      color: #f87171 !important;
      font-weight: 600;
    }
    .nav-link-alert:hover {
      background: rgba(248,113,113,0.12) !important;
      color: #f87171 !important;
    }
    .nav-dropdown {
      position: relative;
    }
    .nav-dropdown-toggle {
      background: none;
      border: none;
      color: #cbd5e1;
      font-size: 0.88rem;
      padding: 0.45rem 0.7rem;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.25rem;
      font-family: inherit;
    }
    .nav-dropdown-toggle:hover {
      background: #1e293b;
      color: #38bdf8;
    }
    .nav-dropdown.open .nav-dropdown-toggle {
      background: #1e293b;
      color: #38bdf8;
    }
    .caret {
      font-size: 0.7rem;
      transition: transform 0.15s;
    }
    .nav-dropdown.open .caret {
      transform: rotate(180deg);
    }
    .nav-dropdown-menu {
      display: none;
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      min-width: 170px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 10px;
      padding: 0.4rem;
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
      z-index: 1000;
    }
    .nav-dropdown.open .nav-dropdown-menu {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }
    .nav-dropdown-menu a {
      color: #cbd5e1;
      text-decoration: none;
      font-size: 0.85rem;
      padding: 0.4rem 0.6rem;
      border-radius: 6px;
      white-space: nowrap;
    }
    .nav-dropdown-menu a:hover {
      background: #334155;
      color: #38bdf8;
    }
    .nav-user {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 0.82rem;
      color: #94a3b8;
      white-space: nowrap;
    }
    .role-badge {
      padding: 0.15rem 0.55rem;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      background: #22c55e;
      color: #0f172a;
    }
    .role-badge.role-admin { background: #f59e0b; }
    .role-badge.role-officer { background: #a78bfa; }
    .nav-user button {
      background: #ef4444;
      color: white;
      border: none;
      padding: 0.4rem 0.8rem;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
    }
    .nav-user button:hover {
      background: #dc2626;
    }
    @media (max-width: 900px) {
      .nav-email { display: none; }
    }
  `;
  document.head.appendChild(style);
}

document.addEventListener('DOMContentLoaded', () => {
  injectNavStyles();
  buildNav();      // instant, from the cached role - cosmetic only
  trackVisit();
  sbVerifySession(); // authoritative, from the server
});

// Add to bottom of app.js
function showToast(message, type = 'info') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const colors = {
    success: '#22c55e',
    error:   '#ef4444',
    info:    '#38bdf8',
    warning: '#f59e0b'
  };

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.innerText = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: ${colors[type] || colors.info};
    color: ${type === 'warning' || type === 'success' ? '#0f172a' : 'white'};
    padding: 0.8rem 1.4rem;
    border-radius: 10px;
    font-size: 0.9rem;
    font-weight: bold;
    z-index: 9999;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    animation: slideUp 0.3s ease;
  `;

  const style = document.createElement('style');
  style.innerText = `
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3500);
}

// Lazy-load the assistant chat logic + widget shell the first time
// the floating button is clicked, then just toggle it on later clicks.
// Figure out which folder app.js itself was loaded from, so the two
// assistant scripts load from the same place regardless of how deep
// the current page sits (no more hardcoded '../js/' guess).
function getScriptBaseDir() {
  const appScript = document.querySelector('script[src*="app.js"]');
  if (!appScript) return '../js/'; // fallback, shouldn't normally happen
  const src = appScript.getAttribute('src');
  return src.slice(0, src.lastIndexOf('/') + 1);
}

let assistantScriptsLoading = null;
function loadAssistantScripts() {
  if (assistantScriptsLoading) return assistantScriptsLoading;

  const base = getScriptBaseDir();

  assistantScriptsLoading = new Promise((resolve, reject) => {
    let loaded = 0;
    const done = () => { loaded++; if (loaded === 2) resolve(); };
    const fail = (src) => (e) => {
      console.error(`Smart Ballari Assistant: failed to load ${src}. ` +
        `Check that the file exists at that path.`, e);
      reject(new Error(`Failed to load ${src}`));
    };

    const s1 = document.createElement('script');
    s1.src = base + 'assistant.js';
    s1.onload = done;
    s1.onerror = fail(s1.src);
    document.body.appendChild(s1);

    const s2 = document.createElement('script');
    s2.src = base + 'assistant-widget.js';
    s2.onload = done;
    s2.onerror = fail(s2.src);
    document.body.appendChild(s2);
  });

  // If it fails, clear the cache so the next click retries instead of
  // being stuck forever on a rejected promise.
  assistantScriptsLoading.catch(() => { assistantScriptsLoading = null; });

  return assistantScriptsLoading;
}

// Floating AI assistant button — shown on all pages, opens a small
// draggable widget instead of navigating to a full page.
function addAssistantButton() {
  const page = window.location.pathname.split('/').pop();
  if (page === 'assistant.html') return; // full page already has the assistant inline

  const btn = document.createElement('div');
  btn.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: linear-gradient(135deg, #38bdf8, #7c3aed);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    cursor: pointer;
    z-index: 9999;
    box-shadow: 0 4px 20px rgba(56,189,248,0.4);
    animation: floatPulse 3s infinite;
    transition: transform 0.2s;
  `;
  btn.innerText = '🤖';
  btn.title     = 'Open AI Assistant';
  btn.onclick   = async () => {
    if (!window.toggleAssistantWidget) {
      btn.innerText = '⏳';
      try {
        await loadAssistantScripts();
      } catch (err) {
        btn.innerText = '🤖';
        showToast?.('Could not load the assistant. Check console for the missing file path.', 'error');
        return;
      }
      btn.innerText = '🤖';
    }
    if (typeof window.toggleAssistantWidget === 'function') {
      window.toggleAssistantWidget();
    } else {
      console.error('Smart Ballari Assistant: scripts loaded but toggleAssistantWidget is still undefined — check assistant-widget.js for a runtime error.');
      showToast?.('Assistant failed to initialize — check console.', 'error');
    }
  };
  btn.onmouseenter = () => btn.style.transform = 'scale(1.1)';
  btn.onmouseleave = () => btn.style.transform = 'scale(1)';

  const style = document.createElement('style');
  style.innerText = `
    @keyframes floatPulse {
      0%,100% { box-shadow: 0 4px 20px rgba(56,189,248,0.4); }
      50%      { box-shadow: 0 4px 32px rgba(124,58,237,0.6); }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(btn);
}

document.addEventListener('DOMContentLoaded', addAssistantButton);

// Make globally accessible
window.showToast = showToast;

// Shared helper — opens Google Maps directions in a new tab.
// Used by the Colleges page and any other page needing a "Directions" button.
window.openMaps = (lat, lng, name) => {
  window.open(
    `https://maps.google.com/?q=${lat},${lng}&label=${encodeURIComponent(name)}`,
    '_blank'
  );
};