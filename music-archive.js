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
    const ARCHIVES_TOP_OFFSET_PX = 115;   // move down from the frame
    const ARCHIVES_BOTTOM_OFFSET_PX = 15; // lift up from the bottom strip

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
      // Adjust this to move the whole archive UI down from the frame.
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

  // ------------------------------------------------------------
  // ARCHIVES UI (Bands/Shows) — injected ONLY when Archives tab is active
  // ------------------------------------------------------------

  // One-time CSS injection for the Archives UI.
  // Everything is scoped under #musicArchiveUI so it won't affect the rest of the site.
  function ensureArchiveUIStyles() {
    if (document.getElementById('musicArchiveUIStyles')) return;

    const s = document.createElement('style');
    s.id = 'musicArchiveUIStyles';
    s.textContent = `
      /* =========================
         ARCHIVE UI TUNING KNOBS
         Change these vars to adjust spacing/sizes.
         ========================= */
      #musicArchiveUI{
        --au-maxWidth: 900px;          /* overall max width of the archive UI block */
        --au-gap: 14px;               /* vertical spacing between rows */
        --au-padX: 18px;              /* inner horizontal padding */
        --au-padY: 16px;              /* inner vertical padding */

        --au-frameRadius: 14px;
        --au-frameBorder: rgba(255,70,110,0.35);
        --au-frameGlow: 0 0 0 1px rgba(255,70,110,0.10) inset, 0 0 26px rgba(255,70,110,0.14);

        /* Bands/Shows toggle sizes */
        --au-toggleH: 48px;
        --au-toggleW: 360px;
        --au-toggleRadius: 999px;
        --au-toggleText: 15px;
        --au-toggleTracking: .08em;

        /* Pills */
        --au-pillH: 34px;
        --au-pillRadius: 999px;
        --au-pillText: 13px;
        --au-pillTracking: .10em;
        --au-pillGap: 10px;

        /* Accent colors */
        --au-accent: rgba(255,70,110,0.95);
        --au-accentSoft: rgba(255,70,110,0.35);
        --au-accentDim: rgba(255,70,110,0.18);
        --au-gold: rgba(255,190,70,0.95);
        --au-goldSoft: rgba(255,190,70,0.20);
      }

      #musicArchiveUI{
        width:100%;
        height:100%;
        display:flex;
        align-items:center;
        justify-content:center;
        padding: var(--au-padY) var(--au-padX);
        box-sizing:border-box;
      }

      /* Main framed block */
      #musicArchiveUI .au-shell{
        width: min(var(--au-maxWidth), 100%);
        border-radius: var(--au-frameRadius);
        border: 1px solid var(--au-frameBorder);
        background: rgba(0,0,0,0.10);
        box-shadow: var(--au-frameGlow);
        padding: 18px 18px 16px;
        box-sizing:border-box;
      }

      #musicArchiveUI .au-row{ display:flex; justify-content:center; }
      #musicArchiveUI .au-col{ display:flex; flex-direction:column; gap: var(--au-gap); }

      /* =========================
         Bands / Shows Toggle (top)
         ========================= */
      #musicArchiveUI .au-toggleFrame{
        position:relative;
        width: min(var(--au-toggleW), 100%);
        height: var(--au-toggleH);
        border-radius: 18px;
        border: 1px solid rgba(255,70,110,0.28);
        background: rgba(0,0,0,0.18);
        box-shadow: 0 0 0 1px rgba(255,70,110,0.08) inset, 0 0 22px rgba(255,70,110,0.16);
        overflow:hidden;
      }

      /* Decorative “sci-fi” corners */
      #musicArchiveUI .au-toggleFrame::before,
      #musicArchiveUI .au-toggleFrame::after{
        content:"";
        position:absolute;
        top:50%;
        width:34px;
        height:20px;
        transform:translateY(-50%);
        border:1px solid rgba(255,70,110,0.35);
        box-shadow:0 0 14px rgba(255,70,110,0.18);
        opacity:.9;
      }
      #musicArchiveUI .au-toggleFrame::before{
        left:10px;
        border-right:none;
        border-top-left-radius:10px;
        border-bottom-left-radius:10px;
      }
      #musicArchiveUI .au-toggleFrame::after{
        right:10px;
        border-left:none;
        border-top-right-radius:10px;
        border-bottom-right-radius:10px;
      }

      #musicArchiveUI .au-toggle{
        position:absolute;
        inset: 8px;
        border-radius: var(--au-toggleRadius);
        display:flex;
        align-items:center;
        justify-content:space-between;
        background: rgba(0,0,0,0.22);
        border: 1px solid rgba(255,70,110,0.22);
        box-shadow: 0 0 0 1px rgba(255,70,110,0.06) inset;
      }

      #musicArchiveUI .au-toggleBtn{
        flex:1;
        height:100%;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size: var(--au-toggleText);
        letter-spacing: var(--au-toggleTracking);
        text-transform:uppercase;
        cursor:pointer;
        user-select:none;
        color: rgba(255,255,255,0.72);
        position:relative;
        z-index:2;
      }

      /* Active slider */
      #musicArchiveUI .au-toggleSlider{
        position:absolute;
        top:0; bottom:0;
        width:50%;
        border-radius: var(--au-toggleRadius);
        background: radial-gradient(circle at 30% 40%, rgba(255,190,70,0.92), rgba(255,70,110,0.78));
        box-shadow: 0 0 18px rgba(255,190,70,0.16), 0 0 22px rgba(255,70,110,0.22);
        transition: transform 160ms ease;
        z-index:1;
        opacity:.95;
      }

      #musicArchiveUI[data-mode="bands"] .au-toggleSlider{ transform: translateX(0%); }
      #musicArchiveUI[data-mode="shows"] .au-toggleSlider{ transform: translateX(100%); }

      #musicArchiveUI[data-mode="bands"] .au-toggleBtn[data-mode="bands"],
      #musicArchiveUI[data-mode="shows"] .au-toggleBtn[data-mode="shows"]{
        color: rgba(0,0,0,0.78);
        font-weight: 700;
        text-shadow: 0 1px 0 rgba(255,255,255,0.25);
      }

      /* =========================
         Secondary pills row
         ========================= */
      #musicArchiveUI .au-pills{ display:flex; gap: var(--au-pillGap); flex-wrap:wrap; justify-content:center; }

      #musicArchiveUI .au-pill{
        height: var(--au-pillH);
        padding: 0 16px;
        border-radius: var(--au-pillRadius);
        border: 1px solid rgba(255,70,110,0.20);
        background: rgba(0,0,0,0.16);
        box-shadow: 0 0 0 1px rgba(255,70,110,0.05) inset;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        font-size: var(--au-pillText);
        letter-spacing: var(--au-pillTracking);
        text-transform:uppercase;
        cursor:pointer;
        user-select:none;
        color: rgba(255,255,255,0.70);
        transition: transform 140ms ease, filter 140ms ease, opacity 140ms ease;
      }

      #musicArchiveUI .au-pill:hover{ transform: translateY(-1px); filter: brightness(1.12); opacity: .95; }

      #musicArchiveUI .au-pill.is-active{
        background: rgba(255,255,255,0.06);
        border-color: rgba(255,190,70,0.38);
        box-shadow: 0 0 0 1px rgba(255,190,70,0.10) inset, 0 0 18px rgba(255,190,70,0.12);
        color: rgba(255,255,255,0.88);
      }

      /* =========================
         Helper text + legend
         ========================= */
      #musicArchiveUI .au-help{
        text-align:center;
        font-size: 12px;
        letter-spacing: .08em;
        opacity: .75;
        text-transform:none;
        margin-top: 2px;
      }

      #musicArchiveUI .au-legend{
        display:flex;
        align-items:center;
        justify-content:center;
        gap: 14px;
        font-size: 11px;
        letter-spacing: .06em;
        opacity:.75;
        margin-top: 6px;
      }
      #musicArchiveUI .au-dot{
        width:10px; height:10px; border-radius:3px;
        display:inline-block;
        margin-right:6px;
        border: 1px solid rgba(255,255,255,0.12);
      }
      #musicArchiveUI .au-dot.gray{ background: rgba(120,120,120,0.35); }
      #musicArchiveUI .au-dot.yellow{ background: rgba(255,190,70,0.55); }
      #musicArchiveUI .au-dot.green{ background: rgba(70,255,140,0.40); }

      @media (max-width: 520px){
        #musicArchiveUI{ --au-toggleW: 320px; --au-padX: 10px; }
        #musicArchiveUI .au-shell{ padding: 14px 12px 12px; }
      }
    `;

    document.head.appendChild(s);
  }

  // HTML shell for the Archives UI (static layout for now)
  function archiveUIHtml() {
    return `
      <div id="musicArchiveUI" data-mode="bands">
        <div class="au-shell">
          <div class="au-col">
            <!-- Row 1: Bands / Shows toggle -->
            <div class="au-row">
              <div class="au-toggleFrame" aria-label="Archive mode">
                <div class="au-toggle">
                  <div class="au-toggleSlider" aria-hidden="true"></div>
                  <div class="au-toggleBtn" data-mode="bands" role="button" aria-pressed="true">Bands</div>
                  <div class="au-toggleBtn" data-mode="shows" role="button" aria-pressed="false">Shows</div>
                </div>
              </div>
            </div>

            <!-- Row 2: Secondary pills (placeholders for now) -->
            <div class="au-row">
              <div class="au-pills" aria-label="Archive sections">
                <div class="au-pill is-active" data-pill="intro">Introduction</div>
                <div class="au-pill" data-pill="started">How It Started</div>
                <div class="au-pill" data-pill="faq">Notes-FAQ</div>
                <div class="au-pill" data-pill="updates">Updates</div>
              </div>
            </div>

            <!-- Helper text -->
            <div class="au-help">Select a band from the list.</div>

            <!-- Row 3: Category pills -->
            <div class="au-row">
              <div class="au-pills" aria-label="Band scope">
                <div class="au-pill is-active" data-scope="local">Local</div>
                <div class="au-pill" data-scope="regional">Regional</div>
                <div class="au-pill" data-scope="national">National</div>
                <div class="au-pill" data-scope="international">International</div>
              </div>
            </div>

            <!-- Row 4: Alpha-range pills -->
            <div class="au-row">
              <div class="au-pills" aria-label="Band range">
                <div class="au-pill is-active" data-range="oc">O-C</div>
                <div class="au-pill" data-range="dg">D-G</div>
                <div class="au-pill" data-range="hk">H-K</div>
                <div class="au-pill" data-range="lo">L-O</div>
                <div class="au-pill" data-range="ps">P-S</div>
                <div class="au-pill" data-range="tz">T-Z</div>
              </div>
            </div>

            <!-- Legend -->
            <div class="au-legend" aria-label="Legend">
              <span><span class="au-dot gray"></span>= Nothing yet</span>
              <span><span class="au-dot yellow"></span>= In Progress</span>
              <span><span class="au-dot green"></span>= Fully updated</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // One-time event delegation for the Archives UI.
  // Keeps it fast and avoids re-binding on every wipe.
  function ensureArchiveUIEvents() {
    if (!_contentPanelEl || _contentPanelEl.dataset.archiveUiBound === '1') return;

    _contentPanelEl.dataset.archiveUiBound = '1';

    _contentPanelEl.addEventListener('click', (e) => {
      const root = _contentPanelEl.querySelector('#musicArchiveUI');
      if (!root) return; // only active when archive UI is mounted

      const toggleBtn = e.target.closest('.au-toggleBtn');
      if (toggleBtn && root.contains(toggleBtn)) {
        const mode = toggleBtn.getAttribute('data-mode');
        root.setAttribute('data-mode', mode);
        root.querySelectorAll('.au-toggleBtn').forEach((b) => {
          const isOn = b.getAttribute('data-mode') === mode;
          b.setAttribute('aria-pressed', isOn ? 'true' : 'false');
        });
        return;
      }

      const pill = e.target.closest('.au-pill');
      if (pill && root.contains(pill)) {
        // "group" by attribute type so each row can have its own active state
        const groupAttr = ['data-pill', 'data-scope', 'data-range'].find((a) => pill.hasAttribute(a));
        if (!groupAttr) return;

        const groupSelector = `[${groupAttr}]`;
        pill.parentElement.querySelectorAll(groupSelector).forEach((p) => p.classList.remove('is-active'));
        pill.classList.add('is-active');
      }
    });
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

  // ------------------------------------------------------------
  // ARCHIVES HEADER UI (Bands / Shows selector)
  // This renders ONLY inside the Archive content panel
  // All spacing, sizing, glow, and layout values are adjustable below
  // ------------------------------------------------------------

  function renderArchiveHeaderUI() {
    return `
      <div class="archiveHeaderWrap">
        <!-- Bands / Shows toggle -->
        <div class="archiveModeToggle">
          <button class="archiveModeBtn is-active" data-mode="bands">Bands</button>
          <button class="archiveModeBtn" data-mode="shows">Shows</button>
        </div>
      </div>
    `;
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

          /* --------------------------------------------------
             ARCHIVES HEADER (Bands / Shows)
             All values below are SAFE TO TUNE
          -------------------------------------------------- */

          .archiveHeaderWrap{
            width:100%;
            display:flex;
            justify-content:center;
            margin-bottom:26px; /* space below header */
          }

          .archiveModeToggle{
            display:flex;
            gap:10px; /* spacing between buttons */
            padding:6px;
            border-radius:999px;
            background:rgba(0,0,0,0.35);
            box-shadow:
              0 0 0 1px rgba(255,80,110,0.35) inset,
              0 0 22px rgba(255,80,110,0.25);
          }

          .archiveModeBtn{
            min-width:96px; /* button width */
            padding:8px 18px; /* vertical / horizontal padding */
            border-radius:999px;
            border:none;
            background:transparent;
            color:rgba(255,190,200,0.75);
            font-size:13px;
            letter-spacing:.12em;
            text-transform:uppercase;
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
            color:#120306;
            box-shadow:
              0 0 0 1px rgba(255,255,255,0.45) inset,
              0 0 26px rgba(255,90,120,0.75);
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
                if (i >= terminalText.length) {
                  window.clearInterval(_typeTimer);
                  _typeTimer = null;
                  return;
                }
                term.textContent += terminalText.charAt(i);
                i++;
              }, TYPE_MS);
            }
          }, WIPE_IN_MS);
        }, WIPE_OUT_MS);
      }

      // Attach tab click handlers
      _orangeBoxEl.querySelectorAll('.hudTab').forEach((tab) => {
        tab.addEventListener('click', () => {
          animateHudTab(tab);
          if (!_contentPanelEl) return;

          const label = tab.textContent.trim();

          if (label === 'Archives') {
            setArchiveViewportExpanded(true);
            ensureArchiveUIStyles();
            wipeSwapContent(archiveUIHtml(), '');
            ensureArchiveUIEvents();
            return;
          }

          setArchiveViewportExpanded(false);
          wipeSwapContent('', '');
        });
      });

      hudMain.appendChild(_orangeBoxEl);
    }
  }

  function destroy() {
    restoreFrameVisibility();
    restoreFrameHeight();

    if (_onResize) {
      window.removeEventListener('resize', _onResize);
      _onResize = null;
    }

    if (_orangeBoxEl && _orangeBoxEl.parentNode) {
      _orangeBoxEl.parentNode.removeChild(_orangeBoxEl);
    }
    _orangeBoxEl = null;

    if (_contentPanelEl && _contentPanelEl.parentNode) {
      _contentPanelEl.parentNode.removeChild(_contentPanelEl);
    }
    _contentPanelEl = null;

    const hudMain = document.querySelector('.hudStub.hudMain');
    if (hudMain && _prevHudMainPadding !== null) {
      hudMain.style.padding = _prevHudMainPadding;
    }
    _prevHudMainPadding = null;

    const hudMainBox = document.querySelector('.hudStub.hudMain');
    if (hudMainBox && _prevHudMainBg !== null) {
      hudMainBox.style.background = _prevHudMainBg;
    }
    _prevHudMainBg = null;
  }

  // Mount / unmount hooks (SmugMug route aware)
  document.addEventListener('smugmug:route:music:enter', () => render(document.querySelector('[data-hud-main-text]')?.parentNode));
  document.addEventListener('smugmug:route:music:exit', destroy);

})();(() => {
                if (i >= terminalText.length) {
          