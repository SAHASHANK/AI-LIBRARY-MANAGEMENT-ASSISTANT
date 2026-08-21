/**
 * discover.js — AI-Powered Book Discovery & Recommendation Feed
 */

// ── State ───────────────────────────────────────────────────────
let isLoading       = false;
let currentCategory = '';

// ── Fetch recommendations ─────────────────────────────────────────
async function fetchRecommendations(query = '', category = '') {
  if (isLoading) return;
  isLoading = true;

  const skeleton = document.getElementById('recSkeleton');
  const results  = document.getElementById('recResults');

  if (skeleton) skeleton.style.display = 'flex';
  if (results)  results.innerHTML = '';

  const payload = {};
  if (query)    payload.query = query;
  if (category) payload.query = `Best ${category} books worth reading`;

  try {
    const res  = await fetch('/api/recommendations', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();

    if (skeleton) skeleton.style.display = 'none';

    if (data.error) {
      if (results) results.innerHTML = `<div class="rec-card" style="color:var(--destructive)">⚠️ ${escapeHtml(data.error)}</div>`;
      return;
    }

    renderRecommendations(data.recommendations || '');

  } catch (e) {
    if (skeleton) skeleton.style.display = 'none';
    if (results)  results.innerHTML = '<div class="rec-card">Connection error. Please try again.</div>';
  }

  isLoading = false;
}


// ── Parse & render recommendations ───────────────────────────────
function renderRecommendations(text) {
  const results = document.getElementById('recResults');
  if (!results) return;

  if (!text.trim()) {
    results.innerHTML = '<div class="rec-card">No recommendations returned. Try a different query.</div>';
    return;
  }

  // Split on numbered entries: "1." / "[1]"
  const entries = splitRecommendations(text);

  if (entries.length === 0) {
    // Fallback: render raw formatted text in a single card
    results.innerHTML = `<div class="rec-card">
      <div class="study-output">${formatMarkdown(text)}</div>
    </div>`;
    return;
  }

  results.innerHTML = '';
  entries.forEach((entry, idx) => {
    const card = buildRecCard(entry, idx + 1);
    results.appendChild(card);
  });
}


// ── Split AI text into individual recommendation entries ──────────
function splitRecommendations(text) {
  // Try splitting by "1." "2." or "[1]" "[2]"
  const pattern = /(?:^\[?\d+\]?\.?\s+|\n\[?\d+\]?\.?\s+)/gm;
  const parts   = text.split(pattern).filter(p => p.trim().length > 20);
  return parts;
}


// ── Build individual recommendation card ─────────────────────────
function buildRecCard(text, num) {
  const card = document.createElement('div');
  card.className = 'rec-card';

  // Try to extract title (bold text or first line)
  const boldMatch = text.match(/\*\*([^*]+)\*\*/);
  const title     = boldMatch ? boldMatch[1] : text.split('\n')[0].replace(/^[^:]+:\s*/, '').trim();

  // Extract author
  const authorMatch = text.match(/by ([A-Z][a-z]+ [A-Z][a-z]+)/);
  const author      = authorMatch ? authorMatch[1] : '';

  // Extract genre tag — look for (Genre) pattern
  const genreMatch = text.match(/\(([^)]{3,30})\)/);
  const genre      = genreMatch ? genreMatch[1] : '';

  // Try to extract "Why it matches" or last sentence as rationale
  const whyMatch   = text.match(/[Ww]hy[^:]*:\s*(.+?)(?:\n|$)/s) || text.match(/[Mm]atches[^:]*:\s*(.+?)(?:\n|$)/s);
  const whyText    = whyMatch ? whyMatch[1].trim() : '';

  // Clean body for synopsis
  let body = text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br />');

  card.innerHTML = `
    <div class="rec-card__header">
      <div class="rec-card__num">${String(num).padStart(2,'0')}</div>
      <div class="rec-card__title-group">
        <div class="rec-card__title">${escapeHtml(title)}</div>
        ${author ? `<div class="rec-card__author">by ${escapeHtml(author)}</div>` : ''}
      </div>
      ${genre ? `<span class="rec-card__genre">${escapeHtml(genre)}</span>` : ''}
    </div>
    <div class="rec-card__synopsis">${body}</div>
    ${whyText ? `<p class="rec-card__why">${escapeHtml(whyText)}</p>` : ''}
    <div class="rec-card__actions">
      <button class="btn btn--sm btn--ghost add-to-shelf-btn"
        data-title="${escapeHtml(title)}" data-author="${escapeHtml(author)}" data-genre="${escapeHtml(genre)}">
        + Add to Shelf
      </button>
      <a href="/study?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}"
         class="btn btn--sm btn--ghost">Study Guide →</a>
      <a href="/chat?q=Tell me more about ${encodeURIComponent(title)}"
         class="btn btn--sm btn--ghost">Ask Alexandria →</a>
    </div>`;

  // Add to shelf
  card.querySelector('.add-to-shelf-btn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Adding…';
    try {
      const res  = await fetch('/api/bookshelf/add', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          title:  btn.dataset.title,
          author: btn.dataset.author,
          genre:  btn.dataset.genre,
        }),
      });
      const data = await res.json();
      if (data.status === 'exists') {
        btn.textContent = '✓ Already on shelf';
        showToast('Already on your shelf.', 'warn');
      } else {
        btn.textContent = '✓ Added to shelf';
        showToast(`"${btn.dataset.title}" added to shelf!`, 'success');
      }
    } catch (err) {
      btn.textContent = '+ Add to Shelf';
      btn.disabled    = false;
      showToast('Could not add book.', 'error');
    }
  });

  return card;
}


// ── Event Listeners ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Search
  const searchBtn   = document.getElementById('discoverSearchBtn');
  const searchInput = document.getElementById('discoverSearch');

  searchBtn?.addEventListener('click', () => {
    fetchRecommendations(searchInput?.value.trim());
  });

  searchInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') fetchRecommendations(searchInput.value.trim());
  });

  // Quick suggestion tags
  document.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (searchInput) searchInput.value = btn.dataset.q || '';
      fetchRecommendations(btn.dataset.q || '');
    });
  });

  // Category pills
  document.querySelectorAll('.category-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      currentCategory = pill.dataset.cat;
      document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('category-pill--active'));
      pill.classList.add('category-pill--active');
      if (searchInput) searchInput.value = '';
      fetchRecommendations('', currentCategory);
    });
  });

  // Auto-load personalized recommendations on page load
  fetchRecommendations();

  // Handle pre-filled query from URL (e.g. from chat link)
  const urlParams = new URLSearchParams(window.location.search);
  const qParam    = urlParams.get('q');
  if (qParam) {
    if (searchInput) searchInput.value = qParam;
    fetchRecommendations(qParam);
  }
});
