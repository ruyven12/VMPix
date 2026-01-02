// music-archive-shows.js
(function () {
  'use strict';

  // Optional: inject shows-only CSS once
  function ensureShowsStyles() {
    if (document.getElementById('musicShowsStyles')) return;
    const s = document.createElement('style');
    s.id = 'musicShowsStyles';
    s.textContent = `
      /* Shows-only styles live here */
      .showsWrap{
        width:100%;
        max-width:980px;
        margin:0 auto;
      }
      .showsTitle{
        opacity:.9;
        font-size:14px;
        letter-spacing:.10em;
        text-transform:uppercase;
        margin-bottom:14px;
      }
      .showsNote{
        opacity:.75;
        font-size:13px;
        line-height:1.6;
        letter-spacing:.03em;
        text-transform:none;
      }
    `;
    document.head.appendChild(s);
  }

  function render() {
    ensureShowsStyles();

    // Return ONLY the HTML that belongs inside #musicContentPanel
    return `
      <div class="showsWrap">
        <div class="showsTitle">Shows</div>
        <div class="showsNote">
          (Shows module is now split into its own file.)<br><br>
          Next step: drop in your year table + poster hover system here.
        </div>
      </div>
    `;
  }

  // Optional: hook after content is placed into #musicContentPanel
  function onMount(panelEl) {
    // Example: attach listeners inside panelEl if/when you add interactive stuff
    // const btn = panelEl.querySelector('....');
    // if (btn) btn.addEventListener('click', ...);
  }

  window.MusicArchiveShows = { render, onMount };
})();
