// home.js
// Home module for the HUD shell (hud-app.js)
//
// Exposes:
//   window.HomeArchive.render(mountEl)
//   window.HomeArchive.onEnter()
//   window.HomeArchive.destroy()
//
// This keeps things consistent with music-archive.js / wrestling-archive.js / about-archive.js:
// the shell routes, this file owns the Home UI.

(function () {
  'use strict';

  const DEFAULT_COPY =
    "Welcome to the landing site for Voodoo Media. Right now this is a placeholder for more content later but for now, please make your selection above.
	
	Also, this page at the moment is best viewed inside a browser only and should do good with most devices. If you are viewing this from Facebook Webview (you clicked the link in Facebook), view by browser instead.";

  let _mount = null;

  function ensureHomeStyles() {
    if (document.getElementById('homeArchiveStyles')) return;

    const s = document.createElement('style');
    s.id = 'homeArchiveStyles';
    s.textContent = `
      /* Home module: keep it subtle + consistent with HUD */
      #homeContentRoot{
        width: 100%;
        max-width: min(900px, 92%);
        margin: 0 auto;
        text-align: center;
        display: grid;
        gap: 14px;
        justify-items: center;
      }

      #homeContentRoot .homeQuickRow{
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: center;
        margin-top: 6px;
      }

      #homeContentRoot .homeQuickBtn{
        appearance: none;
        border: 1px solid rgba(255,60,60,.32);
        background: rgba(0,0,0,.16);
        color: inherit;
        font-family: inherit;
        letter-spacing: .14em;
        text-transform: uppercase;
        font-weight: 800;
        font-size: 12px;
        padding: 8px 12px;
        border-radius: 999px;
        cursor: pointer;
        transition: transform 120ms ease, box-shadow 180ms ease, border-color 180ms ease, filter 180ms ease;
      }

      #homeContentRoot .homeQuickBtn:hover{
        border-color: rgba(255,60,60,.46);
        box-shadow: 0 0 0 1px rgba(255,60,60,.16), 0 0 22px rgba(255,60,60,.20);
        filter: brightness(1.06);
      }

      #homeContentRoot .homeQuickBtn:active{
        transform: translateY(1px);
      }
    `;
    document.head.appendChild(s);
  }

  function mountEl() {
    return _mount || document.getElementById('hudMainMount');
  }

  // Tiny self-contained typer so we don't depend on hud-app.js internals
  function typeInto(el, text) {
    if (!el) return;
    const full = String(text || '').trim();
    if (!full) {
      el.textContent = '';
      return;
    }

    if (el._typeTimer) {
      clearInterval(el._typeTimer);
      el._typeTimer = null;
    }

    el.classList.add('isTyping');
    el.textContent = '';

    const speedMs = 12;
    let i = 0;

    el._typeTimer = setInterval(() => {
      i++;
      el.textContent = full.slice(0, i);
      if (i >= full.length) {
        clearInterval(el._typeTimer);
        el._typeTimer = null;
        el.textContent = full;
        el.classList.remove('isTyping');
      }
    }, speedMs);
  }

  function render(mount) {
    ensureHomeStyles();
    _mount = mount || mountEl();
    if (!_mount) return;

    // Keep the same HUD-main expectations: a [data-hud-main-text] exists
    _mount.innerHTML = `
      <div id="homeContentRoot">
        <div>
          <span data-hud-main-text></span>
        </div></div>
    `;

    // Wire quick nav buttons (no external deps)
    _mount.querySelectorAll('[data-go]').forEach(btn => {
      btn.addEventListener('click', () => {
        const to = btn.getAttribute('data-go') || '#/home';
        location.hash = to;
      }, { passive: true });
    });
  }

  function onEnter(copyOverride) {
    const root = mountEl();
    if (!root) return;
    const el = root.querySelector('[data-hud-main-text]');
    typeInto(el, copyOverride || DEFAULT_COPY);
  }

  function destroy() {
    const root = mountEl();
    if (!root) return;

    // Stop typer if running
    const el = root.querySelector('[data-hud-main-text]');
    if (el && el._typeTimer) {
      clearInterval(el._typeTimer);
      el._typeTimer = null;
    }
    // Leave DOM alone; the router will replace it on next route render.
  }

  window.HomeArchive = {
    render,
    onEnter,
    destroy,
  };
})();
