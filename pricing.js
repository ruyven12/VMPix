// pricing.js
// Pricing section module (stub)
(function () {
  'use strict';

  let _mount = null;

  function render(mountEl) {
    if (!mountEl) return;
    _mount = mountEl;

    _mount.innerHTML = `
      <div style="max-width:760px; margin:0 auto; opacity:.9; font-size:14px; line-height:1.6; letter-spacing:.04em; text-transform:none;">
        <strong>Pricing</strong><br><br>
        <div style="opacity:.75">
          Pricing details coming soon.
        </div>
      </div>
    `;
  }

  function onEnter() {}
  function destroy() {
    if (_mount) {
      _mount.innerHTML = '';
      _mount = null;
    }
  }

  window.Pricing = { render, onEnter, destroy };
})();
