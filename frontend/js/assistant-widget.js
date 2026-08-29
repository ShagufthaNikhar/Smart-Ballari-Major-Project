// ─────────────────────────────────────────────────────────
// Floating Smart Ballari Assistant widget.
// Reuses the same element IDs assistant.js already expects
// (chat-messages, suggestions-row, chat-input, send-btn,
// voice-btn) so all its chat logic works unchanged — this
// file only builds the small draggable shell around it.
// ─────────────────────────────────────────────────────────

let widgetBuilt = false;
let widgetOpen  = false;
let dragState   = null;

function injectWidgetStyles() {
  if (document.getElementById('assistant-widget-styles')) return;

  const style = document.createElement('style');
  style.id = 'assistant-widget-styles';
  style.innerText = `
    #assistant-widget {
      position: fixed;
      bottom: 90px;
      right: 24px;
      width: 340px;
      height: 480px;
      min-width: 280px;
      min-height: 320px;
      max-width: 92vw;
      max-height: 80vh;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 14px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.5);
      display: none;
      flex-direction: column;
      overflow: hidden;
      z-index: 9998;
      resize: both;
    }
    #assistant-widget.open { display: flex; }
    #assistant-widget.minimized {
      height: auto !important;
      resize: none;
    }
    #assistant-widget.minimized .widget-body { display: none; }

    .widget-header {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.6rem 0.8rem;
      background: #1e293b;
      border-bottom: 1px solid #334155;
      cursor: grab;
      user-select: none;
      flex-shrink: 0;
    }
    .widget-header:active { cursor: grabbing; }
    .widget-avatar {
      width: 30px; height: 30px;
      border-radius: 50%;
      background: linear-gradient(135deg, #38bdf8, #7c3aed);
      display: flex; align-items: center; justify-content: center;
      font-size: 1rem;
      flex-shrink: 0;
    }
    .widget-title { flex: 1; min-width: 0; }
    .widget-title h4 {
      color: #f1f5f9;
      font-size: 0.82rem;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .widget-title p {
      color: #64748b;
      font-size: 0.65rem;
      margin: 0;
    }
    .widget-header-btns {
      display: flex;
      gap: 0.25rem;
      flex-shrink: 0;
    }
    .widget-header-btns button {
      width: 24px; height: 24px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: #94a3b8;
      cursor: pointer;
      font-size: 0.8rem;
      display: flex; align-items: center; justify-content: center;
    }
    .widget-header-btns button:hover {
      background: #334155;
      color: #f1f5f9;
    }

    .widget-body {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }

    #assistant-widget .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 0.8rem;
      display: flex;
      flex-direction: column;
      gap: 0.7rem;
    }
    #assistant-widget .msg {
      display: flex;
      gap: 0.5rem;
      max-width: 90%;
    }
    #assistant-widget .msg.user {
      align-self: flex-end;
      flex-direction: row-reverse;
    }
    #assistant-widget .msg-avatar {
      width: 24px; height: 24px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.8rem;
      flex-shrink: 0;
    }
    #assistant-widget .msg-avatar.bot {
      background: linear-gradient(135deg, #38bdf822, #7c3aed22);
      border: 1px solid #334155;
    }
    #assistant-widget .msg-avatar.user-av {
      background: #38bdf822;
      border: 1px solid #38bdf8;
    }
    #assistant-widget .msg-bubble {
      background: #1e293b;
      border-radius: 12px;
      padding: 0.55rem 0.75rem;
      font-size: 0.78rem;
      line-height: 1.5;
      color: #e2e8f0;
      border: 1px solid #334155;
    }
    #assistant-widget .msg.user .msg-bubble {
      background: #38bdf822;
      border-color: #38bdf8;
      color: #f1f5f9;
    }
    #assistant-widget .msg-bubble b { color: #38bdf8; }
    #assistant-widget .intent-badge {
      display: inline-block;
      padding: 0.1rem 0.4rem;
      border-radius: 999px;
      font-size: 0.6rem;
      background: #7c3aed22;
      color: #a78bfa;
      margin-bottom: 0.25rem;
    }
    #assistant-widget .quick-actions {
      display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.4rem;
    }
    #assistant-widget .quick-btn {
      padding: 0.25rem 0.55rem;
      background: #0f172a;
      border: 1px solid #334155;
      color: #94a3b8;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.68rem;
    }
    #assistant-widget .quick-btn:hover { border-color: #38bdf8; color: #38bdf8; }

    #assistant-widget .typing-indicator { display: flex; gap: 0.5rem; align-items: center; }
    #assistant-widget .typing-dots {
      display: flex; gap: 4px;
      padding: 0.5rem 0.7rem;
      background: #1e293b;
      border-radius: 12px;
      border: 1px solid #334155;
    }
    #assistant-widget .typing-dot {
      width: 5px; height: 5px;
      background: #64748b;
      border-radius: 50%;
      animation: widgetTypingBounce 1.2s infinite;
    }
    #assistant-widget .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    #assistant-widget .typing-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes widgetTypingBounce {
      0%,80%,100% { transform: translateY(0); opacity: 0.4; }
      40% { transform: translateY(-5px); opacity: 1; }
    }

    #assistant-widget .suggestions-row {
      padding: 0.4rem 0.6rem;
      border-top: 1px solid #1e293b;
      display: flex;
      gap: 0.3rem;
      overflow-x: auto;
      background: #0f172a;
      flex-shrink: 0;
    }
    #assistant-widget .suggestion-chip {
      padding: 0.25rem 0.6rem;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 999px;
      font-size: 0.65rem;
      color: #94a3b8;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
    }
    #assistant-widget .suggestion-chip:hover { border-color: #38bdf8; color: #38bdf8; }

    #assistant-widget .chat-input-wrap {
      padding: 0.55rem 0.6rem;
      border-top: 1px solid #334155;
      background: #1e293b;
      display: flex;
      gap: 0.4rem;
      align-items: flex-end;
      flex-shrink: 0;
    }
    #assistant-widget .chat-input {
      flex: 1;
      background: #0f172a;
      border: 1px solid #334155;
      color: #f1f5f9;
      padding: 0.5rem 0.7rem;
      border-radius: 8px;
      font-size: 0.8rem;
      resize: none;
      outline: none;
      max-height: 90px;
      min-height: 36px;
      font-family: inherit;
    }
    #assistant-widget .chat-input:focus { border-color: #38bdf8; }
    #assistant-widget .send-btn {
      width: 36px; height: 36px;
      border-radius: 8px;
      background: #38bdf8;
      color: #0f172a;
      border: none;
      cursor: pointer;
      font-size: 1rem;
      flex-shrink: 0;
    }
    #assistant-widget .send-btn:hover { background: #0ea5e9; }
    #assistant-widget .send-btn:disabled { background: #334155; color: #64748b; cursor: not-allowed; }
    #assistant-widget .voice-btn {
      width: 36px; height: 36px;
      border-radius: 8px;
      background: #1e293b;
      border: 1px solid #334155;
      color: #94a3b8;
      cursor: pointer;
      font-size: 1rem;
      flex-shrink: 0;
    }
    #assistant-widget .voice-btn.listening {
      border-color: #ef4444; color: #ef4444;
      animation: widgetMicPulse 1s infinite;
    }
    @keyframes widgetMicPulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.3); }
      50% { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
    }

    @media (max-width: 480px) {
      #assistant-widget {
        right: 12px;
        left: 12px;
        width: auto;
        bottom: 84px;
      }
    }
  `;
  document.head.appendChild(style);
}

function buildWidget() {
  if (widgetBuilt) return;

  const el = document.createElement('div');
  el.id = 'assistant-widget';
  el.innerHTML = `
    <div class="widget-header" id="widget-drag-handle">
      <div class="widget-avatar">🤖</div>
      <div class="widget-title">
        <h4>Smart Ballari Assistant</h4>
        <p>AI city guide</p>
      </div>
      <div class="widget-header-btns">
        <button type="button" id="widget-expand" title="Open full view">↗</button>
        <button type="button" id="widget-minimize" title="Minimize">–</button>
        <button type="button" id="widget-close" title="Close">✕</button>
      </div>
    </div>
    <div class="widget-body">
      <div class="chat-messages" id="chat-messages"></div>
      <div class="suggestions-row" id="suggestions-row"></div>
      <div class="chat-input-wrap">
        <button class="voice-btn" id="voice-btn" onclick="toggleVoiceInput()" title="Voice input">🎙️</button>
        <textarea
          class="chat-input"
          id="chat-input"
          placeholder="Ask anything about Ballari..."
          rows="1"
          onkeydown="handleKey(event)"
          oninput="autoResize(this)"></textarea>
        <button class="send-btn" id="send-btn" onclick="sendMessage()">➤</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  widgetBuilt = true;

  document.getElementById('widget-close').addEventListener('click', (e) => {
    e.stopPropagation();
    closeWidget();
  });
  document.getElementById('widget-minimize').addEventListener('click', (e) => {
    e.stopPropagation();
    el.classList.toggle('minimized');
  });
  document.getElementById('widget-expand').addEventListener('click', (e) => {
    e.stopPropagation();
    window.location.href = 'assistant.html';
  });

  initDrag(el, document.getElementById('widget-drag-handle'));
}

function initDrag(panel, handle) {
  const start = (clientX, clientY) => {
    const rect = panel.getBoundingClientRect();
    dragState = {
      offsetX: clientX - rect.left,
      offsetY: clientY - rect.top
    };
    // Switch anchoring from right/bottom to left/top so it can move freely
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.left = rect.left + 'px';
    panel.style.top = rect.top + 'px';
  };

  const move = (clientX, clientY) => {
    if (!dragState) return;
    const maxX = window.innerWidth - panel.offsetWidth - 8;
    const maxY = window.innerHeight - panel.offsetHeight - 8;
    const x = Math.min(Math.max(8, clientX - dragState.offsetX), Math.max(8, maxX));
    const y = Math.min(Math.max(8, clientY - dragState.offsetY), Math.max(8, maxY));
    panel.style.left = x + 'px';
    panel.style.top  = y + 'px';
  };

  const end = () => { dragState = null; };

  handle.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    start(e.clientX, e.clientY);
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => move(e.clientX, e.clientY));
  document.addEventListener('mouseup', end);

  handle.addEventListener('touchstart', (e) => {
    if (e.target.closest('button')) return;
    const t = e.touches[0];
    start(t.clientX, t.clientY);
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!dragState) return;
    const t = e.touches[0];
    move(t.clientX, t.clientY);
  }, { passive: true });
  document.addEventListener('touchend', end);
}

function openWidget() {
  injectWidgetStyles();
  buildWidget();
  const el = document.getElementById('assistant-widget');
  el.classList.remove('minimized');
  el.classList.add('open');
  widgetOpen = true;
  window.initAssistant?.(); // (re)populate welcome message + suggestions
}

function closeWidget() {
  const el = document.getElementById('assistant-widget');
  if (el) el.classList.remove('open');
  widgetOpen = false;
}

window.toggleAssistantWidget = () => {
  if (widgetOpen) {
    closeWidget();
  } else {
    openWidget();
  }
};