// music-archive.js (user working file)
// Phase 2 clean baseline (DEDUPED)
// - Keeps HUD neon frame visible on Music route
// - Removes HUD main container fill only (Music only) â€” border stays
// - Allows Music-only frame height + vertical placement control
// - OPTION B: Re-parent #hudMainMount so .neonFrameTextInner can be display:none (glass removed)
// - Displays: THE WORLD OF MUSIC

(function () {
  'use strict';

  let _mount = null;
  let _suppressMusicTabUrlSync = false;

  // restore state
  let _prevWrapDisplay = null;
  let _prevWrapMinHeight = null;
  let _prevWrapHeight = null;
  let _prevHudMainBg = null;

  // HUD main flex auto-height restore (Music route only)
  // NOTE: These are referenced by setArchiveViewportExpanded(); they must exist
  // before any route logic runs (prevents ReferenceError in webviews).
  let _prevHudMainDisplay = null;
  let _prevHudMainFlexDirection = null;
  let _prevHudMainAlignItems = null;
  let _prevHudMainJustifyContent = null;
  // ORANGE BOX (info strip) restore â€” Music route only
  let _orangeBoxEl = null;
  let _prevHudMainPadding = null;

  // page horizontal overflow restore (Music route only)
  let _prevHtmlOverflowX = null;
  let _prevBodyOverflowX = null;

  // GREEN BOX (main changing content area) â€” Music route only
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
  // Title band (frame) fill removal restore (Music route only)
  let _prevFrameBg = null;
  let _prevFrameShadow = null;
  let _prevFrameFilter = null;
  let _prevOrnBg = null;
  let _prevOrnShadow = null;
  let _prevOrnFilter = null;

  // content sizing (Music route only)
  let _onResize = null;

  function pxToNum(v) {
    const n = parseFloat(String(v || '').replace('px', ''));
    return Number.isFinite(n) ? n : 0;
  }

  function isMusicMobileViewport() {
    try {
      return Math.min(window.innerWidth || 0, window.innerHeight || 0) <= 760;
    } catch (_) {
      return false;
    }
  }

  function updateMusicViewportDebug(info) {
    try {
      const el = document.getElementById('musicViewportDebug');
      if (!el) return;
      const data = info && typeof info === 'object' ? info : {};
      const lines = [
        `mobile=${!!data.mobile} expanded=${!!data.expanded} mode=${String(data.mode || '').trim() || 'unknown'}`,
        `viewport=${Number(data.viewportHeight || 0)} panelTop=${Number(data.panelTop || 0)} panelHeight=${Number(data.panelHeight || 0)}`,
        `hudH=${Number(data.hudHeight || 0)} innerH=${Number(data.innerHeight || 0)}`
      ];
      el.textContent = lines.join(' | ');
      el.style.display = 'block';
    } catch (_) {}
  }

  function getMusicViewportDebugMarkup() {
    return `<div id="musicViewportDebug" style="display:none; position:sticky; top:0; z-index:5; margin:0 0 10px; padding:8px 10px; border:1px solid rgba(97,224,255,.22); border-radius:10px; background:rgba(6,12,18,.92); color:rgba(210,242,255,.92); font-family:'Orbitron',system-ui,sans-serif; font-size:9px; line-height:1.5; text-transform:none; word-break:break-word;"></div>`;
  }

  function sizeContentPanelToHud() {
    // Reduce fragile layout magic numbers:
    // Compute the scrollable "green box" height from real DOM geometry,
    // so changes to paddings/strips/titles don't require re-tuning pixel offsets.
    if (!_contentPanelEl) return;

    const hudMain = document.querySelector('.hudStub.hudMain');
    if (!hudMain) return;

    // Music route: prevent horizontal overflow (webviews / 100vw quirks / animated layers).
    // Keep vertical overflow visible so nothing is visually clipped.
    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    if (htmlEl && _prevHtmlOverflowX === null) _prevHtmlOverflowX = htmlEl.style.overflowX || '';
    if (bodyEl && _prevBodyOverflowX === null) _prevBodyOverflowX = bodyEl.style.overflowX || '';
    if (htmlEl) htmlEl.style.overflowX = 'hidden';
    if (bodyEl) bodyEl.style.overflowX = 'hidden';

    if (isMusicMobileViewport()) {
      try {
        const panelRectMobile = _contentPanelEl.getBoundingClientRect();
        const viewportHeight =
          Math.max(
            Number(window.innerHeight) || 0,
            Number(document.documentElement && document.documentElement.clientHeight) || 0
          ) || 0;
        const bottomGap = 12;
        if (panelRectMobile && Number.isFinite(panelRectMobile.top) && viewportHeight > 0) {
          const availMobile = Math.max(220, Math.floor(viewportHeight - panelRectMobile.top - bottomGap));
          _contentPanelEl.style.height = `${availMobile}px`;
          _contentPanelEl.style.maxHeight = `${availMobile}px`;
          _contentPanelEl.style.minHeight = '0px';
          updateMusicViewportDebug({
            mobile: true,
            expanded: !!(_contentPanelEl.style.flex && _contentPanelEl.style.flex.indexOf('1 1 auto') >= 0),
            mode: document.querySelector('#musicInfoStrip .hudTab.is-active, #musicInfoStrip .hudTab[aria-selected="true"]')?.textContent || '',
            viewportHeight,
            panelTop: Math.round(panelRectMobile.top || 0),
            panelHeight: availMobile,
            hudHeight: hudMain.clientHeight || 0,
            innerHeight: window.innerHeight || 0
          });
          return;
        }
      } catch (_) {}
    }

    const hudH = hudMain.clientHeight || 0;
    const cs = window.getComputedStyle ? window.getComputedStyle(hudMain) : null;

    const padTop = cs ? pxToNum(cs.paddingTop) : 0;
    const padBottom = cs ? pxToNum(cs.paddingBottom) : 0;

    // Inner content area height (green box region)
    const innerH = Math.max(0, hudH - padTop - padBottom);

    // Derive the available height based on where the content panel starts and
    // where the pinned info strip (orange box) begins.
    // Fallback to the previous behavior if geometry isn't available yet.
    try {
      const hudRect = hudMain.getBoundingClientRect();
      const panelRect = _contentPanelEl.getBoundingClientRect();

      if (hudRect && panelRect && Number.isFinite(hudRect.top) && Number.isFinite(panelRect.top)) {
        const panelTopInner = Math.max(0, (panelRect.top - hudRect.top) - padTop);

        // If the orange strip exists *below* the panel (pinned/footer style), reserve everything
        // from its top down (plus a safe gap). If the strip is above the panel (header style),
        // do NOT reserve it.
        let orangeTopInner = innerH;
        if (_orangeBoxEl) {
          const oRect = _orangeBoxEl.getBoundingClientRect();
          if (oRect && Number.isFinite(oRect.top) && Number.isFinite(panelRect.top)) {
            // Only reserve space if the strip starts BELOW the panel top.
            if (oRect.top > panelRect.top + 1) {
              orangeTopInner = Math.max(0, (oRect.top - hudRect.top) - padTop);
            }
          }
        }

        const safeGap = pxToNum(ORANGE_BOX_SAFE_GAP);
        const avail = Math.max(0, orangeTopInner - safeGap - panelTopInner);

        _contentPanelEl.style.height = `${avail}px`;
        _contentPanelEl.style.maxHeight = `${avail}px`;
        updateMusicViewportDebug({
          mobile: false,
          expanded: !!(_contentPanelEl.style.flex && _contentPanelEl.style.flex.indexOf('1 1 auto') >= 0),
          mode: document.querySelector('#musicInfoStrip .hudTab.is-active, #musicInfoStrip .hudTab[aria-selected="true"]')?.textContent || '',
          viewportHeight: window.innerHeight || 0,
          panelTop: Math.round(panelRect.top || 0),
          panelHeight: avail,
          hudHeight: hudH,
          innerHeight: innerH
        });
        return;
      }
    } catch (_) {}

    // Fallback (legacy tuning knobs)
    const topGap = pxToNum(GREEN_BOX_MARGIN_TOP);
    const ARCHIVES_TOP_OFFSET_PX = 115;
    const ARCHIVES_BOTTOM_OFFSET_PX = 15;
    const avail = Math.max(0, innerH - topGap - ARCHIVES_TOP_OFFSET_PX - ARCHIVES_BOTTOM_OFFSET_PX);
    _contentPanelEl.style.height = `${avail}px`;
    _contentPanelEl.style.maxHeight = `${avail}px`;
    updateMusicViewportDebug({
      mobile: isMusicMobileViewport(),
      expanded: !!(_contentPanelEl.style.flex && _contentPanelEl.style.flex.indexOf('1 1 auto') >= 0),
      mode: document.querySelector('#musicInfoStrip .hudTab.is-active, #musicInfoStrip .hudTab[aria-selected="true"]')?.textContent || '',
      viewportHeight: window.innerHeight || 0,
      panelTop: 0,
      panelHeight: avail,
      hudHeight: hudH,
      innerHeight: innerH
    });
  }

  // Archives-only: expand the content panel to the â€œgreen boxâ€ height.
  // For other tabs, revert to the original auto-sizing behavior.
  function setArchiveViewportExpanded(isExpanded) {
    if (!_contentPanelEl) return;
    const isMobile = isMusicMobileViewport();
    const ensureViewportSizing = () => {
      if (_onResize) {
        window.removeEventListener('resize', _onResize);
        _onResize = null;
      }
      _onResize = function musicArchiveViewportResize() {
        sizeContentPanelToHud();
      };
      window.addEventListener('resize', _onResize, { passive: true });
      try {
        window.requestAnimationFrame(() => sizeContentPanelToHud());
      } catch (_) {
        sizeContentPanelToHud();
      }
    };

    if (isExpanded) {
      // Archives-only vertical positioning
      _contentPanelEl.style.marginTop = '40px';
      _contentPanelEl.style.overflowY = 'auto';
      _contentPanelEl.style.overflowX = 'hidden';
      _contentPanelEl.style.webkitOverflowScrolling = 'touch';
      _contentPanelEl.style.overscrollBehavior = 'contain';
      // IMPORTANT: avoid flex vertical centering in scrollable archives viewport
      // (prevents top rows from being clipped / unreachable)
      _contentPanelEl.style.display = 'block';
      _contentPanelEl.style.alignItems = '';
      _contentPanelEl.style.justifyContent = '';
      _contentPanelEl.style.textAlign = '';

      // Prefer true auto-height via flex (Music route only) so the panel naturally
      // fills the remaining HUD height without fragile pixel math.
      const hudMain = document.querySelector('.hudStub.hudMain');
      if (hudMain) {
        if (_prevHudMainDisplay === null) _prevHudMainDisplay = hudMain.style.display || '';
        if (_prevHudMainFlexDirection === null) _prevHudMainFlexDirection = hudMain.style.flexDirection || '';
        if (_prevHudMainAlignItems === null) _prevHudMainAlignItems = hudMain.style.alignItems || '';
        if (_prevHudMainJustifyContent === null) _prevHudMainJustifyContent = hudMain.style.justifyContent || '';

        hudMain.style.display = 'flex';
        hudMain.style.flexDirection = 'column';
        hudMain.style.alignItems = 'center';
        hudMain.style.justifyContent = 'flex-start';
      }

      _contentPanelEl.style.flex = '1 1 auto';
      _contentPanelEl.style.minHeight = '0px';
      _contentPanelEl.style.height = '';
      _contentPanelEl.style.maxHeight = '';
      ensureViewportSizing();
    } else {
      if (isMobile) {
        _contentPanelEl.style.marginTop = '14px';
        _contentPanelEl.style.overflowY = 'auto';
        _contentPanelEl.style.overflowX = 'hidden';
        _contentPanelEl.style.webkitOverflowScrolling = 'touch';
        _contentPanelEl.style.overscrollBehavior = 'contain';
        _contentPanelEl.style.display = 'block';
        _contentPanelEl.style.alignItems = '';
        _contentPanelEl.style.justifyContent = '';
        _contentPanelEl.style.textAlign = '';

        const hudMainMobile = document.querySelector('.hudStub.hudMain');
        if (hudMainMobile) {
          if (_prevHudMainDisplay === null) _prevHudMainDisplay = hudMainMobile.style.display || '';
          if (_prevHudMainFlexDirection === null) _prevHudMainFlexDirection = hudMainMobile.style.flexDirection || '';
          if (_prevHudMainAlignItems === null) _prevHudMainAlignItems = hudMainMobile.style.alignItems || '';
          if (_prevHudMainJustifyContent === null) _prevHudMainJustifyContent = hudMainMobile.style.justifyContent || '';

          hudMainMobile.style.display = 'flex';
          hudMainMobile.style.flexDirection = 'column';
          hudMainMobile.style.alignItems = 'center';
          hudMainMobile.style.justifyContent = 'flex-start';
        }

        _contentPanelEl.style.flex = '1 1 auto';
        _contentPanelEl.style.minHeight = '0px';
        _contentPanelEl.style.height = '';
        _contentPanelEl.style.maxHeight = '';
        ensureViewportSizing();
        return;
      }

      // revert to original behavior
      _contentPanelEl.style.marginTop = '';
      _contentPanelEl.style.height = '';
      _contentPanelEl.style.maxHeight = '';
      _contentPanelEl.style.overflowY = '';
      _contentPanelEl.style.overflowX = '';
      _contentPanelEl.style.webkitOverflowScrolling = '';
      _contentPanelEl.style.overscrollBehavior = '';
      // Restore original (non-archives) layout
      _contentPanelEl.style.display = 'flex';
      _contentPanelEl.style.alignItems = 'center';
      _contentPanelEl.style.justifyContent = 'center';
      _contentPanelEl.style.textAlign = 'center';

      // Revert flex auto-height behavior
      _contentPanelEl.style.flex = '';
      _contentPanelEl.style.minHeight = '';

      const hudMain = document.querySelector('.hudStub.hudMain');
      if (hudMain) {
        if (_prevHudMainDisplay !== null) hudMain.style.display = _prevHudMainDisplay || '';
        if (_prevHudMainFlexDirection !== null) hudMain.style.flexDirection = _prevHudMainFlexDirection || '';
        if (_prevHudMainAlignItems !== null) hudMain.style.alignItems = _prevHudMainAlignItems || '';
        if (_prevHudMainJustifyContent !== null) hudMain.style.justifyContent = _prevHudMainJustifyContent || '';
      }

      _prevHudMainDisplay = null;
      _prevHudMainFlexDirection = null;
      _prevHudMainAlignItems = null;
      _prevHudMainJustifyContent = null;

      if (_onResize) {
        window.removeEventListener('resize', _onResize);
        _onResize = null;
      }
    }
  }

  // ---- Music-only tuning ----
  const MUSIC_FRAME_HEIGHT = '5px'; // adjust safely (100pxâ€“130px)

  // ðŸ‘‰ HEADER WRAP (translucent layer) HEIGHT CONTROL (MUSIC ONLY)
  // This controls .neonFrameWrap (the magenta debug layer we confirmed).
  // Use MIN height for safety; set strict=true only if you want a fixed box.
  const NEON_WRAP_MIN_HEIGHT = '5px'; // try 140pxâ€“260px
  const NEON_WRAP_STRICT_HEIGHT = false; // true = force exact height (can clip)

  // ðŸ‘‰ VERTICAL POSITION ADJUSTMENT FOR THE NEON FRAME (MUSIC ONLY)
  // Negative values move the frame UP, positive values move it DOWN.
  const MUSIC_FRAME_Y_OFFSET = '0px';

  // ðŸ‘‰ TITLE POSITION INSIDE THE FRAME (MUSIC ONLY)
  // Negative = move title UP, positive = move title DOWN.
  const MUSIC_TITLE_Y_OFFSET = '-80px';

  // ðŸ‘‰ OPTIONAL: add breathing room inside the frame (MUSIC ONLY)
  // Use small values like '6px'â€“'14px'. Set to '0px' for none.
  const MUSIC_TITLE_PADDING_Y = '0px';
  const MUSIC_TITLE_VISUAL_NUDGE = '-93px';

  // ------------------------------------------------------------
  // ORANGE BOX (info strip) tuning knobs (Music only)
  // ------------------------------------------------------------
  const ORANGE_BOX_HEIGHT = 'auto';
  const ORANGE_BOX_BOTTOM = '12px'; // distance from bottom of hudMain when pinned
  const ORANGE_BOX_SAFE_GAP = '16px'; // extra breathing room between strip + content/padding
  const ORANGE_BOX_MARGIN_TOP = '2px';
  const ORANGE_BOX_MAX_WIDTH = '96%';

  const ORANGE_BOX_X_OFFSET = '0px';
  const ORANGE_BOX_Y_OFFSET = '0px';

  const ORANGE_BOX_BORDER = '0 0 0 1px rgba(255,70,110,0.50) inset, 0 0 10px rgba(255,70,110,0.50)';
  const ORANGE_BOX_RADIUS = '10px';
  const ORANGE_BOX_BG = 'rgba(0,0,0,0.12)';
  const ORANGE_BOX_GLOW =
    '0 0 0 1px rgba(255,70,110,0.50) inset, 0 0 10px rgba(255,70,110,0.50)';
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
  const GREEN_BOX_MOBILE_MIN_HEIGHT = '520px'; // mobile baseline (try 420pxâ€“820px)
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

  // ðŸ‘‰ MUSIC LANDING PANELS (green/orange translucent boxes)
  // Set false to hide/remove the two translucent boxes on the Music route landing view.
  // (Tabs + content panel remain in code for later re-enable.)
  const SHOW_MUSIC_PANELS = true;

  // Debug outlines (keep OFF for production)
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
    wrap.style.backdropFilter = 'none';
    wrap.style.webkitBackdropFilter = 'none';

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

      // Music-only: remove the title-band translucent fill while keeping the frame border
      if (_prevFrameBg === null) _prevFrameBg = frame.style.background || '';
      if (_prevFrameShadow === null) _prevFrameShadow = frame.style.boxShadow || '';
      if (_prevFrameFilter === null) _prevFrameFilter = frame.style.backdropFilter || '';

      frame.style.background = 'transparent';
      frame.style.boxShadow = 'none';
      frame.style.backdropFilter = 'none';
      frame.style.webkitBackdropFilter = 'none';
    }
    if (orn) {
      _prevOrnHeight = orn.style.height || '';
      orn.style.height = MUSIC_FRAME_HEIGHT;

      // Music-only: if the ornament layer is contributing any tint/glass, neutralize it
      if (_prevOrnBg === null) _prevOrnBg = orn.style.background || '';
      if (_prevOrnShadow === null) _prevOrnShadow = orn.style.boxShadow || '';
      if (_prevOrnFilter === null) _prevOrnFilter = orn.style.backdropFilter || '';

      orn.style.background = 'transparent';
      orn.style.boxShadow = 'none';
      orn.style.backdropFilter = 'none';
      orn.style.webkitBackdropFilter = 'none';
    }
  }

  function restoreFrameHeight() {
    const frame = document.querySelector('.neonFrame');
    const orn = document.querySelector('.hudOrn');

    if (frame) {
      frame.style.height = _prevFrameHeight || '';
      frame.style.background = _prevFrameBg || '';
      frame.style.boxShadow = _prevFrameShadow || '';
      frame.style.backdropFilter = _prevFrameFilter || '';
      frame.style.webkitBackdropFilter = _prevFrameFilter || '';
    }
    if (orn) {
      orn.style.height = _prevOrnHeight || '';
      orn.style.background = _prevOrnBg || '';
      orn.style.boxShadow = _prevOrnShadow || '';
      orn.style.backdropFilter = _prevOrnFilter || '';
      orn.style.webkitBackdropFilter = _prevOrnFilter || '';
    }

    _prevFrameHeight = null;
    _prevOrnHeight = null;

    _prevFrameBg = null;
    _prevFrameShadow = null;
    _prevFrameFilter = null;

    _prevOrnBg = null;
    _prevOrnShadow = null;
    _prevOrnFilter = null;
  }

  // ------------------------------------------------------------
  // ARCHIVES MODE TOGGLE UI (Bands / Shows selector)
  // Option A: render this inside the Music info strip area (top rail),
  // not inside the main content panel.
  // ------------------------------------------------------------

  function renderArchiveHeaderUI() {
    return `
      <div class="archiveHeaderWrap">
        <!-- Section toggle (Bands / Shows / Origins / Project) -->
        <div class="archiveModeToggle" role="tablist" aria-label="Music sections (quick)">
          <button class="archiveModeBtn is-active" data-mode="bands" role="tab" aria-selected="true">Bands</button>
          <button class="archiveModeBtn" data-mode="shows" role="tab" aria-selected="false">Shows</button>
          <button class="archiveModeBtn" data-mode="people" role="tab" aria-selected="false">People</button>
		  <button class="archiveModeBtn" data-mode="origins" role="tab" aria-selected="false">Origins of Music</button>
          <button class="archiveModeBtn" data-mode="project" role="tab" aria-selected="false">Reimaging Project</button>
          <button class="archiveModeBtn" data-mode="stats" role="tab" aria-selected="false">Stats</button>
        </div>
      </div>
    `;
  }
// Wrap Bands/Shows content (toggle is mounted in the info strip, not here)
function wrapArchiveModeUI(activeMode, innerHtml) {
  return `<div id="musicArchiveInner">${innerHtml || ''}</div>`;
}

function mountArchiveModeToggle(activeMode) {
  const host = document.getElementById('archiveModeToggleMount');
  if (!host) return;
  host.innerHTML = renderArchiveHeaderUI();
  try { bindArchiveModeToggle(activeMode); } catch (_) {}
}

function clearArchiveModeToggle() {
  const host = document.getElementById('archiveModeToggleMount');
  if (!host) return;
  host.innerHTML = '';
}

// Bind the Bands/Shows toggle buttons in the shared header
function bindArchiveModeToggle(activeMode) {
  const host = document.getElementById('archiveModeToggleMount');
  const scope = host || document.getElementById('musicContentPanel');
  if (!scope) return;

  const btns = scope.querySelectorAll('.archiveModeBtn[data-mode]');
  btns.forEach((b) => {
    const m = (b.getAttribute('data-mode') || '').toLowerCase();
    const isOn = m === (activeMode || '').toLowerCase();
    b.classList.toggle('is-active', isOn);
    // keep aria-selected in sync for assistive tech (safe no-op if roles differ)
    try { b.setAttribute('aria-selected', isOn ? 'true' : 'false'); } catch (_) {}
  });

  btns.forEach((b) => {
    // ensure we don't double-bind if the panel swaps rapidly
    b.onclick = null;
    b.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        const targetMode = (b.getAttribute('data-mode') || '').toLowerCase();
        if (!targetMode) return;
        try {
          window.MusicArchive?.setMode?.(targetMode);
        } catch (_) {}
      },
      { passive: false }
    );
  });
}


const MUSIC_STATS_SHOTS_FALLBACK = 61289;
const MUSIC_STATS_NOT_UPGRADED_FALLBACK = 22506;
const MUSIC_STATS_ON_SITE_FALLBACK = 36342;
let _musicStatsPromise = null;

function getMusicArchiveApiBase() {
  try {
    return (typeof window !== 'undefined' && typeof window.MUSIC_ARCHIVE_API_BASE === 'string' && window.MUSIC_ARCHIVE_API_BASE.trim())
      ? window.MUSIC_ARCHIVE_API_BASE.trim().replace(/\/$/, '')
      : 'https://music-archive-3lfa.onrender.com';
  } catch (_) {
    return 'https://music-archive-3lfa.onrender.com';
  }
}

function parseMusicCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function formatMusicStatNumber(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0';
  try { return n.toLocaleString(); } catch (_) { return String(Math.round(n)); }
}

function parseTotalShotsFromMusicStatsCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter((l) => String(l || '').trim());
  if (lines.length < 2) return null;
  const header = parseMusicCsvLine(lines[0]).map((h) => String(h || '').trim().toLowerCase());
  let idx = header.indexOf('total');
  if (idx < 0) idx = Math.max(0, header.length - 1);
  for (let i = 1; i < lines.length; i++) {
    const row = parseMusicCsvLine(lines[i]);
    const raw = String((idx >= 0 && idx < row.length) ? row[idx] : '').replace(/[^\d.-]/g, '');
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function formatMusicGeneratedAt(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'Unavailable';
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return raw;
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
        hour12: true
    }).format(d);
  } catch (_) {
    return d.toLocaleString();
  }
}

async function fetchMusicStatsData(forceFresh) {
  if (_musicStatsPromise && !forceFresh) return _musicStatsPromise;

  _musicStatsPromise = (async () => {
    const apiBase = getMusicArchiveApiBase();
    const peopleIndexUrl = apiBase + '/people-index.json';
    const cacheOpt = forceFresh ? 'no-store' : 'default';
    const [bandsRes, peopleRes, statsRes] = await Promise.allSettled([
      fetch(apiBase + '/sheet/bands', { cache: cacheOpt }).then((r) => r.text()),
      fetch(peopleIndexUrl, { cache: cacheOpt }).then((r) => r.json()),
      fetch(apiBase + '/sheet/stats', { cache: cacheOpt }).then((r) => r.text())
    ]);

    let totalBands = 0;
    let fullyUpgraded = 0;
    let inProgress = 0;
    let notWorkedYet = 0;
    let archivedSets = 0;
    let plannedSets = 0;

    if (bandsRes.status === 'fulfilled') {
      const lines = String(bandsRes.value || '').split(/\r?\n/).filter((l) => String(l || '').trim());
      const headerLine = lines.shift();
      if (headerLine) {
        const header = parseMusicCsvLine(headerLine).map((h) => String(h || '').trim().toLowerCase());
        const bandIdx = header.indexOf('band');
        const totalIdx = header.indexOf('total_sets');
        const archivedIdx = header.indexOf('sets_archive');
        for (const line of lines) {
          const cols = parseMusicCsvLine(line);
          const bandName = String((bandIdx >= 0 ? cols[bandIdx] : '') || '').trim();
          if (!bandName) continue;
          totalBands += 1;
          const totalRaw = String((totalIdx >= 0 ? cols[totalIdx] : '') || '').trim();
          const archivedRaw = String((archivedIdx >= 0 ? cols[archivedIdx] : '') || '').trim();
          const total = Number(totalRaw);
          const archived = Number(archivedRaw);
          const hasTotal = Number.isFinite(total) && total > 0;
          const hasArchived = Number.isFinite(archived) && archived >= 0;
          if (hasTotal) plannedSets += total;
          if (hasArchived) archivedSets += archived;
          if (hasTotal && hasArchived) {
            if (archived >= total) fullyUpgraded += 1;
            else inProgress += 1;
          } else {
            notWorkedYet += 1;
          }
        }
      }
    }

    const peopleJson = peopleRes.status === 'fulfilled' ? (peopleRes.value || {}) : {};
    const peopleList = Array.isArray(peopleJson.people) ? peopleJson.people : [];
    const peopleCount = peopleList.length;
    const photosIndexed = peopleList.reduce((sum, person) => {
      const n = Number(person && person.photoCount);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
    const albumCount = Number(peopleJson.albumsScanned || 0) || 0;
    const generatedAt = String(peopleJson.generatedAt || '').trim();
    const totalShots = (() => {
      if (statsRes.status === 'fulfilled') {
        const parsed = parseTotalShotsFromMusicStatsCsv(statsRes.value);
        if (Number.isFinite(parsed)) return parsed;
      }
      return MUSIC_STATS_SHOTS_FALLBACK;
    })();

    const shotNotUpgraded = MUSIC_STATS_NOT_UPGRADED_FALLBACK;
    const shotsOnSite = MUSIC_STATS_ON_SITE_FALLBACK;
    const shotsOnSitePct = totalShots > 0 ? (shotsOnSite / totalShots) * 100 : 0;
    const progressPct = plannedSets > 0 ? (archivedSets / plannedSets) * 100 : (totalBands > 0 ? (fullyUpgraded / totalBands) * 100 : 0);

    return {
      totalBands,
      totalShots,
      albumCount,
      peopleCount,
      photosIndexed,
      fullyUpgraded,
      inProgress,
      notWorkedYet,
      archivedSets,
      plannedSets,
      shotNotUpgraded,
      shotsOnSite,
      shotsOnSitePct,
      progressPct,
      generatedAt,
      generatedAtLabel: formatMusicGeneratedAt(generatedAt)
    };
  })().catch((err) => {
    console.warn('[music] stats load failed', err);
    return {
      totalBands: 0,
      totalShots: MUSIC_STATS_SHOTS_FALLBACK,
      albumCount: 0,
      peopleCount: 0,
      photosIndexed: 0,
      fullyUpgraded: 0,
      inProgress: 0,
      notWorkedYet: 0,
      archivedSets: 0,
      plannedSets: 0,
      shotNotUpgraded: MUSIC_STATS_NOT_UPGRADED_FALLBACK,
      shotsOnSite: MUSIC_STATS_ON_SITE_FALLBACK,
      shotsOnSitePct: MUSIC_STATS_SHOTS_FALLBACK > 0 ? (MUSIC_STATS_ON_SITE_FALLBACK / MUSIC_STATS_SHOTS_FALLBACK) * 100 : 0,
      progressPct: 0,
      generatedAt: '',
      generatedAtLabel: 'Unavailable'
    };
  });

  return _musicStatsPromise;
}

function renderMusicStatsPanel() {
  return     '<div class="musicStatsShell">' +
      '<div class="musicStatsPanel" id="musicStatsPanel">' +
        '<div class="musicStatsLoading">Loading Music Stats...</div>' +
      '</div>' +
    '</div>';
}

function formatMusicAnimatedStatValue(value, type, decimals) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const safeDecimals = Math.max(0, Number(decimals) || 0);
  if (type === 'percent') return safeValue.toFixed(safeDecimals) + '%';
  return formatMusicStatNumber(Math.round(safeValue));
}

function getMusicAnimatedStatDuration(value, type) {
  const safeValue = Math.abs(Number(value) || 0);
  if (type === 'percent') return 860;
  if (safeValue < 100) return 720;
  if (safeValue < 1000) return 880;
  if (safeValue < 10000) return 1040;
  return 1220;
}

function animateMusicStatsPanel(host) {
  if (!host || !host.isConnected) return;

  const prefersReduced =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sections = Array.from(host.querySelectorAll('[data-music-stats-section]'));
  const animatedStats = Array.from(host.querySelectorAll('[data-animate-value]'));
  const animatedBars = Array.from(host.querySelectorAll('[data-animate-width]'));

  if (prefersReduced) {
    sections.forEach((section) => section.classList.add('is-visible'));
    animatedStats.forEach((el) => {
      const value = Number(el.getAttribute('data-animate-value') || 0);
      const type = String(el.getAttribute('data-animate-type') || 'number');
      const decimals = Number(el.getAttribute('data-animate-decimals') || 0);
      el.textContent = formatMusicAnimatedStatValue(value, type, decimals);
    });
    animatedBars.forEach((el) => {
      const width = Math.max(0, Math.min(100, Number(el.getAttribute('data-animate-width') || 0)));
      el.style.width = width.toFixed(2) + '%';
    });
    return;
  }

  sections.forEach((section) => section.classList.remove('is-visible'));
  animatedStats.forEach((el) => {
    const type = String(el.getAttribute('data-animate-type') || 'number');
    const decimals = Number(el.getAttribute('data-animate-decimals') || 0);
    el.textContent = formatMusicAnimatedStatValue(0, type, decimals);
  });
  animatedBars.forEach((el) => {
    el.style.width = '0%';
  });

  const runStatAnimation = (el) => {
    const target = Number(el.getAttribute('data-animate-value') || 0);
    const type = String(el.getAttribute('data-animate-type') || 'number');
    const decimals = Number(el.getAttribute('data-animate-decimals') || 0);
    const duration = getMusicAnimatedStatDuration(target, type);
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;
      el.textContent = formatMusicAnimatedStatValue(current, type, decimals);
      if (progress < 1 && el.isConnected) {
        window.requestAnimationFrame(tick);
      }
    };

    window.requestAnimationFrame(tick);
  };

  const runBarAnimation = (el) => {
    const width = Math.max(0, Math.min(100, Number(el.getAttribute('data-animate-width') || 0)));
    window.requestAnimationFrame(() => {
      if (el.isConnected) el.style.width = width.toFixed(2) + '%';
    });
  };

  sections.forEach((section, index) => {
    window.setTimeout(() => {
      if (!section.isConnected) return;
      section.classList.add('is-visible');
      section.querySelectorAll('[data-animate-value]').forEach(runStatAnimation);
      section.querySelectorAll('[data-animate-width]').forEach(runBarAnimation);
    }, index * 160);
  });
}

async function mountMusicStatsPanel(panel) {
  const scope = panel || document.getElementById('musicContentPanel');
  const host = scope ? scope.querySelector('#musicStatsPanel') : null;
  if (!host) return;

  host.innerHTML = '<div class="musicStatsLoading">Loading Music Stats...</div>';

  try {
    const stats = await fetchMusicStatsData();
    if (!host.isConnected) return;
    const safeTotalBands = Math.max(0, Number(stats.totalBands || 0));
    const fullyPct = safeTotalBands > 0 ? (Number(stats.fullyUpgraded || 0) / safeTotalBands) * 100 : 0;
    const inProgressPct = safeTotalBands > 0 ? (Number(stats.inProgress || 0) / safeTotalBands) * 100 : 0;
    const notWorkedPct = safeTotalBands > 0 ? (Number(stats.notWorkedYet || 0) / safeTotalBands) * 100 : 0;
    const peopleIndexPct = Number(stats.totalShots || 0) > 0 ? (Number(stats.photosIndexed || 0) / Number(stats.totalShots || 0)) * 100 : 0;
    host.innerHTML =
      '<div class="musicStatsMainTitle">Archive Statistics</div>' +
      '<div class="musicStatsSeparator musicStatsSeparatorOuter" aria-hidden="true"></div>' +
      '<div class="musicStatsIntroText">Welcome to the Stats section of the Music side. This page serves as a data housing of the entire archive, giving you an in-depth look into individual statistics for it. More to come soon!</div>' +
      '<div class="musicStatsSeparator musicStatsSeparatorOuter" aria-hidden="true"></div>' +
      '<div class="musicStatsSection musicStatsSectionBand" data-music-stats-section="band">' +
        '<div class="musicStatsMidHeading">Reimaging Project - Band Stats</div>' +
        '<div class="musicStatsGrid">' +
          '<div class="musicStatsChip good musicStatsChipMeter">' +
            '<div class="musicStatsChipTop"><div class="musicStatsChipName">Fully Upgraded</div><div class="musicStatsChipMeta"><div class="musicStatsChipValue" data-animate-value="' + Number(stats.fullyUpgraded || 0) + '" data-animate-type="number" data-animate-decimals="0">0</div><div class="musicStatsChipPct" data-animate-value="' + fullyPct.toFixed(1) + '" data-animate-type="percent" data-animate-decimals="1">0.0%</div></div></div>' +
            '<div class="musicStatsChipRail"><div class="musicStatsChipFill" data-animate-width="' + Math.max(0, Math.min(100, fullyPct)).toFixed(2) + '" style="width:0%"></div></div>' +
          '</div>' +
          '<div class="musicStatsChip partial musicStatsChipMeter">' +
            '<div class="musicStatsChipTop"><div class="musicStatsChipName">In Progress</div><div class="musicStatsChipMeta"><div class="musicStatsChipValue" data-animate-value="' + Number(stats.inProgress || 0) + '" data-animate-type="number" data-animate-decimals="0">0</div><div class="musicStatsChipPct" data-animate-value="' + inProgressPct.toFixed(1) + '" data-animate-type="percent" data-animate-decimals="1">0.0%</div></div></div>' +
            '<div class="musicStatsChipRail"><div class="musicStatsChipFill" data-animate-width="' + Math.max(0, Math.min(100, inProgressPct)).toFixed(2) + '" style="width:0%"></div></div>' +
          '</div>' +
          '<div class="musicStatsChip none musicStatsChipMeter">' +
            '<div class="musicStatsChipTop"><div class="musicStatsChipName">Not Worked Yet</div><div class="musicStatsChipMeta"><div class="musicStatsChipValue" data-animate-value="' + Number(stats.notWorkedYet || 0) + '" data-animate-type="number" data-animate-decimals="0">0</div><div class="musicStatsChipPct" data-animate-value="' + notWorkedPct.toFixed(1) + '" data-animate-type="percent" data-animate-decimals="1">0.0%</div></div></div>' +
            '<div class="musicStatsChipRail"><div class="musicStatsChipFill" data-animate-width="' + Math.max(0, Math.min(100, notWorkedPct)).toFixed(2) + '" style="width:0%"></div></div>' +
          '</div>' +
        '</div>' +
        '<div class="musicStatsContextChip"><span class="musicStatsContextValue" data-animate-value="' + Number(stats.totalBands || 0) + '" data-animate-type="number" data-animate-decimals="0">0</span><span class="musicStatsContextLabel">Total Bands</span></div>' +
      '</div>' +
      '<div class="musicStatsSeparator musicStatsSeparatorInner" aria-hidden="true"></div>' +
      '<div class="musicStatsSection musicStatsSectionPhoto" data-music-stats-section="photo">' +
        '<div class="musicStatsLowerHeading">Reimaging Project - Individual Photo Stats</div>' +
        '<div class="musicStatsPhotoGrid">' +
          '<div class="musicStatsShotCard"><div class="musicStatsShotValue" data-animate-value="' + Number(stats.shotNotUpgraded || 0) + '" data-animate-type="number" data-animate-decimals="0">0</div><div class="musicStatsShotLabel">Not Upgraded</div></div>' +
          '<div class="musicStatsShotCard"><div class="musicStatsShotValue" data-animate-value="' + Number(stats.shotsOnSite || 0) + '" data-animate-type="number" data-animate-decimals="0">0</div><div class="musicStatsShotLabel">On Site</div></div>' +
          '<div class="musicStatsShotCard musicStatsShotCardPercent"><div class="musicStatsShotValue" data-animate-value="' + Number(stats.shotsOnSitePct || 0).toFixed(2) + '" data-animate-type="percent" data-animate-decimals="2">0.00%</div><div class="musicStatsShotLabel">Percent Done</div></div>' +
        '</div>' +
        '<div class="musicStatsContextChip"><span class="musicStatsContextValue" data-animate-value="' + Number(stats.totalShots || 0) + '" data-animate-type="number" data-animate-decimals="0">0</span><span class="musicStatsContextLabel">Total Shots</span></div>' +
      '</div>' +
      '<div class="musicStatsSeparator musicStatsSeparatorInner" aria-hidden="true"></div>' +
      '<div class="musicStatsSection musicStatsSectionPeople" data-music-stats-section="people">' +
        '<div class="musicStatsLowerHeading">People Stats</div>' +
        '<div class="musicStatsPeopleGrid">' +
          '<div class="musicStatsCard musicStatsCardTop"><div class="musicStatsValue" data-animate-value="' + Number(stats.peopleCount || 0) + '" data-animate-type="number" data-animate-decimals="0">0</div><div class="musicStatsLabel">People Tagged</div></div>' +
          '<div class="musicStatsCard musicStatsCardTop"><div class="musicStatsValue" data-animate-value="' + Number(stats.photosIndexed || 0) + '" data-animate-type="number" data-animate-decimals="0">0</div><div class="musicStatsLabel">Photos Indexed</div></div>' +
          '<div class="musicStatsCard musicStatsCardTop"><div class="musicStatsValue" data-animate-value="' + Number(stats.albumCount || 0) + '" data-animate-type="number" data-animate-decimals="0">0</div><div class="musicStatsLabel">Albums</div></div>' +
        '</div>' +
        '<div class="musicStatsFooter">' +
          '<div class="musicStatsFooterRow">' +
            '<div class="musicStatsFooterLabel">Indexing Progress:</div>' +
            '<div class="musicStatsFooterUpdated">Last updated: ' + stats.generatedAtLabel + '</div>' +
            '<div class="musicStatsFooterPct" data-animate-value="' + peopleIndexPct.toFixed(2) + '" data-animate-type="percent" data-animate-decimals="2">0.00%</div>' +
          '</div>' +
          '<div class="musicStatsBar"><div class="musicStatsBarFill" data-animate-width="' + Math.max(0, Math.min(100, peopleIndexPct)).toFixed(2) + '" style="width:0%"></div></div>' +
        '</div>' +
      '</div>';
    animateMusicStatsPanel(host);
  } catch (_) {
    if (!host.isConnected) return;
    host.innerHTML = '<div class="musicStatsError">Stats failed to load.</div>';
  }
}


  function animateStripOpen(el) {
        if (!el) return;
        const prefersReduced =
          window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReduced) {
          el.style.height = 'auto';
          el.style.opacity = '1';
          return;
        }

        // measure target height
        el.style.height = 'auto';
        const target = el.scrollHeight || 0;

        // start collapsed
        el.style.opacity = '0';
        el.style.height = '0px';
        el.style.paddingTop = '0px';
        el.style.paddingBottom = '0px';

        // animate to content height, then release to auto
        requestAnimationFrame(() => {
          el.style.opacity = '1';
          el.style.height = target + 'px';
          el.style.paddingTop = '10px';
          el.style.paddingBottom = '10px';
        });

        const onEnd = (e) => {
          if (e && e.propertyName !== 'height') return;
          el.style.height = 'auto';
          el.removeEventListener('transitionend', onEnd);
        };
        el.addEventListener('transitionend', onEnd);
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

    // Music-only: prevent any accidental horizontal overflow (blank space to the right)
    const _html = document.documentElement;
    const _body = document.body;
    if (_html && _prevHtmlOverflowX === null) _prevHtmlOverflowX = _html.style.overflowX || '';
    if (_body && _prevBodyOverflowX === null) _prevBodyOverflowX = _body.style.overflowX || '';
    if (_html) _html.style.overflowX = 'hidden';
    if (_body) _body.style.overflowX = 'hidden';

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
if (!hudMain) return;

// Music route: prevent horizontal overflow (webviews / 100vw quirks / animated layers).
// Keep vertical overflow visible so nothing is visually clipped.
const htmlEl = document.documentElement;
const bodyEl = document.body;
if (htmlEl && _prevHtmlOverflowX === null) _prevHtmlOverflowX = htmlEl.style.overflowX || '';
if (bodyEl && _prevBodyOverflowX === null) _prevBodyOverflowX = bodyEl.style.overflowX || '';
if (htmlEl) htmlEl.style.overflowX = 'hidden';
if (bodyEl) bodyEl.style.overflowX = 'hidden';

    // If you don't want the translucent panels on the Music landing view, skip creating them.
    if (!SHOW_MUSIC_PANELS){
      // Remove any previously-created panels (if toggled during dev)
      if (_orangeBoxEl && _orangeBoxEl.parentNode) _orangeBoxEl.parentNode.removeChild(_orangeBoxEl);
      _orangeBoxEl = null;

      if (_contentPanelEl && _contentPanelEl.parentNode) _contentPanelEl.parentNode.removeChild(_contentPanelEl);
      _contentPanelEl = null;

      // Restore a simple padding for the Music route (no reserved strip space)
      if (_prevHudMainPadding === null) _prevHudMainPadding = hudMain.style.padding || '';
      hudMain.style.position = 'relative';
      hudMain.style.padding = '18px 18px';
      hudMain.style.boxSizing = 'border-box';
      hudMain.style.overflow = 'visible';
      hudMain.style.overflowX = 'hidden';

      // Simple landing copy (no boxes)
      // Simple landing copy (no boxes)
      const existingCopy = document.getElementById('musicLandingCopy');
      if (existingCopy && existingCopy.parentNode) existingCopy.parentNode.removeChild(existingCopy);

      const copy = document.createElement('div');
      copy.id = 'musicLandingCopy';
      copy.style.width = '100%';
      copy.style.display = 'flex';
      copy.style.alignItems = 'center';
      copy.style.justifyContent = 'center';
      copy.style.textAlign = 'center';
      copy.style.padding = '26px 0';

      copy.innerHTML = `
        <div style="max-width:720px; opacity:.85; font-size:14px; line-height:1.6; letter-spacing:.04em; text-transform:none;">
          <strong>Welcome to the Music section under Voodoo Media - one of the biggest projects that I have in my arsenal.</strong><br><br>
          Filters to sort the way you look at the archive are above along with some info bits - please make your selection above.
        </div>
      `;

      hudMain.appendChild(copy);
      return;
    }

    // Panels enabled
    if (hudMain && !_orangeBoxEl) {
      if (_prevHudMainPadding === null) {
        _prevHudMainPadding = hudMain.style.padding || '';
      }

      hudMain.style.position = 'relative';
      hudMain.style.padding = '0px'; // strip moved above content panel

      // Ensure hudMain has a reliable height context for our â€œgreen boxâ€ sizing
      hudMain.style.boxSizing = 'border-box';
      hudMain.style.overflow = 'visible';
      hudMain.style.overflowX = 'hidden';

      if (!_contentPanelEl) {
        _contentPanelEl = document.createElement('div');
        _contentPanelEl.id = 'musicContentPanel';

        _contentPanelEl.style.width = '100%';
        _contentPanelEl.style.maxWidth = ORANGE_BOX_MAX_WIDTH;
        _contentPanelEl.style.margin = `${GREEN_BOX_MARGIN_TOP} auto 0`;
        _contentPanelEl.style.minHeight = GREEN_BOX_DESKTOP_MIN_HEIGHT;
        _contentPanelEl.style.borderRadius = '10px';

        _contentPanelEl.style.border = '1px solid rgba(255, 70, 110, 0.35)';
        _contentPanelEl.style.background = 'rgba(0,0,0,0.10)';
        _contentPanelEl.style.boxShadow =
          '0 0 0 1px rgba(255,70,110,0.12) inset, 0 0 22px rgba(255,70,110,0.16)';

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
          ${getMusicViewportDebugMarkup()}
          <div style="max-width:720px; opacity:.85; font-size:14px; line-height:1.6; letter-spacing:.04em; text-transform:none;">
            <strong>Welcome to the Music section under Voodoo Media - one of the biggest projects that I have in my arsenal.</strong><br><br>
            Filters to sort the way you look at the archive are above along with some info bits - please make your selection above.
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

          /* --------------------------------------------------
             OPTION 2: Title + Body blocks (Music route informational tabs)
          -------------------------------------------------- */
          .musicProject{
            width:100%;
            max-width:760px;
            margin:0 auto;
          }
          .musicProjectTitle{
            font-family:"Orbitron", system-ui, sans-serif;
            font-size:28px;
            font-weight:900;
            letter-spacing:.14em;
            text-transform:uppercase;
            text-align:center;
            margin-bottom:16px;
            color:rgba(255,210,210,.95);
            text-shadow:
              0 0 14px rgba(255,60,60,.35),
              0 0 28px rgba(255,60,60,.18);
          }
          .musicProjectBody{
            font-size:15px;
            line-height:1.7;
            opacity:.82;
            letter-spacing:.04em;
            white-space:pre-wrap;
          }
          @media (max-width:520px){
            .musicProjectTitle{ font-size:22px; }
            .musicProjectBody{ font-size:14px; }
          }

          .musicStatsShell{
            width:100%;
            max-width:1080px;
            margin:0 auto;
            padding:8px 2px 6px;
          }
          .musicStatsPanel{
            --musicStatsBorderBase: rgba(112, 196, 255, 0.42);
            --musicStatsBorderStrong: rgba(145, 214, 255, 0.56);
            --musicStatsTextStrong: rgba(244,247,255,0.98);
            --musicStatsTextMuted: rgba(212,223,242,0.74);
            --musicStatsSuccess: #64e3ba;
            --musicStatsWarning: #f6c44d;
            --musicStatsDanger: #ff7a99;
            --musicStatsAccent: #67cbff;
            position:relative;
            overflow:hidden;
            border-radius:22px;
            border:1px solid var(--musicStatsBorderBase);
            background:transparent;
            box-shadow: inset 0 0 0 1px rgba(190,236,255,0.08), 0 0 0 1px rgba(103,203,255,0.18), 0 0 18px rgba(103,203,255,0.20), 0 0 42px rgba(24,82,140,0.16), 0 24px 54px rgba(0,0,0,0.22);
            padding:18px;
          }
          .musicStatsPanel::before{
            content:"";
            position:absolute;
            inset:0;
            pointer-events:none;
            background:
              linear-gradient(180deg, rgba(255,255,255,0.02), transparent 18%);
            opacity:.45;
          }
          .musicStatsPanel > *{ position:relative; z-index:1; }
          .musicStatsSection{
            border-radius:18px;
            border:1px solid rgba(116,196,255,0.28);
            background:linear-gradient(180deg, rgba(14,22,42,0.50), rgba(10,18,36,0.30));
            box-shadow: inset 0 0 0 1px rgba(190,236,255,0.05), 0 0 14px rgba(103,203,255,0.10), 0 0 24px rgba(16,36,74,0.10);
            padding:14px;
            opacity:0;
            transform: translateY(10px) scale(0.985);
            transition: opacity 320ms ease, transform 420ms cubic-bezier(.2,.8,.2,1);
          }
          .musicStatsSection.is-visible{
            opacity:1;
            transform: translateY(0) scale(1);
          }
          .musicStatsSectionTop{
            margin-bottom:0;
          }
          .musicStatsSectionBody{
            margin-top:0;
          }
          .musicStatsSectionBand,
          .musicStatsSectionPhoto,
          .musicStatsSectionPeople{
            margin:0;
          }
          .musicStatsSeparator{
            position:relative;
            height:3px;
            margin:15px 19px 17px;
            border-radius:999px;
            background:linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(103,203,255,0.24) 18%, rgba(103,203,255,0.62) 50%, rgba(100,227,186,0.22) 82%, rgba(255,255,255,0) 100%);
            box-shadow: 0 0 12px rgba(103,203,255,0.22), 0 0 24px rgba(100,227,186,0.10);
            overflow:hidden;
          }
          .musicStatsSeparator::after{
            content:"";
            position:absolute;
            inset:0;
            border-radius:inherit;
            background:linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0) 100%);
            opacity:.72;
            filter: blur(.2px);
          }
          .musicStatsSeparatorInner{
            margin:16px 5px 14px;
          }
          .musicStatsSeparatorOuter{
            margin:8px 19px 10px;
          }
          .musicStatsIntroText{
            margin:0 0 8px;
            text-align:center;
            font-size:13px;
            font-weight:700;
            letter-spacing:.08em;
            color:var(--musicStatsTextMuted);
            text-transform:none;
          }
          .musicStatsTop{
            display:grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap:12px;
          }
          .musicStatsPeopleRow{
            display:grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap:12px;
            margin:0 0 14px;
          }
          .musicStatsPhotoGrid{
            display:grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap:12px;
            margin:0 0 14px;
          }
          .musicStatsPeopleGrid{
            display:grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap:12px;
            margin:0 0 14px;
          }
          .musicStatsContextChip{
            margin:12px auto 8px;
            width:max-content;
            max-width:100%;
            display:flex;
            align-items:center;
            justify-content:center;
            gap:10px;
            padding:9px 18px;
            border-radius:999px;
            border:1px solid rgba(112,196,255,0.38);
            background:linear-gradient(180deg, rgba(14,22,40,0.92), rgba(10,17,33,0.70));
            box-shadow: inset 0 0 0 1px rgba(190,236,255,0.05), 0 0 14px rgba(103,203,255,0.16), 0 0 26px rgba(103,203,255,0.08);
            text-align:center;
          }
          .musicStatsContextValue{
            font-family:"Orbitron", system-ui, sans-serif;
            font-size:22px;
            font-weight:900;
            line-height:1;
            color:var(--musicStatsTextStrong);
          }
          .musicStatsContextLabel{
            font-size:11px;
            font-weight:800;
            letter-spacing:.14em;
            color:var(--musicStatsTextMuted);
            text-transform:uppercase;
          }
          .musicStatsCardTop{
            text-align:center;
            align-items:center;
          }
          .musicStatsTop{
            margin-bottom:10px;
          }
          .musicStatsTopLabels{
            display:grid;
            grid-template-columns: 1fr;
            gap:12px;
            margin-bottom:10px;
          }
          .musicStatsTopHeading{
            text-align:center;
            font-family:"Orbitron", system-ui, sans-serif;
            font-size:15px;
            font-weight:900;
            letter-spacing:.16em;
            text-transform:uppercase;
            color:rgba(233,236,245,0.90);
          }
          .musicStatsTopHeading.is-single{
            justify-self:center;
            width:max-content;
          }
          .musicStatsMainTitle{
            margin:2px 0 14px;
            text-align:center;
            font-family:"Orbitron", system-ui, sans-serif;
            font-size:24px;
            font-weight:900;
            letter-spacing:.14em;
            text-transform:uppercase;
            color:rgba(236,241,250,0.94);
          }
          .musicStatsLowerHeading{
            margin:14px 0 10px;
            text-align:center;
            font-family:"Orbitron", system-ui, sans-serif;
            font-size:15px;
            font-weight:900;
            letter-spacing:.16em;
            text-transform:uppercase;
            color:rgba(236,241,250,0.90);
          }
          .musicStatsMidHeading{
            margin:0 0 12px;
            text-align:center;
            font-family:"Orbitron", system-ui, sans-serif;
            font-size:15px;
            font-weight:900;
            letter-spacing:.16em;
            text-transform:uppercase;
            color:rgba(236,241,250,0.90);
          }
          .musicStatsCard{
            border-radius:16px;
            border:1px solid rgba(112,196,255,0.30);
            background:linear-gradient(180deg, rgba(16,24,43,0.86), rgba(11,19,36,0.64));
            box-shadow: inset 0 0 0 1px rgba(190,236,255,0.05), 0 0 12px rgba(103,203,255,0.14), 0 0 22px rgba(17,34,66,0.10);
            padding:14px 16px;
            min-height:84px;
            display:flex;
            flex-direction:column;
            justify-content:center;
            gap:6px;
          }
          .musicStatsValue{
            font-family:"Orbitron", system-ui, sans-serif;
            font-size:32px;
            font-weight:900;
            line-height:1;
            letter-spacing:.04em;
            color:var(--musicStatsTextStrong);
          }
          .musicStatsLabel{
            font-size:11px;
            font-weight:800;
            letter-spacing:.18em;
            text-transform:uppercase;
            color:var(--musicStatsTextMuted);
          }
          .musicStatsHeading{
            margin:18px 0 12px;
            text-align:center;
            font-family:"Orbitron", system-ui, sans-serif;
            font-size:18px;
            font-weight:900;
            letter-spacing:.18em;
            text-transform:uppercase;
            color:rgba(236,241,250,0.90);
          }
          .musicStatsGrid{
            display:grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap:14px;
          }
          .musicStatsChip{
            border-radius:15px;
            border:1px solid rgba(112,196,255,0.30);
            padding:13px 16px;
            min-height:68px;
            background:linear-gradient(180deg, rgba(14,22,42,0.82), rgba(10,18,36,0.58));
            box-shadow: inset 0 0 0 1px rgba(190,236,255,0.045), 0 0 12px rgba(103,203,255,0.14), 0 0 24px rgba(16,36,74,0.10);
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:12px;
          }
          .musicStatsChipMeter{
            position:relative;
            min-height:96px;
            padding:12px 16px 14px;
            overflow:hidden;
            display:flex;
            flex-direction:column;
            align-items:stretch;
            justify-content:flex-start;
            background:
              radial-gradient(circle at 8% 50%, rgba(255,255,255,0.06), transparent 20%),
              linear-gradient(180deg, rgba(13,18,36,0.95), rgba(11,17,34,0.74)),
              linear-gradient(90deg, rgba(255,255,255,0.03), transparent 42%);
            box-shadow:
              inset 0 0 0 1px rgba(190,236,255,0.05),
              inset 0 0 26px rgba(255,255,255,0.02),
              0 0 16px rgba(103,203,255,0.12),
              0 0 18px rgba(0,0,0,0.18);
          }
          .musicStatsChipMeter::before{
            content:"";
            position:absolute;
            left:14px;
            right:14px;
            top:12px;
            height:1px;
            border-radius:999px;
            background:linear-gradient(90deg, rgba(255,255,255,0.24), rgba(255,255,255,0.04) 18%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.04) 82%, rgba(255,255,255,0.16));
            opacity:.46;
            pointer-events:none;
          }
          .musicStatsChipMeter::after{
            content:"";
            position:absolute;
            inset:10px;
            border-radius:12px;
            border:1px solid color-mix(in srgb, currentColor 42%, transparent);
            clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
            opacity:.26;
            pointer-events:none;
          }
          .musicStatsChipTop{
            display:flex;
            align-items:flex-start;
            justify-content:space-between;
            gap:14px;
            padding:4px 6px 0 8px;
          }
          .musicStatsChipMeta{
            display:flex;
            flex-direction:column;
            align-items:flex-end;
            gap:4px;
          }
          .musicStatsChipName{
            font-size:14px;
            font-weight:800;
            letter-spacing:.16em;
			text-transform: none;
            color:rgba(226,232,240,0.78);
          }
          .musicStatsChipValue{
            font-family:"Orbitron", system-ui, sans-serif;
            font-size:26px;
            font-weight:900;
            line-height:1;
            color:var(--musicStatsTextStrong);
            text-shadow: 0 0 10px color-mix(in srgb, currentColor 20%, transparent);
          }
          .musicStatsChipTotal{
            font-size:15px;
            font-weight:800;
            letter-spacing:.08em;
            color:rgba(226,232,240,0.76);
          }
          .musicStatsChipPct{
            font-family:"Orbitron", system-ui, sans-serif;
            font-size:12px;
            font-weight:800;
            letter-spacing:.14em;
            color:rgba(220,228,242,0.80);
          }
          .musicStatsChipRail{
            position:relative;
            margin-top:13px;
            height:12px;
            border-radius:999px;
            overflow:hidden;
            background:
              repeating-linear-gradient(90deg, rgba(255,255,255,0.065) 0 12px, rgba(255,255,255,0.012) 12px 16px),
              linear-gradient(180deg, rgba(3,8,20,0.92), rgba(12,18,34,0.72));
            box-shadow: inset 0 0 0 1px rgba(255,255,255,0.05), inset 0 3px 8px rgba(0,0,0,0.28);
          }
          .musicStatsChipFill{
            position:absolute;
            inset:0 auto 0 0;
            width:0%;
            border-radius:inherit;
            background:linear-gradient(90deg, currentColor 0%, color-mix(in srgb, currentColor 78%, #ffd54a 22%) 100%);
            box-shadow: 0 0 12px color-mix(in srgb, currentColor 68%, transparent), 0 0 22px color-mix(in srgb, currentColor 42%, transparent);
            transition: width 820ms cubic-bezier(.2,.8,.2,1);
          }
          .musicStatsChip.good{ border-color: color-mix(in srgb, var(--musicStatsSuccess) 40%, var(--musicStatsBorderStrong)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--musicStatsSuccess) 10%, transparent), 0 0 18px color-mix(in srgb, var(--musicStatsSuccess) 16%, transparent); }
          .musicStatsChip.good .musicStatsChipValue{ color:var(--musicStatsSuccess); }
          .musicStatsChip.good.musicStatsChipMeter{ color:var(--musicStatsSuccess); border-color: color-mix(in srgb, var(--musicStatsSuccess) 44%, var(--musicStatsBorderStrong)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--musicStatsSuccess) 12%, transparent), 0 0 18px color-mix(in srgb, var(--musicStatsSuccess) 16%, transparent); }
          .musicStatsChip.partial{ border-color: color-mix(in srgb, var(--musicStatsWarning) 42%, var(--musicStatsBorderStrong)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--musicStatsWarning) 10%, transparent), 0 0 18px color-mix(in srgb, var(--musicStatsWarning) 16%, transparent); }
          .musicStatsChip.partial .musicStatsChipValue{ color:var(--musicStatsWarning); }
          .musicStatsChip.partial.musicStatsChipMeter{ color:var(--musicStatsWarning); border-color: color-mix(in srgb, var(--musicStatsWarning) 46%, var(--musicStatsBorderStrong)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--musicStatsWarning) 12%, transparent), 0 0 18px color-mix(in srgb, var(--musicStatsWarning) 16%, transparent); }
          .musicStatsChip.none{ border-color: color-mix(in srgb, var(--musicStatsDanger) 36%, var(--musicStatsBorderStrong)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--musicStatsDanger) 8%, transparent), 0 0 18px color-mix(in srgb, var(--musicStatsDanger) 14%, transparent); }
          .musicStatsChip.none .musicStatsChipValue{ color:var(--musicStatsDanger); }
          .musicStatsChip.none.musicStatsChipMeter{ color:var(--musicStatsDanger); border-color: color-mix(in srgb, var(--musicStatsDanger) 42%, var(--musicStatsBorderStrong)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--musicStatsDanger) 10%, transparent), 0 0 18px color-mix(in srgb, var(--musicStatsDanger) 14%, transparent); }
          .musicStatsChip.info{ border-color: color-mix(in srgb, var(--musicStatsAccent) 34%, var(--musicStatsBorderStrong)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--musicStatsAccent) 8%, transparent), 0 0 18px color-mix(in srgb, var(--musicStatsAccent) 14%, transparent); }
          .musicStatsChip.info .musicStatsChipValue{ color:var(--musicStatsAccent); }
          .musicStatsFooter{
            margin-top:16px;
            border-radius:18px;
            border:1px solid rgba(112,196,255,0.30);
            background:linear-gradient(180deg, rgba(14,22,42,0.88), rgba(10,18,36,0.62));
            box-shadow: inset 0 0 0 1px rgba(190,236,255,0.04), 0 0 12px rgba(103,203,255,0.12), 0 0 22px rgba(16,36,74,0.08);
            padding:14px 16px 16px;
          }
          .musicStatsShotCard{
            position:relative;
            border-radius:16px;
            border:1px solid rgba(112,196,255,0.30);
            background:
              linear-gradient(180deg, rgba(20,25,42,0.90), rgba(15,20,36,0.66)),
              linear-gradient(90deg, rgba(255,255,255,0.03), transparent 48%);
            box-shadow:
              inset 0 0 0 1px rgba(190,236,255,0.04),
              inset 0 10px 20px rgba(255,255,255,0.015),
              0 0 12px rgba(103,203,255,0.12),
              0 0 22px rgba(16,36,74,0.08);
            min-height:70px;
            padding:14px 16px;
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:12px;
            overflow:hidden;
          }
          .musicStatsShotCard::before{
            content:"";
            position:absolute;
            inset:0;
            border-radius:inherit;
            pointer-events:none;
            background:linear-gradient(90deg, rgba(255,255,255,0.03), transparent 38%, rgba(255,255,255,0.02));
            opacity:.55;
          }
          .musicStatsShotCardPercent{
            border-color: color-mix(in srgb, var(--musicStatsAccent) 38%, var(--musicStatsBorderStrong));
            box-shadow:
              inset 0 0 0 1px color-mix(in srgb, var(--musicStatsAccent) 8%, transparent),
              inset 0 10px 20px rgba(255,255,255,0.015),
              0 0 18px color-mix(in srgb, var(--musicStatsAccent) 14%, transparent);
          }
          .musicStatsShotValue{
            position:relative;
            z-index:1;
            font-family:"Orbitron", system-ui, sans-serif;
            font-size:30px;
            font-weight:900;
            line-height:1;
            letter-spacing:.03em;
            color:var(--musicStatsTextStrong);
          }
          .musicStatsShotCardPercent .musicStatsShotValue{
            color:var(--musicStatsAccent);
          }
          .musicStatsShotLabel{
            position:relative;
            z-index:1;
            font-size:12px;
            font-weight:800;
            letter-spacing:.08em;
            color:var(--musicStatsTextMuted);
            text-transform:none;
          }
          .musicStatsFooterRow{
            display:grid;
            grid-template-columns: minmax(0, 1fr) minmax(220px, auto) minmax(0, 1fr);
            align-items:center;
            gap:14px;
            margin-bottom:10px;
          }
          .musicStatsFooterLabel,
          .musicStatsFooterUpdated{
            font-size:12px;
            font-weight:800;
            letter-spacing:.08em;
            color:var(--musicStatsTextMuted);
            text-transform:none;
          }
          .musicStatsFooterPct{
            font-family:"Orbitron", system-ui, sans-serif;
            font-size:28px;
            font-weight:900;
            color:var(--musicStatsAccent);
            justify-self:end;
          }
          .musicStatsFooterUpdated{
            justify-self:center;
            text-align:center;
          }
          .musicStatsBar{
            position:relative;
            height:12px;
            border-radius:999px;
            overflow:hidden;
            background:rgba(255,255,255,0.05);
            box-shadow: inset 0 0 0 1px rgba(255,255,255,0.035);
          }
          .musicStatsBarFill{
            position:absolute;
            inset:0 auto 0 0;
            width:0%;
            border-radius:inherit;
            background:linear-gradient(90deg, color-mix(in srgb, var(--musicStatsAccent) 88%, white 12%), color-mix(in srgb, var(--musicStatsSuccess) 82%, var(--musicStatsAccent) 18%));
            box-shadow: 0 0 16px color-mix(in srgb, var(--musicStatsAccent) 24%, transparent);
            transition: width 900ms cubic-bezier(.2,.8,.2,1);
          }
          .musicStatsLoading,
          .musicStatsError{
            min-height:220px;
            display:flex;
            align-items:center;
            justify-content:center;
            text-align:center;
            font-size:13px;
            letter-spacing:.12em;
            text-transform:uppercase;
            color:rgba(226,232,240,0.72);
          }
          .musicStatsError{ color:rgba(251,113,133,0.86); }
          @media (max-width: 920px){
            .musicStatsTopLabels,
            .musicStatsTop,
            .musicStatsPeopleRow,
            .musicStatsGrid{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .musicStatsFooterRow{ grid-template-columns: 1fr; justify-items:start; }
            .musicStatsFooterPct{ justify-self:end; }
          }
          @media (max-width: 620px){
            .musicStatsPanel{ padding:14px; border-radius:18px; }
            .musicStatsSection{ padding:12px; }
            .musicStatsSeparator{ margin:15px 13px 17px; }
            .musicStatsTopLabels,
            .musicStatsPeopleRow,
            .musicStatsGrid,
            .musicStatsPhotoGrid,
            .musicStatsPeopleGrid{ grid-template-columns: 1fr; }
            .musicStatsTop{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .musicStatsMainTitle{ font-size:18px; }
            .musicStatsSeparatorOuter{ margin:8px 13px 10px; }
            .musicStatsTopHeading{ font-size:14px; }
            .musicStatsValue{ font-size:28px; }
            .musicStatsChipValue{ font-size:22px; }
            .musicStatsChipTotal{ font-size:13px; }
            .musicStatsContextChip{ width:100%; }
            .musicStatsContextValue{ font-size:20px; }
            .musicStatsShotValue{ font-size:26px; }
            .musicStatsFooterPct{ font-size:24px; }
          }

          /* --------------------------------------------------
             ARCHIVES HEADER (Bands / Shows)
             All values below are SAFE TO TUNE
          -------------------------------------------------- */

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
            gap:10px; /* spacing between buttons */
            padding:6px;
            border-radius:999px;
            background:rgba(0,0,0,0.35);
            box-shadow:
              0 0 0 1px rgba(255,80,110,0.35) inset,
              0 0 22px rgba(255,80,110,0.25);
          }

          .archiveModeBtn{
            min-width:84px; /* button width */
            padding:8px 14px; /* vertical / horizontal padding */
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

          @media (max-width: 760px){
            .archiveHeaderWrap{
              margin-top: 8px;
            }

            .archiveModeToggle{
              width: min(100%, 680px);
              gap: 8px;
              padding: 8px;
              border-radius: 28px;
            }

            .archiveModeBtn{
              min-width: clamp(88px, 26vw, 126px);
              padding: 8px 9px;
              font-size: clamp(10px, 2.45vw, 12px);
              letter-spacing: .06em;
            }
          }

          @media (max-width: 520px){
            .archiveModeToggle{
              gap: 6px;
              padding: 7px;
              border-radius: 26px;
            }

            .archiveModeBtn{
              min-width: calc(50% - 6px);
              padding: 7px 7px;
              font-size: clamp(9px, 2.9vw, 10.5px);
              letter-spacing: .03em;
            }
          }

          /* -------------------------------------------------- */

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
          /*
            Allow the archive mode pills (Bands/Shows) glow to render fully.
            The strip previously used overflow:hidden for the scan ping effect,
            but that clips box-shadows on the pills.
          */
          #musicInfoStrip{ position:relative; overflow:visible; transition:height 220ms ease, padding 220ms ease, opacity 220ms ease; }

          /* Mount area for the Bands/Shows pills (kept separate from the main tab row) */
          #archiveModeToggleMount{
            width:100%;
            display:flex;
            justify-content:center;
            align-items:center;
            padding:10px 0 10px;
            box-sizing:border-box;
          }

          #archiveModeToggleMount .archiveHeaderWrap{
            justify-content:center;
            margin-bottom:0;
          }

          #musicInfoStrip .hudTabs{

  display:none !important; /* hide legacy top tab row; pills are primary */
  display:flex;
  flex-wrap:nowrap;
  align-items:center;
  gap:18px;
  user-select:none;

  overflow-x:auto;
  overflow-y:hidden;
  -webkit-overflow-scrolling:touch;
  scrollbar-width:none;

  padding:0 18px;
  width:100%;
  box-sizing:border-box;
  white-space:nowrap;
}

/* Invisible flex spacers = centered when possible, scrollable when needed */
#musicInfoStrip .hudTabs::before,
#musicInfoStrip .hudTabs::after{
  content:"";
  flex:1 0 auto;
}

          #musicInfoStrip .hudTabs::-webkit-scrollbar{ display:none; }

          #musicInfoStrip .hudTab{ flex:0 0 auto; }

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
            /* Keep the pingâ€™s box *within* the strip so it canâ€™t create horizontal scroll */
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

      _orangeBoxEl.style.height = 'auto';
	  _orangeBoxEl.style.minHeight = 'unset';
	  _orangeBoxEl.style.paddingTop = '0px';
	  _orangeBoxEl.style.paddingBottom = '10px';
	  _orangeBoxEl.style.paddingLeft = '14px';
	  _orangeBoxEl.style.paddingRight = '14px';
      _orangeBoxEl.style.maxWidth = ORANGE_BOX_MAX_WIDTH;
      _orangeBoxEl.style.width = '100%';
      // Strip is now ABOVE the content panel (not pinned to bottom)
      _orangeBoxEl.style.position = 'relative';
      _orangeBoxEl.style.left = '';
      _orangeBoxEl.style.bottom = '';
      _orangeBoxEl.style.transform = '';
      _orangeBoxEl.style.margin = '0px auto 5px';
      // --- RED GLOW BORDER (Music tabs strip) ---
      _orangeBoxEl.style.border = ORANGE_BOX_BORDER;
      _orangeBoxEl.style.boxShadow = ORANGE_BOX_GLOW;
	  _orangeBoxEl.style.display = 'flex';
      _orangeBoxEl.style.flexDirection = 'column';
      _orangeBoxEl.style.alignItems = 'center';
      _orangeBoxEl.style.justifyContent = 'center';
      _orangeBoxEl.style.textAlign = 'center';

      _orangeBoxEl.innerHTML = `
  <div class="hudTabs" role="tablist" aria-label="Music sections">
    <div class="hudTab" data-tab="bands" role="tab" aria-selected="false">Bands</div>
    <div class="hudTab" data-tab="shows" role="tab" aria-selected="false">Shows</div>
    <div class="hudTab" data-tab="people" role="tab" aria-selected="false">People</div>
	<div class="hudTab" data-tab="origins" role="tab" aria-selected="false">Origins of Music</div>	
	<div class="hudTab" data-tab="project" role="tab" aria-selected="false">The Reimaging Project</div>
	<div class="hudTab" data-tab="stats" role="tab" aria-selected="false">Archive Stats</div>
          </div>
  <div id="archiveModeToggleMount" aria-live="polite">
    ${renderArchiveHeaderUI()}
  </div>
  <div class="scanPing" aria-hidden="true"></div>
`;

      const WIPE_OUT_MS = 140;
      const WIPE_IN_MS = 180;
      const TYPE_MS = 7;
      let _typeTimer = null;
      let _swapToken = 0; // cancels stale wipe swaps

      function wipeSwapContent(nextHtml, terminalText, onAfterSwap) {
        if (!_contentPanelEl) return;
        const debugMarkup = getMusicViewportDebugMarkup();
        const wrappedHtml = `${debugMarkup}${String(nextHtml || '')}`;
        const prefersReduced =
          window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (prefersReduced) {
          _contentPanelEl.innerHTML = wrappedHtml;
          if (typeof onAfterSwap === 'function') onAfterSwap();
          return;
        }

        const token = ++_swapToken;

        _contentPanelEl.classList.remove('wipe-out', 'wipe-in');
        void _contentPanelEl.offsetWidth;
        _contentPanelEl.classList.add('wipe-out');

        window.setTimeout(() => {
          if (token !== _swapToken) return;
          if (terminalText) {
            _contentPanelEl.innerHTML = `
              ${debugMarkup}
              <div class="termLine"><span class="termText"></span><span class="termCaret">â–Œ</span></div>
            `;
          } else {
            _contentPanelEl.innerHTML = wrappedHtml;
          }

          _contentPanelEl.classList.remove('wipe-out');
          void _contentPanelEl.offsetWidth;
          _contentPanelEl.classList.add('wipe-in');

          window.setTimeout(() => {
            if (token !== _swapToken) return;
            _contentPanelEl.classList.remove('wipe-in');
            if (typeof onAfterSwap === 'function') onAfterSwap();

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
          if (!_suppressMusicTabUrlSync) {
            try { syncMusicSubroute((tab.getAttribute('data-tab') || '').trim(), { replace: false }); } catch (_) {}
          }
          try { setMusicDocumentTitle((tab.getAttribute('data-tab') || '').trim()); } catch (_) {}
          animateHudTab(tab);
          if (!_contentPanelEl) return;

          const label = tab.textContent.trim();

          // Use data-tab as the stable routing key (text can change)
          const tabKey = (tab.getAttribute('data-tab') || '').trim();

                    // Stats + Bands + Shows + People are the driven UI now (use the expanded green viewport)
                    if (tabKey === 'stats' || tabKey === 'bands' || tabKey === 'shows' || tabKey === 'people' || label === 'Stats' || label === 'Bands' || label === 'Shows' || label === 'People') {
                      setArchiveViewportExpanded(true);
          
                      if (tabKey === 'stats' || label === 'Stats') {
                        const html = wrapArchiveModeUI('stats', renderMusicStatsPanel());
                        wipeSwapContent(html, '', () => {
                          const panel = document.getElementById('musicContentPanel');
                          if (panel) panel.scrollTop = 0;
                          try { mountArchiveModeToggle('stats'); } catch (_) {}
                          try { mountMusicStatsPanel(panel); } catch (_) {}
                        });
                        return;
                      }

                      // Bands (external module)
                      if (tabKey === 'bands' || label === 'Bands') {
                        // Force a fresh mount each time Bands is selected (prevents stale deep-view state)
                        try { window.MusicArchiveBands?.destroy?.(); } catch (_) {}
          
                        const inner =
                  window.MusicArchiveBands?.render?.() ||
                  `<div style="opacity:.7">Bands module not loaded.</div>`;

                const html = wrapArchiveModeUI('bands', inner);

                wipeSwapContent(html, '', () => {
                  const panel = document.getElementById('musicContentPanel');
                  if (panel) panel.scrollTop = 0;
                  try { mountArchiveModeToggle('bands'); } catch (_) {}
                  try { window.MusicArchiveBands?.onMount?.(panel, { fresh: true }); } catch (_) {}
                });

return;
                      }
          
                      // People (Phase 2: on-demand module; fail-soft to placeholder)
                      if (tabKey === 'people' || label === 'People') {
                        const mountPeople = () => {
                          const html =
                            window.MusicArchivePeople?.render?.() ||
                            `<div style="opacity:.8; font-size:14px; letter-spacing:.12em; text-transform:uppercase;">People â€“ Coming Soon</div>`;

                          wipeSwapContent(html, '', () => {
                            const panel = document.getElementById('musicContentPanel');
                            if (panel) panel.scrollTop = 0;
                            try { mountArchiveModeToggle('people'); } catch (_) {}
                            try { window.MusicArchivePeople?.onMount?.(panel, { fresh: true }); } catch (_) {}
                          });
                        };

                        if (window.MusicArchivePeople && typeof window.MusicArchivePeople.render === 'function') {
                          mountPeople();
                          return;
                        }

                        const peopleModuleSrc = "/music-archive-people.js?v=20260310a";


                        // Try to load the module once.
                        try {
                          const existing = document.querySelector('script[data-music-archive-people="1"]');
                          if (existing) {
                            existing.addEventListener('load', () => { try { mountPeople(); } catch (_) {} }, { once: true });
                            existing.addEventListener('error', () => { try { mountPeople(); } catch (_) {} }, { once: true });
                            wipeSwapContent(`<div style="opacity:.8; font-size:13px; letter-spacing:.12em; text-transform:uppercase;">Loading Peopleâ€¦</div>`, '');
                            return;
                          }

                          const s = document.createElement('script');
                          s.src = peopleModuleSrc;
                          s.async = true;
                          s.setAttribute('data-music-archive-people', '1');
                          s.addEventListener('load', () => { try { mountPeople(); } catch (_) {} }, { once: true });
                          s.addEventListener('error', () => { try { mountPeople(); } catch (_) {} }, { once: true });
                          document.head.appendChild(s);
                          wipeSwapContent(`<div style="opacity:.8; font-size:13px; letter-spacing:.12em; text-transform:uppercase;">Loading Peopleâ€¦</div>`, '');
                          return;
                        } catch (_) {
                          mountPeople();
                          return;
                        }
                      }
          
                      // Shows (external module)
                      if (tabKey === 'shows' || label === 'Shows') {
                        try { window.MusicArchiveShows?.destroy?.(); } catch (_) {}
          
                        const inner =
                  window.MusicArchiveShows?.render?.() ||
                  `<div style="opacity:.7">Shows module not loaded.</div>`;

                const html = wrapArchiveModeUI('shows', inner);

                wipeSwapContent(html, '', () => {
                  const panel = document.getElementById('musicContentPanel');
                  if (panel) panel.scrollTop = 0;
                  try { mountArchiveModeToggle('shows'); } catch (_) {}
                  try { window.MusicArchiveShows?.onMount?.(panel, { fresh: true }); } catch (_) {}
                });

return;
                      }
          
                      // Fallback safety (shouldn't hit)
                      wipeSwapContent(`<div style="opacity:.7">Section not available.</div>`, '');
                      return;
                    }
          
          // All other tabs: revert to original auto-sizing
          setArchiveViewportExpanded(false);

          // Keep the quick-toggle visible for Origins/Project as well (unifies the experience).
          if (tabKey === 'origins' || tabKey === 'project') {
            try { mountArchiveModeToggle(tabKey); } catch (_) {}
          } else {
            try { clearArchiveModeToggle(); } catch (_) {}
          }

          if (tabKey === 'origins' || label === 'Origins of Music' || label === 'Origins in Music' || label === 'Origins') {
            const originsBody = `Personally, I've been always a concert goer throughout my life (with my first ever music-related show was Korn, Disturbed and Sev (the Pop Sucks 2 Tour) back in 2001 when they visited Maine. From there, my shows were fewer and far between for a stretch of time (which, still highlighted by seeing some national bands at the time such as Nothingface, Silent Civilian, Mushroomhead, among others). However, the music project really ramped up in mid-2011 when I checked out a set from 3 bands - Dark Rain, Fifth Freedom and 13 High - at a local bar and thoroughly enjoyed the music. Flash forward a couple months to Sept 2011, where I was invited to check out 13 High once more. Their sound was definitely I was grooving to at that time - in which after helping with equipment load in and out for my buddy Eric at the time (had an injury), it evolved into going another, and another, and another.....until it became what it is today.

Back then, I started to just take pictures (albeit not the best, but gotta start somewhere) for keepsakes of what I've seen and been through. From going to a lot of the 13 High shows between 2011 and a lot of 2012, I was hooked. And as through those shows, most of those bands from there became life-long friends of mine, and I wouldn't trade it for the world. Fast forward now to 2025 and 14 years later it is still a prevalent force in my life. Without that one decision back then, who knows where I would be today! This page is dedicated to the vast journey that it has been and will continue to be until I can no longer do it anymore.`;
            const html = `
              <div class="musicProject">
                <div class="musicProjectTitle">The Origins of Music</div>
                <div class="musicProjectBody"; style="text-transform:none";>${originsBody}</div>
              </div>
            `;
            wipeSwapContent(html, '');
            return;
          }
          if (tabKey === 'project' || label === 'The Reimaging Project' || label === 'Reimaging Project') {
            const projectBody = `The "Reimaging" Project has been a few-year odyssey in my photography world where I have wanted to modernize the overall shot that was taken previously. When this project started in mid-2023, my organization of my entire music journey was not noted with any data on it, or in any structure on my storage devices. A lot of the data was spread across multiple drives. This changed when I started to centralize every bit of data into one specific drive. It didn't stop there.

The kickstarter for this project really started when we lost a good friend of ours in the Maine local scene - Steve Lepannen. When he unexpectedly passed, I was trying to find photos to post on socials of his passing and some thoughts. However I can recall I was frustrated because of the disorganization. From there, it has been the goal to get it under control. 

What originally started as that, it evolved into something bigger than that. It then evolved into bringing the quality of the shots to my photo standards of today, and bringing everything into one area. This will explain the bands section a bit more with colors of who's up and who's not.

The actual process for this project is below (with progress markers). Overall progress is tracked in the Bands tab.

<strong>What the project involves</strong>

* <span style="color:#5CFF8A;"><strong>Archive organization:</strong> Reorganized the entire archive into a consistent region â†’ band â†’ show hierarchy.</span>
* <span style="color:#5CFF8A;"><strong>Location history:</strong> Embedded GPS/location data into individual photos to preserve historical context.</span>
* <span style="color:#FFD700;"><strong>Show metadata (â€œJobâ€):</strong> Added Job data to identify the specific show associated with each image. (still need to do for candid shots)</span>

<strong>Additional work</strong>

* <span style="color:#FFD700;">Added Creator flags of my name and "Voodoo Media 20XX" to each individual shot. (still need to do for candid shots)</span>
* <span style="color:#FFD700;">Added individual keywords of individuals to each photo (if possible) to preserve individual history. (done up to the point of researching more)</span>
* <span style="color:#5CFF8A;">Harnessed the power of AI to assist in bringing details up to modern standards in archive files.</span>
* <span style="color:#FFD700;">Removed all previous watermarks as best as I could from older photos, used one universal watermark for all shots. (Being worked on as shots go into the archive - Progress is in Bands tab)</span>
* <span style="color:#FFD700;">Put them through my photo editor once more. A lot of the shots just needed minor touchups, but I wanted to preserve the original edits while bringing it to my standards of today. (Being worked on as shots go into the archive - Progress is in Bands tab)</span>
* <span style="color:#FFD700;">Back up shot 3x - Web, Cloud, and Physical storages. (Being worked on as shots go into the archive - Progress is in Bands tab)</span>

Why do this though? Why put in this much effort for a small-scale operation? Simple - in the interest of preserveration. This site will serve as the journey that I've had through the years and preserves a small chunk of Maine music history for years to come. This also is a 'love letter' of sorts to the scene that gave me so much in this life that I am grateful for. This is also giving back to those who I've photoed, met, and became lifelong friends with.

-Voodoo 1/29/26`;
            const html = `
              <div class="musicProject">
                <div class="musicProjectTitle">The "Reimaging" Project</div>
                <div class="musicProjectBody" style="text-transform:none;">${projectBody}</div>
              </div>
            `;
            wipeSwapContent(html, '');
            return;
          }// Updates (or anything else)
          wipeSwapContent(
            `<div style="opacity:.7; font-size:14px; letter-spacing:.12em; text-transform:uppercase;">${label} â€“ Coming Soon</div>`,
            `${label} â€“ Coming Soon`
          );
        });
      });

      _orangeBoxEl.style.pointerEvents = 'auto';
      if (_contentPanelEl && _contentPanelEl.parentNode === hudMain) {
        hudMain.insertBefore(_orangeBoxEl, _contentPanelEl);
      } else {
        hudMain.appendChild(_orangeBoxEl);
      }

      bindArchiveModeToggle('');

      animateStripOpen(_orangeBoxEl);

      // Default: keep original auto-sizing unless Archives is selected
      setArchiveViewportExpanded(false);
    }
  }

  const MUSIC_SUBROUTES = new Set(['stats', 'bands', 'shows', 'people', 'origins', 'project']);
  const MUSIC_TITLE_BY_MODE = {
    stats: 'Stats',
    bands: 'Bands',
    shows: 'Shows',
    people: 'People',
    origins: 'Origins of Music',
    project: 'Reimagining Project'
  };

  function setMusicDocumentTitle(mode, fallback){
    try {
      const label = String(fallback || MUSIC_TITLE_BY_MODE[String(mode || '').toLowerCase().trim()] || 'Music').trim();
      if (typeof window.VMPixSetTitle === 'function') window.VMPixSetTitle(label);
      else document.title = label ? (label + ' - Voodoo Media') : 'Voodoo Media';
    } catch (_) {}
  }

  function getMusicSubrouteFromPath() {
    try {
      const parts = String(window.location.pathname || '').trim().replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
      if (!parts.length) return '';
      if (String(parts[0] || '').toLowerCase() !== 'music') return '';
      const sub = String(parts[1] || '').toLowerCase().trim();
      return MUSIC_SUBROUTES.has(sub) ? sub : '';
    } catch (_) {
      return '';
    }
  }

  function syncMusicSubroute(mode, opts) {
    const key = MUSIC_SUBROUTES.has(String(mode || '').toLowerCase().trim())
      ? String(mode || '').toLowerCase().trim()
      : 'bands';
    const replace = !!(opts && opts.replace);
    const preservePath = !!(opts && opts.preservePath);
    const currentPath = String(window.location.pathname || '').trim();
    const target = (preservePath && currentPath.toLowerCase().startsWith(`/music/${key}`))
      ? `${currentPath}${window.location.search || ''}`
      : `/music/${key}${window.location.search || ''}`;

    try {
      if (replace) window.history.replaceState({ __vmpixBackGuard: true }, document.title, target);
      else window.history.pushState({ __vmpixBackGuard: true }, document.title, target);
    } catch (_) {}
  }
  function onEnter() {
    try {
      const initialMode = getMusicSubrouteFromPath();
      if (initialMode) setMode(initialMode, { replace: true, preservePath: true });
    } catch (_) {}

    // Warm the People index and preload the People module so the People tab is fast
    // (prevents first-click cold-start + script-load delays).
    try {
      const __VM_PEOPLE_WARM_KEY = '__vm_music_people_index_warm_v1';
      const getSession = (k) => { try { return sessionStorage.getItem(k); } catch (_) { return null; } };
      const setSession = (k, v) => { try { sessionStorage.setItem(k, v); } catch (_) {} };

      // 1) Preload the People module script (on-demand loader still works as fallback).
      try {
        const peopleModuleSrc = "/music-archive-people.js?v=20260310a";
        const existing = document.querySelector('script[data-music-archive-people="1"]');
        if (!existing) {
          const s = document.createElement('script');
                          s.src = peopleModuleSrc;
          s.async = true;
          s.setAttribute('data-music-archive-people', '1');
          document.head.appendChild(s);
        }
      } catch (_) {}

      // 2) Leave the People index cold until the user actually opens People.
      // The music backend can return transient 503s during warm-up, which pollutes
      // the console and obscures real admin/debug signals.
      if (!getSession(__VM_PEOPLE_WARM_KEY)) {
        setSession(__VM_PEOPLE_WARM_KEY, String(Date.now()));
      }
    } catch (_) {}
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

    const landingCopy = document.getElementById('musicLandingCopy');
    if (landingCopy && landingCopy.parentNode) landingCopy.parentNode.removeChild(landingCopy);

const hudMain = document.querySelector('.hudStub.hudMain');
if (hudMain) {
  hudMain.style.padding = _prevHudMainPadding || '';
  // reset any Music-only overflow overrides
  hudMain.style.overflow = '';
  hudMain.style.overflowX = '';
  hudMain.style.overflowY = '';

  // Restore any Music-only flex layout used for auto-height archives.
  if (_prevHudMainDisplay !== null) hudMain.style.display = _prevHudMainDisplay || '';
  if (_prevHudMainFlexDirection !== null) hudMain.style.flexDirection = _prevHudMainFlexDirection || '';
  if (_prevHudMainAlignItems !== null) hudMain.style.alignItems = _prevHudMainAlignItems || '';
  if (_prevHudMainJustifyContent !== null) hudMain.style.justifyContent = _prevHudMainJustifyContent || '';
}
_prevHudMainPadding = null;
_prevHudMainDisplay = null;
_prevHudMainFlexDirection = null;
_prevHudMainAlignItems = null;
_prevHudMainJustifyContent = null;

// Restore page-level overflowX (only if we changed it)
const htmlEl = document.documentElement;
const bodyEl = document.body;
if (htmlEl && _prevHtmlOverflowX !== null) htmlEl.style.overflowX = _prevHtmlOverflowX || '';
if (bodyEl && _prevBodyOverflowX !== null) bodyEl.style.overflowX = _prevBodyOverflowX || '';
_prevHtmlOverflowX = null;
_prevBodyOverflowX = null;


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

  
// Programmatically switch between Bands/Shows without returning to the Music landing view
function setMode(mode, opts) {
  const m = String(mode || '').toLowerCase().trim();
  const key =
    (m === 'stats' || m === 'bands' || m === 'shows' || m === 'people' || m === 'origins' || m === 'project')
      ? m
      : 'bands';

  try {
    syncMusicSubroute(key, { replace: !!(opts && opts.replace), preservePath: !!(opts && opts.preservePath) });
  } catch (_) {}

  try {
    const tab =
      (_orangeBoxEl && _orangeBoxEl.querySelector(`.hudTab[data-tab="${key}"]`)) ||
      document.querySelector(`.hudTab[data-tab="${key}"]`);
    if (tab) {
      _suppressMusicTabUrlSync = true;
      try { tab.click(); } finally { _suppressMusicTabUrlSync = false; }
    }
  } catch (_) {}
}

window.MusicArchive = { render, onEnter, destroy, setMode };
})();






