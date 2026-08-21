/**
 * app.js — Alexandria Global Application Module
 * Handles: Theme toggle, preferences modal, nav, toast, shared utilities
 */

// ── Utility: HTML escaping ──────────────────────────────────────
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ── Utility: Basic Markdown → HTML (inline) ─────────────────────
function formatMarkdown(text) {
  if (!text) return '';
  return text
    // Code blocks
    .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // H3
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    // H2
    .replace(/^## (.+)$/gm, '<h2>$2</h2>'.replace('$2','$1'))
    // Ordered list items
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    // Unordered list items
    .replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ol>/<ul>
    .replace(/(<li>.*<\/li>\n?)+/g, m => {
      const isOrdered = /^\d+\./.test('');
      return `<ol>${m}</ol>`;
    })
    // Horizontal rules
    .replace(/^---$/gm, '<hr />')
    // Line breaks (double newline = paragraph)
    .replace(/\n\n/g, '</p><p>')
    // Single newlines
    .replace(/\n/g, '<br />')
    // Wrap in paragraph if not already block
    .replace(/^(?!<[holupr]|<pre|<block)(.+)/m, '<p>$1</p>');
}

// ── Toast Notification ──────────────────────────────────────────
function showToast(message, type = '', duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className   = `toast toast--show${type ? ` toast--${type}` : ''}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.className = 'toast';
  }, duration);
}


// ── Theme ───────────────────────────────────────────────────────
const ThemeManager = (() => {
  const KEY = 'alexandria-theme';
  const html = document.documentElement;

  function apply(theme) {
    html.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = theme === 'dark' ? '◐' : '◑';
  }

  function toggle() {
    const current = html.getAttribute('data-theme') || 'light';
    apply(current === 'dark' ? 'light' : 'dark');
  }

  function init() {
    const saved = localStorage.getItem(KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    apply(saved || (prefersDark ? 'dark' : 'light'));

    const btn = document.getElementById('themeToggle');
    if (btn) btn.addEventListener('click', toggle);
  }

  return { init, toggle, apply };
})();


// ── Preferences Modal ───────────────────────────────────────────
const PreferencesManager = (() => {
  let prefs = {};

  function openModal() {
    const overlay = document.getElementById('prefModal');
    if (!overlay) return;
    loadCurrent();
    overlay.classList.add('modal--open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const overlay = document.getElementById('prefModal');
    if (!overlay) return;
    overlay.classList.remove('modal--open');
    document.body.style.overflow = '';
  }

  function loadCurrent() {
    fetch('/api/preferences')
      .then(r => r.json())
      .then(data => {
        prefs = data;
        // Mark genre chips
        const genres = data.genres || [];
        document.querySelectorAll('#genreChips .chip').forEach(chip => {
          chip.classList.toggle('chip--selected', genres.includes(chip.dataset.value));
        });
        // Set dropdowns
        const level  = document.getElementById('readingLevel');
        const intent = document.getElementById('readingIntent');
        if (level  && data.reading_level) level.value  = data.reading_level;
        if (intent && data.intent)        intent.value = data.intent;
        // Mark format chips
        const formats = data.formats || ['Physical', 'eBook'];
        document.querySelectorAll('#formatChips .chip').forEach(chip => {
          chip.classList.toggle('chip--selected', formats.includes(chip.dataset.value));
        });
      })
      .catch(() => {});
  }

  function savePreferences() {
    const genres  = Array.from(document.querySelectorAll('#genreChips .chip--selected')).map(c => c.dataset.value);
    const formats = Array.from(document.querySelectorAll('#formatChips .chip--selected')).map(c => c.dataset.value);
    const level   = document.getElementById('readingLevel')?.value || 'Adult';
    const intent  = document.getElementById('readingIntent')?.value || 'Leisure';

    const payload = { genres, formats, reading_level: level, intent };

    fetch('/api/preferences', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
      .then(r => r.json())
      .then(() => {
        closeModal();
        showToast('Reading profile saved!', 'success');
      })
      .catch(() => showToast('Failed to save preferences.', 'error'));
  }

  function init() {
    // Chip toggle behaviour (genre + format chips)
    document.querySelectorAll('.chip-group').forEach(group => {
      group.addEventListener('click', e => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        chip.classList.toggle('chip--selected');
      });
    });

    // Open / Close events
    document.querySelectorAll('#openPreferences, #sidebarPrefBtn').forEach(btn => {
      btn?.addEventListener('click', openModal);
    });
    document.getElementById('prefModalClose')?.addEventListener('click', closeModal);
    document.getElementById('prefModalCancel')?.addEventListener('click', closeModal);
    document.getElementById('prefModalSave')?.addEventListener('click', savePreferences);

    // Close on overlay click
    document.getElementById('prefModal')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModal();
    });
  }

  return { init, openModal, closeModal };
})();


// ── Navigation ──────────────────────────────────────────────────
const NavManager = (() => {
  function init() {
    const menuBtn   = document.getElementById('mobileMenuBtn');
    const mobileNav = document.getElementById('mobileMenu');
    if (!menuBtn || !mobileNav) return;

    menuBtn.addEventListener('click', () => {
      const isOpen = mobileNav.classList.toggle('nav__mobile--open');
      menuBtn.setAttribute('aria-expanded', String(isOpen));
    });

    // Close on outside click
    document.addEventListener('click', e => {
      if (!e.target.closest('.nav')) {
        mobileNav.classList.remove('nav__mobile--open');
      }
    });
  }
  return { init };
})();


// ── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
  PreferencesManager.init();
  NavManager.init();
});
