// music-archive-shows.js
(function () {
  "use strict";

  // --- Shows state persistence (so tab switching doesn't reset) ---
  const SHOWS_STATE_KEY = "musicArchive_shows_state_v1";
  function loadShowsState() {
    try {
      return JSON.parse(sessionStorage.getItem(SHOWS_STATE_KEY) || "{}") || {};
    } catch (_) {
      return {};
    }
  }
  function saveShowsState(patch) {
    try {
      const cur = loadShowsState();
      const next = Object.assign({}, cur, patch || {});
      sessionStorage.setItem(SHOWS_STATE_KEY, JSON.stringify(next));
      return next;
    } catch (_) {
      return null;
    }
  }
  function cssEscape(str){
    try {
      return (window.CSS && CSS.escape) ? CSS.escape(String(str)) : String(str).replace(/"/g, '\\\"');
    } catch (_) {
      return String(str).replace(/"/g, '\\\"');
    }
  }
  function makeShowId(show) {
    const d = String(show?.date || "").trim();
    const t = String(show?.title || "").trim().toLowerCase();
    return (d + "|" + t).replace(/\s+/g, " ").slice(0, 180);
  }


  // Optional: inject shows-only CSS once
  function ensureShowsStyles() {
    if (document.getElementById("musicShowsStyles")) return;
    const s = document.createElement("style");
    s.id = "musicShowsStyles";
    s.textContent = `
      /* Shows-only styles live here */
      .showsWrap{
        width:100%;
        max-width:1100px;
        margin:0 auto;
        box-sizing:border-box;

        /* Keep content top-aligned inside the parent panel */
        height:100%;
        min-height:100%;
        min-height:0; /* allow inner scroller to size correctly */
        align-self:stretch;

        display:flex;
        flex-direction:column;
        justify-content:flex-start;

        /* tweak top/bottom spacing */
        padding-top: 8px;
        padding-bottom: 84px; /* room for bottom nav on small screens */
      }
      /* Year pills row (styled to match the main nav tabs look) */
      #showsYearsMount{
        display:flex;

        padding: 10px 10px;
        margin: 10px auto 8px;

        /* Keep years bar readable: don't let tiles visually scroll behind it */
        backdrop-filter: blur(6px);
        background: rgba(0,0,0,0.18);
        border-bottom: 1px solid rgba(255,255,255,0.06);

        flex-wrap:wrap;
        gap: 12px;
        justify-content:center;
        align-items:center;
      }

      /* Make the content area the scroller so cards never scroll behind the years bar */
      #showsYearContent{
        flex: 1 1 auto;
        min-height: 0; /* critical for flexbox scrolling */
        overflow-y: auto;
        overflow-x: hidden;
        padding-bottom: 84px; /* room for bottom nav on small screens */
      }

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

      /* underline accent like the nav tabs */
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
        background: transparent;
      }

      .YearPillActive::after{
        opacity: 1;
        transform: translateY(0px);
        box-shadow: 0 0 12px rgba(236,72,153,0.55);
      }

      /* Year instruction / empty state */

      .showsNote{
        text-align:center;
        color: rgba(255,255,255,0.75);
        font-size:12px;
        margin: 4px 0 14px;
      }

      /* Shows grid: 2 columns desktop, 1 column mobile */
      .showsGrid{
        width:100%;
        display:grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
        align-items:start;
      }
      @media (max-width: 860px){
        .showsGrid{ grid-template-columns: 1fr; }
      }

      /* Individual show tile */
      .showTile{
        border:1px solid rgba(255,255,255,0.10);
        border-radius: 14px;
        background: rgba(255,255,255,0.04);
        overflow:hidden;
      }
      .showTileHeader{
        display:flex;
        gap: 14px;
        padding: 14px;
        align-items:flex-start;
      }
      .showPosterWrap{
        flex:0 0 auto;
        width: 110px;
      }

      .showPosterPlaceholder{
        width:110px;
        height:160px;
        border:1px solid rgba(255,255,255,0.35);
        border-radius:10px;
        display:flex;
        align-items:center;
        justify-content:center;
        color: rgba(255,255,255,0.55);
        font-size:12px;
        font-weight:700;
        letter-spacing:0.08em;
      }
      @media (max-width: 420px){
        .showPosterPlaceholder{ width:92px; height:134px; }
      }

      .showPoster{
        width:110px;
        height:auto;
        border-radius: 10px;
        display:block;
        box-shadow: 0 6px 16px rgba(0,0,0,0.35);
      }
      @media (max-width: 420px){
        .showTileHeader{ gap: 10px; padding: 12px; }
        .showPosterWrap{ width: 92px; }
        .showPoster{ width: 92px; }
      }

      .showMeta{
        flex:1 1 auto;
        min-width:0;
      }
      .showTitle{
        font-weight:700;
        font-size:14px;
        color: rgba(255,255,255,0.94);
        margin: 0 0 4px;
      }
      .showDate{
        font-size:12px;
        color: rgba(148,163,184,0.95);
        margin: 0 0 6px;
      }
      .showVenue{
        font-size:12px;
        color: rgba(255,255,255,0.75);
        margin: 0 0 8px;
      }
      .showCamera{
        font-size:11px;
        color: rgba(255,255,255,0.60);
        font-style: italic;
        margin: 0 0 0;
      }

      .showActions{
        display:flex;
        gap: 8px;
        margin-top: 10px;
        flex-wrap: wrap;
      }
      .showBtn{
        cursor:pointer;
        padding:6px 10px;
        border-radius: 10px;
        border:1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.88);
        font-size:12px;
        line-height: 1;
        user-select:none;
      }
      .showBtn:hover{ background: rgba(255,255,255,0.10); }

      /* Expanded area (bands) – smoother animated accordion
         Notes:
         - Keep padding on an inner wrapper so we don't animate padding (less jank)
         - Use a nicer easing curve + slightly longer duration
      */
      .showExpand{
        max-height: 0;
        opacity: 0;
        transform: translate3d(0,-6px,0);
        overflow: hidden;
        contain: layout paint;

        transition:
          max-height .42s cubic-bezier(0.2, 0, 0, 1),
          opacity .26s cubic-bezier(0.2, 0, 0, 1),
          transform .26s cubic-bezier(0.2, 0, 0, 1);
        will-change: max-height, opacity, transform;
      }
      .showTile.isOpen .showExpand{
        max-height: 1000px; /* large enough for most band lists */
        opacity: 1;
        transform: translate3d(0,0,0);
      }

      .showExpandInner{
        padding: 0 14px 14px;
      }

      @media (prefers-reduced-motion: reduce){
        .showExpand{
          transition: none !important;
          transform: none !important;
        }
      }


      /* List-style bands (small logos + pulsing status dot) */
      .bandGrid{
        display:flex;
        flex-direction:column;
        gap: 6px;
      }

      .bandCard{
        border-radius: 12px;
        padding: 8px 10px;
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(0,0,0,0.16);

        display:flex;
        flex-direction:row;
        align-items:center;
        justify-content:flex-start;
        gap: 10px;

        min-height: 0;
        text-align:left;
      }

      .statusDot{
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: rgba(148,163,184,0.55);
        box-shadow: 0 0 0 0 rgba(148,163,184,0.0);
        flex: 0 0 auto;
      }

      /* Dot colors + pulse tied to your existing isGood / isBad logic */
      .bandCard.isGood .statusDot{
        background: rgba(34,197,94,0.95);
        animation: statusPulse 1.25s ease-out infinite;
      }
      .bandCard.isBad .statusDot{
        background: rgba(239,68,68,0.92);
        animation: statusPulse 1.25s ease-out infinite;
      }

      @keyframes statusPulse{
        0%   { transform: scale(0.92); box-shadow: 0 0 0 0 rgba(255,255,255,0.0); }
        70%  { transform: scale(1.00); box-shadow: 0 0 0 8px rgba(255,255,255,0.0); }
        100% { transform: scale(0.92); box-shadow: 0 0 0 0 rgba(255,255,255,0.0); }
      }

      .bandLogo{
        width: 28px;
        height: 28px;
        object-fit: cover;
        border-radius: 8px;
        background: rgba(255,255,255,0.06);
        flex: 0 0 auto;
      }

      .bandName{
        font-size: 12px;
        color: rgba(255,255,255,0.90);
        line-height: 1.15;
        word-break: break-word;
      }
      /* "More" dropdown */
      .YearsMoreWrap{ position: relative; }
      .YearsMoreBtn{
        cursor:pointer;
        padding:6px 12px;
        border-radius:999px;
        border:1px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.92);
        font-size:12px;
        user-select:none;
        line-height:1;
      }
      .YearsMoreMenu{
        position:absolute;
        top: calc(100% + 8px);
        right: 0;
        z-index: 50;
        min-width: 170px;
        background: rgba(15,23,42,0.98);
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 12px;
        padding: 6px;
        box-shadow: 0 10px 22px rgba(0,0,0,0.35);
      }
      .YearsMoreItem{
        cursor:pointer;
        padding: 8px 10px;
        border-radius: 10px;
        color: rgba(255,255,255,0.86);
        font-size: 12px;
      }
      .YearsMoreItem:hover{ background: rgba(255,255,255,0.08); }
      .YearsMoreItem.isActive{ background: rgba(255,255,255,0.16); }
      `;
document.head.appendChild(s);
  }
  
  function getScrollParent(el) {
  let node = el;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  // fallback (SmugMug sometimes uses document scrolling)
  return document.scrollingElement || document.documentElement;
}

function getScrollableAncestors(el) {
  const out = [];
  let node = el;

  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const oy = style.overflowY;
    const ox = style.overflowX;

    const canScrollY = (oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight;
    const canScrollX = (ox === "auto" || ox === "scroll") && node.scrollWidth > node.clientWidth;

    if (canScrollY || canScrollX) out.push(node);
    node = node.parentElement;
  }

  const doc = document.scrollingElement || document.documentElement;
  if (doc) out.push(doc);

  return out;
}

function saveScrollSnapshot(fromEl) {
  return getScrollableAncestors(fromEl).map((el) => ({
    el,
    top: el.scrollTop,
    left: el.scrollLeft,
  }));
}

function restoreScrollSnapshot(snapshot) {
  if (!snapshot) return;
  for (const s of snapshot) {
    try {
      s.el.scrollTop = s.top;
      s.el.scrollLeft = s.left;
    } catch (_) {}
  }
}



  function mountYearsPillsOverflow({
    containerEl,
    years, // array like [2026, 2025, ...]
    activeYear, // number
    maxVisible = 4, // how many pills before overflow
    onSelectYear, // function(year) {}
    pillClass = "YearPill",
    pillActiveClass = "YearPillActive",
    moreLabel = "More ▾",
  }) {
    if (!containerEl) return;

    const sorted = [...years]
      .map(Number)
      .filter(Boolean)
      .sort((a, b) => b - a);

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
          ${visible
            .map(
              (y) => `
            <button type="button"
              class="${pillClass} ${y === activeYear ? pillActiveClass : ""}"
              data-year="${y}"
              role="tab"
              aria-selected="${y === activeYear ? "true" : "false"}">
              ${y}
            </button>
          `,
            )
            .join("")}
        </div>

        ${
          overflow.length
            ? `
          <div class="yearsMore">
            <button type="button"
              class="${pillClass}"
              data-years-more="1"
              aria-haspopup="menu"
              aria-expanded="false">
              ${moreLabel}
            </button>
            <div class="yearsMenu" role="menu" aria-label="More years">
              ${overflow
                .map(
                  (y) => `
                <button type="button" class="menuItem" role="menuitem" data-year="${y}">
                  ${y}
                </button>
              `,
                )
                .join("")}
            </div>
          </div>
        `
            : ""
        }
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

    function openMenu() {
      if (!menu || !moreBtn) return;
      menu.classList.add("isOpen");
      moreBtn.setAttribute("aria-expanded", "true");
    }

    // Click handlers (year selection + More toggle)
    // Prevent stacking multiple handlers if mountYearsPillsOverflow is called again.
    if (containerEl._yearsClickHandler) {
      containerEl.removeEventListener("click", containerEl._yearsClickHandler);
    }

    containerEl._yearsClickHandler = (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      if (btn.dataset.yearsMore === "1") {
        if (!menu) return;
        const isOpen = menu.classList.contains("isOpen");
        isOpen ? closeMenu() : openMenu();
        return;
      }

      const yearStr = btn.dataset.year;
      if (!yearStr) return;
      const year = Number(yearStr);

      closeMenu();
	  try { btn.focus({ preventScroll: true }); } catch (_) {}
      if (typeof onSelectYear === "function") onSelectYear(year);
    };

    containerEl.addEventListener("click", containerEl._yearsClickHandler);

    // Close menu on outside click + ESC
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

  // ================================
  // TEST PORT: shows posters only
  // ================================

  const API_BASE = "https://music-archive-3lfa.onrender.com";
  const SHOWS_ENDPOINT = `${API_BASE}/sheet/shows`;

  let SHOWS_CACHE = null;
  let SHOWS_LOADING = null;

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

  async function loadShowsFromCsv() {
    const res = await fetch(SHOWS_ENDPOINT);
    const text = await res.text();
    if (!text || !text.trim()) return [];

    const lines = text.split(/\r?\n/).filter((l) => l.trim());

    const headerLine = lines.shift();
    if (!headerLine) return [];

    const header = parseCsvLine(headerLine).map((h) => h.trim());
    const headerLower = header.map((h) => h.toLowerCase());

    const nameIdx =
      headerLower.indexOf("show_name") !== -1
        ? headerLower.indexOf("show_name")
        : headerLower.indexOf("title");

    const urlIdx =
      headerLower.indexOf("show_url") !== -1
        ? headerLower.indexOf("show_url")
        : headerLower.indexOf("poster_url");

    const dateIdx =
      headerLower.indexOf("show_date") !== -1
        ? headerLower.indexOf("show_date")
        : headerLower.indexOf("date");

    const venueIdx = headerLower.indexOf("show_venue");
    const cityIdx =
      headerLower.indexOf("show_city") !== -1
        ? headerLower.indexOf("show_city")
        : headerLower.indexOf("city");
    const stateIdx =
      headerLower.indexOf("show_state") !== -1
        ? headerLower.indexOf("show_state")
        : headerLower.indexOf("state");

const bandIdxs = [];
for (let n = 1; n <= 20; n++) {
  bandIdxs.push(headerLower.indexOf(`band_${n}`));
}

    const rows = [];

    for (const line of lines) {
      const cols = parseCsvLine(line);

      const row = {
        title: nameIdx !== -1 ? (cols[nameIdx] || "").trim() : "",
        poster_url: urlIdx !== -1 ? (cols[urlIdx] || "").trim() : "",
        date: dateIdx !== -1 ? (cols[dateIdx] || "").trim() : "",
        venue: venueIdx !== -1 ? (cols[venueIdx] || "").trim() : "",
        city: cityIdx !== -1 ? (cols[cityIdx] || "").trim() : "",
        state: stateIdx !== -1 ? (cols[stateIdx] || "").trim() : "",
        bands: bandIdxs.map((ix) => (ix !== -1 ? (cols[ix] || "").trim() : "")).filter(Boolean),
      };

      rows.push(row);
    }

    return rows;
  }

  async function ensureShowsLoaded() {
    if (Array.isArray(SHOWS_CACHE)) return SHOWS_CACHE;
    if (SHOWS_LOADING) return SHOWS_LOADING;

    SHOWS_LOADING = (async () => {
      try {
        const rows = await loadShowsFromCsv();
        SHOWS_CACHE = rows;
        return rows;
      } catch (e) {
        console.warn("Shows CSV load failed:", e);
        SHOWS_CACHE = [];
        return [];
      } finally {
        SHOWS_LOADING = null;
      }
    })();

    return SHOWS_LOADING;
  }

  function yearFromShowDate(raw) {
    const parts = String(raw || "")
      .trim()
      .split("/");
    if (parts.length !== 3) return null;
    let y = (parts[2] || "").trim();
    if (!y) return null;
    if (y.length === 2) y = "20" + y;
    const n = Number(y);
    return Number.isFinite(n) ? n : null;
  }

  function getShowsForYear(year, allShows) {
    const yr = Number(year);
    if (!Array.isArray(allShows) || !allShows.length) return [];
    return allShows.filter((s) => yearFromShowDate(s.date) === yr);
  }
  
  function renderPosterDetail({ year, show, containerEl }) {
  if (!containerEl) return;

  const title = (show?.title || "").trim();
  const date = (show?.prettyDate || "").trim();
  const venueLine = (show?.venueLine || "").trim();
  const posterUrl = (show?.poster_url || "").trim();

  const safe = (v) => String(v || "").split('"').join("&quot;");

  containerEl.innerHTML = `
    <div class="showsDetail">
      <button type="button" class="showsBackBtn" data-action="back">← Back to ${year}</button>

      <div class="showsDetailCard">
        ${posterUrl ? `<img class="showsDetailImg" src="${safe(posterUrl)}" alt="${safe(title) || "Show"}" />` : ""}
        <div class="showsDetailMeta">
          <div class="showsDetailTitle">${safe(title)}</div>
          ${date ? `<div class="showsDetailDate">${safe(date)}</div>` : ``}
          ${venueLine ? `<div class="showsDetailVenue">${safe(venueLine)}</div>` : ``}
        </div>
      </div>
    </div>
  `;
}



  // ===== Shows UI (2-col grid + expandable band cards) =====
  let _bandsIndexPromise = null;
  let _bandsByName = null; // normalizedName -> bandInfo

  function normName(s) {
    return String(s || "").trim().toLowerCase();
  }

  
  // ===== CSV helpers (for /sheet/bands when it returns text/plain or text/csv) =====
  function splitCSVLine(line) {
    const out = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (ch === "," && !inQ) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  function parseCSV(text) {
    const norm = (text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = norm.split("\n").filter((l) => l.trim().length);
    if (!lines.length) return [];
    const headers = splitCSVLine(lines[0]).map((h) => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCSVLine(lines[i]);
      const row = {};
      for (let j = 0; j < headers.length; j++) row[headers[j]] = (cols[j] || "").trim();
      rows.push(row);
    }
    return rows;
  }

async function ensureBandsIndex() {
    if (_bandsByName) return _bandsByName;
    if (_bandsIndexPromise) return _bandsIndexPromise;

    _bandsIndexPromise = fetch(`${API_BASE}/sheet/bands`)
      .then(async (r) => {
        const ct = (r.headers.get('content-type') || '').toLowerCase();
        const txt = await r.text();

        // If the backend returns JSON, parse JSON.
        if (ct.includes('application/json') || /^[\s]*[\[{]/.test(txt)) {
          try {
            return JSON.parse(txt);
          } catch (e) {
            throw new Error(`Invalid JSON from /sheet/bands: ${String(e && e.message ? e.message : e)}`);
          }
        }

        // If the backend returns HTML, treat as an error (prevents weird CSV parsing).
        if (/^[\s]*</.test(txt)) {
          throw new Error(`Expected JSON/CSV from /sheet/bands but got HTML (${ct || 'unknown'}).`);
        }

        // Otherwise assume CSV (text/plain or text/csv) and parse it.
        return parseCSV(txt);
      })
      .then((rows) => {
        const map = new Map();
        (rows || []).forEach((row) => {
          const name = row.band || row.name || row.Band || "";
          const key = normName(name);
          if (!key) return;
          map.set(key, {
            name: name,
            logo_url: row.logo_url || row.logo || "",
            smug_folder: row.smug_folder || row.smugFolder || "",
            region: row.region || "",
          });
        });
        _bandsByName = map;
        return map;
      })
      .catch((e) => {
        console.warn("Failed to load bands index:", e);
        _bandsByName = new Map();
        return _bandsByName;
      });

    return _bandsIndexPromise;
  }

  // ===== show-date (MMDDYY) -> album existence check (ported from script.js) =====
  const BAND_DATE_ALBUM_CACHE = {}; // "<folder>|<MMDDYY>" -> boolean

  function toMMDDYY(raw) {
    const s = String(raw || "").trim();
    if (!s) return "";
    // Accept M/D/YYYY, MM/DD/YYYY, or YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [yyyy, mm, dd] = s.split("-");
      return `${mm}${dd}${yyyy.slice(2)}`;
    }
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!m) return "";
    const mm = m[1].padStart(2, "0");
    const dd = m[2].padStart(2, "0");
    const yy = (m[3].length === 4 ? m[3].slice(2) : m[3]).padStart(2, "0");
    return `${mm}${dd}${yy}`;
  }

  
  // ===== SmugMug folder helpers (ported from script.js) =====
  function cleanFolderPath(s) {
    return (s || "").replace(/[:]/g, "").trim();
  }

  const toSlug = (s) =>
    (s || "")
      .trim()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9\s-]+/gi, "")
      .replace(/\s+/g, "-")
      .toLowerCase();

  // get all albums inside a SmugMug folder using the same backend pattern as script.js
  async function fetchFolderAlbums(folderPath, region) {
    const clean = cleanFolderPath(folderPath || "");
    if (!clean) return [];
    const baseSlug = toSlug(clean || "");
    const res = await fetch(
      `${API_BASE}/smug/${encodeURIComponent(baseSlug)}?folder=${encodeURIComponent(
        clean
      )}&region=${encodeURIComponent(region || "")}&count=200&start=1`
    );
    const data = await res.json();
    const albums =
      (data && data.Response && (data.Response.Album || data.Response.Albums)) ||
      [];
    return albums;
  }

  // show-date (MMDDYY) -> album existence check
  // key: "<folder>|<MMDDYY>" -> true/false
  async function bandHasAlbumForCode(bandInfo, mmddyy) {
    try {
      const folderPath = cleanFolderPath(bandInfo?.smug_folder || "");
      const region = bandInfo?.region || "";
      if (!folderPath || !mmddyy) return false;

      const cacheKey = `${folderPath}|${mmddyy}`;
      if (cacheKey in BAND_DATE_ALBUM_CACHE) return BAND_DATE_ALBUM_CACHE[cacheKey];

      const albums = await fetchFolderAlbums(folderPath, region);

      const found = (albums || []).some((alb) => {
        const name = String(alb?.UrlName || alb?.Name || alb?.Title || "").trim();
        return name.includes(mmddyy);
      });

      BAND_DATE_ALBUM_CACHE[cacheKey] = found;
      return found;
    } catch (e) {
      console.warn("bandHasAlbumForCode failed:", e);
      return false;
    }
  }


  function buildVenueText(show) {
    const venue = String(show.venue || "").trim();
    const city = String(show.city || "").trim();
    const state = String(show.state || "").trim();
    if (venue && city && state) return `${venue} - ${city}, ${state}`;
    if (venue && city) return `${venue} - ${city}`;
    if (venue && state) return `${venue} - ${state}`;
    if (city && state) return `${city}, ${state}`;
    if (venue) return venue;
    if (city) return city;
    if (state) return state;
    return "";
  }

  function renderShowsGridForYear({ year, shows, containerEl }) {
    if (!containerEl) return;

    containerEl.innerHTML = "";

    const grid = document.createElement("div");
    grid.className = "showsGrid";
    containerEl.appendChild(grid);

    const mmddyy = toMMDDYY(shows?.[0]?.date) || ""; // not used globally; kept for parity

    shows.forEach((s, idx) => {
      const tile = document.createElement("div");
      tile.className = "showTile";
      tile.setAttribute("data-idx", String(idx));
      tile.setAttribute("data-show-id", makeShowId(s));

      const header = document.createElement("div");
      header.className = "showTileHeader";

      const posterWrap = document.createElement("div");
      posterWrap.className = "showPosterWrap";

      
      if (s.poster_url) {
        const poster = document.createElement("img");
        poster.className = "showPoster";
        poster.alt = s.title || "Poster";
        poster.loading = "lazy";
        poster.src = s.poster_url;
        posterWrap.appendChild(poster);
      } else {
        const ph = document.createElement("div");
        ph.className = "showPosterPlaceholder";
        ph.textContent = "N/A";
        posterWrap.appendChild(ph);
      }
const meta = document.createElement("div");
      meta.className = "showMeta";

      const title = document.createElement("div");
      title.className = "showTitle";
      title.textContent = s.title || "";

      const date = document.createElement("div");
      date.className = "showDate";
      date.textContent = s.pretty_date || s.date || "";

      const venue = document.createElement("div");
      venue.className = "showVenue";
      venue.textContent = buildVenueText(s);

      const cam = document.createElement("div");
      cam.className = "showCamera";
      cam.textContent = s.camera ? `Camera Used: ${s.camera}` : "";

      const actions = document.createElement("div");
      actions.className = "showActions";

      const bandsBtn = document.createElement("button");
      bandsBtn.type = "button";
      bandsBtn.className = "showBtn bandsToggle";
      bandsBtn.textContent = "Bands ▾";

      actions.appendChild(bandsBtn);

      meta.appendChild(title);
      meta.appendChild(date);
      meta.appendChild(venue);
      if (s.camera) meta.appendChild(cam);
header.appendChild(posterWrap);
      header.appendChild(meta);

      const expand = document.createElement("div");
      expand.className = "showExpand";

      // Inner wrapper holds padding so the accordion animation stays smooth
      const expandInner = document.createElement("div");
      expandInner.className = "showExpandInner";

      const bandGrid = document.createElement("div");
      bandGrid.className = "bandGrid";

      expandInner.appendChild(bandGrid);
      expand.appendChild(expandInner);

      // Build band cards (logos + name + green/red border)
      const showMMDDYY = toMMDDYY(s.date);
      ensureBandsIndex().then((bandsIndex) => {
        (s.bands || []).forEach((bandName) => {
          const info = bandsIndex.get(normName(bandName)) || { name: bandName };
          const card = document.createElement("div");
          card.className = "bandCard";
          card.setAttribute("data-band", bandName);

          // pulsing status dot (color comes from isGood / isBad class)
          const dot = document.createElement("span");
          dot.className = "statusDot";

          const img = document.createElement("img");
          img.className = "bandLogo";
          img.alt = bandName;
          img.loading = "lazy";
          img.src = info.logo_url || "";
          if (!img.src) img.style.opacity = "0.25";

          const nm = document.createElement("div");
          nm.className = "bandName";
          nm.textContent = bandName;

          card.appendChild(dot);
          card.appendChild(img);
          card.appendChild(nm);
          bandGrid.appendChild(card);

          // async album check for border coloring
          bandHasAlbumForCode(info, showMMDDYY).then((has) => {
            card.classList.toggle("isGood", !!has);
            card.classList.toggle("isBad", !has);
          });
        });
      });

      tile.appendChild(header);
      tile.appendChild(expand);
      grid.appendChild(tile);
    });
  }


  function render() {
    ensureShowsStyles();

    return `
      <div class=\"showsWrap\">
        <div id=\"showsYearsMount\"></div>
        <div id="showsYearContent" class="showsNote">Select a year from the list.</div>
      </div>
    `;
  }

  function onMount(panelEl) {
    if (!panelEl) return;

    const years = [
      2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015,
      2014, 2013, 2012, 2011, 2010, 2009,
    ];
	
	let currentYearShows = [];
	let currentYearPretty = []; // same shows but with prettyDate + venueLine


    const persisted = loadShowsState();

    // If the parent app re-mounts Shows when switching tabs, restore last viewed year
    let activeYear = Number(persisted.activeYear || 2025);
    if (!years.includes(activeYear)) activeYear = years[0] || 2025;

    const pillClass = "YearPill";
    const pillActiveClass = "YearPillActive";

    const mountEl = panelEl.querySelector("#showsYearsMount");
    if (!mountEl) return;
	
	const contentEl = panelEl.querySelector("#showsYearContent");
if (!contentEl) return;

// Clicking a poster toggles a dropdown inside that card (years row stays)

contentEl.addEventListener("click", (e) => {
  const toggle = e.target.closest(".bandsToggle") || e.target.closest(".showTileHeader");
  if (!toggle) return;

  const tile = e.target.closest(".showTile");
  if (!tile) return;

  // Close other open tiles (accordion behavior)
  const openTiles = contentEl.querySelectorAll(".showTile.isOpen");
  openTiles.forEach((t) => {
    if (t !== tile) t.classList.remove("isOpen");
  });

  tile.classList.toggle("isOpen");

  // Persist which show (if any) is open for the current year
  const isOpen = tile.classList.contains("isOpen");
  const openId = isOpen ? tile.getAttribute("data-show-id") : "";
  saveShowsState({ openShowId: openId });
});

    async function handleSelectYear(year) {
  // ✅ Save ALL relevant scroll containers (SmugMug often scrolls a parent wrapper)
  const snap = saveScrollSnapshot(mountEl);

  activeYear = year;
  // Persist selected year and clear open tile for new year
  saveShowsState({ activeYear: year, openShowId: "" });
  mountYearsPillsOverflow({
    containerEl: mountEl,
    years,
    activeYear,
    maxVisible: years.length,
    onSelectYear: handleSelectYear,
    pillClass,
    pillActiveClass,
    moreLabel: "More ▾",
  });

  // ✅ Restore after SmugMug does its own post-render adjustments
  setTimeout(() => restoreScrollSnapshot(snap), 0);
  setTimeout(() => restoreScrollSnapshot(snap), 50);

  const content = panelEl.querySelector("#showsYearContent");
  if (content) {
    content.innerHTML = `<div class="showsWip">Loading posters…</div>`;

    const requestId = String(Date.now()) + String(Math.random());
    content.dataset.req = requestId;

    const all = await ensureShowsLoaded();
    if (content.dataset.req !== requestId) return;

    const showsForYear = getShowsForYear(year, all);
	currentYearShows = showsForYear;
currentYearPretty = (showsForYear || []).map((s) => {
  const venue = String(s.venue || "").trim();
  const city = String(s.city || "").trim();
  const state = String(s.state || "").trim();
  const place = [city, state].filter(Boolean).join(", ");
  const venueLine = [venue, place].filter(Boolean).join(" - ");

  return {
    ...s,
    venueLine,
    prettyDate: s.date ? (function formatPrettyDateInline(raw){
      const parts = String(raw || "").trim().split("/");
      if (parts.length !== 3) return String(raw || "").trim();
      const m = Number(parts[0]) - 1;
      const d = Number(parts[1]);
      let y = Number(parts[2]);
      if (!Number.isFinite(m) || !Number.isFinite(d) || !Number.isFinite(y)) return String(raw || "").trim();
      if (y < 100) y += 2000;
      const dateObj = new Date(y, m, d);
      if (Number.isNaN(dateObj.getTime())) return String(raw || "").trim();
      const month = dateObj.toLocaleString("en-US", { month: "long" });
      const day = dateObj.getDate();
      const year2 = dateObj.getFullYear();
      const suffix =
        day % 10 === 1 && day !== 11 ? "st" :
        day % 10 === 2 && day !== 12 ? "nd" :
        day % 10 === 3 && day !== 13 ? "rd" : "th";
      return month + " " + day + suffix + ", " + year2;
    })(s.date) : "",
  };
});

    renderShowsGridForYear({ year, shows: showsForYear, containerEl: content });

    // Restore previously-open tile (if any) after re-render
    const st = loadShowsState();
    if (st.openShowId) {
      const toOpen = content.querySelector(`.showTile[data-show-id="${cssEscape(st.openShowId)}"]`);
      if (toOpen) toOpen.classList.add("isOpen");
    }
    // ✅ Restore again after content swap + layout reflow
    setTimeout(() => restoreScrollSnapshot(snap), 0);
    setTimeout(() => restoreScrollSnapshot(snap), 50);
  }
}



    mountYearsPillsOverflow({
      containerEl: mountEl,
      years,
      activeYear,
      maxVisible: years.length,
      onSelectYear: handleSelectYear,
      pillClass,
      pillActiveClass,
      moreLabel: "More ▾",
    });

    // Initial render: restore last selected year (prevents reset when returning to Shows tab)
    handleSelectYear(activeYear);

  }

  window.MusicArchiveShows = { render, onMount };
})();
