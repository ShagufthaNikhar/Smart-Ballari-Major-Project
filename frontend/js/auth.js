import { signInWithEmailAndPassword, createUserWithEmailAndPassword }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { auth } from "./firebase-config.js";

const BACKEND = window.SB_API;

/**
 * Registers the Firebase user in MongoDB if they are new.
 * NOTE: routes/auth.js must ignore any `role` sent by the client here.
 * New accounts are always created as 'citizen'; promotion happens only
 * through PATCH /api/admin/users/:id/role.
 */
async function syncWithBackend(user) {
  const token = await user.getIdToken();
  const res = await fetch(`${BACKEND}/api/auth/sync-user`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ token })
  });
  if (!res.ok) throw new Error('Could not complete sign-in. Please try again.');
  return res.json();
}

/**
 * The authoritative role lookup. Comes from MongoDB via a verified token,
 * so it cannot be forged the way a localStorage value can.
 */
async function fetchMe(user) {
  const token = await user.getIdToken();
  const res = await fetch(`${BACKEND}/api/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Could not load your account.');
  return res.json();
}

async function completeSignIn(cred) {
  await syncWithBackend(cred.user);
  const me = await fetchMe(cred.user);

  // Cached for drawing nav links only. Never trusted as a gate -
  // every protected page re-checks with /api/me, and the API enforces
  // the real boundary server-side.
  localStorage.setItem('userRole',  me.role);
  localStorage.setItem('userEmail', me.email);
  localStorage.setItem('userName',  me.name || '');

  // The server decides the destination.
  window.location.href = me.home;
}

function showError(err) {
  const el = document.getElementById('error-msg');
  const msg = (err && err.code === 'auth/invalid-credential')
    ? 'Incorrect email or password.'
    : (err && err.message) || 'Something went wrong.';
  if (el) el.innerText = msg;
  console.error(err);
}

window.login = async () => {
  const email = document.getElementById('email').value.trim();
  const pass  = document.getElementById('password').value;
  if (!email || !pass) return showError(new Error('Enter your email and password.'));

  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    await completeSignIn(cred);
  } catch (err) {
    showError(err);
  }
};

window.register = async () => {
  const email = document.getElementById('email').value.trim();
  const pass  = document.getElementById('password').value;
  if (!email || !pass) return showError(new Error('Enter your email and password.'));

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await completeSignIn(cred);
  } catch (err) {
    showError(err);
  }
};


window.logout = async () => {
  localStorage.removeItem('userRole');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userName');
  await auth.signOut();
  window.location.href = 'login.html';   // ← was '/pages/login.html'
};