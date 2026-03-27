// wrestling-archive.js
// Full Wrestling HUD module (Music-style shell) with Shows module support.
// - Uses same-origin script loading for /wrestling-archive-shows.js (no cross-domain fetch).
// - No Bands tab.
// - Shows tab loads window.WrestlingArchiveShows.render()/onMount() when available.

(function () {
  'use strict';

  const WRESTLING_FRONTEND_VERSION = '20260327-people-posters-r4';

  // ✅ IMPORTANT: this must be reachable on the SAME origin as the page (repo root, like /music-archive-shows.js)
  const SHOWS_SCRIPT_SRC = (function(){
    // Use relative path for local file:// testing so it resolves next to index.html
    if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
      return './wrestling-archive-shows.js?v=' + WRESTLING_FRONTEND_VERSION;
    }
    return '/wrestling-archive-shows.js?v=' + WRESTLING_FRONTEND_VERSION;
  })();
  const PEOPLE_SCRIPT_SRC = (function(){
    if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
      return './wrestling-archive-people.js?v=' + WRESTLING_FRONTEND_VERSION;
    }
    return '/wrestling-archive-people.js?v=' + WRESTLING_FRONTEND_VERSION;
  })();

  let _mount = null;

  // restore state
  let _prevWrapDisplay = null;
  let _prevWrapMinHeight = null;
  let _prevWrapHeight = null;
  let _prevHudMainBg = null;

  // ORANGE BOX (info strip) restore — Wrestling route only
  let _orangeBoxEl = null;
  let _prevHudMainPadding = null;

  // GREEN BOX (main changing content area) — Wrestling route only
  let _contentPanelEl = null;

  // inner glass panel restore
  let _prevGlassDisplay = null;

  // mount re-parenting restore (Option B)
  let _prevMountParent = null;
  let _prevMountNextSibling = null;
  let _prevMountStyle = null;

  // glassOuter restore
  let _prevOuterBg = null;
  let _prevOuterShadow = null;
  let _prevOuterPos = null;

  // spacing restore
  let _prevWrapTransform = null;
  let _prevMenuAlign = null;
  let _prevMenuPaddingTop = null;
  let _prevFrameHeight = null;
  let _prevOrnHeight = null;

  // content sizing
  let _onResize = null;

  // typing timer
  let _typeTimer = null;
  let _showsMountTimer = null;
  let _peopleMountTimer = null;

  let _suppressWrestlingTabUrlSync = false;

  const WRESTLING_SUBROUTES = new Set(['shows', 'people', 'stats', 'origins']);
  const WRESTLING_TITLE_BY_MODE = {
    shows: 'Wrestling Shows',
    people: 'Wrestling Performers',
    stats: 'Wrestling Stats',
    origins: 'Origins of Wrestling'
  };

  function trackWrestlingEvent(eventName, payload) {
    try {
      if (!window.VMPixAnalytics || typeof window.VMPixAnalytics.track !== 'function') return;
      window.VMPixAnalytics.track(eventName, Object.assign({
        source: 'wrestling_archive',
        section: 'wrestling'
      }, payload || {}));
    } catch (_) {}
  }

  function setWrestlingDocumentTitle(mode, fallback) {
    try {
      const label = String(fallback || WRESTLING_TITLE_BY_MODE[String(mode || '').toLowerCase().trim()] || 'Wrestling').trim();
      document.title = label ? (label + ' | VMPix') : 'VMPix';
    } catch (_) {}
  }

  function renderWrestlingPlaceholderCard(opts) {
    const title = String(opts && opts.title || 'Coming Soon').trim();
    const body = String(opts && opts.body || '').trim();
    return '' +
      '<div class="wrestlingPlaceholder">' +
        '<div class="wrestlingPlaceholderTitle">' + title + '</div>' +
        '<div class="wrestlingPlaceholderSeparator" aria-hidden="true"></div>' +
        '<div class="wrestlingPlaceholderBody">' + body + '</div>' +
      '</div>';
  }

  function getWrestlingSubrouteFromPath() {
    try {
      const parts = String(window.location.pathname || '').trim().replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
      if (!parts.length) return '';
      if (String(parts[0] || '').toLowerCase() !== 'wrestling') return '';
      const sub = String(parts[1] || '').toLowerCase().trim();
      return WRESTLING_SUBROUTES.has(sub) ? sub : '';
    } catch (_) {
      return '';
    }
  }

  function syncWrestlingSubroute(mode, opts) {
    const key = WRESTLING_SUBROUTES.has(String(mode || '').toLowerCase().trim())
      ? String(mode || '').toLowerCase().trim()
      : 'shows';
    const replace = !!(opts && opts.replace);
    const preservePath = !!(opts && opts.preservePath);
    const currentPath = String(window.location.pathname || '').trim();
    const target = (preservePath && currentPath.toLowerCase().startsWith('/wrestling/' + key))
      ? currentPath + (window.location.search || '')
      : '/wrestling/' + key + (window.location.search || '');

    try {
      if (replace) window.history.replaceState({ __vmpixBackGuard: true }, document.title, target);
      else window.history.pushState({ __vmpixBackGuard: true }, document.title, target);
    } catch (_) {}
  }

  function pxToNum(v) {
    const n = parseFloat(String(v || '').replace('px', ''));
    return Number.isFinite(n) ? n : 0;
  }

  // ---- Wrestling-only tuning ----
  const WRESTLING_FRAME_HEIGHT = '110px';

  const NEON_WRAP_MIN_HEIGHT = '100px';
  const NEON_WRAP_STRICT_HEIGHT = true;

  const WRESTLING_FRAME_Y_OFFSET = '0px';
  const WRESTLING_TITLE_PADDING_Y = '0px';
  const WRESTLING_TITLE_VISUAL_NUDGE = '-93px';

  // ORANGE STRIP tuning
  const ORANGE_BOX_HEIGHT = '56px';
  const ORANGE_BOX_BOTTOM = '12px';
  const ORANGE_BOX_SAFE_GAP = '20px';
  const ORANGE_BOX_MAX_WIDTH = '96%';

  const ORANGE_BOX_X_OFFSET = '0px';
  const ORANGE_BOX_Y_OFFSET = '0px';

  const ORANGE_BOX_RADIUS = '10px';
  const ORANGE_BOX_BG = 'rgba(0,0,0,0.12)';

  const ORANGE_BOX_TEXT_SIZE = '11px';
  const ORANGE_BOX_TEXT_TRACKING = '.12em';

  // GREEN PANEL tuning
  const GREEN_BOX_DESKTOP_MIN_HEIGHT = '0px';
  const GREEN_BOX_MOBILE_MIN_HEIGHT = '520px';

  const GREEN_BOX_MARGIN_TOP = '8px';
  const GREEN_BOX_PADDING = '18px 18px';

  const GREEN_BOX_ALIGN_ITEMS = 'center';
  const GREEN_BOX_JUSTIFY_CONTENT = 'center';
  const GREEN_BOX_TEXT_ALIGN = 'center';

  const GREEN_BOX_MOBILE_PADDING = '14px 12px';
  const GREEN_BOX_MOBILE_ALIGN_ITEMS = 'flex-start';
  const GREEN_BOX_MOBILE_JUSTIFY_CONTENT = 'flex-start';
  const GREEN_BOX_MOBILE_TEXT_ALIGN = 'left';

  const GREEN_BOX_OVERFLOW_Y = 'auto';

  // Expanded viewport used for Shows
  function sizeContentPanelToHud() {
    const ARCHIVES_TOP_OFFSET_PX = 115;
    const ARCHIVES_BOTTOM_OFFSET_PX = 10;

    if (!_contentPanelEl) return;

    const hudMain = document.querySelector('.hudStub.hudMain');
    if (!hudMain) return;

    const hudH = hudMain.clientHeight || 0;
    const cs = window.getComputedStyle ? window.getComputedStyle(hudMain) : null;

    const padTop = cs ? pxToNum(cs.paddingTop) : 0;
    const padBottom = cs ? pxToNum(cs.paddingBottom) : 0;

    const innerH = Math.max(0, hudH - padTop - padBottom);
    const topGap = pxToNum(GREEN_BOX_MARGIN_TOP);

    const avail = Math.max(0, innerH - topGap - ARCHIVES_TOP_OFFSET_PX - ARCHIVES_BOTTOM_OFFSET_PX);

    _contentPanelEl.style.height = `${avail}px`;
    _contentPanelEl.style.maxHeight = `${avail}px`;
  }

  function setArchiveViewportExpanded(isExpanded) {
    if (!_contentPanelEl) return;

    if (isExpanded) {
      _contentPanelEl.style.marginTop = '0px';
      sizeContentPanelToHud();

      if (!_onResize) {
        _onResize = () => window.requestAnimationFrame(sizeContentPanelToHud);
        window.addEventListener('resize', _onResize, { passive: true });
      }
    } else {
      _contentPanelEl.style.marginTop = '';
      _contentPanelEl.style.height = '';
      _contentPanelEl.style.maxHeight = '';

      if (_onResize) {
        window.removeEventListener('resize', _onResize);
        _onResize = null;
      }
    }
  }

  // Panel mode swap: Shows needs normal document flow
  function setPanelMode(mode) {
    if (!_contentPanelEl) return;

    if (mode === 'shows' || mode === 'people') {
      _contentPanelEl.style.display = 'flex';
      _contentPanelEl.style.alignItems = '';
      _contentPanelEl.style.justifyContent = '';
      _contentPanelEl.style.textAlign = 'left';
    } else {
      _contentPanelEl.style.display = 'flex';
      _contentPanelEl.style.alignItems = GREEN_BOX_ALIGN_ITEMS;
      _contentPanelEl.style.justifyContent = GREEN_BOX_JUSTIFY_CONTENT;
      _contentPanelEl.style.textAlign = GREEN_BOX_TEXT_ALIGN;
    }
  

    // track mode for stale async guards
    try { _contentPanelEl.dataset.mode = mode || 'default'; } catch (_) {}
}

  // ✅ Same-origin lazy loader (script tag injection)
  function ensureWrestlingShowsLoaded() {
    if (window.WrestlingArchiveShows && typeof window.WrestlingArchiveShows.render === 'function') {
      return Promise.resolve(true);
    }

    const existing = document.querySelector('script[data-wa-shows="1"]');
    if (existing) {
      return new Promise((resolve) => {
        const start = Date.now();
        const t = setInterval(() => {
          if (window.WrestlingArchiveShows?.render) {
            clearInterval(t);
            resolve(true);
          } else if (Date.now() - start > 2500) {
            clearInterval(t);
            resolve(false);
          }
        }, 50);
      });
    }

    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = SHOWS_SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.dataset.waShows = '1';
      s.onload = () => resolve(!!window.WrestlingArchiveShows?.render);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  function ensureFrameVisibleForWrestling() {
    const wrap = document.querySelector('.neonFrameWrap');
    if (!wrap) return;

    if (_prevWrapDisplay === null) _prevWrapDisplay = wrap.style.display || '';
    wrap.style.display = 'block';

    if (_prevWrapTransform === null) _prevWrapTransform = wrap.style.transform || '';
    wrap.style.transform = `translateY(${WRESTLING_FRAME_Y_OFFSET})`;

    if (_prevWrapMinHeight === null) _prevWrapMinHeight = wrap.style.minHeight || '';
    if (_prevWrapHeight === null) _prevWrapHeight = wrap.style.height || '';
    wrap.style.minHeight = NEON_WRAP_MIN_HEIGHT;
    wrap.style.height = NEON_WRAP_STRICT_HEIGHT ? NEON_WRAP_MIN_HEIGHT : '';

    // Kill wrap overlays on Wrestling route
    if (!document.getElementById('wrestlingWrapOverlayKill')) {
      const s = document.createElement('style');
      s.id = 'wrestlingWrapOverlayKill';
      s.textContent = `
        .route-wrestling .neonFrameWrap::before,
        .route-wrestling .neonFrameWrap::after{
          content:none !important;
          display:none !important;
          opacity:0 !important;
        }`;
      document.head.appendChild(s);
    }

    const menuHero = document.querySelector('.menuHero');
    if (menuHero) {
      if (_prevMenuAlign === null) _prevMenuAlign = menuHero.style.alignItems || '';
      if (_prevMenuPaddingTop === null) _prevMenuPaddingTop = menuHero.style.paddingTop || '';
      menuHero.style.alignItems = 'flex-start';
      menuHero.style.paddingTop = '0px';
    }
  }

  function restoreFrameVisibility() {
    const wrap = document.querySelector('.neonFrameWrap');
    if (wrap) {
      wrap.style.display = _prevWrapDisplay || '';
      wrap.style.transform = _prevWrapTransform || '';
      wrap.style.minHeight = _prevWrapMinHeight || '';
      wrap.style.height = _prevWrapHeight || '';
    }
    _prevWrapDisplay = null;
    _prevWrapTransform = null;
    _prevWrapMinHeight = null;
    _prevWrapHeight = null;

    const menuHero = document.querySelector('.menuHero');
    if (menuHero) {
      menuHero.style.alignItems = _prevMenuAlign || '';
      menuHero.style.paddingTop = _prevMenuPaddingTop || '';
    }
    _prevMenuAlign = null;
    _prevMenuPaddingTop = null;
  }

  function applyWrestlingFrameHeight() {
    const frame = document.querySelector('.neonFrame');
    const orn = document.querySelector('.hudOrn');
    if (frame) { _prevFrameHeight = frame.style.height || ''; frame.style.height = WRESTLING_FRAME_HEIGHT; }
    if (orn) { _prevOrnHeight = orn.style.height || ''; orn.style.height = WRESTLING_FRAME_HEIGHT; }
  }

  function restoreFrameHeight() {
    const frame = document.querySelector('.neonFrame');
    const orn = document.querySelector('.hudOrn');
    if (frame) frame.style.height = _prevFrameHeight || '';
    if (orn) orn.style.height = _prevOrnHeight || '';
    _prevFrameHeight = null;
    _prevOrnHeight = null;
  }

  function animateHudTab(tabEl) {
    if (!tabEl) return;
    const strip = document.getElementById('wrestlingInfoStrip');
    if (!strip) return;

    const wasActive = tabEl.classList.contains('is-active');

    strip.querySelectorAll('.archiveModeBtn').forEach((t) => t.classList.remove('sweep'));

    if (!wasActive) {
      strip.querySelectorAll('.archiveModeBtn').forEach((t) => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      tabEl.classList.add('is-active');
      tabEl.setAttribute('aria-selected', 'true');
    }

    tabEl.classList.remove('sweep');
    void tabEl.offsetWidth;
    tabEl.classList.add('sweep');

    strip.classList.remove('ping');
    void strip.offsetWidth;
    strip.classList.add('ping');
  }

  function wipeSwapContent(nextHtml, terminalText) {
    if (!_contentPanelEl) return;

    const prefersReduced =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      _contentPanelEl.innerHTML = nextHtml || '';
      return;
    }

    // stop any ongoing typing
    if (_typeTimer) {
      window.clearInterval(_typeTimer);
      _typeTimer = null;
    }

    const WIPE_OUT_MS = 140;
    const WIPE_IN_MS = 180;
    const TYPE_MS = 7;

    _contentPanelEl.classList.remove('wipe-out', 'wipe-in');
    void _contentPanelEl.offsetWidth;
    _contentPanelEl.classList.add('wipe-out');

    window.setTimeout(() => {
      if (terminalText) {
        _contentPanelEl.innerHTML = `
          <div class="termLine"><span class="termText"></span><span class="termCaret">▌</span></div>
        `;
      } else {
        _contentPanelEl.innerHTML = nextHtml || '';
      }

      _contentPanelEl.classList.remove('wipe-out');
      void _contentPanelEl.offsetWidth;
      _contentPanelEl.classList.add('wipe-in');

      window.setTimeout(() => {
        _contentPanelEl.classList.remove('wipe-in');

        if (terminalText) {
          const term = _contentPanelEl.querySelector('.termText');
          if (!term) return;

          term.textContent = '';
          let i = 0;
          _typeTimer = window.setInterval(() => {
            i += 1;
            term.textContent = terminalText.slice(0, i);
            if (i >= terminalText.length) {
              window.clearInterval(_typeTimer);
              _typeTimer = null;
            }
          }, TYPE_MS);
        }
      }, WIPE_IN_MS);
    }, WIPE_OUT_MS);
  }

  function injectStylesOnce() {
    if (!document.getElementById('wrestlingContentWipeStyles')) {
      const cs = document.createElement('style');
      cs.id = 'wrestlingContentWipeStyles';
      cs.textContent = `
        #wrestlingContentPanel{ position:relative; }
        #wrestlingContentPanel.wipe-out{ animation: wrestlingContentWipeOut 140ms ease-out both; }
        #wrestlingContentPanel.wipe-in{ animation: wrestlingContentWipeIn 180ms ease-out both; }

        @keyframes wrestlingContentWipeOut{
          0%{ opacity:1; filter:blur(0px); clip-path:inset(0% 0% 0% 0%); }
          100%{ opacity:0; filter:blur(.8px); clip-path:inset(0% 0% 0% 100%); }
        }
        @keyframes wrestlingContentWipeIn{
          0%{ opacity:0; filter:blur(.8px); clip-path:inset(0% 100% 0% 0%); }
          100%{ opacity:1; filter:blur(0px); clip-path:inset(0% 0% 0% 0%); }
        }

        #wrestlingContentPanel .termLine{
          opacity:.85;
          font-size:14px;
          letter-spacing:.04em;
          text-transform:none;
          font-variant:normal;
          display:inline-block;
          white-space:pre-wrap;
        }
        #wrestlingContentPanel .termText{ text-transform:none; font-variant:normal; }
        #wrestlingContentPanel .termCaret{
          display:inline-block;
          width:0.6ch;
          transform:translateY(1px);
          animation:termBlink 700ms steps(1) infinite;
        }
        @keyframes termBlink{ 50%{ opacity:0; } }

        @media (prefers-reduced-motion: reduce){
          #wrestlingContentPanel.wipe-out,
          #wrestlingContentPanel.wipe-in{ animation:none !important; }
        }
      `;
      document.head.appendChild(cs);
    }

    if (!document.getElementById('wrestlingInfoStripStyles')) {
      const style = document.createElement('style');
      style.id = 'wrestlingInfoStripStyles';
      style.textContent = `
        #wrestlingInfoStrip{ position:relative; overflow:visible; transition:height 220ms ease, padding 220ms ease, opacity 220ms ease; }

        .archiveHeaderWrap{
          width:100%;
          display:flex;
          justify-content:center;
          margin:10px 0 0;
        }

        .archiveModeToggle{
          display:flex;
          flex-wrap:wrap;
          justify-content:center;
          gap:10px;
          padding:6px;
          border-radius:999px;
          background:rgba(0,0,0,0.35);
          box-shadow:
            0 0 0 1px rgba(255,80,110,0.35) inset,
            0 0 22px rgba(255,80,110,0.25);
        }

        .archiveModeBtn{
          min-width:84px;
          padding:8px 14px;
          border-radius:999px;
          border:none;
          background:transparent;
          color:rgba(255,190,200,0.75);
          font-size:13px;
          font-family: Orbitron;
          letter-spacing:.12em;
          text-transform:none;
          cursor:pointer;
          transition:all 160ms ease;
        }

        .archiveModeBtn:hover{
          color:#fff;
        }

        .archiveModeBtn.is-active{
          background:linear-gradient(
            180deg,
            rgba(255,120,140,0.95),
            rgba(255,70,90,0.85)
          );
          color:#010306;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.45) inset,
            0 0 26px rgba(255,90,120,0.75);
        }
        .archiveModeBtn.is-disabled{
          opacity:.5;
          cursor:default;
          filter:saturate(.75);
        }
        .archiveModeBtn.is-disabled:hover{
          color:rgba(255,190,200,0.75);
        }

        .wrestlingPlaceholder{
          width:100%;
          max-width:900px;
          margin:0 auto;
          text-align:center;
        }
        .wrestlingPlaceholderTitle{
          font-family:"Orbitron", system-ui, sans-serif;
          font-size:24px;
          font-weight:900;
          letter-spacing:.12em;
          text-transform:none;
          color:rgba(244,247,255,0.96);
          margin-bottom:14px;
        }
        .wrestlingPlaceholderSeparator{
          height:3px;
          margin:0 auto 16px;
          width:min(100%, 820px);
          border-radius:999px;
          background:linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(103,203,255,0.24) 18%, rgba(103,203,255,0.62) 50%, rgba(100,227,186,0.22) 82%, rgba(255,255,255,0) 100%);
          box-shadow:0 0 12px rgba(103,203,255,0.20), 0 0 24px rgba(100,227,186,0.08);
        }
        .wrestlingPlaceholderBody{
          max-width:760px;
          margin:0 auto;
          font-size:14px;
          line-height:1.7;
          letter-spacing:.04em;
          color:rgba(212,223,242,0.82);
          text-transform:none;
          white-space:pre-wrap;
        }

        @media (max-width: 760px){
          .archiveModeToggle{
            width:min(100%, 680px);
            gap:8px;
            padding:8px;
            border-radius:28px;
          }
          .archiveModeBtn{
            min-width:clamp(88px, 26vw, 126px);
            padding:8px 9px;
            font-size:clamp(10px, 2.45vw, 12px);
            letter-spacing:.06em;
          }
          .wrestlingPlaceholderTitle{
            font-size:20px;
            letter-spacing:.08em;
          }
          .wrestlingPlaceholderBody{
            font-size:13px;
          }
        }

        @media (max-width: 520px){
          .archiveModeToggle{
            gap:6px;
            padding:7px;
            border-radius:26px;
          }
          .archiveModeBtn{
            min-width:calc(50% - 6px);
            padding:7px 7px;
            font-size:clamp(9px, 2.9vw, 10.5px);
            letter-spacing:.03em;
          }
          .wrestlingPlaceholderTitle{
            font-size:17px;
            letter-spacing:.05em;
          }
          .wrestlingPlaceholderBody{
            font-size:12px;
            line-height:1.6;
          }
        }

        #wrestlingInfoStrip .scanPing{
          pointer-events:none;
          position:absolute;
          left:0;
          top:0;
          width:100%;
          height:100%;
          opacity:0;
          background:linear-gradient(
            90deg,
            rgba(255,255,255,0) 0%,
            rgba(255,255,255,.10) 45%,
            rgba(255,255,255,0) 100%
          );
          background-size:200% 100%;
          background-position:-100% 0;
          filter:blur(.2px);
          transform:skewX(-18deg);
        }

        @keyframes hudScanPing{
          0%{ opacity:0; background-position:-100% 0; }
          10%{ opacity:.65; }
          60%{ opacity:.35; }
          100%{ opacity:0; background-position:200% 0; }
        }
        #wrestlingInfoStrip.ping .scanPing{ animation:hudScanPing 320ms ease-out both; }
      `;
      document.head.appendChild(style);
    }
  }

  function render(mountEl) {
    if (!mountEl) return;
    _mount = mountEl;

    injectStylesOnce();

    // Make HUD main background transparent (keep border)
    const hudMainBox = document.querySelector('.hudStub.hudMain');
    if (hudMainBox) {
      _prevHudMainBg = hudMainBox.style.background || '';
      hudMainBox.style.background = 'transparent';
    }

    ensureFrameVisibleForWrestling();
    applyWrestlingFrameHeight();

    // Option B: move mount into outer glass, hide inner
    const glassInner = document.querySelector('.neonFrameTextInner');
    const glassOuter = document.querySelector('.neonFrameText');

    if (glassInner && glassOuter) {
      if (_prevOuterBg === null) _prevOuterBg = glassOuter.style.background || '';
      if (_prevOuterShadow === null) _prevOuterShadow = glassOuter.style.boxShadow || '';
      if (_prevOuterPos === null) _prevOuterPos = glassOuter.style.position || '';

      glassOuter.style.background = 'transparent';
      glassOuter.style.boxShadow = 'none';
      if (!glassOuter.style.position) glassOuter.style.position = 'relative';

      glassOuter.style.display = 'flex';
      glassOuter.style.alignItems = 'center';
      glassOuter.style.justifyContent = 'center';
      glassOuter.style.height = '100%';
      glassOuter.style.padding = '0';
      glassOuter.style.margin = '0';

      if (_prevMountParent === null) {
        _prevMountParent = mountEl.parentNode;
        _prevMountNextSibling = mountEl.nextSibling;
        _prevMountStyle = mountEl.getAttribute('style') || '';
      }

      glassOuter.appendChild(mountEl);

      mountEl.style.display = 'flex';
      mountEl.style.alignItems = 'center';
      mountEl.style.justifyContent = 'center';
      mountEl.style.width = '100%';
      mountEl.style.height = '100%';
      mountEl.style.position = 'relative';
      mountEl.style.zIndex = '2';
      mountEl.style.paddingTop = WRESTLING_TITLE_PADDING_Y;
      mountEl.style.paddingBottom = WRESTLING_TITLE_PADDING_Y;

      if (_prevGlassDisplay === null) _prevGlassDisplay = glassInner.style.display || '';
      glassInner.style.display = 'none';
    }

    // Title inside neon frame
    _mount.innerHTML = `<span data-hud-main-text
      style="font-size:16px; line-height:1; letter-spacing:.14em; text-transform:none;
             display:inline-block; transform:translateY(${WRESTLING_TITLE_VISUAL_NUDGE});">
      The World of Wrestling
    </span>`;

    const hudMain = document.querySelector('.hudStub.hudMain');
    if (!hudMain) return;

    if (_prevHudMainPadding === null) _prevHudMainPadding = hudMain.style.padding || '';

    hudMain.style.position = 'relative';
    hudMain.style.padding = '0 18px 0';
    hudMain.style.boxSizing = 'border-box';
    hudMain.style.overflow = 'hidden';

    // Green content panel
    if (!_contentPanelEl) {
      _contentPanelEl = document.createElement('div');
      _contentPanelEl.id = 'wrestlingContentPanel';
	  _contentPanelEl.style.display = 'none';
      _contentPanelEl.style.width = '100%';
      _contentPanelEl.style.maxWidth = ORANGE_BOX_MAX_WIDTH;
      _contentPanelEl.style.margin = `${GREEN_BOX_MARGIN_TOP} auto 0`;
      _contentPanelEl.style.minHeight = GREEN_BOX_DESKTOP_MIN_HEIGHT;
      _contentPanelEl.style.borderRadius = '10px';
      _contentPanelEl.style.border = '1px solid rgba(255, 70, 110, 0.25)';
      _contentPanelEl.style.background = 'rgba(0,0,0,0.10)';
      _contentPanelEl.style.boxShadow = '0 0 0 1px rgba(255,70,110,0.50) inset, 0 0 10px rgba(255,70,110,0.50)';
      _contentPanelEl.style.boxSizing = 'border-box';
      _contentPanelEl.style.padding = GREEN_BOX_PADDING;
      _contentPanelEl.style.overflowY = GREEN_BOX_OVERFLOW_Y;

      if (window.matchMedia && window.matchMedia('(max-width: 520px)').matches) {
        _contentPanelEl.style.padding = GREEN_BOX_MOBILE_PADDING;
        _contentPanelEl.style.minHeight = GREEN_BOX_MOBILE_MIN_HEIGHT;
      }

      hudMain.appendChild(_contentPanelEl);
    }

    // Default: centered terminal-style content
    setArchiveViewportExpanded(false);
    setPanelMode('default');

    _contentPanelEl.innerHTML = `
      <div style="max-width:720px; opacity:.85; font-size:14px; line-height:1.6; letter-spacing:.04em; text-transform:none;">
        <strong>Welcome to the Wrestling section for this page.</strong><br>
        Please make your selection above.
      </div>
    `;

    // Orange strip
    if (!_orangeBoxEl) {
      _orangeBoxEl = document.createElement('div');
      _orangeBoxEl.id = 'wrestlingInfoStrip';

      _orangeBoxEl.style.height = 'auto';
      _orangeBoxEl.style.minHeight = 'unset';
      _orangeBoxEl.style.paddingTop = '0px';
      _orangeBoxEl.style.paddingBottom = '10px';
      _orangeBoxEl.style.paddingLeft = '14px';
      _orangeBoxEl.style.paddingRight = '14px';
      _orangeBoxEl.style.maxWidth = ORANGE_BOX_MAX_WIDTH;
      _orangeBoxEl.style.width = '100%';
      _orangeBoxEl.style.position = 'relative';
      _orangeBoxEl.style.left = '';
      _orangeBoxEl.style.top = '';
      _orangeBoxEl.style.bottom = '';
      _orangeBoxEl.style.transform = '';
      _orangeBoxEl.style.margin = '0px auto 5px';
      _orangeBoxEl.style.border = '1px solid rgba(255, 70, 110, 0.25)';
      _orangeBoxEl.style.borderRadius = ORANGE_BOX_RADIUS;
      _orangeBoxEl.style.background = 'rgba(0,0,0,0.10)';
      _orangeBoxEl.style.boxShadow = '0 0 0 1px rgba(255,70,110,0.50) inset, 0 0 10px rgba(255,70,110,0.50)';
      _orangeBoxEl.style.boxSizing = 'border-box';
      _orangeBoxEl.style.display = 'flex';
      _orangeBoxEl.style.flexDirection = 'column';
      _orangeBoxEl.style.alignItems = 'center';
      _orangeBoxEl.style.justifyContent = 'center';
      _orangeBoxEl.style.textAlign = 'center';
      _orangeBoxEl.style.pointerEvents = 'auto';
      _orangeBoxEl.innerHTML = `
        <div class="archiveHeaderWrap">
          <div class="archiveModeToggle" role="tablist" aria-label="Wrestling sections">
            <button class="archiveModeBtn" data-tab="shows" role="tab" aria-selected="false">Shows</button>
            <button class="archiveModeBtn" data-tab="people" role="tab" aria-selected="false">Performers</button>
            <button class="archiveModeBtn" data-tab="origins" role="tab" aria-selected="false">Origins</button>
            <button class="archiveModeBtn is-disabled" data-tab="stats" data-disabled="1" role="tab" aria-selected="false" aria-disabled="true" tabindex="-1">Stats (Coming Soon)</button>
          </div>
        </div>
        <div class="scanPing" aria-hidden="true"></div>
      `;

      _orangeBoxEl.querySelectorAll('.archiveModeBtn').forEach((tab) => {
        tab.addEventListener('click', async () => {
          const modeKey = String(tab.getAttribute('data-tab') || '').trim().toLowerCase();
          const label = tab.textContent.trim();
          if (String(tab.getAttribute('data-disabled') || '') === '1') return;
          if (!_suppressWrestlingTabUrlSync) {
            try { syncWrestlingSubroute(modeKey, { replace: false }); } catch (_) {}
          }
          try { setWrestlingDocumentTitle(modeKey); } catch (_) {}
          trackWrestlingEvent('nav_click', {
            subsection: modeKey,
            entity_type: 'page',
            entity_id: '/wrestling/' + modeKey,
            entity_label: label,
            meta: { route_key: modeKey }
          });
          animateHudTab(tab);

          // prevent stale Shows mounts from firing after tab switches
          if (_showsMountTimer) {
            window.clearTimeout(_showsMountTimer);
            _showsMountTimer = null;
          }
          if (_peopleMountTimer) {
            window.clearTimeout(_peopleMountTimer);
            _peopleMountTimer = null;
          }

          if (modeKey === 'shows') {
            setPanelMode('shows');
            setArchiveViewportExpanded(true);

            // ensure module loaded (same-origin)
            const ok = await ensureWrestlingShowsLoaded();
            if (!ok) {
              wipeSwapContent(
                `<div style="opacity:.75; font-size:13px; line-height:1.6;">
                   <strong>Shows module not loaded.</strong><br>
                   Confirm this file exists on the site:<br>
                   <code>${SHOWS_SCRIPT_SRC}</code>
                 </div>`,
                ''
              );
              return;
            }

            const html = window.WrestlingArchiveShows?.render?.() || '';
            wipeSwapContent(html, '');

            _showsMountTimer = window.setTimeout(() => {
              const panel = document.getElementById('wrestlingContentPanel');
              if (!panel) return;

              // Guard: only mount if Shows is still the active panel + skeleton is present
              const mode = (panel.dataset && panel.dataset.mode) ? panel.dataset.mode : null;
              if (mode && mode !== 'shows') return;
              if (!panel.querySelector('#waShowsRoot')) return;

              window.WrestlingArchiveShows?.onMount?.(panel);
            }, 360);

            return;
          }

          if (modeKey === 'people') {
            setPanelMode('people');
            setArchiveViewportExpanded(true);

            const ok = await ensureWrestlingPeopleLoaded();
            if (!ok) {
              wipeSwapContent(
                `<div style="opacity:.75; font-size:13px; line-height:1.6;">
                   <strong>Performers module not loaded.</strong><br>
                   Confirm this file exists on the site:<br>
                   <code>${PEOPLE_SCRIPT_SRC}</code>
                 </div>`,
                ''
              );
              return;
            }

            const html = window.WrestlingArchivePeople?.render?.() || '';
            wipeSwapContent(html, '');

            _peopleMountTimer = window.setTimeout(() => {
              const panel = document.getElementById('wrestlingContentPanel');
              if (!panel) return;

              const mode = (panel.dataset && panel.dataset.mode) ? panel.dataset.mode : null;
              if (mode && mode !== 'people') return;
              if (!panel.querySelector('#waPeopleRoot')) return;

              window.WrestlingArchivePeople?.onMount?.(panel);
            }, 220);

            return;
          }

          // other tabs
          setArchiveViewportExpanded(false);
          setPanelMode('default');

          if (modeKey === 'stats') {
            wipeSwapContent(
              renderWrestlingPlaceholderCard({
                title: 'Archive Statistics',
                body: 'This page will house the Wrestling-side archive totals, indexing progress, and other project-level stats once the backend and source data are finalized.\n\nFor now, this placeholder keeps the section live in the shell so we can build the real stats module next without changing navigation again.'
              }),
              ''
            );
            return;
          }

          if (modeKey === 'origins') {
            wipeSwapContent(
              renderWrestlingPlaceholderCard({
                title: 'The Origins of Wrestling',
                body: `Limitless Wrestling has been a mainstay in my life since December 2021 when one of my friends suggested that I go to this indie wrestling event. Personally, I've been a fan of wrestling most of my life and have gone to many events ranging from WWE house shows to Wrestlemania 35 in NYJ/NYC.\n\nHowever, that one event sparked my love for indie wrestling and haven't looked back since. On this page (for now), all of the 2024 events and newer will be available, with 2023 and before being available down the road. Be on the lookout for that content!`
              }),
              ''
            );
            return;
          }

          if (modeKey === '__legacy_stats__') {
            wipeSwapContent('', `Notes – Coming Soon`);
            return;
          }

          wipeSwapContent(
            `<div style="opacity:.7; font-size:14px; letter-spacing:.12em; text-transform:uppercase;">${label} – Coming Soon</div>`,
            `${label} – Coming Soon`
          );
        });
      });
    }
      if (_contentPanelEl && _contentPanelEl.parentNode === hudMain) {
        hudMain.insertBefore(_orangeBoxEl, _contentPanelEl);
      } else {
        hudMain.appendChild(_orangeBoxEl);
      }
  }

  function onEnter() {
    try {
      const initialMode = getWrestlingSubrouteFromPath();
      if (initialMode) {
        setMode(initialMode, { replace: true, preservePath: true });
        return;
      }
      setWrestlingDocumentTitle('shows');
      setMode('shows', { replace: true, preservePath: true });
    } catch (_) {}
  }

  function ensureWrestlingPeopleLoaded() {
    if (window.WrestlingArchivePeople && typeof window.WrestlingArchivePeople.render === 'function') {
      return Promise.resolve(true);
    }

    const existing = document.querySelector('script[data-wa-people="1"]');
    if (existing) {
      return new Promise((resolve) => {
        const start = Date.now();
        const t = setInterval(() => {
          if (window.WrestlingArchivePeople?.render) {
            clearInterval(t);
            resolve(true);
          } else if (Date.now() - start > 2500) {
            clearInterval(t);
            resolve(false);
          }
        }, 50);
      });
    }

    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = PEOPLE_SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.dataset.waPeople = '1';
      s.onload = () => resolve(!!window.WrestlingArchivePeople?.render);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }


  function setMode(mode, opts) {
    const m = String(mode || '').toLowerCase().trim();
    const key = WRESTLING_SUBROUTES.has(m) ? m : 'shows';
    try { setWrestlingDocumentTitle(key); } catch (_) {}

    try {
      syncWrestlingSubroute(key, { replace: !!(opts && opts.replace), preservePath: !!(opts && opts.preservePath) });
    } catch (_) {}

    try {
      const tab =
        (_orangeBoxEl && _orangeBoxEl.querySelector(`.archiveModeBtn[data-tab="${key}"]`)) ||
        document.querySelector(`.archiveModeBtn[data-tab="${key}"]`);
      if (tab) {
        _suppressWrestlingTabUrlSync = true;
        try { tab.click(); } finally { _suppressWrestlingTabUrlSync = false; }
      }
    } catch (_) {}
  }

  function destroy() {
    // stop typing
    if (_typeTimer) {
      window.clearInterval(_typeTimer);
      _typeTimer = null;
    }
    if (_showsMountTimer) {
      window.clearTimeout(_showsMountTimer);
      _showsMountTimer = null;
    }
    if (_peopleMountTimer) {
      window.clearTimeout(_peopleMountTimer);
      _peopleMountTimer = null;
    }

    const hudMainBox = document.querySelector('.hudStub.hudMain');
    if (hudMainBox) {
      hudMainBox.style.background = _prevHudMainBg || '';
    }
    _prevHudMainBg = null;

    restoreFrameHeight();

    const glassInner = document.querySelector('.neonFrameTextInner');
    const glassOuter = document.querySelector('.neonFrameText');

    if (glassInner) glassInner.style.display = _prevGlassDisplay || '';
    _prevGlassDisplay = null;

    if (glassOuter) {
      glassOuter.style.background = _prevOuterBg || '';
      glassOuter.style.boxShadow = _prevOuterShadow || '';
      glassOuter.style.position = _prevOuterPos || '';
    }
    _prevOuterBg = null;
    _prevOuterShadow = null;
    _prevOuterPos = null;

    if (_mount && _prevMountParent) {
      _mount.setAttribute('style', _prevMountStyle || '');
      if (_prevMountNextSibling && _prevMountNextSibling.parentNode === _prevMountParent) {
        _prevMountParent.insertBefore(_mount, _prevMountNextSibling);
      } else {
        _prevMountParent.appendChild(_mount);
      }
    }
    _prevMountParent = null;
    _prevMountNextSibling = null;
    _prevMountStyle = null;

    if (_orangeBoxEl && _orangeBoxEl.parentNode) _orangeBoxEl.parentNode.removeChild(_orangeBoxEl);
    _orangeBoxEl = null;

    if (_contentPanelEl && _contentPanelEl.parentNode) _contentPanelEl.parentNode.removeChild(_contentPanelEl);
    _contentPanelEl = null;

    const hudMain = document.querySelector('.hudStub.hudMain');
    if (hudMain) hudMain.style.padding = _prevHudMainPadding || '';
    _prevHudMainPadding = null;

    restoreFrameVisibility();

    if (_onResize) {
      window.removeEventListener('resize', _onResize);
      _onResize = null;
    }

    if (_mount) {
      _mount.innerHTML = '';
      _mount = null;
    }
  }

  window.WrestlingArchive = { render, onEnter, destroy, setMode };
})();
