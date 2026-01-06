// wrestling-archive.js
// Placeholder Wrestling module for the HUD.
// Currently mirrors your existing "typed text" behavior so nothing changes visually.

(function(){
  "use strict";

  const COPY = "Wrestling Archives - Coming Soon";

  function render(mountEl){
    if (!mountEl) return;
    mountEl.innerHTML = '<span data-hud-main-text></span>';
  }

  function onEnter(){
    // Let hud-app.js do the typing if it wants; we won't force anything here.
    // Keeping this empty preserves the current look/feel.
  }

  function destroy(){}

  window.WrestlingArchive = { render, onEnter, destroy, COPY };
})();
