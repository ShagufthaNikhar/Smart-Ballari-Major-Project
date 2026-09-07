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


  // ============================================================
  // FETCH ISSUE STATISTICS
  // ============================================================

  try {
    const res = await fetch(`${window.SB_API}/api/issues/stats`);
    const data = await res.json();

    document.getElementById('total-issues').innerText =
      data.total ?? '--';

    document.getElementById('resolved-issues').innerText =
      data.resolved ?? '--';

    document.getElementById('pending-issues').innerText =
      data.pending ?? '--';

  } catch {
    // Backend not ready yet — silently skip
  }


  // ============================================================
  // LIVE ALERTS
  // ============================================================

  loadLiveAlerts();


  // ============================================================
  // FETCH RECENT ISSUES FEED
  // ============================================================

  try {
    const res = await fetch(`${window.SB_API}/api/issues/recent`);
    const issues = await res.json();

    const feed = document.getElementById('feed-list');

    if (!issues.length) {
      feed.innerHTML = '<p>No issues reported yet.</p>';
      return;
    }

    feed.innerHTML = issues.map(i => `
      <div class="feed-card">

        <div class="feed-meta">

          <span class="tag tag-${i.status}">
            ${i.status}
          </span>

          <span class="feed-category">
            ${i.category}
          </span>

        </div>

        <p class="feed-title">
          ${window.sbEsc(i.title)}
        </p>

        <p class="feed-loc">
          📍 ${window.sbEsc(
            i.location?.address || 'Ballari'
          )}
        </p>

      </div>
    `).join('');

  } catch {
    document.getElementById('feed-list').innerHTML =
      '<p>Could not load issues.</p>';
  }

});


// ============================================================
// LIVE ALERTS
// ============================================================
// Uses the existing recent issues endpoint.
// Only OPEN issues are shown as live alerts.
// ============================================================

async function loadLiveAlerts() {

  const container =
    document.getElementById('alerts-content');

  if (!container) return;

  try {

    const res =
      await fetch(
        `${window.SB_API}/api/issues/recent`
      );

    const issues =
      await res.json();


    const critical =
      (
        Array.isArray(issues)
          ? issues
          : []
      )
      .filter(i =>
        i.status === 'open'
      )
      .slice(0, 4);


    const categoryIcon = {

      road: '🛣️',

      water: '💧',

      electric: '⚡',

      sanitation: '🗑️',

      other: '📦'

    };


    if (!critical.length) {

      container.innerHTML = `
        <p style="
          color:#22c55e;
          font-size:0.88rem;
        ">
          ✅ No active alerts right now.
        </p>
      `;

      return;
    }


    container.innerHTML =
      critical.map(i => {

        const created =
          i.createdAt
            ? new Date(i.createdAt)
            : null;


        const ago =
          created
            ? timeAgo(created)
            : 'Recently';


        return `

          <div class="alert-item">

            <div class="alert-icon">
              ${categoryIcon[i.category] || '📦'}
            </div>


            <div>

              <div class="alert-text">
                ${window.sbEsc(
                  i.title || 'Civic issue'
                )}
              </div>


              <div style="
                font-size:0.78rem;
                color:#64748b;
              ">

                📍 ${window.sbEsc(
                  i.location?.address ||
                  'Ballari'
                )}

              </div>


              <div class="alert-time">
                ${ago}
              </div>

            </div>


            <a
              href="tracker.html?id=${encodeURIComponent(
                i.grievanceId || i.id || ''
              )}"
              style="
                margin-left:auto;
                font-size:0.78rem;
                color:#38bdf8;
                text-decoration:none;
                white-space:nowrap;
              "
            >
              Track →
            </a>

          </div>

        `;

      }).join('');


  } catch (err) {

    console.error(
      'Live alerts error:',
      err
    );

    container.innerHTML = `
      <p style="
        color:#ef4444;
        font-size:0.85rem;
      ">
        ⚠️ Could not load live alerts.
      </p>
    `;

  }
}


// ============================================================
// TIME AGO HELPER
// ============================================================

function timeAgo(date) {

  const seconds =
    Math.floor(
      (Date.now() - date.getTime()) / 1000
    );


  if (seconds < 60) {
    return 'Just now';
  }


  const minutes =
    Math.floor(seconds / 60);


  if (minutes < 60) {
    return `${minutes} min ago`;
  }


  const hours =
    Math.floor(minutes / 60);


  if (hours < 24) {
    return `${hours} hr ago`;
  }


  const days =
    Math.floor(hours / 24);


  if (days === 1) {
    return 'Yesterday';
  }


  return `${days} days ago`;

}



// ============================================================
// MUNICIPALITY UPDATES
// ============================================================

async function loadUpdates() {

  const area =
    document.getElementById(
      'area-select'
    )?.value || 'all';


  try {

    const res =
      await fetch(
        `${window.SB_API}/api/updates?area=${area}`
      );


    const updates =
      await res.json();


    const container =
      document.getElementById(
        'updates-list'
      );


    if (!updates.length) {

      container.innerHTML =
        '<p style="color:#64748b;">No updates for this area.</p>';

      return;

    }


    container.innerHTML =
      updates.map(u => `

        <div class="update-card update-${u.type}">

          <div class="update-meta">

            <span class="update-badge badge-${u.type}">
              ${u.type}
            </span>

            <span class="update-area">
              📍 ${areaLabel(u.area)}
            </span>

            <span class="update-date">
              ${
                new Date(
                  u.createdAt
                ).toLocaleDateString('en-IN')
              }
            </span>

          </div>


          <h4>
            ${window.sbEsc(u.title)}
          </h4>


          <p>
            ${window.sbEsc(u.description)}
          </p>


          <small style="color:#475569;">
            Posted by:
            ${window.sbEsc(
              u.postedBy || 'Municipality'
            )}
          </small>

        </div>

      `).join('');


  } catch {

    document.getElementById(
      'updates-list'
    ).innerHTML =
      '<p style="color:#ef4444;">Could not load updates.</p>';

  }

}


function areaLabel(area) {

  const map = {

    'ballari-city':
      'Ballari City',

    'hospet':
      'Hospet',

    'siruguppa':
      'Siruguppa',

    'sandur':
      'Sandur',

    'kudligi':
      'Kudligi',

    'all':
      'All Areas'

  };


  return map[area] || area;

}



// ============================================================
// FEED CARD
// ============================================================

function buildFeedCard(issue, userVote) {

  return `

    <div
      class="feed-card"
      id="fc-${issue.id}"
    >

      <div class="feed-meta">

        <span class="tag tag-${issue.status}">
          ${issue.status}
        </span>


        <span class="feed-category">
          ${issue.category}
        </span>


        ${
          issue.verified

            ? `
              <span style="
                color:#22c55e;
                font-size:0.72rem;
              ">
                ✅ Verified
              </span>
            `

            : ''
        }


        ${
          issue.priority === 'critical' ||
          issue.priority === 'high'

            ? `
              <span style="
                color:#ef4444;
                font-size:0.72rem;
              ">
                🔺 ${issue.priority}
              </span>
            `

            : ''
        }

      </div>


      <p class="feed-title">
        ${window.sbEsc(issue.title)}
      </p>


      <p class="feed-loc">
        📍 ${window.sbEsc(
          issue.location?.address ||
          'Ballari'
        )}
      </p>


      <!-- Vote bar -->

      <div style="
        display:flex;
        align-items:center;
        gap:0.5rem;
        margin-top:0.5rem;
      ">

        <button
          onclick="voteIssue('${issue.id}','up')"
          style="
            padding:0.2rem 0.6rem;
            border-radius:6px;
            border:none;
            background:${
              userVote === 'up'
                ? '#22c55e'
                : '#0f172a'
            };
            color:${
              userVote === 'up'
                ? '#0f172a'
                : '#64748b'
            };
            cursor:pointer;
            font-size:0.78rem;
          "
        >
          👍 ${issue.upvotes || 0}
        </button>


        <button
          onclick="voteIssue('${issue.id}','down')"
          style="
            padding:0.2rem 0.6rem;
            border-radius:6px;
            border:none;
            background:${
              userVote === 'down'
                ? '#ef4444'
                : '#0f172a'
            };
            color:${
              userVote === 'down'
                ? 'white'
                : '#64748b'
            };
            cursor:pointer;
            font-size:0.78rem;
          "
        >
          👎 ${issue.downvotes || 0}
        </button>


        <button
          onclick="flagIssue('${issue.id}')"
          id="flag-${issue.id}"
          title="Report this as spam, a duplicate or inaccurate"
          style="
            padding:0.2rem 0.6rem;
            border-radius:6px;
            border:none;
            background:#0f172a;
            color:#64748b;
            cursor:pointer;
            font-size:0.78rem;
          "
        >
          ⚑ Flag
        </button>


        <span style="
          font-size:0.7rem;
          color:#475569;
          margin-left:auto;
        ">
          Score: ${issue.voteScore || 0}
        </span>

      </div>

    </div>

  `;

}



// ============================================================
// FLAG ISSUE
// ============================================================

window.flagIssue = async (issueId) => {

  const { auth } =
    await import(
      './firebase-config.js'
    );


  const token =
    await auth.currentUser?.getIdToken();


  if (!token) {

    showToast(
      'Login to flag',
      'warning'
    );

    return;

  }


  if (
    !confirm(
      'Flag this grievance as spam, duplicate or inaccurate?'
    )
  ) {

    return;

  }


  const btn =
    document.getElementById(
      `flag-${issueId}`
    );


  if (btn) {
    btn.disabled = true;
  }


  try {

    const res =
      await fetch(

        `${window.SB_API}/api/community/issues/${issueId}/flag`,

        {
          method: 'POST',

          headers: {
            'Authorization':
              `Bearer ${token}`
          }
        }

      );


    const data =
      await res.json();


    if (res.status === 409) {

      showToast(
        'You already flagged this one.',
        'info'
      );


      if (btn) {

        btn.innerText =
          `⚑ ${data.flags}`;

      }


      return;

    }


    if (!res.ok) {

      throw new Error(
        data.error ||
        'Could not flag.'
      );

    }


    showToast(
      'Flagged for review. Thanks.',
      'success'
    );


    if (btn) {

      btn.innerText =
        `⚑ ${data.flags}`;

      btn.style.color =
        '#f59e0b';

    }


  } catch (err) {

    if (btn) {
      btn.disabled = false;
    }


    showToast(
      err.message,
      'error'
    );

  }

};



// ============================================================
// VOTE ISSUE
// ============================================================

window.voteIssue = async (
  issueId,
  vote
) => {

  const { auth } =
    await import(
      './firebase-config.js'
    );


  const token =
    await auth.currentUser?.getIdToken();


  if (!token) {

    showToast(
      'Login to vote',
      'warning'
    );

    return;

  }


  try {

    const res =
      await fetch(

        `${window.SB_API}/api/community/issues/${issueId}/vote`,

        {

          method: 'POST',

          headers: {

            'Content-Type':
              'application/json',

            'Authorization':
              `Bearer ${token}`

          },

          body:
            JSON.stringify({
              vote
            })

        }

      );


    const data =
      await res.json();


    showToast(

      vote === 'up'
        ? '👍 Upvoted! +1 trust point'
        : '👎 Downvoted',

      vote === 'up'
        ? 'success'
        : 'info'

    );


    // Refresh feed

    loadUpdates?.();


  } catch {

    showToast(
      'Vote failed.',
      'error'
    );

  }

};


// ============================================================
// LOAD UPDATES ON PAGE LOAD
// ============================================================

loadUpdates();