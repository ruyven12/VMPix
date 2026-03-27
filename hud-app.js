// hud-app.js
// Keeps your HUD markup + CSS untouched. This file only moves the inline logic out of index.html.
//
// Dependencies (optional): music-archive.js, wrestling-archive.js, about-archive.js
// Each can expose window.MusicArchive / window.WrestlingArchive / window.AboutArchive
//
// NOTE: This is intentionally vanilla (no build tools / no modules) to match your previous style.

(function(){
  "use strict";

  // =============================
  // GLOBAL "DING" (tiny audible cue)
  // =============================
  // Usage: window.vmDing();
  // Safe: no-op if audio is unavailable or blocked.
  window.vmDing = function vmDing(){
    try{
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(ctx.destination);
      const now = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      o.start(now);
      o.stop(now + 0.14);
      o.onended = () => { try{ ctx.close(); }catch(_){ } };
    }catch(_){ }
  };

  
  // Auto-set --intro-chars based on the text inside .hudIntroType
  document.querySelectorAll('.hudIntroText').forEach(el => {
    const alreadySet = el.style.getPropertyValue('--intro-chars');
    if (alreadySet) return;

    const t = el.querySelector('.hudIntroType');
    if (!t) return;

    const n = ((t.textContent || '').trim().length || 1) + 1; // +1 buffer
    el.style.setProperty('--intro-chars', n);
  });

  function ensureHudResponsiveNavStyles(){
    if (document.getElementById('hudResponsiveNavStyles')) return;

    const s = document.createElement('style');
    s.id = 'hudResponsiveNavStyles';
    s.textContent = `
      html{
        -webkit-text-size-adjust: 100%;
        text-size-adjust: 100%;
      }

      @media (max-width: 760px){
        .hudContent{
          grid-template-rows: auto auto minmax(0, 1fr) !important;
          padding-left: 12px !important;
          padding-right: 12px !important;
        }

        .hudTopbar{
          padding: 10px 12px !important;
        }

        .hudBrandImg{
          height: 58px !important;
          max-width: min(72vw, 240px) !important;
          object-fit: contain;
        }

        .hudContent > .hudStub:not(.hudMain){
          display: flex !important;
          flex-wrap: wrap;
          justify-content: center;
          align-items: center;
          gap: 8px 10px;
          padding: 10px 6px 8px !important;
          overflow: visible !important;
        }

        .hudIntroText{
          font-size: clamp(10px, 2.55vw, 12px) !important;
          padding: 6px 9px !important;
          max-width: calc(50vw - 22px);
          transform: none !important;
        }

        .hudIntroType{
          width: auto !important;
          overflow: visible !important;
          animation: none !important;
          white-space: nowrap;
          letter-spacing: .08em !important;
        }

        .hudStub.hudMain{
          min-height: 0 !important;
          margin-top: 8px !important;
        }
      }

      @media (max-width: 520px){
        .hudIntroText{
          font-size: clamp(9px, 2.8vw, 10.5px) !important;
          padding: 5px 8px !important;
          max-width: calc(50vw - 18px);
        }

        .hudIntroType{
          letter-spacing: .05em !important;
        }
      }
    `;
    document.head.appendChild(s);
  }
  ensureHudResponsiveNavStyles();

  
  // =============================
  // NAV PILL HI-TECH INTERACTION
  // =============================
  (function(){
    const pills = Array.from(document.querySelectorAll('.hudIntroText'));
    if (!pills.length) return;
    const ADMIN_TOKEN_KEY = 'vm_admin_token_v1';
    let adminTokenMemory = '';
    const ADMIN_AUTH_API_BASE =
      (typeof window !== 'undefined' && typeof window.WRESTLING_ARCHIVE_API_BASE === 'string' && window.WRESTLING_ARCHIVE_API_BASE.trim())
        ? window.WRESTLING_ARCHIVE_API_BASE.trim().replace(/\/$/, '')
        : 'https://wrestling-archive.onrender.com';
    let adminModal = null;
    const adminPill = document.querySelector('.hudIntroText[data-admin-trigger]');

    function setAdminUnlockedUI(unlocked){
      if (!adminPill) return;
      adminPill.classList.toggle('is-admin-unlocked', !!unlocked);
      adminPill.classList.toggle('is-disabled', !unlocked);
      adminPill.setAttribute('aria-expanded', 'false');
    }

    function getAdminToken(){
      let token = String(adminTokenMemory || '').trim();
      if (!token) {
        try { token = String(sessionStorage.getItem(ADMIN_TOKEN_KEY) || '').trim(); } catch (_) {}
      }
      if (token && !adminTokenMemory) {
        adminTokenMemory = token;
        try { window.__VM_ADMIN_TOKEN__ = token; } catch (_) {}
      }
      return String(token || '').trim();
    }

    function isAdminUnlocked(){
      return !!getAdminToken();
    }

    function markAdminUnlocked(token){
      if (!token) return;
      adminTokenMemory = String(token || '').trim();
      try { window.__VM_ADMIN_TOKEN__ = adminTokenMemory; } catch (_) {}
      try { sessionStorage.setItem(ADMIN_TOKEN_KEY, adminTokenMemory); } catch (_) {}
      setAdminUnlockedUI(true);
    }

    function clearAdminUnlocked(){
      adminTokenMemory = '';
      try { window.__VM_ADMIN_TOKEN__ = ''; } catch (_) {}
      try { sessionStorage.removeItem(ADMIN_TOKEN_KEY); } catch (_) {}
      setAdminUnlockedUI(false);
    }
    try { window.__vmClearAdminUnlocked = clearAdminUnlocked; } catch (_) {}

    async function verifyAdminAccess(){
      const token = getAdminToken();
      if (!token) {
        clearAdminUnlocked();
        return false;
      }
      try { window.__VM_ADMIN_TOKEN__ = token; } catch (_) {}
      try {
        const res = await fetch(`${ADMIN_AUTH_API_BASE}/admin/verify`, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`
          }
        });
        if (!res.ok) {
          clearAdminUnlocked();
          return false;
        }
        try { sessionStorage.setItem(ADMIN_TOKEN_KEY, token); } catch (_) {}
        setAdminUnlockedUI(true);
        return true;
      } catch (_) {
        return true;
      }
    }

    function ensureAdminModal(){
      if (adminModal && adminModal.parentNode) return adminModal;
      const el = document.createElement('div');
      el.className = 'hudAdminModal';
      el.innerHTML = `
        <div class="hudAdminCard" role="dialog" aria-modal="true" aria-label="Admin Access">
          <div class="hudAdminEyebrow">Restricted</div>
          <div class="hudAdminTitle">Admin Access</div>
          <div class="hudAdminBody">Enter the password to continue. This access is now verified through the backend before the Admin route unlocks.</div>
          <input class="hudAdminField" id="hudAdminPassword" type="password" inputmode="numeric" autocomplete="current-password" placeholder="Password" />
          <div class="hudAdminError" id="hudAdminError"></div>
          <div class="hudAdminActions">
            <button type="button" class="hudAdminBtn" data-admin-action="cancel">Cancel</button>
            <button type="button" class="hudAdminBtn is-primary" data-admin-action="submit">Unlock</button>
          </div>
        </div>
      `;
      document.body.appendChild(el);
      adminModal = el;

      el.addEventListener('click', (e) => {
        const btn = e.target && e.target.closest ? e.target.closest('[data-admin-action]') : null;
        if (btn) {
          const act = btn.getAttribute('data-admin-action') || '';
          if (act === 'cancel') closeAdminModal();
          if (act === 'submit') submitAdminPassword();
          return;
        }
        if (e.target === el) closeAdminModal();
      });

      const input = el.querySelector('#hudAdminPassword');
      if (input) {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submitAdminPassword();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            closeAdminModal();
          }
        });
      }

      return el;
    }

    function openAdminModal(){
      const el = ensureAdminModal();
      if (!el) return;
      el.classList.add('is-open');
      const err = el.querySelector('#hudAdminError');
      const input = el.querySelector('#hudAdminPassword');
      if (err) err.textContent = '';
      if (input) {
        input.value = '';
        window.setTimeout(() => { try { input.focus(); } catch (_) {} }, 20);
      }
    }
    try { window.__vmOpenAdminModal = openAdminModal; } catch (_) {}

    function closeAdminModal(){
      const el = ensureAdminModal();
      if (!el) return;
      el.classList.remove('is-open');
      if (adminPill) adminPill.setAttribute('aria-expanded', 'false');
    }

    async function submitAdminPassword(){
      const el = ensureAdminModal();
      if (!el) return;
      const input = el.querySelector('#hudAdminPassword');
      const err = el.querySelector('#hudAdminError');
      const submitBtn = el.querySelector('[data-admin-action="submit"]');
      const value = input ? String(input.value || '').trim() : '';
      if (err) err.textContent = '';
      if (!value) {
        if (err) err.textContent = 'Enter the password';
        return;
      }
      if (submitBtn) submitBtn.disabled = true;
      try {
        const res = await fetch(`${ADMIN_AUTH_API_BASE}/admin/auth`, {
          method: 'POST',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({ password: value })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data || !data.ok || !data.token) {
          clearAdminUnlocked();
          if (err) err.textContent = (data && data.error === 'invalid password') ? 'Incorrect password' : 'Unable to verify access right now';
          return;
        }
        markAdminUnlocked(data.token);
        if (err) err.textContent = 'Access approved';
        window.setTimeout(() => {
          closeAdminModal();
          navigateToRoute('admin');
          try { scheduleVmAdminAnalyticsAutoload('7d', { delayMs: 450, maxAttempts: 8 }); } catch (_) {}
        }, 220);
      } catch (_) {
        if (err) err.textContent = 'Unable to reach admin auth service';
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    }

    // Nav underline rail (single element that slides between pills)
    // NOTE: Disabled for now (user request: kill underline). Keep code path in place
    // so it can be re-enabled later with a single toggle.
    const ENABLE_NAV_UNDERLINE = false;
    const navStub = document.querySelector('.hudContent > .hudStub:not(.hudMain)') || null;
    let underline = null;

    function ensureUnderline(){
      if (!ENABLE_NAV_UNDERLINE) return null;
      if (!navStub) return null;
      if (underline && underline.parentNode) return underline;
      underline = document.createElement('div');
      underline.className = 'hudNavUnderline';
      underline.setAttribute('aria-hidden', 'true');
      navStub.appendChild(underline);
      return underline;
    }

    function moveUnderlineTo(el){
      if (!ENABLE_NAV_UNDERLINE) return;
      const u = ensureUnderline();
      if (!u || !navStub || !el) return;

      const r = el.getBoundingClientRect();
      const nr = navStub.getBoundingClientRect();
      const left = Math.max(0, (r.left - nr.left));
      const w = Math.max(10, r.width);

      u.style.setProperty('--ux', left + 'px');
      u.style.width = w + 'px';
      u.classList.add('is-on');
    }

    function clearUnderline(){
      if (!ENABLE_NAV_UNDERLINE) return;
      if (!underline) return;
      underline.classList.remove('is-on');
    }

    // Pointer-follow glow hotspot + magnetic micro-motion (desktop only; harmless on touch)
        pills.forEach(pill => {
      pill.addEventListener('pointermove', (e) => {
        const r = pill.getBoundingClientRect();
        const x = (e.clientX - r.left);
        const y = (e.clientY - r.top);
        pill.style.setProperty('--mx', x + 'px');
        pill.style.setProperty('--my', y + 'px');

        const nx = (x / Math.max(1, r.width)) - 0.5;
        const ny = (y / Math.max(1, r.height)) - 0.5;
        const tx = Math.max(-4, Math.min(4, nx * 8));
        const ty = Math.max(-3, Math.min(3, ny * 6));
        pill.style.setProperty('--tx', tx.toFixed(2) + 'px');
        pill.style.setProperty('--ty', ty.toFixed(2) + 'px');
      }, { passive: true });

      pill.addEventListener('pointerleave', () => {
        pill.style.removeProperty('--mx');
        pill.style.removeProperty('--my');
        pill.style.removeProperty('--tx');
        pill.style.removeProperty('--ty');
      }, { passive: true });

      pill.addEventListener('click', (e) => {
        pill.classList.remove('is-press');
        void pill.offsetWidth;
        pill.classList.add('is-press');
        window.setTimeout(() => pill.classList.remove('is-press'), 260);

        if (e.defaultPrevented) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (typeof e.button === 'number' && e.button !== 0) return;

        if (pill.hasAttribute('data-admin-trigger')) {
          e.preventDefault();
          if (isAdminUnlocked()) {
            verifyAdminAccess().then((ok) => {
              if (ok) {
                setAdminUnlockedUI(true);
                navigateToRoute('admin');
                return;
              }
              pill.setAttribute('aria-expanded', 'true');
              openAdminModal();
            });
            return;
          }
          pill.setAttribute('aria-expanded', 'true');
          openAdminModal();
          return;
        }

        const route = pill.getAttribute('data-nav') || 'home';
        e.preventDefault();
        navigateToRoute(route);
      });
    });

    Array.from(document.querySelectorAll('.hudBrandLink[data-nav]')).forEach(link => {
      link.addEventListener('click', (e) => {
        if (e.defaultPrevented) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (typeof e.button === 'number' && e.button !== 0) return;
        e.preventDefault();
        navigateToRoute(link.getAttribute('data-nav') || 'home');
      });
    });

    // Expose a tiny hook for the router to reposition underline on route change
    window.__hudMoveNavUnderline = function(){
      if (!ENABLE_NAV_UNDERLINE) return;
      const active = document.querySelector('.hudStub [data-nav].is-active') || null;
      if (active) moveUnderlineTo(active);
    };

    // Initial underline placement (after first layout)
    window.requestAnimationFrame(() => {
      if (!ENABLE_NAV_UNDERLINE) return;
      const active = document.querySelector('.hudStub [data-nav].is-active') || null;
      if (active) moveUnderlineTo(active);
    });

    clearAdminUnlocked();
  })();

function pulseFrame(){
    const wrap = document.querySelector('.neonFrameWrap');

    // If the neon frame exists (older layout), pulse it. Otherwise skip safely.
    if (wrap){
      wrap.classList.remove('pulse');
      void wrap.offsetWidth;
      wrap.classList.add('pulse');
    }

    // Whole HUD surge (pairs with CSS in index.html)
    const hudEl = document.getElementById('hud');
    if (hudEl){
      hudEl.classList.remove('hud-surge');
      void hudEl.offsetWidth;
      hudEl.classList.add('hud-surge');
      window.setTimeout(() => hudEl.classList.remove('hud-surge'), 260);
    }

    // pill-only wipe pulse (no layout changes)
    const pills = document.querySelectorAll('.hudIntroText');
    pills.forEach(p => p.classList.remove('isPulse'));
    void document.body.offsetWidth;
    pills.forEach(p => p.classList.add('isPulse'));
    window.setTimeout(() => pills.forEach(p => p.classList.remove('isPulse')), 1100);
  }
  // HUD MAIN: terminal typing (paragraph mode)
  function typeHudMainText(newText, el){
    const t = el || document.querySelector('[data-hud-main-text]');
    if (!t) return;

    const fullText = (newText ?? t.textContent ?? '').toString().trim();
    if (!fullText) return;

    t.classList.add('isTyping');
    t.textContent = '';

    const speedMs = 12;
    let i = 0;

    if (t._typeTimer) clearInterval(t._typeTimer);

    t._typeTimer = setInterval(() => {
      i++;
      t.textContent = fullText.slice(0, i);

      if (i >= fullText.length) {
        clearInterval(t._typeTimer);
        t._typeTimer = null;
        t.textContent = fullText;
      }
    }, speedMs);
  }

  function stopAllTyping(){
    document.querySelectorAll('[data-hud-main-text]').forEach(el => {
      if (el && el._typeTimer){
        clearInterval(el._typeTimer);
        el._typeTimer = null;
      }
      if (el) el.classList.remove('isTyping');
    });
  }

  // =============================
  // Routing + Mount
  // =============================
  const mount = () => document.getElementById('hudMainMount');
  const DEFAULT_SITE_TITLE = 'Voodoo Media';

  function buildDocumentTitle(label){
    const part = String(label || '').trim();
    return part ? part + ' - ' + DEFAULT_SITE_TITLE : DEFAULT_SITE_TITLE;
  }

  function setDocumentTitle(label){
    try { document.title = buildDocumentTitle(label); } catch (_) {}
  }

  function setActiveTopNav(route){
    document.querySelectorAll('.hudStub [data-nav]').forEach(a => {
      a.classList.toggle('is-active', a.getAttribute('data-nav') === route);
    });

    // Cinematic nav underline: keep it pinned to the active pill
    try{
      if (typeof window.__hudMoveNavUnderline === 'function') window.__hudMoveNavUnderline();
    }catch(_){ }
  }

    const VALID_ROUTE_KEYS = new Set(['home','music','wrestling','calendar','about','pricing','contact','admin']);

  function sanitizeRouteKey(v){
    const key = String(v || '').trim().toLowerCase();
    return VALID_ROUTE_KEYS.has(key) ? key : '';
  }

  function routeKeyFromHash(){
    const hash = location.hash || '#/home';
    return sanitizeRouteKey(hash.replace(/^#\/?/, '').trim() || 'home') || 'home';
  }

  function routeKeyFromPath(){
    try {
      const path = String(location.pathname || '').trim();
      const seg = path.replace(/^\/+|\/+$/g, '').split('/')[0] || '';
      return sanitizeRouteKey(seg);
    } catch (_) {
      return '';
    }
  }

      function currentRouteKey(){
    const pathRoute = routeKeyFromPath();
    if (pathRoute) return pathRoute;
    return 'home';
  }

    function routePathForKey(route){
    const key = sanitizeRouteKey(route) || 'home';
    if (key === 'home') return '/';
    if (key === 'music') return '/music';
    return `/${key}`;
  }

  function routeKeyFromAny(v){
    const raw = String(v || '').trim();
    if (!raw) return 'home';
    if (raw.startsWith('#')) return sanitizeRouteKey(raw.replace(/^#\/?/, '').trim()) || 'home';
    if (raw.startsWith('/')) return sanitizeRouteKey(raw.replace(/^\/+|\/+$/g, '').split('/')[0]) || 'home';
    return sanitizeRouteKey(raw) || 'home';
  }

  function syncUrlToRoute(route, opts){
    const key = sanitizeRouteKey(route) || 'home';
    const replace = !!(opts && opts.replace);
    const preservePath = !!(opts && opts.preservePath);
    const currentPath = String(location.pathname || '').trim();
    const shouldPreserveSubpath = preservePath && (
      (key === 'music' && currentPath.toLowerCase().startsWith('/music/')) ||
      (key === 'wrestling' && currentPath.toLowerCase().startsWith('/wrestling/'))
    );
    const target = shouldPreserveSubpath
      ? currentPath + (location.search || '')
      : routePathForKey(key) + (location.search || '');
    try {
      if (replace) history.replaceState(__VM_BACK_GUARD_STATE, document.title, target);
      else history.pushState(__VM_BACK_GUARD_STATE, document.title, target);
    } catch (_) {
      location.hash = '#/' + key;
      return;
    }
    try { setLastHash('#/' + key); } catch (_) {}
  }

  function navigateToRoute(route, opts){
    const key = routeKeyFromAny(route);
    syncUrlToRoute(key, opts);
    navigate(key);
  }

  async function __vmAdminFetch(path, options){
    const base =
      (typeof window !== 'undefined' && typeof window.WRESTLING_ARCHIVE_API_BASE === 'string' && window.WRESTLING_ARCHIVE_API_BASE.trim())
        ? window.WRESTLING_ARCHIVE_API_BASE.trim().replace(/\/$/, '')
        : 'https://wrestling-archive.onrender.com';
    let token = '';
    try { token = String(sessionStorage.getItem('vm_admin_token_v1') || '').trim(); } catch (_) {}
    if (!token) {
      try { token = String((window && window.__VM_ADMIN_TOKEN__) || '').trim(); } catch (_) {}
    }
    const headers = Object.assign({
      Accept: 'application/json'
    }, (options && options.headers) || {});
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${base}${path}`, Object.assign({ cache: 'no-store', headers }, options || {}));
  }

  function escapeVmAdminHtml(value){
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatVmAdminNumber(value){
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return '0';
    try { return num.toLocaleString(); } catch (_) {}
    return String(num);
  }

  function formatVmAdminDate(value){
    if (!value) return 'Unknown';
    try {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date.toLocaleString();
    } catch (_) {}
    return String(value);
  }

  function getVmAdminWrestlingApiBase(){
    return (
      (typeof window !== 'undefined' && typeof window.WRESTLING_ARCHIVE_API_BASE === 'string' && window.WRESTLING_ARCHIVE_API_BASE.trim())
        ? window.WRESTLING_ARCHIVE_API_BASE.trim().replace(/\/$/, '')
        : 'https://wrestling-archive.onrender.com'
    );
  }

  function getVmAdminMusicApiBase(){
    return (
      (typeof window !== 'undefined' && typeof window.MUSIC_ARCHIVE_API_BASE === 'string' && window.MUSIC_ARCHIVE_API_BASE.trim())
        ? window.MUSIC_ARCHIVE_API_BASE.trim().replace(/\/$/, '')
        : 'https://music-archive-3lfa.onrender.com'
    );
  }

  const vmAdminFacebookPickerState = {
    loading: false,
    loaded: false,
    loadError: '',
    items: [],
    query: '',
    browseShowId: '',
    browseMatchId: '',
    photoItems: [],
    selectedPhotoIds: [],
    photoLoading: false,
    photoError: '',
    selectedId: '',
    selected: null
  };

  const vmAdminFacebookMentionState = {
    loading: false,
    loaded: false,
    error: '',
    results: [],
    active: false,
    query: '',
    start: -1,
    end: -1,
    activeIndex: 0
  };

  const vmAdminFacebookAlbumState = {
    loading: false,
    loaded: false,
    error: '',
    items: []
  };

  const vmAdminNativeShareState = {
    key: '',
    files: [],
    loading: false,
    error: '',
    promise: null
  };

  function parseVmAdminCsvLine(line){
    const out = [];
    let current = '';
    let inQuotes = false;
    const src = String(line || '');
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (ch === '"') {
        if (inQuotes && src[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === ',' && !inQuotes) {
        out.push(current);
        current = '';
        continue;
      }
      current += ch;
    }
    out.push(current);
    return out;
  }

  function slugVmAdminShowDate(raw){
    const value = String(raw || '').trim();
    let match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (match) {
      let yy = String(match[3] || '').trim();
      if (yy.length === 4) yy = yy.slice(2);
      return `${String(match[1]).padStart(2, '0')}${String(match[2]).padStart(2, '0')}${yy}`;
    }
    match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[2]}${match[3]}${String(match[1]).slice(2)}` : '';
  }

  function formatVmAdminShowDate(raw){
    const value = String(raw || '').trim();
    if (!value) return '';
    let year = 0;
    let month = 0;
    let day = 0;
    let match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (match) {
      month = Number(match[1]);
      day = Number(match[2]);
      year = Number(String(match[3]).length === 2 ? `20${match[3]}` : match[3]);
    } else {
      match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return value;
      year = Number(match[1]);
      month = Number(match[2]);
      day = Number(match[3]);
    }
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return value;
    try {
      return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
    } catch (_) {}
    return value;
  }

  function formatVmAdminShowDateLongOrdinal(raw){
    const value = String(raw || '').trim();
    if (!value) return '';
    let year = 0;
    let month = 0;
    let day = 0;
    let match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (match) {
      month = Number(match[1]);
      day = Number(match[2]);
      year = Number(String(match[3]).length === 2 ? `20${match[3]}` : match[3]);
    } else {
      match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return formatVmAdminShowDate(value);
      year = Number(match[1]);
      month = Number(match[2]);
      day = Number(match[3]);
    }
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return formatVmAdminShowDate(value);
    const monthLabel = date.toLocaleDateString(undefined, { month: 'long' });
    const suffix = (function (n) {
      const mod100 = n % 100;
      if (mod100 >= 11 && mod100 <= 13) return 'th';
      const mod10 = n % 10;
      if (mod10 === 1) return 'st';
      if (mod10 === 2) return 'nd';
      if (mod10 === 3) return 'rd';
      return 'th';
    })(day);
    return `${monthLabel} ${day}${suffix}, ${year}`;
  }

  function buildVmAdminShowVenueLine(showRow){
    const row = showRow && typeof showRow === 'object' ? showRow : {};
    const venue = String(row.show_venue || row.venue || '').trim();
    const city = String(row.show_city || row.city || '').trim();
    const state = String(row.show_state || row.state || '').trim();
    const place = city && state ? `${city}, ${state}` : (city || state);
    return [venue, place].filter(Boolean).join(' â€¢ ');
  }

  function normalizeVmAdminMatchSlug(value){
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return '';
    return raw
      .replace(/[^a-z0-9\-_ ]+/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function getVmAdminMatchField(row, index, field){
    const n = Number(index);
    const keys = [
      `match-${n}_${field}`,
      `match_${n}_${field}`,
      `match-${n}-${field}`,
      `match_${n}-${field}`,
      `part_${n}_${field}`
    ];
    return readVmAdminShowField(row, keys);
  }

  function getVmAdminMatchRouteSlug(urlCell, index){
    const raw = String(urlCell || '').trim();
    if (raw && !/^https?:\/\//i.test(raw) && !raw.startsWith('/')) {
      const clean = normalizeVmAdminMatchSlug(raw);
      if (clean) return clean;
    }
    return `match-${String(Number(index) || 1)}`;
  }

  function buildVmAdminMatchTitle(type, stip, title){
    return String(stip || '').trim() || String(title || '').trim() || String(type || '').trim() || 'Match Album';
  }

  function resolveVmAdminMatchUrl(urlCell, showRow){
    const raw = String(urlCell || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('/')) return `https://vmpix.smugmug.com${raw}`;

    const base = readVmAdminShowField(showRow, ['show_url', 'showurl', 'showUrl', 'show']);
    if (base) return `${base.replace(/\/$/, '')}/${raw.replace(/^\//, '')}`;

    const poster = readVmAdminShowField(showRow, ['show_poster', 'poster_url']);
    if (poster) {
      try {
        const url = new URL(poster);
        const parts = String(url.pathname || '').split('/').filter(Boolean);
        for (let i = 0; i < parts.length - 2; i++) {
          if (String(parts[i]).toLowerCase() === 'wrestling' && /^\d{6}$/.test(parts[i + 2])) {
            return `https://vmpix.smugmug.com/${parts.slice(i, i + 3).join('/')}/${raw.replace(/^\//, '')}`;
          }
        }
      } catch (_) {}
    }

    const mmddyy = slugVmAdminShowDate(readVmAdminShowField(showRow, ['show_date', 'date']));
    if (mmddyy) {
      const fedFolder = String(readVmAdminShowField(showRow, ['show_folder', 'fed', 'promotion', 'company', 'show_company', 'showCompany']) || 'Limitless')
        .replace(/wrestling/ig, ' ')
        .trim()
        .split(/\s+/)[0]
        .replace(/[^A-Za-z0-9]/g, '') || 'Limitless';
      return `https://vmpix.smugmug.com/Wrestling/${fedFolder}/${mmddyy}/${raw.replace(/^\//, '')}`;
    }
    return raw;
  }

  async function resolveVmAdminAlbumKeyFromUrl(albumUrl){
    const apiBase = getVmAdminWrestlingApiBase();
    const clean = String(albumUrl || '').trim();
    if (!clean) return '';
    const candidates = [
      `${apiBase}/smug/resolve-album?url=${encodeURIComponent(clean)}`,
      `${apiBase}/smug/resolve?url=${encodeURIComponent(clean)}`,
      `${apiBase}/smug/album-from-url?url=${encodeURIComponent(clean)}`,
      `${apiBase}/smug/url-to-album?url=${encodeURIComponent(clean)}`
    ];
    for (let i = 0; i < candidates.length; i++) {
      try {
        const res = await fetch(candidates[i], { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' } });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) continue;
        const value = String(data.albumKey || data.AlbumKey || data?.Response?.Album?.AlbumKey || data?.Response?.AlbumKey || '').trim();
        if (value) return value;
      } catch (_) {}
    }
    return '';
  }

  async function fetchVmAdminAlbumImages(albumKey){
    const apiBase = getVmAdminWrestlingApiBase();
    const clean = String(albumKey || '').trim();
    if (!clean) return [];
    let start = 1;
    let more = true;
    const all = [];
    while (more) {
      const res = await fetch(`${apiBase}/smug/album/${encodeURIComponent(clean)}?count=200&start=${start}`, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) break;
      const resp = data && data.Response || {};
      let imgs = [];
      if (Array.isArray(resp.AlbumImage)) imgs = resp.AlbumImage;
      else if (resp.AlbumImage) imgs = [resp.AlbumImage];
      else if (Array.isArray(resp.Images)) imgs = resp.Images;
      else if (resp.Images) imgs = [resp.Images];
      imgs = (imgs || []).filter(Boolean);
      all.push(...imgs);
      const total = Number(resp?.Pages?.Total) || 0;
      const perPage = Number(resp?.Pages?.Count) || 200;
      const got = (start - 1) + imgs.length;
      if (!total || got >= total || !imgs.length) {
        more = false;
      } else {
        start += perPage;
      }
    }
    return all;
  }

  function pickVmAdminImageUrl(img, keys){
    for (let i = 0; i < keys.length; i++) {
      const value = img && img[keys[i]];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
  }

  function getVmAdminPhotoThumb(img){
    return pickVmAdminImageUrl(img, ['ThumbnailUrl', 'ThumbUrl', 'SmallUrl', 'MediumUrl', 'LargeUrl', 'ImageUrl', 'Url']);
  }

  function getVmAdminPhotoFull(img){
    return pickVmAdminImageUrl(img, ['OriginalUrl', 'ArchivedUri', 'ArchivedUrl', 'LargestImageUrl', 'X3LargeUrl', 'X2LargeUrl', 'XLargeUrl', 'LargeUrl', 'MediumUrl', 'ImageUrl', 'Url']);
  }

  async function loadVmAdminFacebookMentionSearch(query){
    const cleanQuery = String(query || '').trim();
    if (!cleanQuery) {
      vmAdminFacebookMentionState.results = [];
      vmAdminFacebookMentionState.loaded = false;
      vmAdminFacebookMentionState.error = '';
      renderVmAdminFacebookMentionSuggestions();
      return [];
    }
    if (vmAdminFacebookMentionState.loading && vmAdminFacebookMentionState.query === cleanQuery.toLowerCase()) return [];
    vmAdminFacebookMentionState.loading = true;
    vmAdminFacebookMentionState.error = '';
    renderVmAdminFacebookMentionSuggestions();
    try {
      const data = await fetchVmAdminJsonWithExplicitToken('/admin/facebook/mentions/search', { q: cleanQuery });
      const rawItems = Array.isArray(data && data.items)
        ? data.items
        : (Array.isArray(data && data.results)
          ? data.results
          : (Array.isArray(data && data.pages) ? data.pages : []));
      const list = rawItems.map((item) => {
        const row = item && typeof item === 'object' ? item : {};
        const label = String(row.label || row.name || row.title || '').trim();
        const pageId = String(row.page_id || row.pageId || row.id || '').trim();
        const handle = String(row.handle || row.username || '').trim();
        const subtitle = String(row.subtitle || row.category || row.type || '').trim();
        return {
          id: pageId || label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          label,
          page_id: pageId,
          handle,
          subtitle
        };
      }).filter((item) => item.label);
      vmAdminFacebookMentionState.results = list;
      vmAdminFacebookMentionState.loaded = true;
      return list;
    } catch (err) {
      vmAdminFacebookMentionState.loaded = false;
      vmAdminFacebookMentionState.results = [];
      vmAdminFacebookMentionState.error = messageFromVmAdminError(err, 'Facebook mention search is not ready yet');
      return [];
    } finally {
      vmAdminFacebookMentionState.loading = false;
      renderVmAdminFacebookMentionSuggestions();
    }
  }

  function getVmAdminFacebookMentionMatch(textarea){
    const field = textarea || document.getElementById('vmAdminFacebookCaption');
    if (!field) return null;
    const value = String(field.value || '');
    const caret = Number(field.selectionStart || 0);
    const before = value.slice(0, caret);
    const atIndex = before.lastIndexOf('@');
    if (atIndex < 0) return null;
    const prefix = before.slice(0, atIndex);
    if (prefix && !/[\s([{"'`]/.test(prefix.slice(-1))) return null;
    const rawQuery = before.slice(atIndex + 1);
    if (/[\s\r\n]/.test(rawQuery)) return null;
    const start = atIndex;
    return {
      start,
      end: caret,
      query: rawQuery.trim().toLowerCase()
    };
  }

  function getVmAdminFacebookMentionSuggestions(){
    return (Array.isArray(vmAdminFacebookMentionState.results) ? vmAdminFacebookMentionState.results : []).slice(0, 6);
  }

  function hideVmAdminFacebookMentionSuggestions(){
    vmAdminFacebookMentionState.active = false;
    vmAdminFacebookMentionState.query = '';
    vmAdminFacebookMentionState.start = -1;
    vmAdminFacebookMentionState.end = -1;
    vmAdminFacebookMentionState.activeIndex = 0;
    renderVmAdminFacebookMentionSuggestions();
  }

  function renderVmAdminFacebookMentionSuggestions(){
    const shell = document.getElementById('vmAdminFacebookMentionSuggestions');
    if (!shell) return;
    if (!vmAdminFacebookMentionState.active) {
      shell.style.display = 'none';
      shell.innerHTML = '';
      return;
    }
    shell.style.display = 'grid';
    if (vmAdminFacebookMentionState.loading) {
      shell.innerHTML = `<div style="padding:10px 12px; color:rgba(208,222,232,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.45;">Loading mention suggestions...</div>`;
      return;
    }
    if (vmAdminFacebookMentionState.error) {
      shell.innerHTML = `<div style="padding:10px 12px; color:rgba(255,192,205,.88); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.45;">${escapeVmAdminHtml(vmAdminFacebookMentionState.error)}</div>`;
      return;
    }
    const suggestions = getVmAdminFacebookMentionSuggestions();
    if (!suggestions.length) {
      shell.innerHTML = `<div style="padding:10px 12px; color:rgba(214,198,210,.72); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.45;">No matching Facebook Pages found.</div>`;
      return;
    }
    shell.innerHTML = suggestions.map((item, index) => `
      <button type="button" data-facebook-mention-id="${escapeVmAdminHtml(item.id)}" style="padding:10px 12px; border:0; border-top:${index === 0 ? '0' : '1px solid rgba(255,255,255,.06)'}; background:${index === vmAdminFacebookMentionState.activeIndex ? 'rgba(10,20,28,.82)' : 'transparent'}; color:${index === vmAdminFacebookMentionState.activeIndex ? 'rgba(210,242,255,.94)' : 'rgba(245,236,242,.9)'}; font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; text-align:left; cursor:pointer;">
        <div>${escapeVmAdminHtml(item.label)}</div>
        ${item.subtitle || item.handle ? `<div style="margin-top:4px; color:rgba(214,198,210,.72); font-size:9px; font-weight:700; letter-spacing:.04em;">${escapeVmAdminHtml([item.handle, item.subtitle].filter(Boolean).join(' â€¢ '))}</div>` : ''}
      </button>
    `).join('');
  }

  function refreshVmAdminFacebookMentionSuggestions(textarea){
    const field = textarea || document.getElementById('vmAdminFacebookCaption');
    if (!field) return;
    const match = getVmAdminFacebookMentionMatch(field);
    if (!match) {
      hideVmAdminFacebookMentionSuggestions();
      return;
    }
    vmAdminFacebookMentionState.active = true;
    vmAdminFacebookMentionState.query = match.query;
    vmAdminFacebookMentionState.start = match.start;
    vmAdminFacebookMentionState.end = match.end;
    vmAdminFacebookMentionState.activeIndex = 0;
    renderVmAdminFacebookMentionSuggestions();
    loadVmAdminFacebookMentionSearch(match.query).catch(() => null);
  }

  function handleVmAdminFacebookMentionRefresh(event){
    const key = String(event && event.key || '');
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'Enter' || key === 'Escape') return;
    const field = document.getElementById('vmAdminFacebookCaption');
    if (!field) return;
    field.dataset.vmFacebookAutofill = '';
    refreshVmAdminFacebookMentionSuggestions(field);
  }

  function insertVmAdminFacebookMention(item){
    const field = document.getElementById('vmAdminFacebookCaption');
    if (!field) return;
    const meta = item && typeof item === 'object' ? item : null;
    const label = String(meta && meta.label || '').trim();
    if (!label) return;
    const value = String(field.value || '');
    const start = Math.max(0, Number(vmAdminFacebookMentionState.start || 0));
    const end = Math.max(start, Number(field.selectionStart || vmAdminFacebookMentionState.end || start));
    field.value = `${value.slice(0, start)}@${label} ${value.slice(end)}`;
    if (!Array.isArray(field.__vmFacebookMentions)) field.__vmFacebookMentions = [];
    field.__vmFacebookMentions = field.__vmFacebookMentions
      .filter((entry) => String(entry && entry.page_id || '').trim() !== String(meta && meta.page_id || '').trim() || !String(meta && meta.page_id || '').trim());
    field.__vmFacebookMentions.push({
      platform: 'facebook',
      label,
      page_id: String(meta && meta.page_id || '').trim(),
      handle: String(meta && meta.handle || '').trim()
    });
    const nextCaret = start + label.length + 2;
    try {
      field.focus();
      field.setSelectionRange(nextCaret, nextCaret);
    } catch (_) {}
    field.dataset.vmFacebookAutofill = '';
    hideVmAdminFacebookMentionSuggestions();
  }

  function buildVmAdminFacebookMentionsPayload(){
    const field = document.getElementById('vmAdminFacebookCaption');
    if (!field || !Array.isArray(field.__vmFacebookMentions)) return [];
    const caption = String(field.value || '');
    return field.__vmFacebookMentions.filter((item) => {
      const label = String(item && item.label || '').trim();
      return label && caption.indexOf(`@${label}`) >= 0;
    }).map((item) => ({
      platform: 'facebook',
      label: String(item.label || '').trim(),
      page_id: String(item.page_id || '').trim(),
      handle: String(item.handle || '').trim()
    })).filter((item) => item.label);
  }

  function readVmAdminShowField(row, keys){
    const source = row && typeof row === 'object' ? row : {};
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = source[key];
      if (value != null && String(value).trim()) return String(value).trim();
    }
    return '';
  }

  function buildVmAdminFacebookPickerMatchItems(showItem){
    const item = showItem && typeof showItem === 'object' ? showItem : null;
    const row = item && item.rawRow && typeof item.rawRow === 'object' ? item.rawRow : null;
    if (!row) return [];
    const out = [];
    for (let index = 1; index <= 12; index++) {
      const type = getVmAdminMatchField(row, index, 'type');
      const stip = getVmAdminMatchField(row, index, 'stip');
      const partTitle = getVmAdminMatchField(row, index, 'title');
      const people = getVmAdminMatchField(row, index, 'people');
      const urlCell = getVmAdminMatchField(row, index, 'url');
      if (!type && !stip && !partTitle && !people) break;
      const routeSlug = getVmAdminMatchRouteSlug(urlCell, index);
      const matchTitle = buildVmAdminMatchTitle(type, stip, partTitle);
      if (!matchTitle && !people && !urlCell) continue;
      const routePath = item.slug ? `${item.routePath}/${routeSlug}` : item.routePath;
      const routeUrl = `${window.location.origin}${routePath}`;
      out.push({
        id: `${item.id}:match:${routeSlug}`,
        type: 'match',
        entityId: item.slug ? `wrestling-match-${item.slug}-${routeSlug}` : `wrestling-match-${routeSlug}`,
        title: matchTitle,
        subtitle: people || item.title,
        meta: item.prettyDate,
        prettyDate: item.prettyDate,
        routePath,
        routeUrl,
        imageUrl: item.imageUrl,
        imageLabel: item.imageLabel,
        company: item.company,
        rawDate: item.rawDate,
        slug: routeSlug,
        showId: item.id,
        showTitle: item.title,
        sourceAlbumUrl: resolveVmAdminMatchUrl(urlCell, row),
        searchBlob: [matchTitle, people, type, stip, item.title, item.prettyDate, item.company].filter(Boolean).join(' ').toLowerCase()
      });
    }
    return out;
  }

  function getVmAdminFacebookBrowseShow(){
    const browseShowId = String(vmAdminFacebookPickerState.browseShowId || '').trim();
    if (!browseShowId) return null;
    return (Array.isArray(vmAdminFacebookPickerState.items) ? vmAdminFacebookPickerState.items : []).find((item) => item.id === browseShowId) || null;
  }

  function getVmAdminFacebookBrowseMatch(){
    const browseMatchId = String(vmAdminFacebookPickerState.browseMatchId || '').trim();
    if (!browseMatchId) return null;
    const parent = getVmAdminFacebookBrowseShow();
    if (!parent) return null;
    return buildVmAdminFacebookPickerMatchItems(parent).find((item) => item.id === browseMatchId) || null;
  }

  function buildVmAdminFacebookPickerItemFromShow(row){
    const apiBase = getVmAdminWrestlingApiBase();
    const rawDate = readVmAdminShowField(row, ['show_date', 'date']);
    const slug = slugVmAdminShowDate(rawDate);
    const title = readVmAdminShowField(row, ['show_name', 'show', 'title', 'event', 'event_name']) || formatVmAdminShowDate(rawDate) || 'Wrestling Show';
    const company = readVmAdminShowField(row, ['show_folder', 'fed', 'promotion', 'company', 'show_company', 'showCompany']);
    const venueLine = buildVmAdminShowVenueLine(row);
    const posterRaw = readVmAdminShowField(row, ['show_poster', 'poster_url']);
    const posterUrl = posterRaw ? `${apiBase}/show-poster?url=${encodeURIComponent(posterRaw)}` : '';
    const routePath = slug ? `/wrestling/shows/${slug}` : '/wrestling/shows';
    const routeUrl = `${window.location.origin}${routePath}`;
    const prettyDate = formatVmAdminShowDate(rawDate);
    const displayDate = formatVmAdminShowDateLongOrdinal(rawDate) || prettyDate;
    const searchBlob = [title, prettyDate, company, venueLine, slug].filter(Boolean).join(' ').toLowerCase();
    return {
      id: `show:${slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      type: 'show',
      entityId: slug ? `wrestling-show-${slug}` : `wrestling-show-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`,
      title,
      subtitle: displayDate,
      meta: venueLine,
      prettyDate,
      routePath,
      routeUrl,
      imageUrl: posterUrl,
      imageLabel: posterUrl ? 'Show Poster' : 'No poster yet',
      company,
      rawDate,
      slug,
      rawRow: row,
      sortKey: (function () {
        const clean = slugVmAdminShowDate(rawDate);
        if (!clean || clean.length !== 6) return 0;
        const mm = Number(clean.slice(0, 2));
        const dd = Number(clean.slice(2, 4));
        const yy = Number(clean.slice(4, 6));
        return ((2000 + yy) * 10000) + (mm * 100) + dd;
      })(),
      searchBlob
    };
  }

  async function loadVmAdminFacebookPickerItems(){
    if (vmAdminFacebookPickerState.loading) return [];
    if (vmAdminFacebookPickerState.loaded && !vmAdminFacebookPickerState.loadError) {
      return vmAdminFacebookPickerState.items;
    }
    vmAdminFacebookPickerState.loading = true;
    vmAdminFacebookPickerState.loadError = '';
    renderVmAdminFacebookPicker();
    try {
      const apiBase = getVmAdminWrestlingApiBase();
      const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      const timeout = window.setTimeout(() => {
        try { if (ctrl) ctrl.abort(); } catch (_) {}
      }, 15000);
      const res = await fetch(`${apiBase}/sheet/shows?_ts=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'text/plain, text/csv, application/json;q=0.9, */*;q=0.8' },
        signal: ctrl ? ctrl.signal : undefined
      });
      window.clearTimeout(timeout);
      const text = await res.text();
      if (!res.ok) throw new Error('Unable to load wrestling show source data');
      const lines = String(text || '').split(/\r?\n/).filter((line) => String(line || '').trim());
      if (!lines.length) {
        vmAdminFacebookPickerState.items = [];
      } else {
        const header = parseVmAdminCsvLine(lines.shift()).map((cell) => String(cell || '').trim().toLowerCase());
        const rows = lines.map((line) => {
          const cols = parseVmAdminCsvLine(line);
          const row = {};
          header.forEach((key, index) => {
            row[key] = String(cols[index] || '').trim();
          });
          return row;
        });
        vmAdminFacebookPickerState.items = rows
          .map(buildVmAdminFacebookPickerItemFromShow)
          .filter((item) => item && item.id)
          .sort((a, b) => (Number(b.sortKey || 0) - Number(a.sortKey || 0)) || String(a.title || '').localeCompare(String(b.title || '')));
      }
      vmAdminFacebookPickerState.loaded = true;
      if (vmAdminFacebookPickerState.selectedId) {
        const selected = vmAdminFacebookPickerState.items.find((item) => item.id === vmAdminFacebookPickerState.selectedId) || null;
        vmAdminFacebookPickerState.selected = selected;
      }
      return vmAdminFacebookPickerState.items;
    } catch (err) {
      vmAdminFacebookPickerState.loaded = false;
      const timedOut = String(err && err.name || '').trim() === 'AbortError';
      vmAdminFacebookPickerState.loadError = timedOut
        ? 'Wrestling show source timed out while loading. Please try again.'
        : messageFromVmAdminError(err, 'Unable to load archive picker data');
      throw err;
    } finally {
      vmAdminFacebookPickerState.loading = false;
      renderVmAdminFacebookPicker();
    }
  }

  function getVmAdminFacebookFilteredPickerItems(){
    const query = String(vmAdminFacebookPickerState.query || '').trim().toLowerCase();
    const items = Array.isArray(vmAdminFacebookPickerState.items) ? vmAdminFacebookPickerState.items : [];
    const browseMatch = getVmAdminFacebookBrowseMatch();
    if (browseMatch) {
      const photoItems = Array.isArray(vmAdminFacebookPickerState.photoItems) ? vmAdminFacebookPickerState.photoItems : [];
      if (!query) return photoItems;
      return photoItems.filter((item) => String(item && item.searchBlob || '').indexOf(query) >= 0);
    }
    const parent = getVmAdminFacebookBrowseShow();
    if (parent) {
      const matchItems = buildVmAdminFacebookPickerMatchItems(parent);
      if (!query) return matchItems;
      return matchItems.filter((item) => String(item && item.searchBlob || '').indexOf(query) >= 0);
    }
    if (!query) return items.slice(0, 24);
    return items.filter((item) => String(item && item.searchBlob || '').indexOf(query) >= 0).slice(0, 24);
  }

  function buildVmAdminFacebookCaptionStarter(item){
    const entry = item && typeof item === 'object' ? item : null;
    if (!entry) return '';
    const lines = [];
    if (entry.title) lines.push(entry.title);
    if (entry.type === 'photo' && entry.matchTitle) lines.push(entry.matchTitle);
    if (entry.type === 'match' && entry.showTitle) lines.push(entry.showTitle);
    if (entry.prettyDate) lines.push(entry.prettyDate);
    if (entry.routeUrl) lines.push(entry.routeUrl);
    return lines.join('\n');
  }

  function getVmAdminFacebookSelectedPhotoItems(){
    const ids = Array.isArray(vmAdminFacebookPickerState.selectedPhotoIds) ? vmAdminFacebookPickerState.selectedPhotoIds : [];
    const items = Array.isArray(vmAdminFacebookPickerState.photoItems) ? vmAdminFacebookPickerState.photoItems : [];
    const map = new Map(items.map((item) => [item.id, item]));
    return ids.map((id) => map.get(id)).filter(Boolean);
  }

  function syncVmAdminFacebookPhotoSelectionIntoComposer(){
    const selectedItems = getVmAdminFacebookSelectedPhotoItems();
    const imageField = document.getElementById('vmAdminFacebookImageUrl');
    const titleField = document.getElementById('vmAdminFacebookEntityLabel');
    const linkField = document.getElementById('vmAdminFacebookLinkUrl');
    const captionField = document.getElementById('vmAdminFacebookCaption');
    const hiddenIdField = document.getElementById('vmAdminFacebookEntityIdHidden');
    const hiddenRouteField = document.getElementById('vmAdminFacebookEntityRouteHidden');
    const pickerStatus = document.getElementById('vmAdminFacebookPickerStatus');
    if (!selectedItems.length) {
      if (imageField) imageField.value = '';
      if (titleField) titleField.value = '';
      if (hiddenIdField) hiddenIdField.value = '';
      if (hiddenRouteField) hiddenRouteField.value = '';
      if (pickerStatus) pickerStatus.textContent = 'Browsing photos';
      return;
    }
    const primary = selectedItems[0];
    const label = selectedItems.length > 1
      ? `${selectedItems.length} Photos Selected`
      : String(primary.title || 'Photo').trim();
    if (imageField) imageField.value = String(primary.imageFullUrl || primary.imageUrl || '').trim();
    if (titleField) titleField.value = label;
    if (hiddenIdField) hiddenIdField.value = selectedItems.map((item) => item.entityId).filter(Boolean).join(',');
    if (hiddenRouteField) hiddenRouteField.value = String(primary.routePath || '').trim();
    if (linkField && !String(linkField.value || '').trim()) {
      linkField.value = String(primary.routeUrl || '').trim();
    }
    if (captionField) {
      const starter = selectedItems.length > 1
        ? [
            `${selectedItems.length} photos selected`,
            primary.matchTitle || primary.title,
            primary.showTitle || '',
            primary.prettyDate || '',
            primary.routeUrl || ''
          ].filter(Boolean).join('\n')
        : [
            primary.matchTitle || primary.title,
            primary.showTitle || '',
            primary.prettyDate || '',
            primary.routeUrl || ''
          ].filter(Boolean).join('\n');
      const current = String(captionField.value || '').trim();
      const auto = String(captionField.dataset.vmFacebookAutofill || '') === '1';
      if (!current || auto) {
        captionField.value = starter;
        captionField.dataset.vmFacebookAutofill = starter ? '1' : '';
      }
    }
    if (pickerStatus) {
      pickerStatus.textContent = selectedItems.length > 1
        ? `Selected ${selectedItems.length} photos`
        : `Selected photo: ${primary.title}`;
    }
    vmAdminFacebookPickerState.selectedId = primary.id;
    vmAdminFacebookPickerState.selected = primary;
    if (readVmAdminFacebookPublishMode() === 'share') {
      try {
        const payload = buildVmAdminFacebookComposerPayload();
        warmVmAdminNativeShareFiles(payload).catch(() => null);
      } catch (_) {}
    }
    syncVmAdminInstagramSelectionIntoComposer(vmAdminFacebookPickerState.selected);
  }

  function toggleVmAdminFacebookPhotoSelection(itemId){
    const item = (Array.isArray(vmAdminFacebookPickerState.photoItems) ? vmAdminFacebookPickerState.photoItems : []).find((photo) => photo.id === itemId) || null;
    if (!item) return;
    const current = Array.isArray(vmAdminFacebookPickerState.selectedPhotoIds) ? vmAdminFacebookPickerState.selectedPhotoIds.slice() : [];
    const existingIndex = current.indexOf(itemId);
    if (existingIndex >= 0) {
      current.splice(existingIndex, 1);
    } else {
      current.push(itemId);
    }
    vmAdminFacebookPickerState.selectedPhotoIds = current;
    if (!current.length) {
      vmAdminFacebookPickerState.selectedId = '';
      vmAdminFacebookPickerState.selected = null;
    }
    syncVmAdminFacebookPhotoSelectionIntoComposer();
    renderVmAdminFacebookPicker();
  }

  function syncVmAdminFacebookSelectionIntoComposer(item){
    const entry = item && typeof item === 'object' ? item : null;
    const imageField = document.getElementById('vmAdminFacebookImageUrl');
    const titleField = document.getElementById('vmAdminFacebookEntityLabel');
    const linkField = document.getElementById('vmAdminFacebookLinkUrl');
    const captionField = document.getElementById('vmAdminFacebookCaption');
    const hiddenIdField = document.getElementById('vmAdminFacebookEntityIdHidden');
    const hiddenRouteField = document.getElementById('vmAdminFacebookEntityRouteHidden');
    const pickerStatus = document.getElementById('vmAdminFacebookPickerStatus');
    const previousRoute = String((hiddenRouteField && hiddenRouteField.value) || '').trim();
    const previousRouteUrl = previousRoute ? `${window.location.origin}${previousRoute}` : '';
    if (!entry) {
      if (hiddenIdField) hiddenIdField.value = '';
      if (hiddenRouteField) hiddenRouteField.value = '';
      if (pickerStatus) pickerStatus.textContent = 'Single-select picker ready';
      return;
    }
    if (imageField) imageField.value = String(entry.imageFullUrl || entry.imageUrl || '').trim();
    if (titleField) titleField.value = String(entry.title || '').trim();
    if (hiddenIdField) hiddenIdField.value = String(entry.entityId || '').trim();
    if (hiddenRouteField) hiddenRouteField.value = String(entry.routePath || '').trim();
    if (linkField) {
      const currentLink = String(linkField.value || '').trim();
      if (!currentLink || currentLink === previousRouteUrl || currentLink === previousRoute) {
        linkField.value = String(entry.routeUrl || '').trim();
      }
    }
    const starter = buildVmAdminFacebookCaptionStarter(entry);
    if (captionField) {
      const current = String(captionField.value || '').trim();
      const auto = String(captionField.dataset.vmFacebookAutofill || '') === '1';
      if (!current || auto) {
        captionField.value = starter;
        captionField.dataset.vmFacebookAutofill = starter ? '1' : '';
      }
    }
    if (pickerStatus) {
      pickerStatus.textContent = entry.title
        ? `Selected ${entry.type === 'match' ? 'match' : 'show'}: ${entry.title}`
        : 'Archive item selected';
    }
    if (readVmAdminFacebookPublishMode() === 'share') {
      try {
        const payload = buildVmAdminFacebookComposerPayload();
        warmVmAdminNativeShareFiles(payload).catch(() => null);
      } catch (_) {}
    }
    syncVmAdminInstagramSelectionIntoComposer(entry);
  }

  function syncVmAdminInstagramSelectionIntoComposer(item){
    const entry = item && typeof item === 'object' ? item : null;
    const selectedItems = getVmAdminFacebookSelectedPhotoItems();
    const imageField = document.getElementById('vmAdminInstagramImageUrl');
    const titleField = document.getElementById('vmAdminInstagramEntityLabel');
    const captionField = document.getElementById('vmAdminInstagramCaption');
    const hiddenIdField = document.getElementById('vmAdminInstagramEntityIdHidden');
    const hiddenRouteField = document.getElementById('vmAdminInstagramEntityRouteHidden');
    const pickerStatus = document.getElementById('vmAdminInstagramPickerStatus');
    if (selectedItems.length) {
      const primary = selectedItems[0];
      const label = selectedItems.length > 1
        ? `${selectedItems.length} Photos Selected`
        : String(primary.title || 'Photo').trim();
      if (imageField) imageField.value = String(primary.imageFullUrl || primary.imageUrl || '').trim();
      if (titleField) titleField.value = label;
      if (hiddenIdField) hiddenIdField.value = selectedItems.map((photo) => photo.entityId).filter(Boolean).join(',');
      if (hiddenRouteField) hiddenRouteField.value = String(primary.routePath || '').trim();
      if (captionField) {
        const starter = selectedItems.length > 1
          ? [
              `${selectedItems.length} photos selected`,
              primary.matchTitle || primary.title,
              primary.showTitle || '',
              primary.prettyDate || ''
            ].filter(Boolean).join('\n')
          : [
              primary.matchTitle || primary.title,
              primary.showTitle || '',
              primary.prettyDate || ''
            ].filter(Boolean).join('\n');
        const current = String(captionField.value || '').trim();
        const auto = String(captionField.dataset.vmInstagramAutofill || '') === '1';
        if (!current || auto) {
          captionField.value = starter;
          captionField.dataset.vmInstagramAutofill = starter ? '1' : '';
        }
      }
      if (pickerStatus) {
        pickerStatus.textContent = selectedItems.length > 1
          ? `Selected ${selectedItems.length} photos`
          : `Selected photo: ${primary.title}`;
      }
      return;
    }
    if (!entry) {
      if (imageField) imageField.value = '';
      if (hiddenIdField) hiddenIdField.value = '';
      if (hiddenRouteField) hiddenRouteField.value = '';
      if (pickerStatus) pickerStatus.textContent = 'Single-select picker ready';
      return;
    }
    if (imageField) imageField.value = String(entry.imageFullUrl || entry.imageUrl || '').trim();
    if (titleField) titleField.value = String(entry.title || '').trim();
    if (hiddenIdField) hiddenIdField.value = String(entry.entityId || '').trim();
    if (hiddenRouteField) hiddenRouteField.value = String(entry.routePath || '').trim();
    if (captionField) {
      const starter = [
        entry.title || '',
        entry.showTitle || '',
        entry.prettyDate || ''
      ].filter(Boolean).join('\n');
      const current = String(captionField.value || '').trim();
      const auto = String(captionField.dataset.vmInstagramAutofill || '') === '1';
      if (!current || auto) {
        captionField.value = starter;
        captionField.dataset.vmInstagramAutofill = starter ? '1' : '';
      }
    }
    if (pickerStatus) {
      pickerStatus.textContent = entry.title
        ? `Selected ${entry.type === 'match' ? 'match' : 'show'}: ${entry.title}`
        : 'Archive item selected';
    }
  }

  function renderVmAdminSharedPicker(prefix){
    const resultsShell = document.getElementById(`vmAdmin${prefix}PickerResults`);
    const selectedShell = document.getElementById(`vmAdmin${prefix}PickerSelected`);
    const selectedPanel = document.getElementById(`vmAdmin${prefix}PickerSelectedPanel`);
    const layoutShell = document.getElementById(`vmAdmin${prefix}PickerLayout`);
    const countShell = document.getElementById(`vmAdmin${prefix}PickerCount`);
    if (!resultsShell || !selectedShell) return;
    const selected = vmAdminFacebookPickerState.selected;
    const selectedPhotoItems = getVmAdminFacebookSelectedPhotoItems();
    const items = getVmAdminFacebookFilteredPickerItems();
    const browseMatch = getVmAdminFacebookBrowseMatch();
    const browseShow = getVmAdminFacebookBrowseShow();
    if (layoutShell) {
      layoutShell.style.gridTemplateColumns = 'minmax(0,1fr)';
    }
    if (selectedPanel) {
      selectedPanel.style.display = 'none';
    }
    if (countShell) {
      if (vmAdminFacebookPickerState.loading) {
        countShell.textContent = 'Loading shows...';
      } else if (vmAdminFacebookPickerState.loadError) {
        countShell.textContent = 'Source unavailable';
      } else if (browseMatch) {
        countShell.textContent = vmAdminFacebookPickerState.photoLoading
          ? 'Loading photos...'
          : `${formatVmAdminNumber(items.length)} photo${items.length === 1 ? '' : 's'}`;
      } else if (browseShow) {
        countShell.textContent = `${formatVmAdminNumber(items.length)} match${items.length === 1 ? '' : 'es'}`;
      } else {
        countShell.textContent = `${formatVmAdminNumber(items.length)} result${items.length === 1 ? '' : 's'}`;
      }
    }
    if (vmAdminFacebookPickerState.loading) {
      resultsShell.innerHTML = `<div style="padding:12px; border:1px solid rgba(255,255,255,.06); border-radius:12px; background:rgba(11,14,20,.72); color:rgba(208,222,232,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.55;">Loading Wrestling shows...</div>`;
    } else if (browseMatch && vmAdminFacebookPickerState.photoLoading) {
      resultsShell.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;">
          <button type="button" data-facebook-picker-back-to-match="1" onclick="window.__vmAdminFacebookPickerBackToMatches && window.__vmAdminFacebookPickerBackToMatches(); return false;" style="padding:7px 10px; border-radius:999px; border:1px solid rgba(255,255,255,.08); background:rgba(14,16,24,.88); color:rgba(247,237,242,.92); font-family:'Orbitron',system-ui,sans-serif; font-size:9px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer;">Back to Matches</button>
          <div style="min-width:0; color:rgba(210,242,255,.92); font-family:'Orbitron',system-ui,sans-serif; font-size:9px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; text-align:right;">${escapeVmAdminHtml(browseMatch.title)}</div>
        </div>
        <div style="padding:12px; border:1px solid rgba(255,255,255,.06); border-radius:12px; background:rgba(11,14,20,.72); color:rgba(208,222,232,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.55;">Loading match photos...</div>
      `;
    } else if (vmAdminFacebookPickerState.loadError) {
      resultsShell.innerHTML = `<div style="padding:12px; border:1px solid rgba(255,95,135,.18); border-radius:12px; background:rgba(22,10,16,.72); color:rgba(255,192,205,.88); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.55;">${escapeVmAdminHtml(vmAdminFacebookPickerState.loadError)}</div>`;
    } else if (!items.length) {
      if (browseMatch) {
        resultsShell.innerHTML = `
          <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;">
            <button type="button" data-facebook-picker-back-to-match="1" onclick="window.__vmAdminFacebookPickerBackToMatches && window.__vmAdminFacebookPickerBackToMatches(); return false;" style="padding:7px 10px; border-radius:999px; border:1px solid rgba(255,255,255,.08); background:rgba(14,16,24,.88); color:rgba(247,237,242,.92); font-family:'Orbitron',system-ui,sans-serif; font-size:9px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer;">Back to Matches</button>
            <div style="min-width:0; color:rgba(210,242,255,.92); font-family:'Orbitron',system-ui,sans-serif; font-size:9px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; text-align:right;">${escapeVmAdminHtml(browseMatch.title)}</div>
          </div>
          <div style="padding:12px; border:1px solid rgba(255,255,255,.06); border-radius:12px; background:rgba(11,14,20,.72); color:rgba(214,198,210,.68); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.55;">${escapeVmAdminHtml(vmAdminFacebookPickerState.photoError || 'No photos found for this match yet.')}</div>
        `;
        return;
      }
      if (browseShow) {
        resultsShell.innerHTML = `
          <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;">
            <button type="button" data-facebook-picker-back="1" onclick="window.__vmAdminFacebookPickerBackToShows && window.__vmAdminFacebookPickerBackToShows(); return false;" style="padding:7px 10px; border-radius:999px; border:1px solid rgba(255,255,255,.08); background:rgba(14,16,24,.88); color:rgba(247,237,242,.92); font-family:'Orbitron',system-ui,sans-serif; font-size:9px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer;">Back to Shows</button>
            <div style="min-width:0; color:rgba(210,242,255,.92); font-family:'Orbitron',system-ui,sans-serif; font-size:9px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; text-align:right;">${escapeVmAdminHtml(browseShow.title)}</div>
          </div>
          <div style="padding:12px; border:1px solid rgba(255,255,255,.06); border-radius:12px; background:rgba(11,14,20,.72); color:rgba(214,198,210,.68); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.55;">No matches found for this show yet. The picker has switched into match-browser mode, but this source row does not appear to have match entries we can parse.</div>
        `;
      } else {
        resultsShell.innerHTML = `<div style="padding:12px; border:1px solid rgba(255,255,255,.06); border-radius:12px; background:rgba(11,14,20,.72); color:rgba(214,198,210,.68); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.55;">No shows matched this search yet.</div>`;
      }
    } else {
      const photoHeaderHtml = browseMatch ? `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;">
          <button type="button" data-facebook-picker-back-to-match="1" onclick="window.__vmAdminFacebookPickerBackToMatches && window.__vmAdminFacebookPickerBackToMatches(); return false;" style="padding:7px 10px; border-radius:999px; border:1px solid rgba(255,255,255,.08); background:rgba(14,16,24,.88); color:rgba(247,237,242,.92); font-family:'Orbitron',system-ui,sans-serif; font-size:9px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer;">Back to Matches</button>
          <div style="min-width:0; color:rgba(210,242,255,.92); font-family:'Orbitron',system-ui,sans-serif; font-size:9px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; text-align:right;">${escapeVmAdminHtml(browseMatch.title)}</div>
        </div>
      ` : '';
      const headerHtml = browseShow ? `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;">
          <button type="button" data-facebook-picker-back="1" onclick="window.__vmAdminFacebookPickerBackToShows && window.__vmAdminFacebookPickerBackToShows(); return false;" style="padding:7px 10px; border-radius:999px; border:1px solid rgba(255,255,255,.08); background:rgba(14,16,24,.88); color:rgba(247,237,242,.92); font-family:'Orbitron',system-ui,sans-serif; font-size:9px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer;">Back to Shows</button>
          <div style="min-width:0; color:rgba(210,242,255,.92); font-family:'Orbitron',system-ui,sans-serif; font-size:9px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; text-align:right;">${escapeVmAdminHtml(browseShow.title)}</div>
        </div>
      ` : '';
      const bodyHtml = browseMatch
        ? `<div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px;">${items.map((item) => {
            const picked = selectedPhotoItems.some((photo) => photo.id === item.id);
            return `
              <button type="button" data-facebook-picker-item="${escapeVmAdminHtml(item.id)}" onclick="window.__vmAdminFacebookPickerSelectPhoto && window.__vmAdminFacebookPickerSelectPhoto('${escapeVmAdminHtml(item.id)}'); return false;" style="display:block; width:100%; padding:0; border:${picked ? '2px solid rgba(97,224,255,.86)' : '1px solid rgba(255,255,255,.08)'}; border-radius:12px; overflow:hidden; background:${picked ? 'rgba(10,20,28,.82)' : 'rgba(16,12,20,.7)'}; box-shadow:${picked ? '0 0 0 1px rgba(97,224,255,.18), 0 0 18px rgba(97,224,255,.18)' : 'none'}; cursor:pointer;">
                <div style="aspect-ratio:1/1; background:rgba(8,10,16,.8);">
                  ${item.imageUrl ? `<img src="${escapeVmAdminHtml(item.imageUrl)}" alt="${escapeVmAdminHtml(item.title)}" style="display:block; width:100%; height:100%; object-fit:cover;" />` : ''}
                </div>
              </button>
            `;
          }).join('')}</div>`
        : items.map((item) => {
        const active = selected && selected.id === item.id;
        const actionLabel = item.type === 'match' ? 'Use Match' : 'Use Show';
        const titleAction = item.type === 'show'
          ? `data-facebook-picker-open-show="${escapeVmAdminHtml(item.id)}" onclick="window.__vmAdminFacebookPickerOpenShow && window.__vmAdminFacebookPickerOpenShow('${escapeVmAdminHtml(item.id)}'); return false;"`
          : (item.type === 'match'
            ? `data-facebook-picker-open-match="${escapeVmAdminHtml(item.id)}" onclick="window.__vmAdminFacebookPickerOpenMatch && window.__vmAdminFacebookPickerOpenMatch('${escapeVmAdminHtml(item.id)}'); return false;"`
            : `data-facebook-picker-item="${escapeVmAdminHtml(item.id)}"`);
        const browseAction = item.type === 'show'
          ? `<button type="button" data-facebook-picker-open-show="${escapeVmAdminHtml(item.id)}" onclick="window.__vmAdminFacebookPickerOpenShow && window.__vmAdminFacebookPickerOpenShow('${escapeVmAdminHtml(item.id)}'); return false;" style="padding:5px 8px; border-radius:999px; border:1px solid rgba(255,255,255,.08); background:rgba(14,16,24,.88); color:rgba(247,237,242,.92); font-family:'Orbitron',system-ui,sans-serif; font-size:9px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer;">Open Matches</button>`
          : (item.type === 'match'
            ? `<button type="button" data-facebook-picker-open-match="${escapeVmAdminHtml(item.id)}" onclick="window.__vmAdminFacebookPickerOpenMatch && window.__vmAdminFacebookPickerOpenMatch('${escapeVmAdminHtml(item.id)}'); return false;" style="padding:5px 8px; border-radius:999px; border:1px solid rgba(255,255,255,.08); background:rgba(14,16,24,.88); color:rgba(247,237,242,.92); font-family:'Orbitron',system-ui,sans-serif; font-size:9px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer;">Open Photos</button>`
            : '');
        return `
          <div style="width:100%; text-align:left; padding:10px 12px; border:1px solid ${active ? 'rgba(97,224,255,.24)' : 'rgba(255,255,255,.06)'}; border-radius:12px; background:${active ? 'rgba(10,20,28,.82)' : 'rgba(16,12,20,.7)'}; color:rgba(245,236,242,.94);">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
              <div style="min-width:0;">
                <button type="button" ${titleAction} style="padding:0; border:0; background:transparent; color:${active ? 'rgba(210,242,255,.94)' : 'rgba(245,236,242,.9)'}; font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer; text-align:left;">${escapeVmAdminHtml(item.title)}</button>
                <div style="margin-top:4px; color:rgba(214,198,210,.72); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.45;">${escapeVmAdminHtml(item.subtitle || 'Show')}</div>
              </div>
              <div style="display:grid; gap:6px; justify-items:end;">
                ${browseAction}
              </div>
            </div>
          </div>
        `;
      }).join('');
      resultsShell.innerHTML = (browseMatch ? photoHeaderHtml : headerHtml) + bodyHtml;
    }
    if (selectedPhotoItems.length) {
      const primaryPhoto = selectedPhotoItems[0];
      selectedShell.innerHTML = `
        <div style="display:grid; gap:10px; margin-top:10px;">
          <div style="border:1px solid rgba(97,224,255,.14); border-radius:14px; overflow:hidden; background:linear-gradient(180deg,rgba(10,18,24,.92),rgba(6,10,16,.92));">
            <div style="aspect-ratio:4/5;">
              ${primaryPhoto.imageUrl ? `<img src="${escapeVmAdminHtml(primaryPhoto.imageUrl)}" alt="${escapeVmAdminHtml(primaryPhoto.title)}" style="display:block; width:100%; height:100%; object-fit:cover;" />` : ''}
            </div>
          </div>
          <button type="button" data-facebook-picker-clear="1" style="min-width:148px; padding:9px 14px; border-radius:999px; border:1px solid rgba(255,255,255,.08); background:linear-gradient(180deg,rgba(23,18,29,.94),rgba(13,11,18,.92)); color:rgba(247,237,242,.94); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer;">Clear Selection</button>
        </div>
      `;
      return;
    }
    if (!selected) {
      selectedShell.innerHTML = `
        <div style="margin-top:10px; border:1px solid rgba(97,224,255,.14); border-radius:14px; overflow:hidden; background:linear-gradient(180deg,rgba(10,18,24,.92),rgba(6,10,16,.92));">
          <div style="aspect-ratio:4/5; display:flex; align-items:center; justify-content:center; color:rgba(166,235,210,.72); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">No Selection</div>
        </div>
        <div style="margin-top:10px; color:rgba(245,236,242,.92); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.08em; text-transform:uppercase;">Pick a show or match result</div>
        <div style="margin-top:5px; color:rgba(214,198,210,.7); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.5;">Use the show button for a show-level post, or click a show title to browse that card's matches like a file browser.</div>
      `;
      return;
    }
    selectedShell.innerHTML = `
      <div style="margin-top:10px; border:1px solid rgba(97,224,255,.14); border-radius:14px; overflow:hidden; background:linear-gradient(180deg,rgba(10,18,24,.92),rgba(6,10,16,.92));">
        ${selected.imageUrl ? `<img src="${escapeVmAdminHtml(selected.imageUrl)}" alt="${escapeVmAdminHtml(selected.title)}" style="display:block; width:100%; aspect-ratio:4/5; object-fit:cover;" />` : `<div style="aspect-ratio:4/5; display:flex; align-items:center; justify-content:center; color:rgba(166,235,210,.72); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">No Poster</div>`}
      </div>
      <div style="margin-top:10px; color:rgba(245,236,242,.92); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.08em; text-transform:uppercase;">${escapeVmAdminHtml(selected.title)}</div>
      <div style="margin-top:5px; color:rgba(214,198,210,.7); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.5;">${escapeVmAdminHtml([selected.subtitle, selected.meta, selected.routePath].filter(Boolean).join(' â€¢ '))}</div>
      <div style="margin-top:10px; padding:9px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(7,10,16,.78); color:rgba(208,222,232,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:9px; line-height:1.55; white-space:pre-wrap;">${escapeVmAdminHtml(buildVmAdminFacebookCaptionStarter(selected) || 'No caption starter')}</div>
      <button type="button" data-facebook-picker-clear="1" style="margin-top:10px; min-width:148px; padding:9px 14px; border-radius:999px; border:1px solid rgba(255,255,255,.08); background:linear-gradient(180deg,rgba(23,18,29,.94),rgba(13,11,18,.92)); color:rgba(247,237,242,.94); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer;">Clear Selection</button>
    `;
  }

  function renderVmAdminFacebookPicker(){
    try {
      renderVmAdminSharedPicker('Facebook');
    } catch (err) {
      try { console.error('Facebook picker render failed:', err); } catch (_) {}
    }
    try {
      renderVmAdminSharedPicker('Instagram');
    } catch (err) {
      try { console.error('Instagram picker render failed:', err); } catch (_) {}
    }
  }

  function selectVmAdminFacebookPickerItem(itemId){
    if (getVmAdminFacebookBrowseMatch()) {
      toggleVmAdminFacebookPhotoSelection(itemId);
      return;
    }
    const rootItems = Array.isArray(vmAdminFacebookPickerState.items) ? vmAdminFacebookPickerState.items : [];
    let match = rootItems.find((item) => item.id === itemId) || null;
    if (!match && vmAdminFacebookPickerState.browseShowId) {
      const parent = rootItems.find((item) => item.id === vmAdminFacebookPickerState.browseShowId) || null;
      match = buildVmAdminFacebookPickerMatchItems(parent).find((item) => item.id === itemId) || null;
    }
    vmAdminFacebookPickerState.selectedId = match ? match.id : '';
    vmAdminFacebookPickerState.selected = match;
    syncVmAdminFacebookSelectionIntoComposer(match);
    renderVmAdminFacebookPicker();
  }

  function openVmAdminFacebookPickerShow(itemId){
    const match = (Array.isArray(vmAdminFacebookPickerState.items) ? vmAdminFacebookPickerState.items : []).find((item) => item.id === itemId) || null;
    if (!match) return;
    vmAdminFacebookPickerState.browseShowId = match.id;
    vmAdminFacebookPickerState.browseMatchId = '';
    vmAdminFacebookPickerState.photoItems = [];
    vmAdminFacebookPickerState.selectedPhotoIds = [];
    vmAdminFacebookPickerState.photoError = '';
    vmAdminFacebookPickerState.photoLoading = false;
    const pickerStatus = document.getElementById('vmAdminFacebookPickerStatus');
    const matchItems = buildVmAdminFacebookPickerMatchItems(match);
    if (pickerStatus) {
      pickerStatus.textContent = matchItems.length
        ? `Browsing matches for ${match.title}`
        : `No matches found for ${match.title}`;
    }
    renderVmAdminFacebookPicker();
  }

  function closeVmAdminFacebookPickerShow(){
    vmAdminFacebookPickerState.browseShowId = '';
    vmAdminFacebookPickerState.browseMatchId = '';
    vmAdminFacebookPickerState.photoItems = [];
    vmAdminFacebookPickerState.selectedPhotoIds = [];
    vmAdminFacebookPickerState.photoError = '';
    vmAdminFacebookPickerState.photoLoading = false;
    const pickerStatus = document.getElementById('vmAdminFacebookPickerStatus');
    if (pickerStatus && !vmAdminFacebookPickerState.selected) {
      pickerStatus.textContent = 'Single-select picker ready';
    }
    renderVmAdminFacebookPicker();
  }

  async function openVmAdminFacebookPickerMatch(itemId){
    const parent = getVmAdminFacebookBrowseShow();
    const match = parent ? buildVmAdminFacebookPickerMatchItems(parent).find((item) => item.id === itemId) || null : null;
    if (!match) return;
    vmAdminFacebookPickerState.browseMatchId = match.id;
    vmAdminFacebookPickerState.photoItems = [];
    vmAdminFacebookPickerState.selectedPhotoIds = [];
    vmAdminFacebookPickerState.photoError = '';
    vmAdminFacebookPickerState.photoLoading = true;
    const pickerStatus = document.getElementById('vmAdminFacebookPickerStatus');
    if (pickerStatus) pickerStatus.textContent = `Loading photos for ${match.title}`;
    renderVmAdminFacebookPicker();
    try {
      const albumUrl = String(match.sourceAlbumUrl || '').trim();
      if (!albumUrl) throw new Error('No album URL found for this match');
      const albumKey = await resolveVmAdminAlbumKeyFromUrl(albumUrl);
      if (!albumKey) throw new Error('Could not resolve this match album yet');
      const images = await fetchVmAdminAlbumImages(albumKey);
      const photoItems = images.map((img, index) => {
        const imageKey = String(img?.ImageKey || img?.Image?.ImageKey || `photo-${index + 1}`).trim();
        const thumbUrl = getVmAdminPhotoThumb(img);
        const fullUrl = getVmAdminPhotoFull(img) || thumbUrl;
        return {
          id: `${match.id}:photo:${imageKey || (index + 1)}`,
          type: 'photo',
          entityId: `${match.entityId}-photo-${imageKey || (index + 1)}`,
          title: `Photo ${index + 1}`,
          subtitle: match.title,
          meta: [match.showTitle, match.prettyDate].filter(Boolean).join(' â€¢ '),
          prettyDate: match.prettyDate,
          routePath: match.routePath,
          routeUrl: match.routeUrl,
          imageUrl: thumbUrl || fullUrl,
          imageFullUrl: fullUrl || thumbUrl,
          matchTitle: match.title,
          showTitle: match.showTitle,
          sourceAlbumUrl: albumUrl,
          searchBlob: [`photo ${index + 1}`, match.title, match.showTitle, match.prettyDate].filter(Boolean).join(' ').toLowerCase()
        };
      }).filter((item) => item.imageUrl || item.imageFullUrl);
      vmAdminFacebookPickerState.photoItems = photoItems;
      vmAdminFacebookPickerState.photoError = photoItems.length ? '' : 'No photos found for this match yet.';
      if (pickerStatus) {
        pickerStatus.textContent = photoItems.length
          ? `Browsing photos for ${match.title}`
          : `No photos found for ${match.title}`;
      }
    } catch (err) {
      vmAdminFacebookPickerState.photoItems = [];
      vmAdminFacebookPickerState.photoError = messageFromVmAdminError(err, 'Unable to load match photos');
      if (pickerStatus) pickerStatus.textContent = vmAdminFacebookPickerState.photoError;
    } finally {
      vmAdminFacebookPickerState.photoLoading = false;
      renderVmAdminFacebookPicker();
    }
  }

  function closeVmAdminFacebookPickerMatch(){
    vmAdminFacebookPickerState.browseMatchId = '';
    vmAdminFacebookPickerState.photoItems = [];
    vmAdminFacebookPickerState.selectedPhotoIds = [];
    vmAdminFacebookPickerState.photoError = '';
    vmAdminFacebookPickerState.photoLoading = false;
    const browseShow = getVmAdminFacebookBrowseShow();
    const pickerStatus = document.getElementById('vmAdminFacebookPickerStatus');
    if (pickerStatus && browseShow) {
      pickerStatus.textContent = `Browsing matches for ${browseShow.title}`;
    }
    renderVmAdminFacebookPicker();
  }

  function clearVmAdminFacebookPickerSelection(){
    vmAdminFacebookPickerState.selectedId = '';
    vmAdminFacebookPickerState.selected = null;
    vmAdminFacebookPickerState.browseShowId = '';
    vmAdminFacebookPickerState.browseMatchId = '';
    vmAdminFacebookPickerState.photoItems = [];
    vmAdminFacebookPickerState.selectedPhotoIds = [];
    vmAdminFacebookPickerState.photoError = '';
    vmAdminFacebookPickerState.photoLoading = false;
    syncVmAdminFacebookSelectionIntoComposer(null);
    renderVmAdminFacebookPicker();
  }

  function buildVmAdminQuery(params){
    const qs = new URLSearchParams();
    Object.keys(params || {}).forEach((key) => {
      const value = params[key];
      if (value == null || value === '') return;
      qs.set(key, String(value));
    });
    const out = qs.toString();
    return out ? `?${out}` : '';
  }

  async function fetchVmAdminJson(path, params){
    const query = Object.assign({}, params || {}, { _ts: Date.now() });
    const res = await __vmAdminFetch(`${path}${buildVmAdminQuery(query)}`, { method: 'GET' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data || data.ok === false) {
      throw new Error((data && data.error) || `request failed for ${path}`);
    }
    return data;
  }

  async function fetchVmAdminJsonWithExplicitToken(path, params){
    const base =
      (typeof window !== 'undefined' && typeof window.WRESTLING_ARCHIVE_API_BASE === 'string' && window.WRESTLING_ARCHIVE_API_BASE.trim())
        ? window.WRESTLING_ARCHIVE_API_BASE.trim().replace(/\/$/, '')
        : 'https://wrestling-archive.onrender.com';
    const query = Object.assign({}, params || {}, { _ts: Date.now() });
    const token = getVmAdminTokenValue();
    const headers = {
      Accept: 'application/json'
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${base}${path}${buildVmAdminQuery(query)}`, {
      method: 'GET',
      cache: 'no-store',
      headers
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data || data.ok === false) {
      throw new Error((data && data.error) || `request failed for ${path}`);
    }
    return data;
  }

  function isVmAdminInvalidTokenError(err){
    const msg = String((err && err.message) || '').trim().toLowerCase();
    return msg === 'invalid token' || msg.indexOf('invalid token') >= 0;
  }

  function handleVmAdminInvalidToken(statusMessage, opts){
    const options = opts && typeof opts === 'object' ? opts : {};
    try { window.__VM_ADMIN_TOKEN__ = ''; } catch (_) {}
    try { sessionStorage.removeItem('vm_admin_token_v1'); } catch (_) {}
    try {
      if (window.__vmClearAdminUnlocked) window.__vmClearAdminUnlocked();
    } catch (_) {}
    const msg = String(statusMessage || 'Admin session expired. Please unlock Admin again.').trim();
    const statusEls = [
      document.getElementById('vmAdminStatusLine'),
      document.getElementById('vmAdminFacebookStatus'),
      document.getElementById('vmAdminFacebookComposerStatus')
    ];
    statusEls.forEach((el) => {
      if (el) el.textContent = msg;
    });
    if (options.reopenModal !== false) {
      window.setTimeout(() => {
        try {
          if (window.__vmOpenAdminModal) window.__vmOpenAdminModal();
        } catch (_) {}
      }, 120);
    }
  }

  async function postVmAdminJson(path, body){
    const res = await __vmAdminFetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body || {})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data || data.ok === false) {
      throw new Error((data && data.error) || `request failed for ${path}`);
    }
    return data;
  }

  function getVmAdminTokenValue(){
    let token = '';
    try { token = String(sessionStorage.getItem('vm_admin_token_v1') || '').trim(); } catch (_) {}
    if (!token) {
      try { token = String((window && window.__VM_ADMIN_TOKEN__) || '').trim(); } catch (_) {}
    }
    return token;
  }

  async function postVmAdminJsonWithExplicitToken(path, body){
    const base =
      (typeof window !== 'undefined' && typeof window.WRESTLING_ARCHIVE_API_BASE === 'string' && window.WRESTLING_ARCHIVE_API_BASE.trim())
        ? window.WRESTLING_ARCHIVE_API_BASE.trim().replace(/\/$/, '')
        : 'https://wrestling-archive.onrender.com';
    const token = getVmAdminTokenValue();
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      cache: 'no-store',
      headers,
      body: JSON.stringify(body || {})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data || data.ok === false) {
      throw new Error((data && data.error) || `request failed for ${path}`);
    }
    return data;
  }

  function messageFromVmAdminError(err, fallback){
    const raw = String((err && err.message) || '').trim();
    if (isVmAdminInvalidTokenError(err)) return 'Admin session expired. Unlock again.';
    return raw || String(fallback || 'Request failed').trim() || 'Request failed';
  }

  function renderVmAdminFacebookStatus(connection, config){
    const info = connection && typeof connection === 'object' ? connection : {};
    const page = info && info.page && typeof info.page === 'object' ? info.page : {};
    const cfg = config && typeof config === 'object' ? config : {};
    const connected = !!info.connected;
    const pageName = String(page.name || cfg.page_target || 'Voodoo Media').trim() || 'Voodoo Media';
    const tokenStatus = String(info.token_status || (connected ? 'valid' : 'not_connected')).trim() || 'not_connected';
    const updatedAt = info.updated_at ? formatVmAdminDate(info.updated_at) : 'Not connected yet';
    const checkedAt = info.last_checked_at ? formatVmAdminDate(info.last_checked_at) : 'Awaiting first connection';
    const expiresAt = info.user_token_expires_at ? formatVmAdminDate(info.user_token_expires_at) : 'Not available yet';
    const readinessLabel = cfg.connect_ready ? 'Backend ready for Facebook posting.' : 'Facebook setup still needs attention.';
    const configBits = [readinessLabel];

    return `
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px;">
        <div style="border:1px solid rgba(97,224,255,.18); border-radius:16px; padding:14px; background:linear-gradient(180deg,rgba(10,16,24,.9),rgba(8,10,16,.82));">
          <div style="color:rgba(166,235,210,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;">Page Link</div>
          <div style="margin-top:8px; color:${connected ? 'rgba(210,242,255,.96)' : 'rgba(245,236,242,.96)'}; font-family:'Orbitron',system-ui,sans-serif; font-size:18px; font-weight:900; letter-spacing:.03em; text-transform:uppercase;">${escapeVmAdminHtml(connected ? 'Connected' : 'Not Linked')}</div>
          <div style="margin-top:8px; color:rgba(208,222,232,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.5;">Live page: ${escapeVmAdminHtml(pageName)}</div>
        </div>
        <div style="border:1px solid rgba(255,70,110,.18); border-radius:16px; padding:14px; background:linear-gradient(180deg,rgba(19,11,23,.92),rgba(12,9,17,.82));">
          <div style="color:rgba(255,130,164,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;">Token State</div>
          <div style="margin-top:8px; color:rgba(245,236,242,.96); font-family:'Orbitron',system-ui,sans-serif; font-size:16px; font-weight:900; letter-spacing:.03em; text-transform:uppercase;">${escapeVmAdminHtml(tokenStatus.replace(/_/g, ' '))}</div>
          <div style="margin-top:8px; color:rgba(208,222,232,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.5;">Checked ${escapeVmAdminHtml(checkedAt)}</div>
        </div>
        <div style="border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:14px; background:linear-gradient(180deg,rgba(16,14,22,.9),rgba(10,10,15,.82));">
          <div style="color:rgba(214,198,210,.76); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;">Publish Readiness</div>
          <div style="margin-top:8px; color:rgba(245,236,242,.94); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.65;">${escapeVmAdminHtml(configBits.join(' â€¢ '))}</div>
          <div style="margin-top:8px; color:rgba(166,235,210,.76); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.5;">Last sync ${escapeVmAdminHtml(updatedAt)}</div>
          <div style="margin-top:4px; color:rgba(120,224,252,.74); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.5;">User token expiry ${escapeVmAdminHtml(expiresAt)}</div>
        </div>
      </div>
    `;
  }

  function renderVmAdminInstagramStatus(connection, config){
    const info = connection && typeof connection === 'object' ? connection : {};
    const page = info && info.page && typeof info.page === 'object' ? info.page : {};
    const account = info && info.instagram_account && typeof info.instagram_account === 'object' ? info.instagram_account : {};
    const cfg = config && typeof config === 'object' ? config : {};
    const connected = !!info.connected;
    const pageName = String(page.name || cfg.page_target || 'Voodoo Media').trim() || 'Voodoo Media';
    const igName = String(account.username || account.name || cfg.instagram_account_target || 'Instagram Account').trim() || 'Instagram Account';
    const tokenStatus = String(info.token_status || (connected ? 'valid' : 'not_connected')).trim() || 'not_connected';
    const updatedAt = info.updated_at ? formatVmAdminDate(info.updated_at) : 'Not connected yet';
    const checkedAt = info.last_checked_at ? formatVmAdminDate(info.last_checked_at) : 'Awaiting first connection';
    const expiresAt = info.user_token_expires_at ? formatVmAdminDate(info.user_token_expires_at) : 'Not available yet';
    const readinessLabel = cfg.connect_ready ? 'Backend ready for Instagram connection.' : 'Instagram setup still needs attention.';

    return `
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px;">
        <div style="border:1px solid rgba(97,224,255,.18); border-radius:16px; padding:14px; background:linear-gradient(180deg,rgba(10,16,24,.9),rgba(8,10,16,.82));">
          <div style="color:rgba(166,235,210,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;">Instagram Link</div>
          <div style="margin-top:8px; color:${connected ? 'rgba(210,242,255,.96)' : 'rgba(245,236,242,.96)'}; font-family:'Orbitron',system-ui,sans-serif; font-size:18px; font-weight:900; letter-spacing:.03em; text-transform:uppercase;">${escapeVmAdminHtml(connected ? 'Connected' : 'Not Linked')}</div>
          <div style="margin-top:8px; color:rgba(208,222,232,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.5;">IG: ${escapeVmAdminHtml(igName)}</div>
          <div style="margin-top:4px; color:rgba(208,222,232,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.5;">Page: ${escapeVmAdminHtml(pageName)}</div>
        </div>
        <div style="border:1px solid rgba(255,70,110,.18); border-radius:16px; padding:14px; background:linear-gradient(180deg,rgba(19,11,23,.92),rgba(12,9,17,.82));">
          <div style="color:rgba(255,130,164,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;">Token State</div>
          <div style="margin-top:8px; color:rgba(245,236,242,.96); font-family:'Orbitron',system-ui,sans-serif; font-size:16px; font-weight:900; letter-spacing:.03em; text-transform:uppercase;">${escapeVmAdminHtml(tokenStatus.replace(/_/g, ' '))}</div>
          <div style="margin-top:8px; color:rgba(208,222,232,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.5;">Checked ${escapeVmAdminHtml(checkedAt)}</div>
        </div>
        <div style="border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:14px; background:linear-gradient(180deg,rgba(16,14,22,.9),rgba(10,10,15,.82));">
          <div style="color:rgba(214,198,210,.76); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;">Connection Readiness</div>
          <div style="margin-top:8px; color:rgba(245,236,242,.94); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.65;">${escapeVmAdminHtml(readinessLabel)}</div>
          <div style="margin-top:8px; color:rgba(166,235,210,.76); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.5;">Last sync ${escapeVmAdminHtml(updatedAt)}</div>
          <div style="margin-top:4px; color:rgba(120,224,252,.74); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.5;">User token expiry ${escapeVmAdminHtml(expiresAt)}</div>
        </div>
      </div>
    `;
  }

  function setVmAdminFacebookUiState(opts){
    const options = opts || {};
    const connected = !!options.connected;
    const busy = !!options.busy;
    const connectBtn = document.getElementById('vmAdminFacebookConnect');
    const refreshBtn = document.getElementById('vmAdminFacebookRefresh');
    const disconnectBtn = document.getElementById('vmAdminFacebookDisconnect');
    const previewBtn = document.getElementById('vmAdminFacebookPreviewBtn');
    const publishBtn = document.getElementById('vmAdminFacebookPublishBtn');
    const composerStatus = document.getElementById('vmAdminFacebookComposerStatus');
    const previewShell = document.getElementById('vmAdminFacebookPreview');
    const publishMode = readVmAdminFacebookPublishMode();
    if (connectBtn) {
      connectBtn.textContent = connected ? 'Manage Connection' : 'Connect Page';
      connectBtn.disabled = busy;
    }
    if (refreshBtn) refreshBtn.disabled = busy;
    if (disconnectBtn) disconnectBtn.disabled = busy || !connected;
    if (previewBtn) previewBtn.disabled = busy || !connected;
    if (publishBtn) {
      publishBtn.disabled = busy || !connected;
      publishBtn.textContent = publishMode === 'share' ? 'Share' : 'Publish Now';
    }
    if (composerStatus && options.message) composerStatus.textContent = options.message;
    if (previewShell && options.clearPreview) previewShell.innerHTML = 'Facebook preview will appear here.';
  }

  function setVmAdminInstagramUiState(opts){
    const options = opts || {};
    const connected = !!options.connected;
    const busy = !!options.busy;
    const connectBtn = document.getElementById('vmAdminInstagramConnect');
    const refreshBtn = document.getElementById('vmAdminInstagramRefresh');
    const disconnectBtn = document.getElementById('vmAdminInstagramDisconnect');
    const previewBtn = document.getElementById('vmAdminInstagramPreviewBtn');
    const publishBtn = document.getElementById('vmAdminInstagramPublishBtn');
    const statusEl = document.getElementById('vmAdminInstagramStatus');
    if (connectBtn) {
      connectBtn.textContent = connected ? 'Manage Connection' : 'Connect Instagram';
      connectBtn.disabled = busy;
    }
    if (refreshBtn) refreshBtn.disabled = busy;
    if (disconnectBtn) disconnectBtn.disabled = busy || !connected;
    if (previewBtn) previewBtn.disabled = busy || !connected;
    if (publishBtn) publishBtn.disabled = busy || !connected;
    if (statusEl && options.message) statusEl.textContent = options.message;
    if (options.clearPreview) {
      const previewEl = document.getElementById('vmAdminInstagramPreview');
      if (previewEl) previewEl.innerHTML = 'Instagram preview will appear here.';
    }
  }

  function readVmAdminFacebookEntityType(){
    const field = document.getElementById('vmAdminFacebookEntityType');
    return String((field && field.value) || 'normal_post').trim().toLowerCase();
  }

  function readVmAdminFacebookPublishMode(){
    const field = document.getElementById('vmAdminFacebookPublishMode');
    return String((field && field.value) || 'post').trim().toLowerCase();
  }

  function readVmAdminFacebookPhotoToggle(fieldId, fallback){
    const field = document.getElementById(fieldId);
    return String((field && field.value) || fallback || 'no').trim().toLowerCase();
  }

  function buildVmAdminFacebookPhotoMessage(){
    const titleMode = readVmAdminFacebookPhotoToggle('vmAdminFacebookPhotoTitleMode', 'no');
    const linkMode = readVmAdminFacebookPhotoToggle('vmAdminFacebookPhotoLinkMode', 'no');
    const hashtagsMode = readVmAdminFacebookPhotoToggle('vmAdminFacebookPhotoHashtagsMode', 'no');
    const title = String((document.getElementById('vmAdminFacebookEntityLabel') || {}).value || '').trim();
    const caption = String((document.getElementById('vmAdminFacebookCaption') || {}).value || '').trim();
    const link = String((document.getElementById('vmAdminFacebookLinkUrl') || {}).value || '').trim();
    const hashtags = String((document.getElementById('vmAdminFacebookHashtags') || {}).value || '').trim();
    return [
      titleMode === 'yes' ? title : '',
      caption,
      linkMode === 'yes' ? link : '',
      hashtagsMode === 'yes' ? hashtags : ''
    ].filter(Boolean).join('\n\n').trim();
  }

  function syncVmAdminFacebookPhotoOptionsUi(){
    const publishMode = readVmAdminFacebookPublishMode();
    const titleMode = readVmAdminFacebookPhotoToggle('vmAdminFacebookPhotoTitleMode', 'no');
    const linkMode = readVmAdminFacebookPhotoToggle('vmAdminFacebookPhotoLinkMode', 'no');
    const hashtagsMode = readVmAdminFacebookPhotoToggle('vmAdminFacebookPhotoHashtagsMode', 'no');
    const titleWrap = document.getElementById('vmAdminFacebookEntityTitleWrap');
    const titleToggleWrap = document.getElementById('vmAdminFacebookPhotoTitleModeWrap');
    const linkToggleWrap = document.getElementById('vmAdminFacebookPhotoLinkModeWrap');
    const hashtagsToggleWrap = document.getElementById('vmAdminFacebookPhotoHashtagsModeWrap');
    const linkUrlWrap = document.getElementById('vmAdminFacebookLinkUrlWrap');
    const hashtagsWrap = document.getElementById('vmAdminFacebookHashtagsWrap');
    const isPhotoMode = readVmAdminFacebookEntityType() !== 'normal_post';
    const isShareMode = publishMode === 'share';

    if (titleToggleWrap) titleToggleWrap.style.display = isPhotoMode && !isShareMode ? 'block' : 'none';
    if (linkToggleWrap) linkToggleWrap.style.display = isPhotoMode && !isShareMode ? 'block' : 'none';
    if (hashtagsToggleWrap) hashtagsToggleWrap.style.display = isPhotoMode && !isShareMode ? 'block' : 'none';
    if (titleWrap) titleWrap.style.display = isPhotoMode && !isShareMode && titleMode === 'yes' ? 'block' : 'none';
    if (linkUrlWrap) linkUrlWrap.style.display = isPhotoMode && !isShareMode && linkMode === 'yes' ? 'block' : 'none';
    if (hashtagsWrap) hashtagsWrap.style.display = isPhotoMode && !isShareMode && hashtagsMode === 'yes' ? 'block' : 'none';
    if (isShareMode) {
      try {
        const payload = buildVmAdminFacebookComposerPayload();
        warmVmAdminNativeShareFiles(payload).catch(() => null);
      } catch (_) {}
    }
  }

  function buildVmAdminFacebookSharePayload(payload){
    const row = payload && typeof payload === 'object' ? payload : {};
    const title = String(row.entity_label || '').trim();
    const text = String(row.caption || '').trim();
    const linkUrl = String(row.link_url || '').trim();
    const hasPhotos = (Array.isArray(row.selected_photos) && row.selected_photos.length > 0) || !!String(row.image_url || '').trim();
    const shareData = {};
    if (title) shareData.title = title;
    if (text) shareData.text = text;
    if (linkUrl && !hasPhotos) shareData.url = linkUrl;
    return shareData;
  }

  function buildVmAdminNativeShareCacheKey(payload){
    const row = payload && typeof payload === 'object' ? payload : {};
    const selectedPhotos = Array.isArray(row.selected_photos) ? row.selected_photos : [];
    const source = selectedPhotos.length
      ? selectedPhotos.map((item) => String(item && item.image_url || '').trim()).filter(Boolean)
      : [String(row.image_url || '').trim()].filter(Boolean);
    return source.join('|');
  }

  async function buildVmAdminNativeShareFiles(payload){
    if (typeof File === 'undefined') return [];
    const row = payload && typeof payload === 'object' ? payload : {};
    const selectedPhotos = Array.isArray(row.selected_photos) ? row.selected_photos : [];
    const photoItems = selectedPhotos.length
      ? selectedPhotos
      : (row.image_url ? [{ image_url: row.image_url, title: row.entity_label || 'shared-photo' }] : []);
    const apiBase = getVmAdminWrestlingApiBase();
    const getFetchUrl = (rawUrl) => {
      const clean = String(rawUrl || '').trim();
      if (!clean) return '';
      try {
        const target = new URL(clean, window.location.origin);
        const apiOrigin = new URL(apiBase).origin;
        if (target.origin === window.location.origin || target.origin === apiOrigin) {
          return target.toString();
        }
        return `${apiBase}/show-poster?url=${encodeURIComponent(target.toString())}`;
      } catch (_) {
        return `${apiBase}/show-poster?url=${encodeURIComponent(clean)}`;
      }
    };
    const built = await Promise.all(photoItems.map(async (rawItem, index) => {
      const item = rawItem && typeof rawItem === 'object' ? rawItem : {};
      const imageUrl = String(item.image_url || '').trim();
      if (!imageUrl) return null;
      try {
        const res = await fetch(getFetchUrl(imageUrl), { mode: 'cors', cache: 'no-store' });
        if (!res.ok) return null;
        const blob = await res.blob();
        const mime = String(blob && blob.type || '').trim() || 'image/jpeg';
        const baseName = String(item.title || row.entity_label || `shared-photo-${index + 1}`)
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || `shared-photo-${index + 1}`;
        const ext = mime.indexOf('png') >= 0 ? 'png' : (mime.indexOf('webp') >= 0 ? 'webp' : 'jpg');
        return new File([blob], `${baseName}.${ext}`, { type: mime });
      } catch (_) {
        return null;
      }
    }));
    return built.filter(Boolean);
  }

  function warmVmAdminNativeShareFiles(payload){
    const key = buildVmAdminNativeShareCacheKey(payload);
    if (!key) {
      vmAdminNativeShareState.key = '';
      vmAdminNativeShareState.files = [];
      vmAdminNativeShareState.loading = false;
      vmAdminNativeShareState.error = '';
      vmAdminNativeShareState.promise = null;
      return Promise.resolve([]);
    }
    if (vmAdminNativeShareState.key === key && vmAdminNativeShareState.files.length) {
      return Promise.resolve(vmAdminNativeShareState.files.slice());
    }
    if (vmAdminNativeShareState.key === key && vmAdminNativeShareState.loading && vmAdminNativeShareState.promise) {
      return vmAdminNativeShareState.promise;
    }
    vmAdminNativeShareState.key = key;
    vmAdminNativeShareState.files = [];
    vmAdminNativeShareState.loading = true;
    vmAdminNativeShareState.error = '';
    const task = buildVmAdminNativeShareFiles(payload)
      .then((files) => {
        if (vmAdminNativeShareState.key === key) {
          vmAdminNativeShareState.files = Array.isArray(files) ? files : [];
          vmAdminNativeShareState.loading = false;
          vmAdminNativeShareState.error = '';
          vmAdminNativeShareState.promise = null;
        }
        return Array.isArray(files) ? files : [];
      })
      .catch((err) => {
        if (vmAdminNativeShareState.key === key) {
          vmAdminNativeShareState.files = [];
          vmAdminNativeShareState.loading = false;
          vmAdminNativeShareState.error = messageFromVmAdminError(err, 'Unable to prepare share files');
          vmAdminNativeShareState.promise = null;
        }
        throw err;
      });
    vmAdminNativeShareState.promise = task;
    return task;
  }

  async function runVmAdminNativeShare(payload){
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      throw new Error('Native share is not available in this browser.');
    }
    const shareData = buildVmAdminFacebookSharePayload(payload);
    const cacheKey = buildVmAdminNativeShareCacheKey(payload);
    const files = vmAdminNativeShareState.key === cacheKey && Array.isArray(vmAdminNativeShareState.files)
      ? vmAdminNativeShareState.files.slice()
      : [];
    if (files.length) {
      const filesOnlyShareData = { files };
      if (typeof navigator.canShare === 'function' ? navigator.canShare(filesOnlyShareData) : true) {
        await navigator.share(filesOnlyShareData);
        return filesOnlyShareData;
      }
      const fileShareData = { files };
      if (shareData.title) fileShareData.title = shareData.title;
      if (shareData.text) {
        fileShareData.text = String(shareData.text || '').replace(/https?:\/\/\S+/gi, '').trim();
      }
      if ((fileShareData.title || fileShareData.text) && (typeof navigator.canShare !== 'function' ? true : navigator.canShare(fileShareData))) {
        await navigator.share(fileShareData);
        return fileShareData;
      }
    }
    if (cacheKey) {
      warmVmAdminNativeShareFiles(payload).catch(() => null);
      return {
        pending: true,
        message: vmAdminNativeShareState.loading
          ? 'Selected photos are still preparing for share. Click Share again in a moment.'
          : (vmAdminNativeShareState.error || 'Selected photos are not ready to share yet. Click Share again in a moment.')
      };
    }
    if (!shareData.title && !shareData.text && !shareData.url) {
      throw new Error('Nothing is ready to share yet.');
    }
    await navigator.share(shareData);
    return shareData;
  }

  function renderVmAdminFacebookAlbumUi(){
    const modeField = document.getElementById('vmAdminFacebookPublishMode');
    const albumWrap = document.getElementById('vmAdminFacebookAlbumWrap');
    const albumSelect = document.getElementById('vmAdminFacebookAlbumId');
    const albumStatus = document.getElementById('vmAdminFacebookAlbumStatus');
    const refreshBtn = document.getElementById('vmAdminFacebookAlbumRefresh');
    const mode = String((modeField && modeField.value) || 'post').trim().toLowerCase();
    const needsAlbum = mode === 'album' || mode === 'both';
    const items = Array.isArray(vmAdminFacebookAlbumState.items) ? vmAdminFacebookAlbumState.items : [];
    const currentValue = String((albumSelect && albumSelect.value) || '').trim();

    if (albumWrap) albumWrap.style.display = needsAlbum ? 'block' : 'none';
    if (albumSelect) {
      const optionRows = ['<option value="">Select a Facebook album...</option>']
        .concat(items.map((item) => {
          const id = String(item && item.id || '').trim();
          const name = String(item && item.name || '').trim() || 'Untitled Album';
          const count = Number(item && item.count);
          const suffix = Number.isFinite(count) && count >= 0 ? ` (${count})` : '';
          return `<option value="${escapeVmAdminHtml(id)}">${escapeVmAdminHtml(`${name}${suffix}`)}</option>`;
        }));
      albumSelect.innerHTML = optionRows.join('');
      albumSelect.disabled = !needsAlbum || vmAdminFacebookAlbumState.loading;
      if (currentValue && items.some((item) => String(item && item.id || '').trim() === currentValue)) {
        albumSelect.value = currentValue;
      }
    }
    if (refreshBtn) refreshBtn.disabled = !needsAlbum || vmAdminFacebookAlbumState.loading;
    if (albumStatus) {
      if (!needsAlbum) {
        albumStatus.textContent = 'Album upload is off. Custom multi-photo post is the active mode.';
      } else if (mode === 'album') {
        albumStatus.textContent = vmAdminFacebookAlbumState.loading
          ? 'Loading Facebook albums...'
          : 'Album-only mode uploads the selected photos to the chosen album, carries your caption into the album upload, and does not create a custom wall post from this tool.';
      } else if (mode === 'both') {
        albumStatus.textContent = vmAdminFacebookAlbumState.loading
          ? 'Loading Facebook albums...'
          : 'Manual Post/Upload mode uploads to the chosen album with your caption, then creates one custom wall post from this tool.';
      } else if (mode === 'share') {
        albumStatus.textContent = 'Share mode is active. Album selection is not needed.';
      } else if (vmAdminFacebookAlbumState.loading) {
        albumStatus.textContent = 'Loading Facebook albums...';
      } else if (vmAdminFacebookAlbumState.error) {
        albumStatus.textContent = vmAdminFacebookAlbumState.error;
      } else if (!items.length) {
        albumStatus.textContent = 'No Facebook albums available right now.';
      } else {
        albumStatus.textContent = `${formatVmAdminNumber(items.length)} album${items.length === 1 ? '' : 's'} ready for upload.`;
      }
    }
  }

  async function loadVmAdminFacebookAlbums(opts){
    const options = opts && typeof opts === 'object' ? opts : {};
    if (vmAdminFacebookAlbumState.loading) return vmAdminFacebookAlbumState.items;
    if (!options.force && vmAdminFacebookAlbumState.loaded && !vmAdminFacebookAlbumState.error) {
      renderVmAdminFacebookAlbumUi();
      return vmAdminFacebookAlbumState.items;
    }
    vmAdminFacebookAlbumState.loading = true;
    vmAdminFacebookAlbumState.error = '';
    renderVmAdminFacebookAlbumUi();
    try {
      const data = await fetchVmAdminJsonWithExplicitToken('/admin/facebook/albums');
      vmAdminFacebookAlbumState.items = (Array.isArray(data && data.items) ? data.items : []).map((item) => ({
        id: String(item && item.id || '').trim(),
        name: String(item && item.name || '').trim(),
        count: Number(item && item.count),
        type: String(item && item.type || '').trim()
      })).filter((item) => item.id && item.name);
      vmAdminFacebookAlbumState.loaded = true;
      return vmAdminFacebookAlbumState.items;
    } catch (err) {
      vmAdminFacebookAlbumState.loaded = false;
      vmAdminFacebookAlbumState.error = messageFromVmAdminError(err, 'Unable to load Facebook albums right now.');
      throw err;
    } finally {
      vmAdminFacebookAlbumState.loading = false;
      renderVmAdminFacebookAlbumUi();
    }
  }

  function syncVmAdminFacebookEntityTypeUi(){
    const entityType = readVmAdminFacebookEntityType();
    const normalFields = document.querySelectorAll('[data-facebook-mode="normal-post"]');
    const photoFields = document.querySelectorAll('[data-facebook-mode="photo-post"]');
    const linkMode = document.getElementById('vmAdminFacebookNormalLinkMode');
    const linkUrlWrap = document.getElementById('vmAdminFacebookNormalLinkUrlWrap');
    const imageWrap = document.getElementById('vmAdminFacebookImageUrlWrap');
    const titleWrap = document.getElementById('vmAdminFacebookEntityTitleWrap');
    const modeNote = document.getElementById('vmAdminFacebookModeNote');
    const pickerShell = document.getElementById('vmAdminFacebookPickerShell');
    const isNormal = entityType === 'normal_post';
    const isThrowback = entityType === 'throwback';
    const isPhotoMode = entityType === 'photo_post' || isThrowback;

    normalFields.forEach((el) => {
      el.style.display = isNormal ? 'block' : 'none';
    });
    photoFields.forEach((el) => {
      el.style.display = isPhotoMode ? 'block' : 'none';
    });

    if (modeNote) {
      if (isNormal) {
        modeNote.textContent = 'Normal Post uses caption plus an optional link.';
      } else if (isThrowback) {
        modeNote.textContent = 'Throwback uses the archive picker flow first, then keeps the post context tied to the selected show.';
      } else {
        modeNote.textContent = 'Photo Post now reads from real Wrestling show source data, supports multi-select, and can either make one custom wall post, upload to an album with your caption, manually post plus upload, or use share mode.';
      }
    }

    if (titleWrap) {
      titleWrap.style.display = isNormal ? 'none' : 'block';
    }

    if (isNormal) {
      if (pickerShell) pickerShell.style.display = 'none';
      if (imageWrap) imageWrap.style.display = 'none';
      if (linkUrlWrap) {
        const linkEnabled = String((linkMode && linkMode.value) || 'no').trim().toLowerCase() === 'yes';
        linkUrlWrap.style.display = linkEnabled ? 'block' : 'none';
      }
    } else if (isPhotoMode) {
      if (pickerShell) pickerShell.style.display = 'block';
      if (imageWrap) imageWrap.style.display = 'none';
      if (!vmAdminFacebookPickerState.loaded && !vmAdminFacebookPickerState.loading) {
        loadVmAdminFacebookPickerItems().catch(() => null);
      } else {
        renderVmAdminFacebookPicker();
      }
      renderVmAdminFacebookAlbumUi();
      syncVmAdminFacebookPhotoOptionsUi();
      if ((readVmAdminFacebookPublishMode() === 'album' || readVmAdminFacebookPublishMode() === 'both')
          && !vmAdminFacebookAlbumState.loaded
          && !vmAdminFacebookAlbumState.loading) {
        loadVmAdminFacebookAlbums().catch(() => null);
      }
    } else {
      if (pickerShell) pickerShell.style.display = 'block';
      if (imageWrap) imageWrap.style.display = 'none';
      renderVmAdminFacebookAlbumUi();
      syncVmAdminFacebookPhotoOptionsUi();
    }
  }

  function buildVmAdminFacebookEntityId(payload){
    const section = String(payload && payload.section || '').trim().toLowerCase();
    const entityType = String(payload && payload.entity_type || '').trim().toLowerCase();
    const title = String(payload && payload.entity_label || '').trim().toLowerCase();
    const caption = String(payload && payload.caption || '').trim().toLowerCase();
    const raw = title || caption || `${section}-${entityType || 'post'}`;
    const slug = raw
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    return slug || `${section || 'archive'}-${entityType || 'post'}`;
  }

  function buildVmAdminFacebookEntityLabel(payload){
    const explicitTitle = String(payload && payload.entity_label || '').trim();
    if (explicitTitle) return explicitTitle;
    const caption = String(payload && payload.caption || '').trim();
    if (!caption) return 'Untitled Post';
    const firstLine = caption.split(/\r?\n/).map((line) => String(line || '').trim()).find(Boolean) || '';
    return firstLine || 'Untitled Post';
  }

  function compactVmAdminFacebookPayload(payload){
    const out = {};
    Object.keys(payload || {}).forEach((key) => {
      const value = payload[key];
      if (value == null) return;
      if (typeof value === 'string' && !value.trim()) return;
      out[key] = value;
    });
    return out;
  }

  function formatVmAdminIndexGeneratedAt(value){
    const raw = String(value || '').trim();
    if (!raw) return 'Not available';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return 'Not available';
    try {
      return date.toLocaleString(undefined, {
        month: '2-digit',
        day: '2-digit',
        year: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (_) {
      return 'Not available';
    }
  }

  function renderVmAdminIndexTableRows(rows){
    const items = Array.isArray(rows) ? rows : [];
    const slug = (label) => String(label || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return items.map((row) => `
      <div data-index-row="${escapeVmAdminHtml(slug(row.label))}" style="display:grid; grid-template-columns:minmax(0,1.25fr) minmax(0,1.6fr) auto; gap:12px; align-items:center; justify-items:center; padding:10px 0; border-top:1px solid rgba(255,255,255,.06);">
        <div style="width:100%; text-align:center; color:rgba(245,236,242,.92); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:800; letter-spacing:.04em; text-transform:uppercase;">${escapeVmAdminHtml(row.label || 'Index')}</div>
        <div data-index-generated="${escapeVmAdminHtml(slug(row.label))}" style="width:100%; text-align:center; color:rgba(208,222,232,.8); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.55;">${escapeVmAdminHtml(row.generatedAtLabel || 'Checking rebuild time...')}</div>
        <button type="button" style="min-width:132px; padding:8px 12px; border-radius:999px; border:1px solid rgba(255,95,135,.24); background:linear-gradient(180deg,rgba(28,17,30,.9),rgba(16,11,20,.88)); color:rgba(247,237,242,.9); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:default;">Rebuild Index</button>
      </div>
    `).join('');
  }

  function renderVmAdminIndexTableShell(rows){
    return `
      <div style="margin-top:12px; border:1px solid rgba(255,255,255,.06); border-radius:16px; padding:12px 14px; background:rgba(8,10,16,.62);">
        <div style="display:grid; grid-template-columns:minmax(0,1.25fr) minmax(0,1.6fr) auto; gap:12px; align-items:center; justify-items:center; padding-bottom:8px;">
          <div style="width:100%; text-align:center; color:rgba(166,235,210,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Entity</div>
          <div style="width:100%; text-align:center; color:rgba(166,235,210,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Last Rebuild</div>
          <div style="width:100%; text-align:center; color:rgba(166,235,210,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Action</div>
        </div>
        ${renderVmAdminIndexTableRows(rows)}
      </div>
    `;
  }

  async function loadVmAdminIndexingTable(){
    const shell = document.getElementById('vmAdminPeopleMeta');
    if (!shell) return null;
    const rows = [
      { label: 'Music-Bands', base: getVmAdminMusicApiBase(), endpoints: ['/index/bands'] },
      { label: 'Music-Shows', base: getVmAdminMusicApiBase(), endpoints: ['/index/shows'] },
      { label: 'Music-People', base: getVmAdminMusicApiBase(), endpoints: ['/index/people'] },
      { label: 'Wrestling-Shows', base: getVmAdminWrestlingApiBase(), endpoints: ['/index/shows'] },
      { label: 'Wrestling-People', base: getVmAdminWrestlingApiBase(), endpoints: ['/index/index', '/index/people'] }
    ];
    const resolvedRows = rows.map((row) => Object.assign({}, row, { generatedAtLabel: 'Checking rebuild time...' }));
    shell.innerHTML = renderVmAdminIndexTableShell(resolvedRows);
    const slug = (label) => String(label || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const loadRow = async (row) => {
      let generatedAt = '';
      for (let i = 0; i < row.endpoints.length; i++) {
        const endpoint = String(row.endpoints[i] || '').trim();
        if (!endpoint) continue;
        try {
          const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
          const timeout = window.setTimeout(() => {
            try { if (ctrl) ctrl.abort(); } catch (_) {}
          }, 9000);
          const res = await fetch(`${row.base}${endpoint}?cb=${Date.now()}`, {
            method: 'GET',
            cache: 'no-store',
            headers: { Accept: 'application/json' },
            signal: ctrl ? ctrl.signal : undefined
          });
          window.clearTimeout(timeout);
          if (!res.ok) continue;
          const data = await res.json().catch(() => null);
          if (data && data.generatedAt) {
            generatedAt = String(data.generatedAt || '').trim();
            if (generatedAt) break;
          }
        } catch (_) {}
      }
      return Object.assign({}, row, {
        generatedAtLabel: formatVmAdminIndexGeneratedAt(generatedAt)
      });      
    };
    resolvedRows.forEach((row, index) => {
      loadRow(row).then((nextRow) => {
        resolvedRows[index] = nextRow;
        const cell = shell ? shell.querySelector(`[data-index-generated="${slug(nextRow.label)}"]`) : null;
        if (cell) cell.textContent = String(nextRow.generatedAtLabel || 'Not available');
      }).catch(() => {
        resolvedRows[index] = Object.assign({}, row, { generatedAtLabel: 'Not available' });
        const cell = shell ? shell.querySelector(`[data-index-generated="${slug(row.label)}"]`) : null;
        if (cell) cell.textContent = 'Not available';
      });
    });
    return resolvedRows;
  }

  function buildVmAdminFacebookComposerPayload(){
    const previewShell = document.getElementById('vmAdminFacebookPreview');
    const status = document.getElementById('vmAdminFacebookComposerStatus');
    const entityType = readVmAdminFacebookEntityType();
    const selectedPickerItem = vmAdminFacebookPickerState.selected && typeof vmAdminFacebookPickerState.selected === 'object'
      ? vmAdminFacebookPickerState.selected
      : null;
    const selectedPhotos = buildVmAdminFacebookSelectedPhotosPayload();
    const albumPayload = buildVmAdminFacebookAlbumPayload();
    const payload = {
      section: String((document.getElementById('vmAdminFacebookSection') || {}).value || '').trim(),
      entity_type: String((document.getElementById('vmAdminFacebookEntityType') || {}).value || '').trim(),
      entity_id: String((document.getElementById('vmAdminFacebookEntityIdHidden') || {}).value || '').trim(),
      entity_label: String((document.getElementById('vmAdminFacebookEntityLabel') || {}).value || '').trim(),
      caption: String((document.getElementById('vmAdminFacebookCaption') || {}).value || '').trim(),
      link_url: String((document.getElementById('vmAdminFacebookLinkUrl') || {}).value || '').trim(),
      image_url: String((document.getElementById('vmAdminFacebookImageUrl') || {}).value || '').trim(),
      selected_photos: selectedPhotos,
      publish_mode: albumPayload.publish_mode,
      facebook_album_id: albumPayload.facebook_album_id,
      facebook_album_name: albumPayload.facebook_album_name,
      mentions: buildVmAdminFacebookMentionsPayload()
    };
    if (entityType === 'normal_post') {
      const linkMode = String((document.getElementById('vmAdminFacebookNormalLinkMode') || {}).value || 'no').trim().toLowerCase();
      payload.link_url = linkMode === 'yes'
        ? String((document.getElementById('vmAdminFacebookNormalLinkUrl') || {}).value || '').trim()
        : '';
      payload.image_url = '';
    } else {
      const photoLinkMode = readVmAdminFacebookPhotoToggle('vmAdminFacebookPhotoLinkMode', 'no');
      const selectedRoute = String((document.getElementById('vmAdminFacebookEntityRouteHidden') || {}).value || '').trim();
      if (!payload.entity_id && selectedPickerItem && selectedPickerItem.entityId) {
        payload.entity_id = String(selectedPickerItem.entityId || '').trim();
      }
      if (!payload.entity_label && selectedPickerItem && selectedPickerItem.title) {
        payload.entity_label = String(selectedPickerItem.title || '').trim();
      }
      if (photoLinkMode === 'yes' && !payload.link_url && selectedPickerItem && selectedPickerItem.routeUrl) {
        payload.link_url = String(selectedPickerItem.routeUrl || '').trim();
      }
      if (photoLinkMode === 'yes' && !payload.link_url && selectedRoute) {
        payload.link_url = `${window.location.origin}${selectedRoute}`;
      }
      if (!payload.image_url && selectedPickerItem && selectedPickerItem.imageUrl) {
        payload.image_url = String(selectedPickerItem.imageUrl || '').trim();
      }
      if (!payload.image_url && selectedPhotos.length) {
        payload.image_url = String(selectedPhotos[0].image_url || '').trim();
      }
      if (albumPayload.publish_mode === 'share') {
        payload.caption = String((document.getElementById('vmAdminFacebookCaption') || {}).value || '').trim();
        if (!payload.link_url && selectedPickerItem && selectedPickerItem.routeUrl) {
          payload.link_url = String(selectedPickerItem.routeUrl || '').trim();
        }
        if (!payload.link_url && selectedRoute) {
          payload.link_url = `${window.location.origin}${selectedRoute}`;
        }
      } else {
        payload.caption = buildVmAdminFacebookPhotoMessage();
        payload.link_url = '';
      }
    }
    payload.entity_label = buildVmAdminFacebookEntityLabel(payload);
    payload.entity_id = payload.entity_id || buildVmAdminFacebookEntityId(payload);

    if ((albumPayload.publish_mode === 'album' || albumPayload.publish_mode === 'both') && !albumPayload.facebook_album_id) {
      const message = 'Choose a Facebook album before previewing album upload mode.';
      if (previewShell) {
        previewShell.innerHTML = `<div style="color:rgba(255,168,168,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55;">${escapeVmAdminHtml(message)}</div>`;
      }
      if (status) status.textContent = 'Album required';
      setVmAdminFacebookUiState({ connected: true, message });
      throw new Error(message);
    }

    return compactVmAdminFacebookPayload(payload);
  }

  function buildVmAdminFacebookSelectedPhotosPayload(){
    return getVmAdminFacebookSelectedPhotoItems().map((item) => ({
      id: String(item && item.id || '').trim(),
      entity_id: String(item && item.entityId || '').trim(),
      title: String(item && item.title || '').trim(),
      image_url: String(item && (item.imageFullUrl || item.imageUrl) || '').trim(),
      route_url: String(item && item.routeUrl || '').trim(),
      route_path: String(item && item.routePath || '').trim()
    })).filter((item) => item.image_url);
  }

  function buildVmAdminFacebookAlbumPayload(){
    const mode = readVmAdminFacebookPublishMode();
    const albumField = document.getElementById('vmAdminFacebookAlbumId');
    const albumId = String((albumField && albumField.value) || '').trim();
    const selectedOption = albumField && albumField.options && albumField.selectedIndex >= 0
      ? albumField.options[albumField.selectedIndex]
      : null;
    const albumName = String((selectedOption && selectedOption.textContent) || '').replace(/\s+\(\d+\)\s*$/, '').trim();
    return {
      publish_mode: mode,
      facebook_album_id: (mode === 'album' || mode === 'both') ? albumId : '',
      facebook_album_name: (mode === 'album' || mode === 'both') ? albumName : ''
    };
  }

  function renderVmAdminFacebookNormalPostPreview(payload){
    const caption = String(payload && payload.caption || '').trim();
    const linkUrl = String(payload && payload.link_url || '').trim();
    const pageLabel = 'Voodoo Media';
    const finalMessage = linkUrl ? `${caption}\n\n${linkUrl}`.trim() : caption;
    return `
      <div style="display:grid; grid-template-columns:minmax(0,1fr); gap:14px;">
        <div>
          <div style="color:rgba(166,235,210,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;">Target Page</div>
          <div style="margin-top:6px; color:rgba(245,236,242,.96); font-family:'Orbitron',system-ui,sans-serif; font-size:14px; font-weight:900;">${escapeVmAdminHtml(pageLabel)}</div>
          <div style="margin-top:8px; color:rgba(214,198,210,.72); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.55;">Normal Post preview is caption-first and does not include an image.</div>
          <div style="margin-top:12px; padding:14px; border:1px solid rgba(255,255,255,.08); border-radius:16px; background:rgba(8,10,16,.78);">
            <div style="color:rgba(214,198,210,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.7; white-space:pre-wrap;">${escapeVmAdminHtml(finalMessage || 'No caption yet.')}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderVmAdminFacebookSelectedArchivePreview(payload, selected){
    const chosen = selected && typeof selected === 'object' ? selected : null;
    const selectedPhotos = getVmAdminFacebookSelectedPhotoItems();
    const showPhotoGrid = selectedPhotos.length > 1;
    const caption = String(payload && payload.caption || '').trim();
    const linkUrl = String(payload && payload.link_url || '').trim();
    const title = String(
      payload && payload.entity_label ||
      (showPhotoGrid ? `${selectedPhotos.length} Photos Selected` : '') ||
      (chosen && chosen.title) ||
      'Archive Selection'
    ).trim();
    const meta = chosen ? [chosen.subtitle, chosen.meta].filter(Boolean).join(' â€¢ ') : '';
    const finalMessage = linkUrl ? `${caption}\n\n${linkUrl}`.trim() : caption;
    return `
      <div style="display:grid; grid-template-columns:minmax(0,180px) minmax(0,1fr); gap:14px;">
        <div>
          <div style="border:1px solid rgba(255,255,255,.08); border-radius:16px; overflow:hidden; background:rgba(6,9,14,.82); min-height:140px;">
            ${showPhotoGrid ? `
              <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:2px; min-height:140px;">
                ${selectedPhotos.slice(0, 4).map((item) => `
                  <div style="background:rgba(8,10,16,.82); min-height:69px;">
                    ${item.imageUrl ? `<img src="${escapeVmAdminHtml(item.imageUrl)}" alt="${escapeVmAdminHtml(item.title || 'Selected photo')}" style="display:block; width:100%; height:100%; min-height:69px; object-fit:cover;" />` : ''}
                  </div>
                `).join('')}
              </div>
            ` : (payload.image_url ? `<img src="${escapeVmAdminHtml(payload.image_url)}" alt="${escapeVmAdminHtml(title)}" style="display:block; width:100%; height:100%; min-height:140px; object-fit:cover;" />` : `<div style="padding:24px; color:rgba(214,198,210,.66); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; text-transform:uppercase;">No image</div>`)}
          </div>
        </div>
        <div>
          <div style="color:rgba(166,235,210,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;">Selected Archive Item</div>
          <div style="margin-top:6px; color:rgba(245,236,242,.96); font-family:'Orbitron',system-ui,sans-serif; font-size:14px; font-weight:900;">${escapeVmAdminHtml(title)}</div>
          ${meta ? `<div style="margin-top:6px; color:rgba(208,222,232,.72); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.5;">${escapeVmAdminHtml(meta)}</div>` : ''}
          <div style="margin-top:10px; color:rgba(214,198,210,.8); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.65; white-space:pre-wrap; overflow-wrap:anywhere; word-break:break-word;">${escapeVmAdminHtml(finalMessage || 'No caption yet.')}</div>
        </div>
      </div>
    `;
  }

  async function loadVmAdminFacebookStatus(opts){
    const options = opts || {};
    const shell = document.getElementById('vmAdminFacebookMeta');
    const status = document.getElementById('vmAdminFacebookStatus');
    if (!options.silent) {
      if (status) status.textContent = 'Checking status...';
      if (shell) shell.innerHTML = `<div style="color:rgba(208,222,232,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.5;">Loading Facebook connection status...</div>`;
    }
    try {
      const data = await fetchVmAdminJsonWithExplicitToken('/admin/facebook/status');
      if (shell) shell.innerHTML = renderVmAdminFacebookStatus(data && data.connection, data && data.config);
      if (status) {
        const connected = !!(data && data.connection && data.connection.connected);
        status.textContent = connected ? 'Page connected' : 'Page not connected';
        setVmAdminFacebookUiState({
          connected,
          message: connected ? 'Connected and ready to post' : 'Connect a Facebook page to continue'
        });
      }
      return data;
    } catch (err) {
      if (isVmAdminInvalidTokenError(err)) {
        handleVmAdminInvalidToken('Admin session expired. Unlock again for Facebook tools.', { reopenModal: false });
      }
      if (shell) shell.innerHTML = `<div style="color:rgba(255,168,168,.86); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55;">Unable to load Facebook status right now.</div>`;
      if (status) status.textContent = 'Status unavailable';
      setVmAdminFacebookUiState({ connected: false, message: 'Unable to load Facebook tools' });
      throw err;
    }
  }

  async function loadVmAdminInstagramStatus(opts){
    const options = opts || {};
    const shell = document.getElementById('vmAdminInstagramMeta');
    const status = document.getElementById('vmAdminInstagramStatus');
    if (!options.silent) {
      if (status) status.textContent = 'Checking status...';
      if (shell) shell.innerHTML = `<div style="color:rgba(208,222,232,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.5;">Loading Instagram connection status...</div>`;
    }
    try {
      const data = await fetchVmAdminJsonWithExplicitToken('/admin/instagram/status');
      if (shell) shell.innerHTML = renderVmAdminInstagramStatus(data && data.connection, data && data.config);
      if (status) {
        const connected = !!(data && data.connection && data.connection.connected);
        status.textContent = connected ? 'Instagram connected' : 'Instagram not connected';
        setVmAdminInstagramUiState({
          connected,
          message: connected ? 'Connected and ready for Instagram publishing' : 'Connect Instagram to continue'
        });
      }
      return data;
    } catch (err) {
      if (isVmAdminInvalidTokenError(err)) {
        handleVmAdminInvalidToken('Admin session expired. Unlock again for Instagram tools.', { reopenModal: false });
      }
      if (shell) shell.innerHTML = `<div style="color:rgba(255,168,168,.86); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55;">Unable to load Instagram status right now.</div>`;
      if (status) status.textContent = 'Status unavailable';
      setVmAdminInstagramUiState({ connected: false, message: 'Unable to load Instagram tools' });
      throw err;
    }
  }

  function readVmAdminInstagramPhotoToggle(id, fallback){
    const field = document.getElementById(id);
    const value = String((field && field.value) || fallback || 'no').trim().toLowerCase();
    return value === 'yes' ? 'yes' : 'no';
  }

  function syncVmAdminInstagramPhotoOptionsUi(){
    const titleEnabled = readVmAdminInstagramPhotoToggle('vmAdminInstagramPhotoTitleMode', 'no') === 'yes';
    const hashtagsEnabled = readVmAdminInstagramPhotoToggle('vmAdminInstagramPhotoHashtagsMode', 'no') === 'yes';
    const titleWrap = document.getElementById('vmAdminInstagramEntityTitleWrap');
    const hashtagsWrap = document.getElementById('vmAdminInstagramHashtagsWrap');
    if (titleWrap) titleWrap.style.display = titleEnabled ? 'block' : 'none';
    if (hashtagsWrap) hashtagsWrap.style.display = hashtagsEnabled ? 'block' : 'none';
  }

  function buildVmAdminInstagramPhotoMessage(){
    const titleMode = readVmAdminInstagramPhotoToggle('vmAdminInstagramPhotoTitleMode', 'no');
    const hashtagsMode = readVmAdminInstagramPhotoToggle('vmAdminInstagramPhotoHashtagsMode', 'no');
    const title = String((document.getElementById('vmAdminInstagramEntityLabel') || {}).value || '').trim();
    const caption = String((document.getElementById('vmAdminInstagramCaption') || {}).value || '').trim();
    const hashtags = String((document.getElementById('vmAdminInstagramHashtags') || {}).value || '').trim();
    return [
      titleMode === 'yes' ? title : '',
      caption,
      hashtagsMode === 'yes' ? hashtags : ''
    ].filter(Boolean).join('\n\n').trim();
  }

  function buildVmAdminInstagramComposerPayload(){
    const previewShell = document.getElementById('vmAdminInstagramPreview');
    const status = document.getElementById('vmAdminInstagramComposerStatus');
    const selectedPickerItem = vmAdminFacebookPickerState.selected && typeof vmAdminFacebookPickerState.selected === 'object'
      ? vmAdminFacebookPickerState.selected
      : null;
    const selectedPhotos = buildVmAdminFacebookSelectedPhotosPayload();
    const payload = {
      section: String((document.getElementById('vmAdminInstagramSection') || {}).value || '').trim(),
      entity_type: 'photo_post',
      entity_id: String((document.getElementById('vmAdminInstagramEntityIdHidden') || {}).value || '').trim(),
      entity_label: String((document.getElementById('vmAdminInstagramEntityLabel') || {}).value || '').trim(),
      caption: buildVmAdminInstagramPhotoMessage(),
      link_url: '',
      image_url: String((document.getElementById('vmAdminInstagramImageUrl') || {}).value || '').trim(),
      selected_photos: selectedPhotos
    };
    if (!payload.entity_id && selectedPickerItem && selectedPickerItem.entityId) {
      payload.entity_id = String(selectedPickerItem.entityId || '').trim();
    }
    if (!payload.entity_label && selectedPickerItem && selectedPickerItem.title) {
      payload.entity_label = String(selectedPickerItem.title || '').trim();
    }
    if (!payload.image_url && selectedPickerItem && selectedPickerItem.imageUrl) {
      payload.image_url = String(selectedPickerItem.imageFullUrl || selectedPickerItem.imageUrl || '').trim();
    }
    if (!payload.image_url && selectedPhotos.length) {
      payload.image_url = String(selectedPhotos[0].image_url || '').trim();
    }
    payload.entity_label = buildVmAdminFacebookEntityLabel(payload);
    payload.entity_id = payload.entity_id || buildVmAdminFacebookEntityId(payload);
    if (!payload.image_url && !selectedPhotos.length) {
      const message = 'Select at least one archive photo before previewing Instagram.';
      if (previewShell) {
        previewShell.innerHTML = `<div style="color:rgba(255,168,168,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55;">${escapeVmAdminHtml(message)}</div>`;
      }
      if (status) status.textContent = 'Photo required';
      setVmAdminInstagramUiState({ connected: true, message });
      throw new Error(message);
    }
    if (!payload.caption) {
      const message = 'Add an Instagram caption before previewing.';
      if (previewShell) {
        previewShell.innerHTML = `<div style="color:rgba(255,168,168,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55;">${escapeVmAdminHtml(message)}</div>`;
      }
      if (status) status.textContent = 'Caption required';
      setVmAdminInstagramUiState({ connected: true, message });
      throw new Error(message);
    }
    return compactVmAdminFacebookPayload(payload);
  }

  function renderVmAdminInstagramSelectedArchivePreview(payload, selected){
    const chosen = selected && typeof selected === 'object' ? selected : null;
    const selectedPhotos = getVmAdminFacebookSelectedPhotoItems();
    const showPhotoGrid = selectedPhotos.length > 1;
    const caption = String(payload && payload.caption || '').trim();
    const title = String(
      payload && payload.entity_label ||
      (showPhotoGrid ? `${selectedPhotos.length} Photos Selected` : '') ||
      (chosen && chosen.title) ||
      'Archive Selection'
    ).trim();
    const meta = chosen ? [chosen.subtitle, chosen.meta].filter(Boolean).join(' • ') : '';
    return `
      <div style="display:grid; grid-template-columns:minmax(0,180px) minmax(0,1fr); gap:14px;">
        <div>
          <div style="border:1px solid rgba(255,255,255,.08); border-radius:16px; overflow:hidden; background:rgba(6,9,14,.82); min-height:140px;">
            ${showPhotoGrid ? `
              <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:2px; min-height:140px;">
                ${selectedPhotos.slice(0, 4).map((item) => `
                  <div style="background:rgba(8,10,16,.82); min-height:69px;">
                    ${item.imageUrl ? `<img src="${escapeVmAdminHtml(item.imageUrl)}" alt="${escapeVmAdminHtml(item.title || 'Selected photo')}" style="display:block; width:100%; height:100%; min-height:69px; object-fit:cover;" />` : ''}
                  </div>
                `).join('')}
              </div>
            ` : (payload.image_url ? `<img src="${escapeVmAdminHtml(payload.image_url)}" alt="${escapeVmAdminHtml(title)}" style="display:block; width:100%; height:100%; min-height:140px; object-fit:cover;" />` : `<div style="padding:24px; color:rgba(214,198,210,.66); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; text-transform:uppercase;">No image</div>`)}
          </div>
        </div>
        <div>
          <div style="color:rgba(166,235,210,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;">Instagram Archive Item</div>
          <div style="margin-top:6px; color:rgba(245,236,242,.96); font-family:'Orbitron',system-ui,sans-serif; font-size:14px; font-weight:900;">${escapeVmAdminHtml(title)}</div>
          ${meta ? `<div style="margin-top:6px; color:rgba(208,222,232,.72); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.5;">${escapeVmAdminHtml(meta)}</div>` : ''}
          <div style="margin-top:10px; color:rgba(214,198,210,.8); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.65; white-space:pre-wrap; overflow-wrap:anywhere; word-break:break-word;">${escapeVmAdminHtml(caption || 'No caption yet.')}</div>
        </div>
      </div>
    `;
  }

  function renderVmAdminInstagramHistoryItems(items){
    const rows = Array.isArray(items) ? items : [];
    if (!rows.length) {
      return `<div style="color:rgba(214,198,210,.68); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55;">No Instagram publish history yet.</div>`;
    }
    return rows.map((item) => {
      const when = formatVmAdminDate(item && item.created_at);
      const label = String(item && item.entity_label || 'Instagram Post').trim() || 'Instagram Post';
      const statusLabel = String(item && item.status || 'unknown').trim().toUpperCase();
      const details = [
        item && item.media_type ? String(item.media_type).trim() : '',
        item && item.selected_photo_count ? `${formatVmAdminNumber(item.selected_photo_count)} photo${Number(item.selected_photo_count) === 1 ? '' : 's'}` : '',
        item && item.instagram_account_name ? `@${String(item.instagram_account_name).trim()}` : ''
      ].filter(Boolean).join(' • ');
      const error = String(item && item.error || '').trim();
      return `
        <div style="border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:12px 14px; background:linear-gradient(180deg,rgba(10,14,20,.9),rgba(8,10,16,.84));">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
            <div style="color:rgba(245,236,242,.94); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase;">${escapeVmAdminHtml(label)}</div>
            <div style="padding:6px 10px; border-radius:999px; border:1px solid ${statusLabel === 'PUBLISHED' ? 'rgba(97,224,255,.24)' : 'rgba(255,95,135,.26)'}; color:${statusLabel === 'PUBLISHED' ? 'rgba(210,242,255,.92)' : 'rgba(247,237,242,.92)'}; font-family:'Orbitron',system-ui,sans-serif; font-size:9px; font-weight:800; letter-spacing:.08em; text-transform:uppercase;">${escapeVmAdminHtml(statusLabel)}</div>
          </div>
          <div style="margin-top:8px; color:rgba(208,222,232,.74); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.55;">${escapeVmAdminHtml(when)}</div>
          ${details ? `<div style="margin-top:6px; color:rgba(166,235,210,.76); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.5;">${escapeVmAdminHtml(details)}</div>` : ''}
          ${error ? `<div style="margin-top:8px; color:rgba(255,168,168,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.55;">${escapeVmAdminHtml(error)}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  async function loadVmAdminInstagramHistory(opts){
    const options = opts || {};
    const shell = document.getElementById('vmAdminInstagramHistory');
    if (!shell) return null;
    if (!getVmAdminTokenValue()) {
      if (!options.silent) {
        shell.innerHTML = `<div style="color:rgba(214,198,210,.68); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55;">Unlock Admin to load Instagram publish history.</div>`;
      }
      return null;
    }
    if (!options.silent) {
      shell.innerHTML = `<div style="color:rgba(214,198,210,.68); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55;">Loading Instagram publish history...</div>`;
    }
    try {
      const data = await fetchVmAdminJsonWithExplicitToken('/admin/instagram/history', { limit: 10 });
      const items = Array.isArray(data && data.items) ? data.items : [];
      shell.innerHTML = renderVmAdminInstagramHistoryItems(items);
      return items;
    } catch (err) {
      if (isVmAdminInvalidTokenError(err)) {
        handleVmAdminInvalidToken('Admin session expired. Unlock again for Instagram tools.', { reopenModal: false });
      }
      shell.innerHTML = `<div style="color:rgba(255,168,168,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55;">Unable to load Instagram history right now.</div>`;
      throw err;
    }
  }

  async function runVmAdminInstagramPreview(){
    const status = document.getElementById('vmAdminInstagramComposerStatus');
    const previewShell = document.getElementById('vmAdminInstagramPreview');
    const selectedPickerItem = vmAdminFacebookPickerState.selected;
    const cleanPayload = buildVmAdminInstagramComposerPayload();
    setVmAdminInstagramUiState({ connected: true, busy: true, message: 'Building Instagram preview...' });
    if (status) status.textContent = 'Building preview...';
    if (previewShell && selectedPickerItem) {
      previewShell.innerHTML = renderVmAdminInstagramSelectedArchivePreview(cleanPayload, selectedPickerItem);
    }
    try {
      const data = await postVmAdminJsonWithExplicitToken('/admin/instagram/preview', cleanPayload);
      const preview = data && data.preview ? data.preview : {};
      if (previewShell) {
        previewShell.innerHTML = `
          <div style="display:grid; grid-template-columns:minmax(0,180px) minmax(0,1fr); gap:14px;">
            <div>
              <div style="border:1px solid rgba(255,255,255,.08); border-radius:16px; overflow:hidden; background:rgba(6,9,14,.82); min-height:140px;">
                ${preview.image_url ? `<img src="${escapeVmAdminHtml(preview.image_url)}" alt="" style="display:block; width:100%; height:100%; min-height:140px; object-fit:cover;" />` : `<div style="padding:24px; color:rgba(214,198,210,.66); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; text-transform:uppercase;">No image</div>`}
              </div>
            </div>
            <div>
              <div style="color:rgba(166,235,210,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;">Target Instagram</div>
              <div style="margin-top:6px; color:rgba(245,236,242,.96); font-family:'Orbitron',system-ui,sans-serif; font-size:14px; font-weight:900;">${escapeVmAdminHtml(preview.account_name || 'Instagram Account')}</div>
              <div style="margin-top:8px; color:rgba(208,222,232,.72); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.55;">${escapeVmAdminHtml(preview.post_kind === 'carousel' ? 'Photo Post mode: Carousel' : 'Photo Post mode: Single Image')}</div>
              <div style="margin-top:10px; color:rgba(214,198,210,.8); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.65; white-space:pre-wrap; overflow-wrap:anywhere; word-break:break-word;">${escapeVmAdminHtml(preview.final_message || '')}</div>
            </div>
          </div>
        `;
      }
      if (status) status.textContent = 'Preview ready';
      setVmAdminInstagramUiState({ connected: true, message: 'Instagram preview ready' });
      return cleanPayload;
    } catch (err) {
      if (isVmAdminInvalidTokenError(err)) {
        handleVmAdminInvalidToken('Admin session expired. Unlock again for Instagram tools.', { reopenModal: false });
      }
      if (previewShell) previewShell.innerHTML = `<div style="color:rgba(255,168,168,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55;">Unable to build Instagram preview right now.</div>`;
      if (status) status.textContent = isVmAdminInvalidTokenError(err) ? 'Admin session expired' : 'Preview failed';
      setVmAdminInstagramUiState({
        connected: !isVmAdminInvalidTokenError(err),
        message: messageFromVmAdminError(err, 'Instagram preview failed')
      });
      throw err;
    }
  }

  async function runVmAdminInstagramPublish(){
    const status = document.getElementById('vmAdminInstagramComposerStatus');
    try {
      setVmAdminInstagramUiState({ connected: true, busy: true, message: 'Publishing to Instagram...' });
      if (status) status.textContent = 'Publishing to Instagram...';
      const payload = await runVmAdminInstagramPreview();
      await postVmAdminJsonWithExplicitToken('/admin/instagram/publish', payload || {});
      if (status) status.textContent = 'Instagram post published';
      setVmAdminInstagramUiState({ connected: true, message: 'Instagram post published' });
      await loadVmAdminInstagramStatus({ silent: true });
      await loadVmAdminInstagramHistory({ silent: false });
      return payload;
    } catch (err) {
      if (isVmAdminInvalidTokenError(err)) {
        handleVmAdminInvalidToken('Admin session expired. Unlock again for Instagram tools.', { reopenModal: false });
      }
      if (status) status.textContent = isVmAdminInvalidTokenError(err) ? 'Admin session expired' : 'Instagram publish failed';
      setVmAdminInstagramUiState({
        connected: !isVmAdminInvalidTokenError(err),
        message: messageFromVmAdminError(err, 'Instagram publish failed')
      });
      throw err;
    }
  }

  window.__vmAdminRefreshInstagram = function __vmAdminRefreshInstagram(){
    const disconnectBtn = document.getElementById('vmAdminInstagramDisconnect');
    setVmAdminInstagramUiState({
      connected: !!(disconnectBtn && !disconnectBtn.disabled),
      busy: true,
      message: 'Refreshing status...'
    });
    return loadVmAdminInstagramStatus();
  };

  window.__vmAdminRefreshFacebook = function __vmAdminRefreshFacebook(){
    const disconnectBtn = document.getElementById('vmAdminFacebookDisconnect');
    setVmAdminFacebookUiState({
      connected: !!(disconnectBtn && !disconnectBtn.disabled),
      busy: true,
      message: 'Refreshing status...'
    });
    return loadVmAdminFacebookStatus();
  };

  async function loadVmAdminFacebookHistory(opts){
    const options = opts || {};
    const shell = document.getElementById('vmAdminFacebookHistory');
    if (!shell) return null;
    if (!getVmAdminTokenValue()) {
      if (!options.silent) {
        shell.innerHTML = `<div style="color:rgba(214,198,210,.68); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55;">Unlock Admin to load Facebook publish history.</div>`;
      }
      return null;
    }
    if (!options.silent) {
      shell.innerHTML = `<div style="color:rgba(208,222,232,.76); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55;">Loading Facebook publish history...</div>`;
    }
    try {
      const data = await fetchVmAdminJsonWithExplicitToken('/admin/facebook/history', { limit: 8 });
      const items = Array.isArray(data && data.items) ? data.items : [];
      if (!items.length) {
        shell.innerHTML = `<div style="color:rgba(214,198,210,.68); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55;">No Facebook publish attempts logged yet.</div>`;
        return data;
      }
      shell.innerHTML = items.map((item) => {
        const ok = String(item && item.status || '').trim().toLowerCase() === 'success';
        const meta = item && item.meta && typeof item.meta === 'object' ? item.meta : {};
        const publishMode = String(meta.publish_mode || '').trim().toLowerCase();
        const albumName = String(meta.facebook_album_name || '').trim();
        const albumCount = Number(meta.album_upload_count);
        const modeBits = [];
        if (publishMode === 'album') {
          modeBits.push('Album Upload');
        } else if (publishMode === 'both') {
          modeBits.push('Manual Post/Upload');
        } else if (publishMode === 'share') {
          modeBits.push('Share');
        } else if (publishMode === 'post') {
          modeBits.push('Custom Post');
        }
        if (albumName) modeBits.push(albumName);
        if (Number.isFinite(albumCount) && albumCount > 0) {
          modeBits.push(`${albumCount} album photo${albumCount === 1 ? '' : 's'}`);
        }
        return `
          <div style="border:1px solid rgba(255,255,255,.06); border-radius:14px; padding:12px; background:rgba(9,10,16,.72);">
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
              <div>
                <div style="color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:900; letter-spacing:.06em; text-transform:uppercase;">${escapeVmAdminHtml(item.entity_label || item.entity_id || 'Unknown item')}</div>
                <div style="margin-top:4px; color:rgba(208,222,232,.72); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.5;">${escapeVmAdminHtml(formatVmAdminDate(item.created_at))}</div>
              </div>
              <div style="padding:6px 9px; border-radius:999px; border:1px solid ${ok ? 'rgba(97,224,255,.22)' : 'rgba(255,95,135,.28)'}; color:${ok ? 'rgba(210,242,255,.92)' : 'rgba(255,192,205,.92)'}; font-family:'Orbitron',system-ui,sans-serif; font-size:9px; font-weight:800; letter-spacing:.1em; text-transform:uppercase;">${escapeVmAdminHtml(ok ? 'Success' : (item.status || 'Failed'))}</div>
            </div>
            <div style="margin-top:8px; color:rgba(214,198,210,.72); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.55;">${escapeVmAdminHtml(item.section || 'section')} â€¢ ${escapeVmAdminHtml(item.entity_type || 'show')}</div>
            ${modeBits.length ? `<div style="margin-top:6px; color:rgba(208,222,232,.72); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.55;">${escapeVmAdminHtml(modeBits.join(' / '))}</div>` : ''}
            ${item && item.error ? `<div style="margin-top:8px; color:rgba(255,168,168,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.55;">${escapeVmAdminHtml(item.error)}</div>` : ''}
          </div>
        `;
      }).join('');
      return data;
    } catch (_) {
      if (isVmAdminInvalidTokenError(_)) {
        handleVmAdminInvalidToken('Admin session expired. Unlock again for Facebook tools.', { reopenModal: false });
      }
      shell.innerHTML = `<div style="color:rgba(255,168,168,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55;">Unable to load Facebook publish history right now.</div>`;
      return null;
    }
  }

  async function runVmAdminFacebookPreview(){
    const status = document.getElementById('vmAdminFacebookComposerStatus');
    const previewShell = document.getElementById('vmAdminFacebookPreview');
    const selectedPickerItem = vmAdminFacebookPickerState.selected;
    const cleanPayload = buildVmAdminFacebookComposerPayload();
    const entityType = String(cleanPayload.entity_type || '').trim().toLowerCase();
    setVmAdminFacebookUiState({ connected: true, busy: true, message: 'Building preview...' });
    if (status) status.textContent = 'Building preview...';
    if (entityType === 'normal_post') {
      if (previewShell) previewShell.innerHTML = renderVmAdminFacebookNormalPostPreview(cleanPayload);
      if (status) status.textContent = 'Preview ready';
      setVmAdminFacebookUiState({ connected: true, message: 'Preview ready' });
      return cleanPayload;
    }
    if (previewShell && selectedPickerItem) {
      previewShell.innerHTML = renderVmAdminFacebookSelectedArchivePreview(cleanPayload, selectedPickerItem);
    }
    try {
      const data = await postVmAdminJsonWithExplicitToken('/admin/facebook/preview', cleanPayload);
      const preview = data && data.preview ? data.preview : {};
      if (previewShell) {
        previewShell.innerHTML = `
          <div style="display:grid; grid-template-columns:minmax(0,180px) minmax(0,1fr); gap:14px;">
            <div>
              <div style="border:1px solid rgba(255,255,255,.08); border-radius:16px; overflow:hidden; background:rgba(6,9,14,.82); min-height:140px;">
                ${preview.image_url ? `<img src="${escapeVmAdminHtml(preview.image_url)}" alt="" style="display:block; width:100%; height:100%; min-height:140px; object-fit:cover;" />` : `<div style="padding:24px; color:rgba(214,198,210,.66); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; text-transform:uppercase;">No image</div>`}
              </div>
            </div>
            <div>
              <div style="color:rgba(166,235,210,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;">Target Page</div>
              <div style="margin-top:6px; color:rgba(245,236,242,.96); font-family:'Orbitron',system-ui,sans-serif; font-size:14px; font-weight:900;">${escapeVmAdminHtml(preview.page_name || 'Voodoo Media')}</div>
              <div style="margin-top:8px; color:rgba(208,222,232,.72); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.55;">
                ${escapeVmAdminHtml(preview.publish_mode === 'both'
                  ? `Publish mode: Manual Post/Upload${preview.facebook_album_name ? ` / Album: ${preview.facebook_album_name}` : ''} / Album caption + one custom wall post`
                  : (preview.publish_mode === 'share'
                    ? 'Publish mode: Share'
                    : (preview.publish_mode === 'album'
                    ? `Publish mode: Album Upload${preview.facebook_album_name ? ` / Album: ${preview.facebook_album_name}` : ''} / Album caption / No custom wall post`
                    : 'Publish mode: Custom Multi-Photo Post')))}
              </div>
        <div style="margin-top:10px; color:rgba(214,198,210,.8); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.65; white-space:pre-wrap; overflow-wrap:anywhere; word-break:break-word;">${escapeVmAdminHtml(preview.final_message || '')}</div>
            </div>
          </div>
        `;
      }
      if (status) status.textContent = 'Preview ready';
      setVmAdminFacebookUiState({ connected: true, message: 'Preview ready' });
      return cleanPayload;
    } catch (err) {
      if (isVmAdminInvalidTokenError(err)) {
        handleVmAdminInvalidToken('Admin session expired. Unlock again for Facebook tools.', { reopenModal: false });
      }
      if (previewShell) previewShell.innerHTML = `<div style="color:rgba(255,168,168,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55;">Unable to build preview right now.</div>`;
      if (status) {
        status.textContent = isVmAdminInvalidTokenError(err)
          ? 'Admin session expired'
          : 'Preview failed';
      }
      setVmAdminFacebookUiState({
        connected: !isVmAdminInvalidTokenError(err),
        message: messageFromVmAdminError(err, 'Preview failed')
      });
      throw err;
    }
  }

  async function runVmAdminFacebookPublish(){
    const status = document.getElementById('vmAdminFacebookComposerStatus');
    try {
      const publishMode = readVmAdminFacebookPublishMode();
      if (publishMode === 'share') {
        const payload = buildVmAdminFacebookComposerPayload();
        const result = await runVmAdminNativeShare(payload || {});
        if (result && result.pending) {
          if (status) status.textContent = String(result.message || 'Preparing share files...');
          setVmAdminFacebookUiState({ connected: true, message: String(result.message || 'Preparing share files...') });
          return payload;
        }
        if (status) status.textContent = 'Share sheet opened';
        setVmAdminFacebookUiState({ connected: true, message: 'Share sheet opened' });
        return payload;
      }
      setVmAdminFacebookUiState({ connected: true, busy: true, message: 'Publishing post...' });
      if (status) status.textContent = 'Publishing post...';
      const payload = await runVmAdminFacebookPreview();
      await postVmAdminJsonWithExplicitToken('/admin/facebook/publish', payload || {});
      const resolvedPublishMode = String(payload && payload.publish_mode || 'post').trim().toLowerCase();
      const successMessage = resolvedPublishMode === 'album'
        ? 'Photos uploaded to album only'
        : (resolvedPublishMode === 'both'
          ? 'One wall post published and album uploaded'
          : (resolvedPublishMode === 'share'
            ? 'Share published'
            : 'Post published'));
      if (status) status.textContent = successMessage;
      setVmAdminFacebookUiState({ connected: true, message: successMessage });
      await loadVmAdminFacebookStatus({ silent: true });
      await loadVmAdminFacebookHistory({ silent: false });
    } catch (_) {
      if (isVmAdminInvalidTokenError(_)) {
        handleVmAdminInvalidToken('Admin session expired. Unlock again for Facebook tools.', { reopenModal: false });
      }
      const entityType = readVmAdminFacebookEntityType();
      const rawMessage = messageFromVmAdminError(_, 'Publish failed');
      const normalPostNeedsBackendRule = entityType === 'normal_post'
        && /image_url must be a valid http\(s\) url/i.test(String(rawMessage || ''));
      const finalMessage = normalPostNeedsBackendRule
        ? 'Normal Post publish is waiting on the backend caption-only rule.'
        : rawMessage;
      if (status) {
        status.textContent = isVmAdminInvalidTokenError(_)
          ? 'Admin session expired'
          : (normalPostNeedsBackendRule
            ? 'Normal Post needs backend update'
            : 'Publish failed');
      }
      setVmAdminFacebookUiState({
        connected: !isVmAdminInvalidTokenError(_),
        message: finalMessage
      });
      throw _;
    }
  }

  async function startVmAdminFacebookConnect(){
    const facebookStatusEl = document.getElementById('vmAdminFacebookStatus');
    const facebookComposerStatus = document.getElementById('vmAdminFacebookComposerStatus');
    const facebookConnectBtn = document.getElementById('vmAdminFacebookConnect');
    setVmAdminFacebookUiState({ connected: false, busy: true, message: 'Opening Facebook login...' });
    if (facebookConnectBtn) facebookConnectBtn.disabled = true;
    if (facebookStatusEl) facebookStatusEl.textContent = 'Opening Facebook login...';
    if (facebookComposerStatus) facebookComposerStatus.textContent = 'Opening Facebook login...';
    try {
      const returnTo = `${window.location.origin}/admin`;
      const data = await postVmAdminJsonWithExplicitToken('/admin/facebook/connect/start', { return_to: returnTo });
      const authorizeUrl = String(data && data.authorize_url || '').trim();
      if (!authorizeUrl) throw new Error('facebook authorize url missing');
      window.location.href = authorizeUrl;
    } catch (err) {
      if (isVmAdminInvalidTokenError(err)) {
        handleVmAdminInvalidToken('Admin session expired. Unlock again for Facebook tools.');
      }
      const msg = messageFromVmAdminError(err, 'Facebook authorization could not start');
      if (facebookStatusEl) facebookStatusEl.textContent = msg;
      if (facebookComposerStatus) facebookComposerStatus.textContent = msg;
      setVmAdminFacebookUiState({ connected: false, message: msg });
      if (facebookConnectBtn) facebookConnectBtn.disabled = false;
      throw err;
    }
  }

  async function disconnectVmAdminFacebook(){
    const facebookStatusEl = document.getElementById('vmAdminFacebookStatus');
    const facebookComposerStatus = document.getElementById('vmAdminFacebookComposerStatus');
    const facebookDisconnectBtn = document.getElementById('vmAdminFacebookDisconnect');
    setVmAdminFacebookUiState({ connected: true, busy: true, message: 'Disconnecting page...' });
    if (facebookDisconnectBtn) facebookDisconnectBtn.disabled = true;
    if (facebookStatusEl) facebookStatusEl.textContent = 'Disconnecting page...';
    if (facebookComposerStatus) facebookComposerStatus.textContent = 'Disconnecting page...';
    try {
      await postVmAdminJsonWithExplicitToken('/admin/facebook/disconnect', {});
      await loadVmAdminFacebookStatus({ silent: false });
      await loadVmAdminFacebookHistory({ silent: false });
      clearVmAdminFacebookPickerSelection();
      setVmAdminFacebookUiState({ connected: false, message: 'Page disconnected', clearPreview: true });
    } catch (err) {
      if (isVmAdminInvalidTokenError(err)) {
        handleVmAdminInvalidToken('Admin session expired. Unlock again for Facebook tools.');
      }
      const msg = messageFromVmAdminError(err, 'Facebook disconnect failed');
      if (facebookStatusEl) facebookStatusEl.textContent = msg;
      if (facebookComposerStatus) facebookComposerStatus.textContent = msg;
      setVmAdminFacebookUiState({ connected: true, message: msg });
      throw err;
    }
  }

  window.__vmAdminFacebookConnect = function __vmAdminFacebookConnect(){
    return startVmAdminFacebookConnect();
  };
  window.__vmAdminFacebookDisconnect = function __vmAdminFacebookDisconnect(){
    return disconnectVmAdminFacebook();
  };
  window.__vmAdminFacebookPreviewDraft = function __vmAdminFacebookPreviewDraft(){
    return runVmAdminFacebookPreview();
  };
  window.__vmAdminFacebookPublishNow = function __vmAdminFacebookPublishNow(){
    return runVmAdminFacebookPublish();
  };
  window.__vmAdminFacebookPickerOpenShow = function __vmAdminFacebookPickerOpenShow(itemId){
    return openVmAdminFacebookPickerShow(itemId);
  };
  window.__vmAdminFacebookPickerBackToShows = function __vmAdminFacebookPickerBackToShows(){
    return closeVmAdminFacebookPickerShow();
  };
  window.__vmAdminFacebookPickerOpenMatch = function __vmAdminFacebookPickerOpenMatch(itemId){
    return openVmAdminFacebookPickerMatch(itemId);
  };
  window.__vmAdminFacebookPickerBackToMatches = function __vmAdminFacebookPickerBackToMatches(){
    return closeVmAdminFacebookPickerMatch();
  };
  window.__vmAdminFacebookPickerSelectPhoto = function __vmAdminFacebookPickerSelectPhoto(itemId){
    return toggleVmAdminFacebookPhotoSelection(itemId);
  };
  window.__vmAdminFacebookMentionRefresh = function __vmAdminFacebookMentionRefresh(event){
    return handleVmAdminFacebookMentionRefresh(event);
  };
  window.__vmAdminSyncFacebookEntityTypeUi = function __vmAdminSyncFacebookEntityTypeUi(){
    return syncVmAdminFacebookEntityTypeUi();
  };
  window.__vmAdminSyncFacebookAlbumUi = function __vmAdminSyncFacebookAlbumUi(){
    renderVmAdminFacebookAlbumUi();
    const mode = readVmAdminFacebookPublishMode();
    if ((mode === 'album' || mode === 'both') && !vmAdminFacebookAlbumState.loaded && !vmAdminFacebookAlbumState.loading) {
      return loadVmAdminFacebookAlbums().catch(() => null);
    }
    return null;
  };
  window.__vmAdminSyncFacebookPhotoOptionsUi = function __vmAdminSyncFacebookPhotoOptionsUi(){
    return syncVmAdminFacebookPhotoOptionsUi();
  };
  window.__vmAdminRefreshFacebookAlbums = function __vmAdminRefreshFacebookAlbums(){
    return loadVmAdminFacebookAlbums({ force: true }).catch(() => null);
  };

  async function startVmAdminInstagramConnect(){
    const statusEl = document.getElementById('vmAdminInstagramStatus');
    const connectBtn = document.getElementById('vmAdminInstagramConnect');
    setVmAdminInstagramUiState({ connected: false, busy: true, message: 'Opening Instagram login...' });
    if (connectBtn) connectBtn.disabled = true;
    if (statusEl) statusEl.textContent = 'Opening Instagram login...';
    try {
      const returnTo = `${window.location.origin}/admin`;
      const data = await postVmAdminJsonWithExplicitToken('/admin/instagram/connect/start', { return_to: returnTo });
      const authorizeUrl = String(data && data.authorize_url || '').trim();
      if (!authorizeUrl) throw new Error('instagram authorize url missing');
      window.location.href = authorizeUrl;
    } catch (err) {
      if (isVmAdminInvalidTokenError(err)) {
        handleVmAdminInvalidToken('Admin session expired. Unlock again for Instagram tools.');
      }
      const msg = messageFromVmAdminError(err, 'Instagram authorization could not start');
      if (statusEl) statusEl.textContent = msg;
      setVmAdminInstagramUiState({ connected: false, message: msg });
      if (connectBtn) connectBtn.disabled = false;
      throw err;
    }
  }

  async function disconnectVmAdminInstagram(){
    const statusEl = document.getElementById('vmAdminInstagramStatus');
    const disconnectBtn = document.getElementById('vmAdminInstagramDisconnect');
    setVmAdminInstagramUiState({ connected: true, busy: true, message: 'Disconnecting Instagram...' });
    if (disconnectBtn) disconnectBtn.disabled = true;
    if (statusEl) statusEl.textContent = 'Disconnecting Instagram...';
    try {
      await postVmAdminJsonWithExplicitToken('/admin/instagram/disconnect', {});
      await loadVmAdminInstagramStatus({ silent: false });
      setVmAdminInstagramUiState({ connected: false, message: 'Instagram disconnected' });
    } catch (err) {
      if (isVmAdminInvalidTokenError(err)) {
        handleVmAdminInvalidToken('Admin session expired. Unlock again for Instagram tools.');
      }
      const msg = messageFromVmAdminError(err, 'Instagram disconnect failed');
      if (statusEl) statusEl.textContent = msg;
      setVmAdminInstagramUiState({ connected: true, message: msg });
      throw err;
    }
  }

  window.__vmAdminInstagramConnect = function __vmAdminInstagramConnect(){
    return startVmAdminInstagramConnect();
  };
  window.__vmAdminInstagramDisconnect = function __vmAdminInstagramDisconnect(){
    return disconnectVmAdminInstagram();
  };
  window.__vmAdminInstagramPreviewDraft = function __vmAdminInstagramPreviewDraft(){
    return runVmAdminInstagramPreview();
  };
  window.__vmAdminInstagramPublishNow = function __vmAdminInstagramPublishNow(){
    return runVmAdminInstagramPublish();
  };
  window.__vmAdminSyncInstagramPhotoOptionsUi = function __vmAdminSyncInstagramPhotoOptionsUi(){
    return syncVmAdminInstagramPhotoOptionsUi();
  };

  function readVmFacebookCallbackState(){
    try {
      const params = new URLSearchParams(window.location.search || '');
      const mode = String(params.get('facebook') || '').trim().toLowerCase();
      if (!mode) return null;
      return {
        mode,
        message: String(params.get('message') || '').trim(),
        pageId: String(params.get('page_id') || '').trim(),
        pageName: String(params.get('page_name') || '').trim()
      };
    } catch (_) {
      return null;
    }
  }

  function clearVmFacebookCallbackState(){
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('facebook');
      url.searchParams.delete('message');
      url.searchParams.delete('page_id');
      url.searchParams.delete('page_name');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    } catch (_) {}
  }

  function readVmInstagramCallbackState(){
    try {
      const params = new URLSearchParams(window.location.search || '');
      const mode = String(params.get('instagram') || '').trim().toLowerCase();
      if (!mode) return null;
      return {
        mode,
        message: String(params.get('message') || '').trim(),
        pageId: String(params.get('page_id') || '').trim(),
        pageName: String(params.get('page_name') || '').trim(),
        instagramId: String(params.get('instagram_id') || '').trim(),
        instagramUsername: String(params.get('instagram_username') || '').trim()
      };
    } catch (_) {
      return null;
    }
  }

  function clearVmInstagramCallbackState(){
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('instagram');
      url.searchParams.delete('message');
      url.searchParams.delete('page_id');
      url.searchParams.delete('page_name');
      url.searchParams.delete('instagram_id');
      url.searchParams.delete('instagram_username');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    } catch (_) {}
  }

  function isVmAdminAnalyticsCleared(snapshot){
    const overview = snapshot && snapshot.overview || {};
    const totals = overview && overview.totals || {};
    const routes = Array.isArray(snapshot && snapshot.routes && snapshot.routes.items) ? snapshot.routes.items : [];
    const entities = Array.isArray(snapshot && snapshot.entities && snapshot.entities.items) ? snapshot.entities.items : [];
    const events = Array.isArray(snapshot && snapshot.events && snapshot.events.items) ? snapshot.events.items : [];

    return Number(totals.events || 0) === 0
      && Number(totals.pageviews || 0) === 0
      && Number(totals.visitors || 0) === 0
      && Number(totals.sessions || 0) === 0
      && routes.length === 0
      && entities.length === 0
      && events.length === 0;
  }

  async function fetchVmAdminAnalyticsSnapshot(range){
    const activeRange = String(range || '7d');
    const [overview, routes, entities, events] = await Promise.all([
      fetchVmAdminJson('/admin/analytics/overview', { range: activeRange }),
      fetchVmAdminJson('/admin/analytics/routes', { range: activeRange, limit: 8 }),
      fetchVmAdminJson('/admin/analytics/entities', { range: activeRange, limit: 8 }),
      fetchVmAdminJson('/admin/analytics/events', { range: activeRange, limit: 50 })
    ]);

    return { overview, routes, entities, events };
  }

  function renderVmAdminAnalyticsOverview(data){
    const totals = (data && data.totals) || {};
    const sections = Array.isArray(data && data.sections) ? data.sections : [];
    const summary = [
      { label: 'Events', value: formatVmAdminNumber(totals.events) },
      { label: 'Pageviews', value: formatVmAdminNumber(totals.pageviews) },
      { label: 'Visitors', value: formatVmAdminNumber(totals.visitors) },
      { label: 'Sessions', value: formatVmAdminNumber(totals.sessions) }
    ];
    const summaryHtml = summary.map((item) => `
      <div style="position:relative; overflow:hidden; border:1px solid rgba(255,70,110,.2); border-radius:16px; padding:16px 16px 14px; background:linear-gradient(180deg,rgba(15,10,22,.92),rgba(8,8,15,.84)); box-shadow:0 12px 28px rgba(0,0,0,.22);">
        <div style="position:absolute; inset:auto -10% 0 auto; width:84px; height:84px; border-radius:999px; background:radial-gradient(circle,rgba(70,214,255,.16),rgba(70,214,255,0)); pointer-events:none;"></div>
        <div style="color:rgba(214,198,210,.72); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:700; letter-spacing:.16em; text-transform:uppercase;">${escapeVmAdminHtml(item.label)}</div>
        <div style="margin-top:10px; color:rgba(250,241,245,.98); font-family:'Orbitron',system-ui,sans-serif; font-size:30px; font-weight:900; letter-spacing:.01em; line-height:1;">${escapeVmAdminHtml(item.value)}</div>
      </div>
    `).join('');
    const sectionsHtml = sections.length
      ? sections.slice(0, 6).map((item) => {
          const events = Number(item && item.events || 0);
          const pageviews = Number(item && item.pageviews || 0);
          const barWidth = Math.max(8, Math.min(100, events));
          return `
          <div style="padding:10px 0 12px; border-bottom:1px solid rgba(255,255,255,.06);">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
              <div style="color:rgba(245,236,242,.92); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;">${escapeVmAdminHtml(item.section || 'Unknown')}</div>
              <div style="color:rgba(208,222,232,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:10px;">${escapeVmAdminHtml(formatVmAdminNumber(events))} evt / ${escapeVmAdminHtml(formatVmAdminNumber(pageviews))} view</div>
            </div>
            <div style="margin-top:7px; height:7px; border-radius:999px; background:rgba(255,255,255,.05); overflow:hidden;">
              <div style="width:${barWidth}%; height:100%; border-radius:999px; background:linear-gradient(90deg,rgba(255,80,132,.86),rgba(89,225,255,.8));"></div>
            </div>
          </div>
        `;
        }).join('')
      : `<div style="color:rgba(214,198,210,.68); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.5;">No analytics data yet for this range.</div>`;
    return `
      <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px;">${summaryHtml}</div>
      <div style="margin-top:18px; padding:14px; border:1px solid rgba(255,255,255,.05); border-radius:16px; background:linear-gradient(180deg,rgba(8,8,16,.68),rgba(10,10,18,.42));">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
          <div style="color:rgba(255,130,164,.82); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;">Section Split</div>
          <div style="color:rgba(166,235,210,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;">Last ingest ${escapeVmAdminHtml(formatVmAdminDate(data && data.lastIngestAt))}</div>
        </div>
        <div style="margin-top:8px;">${sectionsHtml}</div>
      </div>
    `;
  }

  function renderVmAdminAnalyticsList(items, formatter, emptyCopy){
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      return `<div style="color:rgba(214,198,210,.68); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.5;">${escapeVmAdminHtml(emptyCopy)}</div>`;
    }
    return list.map((item, index) => formatter(item, index)).join('');
  }

  function renderVmAdminAnalyticsRoutes(items){
    return renderVmAdminAnalyticsList(items, (item, index) => `
      <div style="display:grid; grid-template-columns:36px minmax(0,1fr) auto; gap:12px; align-items:start; padding:11px 0; border-bottom:1px solid rgba(255,255,255,.06);">
        <div style="display:flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:999px; border:1px solid rgba(255,80,132,.2); background:rgba(255,80,132,.08); color:rgba(255,130,164,.86); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:900;">${index + 1}</div>
        <div>
          <div style="color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:12px; font-weight:800; line-height:1.35;">${escapeVmAdminHtml(item.route || 'Unknown route')}</div>
          <div style="margin-top:4px; color:rgba(120,224,252,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;">${escapeVmAdminHtml(item.section || 'unknown')}</div>
        </div>
        <div style="text-align:right;">
          <div style="color:rgba(247,237,242,.96); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:900;">${escapeVmAdminHtml(formatVmAdminNumber(item.events))}<span style="margin-left:4px; color:rgba(214,198,210,.64); font-size:9px; font-weight:700; letter-spacing:.12em; text-transform:uppercase;">evt</span></div>
          <div style="margin-top:4px; color:rgba(208,222,232,.82); font-family:'Orbitron',system-ui,sans-serif; font-size:10px;">${escapeVmAdminHtml(formatVmAdminNumber(item.pageviews))} view</div>
        </div>
      </div>
    `, 'No route data yet.');
  }

  function renderVmAdminAnalyticsEntities(items){
    return renderVmAdminAnalyticsList(items, (item, index) => `
      <div style="display:grid; grid-template-columns:36px minmax(0,1fr) auto; gap:12px; align-items:start; padding:11px 0; border-bottom:1px solid rgba(255,255,255,.06);">
        <div style="display:flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:999px; border:1px solid rgba(255,80,132,.2); background:rgba(120,224,252,.08); color:rgba(120,224,252,.88); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:900;">${index + 1}</div>
        <div>
          <div style="color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:12px; font-weight:800; line-height:1.35;">${escapeVmAdminHtml(item.entity_label || item.entity_id || 'Unknown entity')}</div>
          <div style="margin-top:4px; color:rgba(214,198,210,.66); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; letter-spacing:.08em; text-transform:uppercase;">${escapeVmAdminHtml(item.entity_type || 'entity')}</div>
        </div>
        <div style="text-align:right; color:rgba(247,237,242,.96); font-family:'Orbitron',system-ui,sans-serif; font-size:13px; font-weight:900;">${escapeVmAdminHtml(formatVmAdminNumber(item.events))}</div>
      </div>
    `, 'No entity activity yet.');
  }

  function renderVmAdminAnalyticsEvents(items){
    return renderVmAdminAnalyticsList(items, (item) => `
      <div style="padding:11px 0 12px; border-bottom:1px solid rgba(255,255,255,.06);">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
          <div style="color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:900; letter-spacing:.08em; text-transform:uppercase;">${escapeVmAdminHtml(item.event_name || 'event')}</div>
          <div style="color:rgba(208,222,232,.66); font-family:'Orbitron',system-ui,sans-serif; font-size:10px;">${escapeVmAdminHtml(formatVmAdminDate(item.occurred_at || item.received_at))}</div>
        </div>
        <div style="margin-top:6px; color:rgba(214,198,210,.74); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.5;">${escapeVmAdminHtml(item.route || item.section || 'Unknown route')}</div>
        <div style="margin-top:4px; color:rgba(166,235,210,.76); font-family:'Orbitron',system-ui,sans-serif; font-size:9px; font-weight:700; letter-spacing:.1em; text-transform:uppercase;">${escapeVmAdminHtml(item.section || 'unknown')}${item.source ? ` / ${escapeVmAdminHtml(item.source)}` : ''}</div>
      </div>
    `, 'No recent events yet.');
  }

  function getVmAdminAnalyticsNodes(){
    return {
      statusEl: document.getElementById('vmAdminStatusLine'),
      analyticsStatusEl: document.getElementById('vmAdminAnalyticsStatus'),
      metaEl: document.getElementById('vmAdminPeopleMeta'),
      rebuildBtn: document.querySelector('[data-admin-rebuild="people"]'),
      analyticsRange: document.getElementById('vmAdminAnalyticsRange'),
      analyticsRefresh: document.getElementById('vmAdminAnalyticsRefresh'),
      overviewEl: document.getElementById('vmAdminAnalyticsOverview'),
      routesEl: document.getElementById('vmAdminAnalyticsRoutes'),
      entitiesEl: document.getElementById('vmAdminAnalyticsEntities'),
      eventsEl: document.getElementById('vmAdminAnalyticsEvents')
    };
  }

  function setVmAdminAnalyticsSectionState(section, collapsed){
    if (!section) return false;
    const button = section.querySelector('[data-analytics-toggle]');
    const body = section.querySelector('[data-analytics-body]');
    const icon = section.querySelector('[data-analytics-chevron]');
    if (!button || !body) return false;

    section.setAttribute('data-collapsed', collapsed ? 'true' : 'false');
    button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    body.style.display = collapsed ? 'none' : '';
    if (icon) icon.textContent = collapsed ? '+' : '-';
    return true;
  }

  function toggleVmAdminAnalyticsSection(sectionName){
    const name = String(sectionName || '').trim();
    if (!name) return false;
    const section = document.querySelector(`[data-analytics-section="${name}"]`);
    if (!section) return false;

    const collapsed = section.getAttribute('data-collapsed') === 'true';
    const nextCollapsed = !collapsed;
    setVmAdminAnalyticsSectionState(section, nextCollapsed);

    if (!nextCollapsed) {
      const nodes = getVmAdminAnalyticsNodes();
      const activeRange = String((nodes.analyticsRange && nodes.analyticsRange.value) || '7d');
      loadVmAdminAnalytics(activeRange, { silent: false });
    }
    return true;
  }

  function setVmAdminCollapsibleSectionState(section, collapsed){
    const root = section && typeof section === 'object' ? section : null;
    if (!root) return false;
    const button = root.querySelector('[data-admin-collapsible-header]');
    const body = root.querySelector('[data-admin-collapsible-body]');
    const icon = root.querySelector('[data-admin-collapsible-chevron]');
    if (!button || !body) return false;
    root.setAttribute('data-collapsed', collapsed ? 'true' : 'false');
    button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    body.style.display = collapsed ? 'none' : '';
    if (icon) icon.textContent = collapsed ? '+' : '-';
    return true;
  }

  function toggleVmAdminCollapsibleSection(sectionName){
    const name = String(sectionName || '').trim();
    if (!name) return false;
    const section = document.querySelector(`[data-admin-collapsible-section="${name}"]`);
    if (!section) return false;
    const collapsed = section.getAttribute('data-collapsed') === 'true';
    setVmAdminCollapsibleSectionState(section, !collapsed);
    return true;
  }

  function initVmAdminCollapsibles(root){
    const shell = root && typeof root.querySelectorAll === 'function' ? root : document;
    const sections = Array.prototype.slice.call(shell.querySelectorAll('[data-admin-collapsible-section]'));
    sections.forEach((section) => {
      const collapsed = section.getAttribute('data-collapsed') !== 'false';
      setVmAdminCollapsibleSectionState(section, collapsed);
    });
    try {
      window.__vmAdminToggleCollapsibleSection = toggleVmAdminCollapsibleSection;
    } catch (_) {}
    if (shell.__vmAdminCollapsibleDelegatedBound) return;
    shell.addEventListener('click', (event) => {
      const target = event.target;
      const button = target && target.closest ? target.closest('[data-admin-collapsible-header]') : null;
      if (!button) return;
      const section = button.closest('[data-admin-collapsible-section]');
      if (!section) return;
      event.preventDefault();
      toggleVmAdminCollapsibleSection(section.getAttribute('data-admin-collapsible-section'));
    }, { once: false });
    shell.__vmAdminCollapsibleDelegatedBound = true;
  }

  function triggerVmAdminAnalyticsRefresh(){
    const nodes = getVmAdminAnalyticsNodes();
    const activeRange = String((nodes.analyticsRange && nodes.analyticsRange.value) || '7d');
    loadVmAdminAnalytics(activeRange);
    return true;
  }

  async function triggerVmAdminAnalyticsReset(){
    const nodes = getVmAdminAnalyticsNodes();
    const analyticsRange = nodes.analyticsRange;
    const analyticsReset = document.getElementById('vmAdminAnalyticsReset');
    const analyticsStatusEl = nodes.analyticsStatusEl;

    const confirmed = window.confirm('Reset analytics data now? This will clear the stored analytics feed and reset this browser analytics session.');
    if (!confirmed) return false;

    if (analyticsReset) analyticsReset.disabled = true;
    if (analyticsStatusEl) analyticsStatusEl.textContent = 'Resetting analytics data...';

    try {
      const res = await __vmAdminFetch('/admin/analytics/reset', {
        method: 'POST',
        headers: {
          Accept: 'application/json'
        }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data || !data.ok) {
        throw new Error((data && data.error) || 'reset failed');
      }
      try {
        if (window.VMPixAnalytics && typeof window.VMPixAnalytics.clearClientState === 'function') {
          window.VMPixAnalytics.clearClientState();
        } else if (window.VMPixAnalytics && typeof window.VMPixAnalytics.clearBufferedEvents === 'function') {
          window.VMPixAnalytics.clearBufferedEvents();
        }
      } catch (_) {}
      const selectedRange = analyticsRange ? analyticsRange.value : '7d';
      renderVmAdminAnalyticsZeroState(selectedRange);
      let resetVerified = false;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const snapshot = await fetchVmAdminAnalyticsSnapshot(selectedRange);
        if (isVmAdminAnalyticsCleared(snapshot)) {
          resetVerified = true;
          break;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 350));
      }
      if (analyticsStatusEl) {
        const beforeCount = Number(data && data.beforeCount || 0);
        const clearedSummary = data && typeof data.cleared === 'object' && data.cleared
          ? [
              `events ${formatVmAdminNumber(data.cleared.events)}`,
              `pageviews ${formatVmAdminNumber(data.cleared.pageviews)}`,
              `visitors ${formatVmAdminNumber(data.cleared.visitors)}`,
              `sessions ${formatVmAdminNumber(data.cleared.sessions)}`
            ].join(' | ')
          : '';
        analyticsStatusEl.textContent = resetVerified
          ? (clearedSummary
              ? `Analytics reset complete (${clearedSummary})`
              : `Analytics reset complete (${beforeCount} cleared)`)
          : 'Analytics reset returned, but backend data still appears present';
      }
      return true;
    } catch (err) {
      if (analyticsStatusEl) analyticsStatusEl.textContent = (err && err.message) ? `Analytics reset failed: ${err.message}` : 'Analytics reset failed';
      return false;
    } finally {
      if (analyticsReset) analyticsReset.disabled = false;
    }
  }

  function initVmAdminAnalyticsCollapsibles(rootEl){
    const root = rootEl || document;
    const sections = Array.prototype.slice.call(root.querySelectorAll('[data-analytics-section]'));
    sections.forEach((section) => {
      const collapsed = section.getAttribute('data-collapsed') !== 'false';
      setVmAdminAnalyticsSectionState(section, collapsed);
    });

    try {
      window.__vmAdminToggleAnalyticsSection = toggleVmAdminAnalyticsSection;
      window.__vmAdminRefreshAnalytics = triggerVmAdminAnalyticsRefresh;
      window.__vmAdminResetAnalytics = triggerVmAdminAnalyticsReset;
    } catch (_) {}

    if (root.__vmAnalyticsCollapseDelegatedBound) return;
    root.addEventListener('click', (event) => {
      const button = event.target && typeof event.target.closest === 'function'
        ? event.target.closest('[data-analytics-toggle]')
        : null;
      if (!button || !root.contains(button)) return;

      const section = button.closest('[data-analytics-section]');
      if (!section) return;

      event.preventDefault();
      toggleVmAdminAnalyticsSection(section.getAttribute('data-analytics-section'));
    }, { once: false });
    root.__vmAnalyticsCollapseDelegatedBound = true;
  }

  function renderVmAdminAnalyticsZeroState(range){
    const nodes = getVmAdminAnalyticsNodes();
    const activeRange = String(range || '7d');
    if (!nodes.overviewEl || !nodes.routesEl || !nodes.entitiesEl || !nodes.eventsEl) return false;

    nodes.overviewEl.innerHTML = renderVmAdminAnalyticsOverview({
      totals: {
        events: 0,
        pageviews: 0,
        visitors: 0,
        sessions: 0
      },
      sections: [],
      lastIngestAt: null
    });
    nodes.routesEl.innerHTML = renderVmAdminAnalyticsRoutes([]);
    nodes.entitiesEl.innerHTML = renderVmAdminAnalyticsEntities([]);
    nodes.eventsEl.innerHTML = renderVmAdminAnalyticsEvents([]);
    if (nodes.analyticsStatusEl) nodes.analyticsStatusEl.textContent = `Analytics reset complete for ${activeRange}`;
    return true;
  }

  let __vmAdminAnalyticsLoadSeq = 0;
  let __vmAdminAnalyticsAppliedSeq = 0;

  async function loadVmAdminAnalytics(range, opts){
    const nodes = getVmAdminAnalyticsNodes();
    const activeRange = String(range || (nodes.analyticsRange && nodes.analyticsRange.value) || '7d');
    const silent = !!(opts && opts.silent);
    const suppressTrack = !!(opts && opts.suppressTrack);
    const loadSeq = ++__vmAdminAnalyticsLoadSeq;

    if (!nodes.overviewEl || !nodes.routesEl || !nodes.entitiesEl || !nodes.eventsEl) {
      return false;
    }

    if (!silent) {
      if (nodes.analyticsStatusEl) nodes.analyticsStatusEl.textContent = `Loading analytics for ${activeRange}...`;
      nodes.overviewEl.innerHTML = 'Loading analytics overview...';
      nodes.routesEl.innerHTML = 'Loading route activity...';
      nodes.entitiesEl.innerHTML = 'Loading entity activity...';
      nodes.eventsEl.innerHTML = 'Loading recent events...';
    }

    if (nodes.analyticsRefresh) nodes.analyticsRefresh.disabled = true;
    if (nodes.analyticsRange) nodes.analyticsRange.disabled = true;

    try {
      const snapshot = await fetchVmAdminAnalyticsSnapshot(activeRange);
      const overview = snapshot.overview;
      const routes = snapshot.routes;
      const entities = snapshot.entities;
      const events = snapshot.events;

      if (loadSeq < __vmAdminAnalyticsLoadSeq) {
        return false;
      }
      __vmAdminAnalyticsAppliedSeq = loadSeq;

      nodes.overviewEl.innerHTML = renderVmAdminAnalyticsOverview(overview);
      nodes.routesEl.innerHTML = renderVmAdminAnalyticsRoutes(routes && routes.items);
      nodes.entitiesEl.innerHTML = renderVmAdminAnalyticsEntities(entities && entities.items);
      nodes.eventsEl.innerHTML = renderVmAdminAnalyticsEvents(events && events.items);
      if (nodes.analyticsStatusEl) nodes.analyticsStatusEl.textContent = `Analytics loaded for ${activeRange}`;

      return true;
    } catch (err) {
      if (loadSeq < __vmAdminAnalyticsLoadSeq) {
        return false;
      }
      try { console.error('Admin analytics load failed:', err); } catch (_) {}
      nodes.overviewEl.innerHTML = 'Analytics overview unavailable right now.';
      nodes.routesEl.innerHTML = 'Route activity unavailable right now.';
      nodes.entitiesEl.innerHTML = 'Entity activity unavailable right now.';
      nodes.eventsEl.innerHTML = 'Recent event feed unavailable right now.';
      if (nodes.analyticsStatusEl) nodes.analyticsStatusEl.textContent = (err && err.message) ? `Analytics load failed: ${err.message}` : 'Analytics load failed';
      return false;
    } finally {
      if (nodes.analyticsRefresh) nodes.analyticsRefresh.disabled = false;
      if (nodes.analyticsRange) nodes.analyticsRange.disabled = false;
    }
  }

  let __vmAdminAnalyticsAutoloadTimer = null;
  function scheduleVmAdminAnalyticsAutoload(range, opts){
    const activeRange = String(range || '7d');
    const maxAttempts = Math.max(1, Number((opts && opts.maxAttempts) || 6));
    const delayMs = Math.max(50, Number((opts && opts.delayMs) || 300));
    let attempts = 0;

    try {
      if (__vmAdminAnalyticsAutoloadTimer) {
        window.clearTimeout(__vmAdminAnalyticsAutoloadTimer);
      }
    } catch (_) {}

    const tryLoad = () => {
      attempts += 1;
      Promise.resolve(loadVmAdminAnalytics(activeRange, { silent: attempts > 1 }))
        .then((ok) => {
          if (ok) return;
          if (attempts >= maxAttempts) return;
          __vmAdminAnalyticsAutoloadTimer = window.setTimeout(tryLoad, delayMs);
        })
        .catch((err) => {
          try { console.error('Admin analytics autoload retry failed:', err); } catch (_) {}
          if (attempts >= maxAttempts) return;
          __vmAdminAnalyticsAutoloadTimer = window.setTimeout(tryLoad, delayMs);
        });
    };

    __vmAdminAnalyticsAutoloadTimer = window.setTimeout(tryLoad, 0);
  }

  try {
    window.__vmAdminAnalyticsLoad = loadVmAdminAnalytics;
    window.__vmAdminAnalyticsAutoload = scheduleVmAdminAnalyticsAutoload;
  } catch (_) {}

  // Keep your exact copy (same as inline)
  const ROUTE_COPY = {
    // Home supports HTML so you can style + edit copy easily.
    // You can change these CSS vars to tweak the look:
    //   --homeTextTransform: none | uppercase | ...
    //   --homeTitleSize / --homeSubtitleSize / --homeNoteSize
    home: `
      <div class="hud-copy" style="--homeTextTransform:none;">

        <p class="hud-title" style="--homeTitleSize:22px;">
          Welcome to the landing site for Voodoo Media.
        </p>

        <p class="hud-subtitle" style="--homeSubtitleSize:16px;">
          Right now this is a placeholder for more content later,
          but for now please make your selection above.<br><br>
		  Also, this page at the moment is best viewed inside a browser
          and should load with most devices. If you are viewing this
          from Facebook webview you likely will encounter issues.
        </p>

      </div>
    `,
    wrestling: "Wrestling Archives - Coming Soon",
    calendar: "Calendar - Coming Soon",
    about: "About Me - Coming Soon",
    pricing: "Pricing - Coming Soon",
    contact: "Contact - Coming Soon",
    admin: "Admin Control"
  };

  // Helper: render a typed-text span into the mount (same HUD behavior)
  function renderTypedShell(m){
    if (!m) return;
    m.innerHTML = '<span data-hud-main-text></span>';
  }

  // Module adapters (optional external files)
  const MusicArchive = window.MusicArchive;
  const WrestlingArchive = window.WrestlingArchive;
  const CalendarArchive = window.CalendarArchive;
  const AboutArchive = window.AboutArchive;
  const Pricing = window.Pricing;
  const Contact = window.Contact;

  // Optional: Home module (home.js)
  const HomeArchive = window.HomeArchive;

  // Route modules: keep behavior identical, but allow upgrades via external JS later

  // =============================
  // Backend Warm-up (prevents first-click cold-start delay)
  // =============================
  const __VM_WARM_KEY = '__vm_backend_warm_v1';

  function _vmTryGetSession(key){
    try { return sessionStorage.getItem(key); } catch(_){ return null; }
  }
  function _vmTrySetSession(key, val){
    try { sessionStorage.setItem(key, val); } catch(_){}
  }

  function warmUpBackendsOnce(){
    try{
      if (_vmTryGetSession(__VM_WARM_KEY)) return;
      _vmTrySetSession(__VM_WARM_KEY, String(Date.now()));

      const musicBase =
        (typeof window !== 'undefined' && typeof window.MUSIC_ARCHIVE_API_BASE === 'string' && window.MUSIC_ARCHIVE_API_BASE.trim())
          ? window.MUSIC_ARCHIVE_API_BASE.trim().replace(/\/$/, '')
          : 'https://music-archive-3lfa.onrender.com';

      const wrestleBase =
        (typeof window !== 'undefined' && typeof window.WRESTLING_ARCHIVE_API_BASE === 'string' && window.WRESTLING_ARCHIVE_API_BASE.trim())
          ? window.WRESTLING_ARCHIVE_API_BASE.trim().replace(/\/$/, '')
          : 'https://wrestling-archive.onrender.com';

      const targets = [
        musicBase + '/health',
        musicBase + '/sheet/bands',
        wrestleBase + '/sheet/shows',
        wrestleBase + '/'
      ];

      targets.forEach((url) => {
        try{
          const ctrl = (window.AbortController) ? new AbortController() : null;
          const sig = ctrl ? ctrl.signal : undefined;

          // Short timeout: we only need to wake the server, not download full payloads.
          const to = window.setTimeout(() => { try{ ctrl && ctrl.abort(); }catch(_){ } }, 8000);

          fetch(url, { method: 'GET', signal: sig, cache: 'no-store' })
            .then((res) => {
              // Cancel body ASAP to avoid wasting bandwidth.
              try{
                if (res && res.body && typeof res.body.cancel === 'function') res.body.cancel();
              }catch(_){ }
            })
            .catch(() => {})
            .finally(() => { try{ window.clearTimeout(to); }catch(_){ } });
        }catch(_){}
      });
    }catch(_){}
  }

  const __VM_KEEPALIVE_INTERVAL_MS = 1000 * 60 * 10;
  let _vmKeepAliveTimer = null;

  function getBackendKeepaliveTargets(){
    const musicBase =
      (typeof window !== 'undefined' && typeof window.MUSIC_ARCHIVE_API_BASE === 'string' && window.MUSIC_ARCHIVE_API_BASE.trim())
        ? window.MUSIC_ARCHIVE_API_BASE.trim().replace(/\/$/, '')
        : 'https://music-archive-3lfa.onrender.com';

    const wrestleBase =
      (typeof window !== 'undefined' && typeof window.WRESTLING_ARCHIVE_API_BASE === 'string' && window.WRESTLING_ARCHIVE_API_BASE.trim())
        ? window.WRESTLING_ARCHIVE_API_BASE.trim().replace(/\/$/, '')
        : 'https://wrestling-archive.onrender.com';

    return [
      musicBase + '/health',
      musicBase + '/sheet/bands',
      wrestleBase + '/sheet/shows',
      wrestleBase + '/'
    ];
  }

  function pingBackends(){
    try{
      const targets = getBackendKeepaliveTargets();
      targets.forEach((url) => {
        try{
          const ctrl = (window.AbortController) ? new AbortController() : null;
          const sig = ctrl ? ctrl.signal : undefined;
          const to = window.setTimeout(() => { try{ ctrl && ctrl.abort(); }catch(_){ } }, 8000);

          fetch(url, { method: 'GET', signal: sig, cache: 'no-store' })
            .then((res) => {
              try{
                if (res && res.body && typeof res.body.cancel === 'function') res.body.cancel();
              }catch(_){ }
            })
            .catch(() => {})
            .finally(() => { try{ window.clearTimeout(to); }catch(_){ } });
        }catch(_){ }
      });
    }catch(_){ }
  }

  function installBackendKeepAlive(){
    try {
      if (_vmKeepAliveTimer) return;
      pingBackends();
      _vmKeepAliveTimer = window.setInterval(() => {
        try { pingBackends(); } catch (_) {}
      }, __VM_KEEPALIVE_INTERVAL_MS);

      document.addEventListener('visibilitychange', () => {
        try {
          if (!document.hidden) pingBackends();
        } catch (_) {}
      });
    } catch (_) {}
  }

  const modules = {
    home: {
  render(){
    const m = mount();
    if (!m) return;

    // If the music archive previously mounted UI, let it clean up
    if (MusicArchive && typeof MusicArchive.destroy === 'function') MusicArchive.destroy();

    // Prefer external home.js module when present
    if (HomeArchive && typeof HomeArchive.render === 'function'){
      HomeArchive.render(m);
    } else {
      // Home copy is HTML so you can style/edit it. Inject as markup.
      m.innerHTML = ROUTE_COPY.home;
    }
  },
  onEnter(){
    setDocumentTitle('');
    // Warm backend services ASAP and keep them alive every 10 minutes while the site is open.
    installBackendKeepAlive();
    if (HomeArchive && typeof HomeArchive.onEnter === 'function'){
      // Pass the editable Home copy through so home.js can render it (HTML or plain text).
      HomeArchive.onEnter(ROUTE_COPY.home);
      return;
    }
    // No typing animation for Home; render styled HTML immediately.
    const m = mount();
    if (m) m.innerHTML = ROUTE_COPY.home;
  },
  onLeave(){
    if (HomeArchive && typeof HomeArchive.destroy === 'function'){
      HomeArchive.destroy();
    }
  }
},

music: {
      render(){
        const m = mount();
        if (!m) return;
        // Preserve your current "blank music" behavior unless you wire the archive in.
        // If MusicArchive provides a render() function, we'll use it.
        if (MusicArchive && typeof MusicArchive.render === 'function'){
          MusicArchive.render(m);
        } else {
          m.innerHTML = '';
        }
      },
      onEnter(){
        if (MusicArchive && typeof MusicArchive.onEnter === 'function'){
          MusicArchive.onEnter();
        }
      },
      onLeave(){
        if (MusicArchive && typeof MusicArchive.destroy === 'function'){
          MusicArchive.destroy();
        }
      }
    },

    wrestling: {
      render(){
        const m = mount();
        if (!m) return;
        if (WrestlingArchive && typeof WrestlingArchive.render === 'function'){
          WrestlingArchive.render(m);
        } else {
          renderTypedShell(m);
        }
      },
      onEnter(){
        if (WrestlingArchive && typeof WrestlingArchive.onEnter === 'function'){
          WrestlingArchive.onEnter();
          return;
        }
        const el = document.querySelector('[data-hud-main-text]');
        typeHudMainText(ROUTE_COPY.wrestling, el);
      },
      onLeave(){
        if (WrestlingArchive && typeof WrestlingArchive.destroy === 'function'){
          WrestlingArchive.destroy();
        }
      }
    },

    calendar: {
      render(){
        const m = mount();
        if (!m) return;
        if (CalendarArchive && typeof CalendarArchive.render === 'function'){
          CalendarArchive.render(m);
        } else {
          renderTypedShell(m);
        }
      },
      onEnter(){
        if (CalendarArchive && typeof CalendarArchive.onEnter === 'function'){
          CalendarArchive.onEnter();
          return;
        }
        const el = document.querySelector('[data-hud-main-text]');
        typeHudMainText(ROUTE_COPY.calendar, el);
      },
      onLeave(){
        if (CalendarArchive && typeof CalendarArchive.destroy === 'function'){
          CalendarArchive.destroy();
        }
      }
    },

    about: {
      render(){
        const m = mount();
        if (!m) return;
        if (AboutArchive && typeof AboutArchive.render === 'function'){
          AboutArchive.render(m);
        } else {
          renderTypedShell(m);
        }
      },
      onEnter(){
        if (AboutArchive && typeof AboutArchive.onEnter === 'function'){
          AboutArchive.onEnter();
          return;
        }
        const el = document.querySelector('[data-hud-main-text]');
        typeHudMainText(ROUTE_COPY.about, el);
      },
      onLeave(){
        if (AboutArchive && typeof AboutArchive.destroy === 'function'){
          AboutArchive.destroy();
        }
      }
    },

    pricing: {
      render(){
        const m = mount();
        if (!m) return;
        if (Pricing && typeof Pricing.render === 'function'){
          Pricing.render(m);
        } else {
          renderTypedShell(m);
        }
      },
      onEnter(){
        if (Pricing && typeof Pricing.onEnter === 'function'){
          Pricing.onEnter();
          return;
        }
        const el = document.querySelector('[data-hud-main-text]');
        typeHudMainText(ROUTE_COPY.pricing, el);
      },
      onLeave(){
        if (Pricing && typeof Pricing.destroy === 'function'){
          Pricing.destroy();
        }
      }
    },

    contact: {
      render(){
        const m = mount();
        if (!m) return;
        if (Contact && typeof Contact.render === 'function'){
          Contact.render(m);
        } else {
          renderTypedShell(m);
        }
      },
      onEnter(){
        if (Contact && typeof Contact.onEnter === 'function'){
          Contact.onEnter();
          return;
        }
        const el = document.querySelector('[data-hud-main-text]');
        typeHudMainText(ROUTE_COPY.contact, el);
      },
      onLeave(){
        if (Contact && typeof Contact.destroy === 'function'){
          Contact.destroy();
        }
      }
    },

    admin: {
      render(){
        const m = mount();
        if (!m) return;
        m.innerHTML = `
          <div id="vmAdminPanelRoot" style="width:min(1040px,100%); margin:0 auto; padding:18px 18px 28px;">
            <div style="position:relative; overflow:hidden; border:1px solid rgba(255,70,110,.24); border-radius:22px; padding:20px; background:
              radial-gradient(circle at top right, rgba(86,216,255,.12), transparent 34%),
              radial-gradient(circle at bottom left, rgba(255,74,131,.12), transparent 36%),
              linear-gradient(180deg,rgba(18,10,24,.82),rgba(8,7,14,.9)); box-shadow:0 0 0 1px rgba(255,255,255,.03) inset, 0 20px 50px rgba(0,0,0,.28);">
              <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:18px; flex-wrap:wrap;">
                <div style="min-width:min(100%,420px); max-width:620px;">
                  <div style="color:rgba(255,130,164,.86); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:900; letter-spacing:.18em; text-transform:uppercase;">Admin Analytics</div>
                  <div style="margin-top:7px; color:rgba(245,236,242,.98); font-family:'Orbitron',system-ui,sans-serif; font-size:32px; font-weight:900; letter-spacing:.04em; text-transform:uppercase; line-height:1;">Control Center</div>
                  <div style="margin-top:12px; color:rgba(225,208,220,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:12px; line-height:1.6;">A live readout for route traffic, entity activity, and recent site behavior, styled to feel native to the VMPix shell instead of a temporary admin utility.</div>
                </div>
                <div style="display:flex; flex-direction:column; gap:8px; min-width:240px; align-items:flex-start;">
                  <div id="vmAdminStatusLine" style="padding:9px 12px; border-radius:999px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.03); color:rgba(166,235,210,.88); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.1em; text-transform:uppercase;">Checking backend access...</div>
                  <div id="vmAdminAnalyticsStatus" style="padding:9px 12px; border-radius:999px; border:1px solid rgba(255,255,255,.06); background:rgba(7,10,18,.56); color:rgba(208,222,232,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.1em; text-transform:uppercase;">Preparing analytics dashboard...</div>
                </div>
              </div>
              <div style="margin-top:20px;">
                <div style="display:flex; align-items:center; gap:12px;">
                  <div style="flex:1; height:2px; background:linear-gradient(90deg,rgba(255,70,110,.04),rgba(255,70,110,.62),rgba(97,224,255,.56),rgba(255,70,110,.04));"></div>
                </div>
              </div>
              <div style="display:grid; grid-template-columns:minmax(0,1fr); gap:14px; margin-top:16px;">
                <details style="border:1px solid rgba(255,70,110,.18); border-radius:18px; padding:16px; background:linear-gradient(180deg,rgba(17,11,25,.92),rgba(12,10,18,.72));">
                  <summary style="list-style:none; cursor:pointer;">
                    <div style="display:flex; align-items:center; gap:12px;">
                      <div style="flex:1; height:2px; background:linear-gradient(90deg,rgba(255,70,110,.04),rgba(255,70,110,.62),rgba(97,224,255,.56),rgba(255,70,110,.04));"></div>
                    </div>
                    <div style="display:grid; grid-template-columns:30px minmax(0,1fr) auto; align-items:center; gap:10px; margin-top:10px;">
                      <div></div>
                      <div style="color:rgba(255,130,164,.88); font-family:'Orbitron',system-ui,sans-serif; font-size:16px; font-weight:900; letter-spacing:.18em; text-transform:uppercase; text-align:center;">Indexing Tools</div>
                      <div style="min-width:84px; padding:7px 10px; border-radius:999px; border:1px solid rgba(97,224,255,.24); display:flex; align-items:center; justify-content:center; color:rgba(210,242,255,.92); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; margin-left:auto;">Expand</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px; margin-top:10px;">
                      <div style="flex:1; height:2px; background:linear-gradient(90deg,rgba(255,70,110,.04),rgba(255,70,110,.62),rgba(97,224,255,.56),rgba(255,70,110,.04));"></div>
                    </div>
                  </summary>
                  <div style="margin-top:10px;">
                    <div style="margin-top:10px; color:rgba(214,198,210,.74); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55; text-align:center;">This area deals with the cached results of our indexes and gives us the ability to rebuild them on command.</div>
                    <div id="vmAdminPeopleMeta" style="margin-top:12px; min-height:220px;">${renderVmAdminIndexTableShell([
                      { label: 'Music-Bands', generatedAtLabel: 'Checking rebuild time...' },
                      { label: 'Music-Shows', generatedAtLabel: 'Checking rebuild time...' },
                      { label: 'Music-People', generatedAtLabel: 'Checking rebuild time...' },
                      { label: 'Wrestling-Shows', generatedAtLabel: 'Checking rebuild time...' },
                      { label: 'Wrestling-People', generatedAtLabel: 'Checking rebuild time...' }
                    ])}</div>
                  </div>
                </details>
                <details style="border:1px solid rgba(255,70,110,.18); border-radius:18px; padding:16px; background:linear-gradient(180deg,rgba(17,11,25,.92),rgba(12,10,18,.72));">
                  <summary style="list-style:none; cursor:pointer;">
                    <div style="display:flex; align-items:center; gap:12px;">
                      <div style="flex:1; height:2px; background:linear-gradient(90deg,rgba(255,70,110,.04),rgba(255,70,110,.62),rgba(97,224,255,.56),rgba(255,70,110,.04));"></div>
                    </div>
                    <div style="display:grid; grid-template-columns:30px minmax(0,1fr) auto; align-items:center; gap:10px; margin-top:10px;">
                      <div></div>
                      <div style="color:rgba(255,130,164,.88); font-family:'Orbitron',system-ui,sans-serif; font-size:16px; font-weight:900; letter-spacing:.18em; text-transform:uppercase; text-align:center;">Facebook Publishing</div>
                      <div style="min-width:84px; padding:7px 10px; border-radius:999px; border:1px solid rgba(97,224,255,.24); display:flex; align-items:center; justify-content:center; color:rgba(210,242,255,.92); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; margin-left:auto;">Expand</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px; margin-top:10px;">
                      <div style="flex:1; height:2px; background:linear-gradient(90deg,rgba(255,70,110,.04),rgba(255,70,110,.62),rgba(97,224,255,.56),rgba(255,70,110,.04));"></div>
                    </div>
                  </summary>
                  <div style="margin-top:10px;">
                    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
                      <div style="flex:1 1 100%; min-width:0;">
                        <div style="margin-top:10px; color:rgba(214,198,210,.74); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55; text-align:center;">Manage the live page connection here, then use the composer below for post previews and publishing.</div>
                      </div>
                      <div id="vmAdminFacebookStatus" style="padding:8px 10px; border-radius:999px; border:1px solid rgba(97,224,255,.22); background:rgba(10,18,24,.72); color:rgba(210,242,255,.9); font-family:'Orbitron',system-ui,sans-serif; font-size:9px; font-weight:800; letter-spacing:.1em; text-transform:uppercase;">Checking status...</div>
                    </div>
                    <div id="vmAdminFacebookMeta" style="margin-top:12px; min-height:52px; color:rgba(208,222,232,.82); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55;">Loading Facebook connection details...</div>
                    <div style="margin-top:14px; display:flex; gap:8px; flex-wrap:wrap; justify-content:center;">
                      <button type="button" id="vmAdminFacebookConnect" onclick="window.__vmAdminFacebookConnect && window.__vmAdminFacebookConnect(); return false;" style="position:relative; z-index:2; pointer-events:auto; min-width:168px; padding:10px 15px; border-radius:999px; border:1px solid rgba(97,224,255,.28); background:linear-gradient(180deg,rgba(11,26,34,.94),rgba(8,16,23,.92)); color:rgba(210,242,255,.94); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer;">Connect Page</button>
                      <button type="button" id="vmAdminFacebookRefresh" onclick="window.__vmAdminRefreshFacebook && window.__vmAdminRefreshFacebook(); return false;" style="position:relative; z-index:2; pointer-events:auto; min-width:144px; padding:10px 15px; border-radius:999px; border:1px solid rgba(255,255,255,.08); background:linear-gradient(180deg,rgba(23,18,29,.94),rgba(13,11,18,.92)); color:rgba(247,237,242,.94); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer;">Check Connection</button>
                      <button type="button" id="vmAdminFacebookDisconnect" onclick="window.__vmAdminFacebookDisconnect && window.__vmAdminFacebookDisconnect(); return false;" style="position:relative; z-index:2; pointer-events:auto; min-width:156px; padding:10px 15px; border-radius:999px; border:1px solid rgba(255,95,135,.34); background:linear-gradient(180deg,rgba(48,20,34,.92),rgba(27,11,20,.92)); color:rgba(247,237,242,.96); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer;">Disconnect Page</button>
                    </div>
                    <div style="margin-top:16px; border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:14px; background:linear-gradient(180deg,rgba(9,12,18,.84),rgba(6,8,14,.86));">
                    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
                      <div>
                        <div style="color:rgba(255,130,164,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;">Composer</div>
                        <div style="margin-top:6px; color:rgba(214,198,210,.72); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55;">Normal Post stays manual. Photo Post now pulls from a real Wrestling show picker.</div>
                      </div>
                      <div id="vmAdminFacebookComposerStatus" style="padding:8px 10px; border-radius:999px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.03); color:rgba(208,222,232,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:9px; font-weight:800; letter-spacing:.1em; text-transform:uppercase;">Checking connection...</div>
                    </div>
                    <div style="display:grid; grid-template-columns:minmax(0,1fr); gap:10px; margin-top:14px;">
                      <label style="display:block;">
                        <div style="margin-bottom:6px; color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Section</div>
                        <select id="vmAdminFacebookSection" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px;">
                          <option value="wrestling">Wrestling</option>
                          <option value="music">Music</option>
                        </select>
                      </label>
                      <label style="display:block;">
                        <div style="margin-bottom:6px; color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Entity Type</div>
                        <select id="vmAdminFacebookEntityType" onchange="window.__vmAdminSyncFacebookEntityTypeUi && window.__vmAdminSyncFacebookEntityTypeUi();" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px;">
                          <option value="normal_post" selected>Normal Post</option>
                          <option value="photo_post">Photo Post</option>
                          <option value="throwback">Throwback</option>
                        </select>
                      </label>
                      <input id="vmAdminFacebookEntityIdHidden" type="hidden" value="" />
                      <input id="vmAdminFacebookEntityRouteHidden" type="hidden" value="" />
                    </div>
                    <div id="vmAdminFacebookModeNote" style="margin-top:10px; color:rgba(166,235,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.55;">Normal Post uses caption plus an optional link.</div>
                    <div style="display:grid; grid-template-columns:minmax(0,1fr); gap:10px; margin-top:10px;">
                      <label data-facebook-mode="normal-post" style="display:block;">
                        <div style="margin-bottom:6px; color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Link</div>
                        <select id="vmAdminFacebookNormalLinkMode" onchange="window.__vmAdminSyncFacebookEntityTypeUi && window.__vmAdminSyncFacebookEntityTypeUi();" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px;">
                          <option value="no" selected>No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </label>
                      <label id="vmAdminFacebookNormalLinkUrlWrap" data-facebook-mode="normal-post" style="display:none;">
                        <div style="margin-bottom:6px; color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Link URL</div>
                        <input id="vmAdminFacebookNormalLinkUrl" type="url" placeholder="https://..." style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px;" />
                      </label>
                      <div id="vmAdminFacebookPickerShell" data-facebook-mode="photo-post" style="display:none; border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:14px; background:linear-gradient(180deg,rgba(11,14,20,.9),rgba(8,10,16,.84));">
                        <div style="color:rgba(166,235,210,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;">Choose Content</div>
                        <div style="margin-top:6px; color:rgba(214,198,210,.7); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.55;">Show-source-first picker. Search shows, choose one result, and the composer fields will update automatically.</div>
                        <div id="vmAdminFacebookPickerLayout" style="margin-top:10px; display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px;">
                          <div style="border:1px solid rgba(255,255,255,.06); border-radius:14px; padding:12px; background:rgba(9,11,16,.76);">
                            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                              <div style="color:rgba(245,236,242,.9); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase;">Shows / Results</div>
                              <div id="vmAdminFacebookPickerCount" style="color:rgba(214,198,210,.66); font-family:'Orbitron',system-ui,sans-serif; font-size:9px; font-weight:800; letter-spacing:.08em; text-transform:uppercase;">Loading...</div>
                            </div>
                            <div id="vmAdminFacebookPickerResults" style="margin-top:10px; display:grid; gap:8px; max-height:332px; overflow-y:auto; padding-right:4px;"></div>
                          </div>
                          <div id="vmAdminFacebookPickerSelectedPanel" style="border:1px solid rgba(255,255,255,.06); border-radius:14px; padding:12px; background:rgba(9,11,16,.76);">
                            <div style="color:rgba(245,236,242,.9); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase;">Selected Item</div>
                            <div id="vmAdminFacebookPickerSelected"></div>
                          </div>
                        </div>
                        <div id="vmAdminFacebookPickerStatus" style="margin-top:10px; color:rgba(214,198,210,.64); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.55;">Single-select picker ready</div>
                      </div>
                      <label id="vmAdminFacebookImageUrlWrap" data-facebook-mode="photo-post" style="display:none;">
                        <div style="margin-bottom:6px; color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Image URL</div>
                        <input id="vmAdminFacebookImageUrl" type="url" placeholder="https://..." style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px;" />
                      </label>
                      <div id="vmAdminFacebookPublishModeWrap" data-facebook-mode="photo-post" style="display:none;">
                        <div style="margin-bottom:6px; color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Publish Mode</div>
                        <select id="vmAdminFacebookPublishMode" onchange="window.__vmAdminSyncFacebookEntityTypeUi && window.__vmAdminSyncFacebookEntityTypeUi(); window.__vmAdminSyncFacebookAlbumUi && window.__vmAdminSyncFacebookAlbumUi();" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px;">
                          <option value="post" selected>Custom Multi-Photo Post</option>
                          <option value="album">Upload to Album</option>
                          <option value="both">Manual Post/Upload</option>
                          <option value="share">Share</option>
                        </select>
                      </div>
                      <div id="vmAdminFacebookAlbumWrap" data-facebook-mode="photo-post" style="display:none;">
                        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:6px; flex-wrap:wrap;">
                          <div style="color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Facebook Album</div>
                          <button type="button" id="vmAdminFacebookAlbumRefresh" onclick="window.__vmAdminRefreshFacebookAlbums && window.__vmAdminRefreshFacebookAlbums(); return false;" style="position:relative; z-index:2; pointer-events:auto; min-width:126px; padding:8px 12px; border-radius:999px; border:1px solid rgba(97,224,255,.18); background:linear-gradient(180deg,rgba(11,26,34,.94),rgba(8,16,23,.92)); color:rgba(210,242,255,.94); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer;">Refresh Albums</button>
                        </div>
                        <select id="vmAdminFacebookAlbumId" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px;">
                          <option value="">Select a Facebook album...</option>
                        </select>
                        <div id="vmAdminFacebookAlbumStatus" style="margin-top:8px; color:rgba(214,198,210,.66); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.55;">Album upload is off. Custom multi-photo post is the active mode.</div>
                      </div>
                      <label id="vmAdminFacebookPhotoTitleModeWrap" data-facebook-mode="photo-post" style="display:none;">
                        <div style="margin-bottom:6px; color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Title</div>
                        <select id="vmAdminFacebookPhotoTitleMode" onchange="window.__vmAdminSyncFacebookPhotoOptionsUi && window.__vmAdminSyncFacebookPhotoOptionsUi();" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px;">
                          <option value="no" selected>No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </label>
                      <label id="vmAdminFacebookEntityTitleWrap" data-facebook-mode="photo-post" style="display:none;">
                        <div style="margin-bottom:6px; color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Title</div>
                        <input id="vmAdminFacebookEntityLabel" type="text" placeholder="Post title" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px;" />
                      </label>
                      <label id="vmAdminFacebookPhotoLinkModeWrap" data-facebook-mode="photo-post" style="display:none;">
                        <div style="margin-bottom:6px; color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Link</div>
                        <select id="vmAdminFacebookPhotoLinkMode" onchange="window.__vmAdminSyncFacebookPhotoOptionsUi && window.__vmAdminSyncFacebookPhotoOptionsUi();" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px;">
                          <option value="no" selected>No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </label>
                      <label id="vmAdminFacebookLinkUrlWrap" data-facebook-mode="photo-post" style="display:none;">
                        <div style="margin-bottom:6px; color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Link URL</div>
                        <input id="vmAdminFacebookLinkUrl" type="url" placeholder="https://..." style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px;" />
                      </label>
                      <label id="vmAdminFacebookPhotoHashtagsModeWrap" data-facebook-mode="photo-post" style="display:none;">
                        <div style="margin-bottom:6px; color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Hashtags</div>
                        <select id="vmAdminFacebookPhotoHashtagsMode" onchange="window.__vmAdminSyncFacebookPhotoOptionsUi && window.__vmAdminSyncFacebookPhotoOptionsUi();" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px;">
                          <option value="no" selected>No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </label>
                      <label id="vmAdminFacebookHashtagsWrap" data-facebook-mode="photo-post" style="display:none;">
                        <div style="margin-bottom:6px; color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Hashtags</div>
                        <textarea id="vmAdminFacebookHashtags" rows="2" placeholder="#Hashtags" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.6; resize:vertical;"></textarea>
                      </label>
                      <label style="display:block;">
                        <div style="margin-bottom:6px; color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Caption</div>
                        <div style="position:relative;">
                          <textarea id="vmAdminFacebookCaption" rows="5" placeholder="Write the Facebook caption here..." oninput="window.__vmAdminFacebookMentionRefresh && window.__vmAdminFacebookMentionRefresh();" onclick="window.__vmAdminFacebookMentionRefresh && window.__vmAdminFacebookMentionRefresh();" onkeyup="window.__vmAdminFacebookMentionRefresh && window.__vmAdminFacebookMentionRefresh(event);" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.6; resize:vertical;"></textarea>
                          <div id="vmAdminFacebookMentionSuggestions" style="display:none; position:absolute; left:0; right:0; top:calc(100% + 6px); z-index:40; border:1px solid rgba(97,224,255,.16); border-radius:12px; background:linear-gradient(180deg,rgba(10,18,24,.98),rgba(7,11,18,.98)); box-shadow:0 14px 34px rgba(0,0,0,.38); overflow:hidden;"></div>
                        </div>
                      </label>
                    </div>
                    <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap; justify-content:center;">
                      <button type="button" id="vmAdminFacebookPreviewBtn" onclick="window.__vmAdminFacebookPreviewDraft && window.__vmAdminFacebookPreviewDraft(); return false;" style="position:relative; z-index:2; pointer-events:auto; min-width:148px; padding:10px 15px; border-radius:999px; border:1px solid rgba(97,224,255,.26); background:linear-gradient(180deg,rgba(11,26,34,.94),rgba(8,16,23,.92)); color:rgba(210,242,255,.94); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer;">Preview Draft</button>
                      <button type="button" id="vmAdminFacebookPublishBtn" onclick="window.__vmAdminFacebookPublishNow && window.__vmAdminFacebookPublishNow(); return false;" style="position:relative; z-index:2; pointer-events:auto; min-width:156px; padding:10px 15px; border-radius:999px; border:1px solid rgba(255,95,135,.34); background:linear-gradient(180deg,rgba(48,20,34,.92),rgba(27,11,20,.92)); color:rgba(247,237,242,.96); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer;">Publish Now</button>
                    </div>
                    <div id="vmAdminFacebookPreview" style="margin-top:14px; min-height:80px; color:rgba(214,198,210,.7); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55;">Facebook preview will appear here.</div>
                    <div style="margin-top:14px;">
                      <div style="color:rgba(166,235,210,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;">Recent Publish History</div>
                      <div id="vmAdminFacebookHistory" style="margin-top:10px; display:grid; grid-template-columns:minmax(0,1fr); gap:10px;"></div>
                    </div>
                  </div>
                  </div>
                </details>
                <details style="border:1px solid rgba(255,70,110,.18); border-radius:18px; padding:16px; background:linear-gradient(180deg,rgba(17,11,25,.92),rgba(12,10,18,.72));">
                  <summary style="list-style:none; cursor:pointer;">
                    <div style="display:flex; align-items:center; gap:12px;">
                      <div style="flex:1; height:2px; background:linear-gradient(90deg,rgba(255,70,110,.04),rgba(255,70,110,.62),rgba(97,224,255,.56),rgba(255,70,110,.04));"></div>
                    </div>
                    <div style="display:grid; grid-template-columns:30px minmax(0,1fr) auto; align-items:center; gap:10px; margin-top:10px;">
                      <div></div>
                      <div style="color:rgba(255,130,164,.88); font-family:'Orbitron',system-ui,sans-serif; font-size:16px; font-weight:900; letter-spacing:.18em; text-transform:uppercase; text-align:center;">Instagram Publishing</div>
                      <div style="min-width:84px; padding:7px 10px; border-radius:999px; border:1px solid rgba(97,224,255,.24); display:flex; align-items:center; justify-content:center; color:rgba(210,242,255,.92); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; margin-left:auto;">Expand</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px; margin-top:10px;">
                      <div style="flex:1; height:2px; background:linear-gradient(90deg,rgba(255,70,110,.04),rgba(255,70,110,.62),rgba(97,224,255,.56),rgba(255,70,110,.04));"></div>
                    </div>
                  </summary>
                  <div style="margin-top:10px;">
                    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
                      <div style="flex:1 1 100%; min-width:0;">
                        <div style="margin-top:10px; color:rgba(214,198,210,.74); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55; text-align:center;">Instagram first pass is Photo Post only. It reuses the archive picker flow, title toggle, hashtags toggle, and caption box without a final link line in the Instagram caption.</div>
                      </div>
                      <div id="vmAdminInstagramStatus" style="padding:8px 10px; border-radius:999px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.03); color:rgba(208,222,232,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:9px; font-weight:800; letter-spacing:.1em; text-transform:uppercase;">Checking status...</div>
                    </div>
                    <div id="vmAdminInstagramMeta" style="margin-top:12px; min-height:52px; color:rgba(208,222,232,.82); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55;">Loading Instagram connection details...</div>
                    <div style="margin-top:14px; display:flex; gap:8px; flex-wrap:wrap; justify-content:center;">
                      <button type="button" id="vmAdminInstagramConnect" onclick="window.__vmAdminInstagramConnect && window.__vmAdminInstagramConnect(); return false;" style="position:relative; z-index:2; pointer-events:auto; min-width:178px; padding:10px 15px; border-radius:999px; border:1px solid rgba(97,224,255,.28); background:linear-gradient(180deg,rgba(11,26,34,.94),rgba(8,16,23,.92)); color:rgba(210,242,255,.94); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer;">Connect Instagram</button>
                      <button type="button" id="vmAdminInstagramRefresh" onclick="window.__vmAdminRefreshInstagram && window.__vmAdminRefreshInstagram(); return false;" style="position:relative; z-index:2; pointer-events:auto; min-width:144px; padding:10px 15px; border-radius:999px; border:1px solid rgba(255,255,255,.08); background:linear-gradient(180deg,rgba(23,18,29,.94),rgba(13,11,18,.92)); color:rgba(247,237,242,.94); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer;">Check Connection</button>
                      <button type="button" id="vmAdminInstagramDisconnect" onclick="window.__vmAdminInstagramDisconnect && window.__vmAdminInstagramDisconnect(); return false;" style="position:relative; z-index:2; pointer-events:auto; min-width:168px; padding:10px 15px; border-radius:999px; border:1px solid rgba(255,95,135,.34); background:linear-gradient(180deg,rgba(48,20,34,.92),rgba(27,11,20,.92)); color:rgba(247,237,242,.96); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer;">Disconnect Instagram</button>
                    </div>
                    <div style="margin-top:18px; border-top:1px solid rgba(255,255,255,.06); padding-top:16px;">
                      <div style="padding:12px 14px; border-radius:16px; border:1px solid rgba(255,255,255,.08); background:linear-gradient(180deg,rgba(12,15,22,.92),rgba(8,10,16,.86)); color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.55;">
                        <div style="color:rgba(255,130,164,.84); font-size:10px; font-weight:900; letter-spacing:.14em; text-transform:uppercase;">Composer</div>
                        <div id="vmAdminInstagramComposerStatus" style="margin-top:8px;">Checking Instagram connection...</div>
                      </div>
                      <div style="display:grid; grid-template-columns:minmax(0,1fr); gap:10px; margin-top:10px;">
                        <label style="display:block;">
                          <div style="margin-bottom:6px; color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Section</div>
                          <select id="vmAdminInstagramSection" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px;">
                            <option value="wrestling" selected>Wrestling</option>
                          </select>
                        </label>
                        <input id="vmAdminInstagramEntityIdHidden" type="hidden" value="" />
                        <input id="vmAdminInstagramEntityRouteHidden" type="hidden" value="" />
                        <div id="vmAdminInstagramPickerShell" style="border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:14px; background:linear-gradient(180deg,rgba(11,14,20,.9),rgba(8,10,16,.84));">
                          <div style="color:rgba(166,235,210,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;">Choose Content</div>
                          <div style="margin-top:6px; color:rgba(214,198,210,.7); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.55;">Reuse the show-source-first archive browser and selected-photo flow to target Instagram with the same archive item.</div>
                          <div id="vmAdminInstagramPickerLayout" style="margin-top:10px; display:grid; grid-template-columns:minmax(0,1fr); gap:12px;">
                            <div style="border:1px solid rgba(255,255,255,.06); border-radius:14px; padding:12px; background:rgba(9,11,16,.76);">
                              <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                                <div style="color:rgba(245,236,242,.9); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase;">Shows / Results</div>
                                <div id="vmAdminInstagramPickerCount" style="color:rgba(214,198,210,.66); font-family:'Orbitron',system-ui,sans-serif; font-size:9px; font-weight:800; letter-spacing:.08em; text-transform:uppercase;">Loading...</div>
                              </div>
                              <div id="vmAdminInstagramPickerResults" style="margin-top:10px; display:grid; gap:8px; max-height:332px; overflow-y:auto; padding-right:4px;">
                                <div style="padding:12px; border:1px solid rgba(255,255,255,.06); border-radius:12px; background:rgba(11,14,20,.72); color:rgba(208,222,232,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.55;">Loading Wrestling shows...</div>
                              </div>
                            </div>
                            <div id="vmAdminInstagramPickerSelectedPanel" style="display:none; border:1px solid rgba(255,255,255,.06); border-radius:14px; padding:12px; background:rgba(9,11,16,.76);">
                              <div style="color:rgba(245,236,242,.9); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase;">Selected Item</div>
                              <div id="vmAdminInstagramPickerSelected"></div>
                            </div>
                          </div>
                          <div id="vmAdminInstagramPickerStatus" style="margin-top:10px; color:rgba(214,198,210,.64); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.55;">Single-select picker ready</div>
                        </div>
                        <input id="vmAdminInstagramImageUrl" type="hidden" value="" />
                        <label id="vmAdminInstagramPhotoTitleModeWrap" style="display:block;">
                          <div style="margin-bottom:6px; color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Title</div>
                          <select id="vmAdminInstagramPhotoTitleMode" onchange="window.__vmAdminSyncInstagramPhotoOptionsUi && window.__vmAdminSyncInstagramPhotoOptionsUi();" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px;">
                            <option value="no" selected>No</option>
                            <option value="yes">Yes</option>
                          </select>
                        </label>
                        <label id="vmAdminInstagramEntityTitleWrap" style="display:none;">
                          <div style="margin-bottom:6px; color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Title</div>
                          <input id="vmAdminInstagramEntityLabel" type="text" placeholder="Instagram title" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px;" />
                        </label>
                        <label id="vmAdminInstagramPhotoHashtagsModeWrap" style="display:block;">
                          <div style="margin-bottom:6px; color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Hashtags</div>
                          <select id="vmAdminInstagramPhotoHashtagsMode" onchange="window.__vmAdminSyncInstagramPhotoOptionsUi && window.__vmAdminSyncInstagramPhotoOptionsUi();" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px;">
                            <option value="no" selected>No</option>
                            <option value="yes">Yes</option>
                          </select>
                        </label>
                        <label id="vmAdminInstagramHashtagsWrap" style="display:none;">
                          <div style="margin-bottom:6px; color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Hashtags</div>
                          <textarea id="vmAdminInstagramHashtags" rows="2" placeholder="#Hashtags" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.6; resize:vertical;"></textarea>
                        </label>
                        <label style="display:block;">
                          <div style="margin-bottom:6px; color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Caption</div>
                          <textarea id="vmAdminInstagramCaption" rows="5" placeholder="Write the Instagram caption here..." style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.6; resize:vertical;"></textarea>
                        </label>
                      </div>
                      <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap; justify-content:center;">
                        <button type="button" id="vmAdminInstagramPreviewBtn" onclick="window.__vmAdminInstagramPreviewDraft && window.__vmAdminInstagramPreviewDraft(); return false;" style="position:relative; z-index:2; pointer-events:auto; min-width:148px; padding:10px 15px; border-radius:999px; border:1px solid rgba(97,224,255,.26); background:linear-gradient(180deg,rgba(11,26,34,.94),rgba(8,16,23,.92)); color:rgba(210,242,255,.94); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer;">Preview Draft</button>
                        <button type="button" id="vmAdminInstagramPublishBtn" onclick="window.__vmAdminInstagramPublishNow && window.__vmAdminInstagramPublishNow(); return false;" style="position:relative; z-index:2; pointer-events:auto; min-width:156px; padding:10px 15px; border-radius:999px; border:1px solid rgba(255,95,135,.34); background:linear-gradient(180deg,rgba(48,20,34,.92),rgba(27,11,20,.92)); color:rgba(247,237,242,.96); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer;">Publish Now</button>
                      </div>
                      <div id="vmAdminInstagramPreview" style="margin-top:14px; min-height:80px; color:rgba(214,198,210,.7); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55;">Instagram preview will appear here.</div>
                      <div style="margin-top:14px;">
                        <div style="color:rgba(166,235,210,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;">Recent Publish History</div>
                        <div id="vmAdminInstagramHistory" style="margin-top:10px; display:grid; grid-template-columns:minmax(0,1fr); gap:10px;"></div>
                      </div>
                    </div>
                  </div>
                </details>
              </div>
              <details style="margin-top:20px;">
                <summary style="list-style:none; cursor:pointer;">
                  <div style="display:flex; align-items:center; gap:12px;">
                    <div style="flex:1; height:2px; background:linear-gradient(90deg,rgba(255,70,110,.04),rgba(255,70,110,.62),rgba(97,224,255,.56),rgba(255,70,110,.04));"></div>
                  </div>
                  <div style="display:grid; grid-template-columns:30px minmax(0,1fr) auto; align-items:center; gap:10px; margin-top:10px;">
                    <div></div>
                    <div style="color:rgba(255,130,164,.88); font-family:'Orbitron',system-ui,sans-serif; font-size:16px; font-weight:900; letter-spacing:.18em; text-transform:uppercase; text-align:center;">Analytics</div>
                    <div style="min-width:84px; padding:7px 10px; border-radius:999px; border:1px solid rgba(97,224,255,.24); display:flex; align-items:center; justify-content:center; color:rgba(210,242,255,.92); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; margin-left:auto;">Expand</div>
                  </div>
                  <div style="display:flex; align-items:center; gap:12px; margin-top:10px;">
                    <div style="flex:1; height:2px; background:linear-gradient(90deg,rgba(255,70,110,.04),rgba(255,70,110,.62),rgba(97,224,255,.56),rgba(255,70,110,.04));"></div>
                  </div>
                </summary>
                <div style="margin-top:10px;">
                  <div style="margin-top:10px; display:flex; align-items:center; gap:10px 12px; flex-wrap:wrap;">
                    <div style="color:rgba(245,236,242,.9); font-family:'Orbitron',system-ui,sans-serif; font-size:12px; font-weight:900; letter-spacing:.08em; text-transform:uppercase;">Time Period</div>
                    <select id="vmAdminAnalyticsRange" style="min-width:96px; padding:8px 10px; border-radius:999px; border:1px solid rgba(255,95,135,.28); background:rgba(14,8,16,.92); color:rgba(247,237,242,.94); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.08em; text-transform:uppercase;">
                      <option value="24h">24h</option>
                      <option value="7d" selected>7d</option>
                      <option value="30d">30d</option>
                    </select>
                    <button type="button" id="vmAdminAnalyticsRefresh" onclick="window.__vmAdminRefreshAnalytics && window.__vmAdminRefreshAnalytics(); return false;" style="position:relative; z-index:2; pointer-events:auto; min-width:156px; padding:10px 15px; border-radius:999px; border:1px solid rgba(255,95,135,.34); background:linear-gradient(180deg,rgba(48,20,34,.92),rgba(27,11,20,.92)); color:rgba(247,237,242,.96); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer;">Refresh Analytics</button>
                    <button type="button" id="vmAdminAnalyticsReset" onclick="window.__vmAdminResetAnalytics && window.__vmAdminResetAnalytics(); return false;" style="position:relative; z-index:2; pointer-events:auto; min-width:148px; padding:10px 15px; border-radius:999px; border:1px solid rgba(97,224,255,.26); background:linear-gradient(180deg,rgba(11,26,34,.94),rgba(8,16,23,.92)); color:rgba(210,242,255,.94); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer;">Reset Analytics</button>
                  </div>
                </div>
                <div style="display:grid; grid-template-columns:minmax(0,1fr); gap:16px; margin-top:14px;">
                <div data-analytics-section="overview" data-collapsed="false" style="border:1px solid rgba(255,70,110,.18); border-radius:20px; padding:18px; background:linear-gradient(180deg,rgba(12,10,18,.88),rgba(10,8,14,.74)); min-height:0;">
                  <button type="button" data-analytics-toggle="overview" onclick="window.__vmAdminToggleAnalyticsSection && window.__vmAdminToggleAnalyticsSection('overview'); return false;" aria-expanded="true" style="position:relative; z-index:2; pointer-events:auto; display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; padding:0; border:0; background:none; text-align:left; cursor:pointer;">
                    <div>
                      <div style="color:rgba(255,130,164,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:900; letter-spacing:.16em; text-transform:uppercase;">Primary Readout</div>
                      <div style="margin-top:5px; color:rgba(245,236,242,.96); font-family:'Orbitron',system-ui,sans-serif; font-size:18px; font-weight:900; letter-spacing:.04em; text-transform:uppercase;">Overview</div>
                    </div>
                    <div data-analytics-chevron="overview" style="flex:0 0 auto; width:30px; height:30px; border-radius:999px; border:1px solid rgba(97,224,255,.24); display:flex; align-items:center; justify-content:center; color:rgba(210,242,255,.92); font-family:'Orbitron',system-ui,sans-serif; font-size:17px; font-weight:900; line-height:1;">-</div>
                  </button>
                  <div data-analytics-body="overview" style="display:block;">
                    <div id="vmAdminAnalyticsOverview" style="margin-top:14px; color:rgba(214,198,210,.7); font-family:'Orbitron',system-ui,sans-serif; font-size:11px;">Loading analytics overview...</div>
                  </div>
                </div>
                <div data-analytics-section="routes" data-collapsed="false" style="border:1px solid rgba(255,70,110,.18); border-radius:20px; padding:18px; background:linear-gradient(180deg,rgba(12,10,18,.88),rgba(10,8,14,.74)); min-height:0;">
                  <button type="button" data-analytics-toggle="routes" onclick="window.__vmAdminToggleAnalyticsSection && window.__vmAdminToggleAnalyticsSection('routes'); return false;" aria-expanded="true" style="position:relative; z-index:2; pointer-events:auto; display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; padding:0; border:0; background:none; text-align:left; cursor:pointer;">
                    <div style="color:rgba(245,236,242,.96); font-family:'Orbitron',system-ui,sans-serif; font-size:18px; font-weight:900; letter-spacing:.04em; text-transform:uppercase;">Top Routes</div>
                    <div data-analytics-chevron="routes" style="flex:0 0 auto; width:30px; height:30px; border-radius:999px; border:1px solid rgba(97,224,255,.24); display:flex; align-items:center; justify-content:center; color:rgba(210,242,255,.92); font-family:'Orbitron',system-ui,sans-serif; font-size:17px; font-weight:900; line-height:1;">-</div>
                  </button>
                  <div data-analytics-body="routes" style="display:block;">
                    <div id="vmAdminAnalyticsRoutes" style="margin-top:14px; color:rgba(214,198,210,.7); font-family:'Orbitron',system-ui,sans-serif; font-size:11px;">Loading route activity...</div>
                  </div>
                </div>
                <div data-analytics-section="entities" data-collapsed="false" style="border:1px solid rgba(255,70,110,.18); border-radius:20px; padding:18px; background:linear-gradient(180deg,rgba(12,10,18,.88),rgba(10,8,14,.74)); min-height:0;">
                  <button type="button" data-analytics-toggle="entities" onclick="window.__vmAdminToggleAnalyticsSection && window.__vmAdminToggleAnalyticsSection('entities'); return false;" aria-expanded="true" style="position:relative; z-index:2; pointer-events:auto; display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; padding:0; border:0; background:none; text-align:left; cursor:pointer;">
                    <div style="color:rgba(245,236,242,.96); font-family:'Orbitron',system-ui,sans-serif; font-size:18px; font-weight:900; letter-spacing:.04em; text-transform:uppercase;">Top Entities</div>
                    <div data-analytics-chevron="entities" style="flex:0 0 auto; width:30px; height:30px; border-radius:999px; border:1px solid rgba(97,224,255,.24); display:flex; align-items:center; justify-content:center; color:rgba(210,242,255,.92); font-family:'Orbitron',system-ui,sans-serif; font-size:17px; font-weight:900; line-height:1;">-</div>
                  </button>
                  <div data-analytics-body="entities" style="display:block;">
                    <div id="vmAdminAnalyticsEntities" style="margin-top:14px; color:rgba(214,198,210,.7); font-family:'Orbitron',system-ui,sans-serif; font-size:11px;">Loading entity activity...</div>
                  </div>
                </div>
                <div data-analytics-section="events" data-collapsed="false" style="border:1px solid rgba(255,70,110,.18); border-radius:20px; padding:18px; background:linear-gradient(180deg,rgba(12,10,18,.88),rgba(10,8,14,.74)); min-height:0;">
                  <button type="button" data-analytics-toggle="events" onclick="window.__vmAdminToggleAnalyticsSection && window.__vmAdminToggleAnalyticsSection('events'); return false;" aria-expanded="true" style="position:relative; z-index:2; pointer-events:auto; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; width:100%; padding:0; border:0; background:none; text-align:left; cursor:pointer;">
                    <div style="color:rgba(245,236,242,.96); font-family:'Orbitron',system-ui,sans-serif; font-size:18px; font-weight:900; letter-spacing:.04em; text-transform:uppercase;">Recent Events</div>
                    <div style="display:flex; align-items:center; gap:12px; margin-left:auto;">
                      <div style="color:rgba(214,198,210,.64); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Newest activity first / 50 entries</div>
                      <div data-analytics-chevron="events" style="flex:0 0 auto; width:30px; height:30px; border-radius:999px; border:1px solid rgba(97,224,255,.24); display:flex; align-items:center; justify-content:center; color:rgba(210,242,255,.92); font-family:'Orbitron',system-ui,sans-serif; font-size:17px; font-weight:900; line-height:1;">-</div>
                    </div>
                  </button>
                  <div data-analytics-body="events" style="display:block;">
                    <div id="vmAdminAnalyticsEvents" style="margin-top:14px; max-height:460px; overflow-y:auto; padding-right:8px; color:rgba(214,198,210,.7); font-family:'Orbitron',system-ui,sans-serif; font-size:11px;">Loading recent events...</div>
                  </div>
                </div>
                </div>
              </details>
            </div>
          </div>
        `;
      },
      onEnter(){
        if (!isAdminUnlocked()) {
          navigateToRoute('home', { replace: true });
          openAdminModal();
          return;
        }
        const statusEl = document.getElementById('vmAdminStatusLine');
        const analyticsStatusEl = document.getElementById('vmAdminAnalyticsStatus');
        const metaEl = document.getElementById('vmAdminPeopleMeta');
        const rebuildBtn = document.querySelector('[data-admin-rebuild="people"]');
        const analyticsRange = document.getElementById('vmAdminAnalyticsRange');
        const analyticsRefresh = document.getElementById('vmAdminAnalyticsRefresh');
        const analyticsReset = document.getElementById('vmAdminAnalyticsReset');
        const facebookStatusEl = document.getElementById('vmAdminFacebookStatus');
        const instagramStatusEl = document.getElementById('vmAdminInstagramStatus');
        const facebookConnectBtn = document.getElementById('vmAdminFacebookConnect');
        const facebookRefreshBtn = document.getElementById('vmAdminFacebookRefresh');
        const facebookDisconnectBtn = document.getElementById('vmAdminFacebookDisconnect');
        const facebookPreviewBtn = document.getElementById('vmAdminFacebookPreviewBtn');
        const facebookPublishBtn = document.getElementById('vmAdminFacebookPublishBtn');
        const facebookEntityType = document.getElementById('vmAdminFacebookEntityType');
        const facebookLinkMode = document.getElementById('vmAdminFacebookNormalLinkMode');
        const facebookComposerStatus = document.getElementById('vmAdminFacebookComposerStatus');
        const facebookPickerSearch = document.getElementById('vmAdminFacebookPickerSearch');
        const facebookPickerResults = document.getElementById('vmAdminFacebookPickerResults');
        const facebookPickerSelected = document.getElementById('vmAdminFacebookPickerSelected');
        const facebookCaption = document.getElementById('vmAdminFacebookCaption');
        const instagramPickerResults = document.getElementById('vmAdminInstagramPickerResults');
        const instagramPickerSelected = document.getElementById('vmAdminInstagramPickerSelected');
        const facebookCallbackState = readVmFacebookCallbackState();
        const instagramCallbackState = readVmInstagramCallbackState();
        try {
          const liveToken = getAdminToken();
          if (liveToken) {
            window.__VM_ADMIN_TOKEN__ = liveToken;
          }
        } catch (_) {}

        initVmAdminAnalyticsCollapsibles(document.getElementById('vmAdminPanelRoot'));
        initVmAdminCollapsibles(document.getElementById('vmAdminPanelRoot'));

        if (analyticsRange) {
          analyticsRange.addEventListener('change', () => {
            loadVmAdminAnalytics(analyticsRange.value);
          }, { once: false });
        }
        syncVmAdminFacebookEntityTypeUi();
        syncVmAdminInstagramPhotoOptionsUi();
        if (facebookEntityType) {
          facebookEntityType.addEventListener('change', () => {
            syncVmAdminFacebookEntityTypeUi();
          }, { once: false });
        }
        if (facebookLinkMode) {
          facebookLinkMode.addEventListener('change', () => {
            syncVmAdminFacebookEntityTypeUi();
          }, { once: false });
        }
        if (facebookCaption) {
          facebookCaption.addEventListener('input', () => {
            facebookCaption.dataset.vmFacebookAutofill = '';
            refreshVmAdminFacebookMentionSuggestions(facebookCaption);
          }, { once: false });
          facebookCaption.addEventListener('click', () => {
            refreshVmAdminFacebookMentionSuggestions(facebookCaption);
          }, { once: false });
          facebookCaption.addEventListener('keyup', (event) => {
            const key = String(event && event.key || '');
            if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'Enter' || key === 'Escape') return;
            refreshVmAdminFacebookMentionSuggestions(facebookCaption);
          }, { once: false });
          facebookCaption.addEventListener('keydown', (event) => {
            if (!vmAdminFacebookMentionState.active) return;
            const suggestions = getVmAdminFacebookMentionSuggestions();
            if (!suggestions.length) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              vmAdminFacebookMentionState.activeIndex = (vmAdminFacebookMentionState.activeIndex + 1) % suggestions.length;
              renderVmAdminFacebookMentionSuggestions();
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              vmAdminFacebookMentionState.activeIndex = (vmAdminFacebookMentionState.activeIndex - 1 + suggestions.length) % suggestions.length;
              renderVmAdminFacebookMentionSuggestions();
              return;
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              insertVmAdminFacebookMention(suggestions[vmAdminFacebookMentionState.activeIndex] || null);
              return;
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              hideVmAdminFacebookMentionSuggestions();
            }
          }, { once: false });
        }
        const facebookMentionShell = document.getElementById('vmAdminFacebookMentionSuggestions');
        if (facebookMentionShell) {
          facebookMentionShell.addEventListener('click', (event) => {
            const target = event.target;
            const btn = target && target.closest ? target.closest('[data-facebook-mention-id]') : null;
            if (!btn) return;
            const id = String(btn.getAttribute('data-facebook-mention-id') || '').trim();
            const item = getVmAdminFacebookMentionSuggestions().find((entry) => String(entry && entry.id || '').trim() === id) || null;
            insertVmAdminFacebookMention(item);
          }, { once: false });
        }
        if (facebookPickerSearch) {
          facebookPickerSearch.addEventListener('focus', () => {
            if (!vmAdminFacebookPickerState.loaded && !vmAdminFacebookPickerState.loading) {
              loadVmAdminFacebookPickerItems().catch(() => null);
            }
          }, { once: false });
          facebookPickerSearch.addEventListener('input', () => {
            vmAdminFacebookPickerState.query = String(facebookPickerSearch.value || '').trim();
            renderVmAdminFacebookPicker();
          }, { once: false });
        }
        const bindFacebookPickerShell = (shell) => {
          if (!shell) return;
          shell.addEventListener('click', (event) => {
            const target = event.target;
            const browseBtn = target && target.closest ? target.closest('[data-facebook-picker-open-show]') : null;
            if (browseBtn) {
              openVmAdminFacebookPickerShow(String(browseBtn.getAttribute('data-facebook-picker-open-show') || '').trim());
              return;
            }
            const backBtn = target && target.closest ? target.closest('[data-facebook-picker-back]') : null;
            if (backBtn) {
              closeVmAdminFacebookPickerShow();
              return;
            }
            const openMatchBtn = target && target.closest ? target.closest('[data-facebook-picker-open-match]') : null;
            if (openMatchBtn) {
              openVmAdminFacebookPickerMatch(String(openMatchBtn.getAttribute('data-facebook-picker-open-match') || '').trim());
              return;
            }
            const backToMatchBtn = target && target.closest ? target.closest('[data-facebook-picker-back-to-match]') : null;
            if (backToMatchBtn) {
              closeVmAdminFacebookPickerMatch();
              return;
            }
            const pickBtn = target && target.closest ? target.closest('[data-facebook-picker-item]') : null;
            if (pickBtn) {
              selectVmAdminFacebookPickerItem(String(pickBtn.getAttribute('data-facebook-picker-item') || '').trim());
              return;
            }
            const clearBtn = target && target.closest ? target.closest('[data-facebook-picker-clear]') : null;
            if (clearBtn) {
              clearVmAdminFacebookPickerSelection();
            }
          }, { once: false });
        };
        bindFacebookPickerShell(facebookPickerResults);
        bindFacebookPickerShell(facebookPickerSelected);
        bindFacebookPickerShell(instagramPickerResults);
        bindFacebookPickerShell(instagramPickerSelected);
        renderVmAdminFacebookPicker();
        if (!vmAdminFacebookPickerState.loaded && !vmAdminFacebookPickerState.loading) {
          loadVmAdminFacebookPickerItems().catch(() => null);
        }

        verifyAdminAccess().then((ok) => {
          if (!ok) {
            if (facebookStatusEl) facebookStatusEl.textContent = 'Unlock Admin';
            if (instagramStatusEl) instagramStatusEl.textContent = 'Unlock Admin';
            if (facebookComposerStatus) facebookComposerStatus.textContent = 'Unlock Admin to continue';
            setVmAdminFacebookUiState({ connected: false, message: 'Unlock Admin to continue' });
            setVmAdminInstagramUiState({ connected: false, message: 'Unlock Admin to continue' });
            const historyShell = document.getElementById('vmAdminFacebookHistory');
            if (historyShell) {
              historyShell.innerHTML = `<div style="color:rgba(214,198,210,.68); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55;">Unlock Admin to load Facebook publish history.</div>`;
            }
            navigateToRoute('home', { replace: true });
            openAdminModal();
            return;
          }
          if (statusEl) statusEl.textContent = 'Backend access approved';
          try {
            loadVmAdminFacebookStatus({ silent: false });
          } catch (_) {}
          try {
            loadVmAdminInstagramStatus({ silent: false });
          } catch (_) {}
          try {
            loadVmAdminFacebookHistory({ silent: false });
          } catch (_) {}
          try {
            loadVmAdminInstagramHistory({ silent: false });
          } catch (_) {}
          setVmAdminFacebookUiState({ connected: false, message: 'Checking connection...' });
          setVmAdminInstagramUiState({ connected: false, message: 'Checking connection...' });

          if (facebookCallbackState) {
            if (facebookCallbackState.mode === 'connected') {
              if (facebookStatusEl) {
                facebookStatusEl.textContent = facebookCallbackState.pageName
                  ? `Connected to ${facebookCallbackState.pageName}`
                  : 'Page connected';
              }
              if (facebookComposerStatus) {
                facebookComposerStatus.textContent = facebookCallbackState.pageName
                  ? `Facebook connected to ${facebookCallbackState.pageName}`
                  : 'Connection complete';
              }
              setVmAdminFacebookUiState({
                connected: true,
                message: facebookCallbackState.pageName
                  ? `Connected to ${facebookCallbackState.pageName}`
                  : 'Connection complete'
              });
              try {
                loadVmAdminFacebookStatus({ silent: true });
                loadVmAdminFacebookHistory({ silent: true });
              } catch (_) {}
            } else if (facebookCallbackState.mode === 'error') {
              const msg = facebookCallbackState.message || 'Facebook connection failed';
              if (facebookStatusEl) facebookStatusEl.textContent = 'Facebook connection error';
              if (facebookComposerStatus) facebookComposerStatus.textContent = msg;
              setVmAdminFacebookUiState({ connected: false, message: msg });
            }
            clearVmFacebookCallbackState();
          }

          if (instagramCallbackState) {
            if (instagramCallbackState.mode === 'connected') {
              if (instagramStatusEl) {
                instagramStatusEl.textContent = instagramCallbackState.instagramUsername
                  ? `Connected to @${instagramCallbackState.instagramUsername}`
                  : 'Instagram connected';
              }
              setVmAdminInstagramUiState({
                connected: true,
                message: instagramCallbackState.instagramUsername
                  ? `Connected to @${instagramCallbackState.instagramUsername}`
                  : 'Connection complete'
              });
              try {
                loadVmAdminInstagramStatus({ silent: true });
                loadVmAdminInstagramHistory({ silent: true });
              } catch (_) {}
            } else if (instagramCallbackState.mode === 'error') {
              const msg = instagramCallbackState.message || 'Instagram connection failed';
              if (instagramStatusEl) instagramStatusEl.textContent = 'Instagram connection error';
              setVmAdminInstagramUiState({ connected: false, message: msg });
            }
            clearVmInstagramCallbackState();
          }

          try {
            loadVmAdminIndexingTable();
          } catch (_) {}

          const initialAnalyticsRange = analyticsRange ? analyticsRange.value : '7d';
          try {
            scheduleVmAdminAnalyticsAutoload(initialAnalyticsRange, { delayMs: 350, maxAttempts: 8 });
          } catch (_) {
            loadVmAdminAnalytics(initialAnalyticsRange);
          }

          __vmAdminFetch('/admin/verify', { method: 'GET' })
            .then((res) => res.json().catch(() => ({})).then((data) => ({ ok: res.ok, data })))
            .then(({ ok, data }) => {
              if (!ok) {
                if (statusEl) statusEl.textContent = 'Backend verification failed';
                if (facebookStatusEl) facebookStatusEl.textContent = 'Admin verify failed';
                return;
              }
              if (statusEl && data && data.expiresAt) {
                statusEl.textContent = `Backend access approved until ${new Date(data.expiresAt).toLocaleString()}`;
              }
              if (facebookStatusEl && (!facebookCallbackState || facebookCallbackState.mode !== 'error')) {
                if (String(facebookStatusEl.textContent || '').trim().toLowerCase() === 'waiting for status...' || String(facebookStatusEl.textContent || '').trim().toLowerCase() === 'admin verify failed') {
                  facebookStatusEl.textContent = 'Admin token verified';
                }
              }
              if (instagramStatusEl && (!instagramCallbackState || instagramCallbackState.mode !== 'error')) {
                if (String(instagramStatusEl.textContent || '').trim().toLowerCase() === 'checking status...' || String(instagramStatusEl.textContent || '').trim().toLowerCase() === 'admin verify failed') {
                  instagramStatusEl.textContent = 'Admin token verified';
                }
              }
            })
            .catch(() => {
              if (statusEl) statusEl.textContent = 'Backend access approved';
            });
        });
      },
      onLeave(){}
    }
  };

  
  let currentRoute = null;
  let lastTrackedPageviewRoute = '';

  function currentAnalyticsRoute(route){
    const key = sanitizeRouteKey(route) || currentRouteKey() || 'home';
    try {
      const pathname = String(location.pathname || '').trim();
      if (pathname) return pathname;
    } catch (_) {}
    return routePathForKey(key);
  }

  function trackShellPageview(route, opts){
    try {
      if (!window.VMPixAnalytics || typeof window.VMPixAnalytics.beginPageview !== 'function') return;

      const analyticsRoute = currentAnalyticsRoute(route);
      const classified = (typeof window.VMPixAnalytics.classifyRoute === 'function')
        ? window.VMPixAnalytics.classifyRoute(analyticsRoute)
        : { route: analyticsRoute, section: sanitizeRouteKey(route) || 'home', subsection: '' };
      const normalizedRoute = String((classified && classified.route) || analyticsRoute || '').trim();
      const force = !!(opts && opts.force);

      if (!normalizedRoute) return;
      if (String((classified && classified.section) || '') === 'admin') return;
      if (!force && normalizedRoute === lastTrackedPageviewRoute) return;

      lastTrackedPageviewRoute = normalizedRoute;

      window.VMPixAnalytics.beginPageview({
        route: normalizedRoute,
        section: String((classified && classified.section) || ''),
        subsection: String((classified && classified.subsection) || ''),
        source: 'site_shell',
        entity_type: 'page',
        entity_id: normalizedRoute,
        entity_label: sanitizeRouteKey(route) || currentRouteKey() || 'home',
        meta: {
          route_key: sanitizeRouteKey(route) || currentRouteKey() || 'home'
        }
      });
    } catch (_) {}
  }


// =============================
// Route Transitions (DIM â†’ WIPE â†’ LOAD)
// Goal (per your latest notes):
//  1) Click â†’ screen dims fully to black (everything hidden)
//  2) As soon as dim completes, run a diagonal wipe ON TOP of the blackout (slower)
//  3) DOM swap happens while fully black (no peeking / no flinches)
//  4) As soon as wipe completes, fade back in immediately (no extra hold)
// =============================
let _isRouting = false;
let _queuedRoute = null;

function prefersReducedMotion(){
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}



// Premium polish helpers (surgical): route sheen + "settle in" for new content.
// - No continuous motion.
// - Runs only on route changes.
// - Honors prefers-reduced-motion.
function ensureSheenLayer(){
  if (document.getElementById('hudRouteSheen')) return;
  const hudEl = document.getElementById('hud');
  if (!hudEl) return;

  const s = document.createElement('div');
  s.id = 'hudRouteSheen';
  // Keep it inside the HUD box; CSS handles visuals.
  hudEl.appendChild(s);
}

function triggerRouteSheen(){
  const hudEl = document.getElementById('hud');
  if (!hudEl) return;

  ensureSheenLayer();

  // Restart CSS animation by toggling a class.
  hudEl.classList.remove('route-sheen');
  void hudEl.offsetWidth; // force reflow
  hudEl.classList.add('route-sheen');

  window.setTimeout(() => {
    hudEl.classList.remove('route-sheen');
  }, 520);
}

function runEnterSettle(durationMs){
  if (prefersReducedMotion()) return;

  const m = mount();
  if (!m) return;

  // Avoid stacking animations
  try { if (m._enterAnim) m._enterAnim.cancel(); } catch(_){}

  try{
    const anim = m.animate(
      [
        { transform: 'translate3d(0,6px,0)', filter: 'blur(1px)', opacity: 0.98 },
        { transform: 'translate3d(0,0,0)', filter: 'blur(0px)', opacity: 1 }
      ],
      { duration: Math.max(220, durationMs || 320), easing: 'cubic-bezier(.2,.85,.2,1)', fill: 'both' }
    );
    m._enterAnim = anim;
    anim.finished.finally(() => { try{ m._enterAnim = null; } catch(_){} });
  }catch(_){
    // If WAAPI isn't supported, skip quietly.
  }
}
// Tunables (requested)
const DIM_OUT_MS  = 180;  // dim-to-black
const WIPE_MS     = 0;    // disabled: no continuous diagonal wipe
const DIM_IN_MS   = 180;  // fade back in
const SWAP_SETTLE_RAFS = 2; // settle frames while fully black



function ensureRouteTransitionStyles(){
  if (document.getElementById('hudRouteTransitionStyles')) return;

  const s = document.createElement('style');
  s.id = 'hudRouteTransitionStyles';
  s.textContent = `
    body.is-routing .hudStub [data-nav]{ pointer-events:none !important; }
    body.is-routing #hud{ pointer-events:none; }

    /* Full-screen blackout layer (always above everything) */
    #hudRouteDim{
      position:fixed;
      inset:0;
      background: rgba(0,0,0,0.96);
      opacity:0;
      pointer-events:none;
      z-index: 2147483000;
      will-change: opacity;
      backface-visibility: hidden;
      transform: translateZ(0);
    }

    /* Diagonal wipe edge (rides on top of the blackout) */
    #hudRouteDim .wipeEdge{
      position:absolute;
      left:50%;
      top:50%;
      width: 34vmax;
      height: 240vmax;
      transform: translate3d(-9999px,-9999px,0) rotate(45deg);
      opacity: 0.92;
      will-change: transform, opacity, filter;
      background: linear-gradient(90deg,
        rgba(0,0,0,0) 0%,
        rgba(255,  0, 90, 0.38) 42%,
        rgba(  0,255,255,0.30) 58%,
        rgba(0,0,0,0) 100%
      );
      filter: blur(0.45px) saturate(1.35);
      mix-blend-mode: screen;
      backface-visibility: hidden;
      transform-style: preserve-3d;
    }

    /* Ember sync target (canvas) â€” brightness driven by --emberBoost */
    #hudEmbers{
      will-change: filter;
      filter: brightness(calc(1 + var(--emberBoost, 0))) saturate(calc(1 + (var(--emberBoost, 0) * 0.55)));
      transition: filter 80ms linear;
    }

    @media (prefers-reduced-motion: reduce){
      #hudRouteDim{ display:none !important; }
      #hudEmbers{ transition:none !important; }
    }
  `;
  document.head.appendChild(s);
}

function ensureDimLayer(){
  if (document.getElementById('hudRouteDim')) return;
  const d = document.createElement('div');
  d.id = 'hudRouteDim';

  const edge = document.createElement('div');
  edge.className = 'wipeEdge';

  d.appendChild(edge);
  document.body.appendChild(d);
}

function lockHudMainHeight(lock){
  const hudMain = document.querySelector('.hudStub.hudMain');
  if (!hudMain || !lock) return () => {};
  const h = hudMain.getBoundingClientRect().height || hudMain.offsetHeight || 0;
  const prev = {
    height: hudMain.style.height || '',
    minHeight: hudMain.style.minHeight || '',
    overflow: hudMain.style.overflow || ''
  };
  if (h > 0){
    hudMain.style.height = h + 'px';
    hudMain.style.minHeight = h + 'px';
    hudMain.style.overflow = 'hidden';
  }
  return () => {
    hudMain.style.height = prev.height;
    hudMain.style.minHeight = prev.minHeight;
    hudMain.style.overflow = prev.overflow;
  };
}

const sleep = (ms) => new Promise(r => window.setTimeout(r, ms));

// rAF progress driver so we can sync embers + edge position smoothly.
function driveProgress(durationMs, onProgress){
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.max(0, Math.min(1, (now - t0) / Math.max(1, durationMs)));
      // easeInOutCubic-ish
      const e = p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3)/2;
      try { onProgress(e, p); } catch(_){}
      if (p < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

async function fadeDim(toOpacity, ms){
  const dim = document.getElementById('hudRouteDim');
  if (!dim) return;
  const from = parseFloat(getComputedStyle(dim).opacity || '0') || 0;
  if (ms <= 0 || from === toOpacity){
    dim.style.opacity = String(toOpacity);
    return;
  }
  try{
    const anim = dim.animate(
      [{ opacity: from }, { opacity: toOpacity }],
      { duration: ms, easing: 'linear', fill: 'forwards' }
    );
    await anim.finished.catch(() => {});
  }catch(_){
    dim.style.opacity = String(toOpacity);
    await sleep(ms);
  }
}

async function runDiagonalWipe(ms){
  const dim = document.getElementById('hudRouteDim');
  const edge = dim ? dim.querySelector('.wipeEdge') : null;
  if (!edge) return;

  // Travel distance so the stripe fully sweeps the screen
  const w = window.innerWidth || 1;
  const h = window.innerHeight || 1;
  const d = Math.max(w, h) * 1.35;

  // Start TL-ish, end BR-ish relative to center
  const sx = -d, sy = -d;
  const ex =  d, ey =  d;

  // Initialize offscreen to avoid a 1-frame pop
  edge.style.transform = `translate3d(${sx}px, ${sy}px, 0) rotate(45deg)`;

  await driveProgress(ms, (eased) => {
    const x = sx + (ex - sx) * eased;
    const y = sy + (ey - sy) * eased;
    edge.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(45deg)`;

    // Ember sync (peak mid-wipe)
    const boost = 0.42 * Math.sin(Math.PI * eased);
    document.documentElement.style.setProperty('--emberBoost', boost.toFixed(4));
  });

  // Park edge out of view after wipe
  edge.style.transform = `translate3d(${ex + d}px, ${ey + d}px, 0) rotate(45deg)`;
}

async function transitionTo(route){
  const next = modules[route] ? route : 'home';

  if (next === currentRoute){
    setActiveTopNav(next);
    try {
      if (next === 'music' && window.MusicArchive && typeof window.MusicArchive.onEnter === 'function') {
        window.MusicArchive.onEnter();
      }
    } catch (_) {}
    trackShellPageview(next);
    return;
  }

  const reduce = prefersReducedMotion();

  _isRouting = true;
  ensureRouteTransitionStyles();
  ensureDimLayer();
  document.body.classList.add('is-routing');

  const dim = document.getElementById('hudRouteDim');
  if (dim) dim.style.display = 'block';

  const unlock = lockHudMainHeight(!reduce);

  // 1) DIM TO BLACK (everything hidden under this layer)
  if (!reduce){
    await fadeDim(1, DIM_OUT_MS);
  }

  // 2) SWAP while fully black (no peeks)
  if (currentRoute && modules[currentRoute] && typeof modules[currentRoute].onLeave === 'function'){
    try { modules[currentRoute].onLeave(); } catch(e) {}
  }

  document.body.classList.remove('route-home','route-music','route-wrestling','route-calendar','route-about','route-pricing','route-contact');
  document.body.classList.add(`route-${next}`);

  setActiveTopNav(next);
  stopAllTyping();

  // IMPORTANT: clean up the previous route before mounting the next one.
  // This prevents cross-route modules (ex: Music) from staying mounted on Wrestling.
  if (currentRoute && modules[currentRoute] && typeof modules[currentRoute].onLeave === 'function'){
    try { modules[currentRoute].onLeave(); } catch(_){ }
  }

  modules[next].render();
  currentRoute = next;

  // Let layout settle UNDER BLACK
  for (let i=0; i<SWAP_SETTLE_RAFS; i++){
    await new Promise(r => window.requestAnimationFrame(r));
  }

  // Fire onEnter under black so first paints happen hidden
  try { modules[next].onEnter && modules[next].onEnter(); } catch(_){}
  trackShellPageview(next);

  // One more settle frame
  await new Promise(r => window.requestAnimationFrame(r));

  // 3) DIAGONAL WIPE (on top of blackout) â€” slower
  if (!reduce && WIPE_MS > 0){
    await runDiagonalWipe(WIPE_MS);
  }

  // 4) Fade back in immediately after wipe (no extra hold)
  pulseFrame();
  triggerRouteSheen();
  runEnterSettle(DIM_IN_MS + 160);
  if (!reduce){
    await fadeDim(0, DIM_IN_MS);
  }

  // Cleanup
  unlock();
  document.body.classList.remove('is-routing');
  _isRouting = false;

  try { document.documentElement.style.setProperty('--emberBoost', '0'); } catch(_){}

  if (_queuedRoute && _queuedRoute !== currentRoute){
    const q = _queuedRoute;
    _queuedRoute = null;
    transitionTo(q);
  } else {
    _queuedRoute = null;
  }
}

function navigate(route){
  transitionTo(route);
}


  
  // ============================================================
  // Mobile Back-Button / History Behavior (updated)
  // Goal:
  //  - Back button should move to the last in-site view (hash route)
  //  - Avoid accidentally dropping out of the site when a hash is cleared
  // How:
  //  - Persist last non-empty hash in sessionStorage
  //  - If a navigation/back results in an empty hash, restore the last hash
  // ============================================================
  const LAST_HASH_KEY = 'vmpix:lastHash';
  let _restoringHash = false;

  function normalizeHash(h){
    const s = (h || '').trim();
    if (!s) return '';
    if (s === '#') return '';
    if (s.startsWith('#/')) return s;
    if (s.startsWith('#')) return '#/' + s.slice(1).replace(/^\/+/, '');
    return '#/' + s.replace(/^\/+/, '');
  }

  function getLastHash(){
    try { return normalizeHash(sessionStorage.getItem(LAST_HASH_KEY) || ''); } catch(_){ return ''; }
  }

  function setLastHash(h){
    const nh = normalizeHash(h);
    if (!nh) return;
    try { sessionStorage.setItem(LAST_HASH_KEY, nh); } catch(_){}
  }

      function restoreHash(){
    if (_restoringHash) return;
    _restoringHash = true;
    syncUrlToRoute('home', { replace: true });
    navigate('home');
    window.setTimeout(() => { _restoringHash = false; }, 0);
  }


  // ============================================================
  // Back-button behavior: unwind internal route levels first, then stay on Home.
  // ============================================================
  const __VM_BACK_GUARD_STATE = { __vmpixBackGuard: true };

  function buildInternalPathTrail(pathname){
    const path = String(pathname || '').trim() || '/';
    const clean = '/' + path.replace(/^\/+|\/+$/g, '');
    const parts = clean.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    if (!parts.length) return ['/'];

    const top = String(parts[0] || '').toLowerCase();
    if (top === 'music') {
      const trail = ['/', '/music'];
      const sub = String(parts[1] || '').toLowerCase();
      if (sub) trail.push('/music/' + sub);
      if (sub === 'people') {
        const personSlug = String(parts[2] || '').trim();
        if (personSlug) trail.push('/music/people/' + personSlug);
      }
      if (sub === 'bands') {
        const band = String(parts[2] || '').trim();
        const album = String(parts[3] || '').trim();
        if (band) trail.push('/music/bands/' + band);
        if (band && album) trail.push('/music/bands/' + band + '/' + album);
      }
      if (sub === 'shows') {
        const showCode = String(parts[2] || '').trim();
        if (showCode) trail.push('/music/shows/' + showCode);
      }
      return trail.filter((value, index, arr) => arr.indexOf(value) === index);
    }

    if (top === 'wrestling') {
      const trail = ['/', '/wrestling'];
      const sub = String(parts[1] || '').toLowerCase();
      if (sub) trail.push('/wrestling/' + sub);
      return trail.filter((value, index, arr) => arr.indexOf(value) === index);
    }

    return ['/', clean].filter((value, index, arr) => arr.indexOf(value) === index);
  }

  function seedInternalHistoryTrail(){
    try {
      if (history.state && history.state.__vmpixTrailSeeded) return;
      const trail = buildInternalPathTrail(location.pathname || '/');
      if (!trail.length) return;
      const search = location.search || '';
      history.replaceState({ __vmpixTrailSeeded: true, __vmpixPath: trail[0] }, document.title, trail[0] + search);
      if (trail.length === 1) {
        history.pushState({ __vmpixBackGuard: true, __vmpixPath: trail[0] }, document.title, trail[0] + search);
        return;
      }
      for (let i = 1; i < trail.length; i += 1) {
        history.pushState({ __vmpixTrailSeeded: true, __vmpixPath: trail[i] }, document.title, trail[i] + search);
      }
    } catch (_) {}
  }

  function installBackGuard(){
    if (installBackGuard._installed) return;
    installBackGuard._installed = true;

    seedInternalHistoryTrail();

    window.addEventListener('popstate', () => {
      const pathRoute = routeKeyFromPath();
      if (!pathRoute){
        restoreHash();
        return;
      }

      navigate(currentRouteKey());

      try {
        const pathname = String(location.pathname || '').trim() || '/';
        if (pathname === '/') {
          history.pushState({ __vmpixBackGuard: true, __vmpixPath: '/' }, document.title, '/' + (location.search || ''));
        }
      } catch (_) {}
    });
  }

window.addEventListener('hashchange', () => {
    const hashRoute = sanitizeRouteKey(String(location.hash || '').replace(/^#\/?/, '').trim());
    if (hashRoute) {
      syncUrlToRoute(hashRoute, { replace: true });
      navigate(hashRoute);
      return;
    }

    const pathRoute = routeKeyFromPath();
    if (!pathRoute) {
      restoreHash();
      return;
    }
    navigate(pathRoute);
  });

        (function(){
    installBackGuard();
    const hashRoute = sanitizeRouteKey(String(location.hash || '').replace(/^#\/?/, '').trim());
    const pathRoute = routeKeyFromPath();

    if (hashRoute) {
      syncUrlToRoute(hashRoute, { replace: true });
      navigate(hashRoute);
      return;
    }

    if (pathRoute) {
      navigate(pathRoute);
      syncUrlToRoute(pathRoute, { replace: true, preservePath: true });
      return;
    }

    syncUrlToRoute('home', { replace: true });
    navigate('home');
  })();
  // =============================
  // MAIN MENU ATMOSPHERE: Embers canvas (copied exactly from your HUD)
  // =============================
  (function(){
    const hero = document.getElementById('hud');
    const canvas = document.getElementById('hudEmbers');
    if (!hero || !canvas) return;

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let w = 0, h = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
    const particles = [];
    const COUNT = 350;

    let lastW = -1, lastH = -1;
    function resize(){
      const r = hero.getBoundingClientRect();
      const nw = Math.max(1, Math.floor(r.width));
      const nh = Math.max(1, Math.floor(r.height));

      if (nw === lastW && nh === lastH) return;
      lastW = nw; lastH = nh;

      w = nw; h = nh;
      canvas.width  = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr,0,0,dpr,0,0);
    }

    function spawn(i){
      particles[i] = {
        x: Math.random() * w,
        y: h + Math.random() * (h * 0.25),
        r: 0.8 + Math.random() * 2.2,
        vy: 0.45 + Math.random() * 1.25,
        vx: (Math.random() - 0.5) * 0.75,
        a: 0.12 + Math.random() * 0.30,
        tw: 0.7 + Math.random() * 1.6,
        ph: Math.random() * Math.PI * 2
      };
    }

    function init(){
      resize();
      particles.length = 0;
      for (let i=0; i<COUNT; i++) spawn(i);
    }

    let t0 = performance.now();
    function tick(now){
      const dt = Math.min(40, now - t0);
      t0 = now;

      // Smooth 2s plasma pulse (avoids fast flame flicker)
      const pulse = 0.82 + 0.18 * Math.sin((now / 2000) * Math.PI * 2);

      ctx.clearRect(0,0,w,h);

      const g = ctx.createRadialGradient(w*0.5,h*0.55, 10, w*0.5,h*0.55, Math.max(w,h)*0.75);
      g.addColorStop(0, 'rgba(0,255,255,0.07)');
      g.addColorStop(0.35, 'rgba(160,70,255,0.06)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0,0,w,h);

      // Reactor "plasma tongue" wisps + base glow (sciâ€‘fi upgrade)
      const prevComp = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';

      // Base reactor glow (subtle, anchored near bottom-center)
      {
        const cx = w * 0.5;
        const cy = h * 0.90;
        const rx = Math.max(80, w * 0.26);
        const ry = Math.max(28, h * 0.06);

        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
        bg.addColorStop(0, `rgba(0,255,255,${0.10 * pulse})`);
        bg.addColorStop(0.45, `rgba(160,70,255,${0.08 * pulse})`);
        bg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bg;

        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Plasma ribbons (controlled, engineered motion â€” not chaotic flame flicker)
      const RIBBONS = 7;
      for (let r = 0; r < RIBBONS; r++){
        const phase = (now / 1550) + (r * 2.15);
        const mid = (RIBBONS - 1) * 0.5;
        const spread = (r - mid) / (mid || 1); // -1..1
        const x0 = w * (0.50 + spread * 0.18 + 0.018 * Math.sin(phase * 0.78));
        const y0 = h * 0.95;

        ctx.beginPath();
        ctx.moveTo(x0, y0);

        const steps = 22;
        for (let s = 1; s <= steps; s++){
          const t = s / steps;

          const driftX = Math.sin(phase + t * 3.35) * (w * 0.11) * Math.pow(1 - t, 0.85);
          const wiggle = Math.cos((phase * 1.18) + t * 4.2) * (h * 0.018);

          const x = x0 + driftX;
          const y = y0 - (t * h * 0.78) + wiggle;

          ctx.lineTo(x, y);
        }

        // Two-pass stroke for "core + halo"
        const wght = 1 - Math.min(1, Math.abs(spread) * 0.55);
        const coreA = (0.10 + r * 0.012) * pulse * wght;
        const haloA = (0.06 + r * 0.010) * pulse * wght;

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.strokeStyle = `rgba(255,255,255,${coreA * 0.55})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.strokeStyle = `rgba(0,255,255,${coreA})`;
        ctx.lineWidth = 2.6;
        ctx.stroke();

        ctx.strokeStyle = `rgba(160,70,255,${haloA})`;
        ctx.lineWidth = 5.4;
        ctx.stroke();
      }

      ctx.globalCompositeOperation = prevComp;


      for (let i=0; i<particles.length; i++){
        const p = particles[i];
        p.y -= p.vy * (dt/16.7);
        p.x += p.vx * (dt/16.7);
        p.ph += 0.03 * p.tw;

        if (p.y < -30 || p.x < -60 || p.x > w + 60) spawn(i);

        const flick = 0.78 + 0.22*Math.sin(p.ph);
        const alpha = p.a * flick * pulse;

        ctx.beginPath();
        ctx.fillStyle = `rgba(0,255,255,${alpha})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fill();

        // Subtle chromatic aberration (sciâ€‘fi split)
        ctx.beginPath();
        ctx.fillStyle = `rgba(160,70,255,${alpha*0.55})`;
        ctx.arc(p.x + 1.6, p.y, p.r * 0.98, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = `rgba(0,200,255,${alpha*0.45})`;
        ctx.arc(p.x - 1.4, p.y, p.r * 0.92, 0, Math.PI*2);
        ctx.fill();

        ctx.beginPath();
        ctx.strokeStyle = `rgba(0,255,255,${alpha*0.55})`;
        ctx.lineWidth = 1;
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx*14, p.y + p.vy*16);
        ctx.stroke();

        // Secondary plasma tint streak
        ctx.beginPath();
        ctx.strokeStyle = `rgba(160,70,255,${alpha*0.32})`;
        ctx.lineWidth = 1;
        ctx.moveTo(p.x + 1.2, p.y);
        ctx.lineTo(p.x + 1.2 - p.vx*12, p.y + p.vy*14);
        ctx.stroke();
      }

      requestAnimationFrame(tick);
    }

    init();
    requestAnimationFrame(tick);

    if ('ResizeObserver' in window){
      const ro = new ResizeObserver(() => resize());
      ro.observe(hero);
    } else {
      window.addEventListener('resize', resize, { passive: true });
    }
  })();

  window.VMPixNavigate = navigateToRoute;
  window.VMPixSetTitle = setDocumentTitle;
  window.VMPixBuildTitle = buildDocumentTitle;
})();








