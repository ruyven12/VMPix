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
  const GREEN_BOX_OVERFLOW_Y = 'auto'; // 'auto' | 'hidden' | 'scroll' // 'auto' | 'hidden' | 'scroll'

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
    // Music-only: adjust the header wrap height (translucent layer)
    if (_prevWrapMinHeight === null)
      _prevWrapMinHeight = wrap.style.minHeight || '';
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
      if (_prevMenuAlign === null)
        _prevMenuAlign = menuHero.style.alignItems || '';
      if (_prevMenuPaddingTop === null)
        _prevMenuPaddingTop = menuHero.style.paddingTop || '';
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
      // --- restore neonFrameWrap opacity ---
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

    // Were we already active?
    const wasActive = tabEl.classList.contains('is-active');

    // Clear sweep from ALL tabs so we can re-run cleanly
    strip.querySelectorAll('.hudTab').forEach((t) => {
      t.classList.remove('sweep');
    });

    // If it wasn't active, switch active tab
    if (!wasActive) {
      strip.querySelectorAll('.hudTab').forEach((t) => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      tabEl.classList.add('is-active');
      tabEl.setAttribute('aria-selected', 'true');
    }

    // Always restart underline sweep on the clicked tab
    tabEl.classList.remove('sweep');
    void tabEl.offsetWidth; // force reflow (restarts keyframes)
    tabEl.classList.add('sweep');

    // Always restart scan ping + border pulse on every click
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

    // ------------------------------------------------------------
    // OPTION B (TEST / NOW DEFAULT):
    // Hide the entire .neonFrameTextInner box (glass layer),
    // BUT first move #hudMainMount out of it so our text still shows.
    //
    // EDIT THIS "BOX" BEHAVIOR HERE:
    // - Want the glass back? Comment out `glassInner.style.display = 'none';`
    // - Want title nudged? Adjust MUSIC_TITLE_Y_OFFSET above.
    // - Want extra padding? Adjust MUSIC_TITLE_PADDING_Y above.
    // ------------------------------------------------------------
    const glassInner = document.querySelector('.neonFrameTextInner');
    const glassOuter = document.querySelector('.neonFrameText');

    if (glassInner && glassOuter) {
      // store + sanitize outer (some themes add a window bg/shadow here)
      if (_prevOuterBg === null)
        _prevOuterBg = glassOuter.style.background || '';
      if (_prevOuterShadow === null)
        _prevOuterShadow = glassOuter.style.boxShadow || '';
      if (_prevOuterPos === null)
        _prevOuterPos = glassOuter.style.position || '';

      glassOuter.style.background = 'transparent';
      glassOuter.style.boxShadow = 'none';
      if (!glassOuter.style.position) glassOuter.style.position = 'relative';

      // ✅ CENTER LOCK FOR OPTION B
      // Make the OUTER box a true full-height flex-center container
      glassOuter.style.display = 'flex';
      glassOuter.style.alignItems = 'center';
      glassOuter.style.justifyContent = 'center';
      glassOuter.style.height = '100%';
      glassOuter.style.padding = '0';
      glassOuter.style.margin = '0';

      // store mount original position for restore (only once)
      if (_prevMountParent === null) {
        _prevMountParent = mountEl.parentNode;
        _prevMountNextSibling = mountEl.nextSibling;
        _prevMountStyle = mountEl.getAttribute('style') || '';
      }

      // move mount to the outer layer (so we can hide the inner)
      glassOuter.appendChild(mountEl);

      // make mount fill the frame and center its contents
      mountEl.style.display = 'flex';
      mountEl.style.alignItems = 'center';
      mountEl.style.justifyContent = 'center';
      mountEl.style.width = '100%';
      mountEl.style.height = '100%';
      mountEl.style.position = 'relative';
      mountEl.style.zIndex = '2';
      mountEl.style.paddingTop = MUSIC_TITLE_PADDING_Y;
      mountEl.style.paddingBottom = MUSIC_TITLE_PADDING_Y;

      // now safe to truly remove the inner glass container
      if (_prevGlassDisplay === null)
        _prevGlassDisplay = glassInner.style.display || '';
      glassInner.style.display = 'none';
    }

    // Simple title only (baseline)
    _mount.innerHTML = `<span data-hud-main-text
     style="font-size:16px; line-height:1; letter-spacing:.14em; text-transform:uppercase;
            display:inline-block; transform:translateY(${MUSIC_TITLE_VISUAL_NUDGE});">
     The World of Music
   </span>`;

    // ------------------------------------------------------------
    // ORANGE BOX (info strip) — CREATE AREA ONLY (no content yet)
    // Edit ORANGE_BOX_* constants above to reposition/size/style it.
    // ------------------------------------------------------------
    const hudMain = document.querySelector('.hudStub.hudMain');
    if (hudMain && !_orangeBoxEl) {
      if (_prevHudMainPadding === null) {
        _prevHudMainPadding = hudMain.style.padding || '';
      }

      // Keep this minimal; just enough to not crush layout.
      hudMain.style.position = 'relative'; // anchor for absolute children
      // Device-aware padding: bottom space follows the pinned orange strip
      hudMain.style.padding = `0 18px calc(${ORANGE_BOX_HEIGHT} + ${ORANGE_BOX_BOTTOM} + ${ORANGE_BOX_SAFE_GAP})`;

      // ------------------------------------------------------------
      // GREEN BOX (main content area) — placeholder container
      // This is the big area that will change when tabs are clicked.
      // ------------------------------------------------------------
      if (!_contentPanelEl) {
        _contentPanelEl = document.createElement('div');
        _contentPanelEl.id = 'musicContentPanel';

        // Visual + layout: fills the main space above the orange strip
        _contentPanelEl.style.width = '100%';
        _contentPanelEl.style.maxWidth = ORANGE_BOX_MAX_WIDTH; // keep alignment consistent
        _contentPanelEl.style.margin = '5px auto 0';
        _contentPanelEl.style.minHeight = GREEN_BOX_DESKTOP_MIN_HEIGHT; // device-aware baseline
        _contentPanelEl.style.borderRadius = '10px';

        // Match HUD vibe (subtle, not overpowering)
        _contentPanelEl.style.border = '1px solid rgba(255, 70, 110, 0.25)';
        _contentPanelEl.style.background = 'rgba(0,0,0,0.10)';
        _contentPanelEl.style.boxShadow =
          '0 0 0 1px rgba(255,70,110,0.08) inset';

        // Content panel layout (tunable)
        _contentPanelEl.style.boxSizing = 'border-box';
        _contentPanelEl.style.padding = GREEN_BOX_PADDING;
        _contentPanelEl.style.overflowY = GREEN_BOX_OVERFLOW_Y;

        // Default: center content (you can change these constants above)
        _contentPanelEl.style.display = 'flex';
        _contentPanelEl.style.alignItems = GREEN_BOX_ALIGN_ITEMS;
        _contentPanelEl.style.justifyContent = GREEN_BOX_JUSTIFY_CONTENT;
        _contentPanelEl.style.textAlign = GREEN_BOX_TEXT_ALIGN;

        // Mobile overrides (optional)
        if (window.matchMedia && window.matchMedia('(max-width: 520px)').matches) {
          _contentPanelEl.style.padding = GREEN_BOX_MOBILE_PADDING;
          _contentPanelEl.style.alignItems = GREEN_BOX_MOBILE_ALIGN_ITEMS;
          _contentPanelEl.style.justifyContent = GREEN_BOX_MOBILE_JUSTIFY_CONTENT;
          _contentPanelEl.style.textAlign = GREEN_BOX_MOBILE_TEXT_ALIGN;
          _contentPanelEl.style.minHeight = GREEN_BOX_MOBILE_MIN_HEIGHT;
        }

        // Temporary placeholder text (safe to remove later)
        _contentPanelEl.innerHTML = `
  <div style="max-width:720px; opacity:.85; font-size:14px; line-height:1.6; letter-spacing:.04em; text-transform:none;">
    <strong>Welcome to the Music section for this page.</strong><br><br>
    Please make your selection below.
  </div>
`;

        // IMPORTANT: append BEFORE the orange strip so it sits above it
        hudMain.appendChild(_contentPanelEl);
      }

      _orangeBoxEl = document.createElement('div');
      _orangeBoxEl.id = 'musicInfoStrip';

      // ===== HUD TABS ANIMATION (Combo A) =====
      // Content panel wipe animation (safe test harness)
      if (!document.getElementById('musicContentWipeStyles')) {
        const cs = document.createElement('style');
        cs.id = 'musicContentWipeStyles';
        cs.textContent = `
  /* Content wipe (panel) */
  #musicContentPanel{ position:relative; }
  #musicContentPanel.wipe-out{ animation: musicContentWipeOut 140ms ease-out both; }
  #musicContentPanel.wipe-in{ animation: musicContentWipeIn 180ms ease-out both; }

  @keyframes musicContentWipeOut{
    0%{ opacity:1; filter:blur(0px); clip-path:inset(0% 0% 0% 0%); }
    100%{ opacity:0; filter:blur(.8px); clip-path:inset(0% 100% 0% 0%); }
  }
  @keyframes musicContentWipeIn{
    0%{ opacity:0; filter:blur(.8px); clip-path:inset(0% 0% 0% 100%); }
    100%{ opacity:1; filter:blur(0px); clip-path:inset(0% 0% 0% 0%); }
  }

  /* Reduced motion: no wipe, just swap */
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
    /* Strip */
    #musicInfoStrip{ overflow:hidden; }

    /* Tabs layout */
    #musicInfoStrip .hudTabs{
      display:flex;
      gap:16px;
      align-items:center;
      justify-content:center;
      white-space:nowrap;
      user-select:none;
    }

    /* Tab base */
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

    /* Underline (sweep) */
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

    #musicInfoStrip .hudTab.is-active{
      opacity:1;
      filter:brightness(1.25);
    }
    #musicInfoStrip .hudTab.is-active::after{ opacity:1; }

    @keyframes hudUnderlineSweep{
      0%{ transform:scaleX(0); }
      70%{ transform:scaleX(1.06); } /* tiny overshoot */
      100%{ transform:scaleX(1); }
    }
    #musicInfoStrip .hudTab.sweep::after{
      animation:hudUnderlineSweep 220ms cubic-bezier(.2,.9,.2,1) both;
    }

    /* Scanline ping overlay */
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
    #musicInfoStrip.ping .scanPing{
      animation:hudScanPing 320ms ease-out both;
    }

    /* Optional: small border pulse */
    @keyframes hudBorderPulse{
      0%{ box-shadow:${ORANGE_BOX_GLOW}; }
      50%{ box-shadow:0 0 0 1px rgba(255,70,110,0.18) inset, 0 0 26px rgba(255,70,110,0.18); }
      100%{ box-shadow:${ORANGE_BOX_GLOW}; }
    }
    #musicInfoStrip.pulse{
      animation:hudBorderPulse 240ms ease-out both;
    }
  `;
        document.head.appendChild(style);
      }

      _orangeBoxEl.style.height = ORANGE_BOX_HEIGHT;
      _orangeBoxEl.style.maxWidth = ORANGE_BOX_MAX_WIDTH;
      _orangeBoxEl.style.width = '100%';
      _orangeBoxEl.style.transform = `translate(${ORANGE_BOX_X_OFFSET}, ${ORANGE_BOX_Y_OFFSET})`;
      // ⬇️ PIN ORANGE BOX TO BOTTOM OF HUD MAIN
      _orangeBoxEl.style.position = 'absolute';
      _orangeBoxEl.style.left = '50%';
      _orangeBoxEl.style.bottom = ORANGE_BOX_BOTTOM; // adjust up/down if needed
      _orangeBoxEl.style.transform = `translateX(-50%) translate(${ORANGE_BOX_X_OFFSET}, ${ORANGE_BOX_Y_OFFSET})`;

      _orangeBoxEl.style.border = 'none';
      _orangeBoxEl.style.borderRadius = ORANGE_BOX_RADIUS;
      _orangeBoxEl.style.background = ORANGE_BOX_BG;
      _orangeBoxEl.style.boxShadow = 'none';
      // Center contents in the strip (safe: affects only the strip)
      _orangeBoxEl.style.display = 'flex';
      _orangeBoxEl.style.alignItems = 'center';
      _orangeBoxEl.style.justifyContent = 'center';
      _orangeBoxEl.style.textAlign = 'center';

      // Put HUD-style text inside (we'll turn these into real tabs later)
      _orangeBoxEl.innerHTML = `
  <div class="hudTabs" role="tablist" aria-label="Music sections">
    <div class="hudTab" data-tab="archives" role="tab" aria-selected="false">Archives</div>
    <div class="hudTab" data-tab="origins" role="tab" aria-selected="false">Origins</div>
    <div class="hudTab" data-tab="notes" role="tab" aria-selected="false">Notes</div>
    <div class="hudTab" data-tab="updates" role="tab" aria-selected="false">Updates</div>
  </div>
  <div class="scanPing" aria-hidden="true"></div>
`;

      // --- TAB CLICK HANDLING (TEST CONTENT ONLY) ---
      const WIPE_OUT_MS = 140;
      const WIPE_IN_MS = 180;

      function wipeSwapContent(nextHtml) {
        if (!_contentPanelEl) return;
        const prefersReduced =
          window.matchMedia &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (prefersReduced) {
          _contentPanelEl.innerHTML = nextHtml;
          return;
        }

        // restart any running animations cleanly
        _contentPanelEl.classList.remove('wipe-out', 'wipe-in');
        void _contentPanelEl.offsetWidth;
        _contentPanelEl.classList.add('wipe-out');

        window.setTimeout(() => {
          _contentPanelEl.innerHTML = nextHtml;
          _contentPanelEl.classList.remove('wipe-out');
          void _contentPanelEl.offsetWidth;
          _contentPanelEl.classList.add('wipe-in');

          window.setTimeout(() => {
            _contentPanelEl.classList.remove('wipe-in');
          }, WIPE_IN_MS);
        }, WIPE_OUT_MS);
      }

      _orangeBoxEl.querySelectorAll('.hudTab').forEach((tab) => {
        tab.addEventListener('click', () => {
          animateHudTab(tab);
          if (_contentPanelEl) {
            const label = tab.textContent.trim();
            if (label === 'Origins') {
              wipeSwapContent(`
                <div style="max-width:820px; opacity:.85; font-size:14px; line-height:1.7; letter-spacing:.03em; text-transform:none;">
                  Personally, I've been always a concert goer throughout my life (with my first ever music-related show was Korn, Disturbed and Sev (the Pop Sucks 2 Tour) back in 2001 when they visited Maine. From there, my shows were fewer and far between for a stretch of time. However, the music project really ramped up in mid-2011 when I checked out a set from 3 bands - Dark Rain, Fifth Freedom and 13 High - at a local bar and thoroughly enjoyed the music. Flash forward a couple months to Sept 2011, where I was invited to check out 13 High once more. Their sound was definitely I was grooving to at that time - in which after helping with equipment load in and out for my buddy Eric at the time (had an injury), it evolved into going another, and another, and another.....until it became what it is today.
                  <br><br>
                  Back then, I started to just take pictures (albeit not the best, but gotta start somewhere) for keepsakes of what I've seen and been through. From going to a lot of the 13 High shows between 2011 and a lot of 2012, I was hooked. And as through those shows, most of those bands from there became life-long friends of mine, and I wouldn't trade it for the world. Fast forward now to 2025 and 14 years later it is still a prevalent force in my life. Without that one decision back then, who knows where I would be today! This page is dedicated to the vast journey that it has been and will continue to be until I can no longer do it anymore.
                </div>
              `);
            } else {
              wipeSwapContent(`
                <div style="opacity:.7; font-size:14px; letter-spacing:.12em; text-transform:uppercase;">
                  ${label} – Coming Soon
                </div>
              `);
            }
          }
        });
      });

      // no content yet; just a visible area
      _orangeBoxEl.style.pointerEvents = 'auto';

      hudMain.appendChild(_orangeBoxEl);
    }
  }

  function onEnter() {
    // no-op for now
  }

  function destroy() {
    // restore HUD main box background
    const hudMainBox = document.querySelector('.hudStub.hudMain');
    if (hudMainBox) {
      hudMainBox.style.background = _prevHudMainBg || '';
    }
    _prevHudMainBg = null;

    restoreFrameHeight();

    // restore glass + mount position (Option B)
    const glassInner = document.querySelector('.neonFrameTextInner');
    const glassOuter = document.querySelector('.neonFrameText');

    // unhide inner
    if (glassInner) {
      glassInner.style.display = _prevGlassDisplay || '';
    }
    _prevGlassDisplay = null;

    // restore outer styles
    if (glassOuter) {
      glassOuter.style.background = _prevOuterBg || '';
      glassOuter.style.boxShadow = _prevOuterShadow || '';
      glassOuter.style.position = _prevOuterPos || '';
    }
    _prevOuterBg = null;
    _prevOuterShadow = null;
    _prevOuterPos = null;

    // move mount back where it originally lived
    if (_mount && _prevMountParent) {
      // restore style attribute exactly (removes our flex/transform/padding, etc.)
      _mount.setAttribute('style', _prevMountStyle || '');

      // reinsert back at original spot
      if (
        _prevMountNextSibling &&
        _prevMountNextSibling.parentNode === _prevMountParent
      ) {
        _prevMountParent.insertBefore(_mount, _prevMountNextSibling);
      } else {
        _prevMountParent.appendChild(_mount);
      }
    }

    _prevMountParent = null;
    _prevMountNextSibling = null;
    _prevMountStyle = null;

    // ORANGE BOX cleanup (Music only)
    if (_orangeBoxEl && _orangeBoxEl.parentNode) {
      _orangeBoxEl.parentNode.removeChild(_orangeBoxEl);
    }
    _orangeBoxEl = null;

    // GREEN BOX cleanup (Music only)
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

    if (_mount) {
      _mount.innerHTML = '';
      _mount = null;
    }
  }

  window.MusicArchive = { render, onEnter, destroy };
})();
