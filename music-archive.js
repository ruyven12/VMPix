// music-archive.js
// Placeholder "Music" module for the HUD.
//
// This is where you'll paste/adapt the working logic from https://music-archive-3lfa.onrender.com/
// WITHOUT changing the HUD shell.
//
// For now: preserves your current behavior (music route clears the HUD main mount).
// Later: replace render() with the actual music archive UI + logic.

(function(){
  "use strict";

  function render(mountEl){
    if (!mountEl) return;
    // Keep current behavior: empty main area for music (and CSS hides the frame on route-music)
    mountEl.innerHTML = '';
  }

  function onEnter(){
    // hook for later
  }

  function destroy(){
    // hook for later cleanup (listeners/timers)
  }

  window.MusicArchive = { render, onEnter, destroy };
})();
