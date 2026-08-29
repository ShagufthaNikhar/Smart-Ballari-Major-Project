import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Single source of truth for Firebase config — every page that needs
// auth should import `auth` (and `app` if needed) from here instead of
// calling initializeApp()/getAuth() with its own copy of these values.
// This prevents pages silently drifting out of sync with a stale or
// placeholder config (which is what was causing "You must be logged in"
// on report.html even after a successful login).
const firebaseConfig = {
  apiKey: "AIzaSyAwcbeIdOJrRRyYy_V2wg8ssay0Dfj1zbU",
  authDomain: "smart-ballari.firebaseapp.com",
  projectId: "smart-ballari",
  storageBucket: "smart-ballari.firebasestorage.app",
  messagingSenderId: "271674607364",
  appId: "1:271674607364:web:cbf616bd0268cf90003251",
  measurementId: "G-TT9T1M1PTM"
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);