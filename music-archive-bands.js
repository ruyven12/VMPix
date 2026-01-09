// music-archive-bands.js
(function () {
  // logo+name only v3 + video2 band detail style
  // logo+name only v2
  "use strict";

  // ================== CONFIG (matches script.js) ==================
  const API_BASE = "https://music-archive-3lfa.onrender.com";
  const CSV_ENDPOINT = `${API_BASE}/sheet/bands`;

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

  // panel-scoped DOM refs
  let panelRoot = null;
  let treeEl = null;
  let resultsEl = null;
  let crumbsEl = null;
  let letterGroupsEl = null;
  let regionPillsEl = null;
  let legendEl = null;

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

  // ================== STYLES ==================
  function ensureBandsStyles() {
    if (document.getElementById("musicBandsStyles")) return;
    const s = document.createElement("style");
    s.id = "musicBandsStyles";
    s.textContent = `
      .bandsWrap{
        width:100%;
        max-width:none;
        margin:0;
        padding: clamp(8px, 1.2vw, 16px);
      }

      /* top bar inside panel */
      .bandsTop{
        display:flex;
        flex-direction:column;
        gap:10px;
        margin-bottom:10px;
      }

      /* region pills */
      #region-pills{
        display:flex;
        flex-wrap:wrap;
        justify-content:center;
        gap:8px;
      }
      .region-pill{
        padding:8px 14px;
        border-radius:999px;
        cursor:pointer;
        user-select:none;
        font-size:12px;
        letter-spacing:.04em;
        background:rgba(255,255,255,0.06);
        border:1px solid rgba(255,255,255,0.12);
        color:rgba(226,232,240,0.9);
      }
      .region-pill.active{
        background:rgba(255,255,255,0.14);
        border-color:rgba(255,255,255,0.22);
      }

      /* letter pills */
      #letter-groups{
        display:flex;
        flex-wrap:wrap;
        justify-content:center;
        gap:8px;
      }
      .letter-pill{
        padding:6px 12px;
        border-radius:999px;
        cursor:pointer;
        font-size:12px;
        background:rgba(17,24,39,0.35);
        border:1px solid rgba(148,163,184,0.25);
        color:#fff;
        backdrop-filter: blur(6px);
      }
      .letter-pill.active{
        background:rgba(255,255,255,0.14);
        border-color:rgba(255,255,255,0.22);
      }

      /* legend */
      #status-legend{
        display:flex;
        justify-content:center;
        gap:10px;
        flex-wrap:wrap;
        font-size:12px;
        opacity:.9;
      }
      .legend-dot{
        width:10px;height:10px;border-radius:50%;
        display:inline-block;margin-right:6px;
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
      }
      .band-card{
        background:rgba(255,255,255,0.04);
        border:1px solid rgba(255,255,255,0.10);
        border-radius:16px;
        padding:12px;
        cursor:pointer;
      }
      .band-card:hover{
        background:rgba(255,255,255,0.06);
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
      .smug-photo{
        width:100%;
        aspect-ratio: 1/1;
        object-fit:cover;
        border-radius:10px;
        border:1px solid rgba(255,255,255,0.10);
        background:rgba(255,255,255,0.04);
      }

      /* lightbox */
      .lightbox{
        position:fixed;
        inset:0;
        background:rgba(0,0,0,0.88);
        display:flex;
        align-items:center;
        justify-content:center;
        z-index:999999;
        padding:18px;
      }
      .lightbox img{
        max-width:95vw;
        max-height:86vh;
        border-radius:14px;
        border:1px solid rgba(255,255,255,0.12);
      }
      .lightbox-controls{
        position:fixed;
        bottom:16px;
        left:50%;
        transform:translateX(-50%);
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        justify-content:center;
      }
      .lightbox-caption{
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

      /* ===== Initial load: hide crumbs until data is ready ===== */
      .bandsWrap.is-loading #crumbs{ display:none !important; }
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

`;


    document.head.appendChild(s);
  }

  // ================== HTML RENDER ==================
  function render() {
    ensureBandsStyles();

    // ONLY what's inside #musicContentPanel
    return `
      <div class="bandsWrap is-loading" id="bands-root">
        <div class="bandsTop">
          <div id="region-pills"></div>
          <div id="letter-groups"></div>
          <div id="status-legend">
            <span><span class="legend-dot" style="background:#22c55e"></span>Fully Upgraded</span>
            <span><span class="legend-dot" style="background:#f59e0b"></span>In Progress</span>
            <span><span class="legend-dot" style="background:#94a3b8"></span>Have Not Worked Yet</span>
          </div>
        </div>

        <div class="bandsLayout">
          <div>
            <div class="bandsLoading" id="bands-loading">Loading bands<span class="dot"></span></div>
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

    const text = await fetch(url, { cache: "no-store" }).then((r) => r.text());

    try {
      sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), text }));
    } catch (_) {}

    return text;
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

  function buildVenueLine(row){
    const venue = String(row?.show_venue || row?.venue || "").trim();
    const city  = String(row?.show_city  || row?.city  || "").trim();
    const state = String(row?.show_state || row?.state || "").trim();

    if (venue && city && state) return `${venue} - ${city}, ${state}`;
    if (venue && city) return `${venue} - ${city}`;
    if (city && state) return `${city}, ${state}`;
    if (venue) return venue;
    return "";
  }

  async function ensureShowsIndex(){
    if (_showsByDate) return _showsByDate;
    if (_showsIndexPromise) return _showsIndexPromise;

    _showsIndexPromise = fetch(SHOWS_ENDPOINT, { cache: "no-store" })
      .then((r) => r.text())
      .then((txt) => {
        if (!txt || !txt.trim()) return [];
        const lines = txt.split(/\r?\n/).filter((l) => l.trim());
        const headerLine = lines.shift();
        if (!headerLine) return [];

        const header = parseCsvLine(headerLine).map((h) => h.trim().toLowerCase());

        const idxName = header.indexOf("show_name") !== -1 ? header.indexOf("show_name") : header.indexOf("title");
        const idxDate = header.indexOf("show_date") !== -1 ? header.indexOf("show_date") : header.indexOf("date");
        const idxUrl = header.indexOf("show_url") !== -1 ? header.indexOf("show_url") : header.indexOf("poster_url");
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
  async function fetchFolderAlbums(folderPath, region) {
    const safeFolder = cleanFolderPath(folderPath || "");
    const baseSlug = toSlug(safeFolder || "");
    const url = `${API_BASE}/smug/${encodeURIComponent(
      baseSlug,
    )}?folder=${encodeURIComponent(safeFolder)}&region=${encodeURIComponent(
      region || "",
    )}&count=200&start=1`;

    const res = await fetch(url);
    const data = await res.json();
    const albums =
      (data && data.Response && (data.Response.Album || data.Response.Albums)) ||
      [];
    return Array.isArray(albums) ? albums : [albums];
  }

  async function fetchAllAlbumImages(albumKey) {
    const all = [];
    let start = 1;
    let more = true;

    while (more) {
      const res = await fetch(
        `${API_BASE}/smug/album/${encodeURIComponent(
          albumKey,
        )}?count=200&start=${start}`,
      );
      const data = await res.json();
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

  // ================== LIGHTBOX (ported pattern) ==================
  let lightboxEl = null;
  let lightboxImg = null;
  let lightboxCaption = null;
  let currentViewList = [];
  let lightboxIndex = 0;

  function upgradeSmugToOriginal(url) {
    if (!url) return "";
    let out = url.replace(/\/(S|M|L|XL|X2|X3|Th|T)\//gi, "/O/");
    out = out.replace(/-(S|M|L|XL|X2|X3|Th|T)\./gi, "-O.");
    return out;
  }

  function bestFullUrl(img) {
    const candidates = [
      img.OriginalUrl,
      img.OriginalImageUrl,
      img.OriginalSizeUrl,
      img.ArchivedSizeUrl,
      img.ImageUrl,
      img.X3LargeUrl,
      img.X2LargeUrl,
      img.LargeUrl,
      img.Url,
      img.MediumUrl,
      img.SmallUrl,
      img.ThumbnailUrl,
    ].filter(Boolean);

    if (!candidates.length) return "";
    const first = candidates[0];

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

    lightboxImg = document.createElement("img");
    lightboxCaption = document.createElement("div");
    lightboxCaption.className = "lightbox-caption";

    const controls = document.createElement("div");
    controls.className = "lightbox-controls";

    const prevBtn = document.createElement("button");
    prevBtn.className = "btn";
    prevBtn.textContent = "← Prev";
    prevBtn.onclick = () => showAt(lightboxIndex - 1);

    const nextBtn = document.createElement("button");
    nextBtn.className = "btn";
    nextBtn.textContent = "Next →";
    nextBtn.onclick = () => showAt(lightboxIndex + 1);

    const closeBtn = document.createElement("button");
    closeBtn.className = "btn";
    closeBtn.textContent = "Close ✕";
    closeBtn.onclick = () => destroyLightbox();

    controls.appendChild(prevBtn);
    controls.appendChild(nextBtn);
    controls.appendChild(closeBtn);

    lightboxEl.appendChild(lightboxImg);
    document.body.appendChild(lightboxEl);
    document.body.appendChild(controls);
    document.body.appendChild(lightboxCaption);

    lightboxEl.addEventListener("click", (e) => {
      if (e.target === lightboxEl) destroyLightbox();
    });

    // stash controls + caption so we can remove them together
    lightboxEl._controls = controls;
    lightboxEl._caption = lightboxCaption;
  }

  function destroyLightbox() {
    if (!lightboxEl) return;
    const c = lightboxEl._controls;
    const cap = lightboxEl._caption;

    if (c && c.parentNode) c.parentNode.removeChild(c);
    if (cap && cap.parentNode) cap.parentNode.removeChild(cap);
    if (lightboxEl && lightboxEl.parentNode) lightboxEl.parentNode.removeChild(lightboxEl);

    lightboxEl = null;
    lightboxImg = null;
    lightboxCaption = null;
  }

  function showAt(idx) {
    if (!currentViewList.length || !lightboxImg || !lightboxCaption) return;
    if (idx < 0) idx = currentViewList.length - 1;
    if (idx >= currentViewList.length) idx = 0;
    lightboxIndex = idx;

    const img = currentViewList[idx];
    if (!img) return;
    lightboxImg.src = bestFullUrl(img);
    lightboxCaption.textContent =
      img.FileName || `${idx + 1} / ${currentViewList.length}`;
  }

  function openLightbox(list, idx) {
    currentViewList = Array.isArray(list) ? list : [];
    ensureLightbox();
    showAt(idx);
  }

  // ================== UI BUILDERS ==================
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
        resetPanelScroll();
        updateLetterGroups(key);
        resultsEl.innerHTML = "";
        window.setTimeout(() => resetPanelScroll(), 200);
        // crumbs removed
      });

      regionPillsEl.appendChild(pill);
    });

    // default active
    const def = regionPillsEl.querySelector(`.region-pill[data-region-key="${CURRENT_REGION}"]`);
    if (def) def.classList.add("active");
  }

  function updateLetterGroups(regionKey) {
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
  }

  function buildTree() { /* sidebar removed */ }

  function statusToColor(status) {
    const s = String(status || "").trim().toLowerCase();
    if (!s) return "#94a3b8"; // unknown
    if (s.includes("active")) return "#22c55e";
    if (s.includes("inactive")) return "#f59e0b";
    return "#94a3b8";
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


  function showLetter(region, letter) {
    if (!resultsEl) return;

    resultsEl.innerHTML = "";
    // crumbs removed
    resetPanelScroll();

    const bandsArr = (BANDS[region] && BANDS[region][letter]) || [];

    // card grid layout (matches your script.js behavior pattern)
    resultsEl.style.display = "grid";
    resultsEl.style.justifyContent = "center";
    resultsEl.style.gridTemplateColumns = "repeat(auto-fit, minmax(250px, 1fr))";
    resultsEl.style.gap = "14px";
    resultsEl.style.width = "100%";
        resultsEl.style.maxWidth = "none";
    resultsEl.style.margin = "0";

    if (!bandsArr.length) {
      resultsEl.appendChild(document.createTextNode("No bands in this group."));
      return;
    }

    bandsArr.forEach((bandObj) => {
      const card = document.createElement("div");
      card.className = "band-card";

      // background color state (green/yellow/gray) based on sets_archive vs total_sets
      card.classList.add(setsStateClass(bandObj));

      const row = document.createElement("div");
      row.className = "band-row";

      const img = document.createElement("img");
      img.className = "band-logo";
      img.alt = bandObj.name || "Band";
      img.loading = "lazy";
      img.src =
        bandObj.logo_url ||
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Crect width='100%25' height='100%25' fill='rgba(255,255,255,0.06)'/%3E%3C/svg%3E";

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.flexDirection = "column";
      right.style.gap = "2px";

      const name = document.createElement("div");
      name.className = "band-name";
      name.textContent = bandObj.name || "";right.appendChild(name);
      row.appendChild(img);
      row.appendChild(right);
      card.appendChild(row);

      card.addEventListener("click", () => {
        // Yield to paint for snappier feel
        window.requestAnimationFrame(() => showBandCard(region, letter, bandObj));
      });

    window.requestAnimationFrame(() => resetPanelScroll());
    window.setTimeout(() => resetPanelScroll(), 200);

      resultsEl.appendChild(card);
    });
  }

  async function showBandCard(region, letter, bandObj) {
    if (!resultsEl) return;

    resultsEl.innerHTML = "";
    // crumbs removed
    resetPanelScroll();

    const wrap = document.createElement("div");
    wrap.className = "bandDetailWrap";

    // Top bar (back button centered like your reference UI)
    const topbar = document.createElement("div");
    topbar.className = "bandDetailTopbar";

    const backBtn = document.createElement("button");
    backBtn.className = "btn";
    backBtn.textContent = "← Back to bands";
    backBtn.addEventListener("click", () => {
      // return to letter view
      CURRENT_REGION = region;
      initRegionPills();
      updateLetterGroups(region);

      // highlight correct letter pill
      if (letterGroupsEl) {
        const pills = Array.from(letterGroupsEl.querySelectorAll(".letter-pill"));
        pills.forEach((p) => p.classList.toggle("active", p.textContent.trim() === letter));
      }

      showLetter(region, letter);
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
    if (!logo.src) logo.style.opacity = "0.20";

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
    albums.forEach((alb) => {
      const card = document.createElement("div");
      card.className = "albumRowCard";

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

      // Option C: venue line + poster from Shows CSV (show_url). Fallbacks:
      // - venue: album Description
      // - poster: SmugMug highlight thumb
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

          // ✅ Poster: prefer show_url from CSV
          const poster = String(best?.show_url || "").trim();
          if (poster && /^https?:\/\//i.test(poster)) {
            thumb.src = poster;
          }

          // ✅ Venue line: prefer CSV, fallback to album Description
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

      card.addEventListener("click", async () => {
        await showAlbumPhotos({
          region,
          letter,
          band: bandObj,
          album: alb,
          folderPath,
        });
      });

      albumsGrid.appendChild(card);
    });
window.requestAnimationFrame(() => resetPanelScroll());
    window.setTimeout(() => resetPanelScroll(), 200);
  }

  async function showAlbumPhotos(info) {
    resultsEl.innerHTML = "";
    // crumbs removed
    resetPanelScroll();

    const wrap = document.createElement("div");
    wrap.style.width = "100%";

    const top = document.createElement("div");
    top.className = "photosTop";

    const backBtn = document.createElement("button");
    backBtn.className = "btn";
    backBtn.textContent = "← Back to albums";
    backBtn.addEventListener("click", () => {
      showBandCard(info.region, info.letter, info.band);
    });

    const title = document.createElement("div");
    title.style.fontSize = "13px";
    title.style.fontWeight = "800";
    title.style.opacity = "0.95";
    title.textContent = info.album?.Name || "Album";

    top.appendChild(backBtn);
    top.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "photosGrid";

    wrap.appendChild(top);
    wrap.appendChild(grid);
    resultsEl.appendChild(wrap);

    const albumKey = info.album?.AlbumKey || info.album?.Key;
    if (!albumKey) {
      const msg = document.createElement("div");
      msg.style.opacity = "0.85";
      msg.textContent = "Album key missing; can’t load photos.";
      grid.appendChild(msg);
      return;
    }

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

    imgs.forEach((img, idx) => {
      const box = document.createElement("div");
      box.className = "smug-photo-box";
      box.dataset.index = String(idx);

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
        openLightbox(imgs, idx);
      });

      grid.appendChild(box);
    });
  }

  // ================== MOUNT ==================
  async function onMount(panelEl) {
    panelRoot = panelEl;
    if (!panelRoot) return;

    // grab refs inside the panel ONLY
    resultsEl = panelRoot.querySelector("#results");
    crumbsEl = null; // breadcrumbs removed
    letterGroupsEl = panelRoot.querySelector("#letter-groups");
    regionPillsEl = panelRoot.querySelector("#region-pills");
    legendEl = panelRoot.querySelector("#status-legend");

    // load data + init UI
    BANDS = await loadBandsFromCsv();

    initRegionPills();
    updateLetterGroups(CURRENT_REGION);

    // End initial loading state (show crumbs only after data is ready)
    try {
      const root = panelRoot.querySelector("#bands-root");
      const loader = panelRoot.querySelector("#bands-loading");
      if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
      if (root) root.classList.remove("is-loading");
    } catch (_) {}

    if (crumbsEl) {
      // crumbs removed
    }

    // default: clear results
    if (resultsEl) resultsEl.innerHTML = "";
    resetPanelScroll();
    if (legendEl) legendEl.style.display = "";
  }

  window.MusicArchiveBands = { render, onMount };
})();
