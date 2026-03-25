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
    const configBits = [
      cfg.app_id_configured ? 'App ID ready' : 'App ID missing',
      cfg.app_secret_configured ? 'App Secret ready' : 'App Secret missing',
      cfg.redirect_uri_configured ? 'Redirect URI ready' : 'Redirect URI missing'
    ];

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
          <div style="margin-top:8px; color:rgba(245,236,242,.94); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.65;">${escapeVmAdminHtml(configBits.join(' • '))}</div>
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
    if (connectBtn) {
      connectBtn.textContent = connected ? 'Manage Connection' : 'Connect Page';
      connectBtn.disabled = busy;
    }
    if (refreshBtn) refreshBtn.disabled = busy;
    if (disconnectBtn) disconnectBtn.disabled = busy || !connected;
    if (previewBtn) previewBtn.disabled = busy || !connected;
    if (publishBtn) publishBtn.disabled = busy || !connected;
    if (composerStatus && options.message) composerStatus.textContent = options.message;
    if (previewShell && options.clearPreview) previewShell.innerHTML = 'Facebook preview will appear here.';
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
        status.textContent = connected ? 'Page linked' : 'Page not linked';
        setVmAdminFacebookUiState({
          connected,
          message: connected ? 'Ready to preview or publish' : 'Connect a Facebook page to continue'
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
        return `
          <div style="border:1px solid rgba(255,255,255,.06); border-radius:14px; padding:12px; background:rgba(9,10,16,.72);">
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
              <div>
                <div style="color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:900; letter-spacing:.06em; text-transform:uppercase;">${escapeVmAdminHtml(item.entity_label || item.entity_id || 'Unknown item')}</div>
                <div style="margin-top:4px; color:rgba(208,222,232,.72); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.5;">${escapeVmAdminHtml(formatVmAdminDate(item.created_at))}</div>
              </div>
              <div style="padding:6px 9px; border-radius:999px; border:1px solid ${ok ? 'rgba(97,224,255,.22)' : 'rgba(255,95,135,.28)'}; color:${ok ? 'rgba(210,242,255,.92)' : 'rgba(255,192,205,.92)'}; font-family:'Orbitron',system-ui,sans-serif; font-size:9px; font-weight:800; letter-spacing:.1em; text-transform:uppercase;">${escapeVmAdminHtml(ok ? 'Success' : (item.status || 'Failed'))}</div>
            </div>
            <div style="margin-top:8px; color:rgba(214,198,210,.72); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; line-height:1.55;">${escapeVmAdminHtml(item.section || 'section')} • ${escapeVmAdminHtml(item.entity_type || 'show')}</div>
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
    const payload = {
      section: String((document.getElementById('vmAdminFacebookSection') || {}).value || '').trim(),
      entity_type: String((document.getElementById('vmAdminFacebookEntityType') || {}).value || '').trim(),
      entity_id: String((document.getElementById('vmAdminFacebookEntityId') || {}).value || '').trim(),
      entity_label: String((document.getElementById('vmAdminFacebookEntityLabel') || {}).value || '').trim(),
      caption: String((document.getElementById('vmAdminFacebookCaption') || {}).value || '').trim(),
      link_url: String((document.getElementById('vmAdminFacebookLinkUrl') || {}).value || '').trim(),
      image_url: String((document.getElementById('vmAdminFacebookImageUrl') || {}).value || '').trim()
    };
    setVmAdminFacebookUiState({ connected: true, busy: true, message: 'Building preview...' });
    if (status) status.textContent = 'Building preview...';
    try {
      const data = await postVmAdminJsonWithExplicitToken('/admin/facebook/preview', payload);
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
              <div style="margin-top:10px; color:rgba(214,198,210,.8); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.65; white-space:pre-wrap;">${escapeVmAdminHtml(preview.final_message || '')}</div>
            </div>
          </div>
        `;
      }
      if (status) status.textContent = 'Preview ready';
      setVmAdminFacebookUiState({ connected: true, message: 'Preview ready' });
      return payload;
    } catch (err) {
      if (previewShell) previewShell.innerHTML = `<div style="color:rgba(255,168,168,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55;">Unable to build preview right now.</div>`;
      if (status) status.textContent = 'Preview failed';
      setVmAdminFacebookUiState({ connected: true, message: messageFromVmAdminError(err, 'Preview failed') });
      throw err;
    }
  }

  async function runVmAdminFacebookPublish(){
    const status = document.getElementById('vmAdminFacebookComposerStatus');
    setVmAdminFacebookUiState({ connected: true, busy: true, message: 'Publishing post...' });
    if (status) status.textContent = 'Publishing post...';
    try {
      const payload = await runVmAdminFacebookPreview();
      await postVmAdminJsonWithExplicitToken('/admin/facebook/publish', payload || {});
      if (status) status.textContent = 'Post published';
      setVmAdminFacebookUiState({ connected: true, message: 'Post published' });
      await loadVmAdminFacebookStatus({ silent: true });
      await loadVmAdminFacebookHistory({ silent: false });
    } catch (_) {
      if (status) status.textContent = 'Publish failed';
      setVmAdminFacebookUiState({ connected: true, message: messageFromVmAdminError(_, 'Publish failed') });
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
              <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:14px; margin-top:16px;">
                <div style="border:1px solid rgba(255,70,110,.18); border-radius:18px; padding:16px; background:linear-gradient(180deg,rgba(17,11,25,.92),rgba(12,10,18,.72));">
                  <div style="color:rgba(245,236,242,.94); font-family:'Orbitron',system-ui,sans-serif; font-size:14px; font-weight:900; letter-spacing:.05em; text-transform:uppercase;">People Index Tools</div>
                  <div style="margin-top:8px; color:rgba(214,198,210,.74); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55;">Rebuild, inspect, and validate the wrestling people index from the same Admin shell.</div>
                  <div id="vmAdminPeopleMeta" style="margin-top:12px; min-height:34px; color:rgba(208,222,232,.82); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.5;">Waiting for rebuild status...</div>
                  <button type="button" data-admin-rebuild="people" style="margin-top:12px; min-width:148px; padding:10px 15px; border-radius:999px; border:1px solid rgba(255,95,135,.34); background:linear-gradient(180deg,rgba(48,20,34,.92),rgba(27,11,20,.92)); color:rgba(247,237,242,.96); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer;">Rebuild Index</button>
                </div>
                <div style="border:1px solid rgba(255,70,110,.18); border-radius:18px; padding:16px; background:linear-gradient(180deg,rgba(17,11,25,.92),rgba(12,10,18,.72));">
                  <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
                    <div>
                      <div style="color:rgba(245,236,242,.94); font-family:'Orbitron',system-ui,sans-serif; font-size:14px; font-weight:900; letter-spacing:.05em; text-transform:uppercase;">Facebook Publishing</div>
                      <div style="margin-top:8px; color:rgba(214,198,210,.74); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55;">Manage the live page connection here, then use the composer below for posting tests.</div>
                    </div>
                    <div id="vmAdminFacebookStatus" style="padding:8px 10px; border-radius:999px; border:1px solid rgba(97,224,255,.22); background:rgba(10,18,24,.72); color:rgba(210,242,255,.9); font-family:'Orbitron',system-ui,sans-serif; font-size:9px; font-weight:800; letter-spacing:.1em; text-transform:uppercase;">Checking status...</div>
                  </div>
                  <div id="vmAdminFacebookMeta" style="margin-top:12px; min-height:52px; color:rgba(208,222,232,.82); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55;">Loading Facebook connection details...</div>
                  <div style="margin-top:14px; display:flex; gap:8px; flex-wrap:wrap;">
                    <button type="button" id="vmAdminFacebookConnect" onclick="window.__vmAdminFacebookConnect && window.__vmAdminFacebookConnect(); return false;" style="position:relative; z-index:2; pointer-events:auto; min-width:168px; padding:10px 15px; border-radius:999px; border:1px solid rgba(97,224,255,.28); background:linear-gradient(180deg,rgba(11,26,34,.94),rgba(8,16,23,.92)); color:rgba(210,242,255,.94); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer;">Connect Page</button>
                    <button type="button" id="vmAdminFacebookRefresh" onclick="window.__vmAdminRefreshFacebook && window.__vmAdminRefreshFacebook(); return false;" style="position:relative; z-index:2; pointer-events:auto; min-width:144px; padding:10px 15px; border-radius:999px; border:1px solid rgba(255,255,255,.08); background:linear-gradient(180deg,rgba(23,18,29,.94),rgba(13,11,18,.92)); color:rgba(247,237,242,.94); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer;">Refresh Status</button>
                    <button type="button" id="vmAdminFacebookDisconnect" onclick="window.__vmAdminFacebookDisconnect && window.__vmAdminFacebookDisconnect(); return false;" style="position:relative; z-index:2; pointer-events:auto; min-width:156px; padding:10px 15px; border-radius:999px; border:1px solid rgba(255,95,135,.34); background:linear-gradient(180deg,rgba(48,20,34,.92),rgba(27,11,20,.92)); color:rgba(247,237,242,.96); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer;">Disconnect</button>
                  </div>
                  <div style="margin-top:16px; border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:14px; background:linear-gradient(180deg,rgba(9,12,18,.84),rgba(6,8,14,.86));">
                    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
                      <div>
                        <div style="color:rgba(255,130,164,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;">Composer</div>
                        <div style="margin-top:6px; color:rgba(214,198,210,.72); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.55;">Use the current composer for preview and publish tests while the real source picker is still being built.</div>
                      </div>
                      <div id="vmAdminFacebookComposerStatus" style="padding:8px 10px; border-radius:999px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.03); color:rgba(208,222,232,.84); font-family:'Orbitron',system-ui,sans-serif; font-size:9px; font-weight:800; letter-spacing:.1em; text-transform:uppercase;">Checking connection...</div>
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px; margin-top:14px;">
                      <label style="display:block;">
                        <div style="margin-bottom:6px; color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Section</div>
                        <select id="vmAdminFacebookSection" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px;">
                          <option value="wrestling">Wrestling</option>
                          <option value="music">Music</option>
                        </select>
                      </label>
                      <label style="display:block;">
                        <div style="margin-bottom:6px; color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Entity Type</div>
                        <input id="vmAdminFacebookEntityType" type="text" value="show" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px;" />
                      </label>
                      <label style="display:block;">
                        <div style="margin-bottom:6px; color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Entity ID</div>
                        <input id="vmAdminFacebookEntityId" type="text" placeholder="081224" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px;" />
                      </label>
                      <label style="display:block;">
                        <div style="margin-bottom:6px; color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Entity Label</div>
                        <input id="vmAdminFacebookEntityLabel" type="text" placeholder="Show title" style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px;" />
                      </label>
                    </div>
                    <div style="display:grid; grid-template-columns:minmax(0,1fr); gap:10px; margin-top:10px;">
                      <label style="display:block;">
                        <div style="margin-bottom:6px; color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Link URL</div>
                        <input id="vmAdminFacebookLinkUrl" type="url" placeholder="https://..." style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px;" />
                      </label>
                      <label style="display:block;">
                        <div style="margin-bottom:6px; color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Image URL</div>
                        <input id="vmAdminFacebookImageUrl" type="url" placeholder="https://..." style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px;" />
                      </label>
                      <label style="display:block;">
                        <div style="margin-bottom:6px; color:rgba(214,198,210,.78); font-family:'Orbitron',system-ui,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;">Caption</div>
                        <textarea id="vmAdminFacebookCaption" rows="5" placeholder="Write the Facebook caption here..." style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(10,12,18,.94); color:rgba(245,236,242,.95); font-family:'Orbitron',system-ui,sans-serif; font-size:11px; line-height:1.6; resize:vertical;"></textarea>
                      </label>
                    </div>
                    <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
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
              </div>
              <div style="margin-top:20px;">
                <div style="display:flex; align-items:center; gap:12px;">
                  <div style="flex:1; height:2px; background:linear-gradient(90deg,rgba(255,70,110,.04),rgba(255,70,110,.62),rgba(97,224,255,.56),rgba(255,70,110,.04));"></div>
                </div>
                <div style="margin-top:10px; color:rgba(255,130,164,.88); font-family:'Orbitron',system-ui,sans-serif; font-size:16px; font-weight:900; letter-spacing:.18em; text-transform:uppercase;">Analytics</div>
                <div style="display:flex; align-items:center; gap:12px; margin-top:10px;">
                  <div style="flex:1; height:2px; background:linear-gradient(90deg,rgba(255,70,110,.04),rgba(255,70,110,.62),rgba(97,224,255,.56),rgba(255,70,110,.04));"></div>
                </div>
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
        const facebookConnectBtn = document.getElementById('vmAdminFacebookConnect');
        const facebookRefreshBtn = document.getElementById('vmAdminFacebookRefresh');
        const facebookDisconnectBtn = document.getElementById('vmAdminFacebookDisconnect');
        const facebookPreviewBtn = document.getElementById('vmAdminFacebookPreviewBtn');
        const facebookPublishBtn = document.getElementById('vmAdminFacebookPublishBtn');
        const facebookComposerStatus = document.getElementById('vmAdminFacebookComposerStatus');
        const facebookCallbackState = readVmFacebookCallbackState();
        try {
          const liveToken = getAdminToken();
          if (liveToken) {
            window.__VM_ADMIN_TOKEN__ = liveToken;
          }
        } catch (_) {}

        initVmAdminAnalyticsCollapsibles(document.getElementById('vmAdminPanelRoot'));

        if (analyticsRange) {
          analyticsRange.addEventListener('change', () => {
            loadVmAdminAnalytics(analyticsRange.value);
          }, { once: false });
        }

        verifyAdminAccess().then((ok) => {
          if (!ok) {
            if (facebookStatusEl) facebookStatusEl.textContent = 'Unlock Admin';
            if (facebookComposerStatus) facebookComposerStatus.textContent = 'Unlock Admin to continue';
            setVmAdminFacebookUiState({ connected: false, message: 'Unlock Admin to continue' });
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
            loadVmAdminFacebookHistory({ silent: false });
          } catch (_) {}
          setVmAdminFacebookUiState({ connected: false, message: 'Checking connection...' });

          if (facebookCallbackState) {
            if (facebookCallbackState.mode === 'connected') {
              if (facebookStatusEl) {
                facebookStatusEl.textContent = facebookCallbackState.pageName
                  ? `Connected to ${facebookCallbackState.pageName}`
                  : 'Page linked';
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

          if (rebuildBtn) {
            rebuildBtn.addEventListener('click', async () => {
              rebuildBtn.disabled = true;
              if (statusEl) statusEl.textContent = 'Rebuilding wrestling people index...';
              try {
                const res = await __vmAdminFetch('/admin/people-index/rebuild', {
                  method: 'POST'
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data || !data.ok) {
                  throw new Error((data && data.error) || 'rebuild failed');
                }
                if (statusEl) statusEl.textContent = 'People index rebuild complete';
                if (metaEl) {
                  const generatedAt = data.generatedAt ? new Date(data.generatedAt).toLocaleString() : 'Unknown';
                  metaEl.textContent = `${Number(data.totalPeople || 0)} people • ${Number(data.totalAppearances || 0)} appearances • rebuilt ${generatedAt}`;
                }
              } catch (_) {
                if (statusEl) statusEl.textContent = 'Rebuild failed';
              } finally {
                rebuildBtn.disabled = false;
              }
            }, { once: false });
          }

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
// Route Transitions (DIM → WIPE → LOAD)
// Goal (per your latest notes):
//  1) Click → screen dims fully to black (everything hidden)
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

    /* Ember sync target (canvas) — brightness driven by --emberBoost */
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

  // 3) DIAGONAL WIPE (on top of blackout) — slower
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

      // Reactor "plasma tongue" wisps + base glow (sci‑fi upgrade)
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

      // Plasma ribbons (controlled, engineered motion — not chaotic flame flicker)
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

        // Subtle chromatic aberration (sci‑fi split)
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








