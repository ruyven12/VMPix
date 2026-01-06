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

  // ================== CONFIG ==================
  const API_BASE = (window.WRESTLING_API_BASE || "https://wrestling-archive.onrender.com").replace(/\/$/, "");
  // Tip: if you proxy endpoints on the same origin as the page, set window.WRESTLING_API_BASE = location.origin;
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
      const res = await fetch(SHOWS_ENDPOINT, { cache: "no-store", mode: "cors" });
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
      // Most common cause when embedded on another domain: CORS blocked by the API host.
      setCrumbs("Error loading shows data (likely CORS). If this page is on a different domain than the API, enable CORS on the API or proxy it through the same site.");
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

  function renderShowsCards(rows) {
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

      // expandable details
      const details = document.createElement("div");
      details.style.gridColumn = "1 / -1";
      details.style.maxHeight = "0px";
      details.style.overflow = "hidden";
      details.style.transition = "max-height 0.3s ease";

      function buildPartsWrap(row) {
        const wrap = document.createElement("div");
        wrap.style.display = "flex";
        wrap.style.flexDirection = "column";
        wrap.style.gap = "8px";
        wrap.style.padding = "10px 0";

        let any = false;

        for (let i = 1; i <= 10; i++) {
          const type = (row[`part_${i}_type`] || "").trim();
          const stip = (row[`part_${i}_stip`] || "").trim();
          const partTitle = (row[`part_${i}_title`] || "").trim();
          const people = (row[`part_${i}_people`] || "").trim();

          if (!type && !stip && !partTitle && !people) continue;
          any = true;

          const box = document.createElement("div");
          box.style.display = "flex";
          box.style.flexDirection = "column";
          box.style.padding = "10px 14px";
          box.style.borderRadius = "10px";
          box.style.border = "1px solid rgba(255,255,255,0.08)";
          box.style.background = "rgba(15, 23, 42, 0.22)";
          box.style.transition = "background 0.15s ease";

          box.addEventListener("mouseenter", () => {
            box.style.background = "rgba(30, 41, 59, 0.35)";
          });
          box.addEventListener("mouseleave", () => {
            box.style.background = "rgba(15, 23, 42, 0.22)";
          });

          const head = document.createElement("div");
          head.style.fontWeight = "800";
          head.style.fontSize = "14px";
          head.style.marginBottom = "4px";

          let headerLabel = "";
          if (partTitle) headerLabel = `${partTitle} Match`;
          else if (stip) headerLabel = `${stip} Match`;
          else headerLabel = type;

          const typeNorm = (type || "").toLowerCase();

          if (typeNorm.includes("championship")) {
            box.style.border = "1px solid rgba(250, 204, 21, 0.45)";
            box.style.background = "rgba(250, 204, 21, 0.08)";

            const badge = document.createElement("span");
            badge.style.display = "inline-flex";
            badge.style.alignItems = "center";
            badge.style.gap = "6px";
            badge.style.fontSize = "10px";
            badge.style.fontWeight = "900";
            badge.style.letterSpacing = "0.08em";
            badge.style.padding = "3px 8px";
            badge.style.borderRadius = "999px";
            badge.style.marginBottom = "6px";
            badge.style.width = "fit-content";
            badge.style.background = "rgba(250, 204, 21, 0.18)";
            badge.style.border = "1px solid rgba(250, 204, 21, 0.35)";
            badge.style.color = "rgba(250, 204, 21, 0.95)";

            const icon = document.createElement("span");
            icon.textContent = "🏆";
            icon.style.fontSize = "12px";

            const label = document.createElement("span");
            label.textContent = "CHAMPIONSHIP";

            badge.appendChild(icon);
            badge.appendChild(label);
            box.appendChild(badge);

            head.style.fontWeight = "900";
          }

          if (typeNorm === "promo" || typeNorm === "segment") {
            box.style.border = "1px solid rgba(56, 189, 248, 0.22)";
            box.style.background = "rgba(56, 189, 248, 0.06)";
          }

          head.textContent = headerLabel;
          box.appendChild(head);

          if (people) {
            const body = document.createElement("div");
            body.textContent = people;
            body.style.fontSize = "13px";
            body.style.opacity = "0.9";
            box.appendChild(body);
          }

          wrap.appendChild(box);
        }

        if (!any) {
          const none = document.createElement("div");
          none.textContent = "No match info yet.";
          none.style.opacity = "0.8";
          wrap.appendChild(none);
        }

        return wrap;
      }

      posterBox.addEventListener("click", () => {
        const open = details.classList.toggle("open");
        if (!open) {
          details.style.maxHeight = "0px";
          return;
        }

        details.innerHTML = "";
        const wrap = buildPartsWrap(r);
        details.appendChild(wrap);

        requestAnimationFrame(() => {
          details.style.maxHeight = wrap.offsetHeight + 32 + "px";
        });
      });

      card.appendChild(posterBox);
      card.appendChild(right);
      card.appendChild(details);

      resultsEl.appendChild(card);
    });
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
        renderShowsCards(rows);
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

window.__WRESTLING_ARCHIVE_SHOWS_LOADED__ = true;
//# sourceURL=wrestling-archive-shows.js
