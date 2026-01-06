// music-archive-bands.js
(function () {
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
      // Find the nearest scrollable ancestor (including the panel itself)
      const start = panelRoot || document.getElementById('musicContentPanel');
      let el = start;
      let scroller = null;

      while (el && el !== document.body) {
        const cs = window.getComputedStyle(el);
        const oy = cs.overflowY;
        const canScroll = (oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 2;
        if (canScroll) { scroller = el; break; }
        el = el.parentElement;
      }

      // Fallback to the document scroller if needed
      if (!scroller) scroller = document.scrollingElement || document.documentElement;

      // Hard reset (do it twice to defeat any late layout/restore)
      scroller.scrollTop = 0;
      window.requestAnimationFrame(() => { scroller.scrollTop = 0; });
      window.setTimeout(() => { scroller.scrollTop = 0; }, 0);
      window.setTimeout(() => { scroller.scrollTop = 0; }, 120);
    } catch (e) {}
  }
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

      /* crumbs */
      #crumbs{
        text-align:center;
        margin:10px 0 12px;
        font-size:12px;
        opacity:.85;
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
      .albumsGrid{
        width:100%;
        display:grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap:14px;
        max-width:none;
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
    `;
    document.head.appendChild(s);
  }

  // ================== HTML RENDER ==================
  function render() {
    ensureBandsStyles();

    // ONLY what's inside #musicContentPanel
    return `
      <div class="bandsWrap" id="bands-root">
        <div class="bandsTop">
          <div id="region-pills"></div>
          <div id="letter-groups"></div>
          <div id="status-legend">
            <span><span class="legend-dot" style="background:#22c55e"></span>Active</span>
            <span><span class="legend-dot" style="background:#f59e0b"></span>Inactive</span>
            <span><span class="legend-dot" style="background:#94a3b8"></span>Unknown</span>
          </div>
        </div>

        <div class="bandsLayout">
          <div>
            <div id="crumbs">Select a region first, then the corresponding letter.</div>
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

  async function loadBandsFromCsv() {
    try {
      const text = await fetch(CSV_ENDPOINT).then((r) => r.text());
      if (!text.trim()) return {};

      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const headerLine = lines.shift();
      const header = headerLine.split(",").map((h) => h.trim().toLowerCase());

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
    setTimeout(() => resetPanelScroll(), 450);
        updateLetterGroups(key);
        resultsEl.innerHTML = "";
        crumbsEl.textContent = "Select a region first, then the corresponding letter.";
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

  function showLetter(region, letter) {
    if (!resultsEl) return;

    resultsEl.innerHTML = "";
    crumbsEl.textContent = `${region} → ${letter}`;
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
      name.textContent = bandObj.name || "";

      const meta = document.createElement("div");
      meta.className = "band-meta";

      const total = Number(bandObj.total_sets) || 0;
      const archived = Number(bandObj.sets_archive) || 0;
      const status = String(bandObj.status || "").trim();
      const locParts = [
        bandObj.location || "",
        bandObj.state || "",
        bandObj.country || "",
      ].filter(Boolean);
      const loc = locParts.join(", ");

      const p1 = document.createElement("span");
      p1.className = "pill";
      p1.textContent = `Sets: ${total}`;

      const p2 = document.createElement("span");
      p2.className = "pill";
      p2.textContent = `Archived: ${archived}`;

      const p3 = document.createElement("span");
      p3.className = "pill";
      p3.textContent = status ? `Status: ${status}` : "Status: Unknown";
      p3.style.borderColor = "rgba(255,255,255,0.10)";
      p3.style.background = "rgba(255,255,255,0.04)";
      p3.style.boxShadow = `inset 0 0 0 1px ${statusToColor(status)}22`;

      meta.appendChild(p1);
      meta.appendChild(p2);
      meta.appendChild(p3);

      if (loc) {
        const p4 = document.createElement("span");
        p4.className = "pill";
        p4.textContent = loc;
        meta.appendChild(p4);
      }

      right.appendChild(name);
      right.appendChild(meta);

      row.appendChild(img);
      row.appendChild(right);
      card.appendChild(row);

      card.addEventListener("click", () => {
        showBandCard(region, letter, bandObj);
      });

    window.requestAnimationFrame(() => resetPanelScroll());

      resultsEl.appendChild(card);
    });
  }

  async function showBandCard(region, letter, bandObj) {
    if (!resultsEl) return;

    resultsEl.innerHTML = "";
    crumbsEl.textContent = `${region} → ${letter} → ${bandObj?.name || ""}`;
    resetPanelScroll();

    const wrap = document.createElement("div");
    wrap.className = "albumsWrap";

    const top = document.createElement("div");
    top.style.width = "100%";
    top.style.maxWidth = "1400px";
    top.style.margin = "0 auto";
    top.style.display = "flex";
    top.style.justifyContent = "space-between";
    top.style.alignItems = "center";
    top.style.gap = "10px";
    top.style.flexWrap = "wrap";

    const backBtn = document.createElement("button");
    backBtn.className = "btn";
    backBtn.textContent = "← Back to bands";
    backBtn.addEventListener("click", () => {
      // return to letter view
      // sync region + letter pills
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

    const title = document.createElement("div");
    title.style.fontSize = "14px";
    title.style.fontWeight = "800";
    title.style.opacity = "0.95";
    title.textContent = bandObj?.name || "Band";

    top.appendChild(backBtn);
    top.appendChild(title);
    wrap.appendChild(top);

    const albumsGrid = document.createElement("div");
    albumsGrid.className = "albumsGrid";
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

    let albums = [];
    try {
      albums = await fetchFolderAlbums(folderPath, region);
    } catch (e) {
      const msg = document.createElement("div");
      msg.style.opacity = "0.85";
      msg.textContent = "Could not load albums for this band.";
      albumsGrid.appendChild(msg);
      return;
    }

    if (!albums.length) {
      const msg = document.createElement("div");
      msg.style.opacity = "0.85";
      msg.textContent = "No albums found in that band folder.";
      albumsGrid.appendChild(msg);
      return;
    }

    // show albums
    albums.forEach((alb) => {
      const card = document.createElement("div");
      card.className = "album-card";

      const thumb = document.createElement("img");
      thumb.className = "album-thumb";
      thumb.loading = "lazy";
      thumb.alt = alb?.Name || "Album";
      thumb.src =
        alb?.HighlightImage?.ThumbnailUrl ||
        alb?.HighlightImage?.SmallUrl ||
        alb?.HighlightImage?.MediumUrl ||
        alb?.ThumbnailUrl ||
        alb?.SmallUrl ||
        alb?.MediumUrl ||
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='750'%3E%3Crect width='100%25' height='100%25' fill='rgba(255,255,255,0.06)'/%3E%3C/svg%3E";

      const t = document.createElement("div");
      t.className = "album-title";
      t.textContent = alb?.Name || alb?.Title || "Album";

      const sub = document.createElement("div");
      sub.className = "album-sub";
      sub.textContent = alb?.ImageCount ? `${alb.ImageCount} photos` : "";

      card.appendChild(thumb);
      card.appendChild(t);
      card.appendChild(sub);

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
  }

  async function showAlbumPhotos(info) {
    resultsEl.innerHTML = "";
    crumbsEl.textContent = `${info.region} → ${info.letter} → ${info.band?.name || ""} → ${info.album?.Name || "Album"}`;
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
    crumbsEl = panelRoot.querySelector("#crumbs");
    letterGroupsEl = panelRoot.querySelector("#letter-groups");
    regionPillsEl = panelRoot.querySelector("#region-pills");
    legendEl = panelRoot.querySelector("#status-legend");

    // load data + init UI
    BANDS = await loadBandsFromCsv();

    initRegionPills();
    updateLetterGroups(CURRENT_REGION);

    if (crumbsEl) {
      crumbsEl.textContent = "Select a region first, then the corresponding letter.";
    }

    // default: clear results
    if (resultsEl) resultsEl.innerHTML = "";
    resetPanelScroll();
    if (legendEl) legendEl.style.display = "";
  }

  window.MusicArchiveBands = { render, onMount };
})();
