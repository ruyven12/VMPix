// about-archive.js
// Placeholder About module for the HUD.
// Currently mirrors your existing "typed text" behavior so nothing changes visually.

(function(){
  "use strict";

  const COPY = "About Me - Coming Soon";

  function render(mountEl){
    if (!mountEl) return;
    mountEl.innerHTML = '<span data-hud-main-text></span>';
  }

  function onEnter(){}
  function destroy(){}

  window.AboutArchive = { render, onEnter, destroy, COPY };
})();
