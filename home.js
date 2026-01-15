// home.js
(function () {
  "use strict";

  let _root = null;

  function ensureHomeStyles() {
    if (document.getElementById("voodooHomeStyles")) return;
    const s = document.createElement("style");
    s.id = "voodooHomeStyles";
    s.textContent = `
      /* Scoped to Home panel */
      #voodooHomeRoot { width:100%; max-width:1200px; margin:0 auto; padding: 14px 10px; }
      #voodooHomeRoot .homeTitle { text-align:center; opacity:.9; letter-spacing:.12em; font-size: 13px; }
      #voodooHomeRoot .homeGrid { margin-top:14px; display:grid; gap:12px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
      #voodooHomeRoot .homeCard {
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(0,0,0,0.18);
        padding: 14px;
        text-align:center;
      }
      #voodooHomeRoot .homeCard .k { font-size: 10px; opacity:.65; letter-spacing:.20em; margin-bottom:6px; }
      #voodooHomeRoot .homeCard .v { font-size: 16px; font-weight: 800; }
    `;
    document.head.appendChild(s);
  }

  function render() {
    return `
      <div id="voodooHomeRoot">
        <div class="homeTitle">
          WELCOME TO THE LANDING SITE FOR VOODOO MEDIA. PLEASE MAKE YOUR SELECTION ABOVE.
        </div>

        <div class="homeGrid">
          <div class="homeCard" id="homeCardMusic">
            <div class="k">SECTION</div>
            <div class="v">MUSIC</div>
          </div>
          <div class="homeCard" id="homeCardWrestling">
            <div class="k">SECTION</div>
            <div class="v">WRESTLING</div>
          </div>
          <div class="homeCard" id="homeCardAbout">
            <div class="k">SECTION</div>
            <div class="v">ABOUT</div>
          </div>
        </div>
      </div>
    `;
  }

  function onMount(rootEl) {
    ensureHomeStyles();
    _root = rootEl || document;

    // OPTIONAL: if your shell/router exposes a navigate function, hook cards to it.
    // Replace window.VoodooShell.navigate(...) with whatever your router uses.
    const go = (key) => {
      try {
        if (window.VoodooShell && typeof window.VoodooShell.navigate === "function") {
          window.VoodooShell.navigate(key);
        }
      } catch (_) {}
    };

    const music = _root.querySelector("#homeCardMusic");
    const wrestling = _root.querySelector("#homeCardWrestling");
    const about = _root.querySelector("#homeCardAbout");

    if (music) music.addEventListener("click", () => go("music"));
    if (wrestling) wrestling.addEventListener("click", () => go("wrestling"));
    if (about) about.addEventListener("click", () => go("about"));
  }

  function destroy() {
    _root = null;
  }

  window.VoodooHome = { render, onMount, destroy };
})();
