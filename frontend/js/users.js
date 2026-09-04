const BACKEND = window.SB_API;

let allUsers    = [];
let officerLoad = {};    // userId -> open issue count
let departments = [];
let roleFilter  = 'all';
let myId        = null;  // so an admin can't try to demote themselves
let editing     = null;

document.addEventListener('DOMContentLoaded', init);

async function authHeaders(extra = {}) {
  const { auth } = await import('./firebase-config.js');
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('You must be logged in.');
  return { ...extra, 'Authorization': `Bearer ${token}` };
}

async function api(path, options = {}) {
  const res = await fetch(`${BACKEND}${path}`, {
    ...options,
    headers: await authHeaders(options.headers || {})
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Server responded ${res.status}`);
  return body;
}

async function init() {
  try {
    // Own id first: the server refuses self-demotion, so the button for the
    // current admin's own row is disabled rather than failing on click.
    const me = await api('/api/me');
    myId = me.id;

    departments = await api('/api/admin/departments');
    const sel = document.getElementById('m-dept');
    sel.innerHTML = '<option value="">Select a department…</option>' +
      departments.map(d => `<option value="${esc(d.key)}">${esc(d.label)}</option>`).join('');

    await loadUsers();
  } catch (err) {
    document.getElementById('u-body').innerHTML =
      `<tr><td colspan="5" class="empty-state">${esc(err.message)}</td></tr>`;
  }
}

// ── LOAD ──────────────────────────────────────────────
window.loadUsers = async () => {
  try {
    // /officers carries the open-issue workload that /users doesn't.
    const [users, officers] = await Promise.all([
      api('/api/admin/users'),
      api('/api/admin/officers')
    ]);
    allUsers    = users;
    officerLoad = Object.fromEntries(officers.map(o => [String(o._id), o.openIssues]));

    renderStats();
    renderUsers();
  } catch (err) {
    document.getElementById('u-body').innerHTML =
      `<tr><td colspan="5" class="empty-state">${esc(err.message)}</td></tr>`;
  }
};

function renderStats() {
  const n = r => allUsers.filter(u => u.role === r).length;
  document.getElementById('s-total').textContent    = allUsers.length;
  document.getElementById('s-citizens').textContent = n('citizen');
  document.getElementById('s-officers').textContent = n('officer');
  document.getElementById('s-admins').textContent   = n('admin');
}

window.setRoleFilter = (f) => {
  roleFilter = f;
  document.querySelectorAll('.filter-btn[data-f]')
    .forEach(b => b.classList.toggle('active', b.dataset.f === f));
  renderUsers();
};

window.renderUsers = () => {
  const q = document.getElementById('u-search').value.trim().toLowerCase();

  const rows = allUsers
    .filter(u => roleFilter === 'all' || u.role === roleFilter)
    .filter(u => !q ||
      (u.name  || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q));

  if (!rows.length) {
    document.getElementById('u-body').innerHTML =
      `<tr><td colspan="5" class="empty-state">No matching users.</td></tr>`;
    return;
  }

  document.getElementById('u-body').innerHTML = rows.map(u => {
    const dept = departments.find(d => d.key === u.department);
    const isMe = String(u._id) === String(myId);

    return `
      <tr>
        <td>
          <div class="u-name">${esc(u.name || '—')}${isMe ? ' <span class="u-mail">(you)</span>' : ''}</div>
          <div class="u-mail">${esc(u.email || '')}</div>
        </td>
        <td><span class="role-tag r-${esc(u.role)}">${esc(u.role)}</span></td>
        <td class="dept-cell">
          ${u.role === 'officer'
            ? `${esc(dept ? dept.label : u.department || '—')}
               <small>${esc(u.designation || '')}${u.employeeId ? ' · ' + esc(u.employeeId) : ''}</small>`
            : '—'}
        </td>
        <td>
          ${u.role === 'officer'
            ? `<span class="load-pill">${officerLoad[String(u._id)] || 0} open</span>`
            : '—'}
        </td>
        <td style="text-align:right;">
          <button class="row-btn"
                  onclick="openModal('${u._id}')"
                  ${isMe ? 'disabled title="You cannot change your own role"' : ''}>
            Change role
          </button>
        </td>
      </tr>`;
  }).join('');
};

// ── MODAL ─────────────────────────────────────────────
window.openModal = (id) => {
  editing = allUsers.find(u => String(u._id) === String(id));
  if (!editing) return;

  document.getElementById('m-who').textContent  = `${editing.name || ''} · ${editing.email || ''}`;
  document.getElementById('m-role').value       = editing.role;
  document.getElementById('m-dept').value       = editing.department  || '';
  document.getElementById('m-desig').value      = editing.designation || '';
  document.getElementById('m-empid').value      = editing.employeeId  || '';
  document.getElementById('m-error').textContent = '';

  toggleOfficerFields();
  document.getElementById('role-modal').classList.add('open');
};

window.closeModal = () => {
  document.getElementById('role-modal').classList.remove('open');
  editing = null;
};

window.toggleOfficerFields = () => {
  document.getElementById('officer-fields').style.display =
    document.getElementById('m-role').value === 'officer' ? 'block' : 'none';
};

window.saveRole = async () => {
  if (!editing) return;

  const role = document.getElementById('m-role').value;
  const dept = document.getElementById('m-dept').value;
  const errEl = document.getElementById('m-error');
  errEl.textContent = '';

  // The server enforces this too; checking here avoids a pointless round trip.
  if (role === 'officer' && !dept) {
    errEl.textContent = 'Pick a department — an officer account requires one.';
    return;
  }

  const btn = document.getElementById('m-save');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    await api(`/api/admin/users/${editing._id}/role`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role,
        department:  role === 'officer' ? dept : undefined,
        designation: role === 'officer' ? document.getElementById('m-desig').value : undefined,
        employeeId:  role === 'officer' ? document.getElementById('m-empid').value : undefined
      })
    });

    showToast?.(`${editing.name || 'User'} is now ${role}`, 'success');
    closeModal();
    await loadUsers();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save';
  }
};

// ── HELPERS ───────────────────────────────────────────
function esc(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}