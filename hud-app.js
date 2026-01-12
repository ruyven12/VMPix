// hud-app.js
// Keeps your HUD markup + CSS untouched. This file only moves the inline logic out of index.html.
//
// Dependencies (optional): music-archive.js, wrestling-archive.js, about-archive.js
// Each can expose window.MusicArchive / window.WrestlingArchive / window.AboutArchive
//
// NOTE: This is intentionally vanilla (no build tools / no modules) to match your previous style.

(function(){
  "use strict";

  // --- Device-aware full-height handling ---
  (function(){
    const setVH = () => {
      document.documentElement.style.setProperty('--vh', (window.innerHeight * 0.01) + 'px');
    };
    setVH();
    window.addEventListener('resize', setVH, { passive: true });
    window.addEventListener('orientationchange', setVH, { passive: true });
  })();

  // Auto-set --intro-chars based on the text inside .hudIntroType
  document.querySelectorAll('.hudIntroText').forEach(el => {
    const alreadySet = el.style.getPropertyValue('--intro-chars');
    if (alreadySet) return;

    const t = el.querySelector('.hudIntroType');
    if (!t) return;

    const n = ((t.textContent || '').trim().length || 1) + 1; // +1 buffer
    el.style.setProperty('--intro-chars', n);
  });

  
  // =============================
  // NAV PILL HI-TECH INTERACTION
  // =============================
  (function(){
    const pills = Array.from(document.querySelectorAll('.hudIntroText'));
    if (!pills.length) return;

    // Pointer-follow glow hotspot (desktop only; harmless on touch)
    pills.forEach(pill => {
      pill.addEventListener('pointermove', (e) => {
        const r = pill.getBoundingClientRect();
        const x = (e.clientX - r.left);
        const y = (e.clientY - r.top);
        pill.style.setProperty('--mx', x + 'px');
        pill.style.setProperty('--my', y + 'px');
      }, { passive: true });

      pill.addEventListener('pointerleave', () => {
        pill.style.removeProperty('--mx');
        pill.style.removeProperty('--my');
      }, { passive: true });

      // Quick "press" pulse
      pill.addEventListener('click', () => {
        pill.classList.remove('is-press');
        void pill.offsetWidth;
        pill.classList.add('is-press');
        window.setTimeout(() => pill.classList.remove('is-press'), 260);
      });
    });
  })();

function pulseFrame(){
    const wrap = document.querySelector('.neonFrameWrap');
    if (!wrap) return;

    // frame pulse (existing)
    wrap.classList.remove('pulse');
    void wrap.offsetWidth;
    wrap.classList.add('pulse');

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

  function setActiveTopNav(route){
    document.querySelectorAll('.hudStub [data-nav]').forEach(a => {
      a.classList.toggle('is-active', a.getAttribute('data-nav') === route);
    });
  }

  function routeKeyFromHash(){
    const hash = location.hash || '#/home';
    return (hash.replace(/^#\/?/, '').trim() || 'home').toLowerCase();
  }

  // Keep your exact copy (same as inline)
  const ROUTE_COPY = {
    home: "Welcome to the landing site for Voodoo Media. Right now this is a placeholder for more content later but for now, please make your selection above.",
    wrestling: "Wrestling Archives - Coming Soon",
    about: "About Me - Coming Soon"
  };

  // Helper: render a typed-text span into the mount (same HUD behavior)
  function renderTypedShell(m){
    if (!m) return;
    m.innerHTML = '<span data-hud-main-text></span>';
  }

  // Module adapters (optional external files)
  const MusicArchive = window.MusicArchive;
  const WrestlingArchive = window.WrestlingArchive;
  const AboutArchive = window.AboutArchive;

  // Route modules: keep behavior identical, but allow upgrades via external JS later
  const modules = {
    home: {
      render(){
        const m = mount();
        if (!m) return;
        // If the music archive previously mounted UI, let it clean up
        if (MusicArchive && typeof MusicArchive.destroy === 'function') MusicArchive.destroy();
        renderTypedShell(m);
      },
      onEnter(){
        const el = document.querySelector('[data-hud-main-text]');
        typeHudMainText(ROUTE_COPY.home, el);
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
    }
  };

  
  let currentRoute = null;

  // =============================
  // Route Transitions (smooth out → swap → in)
  // =============================
  let _isRouting = false;
  let _queuedRoute = null;

  function prefersReducedMotion(){
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function ensureRouteTransitionStyles(){
    if (document.getElementById('hudRouteTransitionStyles')) return;
    const s = document.createElement('style');
    s.id = 'hudRouteTransitionStyles';
    s.textContent = `
      /* Disable rapid re-clicks during route transitions */
      body.is-routing .hudStub [data-nav]{ pointer-events:none !important; }

      /* Mild blur for transitioning content (visual only) */
      #hudMainMount.is-leaving, #hudMainMount.is-entering{
        will-change: opacity, transform, filter;
      }
    `;
    document.head.appendChild(s);
  }

  function lockHudMainHeight(lock){
    const hudMain = document.querySelector('.hudStub.hudMain');
    if (!hudMain) return () => {};
    if (!lock) return () => {};

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

  async function transitionTo(route){
    const next = modules[route] ? route : 'home';

    // Clicking current tab: don't re-render (keeps your "no refresh" feel)
    if (next === currentRoute) {
      setActiveTopNav(next);
      return;
    }

    // If already routing, queue the latest request
    if (_isRouting){
      _queuedRoute = next;
      return;
    }

    _isRouting = true;
    ensureRouteTransitionStyles();
    document.body.classList.add('is-routing');

    const m = mount();
    const reduce = prefersReducedMotion();

    // Height lock prevents the frame from "breathing" mid-swap
    const unlock = lockHudMainHeight(!reduce);

    // OUT animation
    try{
      if (m && !reduce){
        m.classList.add('is-leaving');
        await m.animate(
          [
            { opacity: 1, transform: 'translateY(0px) scale(1)', filter: 'blur(0px)' },
            { opacity: 0, transform: 'translateY(8px) scale(0.995)', filter: 'blur(6px)' }
          ],
          { duration: 170, easing: 'cubic-bezier(.2,.9,.2,1)', fill: 'forwards' }
        ).finished.catch(() => {});
      }
    }catch(_){}

    // Leave hook (after OUT)
    if (currentRoute && modules[currentRoute] && typeof modules[currentRoute].onLeave === 'function'){
      try { modules[currentRoute].onLeave(); } catch(e) {}
    }

    // Route class on <body> (for visual state) - unchanged
    document.body.classList.remove('route-home','route-music','route-wrestling','route-about');
    document.body.classList.add(`route-${next}`);

    setActiveTopNav(next);
    stopAllTyping();

    // SWAP DOM
    modules[next].render();
    currentRoute = next;

    // Let layout settle before IN
    await new Promise(r => window.requestAnimationFrame(r));
    await new Promise(r => window.requestAnimationFrame(r));

    // IN animation + defer heavy onEnter until after first paint
    try{
      if (m && !reduce){
        m.classList.remove('is-leaving');
        m.classList.add('is-entering');
        m.style.opacity = '0';
        m.style.transform = 'translateY(-6px) scale(0.995)';
        m.style.filter = 'blur(6px)';

        // Kick IN on next frame
        await new Promise(r => window.requestAnimationFrame(r));

        const inAnim = m.animate(
          [
            { opacity: 0, transform: 'translateY(-6px) scale(0.995)', filter: 'blur(6px)' },
            { opacity: 1, transform: 'translateY(0px) scale(1)', filter: 'blur(0px)' }
          ],
          { duration: 230, easing: 'cubic-bezier(.2,.9,.2,1)', fill: 'forwards' }
        );

        // Start enter work after IN begins (smooth-first)
        window.requestAnimationFrame(() => {
          try { modules[next].onEnter && modules[next].onEnter(); } catch(_) {}
        });

        pulseFrame();

        await inAnim.finished.catch(() => {});
      } else {
        // Reduced motion: do it immediately
        try { modules[next].onEnter && modules[next].onEnter(); } catch(_) {}
        pulseFrame();
      }
    }catch(_){
      try { modules[next].onEnter && modules[next].onEnter(); } catch(_) {}
      pulseFrame();
    }

    // Cleanup
    try{
      if (m){
        m.classList.remove('is-entering','is-leaving');
        m.style.opacity = '';
        m.style.transform = '';
        m.style.filter = '';
      }
    }catch(_){}

    unlock();
    document.body.classList.remove('is-routing');
    _isRouting = false;

    // If something was queued during the transition, go there next.
    if (_queuedRoute && _queuedRoute !== currentRoute){
      const q = _queuedRoute;
      _queuedRoute = null;
      transitionTo(q);
    } else {
      _queuedRoute = null;
    }
  }

  function navigate(route){
    // Keep external API the same; run transition wrapper.
    transitionTo(route);
  }

  window.addEventListener('hashchange', () => navigate(routeKeyFromHash()));

  (function(){
    if (!location.hash) location.hash = '#/home';
    navigate(routeKeyFromHash());
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

      ctx.clearRect(0,0,w,h);

      const g = ctx.createRadialGradient(w*0.5,h*0.55, 10, w*0.5,h*0.55, Math.max(w,h)*0.75);
      g.addColorStop(0, 'rgba(255,40,60,0.08)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0,0,w,h);

      for (let i=0; i<particles.length; i++){
        const p = particles[i];
        p.y -= p.vy * (dt/16.7);
        p.x += p.vx * (dt/16.7);
        p.ph += 0.03 * p.tw;

        if (p.y < -30 || p.x < -60 || p.x > w + 60) spawn(i);

        const flick = 0.65 + 0.35*Math.sin(p.ph);
        const alpha = p.a * flick;

        ctx.beginPath();
        ctx.fillStyle = `rgba(255,110,140,${alpha})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fill();

        ctx.beginPath();
        ctx.strokeStyle = `rgba(255,60,80,${alpha*0.65})`;
        ctx.lineWidth = 1;
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx*14, p.y + p.vy*16);
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

})();
