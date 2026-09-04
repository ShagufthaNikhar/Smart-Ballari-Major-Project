document.addEventListener('DOMContentLoaded', async () => {
  const role = localStorage.getItem('userRole');

  // Role-aware quick actions
  const actions = {
    citizen: [
      { icon: '📌', label: 'Report Issue', href: 'report.html' },
      { icon: '🗺️', label: 'View Map', href: 'map.html' },
      { icon: '📋', label: 'My Reports', href: 'my-issues.html' }
    ],
    officer: [
      { icon: '👮', label: 'Officer Desk', href: 'officer-dashboard.html' },
      { icon: '🗺️', label: 'View Map', href: 'map.html' },
      { icon: '🔍', label: 'Track Issue', href: 'tracker.html' }
    ],
    admin: [
      { icon: '⚙️', label: 'Admin Central', href: 'admin-dashboard.html' },
      { icon: '📊', label: 'Issue Manager', href: 'dashboard.html' },
      { icon: '🗺️', label: 'Full Map', href: 'map.html' },
      { icon: '👥', label: 'Manage Users', href: 'users.html' }
    ]
  };

  const qa = document.getElementById('quick-actions');
  const cards = actions[role] || actions.citizen;
  qa.innerHTML = `
    <h2>Quick Actions</h2>
    <div class="qa-grid">
      ${cards.map(c => `
        <a href="${c.href}" class="qa-card">
          <span class="qa-icon">${c.icon}</span>
          <span>${c.label}</span>
        </a>
      `).join('')}
    </div>
  `;

  // Fetch stats from backend
  try {
    const res = await fetch('http://localhost:5000/api/issues/stats');
    const data = await res.json();
    document.getElementById('total-issues').innerText = data.total ?? '--';
    document.getElementById('resolved-issues').innerText = data.resolved ?? '--';
    document.getElementById('pending-issues').innerText = data.pending ?? '--';
  } catch {
    // Backend not ready yet — silently skip
  }

  // Fetch recent issues feed
  try {
    const res = await fetch('http://localhost:5000/api/issues/recent');
    const issues = await res.json();
    const feed = document.getElementById('feed-list');
    if (!issues.length) {
      feed.innerHTML = '<p>No issues reported yet.</p>';
      return;
    }
    feed.innerHTML = issues.map(i => `
      <div class="feed-card">
        <div class="feed-meta">
          <span class="tag tag-${i.status}">${i.status}</span>
          <span class="feed-category">${i.category}</span>
        </div>
        <p class="feed-title">${i.title}</p>
        <p class="feed-loc">📍 ${i.location?.address || 'Ballari'}</p>
      </div>
    `).join('');
  } catch {
    document.getElementById('feed-list').innerHTML = '<p>Could not load issues.</p>';
  }
  
});

// Add this function to home.js

async function loadUpdates() {
  const area = document.getElementById('area-select')?.value || 'all';
  try {
    const res = await fetch(
      `http://localhost:5000/api/updates?area=${area}`
    );
    const updates = await res.json();
    const container = document.getElementById('updates-list');

    if (!updates.length) {
      container.innerHTML = '<p style="color:#64748b;">No updates for this area.</p>';
      return;
    }

    container.innerHTML = updates.map(u => `
      <div class="update-card update-${u.type}">
        <div class="update-meta">
          <span class="update-badge badge-${u.type}">${u.type}</span>
          <span class="update-area">📍 ${areaLabel(u.area)}</span>
          <span class="update-date">
            ${new Date(u.createdAt).toLocaleDateString('en-IN')}
          </span>
        </div>
        <h4>${u.title}</h4>
        <p>${u.description}</p>
        <small style="color:#475569;">Posted by: ${u.postedBy || 'Municipality'}</small>
      </div>
    `).join('');
  } catch {
    document.getElementById('updates-list').innerHTML =
      '<p style="color:#ef4444;">Could not load updates.</p>';
  }
}

function areaLabel(area) {
  const map = {
    'ballari-city': 'Ballari City',
    'hospet': 'Hospet',
    'siruguppa': 'Siruguppa',
    'sandur': 'Sandur',
    'kudligi': 'Kudligi',
    'all': 'All Areas'
  };
  return map[area] || area;
}


// Add to feed card in home.js
function buildFeedCard(issue, userVote) {
  return `
    <div class="feed-card" id="fc-${issue._id}">
      <div class="feed-meta">
        <span class="tag tag-${issue.status}">${issue.status}</span>
        <span class="feed-category">${issue.category}</span>
        ${issue.verified
          ? '<span style="color:#22c55e; font-size:0.72rem;">✅ Verified</span>'
          : ''}
        ${issue.priority === 'critical' || issue.priority === 'high'
          ? `<span style="color:#ef4444; font-size:0.72rem;">
               🔺 ${issue.priority}
             </span>`
          : ''}
      </div>
      <p class="feed-title">${issue.title}</p>
      <p class="feed-loc">📍 ${issue.location?.address || 'Ballari'}</p>

      <!-- Vote bar -->
      <div style="display:flex; align-items:center; gap:0.5rem;
                  margin-top:0.5rem;">
        <button onclick="voteIssue('${issue._id}','up')"
          style="padding:0.2rem 0.6rem; border-radius:6px; border:none;
                 background:${userVote === 'up' ? '#22c55e' : '#0f172a'};
                 color:${userVote === 'up' ? '#0f172a' : '#64748b'};
                 cursor:pointer; font-size:0.78rem;">
          👍 ${issue.upvotes?.length || 0}
        </button>
        <button onclick="voteIssue('${issue._id}','down')"
          style="padding:0.2rem 0.6rem; border-radius:6px; border:none;
                 background:${userVote === 'down' ? '#ef4444' : '#0f172a'};
                 color:${userVote === 'down' ? 'white' : '#64748b'};
                 cursor:pointer; font-size:0.78rem;">
          👎 ${issue.downvotes?.length || 0}
        </button>
        <span style="font-size:0.7rem; color:#475569; margin-left:auto;">
          Score: ${issue.voteScore || 0}
        </span>
      </div>
    </div>
  `;
}

// Vote handler — add to home.js
window.voteIssue = async (issueId, vote) => {
  const { auth } = await import('./firebase-config.js');
  const token = await auth.currentUser?.getIdToken();
  if (!token) { showToast('Login to vote', 'warning'); return; }

  try {
    const res  = await fetch(
      `${BACKEND}/api/community/issues/${issueId}/vote`,
      {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ vote })
      }
    );
    const data = await res.json();
    showToast(
      vote === 'up' ? '👍 Upvoted! +1 trust point' : '👎 Downvoted',
      vote === 'up' ? 'success' : 'info'
    );
    // Refresh feed
    loadUpdates?.();
  } catch {
    showToast('Vote failed.', 'error');
  }
};
// Call on page load
loadUpdates();