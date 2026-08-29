import { signInWithEmailAndPassword, createUserWithEmailAndPassword }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { auth } from "./firebase-config.js";

async function syncWithBackend(user) {
  const token = await user.getIdToken();
  const res = await fetch('http://localhost:5000/api/auth/sync-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });
  const data = await res.json();
  localStorage.setItem('userRole', data.user.role);
  localStorage.setItem('userEmail', data.user.email);
  return data.user;
}

// LOGIN
window.login = async () => {
  const email = document.getElementById('email').value;
  const pass = document.getElementById('password').value;
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const userData = await syncWithBackend(cred.user);
    redirectByRole(userData.role);
  } catch (err) {
    document.getElementById('error-msg').innerText = err.message;
  }
}

// REGISTER
window.register = async () => {
  const email = document.getElementById('email').value;
  const pass = document.getElementById('password').value;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const userData = await syncWithBackend(cred.user);
    redirectByRole(userData.role);
  } catch (err) {
    document.getElementById('error-msg').innerText = err.message;
  }
}

function redirectByRole(role) {
  if (role === 'admin') window.location.href = 'dashboard.html';
  else if (role === 'municipality') window.location.href = 'dashboard.html';
  else window.location.href = 'home.html';
}