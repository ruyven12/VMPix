// about-archive.js
// Placeholder About module for the HUD.
// Currently mirrors your existing "typed text" behavior so nothing changes visually.

(function(){
  "use strict";

  const COPY = "About Me - Coming Soon";

  function render(mountEl){
    if (!mountEl) return;
    mountEl.innerHTML = `
      <div style="max-width:760px; margin:0 auto; opacity:.9; font-size:14px; line-height:1.6; letter-spacing:.04em; text-transform:none;">
        <strong>About</strong><br><br>
        <div style="opacity:.75">
          About Me - Coming Soon
        </div>
      </div>
    `;
  }

  function onEnter(){}
  function destroy(){}

  window.AboutArchive = { render, onEnter, destroy, COPY };
})();
