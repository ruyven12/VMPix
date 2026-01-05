// music-archive-shows.js
(function () {
  "use strict";

  // Optional: inject shows-only CSS once
  function ensureShowsStyles() {
    if (document.getElementById("musicShowsStyles")) return;
    const s = document.createElement("style");
    s.id = "musicShowsStyles";
    s.textContent = `
      /* Shows-only styles live here */
      .showsWrap{
        width:100%;
        max-width:980px;
        margin:0 auto;
        box-sizing:border-box;

        /* IMPORTANT:
           The parent content panel is centering its children vertically.
           To counter that, we make THIS wrapper fill the available height,
           then lay out our children from the top.
        */
        height:100%;
        min-height:100%;
        align-self:stretch;

        display:flex;
        flex-direction:column;
        justify-content:flex-start; /* <-- forces top alignment */

        /* ===== EDIT TOP GAP HERE ===== */
        padding-top: 2px; /* <-- space from top border of content window */
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

      /* Posters-only test grid (safe + scoped) */
      .showsWip{
        text-align:center;
        opacity:.75;
        margin-top: 10px;
        font-family:'Orbitron', system-ui, sans-serif;
        letter-spacing:.08em;
        text-transform:uppercase;
        font-size:12px;
      }
      .showsPosterGrid{
        width:100%;
        display:grid;
        grid-template-columns: 1fr; /* desktop: 1 per row (for now) */
        gap:14px;
        margin-top: 10px;
      }

      /* mobile: 1 per row (matches scriptmusic behavior) */
      @media (max-width: 700px){
  .showsPosterGrid{ grid-template-columns: 1fr; }

  /* On small screens, stack poster above text */
  .showsPosterRow{
    flex-direction:column;
    align-items:center;
    text-align:center;
  }
  .showsPosterMeta{ width:100%; }
  .showsPosterTitle,
  .showsPosterDate,
  .showsPosterVenue{ text-align:center; }

  .showsPosterImg{
    width:160px;
    flex:0 0 auto;
  }
}

.showsPosterSpacer{
  height: 10px; /* "blank line" after the title */
}



      .showsPosterCard{
        border-radius:14px;
        overflow:hidden;
		border:2px solid rgba(0,255,255,.8);
        background:rgba(0,0,0,.18);
        box-shadow:0 10px 26px rgba(0,0,0,.45);
      }
      .showsPosterRow{
		display:flex;
		flex-direction:row;          /* <-- linear: poster left, text right */
		align-items:flex-start;
		gap:14px;
		padding:14px;
		text-align:left;
	  }

      .showsPosterMeta{
  display:flex;
  flex-direction:column;
  justify-content:center;
  width:100%;
  min-width:0;                 /* <-- important for wrapping in flex */
}


      .showsPosterImg{
  width:120px;                 /* <-- left column size */
  height:auto;
  object-fit:cover;
  display:block;
  flex:0 0 120px;              /* keeps it from shrinking weirdly */
  border-radius:10px;
}

      .showsPosterTitle{
        padding:10px 10px 12px;
        font-family:'Orbitron', system-ui, sans-serif;
        letter-spacing:.06em;
        text-transform:uppercase;
        font-size:12px;
        line-height:1.25;
		word-break: break-word;
		overflow-wrap: anywhere;
        color:rgba(255,255,255,.88);
        opacity:.95;
        text-align:left;
		padding:0 0 6px;
		overflow-wrap:anywhere;
word-break:break-word;

      }

      .showsPosterDate{
        margin-top:-6px;
        font-size:11px;
        letter-spacing:.06em;
        opacity:.85;
        padding:0 0 6px;
text-align:left;

      }
      .showsPosterVenue{
        font-size:11px;
        letter-spacing:.04em;
        opacity:.80;
        padding:0;
		text-align:left;

      }
	  
	  .showsDetail{ width:100%; }

.showsBackBtn{
  border:2px solid rgba(0,255,255,.8);
  background:rgba(0,0,0,.18);
  color:rgba(255,255,255,.9);
  border-radius:12px;
  padding:10px 12px;
  cursor:pointer;
  font-family:'Orbitron', system-ui, sans-serif;
  letter-spacing:.08em;
  text-transform:uppercase;
  font-size:12px;
  margin-bottom:12px;
}

.showsDetailCard{
  border-radius:14px;
  overflow:hidden;
  border:2px solid rgba(0,255,255,.8);
  background:rgba(0,0,0,.18);
  box-shadow:0 10px 26px rgba(0,0,0,.45);
  padding:14px;
  display:flex;
  gap:14px;
  align-items:flex-start;
}

.showsDetailImg{
  width:220px;
  height:auto;
  border-radius:10px;
  flex:0 0 auto;
}

@media (max-width:700px){
  .showsDetailCard{
    flex-direction:column;
    align-items:center;
    text-align:center;
  }
  .showsDetailImg{ width:240px; }
}

.showsDetailTitle{
  font-family:'Orbitron', system-ui, sans-serif;
  letter-spacing:.06em;
  text-transform:uppercase;
  font-size:14px;
  line-height:1.25;
  opacity:.95;
  margin-bottom:8px;
}

.showsDetailDate,
.showsDetailVenue{
  font-size:12px;
  opacity:.85;
  margin-top:4px;
}


      /* Years pills + overflow dropdown (scoped, non-destructive)
         We DO style the pills here, but only when they live inside .yearsNav,
         so we don't affect any other YearPill usage elsewhere.
      */
      .yearsNav{
		position: relative;
		display:flex;
		align-items:center;
		justify-content:center;
		gap:10px;

	  /* important change */
		flex-wrap:nowrap;

		margin-top: 0px;
		margin-bottom: 18px;
		padding: 14px 16px;

		border:2px solid rgba(0,255,255,.8);
		background: transparent;
	  }

      .yearsNav .yearsPills{
  display:flex;
  gap:10px;

  flex-wrap:nowrap;

  /* make it a real scroll area */
  width:100%;
  max-width:100%;
  overflow-x:auto;
  overflow-y:hidden;

  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;
  scroll-behavior:smooth;
}



      /* --- Pill look/feel to match your "orange box" vibe ---
         We keep behavior the same; this is styling only.
      */
      .yearsNav .YearPill{
        -webkit-appearance:none;
        appearance:none;
        border:none;
        background:transparent;
        color:rgba(255,255,255,.88);
        padding:8px 14px 10px;
        border-radius:10px;
		flex: 0 0 auto;
        font-family:'Orbitron', system-ui, sans-serif;
        font-size:12px;
        letter-spacing:.10em;
        text-transform:uppercase;
        cursor:pointer;
        user-select:none;
        position:relative;

        /* Softer "tab" feel like the orange box area */
        opacity:.9;
        transition:
          transform .14s ease,
          opacity .14s ease,
          color .14s ease,
          filter .14s ease,
          background-size .18s ease;

        /* Underline (red line) */
        background-image: linear-gradient(to right, rgba(255, 60, 60, .95), rgba(255, 60, 60, .95));
        background-repeat: no-repeat;
        background-position: 50% calc(100% - 2px);
        background-size: 0% 2px;
      }

      .yearsNav .YearPill:hover{
        transform: translateY(-1px);
        opacity:1;
        filter: brightness(1.08);
      }

      .yearsNav .YearPill:active{
        transform: translateY(0px);
        filter: brightness(1.12);
      }

      .yearsNav .YearPill:focus-visible{
        outline:none;
        filter: brightness(1.12);
      }

      .yearsNav .YearPill.YearPillActive{
        color: rgba(255,255,255,.98);
        opacity: 1;
        background-size: 100% 2px !important;
      }

      .yearsNav .YearPill::after{
        content:"";
        position:absolute;
        inset:0;
        border-radius:inherit;
        pointer-events:none;
        background: radial-gradient(circle at 50% 120%, rgba(255, 60, 60, .18), transparent 55%);
        opacity:0;
        transition: opacity .18s ease;
      }
      .yearsNav .YearPill:hover::after{ opacity:.55; }

      /* Dropdown */
      .yearsNav .yearsMore{ position:relative; display:inline-block; }
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
        background:rgba(12,12,14,.98);
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
        color:rgba(255,255,255,.92);
        cursor:pointer;
        opacity:.92;
        letter-spacing:.04em;
        text-transform:uppercase;
        font-size:12px;
      }
      .yearsNav .yearsMenu .menuItem:hover{ background:rgba(255,255,255,.08); opacity:1; }
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


  function renderPostersOnly({ year, shows, containerEl }) {
    if (!containerEl) return;

    const posters = (shows || []).filter((s) => s);

    if (!posters.length) {
      containerEl.innerHTML = `<div class=\"showsWip\">Work in progress</div>`;
      return;
    }

    function formatPrettyDate(raw) {
      const parts = String(raw || "")
        .trim()
        .split("/");
      if (parts.length !== 3) return String(raw || "").trim();
      const m = Number(parts[0]) - 1;
      const d = Number(parts[1]);
      let y = Number(parts[2]);
      if (!Number.isFinite(m) || !Number.isFinite(d) || !Number.isFinite(y))
        return String(raw || "").trim();
      if (y < 100) y += 2000;

      const dateObj = new Date(y, m, d);
      if (Number.isNaN(dateObj.getTime())) return String(raw || "").trim();

      const month = dateObj.toLocaleString("en-US", { month: "long" });
      const day = dateObj.getDate();
      const year = dateObj.getFullYear();

      const suffix =
        day % 10 === 1 && day !== 11
          ? "st"
          : day % 10 === 2 && day !== 12
            ? "nd"
            : day % 10 === 3 && day !== 13
              ? "rd"
              : "th";

      return month + " " + day + suffix + ", " + year;
    }

    containerEl.innerHTML = `
      <div class=\"showsPosterGrid\" aria-label=\"Show posters for ${year}\">
        ${posters
          .map((s, i) => {
            const title = String(s.title || "").trim();
            const safeTitle = title.split('"').join("&quot;");

            const dateRaw = String(s.date || "").trim();
            const prettyDate = dateRaw ? formatPrettyDate(dateRaw) : "";
            const safeDate = prettyDate.split('"').join("&quot;");

            const venue = String(s.venue || "").trim();
            const city = String(s.city || "").trim();
            const state = String(s.state || "").trim();

            const place = [city, state].filter(Boolean).join(", ");
            const venueLine = [venue, place].filter(Boolean).join(" - ");
            const safeVenueLine = venueLine.split('"').join("&quot;");

            return `
              <div class=\"showsPosterCard showsPosterRow\"
  role=\"button\"
  tabindex=\"0\"
  data-idx=\"${i}\"
  data-year=\"${year}\"
  data-title=\"${safeTitle}\"
  data-date=\"${safeDate}\"
  data-venue=\"${safeVenueLine}\"
  data-poster-url=\"${s.poster_url ? String(s.poster_url).split('"').join("&quot;") : ""}\">

                ${
                  s.poster_url
                    ? `<img class=\"showsPosterImg\" src=\"${s.poster_url}\" alt=\"${safeTitle || "Show"}\" loading=\"lazy\" />`
                    : `<div class=\"showsPosterImg\" style=\"width:150px;height:1px;\"></div><div class=\"showsPosterVenue\" style=\"margin-top:6px;opacity:.6;\">No poster yet</div>`
                }
                <div class=\"showsPosterMeta\">
                  <div class=\"showsPosterTitle\">${safeTitle}</div>
				  <div class=\"showsPosterSpacer\"></div>
                  ${safeDate ? `<div class=\"showsPosterDate\">${safeDate}</div>` : ``}
                  ${safeVenueLine ? `<div class=\"showsPosterVenue\">${safeVenueLine}</div>` : ``}
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function render() {
    ensureShowsStyles();

    return `
      <div class=\"showsWrap\">
        <div id=\"showsYearsMount\"></div>
        <div id=\"showsYearContent\" class=\"showsNote\">Select a year above.</div>
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


    let activeYear = 2025;

    const pillClass = "YearPill";
    const pillActiveClass = "YearPillActive";

    const mountEl = panelEl.querySelector("#showsYearsMount");
    if (!mountEl) return;
	
	const contentEl = panelEl.querySelector("#showsYearContent");
if (!contentEl) return;

// Clicking a poster wipes ONLY the content area (years row stays)
contentEl.addEventListener("click", (e) => {
  // Back button from detail view
  const backBtn = e.target.closest('[data-action="back"]');
  if (backBtn) {
    renderPostersOnly({
      year: activeYear,
      shows: currentYearShows,
      containerEl: contentEl,
    });
    return;
  }

  // Poster card click
  const card = e.target.closest(".showsPosterCard");
  if (!card) return;

  const idx = Number(card.dataset.idx);
  if (!Number.isFinite(idx) || !currentYearPretty[idx]) return;

  renderPosterDetail({
    year: activeYear,
    show: currentYearPretty[idx],
    containerEl: contentEl,
  });
});


    async function handleSelectYear(year) {
  // ✅ Save ALL relevant scroll containers (SmugMug often scrolls a parent wrapper)
  const snap = saveScrollSnapshot(mountEl);

  activeYear = year;

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

    renderPostersOnly({ year, shows: showsForYear, containerEl: content });

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
  }

  window.MusicArchiveShows = { render, onMount };
})();
