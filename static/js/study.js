/**
 * study.js — Study Guide & Summary Generator
 */

// ── State ───────────────────────────────────────────────────────
let recentGuides = [];
let isGenerating  = false;
let currentTitle  = '';
let currentAuthor = '';


// ── Show output ───────────────────────────────────────────────────
function showOutput(title, content, type) {
  const panel   = document.getElementById('studyOutput');
  const header  = document.getElementById('outputTitle');
  const actions = document.getElementById('outputActions');
  if (!panel) return;

  currentTitle  = title;

  const typeLabel = type === 'guide' ? 'Study Guide' : 'Summary';
  if (header) header.textContent = `${typeLabel}: ${title}`;
  if (actions) actions.hidden = false;

  // Render formatted markdown
  const formatted = formatMarkdownStudy(content);
  panel.innerHTML = `<div class="study-output">${formatted}</div>`;
}

// ── Markdown formatter specialised for study guides ───────────────
function formatMarkdownStudy(text) {
  return text
    // Code blocks
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // Headings
    .replace(/^#{1}\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>')
    // Bold
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Horizontal rule
    .replace(/^---+$/gm, '<hr />')
    // Numbered lists
    .replace(/((?:^\d+\.\s+.+\n?)+)/gm, m => {
      const items = m.trim().split('\n').map(l => `<li>${l.replace(/^\d+\.\s+/, '')}</li>`).join('');
      return `<ol>${items}</ol>`;
    })
    // Bullet lists
    .replace(/((?:^[-*]\s+.+\n?)+)/gm, m => {
      const items = m.trim().split('\n').map(l => `<li>${l.replace(/^[-*]\s+/, '')}</li>`).join('');
      return `<ul>${items}</ul>`;
    })
    // Blockquotes
    .replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>')
    // Paragraph breaks
    .replace(/\n{2,}/g, '</p><p>')
    // Single line breaks
    .replace(/\n/g, '<br />')
    // Wrap in paragraph if no block element starts it
    .replace(/^(?!<[houlpbr]|<pre)(.+)/, '<p>$1</p>');
}


// ── Generate study guide ──────────────────────────────────────────
async function generateStudyGuide() {
  if (isGenerating) return;

  const title  = document.getElementById('studyTitle')?.value.trim();
  const author = document.getElementById('studyAuthor')?.value.trim() || '';
  const focus  = document.getElementById('studyFocus')?.value || 'general';

  if (!title) { showToast('Please enter a book title.', 'warn'); return; }

  isGenerating  = true;
  currentTitle  = title;
  currentAuthor = author;

  const btn = document.getElementById('generateStudyGuide');
  if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }

  const outputEl = document.getElementById('studyOutput');
  if (outputEl) {
    outputEl.innerHTML = `
      <div class="study-placeholder">
        <div class="dots" style="margin-bottom:16px"><span></span><span></span><span></span></div>
        <p style="color:var(--text-muted)">Alexandria is crafting your study guide for <strong>${escapeHtml(title)}</strong>…<br/>This usually takes 10–20 seconds.</p>
      </div>`;
  }

  try {
    const res  = await fetch('/api/study-guide', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ title, author, focus }),
    });
    const data = await res.json();

    if (data.error) {
      showOutput(title, `⚠️ Error: ${data.error}`, 'guide');
      showToast('Guide generation failed.', 'error');
    } else {
      showOutput(title, data.guide, 'guide');
      addToRecentGuides(title, author, 'Study Guide', data.guide);
      showToast('Study guide generated!', 'success');
    }
  } catch (e) {
    showOutput(title, '⚠️ Connection error. Please check the server.', 'guide');
    showToast('Connection error.', 'error');
  }

  if (btn) { btn.disabled = false; btn.textContent = 'Generate Study Guide'; }
  isGenerating = false;
}


// ── Generate summary ──────────────────────────────────────────────
async function generateSummary() {
  if (isGenerating) return;

  const title    = document.getElementById('summaryTitle')?.value.trim();
  const author   = document.getElementById('summaryAuthor')?.value.trim() || '';
  const spoilers = document.getElementById('spoilersOk')?.checked || false;

  if (!title) { showToast('Please enter a book title.', 'warn'); return; }

  isGenerating  = true;
  currentTitle  = title;
  currentAuthor = author;

  const btn = document.getElementById('generateSummary');
  if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }

  const outputEl = document.getElementById('studyOutput');
  if (outputEl) {
    outputEl.innerHTML = `
      <div class="study-placeholder">
        <div class="dots" style="margin-bottom:16px"><span></span><span></span><span></span></div>
        <p style="color:var(--text-muted)">Writing a summary of <strong>${escapeHtml(title)}</strong>…</p>
      </div>`;
  }

  try {
    const res  = await fetch('/api/summary', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ title, author, spoilers }),
    });
    const data = await res.json();

    if (data.error) {
      showOutput(title, `⚠️ ${data.error}`, 'summary');
      showToast('Summary generation failed.', 'error');
    } else {
      showOutput(title, data.summary, 'summary');
      addToRecentGuides(title, author, 'Summary', data.summary);
      showToast('Summary generated!', 'success');
    }
  } catch (e) {
    showOutput(title, '⚠️ Connection error.', 'summary');
    showToast('Connection error.', 'error');
  }

  if (btn) { btn.disabled = false; btn.textContent = 'Generate Summary'; }
  isGenerating = false;
}


// ── Recent guides list ────────────────────────────────────────────
function addToRecentGuides(title, author, type, content) {
  recentGuides.unshift({ title, author, type, content, ts: new Date() });
  if (recentGuides.length > 6) recentGuides.pop();
  renderRecentGuides();
}

function renderRecentGuides() {
  const list = document.getElementById('recentGuidesList');
  if (!list) return;

  if (recentGuides.length === 0) {
    list.innerHTML = '<p class="muted-text">No guides generated yet.</p>';
    return;
  }

  list.innerHTML = '';
  recentGuides.forEach(guide => {
    const item = document.createElement('button');
    item.className = 'recent-guide-item';
    item.innerHTML = `
      <span class="recent-guide-item__title">${escapeHtml(guide.title)}</span>
      <span class="recent-guide-item__meta">${guide.type} · ${guide.author || 'Unknown Author'}</span>`;
    item.addEventListener('click', () => {
      showOutput(guide.title, guide.content, guide.type === 'Summary' ? 'summary' : 'guide');
      currentAuthor = guide.author;
    });
    list.appendChild(item);
  });
}


// ── Copy output ───────────────────────────────────────────────────
document.getElementById('copyOutput')?.addEventListener('click', () => {
  const panel = document.getElementById('studyOutput');
  if (!panel) return;
  const text = panel.innerText || panel.textContent || '';
  navigator.clipboard.writeText(text)
    .then(() => showToast('Copied to clipboard!', 'success'))
    .catch(() => showToast('Copy failed.', 'error'));
});


// ── Add to shelf from study panel ─────────────────────────────────
document.getElementById('addToShelfFromStudy')?.addEventListener('click', async () => {
  if (!currentTitle) { showToast('No book to add.', 'warn'); return; }
  try {
    const res  = await fetch('/api/bookshelf/add', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ title: currentTitle, author: currentAuthor }),
    });
    const data = await res.json();
    if (data.status === 'exists') {
      showToast('Already on your shelf.', 'warn');
    } else {
      showToast(`"${currentTitle}" added to shelf!`, 'success');
    }
  } catch (e) {
    showToast('Could not add to shelf.', 'error');
  }
});


// ── Event Listeners ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('generateStudyGuide')?.addEventListener('click', generateStudyGuide);
  document.getElementById('generateSummary')?.addEventListener('click', generateSummary);

  // Handle pre-filled params from URL (e.g. from discover page)
  const params = new URLSearchParams(window.location.search);
  const title  = params.get('title');
  const author = params.get('author');
  if (title) {
    const titleEl  = document.getElementById('studyTitle');
    const authorEl = document.getElementById('studyAuthor');
    if (titleEl)  titleEl.value  = title;
    if (authorEl && author) authorEl.value = author;
  }
});
