// wrestling-archive-shows.js
// Wrestling "Shows" module for the HUD shell (wrestling-archive.js)
//
// Exposes:
//   window.WrestlingArchiveShows.render() -> returns HTML string for the Shows view
//   window.WrestlingArchiveShows.onMount(panelEl) -> wires DOM + fetches CSV + renders
//   window.WrestlingArchiveShows.destroy() -> optional cleanup
//
// Based on your existing shows script logic (Render API CSV -> year pills -> show cards).

(function () {
  'use strict';

  // ================== SMALL UTILITIES (USED EARLY) ==================
  // Keep these near the top so they're definitely defined before any handlers run.
  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  // SmugMug base origin (prefer current origin when already on SmugMug)
  const SMUG_ORIGIN = (function () {
    try {
      const o = (window.location && window.location.origin) ? String(window.location.origin) : "";
      if (o && /smugmug\.com$/i.test(o)) return o;
    } catch (_) {}
    return "https://vmpix.smugmug.com";
  })();

  // ================== CONFIG ==================
  // Wrestling should NOT inherit the Music API base.
  // If you need to override for staging/local, set:
  //   window.WRESTLING_ARCHIVE_API_BASE = "https://your-backend.example.com"
  const API_BASE = (function () {
    try {
      const w = window;
      const v = String((w && w.WRESTLING_ARCHIVE_API_BASE) || "").trim();
      if (v) return v.replace(/\/$/, "");
    } catch (_) {}
    return "https://wrestling-archive.onrender.com";
  })();
  const SHOWS_ENDPOINT = `${API_BASE}/sheet/shows`;

  function trackWrestlingShowsEvent(eventName, payload) {
    try {
      if (!window.VMPixAnalytics || typeof window.VMPixAnalytics.track !== "function") return;
      window.VMPixAnalytics.track(eventName, Object.assign({
        source: "wrestling_shows",
        section: "wrestling",
        subsection: "shows"
      }, payload || {}));
    } catch (_) {}
  }

  // ================================
  // SERVER-SLEEP HARDENING (shared pattern)
  // - Warm the backend once per session
  // - Retry/timeout fetches so a cold Render instance doesn't look "broken"
  // ================================

  const _WAKE_KEY = `vm_wake_${String(API_BASE).replace(/[^a-z0-9]/gi, '_')}_v1`;
  const _WAKE_TTL_MS = 1000 * 60 * 10; // 10 minutes
  let _wakePromise = null;

  const _sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function _fetchWithTimeout(url, opts) {
    const timeoutMs = Number(opts && opts.timeoutMs) || 20000;
    const options = Object.assign({}, opts || {});
    delete options.timeoutMs;

    let ac = null;
    let t = null;
    try {
      if (typeof AbortController !== "undefined") {
        ac = new AbortController();
        options.signal = options.signal || ac.signal;
        t = setTimeout(() => {
          try { ac.abort(); } catch (_) {}
        }, timeoutMs);
      }
    } catch (_) {}

    try {
      return await fetch(url, options);
    } finally {
      if (t) clearTimeout(t);
    }
  }

  async function _wakeBackendOnce() {
    try {
      const raw = sessionStorage.getItem(_WAKE_KEY);
      if (raw) {
        const ts = Number(raw);
        if (Number.isFinite(ts) && (Date.now() - ts) < _WAKE_TTL_MS) return;
      }
    } catch (_) {}

    if (_wakePromise) return _wakePromise;

    _wakePromise = (async () => {
      const candidates = [
        `${API_BASE}/sheet/shows`,
        `${API_BASE}/`,
        `${API_BASE}/ping`,
      ];

      for (let i = 0; i < candidates.length; i++) {
        const u = candidates[i];
        try {
          await _fetchWithTimeout(u, { method: "GET", cache: "no-store", timeoutMs: 6000 });
          break;
        } catch (_) {
          await _sleep(250);
        }
      }
      try { sessionStorage.setItem(_WAKE_KEY, String(Date.now())); } catch (_) {}
    })().finally(() => {
      _wakePromise = null;
    });

    return _wakePromise;
  }

  async function _fetchWithRetry(url, opts) {
    const attempts = Math.max(1, Number(opts && opts.attempts) || 3);
    const timeoutMs = Number(opts && opts.timeoutMs) || 25000;
    const baseDelayMs = Number(opts && opts.baseDelayMs) || 700;
    const options = Object.assign({}, opts && opts.fetchOptions ? opts.fetchOptions : {});

    try { _wakeBackendOnce(); } catch (_) {}

    let lastErr = null;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await _fetchWithTimeout(url, Object.assign({}, options, { timeoutMs }));
        if (res && (res.status === 502 || res.status === 503 || res.status === 504)) {
          lastErr = new Error(`HTTP ${res.status}`);
        } else {
          return res;
        }
      } catch (e) {
        lastErr = e;
      }
      if (i < attempts - 1) {
        const backoff = baseDelayMs * Math.pow(1.6, i);
        await _sleep(Math.min(3500, backoff));
      }
    }
    throw lastErr || new Error("fetch failed");
  }

  // Only show 2021–2026 (your current behavior)
  const MIN_YEAR = 2021;
  const MAX_YEAR = 2026;

  // ================== STATE ==================
  let SHOWS = [];
  let YEARS = [];
  let _waActiveYear = null;
  let _waYearSelectHandler = null;

  // Mounted DOM + handlers
  let _panel = null;
  let _mountToken = 0;
  let _root = null;

  // ================== RENDER (HTML SKELETON) ==================
  function render() {
    // This HTML gets inserted inside #wrestlingContentPanel by wrestling-archive.js
    // Keep IDs unique to this module to avoid collisions.
    return `
      <div id="waShowsRoot" style="width:100%; max-width:1200px; margin:0 auto;">
        <div class="wa-results-head" style="text-align:center; padding:2px 4px 10px;">
          <div id="waBootPanel" class="vmpixBootPanel" role="status" aria-live="polite" style="margin-top:8px;">
            <div class="vmpixBootRow">
              <div class="vmpixSpinner" aria-hidden="true"></div>
              <div class="vmpixBootText">
                <div class="vmpixBootTitle">Waking the archive…</div>
                <div class="vmpixBootSub">If this is the first visit, the server may need a moment to wake.</div>
              </div>
            </div>
            <div class="vmpixShimmer" aria-hidden="true"></div>
          </div>

          <div class="waShowsIntro" aria-label="Wrestling Shows Introduction">
            <div class="waShowsIntroDivider" aria-hidden="true"></div>
            <div class="waShowsIntroTitle">The Archives - Filter By Show</div>
            <div class="waShowsIntroBody">Welcome to the Archives, sorted by show. This section is split by year and lets you drill into individual event cards, match and segment breakdowns, and photo sets that are tied to each event. More data and archive depth will be added here over time.</div>
            <div class="waShowsIntroDivider" aria-hidden="true"></div>
          </div>

          <div id="waCrumbs"
               style="font-size:15px; opacity:.85; text-align:center; margin-top:6px;"></div>

          <div id="waYearGroups"
               style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:12px;">
            <!-- year pills -->
          </div>
        </div>

        <div id="waResults"
             style="display:block; width:100%; max-width:1200px; margin:0 auto;">
          <!-- cards -->
        </div>
      </div>
    `;
  }

  function parseWAShowDateValue(raw) {
    const str = String(raw || "").trim();
    if (!str) return null;

    let year = 0;
    let month = 0;
    let day = 0;

    let m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (m) {
      month = Number(m[1]);
      day = Number(m[2]);
      year = Number(m[3].length === 2 ? ("20" + m[3]) : m[3]);
    } else {
      m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return null;
      year = Number(m[1]);
      month = Number(m[2]);
      day = Number(m[3]);
    }

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    const dt = new Date(year, month - 1, day);
    if (Number.isNaN(dt.getTime())) return null;
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  function isWAUpcomingSelection(value) {
    return String(value || "").trim().toLowerCase() === "upcoming";
  }

  function getWAUpcomingShows(allShows) {
    if (!Array.isArray(allShows) || !allShows.length) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allShows
      .filter((row) => {
        const dt = parseWAShowDateValue(row && (row.show_date || row.date || ""));
        return !!(dt && dt.getTime() >= today.getTime());
      })
      .sort((a, b) => {
        const at = parseWAShowDateValue(a && (a.show_date || a.date || ""));
        const bt = parseWAShowDateValue(b && (b.show_date || b.date || ""));
        return (at ? at.getTime() : 0) - (bt ? bt.getTime() : 0);
      });
  }

  function mountWAYearsPillsOverflow(opts) {
    const containerEl = opts && opts.containerEl;
    if (!containerEl) return;

    const years = Array.isArray(opts && opts.years) ? opts.years.slice() : [];
    const activeYear = opts ? opts.activeYear : null;
    const onSelectYear = opts && opts.onSelectYear;
    const maxVisible = Number(opts && opts.maxVisible) || 6;

    const upcoming = [];
    const numericYears = [];
    years.forEach((value) => {
      if (isWAUpcomingSelection(value)) {
        upcoming.push("Upcoming");
        return;
      }
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) numericYears.push(n);
    });

    const sorted = [...upcoming, ...numericYears.sort((a, b) => b - a)];
    const visible = [];
    const overflow = [];
    sorted.forEach((y) => {
      if (visible.length < maxVisible) visible.push(y);
      else overflow.push(y);
    });

    if (overflow.includes(activeYear) && visible.length) {
      const lastVisible = visible[visible.length - 1];
      visible[visible.length - 1] = activeYear;
      overflow.splice(overflow.indexOf(activeYear), 1);
      overflow.push(lastVisible);
      overflow.sort((a, b) => {
        if (isWAUpcomingSelection(a)) return -1;
        if (isWAUpcomingSelection(b)) return 1;
        return Number(b) - Number(a);
      });
    }

    containerEl.innerHTML = `
      <div class="yearsNav">
        <div class="yearsPills" role="tablist" aria-label="Select a year">
          ${visible.map((y) => `
            <button type="button"
              class="YearPill ${y === activeYear ? "YearPillActive" : ""}"
              data-year="${y}"
              role="tab"
              aria-selected="${y === activeYear ? "true" : "false"}">${y}</button>
          `).join("")}
        </div>
        ${overflow.length ? `
          <div class="yearsMore">
            <button type="button" class="YearPill" data-years-more="1" aria-haspopup="menu" aria-expanded="false">More ▾</button>
            <div class="yearsMenu" role="menu" aria-label="More years">
              ${overflow.map((y) => `<button type="button" class="menuItem" role="menuitem" data-year="${y}">${y}</button>`).join("")}
            </div>
          </div>
        ` : ""}
      </div>
    `;

    const yearsNav = containerEl.querySelector(".yearsNav");
    const moreBtn = containerEl.querySelector('[data-years-more="1"]');
    const menu = containerEl.querySelector(".yearsMenu");

    function closeMenu() {
      if (!menu || !moreBtn) return;
      menu.classList.remove("isOpen");
      moreBtn.setAttribute("aria-expanded", "false");
    }

    if (containerEl._yearsClickHandler) {
      containerEl.removeEventListener("click", containerEl._yearsClickHandler);
    }

    containerEl._yearsClickHandler = (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      if (btn.dataset.yearsMore === "1") {
        if (!menu) return;
        const isOpen = menu.classList.contains("isOpen");
        menu.classList.toggle("isOpen", !isOpen);
        btn.setAttribute("aria-expanded", !isOpen ? "true" : "false");
        return;
      }

      const yearStr = btn.dataset.year;
      if (!yearStr) return;
      const year = isWAUpcomingSelection(yearStr) ? "Upcoming" : Number(yearStr);
      closeMenu();
      if (typeof onSelectYear === "function") onSelectYear(year);
    };

    containerEl.addEventListener("click", containerEl._yearsClickHandler);

    const onDocClick = (e) => {
      if (!menu) return;
      if (!yearsNav || !yearsNav.contains(e.target)) closeMenu();
    };
    const onDocKey = (e) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("click", onDocClick, { capture: true });
    document.addEventListener("keydown", onDocKey);

    return function cleanup() {
      document.removeEventListener("click", onDocClick, { capture: true });
      document.removeEventListener("keydown", onDocKey);
    };
  }

  function refreshWAYearsNav(activeYear, onSelectYear) {
    const rowEl = getYearGroupsEl();
    if (!rowEl) return;
    const selectHandler = onSelectYear || _waYearSelectHandler;
    const filtered = (YEARS || []).filter((y) => y >= MIN_YEAR && y <= MAX_YEAR).sort((a, b) => b - a);
    const yearOptions = getWAUpcomingShows(SHOWS).length ? ['Upcoming', ...filtered] : filtered.slice();
    if (rowEl._yearsCleanup) {
      try { rowEl._yearsCleanup(); } catch (_) {}
      rowEl._yearsCleanup = null;
    }
    rowEl._yearsCleanup = mountWAYearsPillsOverflow({
      containerEl: rowEl,
      years: yearOptions,
      activeYear: activeYear,
      maxVisible: 6,
      onSelectYear: selectHandler
    });
  }

  // ================== MOUNT ==================
  async function onMount(panelEl) {
    ensureShowsStyles();
    _panel = panelEl || document.getElementById("wrestlingContentPanel") || document.body;

    // Guard: ignore stale mounts when Shows isn't the active panel
    const _mode = (_panel && _panel.dataset) ? _panel.dataset.mode : null;
    if (_mode && _mode !== 'shows') return;

    const _myMountToken = ++_mountToken;

    _root = _panel.querySelector("#waShowsRoot");

    if (!_root) {
      // If someone calls onMount without render() having run, create the skeleton anyway.
      if ((_panel && _panel.dataset && _panel.dataset.mode) && _panel.dataset.mode !== 'shows') return;
      if (_myMountToken !== _mountToken) return;
      _panel.innerHTML = render();
      _root = _panel.querySelector("#waShowsRoot");
    }

    // Start waking the backend ASAP (Render cold start)
    try { _wakeBackendOnce(); } catch (_) {}

    // Load shows CSV → build year bubbles from real data
    SHOWS = await loadShowsFromCsv();
    if (_myMountToken !== _mountToken) return;
    if ((_panel && _panel.dataset && _panel.dataset.mode) && _panel.dataset.mode !== 'shows') return;
    YEARS = extractYearsFromShows(SHOWS);

    // Hide the boot panel once we have real data.
    if (_myMountToken !== _mountToken) return;
    try {
      const bp = _panel ? _panel.querySelector("#waBootPanel") : null;
      if (bp && bp.parentNode) bp.parentNode.removeChild(bp);
    } catch (_) {}


    const filtered = YEARS
      .filter((y) => y >= MIN_YEAR && y <= MAX_YEAR)
      .sort((a, b) => b - a);

    const yearOptions = getWAUpcomingShows(SHOWS).length ? ['Upcoming', ...filtered] : filtered.slice();

    function handleSelectYear(year) {
      _waActiveYear = year;
      _waYearSelectHandler = handleSelectYear;
      try { refreshWAYearsNav(_waActiveYear, handleSelectYear); } catch (_) {}

      if (isWAUpcomingSelection(year)) setCrumbs('Upcoming');
      else setCrumbs(`Shows for ${year}`);
      renderShowsCards(getShowsForYear(year), year);
      resetPanelScroll();
    }

    if (yearOptions.length) handleSelectYear(yearOptions[0]);

    const detailSlug = getShowDetailSlugFromPath();
    const matchDetailSlug = getMatchDetailSlugFromPath();
    if (detailSlug) {
      const detailRow = findShowByDateSlug(detailSlug);
      const detailYear = detailRow ? yearFromDateString((detailRow.show_date || detailRow.date || "").trim()) : null;
      if (detailRow && detailYear != null) {
        LAST_LIST_CTX = { year: (detailYear != null ? Number(detailYear) : null) };
        if (matchDetailSlug) {
          handleSelectYear(detailYear);
          const matchAlbum = getWAMatchAlbumFromRow(detailRow, matchDetailSlug);
          if (matchAlbum && matchAlbum.url) {
            openMatchAlbumInPanel(matchAlbum.url, matchAlbum.title, matchAlbum.slug, detailRow, { syncUrl: false });
            resetPanelScroll();
            return;
          }
        }
        handleSelectYear(detailYear);
        setCrumbs(`Shows for ${detailYear}`);
        showShowDetail(detailRow, detailYear, { syncUrl: false });
        resetPanelScroll();
        return;
      }
    }
  }

  // ================== CLEANUP (OPTIONAL) ==================
  function destroy() {
    // If you add timers/listeners later, clear them here.
    // Right now everything is attached to elements that get wiped out by the parent,
    // so this can remain minimal.
    SHOWS = [];
    YEARS = [];
    _panel = null;
    _root = null;
  }

  // ================== HELPERS (DOM) ==================
  function getCrumbsEl() {
    return _panel ? _panel.querySelector("#waCrumbs") : null;
  }

  function setCrumbs(text) {
    const crumbs = getCrumbsEl();
    if (!crumbs) return;
    crumbs.textContent = text;
  }

  function getYearGroupsEl() {
    return _panel ? _panel.querySelector("#waYearGroups") : null;
  }

  function getResultsEl() {
    return _panel ? _panel.querySelector("#waResults") : null;
  }

  function clearResults() {
    const resultsEl = getResultsEl();
    if (!resultsEl) return;
    resultsEl.innerHTML = "";
    resultsEl.style.display = "block";
  }

  // ================== YEAR PILLS (SHOWS LIST NAV) ==================
  // Keep this helper defined near the top so it's available when onMount()
  // runs in all webviews (prevents "renderYearBubbles is not defined" crashes).
  function renderYearBubbles(years) {
    const row = getYearGroupsEl();
    if (!row) return;

    row.innerHTML = "";

    const ys = Array.isArray(years) ? years : [];
    if (!ys.length) {
      const msg = document.createElement("div");
      msg.textContent = "No years found in the shows sheet.";
      msg.style.opacity = "0.7";
      msg.style.fontSize = "13px";
      msg.style.textAlign = "center";
      msg.style.width = "100%";
      row.appendChild(msg);
      return;
    }

    ys.forEach((year) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "letter-pill";
      btn.textContent = String(year);

      btn.addEventListener("click", function (e) {
        try { e.preventDefault(); } catch (_) {}
        try { e.stopPropagation(); } catch (_) {}

        // Active state
        try {
          const btns = Array.prototype.slice.call(row.querySelectorAll(".letter-pill"));
          btns.forEach((b) => b.classList.toggle("active", b === btn));
        } catch (_) {}

        setCrumbs("Shows for " + String(year));
        renderShowsCards(getShowsForYear(year), year);
        resetPanelScroll();
      });

      row.appendChild(btn);
    });
  }


  
  // ================== CINEMATIC TRANSITION (NEON SHUTTER WIPE) ==================
  // Surgical: only used inside this module when swapping major views (list <-> show <-> match album).
  // Uses a lightweight overlay appended to the module panel (not full screen). No routing changes.
  let _waShutterEl = null;
  let _waShutterBusy = false;

  function ensureWAShutterOverlay(containerEl) {
    if (_waShutterEl) return _waShutterEl;

    // Scope the shutter to the module panel (NOT full screen).
    // This keeps the cinematic wipe inside the wrestling content area only.
    const host =
      containerEl ||
      _panel ||
      document.getElementById("wrestlingContentPanel") ||
      document.getElementById("waShowsRoot") ||
      document.body;

    try {
      // Ensure the host can anchor an absolutely-positioned overlay.
      try {
        const cs = window.getComputedStyle ? window.getComputedStyle(host) : null;
        if (cs && cs.position === "static") host.style.position = "relative";
      } catch (_) {}

      const el = document.createElement("div");
      el.id = "waNeonShutter";
      el.setAttribute("aria-hidden", "true");
      el.innerHTML = '<div class="waNeonCurtain"></div><div class="waNeonEdge"></div>';

      host.appendChild(el);
      _waShutterEl = el;
    } catch (_) {
      _waShutterEl = null;
    }
    return _waShutterEl;
  }

  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (_) {
      return false;
    }
  }

  function runNeonShutterTransition(doSwap) {
    // doSwap: function that performs the DOM swap
    try {
      if (typeof doSwap !== "function") return Promise.resolve();
      if (prefersReducedMotion()) { doSwap(); return Promise.resolve(); }
      if (_waShutterBusy) { doSwap(); return Promise.resolve(); }
    } catch (_) {
      try { doSwap(); } catch (_) {}
      return Promise.resolve();
    }

    const el = ensureWAShutterOverlay(_panel);
    if (!el) {
      try { doSwap(); } catch (_) {}
      return Promise.resolve();
    }

    _waShutterBusy = true;

    return new Promise((resolve) => {
      let swapped = false;
      const DURATION = 560; // total ms
      const MIDPOINT = 280; // ms (swap happens when curtain is fully closed)

      // Ensure starting state is clean
      try { el.classList.remove("active"); } catch (_) {}
      try { el.style.display = "block"; } catch (_) {}

      // Kick animation on next frame
      requestAnimationFrame(() => {
        try { el.classList.add("active"); } catch (_) {}

        // Swap at midpoint
        window.setTimeout(() => {
          if (swapped) return;
          swapped = true;
          try { doSwap(); } catch (_) {}
        }, MIDPOINT);

        // End
        window.setTimeout(() => {
          try { el.classList.remove("active"); } catch (_) {}
          try { el.style.display = "none"; } catch (_) {}
          _waShutterBusy = false;
          resolve();
        }, DURATION);
      });
    });
  }


// ================== PANEL SCROLL HELPERS ==================
  function resetPanelScroll() {
    try {
      const panel = _panel || document.getElementById("wrestlingContentPanel");
      const docScroller = document.scrollingElement || document.documentElement;
      if (panel) panel.scrollTop = 0;
      if (panel && panel.parentElement) panel.parentElement.scrollTop = 0;
      if (docScroller) docScroller.scrollTop = 0;
      requestAnimationFrame(() => {
        if (panel) panel.scrollTop = 0;
        if (panel && panel.parentElement) panel.parentElement.scrollTop = 0;
      });
    } catch (_) {}
  }

  // Remember last list context so "Back" restores the same year view cleanly.
  let LAST_LIST_CTX = { year: null };

  // ================== STYLES (SCOPED TO THIS MODULE) ==================
  function ensureShowsStyles() {
    if (document.getElementById("waShowsStyles")) return;
    const s = document.createElement("style");
    s.id = "waShowsStyles";
    s.textContent = `

      /* ===== Shared boot/loading panel ===== */
      .vmpixBootPanel{
        width:100%;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:10px;
        padding: 18px 12px 10px;
        box-sizing:border-box;
        border-radius: 14px;
        background: rgba(0,0,0,0.20);
        border: 1px solid rgba(255,255,255,0.08);
        box-shadow: 0 0 0 1px rgba(0,0,0,0.30) inset;
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
      }
      .vmpixBootRow{
        display:flex;
        align-items:center;
        justify-content:center;
        gap:10px;
        width:100%;
      }
      .vmpixSpinner{
        width:18px; height:18px;
        border-radius:999px;
        border: 2px solid rgba(226,232,240,0.25);
        border-top-color: rgba(226,232,240,0.85);
        animation: vmpixSpin 900ms linear infinite;
        flex: 0 0 auto;
      }
      @keyframes vmpixSpin{ to{ transform: rotate(360deg); } }
      .vmpixBootText{
        text-align:center;
        line-height:1.2;
      }
      .vmpixBootTitle{
        font-size:12px;
        letter-spacing:.14em;
        text-transform:uppercase;
        opacity:.90;
      }
      .vmpixBootSub{
        margin-top:4px;
        font-size:12px;
        opacity:.75;
        letter-spacing:.02em;
      }
      .vmpixShimmer{
        width:min(520px, 92%);
        height:10px;
        border-radius:999px;
        overflow:hidden;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.06);
      }
      .vmpixShimmer:before{
        content:"";
        display:block;
        width:60%;
        height:100%;
        transform: translateX(-80%);
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
        animation: vmpixShimmer 1200ms ease-in-out infinite;
      }
      @keyframes vmpixShimmer{
        0%{ transform: translateX(-80%); }
        100%{ transform: translateX(180%); }
      }

      .waShowsIntro{
        width:100%;
        max-width:980px;
        margin: 12px auto 18px;
        text-align:center;
      }
      .waShowsIntroTitle{
        font-family:"Orbitron", system-ui, sans-serif !important;
        font-size:24px;
        font-weight:900;
        letter-spacing:.12em;
        text-transform:none !important;
        color:rgba(236,241,250,0.95);
        margin-bottom:12px;
      }
      .waShowsIntroDivider{
        position:relative;
        display:block;
        height:2px;
        width:min(100%, 960px);
        margin: 0 auto 14px;
        border-radius:999px;
        background:linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,84,120,0.18) 10%, rgba(255,84,120,0.62) 50%, rgba(255,84,120,0.18) 90%, rgba(255,255,255,0) 100%);
        box-shadow:0 0 10px rgba(255,84,120,0.26), 0 0 18px rgba(255,84,120,0.16);
        overflow:hidden;
      }
      .waShowsIntroDivider::after{
        content:"";
        position:absolute;
        inset:0;
        border-radius:inherit;
        background:linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,220,228,0.40) 50%, rgba(255,255,255,0) 100%);
        opacity:.9;
        filter: blur(.2px);
      }
      .waShowsIntroBody{
        max-width:920px;
        margin:0 auto 16px;
        font-size:13px;
        font-weight:700;
        letter-spacing:.04em;
        line-height:1.25;
        color:rgba(212,223,242,0.78);
        text-transform:none !important;
      }
      @media (max-width: 760px){
        .waShowsIntro{
          margin: 10px auto 14px;
          padding: 0 6px;
        }
        .waShowsIntroDivider{
          margin: 0 auto 10px;
        }
        .waShowsIntroTitle{
          font-size:20px;
          letter-spacing:.08em;
        }
        .waShowsIntroBody{
          margin:0 auto 12px;
          font-size:12px;
          line-height:1.3;
        }
      }
      @media (max-width: 520px){
        .waShowsIntroTitle{
          font-size:16px;
          letter-spacing:.05em;
        }
        .waShowsIntroBody{
          margin:0 auto 10px;
          font-size:11px;
        }
      }


/* ===== Neon shutter wipe (module transition) ===== */
#waNeonShutter{
  position: absolute;
  inset: 0;
  z-index: 999997;
  pointer-events: none;
  border-radius: inherit;
  overflow: hidden;
  display: none;
}
#waNeonShutter .waNeonCurtain{
  position:absolute;
  inset: 0;
  background:
    radial-gradient(120% 160% at 0% 0%, rgba(200,0,0,0.18) 0%, rgba(0,0,0,0.70) 55%, rgba(0,0,0,0.78) 100%);
  transform: scaleX(0);
  opacity: 0;
  will-change: transform, opacity;
}
#waNeonShutter .waNeonEdge{
  position:absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 24px;
  opacity: 0;
  background: linear-gradient(90deg, rgba(255,60,60,0.0) 0%, rgba(255,60,60,0.55) 55%, rgba(255,255,255,0.22) 100%);
  filter: blur(0.2px);
  will-change: transform, opacity;
}
#waNeonShutter.active .waNeonCurtain{
  animation: waNeonShutterCurtain 560ms cubic-bezier(.2,.9,.2,1) forwards;
}
#waNeonShutter.active .waNeonEdge{
  animation: waNeonShutterEdge 560ms cubic-bezier(.2,.9,.2,1) forwards;
}

@keyframes waNeonShutterCurtain{
  0%   { transform: scaleX(0); transform-origin: 0% 50%; opacity: 0; }
  10%  { opacity: 1; }
  50%  { transform: scaleX(1); transform-origin: 0% 50%; opacity: 1; }
  60%  { transform: scaleX(1); transform-origin: 100% 50%; opacity: 1; }
  100% { transform: scaleX(0); transform-origin: 100% 50%; opacity: 0; }
}
@keyframes waNeonShutterEdge{
  0%   { transform: translateX(-24px); opacity: 0; }
  18%  { opacity: .85; }
  50%  { transform: translateX(calc(100% - 24px)); opacity: .95; }
  60%  { transform: translateX(calc(100% - 24px)); opacity: .85; }
  100% { transform: translateX(100%); opacity: 0; }
}


/* === SURGICAL: hide ZIP / select UI in album photo view (keep code intact) === */
/* Keep the Buy Photos link visible (it's an <a>), but hide the select/zip buttons + hint/status. */
#waShowsRoot .waSelectBar button.waSelectBtn,
#waShowsRoot .waSelectBar .waSelectHint,
#waShowsRoot .waSelectStatus{
  display: none !important;
}


/* ===== Album keyword chips (People in this album) ===== */
#waShowsRoot .waAlbumKeywordBox{
  width:100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: 10px 10px 0;
  text-align:center;
}
#waShowsRoot .waAlbumKeywordTitle{
  font-family: "Orbitron", system-ui, sans-serif !important;
  letter-spacing: .10em;
  font-size: 12px;
  opacity:.92;
  margin-bottom: 6px;
}
#waShowsRoot .waAlbumKeywordChips{
  display:flex;
  flex-wrap:wrap;
  gap: 8px;
  justify-content:center;
}
#waShowsRoot .waAlbumKeywordChip{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(0,0,0,0.18);
  font-size: 11px;
  letter-spacing: .08em;
  opacity:.92;
  cursor: pointer;
  user-select: none;
}
#waShowsRoot .waAlbumKeywordChip:hover{
  border-color: rgba(200,0,0,0.55);
  background: rgba(0,0,0,0.26);
}
#waShowsRoot .waAlbumKeywordChip:focus-visible{
  outline: 2px solid rgba(200,0,0,0.55);
  outline-offset: 2px;
}
#waShowsRoot .waAlbumKeywordEmpty{
  font-size: 12px;
  opacity:.65;
  letter-spacing:.08em;
  padding: 6px 0 2px;
}

      /* Scoped: Wrestling Shows detail view */
      #waShowsRoot, #waShowsRoot * { text-transform: none !important; }

      #waYearGroups{
        display:flex;
        padding: 10px 10px;
        margin: 10px auto 8px;
        backdrop-filter: blur(6px);
        background: rgba(0,0,0,0.18);
        border-bottom: 1px solid rgba(255,255,255,0.06);
        flex-wrap:wrap;
        gap: 12px;
        justify-content:center;
        align-items:center;
      }
      .yearsNav{
        display:flex;
        align-items:center;
        justify-content:center;
        gap: 10px;
        width:100%;
      }
      .yearsPills{
        display:flex;
        flex-wrap:wrap;
        gap: 12px;
        justify-content:center;
        align-items:center;
      }
      .yearsMore{ position:relative; }
      .yearsMenu{
        display:none;
        position:absolute;
        top: calc(100% + 8px);
        right: 0;
        z-index: 60;
        min-width: 170px;
        background: rgba(15,23,42,0.98);
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 12px;
        padding: 6px;
        box-shadow: 0 10px 22px rgba(0,0,0,0.35);
      }
      .yearsMenu.isOpen{ display:block; }
      .yearsMenu .menuItem{
        width:100%;
        text-align:left;
        cursor:pointer;
        padding: 8px 10px;
        border-radius: 10px;
        border:0;
        background: transparent;
        color: rgba(255,255,255,0.86);
        font-size: 12px;
        font-family: "Orbitron", system-ui, sans-serif;
      }
      .yearsMenu .menuItem:hover{ background: rgba(255,255,255,0.08); }
      .YearPill{
        cursor:pointer;
        appearance:none;
        border: 0;
        background: transparent;
        padding: 10px 8px;
        border-radius: 10px;
        color: rgba(255,255,255,0.58);
        font-family: 'Orbitron', system-ui, sans-serif;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.06em;
        user-select:none;
        line-height:1;
        position: relative;
        transition: color .12s ease, transform .08s ease, background .12s ease;
      }
      .YearPill:hover{
        color: rgba(255,255,255,0.82);
        background: rgba(255,255,255,0.04);
        transform: translateY(-1px);
      }
      .YearPill:focus-visible{
        outline: 2px solid rgba(236,72,153,0.55);
        outline-offset: 2px;
      }
      .YearPill::after{
        content:"";
        position:absolute;
        left: 8px;
        right: 8px;
        bottom: 4px;
        height: 2px;
        border-radius: 999px;
        background: rgba(236,72,153,0.9);
        box-shadow: 0 0 10px rgba(236,72,153,0.35);
        opacity: 0;
        transform: translateY(3px);
        transition: opacity .12s ease, transform .12s ease;
      }
      .YearPill:hover::after{
        opacity: 0.35;
        transform: translateY(0px);
      }
      .YearPillActive{
        color: rgba(255,255,255,0.92);
      }
      .YearPillActive::after{
        opacity: 1;
        transform: translateY(0);
      }


      .waDetailWrap{
        width:100%;
        max-width:1200px;
        margin: 0 auto;
        display:flex;
        flex-direction:column;
        gap: 16px;
        padding: 6px 8px 14px;
      }
      .waDetailTopbar{
        display:flex;
        justify-content:center;
        margin-top: 2px;
      }
      .waBackBtn{
        font-family: "Orbitron", system-ui, sans-serif !important;
        text-transform: none !important;
        background: transparent !important;
        border: none !important;
        border-bottom: 2px solid rgba(200,0,0,0.30) !important;
        border-radius: 0 !important;
        padding: 6px 2px !important;
        cursor: pointer;
        font-size: 12px;
        letter-spacing: .10em;
        color: rgba(226,232,240,0.92);
        transition: color 160ms ease, border-color 160ms ease, transform 120ms ease;
      }
      .waBackBtn:hover{
        border-bottom-color: rgba(200,0,0,0.90) !important;
        transform: translateX(-2px);
      }
      .waBackBtn:active{ transform: translateX(-1px) translateY(1px); }

      .waDetailHeader{
        width:100%;
        display:grid;
        grid-template-columns: minmax(0, 360px) minmax(0, 1fr);
        gap: 18px;
        align-items:center;
        border-top: 2px solid rgba(200,0,0,0.22);
        border-bottom: 2px solid rgba(200,0,0,0.22);
        padding: 18px 10px;
      }
      @media (max-width: 920px){
        .waDetailHeader{ grid-template-columns: 1fr; justify-items:center; text-align:center; }
      }
      .waDetailPoster{
        width: 320px;
        max-width: 80vw;
        aspect-ratio: 1/1;
        object-fit: cover;
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(0,0,0,0.35);
        box-shadow: 0 18px 40px rgba(0,0,0,0.45);
      }
      .waDetailCard{
        width:100%;
        display:flex;
        flex-direction:column;
        gap: 12px;
      }
      .waDetailNamePill{
        width:100%;
        border-radius: 999px;
        padding: 14px 18px;
        background: radial-gradient(120% 160% at 0% 0%, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.30) 55%, rgba(0,0,0,0.18) 100%);
        border: 1px solid rgba(255,255,255,0.10);
        text-align:center;
      }
      .waDetailNamePill .kicker{
        font-size: 10px;
        letter-spacing: .22em;
        opacity: .65;
        margin-bottom: 6px;
      }
      .waDetailNamePill .name{
        font-size: 22px;
        font-weight: 800;
        letter-spacing: .06em;
      }
      .waInfoRow{
        display:grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      @media (max-width: 920px){
        .waInfoRow{ grid-template-columns: 1fr; }
      }
      .waInfoPill{
        border-radius: 999px;
        padding: 10px 14px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.10);
        display:flex;
        flex-direction:column;
        gap: 4px;
        min-height: 56px;
        justify-content:center;
      
        align-items: center;
        text-align: center;
      }
      .waInfoPill .lbl{
        font-size: 9px;
        letter-spacing:.18em;
        opacity: .55;
      }
      .waInfoPill .val{
        font-size: 13px;
        font-weight: 800;
        opacity: .92;
      }

      .waMatchesTitle{
        font-size: 12px;
        letter-spacing: .18em;
        opacity: .80;
        margin: 2px 0 0;
        text-align:center;
      }
      .waMatchesWrap{
        width:100%;
        max-width: 980px;
        margin: 0 auto;
        display:flex;
        flex-direction:column;
        gap: 10px;
        padding: 4px 0 0;
      }
      .waMatchBox{
        display:flex;
        flex-direction:column;
        padding: 10px 14px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(15, 23, 42, 0.22);
        cursor: pointer;
        transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
      }
      .waMatchBox:hover{
        background: rgba(30, 41, 59, 0.35);
        border-color: rgba(255,255,255,0.14);
        transform: translateY(-1px);
      }
      .waMatchBox:focus-visible{
        outline: 2px solid rgba(200,0,0,0.55);
        outline-offset: 2px;
      }
      .waMatchBox:focus-visible{
        outline: none;
        border-color: rgba(200,0,0,0.55);
        box-shadow: 0 0 0 2px rgba(200,0,0,0.22);
      }
      .waMatchHead{
        font-weight: 900;
        font-size: 14px;
        margin-bottom: 4px;
      }
      .waMatchBody{
        font-size: 13px;
        opacity: 0.9;
      }
      .waBadge{
        display:inline-flex;
        align-items:center;
        gap: 6px;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.08em;
        padding: 3px 8px;
        border-radius: 999px;
        margin-bottom: 6px;
        width: fit-content;
      }
      .waBadgeChamp{
        background: rgba(250, 204, 21, 0.18);
        border: 1px solid rgba(250, 204, 21, 0.35);
        color: rgba(250, 204, 21, 0.95);
      }
      .waBadgeSeg{
        background: rgba(56, 189, 248, 0.10);
        border: 1px solid rgba(56, 189, 248, 0.22);
        color: rgba(185, 230, 255, 0.92);
      }

      /* ===== Match album photos grid (mirrors Bands photo feel) ===== */
      .waAlbumActionsRow{
        display:flex;
        justify-content:center;
        gap: 10px;
        margin-top: -8px;
      }
      .waAlbumActionBtn{
        font-family: "Orbitron", system-ui, sans-serif !important;
        text-transform: none !important;
        font-size: 12px;
        letter-spacing: .10em;
        color: rgba(226,232,240,0.92);
        text-decoration: none;
        padding: 7px 10px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(0,0,0,0.18);
        transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
      }
      .waAlbumActionBtn:hover{
        transform: translateY(-1px);
        border-color: rgba(200,0,0,0.55);
        background: rgba(0,0,0,0.26);
      }

      .waPhotosGridWrap{
        width:100%;
        max-width: 1100px;
        margin: 0 auto;
        padding-top: 2px;
      }
      .waPhotosMeta{
        text-align:center;
        font-size: 12px;
        letter-spacing: .10em;
        opacity: .75;
        margin-bottom: 10px;
      }
      .waPhotosGrid{
        width:100%;
        display:grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 160px));
        gap: 14px;
        justify-content:center;
        align-items:start;
      }
      @media (max-width: 520px){
        .waPhotosGrid{ grid-template-columns: repeat(auto-fit, minmax(140px, 140px)); }
      }

      .waPhotoBox{
        position: relative;
        width: 160px;
        height: 160px;
        border-radius: 14px;
        overflow: hidden;
        background: rgba(0,0,0,0.28);
        border: 1px solid rgba(255,255,255,0.10);
        box-shadow: 0 16px 34px rgba(0,0,0,0.40);
        cursor: pointer;
        transition: transform 150ms ease, border-color 150ms ease, background 150ms ease;
      }
      .waPhotoBox:hover{
        transform: translateY(-2px);
        border-color: rgba(255,255,255,0.18);
        background: rgba(0,0,0,0.34);
      }
      .waPhotoBox img{
        width:100%;
        height:100%;
        object-fit: cover;
        display:block;
      }
      .waPhotoIndex{
        position:absolute;
        top: 8px;
        left: 8px;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .06em;
        padding: 3px 7px;
        border-radius: 999px;
        background: rgba(0,0,0,0.55);
        border: 1px solid rgba(255,255,255,0.16);
        color: rgba(226,232,240,0.92);
        pointer-events:none;
      }
    

/* Selection toolbar */
.waSelectBar{
  display:flex;
  flex-wrap:wrap;
  gap:10px;
  justify-content:center;
  align-items:center;
  margin: 6px auto 10px;
}
.waSelectBtn{
  appearance:none;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(0,0,0,0.22);
  color: rgba(226,232,240,0.92);
  border-radius: 999px;
  padding: 9px 14px;
  font-family: "Orbitron", system-ui, sans-serif !important;
  font-size: 11px;
  letter-spacing: .10em;
  cursor: pointer;
  text-decoration:none;
  transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
}
.waSelectBtn:hover{
  transform: translateY(-1px);
  border-color: rgba(200,0,0,0.55);
  background: rgba(0,0,0,0.28);
}
.waSelectBtn:disabled{
  opacity:.55;
  cursor:not-allowed;
  transform:none;
}
.waSelectPrimary{
  border-color: rgba(200,0,0,0.55);
}
.waSelectHint{
  font-size: 11px;
  opacity:.65;
  letter-spacing: .08em;
}
.waSelectStatus{
  text-align:center;
  font-size: 12px;
  opacity:.80;
  margin: 0 0 10px;
}

/* Selected tile marker */
.waPhotoBox.selected{
  border-color: rgba(200,0,0,0.70);
  box-shadow: 0 18px 40px rgba(200,0,0,0.12), 0 16px 34px rgba(0,0,0,0.40);
}
.waPhotoBox.selected::after{
  content:"✓";
  position:absolute;
  top:8px;
  right:8px;
  width:22px;
  height:22px;
  border-radius: 999px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size: 12px;
  background: rgba(200,0,0,0.75);
  color: rgba(255,255,255,0.95);
  border: 1px solid rgba(255,255,255,0.18);
  box-shadow: 0 10px 18px rgba(0,0,0,0.35);
  pointer-events:none;
}

/* Lightbox */
.waLightbox{
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.72);
  z-index: 999999;
  display:flex;
  align-items:center;
  justify-content:center;
  padding: 18px;
}
.waLightboxShell{
  width: min(1100px, 96vw);
  height: min(760px, 86vh);
  display:flex;
  flex-direction:column;
  border-radius: 18px;
  overflow:hidden;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(0,0,0,0.45);
  box-shadow: 0 30px 70px rgba(0,0,0,0.55);
  backdrop-filter: blur(10px);
}
/* Desktop-only: allow taller lightbox so portrait images aren't clipped */
@media (min-width: 900px){
  .waLightboxShell{
    height: min(92vh, 980px);
  }
}

.waLightboxTopbar{
  display:flex;
  gap:12px;
  align-items:center;
  justify-content:space-between;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.10);
}
.waLightboxTitle{
  font-family: "Orbitron", system-ui, sans-serif !important;
  letter-spacing: .08em;
  font-size: 12px;
  opacity:.92;
  overflow:hidden;
  white-space:nowrap;
  text-overflow:ellipsis;
}
.waLightboxActions{
  display:flex;
  gap:10px;
  align-items:center;
}
.waLightboxBtn{
  appearance:none;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(0,0,0,0.22);
  color: rgba(226,232,240,0.92);
  border-radius: 999px;
  padding: 8px 12px;
  font-family: "Orbitron", system-ui, sans-serif !important;
  font-size: 11px;
  letter-spacing: .10em;
  cursor: pointer;
  text-decoration:none;
}
.waLightboxBtn:hover{
  border-color: rgba(200,0,0,0.55);
}
.waLightboxClose{
  border-color: rgba(200,0,0,0.40);
}
.waLightboxStage{
  position:relative;
  flex: 1;
  display:flex;
  align-items:center;
  justify-content:center;
  padding: 10px;
}
.waLightboxImg{
  max-width: 100%;
  max-height: 100%;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.12);
  box-shadow: 0 20px 50px rgba(0,0,0,0.55);
  transition: opacity 180ms ease;
}
.waLightboxNav{
  position:absolute;
  top:50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(0,0,0,0.30);
  color: rgba(226,232,240,0.92);
  cursor:pointer;
  font-size: 18px;
}
.waLightboxNav:hover{ border-color: rgba(200,0,0,0.55); }
.waLightboxPrev{ left: 12px; }
.waLightboxNext{ right: 12px; }
`;
    document.head.appendChild(s);
  }


  // ================== CSV PARSER ==================
  function parseCsvLine(line) {
    const out = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        out.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  }

  // ================== LOAD SHOWS FROM CSV ==================
  async function loadShowsFromCsv() {
    try {
      const res = await _fetchWithRetry(SHOWS_ENDPOINT, {
        attempts: 3,
        timeoutMs: 25000,
        baseDelayMs: 750,
        fetchOptions: { cache: "no-store" }
      });
      const text = await res.text();
      if (!text.trim()) return [];

      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const headerLine = lines.shift();

      const header = parseCsvLine(headerLine);
      const headerLower = header.map((h) => h.trim().toLowerCase());

      const dateIdx =
        headerLower.indexOf("show_date") !== -1
          ? headerLower.indexOf("show_date")
          : headerLower.indexOf("date");

      const rows = [];

      lines.forEach((line) => {
        const cols = parseCsvLine(line);

        const row = {};
        header.forEach((colName, i) => {
          row[colName.trim().toLowerCase()] = (cols[i] || "").trim();
        });

        row.date =
          dateIdx !== -1 ? (cols[dateIdx] || "").trim() : (row.show_date || row.date || "");

        rows.push(row);
      });

      return rows;
    } catch (err) {
      console.error("Error loading shows CSV:", err);
      setCrumbs("Error loading shows data.");
      return [];
    }
  }

  // ================== YEARS FROM SHOWS ==================
  function yearFromDateString(raw) {
    if (!raw) return null;
    const parts = raw.split("/");
    if (parts.length !== 3) return null;

    let y = (parts[2] || "").trim();
    if (!y) return null;

    if (y.length === 2) y = "20" + y;
    const yr = Number(y);
    return Number.isFinite(yr) ? yr : null;
  }

  function showDateSlugFromRaw(raw) {
    const v = String(raw || "").trim();
    if (!v) return "";

    const m1 = v.match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\s*$/);
    if (m1) {
      const mm = String(m1[1]).padStart(2, "0");
      const dd = String(m1[2]).padStart(2, "0");
      let yy = String(m1[3]);
      if (yy.length === 4) yy = yy.slice(2);
      return mm + dd + yy;
    }

    const m2 = v.match(/^\s*(\d{4})-(\d{2})-(\d{2})\s*$/);
    if (m2) return String(m2[2]) + String(m2[3]) + String(m2[1]).slice(2);

    return "";
  }

  function getShowDetailSlugFromPath() {
    try {
      const parts = String(window.location.pathname || "").trim().replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
      if (String(parts[0] || "").toLowerCase() !== "wrestling") return "";
      if (String(parts[1] || "").toLowerCase() !== "shows") return "";
      const slug = String(parts[2] || "").trim();
      return /^\d{6}$/.test(slug) ? slug : "";
    } catch (_) {
      return "";
    }
  }

  function normalizeWAMatchSlug(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return "";
    return raw
      .replace(/[^a-z0-9\-_ ]+/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getWAMatchRouteSlug(urlCell, idx) {
    const raw = String(urlCell || "").trim();
    if (raw && !/^https?:\/\//i.test(raw) && !raw.startsWith("/")) {
      const clean = normalizeWAMatchSlug(raw);
      if (clean) return clean;
    }
    return "match-" + String(Number(idx) || 1);
  }

  function getMatchDetailSlugFromPath() {
    try {
      const parts = String(window.location.pathname || "").trim().replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
      if (String(parts[0] || "").toLowerCase() !== "wrestling") return "";
      if (String(parts[1] || "").toLowerCase() !== "shows") return "";
      return normalizeWAMatchSlug(parts[3] || "");
    } catch (_) {
      return "";
    }
  }

  function syncShowsPathForDetail(slug, opts) {
    const clean = /^\d{6}$/.test(String(slug || "").trim()) ? String(slug).trim() : "";
    const path = clean ? (`/wrestling/shows/${clean}`) : "/wrestling/shows";
    const target = path + (window.location.search || "");
    const method = (opts && opts.replace) ? "replaceState" : "pushState";
    try {
      window.history[method]({}, "", target);
    } catch (_) {}
  }

  function syncShowsPathForMatch(showSlug, matchSlug, opts) {
    const cleanShow = /^\d{6}$/.test(String(showSlug || "").trim()) ? String(showSlug).trim() : "";
    const cleanMatch = normalizeWAMatchSlug(matchSlug);
    if (!cleanShow || !cleanMatch) {
      syncShowsPathForDetail(cleanShow, opts);
      return;
    }
    const target = `/wrestling/shows/${cleanShow}/${cleanMatch}` + (window.location.search || "");
    const method = (opts && opts.replace) ? "replaceState" : "pushState";
    try {
      window.history[method]({}, "", target);
    } catch (_) {}
  }

  function waPickFirst(obj, keys) {
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (!k) continue;
      const v = obj && Object.prototype.hasOwnProperty.call(obj, k) ? obj[k] : undefined;
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  }

  function getWAMatchField(obj, i, field) {
    const n = Number(i);
    const dash = `match-${n}`;
    const under = `match_${n}`;
    const legacy = `part_${n}`;
    const suffixes = [`_${field}`, `-${field}`];
    const keys = [];
    for (let s = 0; s < suffixes.length; s++) {
      const suf = suffixes[s];
      keys.push(`${dash}${suf}`);
      keys.push(`${under}${suf}`);
    }
    keys.push(`${legacy}_${field}`);
    return waPickFirst(obj, keys);
  }

  function resolveWAMatchUrl(urlCell, showRow) {
    const raw = String(urlCell || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith("/")) return SMUG_ORIGIN.replace(/\/$/, "") + raw;

    function inferShowBaseUrl(r) {
      const base = String((r && (r.show_url || r.showurl || r.showUrl || r.show)) || "").trim();
      if (base) return base;

      const poster = String((r && (r.show_poster || r.poster_url)) || "").trim();
      if (poster) {
        try {
          const u = new URL(poster);
          const parts = String(u.pathname || "").split("/").filter(Boolean);
          for (let i = 0; i < parts.length - 2; i++) {
            if (String(parts[i]).toLowerCase() === "wrestling" && /^\d{6}$/.test(parts[i + 2])) {
              return SMUG_ORIGIN.replace(/\/$/, "") + "/" + parts.slice(i, i + 3).join("/");
            }
          }
        } catch (_) {}
      }

      const rawDate = String((r && (r.show_date || r.date)) || "").trim();
      const mmddyy = showDateSlugFromRaw(rawDate);
      if (mmddyy) {
        const fedFolder = (function () {
          const v = String((r && (r.show_folder || r.fed || r.promotion || r.company || r.show_company || r.showCompany)) || "").trim();
          if (!v) return "";
          let t = v.replace(/wrestling/ig, " ").trim();
          t = t.split(/[-â€“â€”|]/)[0].trim();
          t = t.split(/\s+/)[0].trim();
          t = t.replace(/[^A-Za-z0-9]/g, "");
          return t;
        })();
        return SMUG_ORIGIN.replace(/\/$/, "") + "/Wrestling/" + (fedFolder || "Limitless") + "/" + mmddyy;
      }
      return "";
    }

    const base2 = inferShowBaseUrl(showRow);
    if (base2) return base2.replace(/\/$/, "") + "/" + raw.replace(/^\//, "");
    return raw;
  }

  function getWAMatchAlbumFromRow(showRow, matchSlug) {
    const clean = normalizeWAMatchSlug(matchSlug);
    if (!showRow || !clean) return null;
    for (let idx = 1; idx <= 10; idx++) {
      const type = getWAMatchField(showRow, idx, "type");
      const stip = getWAMatchField(showRow, idx, "stip");
      const partTitle = getWAMatchField(showRow, idx, "title");
      const people = getWAMatchField(showRow, idx, "people");
      const urlCell = getWAMatchField(showRow, idx, "url");
      const slug = getWAMatchRouteSlug(urlCell, idx);
      if (slug !== clean) continue;
      const url = resolveWAMatchUrl(urlCell, showRow);
      if (!type && !stip && !partTitle && !people && !url) return null;
      return {
        slug: slug,
        url: url,
        title: buildMatchHeader(type, stip, partTitle)
      };
    }
    return null;
  }

  function findShowByDateSlug(slug) {
    const clean = String(slug || "").trim();
    if (!/^\d{6}$/.test(clean)) return null;
    const rows = Array.isArray(SHOWS) ? SHOWS : [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowSlug = showDateSlugFromRaw((row && (row.show_date || row.date)) || "");
      if (rowSlug === clean) return row;
    }
    return null;
  }

  function extractYearsFromShows(shows) {
    const set = new Set();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    (shows || []).forEach((s) => {
      const dt = parseWAShowDateValue(s && (s.date || s.show_date || ""));
      if (!dt || dt.getTime() >= today.getTime()) return;
      const yr = yearFromDateString(s.date || s.show_date || "");
      if (yr) set.add(yr);
    });
    return Array.from(set);
  }

  function getShowsForYear(year) {
    if (isWAUpcomingSelection(year)) return getWAUpcomingShows(SHOWS || []);
    const yr = Number(year);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (SHOWS || []).filter((row) => {
      const raw = (row.show_date || row.date || "").trim();
      const y = yearFromDateString(raw);
      if (y !== yr) return false;
      const dt = parseWAShowDateValue(raw);
      return !!(dt && dt.getTime() < today.getTime());
    });
  }

  // ================== RENDERING ==================
  function formatPrettyDate(raw) {
    if (!raw) return "";
    const parts = raw.split("/");
    if (parts.length !== 3) return raw;

    let [m, d, y] = parts.map((p) => p.trim());
    if (!m || !d || !y) return raw;

    if (y.length === 2) y = "20" + y;
    const year = Number(y);
    const month = Number(m) - 1;
    const day = Number(d);

    const date = new Date(year, month, day);
    if (isNaN(date.getTime())) return raw;

    const monthName = date.toLocaleString("en-US", { month: "long" });

    const suffix =
      day % 10 === 1 && day !== 11
        ? "st"
        : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
        ? "rd"
        : "th";

    return `${monthName} ${day}${suffix}, ${year}`;
  }

  function renderShowsCards(rows, year) {
    clearResults();
    const resultsEl = getResultsEl();
    if (!resultsEl) return;

    if (!rows || rows.length === 0) {
      const msg = document.createElement("div");
      msg.textContent = "No shows found for this year.";
      msg.style.opacity = "0.8";
      msg.style.textAlign = "center";
      msg.style.padding = "18px";
      resultsEl.appendChild(msg);
      return;
    }

    resultsEl.style.display = "grid";
    resultsEl.style.gridTemplateColumns = "repeat(auto-fit, minmax(280px, 1fr))";
    resultsEl.style.gap = "16px";

    // Mobile/webview safety: prevent horizontal clipping inside parent panels
    resultsEl.style.boxSizing = "border-box";
    resultsEl.style.padding = "0 4px";
    resultsEl.style.minWidth = "0";
    resultsEl.style.width = "100%";
    resultsEl.style.maxWidth = "1200px";
    resultsEl.style.margin = "0 auto";

    rows.forEach((r) => {
      const title = (r.show_name || r.title || "").trim();
      const rawDate = (r.show_date || r.date || "").trim();
      const posterUrl = (r.show_poster || r.poster_url || "").trim();

      const card = document.createElement("article");
      card.style.display = "grid";
      card.style.gridTemplateColumns = "120px 1fr";
      card.style.gap = "14px";
      card.style.alignItems = "center";
      card.style.padding = "12px 14px";
      card.style.borderRadius = "12px";
      card.style.background = "rgba(15, 23, 42, 0.25)";
      card.style.border = "1px solid rgba(255,255,255,0.08)";

      const posterBox = document.createElement("div");
      posterBox.style.width = "110px";
      posterBox.style.height = "110px";
      posterBox.style.borderRadius = "10px";
      posterBox.style.overflow = "hidden";
      posterBox.style.background = "rgba(0,0,0,0.35)";
      posterBox.style.border = "1px solid rgba(255,255,255,0.10)";
      posterBox.style.display = "flex";
      posterBox.style.alignItems = "center";
      posterBox.style.justifyContent = "center";
      posterBox.style.cursor = "pointer";

      if (posterUrl) {
        const img = document.createElement("img");
        img.src = `${API_BASE}/show-poster?url=${encodeURIComponent(posterUrl)}`;
        img.alt = title || "poster";
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "cover";
        posterBox.appendChild(img);
      } else {
        const ph = document.createElement("div");
        ph.textContent = "No poster";
        ph.style.opacity = "0.6";
        ph.style.fontSize = "12px";
        posterBox.appendChild(ph);
      }

      const right = document.createElement("div");
      right.style.minWidth = "0";
      right.style.display = "flex";
      right.style.flexDirection = "column";
      right.style.gap = "6px";

      const company = (r.company || "").trim();
      if (company) {
        const companyEl = document.createElement("div");
        companyEl.textContent = company;
        companyEl.style.fontSize = "13px";
        companyEl.style.fontWeight = "600";
        companyEl.style.color = "rgba(200,0,0,0.95)";
        right.appendChild(companyEl);
      }

      const titleEl = document.createElement("div");
      titleEl.textContent = title || "(Untitled show)";
      titleEl.style.fontSize = "18px";
      titleEl.style.fontWeight = "700";
      right.appendChild(titleEl);

      if (rawDate) {
        const dateEl = document.createElement("div");
        dateEl.textContent = formatPrettyDate(rawDate);
        dateEl.style.fontSize = "12px";
        right.appendChild(dateEl);
      }
      // Poster click -> open a "show detail" view (Band-style routing)
      posterBox.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        runNeonShutterTransition(function () { showShowDetail(r, year); });
      });
      card.appendChild(posterBox);
      card.appendChild(right);

      resultsEl.appendChild(card);
    });
  }

  

  // ================== SHOW DETAIL (Band-style routing) ==================
  function showShowDetail(row, year, opts) {
    if (!row) return;
    ensureShowsStyles();
    const titleForTracking = String((row.show_name || row.title || "").trim() || "(Untitled show)");
    const showSlugForTracking = showDateSlugFromRaw((row.show_date || row.date || "").trim());

    // Save list context for Back
    LAST_LIST_CTX = { year: (year != null ? Number(year) : null) };

    if (!opts || opts.syncUrl !== false) {
      const detailSlug = showDateSlugFromRaw((row.show_date || row.date || "").trim());
      if (detailSlug) syncShowsPathForDetail(detailSlug, { replace: !!(opts && opts.replace) });
    }

    trackWrestlingShowsEvent("wrestling_show_open", {
      entity_type: "show",
      entity_id: String(showSlugForTracking || ""),
      entity_label: titleForTracking,
      meta: {
        show: titleForTracking,
        year: String(year != null ? year : ""),
        date: String((row.show_date || row.date || "").trim() || ""),
        company: String((row.company || "").trim() || "")
      }
    });

    const resultsEl = getResultsEl();
    const yearRow = getYearGroupsEl();
    const crumbsEl = getCrumbsEl();
    if (!resultsEl) return;

    // Hide year pills while in detail (keeps focus like Bands)
    try { if (yearRow) yearRow.style.display = "none"; } catch (_) {}
    try { if (crumbsEl) crumbsEl.style.display = "none"; } catch (_) {}

    // Build detail view
    resultsEl.style.display = "block";
    resultsEl.innerHTML = "";

    const title = String((row.show_name || row.title || "").trim() || "(Untitled show)");
    const rawDate = String((row.show_date || row.date || "").trim() || "");
    const prettyDate = rawDate ? formatPrettyDate(rawDate) : "-";
    const company = String((row.company || "").trim() || "-");

    // Venue-ish (best-effort: supports venue/city/state columns if present)
    const venue = String((row.show_venue || row.venue || "").trim() || "");
    const city = String((row.show_city || row.city || "").trim() || "");
    const state = String((row.show_state || row.state || "").trim() || "");
    const venueLine = [venue, (city && state ? `${city}, ${state}` : (city || state))].filter(Boolean).join(" - ") || "-";

    const posterUrlRaw = String((row.show_poster || row.poster_url || "").trim() || "");
    const posterUrl = posterUrlRaw ? `${API_BASE}/show-poster?url=${encodeURIComponent(posterUrlRaw)}` : "";

    const wrap = document.createElement("div");
    wrap.className = "waDetailWrap";

    const topbar = document.createElement("div");
    topbar.className = "waDetailTopbar";

    const backBtn = document.createElement("button");
    backBtn.className = "waBackBtn";
    backBtn.type = "button";
    backBtn.textContent = "Back to shows";
    backBtn.addEventListener("click", () => {
      runNeonShutterTransition(function () {
        // Restore list view for the year we came from
        try { if (yearRow) yearRow.style.display = ""; } catch (_) {}
        try { if (crumbsEl) crumbsEl.style.display = ""; } catch (_) {}

        const y = (LAST_LIST_CTX && LAST_LIST_CTX.year != null) ? LAST_LIST_CTX.year : null;
        if (y != null) {
          _waActiveYear = y;
          try { refreshWAYearsNav(_waActiveYear, null); } catch (_) {}
          if (isWAUpcomingSelection(y)) setCrumbs('Upcoming');
          else setCrumbs(`Shows for ${y}`);
          const rows = getShowsForYear(y);
          renderShowsCards(rows, y);
          syncShowsPathForDetail("", { replace: true });
        } else {
          // If we somehow do not know the year, just clear results
          clearResults();
          syncShowsPathForDetail("", { replace: true });
        }
        resetPanelScroll();
      });
    });

    topbar.appendChild(backBtn);
    wrap.appendChild(topbar);

    const header = document.createElement("div");
    header.className = "waDetailHeader";

    const poster = document.createElement("img");
    poster.className = "waDetailPoster";
    poster.alt = title;
    poster.loading = "lazy";
    if (posterUrl) poster.src = posterUrl;

    // If no poster, use a neutral SVG placeholder to keep layout stable
    if (!posterUrl) {
      poster.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='100%25' height='100%25' fill='rgba(0,0,0,0.35)'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='rgba(255,255,255,0.55)' font-size='20'%3ENo%20poster%3C/text%3E%3C/svg%3E";
    }

    const card = document.createElement("div");
    card.className = "waDetailCard";

    const namePill = document.createElement("div");
    namePill.className = "waDetailNamePill";
    namePill.innerHTML = `
      <div class="kicker">SHOW:</div>
      <div class="name">${escapeHtml(title)}</div>
    `;

    const infoRow = document.createElement("div");
    infoRow.className = "waInfoRow";
    infoRow.innerHTML = `
      <div class="waInfoPill">
        <div class="lbl">COMPANY</div>
        <div class="val">${escapeHtml(company)}</div>
      </div>
      <div class="waInfoPill">
        <div class="lbl">DATE</div>
        <div class="val">${escapeHtml(prettyDate)}</div>
      </div>
      <div class="waInfoPill">
        <div class="lbl">VENUE</div>
        <div class="val">${escapeHtml(venueLine)}</div>
      </div>
    `;

    card.appendChild(namePill);
    card.appendChild(infoRow);

    header.appendChild(poster);
    header.appendChild(card);
    wrap.appendChild(header);

    const matchesTitle = document.createElement("div");
    matchesTitle.className = "waMatchesTitle";
    matchesTitle.textContent = "Matches / Segments:";
    wrap.appendChild(matchesTitle);

    const matchesWrap = document.createElement("div");
    matchesWrap.className = "waMatchesWrap";
    wrap.appendChild(matchesWrap);

    renderMatchesInto(matchesWrap, row);

    resultsEl.appendChild(wrap);
    resetPanelScroll();
  }
  function renderMatchesInto(containerEl, row) {
    let any = false;

    // Match columns are moving from part_1_* to match-1_* (and match_1_*).
    // This keeps backward compatibility with the older sheet while supporting the new naming.
    function pickFirst(obj, keys) {
      for (const k of keys) {
        if (!k) continue;
        const v = obj && Object.prototype.hasOwnProperty.call(obj, k) ? obj[k] : undefined;
        if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
      }
      return "";
    }

    function getMatchField(obj, i, field) {
      const n = Number(i);
      const dash = `match-${n}`;
      const under = `match_${n}`;
      const legacy = `part_${n}`;

      // Support a few common header variants:
      //   match-1_type, match_1_type, match-1-type, match_1-type
      //   legacy part_1_* fields
      const suffixes = [
        `_${field}`,
        `-${field}`,
      ];

      const keys = [];
      for (const suf of suffixes) {
        keys.push(`${dash}${suf}`);
        keys.push(`${under}${suf}`);
      }
      keys.push(`${legacy}_${field}`);
      return pickFirst(obj, keys);
    }

    // Resolve a sheet "url" cell into a real SmugMug URL.
    // If the cell is relative (e.g., "Match-1"), we infer the show base URL from the poster URL
    // (or optional show_url field) and then append the relative segment.
    function resolveMatchUrl(urlCell, showRow) {
      const raw = String(urlCell || "").trim();
      if (!raw) return "";
      if (/^https?:\/\//i.test(raw)) return raw;

      // Absolute path on the same origin
      if (raw.startsWith("/")) {
        return SMUG_ORIGIN.replace(/\/$/, "") + raw;
      }

      function inferShowBaseUrl(r) {
        // 1) explicit base in the sheet (optional)
        const base = String((r && (r.show_url || r.showurl || r.showUrl || r.show)) || "").trim();
        if (base) return base;

        // 2) preferred: infer from show_poster URL *only if* it contains /Wrestling/<fed>/<mmddyy> somewhere
        // This is more reliable than assuming a fixed company folder from date alone.
        const poster = String((r && (r.show_poster || r.poster_url)) || "").trim();
        if (poster) {
          try {
            const u = new URL(poster);
            const parts = String(u.pathname || "").split("/").filter(Boolean);

            // Find the "Wrestling/<fed>/<mmddyy>" triple anywhere in the path
            for (let i = 0; i < parts.length - 2; i++) {
              if (String(parts[i]).toLowerCase() === "wrestling" && /^\d{6}$/.test(parts[i + 2])) {
                return SMUG_ORIGIN.replace(/\/$/, "") + "/" + parts.slice(i, i + 3).join("/");
              }
            }
          } catch (_) {}
        }

        // 3) build from show_date using your known structure:
        //    https://vmpix.smugmug.com/Wrestling/<Company>/<mmddyy>
        // NOTE: we avoid hardcoding the company folder when possible.
        const rawDate = String((r && (r.show_date || r.date)) || "").trim();

        const mmddyy = (function () {
          if (!rawDate) return "";
          // Accept: M/D/YY or MM/DD/YYYY
          const m1 = rawDate.match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\s*$/);
          if (m1) {
            const mm = String(m1[1]).padStart(2, "0");
            const dd = String(m1[2]).padStart(2, "0");
            let yy = String(m1[3]);
            if (yy.length === 4) yy = yy.slice(2);
            return mm + dd + yy;
          }
          // Accept: YYYY-MM-DD
          const m2 = rawDate.match(/^\s*(\d{4})-(\d{2})-(\d{2})\s*$/);
          if (m2) {
            const yy = m2[1].slice(2);
            return m2[2] + m2[3] + yy;
          }
          return "";
        })();

        if (mmddyy) {
          // Try to infer the company folder from the sheet, falling back to "Limitless"
          const fedFolder = (function () {
            const raw =
              String((r && (r.show_folder || r.fed || r.promotion || r.company || r.show_company || r.showCompany)) || "").trim();
            if (!raw) return "";
            // Drop the word "Wrestling" and keep the first token as a safe folder guess.
            let t = raw.replace(/wrestling/ig, " ").trim();
            // If there are separators, keep the left side
            t = t.split(/[-–—|]/)[0].trim();
            // Prefer the first word (folder names are typically short)
            t = t.split(/\s+/)[0].trim();
            // Keep URL-safe characters
            t = t.replace(/[^A-Za-z0-9]/g, "");
            return t;
          })();

          return SMUG_ORIGIN.replace(/\/$/, "") + "/Wrestling/" + (fedFolder || "Limitless") + "/" + mmddyy;
        }

        return "";
      }
const base2 = inferShowBaseUrl(showRow);
      if (base2) return base2.replace(/\/$/, "") + "/" + raw.replace(/^\//, "");

      // Last resort: still return the raw string (keeps the UI from crashing)
      return raw;
    }


    for (let i = 1; i <= 10; i++) {
      const type = getMatchField(row, i, "type");
      const stip = getMatchField(row, i, "stip");
      const partTitle = getMatchField(row, i, "title");
      const people = getMatchField(row, i, "people");
      const urlCell = getMatchField(row, i, "url");
      const matchId = getWAMatchRouteSlug(urlCell, i);
      const matchUrl = resolveMatchUrl(urlCell, row);

      if (!type && !stip && !partTitle && !people) continue;
      any = true;

      const box = document.createElement("div");
      box.className = "waMatchBox";
      box.dataset.matchId = matchId;
      if (matchUrl) box.dataset.matchUrl = matchUrl;
      box.setAttribute("role", "button");
      box.setAttribute("tabindex", "0");
      box.title = matchUrl ? "Open match album" : "";

      // Defensive: ensure string (some rows may have blank type)
      const typeNorm = String(type || "").toLowerCase();

      // Smarter header: avoid "Match Match" and handle segment/promo labels cleanly.
      // Use classic args (avoids object-literal shorthand parsing issues in some webviews)
      const headerLabel = buildMatchHeader(type, stip, partTitle);

      // Badges
      // Use indexOf for compatibility with older webviews
      if (typeNorm.indexOf("championship") !== -1) {
        const badge = document.createElement("div");
        badge.className = "waBadge waBadgeChamp";
        // Avoid template literals for older webviews
        badge.innerHTML = '<span style="font-size:12px">🏆</span><span>CHAMPIONSHIP</span>';
        box.appendChild(badge);
      } else if (typeNorm === "promo" || typeNorm === "segment") {
        const badge = document.createElement("div");
        badge.className = "waBadge waBadgeSeg";
        badge.innerHTML = '<span style="font-size:12px">🎤</span><span>' + escapeHtml(typeNorm.toUpperCase()) + '</span>';
        box.appendChild(badge);
      }

      const head = document.createElement("div");
      head.className = "waMatchHead";
      head.textContent = headerLabel;
      box.appendChild(head);

      if (people) {
        const body = document.createElement("div");
        body.className = "waMatchBody";
        body.textContent = people;
        box.appendChild(body);
      }

      containerEl.appendChild(box);

      // Click / keyboard: open the match album INSIDE the HUD (Bands-style grid)
      if (matchUrl) {
        const go = function () {
          runNeonShutterTransition(function () { openMatchAlbumInPanel(matchUrl, headerLabel, matchId, row); });
        };
        box.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          go();
        });
        box.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            go();
          }
        });
      }
    }

    if (!any) {
      const none = document.createElement("div");
      none.textContent = "No match info yet.";
      none.style.opacity = "0.8";
      none.style.textAlign = "center";
      none.style.padding = "10px 0";
      containerEl.appendChild(none);

    }
  }

  // ================== MATCH ALBUM (Bands-style photos grid inside HUD) ==================
  async function openMatchAlbumInPanel(matchUrl, matchTitle, matchId, showRow, opts) {
    const resultsEl = getResultsEl();
    const yearRow = getYearGroupsEl();
    const crumbsEl = getCrumbsEl();
    if (!resultsEl) return;

    const showSlug = showDateSlugFromRaw((showRow && (showRow.show_date || showRow.date || "")) || "");
    const cleanMatchSlug = normalizeWAMatchSlug(matchId);
    trackWrestlingShowsEvent("wrestling_match_open", {
      entity_type: "match",
      entity_id: String(cleanMatchSlug || matchId || ""),
      entity_label: String(matchTitle || cleanMatchSlug || "Match"),
      meta: {
        show_slug: String(showSlug || ""),
        show: String(showRow && (showRow.show_name || showRow.title || "") || ""),
        match_url: String(matchUrl || "")
      }
    });
    if ((!opts || opts.syncUrl !== false) && showSlug && cleanMatchSlug) {
      syncShowsPathForMatch(showSlug, cleanMatchSlug, { replace: !!(opts && opts.replace) });
    }

    // Keep year pills + crumbs hidden (we're inside detail already)
    try { if (yearRow) yearRow.style.display = "none"; } catch (_) {}
    try { if (crumbsEl) crumbsEl.style.display = "none"; } catch (_) {}

    resultsEl.style.display = "block";
    resultsEl.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "waDetailWrap";

    const topbar = document.createElement("div");
    topbar.className = "waDetailTopbar";

    const backBtn = document.createElement("button");
    backBtn.className = "waBackBtn";
    backBtn.type = "button";
    backBtn.textContent = "← Back to show";
    backBtn.addEventListener("click", function () {
      runNeonShutterTransition(function () {
      // Re-render the show detail (keeps all styles consistent)
      showShowDetail(showRow, (LAST_LIST_CTX && LAST_LIST_CTX.year != null) ? LAST_LIST_CTX.year : null, { replace: true });
      resetPanelScroll();
    
      });
});

    topbar.appendChild(backBtn);
    wrap.appendChild(topbar);

    // Header pill (match title)
    const headerPill = document.createElement("div");
    headerPill.className = "waDetailNamePill";
    headerPill.innerHTML =
      '<div class="kicker">MATCH ALBUM:</div>' +
      '<div class="name">' + escapeHtml(matchTitle || matchId || "Match") + '</div>';
    wrap.appendChild(headerPill);

    // People in this album (keywords)
    const kwBox = document.createElement("div");
    kwBox.className = "waAlbumKeywordBox";

    const kwTitle = document.createElement("div");
    kwTitle.className = "waAlbumKeywordTitle";
    kwTitle.textContent = "People in this album:";
    kwBox.appendChild(kwTitle);

    const kwChips = document.createElement("div");
    kwChips.className = "waAlbumKeywordChips";
    kwBox.appendChild(kwChips);

    const kwEmpty = document.createElement("div");
    kwEmpty.className = "waAlbumKeywordEmpty";
    kwEmpty.textContent = "Loading…";
    kwBox.appendChild(kwEmpty);
    kwEmpty.style.display = "none";

    wrap.appendChild(kwBox);


    // Grid container
    const gridWrap = document.createElement("div");
    gridWrap.className = "waPhotosGridWrap";

    
// Toolbar (ported from bands: select-to-zip + buy buttons)

// Toolbar (ported from bands: select-to-zip + buy buttons)
const toolbar = document.createElement("div");
toolbar.className = "waSelectBar";

const buyPhotos = document.createElement("a");
buyPhotos.className = "waSelectBtn";
buyPhotos.textContent = "Buy Photos";
buyPhotos.href = matchUrl || "#";
buyPhotos.target = "_blank";
buyPhotos.rel = "noopener";

const selectToggle = document.createElement("button");
selectToggle.className = "waSelectBtn";
selectToggle.type = "button";
selectToggle.textContent = "Select Photos to Download";

const selectAllBtn = document.createElement("button");
selectAllBtn.className = "waSelectBtn";
selectAllBtn.type = "button";
selectAllBtn.textContent = "Select All";

const dlZipBtn = document.createElement("button");
dlZipBtn.className = "waSelectBtn";
dlZipBtn.type = "button";
dlZipBtn.textContent = "Download ZIP";

const clearBtn = document.createElement("button");
clearBtn.className = "waSelectBtn";
clearBtn.type = "button";
clearBtn.textContent = "Clear";

const hint = document.createElement("div");
hint.className = "waSelectHint";
hint.textContent = "Tip: Toggle select mode, pick photos, then Download ZIP.";

// THEN append
toolbar.appendChild(buyPhotos);
toolbar.appendChild(selectToggle);
toolbar.appendChild(selectAllBtn);
toolbar.appendChild(dlZipBtn);
toolbar.appendChild(clearBtn);
toolbar.appendChild(hint);

gridWrap.appendChild(toolbar);
const statusLine = document.createElement("div");
statusLine.className = "waSelectStatus";
statusLine.textContent = "";
gridWrap.appendChild(statusLine);

const meta = document.createElement("div");
    meta.className = "waPhotosMeta";
    meta.textContent = "Loading photos…";
    gridWrap.appendChild(meta);

    const grid = document.createElement("div");
    grid.className = "waPhotosGrid";
    gridWrap.appendChild(grid);

    wrap.appendChild(gridWrap);
    resultsEl.appendChild(wrap);
    resetPanelScroll();

    // Load images (resolve URL -> AlbumKey -> images) using the wrestling backend
    try {
      // Resolve URL -> Shop NodeKey (SmugMug /shop expects a NodeKey, not always the AlbumKey)
      let albumKey = "";
      // Prefer a canonical URL returned by the resolver (prevents "wrong buy link" on redirected albums)
      let canonicalAlbumUrl = String(matchUrl || "").trim();

      try {
        const shopInfo = await resolveShopNodeFromUrl(matchUrl);

        // Some resolver implementations return a finalUrl (canonical album URL) and/or shopUrl directly.
        if (shopInfo && shopInfo.finalUrl) {
          canonicalAlbumUrl = String(shopInfo.finalUrl || "").trim() || canonicalAlbumUrl;
        }

        const directShopUrl = (shopInfo && shopInfo.shopUrl) ? String(shopInfo.shopUrl || "").trim() : "";
        const hasDirectShop = directShopUrl && /\/shop\?/i.test(directShopUrl);

        if (hasDirectShop) {
          buyPhotos.href = directShopUrl;
        } else if (shopInfo && shopInfo.nodeKey) {
          buyPhotos.href = SMUG_ORIGIN.replace(/\/$/, "") + "/shop?nodeKey=" + encodeURIComponent(shopInfo.nodeKey);
        } else {
          // Fail-soft: at least open the album itself
          buyPhotos.href = canonicalAlbumUrl || (matchUrl || "#");
        }

        if (shopInfo && shopInfo.albumKey) albumKey = String(shopInfo.albumKey || "").trim();
      } catch (_) {
        // Keep the default album link if shop resolution fails
        try { buyPhotos.href = canonicalAlbumUrl || (matchUrl || "#"); } catch (_) {}
      }

      // Still need AlbumKey to load images (fail-soft) (fail-soft)
      if (!albumKey) {
        albumKey = await resolveAlbumKeyFromUrl(canonicalAlbumUrl || matchUrl);
      }

      if (!albumKey) {
        meta.textContent = "Could not resolve this album yet (no AlbumKey returned).";
        return;
      }

      // Load meta (title/keywords) if available (fail-soft)
      let albumTitle = "";
      try {
        const metaJson = await fetchJsonFirstOk([
          API_BASE + "/smug/album-meta/" + encodeURIComponent(albumKey),
        ]);
        const album = metaJson && metaJson.Response && metaJson.Response.Album;
        if (album && typeof album.Title === "string") albumTitle = album.Title;

        // Keywords (People in this album)
        try {
          const rawKw =
            (album && typeof album.Keywords === "string") ? album.Keywords :
            (album && typeof album.Keyword === "string") ? album.Keyword :
            (album && Array.isArray(album.Keywords)) ? album.Keywords.join(";") :
            "";

          const list = String(rawKw || "")
            .split(/[;,]/g)
            .map((s) => s.trim())
            .filter(Boolean);

          // Render into the keyword box if it exists
          try {
            if (kwChips) kwChips.innerHTML = "";
            if (list.length) {
              if (kwEmpty) kwEmpty.style.display = "none";
              for (let i = 0; i < list.length; i++) {
                const chip = document.createElement("div");
                chip.className = "waAlbumKeywordChip";
                chip.textContent = list[i];

                // Make chips clickable (keyword search modal)
                chip.setAttribute("role", "button");
                chip.setAttribute("tabindex", "0");
                chip.title = "Search albums for " + list[i];

                const kw = list[i];
                // Open the keyword search modal with context so results can open INSIDE the HUD
                // (no new window), and still return back to this show.
                const openKw = function () {
                  openWrestlingKeywordSearchModal(kw, {
                    showRow: showRow,
                    // Best-effort context for analytics/debugging; not required for routing.
                    fromAlbumUrl: matchUrl,
                    fromAlbumKey: albumKey,
                    fromAlbumTitle: (albumTitle || matchTitle || matchId || "").trim()
                  });
                };

                chip.addEventListener("click", function (e) {
                  e.preventDefault();
                  e.stopPropagation();
                  openKw();
                });
                chip.addEventListener("keydown", function (e) {
                  if (e.key === "Enter" || e.key === " " ) {
                    e.preventDefault();
                    e.stopPropagation();
                    openKw();
                  }
                });
                if (kwChips) kwChips.appendChild(chip);
              }
            } else {
              if (kwEmpty) {
                kwEmpty.textContent = "No people tags found.";
                kwEmpty.style.display = "";
              }
            }
          } catch (_) {}
        } catch (_) {}

      } catch (_) {}

      if (albumTitle) {
        headerPill.innerHTML =
          '<div class="kicker">ALBUM:</div>' +
          '<div class="name">' + escapeHtml(albumTitle) + '</div>';
      }

      
const images = await fetchAllAlbumImages(albumKey);
if (!images || !images.length) {
  meta.textContent = "No photos returned for this album.";
  return;
}

meta.textContent = images.length + " photo" + (images.length === 1 ? "" : "s");

// Selection state for ZIP downloads
const selected = new Set();
let selectMode = false;

const albumNameForZip = (albumTitle || matchTitle || matchId || "album").trim() || "album";
const albumCtx = { title: albumNameForZip, url: matchUrl || "" };

function updateSelectUI() {
  const n = selected.size;

  selectToggle.textContent = selectMode ? "Done selecting" : "Select Photos to Download";
  dlZipBtn.disabled = !(selectMode && n > 0);
  clearBtn.disabled = !(selectMode && n > 0);
  selectAllBtn.disabled = !selectMode;

  // Only show these controls when select mode is ON
  selectAllBtn.style.display = selectMode ? "" : "none";
  dlZipBtn.style.display = selectMode ? "" : "none";
  clearBtn.style.display = selectMode ? "" : "none";

  if (selectMode) {
    statusLine.textContent = n ? (n + " selected") : "";
    selectToggle.classList.add("waSelectPrimary");
  } else {
    statusLine.textContent = "";
    selectToggle.classList.remove("waSelectPrimary");
  }
}

function redrawGrid() {
  renderPhotoGrid(grid, images, {
    onOpen: function (i) {
      openWALightbox(images, i, albumCtx);
    },
    isSelected: function (i) {
      return selected.has(String(i));
    },
    onToggleSelect: selectMode ? function (i, img, list, tileEl) {
      const k = String(i);
      if (selected.has(k)) selected.delete(k);
      else selected.add(k);
      try { if (tileEl) tileEl.classList.toggle("selected", selected.has(k)); } catch(_) {}
      updateSelectUI();
    } : null
  });
}

// Toolbar handlers
selectToggle.addEventListener("click", function () {
  selectMode = !selectMode;
  if (!selectMode) selected.clear();
  updateSelectUI();
  redrawGrid();
});

selectAllBtn.addEventListener("click", function () {
  if (!selectMode) return;
  selected.clear();
  for (let i = 0; i < images.length; i++) selected.add(String(i));
  updateSelectUI();
  redrawGrid();
});

clearBtn.addEventListener("click", function () {
  selected.clear();
  updateSelectUI();
  redrawGrid();
});

dlZipBtn.addEventListener("click", async function () {
  const n = selected.size;
  if (!n) return;

  const items = [];
  const idxs = Array.from(selected)
    .map((s) => Number(s))
    .filter((x) => Number.isFinite(x))
    .sort((a, b) => a - b);

  idxs.forEach((i) => {
    const it = images[i];
    if (!it) return;
    const url = bestFullUrl(it);
    if (!url) return;
    const filename = String(it?.FileName || `photo-${i + 1}.jpg`).trim() || `photo-${i + 1}.jpg`;
    items.push({ url, filename });
  });

  if (!items.length) {
    statusLine.textContent = "No downloadable URLs found for the selected photos.";
    return;
  }

  dlZipBtn.disabled = true;
  clearBtn.disabled = true;
  selectToggle.disabled = true;
  selectAllBtn.disabled = true;
  statusLine.textContent = `Preparing ZIP for ${items.length} photo(s)…`;

  try {
    await downloadZipFromServer(items, albumNameForZip);
    statusLine.textContent = `ZIP download started (${items.length} photo(s)).`;
  } catch (e) {
    console.warn(e);
    statusLine.textContent = "ZIP download failed. (This requires a server /zip endpoint.)";
  } finally {
    dlZipBtn.disabled = false;
    clearBtn.disabled = false;
    selectToggle.disabled = false;
    selectAllBtn.disabled = false;
    updateSelectUI();
  }
});

// Initial paint
updateSelectUI();
redrawGrid();
    } catch (err) {
      console.warn("openMatchAlbumInPanel failed", err);
      meta.textContent = "Error loading photos for this album.";
    }
  }

  // Try a list of JSON endpoints and return the first successful JSON payload.
  async function fetchJsonFirstOk(urls) {
    const list = Array.isArray(urls) ? urls : [];
    let lastErr = null;

    for (let i = 0; i < list.length; i++) {
      const u = list[i];
      if (!u) continue;

      const ac = (typeof AbortController !== "undefined") ? new AbortController() : null;
      const t = ac ? setTimeout(() => { try { ac.abort(); } catch (_) {} }, 25000) : null;

      try {
        const res = await fetch(u, { cache: "no-store", signal: ac ? ac.signal : undefined });
        if (!res.ok) {
          lastErr = new Error("HTTP " + res.status + " for " + u);
          continue;
        }

        const ct = String(res.headers.get("content-type") || "").toLowerCase();
        const bodyText = await res.text();

        // Skip HTML error pages masquerading as JSON
        if (bodyText && /^[\s]*</.test(bodyText)) {
          lastErr = new Error("Expected JSON but got HTML (" + (ct || "unknown") + ") for " + u);
          continue;
        }

        try {
          return JSON.parse(bodyText || "null");
        } catch (e) {
          lastErr = new Error("Invalid JSON for " + u + ": " + String(e && e.message ? e.message : e));
          continue;
        }
      } catch (e) {
        lastErr = e;
      } finally {
        try { if (t) clearTimeout(t); } catch (_) {}
      }
    }

    if (lastErr) throw lastErr;
    throw new Error("No endpoints tried");
  }


  
  // Resolve a SmugMug album URL into a SmugMug Shop NodeKey (and AlbumKey) using the wrestling backend.
  // This supports SmugMug's shop URL format: /shop?nodeKey=<NodeKey>
  async function resolveShopNodeFromUrl(albumUrl) {
    const u = String(albumUrl || "").trim();
    if (!u) return { nodeKey: "", albumKey: "", finalUrl: "", shopUrl: "" };

    const candidates = [
      API_BASE + "/smug/resolve-shop-node?url=" + encodeURIComponent(u),
    ];

    try {
      const json = await fetchJsonFirstOk(candidates);
      const nodeKey = (json && typeof json.nodeKey === "string") ? json.nodeKey.trim()
                    : (json && typeof json.NodeKey === "string") ? json.NodeKey.trim()
                    : (json && typeof json.nodekey === "string") ? json.nodekey.trim()
                    : "";
      const albumKey = (json && typeof json.albumKey === "string") ? json.albumKey.trim()
                    : (json && typeof json.AlbumKey === "string") ? json.AlbumKey.trim()
                    : "";
      const finalUrl = (json && typeof json.finalUrl === "string") ? json.finalUrl.trim()
                    : (json && typeof json.FinalUrl === "string") ? json.FinalUrl.trim()
                    : "";
      const shopUrl = (json && typeof json.shopUrl === "string") ? json.shopUrl.trim()
                    : (json && typeof json.ShopUrl === "string") ? json.ShopUrl.trim()
                    : "";
      return { nodeKey, albumKey, finalUrl, shopUrl };
    } catch (_) {
      return { nodeKey: "", albumKey: "", finalUrl: "", shopUrl: "" };
    }
  }

// Resolve a SmugMug album URL into an AlbumKey using the wrestling backend (endpoint names may vary).
  async function resolveAlbumKeyFromUrl(albumUrl) {
    const u = String(albumUrl || "").trim();
    if (!u) return "";

    // Some backends can return images directly by URL; try that first.
    // If that exists, it should return { albumKey, Response, ... } or similar.
    const candidates = [
      API_BASE + "/smug/resolve-album?url=" + encodeURIComponent(u),
      API_BASE + "/smug/resolve?url=" + encodeURIComponent(u),
      API_BASE + "/smug/album-from-url?url=" + encodeURIComponent(u),
      API_BASE + "/smug/url-to-album?url=" + encodeURIComponent(u),
    ];

    try {
      const json = await fetchJsonFirstOk(candidates);
      // accept several shapes
      if (json && typeof json.albumKey === "string") return json.albumKey.trim();
      if (json && typeof json.AlbumKey === "string") return json.AlbumKey.trim();
      const resp = json && json.Response;
      if (resp) {
        if (resp.Album && typeof resp.Album.AlbumKey === "string") return String(resp.Album.AlbumKey).trim();
        if (typeof resp.AlbumKey === "string") return String(resp.AlbumKey).trim();
      }
    } catch (_) {}

    // If backend doesn't support resolving, give up gracefully.
    return "";
  }

  async function fetchAllAlbumImages(albumKey) {
    if (!albumKey) return [];
    let start = 1;
    let more = true;
    const all = [];

    while (more) {
      const url = API_BASE + "/smug/album/" + encodeURIComponent(albumKey) + "?count=200&start=" + start;
      const data = await fetchJsonFirstOk([url]);
      const resp = (data && data.Response) || {};

      let imgs = [];
      if (Array.isArray(resp.AlbumImage)) imgs = resp.AlbumImage;
      else if (resp.AlbumImage) imgs = [resp.AlbumImage];
      else if (Array.isArray(resp.Images)) imgs = resp.Images;
      else if (resp.Images) imgs = [resp.Images];

      imgs = (imgs || []).filter(Boolean);
      for (let i = 0; i < imgs.length; i++) all.push(imgs[i]);

      const pages = resp.Pages || {};
      const total = Number(pages.Total) || 0;
      const perPage = Number(pages.Count) || 200;
      const gotSoFar = (start - 1) + imgs.length;

      if (!total || gotSoFar >= total || imgs.length === 0) {
        more = false;
      } else {
        start += perPage;
      }
    }

    return all;
  }

  function pickImageUrl(img, keys) {
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (!k) continue;
      const v = img && img[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  }

// ================== PHOTO UTIL + ZIP + LIGHTBOX (ported from bands) ==================
function bestFullUrl(img){
  // Prefer the highest quality URL we have from SmugMug image payloads
  // NOTE: Some SmugMug responses (esp. protected images) provide ArchivedUri instead of OriginalUrl.
  return pickImageUrl(img, [
    "OriginalUrl",
    "ArchivedUri",
    "ArchivedUrl",
    "LargestImageUrl",
    "X3LargeUrl",
    "X2LargeUrl",
    "XLargeUrl",
    "LargeUrl",
    "MediumUrl",
    "ImageUrl",
    "Url"
  ]);
}

async function downloadZipFromServer(items, suggestedName){
  // items: [{ url, filename }]
  const name = (suggestedName || "photos")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .slice(0, 80) || "photos";
  const endpoint = `${API_BASE}/zip`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items })
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`ZIP endpoint failed: ${res.status} ${t}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Lightbox (kept minimal, same behavior as bands)
let waLightboxEl = null;
let waLightboxImg = null;
let waLightboxIndex = 0;
let waCurrentViewList = [];
let waCurrentAlbumContext = { title: "", url: "" };

function ensureWALightbox(){
  if (waLightboxEl) return;

  waLightboxEl = document.createElement("div");
  waLightboxEl.className = "waLightbox";
  waLightboxEl.setAttribute("role", "dialog");
  waLightboxEl.setAttribute("aria-modal", "true");

  const shell = document.createElement("div");
  shell.className = "waLightboxShell";

  const topbar = document.createElement("div");
  topbar.className = "waLightboxTopbar";

  const title = document.createElement("div");
  title.className = "waLightboxTitle";
  title.textContent = "Photo Viewer";

  const right = document.createElement("div");
  right.className = "waLightboxActions";

  const dlBtn = document.createElement("a");
  dlBtn.className = "waLightboxBtn";
  dlBtn.textContent = "Download";
  // Some mobile webviews (and cross-origin images) ignore the download attribute.
  // We still set it for desktop, but also allow opening in a new tab.
  dlBtn.href = "#";
  dlBtn.target = "_blank";
  dlBtn.rel = "noopener";
  dlBtn.setAttribute("download", "photo.jpg");

  const closeBtn = document.createElement("button");
  closeBtn.className = "waLightboxBtn waLightboxClose";
  closeBtn.type = "button";
  closeBtn.textContent = "✕";

  right.appendChild(dlBtn);
  right.appendChild(closeBtn);

  topbar.appendChild(title);
  topbar.appendChild(right);

  const stage = document.createElement("div");
  stage.className = "waLightboxStage";

  waLightboxImg = document.createElement("img");
  waLightboxImg.className = "waLightboxImg";
  waLightboxImg.alt = "";

  const prevBtn = document.createElement("button");
  prevBtn.className = "waLightboxNav waLightboxPrev";
  prevBtn.type = "button";
  prevBtn.textContent = "←";
  prevBtn.onclick = (e) => { e.stopPropagation(); waShowAt(waLightboxIndex - 1); };

  const nextBtn = document.createElement("button");
  nextBtn.className = "waLightboxNav waLightboxNext";
  nextBtn.type = "button";
  nextBtn.textContent = "→";
  nextBtn.onclick = (e) => { e.stopPropagation(); waShowAt(waLightboxIndex + 1); };

  stage.appendChild(waLightboxImg);
  stage.appendChild(prevBtn);
  stage.appendChild(nextBtn);

  shell.appendChild(topbar);
  shell.appendChild(stage);
  waLightboxEl.appendChild(shell);
  document.body.appendChild(waLightboxEl);

  const destroy = () => destroyWALightbox();
  closeBtn.addEventListener("click", destroy);
  waLightboxEl.addEventListener("click", (e) => { if (e.target === waLightboxEl) destroy(); });

  const onKey = (e) => {
    if (!waLightboxEl) return;
    if (e.key === "Escape") { e.preventDefault(); destroy(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); waShowAt(waLightboxIndex - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); waShowAt(waLightboxIndex + 1); }
  };
  window.addEventListener("keydown", onKey);

  waLightboxEl._onKey = onKey;
  waLightboxEl._titleEl = title;
  waLightboxEl._dlBtn = dlBtn;

  try { document.documentElement.style.overflow = "hidden"; } catch(_) {}
}

function destroyWALightbox(){
  if (!waLightboxEl) return;
  try {
    const onKey = waLightboxEl._onKey;
    if (onKey) window.removeEventListener("keydown", onKey);
  } catch(_) {}
  try { document.documentElement.style.overflow = ""; } catch(_) {}
  try { waLightboxEl.remove(); } catch(_) {}
  waLightboxEl = null;
  waLightboxImg = null;
  waCurrentViewList = [];
}

function waShowAt(idx){
  if (!waLightboxEl || !waLightboxImg || !waCurrentViewList.length) return;
  if (idx < 0) idx = waCurrentViewList.length - 1;
  if (idx >= waCurrentViewList.length) idx = 0;
  waLightboxIndex = idx;

  const img = waCurrentViewList[idx] || {};
  const url = bestFullUrl(img);
  try { waLightboxImg.style.opacity = "0"; } catch(_) {}
  waLightboxImg.onload = () => { try { waLightboxImg.style.opacity = "1"; } catch(_) {} };
  waLightboxImg.src = url || "";

  try {
    const t = waLightboxEl._titleEl;
    if (t) {
      const base = String(waCurrentAlbumContext?.title || "Photo Viewer").trim() || "Photo Viewer";
      t.textContent = `${base}  •  ${idx + 1} / ${waCurrentViewList.length}`;
    }

    const dl = waLightboxEl._dlBtn;
    if (dl) {
      const fn = String(img?.FileName || `photo-${idx+1}.jpg`).trim() || `photo-${idx+1}.jpg`;
      dl.href = url || "#";
      dl.setAttribute("download", fn);
      dl.style.pointerEvents = url ? "auto" : "none";
      dl.style.opacity = url ? "1" : "0.55";
    }
  } catch(_) {}
}

function openWALightbox(images, startIndex, ctx){
  waCurrentViewList = Array.isArray(images) ? images : [];
  waCurrentAlbumContext = ctx || { title: "", url: "" };
  ensureWALightbox();
  waShowAt(Number(startIndex) || 0);
}



  
function renderPhotoGrid(gridEl, images, opts) {
  if (!gridEl) return;
  const imgs = Array.isArray(images) ? images : [];
  const onOpen = (opts && typeof opts.onOpen === "function") ? opts.onOpen : null;
  const onToggleSelect = (opts && typeof opts.onToggleSelect === "function") ? opts.onToggleSelect : null;
  const isSelected = (opts && typeof opts.isSelected === "function") ? opts.isSelected : null;

  gridEl.innerHTML = "";

  for (let i = 0; i < imgs.length; i++) {
    const img = imgs[i] || {};
    const thumb = pickImageUrl(img, ["ThumbnailUrl", "ThumbUrl", "SmallUrl", "TinyUrl", "OriginalUrl"]);
    const full = bestFullUrl(img);

    const box = document.createElement("div");
    box.className = "waPhotoBox";
    box.dataset.index = String(i);
    box.setAttribute("role", "button");
    box.setAttribute("tabindex", "0");

    const badge = document.createElement("div");
    badge.className = "waPhotoIndex";
    badge.textContent = "#" + String(i + 1);
    box.appendChild(badge);

    const im = document.createElement("img");
    im.loading = "lazy";
    im.alt = "";
    im.src = thumb || full || "";
    box.appendChild(im);

    // Selection state (if provided)
    try {
      if (isSelected) box.classList.toggle("selected", !!isSelected(i));
    } catch(_) {}

    const open = function () {
      if (onOpen) return onOpen(i, img, imgs);
      if (!full) return;
      try { window.open(full, "_blank", "noopener"); } catch (_) {}
    };

    const toggle = function () {
      if (onToggleSelect) return onToggleSelect(i, img, imgs, box);
    };

    box.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (onToggleSelect) toggle();
      else open();
    });
    box.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        if (onToggleSelect) toggle();
        else open();
      }
    });

    gridEl.appendChild(box);
  }
}



  // Classic args signature for broader compatibility (some embedded webviews can choke on destructuring)
  function buildMatchHeader(type, stip, partTitle) {
    const t = String(type || "").trim();
    const s = String(stip || "").trim();
    const p = String(partTitle || "").trim();

    const isSeg = (v) => {
      const n = String(v || "").trim().toLowerCase();
      return (
        n === "promo" ||
        n === "segment" ||
        n === "backstage" ||
        n === "interview" ||
        n === "angle" ||
        n === "vignette" ||
        n.indexOf("promo") !== -1 ||
        n.indexOf("segment") !== -1
      );
    };

    const hasMatchWord = (v) => /\bmatch\b/i.test(String(v || ""));
    const hasVsWord = (v) => /\bvs\.?\b/i.test(String(v || ""));

    // Prefer a custom title if provided.
    if (p) {
      // If it's a segment/promo, never append "Match".
      if (isSeg(t)) return p;
      // If it already contains match language, keep it as-is.
      if (hasMatchWord(p) || hasVsWord(p)) return p;
      return `${p} Match`;
    }

    // Next preference: stipulation
    if (s) {
      if (isSeg(t)) return s;
      if (hasMatchWord(s) || hasVsWord(s)) return s;
      return `${s} Match`;
    }

    // Fallback: type
    if (t) {
      if (isSeg(t)) return t;
      if (hasMatchWord(t)) return t;
      return `${t} Match`;
    }

    return "Match";
  }


  // ================== KEYWORD SEARCH MODAL (ALBUM KEYWORDS) ==================
  // Used when clicking "People in this album" chips on match albums.
  // Searches other albums by ALBUM keyword (server must implement one of the endpoints below).
  let _waKwModal = null;
  let _waKwModalBody = null;
  let _waKwModalTitle = null;
  let _waKwModalCount = null;
  // Context so modal results can open inside the HUD (no new window) and return back to the show.
  // Set when opening the modal from a match album keyword chip.
  let _waKwCtx = null;

  function ensureWrestlingKeywordSearchStyles() {
    if (document.getElementById("waKeywordSearchStyles")) return;
    const s = document.createElement("style");
    s.id = "waKeywordSearchStyles";
    s.textContent = `
/* Keyword search modal (scoped global, unique class prefix) */
.waKwOverlay{
  position: fixed;
  inset: 0;
  z-index: 999999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgba(0,0,0,0.68);
}
.waKwModal{
  width: min(980px, 96vw);
  max-height: min(78vh, 760px);
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.12);
  background: radial-gradient(120% 140% at 0% 0%, rgba(200,0,0,0.25) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.40) 100%);
  box-shadow: 0 30px 70px rgba(0,0,0,0.55);
  backdrop-filter: blur(10px);
}
.waKwTopbar{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.10);
}
.waKwTitleWrap{ min-width:0; }
.waKwTitle{
  font-family: "Orbitron", system-ui, sans-serif !important;
  letter-spacing: .08em;
  font-size: 14px;
  font-weight: 900;
  margin: 0;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.waKwSub{
  font-size: 12px;
  letter-spacing: .10em;
  opacity: .80;
  margin-top: 6px;
}
.waKwClose{
  appearance:none;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(0,0,0,0.22);
  color: rgba(226,232,240,0.92);
  border-radius: 999px;
  padding: 8px 12px;
  font-family: "Orbitron", system-ui, sans-serif !important;
  font-size: 11px;
  letter-spacing: .10em;
  cursor: pointer;
}
.waKwClose:hover{ border-color: rgba(200,0,0,0.55); }
.waKwBody{
  padding: 14px 16px 16px;
  overflow: auto;
  max-height: calc(min(78vh, 760px) - 64px);
}
.waKwStatus{
  text-align:center;
  font-size: 12px;
  letter-spacing: .10em;
  opacity: .82;
  padding: 14px 0;
}
.waKwItem{
  display:flex;
  align-items:center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(15, 23, 42, 0.22);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
  margin-bottom: 10px;
}
.waKwItem:hover{
  background: rgba(30, 41, 59, 0.35);
  border-color: rgba(255,255,255,0.14);
  transform: translateY(-1px);
}
.waKwThumb{
  width: 44px;
  height: 44px;
  border-radius: 10px;
  overflow:hidden;
  flex: 0 0 auto;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(0,0,0,0.35);
}
.waKwThumb img{ width:100%; height:100%; object-fit:cover; display:block; }
.waKwText{ min-width:0; display:flex; flex-direction:column; gap: 4px; }
.waKwLine1{ font-size: 13px; font-weight: 900; }
.waKwLine2{ font-size: 11px; opacity: .82; letter-spacing: .06em; }
`;
    document.head.appendChild(s);
  }

  function ensureWrestlingKeywordSearchModal() {
    if (_waKwModal) return;
    ensureWrestlingKeywordSearchStyles();

    const overlay = document.createElement("div");
    overlay.className = "waKwOverlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    const modal = document.createElement("div");
    modal.className = "waKwModal";

    const topbar = document.createElement("div");
    topbar.className = "waKwTopbar";

    const titleWrap = document.createElement("div");
    titleWrap.className = "waKwTitleWrap";

    const title = document.createElement("div");
    title.className = "waKwTitle";
    title.textContent = "";

    const sub = document.createElement("div");
    sub.className = "waKwSub";
    sub.textContent = "Also appears in these albums (Note: This is broken at the moment, will just bring you back to the same album. It will be fixed soon):";

    titleWrap.appendChild(title);
    titleWrap.appendChild(sub);

    const close = document.createElement("button");
    close.className = "waKwClose";
    close.type = "button";
    close.textContent = "Close";

    topbar.appendChild(titleWrap);
    topbar.appendChild(close);

    const body = document.createElement("div");
    body.className = "waKwBody";

    modal.appendChild(topbar);
    modal.appendChild(body);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const destroy = function () { closeWrestlingKeywordSearchModal(); };
    close.addEventListener("click", destroy);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) destroy(); });

    const onKey = function (e) {
      if (!_waKwModal) return;
      if (e.key === "Escape") { e.preventDefault(); destroy(); }
    };
    window.addEventListener("keydown", onKey);

    overlay._onKey = onKey;
    _waKwModal = overlay;
    _waKwModalBody = body;
    _waKwModalTitle = title;
    _waKwModalCount = sub;

    try { document.documentElement.style.overflow = "hidden"; } catch (_) {}
  }

  function closeWrestlingKeywordSearchModal() {
    if (!_waKwModal) return;
    try {
      const onKey = _waKwModal._onKey;
      if (onKey) window.removeEventListener("keydown", onKey);
    } catch (_) {}
    try { document.documentElement.style.overflow = ""; } catch (_) {}
    try { _waKwModal.remove(); } catch (_) {}
    _waKwModal = null;
    _waKwModalBody = null;
    _waKwModalTitle = null;
    _waKwModalCount = null;
    _waKwCtx = null;
  }

  function setKwBodyStatus(text) {
    if (!_waKwModalBody) return;
    _waKwModalBody.innerHTML = "";
    const st = document.createElement("div");
    st.className = "waKwStatus";
    st.textContent = text;
    _waKwModalBody.appendChild(st);
  }

  // Attempt multiple possible backend endpoints (fail-soft). Expected to return a list of albums.
  
  // POST helper for keyword searches (some backends only accept POST).
  async function postJsonFirstOk(urls, payload) {
    const list = Array.isArray(urls) ? urls : [];
    let lastErr = null;

    for (let i = 0; i < list.length; i++) {
      const u = list[i];
      if (!u) continue;

      const ac = (typeof AbortController !== "undefined") ? new AbortController() : null;
      const t = ac ? setTimeout(() => { try { ac.abort(); } catch (_) {} }, 25000) : null;

      try {
        const res = await fetch(u, {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload || {}),
          signal: ac ? ac.signal : undefined
        });

        if (!res.ok) {
          lastErr = new Error("HTTP " + res.status + " for " + u);
          continue;
        }

        const bodyText = await res.text();

        // Skip HTML error pages masquerading as JSON
        if (bodyText && /^[\s]*</.test(bodyText)) {
          lastErr = new Error("Expected JSON but got HTML for " + u);
          continue;
        }

        try {
          return JSON.parse(bodyText || "null");
        } catch (e) {
          lastErr = new Error("Invalid JSON for " + u + ": " + String(e && e.message ? e.message : e));
          continue;
        }
      } catch (e) {
        lastErr = e;
      } finally {
        try { if (t) clearTimeout(t); } catch (_) {}
      }
    }

    if (lastErr) throw lastErr;
    throw new Error("No endpoints tried");
  }

  async function fetchAlbumsByKeywordFromServer(keyword) {
    const kw = String(keyword || "").trim();
    if (!kw) return [];

    // Some backends scope searches by folder/section; include best-effort scope hints.
    const scopeParams = [
      "", // plain
      "&scope=wrestling",
      "&section=wrestling",
      "&base=Wrestling",
      "&folder=Wrestling",
      "&path=%2FWrestling",
    ];

    // Try multiple endpoint + param name variants (server may differ from music side).
    const endpoints = [
      "/smug/albums-by-keyword",
      "/smug/search-albums-by-keyword",
      "/smug/search-albums",
      "/smug/keyword-search",
      "/keyword-search",
      "/smug/albumsByKeyword",
      "/smug/search",
      "/search-albums-by-keyword",
      "/albums-by-keyword",
    ];

    const params = [
      (k) => `keyword=${encodeURIComponent(k)}`,
      (k) => `kw=${encodeURIComponent(k)}`,
      (k) => `q=${encodeURIComponent(k)}`,
      (k) => `term=${encodeURIComponent(k)}`,
      (k) => `name=${encodeURIComponent(k)}`,
    ];

    const candidates = [];
    for (let i = 0; i < endpoints.length; i++) {
      for (let j = 0; j < params.length; j++) {
        for (let s = 0; s < scopeParams.length; s++) {
          candidates.push(`${API_BASE}${endpoints[i]}?${params[j](kw)}${scopeParams[s]}`);
        }
      }
    }

    let json = null;
    try {
      json = await fetchJsonFirstOk(candidates);
    } catch (_) {
      json = null;
    }

    // If GET candidates didn't work, try POST (some servers only accept POST for searches).
    if (!json) {
      try {
        json = await postJsonFirstOk(
          [
            `${API_BASE}/smug/albums-by-keyword`,
            `${API_BASE}/smug/search-albums-by-keyword`,
            `${API_BASE}/smug/search-albums`,
            `${API_BASE}/smug/keyword-search`,
            `${API_BASE}/keyword-search`,
          ],
          { keyword: kw, scope: "wrestling", section: "wrestling" }
        );
      } catch (_) {
        json = null;
      }
    }

    // Accept common shapes:
    //  - { albums: [...] }
    //  - { results: [...] }
    //  - { data: [...] }
    //  - { Response: { Album: [...] } }
    if (json && Array.isArray(json.albums)) return json.albums;
    if (json && Array.isArray(json.results)) return json.results;
    if (json && Array.isArray(json.data)) return json.data;
    if (json && json.Response) {
      const r = json.Response;
      if (Array.isArray(r.Album)) return r.Album;
      if (r.Album) return Array.isArray(r.Album) ? r.Album : [r.Album];
    }

    // Some servers respond with {items:[...]} or {Albums:[...]}
    if (json && Array.isArray(json.items)) return json.items;
    if (json && Array.isArray(json.Albums)) return json.Albums;

    // If server returns a raw array
    if (Array.isArray(json)) return json;
    return [];
  }
  // Best-effort getters across possible album result shapes
  function albumTitleFromResult(a) {
    return String(
      (a && (a.title || a.Title || a.name || a.Name || a.albumTitle || a.AlbumTitle)) ||
      ""
    ).trim();
  }
  function albumDateFromResult(a) {
    // Prefer an explicit date from the server; otherwise derive from UriPath/WebUri using the
    // /Wrestling/<Fed>/<MMDDYY>/... convention.
    const raw = String((a && (a.date || a.Date || a.show_date || a.ShowDate)) || "").trim();
    if (raw) return raw;

    const uriPath = String((a && (a.uriPath || a.UriPath || a.uripath)) || "").trim();
    const url = albumUrlFromResult(a);
    const mmddyy = extractMMDDYYFromWrestlingPath(uriPath || url);
    return mmddyy ? formatPrettyDateFromMMDDYY(mmddyy) : "";
  }

  function extractMMDDYYFromWrestlingPath(pathOrUrl) {
    const v = String(pathOrUrl || "").trim();
    if (!v) return "";
    let p = v;
    try {
      if (/^https?:\/\//i.test(v)) p = (new URL(v)).pathname || "";
    } catch (_) {}
    const parts = String(p || "").split("/").filter(Boolean);
    // Expect: Wrestling/<fed>/<mmddyy>/...
    for (let i = 0; i < parts.length - 2; i++) {
      if (String(parts[i]).toLowerCase() === "wrestling" && /^\d{6}$/.test(parts[i + 2])) {
        return parts[i + 2];
      }
    }
    return "";
  }

  function formatPrettyDateFromMMDDYY(mmddyy) {
    const s = String(mmddyy || "").trim();
    if (!/^\d{6}$/.test(s)) return "";
    const mm = Number(s.slice(0, 2));
    const dd = Number(s.slice(2, 4));
    const yy = Number(s.slice(4, 6));
    if (!mm || !dd) return "";
    const year = 2000 + (Number.isFinite(yy) ? yy : 0);
    const date = new Date(year, mm - 1, dd);
    if (isNaN(date.getTime())) return "";
    const monthName = date.toLocaleString("en-US", { month: "long" });
    const suffix =
      dd % 10 === 1 && dd !== 11 ? "st" :
      dd % 10 === 2 && dd !== 12 ? "nd" :
      dd % 10 === 3 && dd !== 13 ? "rd" :
      "th";
    return `${monthName} ${dd}${suffix}, ${year}`;
  }
  function albumCompanyFromResult(a) {
    return String((a && (a.company || a.Company)) || "").trim();
  }
  function albumShowNameFromResult(a) {
    return String((a && (a.showName || a.ShowName || a.show_name || a["show_name"])) || "").trim();
  }

  function albumThumbFromResult(a) {
    return String(
      (a && (a.thumb || a.thumbnail || a.ThumbnailUrl || a.ThumbUrl || a.thumbUrl || a.thumbnailUrl)) ||
      ""
    ).trim();
  }
  function albumUrlFromResult(a) {
    return String(
      (a && (a.url || a.Url || a.webUrl || a.WebUrl || a.permalink || a.Permalink)) ||
      ""
    ).trim();
  }
  function albumKeyFromResult(a) {
    return String((a && (a.albumKey || a.AlbumKey || a.Key)) || "").trim();
  }

  // Exposed handler for keyword chips
  async function openWrestlingKeywordSearchModal(keyword, ctx) {
    const kw = String(keyword || "").trim();
    if (!kw) return;
    trackWrestlingShowsEvent("wrestling_search", {
      entity_type: "page",
      entity_id: kw.toLowerCase(),
      entity_label: kw,
      meta: {
        keyword: kw,
        from_album_title: String(ctx && ctx.fromAlbumTitle || "").trim(),
        from_album_key: String(ctx && ctx.fromAlbumKey || "").trim()
      }
    });

    // Store context so clicking a result can open INSIDE the HUD (no new window).
    _waKwCtx = (ctx && typeof ctx === "object") ? ctx : null;

    // Normalize URLs/paths for comparisons (strip origin, query/hash, trailing slash)
    function _waNormPath(u) {
      const v = String(u || "").trim();
      if (!v) return "";
      try {
        if (/^https?:\/\//i.test(v)) {
          const p = (new URL(v)).pathname || "";
          return String(p).replace(/\/+$/, "").toLowerCase();
        }
      } catch (_) {}
      // Treat as path
      return String(v)
        .replace(/^[A-Za-z]+:\/\//, "")
        .replace(/\?.*$/, "")
        .replace(/#.*$/, "")
        .replace(/\/+$/, "")
        .toLowerCase();
    }

    ensureWrestlingKeywordSearchModal();
    if (_waKwModalTitle) _waKwModalTitle.textContent = kw;
    if (_waKwModalCount) _waKwModalCount.textContent = "Also appears in these albums (Note: This is broken at the moment, will just bring you back to the same album. It will be fixed soon): Searching…";
    setKwBodyStatus("Searching albums…");

    let albums = [];
    try {
      albums = await fetchAlbumsByKeywordFromServer(kw);
    } catch (e) {
      console.warn("Keyword search failed", e);
      if (_waKwModalCount) _waKwModalCount.textContent = "Also appears in these albums (Note: This is broken at the moment, will just bring you back to the same album. It will be fixed soon):";
      setKwBodyStatus("Search unavailable (server endpoint not configured yet).");
      return;
    }

    let list = (albums || []).filter(Boolean);

    // If invoked from within a match album, exclude that same album from the result list.
    // This prevents a click loop where the top result re-opens the current album.
    try {
      const fromKey = _waKwCtx && _waKwCtx.fromAlbumKey ? String(_waKwCtx.fromAlbumKey).trim() : "";
      const fromPath = _waKwCtx && _waKwCtx.fromAlbumUrl ? _waNormPath(_waKwCtx.fromAlbumUrl) : "";
      if (fromKey || fromPath) {
        list = list.filter(function (a) {
          if (!a) return false;
          if (fromKey) {
            const k = albumKeyFromResult(a);
            if (k && k === fromKey) return false;
          }
          if (fromPath) {
            const u = albumUrlFromResult(a);
            if (u && _waNormPath(u) === fromPath) return false;

            const uriPath = String((a && (a.uriPath || a.UriPath || a.uripath)) || "").trim();
            if (uriPath && _waNormPath(uriPath) === fromPath) return false;
          }
          return true;
        });
      }
    } catch (_) {}
    if (_waKwModalCount) {
      _waKwModalCount.textContent = `Also appears in these albums ((Note: This is broken at the moment, will just bring you back to the same album. It will be fixed soon)): ${list.length} album${list.length === 1 ? "" : "s"} found`;
    }

    if (!_waKwModalBody) return;
    _waKwModalBody.innerHTML = "";

    if (!list.length) {
      setKwBodyStatus("No albums found.");
      return;
    }

    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const title = albumTitleFromResult(a) || "(Untitled album)";
      const date = albumDateFromResult(a);
      const thumb = albumThumbFromResult(a);
      const url = albumUrlFromResult(a);
      const albumKey = albumKeyFromResult(a);

      const item = document.createElement("div");
      item.className = "waKwItem";
      item.setAttribute("role", "button");
      item.setAttribute("tabindex", "0");

      const th = document.createElement("div");
      th.className = "waKwThumb";
      if (thumb) {
        const im = document.createElement("img");
        im.loading = "lazy";
        im.alt = "";
        im.src = thumb;
        th.appendChild(im);
      }

      const tx = document.createElement("div");
      tx.className = "waKwText";
      const l1 = document.createElement("div");
      l1.className = "waKwLine1";
      l1.textContent = title;
      const l2 = document.createElement("div");
      l2.className = "waKwLine2";
      const company = albumCompanyFromResult(a);
      const showName = albumShowNameFromResult(a);

      // Desired format: Company – Show Name – Date (best-effort; omit blanks cleanly)
      const parts = [];
      if (company) parts.push(company);
      if (showName) parts.push(showName);
      if (date) parts.push(date);
      l2.textContent = parts.join(" – ");

      tx.appendChild(l1);
      if (parts.length) tx.appendChild(l2);

      item.appendChild(th);
      item.appendChild(tx);

      const open = function () {
        // Prefer URL from server; otherwise fall back to UriPath; otherwise build a /gallery/<AlbumKey> URL.
        const uriPath = String((a && (a.uriPath || a.UriPath || a.uripath)) || "").trim();
        const targetUrl =
          (url ? url : (uriPath ? (SMUG_ORIGIN.replace(/\/$/, "") + (uriPath.startsWith("/") ? uriPath : ("/" + uriPath))) : "")) ||
          (albumKey ? (SMUG_ORIGIN.replace(/\/$/, "") + "/gallery/" + encodeURIComponent(albumKey)) : "");

        if (!targetUrl) return;

        // If we have show context, open inside the HUD (match album view), not a new window.
        if (_waKwCtx && _waKwCtx.showRow) {
          try { closeWrestlingKeywordSearchModal(); } catch (_) {}
          runNeonShutterTransition(function () {
            openMatchAlbumInPanel(targetUrl, title, ((albumKey && /^[A-Za-z0-9]+$/.test(albumKey)) ? albumKey : ("kw-" + String(i + 1))), _waKwCtx.showRow);
          });
          return;
        }

        // Fail-soft: stay in the same tab (still avoids "new window" behavior).
        try { window.location.href = targetUrl; } catch (_) {}
      };

      item.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        open();
      });
      item.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          open();
        }
      });

      _waKwModalBody.appendChild(item);
    }
  }

  // ================== EXPORT ==================
  window.WrestlingArchiveShows = {
    render,
    onMount,
    destroy,
  };
})();
