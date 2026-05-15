import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ── FIREBASE CONFIG (AUTH ONLY) ───────────────────────
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "smart-ballari.firebaseapp.com",
  projectId: "smart-ballari",
  storageBucket: "smart-ballari.appspot.com",
  messagingSenderId: "XXXX",
  appId: "XXXX"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

const BACKEND = 'http://localhost:5000';

// ── IMAGE PREVIEW ─────────────────────────────────────
document.getElementById('r-image').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert('Image must be under 5MB');
    this.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('img-preview');
    preview.src = e.target.result;
    preview.style.display = 'block';
    document.getElementById('upload-zone').classList.add('has-file');
  };
  reader.readAsDataURL(file);
});

// ── GPS DETECT ────────────────────────────────────────
document.getElementById('gps-btn').addEventListener('click', () => {
  const status = document.getElementById('gps-status');
  status.innerText = '🔍 Detecting...';

  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      document.getElementById('r-lat').value = coords.latitude;
      document.getElementById('r-lng').value = coords.longitude;

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse` +
          `?lat=${coords.latitude}&lon=${coords.longitude}&format=json`
        );
        const data = await res.json();
        document.getElementById('r-address').value =
          data.display_name || `${coords.latitude}, ${coords.longitude}`;
        status.innerText = '✅ Location detected';
      } catch {
        document.getElementById('r-address').value =
          `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
        status.innerText = '✅ GPS captured';
      }
    },
    () => {
      status.innerText = '❌ Could not detect. Enter manually.';
    }
  );
});

// ── SUBMIT REPORT ─────────────────────────────────────
document.getElementById('submit-btn').addEventListener('click', async () => {
  const title     = document.getElementById('r-title').value.trim();
  const category  = document.getElementById('r-category').value;
  const desc      = document.getElementById('r-desc').value.trim();
  const address   = document.getElementById('r-address').value.trim();
  const lat       = parseFloat(document.getElementById('r-lat').value);
  const lng       = parseFloat(document.getElementById('r-lng').value);
  const imageFile = document.getElementById('r-image').files[0];

  if (!title)    { alert('Enter a title.'); return; }
  if (!category) { alert('Select a category.'); return; }
  if (!address)  { alert('Enter your location.'); return; }

  const btn = document.getElementById('submit-btn');
  btn.disabled  = true;
  btn.innerText = '⏳ Submitting...';

  // Show fake upload progress while backend processes
  if (imageFile) {
    document.getElementById('progress-wrap').style.display = 'block';
    let prog = 0;
    const interval = setInterval(() => {
      prog = Math.min(prog + 10, 85);
      document.getElementById('progress-bar').style.width = `${prog}%`;
    }, 200);
    btn._interval = interval;
  }

  // Build FormData — Cloudinary upload handled by backend
  const formData = new FormData();

  formData.append('data', JSON.stringify({
    title,
    category,
    description: desc,
    location: {
      coordinates: {
        lat: lat || 15.1394,
        lng: lng || 76.9214
      },
      address
    },
    status: 'open'
  }));

  if (imageFile) {
    formData.append('image', imageFile);
  }

 // Get Firebase token
  const { getAuth } = await import(
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'
  );
  const token = await getAuth().currentUser?.getIdToken();
  
  if (!token) {
    alert('You must be logged in.');
    btn.disabled  = false;
    btn.innerText = '🚀 Submit Report';
    return;
  }

  try {
    const res = await fetch(`${BACKEND}/api/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    

    // Complete progress bar
    if (btn._interval) clearInterval(btn._interval);
    document.getElementById('progress-bar').style.width = '100%';

     const saved = await res.json();

    // Show success
    document.getElementById('success-gid').innerText = saved.grievanceId;
    document.getElementById('success-card').style.display = 'block';
    btn.style.display = 'none';

  } catch {
    if (btn._interval) clearInterval(btn._interval);
    alert('Submission failed. Is backend running?');
    btn.disabled  = false;
    btn.innerText = '🚀 Submit Report';
  }
});

// ── AI CLASSIFY ───────────────────────────────────────
let classifyTimer = null;

// Auto-classify when user stops typing (debounced)
document.getElementById('r-title').addEventListener('input', debounceClassify);
document.getElementById('r-desc').addEventListener('input',  debounceClassify);

function debounceClassify() {
  clearTimeout(classifyTimer);
  classifyTimer = setTimeout(runClassify, 800);
}

async function runClassify() {
  const title = document.getElementById('r-title').value.trim();
  const desc  = document.getElementById('r-desc').value.trim();
  const text  = `${title}. ${desc}`.trim();

  if (text.length < 10) return;

  showAIBadge('loading');

  try {
    const { getAuth } = await import(
      'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'
    );
    const token = await getAuth().currentUser?.getIdToken();
    if (!token) return;

    const res  = await fetch(`${BACKEND}/api/ai/classify-text`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ text })
    });

    const data = await res.json();

    // Auto-select category
    if (data.category) {
      document.getElementById('r-category').value = data.category;
    }

    showAIBadge('done', data);

  } catch {
    showAIBadge('error');
  }
}

// Also classify image on upload
document.getElementById('r-image').addEventListener('change', async function () {
  const file = this.files[0];
  if (!file) return;

  // Preview (existing code)
  if (file.size > 5 * 1024 * 1024) {
    alert('Image must be under 5MB');
    this.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const preview = document.getElementById('img-preview');
    preview.src   = e.target.result;
    preview.style.display = 'block';
    document.getElementById('upload-zone').classList.add('has-file');

    // Classify image
    showAIBadge('loading');
    try {
      const { getAuth } = await import(
        'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'
      );
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) return;

      const res  = await fetch(`${BACKEND}/api/ai/classify-image`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ image: e.target.result })
      });

      const data = await res.json();

      // Auto-select category if not already set
      const catEl = document.getElementById('r-category');
      if (data.category && !catEl.value) {
        catEl.value = data.category;
      }

      showAIBadge('done', data);

    } catch {
      showAIBadge('error');
    }
  };
  reader.readAsDataURL(file);
});

// ── AI BADGE UI ───────────────────────────────────────
function showAIBadge(state, data = null) {
  let badge = document.getElementById('ai-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'ai-badge';
    badge.style.cssText = `
      display:flex; align-items:center; gap:0.5rem;
      padding:0.5rem 0.8rem; border-radius:8px;
      font-size:0.82rem; margin-top:0.5rem;
      transition: all 0.3s;
    `;
    document.getElementById('r-category')
      .parentElement.appendChild(badge);
  }

  if (state === 'loading') {
    badge.style.background = '#1e293b';
    badge.style.border     = '1px solid #334155';
    badge.style.color      = '#94a3b8';
    badge.innerHTML = '🤖 Classifying...';
    return;
  }

  if (state === 'error') {
    badge.style.background = '#1e293b';
    badge.style.border     = '1px solid #334155';
    badge.style.color      = '#64748b';
    badge.innerHTML = '🤖 AI unavailable — select manually';
    return;
  }

  if (state === 'done' && data) {
    const confColor = data.confidence >= 80
      ? '#22c55e'
      : data.confidence >= 60
      ? '#f59e0b'
      : '#ef4444';

    badge.style.background = '#0f172a';
    badge.style.border     = `1px solid ${confColor}`;
    badge.style.color      = '#f1f5f9';
    badge.innerHTML = `
      🤖 AI: <b style="color:${confColor}">
        ${categoryLabel(data.category)}
      </b>
      <span style="color:#64748b; font-size:0.75rem;">
        ${data.confidence}% confident
      </span>
      <button onclick="acceptAI('${data.category}')"
        style="margin-left:auto; padding:0.2rem 0.6rem;
               background:${confColor}; color:#0f172a;
               border:none; border-radius:4px;
               font-size:0.75rem; cursor:pointer;
               font-weight:bold;">
        ✓ Accept
      </button>
    `;
  }
}

window.acceptAI = (category) => {
  document.getElementById('r-category').value = category;
  showToast(`✅ Category set to ${categoryLabel(category)}`, 'success');
};

function categoryLabel(cat) {
  const map = {
    road: '🛣️ Road', water: '💧 Water',
    electric: '⚡ Electric',
    sanitation: '🗑️ Sanitation', other: '📦 Other'
  };
  return map[cat] || cat;
}