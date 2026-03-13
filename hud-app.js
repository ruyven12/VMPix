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

    const VALID_ROUTE_KEYS = new Set(['home','music','wrestling','calendar','about','pricing','contact']);

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
    contact: "Contact - Coming Soon"
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
        musicBase + '/index/people',
        musicBase + '/sheet/bands',
        wrestleBase + '/health',
        wrestleBase + '/sheet/shows'
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
      musicBase + '/index/people',
      musicBase + '/sheet/bands',
      wrestleBase + '/health',
      wrestleBase + '/sheet/shows'
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
    }
  };

  
  let currentRoute = null;


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
      if (sub === 'bands') {
        const band = String(parts[2] || '').trim();
        const album = String(parts[3] || '').trim();
        if (band) trail.push('/music/bands/' + band);
        if (band && album) trail.push('/music/bands/' + band + '/' + album);
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








