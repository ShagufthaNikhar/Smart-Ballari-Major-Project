// Pages that require login
const PROTECTED = ['home.html', 'map.html', 'dashboard.html', 'users.html'];
const ADMIN_ONLY = ['users.html', 'dashboard.html'];

function guardPage() {
  const page = window.location.pathname.split('/').pop();
  const role = localStorage.getItem('userRole');

  if (PROTECTED.includes(page) && !role) {
    window.location.href = 'login.html';
    return;
  }

  if (ADMIN_ONLY.includes(page) && !['admin', 'municipality'].includes(role)) {
    window.location.href = 'home.html';
  }
}

guardPage(); // run immediately on every page load
// Check auth on every page
function getUser() {
  return {
    role: localStorage.getItem('userRole'),
    email: localStorage.getItem('userEmail')
  };
}

function logout() {
  localStorage.clear();
  window.location.href = 'login.html';
}

// Role-based nav links
function buildNav() {
  const { role, email } = getUser();
  if (!role) { window.location.href = 'login.html'; return; }

  function getDashboardLink() {
  const role = localStorage.getItem('userRole');
  return role === 'admin' || role === 'municipality'
    ? 'admin-dashboard.html'
    : 'citizen-dashboard.html';
}
  const navLinks = {
    user: [
      { label: '🏠 Home',
      href: 'citizen-dashboard.html' },
      { label: '🏠 Home', href: 'home.html' },
      { label: '🗺️ Map', href: 'map.html' },
      { label: '📋 My Issues', href: 'my-issues.html' },
      { label: '📌 Report',      href: 'report.html'  },
    { label: '🔍 Track Issue', href: 'tracker.html' },  // ← add
    { label: '🏙️ City', href: 'city-dashboard.html' },
    { label: '🚍 Transport', href: 'transport.html' },
    { label: '🚨 Emergency', href: 'emergency.html' },
    { label: '🎙️ Voice', href: 'voice-report.html' },
    { label: '🔮 Alerts', href: 'alerts.html' },
    //{ label: '👥 Crowd', href: 'crowd.html' },
    { label: '🏰 Heritage', href: 'heritage.html' },
   // { label: '🛰️ Satellite', href: 'satellite.html' },
    { label: '⚡ Resources', href: 'resources.html' },
    { label: '🤖 Assistant', href: 'assistant.html' },
    { label: '🌆 Lifestyle', href: 'lifestyle.html' },
    { label: '💼 Services', href: 'services.html' }
    ],
    municipality: [
      { label: '🏛️ Dashboard',
      href: 'admin-dashboard.html' },
      { label: '🏠 Home', href: 'home.html' },
      { label: '🗺️ Map', href: 'map.html' },
      { label: '🔍 Track Issue', href: 'tracker.html'  }, // ← add
      { label: '📋 Dashboard',   href: 'dashboard.html'},
      { label: '🏙️ City', href: 'city-dashboard.html' },
      { label: '🚍 Transport', href: 'transport.html' },
      { label: '🚨 Emergency', href: 'emergency.html' },
      { label: '🎙️ Voice', href: 'voice-report.html' },
      { label: '🔮 Alerts', href: 'alerts.html' },
      { label: '👥 Crowd', href: 'crowd.html' },
      { label: '🏰 Heritage', href: 'heritage.html' },
      { label: '🛰️ Satellite', href: 'satellite.html' },
      { label: '⚡ Resources', href: 'resources.html' },
      { label: '🤖 Assistant', href: 'assistant.html' },
      { label: '🌆 Lifestyle', href: 'lifestyle.html' },
      { label: '💼 Services', href: 'services.html' }
    ],
    admin: [
       { label: '⚙️ Admin',
      href: 'admin-dashboard.html' },
      { label: '🏠 Home', href: 'home.html' },
      { label: '🗺️ Map', href: 'map.html' },
      { label: '🔍 Track Issue', href: 'tracker.html'  },
      //{ label: '⚙️ Dashboard', href: 'dashboard.html' },
      //{ label: '👥 Users', href: 'users.html' },
      { label: '🏙️ City', href: 'city-dashboard.html' },
      { label: '🚍 Transport', href: 'transport.html' },
      { label: '🚨 Emergency', href: 'emergency.html' },
      { label: '🎙️ Voice', href: 'voice-report.html' },
      { label: '🔮 Alerts', href: 'alerts.html' },
      //{ label: '👥 Crowd', href: 'crowd.html' },
      { label: '🏰 Heritage', href: 'heritage.html' },
      //{ label: '🛰️ Satellite', href: 'satellite.html' },
      { label: '⚡ Resources', href: 'resources.html' },
      { label: '🤖 Assistant', href: 'assistant.html' },
      { label: '🌆 Lifestyle', href: 'lifestyle.html' },
      { label: '💼 Services', href: 'services.html' }
    ]
  };

  const links = navLinks[role] || navLinks['user'];

  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  navbar.innerHTML = `
    <div class="nav-brand">🏙️ Smart Ballari</div>
    <div class="nav-links">
      ${links.map(l => `<a href="${l.href}">${l.label}</a>`).join('')}
    </div>
    <div class="nav-user">
      <span class="role-badge role-${role}">${role}</span>
      <span>${email}</span>
      <button onclick="logout()">Logout</button>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', buildNav);

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

// Floating AI assistant button — shown on all pages
function addAssistantButton() {
  const page = window.location.pathname.split('/').pop();
  if (page === 'assistant.html') return;

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
  btn.onclick   = () => window.location.href = 'assistant.html';
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