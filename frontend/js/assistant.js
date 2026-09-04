// ===================================================================
//  Smart Ballari - AI Assistant
//  Wrapped in an IIFE: this file is injected as a classic <script> by
//  app.js on every page. Without the wrapper its top-level BACKEND /
//  BALLARI / map / initMap / escapeHtml collide with the page's own
//  script in the shared global scope and the whole file fails to parse.
//  Anything the widget or inline onclick handlers need must be put on
//  window explicitly (see the window.* assignments below).
// ===================================================================
(function () {
  'use strict';

  const BACKEND = window.SB_API;
  const BALLARI = [15.1394, 76.9214];

  let map;
  let mapMarkers   = [];
  let isTyping     = false;
  let recognition  = null;
  let isListening  = false;
  let msgCounter   = 0;

  // ── INIT ──────────────────────────────────────────────
  // Called automatically on full-page assistant.html (DOMContentLoaded).
  // Also called manually by assistant-widget.js after it injects the
  // floating panel markup into the page.
  function initAssistant() {
    if (!document.getElementById('chat-messages')) return; // nothing to init into yet

    initMap();          // no-ops safely if there's no #assistant-map (widget mode)
    loadSuggestions();
    showWelcome();
    initVoiceInput();
  }

  document.addEventListener('DOMContentLoaded', initAssistant);
  window.initAssistant = initAssistant;

  // ── MAP (optional — only present on the full assistant.html page) ──
  function initMap() {
    const container = document.getElementById('assistant-map');
    if (!container || typeof L === 'undefined') {
      map = null;
      return;
    }

    map = L.map('assistant-map', { zoomControl: false })
      .setView(BALLARI, 13);

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { attribution: '© CartoDB', maxZoom: 19 }
    ).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
  }

  // ── WELCOME ───────────────────────────────────────────
  function showWelcome() {
    addBotMessage(
      `**Namaskara! 🙏 Welcome to Smart Ballari Assistant.**

  I can help you with:
  📌 **Report** civic issues
  🔍 **Track** your grievances
  🚑 **Find** nearest hospitals & police
  🚍 **Bus** routes & live tracking
  🌤️ **Weather** alerts & flood risk
  🏰 **Heritage** sites & AR experiences
  🚨 **Emergency** contacts

  What can I help you with today?`,
      [],
      null
    );
  }

  // ── SUGGESTIONS ───────────────────────────────────────
  async function loadSuggestions() {
    const row = document.getElementById('suggestions-row');
    if (!row) return;

    try {
      const res   = await fetch(`${BACKEND}/api/assistant/suggestions`);
      const chips = await res.json();

      row.innerHTML = chips.map(s =>
        `<div class="suggestion-chip"
           onclick="sendQuick('${s.replace(/'/g, "\\'")}')">
          ${s}
        </div>`
      ).join('');
    } catch {}
  }

  // ── SEND MESSAGE ──────────────────────────────────────
  window.sendMessage = async () => {
    const input = document.getElementById('chat-input');
    const text  = input.value.trim();
    if (!text || isTyping) return;

    input.value = '';
    input.style.height = 'auto';

    addUserMessage(text);
    await processMessage(text);
  };

  window.sendQuick = async (text) => {
    document.getElementById('chat-input').value = '';
    addUserMessage(text);
    await processMessage(text);
  };

  // ── PROCESS MESSAGE ───────────────────────────────────
  async function processMessage(text) {
    isTyping = true;
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) sendBtn.disabled = true;

    const typingId = showTyping();

    try {
      const { auth } = await import('./firebase-config.js');
      const token = await auth.currentUser?.getIdToken();

      const res  = await fetch(`${BACKEND}/api/assistant/chat`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`
        },
        body:    JSON.stringify({
          message: text,
          history: getChatHistory()
        })
      });

      const data = await res.json();

      removeTyping(typingId);

      addBotMessage(
        data.reply,
        data.actions || [],
        data.mapData || null,
        data.intent
      );

      // Update map if location data available (no-op in widget mode)
      if (data.mapData) {
        updateMap(data.mapData, data.intent);
      }

    } catch {
      removeTyping(typingId);
      addBotMessage(
        `Sorry, I'm having trouble connecting. Please try again.

  For emergencies:
  🚨 Police: 100
  🚑 Ambulance: 108
  🚒 Fire: 101`,
        [],
        null
      );
    } finally {
      isTyping = false;
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  // ── ADD MESSAGES ──────────────────────────────────────
  function addUserMessage(text) {
    const id  = `msg-${++msgCounter}`;
    const el  = document.createElement('div');
    el.className = 'msg user';
    el.id        = id;
    el.innerHTML = `
      <div class="msg-avatar user-av">👤</div>
      <div class="msg-bubble">${escapeHtml(text)}</div>
    `;
    document.getElementById('chat-messages').appendChild(el);
    scrollBottom();
    return id;
  }

  function addBotMessage(text, actions = [], mapData = null, intent = null) {
    const id  = `msg-${++msgCounter}`;
    const el  = document.createElement('div');
    el.className = 'msg bot';
    el.id        = id;

    const formatted = formatMessage(text);

    const intentBadge = intent && intent !== 'general'
      ? `<div class="intent-badge">${intentLabel(intent)}</div>`
      : '';

    const actionsHtml = actions.length
      ? `<div class="quick-actions">
          ${actions.map(a =>
            `<button class="quick-btn"
               onclick="handleAction(${JSON.stringify(a)})">
               ${a.label}
             </button>`
          ).join('')}
         </div>`
      : '';

    el.innerHTML = `
      <div class="msg-avatar bot">🤖</div>
      <div>
        ${intentBadge}
        <div class="msg-bubble">
          ${formatted}
          ${actionsHtml}
        </div>
      </div>
    `;

    document.getElementById('chat-messages').appendChild(el);
    scrollBottom();
    return id;
  }

  // ── TYPING INDICATOR ──────────────────────────────────
  function showTyping() {
    const id = `typing-${++msgCounter}`;
    const el = document.createElement('div');
    el.className = 'msg bot typing-indicator';
    el.id        = id;
    el.innerHTML = `
      <div class="msg-avatar bot">🤖</div>
      <div class="typing-dots">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    document.getElementById('chat-messages').appendChild(el);
    scrollBottom();
    return id;
  }

  function removeTyping(id) {
    document.getElementById(id)?.remove();
  }

  // ── HANDLE ACTION BUTTONS ─────────────────────────────
  window.handleAction = (action) => {
    switch (action.action) {
      case 'link':
        window.location.href = action.data;
        break;
      case 'call':
        window.location.href = `tel:${action.data}`;
        break;
      case 'map':
        if (map && action.data?.lat && action.data?.lng) {
          map.flyTo([action.data.lat, action.data.lng], 16);
          updateMap(action.data, 'location');
        }
        break;
      case 'chat':
        sendQuick(action.data);
        break;
    }
  };

  // ── UPDATE MAP (safely no-ops without a map panel) ────
  function updateMap(data, intent) {
    if (!map) return;

    mapMarkers.forEach(m => map.removeLayer(m));
    mapMarkers = [];

    const typeIcon = {
      nearest_hospital: '🏥',
      nearest_police:   '🚔',
      bus_routes:       '🚍',
      heritage:         '🏰'
    };

    if (data.lat && data.lng) {
      const icon = typeIcon[intent] || '📍';
      const marker = L.marker([data.lat, data.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="font-size:24px;
            filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
            ${icon}
          </div>`,
          iconSize:   [24, 24],
          iconAnchor: [12, 24]
        })
      }).addTo(map)
        .bindPopup(data.name || 'Location')
        .openPopup();

      mapMarkers.push(marker);
      map.flyTo([data.lat, data.lng], 15, { duration: 1.2 });

      const label = document.getElementById('map-panel-label');
      if (label) label.innerText = data.name || 'Selected Location';

      updateMapInfoPanel(data, intent);
    }
  }

  function updateMapInfoPanel(data, intent) {
    const titleEl = document.getElementById('map-info-title');
    const bodyEl  = document.getElementById('map-info-body');
    if (!titleEl || !bodyEl) return;

    const titleMap = {
      nearest_hospital: '🏥 Nearest Hospitals',
      nearest_police:   '🚔 Police Stations',
      bus_routes:       '🚍 Bus Routes',
      heritage:         '🏰 Heritage Sites'
    };

    titleEl.innerText = titleMap[intent] || '📍 Location Info';

    bodyEl.innerHTML = `
      <div class="info-item">
        <div class="info-icon">📍</div>
        <div>
          <div class="info-name">${data.name || 'Location'}</div>
          ${data.address
            ? `<div class="info-meta">${data.address}</div>`
            : ''}
          ${data.phone
            ? `<div class="info-phone">📞 ${data.phone}</div>`
            : ''}
        </div>
      </div>
    `;
  }

  // ── VOICE INPUT ───────────────────────────────────────
  function initVoiceInput() {
    const voiceBtn = document.getElementById('voice-btn');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      if (voiceBtn) voiceBtn.style.display = 'none';
      return;
    }

    recognition = new SR();
    recognition.continuous      = false;
    recognition.interimResults  = false;
    recognition.lang            = 'en-IN';

    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript;
      document.getElementById('chat-input').value = text;
      stopListening();
      sendMessage();
    };

    recognition.onerror = () => stopListening();
    recognition.onend   = () => stopListening();
  }

  window.toggleVoiceInput = () => {
    if (isListening) { stopListening(); return; }

    isListening = true;
    const btn   = document.getElementById('voice-btn');
    btn.classList.add('listening');
    btn.innerText = '⏹️';

    try { recognition?.start(); } catch {}
    showToast?.('🎙️ Listening...', 'info');
  };

  function stopListening() {
    isListening = false;
    const btn   = document.getElementById('voice-btn');
    if (!btn) return;
    btn.classList.remove('listening');
    btn.innerText = '🎙️';
    try { recognition?.stop(); } catch {}
  }

  // ── KEYBOARD ──────────────────────────────────────────
  window.handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  window.autoResize = (el) => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  // ── HELPERS ───────────────────────────────────────────
  function formatMessage(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
      .replace(/\*(.*?)\*/g,     '<em>$1</em>')
      .replace(/\n/g,            '<br/>')
      .replace(/(\/pages\/[^\s<]+)/g,
        '<a href="$1" style="color:#38bdf8; text-decoration:underline;">$1</a>');
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function scrollBottom() {
    const el = document.getElementById('chat-messages');
    if (!el) return;
    setTimeout(() => el.scrollTop = el.scrollHeight, 50);
  }

  function getChatHistory() {
    const msgs = document.querySelectorAll('.msg');
    return Array.from(msgs)
      .slice(-6)
      .map(m => ({
        role: m.classList.contains('user') ? 'user' : 'assistant',
        content: m.querySelector('.msg-bubble')?.innerText || ''
      }));
  }

  function intentLabel(intent) {
    const labels = {
      nearest_hospital: '🏥 Hospital',
      nearest_police:   '🚔 Police',
      report_issue:     '📌 Report',
      track_grievance:  '🔍 Tracker',
      bus_routes:       '🚍 Transport',
      weather:          '🌤️ Weather',
      heritage:         '🏰 Heritage',
      emergency_contacts:'🚨 Emergency',
      crowd_info:       '👥 Crowd',
      active_alerts:    '⚠️ Alerts',
      resource_status:  '⚡ Resources'
    };
    return labels[intent] || '🤖 AI';
  }

})();