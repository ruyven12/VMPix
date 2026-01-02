// music-archive.js
// Phase 2 start: clean slate.
// Goal: keep the HUD shell + neon frame behavior intact, but remove the fake test UI.
// For now, Music just shows a simple title inside the HUD main area.

(function(){
  "use strict";

  let _mount = null;
  let _prevWrapDisplay = null;

  // Your HUD CSS hides the frame on route-music via:
  //   body.route-music .neonFrameWrap { display:none; }
  // To keep the neon frame visible for Music while we build this out,
  // we override with an inline style (and restore on destroy).
  function ensureFrameVisibleForMusic(){
    const wrap = document.querySelector('.neonFrameWrap');
    if (!wrap) return;

    if (_prevWrapDisplay === null) _prevWrapDisplay = wrap.style.display || "";
    wrap.style.display = "block"; // inline beats stylesheet (rule is not !important)
  }

  function restoreFrameVisibility(){
    const wrap = document.querySelector('.neonFrameWrap');
    if (!wrap) return;

    wrap.style.display = (_prevWrapDisplay !== null) ? _prevWrapDisplay : "";
    _prevWrapDisplay = null;
  }

  function render(mountEl){
    if (!mountEl) return;
    _mount = mountEl;

    // ---- Music-only HUD main box override (remove outline + fill) ----
    const hudMainBox = document.querySelector('.hudStub.hudMain');
    if (hudMainBox){
      // stash previous inline styles so we can restore on destroy
      if (!hudMainBox.dataset._musicPrevBorder) hudMainBox.dataset._musicPrevBorder = hudMainBox.style.border || '';
      if (!hudMainBox.dataset._musicPrevBg)     hudMainBox.dataset._musicPrevBg     = hudMainBox.style.background || '';
      hudMainBox.style.border = 'none';
      hudMainBox.style.background = 'transparent';
    }

    ensureFrameVisibleForMusic();

    // Keep it simple: one centered line of text.
    // (The HUD already centers/frames this area for us.)
    _mount.innerHTML = '<span data-hud-main-text style="font-size:16px; letter-spacing:.14em; text-transform:uppercase;">The World of Music</span>';
  }

    if (!mountEl) return;
    _mount = mountEl;

    ensureFrameVisibleForMusic();

    // ---- Music-only frame height control ----
    // You can tweak this value safely without affecting other routes
    const MUSIC_FRAME_HEIGHT = '110px'; // try 100px–130px

    const frame = document.querySelector('.neonFrame');
    const orn   = document.querySelector('.hudOrn');
    if (frame) frame.style.height = MUSIC_FRAME_HEIGHT;
    if (orn)   orn.style.height   = MUSIC_FRAME_HEIGHT;

    // Keep it simple: one centered line of text.
    // (The HUD already centers/frames this area for us.)
    _mount.innerHTML = '<span data-hud-main-text style="font-size:16px; letter-spacing:.14em; text-transform:uppercase;">The World of Music</span>';
  }

  function onEnter(){
    // No typing yet — we’ll add effects later if desired.
  }

  function destroy(){
    // restore HUD main box styles
    const hudMainBox = document.querySelector('.hudStub.hudMain');
    if (hudMainBox){
      hudMainBox.style.border = hudMainBox.dataset._musicPrevBorder || '';
      hudMainBox.style.background = hudMainBox.dataset._musicPrevBg || '';
      delete hudMainBox.dataset._musicPrevBorder;
      delete hudMainBox.dataset._musicPrevBg;
    }

    if (_mount){
      _mount.innerHTML = "";
      _mount = null;
    }
    restoreFrameVisibility();
  }

    if (_mount){
      _mount.innerHTML = "";
      _mount = null;
    }
    restoreFrameVisibility();
  }

  window.MusicArchive = { render, onEnter, destroy };
})();
