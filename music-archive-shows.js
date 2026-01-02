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

      /* Years pills + overflow dropdown (scoped, non-destructive)
         NOTE: If you already have pill styles/classes in your main CSS,
               keep them! We intentionally do NOT style .yearPill here.
               We only style the overflow menu container.
      */
      .yearsNav{
        display:flex;
        align-items:center;
        gap:10px;
        flex-wrap:wrap; /* keep your current multi-row behavior */
        margin: 6px 0 14px;
      }
      .yearsNav .yearsPills{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        align-items:center;
      }
      .yearsNav .yearsMore{
        position:relative;
        display:inline-block;
      }
      .yearsNav .yearsMenu{
        position:absolute;
        z-index:9999;
        top:calc(100% + 8px);
        right:0;
        min-width:180px;
        max-height:260px;
        overflow:auto;
        padding:8px;
        border-radius:12px;
        background:rgba(20,20,20,.98);
        border:1px solid rgba(255,255,255,.12);
        box-shadow:0 12px 36px rgba(0,0,0,.55);
        display:none;
      }
      .yearsNav .yearsMenu.isOpen{ display:block; }
      .yearsNav .yearsMenu .menuItem{
        display:block;
        width:100%;
        text-align:left;
        padding:10px 12px;
        border-radius:10px;
        background:transparent;
        border:0;
        color:inherit;
        cursor:pointer;
        opacity:.92;
      }
      .yearsNav .yearsMenu .menuItem:hover{
        background:rgba(255,255,255,.08);
        opacity:1;
      }
    `;
    document.head.appendChild(s);
  }

  /**
   * Mounts a "pills + More ▾ overflow" year selector into containerEl.
   * Non-destructive: you decide where it mounts. It does NOT touch other UI.
   *
   * You can map this to your existing pill classes by changing:
   *   pillClass / pillActiveClass
   */
  function mountYearsPillsOverflow({
    containerEl,
    years,              // array like [2026, 2025, ...]
    activeYear,         // number
    maxVisible = 8,     // how many pills before overflow
    onSelectYear,       // function(year) {}
    pillClass = 'yearPill',       // TODO: set to your existing pill class
    pillActiveClass = 'isActive', // TODO: set to your existing active class
    moreLabel = 'More ▾'
  }) {
    if (!containerEl) return;

    const sorted = [...years].map(Number).filter(Boolean).sort((a, b) => b - a);

    // Split into visible + overflow
    const visible = [];
    const overflow = [];
    for (const y of sorted) {
      if (visible.length < maxVisible) visible.push(y);
      else overflow.push(y);
    }

    // Ensure activeYear doesn't "disappear" into overflow
    if (overflow.includes(activeYear)) {
      const lastVisible = visible[visible.length - 1];
      visible[visible.length - 1] = activeYear;
      overflow.splice(overflow.indexOf(activeYear), 1);
      overflow.push(lastVisible);
      overflow.sort((a, b) => b - a);
    }

    containerEl.innerHTML = `
      <div class="yearsNav">
        <div class="yearsPills" role="tablist" aria-label="Select a year">
          ${visible.map(y => `
            <button type="button"
              class="${pillClass} ${y === activeYear ? pillActiveClass : ''}"
              data-year="${y}"
              role="tab"
              aria-selected="${y === activeYear ? 'true' : 'false'}">
              ${y}
            </button>
          `).join('')}
        </div>

        ${overflow.length ? `
          <div class="yearsMore">
            <button type="button"
              class="${pillClass}"
              data-years-more="1"
              aria-haspopup="menu"
              aria-expanded="false">
              ${moreLabel}
            </button>
            <div class="yearsMenu" role="menu" aria-label="More years">
              ${overflow.map(y => `
                <button type="button" class="menuItem" role="menuitem" data-year="${y}">
                  ${y}
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    const yearsNav = containerEl.querySelector('.yearsNav');
    const moreBtn = containerEl.querySelector('[data-years-more="1"]');
    const menu = containerEl.querySelector('.yearsMenu');

    function closeMenu() {
      if (!menu || !moreBtn) return;
      menu.classList.remove('isOpen');
      moreBtn.setAttribute('aria-expanded', 'false');
    }

    function openMenu() {
      if (!menu || !moreBtn) return;
      menu.classList.add('isOpen');
      moreBtn.setAttribute('aria-expanded', 'true');
    }

    // Click handlers (year selection + More toggle)
    containerEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      if (btn.dataset.yearsMore === '1') {
        if (!menu) return;
        const isOpen = menu.classList.contains('isOpen');
        isOpen ? closeMenu() : openMenu();
        return;
      }

      const yearStr = btn.dataset.year;
      if (!yearStr) return;
      const year = Number(yearStr);

      closeMenu();
      if (typeof onSelectYear === 'function') onSelectYear(year);
    });

    // Close menu on outside click + ESC (one-time per mount)
    // We scope "outside" as clicks not inside yearsNav.
    const onDocClick = (e) => {
      if (!menu) return;
      if (!yearsNav || !yearsNav.contains(e.target)) closeMenu();
    };

    const onDocKey = (e) => {
      if (e.key === 'Escape') closeMenu();
    };

    document.addEventListener('click', onDocClick, { capture: true });
    document.addEventListener('keydown', onDocKey);

    // Return a cleanup function in case you remount this module often
    return function cleanup() {
      document.removeEventListener('click', onDocClick, { capture: true });
      document.removeEventListener('keydown', onDocKey);
    };
  }

  function render() {
    ensureShowsStyles();

    // Return ONLY the HTML that belongs inside #musicContentPanel
    return `
      <div class="showsWrap">
        <div class="showsTitle">Shows</div>

        <!-- Year pills mount point (non-destructive) -->
        <div id="showsYearsMount"></div>

        <!-- Your year table / posters will go here next -->
        <div id="showsYearContent" class="showsNote">
          (Shows module is now split into its own file.)<br><br>
          Next step: drop in your year table + poster hover system here.
        </div>
      </div>
    `;
  }

  // Optional: hook after content is placed into #musicContentPanel
  function onMount(panelEl) {
    // ---- CONFIG: wire these into your real data + selection handler ----

    // Example years (add 2026 here when ready)
    const years = [
      2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017,
      2016, 2015, 2014, 2013, 2012, 2011, 2010, 2009
    ];

    // TODO: replace with your real "current selected year"
    let activeYear = 2025;

    // TODO: set these to match your existing pill class names (so we don't restyle)
    const pillClass = 'yearPill';
    const pillActiveClass = 'isActive';

    const mountEl = panelEl.querySelector('#showsYearsMount');
    if (!mountEl) return;

    // Example: what happens when a year is clicked
    function handleSelectYear(year) {
      activeYear = year;

      // 1) Re-render pills so active state updates
      mountYearsPillsOverflow({
        containerEl: mountEl,
        years,
        activeYear,
        maxVisible: 8,
        onSelectYear: handleSelectYear,
        pillClass,
        pillActiveClass,
        moreLabel: 'More ▾'
      });

      // 2) Update content area (placeholder)
      const content = panelEl.querySelector('#showsYearContent');
      if (content) {
        content.innerHTML = `Selected year: <strong>${year}</strong><br><br>
          Next step: render the ${year} show table + poster hover system here.`;
      }

      // 3) Later: call your real year-render function here
      // renderYearTable(year);
    }

    // Initial mount
    mountYearsPillsOverflow({
      containerEl: mountEl,
      years,
      activeYear,
      maxVisible: 8,
      onSelectYear: handleSelectYear,
      pillClass,
      pillActiveClass,
      moreLabel: 'More ▾'
    });
  }

  window.MusicArchiveShows = { render, onMount };
})();
