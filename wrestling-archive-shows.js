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
  const API_BASE = "https://wrestling-archive.onrender.com";
  const SHOWS_ENDPOINT = `${API_BASE}/sheet/shows`;

  // Only show 2021–2025 (your current behavior)
  const MIN_YEAR = 2021;
  const MAX_YEAR = 2025;

  // ================== STATE ==================
  let SHOWS = [];
  let YEARS = [];

  // Mounted DOM + handlers
  let _panel = null;
  let _root = null;

  // ================== RENDER (HTML SKELETON) ==================
  function render() {
    // This HTML gets inserted inside #wrestlingContentPanel by wrestling-archive.js
    // Keep IDs unique to this module to avoid collisions.
    return `
      <div id="waShowsRoot" style="width:100%; max-width:1200px; margin:0 auto;">
        <div class="wa-results-head" style="text-align:center; padding:2px 4px 10px;">
          <div id="waCrumbs"
               style="font-size:15px; opacity:.85; text-align:center; margin-top:6px;">
            NOTE: This is a work in progress - bear with me as it gets coded.
          </div>

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

  // ================== MOUNT ==================
  async function onMount(panelEl) {
    ensureShowsStyles();
    _panel = panelEl || document.getElementById("wrestlingContentPanel") || document.body;
    _root = _panel.querySelector("#waShowsRoot");

    if (!_root) {
      // If someone calls onMount without render() having run, create the skeleton anyway.
      _panel.innerHTML = render();
      _root = _panel.querySelector("#waShowsRoot");
    }

    // Load shows CSV → build year bubbles from real data
    SHOWS = await loadShowsFromCsv();
    YEARS = extractYearsFromShows(SHOWS);

    const filtered = YEARS
      .filter((y) => y >= MIN_YEAR && y <= MAX_YEAR)
      .sort((a, b) => b - a);

    renderYearBubbles(filtered);
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
      /* Scoped: Wrestling Shows detail view */
      #waShowsRoot, #waShowsRoot * { text-transform: none !important; }

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
        grid-template-columns: 360px 1fr;
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
      const res = await fetch(SHOWS_ENDPOINT, { cache: "no-store" });
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

  function extractYearsFromShows(shows) {
    const set = new Set();
    (shows || []).forEach((s) => {
      const yr = yearFromDateString(s.date || s.show_date || "");
      if (yr) set.add(yr);
    });
    return Array.from(set);
  }

  function getShowsForYear(year) {
    const yr = Number(year);
    return (SHOWS || []).filter((row) => {
      const raw = (row.show_date || row.date || "").trim();
      const y = yearFromDateString(raw);
      return y === yr;
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
    resultsEl.style.gridTemplateColumns = "repeat(auto-fit, minmax(420px, 1fr))";
    resultsEl.style.gap = "16px";
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
      // Poster click → open a "show detail" view (Band-style routing)
      posterBox.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        showShowDetail(r, year);
      });
      card.appendChild(posterBox);
      card.appendChild(right);

      resultsEl.appendChild(card);
    });
  }

  

  // ================== SHOW DETAIL (Band-style routing) ==================
  function showShowDetail(row, year) {
    if (!row) return;
    ensureShowsStyles();

    // Save list context for Back
    LAST_LIST_CTX = { year: (year != null ? Number(year) : null) };

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
    const prettyDate = rawDate ? formatPrettyDate(rawDate) : "—";
    const company = String((row.company || "").trim() || "—");

    // Venue-ish (best-effort: supports venue/city/state columns if present)
    const venue = String((row.show_venue || row.venue || "").trim() || "");
    const city = String((row.show_city || row.city || "").trim() || "");
    const state = String((row.show_state || row.state || "").trim() || "");
    const venueLine = [venue, (city && state ? `${city}, ${state}` : (city || state))].filter(Boolean).join(" — ") || "—";

    const posterUrlRaw = String((row.show_poster || row.poster_url || "").trim() || "");
    const posterUrl = posterUrlRaw ? `${API_BASE}/show-poster?url=${encodeURIComponent(posterUrlRaw)}` : "";

    const wrap = document.createElement("div");
    wrap.className = "waDetailWrap";

    const topbar = document.createElement("div");
    topbar.className = "waDetailTopbar";

    const backBtn = document.createElement("button");
    backBtn.className = "waBackBtn";
    backBtn.type = "button";
    backBtn.textContent = "← Back to shows";
    backBtn.addEventListener("click", () => {
      // Restore list view for the year we came from
      try { if (yearRow) yearRow.style.display = ""; } catch (_) {}
      try { if (crumbsEl) crumbsEl.style.display = ""; } catch (_) {}

      const y = (LAST_LIST_CTX && LAST_LIST_CTX.year != null) ? LAST_LIST_CTX.year : null;
      if (y != null) {
        setCrumbs(`Shows for ${y}`);
        const rows = getShowsForYear(y);
        renderShowsCards(rows, y);

        // Re-activate the year pill visually
        try {
          const btns = yearRow ? Array.from(yearRow.querySelectorAll(".letter-pill")) : [];
          btns.forEach((b) => b.classList.toggle("active", String(b.textContent || "").trim() === String(y)));
        } catch (_) {}
      } else {
        // If we somehow don't know the year, just clear results
        clearResults();
      }
      resetPanelScroll();
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
    if (!containerEl) return;

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
        const base = String(r?.show_url || r?.showUrl || r?.show || "").trim();
        if (base) return base;

        // 2) infer from show_poster URL: https://photos.smugmug.com/Wrestling/Limitless/110825/i-XXXX/...
        const poster = String(r?.show_poster || r?.poster_url || "").trim();
        if (!poster) return "";
        try {
          const u = new URL(poster);
          const parts = String(u.pathname || "")
            .split("/")
            .filter(Boolean);
          // Expect: ["Wrestling","Limitless","110825", ...]
          if (parts.length >= 3) {
            return SMUG_ORIGIN.replace(/\/$/, "") + "/" + parts.slice(0, 3).join("/");
          }
        } catch (_) {}
        return "";
      }

      const base2 = inferShowBaseUrl(showRow);
      if (base2) return base2.replace(/\/$/, "") + "/" + raw.replace(/^\//, "");

      // Last resort: still return the raw string (keeps the UI from crashing)
      return raw;
    }

    for (let i = 1; i <= 10; i++) {
      const matchId = `match-${i}`;
      const type = getMatchField(row, i, "type");
      const stip = getMatchField(row, i, "stip");
      const partTitle = getMatchField(row, i, "title");
      const people = getMatchField(row, i, "people");
      const urlCell = getMatchField(row, i, "url");
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

      const typeNorm = type.toLowerCase();

      // Smarter header: avoid "Match Match" and handle segment/promo labels cleanly.
      const headerLabel = buildMatchHeader({ type, stip, partTitle });

      // Badges
      if (typeNorm.includes("championship")) {
        const badge = document.createElement("div");
        badge.className = "waBadge waBadgeChamp";
        badge.innerHTML = `<span style="font-size:12px">🏆</span><span>CHAMPIONSHIP</span>`;
        box.appendChild(badge);
      } else if (typeNorm === "promo" || typeNorm === "segment") {
        const badge = document.createElement("div");
        badge.className = "waBadge waBadgeSeg";
        badge.innerHTML = `<span style="font-size:12px">🎤</span><span>${escapeHtml(typeNorm.toUpperCase())}</span>`;
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

      // Click / keyboard: open the match album URL (when provided).
      if (matchUrl) {
        const go = () => {
          try { window.location.href = matchUrl; } catch (_) {}
        };
        box.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          go();
        });
        box.addEventListener("keydown", (e) => {
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

  function buildMatchHeader({ type, stip, partTitle }) {
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
        n.includes("promo") ||
        n.includes("segment")
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

	function renderYearBubbles(years) {
    const row = getYearGroupsEl();
    if (!row) return;

    row.innerHTML = "";

    if (!years || years.length === 0) {
      const msg = document.createElement("div");
      msg.textContent = "No years found in the shows sheet.";
      msg.style.opacity = "0.7";
      msg.style.fontSize = "13px";
      msg.style.textAlign = "center";
      msg.style.width = "100%";
      row.appendChild(msg);
      return;
    }

    years.forEach((year) => {
      const btn = document.createElement("button");
      btn.className = "letter-pill"; // reuse your site pill styling if it exists
      btn.textContent = String(year);

      btn.addEventListener("click", () => {
        row.querySelectorAll(".letter-pill").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        setCrumbs(`Shows for ${year}`);
        const rows = getShowsForYear(year);
        renderShowsCards(rows, year);
      });

      row.appendChild(btn);
    });
  }

  // ================== EXPORT ==================
  window.WrestlingArchiveShows = {
    render,
    onMount,
    destroy,
  };
})();
