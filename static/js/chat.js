/**
 * chat.js — Alexandria Conversational Chat Agent
 * Full-featured chat interface with history, export, and sidebar toggle.
 */

// ── State ───────────────────────────────────────────────────────
let conversationHistory = [];
let isGenerating        = false;

// ── DOM refs ────────────────────────────────────────────────────
const chatThread  = document.getElementById('chatThread');
const chatInput   = document.getElementById('chatInput');
const chatSend    = document.getElementById('chatSend');
const chatThink   = document.getElementById('chatThinking');
const charCount   = document.getElementById('charCount');
const chatSidebar = document.getElementById('chatSidebar');


// ── Auto-resize textarea ─────────────────────────────────────────
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}


// ── Scroll to bottom ─────────────────────────────────────────────
function scrollToBottom() {
  if (chatThread) {
    chatThread.scrollTo({ top: chatThread.scrollHeight, behavior: 'smooth' });
  }
}


// ── Format timestamp ─────────────────────────────────────────────
function formatTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}


// ── Render a message into the thread ─────────────────────────────
function appendMessage(role, content, timestamp) {
  // Remove welcome screen on first message
  const welcome = chatThread.querySelector('.chat-welcome');
  if (welcome) welcome.remove();

  const isUser  = role === 'user';
  const avatarLetter = isUser ? 'U' : 'A';

  const wrap = document.createElement('div');
  wrap.className = `chat-message chat-message--${role}`;

  const avatar = document.createElement('div');
  avatar.className = `chat-avatar chat-avatar--${role}`;
  avatar.textContent = avatarLetter;

  const bubbleWrap = document.createElement('div');
  bubbleWrap.style.display = 'flex';
  bubbleWrap.style.flexDirection = 'column';
  bubbleWrap.style.gap = '4px';
  bubbleWrap.style.maxWidth = '640px';

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble chat-bubble--${role}`;

  if (isUser) {
    bubble.innerHTML = `<p>${escapeHtml(content)}</p>`;
  } else {
    // Format assistant markdown
    const html = formatMarkdown(content);
    bubble.innerHTML = html.startsWith('<') ? html : `<p>${html}</p>`;
  }

  const ts = document.createElement('div');
  ts.className = 'chat-ts';
  ts.textContent = timestamp ? formatTime(timestamp) : formatTime(new Date().toISOString());

  bubbleWrap.appendChild(bubble);
  bubbleWrap.appendChild(ts);

  wrap.appendChild(avatar);
  wrap.appendChild(bubbleWrap);

  chatThread.appendChild(wrap);
  scrollToBottom();
}


// ── Send message ─────────────────────────────────────────────────
async function sendMessage() {
  if (isGenerating) return;
  const message = chatInput.value.trim();
  if (!message) return;

  isGenerating = true;

  // Clear input
  chatInput.value = '';
  autoResize(chatInput);
  if (charCount) charCount.textContent = '0 / 2000';

  // Show user message
  appendMessage('user', message, null);

  // Show thinking indicator
  if (chatThink) chatThink.hidden = false;
  if (chatSend)  chatSend.classList.add('btn--loading');
  scrollToBottom();

  try {
    const response = await fetch('/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        message,
        history: conversationHistory,
      }),
    });

    const data = await response.json();

    if (chatThink) chatThink.hidden = true;

    if (data.error) {
      appendMessage('assistant', `⚠️ ${data.error}`, null);
    } else {
      appendMessage('assistant', data.reply, data.timestamp);
      // Update model label
      const modelLabel = document.getElementById('chatModelLabel');
      if (modelLabel && data.model) modelLabel.textContent = `Model: ${data.model}`;
    }

    // Update history
    conversationHistory.push({ role: 'user', content: message });
    if (data.reply) conversationHistory.push({ role: 'assistant', content: data.reply });

    // Keep history manageable
    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-20);
    }

  } catch (err) {
    if (chatThink) chatThink.hidden = true;
    appendMessage('assistant', '⚠️ Connection error. Please check the server and try again.', null);
  }

  if (chatSend) chatSend.classList.remove('btn--loading');
  isGenerating = false;
  chatInput.focus();
}


// ── Quick prompts ─────────────────────────────────────────────────
document.querySelectorAll('.quick-prompt').forEach(btn => {
  btn.addEventListener('click', () => {
    const prompt = btn.dataset.prompt;
    if (!prompt || isGenerating) return;
    chatInput.value = prompt;
    autoResize(chatInput);
    sendMessage();
    // On mobile, close sidebar
    if (window.innerWidth < 1024) {
      chatSidebar?.classList.remove('chat-sidebar--open');
    }
  });
});


// ── Clear conversation ────────────────────────────────────────────
document.getElementById('clearChat')?.addEventListener('click', () => {
  conversationHistory = [];
  if (chatThread) {
    chatThread.innerHTML = `
      <div class="chat-welcome">
        <div class="chat-welcome__icon">⬡</div>
        <h2 class="chat-welcome__title">Conversation cleared.</h2>
        <p class="chat-welcome__text">Start a new conversation with Alexandria.</p>
      </div>`;
  }
  showToast('Conversation cleared', '', 2000);
});


// ── Export conversation ────────────────────────────────────────────
document.getElementById('exportChat')?.addEventListener('click', () => {
  if (conversationHistory.length === 0) {
    showToast('No conversation to export', 'warn');
    return;
  }
  const lines = conversationHistory.map(t =>
    `[${t.role.toUpperCase()}]\n${t.content}\n`
  ).join('\n─────────────────────\n\n');

  const blob = new Blob([`Alexandria — Chat Export\n${'═'.repeat(40)}\n\n${lines}`], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `alexandria-chat-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Chat exported!', 'success');
});


// ── Sidebar toggle ────────────────────────────────────────────────
document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  chatSidebar?.classList.toggle('chat-sidebar--open');
});


// ── Input events ──────────────────────────────────────────────────
chatInput?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

chatInput?.addEventListener('input', () => {
  autoResize(chatInput);
  if (charCount) charCount.textContent = `${chatInput.value.length} / 2000`;
});

chatSend?.addEventListener('click', sendMessage);


// ── Load preferences on page load ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  chatInput?.focus();
  // Preload preferences into session context
  fetch('/api/preferences')
    .then(r => r.json())
    .then(prefs => {
      if (prefs && Object.keys(prefs).length > 0) {
        const label = document.getElementById('chatModelLabel');
        if (label && prefs.genres?.length) {
          label.textContent += ` · ${prefs.genres.slice(0,2).join(', ')} reader`;
        }
      }
    })
    .catch(() => {});
});
