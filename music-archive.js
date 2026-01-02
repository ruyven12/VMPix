// music-archive.js
// Phase 1 test: inject a FAKE Music UI into the HUD mount (no API calls yet).
// Goal: prove the theory that clicking Music can load its entire UI from this file,
// WITHOUT changing the HUD HTML/CSS file contents.
//
// Implementation notes:
// - Your HUD CSS currently hides the frame on route-music via:
//   body.route-music .neonFrameWrap { display:none; }
//   For this test, we temporarily override that with an inline style so the mount is visible.
//   (No CSS/HTML edits required; we restore on destroy.)
//
// Later phases: replace the fake UI + local filtering with your real SmugMug public API logic.

(function(){
  "use strict";

  let _mount = null;
  let _onInput = null;
  let _prevWrapDisplay = null;

  const FAKE_BANDS = [
    { name: "Echo Ritual", region: "Local", year: "2025" },
    { name: "13 High", region: "Local", year: "2024" },
    { name: "Loki", region: "Regional", year: "2023" },
    { name: "Trans-Siberian Orchestra", region: "National", year: "2024" },
    { name: "Mixers Showcase Series", region: "Local", year: "2025" },
    { name: "Benefit for Bob Brackett", region: "Local", year: "2023" }
  ];

  function ensureFrameVisibleForMusic(){
    const wrap = document.querySelector('.neonFrameWrap');
    if (!wrap) return;

    // Save existing inline display so we can restore it later
    if (_prevWrapDisplay === null) _prevWrapDisplay = wrap.style.display || "";

    // Inline overrides CSS (since the CSS rule is not !important)
    wrap.style.display = "block";
  }

  function restoreFrameVisibility(){
    const wrap = document.querySelector('.neonFrameWrap');
    if (!wrap) return;

    if (_prevWrapDisplay !== null){
      wrap.style.display = _prevWrapDisplay;
    } else {
      wrap.style.display = "";
    }
    _prevWrapDisplay = null;
  }

  function renderList(filterText){
    if (!_mount) return;
    const q = (filterText || "").trim().toLowerCase();

    const list = _mount.querySelector('#musicFakeList');
    const count = _mount.querySelector('#musicFakeCount');
    if (!list || !count) return;

    const rows = FAKE_BANDS.filter(b => {
      if (!q) return true;
      return (b.name.toLowerCase().includes(q) ||
              b.region.toLowerCase().includes(q) ||
              b.year.toLowerCase().includes(q));
    });

    count.textContent = `${rows.length} result${rows.length === 1 ? "" : "s"}`;

    list.innerHTML = rows.map(b => `
      <button class="hudIntroText" type="button" style="margin:6px; display:inline-flex; align-items:center; gap:10px;">
        <span style="opacity:.92; letter-spacing:.12em;">${escapeHtml(b.name)}</span>
        <span style="opacity:.65; font-size:12px; letter-spacing:.10em;">${escapeHtml(b.region)} • ${escapeHtml(b.year)}</span>
      </button>
    `).join("");

    // Clicking a fake item shows a fake “detail” area (still inside mount)
    list.querySelectorAll('button').forEach((btn, i) => {
      btn.addEventListener('click', () => {
        const detail = _mount.querySelector('#musicFakeDetail');
        if (!detail) return;
        const band = rows[i];
        if (!band) return;
        detail.innerHTML = `
          <div style="margin-top:10px; padding:10px; border:1px solid rgba(255,60,60,.22); border-radius:14px; background:rgba(0,0,0,.10);">
            <div style="font-weight:800; letter-spacing:.12em; margin-bottom:6px;">${escapeHtml(band.name)}</div>
            <div style="opacity:.72; font-size:12px; letter-spacing:.10em;">
              Fake detail panel. Later this is where albums/photos would render from SmugMug.
            </div>
          </div>
        `;
      }, { once: true });
    });
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  function render(mountEl){
    if (!mountEl) return;
    _mount = mountEl;

    // Make the frame visible so #hudMainMount is actually on-screen for route-music
    ensureFrameVisibleForMusic();

    // IMPORTANT: Keep HUD look intact. This UI lives INSIDE the existing frame/mount only.
    _mount.innerHTML = `
      <div id="musicView" style="display:grid; gap:10px;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <div style="font-weight:900; letter-spacing:.14em; text-transform:uppercase;">Music Archive (Test)</div>
          <div style="opacity:.70; font-size:12px; letter-spacing:.10em;" id="musicFakeCount"></div>
        </div>

        <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
          <input id="musicFakeSearch"
                 type="search"
                 placeholder="Type to filter (fake data)…"
                 style="
                   width:min(520px, 100%);
                   padding:10px 12px;
                   border-radius:14px;
                   border:1px solid rgba(255,60,60,.22);
                   background:rgba(0,0,0,.12);
                   color:inherit;
                   outline:none;
                   font-family:inherit;
                   letter-spacing:.08em;
                 "/>
        </div>

        <div id="musicFakeList" style="display:flex; flex-wrap:wrap; justify-content:center;"></div>
        <div id="musicFakeDetail"></div>

        <div style="opacity:.60; font-size:12px; letter-spacing:.10em; text-align:center;">
          This is a fake UI injected by <code>music-archive.js</code>. Next step is swapping fake data for SmugMug API results.
        </div>
      </div>
    `;

    const input = _mount.querySelector('#musicFakeSearch');
    _onInput = () => renderList(input ? input.value : "");
    if (input) input.addEventListener('input', _onInput);

    renderList("");
  }

  function onEnter(){
    // no-op for now (render() already sets it up)
  }

  function destroy(){
    if (_mount){
      const input = _mount.querySelector('#musicFakeSearch');
      if (input && _onInput) input.removeEventListener('input', _onInput);
      _onInput = null;

      // Clear mount (optional); HUD will re-render new route anyway
      _mount.innerHTML = "";
      _mount = null;
    }

    // Restore original frame visibility behavior
    restoreFrameVisibility();
  }

  window.MusicArchive = { render, onEnter, destroy };
})();
