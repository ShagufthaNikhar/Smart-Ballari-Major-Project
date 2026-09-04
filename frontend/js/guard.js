// ===================================================================
//  SAVE THIS AS:   frontend/js/guard.js
// ===================================================================
import { auth } from "./firebase-config.js";

const BACKEND = window.SB_API;

// Relative, so it works whether the static server's root is the project
// folder or the frontend/ folder. All pages are siblings inside /pages/.
const LOGIN_PAGE = 'login.html';

/**
 * Page guard. Call at the top of every protected page:
 *
 *   const me = await guard(['officer']);
 *
 * This is a UX guard, not a security boundary. It stops a citizen landing
 * on a broken empty admin page. The real enforcement is the 403 from the
 * API - which is why it is safe that this runs in the browser.
 */
export async function guard(allowedRoles) {
  const user = await new Promise(resolve => {
    const unsub = auth.onAuthStateChanged(u => { unsub(); resolve(u); });
  });

  if (!user) {
    window.location.replace(LOGIN_PAGE);
    return null;
  }

  let me;
  try {
    const token = await user.getIdToken();
    const res = await fetch(`${BACKEND}/api/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('not registered');
    me = await res.json();
  } catch {
    window.location.replace(LOGIN_PAGE);
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(me.role)) {
    window.location.replace(me.home);   // send them to their own module
    return null;
  }

  return me;
}

/** Authenticated fetch helper - attaches a fresh Firebase token. */
export async function apiFetch(path, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');

  const token = await user.getIdToken();
  const res = await fetch(`${BACKEND}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Authorization': `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Server responded ${res.status}`);
  }
  return res.json();
}