// music-archive-bands.js
(function () {
  'use strict';

  // Optional: inject bands-only CSS once
  function ensureBandsStyles() {
    if (document.getElementById('musicBandsStyles')) return;
    const s = document.createElement('style');
    s.id = 'musicBandsStyles';
    s.textContent = `
      /* Bands-only styles live here */
      .bandsWrap{
        width:100%;
        max-width:980px;
        margin:0 auto;
      }
      .bandsTitle{
        opacity:.9;
        font-size:14px;
        letter-spacing:.10em;
        text-transform:uppercase;
        margin-bottom:14px;
      }
      .bandsNote{
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
    ensureBandsStyles();

    // Return ONLY the HTML that belongs inside #musicContentPanel
    return `
      <div class="bandsWrap">
        <div class="bandsTitle">Bands</div>
        <div class="bandsNote">
          (Bands module is now split into its own file.)<br><br>
          Next step: drop in your Local/Regional/National grouping + logo grid here.
        </div>
      </div>
    `;
  }

  // Optional: hook after content is placed into #musicContentPanel
  function onMount(panelEl) {
    // Attach listeners inside panelEl if/when you add interactive stuff
    // const something = panelEl.querySelector('....');
    // if (something) something.addEventListener('click', ...);
  }

  window.MusicArchiveBands = { render, onMount };
})();
