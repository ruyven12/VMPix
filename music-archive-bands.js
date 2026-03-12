// music-archive-bands.js
(function () {
  // logo+name only v3 + video2 band detail style
  // logo+name only v2
  "use strict";

  // ----- Analytics alias -----
  // Some handlers call `safetrack(...)` (lowercase). Ensure it exists so clicks don't throw.
  function safetrack(eventName, payload) {
    try {
      if (typeof window.trackEvent === "function") {
        const inferredRoute = (() => {
          try {
            const h = String(window.location.hash || '').trim();
            if (h) return h.replace(/^#/, '').split('?')[0];
            return String(window.location.pathname || '').trim();
          } catch (_) {
            return '';
          }
        })();

        const merged = Object.assign(
          {
            route: inferredRoute || '',
            view: 'bands',
            source: 'music_bands'
          },
          (payload && typeof payload === 'object') ? payload : {}
        );
        return window.trackEvent(String(eventName || ""), merged);
      }
    } catch (_) {}
  }


// ----- Logo fallback (handles missing/broken logos gracefully) -----
function initialsFromName(name) {
  const s = String(name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0] ? parts[0][0] : "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0] && parts[0][1] ? parts[0][1] : "");
  return (a + b).toUpperCase() || "?";
}

function makeLogoDataUri(name) {
  const initials = initialsFromName(name);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="rgba(255,255,255,0.10)"/><stop offset="1" stop-color="rgba(255,255,255,0.03)"/></linearGradient></defs>` +
    `<rect x="0" y="0" width="256" height="256" rx="38" fill="url(#g)"/>` +
    `<text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial" font-weight="800" font-size="96" fill="rgba(255,255,255,0.80)">${initials}</text>` +
    `</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function applyLogoFallback(imgEl, name) {
  if (!imgEl) return;
  imgEl.addEventListener("error", () => {
    try {
      imgEl.src = makeLogoDataUri(name);
      imgEl.style.opacity = "0.85";
    } catch (_) {}
  }, { once: true });

  if (!String(imgEl.src || "").trim()) {
    try {
      imgEl.src = makeLogoDataUri(name);
      imgEl.style.opacity = "0.75";
    } catch (_) {}
  }
}


  // ================== CONFIG (matches script.js) ==================
  // API base (prefer same-origin when hosted on Render; fallback to the known Render API)
  // - If you serve index.html from the SAME Render service, this auto-uses that origin.
  // - If you embed/host elsewhere (SmugMug/GitHub/file://), it falls back to the Render API.
  const DEFAULT_API_BASE = "https://music-archive-3lfa.onrender.com";

// API base
// - If you set window.MUSIC_ARCHIVE_API_BASE in your page, we will use that.
// - Otherwise, we always use the backend Render API (do NOT auto-assume same-origin,
//   because the frontend may be hosted on a different Render service).
const API_BASE =
  (typeof window !== "undefined" &&
    typeof window.MUSIC_ARCHIVE_API_BASE === "string" &&
    window.MUSIC_ARCHIVE_API_BASE.trim())
    ? window.MUSIC_ARCHIVE_API_BASE.trim().replace(/\/$/, "")
    : DEFAULT_API_BASE;

  // Static Fix/Metadata Stats (not pulled from API) — source: your Stats sheet screenshot
  const FIXMETA_STATIC = {
    totalFilesNum: 61289,
    notUpgradedNum: 22506,
    onSiteNum: 36342,
    pctOnSiteNum: 59.30,
  };

const CSV_ENDPOINT = `${API_BASE}/sheet/bands`;

// quick sanity log (helps confirm the app is hitting the correct server)
try { console.log("[music-archive] API_BASE =", API_BASE); } catch (_) {}

  // ===== Feature flags =====
  // Keep the ZIP/multi-select code in place, but hide the UI for now.
  // Flip to true later if you want to re-enable it.
  const ENABLE_ZIP_SELECT_UI = false;

  // Keep the Lightbox download button logic, but hide the button for now.
  // Flip to true later if you want to show it again.
  const SHOW_LIGHTBOX_DOWNLOAD_BTN = true;

  // Loading message shown while the Bands CSV is being fetched.
  // Edit this string to whatever you want displayed.
  const BANDS_LOADING_TEXT = "Waking the archive…";

  // where each region actually lives on SmugMug (kept from your script.js)
  const REGION_FOLDER_BASE = {
    Local: "Music/Archives/Bands/Local",
    Regional: "Music/Archives/Bands/Regional",
    National: "Music/Archives/Bands/National",
    International: "Music/Archives/Bands/International",
  };

  // ================== STATE ==================
  let BANDS = {};
  let CURRENT_REGION = "Local";
  let CURRENT_LETTER = null;

  // panel-scoped DOM refs
  let panelRoot = null;
  let resultsEl = null;
  let letterGroupsEl = null;
  let regionPillsEl = null;
  let legendEl = null;
  // remember the most recent band context so back-navigation always has something to restore
  let LAST_BAND_CTX = null;
  // sequence token to prevent out-of-order renders during rapid Region/Letter clicks
  let SHOWLETTER_SEQ = 0;

  function resetPanelScroll() {
    try {
      const panel = panelRoot || document.getElementById('musicContentPanel');
      const docScroller = document.scrollingElement || document.documentElement;

      // Always try these in order; this avoids "wrong scroller detected" issues.
      if (panel) panel.scrollTop = 0;
      if (panel && panel.parentElement) panel.parentElement.scrollTop = 0;
      if (docScroller) docScroller.scrollTop = 0;

      // Repeat after layout/animations
      window.requestAnimationFrame(() => {
        if (panel) panel.scrollTop = 0;
        if (panel && panel.parentElement) panel.parentElement.scrollTop = 0;
      });
      window.setTimeout(() => {
        if (panel) panel.scrollTop = 0;
      }, 0);
      window.setTimeout(() => {
        if (panel) panel.scrollTop = 0;
      }, 200);
    } catch (e) {}
  }


  // ===== Scroll restore (mobile + webviews) =====
  // Ensures the content panel is actually scrollable again.
  // Defensive against cases where a previous overlay/lightbox left overflow locked.
  function ensurePanelScrollable() {
    try {
      const panel = panelRoot || document.getElementById("musicContentPanel");
      if (panel) {
        // Allow vertical scroll inside the panel
        panel.style.overflowY = "auto";
        panel.style.overflowX = "hidden";
        panel.style.webkitOverflowScrolling = "touch";
        panel.style.overscrollBehavior = "contain";

        // Ensure the panel can grow within the viewport
        /* Let the panel scroll to the true bottom inside whatever layout it sits in (avoids 100vh clipping). */
        panel.style.height = "100%";
        panel.style.minHeight = "0";
        panel.style.maxHeight = "100%";
      }

      // If no lightbox is active, make sure page scrolling isn't locked
      if (!lightboxEl) {
        try { document.documentElement.style.overflow = ""; } catch (_) {}
        try { document.body.style.overflow = ""; } catch (_) {}
      }
    } catch (e) {}
  }


  // ================== STYLES ==================
  function ensureBandsStyles() {
    if (document.getElementById("musicBandsStyles")) return;
    const s = document.createElement("style");
    s.id = "musicBandsStyles";
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

/* ===== Scroll restore ===== */
      #musicContentPanel{
        overflow-y: auto;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        height: 100%;
        max-height: 100%;
        min-height: 0;
        box-sizing: border-box;
        padding-bottom: 28px; /* prevents last line from feeling clipped */
      }


      /* ===== Hi-tech HUD transition: band detail -> album photos ===== */
      .hudWipeOverlay{
        position: fixed;
        inset: 0;
        z-index: 999999;
        pointer-events: none;
        background: rgba(0,0,0,0.18);
        opacity: 0;
        transition: opacity 120ms ease;
      }
      /* Contained (panel-only) HUD wipe: bounded to a host element */
      .hudWipeOverlay.is-contained{
        position: absolute;
        inset: 0;
      }
      .hudWipeOverlay.is-on{ opacity: 1; }
      .hudWipeOverlay::before{
        content:"";
        position:absolute;
        left:-20vw;
        right:-20vw;
        top:-30vh;
        height: 48vh;
        background: linear-gradient(180deg,
          rgba(239,68,68,0.00) 0%,
          rgba(239,68,68,0.10) 25%,
          rgba(255,255,255,0.16) 50%,
          rgba(239,68,68,0.10) 75%,
          rgba(239,68,68,0.00) 100%
        );
        filter: blur(6px);
        transform: translateY(-70vh);
        opacity: .92;
      }
      .hudWipeOverlay.is-contained::before{
        left: -20%;
        right: -20%;
        top: -30%;
        height: 48%;
        transform: translateY(-70%);
      }
      .hudWipeOverlay.is-on::before{
        animation: hudSweep 420ms cubic-bezier(0.2, 0.85, 0.2, 1) forwards;
      }
      .hudWipeOverlay.is-contained.is-on::before{
        animation: hudSweepContained 420ms cubic-bezier(0.2, 0.85, 0.2, 1) forwards;
      }
      .hudWipeOverlay::after{
        content:"";
        position:absolute;
        inset:0;
        background: repeating-linear-gradient(
          to bottom,
          rgba(255,255,255,0.04) 0px,
          rgba(255,255,255,0.04) 1px,
          rgba(0,0,0,0.00) 3px,
          rgba(0,0,0,0.00) 6px
        );
        opacity: 0.22;
        mix-blend-mode: overlay;
      }
      @keyframes hudSweep{
        0%{ transform: translateY(-70vh); }
        100%{ transform: translateY(140vh); }
      }
      @keyframes hudSweepContained{
        0%{ transform: translateY(-70%); }
        100%{ transform: translateY(140%); }
      }

      .albumRowCard.is-opening-album{
        transform: scale(1.02);
        border-color: rgba(239,68,68,0.30);
        box-shadow: 0 18px 40px rgba(0,0,0,0.40);
      }

      .photosWrap.entering{
        opacity: 0;
        transform: translateY(10px);
        filter: blur(10px);
      }
      .photosWrap{
        transition: opacity 220ms ease, transform 220ms ease, filter 220ms ease;
      }
      .photosWrap{ padding-bottom: 28px; box-sizing: border-box; }
      .smug-photo-box.tileHidden{
        opacity: 0;
        transform: translateY(10px);
        filter: blur(10px);
      }
      .smug-photo-box{
        transition: opacity 220ms ease, transform 220ms ease, filter 220ms ease, border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
      }

      /* ===== Multi-select + ZIP download (album photos) ===== */
      .selectToolbar{
        width: 100%;
        max-width: 1100px;
        margin: 10px auto 0;
        display:flex;
        align-items:center;
        justify-content:center;
        gap: 10px;
        flex-wrap:wrap;
      }
      .selectBtn{
        font-family: "Orbitron", system-ui, sans-serif !important;
        text-transform: none !important;
        background: rgba(17,24,39,0.35);
        border: 1px solid rgba(148,163,184,0.25);
        border-radius: 999px;
        padding: 7px 14px;
        cursor:pointer;
        font-size: 12px;
        color: rgba(226,232,240,0.92);
        text-decoration:none;
        display:inline-flex;
        align-items:center;
        gap:6px;
      }
      .selectBtn:hover{ border-color: rgba(239,68,68,0.45); }
      .selectBtn.primary{
        border-color: rgba(239,68,68,0.55);
      }
      .selectHint{
        font-family: "Orbitron", system-ui, sans-serif !important;
        text-transform: none !important;
        font-size: 11px;
        letter-spacing: .10em;
        opacity: .72;
        text-align:center;
      }
      .smug-photo-box.selected{
        border-color: rgba(239,68,68,0.70);
        box-shadow: 0 0 0 2px rgba(239,68,68,0.22), 0 14px 28px rgba(0,0,0,0.35);
      }
      .selectCheck{
        position:absolute;
        top:10px;
        right:10px;
        z-index:3;
        width: 24px;
        height: 24px;
        border-radius: 999px;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size: 12px;
        font-weight: 900;
        background: rgba(0,0,0,0.55);
        border: 1px solid rgba(255,255,255,0.16);
        color: rgba(226,232,240,0.92);
        backdrop-filter: blur(6px);
        pointer-events:none;
        opacity: 0;
        transform: scale(0.92);
        transition: opacity 140ms ease, transform 140ms ease, background 140ms ease, border-color 140ms ease;
      }
      .inSelectMode .smug-photo-box .selectCheck{ opacity: .92; transform: scale(1); }
      .smug-photo-box.selected .selectCheck{
        background: rgba(239,68,68,0.72);
        border-color: rgba(239,68,68,0.85);
      }
      .zipStatus{
        width:100%;
        max-width:1100px;
        margin: 8px auto 0;
        text-align:center;
        font-size: 12px;
        opacity: .80;
      }

      /* ===== Band detail view: hide letter groupings + status legend ===== */
      .inBandDetail #letter-groups{ display:none !important; }
      .inBandDetail #status-legend{ display:none !important; }

      /* ===== Bands stats lines (Total + Legend) ===== */
      #status-legend{
        display:flex;
        flex-direction:column;
        align-items:center;
        gap: 8px;
      }
      .bandsTotalLine{
        font-family: "Orbitron", system-ui, sans-serif !important;
        font-size: 12px;
        letter-spacing: .12em;
        text-transform: none !important;
        opacity: .85;
      }
      .bandsOverallLine{
        font-family: "Orbitron", system-ui, sans-serif !important;
        font-size: 11px;
        letter-spacing: .12em;
        text-transform: none !important;
        opacity: .72;
      }
	  
.overallStatsGrid{
  display:grid;
  width:500px;
  grid-template-columns: repeat(2, minmax(150px, 1fr));
  gap: 12px;
  margin-top: 14px;
  margin:0px auto 0;
  justify-items: stretch;
  align-items: stretch;
}

.statsCol {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.statsRow {
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(255,255,255,0.08);
  font-size: 14px;
  letter-spacing: 0.4px;
}

.statsCol.values .statsRow {
  text-align: right;
  font-weight: 600;
}

/* Status colors */
.statsRow.good {
  border: 2px solid rgba(0,255,120,0.35);
}

.statsRow.partial {
  border: 2px solid rgba(255,180,0,0.35);
}

.statsRow.none {
  border: 2px solid rgba(255,80,80,0.35);
}

      
      
      /* ===== Loading shimmer (Fix / Metadata values) ===== */
      @keyframes vmFixMetaShimmer {
        0%   { transform: translateX(-120%); }
        100% { transform: translateX(120%); }
      }
      .fixmetaShimmer{
        position: relative;
        display: inline-block;
        min-width: 2.8em;
        padding: 0 .15em;
        border-radius: 6px;
        background: rgba(255,255,255,0.08);
        overflow: hidden;
      }
      .fixmetaShimmer::after{
        content:"";
        position:absolute;
        inset:-2px;
        background: linear-gradient(90deg,
          rgba(255,255,255,0.00) 0%,
          rgba(255,255,255,0.18) 45%,
          rgba(255,255,255,0.00) 100%
        );
        transform: translateX(-120%);
        animation: vmFixMetaShimmer 1.15s ease-in-out infinite;
        pointer-events:none;
      }
      /* When loaded, we remove .fixmetaShimmer so the highlight stops. */
/* ===== Overall Archive Stats (pills) ===== */
      .overallStatsTitle{
        font-family: "Orbitron", system-ui, sans-serif !important;
        font-size: 20px;
        font-weight: 900;
        letter-spacing: .12em;
        text-transform: none !important;
        text-align:center;
        margin-bottom: 10px;
      }
      .overallStatsPills{
        width: 100%;
        display:flex;
        flex-wrap:wrap;
        align-items:stretch;
        justify-content:center;
        gap: 12px;
        margin: 0 auto 2px;
      }
      .overallStatsPill{
        min-width: 180px;
        min-height: 60px;
        border-radius: 18px;
        padding: 12px 16px;
        background: radial-gradient(120% 160% at 0% 0%, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.30) 55%, rgba(0,0,0,0.18) 100%);
        border: 1px solid rgba(255,255,255,0.10);
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.05), 0 14px 34px rgba(0,0,0,0.35);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        display:flex;
        flex-direction:column;
        gap: 6px;
		align-items: center;
		justify-content: space-between;
      }
      .overallStatsPill .lbl{
        font-size: 14px;
        letter-spacing:.18em;
        text-transform: uppercase;
        display:flex;
        align-items:center;
        justify-content:center;
		white-space: nowrap;
        gap: 8px;
      }
      .overallStatsPill .val{
        font-size: 14px;
        font-weight: 900;
        letter-spacing: .06em;
		white-space: nowrap;
        line-height: 1.2;
      }
      .overallStatsPill .sub{
        font-size: 10px;
        letter-spacing: .10em;
      }
      .overallStatsPill .dot{
        width: 10px;
        height: 10px;
        border-radius: 999px;
        display:inline-block;
        flex: 0 0 auto;
      }
      .overallStatsPill.good{ border-color: rgba(34,197,94,0.30); }
      .overallStatsPill.partial{ border-color: rgba(245,158,11,0.30); }
      .overallStatsPill.none{ border-color: rgba(148,163,184,0.26); }

      @media (max-width: 520px){
        .overallStatsPill{
          min-width: min(92vw, 420px);
          border-radius: 18px;
        }
      }


/* ===== Reimaging Stats: collapsible (click header to expand/collapse) ===== */
#bands-overall .reimagingStatsHdr{
  width: 100%;
  display:flex;
  align-items:center;
  justify-content:center;
  gap: 10px;
  background: transparent;
  border: none;
  padding: 6px 0 2px;
  margin: 0 auto 6px;
  cursor: pointer;
  color: rgba(226,232,240,0.92);
  font-family: "Orbitron", system-ui, sans-serif !important;
  font-size: 20px;
  font-weight: 900;
  letter-spacing: .12em;
  text-transform: none !important;
}
#bands-overall .reimagingStatsHdr:hover{
  color: rgba(226,232,240,0.98);
}
#bands-overall .reimagingStatsHdr .chev{
  font-size: 14px;
  opacity: .75;
  transform: translateY(1px);
  transition: transform 220ms ease;
}
#bands-overall.is-open .reimagingStatsHdr .chev{
  transform: translateY(1px) rotate(180deg);
}

#bands-overall .reimagingStatsBody{
  overflow: hidden;
  max-height: 0px;
  opacity: 0;
  transform: translateY(-4px);
  filter: blur(6px);
  transition: max-height 320ms cubic-bezier(0.2, 0.85, 0.2, 1), opacity 240ms ease, transform 240ms ease, filter 240ms ease;
  will-change: max-height, opacity, transform, filter;
}
#bands-overall.is-open .reimagingStatsBody{
  opacity: 1;
  transform: translateY(0);
  filter: blur(0);
}
@media (prefers-reduced-motion: reduce){
  #bands-overall .reimagingStatsHdr .chev{ transition: none !important; }
  #bands-overall .reimagingStatsBody{ transition: none !important; }
}


/* ===== Reimaging Stats: clean reveal + segmented bar (Option B) ===== */
#bands-overall .statsRow{
  transition: opacity 260ms ease, transform 260ms ease, filter 260ms ease;
  will-change: opacity, transform, filter;
}
#bands-overall .statsRow.reimagingAnimHidden{
  opacity: 0;
  transform: translateY(8px);
  filter: blur(8px);
}
#bands-overall .statsRow.reimagingAnimIn{
  opacity: 1;
  transform: translateY(0);
  filter: blur(0);
}

#bands-overall .overallStatsBar{
  width: min(820px, 92vw);
  height: 10px;
  margin: 10px auto 0;
  display:flex;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 999px;
  background: rgba(0,0,0,0.18);
  border: 1px solid rgba(255,255,255,0.10);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.05), 0 12px 26px rgba(0,0,0,0.28);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  align-items:center;
  justify-content:space-between;
  overflow: hidden;
}
#bands-overall .overallStatsBar .seg{
  height: 100%;
  width: 0%;
  border-radius: 999px;
  transition: width 620ms cubic-bezier(0.2, 0.85, 0.2, 1);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.05) inset;
}
#bands-overall .overallStatsBar .seg.good{ background: rgba(34,197,94,0.55); }
#bands-overall .overallStatsBar .seg.partial{ background: rgba(245,158,11,0.55); }
#bands-overall .overallStatsBar .seg.none{ background: rgba(148,163,184,0.40); }

@media (prefers-reduced-motion: reduce){
  #bands-overall .statsRow{ transition: none !important; }
  #bands-overall .overallStatsBar .seg{ transition: none !important; }
}


/* --- Premium number animation + % ring (non-destructive) --- */
#bands-overall .statsPctRow .pctWrap{
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
#bands-overall .statsPctRow .pctLabel{
  margin-left: 10px;
  opacity: .9;
}

/* subtle circular progress ring behind the % */
#bands-overall .pctRing{
  width: 34px;
  height: 34px;
  display: inline-block;
  filter: drop-shadow(0 0 8px rgba(255,70,70,.12));
}
#bands-overall .pctRing svg{
  width: 34px;
  height: 34px;
  display: block;
  transform: rotate(-90deg);
}
#bands-overall .pctRing circle{
  fill: none;
  stroke-width: 5;
}
#bands-overall .pctRing .pctBg{
  stroke: rgba(255,255,255,.12);
}
#bands-overall .pctRing .pctFg{
  /* circumference for r=14 is ~87.96 */
  stroke-dasharray: 87.96;
  stroke-dashoffset: calc(87.96 * (1 - (var(--pct, 0) / 100)));
  stroke: rgba(255,70,70,.55);
  transition: stroke-dashoffset 900ms cubic-bezier(.2,.9,.2,1);
}

/* nicer numeric emphasis when animating */
#bands-overall .statsRow strong.isCounting{
  text-shadow: 0 0 14px rgba(255,70,70,.18);
}

      .inBandDetail #region-pills{ display:none !important; }

      /* ===== Album photos view: center Back-to-albums + hide legend ===== */

      .inAlbumPhotos #letter-groups{ display:none !important; }

      .inAlbumPhotos #status-legend{ display:none !important; }
      .inAlbumPhotos #region-pills{ display:none !important; }

      .inAlbumPhotos .photosTop{
        display:flex;
        align-items:center;
        justify-content:center;
        gap: 0;
        margin-top: 6px;
      }

      .backToAlbumsBtn{
        font-family: "Orbitron", system-ui, sans-serif !important;
        text-transform: none !important;
        background: transparent !important;
        border: none !important;
        border-bottom: 2px solid rgba(239,68,68,0.30) !important;
        border-radius: 0 !important;
        padding: 6px 2px !important;
        cursor: pointer;
        font-size: 12px;
        letter-spacing: .10em;
        color: rgba(226,232,240,0.92);
        transition: color 160ms ease, border-color 160ms ease, opacity 160ms ease, transform 120ms ease;
      }
      .backToAlbumsBtn:hover{
        color: rgba(226,232,240,0.98);
        border-bottom-color: rgba(239,68,68,0.90) !important;
        transform: translateX(-2px);
      }
      .backToAlbumsBtn:active{
        transform: translateX(-1px) translateY(1px);
      }

/* ===== Back to Bands (line-style) typography: Orbitron, no forced uppercase ===== */
.backToBandsBtn{
  font-family: "Orbitron", system-ui, sans-serif !important;
  text-transform: none !important;
}

/* Back to Bands button: match "line tab" UI (Orbitron, no forced uppercase) */
.backToBandsBtn{
  background: transparent !important;
  border: none !important;
  border-bottom: 2px solid rgba(239,68,68,0.30) !important;
  border-radius: 0 !important;
  padding: 6px 2px !important;
  cursor: pointer;
  font-size: 12px;
  letter-spacing: .10em;
  color: rgba(226,232,240,0.92);
  text-transform: none !important;
  transition: color 160ms ease, border-color 160ms ease, opacity 160ms ease, transform 120ms ease;
}

      /* ===== Album keywords box (People in this album) ===== */
      .albumKeywordBox{
        margin-top: 10px;
        padding: 12px 14px;
        border-radius: 18px;
        border: 1px solid rgba(148,163,184,0.22);
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.10);
box-shadow: 0 10px 25px rgba(0,0,0,0.28);
        backdrop-filter: blur(8px);
        max-width: 1100px;
        margin-left: auto;
        margin-right: auto;
      }
      .albumKeywordLabel{
        font-family: "Orbitron", system-ui, sans-serif;
        font-size: 11px;
        letter-spacing: .12em;
        text-transform: uppercase;
        color: rgba(226,232,240,0.75);
        margin-bottom: 8px;
      }
      .albumKeywordChips{
        display:flex;
        flex-wrap:wrap;
        gap: 8px;
        align-items:center;
      }
      .albumKeywordChip{
        display:inline-flex;
        align-items:center;
        gap: 6px;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid rgba(148,163,184,0.28);
        background: rgba(17,24,39,0.35);
color: rgba(226,232,240,0.92);
        font-size: 12px;
        line-height: 1;
        white-space: nowrap;
      }
      .albumKeywordChip:hover{
        border-color: rgba(239,68,68,0.45);
      }

  
  /* ===== Also Appears modal (Option A+) ===== */
  .alsoModalOverlay{
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.55);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .alsoModal{
    font-family: "Orbitron", system-ui, sans-serif;
    width: min(760px, 96vw);
    max-height: min(560px, 84vh);
    overflow: auto;
    border-radius: 16px;
    background: rgba(55, 0, 0, 0.50);
    border: 1px solid rgba(255,255,255,0.10);
    box-shadow: 0 18px 60px rgba(0,0,0,0.55);
    backdrop-filter: blur(10px);
    padding: 0; /* header/body provide their own padding; enables sticky header */
  }

  /* Sticky header */
  .alsoModalHeader{
    position: sticky;
    top: 0;
    z-index: 2;
    display:flex;
    align-items:center;
    justify-content:center;
    text-align: center;
    padding: 12px 14px 10px;
    background: rgba(55, 0, 0, 0.72);
    border-bottom: 1px solid rgba(255,255,255,0.08);
    backdrop-filter: blur(10px);
  }
  .alsoModalHeaderInner{
    width: 100%;
    max-width: 640px;
    padding: 0 64px; /* space for Close button */
  }
  .alsoModalName{
    font-family: "Orbitron", system-ui, sans-serif;
    font-size: 16px;
    font-weight: 800;
    line-height: 1.2;
    margin-bottom: 6px;
    text-transform: none !important;
  }
  .alsoModalTitle{
    font-family: "Orbitron", system-ui, sans-serif;
    font-size: 12px;
    letter-spacing: 0.12em;
    opacity: 0.85;
    text-transform: none !important;
    margin-bottom: 8px;
  }
  .alsoModalMeta{
    font-size: 11px;
    letter-spacing: .10em;
    opacity: .78;
  }
  .alsoModalClose{
    position: absolute;
    right: 14px;
    top: 12px;
    border: 1px solid rgba(255,255,255,0.20);
    background: rgba(0,0,0,0.18);
    color: rgba(255,255,255,0.92);
    border-radius: 999px;
    padding: 6px 10px;
    cursor: pointer;
    font-size: 12px;
  }
  .alsoModalClose:hover{
    border-color: rgba(239,68,68,0.55);
  }

  .alsoModalBody{
    padding: 10px 14px 0;
    font-size: 12px;
    opacity: 0.92;
    text-align: center;
  }
  .alsoModalList{
    padding: 10px 14px 14px;
    display:flex;
    flex-direction:column;
    gap: 10px;
    align-items: center;
  }

  .alsoModalGroup{
    width: min(640px, 100%);
    display:flex;
    flex-direction:column;
    gap: 10px;
  }
  .alsoModalGroupHdr{
    width: 100%;
    text-align: center;
    font-size: 20px;
    letter-spacing: .14em;
    opacity: .80;
    padding: 8px 10px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(0,0,0,0.10);
  }

  .alsoModalItem{
    width: 100%;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(0,0,0,0.10);
    cursor: pointer;
    text-align: center;
    overflow: hidden;
    transition: transform 160ms ease, border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
  }
  .alsoModalItem:hover{
    border-color: rgba(255,255,255,0.16);
    background: rgba(255,255,255,0.06);
    transform: translateY(-1px);
    box-shadow: 0 12px 26px rgba(0,0,0,0.28);
  }
  .alsoModalItem:active{
    transform: translateY(0px);
  }
  .alsoModalItemRow{
    display:grid;
    grid-template-columns: 92px 1fr;
    gap: 10px;
    padding: 10px 12px;
    align-items:center;
  }
  .alsoModalItemDate{
    font-weight: 900;
    font-size: 15px;
    letter-spacing: .06em;
    opacity: .92;
    padding: 6px 8px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.10);
    background: rgba(0,0,0,0.18);
  }
  /* tiny poster icon in the left pill (keeps row height stable) */
  .alsoModalItemDate{
    display:flex;
    align-items:center;
    justify-content:center;
    line-height: 0;
  }
  .alsoModalPosterIcon{
    width: 22px;
    height: 22px;
    border-radius: 6px;
    object-fit: cover;
    display:block;
    box-shadow: 0 6px 14px rgba(0,0,0,0.28);
  }
  .alsoModalPosterFallback{
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.10);
  }

  .alsoModalItemMain{
    min-width: 0;
    display:flex;
    flex-direction:column;
    gap: 4px;
    align-items:center;
  }
  .alsoModalItemTitle{
    font-weight: 800;
    font-size: 17px;
    opacity: 0.96;
    line-height: 1.2;
  }
  .alsoModalItemSub{
    font-size: 11px;
    opacity: 0.78;
  }

  @media (max-width: 520px){
    .alsoModalHeaderInner{ padding: 0 56px; }
    .alsoModalItemRow{
      grid-template-columns: 1fr;
      gap: 8px;
    }
    .alsoModalItemDate{
      width: fit-content;
      margin: 0 auto;
    }
  }

  .albumKeywordEmpty{
        color: rgba(226,232,240,0.65);
        font-size: 12px;
        padding: 6px 0 2px;
      }

      /* Center the "People in this album" bubble content */
      .albumKeywordBox{
        text-align: center;
      }
      .albumKeywordChips{
        justify-content: center;
      }
      .albumKeywordTitle{
        font-family: "Orbitron", system-ui, sans-serif;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: .10em;
        margin-bottom: 8px;
        opacity: .90;
      }
.backToBandsBtn:hover{
  color: rgba(226,232,240,0.98);
  border-bottom-color: rgba(239,68,68,0.90) !important;
  transform: translateX(-2px);
}
.backToBandsBtn:active{
  transform: translateX(-1px) translateY(1px);
}

      .bandsWrap{
        width:100%;
        max-width:none;
        margin:0;
        padding: clamp(8px, 1.2vw, 16px);
      }

      /* Extra bottom breathing room so long text never looks clipped */
      .bandsWrap{ padding-bottom: 28px; }

      /* top bar inside panel */
      .bandsTop{
        display:flex;
        flex-direction:column;
        gap:10px;
        margin-bottom:10px;
      }

/* ===== Divider above bands header block ===== */
.bandsTopDivider{
  width: 100%;
  border-top: 1px solid rgba(239,68,68,0.22);
  margin: 2px 0 8px;
}

      /* ===== Divider between legend and region tabs ===== */
.bandsLegendDivider{
  width: 100%;
  border-top: 1px solid rgba(239,68,68,0.22);
  margin: 6px 0 10px;
}

/* region pills (match top action tabs style) */
      #region-pills{
        display:flex;
        flex-wrap:wrap;
        justify-content:center;
        gap:18px;
        padding: 2px 0 6px;
        border-bottom: 1px solid rgba(239,68,68,0.22);
      }
      .region-pill{
        padding:6px 2px;
        cursor:pointer;
        user-select:none;
        font-size:12px;
        letter-spacing:.10em;
        background:transparent;
        border:none;
        color:rgba(226,232,240,0.75);
        border-bottom: 2px solid transparent;
        transition: color 160ms ease, border-color 160ms ease, opacity 160ms ease;
      }
      .region-pill:hover{
        color:rgba(226,232,240,0.92);
        border-bottom-color: rgba(239,68,68,0.35);
      }
      .region-pill.active{
        color:rgba(226,232,240,0.98);
        border-bottom-color: rgba(239,68,68,0.90);
      }

/* letter pills (match top action tabs style) */
      #letter-groups{
        display:flex;
        flex-wrap:wrap;
        justify-content:center;
        gap:16px;
        padding: 6px 0 6px;
      }
      .letter-pill{
        padding:6px 2px;
        cursor:pointer;
        font-size:12px;
        letter-spacing:.10em;
        background:transparent;
        border:none;
        color:rgba(226,232,240,0.72);
        border-bottom: 2px solid transparent;
        transition: color 160ms ease, border-color 160ms ease, opacity 160ms ease;
      }
      .letter-pill:hover{
        color:rgba(226,232,240,0.92);
        border-bottom-color: rgba(239,68,68,0.28);
      }
      .letter-pill.active{
        color:rgba(226,232,240,0.98);
        border-bottom-color: rgba(239,68,68,0.85);
      }

      /* ===== Stats inline (Dynamic) ===== */
      .bandsStatsInline{
        display:inline-flex;
        align-items:center;
        gap:10px;
        padding-left: 6px;
        opacity: .92;
        letter-spacing: .06em;
        white-space: nowrap;
      }
      .bandsStatsInline .mini{
        display:inline-flex;
        align-items:center;
        gap:6px;
      }
      @media (max-width: 520px){
        .bandsStatsInline{
          width: 100%;
          justify-content: center;
          white-space: normal;
        }
      }
/* 2-column layout: tree + results */
      /* hide tree sidebar */
      #tree{ display:none !important; }

      .bandsLayout{
        display:grid;
        grid-template-columns: 1fr;
        gap:14px;
        align-items:start;
      }
      @media (max-width: 950px){
        .bandsLayout{ grid-template-columns: 1fr; }
      }

      /* tree */
      #tree{
        position:sticky;
        top:0;
        align-self:flex-start;
        max-height:80vh;
        overflow:auto;
        padding:10px;
        border-radius:14px;
        background:rgba(255,255,255,0.04);
        border:1px solid rgba(255,255,255,0.10);
      }
      .tree-section-title{
        font-size:12px;
        letter-spacing:.08em;
        text-transform:uppercase;
        opacity:.8;
        margin:6px 0 8px;
      }
      .tree-letter{
        display:flex;
        align-items:center;
        justify-content:space-between;
        width:100%;
        padding:8px 10px;
        border-radius:12px;
        cursor:pointer;
        background:rgba(17,24,39,0.30);
        border:1px solid rgba(148,163,184,0.18);
        color:rgba(226,232,240,0.95);
        font-size:12px;
        margin-bottom:8px;
      }
      .tree-letter:hover{
        background:rgba(255,255,255,0.08);
      }
      .tree-count{
        opacity:.7;
        font-size:11px;
      }

      /* results */
      #results{
        min-height:200px;

        /* ===== Region/Letter transitions (fade + tiny slide + blur) ===== */
        transition: opacity 180ms ease, transform 180ms ease, filter 180ms ease;
        will-change: opacity, transform, filter;
      }
      #results.is-swapping{
        opacity: 0;
        transform: translateY(6px) scale(0.995);
        filter: blur(8px);
      }
      @media (prefers-reduced-motion: reduce){
        #results{ transition: none !important; }
        #results.is-swapping{ transform:none !important; filter:none !important; opacity: 0; }
      }
      .band-card{
        background:rgba(255,255,255,0.04);
        border:1px solid rgba(255,255,255,0.10);
        border-radius:16px;
        padding:12px;
        cursor:pointer;
      }

      /* Stagger reveal for photo tiles */
      .smug-photo-box.tileHidden{
        opacity: 0;
        transform: translateY(8px) scale(0.99);
        filter: blur(8px);
      }
      .smug-photo-box{
        transition: opacity 220ms ease, transform 220ms ease, filter 220ms ease, transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
      }
      .band-card:hover{
        background:rgba(255,255,255,0.06);
      }

      /* ===== Band list -> Band detail transition helpers ===== */
      #results.is-dimming .band-card{
        transition: transform 180ms ease, opacity 180ms ease;
      }
      #results.is-dimming .band-card:not(.is-opening){
        opacity: 0.55;
        transform: scale(0.985);
      }
      #results .band-card.is-opening{
        transform: scale(1.03);
        box-shadow: 0 18px 40px rgba(0,0,0,0.35);
      }

      /* ===== Band list card status backgrounds (based on sets_archive vs total_sets) =====
         - if total_sets and sets_archive are equal (and both present) => green
         - if total_sets > sets_archive => yellow
         - if either field missing/blank => gray
         Note: these are only used in the band LIST (#results), not the band detail view.
      */
      #results .band-card.setsGood{
        background: rgba(34,197,94,0.14);
        border-color: rgba(34,197,94,0.28);
      }
      #results .band-card.setsPartial{
        background: rgba(245,158,11,0.14);
        border-color: rgba(245,158,11,0.28);
      }
      #results .band-card.setsNone{
        background: rgba(148,163,184,0.12);
        border-color: rgba(148,163,184,0.22);
      }
      #results .band-card.setsGood:hover{ background: rgba(34,197,94,0.18); }
      #results .band-card.setsPartial:hover{ background: rgba(245,158,11,0.18); }
      #results .band-card.setsNone:hover{ background: rgba(148,163,184,0.16); }
      .band-row{
        display:flex;
        align-items:center;
        gap:10px;
      }
      .band-logo{
        width:54px;height:54px;border-radius:12px;
        object-fit:cover;
        background:rgba(255,255,255,0.06);
        border:1px solid rgba(255,255,255,0.10);
        flex:0 0 auto;
      }
      .band-name{
        font-size:15px;
        font-weight:700;
        line-height:1.1;
      }

      .band-count{
        font-size: 12px;
        font-weight: 800;
        opacity: .80;
        margin-left: 8px;
        letter-spacing: .06em;
        white-space: nowrap;
        display: inline-block;
      }
      .band-meta{
        margin-top:6px;
        font-size:12px;
        opacity:.85;
        display:flex;
        flex-wrap:wrap;
        gap:10px;
      }
      .pill{
        padding:3px 10px;
        border-radius:999px;
        background:rgba(17,24,39,0.35);
        border:1px solid rgba(148,163,184,0.18);
        font-size:11px;
        white-space:nowrap;
      }

      /* albums */
      .albumsWrap{
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:10px;
      }
      
      .album-card{
        background:rgba(255,255,255,0.04);
        border:1px solid rgba(255,255,255,0.10);
        border-radius:16px;
        padding:10px;
        cursor:pointer;
      }
      .album-thumb{
        width:100%;
        aspect-ratio: 16/10;
        object-fit:cover;
        border-radius:12px;
        border:1px solid rgba(255,255,255,0.10);
        background:rgba(255,255,255,0.04);
      }
      .album-title{
        margin-top:8px;
        font-weight:700;
        font-size:13px;
      }
      .album-sub{
        margin-top:4px;
        font-size:12px;
        opacity:.8;
      }

      /* photos */
      .photosTop{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        width:100%;
        max-width:none;
        margin:0 auto 10px;
        flex-wrap:wrap;
      }

      /* Album photos view enter (pairs with HUD sweep) */
      .photosWrap.entering{
        opacity: 0;
        transform: translateY(10px);
        filter: blur(10px);
      }
      .photosWrap{
        transition: opacity 260ms ease, transform 260ms ease, filter 260ms ease;
      }
      .btn{
        padding:6px 14px;
        background:rgba(17,24,39,0.35);
        color:#fff;
        border:1px solid rgba(148,163,184,0.25);
        border-radius:9999px;
        cursor:pointer;
        font-size:12px;
        backdrop-filter:blur(6px);
      }
      .photosGrid{
        width:100%;
        display:grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap:10px;
        max-width:none;
        margin:0 auto;
      }
      .smug-photo-box{
        background:rgba(255,255,255,0.04);
        border:1px solid rgba(255,255,255,0.10);
        border-radius:14px;
        padding:8px;
        cursor:pointer;
      }

/* ===== Loading shimmer (album photos) ===== */
.smug-photo-box.shimmer{
  cursor: default;
}
.smug-photo-box.shimmer:hover{
  transform:none;
  box-shadow:none;
  border-color: rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.04);
}
.smug-photo-box.shimmer .shimmerInner{
  width: 100%;
  aspect-ratio: 1/1;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.10);
  background: linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.14) 37%, rgba(255,255,255,0.06) 63%);
  background-size: 400% 100%;
  animation: smugShimmer 1.2s ease-in-out infinite;
}
@keyframes smugShimmer{
  0%{ background-position: 100% 0; }
  100%{ background-position: -100% 0; }
}
@media (prefers-reduced-motion: reduce){
  .smug-photo-box.shimmer .shimmerInner{ animation: none !important; }
}


      /* Stagger reveal for photos (after view mounts) */
      .smug-photo-box.tileHidden{
        opacity: 0;
        transform: translateY(10px);
        filter: blur(10px);
      }
      .smug-photo{
        width:100%;
        aspect-ratio: 1/1;
        object-fit:cover;
        border-radius:10px;
        border:1px solid rgba(255,255,255,0.10);
        background:rgba(255,255,255,0.04);
      }

      /* ===== Photos grid: editorial tiles (hover meta + index) ===== */
      .photosGrid{
        padding-bottom: 10px;
      }
      .smug-photo-box{
        position: relative;
        overflow: hidden;
        transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
      }
      .smug-photo-box:hover{
        transform: translateY(-2px);
        border-color: rgba(239,68,68,0.28);
        box-shadow: 0 14px 28px rgba(0,0,0,0.35);
        background: rgba(255,255,255,0.06);
      }
      .smug-photo{
        transition: transform 220ms ease, filter 220ms ease;
        will-change: transform;
      }
      .smug-photo-box:hover .smug-photo{
        transform: scale(1.04);
        filter: saturate(1.05) contrast(1.02);
      }

      .photoIndexBadge{
        position:absolute;
        top:10px;
        left:10px;
        z-index:2;
        font-size:11px;
        font-weight:800;
        letter-spacing:.08em;
        padding:6px 10px;
        border-radius: 999px;
        background: rgba(0,0,0,0.55);
        border: 1px solid rgba(255,255,255,0.14);
        color: rgba(226,232,240,0.95);
        backdrop-filter: blur(6px);
        pointer-events:none;
      }

      .photoHoverMeta{
        position:absolute;
        left:10px;
        right:10px;
        bottom:10px;
        z-index:2;
        padding:10px 10px;
        border-radius: 14px;
        background: linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.72) 100%);
        border: 1px solid rgba(255,255,255,0.12);
        backdrop-filter: blur(6px);
        opacity: 0;
        transform: translateY(6px);
        transition: opacity 160ms ease, transform 160ms ease;
        pointer-events:none;
      }
      .smug-photo-box:hover .photoHoverMeta{
        opacity: 1;
        transform: translateY(0);
      }
      .photoHoverMeta .fn{
        font-size: 12px;
        font-weight: 800;
        opacity: .95;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .photoHoverMeta .sub{
        margin-top:4px;
        font-size: 11px;
        opacity: .75;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* ===== Lightbox v2: cinematic focus + filmstrip ===== */
      .lightbox{
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,0.92);
        padding: 0;
        overflow: hidden;
      }
      .lightboxShell{
        width: min(1280px, 96vw);
        height: min(860px, 92vh);
        max-height: 92vh;
        display:flex;
        flex-direction:column;
        align-items:stretch;
        justify-content:space-between;
        gap: 10px;
      }
      .lightboxTopbar{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap: 10px;
        padding: 14px 14px 8px;
      }
      .lightboxTitle{
        display:flex;
        flex-direction:column;
        gap: 4px;
        min-width:0;
      }
      .lightboxTitle .line1{
        font-size: 12px;
        font-weight: 800;
        letter-spacing: .06em;
        opacity: .92;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .lightboxTitle .line2{
        font-size: 11px;
        opacity: .70;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .lightboxCounter{
        font-size: 11px;
        letter-spacing: .12em;
        opacity: .70;
        white-space: nowrap;
      }

      .lightboxDownloadBtn{
        background: rgba(17,24,39,0.35);
        border: 1px solid rgba(148,163,184,0.25);
        border-radius: 999px;
        padding: 6px 12px;
        cursor:pointer;
        font-size: 12px;
        color: rgba(226,232,240,0.92);
        text-decoration:none;
        display:inline-flex;
        align-items:center;
        gap:6px;
      }
      .lightboxDownloadBtn:hover{
        border-color: rgba(239,68,68,0.45);
      }

      .lightboxCloseBtn{
        background: rgba(17,24,39,0.35);
        border: 1px solid rgba(148,163,184,0.25);
        border-radius: 999px;
        padding: 6px 12px;
        cursor:pointer;
        font-size: 12px;
        color: rgba(226,232,240,0.92);
      }

      .lightboxStage{
        position: relative;
        flex: 1 1 auto;
        min-height: 0;
        display:flex;
        align-items:center;
        justify-content:center;
        padding: 0 14px;
      }
      .lightboxImg{
        max-width: 100%;
        max-height: 100%;
        width: auto;
        height: auto;
        object-fit: contain;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.12);
        box-shadow: 0 18px 50px rgba(0,0,0,0.55);
        opacity: 0;
        transition: opacity 220ms ease;
      }

      .lightboxNavBtn{
        position:absolute;
        top:50%;
        transform: translateY(-50%);
        background: rgba(0,0,0,0.45);
        border: 1px solid rgba(255,255,255,0.14);
        color: rgba(226,232,240,0.92);
        width: 44px;
        height: 44px;
        border-radius: 999px;
        cursor:pointer;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size: 16px;
        backdrop-filter: blur(6px);
      }
      .lightboxNavBtn:hover{
        border-color: rgba(239,68,68,0.45);
      }
      .lightboxNavPrev{ left: 18px; }
      .lightboxNavNext{ right: 18px; }

      .lightboxStrip{
        padding: 0 14px 14px;
        overflow-x: auto;
        overflow-y: hidden;
        display:flex;
        gap: 8px;
        align-items:center;
        scroll-behavior: smooth;
      }
      .lightboxThumb{
        width: 54px;
        height: 54px;
        border-radius: 12px;
        object-fit: cover;
        border: 1px solid rgba(255,255,255,0.12);
        opacity: .60;
        cursor:pointer;
        flex: 0 0 auto;
        transition: opacity 140ms ease, transform 140ms ease, border-color 140ms ease;
        background: rgba(255,255,255,0.04);
      }
      .lightboxThumb:hover{
        opacity: .92;
        transform: translateY(-1px);
        border-color: rgba(239,68,68,0.35);
      }
      .lightboxThumb.active{
        opacity: 1;
        border-color: rgba(239,68,68,0.85);
        box-shadow: 0 0 0 1px rgba(239,68,68,0.25);
      }

      @media (max-width: 620px){
        .lightboxShell{ height: 94vh; }
        .lightboxNavBtn{ width: 40px; height: 40px; }
        .lightboxStrip{ padding-bottom: 10px; }
      }

      /* lightbox (legacy)
         NOTE: The site now uses the newer Lightbox v2 styles above.
         Keep these legacy styles available, but only apply them if a lightbox
         is explicitly created with the additional "legacy" class.
      */
      .lightbox.legacy{
        position:fixed;
        inset:0;
        background:rgba(0,0,0,0.88);
        display:flex;
        align-items:center;
        justify-content:center;
        z-index:999999;
        padding:18px;
      }
      .lightbox.legacy img{
        max-width:95vw;
        max-height:86vh;
        border-radius:14px;
        border:1px solid rgba(255,255,255,0.12);
      }
      .lightbox.legacy .lightbox-controls{
        position:fixed;
        bottom:16px;
        left:50%;
        transform:translateX(-50%);
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        justify-content:center;
      }
      .lightbox.legacy .lightbox-caption{
        position:fixed;
        top:14px;
        left:50%;
        transform:translateX(-50%);
        color:rgba(255,255,255,0.9);
        font-size:12px;
        background:rgba(0,0,0,0.45);
        border:1px solid rgba(255,255,255,0.12);
        padding:6px 10px;
        border-radius:999px;
        max-width:92vw;
        text-overflow:ellipsis;
        overflow:hidden;
        white-space:nowrap;
      }

      /* ===== Surgical: logo + name only in band list cards =====
         This hides any legacy meta blocks that might still be present due to caching or older markup.
         Scoped to #results to avoid impacting album/photo views.
      */
      #results .band-card *{ display:none !important; }
      #results .band-card .band-row{ display:flex !important; }
      #results .band-card .band-logo{ display:block !important; }
      #results .band-card .band-name{ display:block !important; }
#results .band-card .band-count{ display:inline-block !important; }
      #results .band-card .band-row > div{ display:flex !important; flex-direction:column !important; }

      /* ===== Band detail view (modeled after your Video 2 layout) ===== */
      .bandDetailWrap{
        width:100%;
        max-width:1200px;
        margin: 0 auto;
        display:flex;
        flex-direction:column;
        gap: 16px;
        padding-top: 6px;
      }

      
      /* ===== Band detail enter transition (pairs with shared-logo zoom) ===== */
      .bandDetailWrap.entering{
        opacity: 0;
        transform: translateY(10px);
        filter: blur(8px);
      }
      .bandDetailWrap{
        transition: opacity 260ms ease, transform 260ms ease, filter 260ms ease;
      }

.bandDetailTopbar{
        display:flex;
        justify-content:center;
      }

      .bandDetailHeader{
        width:100%;
        display:grid;
        grid-template-columns: 360px 1fr;
        gap: 18px;
        align-items:center;
        border-top: 2px solid rgba(239,68,68,0.28);
        border-bottom: 2px solid rgba(239,68,68,0.28);
        padding: 18px 10px;
      }
      @media (max-width: 920px){
        .bandDetailHeader{
          grid-template-columns: 1fr;
          justify-items:center;
          text-align:center;
        }
      }

      .bandDetailLogo{
        width: 320px;
        max-width: 80vw;
        aspect-ratio: 1/1;
        object-fit: contain;
        border-radius: 18px;
        opacity: 0.95;
        filter: drop-shadow(0 10px 20px rgba(0,0,0,0.55));
      }

      .bandDetailCard{
        width:100%;
        display:flex;
        flex-direction:column;
        gap: 12px;
      }

      .bandDetailNamePill{
        width:100%;
        border-radius: 999px;
        padding: 14px 18px;
        background: radial-gradient(120% 160% at 0% 0%, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.30) 55%, rgba(0,0,0,0.18) 100%);
        border: 1px solid rgba(255,255,255,0.10);
        text-align:center;
      }
      .bandDetailNamePill .kicker{
        font-size: 10px;
        letter-spacing: .22em;
        text-transform: uppercase;
        opacity: .65;
        margin-bottom: 6px;
      }
      .bandDetailNamePill .name{
        font-size: 22px;
        font-weight: 800;
        letter-spacing: .06em;
      }

      .bandInfoRow{
        display:grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      @media (max-width: 920px){
        .bandInfoRow{ grid-template-columns: 1fr; }
      }

      .bandInfoPill{
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
      .bandInfoPill .lbl{
        font-size: 9px;
        letter-spacing:.18em;
        text-transform: uppercase;
        opacity: .55;
      }
      .bandInfoPill .val{
        font-size: 13px;
        font-weight: 800;
        opacity: .92;
      }

      .bandInfoGrid2{
        display:grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      @media (max-width: 920px){
        .bandInfoGrid2{ grid-template-columns: 1fr; }
      }

      .bandInfoBox{
        border-radius: 16px;
        padding: 12px 14px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        min-height: 54px;
      }
      .bandInfoBox .lbl{
        font-size: 9px;
        letter-spacing:.18em;
        text-transform: uppercase;
        opacity: .55;
        margin-bottom: 6px;
      }
      .bandInfoBox .val{
        font-size: 13px;
        opacity: .80;
      }

      .bandAlbumsTitle{
        font-size: 12px;
        letter-spacing: .18em;
        text-transform: uppercase;
        opacity: .80;
        margin-top: 6px;
      }

      .bandAlbumsGrid{
        width:100%;
        display:grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 240px));
        gap: 16px;
        justify-content:center;
        align-items:start;
      }

      /* Make album cards in band detail feel more like poster tiles */
      .bandAlbumsGrid .album-card{
        padding: 12px;
        border-radius: 18px;
        background: rgba(15,23,42,0.26);
        border: 1px solid rgba(255,255,255,0.10);
        box-shadow: 0 18px 40px rgba(0,0,0,0.35);
      }
      .bandAlbumsGrid .album-thumb{
        border-radius: 14px;
        aspect-ratio: 2/3;
      }
      .bandAlbumsGrid .album-sub{
        font-size: 11px;
      }

      /* ===== Force album rows (single-column, stacked) ===== */
      .bandAlbumsGrid{
        display:flex !important;
        flex-direction:column !important;
        gap:12px !important;
      }

      /* ===== Album row cards (match your centered poster + text layout) ===== */
      .albumRowCard{
        width:100%;
        max-width: 980px;
        margin: 0 auto;
        display:flex;
        gap: 18px;
        padding: 14px 16px;
        border-radius: 16px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.10);
        box-shadow: 0 12px 26px rgba(0,0,0,0.30);
        cursor:pointer;

        /* center the whole “poster + text” block */
        justify-content:center;
        align-items:center;
      }
      .albumRowCard:hover{
        background: rgba(255,255,255,0.06);
        border-color: rgba(255,255,255,0.16);
      }

      /* Selected album row (pre-transition emphasis) */
      .albumRowCard.is-opening-album{
        transform: scale(1.01);
        border-color: rgba(239,68,68,0.30);
        box-shadow: 0 18px 44px rgba(0,0,0,0.38), 0 0 0 2px rgba(239,68,68,0.14);
      }

      /* Stagger reveal for album rows (after band logo transition lands) */
      .albumRowCard.staggerHidden{
        opacity: 0;
        transform: translateY(8px);
        filter: blur(8px);
      }
      .albumRowCard{
        transition: opacity 240ms ease, transform 240ms ease, filter 240ms ease, background 160ms ease, border-color 160ms ease;
      }

      .albumRowThumb{
        width: 140px;
        height: auto;
        aspect-ratio: 2 / 3;
        object-fit: cover;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(255,255,255,0.04);
        box-shadow: 0 6px 16px rgba(0,0,0,0.35);
        flex: 0 0 auto;
      }

      .albumRowMeta{
        flex: 0 1 auto;
        min-width: 0;
        display:flex;
        flex-direction:column;
        align-items:center;
        text-align:center;
        gap: 6px;
      }

      .albumRowTitle{
        font-size: 15px;
        font-weight: 800;
        letter-spacing: .04em;
        line-height: 1.15;
        opacity: .96;
      }
      .albumRowSub{
        font-size: 12px;
        opacity: .82;
        line-height: 1.2;
      }

      @media (max-width: 520px){
        .albumRowCard{
          flex-direction: column;
          gap: 12px;
          padding: 12px;
        }
        .albumRowThumb{ width: 110px; }
        .albumRowMeta{ width: 100%; }
      }

      /* ===== Initial load: hide crumbs + legend until data is ready ===== */
      .bandsWrap.is-loading #crumbs{ display:none !important; }
      .bandsWrap.is-loading #status-legend{ display:none !important; }
      .bandsLoading{
        width:100%;
        display:flex;
        align-items:center;
        justify-content:center;
        padding: 18px 0 6px;
        opacity:.85;
        font-size:12px;
        letter-spacing:.12em;
        text-transform: uppercase;
      }
      .bandsLoading .dot{
        display:inline-block;
        width:8px; height:8px;
        border-radius:999px;
        background: rgba(226,232,240,0.75);
        margin-left:10px;
        animation: bandsDot 800ms ease-in-out infinite;
      }
      @keyframes bandsDot{
        0%,100%{ transform: translateY(0) scale(1); opacity:.55; }
        50%{ transform: translateY(-2px) scale(1.25); opacity:1; }
      }

      /* ===== Typography override: disable forced uppercase (Orbitron) ===== */
      .bandsWrap,
      .bandsWrap *{
        text-transform: none !important;
      }

      /* ===== Shared-element gating: prevent "blink" by hiding content until logo transition completes ===== */
      .bandDetailWrap.loading-content .bandDetailCard,
      .bandDetailWrap.loading-content .bandAlbumsTitle,
      .bandDetailWrap.loading-content .bandAlbumsGrid{
        opacity: 0;
        transform: translateY(10px);
        filter: blur(10px);
        pointer-events: none;
      }
      .bandDetailWrap.loading-content .bandDetailLogo{
        transition: opacity 220ms ease;
      }
      .bandDetailWrap.closing .bandDetailCard,
      .bandDetailWrap.closing .bandAlbumsTitle,
      .bandDetailWrap.closing .bandAlbumsGrid{
        opacity: 0;
        transform: translateY(10px);
        filter: blur(10px);
        pointer-events: none;
        transition: opacity 160ms ease, transform 160ms ease, filter 160ms ease;
      }

`;

    document.head.appendChild(s);
  }

  // ================== HTML RENDER ==================
  function render() {
    try { document.body.classList.remove("inBandDetail"); } catch(_) {}
    ensureBandsStyles();

    // ONLY what's inside #musicContentPanel
    return `
      <div class="bandsWrap is-loading" id="bands-root">
        <div class="bandsTop">
          <div class="bandsTopDivider" aria-hidden="true"></div>
          <div id="status-legend">
            <div id="bands-overall" class="bandsOverallLine"></div>
            <div id="bands-total" class="bandsTotalLine"></div>
</div>
                    <div class="bandsLegendDivider" aria-hidden="true"></div>
          <div id="region-pills"></div>
          <div id="letter-groups"></div>
        </div>

        <div class="bandsLayout">
          <div>
            <div class="bandsLoading" id="bands-loading">
              <div class="vmpixBootPanel" role="status" aria-live="polite">
                <div class="vmpixBootRow">
                  <div class="vmpixSpinner" aria-hidden="true"></div>
                  <div class="vmpixBootText">
                    <div class="vmpixBootTitle">${BANDS_LOADING_TEXT}</div>
                    <div class="vmpixBootSub">If this is the first visit, the server may need a moment to wake.</div>
                  </div>
                </div>
                <div class="vmpixShimmer" aria-hidden="true"></div>
              </div>
            </div>
            <div id="results"></div>
          </div>
        </div>
      </div>
    `;
  }

  // ================== CSV LOAD (ported pattern) ==================
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

  // ================== PERF HELPERS ==================
  // Goal: faster first reveal (don't block UI) + fewer repeat network calls.

  // ---- Concurrency limiter (prevents request stampede) ----
  function pLimit(max) {
    let active = 0;
    const queue = [];
    const next = () => {
      if (active >= max || !queue.length) return;
      active++;
      const { fn, resolve, reject } = queue.shift();
      Promise.resolve()
        .then(fn)
        .then(resolve, reject)
        .finally(() => { active--; next(); });
    };
    return (fn) => new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
  }

  // Smooth-first: keep this low so the panel stays responsive (esp. mobile/webviews)
  const limitNet = pLimit(2);

  // ---- Session cache (Bands CSV) ----
  const BANDS_CSV_CACHE_KEY = "vm_music_bands_csv_v1";
  const BANDS_CSV_TTL_MS = 1000 * 60 * 30; // 30 minutes

	// ---- Session cache (Stats tab CSV: Fix / Metadata) ----
	// Server provides this as /sheet/stats (and aliases). We only read values to replace the "xxx" placeholders.
	const STATS_CSV_ENDPOINTS = [
  `${API_BASE}/sheet/stats`,
  `${API_BASE}/sheet/stats/`,
  `${API_BASE}/sheet/fix_metadata`,
  `${API_BASE}/sheet/fix_metadata/`,
  `${API_BASE}/sheet/fix-metadata`,
  `${API_BASE}/sheet/fixmetadata`,
  `${API_BASE}/sheet/fix`,
  `/sheet/stats`,
  `/sheet/fix_metadata`,
];

const STATS_CSV_CACHE_KEY = "vm_music_stats_csv_v2";
	const STATS_CSV_TTL_MS = 1000 * 60 * 10; // 10 minutes

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

    // Best-effort abort (older browsers may not support AbortController)
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
      const res = await fetch(url, options);
      return res;
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
        `${API_BASE}/health`,
        `${API_BASE}/ping`,
        `${API_BASE}/`,
        `${API_BASE}/sheet/stats`,
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

    // Warm the backend in the background (helps cold starts)
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

async function fetchTextWithSessionCache(url, ttlMs, key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.text && (Date.now() - (parsed.ts || 0)) < ttlMs) {
        return String(parsed.text || "");
      }
    }
  } catch (_) {}

  // Note: use retry/timeout to handle Render cold starts gracefully.
  const res = await _fetchWithRetry(url, {
    attempts: 3,
    timeoutMs: 25000,
    baseDelayMs: 750,
    fetchOptions: { cache: "no-store" }
  });
  const text = await res.text();

  // 🚨 HARD GUARD: stop if server returned HTML instead of CSV
  if (/<!doctype html>|<html/i.test(text)) {
    console.error("CSV fetch failed – received HTML instead:", url);
    console.warn("Preview:", text.slice(0, 200));
    return ""; // ⛔ prevents bad stats + broken numbers
  }

  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ ts: Date.now(), text })
    );
  } catch (_) {}

  return text;
}


async function fetchTextFirstOkWithSessionCache(urls, ttlMs, key) {
  // Reuse the same session cache bucket, but only cache on a successful (2xx) response.
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.text && (Date.now() - (parsed.ts || 0)) < ttlMs) {
        return String(parsed.text || "");
      }
    }
  } catch (_) {}

  const list = Array.isArray(urls) ? urls : [urls];
  let lastErr = null;

  for (let i = 0; i < list.length; i++) {
    const url = list[i];
    if (!url) continue;
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const text = await r.text();

      // IMPORTANT: Some hosts return the app's HTML (200 OK) for unknown routes.
      // If we accidentally treat that as CSV and cache it, stats will never parse.
      const trimmed = String(text || "").trimStart();
      if (
        /^<!doctype\s+html/i.test(trimmed) ||
        /^<html\b/i.test(trimmed) ||
        /^<style\b/i.test(trimmed)
      ) {
        throw new Error("Non-CSV HTML response");
      }

      try {
        sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), text }));
      } catch (_) {}

      return text;
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error("No stats endpoints succeeded");
}

// ---- Stats (Fix / Metadata tab) loader ----
	let _fixMetaPromise = null;
	let _fixMetaCached = null;

	function _firstNonEmpty(arr, idx) {
	  try {
	    const v = (arr && idx >= 0 && idx < arr.length) ? String(arr[idx] || "").trim() : "";
	    return v;
	  } catch (_) {
	    return "";
	  }
	}

	function _safeNumStr(s) {
	  const t = String(s || "").trim();
	  return t ? t : "—";
	}

	async function ensureFixMetadataStats() {
	  // Fix/Metadata stats are currently unused. Short-circuit to avoid unnecessary network calls.
	  return null;
	}

  // ---- Folder albums cache (per region + folder) ----
  const FOLDER_ALBUMS_CACHE = new Map(); // key -> { ts, albums }
  const FOLDER_ALBUMS_TTL_MS = 1000 * 60 * 30; // 30 minutes

  async function fetchFolderAlbumsCached(folderPath, region) {
    const safeFolder = cleanFolderPath(folderPath || "");
    if (!safeFolder) return [];

    const key = `${region || ""}||${safeFolder}`;
    const hit = FOLDER_ALBUMS_CACHE.get(key);
    const now = Date.now();

    if (hit && hit.albums && (now - (hit.ts || 0)) < FOLDER_ALBUMS_TTL_MS) {
      return hit.albums;
    }

    // limit heavy network calls
    const albums = await limitNet(() => fetchFolderAlbums(safeFolder, region));
    FOLDER_ALBUMS_CACHE.set(key, { ts: now, albums });
    return albums;
  }

  // ================== SHOWS INDEX (Option C) ==================
  // Albums: show_name + show_date from album name; venue line from /sheet/shows CSV (fallback to album Description)
  const SHOWS_ENDPOINT = `${API_BASE}/sheet/shows`;
  let _showsIndexPromise = null;
  let _showsByDate = null; // mmddyy -> [showRow,...]

  function normStr(s){
    return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function toMMDDYY(raw) {
    const s = String(raw || "").trim();
    if (!s) return "";
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

  function parseAlbumNameToShowBits(name){
    const raw = String(name || "").trim();
    const m = raw.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[-–—]\s*(.+)$/);
    if (m) {
      const dateStr = m[1].trim();
      const showName = m[2].trim();
      return { show_date: dateStr, show_name: showName, mmddyy: toMMDDYY(dateStr) };
    }
    return { show_date: "", show_name: raw, mmddyy: "" };
  }

  
  function findBandNavTarget(request) {
    const want = normStr(request && request.bandName);
    if (!want) return null;

    try {
      const regions = Object.keys(BANDS || {});
      for (const region of regions) {
        const lettersObj = BANDS[region] || {};
        const letters = Object.keys(lettersObj || {});
        for (const letter of letters) {
          const list = Array.isArray(lettersObj[letter]) ? lettersObj[letter] : [];
          for (const band of list) {
            const have = normStr(band && (band.name || band.band || ''));
            if (have && have === want) {
              return { region, letter, band };
            }
          }
        }
      }
    } catch (_) {}

    return null;
  }

  async function resolveBandNavAlbum(target, request) {
    const folderPath = cleanFolderPath(target?.band?.smug_folder || '');
    const region = String(target?.region || '').trim();
    if (!folderPath || !region) return null;

    const wantDate = toMMDDYY(request?.showDate || '');
    const wantTitle = normStr(request?.showTitle || '');
    const albums = await fetchFolderAlbumsCached(folderPath, region).catch(() => []);
    if (!Array.isArray(albums) || !albums.length) return null;

    let best = null;
    let bestScore = -1;

    albums.forEach((alb) => {
      const rawName = String(alb?.Name || alb?.Title || '').trim();
      if (!rawName) return;

      const bits = parseAlbumNameToShowBits(rawName);
      const haveDate = bits.mmddyy || '';
      const haveTitle = normStr(bits.show_name || rawName);
      let score = 0;

      if (wantDate && haveDate && haveDate === wantDate) score += 100;
      if (wantTitle && haveTitle) {
        if (haveTitle === wantTitle) score += 60;
        else if (haveTitle.includes(wantTitle) || wantTitle.includes(haveTitle)) score += 30;
      }

      if (score > bestScore) {
        bestScore = score;
        best = alb;
      }
    });

    const usable = bestScore >= 100 || (!wantDate && bestScore >= 60);
    if (!usable || !best) return null;

    return { album: best, allAlbums: albums, folderPath };
  }

  async function consumePendingBandNav() {
    let request = null;
    try {
      request = window.__VM_MUSIC_BAND_NAV || null;
      window.__VM_MUSIC_BAND_NAV = null;
    } catch (_) {}

    if (!request || normStr(request.source) !== 'shows') return false;

    const target = findBandNavTarget(request);
    if (!target || !target.band) return false;

    CURRENT_REGION = target.region || CURRENT_REGION;
    CURRENT_LETTER = target.letter || null;

    try { initRegionPills(); } catch (_) {}
    try { updateLegendStats(CURRENT_REGION, CURRENT_LETTER); } catch (_) {}
    try { updateLetterGroups(CURRENT_REGION, { autoSelect: false }); } catch (_) {}

    const match = await resolveBandNavAlbum(target, request).catch(() => null);
    if (match && match.album) {
      await showAlbumPhotos({
        region: target.region,
        letter: target.letter,
        band: target.band,
        album: match.album,
        folderPath: match.folderPath,
        allAlbums: match.allAlbums,
        _navSource: request
      });
      return true;
    }

    await showBandCard(target.region, target.letter, target.band);
    return true;
  }

  async function ensureShowsIndex(){
    if (_showsByDate) return _showsByDate;
    if (_showsIndexPromise) return _showsIndexPromise;

    _showsIndexPromise = fetch(SHOWS_ENDPOINT)
      .then((r) => r.text())
      .then((txt) => {
        if (!txt || !txt.trim()) return [];
        const lines = txt.split(/\r?\n/).filter((l) => l.trim());
        const headerLine = lines.shift();
        if (!headerLine) return [];

        const header = parseCsvLine(headerLine).map((h) => h.trim().toLowerCase());

        const idxName = header.indexOf("show_name") !== -1 ? header.indexOf("show_name") : header.indexOf("title");
        const idxDate = header.indexOf("show_date") !== -1 ? header.indexOf("show_date") : header.indexOf("date");
        // Poster URL column name varies in the sheet; be flexible.
        let idxUrl = -1;
        const urlCandidates = [
          "show_url",
          "poster_url",
          "show url",
          "poster url",
          "show poster url",
          "poster",
          "url",
        ];
        for (const key of urlCandidates) {
          const i = header.indexOf(key);
          if (i !== -1) { idxUrl = i; break; }
        }
        // As a last resort, grab the first column that looks like a poster/image url field.
        if (idxUrl === -1) {
          idxUrl = header.findIndex((h) => {
            const s = String(h || "").toLowerCase();
            return s.includes("url") && (s.includes("poster") || s.includes("show") || s.includes("image"));
          });
        }
        const idxVenue = header.indexOf("show_venue");
        const idxCity = header.indexOf("show_city") !== -1 ? header.indexOf("show_city") : header.indexOf("city");
        const idxState = header.indexOf("show_state") !== -1 ? header.indexOf("show_state") : header.indexOf("state");

        const rows = [];
        for (const line of lines) {
          const cols = parseCsvLine(line);
          const row = {
            show_name: idxName !== -1 ? (cols[idxName] || "").trim() : "",
            show_date: idxDate !== -1 ? (cols[idxDate] || "").trim() : "",
            show_url: idxUrl !== -1 ? (cols[idxUrl] || "").trim() : "",
            show_venue: idxVenue !== -1 ? (cols[idxVenue] || "").trim() : "",
            show_city: idxCity !== -1 ? (cols[idxCity] || "").trim() : "",
            show_state: idxState !== -1 ? (cols[idxState] || "").trim() : "",
          };
          row.mmddyy = toMMDDYY(row.show_date);
          rows.push(row);
        }
        return rows;
      })
      .then((rows) => {
        const map = new Map();
        (rows || []).forEach((row) => {
          const key = row.mmddyy || "";
          if (!key) return;
          if (!map.has(key)) map.set(key, []);
          map.get(key).push(row);
        });
        _showsByDate = map;
        return map;
      })
      .catch((e) => {
        console.warn("Shows index load failed:", e);
        _showsByDate = new Map();
        return _showsByDate;
      })
      .finally(() => {
        _showsIndexPromise = null;
      });

    return _showsIndexPromise;
  }

  async function loadBandsFromCsv() {
    try {
      const text = await fetchTextWithSessionCache(CSV_ENDPOINT, BANDS_CSV_TTL_MS, BANDS_CSV_CACHE_KEY);
      if (!text.trim()) return {};

      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const headerLine = lines.shift();
      const header = parseCsvLine(headerLine).map((h) => h.trim().toLowerCase());

      const bandIdx = header.indexOf("band");
      const regionIdx = header.indexOf("region");
      const letterIdx = header.indexOf("letter");
      const smugFolderIdx = header.indexOf("smug_folder");
      const logoIdx = header.indexOf("logo_url");

      const locationIdx = header.indexOf("location");
      const stateIdx = header.indexOf("state");
      const countryIdx = header.indexOf("country");
      const statusIdx = header.indexOf("status");
      const totalSetsIdx = header.indexOf("total_sets");
      const setsArchiveIdx = header.indexOf("sets_archive");

      // Members (new fields)
      const vox1Idx = header.indexOf("vox_1");
      const vox2Idx = header.indexOf("vox_2");
      const vox3Idx = header.indexOf("vox_3");
      const gtr1Idx = header.indexOf("guitar_1");
      const gtr2Idx = header.indexOf("guitar_2");
      const gtr3Idx = header.indexOf("guitar_3");
      const bassIdx = header.indexOf("bass");
      const drumIdx = header.indexOf("drum");
      const keysIdx = header.indexOf("keys");

      const past1Idx = header.indexOf("past_1");
      const past2Idx = header.indexOf("past_2");
      const past3Idx = header.indexOf("past_3");
      const past4Idx = header.indexOf("past_4");
      const past5Idx = header.indexOf("past_5");
      const past6Idx = header.indexOf("past_6");

      if (bandIdx === -1) return {};

      function bucketFor(name) {
        if (!name) return "0-C";
        const c = name.trim().charAt(0).toUpperCase();
        if ("ABC0123456789".includes(c)) return "0-C";
        if ("DEFG".includes(c)) return "D-G";
        if ("HIJK".includes(c)) return "H-K";
        if ("LMNO".includes(c)) return "L-O";
        if ("PQRS".includes(c)) return "P-S";
        return "T-Z";
      }

      const built = {};

      lines.forEach((line) => {
        const cols = parseCsvLine(line);
        const name = (cols[bandIdx] || "").trim();
        if (!name) return;

        const regionRaw =
          regionIdx !== -1 && cols[regionIdx] ? cols[regionIdx] : "Local";
        const region = (regionRaw || "Local").trim() || "Local";

        const letterRaw =
          letterIdx !== -1 && cols[letterIdx] ? cols[letterIdx] : "";
        const letter = letterRaw.trim() || bucketFor(name);

        const smugFolder =
          smugFolderIdx !== -1 && cols[smugFolderIdx]
            ? cols[smugFolderIdx].trim()
            : "";

        const logoUrl =
          logoIdx !== -1 && cols[logoIdx] ? cols[logoIdx].trim() : "";

        const bandData = {
          name,
          region,
          letter,
          smug_folder: smugFolder,
          logo_url: logoUrl,
          location: locationIdx !== -1 ? (cols[locationIdx] || "").trim() : "",
          state: stateIdx !== -1 ? (cols[stateIdx] || "").trim() : "",
          country: countryIdx !== -1 ? (cols[countryIdx] || "").trim() : "",
          status: statusIdx !== -1 ? (cols[statusIdx] || "").trim() : "",
          total_sets:
            totalSetsIdx !== -1 ? (cols[totalSetsIdx] || "").trim() : "",
          sets_archive:
            setsArchiveIdx !== -1 ? (cols[setsArchiveIdx] || "").trim() : "",

          // Member fields (role-specific columns)
          vox_1: vox1Idx !== -1 ? (cols[vox1Idx] || "").trim() : "",
          vox_2: vox2Idx !== -1 ? (cols[vox2Idx] || "").trim() : "",
          vox_3: vox3Idx !== -1 ? (cols[vox3Idx] || "").trim() : "",
          guitar_1: gtr1Idx !== -1 ? (cols[gtr1Idx] || "").trim() : "",
          guitar_2: gtr2Idx !== -1 ? (cols[gtr2Idx] || "").trim() : "",
          guitar_3: gtr3Idx !== -1 ? (cols[gtr3Idx] || "").trim() : "",
          bass: bassIdx !== -1 ? (cols[bassIdx] || "").trim() : "",
          drum: drumIdx !== -1 ? (cols[drumIdx] || "").trim() : "",
          keys: keysIdx !== -1 ? (cols[keysIdx] || "").trim() : "",

          past_1: past1Idx !== -1 ? (cols[past1Idx] || "").trim() : "",
          past_2: past2Idx !== -1 ? (cols[past2Idx] || "").trim() : "",
          past_3: past3Idx !== -1 ? (cols[past3Idx] || "").trim() : "",
          past_4: past4Idx !== -1 ? (cols[past4Idx] || "").trim() : "",
          past_5: past5Idx !== -1 ? (cols[past5Idx] || "").trim() : "",
          past_6: past6Idx !== -1 ? (cols[past6Idx] || "").trim() : "",

          // Arrays of member display lines (already formatted in sheet like: "Nick Owen (vox, bass)")
          core_members: [
            vox1Idx !== -1 ? (cols[vox1Idx] || "").trim() : "",
            vox2Idx !== -1 ? (cols[vox2Idx] || "").trim() : "",
            vox3Idx !== -1 ? (cols[vox3Idx] || "").trim() : "",
            gtr1Idx !== -1 ? (cols[gtr1Idx] || "").trim() : "",
            gtr2Idx !== -1 ? (cols[gtr2Idx] || "").trim() : "",
            gtr3Idx !== -1 ? (cols[gtr3Idx] || "").trim() : "",
            bassIdx !== -1 ? (cols[bassIdx] || "").trim() : "",
            drumIdx !== -1 ? (cols[drumIdx] || "").trim() : "",
            keysIdx !== -1 ? (cols[keysIdx] || "").trim() : "",
          ].filter(Boolean),

          other_members: [
            past1Idx !== -1 ? (cols[past1Idx] || "").trim() : "",
            past2Idx !== -1 ? (cols[past2Idx] || "").trim() : "",
            past3Idx !== -1 ? (cols[past3Idx] || "").trim() : "",
            past4Idx !== -1 ? (cols[past4Idx] || "").trim() : "",
            past5Idx !== -1 ? (cols[past5Idx] || "").trim() : "",
            past6Idx !== -1 ? (cols[past6Idx] || "").trim() : "",
          ].filter(Boolean),
        };

        if (!built[region]) built[region] = {};
        if (!built[region][letter]) built[region][letter] = [];
        built[region][letter].push(bandData);
      });

      return built;
    } catch (err) {
      console.error("Error loading bands CSV:", err);
      return {};
    }
  }

  // ================== SMUGMUG API HELPERS ==================
  // ----- Backend JSON fetch helper (fail-soft + avoids HTML/invalid JSON surprises) -----
  async function fetchJsonSafe(url, opts) {
    const o = opts || {};
    const timeoutMs = Number(o.timeoutMs || 25000);
    const maxRetries = Number(o.retries || 1);
    const retryStatuses = new Set([429, 500, 502, 503, 504]);

    let attempt = 0;
    while (true) {
      attempt++;
      const ac = (typeof AbortController !== "undefined") ? new AbortController() : null;
      const t = ac ? setTimeout(() => { try { ac.abort(); } catch (_) {} }, timeoutMs) : null;

      try {
        const res = await fetch(url, { signal: ac ? ac.signal : undefined });
        const ct = String(res.headers.get("content-type") || "").toLowerCase();
        const bodyText = await res.text();

        // Retry on transient status codes.
        if (!res.ok) {
          if (attempt <= maxRetries && retryStatuses.has(res.status)) {
            // If we're being rate-limited, honor Retry-After when present.
            let retryAfterMs = 0;
            try {
              if (res.status === 429) {
                const ra = String(res.headers.get("retry-after") || "").trim();
                const secs = Number(ra);
                if (Number.isFinite(secs) && secs > 0) retryAfterMs = Math.min(15000, Math.round(secs * 1000));
              }
            } catch (_) {}

            const expBackoff = Math.min(1500, 250 * Math.pow(2, attempt - 1));
            const jitter = Math.floor(Math.random() * 250);
            const backoff = Math.max(expBackoff, retryAfterMs) + jitter;

            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }
          const snippet = bodyText.slice(0, 180).replace(/\s+/g, " ").trim();
          throw new Error(`HTTP ${res.status} ${res.statusText || ""} (${ct || "unknown"}): ${snippet}`);
        }

        // Reject HTML masquerading as JSON.
        if (bodyText && /^[\s]*</.test(bodyText)) {
          throw new Error(`Expected JSON but got HTML (${ct || "unknown"})`);
        }

        try {
          return JSON.parse(bodyText || "null");
        } catch (e) {
          throw new Error(`Invalid JSON: ${String(e && e.message ? e.message : e)}`);
        }
      } catch (err) {
        // Retry on network/timeout errors.
        if (attempt <= maxRetries) {
          const expBackoff = Math.min(1500, 250 * Math.pow(2, attempt - 1));
          const jitter = Math.floor(Math.random() * 250);
          const backoff = expBackoff + jitter;
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        throw err;
      } finally {
        try { if (t) clearTimeout(t); } catch (_) {}
      }
    }
  }


  async function fetchFolderAlbums(folderPath, region) {
    const safeFolder = cleanFolderPath(folderPath || "");
    const baseSlug = toSlug(safeFolder || "");
    const url = `${API_BASE}/smug/${encodeURIComponent(
      baseSlug,
    )}?folder=${encodeURIComponent(safeFolder)}&region=${encodeURIComponent(
      region || "",
    )}&count=200&start=1`;

    const data = await fetchJsonSafe(url, { retries: 2 });
    const albumsRaw = (data && data.Response && (data.Response.Album || data.Response.Albums)) || [];
    if (Array.isArray(albumsRaw)) return albumsRaw;
    return albumsRaw ? [albumsRaw] : [];
  }

  async function fetchAllAlbumImages(albumKey) {
    const all = [];
    let start = 1;
    let more = true;

    while (more) {
      const data = await fetchJsonSafe(`${API_BASE}/smug/album/${encodeURIComponent(
          albumKey,
        )}?count=200&start=${start}`, { retries: 2 });
      const resp = (data && data.Response) || {};

      let imgs = [];
      if (Array.isArray(resp.AlbumImage)) imgs = resp.AlbumImage;
      else if (resp.AlbumImage) imgs = [resp.AlbumImage];
      else if (Array.isArray(resp.Images)) imgs = resp.Images;
      else if (resp.Images) imgs = [resp.Images];

      imgs = (imgs || []).filter(Boolean);
      all.push(...imgs);

      const pages = resp.Pages || {};
      const total = Number(pages.Total) || 0;
      const perPage = Number(pages.Count) || 200;
      const gotSoFar = start - 1 + imgs.length;
      if (!total || gotSoFar >= total || imgs.length === 0) {
        more = false;
      } else {
        start += perPage;
      }
    }

    return all;
  }

  async function fetchAlbumKeywords(albumKey) {
    if (!albumKey) return [];
    try {
      const metaJson = await fetchJsonSafe(`${API_BASE}/smug/album-meta/${encodeURIComponent(albumKey)}`, { retries: 1 }).catch(() => null);
      if (!metaJson) {
        // Backend can return 500 for some albums; fail-soft.
        return [];
      }
      const album = metaJson && metaJson.Response && metaJson.Response.Album;
      if (!album) return [];

      let ak = [];
      if (Array.isArray(album.KeywordArray) && album.KeywordArray.length) {
        ak = album.KeywordArray.map((k) => {
          if (!k) return "";
          if (typeof k === "string") return k;
          if (typeof k === "object" && typeof k.Name === "string") return k.Name;
          if (typeof k === "object" && typeof k.value === "string") return k.value;
          return "";
        }).filter(Boolean);
      } else if (typeof album.Keywords === "string" && album.Keywords.trim()) {
        ak = album.Keywords.split(/[,;]+/).map((k) => k.trim()).filter(Boolean);
      }

      // normalize + dedupe (case-insensitive)
      const norm = ak
        .map((k) => String(k || "").trim())
        .filter(Boolean);

      const seen = new Set();
      const out = [];
      for (const k of norm) {
        const key = k.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(k);
      }
      if (!out.length) {
        console.warn("No album keywords returned for", albumKey, { hasKeywordArray: !!album.KeywordArray, hasKeywordsString: !!album.Keywords });
      }
      return out;
    } catch (err) {
      console.warn("fetchAlbumKeywords failed", albumKey, err);
      return [];
    }
  }

  
  
  // ================== "Also appears in these albums" (cross-band via Bands CSV + SmugMug album keywords) ==================
  // Click a keyword/person chip in the Album Photos view to see other albums (in candidate band folders) where that keyword appears
  // in album-level SmugMug keywords. Candidates bands are filtered using the Bands CSV member columns to avoid scanning the whole archive.

  const _alsoModalCache = new Map(); // nameLower -> results[]
  const _albumKeywordSetCache = new Map(); // albumKeyLower -> Set(keywordLower)

  function _normKey(s) {
    return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
  }
  function _stripRoleSuffix(s) {
    // Normalize member strings coming from the Bands CSV so name-matching works.
    // Examples:
    //   "Bob Rox (drums)" -> "Bob Rox"
    //   "Brian Crawford - Guitar" -> "Brian Crawford"
    // Note: we ONLY strip a trailing role suffix when it's clearly separated
    // by spaces around a dash (so hyphenated names remain intact).
    return String(s || "")
      .trim()
      .replace(/\s*\([^)]*\)\s*$/, "")          // trailing "(role)"
      .replace(/\s*[-–—]\s+[^()]+$/, "")          // trailing " - Role"
      .trim();
  }

  function _eh(s){
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]));
  }

  function _getAllBandEntries() {
    const out = [];
    try {
      const regions = Object.keys(BANDS || {});
      regions.forEach((rk) => {
        const lettersObj = BANDS[rk] || {};
        Object.keys(lettersObj).forEach((lk) => {
          const arr = lettersObj[lk] || [];
          (arr || []).forEach((b) => out.push(b));
        });
      });
    } catch (_) {}
    return out;
  }

  function _bandMatchesPerson(bandObj, personLower) {
    const core = (bandObj && bandObj.core_members) || [];
    const other = (bandObj && bandObj.other_members) || [];
    const all = ([]).concat(core, other);
    for (const raw of all) {
      const n = _normKey(_stripRoleSuffix(raw));
      if (n && n === personLower) return true;
    }
    return false;
  }

  async function _getAlbumKeywordSet(albumKey) {
    const k = _normKey(albumKey);
    if (!k) return new Set();
    if (_albumKeywordSetCache.has(k)) return _albumKeywordSetCache.get(k);

    const kws = await fetchAlbumKeywords(albumKey).catch(() => []);
    const set = new Set((kws || []).map((x) => _normKey(x)).filter(Boolean));
    _albumKeywordSetCache.set(k, set);
    return set;
  }

  function _ensureAlsoModal() {
    let overlay = document.getElementById("alsoModalOverlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "alsoModalOverlay";
    overlay.className = "alsoModalOverlay";
    overlay.style.display = "none";
    overlay.innerHTML = `
      <div class="alsoModal" role="dialog" aria-modal="true">
        <div class="alsoModalHeader">
          <div class="alsoModalHeaderInner">
            <div class="alsoModalName" id="alsoModalName">—</div>
            <div class="alsoModalTitle">Also appears in these albums:</div>
            <div class="alsoModalMeta" id="alsoModalMeta"></div>
          </div>
          <button class="alsoModalClose" id="alsoModalClose">Close</button>
        </div>
        <div class="alsoModalBody" id="alsoModalBody"></div>
        <div class="alsoModalList" id="alsoModalList"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector("#alsoModalClose");
    const close = () => { overlay.style.display = "none"; };
    closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.style.display !== "none") close();
    });

    return overlay;
  }

  async function _runAlsoAppearsSearch(personName, ctx) {
    const personLower = _normKey(_stripRoleSuffix(personName));
    if (!personLower) return [];

    // cache by nameLower only (fast). If you later want scope-aware cache, include ctx.region/folder.
    if (_alsoModalCache.has(personLower)) return _alsoModalCache.get(personLower);

    const candidates = _getAllBandEntries().filter((b) => _bandMatchesPerson(b, personLower));
    const results = [];
    const seenAlbum = new Set();

    // Search each candidate band folder's albums and match on album keywords
    for (const b of candidates) {
      let folderPath = (b && b.smug_folder) ? String(b.smug_folder).trim() : "";
      // Strict: if smug_folder isn't set, we cannot search that band.
      if (!folderPath) continue;
      let region = (b && b.region) ? String(b.region).trim() : "";
      // If region is missing (older cached data), infer from smug_folder path; otherwise fall back to the current context.
      if (!region) {
        const fp = String(folderPath);
        if (/\/Local\//i.test(fp)) region = "Local";
        else if (/\/Regional\//i.test(fp)) region = "Regional";
        else if (/\/National\//i.test(fp)) region = "National";
        else if (/\/International\//i.test(fp)) region = "International";
        else if (ctx && ctx.region) region = String(ctx.region).trim();
      }

      let albums = [];
      try {
        albums = await fetchFolderAlbumsCached(folderPath, region);
      } catch (_) {
        continue;
      }
      for (const alb of (albums || [])) {
        const aKey = String(alb?.AlbumKey || alb?.Key || "").trim();
        if (!aKey) continue;
        const aKeyLower = _normKey(aKey);
        if (seenAlbum.has(aKeyLower)) continue;
        seenAlbum.add(aKeyLower);

        // exclude current album
        if (ctx && ctx.currentAlbumKey && _normKey(ctx.currentAlbumKey) === aKeyLower) continue;

        const set = await _getAlbumKeywordSet(aKey).catch(() => new Set());
        if (set && set.has(personLower)) {
          results.push({
            bandName: b.band || b.name || "Band",
            region,
            letter: b.letter || "",
            folderPath,
            album: alb,
            albumKey: aKey,
            title: String(alb?.Title || alb?.Name || alb?.NiceName || "").trim() || aKey,
          });
        }
      }
    }

    // Sort newest-ish by title (since we don't reliably have dates everywhere)
    results.sort((a, b) => String(a.title).localeCompare(String(b.title)));

    _alsoModalCache.set(personLower, results);
    return results;
  }

  async function openAlsoAppearsModal(personName, ctx) {
    const overlay = _ensureAlsoModal();
    const nameEl = overlay.querySelector("#alsoModalName");
    const metaEl = overlay.querySelector("#alsoModalMeta");
    const bodyEl = overlay.querySelector("#alsoModalBody");
    const listEl = overlay.querySelector("#alsoModalList");

    nameEl.textContent = personName;
    if (metaEl) metaEl.textContent = "";
    bodyEl.textContent = "Searching albums…";
    listEl.innerHTML = "";
    overlay.style.display = "flex";

    const results = await _runAlsoAppearsSearch(personName, ctx).catch(() => []);

    // Poster lookup: use Shows CSV (date -> show_url) so we can reliably display the poster image
    // even when the SmugMug album highlight image is missing.
    const showsByDate = await ensureShowsIndex().catch(() => new Map());

    if (!results.length) {
      if (metaEl) metaEl.textContent = "";
      bodyEl.textContent = "No other albums found for this name.";
      return;
    }

    // Sort by date (if present at start of title), newest first
    const parseDateNum = (s) => {
      const m = String(s || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (!m) return 0;
      let mm = parseInt(m[1], 10) || 0;
      let dd = parseInt(m[2], 10) || 0;
      let yy = parseInt(m[3], 10) || 0;
      if (yy < 100) yy += 2000; // assume 20xx
      // yyyymmdd numeric for sorting
      return (yy * 10000) + (mm * 100) + dd;
    };
    const splitTitle = (t) => {
      const s = String(t || "").trim();
      const m = s.match(/^\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*-\s*(.+)$/);
      if (m) return { date: m[1], rest: (m[2] || "").trim() };
      return { date: "", rest: s };
    };

    results.forEach((r) => {
      const parts = splitTitle(r.title);
      r.__dateNum = parts.date ? parseDateNum(parts.date) : 0;
      r.__dateStr = parts.date || "";
      r.__restTitle = parts.rest || String(r.title || "").trim();
    });
    results.sort((a, b) => (b.__dateNum - a.__dateNum) || String(a.__restTitle).localeCompare(String(b.__restTitle)));

    if (metaEl) {
      metaEl.textContent = `${results.length} album${results.length === 1 ? "" : "s"} found`;
    }
    bodyEl.textContent = "";

    // Group by band name (keeps the list cleaner when many entries are the same band)
    const groups = new Map();
    results.forEach((r) => {
      const key = String(r.bandName || "Band").trim() || "Band";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    });

    groups.forEach((items, bandName) => {
      const group = document.createElement("div");
      group.className = "alsoModalGroup";

      const hdr = document.createElement("div");
      hdr.className = "alsoModalGroupHdr";
      hdr.textContent = bandName;
      group.appendChild(hdr);

      items.forEach((r) => {
        const item = document.createElement("div");
        item.className = "alsoModalItem";
        item.setAttribute("role", "button");
        item.setAttribute("tabindex", "0");

        const datePart = r.__dateStr ? _eh(r.__dateStr) : "—";
        const titlePart = _eh(r.__restTitle || r.title);

        // Prefer poster image from Shows CSV (match by date, then best-effort by show title).
        // Fallback to SmugMug album highlight/thumbnail URLs.
        let posterUrl = "";
        try {
          const mmddyy = r.__dateStr ? toMMDDYY(r.__dateStr) : "";
          const list = (mmddyy && showsByDate && showsByDate.get(mmddyy)) ? (showsByDate.get(mmddyy) || []) : [];
          const wantTitle = normStr(r.__restTitle || r.title || "");

          // Pick the best matching show row for this date.
          let best = null;
          if (list && list.length) {
            // 1) exact-ish title match
            best = list.find((row) => {
              const have = normStr(row && row.show_name);
              return have && wantTitle && (have === wantTitle);
            }) || null;

            // 2) substring match either direction
            if (!best && wantTitle) {
              best = list.find((row) => {
                const have = normStr(row && row.show_name);
                return have && (have.includes(wantTitle) || wantTitle.includes(have));
              }) || null;
            }

            // 3) first row with a show_url
            if (!best) {
              best = list.find((row) => String(row?.show_url || "").trim()) || null;
            }
          }

          const fromShows = best ? String(best.show_url || "").trim() : "";
          if (fromShows) posterUrl = fromShows;
        } catch (_) {}

        if (!posterUrl) {
          posterUrl =
            r?.album?.HighlightImage?.ThumbnailUrl ||
            r?.album?.HighlightImage?.SmallUrl ||
            r?.album?.HighlightImage?.MediumUrl ||
            r?.album?.ThumbnailUrl ||
            r?.album?.SmallUrl ||
            r?.album?.MediumUrl ||
            "";
        }
        const posterHtml = posterUrl
          ? `<img class="alsoModalPosterIcon" src="${_eh(posterUrl)}" alt="" loading="lazy">`
          : `<div class="alsoModalPosterFallback" aria-hidden="true"></div>`;

        item.innerHTML = `
          <div class="alsoModalItemRow">
            <div class="alsoModalItemDate">${posterHtml}</div>
            <div class="alsoModalItemMain">
              <div class="alsoModalItemTitle">${titlePart}</div>
              <div class="alsoModalItemSub">${datePart}</div>
            </div>
          </div>
        `;

        const go = async () => {
          // jump to that album's photo view (same flow)
          overlay.style.display = "none";
          await showAlbumPhotos({
            // When jumping from the modal, keep the *current* band context for navigation
            region: (ctx && ctx.region) || r.region || "",
            letter: (ctx && ctx.letter) || r.letter || "",
            band: (ctx && ctx.band) || (LAST_BAND_CTX && LAST_BAND_CTX.band) || null,
            album: r.album,
            folderPath: r.folderPath,
            allAlbums: null,
            _returnCtx: ctx || LAST_BAND_CTX || null,
          });
        };

        item.addEventListener("click", go);
        item.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            go();
          }
        });

        group.appendChild(item);
      });

      listEl.appendChild(group);
    });
  }
async function downloadZipFromServer(items, suggestedName){
    // items: [{ url, filename }]
    const name = (suggestedName || "photos").replace(/[^a-z0-9-_]+/gi, "-").slice(0, 80) || "photos";
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

  // ================== LIGHTBOX (ported pattern) ==================
  let lightboxEl = null;
  let lightboxImg = null;
  let lightboxCaption = null;
  let currentViewList = [];
  let currentAlbumContext = { band: '', album: '', show: '' };
  let lightboxIndex = 0;

  function upgradeSmugToOriginal(url) {
    if (!url) return "";
    let out = url.replace(/\/(S|M|L|XL|X2|X3|Th|T)\//gi, "/O/");
    out = out.replace(/-(S|M|L|XL|X2|X3|Th|T)\./gi, "-O.");
    return out;
  }

  function bestFullUrl(img) {
    // Prefer the highest quality URL we have from SmugMug image payloads.
    // Different endpoints return different field names, so include the common variants.
    const candidates = [
      img?.OriginalUrl,
      img?.LargestImageUrl,
      img?.OriginalImageUrl,
      img?.OriginalSizeUrl,
      img?.ArchivedSizeUrl,
      img?.ImageUrl,
      img?.X3LargeUrl,
      img?.X2LargeUrl,
      img?.XLargeUrl,
      img?.LargeUrl,
      img?.MediumUrl,
      img?.SmallUrl,
      img?.ThumbnailUrl,
      img?.TinyUrl,
      img?.Url,
    ].filter(Boolean);

    if (!candidates.length) return "";
    const first = candidates[0];

    // If we only got a sized SmugMug CDN URL, upgrade it to Original by swapping the size token.
    if (
      candidates.length === 1 &&
      /photos\.smugmug\.com\/.+\/(S|M|L|XL|X2|X3|Th|T)\//i.test(first)
    ) {
      return upgradeSmugToOriginal(first);
    }
    return first;
  }
function ensureLightbox() {
    if (lightboxEl) return;

    lightboxEl = document.createElement("div");
    lightboxEl.className = "lightbox";

    // Shell
    const shell = document.createElement("div");
    shell.className = "lightboxShell";

    // Topbar
    const topbar = document.createElement("div");
    topbar.className = "lightboxTopbar";

    const titleBox = document.createElement("div");
    titleBox.className = "lightboxTitle";

    const line1 = document.createElement("div");
    line1.className = "line1";
    line1.textContent = "";

    const line2 = document.createElement("div");
    line2.className = "line2";
    line2.textContent = "←/→ navigate • Esc close";

    titleBox.appendChild(line1);
    titleBox.appendChild(line2);

    const counter = document.createElement("div");
    counter.className = "lightboxCounter";
    counter.textContent = "";

    const dlBtn = document.createElement("a");
    dlBtn.className = "lightboxDownloadBtn";
    dlBtn.textContent = "Download ⭳";
    dlBtn.href = "#";
    dlBtn.target = "_blank";
    dlBtn.rel = "noopener";
    dlBtn.addEventListener("click", (e) => {
      // Best-effort: some browsers block download attribute for cross-origin; opening in new tab still works.
      if (dlBtn.href === "#") { e.preventDefault(); return; }
    });

    // Hide by default (logic still updates href in showAt)
    try { dlBtn.style.display = SHOW_LIGHTBOX_DOWNLOAD_BTN ? "inline-flex" : "none"; } catch(_) {}

    const closeBtn = document.createElement("button");
    closeBtn.className = "lightboxCloseBtn";
    closeBtn.textContent = "Close ✕";
    closeBtn.onclick = () => destroyLightbox();

    topbar.appendChild(titleBox);
    topbar.appendChild(counter);
    topbar.appendChild(dlBtn);
    topbar.appendChild(closeBtn);

    // Stage
    const stage = document.createElement("div");
    stage.className = "lightboxStage";

    lightboxImg = document.createElement("img");
    lightboxImg.className = "lightboxImg";

    const prevBtn = document.createElement("button");
    prevBtn.className = "lightboxNavBtn lightboxNavPrev";
    prevBtn.type = "button";
    prevBtn.textContent = "←";
    prevBtn.onclick = (e) => { e.stopPropagation(); showAt(lightboxIndex - 1); };

    const nextBtn = document.createElement("button");
    nextBtn.className = "lightboxNavBtn lightboxNavNext";
    nextBtn.type = "button";
    nextBtn.textContent = "→";
    nextBtn.onclick = (e) => { e.stopPropagation(); showAt(lightboxIndex + 1); };

    stage.appendChild(lightboxImg);
    stage.appendChild(prevBtn);
    stage.appendChild(nextBtn);

    // Filmstrip
    const strip = document.createElement("div");
    strip.className = "lightboxStrip";

    shell.appendChild(topbar);
    shell.appendChild(stage);
    shell.appendChild(strip);

    lightboxEl.appendChild(shell);
    document.body.appendChild(lightboxEl);

    // Click outside shell closes
    lightboxEl.addEventListener("click", (e) => {
      if (e.target === lightboxEl) destroyLightbox();
    });

    // Keyboard nav (install once per open)
    const onKey = (e) => {
      if (!lightboxEl) return;
      if (e.key === "Escape") { e.preventDefault(); destroyLightbox(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); showAt(lightboxIndex - 1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); showAt(lightboxIndex + 1); }
    };
    window.addEventListener("keydown", onKey);

    // prevent background scroll
    try { document.documentElement.style.overflow = "hidden"; } catch(_) {}

    // stash refs for cleanup
    lightboxEl._onKey = onKey;
    lightboxEl._line1 = line1;
    lightboxEl._counter = counter;
    lightboxEl._dlBtn = dlBtn;
    lightboxEl._strip = strip;
  }

  function destroyLightbox() {
    if (!lightboxEl) return;

    try {
      const onKey = lightboxEl._onKey;
      if (onKey) window.removeEventListener("keydown", onKey);
    } catch(_) {}

    try { document.documentElement.style.overflow = ""; } catch(_) {}

    if (lightboxEl && lightboxEl.parentNode) lightboxEl.parentNode.removeChild(lightboxEl);

    lightboxEl = null;
    lightboxImg = null;
    lightboxCaption = null;
  }

  
  function showAt(idx) {
    if (!currentViewList.length || !lightboxImg || !lightboxEl) return;
    if (idx < 0) idx = currentViewList.length - 1;
    if (idx >= currentViewList.length) idx = 0;
    lightboxIndex = idx;

    const img = currentViewList[idx];
    if (!img) return;

    // Crossfade
    try { lightboxImg.style.opacity = "0"; } catch(_) {}

    const url = bestFullUrl(img);

    // Update Download button for current image (best effort)
    try {
      const dl = lightboxEl && lightboxEl._dlBtn;
      if (dl) {
        const fn2 = String(img?.FileName || `photo-${idx+1}.jpg`).trim() || `photo-${idx+1}.jpg`;
        dl.href = url || "#";
        dl.setAttribute("download", fn2);
        dl.style.pointerEvents = url ? "auto" : "none";
        dl.style.opacity = url ? "1" : "0.55";
        dl.style.display = SHOW_LIGHTBOX_DOWNLOAD_BTN ? "inline-flex" : "none";
      }
    } catch(_) {}
    lightboxImg.onload = () => {
      try { lightboxImg.style.opacity = "1"; } catch(_) {}
    };
    lightboxImg.src = url;

    // Caption lines
    const band = String(currentAlbumContext?.band || "").trim();
    const album = String(currentAlbumContext?.album || "").trim();
    const show = String(currentAlbumContext?.show || "").trim();
    const fn = String(img.FileName || '').trim();

    // Analytics: individual photo view
    try {
      safetrack('photo_open', {
        band: band,
        show: show,
        album: album,
        photo: fn || String(url || ''),
        category: 'lightbox',
        extra: { index: idx + 1, total: currentViewList.length }
      });
    } catch (_) {}

    const line1Parts = [];
    if (band) line1Parts.push(band);
    if (show) line1Parts.push(show);
    else if (album) line1Parts.push(album);

    if (fn) line1Parts.push(fn);

    const line1 = line1Parts.join(" • ");
    const counterText = `${idx + 1} / ${currentViewList.length}`;

    try {
      const l1 = lightboxEl._line1;
      if (l1) l1.textContent = line1 || "Photo Viewer";
      const c = lightboxEl._counter;
      if (c) c.textContent = counterText;
    } catch(_) {}

    // Filmstrip active state + keep visible
    try {
      const strip = lightboxEl._strip;
      if (strip) {
        const thumbs = strip.querySelectorAll(".lightboxThumb");
        thumbs.forEach((t) => t.classList.remove("active"));
        const active = strip.querySelector(`.lightboxThumb[data-idx="${idx}"]`);
        if (active) {
          active.classList.add("active");
          active.scrollIntoView({ block: "nearest", inline: "center" });
        }
      }
    } catch(_) {}
  }

  
  function openLightbox(list, idx, context) {
    currentViewList = Array.isArray(list) ? list : [];
    if (context && typeof context === "object") {
      currentAlbumContext = {
        band: String(context.band || ""),
        album: String(context.album || ""),
        show: String(context.show || ""),
      };
    } else {
      currentAlbumContext = { band: "", album: "", show: "" };
    }

    ensureLightbox();

    // Analytics: opening the viewer for this album
    try {
      safetrack('album_open', {
        band: String(currentAlbumContext?.band || ''),
        show: String(currentAlbumContext?.show || ''),
        album: String(currentAlbumContext?.album || ''),
        category: 'lightbox',
        photo: ''
      });
    } catch (_) {}

    // Build filmstrip (thumbnails) once per open
    try {
      const strip = lightboxEl && lightboxEl._strip;
      if (strip) {
        strip.innerHTML = "";
        const maxThumbs = Math.min(currentViewList.length, 220); // keep it snappy
        for (let i = 0; i < maxThumbs; i++) {
          const it = currentViewList[i];
          const th = document.createElement("img");
          th.className = "lightboxThumb";
          th.dataset.idx = String(i);
          th.loading = "lazy";
          th.alt = it?.FileName || `Photo ${i + 1}`;
          th.src = it?.ThumbnailUrl || it?.SmallUrl || it?.MediumUrl || bestFullUrl(it);
          th.addEventListener("click", (e) => {
            e.stopPropagation();
            showAt(i);
          });
          strip.appendChild(th);
        }
      }
    } catch(_) {}

    showAt(idx);
  }

  // ================== UI BUILDERS ==================

  // ================== HUD TRANSITION HELPERS ==================
  function runHudWipe(targetOrDuration, opts){
    // Backwards compatible:
    //  - runHudWipe(420) => Promise that resolves when wipe completes
    //  - runHudWipe(hostEl, { hold:true, minHoldMs:340 }) => controller with .remove()
    //  - runHudWipe(420, { hold:true }) => controller with .remove()
    const options = (opts && typeof opts === "object") ? opts : null;
    const dur = (typeof targetOrDuration === "number") ? (Number(targetOrDuration) || 420) : 420;
    // If the first arg is an Element, treat it as the host container to keep the wipe local.
    const hostEl = (targetOrDuration && typeof targetOrDuration === "object" && targetOrDuration.nodeType === 1)
      ? targetOrDuration
      : (options && options.hostEl && options.hostEl.nodeType === 1 ? options.hostEl : null);

    try {
      const existing = document.getElementById('hudWipeOverlay');
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    } catch(_) {}

    const overlay = document.createElement('div');
    overlay.id = 'hudWipeOverlay';
    overlay.className = 'hudWipeOverlay';

    // Mount strategy:
    // - Default: fixed full-screen overlay on <body> (existing behavior)
    // - Contained: absolute overlay inside a provided host element (panel-only behavior)
    let mount = document.body;
    if (hostEl) {
      mount = hostEl;
      overlay.classList.add('is-contained');
      try {
        const cs = window.getComputedStyle(mount);
        if (cs && cs.position === 'static') mount.style.position = 'relative';
      } catch (_) {}
    }
    mount.appendChild(overlay);

    const startedAt = Date.now();

    window.requestAnimationFrame(() => {
      try { overlay.classList.add('is-on'); } catch(_) {}
    });

    const doRemove = () => {
      try { overlay.classList.remove('is-on'); } catch(_) {}
      window.setTimeout(() => {
        try { overlay.remove(); } catch(_) {}
      }, 160);
    };

    // HOLD mode: caller controls when to remove (prevents blank flashes during view swaps)
    if (options && options.hold) {
      return {
        _startedAt: startedAt,
        remove: doRemove
      };
    }

    // Default mode: auto remove after duration (classic behavior)
    return new Promise((resolve) => {
      window.setTimeout(() => {
        doRemove();
        window.setTimeout(resolve, 180);
      }, dur);
    });
  }

  // ================== SHARED-ELEMENT TRANSITION ==================
  // Option A: "logo zoom" from the clicked band card into the detail header logo.
  async function animateBandOpen(region, letter, bandObj, fromImgEl) {
    try {
      if (!fromImgEl) {
        // fallback
        showBandCard(region, letter, bandObj, { deferContent: true });
        return;
      }

      // Card emphasis (makes the click feel like it "expands" into the detail view)
      const fromCardEl = (() => {
        try { return fromImgEl.closest && fromImgEl.closest('.band-card'); } catch(_) { return null; }
      })();
      try {
        if (resultsEl) resultsEl.classList.add('is-dimming');
        if (fromCardEl) fromCardEl.classList.add('is-opening');
      } catch(_) {}

      const startRect = fromImgEl.getBoundingClientRect();
      if (!startRect || !startRect.width || !startRect.height) {
        showBandCard(region, letter, bandObj, { deferContent: true });
        return;
      }

      // Clone the logo image and animate it as a fixed overlay
      const clone = fromImgEl.cloneNode(true);
      const startStyle = window.getComputedStyle(fromImgEl);

      clone.style.position = "fixed";
      clone.style.left = `${startRect.left}px`;
      clone.style.top = `${startRect.top}px`;
      clone.style.width = `${startRect.width}px`;
      clone.style.height = `${startRect.height}px`;
      clone.style.margin = "0";
      clone.style.zIndex = "999999";
      clone.style.pointerEvents = "none";
      clone.style.transformOrigin = "top left";
      clone.style.borderRadius = startStyle.borderRadius || "12px";
      clone.style.boxShadow = "0 18px 40px rgba(0,0,0,0.45)";
      clone.style.willChange = "transform";

      // Soft dim behind the transition
      const overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.background = "rgba(0,0,0,0.30)";
      overlay.style.opacity = "0";
      overlay.style.transition = "opacity 180ms ease";
      overlay.style.zIndex = "999998";
      overlay.style.pointerEvents = "none";

      document.body.appendChild(overlay);
      document.body.appendChild(clone);
      window.requestAnimationFrame(() => (overlay.style.opacity = "1"));

      // Render destination view ASAP (don’t await album loading)
      showBandCard(region, letter, bandObj, { deferContent: true });

      // Wait for destination logo to exist
      let destLogo = null;
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => window.requestAnimationFrame(r));
        destLogo = (panelRoot || document).querySelector(".bandDetailLogo");
        if (destLogo) break;
      }

      if (!destLogo) {
        // fallback cleanup
        try {
          if (resultsEl) resultsEl.classList.remove('is-dimming');
          if (fromCardEl) fromCardEl.classList.remove('is-opening');
        } catch(_) {}
        overlay.remove();
        clone.remove();
        return;
      }

      // Fade/slide the detail view in
      const wrap = (panelRoot || document).querySelector(".bandDetailWrap");
      if (wrap) {
        wrap.classList.add("entering");
        window.requestAnimationFrame(() => wrap.classList.remove("entering"));
      }

      // Hide the real logo until the clone arrives
      const destRect = destLogo.getBoundingClientRect();
      const destStyle = window.getComputedStyle(destLogo);
      destLogo.style.opacity = "0";

      const dx = destRect.left - startRect.left;
      const dy = destRect.top - startRect.top;
      const sx = destRect.width / startRect.width;
      const sy = destRect.height / startRect.height;

      const anim = clone.animate(
        [
          { transform: "translate(0px, 0px) scale(1, 1)", borderRadius: startStyle.borderRadius || "12px" },
          { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, borderRadius: destStyle.borderRadius || "18px" },
        ],
        { duration: 420, easing: "cubic-bezier(0.2, 0.85, 0.2, 1)", fill: "forwards" }
      );

      await anim.finished.catch(() => {});

      // Reveal content only after logo transition lands (prevents blink)
      try {
        const wrapEl = (panelRoot || document).querySelector(".bandDetailWrap");
        if (wrapEl && typeof wrapEl._releaseContent === "function") {
          // Try to decode logo before showing it (best effort)
          try {
            if (destLogo && destLogo.decode) await destLogo.decode();
          } catch (_) {}
          wrapEl._releaseContent();
          delete wrapEl._releaseContent;
        }
      } catch (_) {}

      // Reveal the real logo and cleanup
      destLogo.style.opacity = "";

      // Restore list card state (best effort)
      try {
        if (resultsEl) resultsEl.classList.remove('is-dimming');
        if (fromCardEl) fromCardEl.classList.remove('is-opening');
      } catch(_) {}

      overlay.style.opacity = "0";
      window.setTimeout(() => {
        try { overlay.remove(); } catch (_) {}
      }, 200);

      try { clone.remove(); } catch (_) {}
    } catch (e) {
      // If anything goes wrong, just open normally
      try {
        if (resultsEl) resultsEl.classList.remove('is-dimming');
        const c = (fromImgEl && fromImgEl.closest) ? fromImgEl.closest('.band-card') : null;
        if (c) c.classList.remove('is-opening');
      } catch(_) {}
      try { showBandCard(region, letter, bandObj); } catch (_) {}
    }
  }

  // Reverse transition: "logo zoom back" from detail header into the band card logo in the list.
  async function animateBandClose(region, letter, bandObj) {
    try {
      const fromLogo = (panelRoot || document).querySelector(".bandDetailLogo");
      if (!fromLogo) {
        showLetter(region, letter);
        return;
      }

      const startRect = fromLogo.getBoundingClientRect();
      if (!startRect || !startRect.width || !startRect.height) {
        showLetter(region, letter);
        return;
      }

      // Clone the big logo as a fixed overlay
      const clone = fromLogo.cloneNode(true);
      const startStyle = window.getComputedStyle(fromLogo);

      clone.style.position = "fixed";
      clone.style.left = `${startRect.left}px`;
      clone.style.top = `${startRect.top}px`;
      clone.style.width = `${startRect.width}px`;
      clone.style.height = `${startRect.height}px`;
      clone.style.margin = "0";
      clone.style.zIndex = "999999";
      clone.style.pointerEvents = "none";
      clone.style.transformOrigin = "top left";
      clone.style.borderRadius = startStyle.borderRadius || "18px";
      clone.style.boxShadow = "0 18px 40px rgba(0,0,0,0.45)";
      clone.style.willChange = "transform";

      // Soft dim behind the transition
      const overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.background = "rgba(0,0,0,0.30)";
      overlay.style.opacity = "1";
      overlay.style.transition = "opacity 180ms ease";
      overlay.style.zIndex = "999998";
      overlay.style.pointerEvents = "none";

      document.body.appendChild(overlay);
      document.body.appendChild(clone);

      // Render the destination (band list) first, but keep it hidden until the logo lands
      showLetter(region, letter);

      // Hide list while we animate
      try {
        if (resultsEl) {
          resultsEl.style.opacity = "0";
          resultsEl.style.transition = "opacity 180ms ease";
        }
      } catch (_) {}

      // Find the matching band card logo in the list
      let targetImg = null;
      for (let i = 0; i < 45; i++) {
        await new Promise((r) => window.requestAnimationFrame(r));
        const cards = (panelRoot || document).querySelectorAll("#results .band-card");
        if (cards && cards.length) {
          for (const c of cards) {
            const nm = c.querySelector(".band-name");
            const txt = (nm ? nm.textContent : "").trim();
            if (txt && txt.toLowerCase() === String(bandObj?.name || "").trim().toLowerCase()) {
              targetImg = c.querySelector("img.band-logo");
              break;
            }
          }
        }
        if (targetImg) break;
      }

      if (!targetImg) {
        // fallback: just fade in list and cleanup
        if (resultsEl) resultsEl.style.opacity = "1";
        overlay.style.opacity = "0";
        window.setTimeout(() => { try { overlay.remove(); } catch(_){} }, 200);
        try { clone.remove(); } catch(_) {}
        return;
      }

      const endRect = targetImg.getBoundingClientRect();
      const endStyle = window.getComputedStyle(targetImg);

      // Hide the real target logo until the clone arrives
      targetImg.style.opacity = "0";

      const dx = endRect.left - startRect.left;
      const dy = endRect.top - startRect.top;
      const sx = endRect.width / startRect.width;
      const sy = endRect.height / startRect.height;

      const anim = clone.animate(
        [
          { transform: "translate(0px, 0px) scale(1, 1)", borderRadius: startStyle.borderRadius || "18px" },
          { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, borderRadius: endStyle.borderRadius || "12px" },
        ],
        { duration: 380, easing: "cubic-bezier(0.2, 0.85, 0.2, 1)", fill: "forwards" }
      );

      await anim.finished.catch(() => {});

      // Reveal list + real logo, cleanup
      targetImg.style.opacity = "";
      if (resultsEl) resultsEl.style.opacity = "1";

      overlay.style.opacity = "0";
      window.setTimeout(() => {
        try { overlay.remove(); } catch (_) {}
      }, 200);

      try { clone.remove(); } catch (_) {}
    } catch (e) {
      try { showLetter(region, letter); } catch (_) {}
    }
  }

  function initRegionPills() {
    if (!regionPillsEl) return;
    regionPillsEl.innerHTML = "";

    const regions = ["Local", "Regional", "National", "International"];

    regions.forEach((key) => {
      const pill = document.createElement("div");
      pill.className = "region-pill";
      pill.textContent = key;
      pill.dataset.regionKey = key;

      pill.addEventListener("click", () => {
        regionPillsEl
          .querySelectorAll(".region-pill")
          .forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");

        CURRENT_REGION = key;
        try { CURRENT_LETTER = null; } catch(_) {}
        try { updateLegendStats(key, null); } catch(_) {}
        resetPanelScroll();
        ensurePanelScrollable();
        // Keep current results visible until the transition swaps to the next letter group
        updateLetterGroups(key, { autoSelect: true });
        window.setTimeout(() => resetPanelScroll(), 200);
        // crumbs removed
      });

      regionPillsEl.appendChild(pill);
    });

    // default active
    const def = regionPillsEl.querySelector(`.region-pill[data-region-key="${CURRENT_REGION}"]`);
    if (def) def.classList.add("active");
  }

  function updateLetterGroups(regionKey, opts) {
    if (!letterGroupsEl) return;
    letterGroupsEl.innerHTML = "";

    if (!BANDS || !BANDS[regionKey]) return;

    const letters = Object.keys(BANDS[regionKey]).sort();
    letters.forEach((letter) => {
      const btn = document.createElement("button");
      btn.className = "letter-pill";
      btn.textContent = letter;

      btn.addEventListener("click", () => {
        letterGroupsEl
          .querySelectorAll(".letter-pill")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        showLetter(regionKey, letter);
      });

      letterGroupsEl.appendChild(btn);
    });

    // Optional: auto-select a default letter group (prefers "0-C")
    try {
      if (opts && opts.autoSelect && letters.length) {
        const preferred = letters.includes("0-C") ? "0-C" : letters[0];
        const btn = Array.from(letterGroupsEl.querySelectorAll(".letter-pill")).find(
          (b) => String(b.textContent || "").trim() === preferred,
        );
        if (btn) {
          // mirror a real click so rendering always happens
          btn.click();
        } else {
          // last resort: render directly
          showLetter(regionKey, preferred);
        }
      }
    } catch (_) {}
  }

  // ===== Band list coloring based on sets_archive vs total_sets =====
  // Rules:
  //  - if total_sets and sets_archive are equal (and both present) => green
  //  - if total_sets > sets_archive (and both present) => yellow
  //  - if either field missing/blank => gray
  function setsStateClass(bandObj){
    try {
      const tRaw = (bandObj && bandObj.total_sets != null) ? String(bandObj.total_sets).trim() : "";
      const aRaw = (bandObj && bandObj.sets_archive != null) ? String(bandObj.sets_archive).trim() : "";
      if (!tRaw || !aRaw) return "setsNone";

      const total = Number(tRaw);
      const archived = Number(aRaw);
      if (!Number.isFinite(total) || !Number.isFinite(archived)) return "setsNone";

      if (total === archived) return "setsGood";
      if (total > archived) return "setsPartial";

      // If archived > total (rare / data mismatch), treat as complete.
      return "setsGood";
    } catch (_) {
      return "setsNone";
    }
  }

  // ===== Dynamic legend stats (counts update on Region/Letter changes) =====
  function getBandsInScope(region, letter){
    try{
      const reg = (region && BANDS && BANDS[region]) ? BANDS[region] : null;
      if (!reg) return [];
      // If a letter is provided, use that group; otherwise combine all letters for the region.
      if (letter && reg[letter]) return Array.isArray(reg[letter]) ? reg[letter] : [];
      const out = [];
      Object.keys(reg || {}).forEach((lk) => {
        const arr = reg[lk];
        if (Array.isArray(arr)) out.push(...arr);
      });
      return out;
    } catch(_){
      return [];
    }
  }

  
  function getAllBandsOverall(){
    try{
      const out = [];
      const regions = Object.keys(BANDS || {});
      regions.forEach((rk) => {
        const reg = BANDS[rk] || {};
        Object.keys(reg || {}).forEach((lk) => {
          const arr = reg[lk];
          if (Array.isArray(arr)) out.push(...arr);
        });
      });
      return out;
    } catch(_){
      return [];
    }
  }

// ===== Reimaging Stats: animate once per session (Option B) =====
function animateReimagingStats(overallEl){
  try{
    if (!overallEl) return;

    // Replay each time you enter this screen: run once per DOM mount
    try{
      if (overallEl.dataset && overallEl.dataset.reimagingAnimRan === "1") return;
      if (overallEl.dataset) overallEl.dataset.reimagingAnimRan = "1";
    } catch(_){}

    // Respect reduced motion
    try{
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }
    } catch(_){}

    const rows = Array.from(overallEl.querySelectorAll(".statsRow"));
    if (rows.length){
      // Reset state so the animation always has a clean starting point
      rows.forEach((r) => {
        try{
          r.classList.remove("reimagingAnimIn");
          r.classList.add("reimagingAnimHidden");
        } catch(_){}
      });

      window.requestAnimationFrame(() => {
        rows.forEach((r, i) => {
          window.setTimeout(() => {
            try{
              r.classList.add("reimagingAnimIn");
              r.classList.remove("reimagingAnimHidden");
            } catch(_){}
          }, Math.min(520, i * 110));
        });
      });
    }

    const segs = Array.from(overallEl.querySelectorAll(".overallStatsBar .seg"));
    if (segs.length){
      // Start collapsed, then expand to target percentages
      segs.forEach((s) => {
        try { s.style.width = "0%"; } catch(_){}
      });

      window.requestAnimationFrame(() => {
        segs.forEach((s, i) => {
          const pct = Number(s.getAttribute("data-pct")) || 0;
          window.setTimeout(() => {
            try { s.style.width = pct.toFixed(2) + "%"; } catch(_){}
          }, Math.min(420, i * 140));
        });
      });
    }

    // Count-up animation for the right-side numeric values (no value changes; ends on original text)
    try{
      const ids = ["fixmeta-total-files","fixmeta-not-upgraded","fixmeta-on-site","fixmeta-percent"];
      const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

      ids.forEach((id) => {
        const el = overallEl.querySelector("#" + id);
        if (!el) return;

        const original = (el.dataset && el.dataset.originalText) ? el.dataset.originalText : (el.textContent || "").trim();
        try{
          if (el.dataset) el.dataset.originalText = original;
        } catch(_){}

        // Parse numeric value
        const raw = original.replace(/,/g, "");
        const target = Number(raw);
        if (!isFinite(target)) return;

        const isPercent = (id === "fixmeta-percent");
        const isInteger = !isPercent; // your file counts are integers; percent uses 2 decimals

        const dur = 1400;
        const t0 = performance.now();
        el.classList.add("isCounting");

        const tick = (now) => {
          const t = Math.min(1, (now - t0) / dur);
          const v = target * easeOutCubic(t);

          try{
            if (isPercent){
              const val = Math.max(0, Math.min(target, v));
              el.textContent = val.toFixed(2);
              // drive the ring fill
              const row = el.closest(".statsPctRow") || el.parentElement;
              if (row && row.style) row.style.setProperty("--pct", String(val));
            } else if (isInteger){
              const val = Math.round(Math.max(0, Math.min(target, v)));
              el.textContent = val.toLocaleString();
            } else {
              el.textContent = String(v);
            }
          } catch(_){}

          if (t < 1) {
            window.requestAnimationFrame(tick);
          } else {
            // End exactly on the original display text
            try{ el.textContent = original; } catch(_){}
            try{ el.classList.remove("isCounting"); } catch(_){}
            try{
              if (isPercent){
                const row = el.closest(".statsPctRow") || el.parentElement;
                if (row && row.style) row.style.setProperty("--pct", String(target));
              }
            } catch(_){}
          }
        };

        window.requestAnimationFrame(tick);
      });
    } catch(_){}
  } catch(_){}
}

  
  function renderOverallStatsOnce(){
    try{
      const overallEl =
        (panelRoot ? panelRoot.querySelector("#bands-overall") : null) ||
        document.getElementById("bands-overall");
      if (!overallEl) return;

      const list = getAllBandsOverall();
      let good = 0, partial = 0, none = 0;

      (list || []).forEach((b) => {
        const cls = setsStateClass(b);
        if (cls === "setsGood") good++;
        else if (cls === "setsPartial") partial++;
        else none++;
      });

      const total = (list || []).length;

      const pct = (n) => {
        if (!total) return "0.0%";
        const p = (n * 100) / total;
        return `${p.toFixed(1)}%`;
      };

      overallEl.innerHTML = `
  <button class="reimagingStatsHdr" type="button" aria-expanded="false" aria-controls="reimagingStatsBody">"Reimaging Project" Stats:<span class="chev">▾</span></button>

  <div class="reimagingStatsBody" id="reimagingStatsBody">

  <div class="overallStatsGrid">
    <div class="statsCol">
      <div class="statsRow" style="text-align:center">${total}   Total Bands</div>
	  <div class="statsRow good" style="text-align:center">${good}   Fully Upgraded</div>
	  <div class="statsRow partial" style="text-align:center">${partial}   In Progress</div>
	  <div class="statsRow none" style="text-align:center">${none}   Not Worked Yet</div>
	</div>
	<div class="statsCol">
		  <div class="statsRow" style="text-align:center"><strong id="fixmeta-total-files">${Number(FIXMETA_STATIC.totalFilesNum||0).toLocaleString()}</strong>  *  Total Shots</div>
		  <div class="statsRow" style="text-align:center"><strong id="fixmeta-not-upgraded">${Number(FIXMETA_STATIC.notUpgradedNum||0).toLocaleString()}</strong>  *  Not Upgraded</div>
		  <div class="statsRow" style="text-align:center"><strong id="fixmeta-on-site">${Number(FIXMETA_STATIC.onSiteNum||0).toLocaleString()}</strong>  *  On Site</div>
		  <div class="statsRow statsPctRow" style="text-align:center"><span class="pctWrap"><span class="pctRing" aria-hidden="true"><svg viewBox="0 0 40 40" focusable="false" aria-hidden="true"><circle class="pctBg" cx="20" cy="20" r="14"></circle><circle class="pctFg" cx="20" cy="20" r="14"></circle></svg></span><span class="pctVal"><strong id="fixmeta-percent">${(typeof FIXMETA_STATIC.pctOnSiteNum === "number" ? FIXMETA_STATIC.pctOnSiteNum.toFixed(2) : "0.00")}</strong>%</span></span><span class="pctLabel"></span></div>
	</div>
   </div>

<div class="overallStatsBar" aria-hidden="true">
  <div class="seg good" data-pct="${(total ? (good*100/total) : 0)}"></div>
  <div class="seg partial" data-pct="${(total ? (partial*100/total) : 0)}"></div>
  <div class="seg none" data-pct="${(total ? (none*100/total) : 0)}"></div>
</div>

</div>
`;
// Collapsible: header always visible; body expands on click.
      try{
        overallEl.classList.remove("is-open");
        const hdr = overallEl.querySelector(".reimagingStatsHdr");
        const body = overallEl.querySelector(".reimagingStatsBody");
        if (hdr && body){
          // start collapsed
          hdr.setAttribute("aria-expanded", "false");
          body.style.maxHeight = "0px";

          const open = () => {
            overallEl.classList.add("is-open");
            hdr.setAttribute("aria-expanded", "true");

            // measure + expand
            const h = body.scrollHeight || 0;
            body.style.maxHeight = h ? (h + "px") : "1200px";

            // replay the reveal animation each time you expand
            try{
              if (overallEl.dataset) overallEl.dataset.reimagingAnimRan = "0";
            } catch(_){}
            animateReimagingStats(overallEl);
          };

          const close = () => {
            overallEl.classList.remove("is-open");
            hdr.setAttribute("aria-expanded", "false");
            body.style.maxHeight = "0px";
          };

          hdr.addEventListener("click", () => {
            const isOpen = overallEl.classList.contains("is-open");
            if (isOpen) close();
            else open();
          });

          // If layout changes (e.g., responsive), keep max-height in sync while open
          window.requestAnimationFrame(() => {
            try{
              if (overallEl.classList.contains("is-open")){
                const hh = body.scrollHeight || 0;
                if (hh) body.style.maxHeight = hh + "px";
              }
            } catch(_){}
          });
        }
      } catch(_){}

    } catch(_){}
  }

  function updateLegendStats(region, letter){
    try{
      const totalEl =
        (panelRoot ? panelRoot.querySelector("#bands-total") : null) ||
        document.getElementById("bands-total");

      const list = getBandsInScope(region, letter);
      const total = (list || []).length;

      let good = 0, partial = 0, none = 0;
      (list || []).forEach((b) => {
        const cls = setsStateClass(b);
        if (cls === "setsGood") good++;
        else if (cls === "setsPartial") partial++;
        else none++;
      });

      const pct = (n) => {
        if (!total) return "0.0%";
        const p = (n * 100) / total;
        return `${p.toFixed(1)}%`;
      };
} catch(_){}
  }

  function showLetter(regionKey, letter){
    if (!resultsEl) return;

    CURRENT_REGION = regionKey || CURRENT_REGION;
    CURRENT_LETTER = letter || null;

    try { updateLegendStats(CURRENT_REGION, CURRENT_LETTER); } catch(_) {}

    // Transition out
    try { resultsEl.classList.add("is-swapping"); } catch(_) {}

    const doRender = () => {
      try { resultsEl.innerHTML = ""; } catch(_) {}

      const list = (BANDS && BANDS[CURRENT_REGION] && BANDS[CURRENT_REGION][letter]) ? BANDS[CURRENT_REGION][letter] : [];
      const bands = Array.isArray(list) ? list.slice() : [];
      bands.sort((a,b)=> String(a?.name||"").localeCompare(String(b?.name||""), undefined, { sensitivity:"base" }));

      bands.forEach((bandObj) => {
        const card = document.createElement("div");
        const stateCls = setsStateClass(bandObj);
        card.className = `band-card ${stateCls}`;

        const row = document.createElement("div");
        row.className = "band-row";

        const img = document.createElement("img");
        img.className = "band-logo";
        img.loading = "lazy";
        img.alt = bandObj?.name || "Band";
        img.src = bandObj?.logo_url || "";
        applyLogoFallback(img, bandObj?.name || "");

        const right = document.createElement("div");

        const nm = document.createElement("div");
        nm.className = "band-name";
        nm.textContent = bandObj?.name || "";

        // Only show the (archived/total) count when the card is "In Progress" (yellow / partial).
        if (stateCls === "setsPartial") {
          const cnt = document.createElement("span");
          cnt.className = "band-count";
          const t = Number(bandObj?.total_sets) || 0;
          const a = Number(bandObj?.sets_archive) || 0;
          cnt.textContent = `(${a}/${t})`;
          // name line (band name + count)
          nm.appendChild(cnt);
        }

        right.appendChild(nm);

        row.appendChild(img);
        row.appendChild(right);
        card.appendChild(row);

        card.addEventListener("click", () => {
          // Analytics: band click
          safetrack('band_click', {
            band: String(bandObj?.name || ''),
            category: String(CURRENT_REGION || ''),
            year: '',
          });
          animateBandOpen(CURRENT_REGION, letter, bandObj, img);
        });

        resultsEl.appendChild(card);
      });

      resetPanelScroll();
      ensurePanelScrollable();

      // Transition in
      window.requestAnimationFrame(() => {
        try { resultsEl.classList.remove("is-swapping"); } catch(_) {}
      });
    };

    // Small delay so the "swap" class takes effect before we replace DOM
    window.setTimeout(doRender, 120);
  }

async function showBandCard(region, letter, bandObj, opts) {
    opts = opts || {};

    // Keep a safe return context for Back buttons / modal jumps
    try { LAST_BAND_CTX = { region, letter, band: bandObj }; } catch(_) {}

    if (!resultsEl) return;
    try { document.body.classList.remove("inAlbumPhotos"); } catch(_) {}
    try { document.body.classList.add("inBandDetail"); } catch(_) {}

    resultsEl.innerHTML = "";
    // crumbs removed
    resetPanelScroll();
    ensurePanelScrollable();

    const wrap = document.createElement("div");
    wrap.className = "bandDetailWrap";
    if (opts && opts.deferContent) wrap.classList.add("loading-content");

    // Top bar (back button centered like your reference UI)
    const topbar = document.createElement("div");
    topbar.className = "bandDetailTopbar";

    const backBtn = document.createElement("button");
    backBtn.className = "btn backToBandsBtn";
    const letterLabel = (letter || "").trim();
    backBtn.textContent = `← Back to ${letterLabel ? (letterLabel + " ") : ""}Bands`;
    backBtn.classList.add("backToBandsBtn");
    backBtn.addEventListener("click", () => {
      try { document.body.classList.remove("inBandDetail"); } catch(_) {}
      // return to letter view (with reverse shared-element transition)
      CURRENT_REGION = region;
      initRegionPills();
      updateLetterGroups(region);

      // highlight correct letter pill
      if (letterGroupsEl) {
        const pills = Array.from(letterGroupsEl.querySelectorAll(".letter-pill"));
        pills.forEach((p) => p.classList.toggle("active", p.textContent.trim() === letter));
      }

      // Hide info immediately, keep logo for the reverse transition
      try { wrap.classList.add("closing"); } catch (_) {}

      // Reverse logo-zoom back into the band card
      window.requestAnimationFrame(() => animateBandClose(region, letter, bandObj));
    });

    topbar.appendChild(backBtn);
    wrap.appendChild(topbar);

    // Header block (logo left + info right)
    const header = document.createElement("div");
    header.className = "bandDetailHeader";

    const logo = document.createElement("img");
    logo.className = "bandDetailLogo";
    logo.alt = bandObj?.name || "Band";
    logo.loading = "lazy";
    logo.src = bandObj?.logo_url || "";
    applyLogoFallback(logo, bandObj?.name || "");

    const card = document.createElement("div");
    card.className = "bandDetailCard";

    const namePill = document.createElement("div");
    namePill.className = "bandDetailNamePill";
    namePill.innerHTML = `
      <div class="kicker">BAND:</div>
      <div class="name">${(bandObj?.name || "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
    `;

    const locParts = [bandObj?.location, bandObj?.state, bandObj?.country].filter(Boolean);
    const loc = locParts.join(", ") || "—";

    const status = String(bandObj?.status || "").trim() || "Unknown";
    const total = Number(bandObj?.total_sets) || 0;
    const archived = Number(bandObj?.sets_archive) || 0;

    const infoRow = document.createElement("div");
    infoRow.className = "bandInfoRow";
    infoRow.innerHTML = `
      <div class="bandInfoPill">
        <div class="lbl">HOME LOCATION/REGION</div>
        <div class="val">${loc}</div>
      </div>
      <div class="bandInfoPill">
        <div class="lbl">STATUS</div>
        <div class="val">${status}</div>
      </div>
      <div class="bandInfoPill">
        <div class="lbl">SETS (ARCHIVE / TOTAL)</div>
        <div class="val">${archived} / ${total}</div>
      </div>
    `;

    // Members (render one-per-line, like: "Nick Owen (vox, bass)")
    const esc = (v) => String(v || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const joinLines = (arr) => {
      const lines = (Array.isArray(arr) ? arr : []).map((s) => String(s || "").trim()).filter(Boolean);
      if (!lines.length) return "—";
      return lines.map((s) => esc(s)).join("<br>");
    };

    // Group duplicate names in CORE MEMBERS:
    //  - Input lines may look like "Nick Owen (vox)" and "Nick Owen (bass)"
    //  - Output becomes "Nick Owen (vox, bass)"
    function groupCoreMembers(lines) {
      const raw = (Array.isArray(lines) ? lines : [])
        .map((s) => String(s || "").trim())
        .filter(Boolean);

      if (!raw.length) return [];

      const order = [];
      const map = new Map(); // key -> { name, roles:Set }

      raw.forEach((line) => {
        let name = line;
        let roles = [];

        const m = line.match(/^(.+?)\s*\((.+)\)\s*$/);
        if (m) {
          name = (m[1] || "").trim();
          roles = String(m[2] || "")
            .split(",")
            .map((r) => r.trim())
            .filter(Boolean);
        } else {
          name = String(line || "").trim();
        }

        const key = name.toLowerCase();
        if (!map.has(key)) {
          map.set(key, { name, roles: new Set() });
          order.push(key);
        }
        const entry = map.get(key);
        roles.forEach((r) => entry.roles.add(r));
      });

      return order.map((key) => {
        const entry = map.get(key);
        const roles = Array.from(entry.roles || []);
        return roles.length ? `${entry.name} (${roles.join(", ")})` : entry.name;
      });
    }

    const joinCoreLines = (arr) => {
      const grouped = groupCoreMembers(arr);
      return joinLines(grouped.length ? grouped : arr);
    };

    
    // Build member lines from role-specific columns.
    // If the sheet stores only the name (no "(role)" suffix), we add it here.
    // If the value already includes parentheses, we keep it as-is.
    const withRole = (val, role) => {
      const s = String(val || "").trim();
      if (!s) return "";
      return /\([^)]*\)/.test(s) ? s : `${s} (${role})`;
    };

    const coreLinesFromRoles = [
      withRole(bandObj?.vox_1, "vox"),
      withRole(bandObj?.vox_2, "vox"),
      withRole(bandObj?.vox_3, "vox"),
      withRole(bandObj?.guitar_1, "gtr"),
      withRole(bandObj?.guitar_2, "gtr"),
      withRole(bandObj?.guitar_3, "gtr"),
      withRole(bandObj?.bass, "bass"),
      withRole(bandObj?.drum, "drums"),
      withRole(bandObj?.keys, "keys"),
    ].filter(Boolean);

    const otherLinesFromPast = [
      bandObj?.past_1, bandObj?.past_2, bandObj?.past_3,
      bandObj?.past_4, bandObj?.past_5, bandObj?.past_6
    ].map((v) => String(v || "").trim()).filter(Boolean);

const members = document.createElement("div");
    members.className = "bandInfoGrid2";
    members.innerHTML = `
      <div class="bandInfoBox">
        <div class="lbl">CORE MEMBERS</div>
        <div class="val">${joinCoreLines(coreLinesFromRoles)}</div>
      </div>
      <div class="bandInfoBox">
        <div class="lbl">OTHER MEMBERS</div>
        <div class="val">${joinLines(otherLinesFromPast)}</div>
      </div>
    `;

    card.appendChild(namePill);
    card.appendChild(infoRow);
    card.appendChild(members);

    header.appendChild(logo);
    header.appendChild(card);
    wrap.appendChild(header);

    // Albums title + grid
    const albumsTitle = document.createElement("div");
    albumsTitle.className = "bandAlbumsTitle";
    albumsTitle.textContent = "Current Albums in Archive:";
    wrap.appendChild(albumsTitle);

    const albumsGrid = document.createElement("div");
    albumsGrid.className = "bandAlbumsGrid";
    wrap.appendChild(albumsGrid);

    resultsEl.appendChild(wrap);

    async function __loadBandAlbums() {
      const folderPath = cleanFolderPath(bandObj?.smug_folder || "");
      if (!folderPath) {
        const msg = document.createElement("div");
        msg.style.opacity = "0.85";
        msg.textContent = "No SmugMug folder set for this band in the Bands sheet.";
        albumsGrid.appendChild(msg);
        return;
      }

      // Fast first reveal: show UI immediately, then load albums async.
      const loading = document.createElement("div");
      loading.style.opacity = "0.85";
      loading.style.textAlign = "center";
      loading.style.padding = "10px 0";
      loading.textContent = "Loading albums…";
      albumsGrid.appendChild(loading);

      let albums = [];
      try {
        albums = await fetchFolderAlbumsCached(folderPath, region);
      } catch (e) {
        loading.textContent = "Could not load albums for this band.";
        return;
      }

      // Clear loading indicator
      if (loading && loading.parentNode) loading.parentNode.removeChild(loading);

      if (!albums.length) {
        const msg = document.createElement("div");
        msg.style.opacity = "0.85";
        msg.style.textAlign = "center";
        msg.style.padding = "10px 0";
        msg.textContent = "No albums found in that band folder.";
        albumsGrid.appendChild(msg);
        return;
      }

      // Show albums (row cards)
      albums.forEach((alb, i) => {
        const card = document.createElement("div");
        card.className = "albumRowCard";
        // Start hidden; we'll stagger-reveal for a smoother transition.
        card.classList.add("staggerHidden");

        const thumb = document.createElement("img");
        thumb.className = "albumRowThumb";
        thumb.loading = "lazy";
        thumb.alt = alb?.Name || alb?.Title || "Show";
        thumb.src =
          alb?.HighlightImage?.SmallUrl ||
          alb?.HighlightImage?.MediumUrl ||
          alb?.HighlightImage?.ThumbnailUrl ||
          alb?.SmallUrl ||
          alb?.MediumUrl ||
          alb?.ThumbnailUrl ||
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='260'%3E%3Crect width='100%25' height='100%25' fill='rgba(255,255,255,0.06)'/%3E%3C/svg%3E";

        const meta = document.createElement("div");
        meta.className = "albumRowMeta";

        const bits = parseAlbumNameToShowBits(alb?.Name || alb?.Title || "");
        const showNameLine = bits.show_name || (alb?.Name || alb?.Title || "Show");
        const showDateLine = bits.show_date || "";

        const t1 = document.createElement("div");
        t1.className = "albumRowTitle";
        t1.textContent = showNameLine;

        const t2 = document.createElement("div");
        t2.className = "albumRowSub";
        t2.textContent = showDateLine;

        const t3 = document.createElement("div");
        t3.className = "albumRowSub";
        t3.textContent = ""; // filled async

        meta.appendChild(t1);
        if (t2.textContent) meta.appendChild(t2);

        (async () => {
          try {
            const showsByDate = await ensureShowsIndex();
            const candidates = bits.mmddyy ? (showsByDate.get(bits.mmddyy) || []) : [];
            const want = normStr(showNameLine);

            let best = null;
            for (const r of candidates) {
              const nm = normStr(r.show_name);
              if (!nm) continue;
              if (want.includes(nm) || nm.includes(want)) { best = r; break; }
            }
            if (!best && candidates.length) best = candidates[0];

            const poster = String(best?.show_url || "").trim();
            if (poster && /^https?:\/\//i.test(poster)) {
              thumb.src = poster;
            }

            const fromCsv = best ? buildVenueLine(best) : "";
            const fromDesc = String(alb?.Description || "").trim();

            const line = fromCsv || fromDesc || "";
            if (line) {
              t3.textContent = line;
              meta.appendChild(t3);
            }
          } catch (_) {
            const fromDesc = String(alb?.Description || "").trim();
            if (fromDesc) {
              t3.textContent = fromDesc;
              meta.appendChild(t3);
            }
          }
        })();

        card.appendChild(thumb);
        card.appendChild(meta);

        // Stagger reveal (pairs with .albumRowCard.staggerHidden CSS)
        window.setTimeout(() => {
          try { card.classList.remove("staggerHidden"); } catch(_) {}
        }, Math.min(650, (Number(i) || 0) * 45));

        card.addEventListener("click", async () => {
          // Analytics: album open
          safetrack('album_open', {
            band: String(bandObj?.name || ''),
            show: String(alb?.Name || alb?.Title || alb?.NiceName || ''),
            album: String(alb?.AlbumKey || alb?.Key || alb?.Uri || alb?.Name || alb?.Title || ''),
            year: '',
            category: String(region || ''),
          });
          // Hi-tech HUD transition into the album photos view
          try { card.classList.add("is-opening-album"); } catch(_) {}
          // Option 1: Keep the HUD wipe contained to the content panel (not full-screen)
          const hudHost = panelRoot || document.getElementById("musicContentPanel") || resultsEl || document.body;
          const wipeP = runHudWipe(hudHost, { hold: false });

          // small lead-in so the user feels the click before we swap views
          await new Promise((r) => window.setTimeout(r, 120));

          await showAlbumPhotos({
            region,
            letter,
            band: bandObj,
            album: alb,
            folderPath,
            allAlbums: albums,
          });

          // let the sweep finish (best-effort)
          await wipeP.catch(() => {});
        });

        albumsGrid.appendChild(card);
      });
      window.requestAnimationFrame(() => resetPanelScroll());
      window.setTimeout(() => resetPanelScroll(), 200);
    }

    // Defer heavy loading until the logo zoom finishes (prevents "blink")
    if (opts && opts.deferContent) {
      // expose a one-shot release hook for the animator
      wrap._releaseContent = () => {
        try { wrap.classList.remove("loading-content"); } catch(_) {}
        try { __loadBandAlbums(); } catch(_) {}
      };
    } else {
      __loadBandAlbums();
    }

  }
  async function showAlbumPhotos(info) {
    resultsEl.innerHTML = "";
    try { document.body.classList.remove("inBandDetail"); } catch(_) {}
    try { document.body.classList.add("inAlbumPhotos"); } catch(_) {}
    // crumbs removed
    resetPanelScroll();
    ensurePanelScrollable();

    const wrap = document.createElement("div");
    wrap.className = "photosWrap entering";
    wrap.style.width = "100%";

    const top = document.createElement("div");
    top.className = "photosTop";

    const backBtn = document.createElement("button");
    backBtn.className = "btn backToAlbumsBtn";
    backBtn.textContent = "← Back to albums";
    backBtn.addEventListener("click", async () => {
      const _wipeHoldMs = 340;
      let hudCtl = null;
      let prevView = null;
      let lockedMinHeight = "";
      try {
        const host = panelRoot || document.getElementById("musicContentPanel") || document.body;
        hudCtl = runHudWipe(host, { hold: true, minHoldMs: _wipeHoldMs, direction: "rtl" });

        // Keep current Photos view available to overlay while the destination view mounts.
        prevView = wrap;
        if (resultsEl) {
          try {
            const rs = window.getComputedStyle(resultsEl);
            if (rs.position === "static") resultsEl.style.position = "relative";
          } catch(_) {}
          lockedMinHeight = resultsEl.style.minHeight || "";
          resultsEl.style.minHeight = `${resultsEl.getBoundingClientRect().height || 0}px`;
        }
        // Detach before showBandCard() clears resultsEl
        if (prevView && prevView.parentNode === resultsEl) resultsEl.removeChild(prevView);
      } catch (_) {}

      try { document.body.classList.remove("inAlbumPhotos"); } catch(_) {}
      try { document.body.classList.remove("inSelectMode"); } catch(_) {}

      // Prefer explicit return context (modal jumps), otherwise fall back to last known band context
      const ret = (info && info._returnCtx) || LAST_BAND_CTX || { region: info.region, letter: info.letter, band: info.band };
      const r = (ret && ret.region) || info.region || (LAST_BAND_CTX && LAST_BAND_CTX.region) || "";
      const l = (ret && ret.letter) || info.letter || (LAST_BAND_CTX && LAST_BAND_CTX.letter) || "";
      const b = (ret && ret.band) || info.band || (LAST_BAND_CTX && LAST_BAND_CTX.band) || null;

      showBandCard(r, l, b);

      // Fade out the previous Photos view on top while the wipe completes (prevents "blank flash")
      if (prevView && resultsEl) {
        try {
          prevView.style.position = "absolute";
          prevView.style.inset = "0";
          prevView.style.width = "100%";
          prevView.style.pointerEvents = "none";
          prevView.style.zIndex = "5";
          prevView.style.opacity = "0.92";
          prevView.style.filter = "blur(1.5px)";
          prevView.style.transition = "opacity 160ms ease, filter 160ms ease";
          resultsEl.appendChild(prevView);

          window.requestAnimationFrame(() => {
            try {
              prevView.style.opacity = "0";
              prevView.style.filter = "blur(8px)";
            } catch(_) {}
          });

          window.setTimeout(() => {
            try { if (prevView && prevView.parentNode) prevView.parentNode.removeChild(prevView); } catch(_) {}
          }, 220);
        } catch (_) {}
      }

      // Remove wipe after minimum hold, then release height lock
      if (hudCtl) {
        try {
          const startedAt = Number(hudCtl._startedAt) || Date.now();
          const elapsed = Date.now() - startedAt;
          const wait = Math.max(0, _wipeHoldMs - elapsed);
          window.setTimeout(() => {
            try { if (hudCtl && typeof hudCtl.remove === "function") hudCtl.remove(); } catch(_) {}
            try { if (resultsEl) resultsEl.style.minHeight = lockedMinHeight; } catch(_) {}
          }, wait);
        } catch (_) {}
      } else {
        try { if (resultsEl) resultsEl.style.minHeight = lockedMinHeight; } catch(_) {}
      }
    });

    const title = document.createElement("div");
    title.style.fontSize = "13px";
    title.style.fontWeight = "800";
    title.style.opacity = "0.95";
    title.textContent = info.album?.Name || "Album";

    top.appendChild(backBtn);
const grid = document.createElement("div");
    grid.className = "photosGrid";

    wrap.appendChild(top);

    // ===== Album keywords (from SmugMug album metadata) =====
    const keywordBox = document.createElement("div");
    keywordBox.className = "albumKeywordBox";
    const kwTitle = document.createElement("div");
    kwTitle.className = "albumKeywordTitle";
    kwTitle.textContent = (info.album?.Name || info.album?.Title || "").trim() || "Album";
    const kwLabel = document.createElement("div");
    kwLabel.className = "albumKeywordLabel";
    kwLabel.textContent = "People in this album:";
    const kwChips = document.createElement("div");
    kwChips.className = "albumKeywordChips";

    keywordBox.appendChild(kwTitle);
    keywordBox.appendChild(kwLabel);
    keywordBox.appendChild(kwChips);
    wrap.appendChild(keywordBox);

    // ===== Multi-select toolbar (Select mode + Download ZIP) =====
    // UI is currently hidden (feature-flagged), but code remains for later.
    let selectMode = false;
    const selected = new Set(); // stores indices as strings

    const toolbar = document.createElement("div");
    toolbar.className = "selectToolbar";

    const buyBtn = document.createElement("a");
    buyBtn.className = "selectBtn";
    buyBtn.textContent = "Buy Photos";
    // Default to the album URL; then try to resolve the SmugMug Shop NodeKey
    // (SmugMug shop links use /shop?nodeKey=..., not always the AlbumKey).
    (function initBuyPhotosLink() {
      const alb = info && info.album ? info.album : null;

      // Try to detect a NodeKey/NodeID directly from the album payload (fast path).
      const directNodeKey =
        (alb && (alb.NodeKey || alb.nodeKey || alb.NodeID || alb.nodeID || alb.NodeId || alb.nodeId)) ? String(alb.NodeKey || alb.nodeKey || alb.NodeID || alb.nodeID || alb.NodeId || alb.nodeId).trim() : "";

      // Album identifiers we always have.
      const albumKey = alb && (alb.AlbumKey || alb.Key || alb.albumKey || alb.key) ? String(alb.AlbumKey || alb.Key || alb.albumKey || alb.key).trim() : "";

      // Web/URL fields vary by endpoint; be defensive.
      const rawWeb =
        alb && (alb.WebUri || alb.WebURL || alb.WebUrl || alb.webUri || alb.weburl || alb.webUrl || alb.Url || alb.url) ?
        (alb.WebUri || alb.WebURL || alb.WebUrl || alb.webUri || alb.weburl || alb.webUrl || alb.Url || alb.url) : "";

      const rawPath =
        alb && (alb.UrlPath || alb.URLPath || alb.urlPath || alb.urlpath || alb.Uri || alb.URI || alb.uri) ?
        (alb.UrlPath || alb.URLPath || alb.urlPath || alb.urlpath || alb.Uri || alb.URI || alb.uri) : "";

      // Prefer the current origin when already on SmugMug, otherwise default to your SmugMug domain.
      let smugOrigin = "https://vmpix.smugmug.com";
      try {
        const o = (window.location && window.location.origin) ? String(window.location.origin) : "";
        if (o && /smugmug\.com$/i.test(o)) smugOrigin = o;
      } catch (_) {}

      // If we have a direct NodeKey/NodeID, go straight to the shop URL.
      if (directNodeKey) {
        buyBtn.href = smugOrigin.replace(/\/$/, "") + "/shop?nodeKey=" + encodeURIComponent(directNodeKey);
        buyBtn.rel = "noopener";
        buyBtn.target = "_blank";
        return;
      }

      let albumUrl = "";
      try {
        if (typeof rawWeb === "string" && /^https?:\/\//i.test(String(rawWeb).trim())) {
          albumUrl = String(rawWeb).trim();
          try { smugOrigin = new URL(albumUrl).origin; } catch (_) {}
        } else if (typeof rawPath === "string" && String(rawPath).trim()) {
          const p0 = String(rawPath).trim();
          const p = p0.startsWith("/") ? p0 : ("/" + p0);
          albumUrl = smugOrigin.replace(/\/$/, "") + p;
        }
      } catch (_) {}

      // Safe fallback: at least go to the album page if we can.
      buyBtn.href = albumUrl || "#";
      buyBtn.rel = "noopener";
      buyBtn.target = "_blank";

      // Best case: resolve to /shop?nodeKey=... using the backend.
      // Some backend versions accept url, others accept albumKey; send both.
      if (!albumUrl && !albumKey) return;
      (async () => {
        try {
          const qs = [];
          if (albumUrl) qs.push("url=" + encodeURIComponent(albumUrl));
          if (albumKey) qs.push("albumKey=" + encodeURIComponent(albumKey));
          const json = await fetchJsonSafe(API_BASE + "/smug/resolve-shop-node?" + qs.join("&"), { retries: 1 }).catch(() => null);
          if (!json) return;
          const nodeKey = (json && typeof json.nodeKey === "string") ? json.nodeKey.trim() : (json && typeof json.NodeKey === "string" ? json.NodeKey.trim() : "");
          if (!nodeKey) return;
          buyBtn.href = smugOrigin.replace(/\/$/, "") + "/shop?nodeKey=" + encodeURIComponent(nodeKey);
        } catch (_) {}
      })();
    })();;
    buyBtn.target = "_blank";
    toolbar.appendChild(buyBtn);

    // Only mount the ZIP/select UI when explicitly enabled.
    let selectToggle = null;
    let dlZipBtn = null;
    let clearBtn = null;
    let hint = null;
    let statusLine = null;
    // Safe default when the feature is disabled (or before it's initialized).
    let updateSelectUI = () => {};

    if (ENABLE_ZIP_SELECT_UI) {
      selectToggle = document.createElement("button");
      selectToggle.className = "selectBtn";
      selectToggle.type = "button";
      selectToggle.textContent = "Select Photos to Download";

      dlZipBtn = document.createElement("button");
      dlZipBtn.className = "selectBtn primary";
      dlZipBtn.type = "button";
      dlZipBtn.textContent = "Download ZIP (0)";
      dlZipBtn.style.display = "none";

      clearBtn = document.createElement("button");
      clearBtn.className = "selectBtn";
      clearBtn.type = "button";
      clearBtn.textContent = "Clear";
      clearBtn.style.display = "none";

      hint = document.createElement("div");
      hint.className = "selectHint";
      hint.textContent = "Tip: In Select mode, click thumbnails to add/remove.";

      statusLine = document.createElement("div");
      statusLine.className = "zipStatus";
      statusLine.textContent = "";

      updateSelectUI = function updateSelectUI(){
        const n = selected.size;
        dlZipBtn.textContent = `Download ZIP (${n})`;
        dlZipBtn.style.display = selectMode ? "inline-flex" : "none";
        clearBtn.style.display = (selectMode && n) ? "inline-flex" : "none";
        hint.style.display = selectMode ? "block" : "none";

        try {
          if (selectMode) document.body.classList.add("inSelectMode");
          else document.body.classList.remove("inSelectMode");
        } catch(_) {}
      };

      selectToggle.addEventListener("click", () => {
        selectMode = !selectMode;
        if (!selectMode) selected.clear();
        statusLine.textContent = "";
        selectToggle.textContent = selectMode ? "Done selecting" : "Select Photos to Download";
        updateSelectUI();
        try {
          const tiles = grid.querySelectorAll(".smug-photo-box");
          tiles.forEach((t) => {
            const k = t.dataset.index || "";
            t.classList.toggle("selected", selectMode && selected.has(k));
          });
        } catch(_) {}
      });

      clearBtn.addEventListener("click", () => {
        selected.clear();
        statusLine.textContent = "";
        updateSelectUI();
        try {
          const tiles = grid.querySelectorAll(".smug-photo-box.selected");
          tiles.forEach((t) => t.classList.remove("selected"));
        } catch(_) {}
      });

      dlZipBtn.addEventListener("click", async () => {
        const n = selected.size;
        if (!n) return;

        const items = [];
        const idxs = Array.from(selected).map((s) => Number(s)).filter((x) => Number.isFinite(x)).sort((a,b)=>a-b);
        idxs.forEach((i) => {
          const it = imgs[i];
          if (!it) return;
          const url = bestFullUrl(it);
          if (!url) return;
          const filename = String(it?.FileName || `photo-${i+1}.jpg`).trim() || `photo-${i+1}.jpg`;
          items.push({ url, filename });
        });

        if (!items.length) {
          statusLine.textContent = "No downloadable URLs found for the selected photos.";
          return;
        }

        dlZipBtn.disabled = true;
        clearBtn.disabled = true;
        selectToggle.disabled = true;
        statusLine.textContent = `Preparing ZIP for ${items.length} photo(s)…`;

        try {
          const albumName = (info?.album?.Name || info?.album?.Title || "album").trim();
          await downloadZipFromServer(items, albumName);
          statusLine.textContent = `ZIP download started (${items.length} photo(s)).`;
        } catch (e) {
          console.warn(e);
          statusLine.textContent = "ZIP download failed. (This requires a server /zip endpoint.)";
        } finally {
          dlZipBtn.disabled = false;
          clearBtn.disabled = false;
          selectToggle.disabled = false;
        }
      });

      toolbar.appendChild(selectToggle);
      toolbar.appendChild(dlZipBtn);
      toolbar.appendChild(clearBtn);
      toolbar.appendChild(hint);
      wrap.appendChild(toolbar);
      wrap.appendChild(statusLine);
    } else {
      // Still show the toolbar container (currently only the Buy button).
      wrap.appendChild(toolbar);
    }

    const albumKey = info.album?.AlbumKey || info.album?.Key || info.albumKey || "";

    function prettyKeyword(s) {
      const t = String(s || "").trim();
      if (!t) return "";
      return t
        .split(/\s+/)
        .map((p) => p ? (p.charAt(0).toUpperCase() + p.slice(1)) : "")
        .join(" ");
    }

    async function renderAlbumKeywords() {
      kwChips.innerHTML = "";
      const kws = await fetchAlbumKeywords(albumKey || info.albumKey || info.album?.AlbumKey || info.album?.Key || "");
      const list = (kws || []).filter(Boolean);

      if (!list.length) {
        const none = document.createElement("div");
        none.className = "albumKeywordEmpty";
        none.textContent = "No keywords found on this album.";
        kwChips.appendChild(none);
        return;
      }

      list.forEach((kw) => {
        const chip = document.createElement("span");
        chip.className = "albumKeywordChip";
        chip.textContent = prettyKeyword(kw);
        chip.style.cursor = "pointer";
        chip.title = "Click to see other albums containing this keyword";
        chip.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          openAlsoAppearsModal(kw, {
            region: info.region,
            letter: info.letter,
            band: info.band,
            folderPath: info.folderPath,
            currentAlbumKey: albumKey,
          });
        });
        kwChips.appendChild(chip);
      });
    }
    wrap.appendChild(grid);
    resultsEl.appendChild(wrap);

    // allow the view to "land" after the HUD sweep
    window.requestAnimationFrame(() => {
      try { wrap.classList.remove("entering"); } catch(_) {}
    });

    // albumKey declared above (needed for keyword chips + modal context)
    if (!albumKey) {
      const msg = document.createElement("div");
      msg.style.opacity = "0.85";
      msg.textContent = "Album key missing; can’t load photos.";
      grid.appendChild(msg);
      return;
    }

    // Populate the album keyword chips now that we have albumKey
    renderAlbumKeywords();


// ===== Loading shimmer tiles while photos are fetched =====
// Keep this lightweight and purely visual (no logic changes).
try {
  const SHIMMER_COUNT = 12;
  for (let i = 0; i < SHIMMER_COUNT; i++) {
    const sh = document.createElement("div");
    sh.className = "smug-photo-box shimmer";
    const inner = document.createElement("div");
    inner.className = "shimmerInner";
    sh.appendChild(inner);
    grid.appendChild(sh);
  }
} catch (_) {}

    let imgs = [];
    try {
      imgs = await fetchAllAlbumImages(albumKey);
    } catch (e) {
      const msg = document.createElement("div");
      msg.style.opacity = "0.85";
      msg.textContent = "Could not load album photos.";
      grid.appendChild(msg);
      return;
    }

    if (!imgs.length) {
      const msg = document.createElement("div");
      msg.style.opacity = "0.85";
      msg.textContent = "No photos found in this album.";
      grid.appendChild(msg);
      return;
    }


// Remove shimmer placeholders now that we have real images
try { grid.innerHTML = ""; } catch (_) {}


    imgs.forEach((img, idx) => {
      const box = document.createElement("div");
      box.className = "smug-photo-box tileHidden";

      // index badge (helps orientation)
      const badge = document.createElement("div");
      badge.className = "photoIndexBadge";
      badge.textContent = `#${idx + 1}`;
      box.appendChild(badge);

      // selection check (visible in Select mode)
      // Kept behind feature flag so we can re-enable later without rewriting.
      if (ENABLE_ZIP_SELECT_UI) {
        const chk = document.createElement("div");
        chk.className = "selectCheck";
        chk.textContent = "✓";
        box.appendChild(chk);
      }

      // hover meta (filename + hint)
      const meta = document.createElement("div");
      meta.className = "photoHoverMeta";
      const fn = document.createElement("div");
      fn.className = "fn";
      fn.textContent = img?.FileName || `Photo ${idx + 1}`;
      const sub = document.createElement("div");
      sub.className = "sub";
      sub.textContent = "Click to view • ←/→ to navigate";
      meta.appendChild(fn);
      meta.appendChild(sub);
      box.appendChild(meta);
      box.dataset.index = String(idx);

      // Stagger reveal (pairs with .smug-photo-box.tileHidden CSS)
      window.setTimeout(() => {
        try { box.classList.remove("tileHidden"); } catch(_) {}
      }, Math.min(720, (Number(idx) || 0) * 18));

      const im = document.createElement("img");
      im.className = "smug-photo";
      im.loading = "lazy";
      im.alt = img?.FileName || `Photo ${idx + 1}`;

      // pick a thumbnail-ish url if present
      im.src =
        img?.ThumbnailUrl ||
        img?.SmallUrl ||
        img?.MediumUrl ||
        img?.LargeUrl ||
        img?.Url ||
        bestFullUrl(img);

      box.appendChild(im);

      box.addEventListener("click", () => {
        // In Select mode, toggle selection instead of opening the lightbox
        if (ENABLE_ZIP_SELECT_UI && selectMode) {
          const key = String(idx);
          if (selected.has(key)) selected.delete(key);
          else selected.add(key);

          box.classList.toggle("selected", selected.has(key));
          updateSelectUI();
          return;
        }

        openLightbox(imgs, idx, info && info._lightboxContext ? info._lightboxContext : { band: (info?.band?.name || ''), album: (info?.album?.Name || info?.album?.Title || ''), show: (info?.album?.Name || info?.album?.Title || '') });
      });
      grid.appendChild(box);
    });
  }

  // ================== MOUNT ==================
  async function onMount(panelEl) {
    panelRoot = panelEl;
    if (!panelRoot) return;

    // Start waking the backend ASAP (Render cold start)
    try { _wakeBackendOnce(); } catch (_) {}

    // Restore scroll behavior for this panel (especially on mobile/webviews)
    ensurePanelScrollable();

    // grab refs inside the panel ONLY
    resultsEl = panelRoot.querySelector("#results");
    letterGroupsEl = panelRoot.querySelector("#letter-groups");
    regionPillsEl = panelRoot.querySelector("#region-pills");
    legendEl = panelRoot.querySelector("#status-legend");

    // load data + init UI
    BANDS = await loadBandsFromCsv();


// If we couldn't load the Bands CSV (common when opening the file via file:// which has origin "null"),
// show a clear message so the UI doesn't look broken.
try {
  const regions = Object.keys(BANDS || {});
  if (!regions.length) {
    if (resultsEl) {
      resultsEl.innerHTML = `
        <div class="band-card setsNone" style="cursor:default; text-align:center;">
          <div style="font-weight:800; font-size:14px; margin-bottom:6px; opacity:.95;">Data didn’t load</div>
          <div style="font-size:12px; opacity:.85; line-height:1.35;">
            This usually happens when the page is opened from <strong>file://</strong> (origin "null") or when CORS blocks requests to the server.
            <br>Open this page from a web host (GitHub Pages/SmugMug/localhost) and refresh.
          </div>
        </div>
      `;
    }
  }
} catch (_) {}

    // Static overall stats line (once)
    renderOverallStatsOnce();

    initRegionPills();
    try { updateLegendStats(CURRENT_REGION, null); } catch(_) {}
    updateLetterGroups(CURRENT_REGION);

    // End initial loading state (show crumbs only after data is ready)
    try {
      const root = panelRoot.querySelector("#bands-root");
      const loader = panelRoot.querySelector("#bands-loading");
      if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
      if (root) root.classList.remove("is-loading");
    } catch (_) {}

    const handledPendingNav = await consumePendingBandNav();
    if (handledPendingNav) {
      resetPanelScroll();
      ensurePanelScrollable();
      if (legendEl) legendEl.style.display = "";
      return;
    }

    // default: clear results
    if (resultsEl) resultsEl.innerHTML = "";
    resetPanelScroll();
    ensurePanelScrollable();
    if (legendEl) legendEl.style.display = "";
  }

  window.MusicArchiveBands = { render, onMount };
})();
