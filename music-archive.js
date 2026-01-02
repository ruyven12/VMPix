// music-archive.js (user working file)
// Phase 2 clean baseline (DEDUPED)
// - Keeps HUD neon frame visible on Music route
// - Removes HUD main container fill only (Music only) — border stays
// - Allows Music-only frame height + vertical placement control
// - OPTION B: Re-parent #hudMainMount so .neonFrameTextInner can be display:none (glass removed)
// - Displays: THE WORLD OF MUSIC

(function () {
  'use strict';

  let _mount = null;

  // restore state
  let _prevWrapDisplay = null;
  let _prevWrapMinHeight = null;
  let _prevWrapHeight = null;
  let _prevHudMainBg = null;
  // ORANGE BOX (info strip) restore — Music route only
  let _orangeBoxEl = null;
  let _prevHudMainPadding = null;

  // GREEN BOX (main changing content area) — Music route only
  let _contentPanelEl = null;

  // inner glass panel restore
  let _prevGlassDisplay = null;

  // mount re-parenting restore (Option B)
  let _prevMountParent = null;
  let _prevMountNextSibling = null;
  let _prevMountStyle = null;

  // glassOuter restore (in case it has backgrounds/shadows set elsewhere)
  let _prevOuterBg = null;
  let _prevOuterShadow = null;
  let _prevOuterPos = null;

  // spacing (wrap position) restore
  let _prevWrapTransform = null;
  let _prevMenuAlign = null;
  let _prevMenuPaddingTop = null;
  let _prevFrameHeight = null;
  let _prevOrnHeight = null;

  // content sizing (Music route only)
  let _onResize = null;

  function pxToNum(v) {
    const n = parseFloat(String(v || '').replace('px', ''));
    return Number.isFinite(n) ? n : 0;
  }

  function sizeContentPanelToHud() {
    // ARCHIVES VIEWPORT TUNING
    // Top offset pulls the panel DOWN
    // Bottom offset pulls the panel UP
    const ARCHIVES_TOP_OFFSET_PX = 90;   // move down from the frame
    const ARCHIVES_BOTTOM_OFFSET_PX = 25; // lift up from the bottom strip

    if (!_contentPanelEl) return;

    const hudMain = document.querySelector('.hudStub.hudMain');
    if (!hudMain) return;

    // IMPORTANT:
    // hudMain.clientHeight INCLUDES padding, and we intentionally add a big padding-bottom
    // to reserve space for the pinned bottom strip.
    // So we size the panel to the *inner content box* (clientHeight minus paddings)
    // and let the reserved padding-bottom keep us clear of the strip.

    const hudH = hudMain.clientHeight || 0;
    const cs = window.getComputedStyle ? window.getComputedStyle(hudMain) : null;

    const padTop = cs ? pxToNum(cs.paddingTop) : 0;
    const padBottom = cs ? pxToNum(cs.paddingBottom) : 0;

    // Inner content area height (green box region)
    const innerH = Math.max(0, hudH - padTop - padBottom);

    // Account for the panel's top margin so it doesn't push past the reserved area
    const topGap = pxToNum(GREEN_BOX_MARGIN_TOP);
    const avail = Math.max(
      0,
      innerH - topGap - ARCHIVES_TOP_OFFSET_PX - ARCHIVES_BOTTOM_OFFSET_PX
    );

    _contentPanelEl.style.height = `${avail}px`;
    _contentPanelEl.style.maxHeight = `${avail}px`;
  }

  // Archives-only: expand the content panel to the “green box” height.
  // For other tabs, revert to the original auto-sizing behavior.
  function setArchiveViewportExpanded(isExpanded) {
    if (!_contentPanelEl) return;

    if (isExpanded) {
      // Archives-only vertical positioning
      _contentPanelEl.style.marginTop = '40px';
      sizeContentPanelToHud();
      if (!_onResize) {
        _onResize = () => window.requestAnimationFrame(sizeContentPanelToHud);
        window.addEventListener('resize', _onResize, { passive: true });
      }
    } else {
      // revert to original behavior
      _contentPanelEl.style.marginTop = '';
      _contentPanelEl.style.height = '';
      _contentPanelEl.style.maxHeight = '';

      if (_onResize) {
        window.removeEventListener('resize', _onResize);
        _onResize = null;
      }
    }
  }

  // ---- Music-only tuning ----
  const MUSIC_FRAME_HEIGHT = '110px'; // adjust safely (100px–130px)

  // 👉 HEADER WRAP (translucent layer) HEIGHT CONTROL (MUSIC ONLY)
  // This controls .neonFrameWrap (the magenta debug layer we confirmed).
  // Use MIN height for safety; set strict=true only if you want a fixed box.
  const NEON_WRAP_MIN_HEIGHT = '100px'; // try 140px–260px
  const NEON_WRAP_STRICT_HEIGHT = true; // true = force exact height (can clip)

  // 👉 VERTICAL POSITION ADJUSTMENT FOR THE NEON FRAME (MUSIC ONLY)
  // Negative values move the frame UP, positive values move it DOWN.
  const MUSIC_FRAME_Y_OFFSET = '0px';

  // 👉 TITLE POSITION INSIDE THE FRAME (MUSIC ONLY)
  // Negative = move title UP, positive = move title DOWN.
  const MUSIC_TITLE_Y_OFFSET = '-80px';

  // 👉 OPTIONAL: add breathing room inside the frame (MUSIC ONLY)
  // Use small values like '6px'–'14px'. Set to '0px' for none.
  const MUSIC_TITLE_PADDING_Y = '0px';
  const MUSIC_TITLE_VISUAL_NUDGE = '-93px';

  // ------------------------------------------------------------
  // ORANGE BOX (info strip) tuning knobs (Music only)
  // ------------------------------------------------------------
  const ORANGE_BOX_HEIGHT = '56px';
  const ORANGE_BOX_BOTTOM = '12px'; // distance from bottom of hudMain when pinned
  const ORANGE_BOX_SAFE_GAP = '16px'; // extra breathing room between strip + content/padding
  const ORANGE_BOX_MARGIN_TOP = '2px';
  const ORANGE_BOX_MAX_WIDTH = '96%';

  const ORANGE_BOX_X_OFFSET = '0px';
  const ORANGE_BOX_Y_OFFSET = '0px';

  const ORANGE_BOX_BORDER = '1px solid rgba(255, 70, 110, 0.55)';
  const ORANGE_BOX_RADIUS = '10px';
  const ORANGE_BOX_BG = 'rgba(0,0,0,0.12)';
  const ORANGE_BOX_GLOW =
    '0 0 0 1px rgba(255,70,110,0.12) inset, 0 0 18px rgba(255,70,110,0.10)';
  // ORANGE BOX text styling (match the small HUD instruction text vibe)
  const ORANGE_BOX_TEXT_SIZE = '11px';
  const ORANGE_BOX_TEXT_TRACKING = '.12em';

  // ------------------------------------------------------------
  // GREEN BOX (main content panel) tuning knobs (Music only)
  // ------------------------------------------------------------
  // This is the large area (your green box) that will swap content per tab.
  // Tweak these values to control padding/spacing/size/visual style.

  // Layout sizing
  const GREEN_BOX_DESKTOP_MIN_HEIGHT = '0px'; // desktop: auto-size to content (set to e.g. '320px' if you want a minimum)
  const GREEN_BOX_MOBILE_MIN_HEIGHT = '520px'; // mobile baseline (try 420px–820px)
  const GREEN_BOX_MAX_WIDTH = ORANGE_BOX_MAX_WIDTH; // keep aligned with strip by default

  // Positioning inside hudMain
  const GREEN_BOX_MARGIN_TOP = '14px'; // space from top of hudMain content area
  const GREEN_BOX_MARGIN_BOTTOM = '0px'; // usually 0 because orange strip is pinned

  // Inner padding (what you'll tool with)
  const GREEN_BOX_PADDING = '18px 18px'; // top/bottom left/right padding inside panel

  // Content alignment (desktop/default)
  const GREEN_BOX_ALIGN_ITEMS = 'center';
  const GREEN_BOX_JUSTIFY_CONTENT = 'center';
  const GREEN_BOX_TEXT_ALIGN = 'center';

  // Mobile overrides (optional)
  const GREEN_BOX_MOBILE_PADDING = '14px 12px';
  const GREEN_BOX_MOBILE_ALIGN_ITEMS = 'flex-start';
  const GREEN_BOX_MOBILE_JUSTIFY_CONTENT = 'flex-start';
  const GREEN_BOX_MOBILE_TEXT_ALIGN = 'left';

  // Optional: make it scroll if content is tall
  const GREEN_BOX_OVERFLOW_Y = 'auto'; // 'auto' | 'hidden' | 'scroll'

  // Ensure neon frame is visible on Music route
  function ensureFrameVisibleForMusic() {
    const wrap = document.querySelector('.neonFrameWrap');
    if (!wrap) return;

    if (_prevWrapDisplay === null) {
      _prevWrapDisplay = wrap.style.display || '';
    }
    wrap.style.display = 'block'; // override route-music CSS
    // --- Music-only: remove only wrap's overlay/fill (do NOT hide wrap itself) ---
    if (wrap.dataset.prevOpacity === undefined) {
      wrap.dataset.prevOpacity = wrap.style.opacity || '';
    }
    wrap.style.opacity = '1'; // keep the container visible so frame/title still show

    if (wrap.dataset.prevBg === undefined) {
      wrap.dataset.prevBg = wrap.style.background || '';
    }
    if (wrap.dataset.prevShadow === undefined) {
      wrap.dataset.prevShadow = wrap.style.boxShadow || '';
    }

    wrap.style.background = 'transparent';
    wrap.style.boxShadow = 'none';

    // Music-only positioning
    if (_prevWrapTransform === null) {
      _prevWrapTransform = wrap.style.transform || '';
    }
    wrap.style.transform = `translateY(${MUSIC_FRAME_Y_OFFSET})`;

    // Music-only: adjust the header wrap height (translucent layer)
    if (_prevWrapMinHeight === null) _prevWrapMinHeight = wrap.style.minHeight || '';
    if (_prevWrapHeight === null) _prevWrapHeight = wrap.style.height || '';

    wrap.style.minHeight = NEON_WRAP_MIN_HEIGHT;
    wrap.style.height = NEON_WRAP_STRICT_HEIGHT ? NEON_WRAP_MIN_HEIGHT : '';

    // Kill neonFrameWrap pseudo-element overlays (Music only)
    if (!document.getElementById('musicWrapOverlayKill')) {
      const s = document.createElement('style');
      s.id = 'musicWrapOverlayKill';
      s.textContent = `
        .route-music .neonFrameWrap::before,
        .route-music .neonFrameWrap::after{
          content:none !important;
          display:none !important;
          opacity:0 !important;
        }
      `;
      document.head.appendChild(s);
    }

    // If the parent is centering, force top alignment for Music
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
      if (wrap.dataset.prevOpacity !== undefined) {
        wrap.style.opacity = wrap.dataset.prevOpacity;
        delete wrap.dataset.prevOpacity;
      }
      if (wrap.dataset.prevBg !== undefined) {
        wrap.style.background = wrap.dataset.prevBg;
        delete wrap.dataset.prevBg;
      }
      if (wrap.dataset.prevShadow !== undefined) {
        wrap.style.boxShadow = wrap.dataset.prevShadow;
        delete wrap.dataset.prevShadow;
      }
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

  // Apply Music-only frame height
  function applyMusicFrameHeight() {
    const frame = document.querySelector('.neonFrame');
    const orn = document.querySelector('.hudOrn');

    if (frame) {
      _prevFrameHeight = frame.style.height || '';
      frame.style.height = MUSIC_FRAME_HEIGHT;
    }
    if (orn) {
      _prevOrnHeight = orn.style.height || '';
      orn.style.height = MUSIC_FRAME_HEIGHT;
    }
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

    const strip = document.getElementById('musicInfoStrip');
    if (!strip) return;

    const wasActive = tabEl.classList.contains('is-active');

    strip.querySelectorAll('.hudTab').forEach((t) => {
      t.classList.remove('sweep');
    });

    if (!wasActive) {
      strip.querySelectorAll('.hudTab').forEach((t) => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      tabEl.classList.add('is-active');
      tabEl.setAttribute('aria-selected', 'true');
    }

    tabEl.classList.remove('sweep');
    void tabEl.offsetWidth;
    tabEl.classList.add('sweep');

    strip.classList.remove('ping', 'pulse');
    void strip.offsetWidth;
    strip.classList.add('ping');
  }

  function render(mountEl) {
    if (!mountEl) return;
    _mount = mountEl;

    // Music-only: remove HUD main container fill; keep the 1px border
    const hudMainBox = document.querySelector('.hudStub.hudMain');
    if (hudMainBox) {
      _prevHudMainBg = hudMainBox.style.background || '';
      hudMainBox.style.background = 'transparent';
    }

    ensureFrameVisibleForMusic();
    applyMusicFrameHeight();

    // OPTION B: move mount out of inner glass, hide inner
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
      mountEl.style.paddingTop = MUSIC_TITLE_PADDING_Y;
      mountEl.style.paddingBottom = MUSIC_TITLE_PADDING_Y;

      if (_prevGlassDisplay === null) _prevGlassDisplay = glassInner.style.display || '';
      glassInner.style.display = 'none';
    }

    _mount.innerHTML = `<span data-hud-main-text
      style="font-size:16px; line-height:1; letter-spacing:.14em; text-transform:none;
             display:inline-block; transform:translateY(${MUSIC_TITLE_VISUAL_NUDGE});">
      The World of Music
    </span>`;

    const hudMain = document.querySelector('.hudStub.hudMain');
    if (hudMain && !_orangeBoxEl) {
      if (_prevHudMainPadding === null) {
        _prevHudMainPadding = hudMain.style.padding || '';
      }

      hudMain.style.position = 'relative';
      hudMain.style.padding = `0 18px calc(${ORANGE_BOX_HEIGHT} + ${ORANGE_BOX_BOTTOM} + ${ORANGE_BOX_SAFE_GAP})`;

      // Ensure hudMain has a reliable height context for our “green box” sizing
      hudMain.style.boxSizing = 'border-box';
      hudMain.style.overflow = 'hidden';

      if (!_contentPanelEl) {
        _contentPanelEl = document.createElement('div');
        _contentPanelEl.id = 'musicContentPanel';

        _contentPanelEl.style.width = '100%';
        _contentPanelEl.style.maxWidth = ORANGE_BOX_MAX_WIDTH;
        _contentPanelEl.style.margin = `${GREEN_BOX_MARGIN_TOP} auto 0`;
        _contentPanelEl.style.minHeight = GREEN_BOX_DESKTOP_MIN_HEIGHT;
        _contentPanelEl.style.borderRadius = '10px';

        _contentPanelEl.style.border = '1px solid rgba(255, 70, 110, 0.25)';
        _contentPanelEl.style.background = 'rgba(0,0,0,0.10)';
        _contentPanelEl.style.boxShadow = '0 0 0 1px rgba(255,70,110,0.08) inset';

        _contentPanelEl.style.boxSizing = 'border-box';
        _contentPanelEl.style.padding = GREEN_BOX_PADDING;
        _contentPanelEl.style.overflowY = GREEN_BOX_OVERFLOW_Y;

        _contentPanelEl.style.display = 'flex';
        _contentPanelEl.style.alignItems = GREEN_BOX_ALIGN_ITEMS;
        _contentPanelEl.style.justifyContent = GREEN_BOX_JUSTIFY_CONTENT;
        _contentPanelEl.style.textAlign = GREEN_BOX_TEXT_ALIGN;

        if (window.matchMedia && window.matchMedia('(max-width: 520px)').matches) {
          _contentPanelEl.style.padding = GREEN_BOX_MOBILE_PADDING;
          _contentPanelEl.style.alignItems = GREEN_BOX_MOBILE_ALIGN_ITEMS;
          _contentPanelEl.style.justifyContent = GREEN_BOX_MOBILE_JUSTIFY_CONTENT;
          _contentPanelEl.style.textAlign = GREEN_BOX_MOBILE_TEXT_ALIGN;
          _contentPanelEl.style.minHeight = GREEN_BOX_MOBILE_MIN_HEIGHT;
        }

        _contentPanelEl.innerHTML = `
          <div style="max-width:720px; opacity:.85; font-size:14px; line-height:1.6; letter-spacing:.04em; text-transform:none;">
            <strong>Welcome to the Music section for this page.</strong><br><br>
            Please make your selection below.
          </div>
        `;

        hudMain.appendChild(_contentPanelEl);
      }

      _orangeBoxEl = document.createElement('div');
      _orangeBoxEl.id = 'musicInfoStrip';

      // styles injected (content wipe + strip)
      if (!document.getElementById('musicContentWipeStyles')) {
        const cs = document.createElement('style');
        cs.id = 'musicContentWipeStyles';
        cs.textContent = `
          #musicContentPanel{ position:relative; }
          #musicContentPanel.wipe-out{ animation: musicContentWipeOut 140ms ease-out both; }
          #musicContentPanel.wipe-in{ animation: musicContentWipeIn 180ms ease-out both; }

          @keyframes musicContentWipeOut{
            0%{ opacity:1; filter:blur(0px); clip-path:inset(0% 0% 0% 0%); }
            100%{ opacity:0; filter:blur(.8px); clip-path:inset(0% 0% 0% 100%); }
          }
          @keyframes musicContentWipeIn{
            0%{ opacity:0; filter:blur(.8px); clip-path:inset(0% 100% 0% 0%); }
            100%{ opacity:1; filter:blur(0px); clip-path:inset(0% 0% 0% 0%); }
          }

          #musicContentPanel .termLine{
            opacity:.85;
            font-size:14px;
            letter-spacing:.04em;
            text-transform:none;
            font-variant:normal;
            display:inline-block;
            white-space:pre-wrap;
          }
          #musicContentPanel .termText{ text-transform:none; font-variant:normal; }
          #musicContentPanel .termCaret{
            display:inline-block;
            width:0.6ch;
            transform:translateY(1px);
            animation:termBlink 700ms steps(1) infinite;
          }
          @keyframes termBlink{ 50%{ opacity:0; } }

          @media (prefers-reduced-motion: reduce){
            #musicContentPanel.wipe-out,
            #musicContentPanel.wipe-in{ animation:none !important; }
          }
        `;
        document.head.appendChild(cs);
      }

      if (!document.getElementById('musicInfoStripStyles')) {
        const style = document.createElement('style');
        style.id = 'musicInfoStripStyles';
        style.textContent = `
          #musicInfoStrip{ overflow:hidden; }

          #musicInfoStrip .hudTabs{
            display:flex;
            gap:16px;
            align-items:center;
            justify-content:center;
            white-space:nowrap;
            user-select:none;
          }

          #musicInfoStrip .hudTab{
            position:relative;
            cursor:pointer;
            pointer-events:auto;
            padding:10px 6px;
            font-size:${ORANGE_BOX_TEXT_SIZE};
            letter-spacing:${ORANGE_BOX_TEXT_TRACKING};
            text-transform:uppercase;
            opacity:.75;
            transition: opacity 140ms ease, filter 140ms ease, transform 140ms ease;
          }

          #musicInfoStrip .hudTab:hover{
            opacity:.95;
            filter:brightness(1.15);
            transform:translateY(-1px);
          }

          #musicInfoStrip .hudTab::after{
            content:"";
            position:absolute;
            left:0; right:0;
            bottom:4px;
            height:2px;
            border-radius:999px;
            opacity:0;
            transform:scaleX(0);
            transform-origin:left center;
            background:rgba(255,70,110,0.85);
            box-shadow:0 0 10px rgba(255,70,110,0.35);
            transition:opacity 160ms ease;
          }

          #musicInfoStrip .hudTab.is-active{ opacity:1; filter:brightness(1.25); }
          #musicInfoStrip .hudTab.is-active::after{ opacity:1; }

          @keyframes hudUnderlineSweep{
            0%{ transform:scaleX(0); }
            70%{ transform:scaleX(1.06); }
            100%{ transform:scaleX(1); }
          }
          #musicInfoStrip .hudTab.sweep::after{
            animation:hudUnderlineSweep 220ms cubic-bezier(.2,.9,.2,1) both;
          }

          #musicInfoStrip .scanPing{
            pointer-events:none;
            position:absolute;
            left:-30%;
            top:0;
            width:30%;
            height:100%;
            opacity:0;
            background:linear-gradient(
              90deg,
              rgba(255,255,255,0) 0%,
              rgba(255,255,255,.10) 45%,
              rgba(255,255,255,0) 100%
            );
            filter:blur(.2px);
            transform:skewX(-18deg);
          }

          @keyframes hudScanPing{
            0%{ transform:translateX(0) skewX(-18deg); opacity:0; }
            10%{ opacity:.65; }
            60%{ opacity:.35; }
            100%{ transform:translateX(520%) skewX(-18deg); opacity:0; }
          }
          #musicInfoStrip.ping .scanPing{ animation:hudScanPing 320ms ease-out both; }

          @keyframes hudBorderPulse{
            0%{ box-shadow:${ORANGE_BOX_GLOW}; }
            50%{ box-shadow:0 0 0 1px rgba(255,70,110,0.18) inset, 0 0 26px rgba(255,70,110,0.18); }
            100%{ box-shadow:${ORANGE_BOX_GLOW}; }
          }
          #musicInfoStrip.pulse{ animation:hudBorderPulse 240ms ease-out both; }
        `;
        document.head.appendChild(style);
      }

      _orangeBoxEl.style.height = ORANGE_BOX_HEIGHT;
      _orangeBoxEl.style.maxWidth = ORANGE_BOX_MAX_WIDTH;
      _orangeBoxEl.style.width = '100%';
      _orangeBoxEl.style.position = 'absolute';
      _orangeBoxEl.style.left = '50%';
      _orangeBoxEl.style.bottom = ORANGE_BOX_BOTTOM;
      _orangeBoxEl.style.transform = `translateX(-50%) translate(${ORANGE_BOX_X_OFFSET}, ${ORANGE_BOX_Y_OFFSET})`;

      _orangeBoxEl.style.border = 'none';
      _orangeBoxEl.style.borderRadius = ORANGE_BOX_RADIUS;
      _orangeBoxEl.style.background = ORANGE_BOX_BG;
      _orangeBoxEl.style.boxShadow = 'none';
      _orangeBoxEl.style.display = 'flex';
      _orangeBoxEl.style.alignItems = 'center';
      _orangeBoxEl.style.justifyContent = 'center';
      _orangeBoxEl.style.textAlign = 'center';

      _orangeBoxEl.innerHTML = `
        <div class="hudTabs" role="tablist" aria-label="Music sections">
          <div class="hudTab" data-tab="archives" role="tab" aria-selected="false">Archives</div>
          <div class="hudTab" data-tab="origins" role="tab" aria-selected="false">Origins</div>
          <div class="hudTab" data-tab="notes" role="tab" aria-selected="false">Notes</div>
          <div class="hudTab" data-tab="updates" role="tab" aria-selected="false">Updates</div>
        </div>
        <div class="scanPing" aria-hidden="true"></div>
      `;

      const WIPE_OUT_MS = 140;
      const WIPE_IN_MS = 180;
      const TYPE_MS = 7;
      let _typeTimer = null;

      function wipeSwapContent(nextHtml, terminalText) {
        if (!_contentPanelEl) return;
        const prefersReduced =
          window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (prefersReduced) {
          _contentPanelEl.innerHTML = nextHtml;
          return;
        }

        _contentPanelEl.classList.remove('wipe-out', 'wipe-in');
        void _contentPanelEl.offsetWidth;
        _contentPanelEl.classList.add('wipe-out');

        window.setTimeout(() => {
          if (terminalText) {
            _contentPanelEl.innerHTML = `
              <div class="termLine"><span class="termText"></span><span class="termCaret">▌</span></div>
            `;
          } else {
            _contentPanelEl.innerHTML = nextHtml;
          }

          _contentPanelEl.classList.remove('wipe-out');
          void _contentPanelEl.offsetWidth;
          _contentPanelEl.classList.add('wipe-in');

          window.setTimeout(() => {
            _contentPanelEl.classList.remove('wipe-in');

            if (terminalText) {
              const term = _contentPanelEl.querySelector('.termText');
              if (!term) return;

              if (_typeTimer) {
                window.clearInterval(_typeTimer);
                _typeTimer = null;
              }

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

      _orangeBoxEl.querySelectorAll('.hudTab').forEach((tab) => {
        tab.addEventListener('click', () => {
          animateHudTab(tab);
          if (!_contentPanelEl) return;

          const label = tab.textContent.trim();

          // Archives is a driven UI: expand viewport (green box) ONLY for this tab
          if (label === 'Archives') {
            setArchiveViewportExpanded(true);
            wipeSwapContent(
              '<div style="opacity:.7; font-size:14px; letter-spacing:.12em; text-transform:uppercase;">Archives – Coming Soon</div>',
              'Archives – Coming Soon'
            );
            return;
          }

          // All other tabs: revert to original auto-sizing
          setArchiveViewportExpanded(false);

          if (label === 'Origins') {
            wipeSwapContent(
              '',
              `Personally, I've been always a concert goer throughout my life (with my first ever music-related show was Korn, Disturbed and Sev (the Pop Sucks 2 Tour) back in 2001 when they visited Maine. From there, my shows were fewer and far between for a stretch of time. However, the music project really ramped up in mid-2011 when I checked out a set from 3 bands - Dark Rain, Fifth Freedom and 13 High - at a local bar and thoroughly enjoyed the music. Flash forward a couple months to Sept 2011, where I was invited to check out 13 High once more. Their sound was definitely I was grooving to at that time - in which after helping with equipment load in and out for my buddy Eric at the time (had an injury), it evolved into going another, and another, and another.....until it became what it is today.

Back then, I started to just take pictures (albeit not the best, but gotta start somewhere) for keepsakes of what I've seen and been through. From going to a lot of the 13 High shows between 2011 and a lot of 2012, I was hooked. And as through those shows, most of those bands from there became life-long friends of mine, and I wouldn't trade it for the world. Fast forward now to 2025 and 14 years later it is still a prevalent force in my life. Without that one decision back then, who knows where I would be today! This page is dedicated to the vast journey that it has been and will continue to be until I can no longer do it anymore.`
            );
            return;
          }

          if (label === 'Notes') {
            wipeSwapContent(
              '',
              `1: As you get further back in the Show tab, the quality of the shots does drop off as well - especially 2013 backwards.

2: This is a complete work in progress and things will change throughout. If you see something that looks off, please let me know (Contact section coming soon).`
            );
            return;
          }

          // Updates (or anything else)
          wipeSwapContent(
            `<div style="opacity:.7; font-size:14px; letter-spacing:.12em; text-transform:uppercase;">${label} – Coming Soon</div>`,
            `${label} – Coming Soon`
          );
        });
      });

      _orangeBoxEl.style.pointerEvents = 'auto';
      hudMain.appendChild(_orangeBoxEl);

      // Default: keep original auto-sizing unless Archives is selected
      setArchiveViewportExpanded(false);
    }
  }

  function onEnter() {
    // no-op for now
  }

  function destroy() {
    const hudMainBox = document.querySelector('.hudStub.hudMain');
    if (hudMainBox) {
      hudMainBox.style.background = _prevHudMainBg || '';
    }
    _prevHudMainBg = null;

    restoreFrameHeight();

    const glassInner = document.querySelector('.neonFrameTextInner');
    const glassOuter = document.querySelector('.neonFrameText');

    if (glassInner) {
      glassInner.style.display = _prevGlassDisplay || '';
    }
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

    if (_orangeBoxEl && _orangeBoxEl.parentNode) {
      _orangeBoxEl.parentNode.removeChild(_orangeBoxEl);
    }
    _orangeBoxEl = null;

    if (_contentPanelEl && _contentPanelEl.parentNode) {
      _contentPanelEl.parentNode.removeChild(_contentPanelEl);
    }
    _contentPanelEl = null;

    const hudMain = document.querySelector('.hudStub.hudMain');
    if (hudMain) {
      hudMain.style.padding = _prevHudMainPadding || '';
    }
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

  window.MusicArchive = { render, onEnter, destroy };
})();
