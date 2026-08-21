/**
 * bookshelf.js — Virtual Bookshelf & Reading Progress Tracker
 */

// ── State ───────────────────────────────────────────────────────
let shelf          = [];
let currentFilter  = 'all';
let selectedColor  = '#8B6F47';
let selectedRating = 0;
let activeBookId   = null;

// ── Load shelf from server ────────────────────────────────────────
async function loadShelf() {
  try {
    const res = await fetch('/api/bookshelf');
    shelf = await res.json();
    renderShelf();
    updateSummary();
  } catch (e) {
    showToast('Could not load shelf data.', 'error');
  }
}

// ── Update summary stats ──────────────────────────────────────────
function updateSummary() {
  document.getElementById('psTotal').textContent     = shelf.length;
  document.getElementById('psReading').textContent   = shelf.filter(b => b.status === 'reading').length;
  document.getElementById('psCompleted').textContent = shelf.filter(b => b.status === 'completed').length;
  document.getElementById('psWantToRead').textContent= shelf.filter(b => b.status === 'want-to-read').length;
}

// ── Render bookshelf grid ─────────────────────────────────────────
function renderShelf() {
  const grid  = document.getElementById('bookshelfGrid');
  const empty = document.getElementById('shelfEmpty');
  if (!grid) return;

  const filtered = currentFilter === 'all' ? shelf : shelf.filter(b => b.status === currentFilter);

  if (filtered.length === 0) {
    if (empty) empty.style.display = 'block';
    // Clear any existing cards
    grid.querySelectorAll('.book-card').forEach(c => c.remove());
    return;
  }

  if (empty) empty.style.display = 'none';

  // Rebuild — clear old cards
  grid.querySelectorAll('.book-card').forEach(c => c.remove());

  filtered.forEach(book => {
    const card = buildBookCard(book);
    grid.appendChild(card);
  });
}

// ── Build individual book card ────────────────────────────────────
function buildBookCard(book) {
  const card = document.createElement('div');
  card.className = 'book-card';
  card.dataset.id = book.id;

  const statusLabels = {
    'reading':      'Reading',
    'completed':    'Completed',
    'want-to-read': 'Want to Read',
  };

  card.innerHTML = `
    <div class="book-spine" style="background: ${book.cover_color || '#8B6F47'}">
      <span class="book-spine__title">${escapeHtml(book.title)}</span>
    </div>
    <div class="book-card__body">
      <div class="book-card__author">${escapeHtml(book.author || 'Unknown Author')}</div>
      <div class="book-card__genre">${escapeHtml(book.genre || 'General')}</div>
      <span class="book-card__status book-card__status--${book.status}">
        ${statusLabels[book.status] || book.status}
      </span>
      ${book.status === 'reading' ? `
        <div class="book-card__progress">
          <div class="book-card__progress-fill" style="width:${book.progress || 0}%"></div>
        </div>
      ` : ''}
      ${book.rating > 0 ? `<div style="font-size:12px;margin-top:6px;color:var(--warning)">${'★'.repeat(book.rating)}${'☆'.repeat(5-book.rating)}</div>` : ''}
    </div>`;

  card.addEventListener('click', () => openBookDetail(book));
  return card;
}

// ── Open book detail modal ────────────────────────────────────────
function openBookDetail(book) {
  activeBookId = book.id;
  const modal  = document.getElementById('bookDetailModal');
  const title  = document.getElementById('detailTitle');
  const body   = document.getElementById('detailBody');
  if (!modal || !body) return;

  title.textContent = book.title;

  body.innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-select" id="detailStatus">
          <option value="want-to-read" ${book.status==='want-to-read'?'selected':''}>Want to Read</option>
          <option value="reading"      ${book.status==='reading'?'selected':''}>Currently Reading</option>
          <option value="completed"    ${book.status==='completed'?'selected':''}>Completed</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Progress: <span id="detailProgressVal">${book.progress||0}</span>%</label>
        <input type="range" class="form-range" id="detailProgress" min="0" max="100" value="${book.progress||0}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Rating</label>
      <div class="star-rating" id="detailStars" data-rating="${book.rating||0}">
        ${[1,2,3,4,5].map(n =>
          `<button class="star ${n <= (book.rating||0) ? 'star--active' : ''}" data-val="${n}" aria-label="${n} star">★</button>`
        ).join('')}
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea class="form-textarea" id="detailNotes" rows="4">${escapeHtml(book.notes||'')}</textarea>
    </div>
    <div style="font-size:var(--text-xs);color:var(--text-muted);padding-top:8px;border-top:1px solid var(--border)">
      Added: ${new Date(book.added_at).toLocaleDateString()} · Genre: ${escapeHtml(book.genre||'General')} · Author: ${escapeHtml(book.author||'Unknown')}
    </div>`;

  // Progress range event
  const progressEl = body.querySelector('#detailProgress');
  progressEl?.addEventListener('input', e => {
    body.querySelector('#detailProgressVal').textContent = e.target.value;
  });

  // Stars
  let currentRating = book.rating || 0;
  body.querySelectorAll('#detailStars .star').forEach(star => {
    star.addEventListener('click', () => {
      currentRating = parseInt(star.dataset.val);
      body.querySelectorAll('#detailStars .star').forEach(s => {
        s.classList.toggle('star--active', parseInt(s.dataset.val) <= currentRating);
      });
    });
    star.addEventListener('mouseover', () => {
      body.querySelectorAll('#detailStars .star').forEach(s => {
        s.classList.toggle('star--active', parseInt(s.dataset.val) <= parseInt(star.dataset.val));
      });
    });
    star.addEventListener('mouseleave', () => {
      body.querySelectorAll('#detailStars .star').forEach(s => {
        s.classList.toggle('star--active', parseInt(s.dataset.val) <= currentRating);
      });
    });
  });

  // Save button
  document.getElementById('detailSave').onclick = async () => {
    const payload = {
      status:   body.querySelector('#detailStatus').value,
      progress: parseInt(body.querySelector('#detailProgress').value),
      rating:   currentRating,
      notes:    body.querySelector('#detailNotes').value,
    };
    try {
      await fetch(`/api/bookshelf/update/${book.id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      await loadShelf();
      closeModal('bookDetailModal');
      showToast('Book updated!', 'success');
    } catch (e) {
      showToast('Update failed.', 'error');
    }
  };

  // Remove button
  document.getElementById('detailRemove').onclick = async () => {
    if (!confirm(`Remove "${book.title}" from your shelf?`)) return;
    try {
      await fetch(`/api/bookshelf/remove/${book.id}`, { method: 'DELETE' });
      await loadShelf();
      closeModal('bookDetailModal');
      showToast('Book removed from shelf.', '');
    } catch (e) {
      showToast('Remove failed.', 'error');
    }
  };

  openModal('bookDetailModal');
}

// ── Modal helpers ─────────────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('modal--open'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('modal--open'); document.body.style.overflow = ''; }
}

// ── Add book form ─────────────────────────────────────────────────
async function saveBook() {
  const title = document.getElementById('bookTitle')?.value.trim();
  if (!title) { showToast('Please enter a book title.', 'warn'); return; }

  const payload = {
    title,
    author:       document.getElementById('bookAuthor')?.value.trim() || '',
    genre:        document.getElementById('bookGenre')?.value.trim() || 'General',
    status:       document.getElementById('bookStatus')?.value || 'want-to-read',
    progress:     parseInt(document.getElementById('bookProgress')?.value || 0),
    rating:       selectedRating,
    notes:        document.getElementById('bookNotes')?.value.trim() || '',
    cover_color:  selectedColor,
  };

  try {
    const res  = await fetch('/api/bookshelf/add', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.status === 'exists') {
      showToast('That book is already on your shelf.', 'warn');
    } else {
      await loadShelf();
      closeModal('addBookModal');
      resetAddForm();
      showToast(`"${title}" added to your shelf!`, 'success');
    }
  } catch (e) {
    showToast('Could not add book.', 'error');
  }
}

function resetAddForm() {
  ['bookTitle','bookAuthor','bookGenre','bookNotes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const prog = document.getElementById('bookProgress');
  if (prog) { prog.value = 0; document.getElementById('progressVal').textContent = '0'; }
  selectedRating = 0;
  document.querySelectorAll('#starRating .star').forEach(s => s.classList.remove('star--active'));
  selectedColor = '#8B6F47';
  document.querySelectorAll('#colorSwatches .color-swatch').forEach((s,i) => {
    s.classList.toggle('color-swatch--active', i === 0);
  });
}

// ── Event Listeners ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadShelf();

  // Open add book modals
  ['openAddBook', 'openAddBook2'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => openModal('addBookModal'));
  });

  // Close modals
  document.getElementById('addBookModalClose')?.addEventListener('click',  () => closeModal('addBookModal'));
  document.getElementById('addBookCancel')?.addEventListener('click',      () => closeModal('addBookModal'));
  document.getElementById('bookDetailClose')?.addEventListener('click',    () => closeModal('bookDetailModal'));

  // Overlay close
  ['addBookModal','bookDetailModal'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModal(id);
    });
  });

  // Save book button
  document.getElementById('saveBook')?.addEventListener('click', saveBook);

  // Progress range
  document.getElementById('bookProgress')?.addEventListener('input', e => {
    document.getElementById('progressVal').textContent = e.target.value;
  });

  // Star rating
  const starRating = document.getElementById('starRating');
  starRating?.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', () => {
      selectedRating = parseInt(star.dataset.val);
      starRating.querySelectorAll('.star').forEach(s => {
        s.classList.toggle('star--active', parseInt(s.dataset.val) <= selectedRating);
      });
    });
    star.addEventListener('mouseover', () => {
      starRating.querySelectorAll('.star').forEach(s => {
        s.classList.toggle('star--active', parseInt(s.dataset.val) <= parseInt(star.dataset.val));
      });
    });
    star.addEventListener('mouseleave', () => {
      starRating.querySelectorAll('.star').forEach(s => {
        s.classList.toggle('star--active', parseInt(s.dataset.val) <= selectedRating);
      });
    });
  });

  // Color swatches
  document.querySelectorAll('#colorSwatches .color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      selectedColor = swatch.dataset.color;
      document.querySelectorAll('#colorSwatches .color-swatch').forEach(s => s.classList.remove('color-swatch--active'));
      swatch.classList.add('color-swatch--active');
    });
  });

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentFilter = tab.dataset.filter;
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('filter-tab--active'));
      tab.classList.add('filter-tab--active');
      renderShelf();
    });
  });
});
