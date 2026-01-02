// music-archive.js
// Phase 2 clean baseline (DEDUPED)
// - Keeps HUD neon frame visible on Music route
// - Removes HUD main container fill only (Music only) — border stays
// - Allows Music-only frame height control
// - Displays: THE WORLD OF MUSIC

(function(){
  "use strict";

  let _mount = null;

  // restore state
  let _prevWrapDisplay = null;
  let _prevHudMainBg = null;

  // inner glass panel restore
  let _prevGlassDisplay = null;

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
  // Tweak this one line to dial in the exact vertical placement.
  // Examples:
  //   '-40px'  = slightly up
  //   '0px'    = default / centered
  //   '30px'   = pushed down
  const MUSIC_FRAME_Y_OFFSET = '0px';

  // Ensure neon frame is visible on Music route
  function ensureFrameVisibleForMusic(){
    const wrap = document.querySelector('.neonFrameWrap');
    if (!wrap) return;

    if (_prevWrapDisplay === null) {
      _prevWrapDisplay = wrap.style.display || "";
    }
    wrap.style.display = 'block'; // override route-music CSS

    // Music-only positioning (optional)
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

    // Music-only: hide the inner "glass" panel (the faint translucent window)
    const glass = document.querySelector('.neonFrameTextInner');
    if (glass){
      if (_prevGlassDisplay === null) _prevGlassDisplay = glass.style.display || "";
      glass.style.display = 'none';
    }

    // Simple title only (baseline)
    _mount.innerHTML = '<span data-hud-main-text style="font-size:16px; letter-spacing:.14em; text-transform:uppercase;">The World of Music</span>';
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

    // restore inner glass panel
    const glass = document.querySelector('.neonFrameTextInner');
    if (glass){
      glass.style.display = _prevGlassDisplay || "";
    }
    _prevGlassDisplay = null;

    restoreFrameVisibility();

    if (_mount){
      _mount.innerHTML = "";
      _mount = null;
    }
  }

  window.MusicArchive = { render, onEnter, destroy };
})();
