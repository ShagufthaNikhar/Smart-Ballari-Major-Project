const BACKEND = 'http://localhost:5000';

// ── STATE ──────────────────────────────────────────────
let recognition    = null;
let isRecording    = false;
let finalTranscript = '';
let interimText    = '';
let selectedLang   = 'en-IN';
let detectedLat    = null;
let detectedLng    = null;
let aiResult       = null;
let classifyTimer  = null;

// ── INIT ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkBrowserSupport();
  detectVoiceLocation();   // auto-detect on load
});

function checkBrowserSupport() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    document.getElementById('not-supported').style.display = 'block';
    document.getElementById('mic-btn').disabled = true;
    document.getElementById('mic-status').innerText =
      'Voice not supported';
    return;
  }

  initRecognition(SpeechRecognition);
}

// ── RECOGNITION SETUP ─────────────────────────────────
function initRecognition(SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous      = true;
  recognition.interimResults  = true;
  recognition.lang            = selectedLang;
  recognition.maxAlternatives = 1;

  // Result handler
  recognition.onresult = (e) => {
    interimText  = '';
    let newFinal = '';

    for (let i = e.resultIndex; i < e.results.length; i++) {
      const text = e.results[i][0].transcript;
      if (e.results[i].isFinal) {
        newFinal += text + ' ';
      } else {
        interimText += text;
      }
    }

    if (newFinal) {
      finalTranscript += newFinal;
    }

    // Show in textarea
    const textarea = document.getElementById('transcript-text');
    textarea.value = finalTranscript + interimText;
    textarea.classList.toggle('interim', !!interimText);

    // Auto-scroll
    textarea.scrollTop = textarea.scrollHeight;

    // Debounce AI classify
    if (finalTranscript.length > 15) {
      clearTimeout(classifyTimer);
      classifyTimer = setTimeout(runAIClassify, 1200);
    }
  };

  recognition.onerror = (e) => {
    if (e.error === 'no-speech') {
      setStatus('No speech detected. Try again.', 'warning');
    } else if (e.error === 'not-allowed') {
      setStatus('Microphone blocked. Allow mic access.', 'error');
    } else {
      setStatus(`Error: ${e.error}`, 'error');
    }
    stopRecording();
  };

  recognition.onend = () => {
    if (isRecording) {
      // Auto-restart if still in recording mode
      try { recognition.start(); } catch {}
    }
  };
}

// ── LANGUAGE ───────────────────────────────────────────
window.setLang = (lang, btn) => {
  selectedLang = lang;
  document.querySelectorAll('.lang-btn').forEach(b =>
    b.classList.remove('active')
  );
  btn.classList.add('active');

  const hints = {
    'en-IN': 'Describe the issue in English',
    'kn-IN': 'ಸಮಸ್ಯೆಯನ್ನು ಕನ್ನಡದಲ್ಲಿ ವಿವರಿಸಿ',
    'hi-IN': 'समस्या को हिंदी में बताएं',
    'te-IN': 'తెలుగులో సమస్యను వివరించండి'
  };
  document.getElementById('mic-hint').innerText =
    hints[lang] || 'Describe the issue';

  if (recognition) recognition.lang = lang;
  if (isRecording) {
    stopRecording();
    showToast('Language changed. Tap mic to restart.', 'info');
  }
};

// ── TOGGLE RECORDING ───────────────────────────────────
window.toggleRecording = () => {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
};

function startRecording() {
  if (!recognition) return;

  isRecording      = true;
  finalTranscript  = '';
  interimText      = '';

  recognition.lang = selectedLang;

  try {
    recognition.start();
  } catch {
    recognition.stop();
    setTimeout(() => recognition.start(), 200);
  }

  // UI
  document.getElementById('mic-btn').classList.add('recording');
  document.getElementById('mic-btn').innerText = '⏹️';
  setStatus('Listening...', 'recording');
  showRings(true);
  showWave(true);

  document.getElementById('transcript-text').value = '';
  document.getElementById('transcript-text').placeholder =
    'Speak now — listening...';
}

function stopRecording() {
  isRecording = false;

  try { recognition.stop(); } catch {}

  // UI
  document.getElementById('mic-btn').classList.remove('recording');
  document.getElementById('mic-btn').classList.remove('processing');
  document.getElementById('mic-btn').innerText = '🎙️';
  setStatus('Tap to start speaking', 'idle');
  showRings(false);
  showWave(false);

  document.getElementById('transcript-text').classList.remove('interim');
  document.getElementById('transcript-text').placeholder =
    'Your speech will appear here...';

  // Run classify on stop if text exists
  const text = document.getElementById('transcript-text').value.trim();
  if (text.length > 10) {
    runAIClassify();
  }
}

// ── AI CLASSIFY ────────────────────────────────────────
window.runAIClassify = async () => {
  const text = document.getElementById('transcript-text').value.trim();
  if (!text || text.length < 5) {
    showToast('Speak or type something first.', 'warning');
    return;
  }

  setStatus('🤖 Classifying...', 'processing');
  document.getElementById('mic-btn').classList.add('processing');

  try {
    const { auth } = await import('./firebase-config.js');
    const token = await auth.currentUser?.getIdToken();

    const res = await fetch(`${BACKEND}/api/ai/classify-text`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ text })
    });

    aiResult = await res.json();
    renderAIResult(aiResult);
    setStatus('✅ Classification done', 'done');

  } catch {
    setStatus('⚠️ AI unavailable — classify manually', 'warning');
    showToast('AI classification failed.', 'error');
  } finally {
    document.getElementById('mic-btn').classList.remove('processing');
  }
};

// ── RENDER AI RESULT ───────────────────────────────────
function renderAIResult(data) {
  const card = document.getElementById('ai-result-card');
  card.style.display = 'block';
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const catConfig = {
    road:       { emoji: '🛣️',  label: 'Road / Pothole',   color: '#f59e0b' },
    water:      { emoji: '💧',  label: 'Water Supply',     color: '#38bdf8' },
    electric:   { emoji: '⚡',  label: 'Electricity',      color: '#facc15' },
    sanitation: { emoji: '🗑️', label: 'Sanitation',       color: '#a3e635' },
    other:      { emoji: '📦',  label: 'Other Issue',      color: '#94a3b8' }
  };

  const cfg   = catConfig[data.category] || catConfig.other;
  const conf  = data.confidence || 0;
  const color = conf >= 80
    ? '#22c55e' : conf >= 60
    ? '#f59e0b' : '#ef4444';

  document.getElementById('ai-emoji').innerText  = cfg.emoji;
  document.getElementById('ai-label').innerText  = cfg.label;
  document.getElementById('ai-label').style.color = cfg.color;
  document.getElementById('ai-conf').innerText   =
    `${conf}% confident via ${data.engine || 'AI'}`;

  document.getElementById('ai-conf-bar').style.width      = `${conf}%`;
  document.getElementById('ai-conf-bar').style.background = color;

  // Ranked predictions
  const ranked = data.ranked || [];
  document.getElementById('ranked-list').innerHTML =
    ranked.map(r => `
      <div class="ranked-item">
        <span style="width:140px; font-size:0.78rem;
                     color:#94a3b8; flex-shrink:0;">
          ${r.label.slice(0, 24)}
        </span>
        <div class="bar-bg">
          <div class="bar-fill" style="width:${r.score}%"></div>
        </div>
        <span class="pct">${r.score}%</span>
      </div>
    `).join('');
}

// ── PROCEED TO SUBMIT ──────────────────────────────────
window.proceedToSubmit = () => {
  const text = document.getElementById('transcript-text').value.trim();
  const words = text.split(' ');

  // Auto-fill title from first 8 words
  const autoTitle = words.slice(0, 8).join(' ');
  document.getElementById('v-title').value    = autoTitle;
  document.getElementById('v-desc').value     = text;
  document.getElementById('v-category').value = aiResult?.category || '';

  const submitCard = document.getElementById('submit-card');
  submitCard.style.display = 'block';
  submitCard.scrollIntoView({ behavior: 'smooth' });
};

// ── SUBMIT VOICE REPORT ────────────────────────────────
window.submitVoiceReport = async () => {
  const title    = document.getElementById('v-title').value.trim();
  const category = document.getElementById('v-category').value;
  const desc     = document.getElementById('v-desc').value.trim();

  if (!title)    { showToast('Enter a title.', 'error');    return; }
  if (!category) { showToast('Select a category.', 'error'); return; }

  const btn = document.getElementById('v-submit-btn');
  btn.disabled  = true;
  btn.innerText = '⏳ Submitting...';

  const { auth } = await import('./firebase-config.js');
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    showToast('You must be logged in.', 'error');
    btn.disabled  = false;
    btn.innerText = '🚀 Submit Report';
    return;
  }

  const payload = {
    title,
    category,
    description: desc,
    location: {
      coordinates: {
        lat: detectedLat || 15.1394,
        lng: detectedLng || 76.9214
      },
      address: document.getElementById('loc-addr').innerText ||
               'Ballari, Karnataka'
    },
    status:   'open',
    aiTagged: true,
    aiConf:   aiResult?.confidence || null
  };

  try {
    const res = await fetch(`${BACKEND}/api/issues`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const saved = await res.json();

    document.getElementById('voice-gid').innerText = saved.grievanceId;
    document.getElementById('voice-success').style.display = 'block';
    document.getElementById('submit-card').style.display   = 'none';
    document.getElementById('voice-success')
      .scrollIntoView({ behavior: 'smooth' });

  } catch {
    showToast('Submission failed.', 'error');
    btn.disabled  = false;
    btn.innerText = '🚀 Submit Report';
  }
};

// ── LOCATION DETECT ────────────────────────────────────
window.detectVoiceLocation = () => {
  document.getElementById('loc-addr').innerText = '🔍 Detecting...';

  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      detectedLat = coords.latitude;
      detectedLng = coords.longitude;

      document.getElementById('loc-coords').innerText =
        `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;

      try {
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/reverse` +
          `?lat=${coords.latitude}&lon=${coords.longitude}&format=json`
        );
        const data = await res.json();
        document.getElementById('loc-addr').innerText =
          data.display_name || 'Ballari, Karnataka';
      } catch {
        document.getElementById('loc-addr').innerText =
          `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
      }
    },
    () => {
      document.getElementById('loc-addr').innerText =
        '❌ Could not detect — default to Ballari';
    }
  );
};

// ── TRANSCRIPT HELPERS ─────────────────────────────────
window.clearTranscript = () => {
  finalTranscript = '';
  interimText     = '';
  document.getElementById('transcript-text').value = '';
  document.getElementById('ai-result-card').style.display = 'none';
  document.getElementById('submit-card').style.display    = 'none';
  aiResult = null;
};

window.copyTranscript = () => {
  const text = document.getElementById('transcript-text').value;
  navigator.clipboard.writeText(text);
  showToast('📋 Transcript copied!', 'success');
};

window.onTranscriptEdit = () => {
  finalTranscript = document.getElementById('transcript-text').value;
  clearTimeout(classifyTimer);
  classifyTimer = setTimeout(runAIClassify, 1000);
};

// ── RESET ──────────────────────────────────────────────
window.resetVoiceForm = () => {
  finalTranscript  = '';
  interimText      = '';
  aiResult         = null;

  document.getElementById('transcript-text').value    = '';
  document.getElementById('ai-result-card').style.display = 'none';
  document.getElementById('submit-card').style.display    = 'none';
  document.getElementById('voice-success').style.display  = 'none';
  document.getElementById('v-title').value     = '';
  document.getElementById('v-category').value  = '';
  document.getElementById('v-desc').value      = '';

  setStatus('Tap to start speaking', 'idle');
};

// ── UI HELPERS ─────────────────────────────────────────
function setStatus(msg, type) {
  const el     = document.getElementById('mic-status');
  el.innerText = msg;
  const colors = {
    idle:       '#94a3b8',
    recording:  '#ef4444',
    processing: '#f59e0b',
    done:       '#22c55e',
    error:      '#ef4444',
    warning:    '#f59e0b'
  };
  el.style.color = colors[type] || '#94a3b8';
}

function showRings(show) {
  ['ring1','ring2','ring3'].forEach(id => {
    const el = document.getElementById(id);
    el.classList.toggle('hidden', !show);
  });
}

function showWave(show) {
  for (let i = 1; i <= 7; i++) {
    document.getElementById(`wb${i}`).style.display =
      show ? 'block' : 'none';
  }
}