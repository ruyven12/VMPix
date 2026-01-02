// music-archive.js
// Phase 2 clean baseline (DEDUPED)
// - Keeps HUD neon frame visible on Music route
// - Removes HUD main container fill only (Music only) — border stays
// - Allows Music-only frame height + vertical placement control
// - OPTION B: Re-parent #hudMainMount so .neonFrameTextInner can be display:none (glass removed)
// - Displays: THE WORLD OF MUSIC

(function(){
  "use strict";

  let _mount = null;

  // restore state
  let _prevWrapDisplay = null;
  let _prevHudMainBg = null;

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

  // 👉 VERTICAL POSITION ADJUSTMENT FOR THE NEON FRAME (MUSIC ONLY)
  // Negative values move the frame UP, positive values move it DOWN.
  const MUSIC_FRAME_Y_OFFSET = '0px';

  // 👉 TITLE POSITION INSIDE THE FRAME (MUSIC ONLY)
  // Negative = move title UP, positive = move title DOWN.
  const MUSIC_TITLE_Y_OFFSET = '-20px';

  // 👉 OPTIONAL: add breathing room inside the frame (MUSIC ONLY)
  // Use small values like '6px'–'14px'. Set to '0px' for none.
  const MUSIC_TITLE_PADDING_Y = '0px';

  // Ensure neon frame is visible on Music route
  function ensureFrameVisibleForMusic(){
    const wrap = document.querySelector('.neonFrameWrap');
    if (!wrap) return;

    if (_prevWrapDisplay === null) {
      _prevWrapDisplay = wrap.style.display || "";
    }
    wrap.style.display = 'block'; // override route-music CSS

    // Music-only positioning
    if (_prevWrapTransform === null) {
      _prevWrapTransform = wrap.style.transform || "";
    }
    wrap.style.transform = `translateY(${MUSIC_FRAME_Y_OFFSET})`;

    // If the parent is centering, force top alignment for Music
    const menuHero = document.querySelector('.menuHero');
    if (menuHero){
      if (_prevMenuAlign === null) _prevMenuAlign = menuHero.style.alignItems || "";
      if (_prevMenuPaddingTop === null) _prevMenuPaddingTop = menuHero.style.paddingTop || "";
      menuHero.style.alignItems = 'flex-start';
      menuHero.style.paddingTop = '0px';
    }
  }

  function restoreFrameVisibility(){
    const wrap = document.querySelector('.neonFrameWrap');
    if (wrap){
      wrap.style.display = _prevWrapDisplay || "";
      wrap.style.transform = _prevWrapTransform || "";
    }
    _prevWrapDisplay = null;
    _prevWrapTransform = null;

    const menuHero = document.querySelector('.menuHero');
    if (menuHero){
      menuHero.style.alignItems = _prevMenuAlign || "";
      menuHero.style.paddingTop = _prevMenuPaddingTop || "";
    }
    _prevMenuAlign = null;
    _prevMenuPaddingTop = null;
  }

  // Apply Music-only frame height
  function applyMusicFrameHeight(){
    const frame = document.querySelector('.neonFrame');
    const orn   = document.querySelector('.hudOrn');

    if (frame){
      _prevFrameHeight = frame.style.height || "";
      frame.style.height = MUSIC_FRAME_HEIGHT;
    }
    if (orn){
      _prevOrnHeight = orn.style.height || "";
      orn.style.height = MUSIC_FRAME_HEIGHT;
    }
  }

  function restoreFrameHeight(){
    const frame = document.querySelector('.neonFrame');
    const orn   = document.querySelector('.hudOrn');

    if (frame) frame.style.height = _prevFrameHeight || "";
    if (orn)   orn.style.height   = _prevOrnHeight || "";

    _prevFrameHeight = null;
    _prevOrnHeight = null;
  }

  function render(mountEl){
    if (!mountEl) return;
    _mount = mountEl;

    // Music-only: remove HUD main container fill; keep the 1px border
    const hudMainBox = document.querySelector('.hudStub.hudMain');
    if (hudMainBox){
      _prevHudMainBg = hudMainBox.style.background || "";
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
      if (_prevOuterBg === null) _prevOuterBg = glassOuter.style.background || "";
      if (_prevOuterShadow === null) _prevOuterShadow = glassOuter.style.boxShadow || "";
      if (_prevOuterPos === null) _prevOuterPos = glassOuter.style.position || "";
      glassOuter.style.background = 'transparent';
      glassOuter.style.boxShadow = 'none';
      if (!glassOuter.style.position) glassOuter.style.position = 'relative';

      // store mount original position for restore (only once)
      if (_prevMountParent === null) {
        _prevMountParent = mountEl.parentNode;
        _prevMountNextSibling = mountEl.nextSibling;
        _prevMountStyle = mountEl.getAttribute('style') || "";
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
      mountEl.style.transform = `translateY(${MUSIC_TITLE_Y_OFFSET})`;
      mountEl.style.paddingTop = MUSIC_TITLE_PADDING_Y;
      mountEl.style.paddingBottom = MUSIC_TITLE_PADDING_Y;

      // now safe to truly remove the inner glass container
      if (_prevGlassDisplay === null) _prevGlassDisplay = glassInner.style.display || "";
      glassInner.style.display = 'none';
    }

    // Simple title only (baseline)
    _mount.innerHTML =
      '<span data-hud-main-text style="font-size:16px; letter-spacing:.14em; text-transform:uppercase;">The World of Music</span>';
  }

  function onEnter(){
    // no-op for now
  }

  function destroy(){
    // restore HUD main box background
    const hudMainBox = document.querySelector('.hudStub.hudMain');
    if (hudMainBox){
      hudMainBox.style.background = _prevHudMainBg || "";
    }
    _prevHudMainBg = null;

    restoreFrameHeight();

    // restore glass + mount position (Option B)
    const glassInner = document.querySelector('.neonFrameTextInner');
    const glassOuter = document.querySelector('.neonFrameText');

    // unhide inner
    if (glassInner){
      glassInner.style.display = _prevGlassDisplay || "";
    }
    _prevGlassDisplay = null;

    // restore outer styles
    if (glassOuter){
      glassOuter.style.background = _prevOuterBg || "";
      glassOuter.style.boxShadow = _prevOuterShadow || "";
      glassOuter.style.position = _prevOuterPos || "";
    }
    _prevOuterBg = null;
    _prevOuterShadow = null;
    _prevOuterPos = null;

    // move mount back where it originally lived
    if (_mount && _prevMountParent) {
      // restore style attribute exactly (removes our flex/transform/padding, etc.)
      _mount.setAttribute('style', _prevMountStyle || "");

      // reinsert back at original spot
      if (_prevMountNextSibling && _prevMountNextSibling.parentNode === _prevMountParent) {
        _prevMountParent.insertBefore(_mount, _prevMountNextSibling);
      } else {
        _prevMountParent.appendChild(_mount);
      }
    }

    _prevMountParent = null;
    _prevMountNextSibling = null;
    _prevMountStyle = null;

    restoreFrameVisibility();

    if (_mount){
      _mount.innerHTML = "";
      _mount = null;
    }
  }

  window.MusicArchive = { render, onEnter, destroy };
})();
