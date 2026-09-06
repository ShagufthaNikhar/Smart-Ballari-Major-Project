// ===================================================================
//  Heritage AR — Smart Ballari
//
//  Entry point for the QR code:  ar.html?site=ballari-fort
//
//  Deliberately standalone: this page does NOT load app.js. It is opened by
//  a stranger scanning a poster, so it must work with no login, no navbar and
//  no localStorage state. It only needs config.js for the API base URL.
//
//  AR routing is delegated to <model-viewer>, which picks WebXR or Scene
//  Viewer on Android, AR Quick Look on iOS, and falls back to an interactive
//  3D viewer everywhere else. Hand-rolling that would still leave iPhone
//  Safari without AR, since it exposes no handheld WebXR.
// ===================================================================
'use strict';

const API = window.SB_API;

let monument = null;
let viewer   = null;      // the <model-viewer> element
let audio    = null;
let sheetOpen = false;

// Default to Ballari Fort so a mistyped or bare URL still demos.
const slug = new URLSearchParams(location.search).get('site') || 'ballari-fort';

document.addEventListener('DOMContentLoaded', init);

// ── HELPERS ───────────────────────────────────────────
function esc(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}

function veil({ title, text, spinner = true, actions = [] }) {
  document.getElementById('veil').classList.remove('hide');
  document.getElementById('veil-title').textContent = title;
  document.getElementById('veil-text').textContent  = text;
  document.getElementById('veil-spin').style.display = spinner ? '' : 'none';
  document.getElementById('veil-bar').style.display  = spinner ? '' : 'none';

  const box = document.getElementById('veil-actions');
  box.innerHTML = actions.map(a =>
    `<button class="lnk" onclick="${a.onclick}">${esc(a.label)}</button>`).join('');
  box.style.display = actions.length ? 'flex' : 'none';
}

function hideVeil() { document.getElementById('veil').classList.add('hide'); }

// ── BOOT ──────────────────────────────────────────────
async function init() {
  // Camera AR needs a secure context. On plain http the camera silently never
  // starts and the user just sees black, so say so up front instead.
  const secure = window.isSecureContext ||
                 ['localhost', '127.0.0.1'].includes(location.hostname);

  try {
    const res = await fetch(`${API}/api/heritage/monuments/${encodeURIComponent(slug)}`);
    if (res.status === 404) {
      return veil({
        title: 'Monument not found',
        text: 'That QR code points to a monument that is not in the system.',
        spinner: false,
        actions: [{ label: 'Browse heritage sites', onclick: "location.href='heritage.html'" }]
      });
    }
    if (!res.ok) throw new Error('Could not load monument');
    monument = await res.json();
  } catch (err) {
    return veil({
      title: 'Could not connect',
      text: 'Check your connection and try again.',
      spinner: false,
      actions: [{ label: 'Retry', onclick: 'location.reload()' }]
    });
  }

  document.getElementById('m-name').textContent = monument.name;
  document.getElementById('m-sub').textContent  =
    [monument.period, monument.dynasty].filter(Boolean).join(' · ') || 'Smart Ballari · Heritage AR';
  document.getElementById('s-name').textContent = monument.name;
  document.getElementById('coach-sub').textContent = monument.name;
  document.title = `${monument.name} — Smart Ballari AR`;

  buildSheet();
  countView(false);

  if (!monument.modelUrl) {
    // Three of the four monuments have no model yet. Show the information
    // experience rather than an empty viewer.
    return veil({
      title: 'No 3D model yet',
      text: `${monument.name} does not have an AR model in the system yet, but its history, timeline and gallery are available.`,
      spinner: false,
      actions: [{ label: 'View details', onclick: 'hideVeil(); openSheet();' }]
    });
  }

  if (!secure) {
    veil({
      title: 'AR needs a secure connection',
      text: 'Open this page over https to use the camera. You can still explore the 3D model here.',
      spinner: false,
      actions: [{ label: 'View 3D model', onclick: 'hideVeil(); mountViewer();' }]
    });
    return;
  }

  mountViewer();
}

// ── THE VIEWER ────────────────────────────────────────
function mountViewer() {
  // The veil stays up until the model actually loads - hiding it here would
  // leave the visitor staring at an empty stage during the download.
  veil({ title: 'Loading Ballari Fort…', text: 'Preparing the 3D model.' });
  document.getElementById('veil-title').textContent = `Loading ${monument.name}…`;

  const mv = document.createElement('model-viewer');
  mv.setAttribute('src', monument.modelUrl);
  if (monument.usdzUrl) mv.setAttribute('ios-src', monument.usdzUrl);
  if (monument.posterUrl) mv.setAttribute('poster', monument.posterUrl);

  mv.setAttribute('alt', `3D model of ${monument.name}`);
  mv.setAttribute('ar', '');
  // webxr first (true in-browser placement), then Scene Viewer, then Quick
  // Look. Listing quick-look lets model-viewer generate a USDZ on the fly so
  // iOS still gets AR without us shipping a second model file.
  mv.setAttribute('ar-modes', 'webxr scene-viewer quick-look');
  mv.setAttribute('ar-placement', 'floor');
  mv.setAttribute('ar-scale', 'auto');
  mv.setAttribute('camera-controls', '');
  mv.setAttribute('touch-action', 'pan-y');
  mv.setAttribute('auto-rotate', '');
  mv.setAttribute('auto-rotate-delay', '2600');
  mv.setAttribute('rotation-per-second', '14deg');
  mv.setAttribute('shadow-intensity', '1.1');
  mv.setAttribute('shadow-softness', '0.85');
  mv.setAttribute('environment-image', 'neutral');
  mv.setAttribute('exposure', '1.05');
  mv.setAttribute('camera-orbit', '35deg 68deg 1.4m');
  mv.setAttribute('min-camera-orbit', 'auto 0deg auto');
  mv.setAttribute('max-camera-orbit', 'auto 92deg auto');
  mv.setAttribute('interaction-prompt', 'auto');

  // The AR entry button lives in model-viewer's slot so it only ever renders
  // when the device can actually do AR.
  const btn = document.createElement('button');
  btn.className = 'ar-cta';
  btn.setAttribute('slot', 'ar-button');
  btn.textContent = '📱 View in your space';
  btn.addEventListener('click', () => countView(true));
  mv.appendChild(btn);

  const bar = document.getElementById('veil-bar').querySelector('i');
  mv.addEventListener('progress', (e) => {
    bar.style.width = `${Math.round(e.detail.totalProgress * 100)}%`;
  });

  mv.addEventListener('load', () => {
    hideVeil();
    document.getElementById('ctrls').style.display = '';
    maybeCoach();
  });

  mv.addEventListener('error', () => {
    veil({
      title: "Couldn't load the 3D model",
      text: 'The model file may be missing from the server.',
      spinner: false,
      actions: [{ label: 'View details instead', onclick: 'hideVeil(); openSheet();' }]
    });
  });

  // Tell the visitor what to do the moment AR actually starts.
  mv.addEventListener('ar-status', (e) => {
    if (e.detail.status === 'session-started') {
      window.stopAudio();   // narration must not talk over the AR session
      toast('Point at a flat surface, then tap to place');
      closeSheet();
    }
    if (e.detail.status === 'object-placed') {
      toast('Placed. Pinch to resize, drag to turn, walk around it.');
    }
    if (e.detail.status === 'failed') {
      toast('AR could not start — you can still explore the 3D model');
    }
  });

  document.getElementById('stage').appendChild(mv);
  viewer = mv;
}

// ── CONTROLS ──────────────────────────────────────────
// These drive the on-page 3D view. Inside an AR session the monument is moved
// with the native gestures the platform provides.
window.rotateModel = (deg) => {
  if (!viewer) return;
  const o = viewer.getCameraOrbit();
  viewer.cameraOrbit = `${o.theta * 180 / Math.PI + deg}deg ${o.phi * 180 / Math.PI}deg ${o.radius}m`;
  viewer.removeAttribute('auto-rotate');
};

window.zoomModel = (dir) => {
  if (!viewer) return;
  const o = viewer.getCameraOrbit();
  const r = Math.min(4, Math.max(0.45, o.radius + dir * 0.22));
  viewer.cameraOrbit = `${o.theta * 180 / Math.PI}deg ${o.phi * 180 / Math.PI}deg ${r}m`;
};

window.resetModel = () => {
  if (!viewer) return;
  viewer.cameraOrbit = '35deg 68deg 1.4m';
  viewer.fieldOfView = 'auto';
  viewer.setAttribute('auto-rotate', '');
  toast('View reset');
};

window.goBack = () => {
  if (document.referrer && document.referrer.includes(location.host)) history.back();
  else location.href = 'heritage.html';
};

// ── SHEET ─────────────────────────────────────────────
window.toggleSheet = () => (sheetOpen ? closeSheet() : openSheet());
window.openSheet  = () => {
  document.getElementById('sheet').classList.add('open');
  sheetOpen = true;
};
window.closeSheet = () => {
  document.getElementById('sheet').classList.remove('open');
  sheetOpen = false;
};

window.showPane = (p) => {
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.p === p));
  document.querySelectorAll('.pane').forEach(el =>
    el.classList.toggle('show', el.id === `pane-${p}`));
  if (!sheetOpen) openSheet();
};

function buildSheet() {
  const m = monument;

  // ── overview ──
  const meta = [
    ['Location',  m.location?.address || 'Ballari, Karnataka'],
    ['Period',    m.period],
    ['Built by',  m.dynasty],
    ['Category',  m.heritageCategory]
  ].filter(([, v]) => v);

  document.getElementById('pane-about').innerHTML = `
    <div class="meta-grid">
      ${meta.map(([k, v]) => `<div class="meta"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}
    </div>
    ${m.description ? `<p class="prose">${esc(m.description)}</p>` : ''}
    ${m.facts?.length ? `<h3 class="sec">Key facts</h3>
      ${m.facts.map(f => `<div class="fact">${esc(f)}</div>`).join('')}` : ''}
    <div class="btn-row">
      <a class="lnk" id="map-link" target="_blank" rel="noopener">🗺 View on map</a>
      <button class="lnk" onclick="shareMonument()">↗ Share</button>
    </div>
    ${m.modelCredit ? `<div class="credit">🏛 ${esc(m.modelCredit)}</div>` : ''}`;

  if (m.location?.lat) {
    document.getElementById('map-link').href =
      `https://www.google.com/maps/search/?api=1&query=${m.location.lat},${m.location.lng}`;
  }

  // ── history ──
  document.getElementById('pane-history').innerHTML = m.history
    ? `<p class="prose">${esc(m.history)}</p>`
    : `<p class="prose" style="color:var(--dim)">No extended history recorded for this monument yet.</p>`;

  // ── timeline ──
  document.getElementById('pane-timeline').innerHTML = m.timeline?.length
    ? `<div class="tl">${m.timeline.map(t => `
        <div class="tl-item">
          <div class="tl-year">${esc(t.year)}</div>
          <div class="tl-title">${esc(t.title)}</div>
          ${t.detail ? `<div class="tl-detail">${esc(t.detail)}</div>` : ''}
        </div>`).join('')}</div>`
    : `<p class="prose" style="color:var(--dim)">No timeline recorded yet.</p>`;

  // ── gallery ──
  document.getElementById('pane-gallery').innerHTML = m.images?.length
    ? `<div class="gal">${m.images.map((im, i) => `
        <figure onclick="openLightbox(${i})">
          <img src="${esc(im.url)}" alt="${esc(im.caption || m.name)}" loading="lazy" />
          <figcaption>
            ${im.kind ? `<span class="kind">${esc(im.kind)}</span>` : ''}
            ${esc(im.caption || '')}
          </figcaption>
        </figure>`).join('')}</div>`
    : `<p class="prose" style="color:var(--dim)">No photographs uploaded for this monument yet.</p>`;

  // ── audio ──
  // Prefer the phone's own voice over the shipped MP3: better quality, no
  // download, works offline. The file is only the fallback.
  const canSpeak = 'speechSynthesis' in window && Boolean(m.narrationText);
  const hasAudio = canSpeak || Boolean(m.audioUrl);

  document.getElementById('pane-audio').innerHTML = hasAudio
    ? `<div class="audio-card">
         <div class="audio-row">
           <button class="play-btn" id="play-btn" onclick="toggleAudio()">\u25b6</button>
           <div class="track">
             <div class="track-bar"><i id="track-fill"></i></div>
             <div class="track-time" id="track-time">Audio guide \u00b7 about 90 seconds</div>
           </div>
           <button class="ctrl" onclick="stopAudio()" title="Stop">\u25a0</button>
         </div>
         <p class="prose" style="margin-top:0.7rem; font-size:0.8rem;">
           Narrated history of ${esc(m.name)}.
         </p>
         <p class="prose" style="margin-top:0.4rem; font-size:0.73rem; color:var(--dim);"
            id="voice-note"></p>
       </div>`
    : `<div class="audio-card">
         <p class="prose" style="font-size:0.83rem;">
           \u{1F399} An audio guide has not been recorded for ${esc(m.name)} yet.
         </p>
       </div>`;
}

// ── GALLERY LIGHTBOX ──────────────────────────────────
window.openLightbox = (i) => {
  const im = monument.images[i];
  if (!im) return;
  document.getElementById('lb-img').src = im.url;
  document.getElementById('lb-cap').textContent = im.caption || '';
  document.getElementById('lightbox').classList.add('open');
};
window.closeLightbox = () => document.getElementById('lightbox').classList.remove('open');

// ── AUDIO GUIDE ───────────────────────────────────────
// Two engines. speechSynthesis first, because on-device voices are far
// better than anything we could ship and cost no bandwidth. The MP3 is the
// fallback for devices with no usable voice.
let speaking   = false;
let utterance  = null;
let speakTimer = null;
let speakStart = 0;
let speakPaused = 0;

function pickVoice() {
  const vs = speechSynthesis.getVoices();
  if (!vs.length) return null;
  // Indian English if the device has it, then British, then anything English.
  return vs.find(v => /en[-_]IN/i.test(v.lang))
      || vs.find(v => /en[-_]GB/i.test(v.lang))
      || vs.find(v => /^en/i.test(v.lang))
      || null;
}

function setPlayIcon(playing) {
  const b = document.getElementById('play-btn');
  if (b) b.textContent = playing ? '\u275a\u275a' : '\u25b6';
}

function speakNarration() {
  const text = monument.narrationText;
  utterance = new SpeechSynthesisUtterance(text);
  const v = pickVoice();
  if (v) {
    utterance.voice = v;
    utterance.lang  = v.lang;
    const note = document.getElementById('voice-note');
    if (note) note.textContent = `Spoken by your device (${v.name}).`;
  }
  utterance.rate  = 0.95;
  utterance.pitch = 1.0;

  // Progress: `boundary` is unreliable across browsers, so drive the bar off
  // elapsed time against an estimate. It is an indicator, not a seek bar.
  const words   = text.split(/\s+/).length;
  const estMs   = (words / 2.6) * 1000;
  speakStart    = Date.now();
  speakPaused   = 0;

  clearInterval(speakTimer);
  speakTimer = setInterval(() => {
    if (speechSynthesis.paused) { speakPaused += 120; return; }
    const pct = Math.min(99, ((Date.now() - speakStart - speakPaused) / estMs) * 100);
    const fill = document.getElementById('track-fill');
    const time = document.getElementById('track-time');
    if (fill) fill.style.width = `${pct}%`;
    if (time) time.textContent = `${fmt((Date.now()-speakStart-speakPaused)/1000)} / ~${fmt(estMs/1000)}`;
  }, 120);

  utterance.onend = () => {
    speaking = false;
    clearInterval(speakTimer);
    setPlayIcon(false);
    const fill = document.getElementById('track-fill');
    if (fill) fill.style.width = '0%';
  };
  utterance.onerror = () => {
    speaking = false;
    clearInterval(speakTimer);
    setPlayIcon(false);
    toast('Speech unavailable — trying the audio file');
    if (monument.audioUrl) playFile();
  };

  speechSynthesis.cancel();       // Android sometimes queues stale utterances
  speechSynthesis.speak(utterance);
  speaking = true;
  setPlayIcon(true);
}

function playFile() {
  if (!monument.audioUrl) return;
  if (!audio) {
    audio = new Audio(monument.audioUrl);
    audio.addEventListener('timeupdate', () => {
      const pct = (audio.currentTime / (audio.duration || 1)) * 100;
      const fill = document.getElementById('track-fill');
      const time = document.getElementById('track-time');
      if (fill) fill.style.width = `${pct}%`;
      if (time) time.textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration)}`;
    });
    audio.addEventListener('ended', () => setPlayIcon(false));
    audio.addEventListener('error', () => toast('Audio guide unavailable'));
  }
  audio.play();
  setPlayIcon(true);
}

function fmt(s) {
  if (!isFinite(s)) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

window.toggleAudio = () => {
  const useSpeech = 'speechSynthesis' in window && monument.narrationText;

  if (useSpeech) {
    if (speaking && !speechSynthesis.paused) {
      speechSynthesis.pause(); setPlayIcon(false); return;
    }
    if (speaking && speechSynthesis.paused) {
      speechSynthesis.resume(); setPlayIcon(true); return;
    }
    // Must be inside the tap: iOS blocks speech that is not user-initiated.
    return speakNarration();
  }

  if (!audio) return playFile();
  if (audio.paused) { audio.play(); setPlayIcon(true); }
  else              { audio.pause(); setPlayIcon(false); }
};

window.stopAudio = () => {
  if ('speechSynthesis' in window) { speechSynthesis.cancel(); speaking = false; }
  clearInterval(speakTimer);
  if (audio) { audio.pause(); audio.currentTime = 0; }
  setPlayIcon(false);
  const fill = document.getElementById('track-fill');
  if (fill) fill.style.width = '0%';
};

// Chrome loads voices asynchronously; without this the first tap can get the
// default robotic voice instead of the one we picked.
if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = () => { /* list is now populated */ };
}

// Never let narration keep talking over an AR session or after the visitor
// navigates away.
window.addEventListener('pagehide', () => window.stopAudio());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) window.stopAudio();
});

// ── SHARE ─────────────────────────────────────────────
window.shareMonument = async () => {
  const data = { title: `${monument.name} — Smart Ballari`, url: location.href };
  try {
    if (navigator.share) await navigator.share(data);
    else { await navigator.clipboard.writeText(location.href); toast('Link copied'); }
  } catch { /* the user dismissed the share sheet */ }
};

// ── DEMO-MODE COACH ───────────────────────────────────
// Shown once per device. A judge picking up the phone should not have to be
// told what to do, but a returning user should not be nagged.
function maybeCoach() {
  const KEY = 'sb-ar-coached';
  if (localStorage.getItem(KEY)) return;

  const note = document.getElementById('coach-note');
  if (viewer && viewer.canActivateAR === false) {
    note.textContent = 'This device cannot open camera AR — you can still rotate and inspect the 3D model.';
  }
  document.getElementById('coach').classList.remove('hide');
  try { localStorage.setItem(KEY, '1'); } catch { /* private mode */ }
}
window.dismissCoach = () => document.getElementById('coach').classList.add('hide');

// ── ANALYTICS (anonymous counters only) ───────────────
function countView(isAr) {
  fetch(`${API}/api/heritage/monuments/${encodeURIComponent(slug)}/view`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ar: Boolean(isAr) }),
    keepalive: true
  }).catch(() => { /* never block the experience on a counter */ });
}

// ── TOAST ─────────────────────────────────────────────
let toastTimer = null;
function toast(msg) {
  let el = document.getElementById('ar-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ar-toast';
    el.style.cssText =
      'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(var(--sheet-peek) + 74px);' +
      'z-index:70;background:rgba(30,41,59,0.96);border:1px solid #334155;color:#f1f5f9;' +
      'padding:0.6rem 1rem;border-radius:999px;font-size:0.8rem;max-width:88vw;text-align:center;' +
      'transition:opacity .25s;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 3200);
}