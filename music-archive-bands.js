// music-archive-bands.js
(function () {
  // logo+name only v3 + video2 band detail style
  // logo+name only v2
  "use strict";

  // ================== CONFIG (matches script.js) ==================
  const API_BASE = "https://music-archive-3lfa.onrender.com";
  const CSV_ENDPOINT = `${API_BASE}/sheet/bands`;

  // Loading message shown while the Bands CSV is being fetched.
  // Edit this string to whatever you want displayed.
  const BANDS_LOADING_TEXT = "Loading the machine, takes about 30 seconds to load up.";

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
  // remember the most recent band context so back-navigation always has something to restore
  let LAST_BAND_CTX = null;


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
    width: min(720px, 96vw);
    max-height: min(520px, 80vh);
    overflow: auto;
    border-radius: 14px;
    background: rgba(55, 0, 0, 0.50);
    border: 1px solid rgba(255,255,255,0.10);
    box-shadow: 0 18px 60px rgba(0,0,0,0.55);
    padding: 14px 14px 12px;
    backdrop-filter: blur(10px);
  }
  .alsoModalHeader{
    position: relative;
    display:flex;
    align-items:center;
    justify-content:center;
    gap: 10px;
    margin-bottom: 10px;
    text-align: center;
    padding: 0 72px 0 72px; /* space for Close button */
  }
  .alsoModalHeader > div{
    flex: 1;
    min-width: 0;
    text-align: center;
  }
  .alsoModalTitle{
    font-family: "Orbitron", system-ui, sans-serif;
    font-size: 12px;
    letter-spacing: 0.12em;
    opacity: 0.85;
    text-transform: none;
    margin-bottom: 6px;
  }
  .alsoModalName{
    font-family: "Orbitron", system-ui, sans-serif;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.2;
  }
  .alsoModalClose{
    position: absolute;
    right: 0;
    top: 0;
    border: 1px solid rgba(255,255,255,0.20);
    background: rgba(0,0,0,0.18);
    color: rgba(255,255,255,0.92);
    border-radius: 999px;
    padding: 6px 10px;
    cursor: pointer;
    font-size: 12px;
  }
  .alsoModalBody{
    margin-top: 6px;
    font-size: 12px;
    opacity: 0.92;
  }
  .alsoModalList{
    margin-top: 10px;
    display:flex;
    flex-direction:column;
    gap: 8px;
    align-items: center;
  }
  .alsoModalItem{
    display:flex;
    flex-direction:column;
    gap: 2px;
    padding: 10px 10px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(0,0,0,0.12);
    cursor: pointer;
    width: min(560px, 100%);
    text-align: center;
  }
  .alsoModalItem:hover{
    border-color: rgba(255,255,255,0.16);
    background: rgba(255,255,255,0.06);
  }
  .alsoModalItemTop{
    font-weight: 700;
    font-size: 13px;
    opacity: 0.96;
  }
  .alsoModalItemSub{
    font-size: 11px;
    opacity: 0.78;
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

      /* top bar inside panel */
      .bandsTop{
        display:flex;
        flex-direction:column;
        gap:10px;
        margin-bottom:10px;
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
        background: rgba(0,0,0,0.92);
        padding: 0;
      }
      .lightboxShell{
        width: min(1280px, 96vw);
        height: min(860px, 92vh);
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
        display:flex;
        align-items:center;
        justify-content:center;
        padding: 0 14px;
      }
      .lightboxImg{
        max-width: 100%;
        max-height: 100%;
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
            <div class="bandsLoading" id="bands-loading">${BANDS_LOADING_TEXT}<span class="dot"></span></div>
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


  async function fetchAlbumKeywords(albumKey) {
    if (!albumKey) return [];
    try {
      const metaRes = await fetch(
        `${API_BASE}/smug/album-meta/${encodeURIComponent(albumKey)}`,
      );
      if (!metaRes.ok) {
        // Backend can return 500 for some albums; fail-soft.
        return [];
      }
      const metaJson = await metaRes.json();
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
    // "Bob Rox (drums)" -> "Bob Rox"
    return String(s || "").trim().replace(/\s*\([^)]*\)\s*$/, "").trim();
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
          <div>
            <div class="alsoModalName" id="alsoModalName">—</div>
            <div class="alsoModalTitle">Also appears in these albums:</div>
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
      const folderPath = b.smug_folder || "";
      const region = b.region || "";
      if (!folderPath) continue;

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
    const bodyEl = overlay.querySelector("#alsoModalBody");
    const listEl = overlay.querySelector("#alsoModalList");

    nameEl.textContent = personName;
    bodyEl.textContent = "Searching albums…";
    listEl.innerHTML = "";
    overlay.style.display = "flex";

    const results = await _runAlsoAppearsSearch(personName, ctx).catch(() => []);

    if (!results.length) {
      bodyEl.textContent = "No other albums found for this name.";
      return;
    }
    bodyEl.textContent = "";

    results.forEach((r) => {
      const item = document.createElement("div");
      item.className = "alsoModalItem";
      item.innerHTML = `
        <div class="alsoModalItemTop">${_eh(r.title)}</div>
        <div class="alsoModalItemSub">${_eh(r.bandName)}</div>
      `;

      item.addEventListener("click", async () => {
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
      });

      listEl.appendChild(item);
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
    const fn = String(img.FileName || "").trim();

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

  // ================== SHARED-ELEMENT TRANSITION ==================
  // Option A: "logo zoom" from the clicked band card into the detail header logo.
  async function animateBandOpen(region, letter, bandObj, fromImgEl) {
    try {
      if (!fromImgEl) {
        // fallback
        showBandCard(region, letter, bandObj, { deferContent: true });
        return;
      }

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
      overlay.style.opacity = "0";
      window.setTimeout(() => {
        try { overlay.remove(); } catch (_) {}
      }, 200);

      try { clone.remove(); } catch (_) {}
    } catch (e) {
      // If anything goes wrong, just open normally
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
        resetPanelScroll();
        updateLetterGroups(key);
        // Ensure we always land on the first tab when switching regions
        selectDefaultLetter(key, "0-C");
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

  // ===== Surgical: when switching regions, default to the first letter tab (prefer "0-C") =====
  function selectDefaultLetter(regionKey, preferred) {
    try {
      if (!letterGroupsEl) return;
      const want = String(preferred || "0-C").trim();
      const btns = Array.from(letterGroupsEl.querySelectorAll(".letter-pill"));
      if (!btns.length) return;

      let target = btns.find((b) => String(b.textContent || "").trim() === want) || btns[0];
      btns.forEach((b) => b.classList.remove("active"));
      target.classList.add("active");

      // Render the list for this region+letter
      showLetter(regionKey, String(target.textContent || "").trim());
    } catch (_) {}
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
    try { document.body.classList.remove("inBandDetail"); } catch(_) {}

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
        // Shared-element transition (logo zoom)
        window.requestAnimationFrame(() => animateBandOpen(region, letter, bandObj, img));
      });

    window.requestAnimationFrame(() => resetPanelScroll());
    window.setTimeout(() => resetPanelScroll(), 200);

      resultsEl.appendChild(card);
    });
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

        card.addEventListener("click", async () => {
          await showAlbumPhotos({
            region,
            letter,
            band: bandObj,
            album: alb,
            folderPath,
            allAlbums: albums,
          });
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

    const wrap = document.createElement("div");
    wrap.style.width = "100%";

    const top = document.createElement("div");
    top.className = "photosTop";

    const backBtn = document.createElement("button");
    backBtn.className = "btn backToAlbumsBtn";
    backBtn.textContent = "← Back to albums";
    backBtn.addEventListener("click", () => {
      try { document.body.classList.remove("inAlbumPhotos"); } catch(_) {}
      try { document.body.classList.remove("inSelectMode"); } catch(_) {}

      // Prefer explicit return context (modal jumps), otherwise fall back to last known band context
      const ret = (info && info._returnCtx) || LAST_BAND_CTX || { region: info.region, letter: info.letter, band: info.band };
      const r = (ret && ret.region) || info.region || (LAST_BAND_CTX && LAST_BAND_CTX.region) || "";
      const l = (ret && ret.letter) || info.letter || (LAST_BAND_CTX && LAST_BAND_CTX.letter) || "";
      const b = (ret && ret.band) || info.band || (LAST_BAND_CTX && LAST_BAND_CTX.band) || null;

      showBandCard(r, l, b);
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
    let selectMode = false;
    const selected = new Set(); // stores indices as strings

    const toolbar = document.createElement("div");
    toolbar.className = "selectToolbar";

    const selectToggle = document.createElement("button");
    selectToggle.className = "selectBtn";
    selectToggle.type = "button";
    selectToggle.textContent = "Select Photos to Download";

    const dlZipBtn = document.createElement("button");
    dlZipBtn.className = "selectBtn primary";
    dlZipBtn.type = "button";
    dlZipBtn.textContent = "Download ZIP (0)";
    dlZipBtn.style.display = "none";

    const clearBtn = document.createElement("button");
    clearBtn.className = "selectBtn";
    clearBtn.type = "button";
    clearBtn.textContent = "Clear";
    clearBtn.style.display = "none";

    const hint = document.createElement("div");
    hint.className = "selectHint";
    hint.textContent = "Tip: In Select mode, click thumbnails to add/remove.";

    const statusLine = document.createElement("div");
    statusLine.className = "zipStatus";
    statusLine.textContent = "";

    function updateSelectUI(){
      const n = selected.size;
      dlZipBtn.textContent = `Download ZIP (${n})`;
      dlZipBtn.style.display = selectMode ? "inline-flex" : "none";
      clearBtn.style.display = (selectMode && n) ? "inline-flex" : "none";
      hint.style.display = selectMode ? "block" : "none";

      try {
        if (selectMode) document.body.classList.add("inSelectMode");
        else document.body.classList.remove("inSelectMode");
      } catch(_) {}
    }

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

    const buyBtn = document.createElement("a");
    buyBtn.className = "selectBtn";
    buyBtn.textContent = "Buy Photos";
    buyBtn.href = "#"; // TODO: replace with SmugMug buy link
    buyBtn.target = "_blank";
    toolbar.appendChild(buyBtn);
    toolbar.appendChild(selectToggle);
    toolbar.appendChild(dlZipBtn);
    toolbar.appendChild(clearBtn);
    toolbar.appendChild(hint);
    wrap.appendChild(toolbar);
    wrap.appendChild(statusLine);

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

    const albumKey = info.album?.AlbumKey || info.album?.Key;
    if (!albumKey) {
      const msg = document.createElement("div");
      msg.style.opacity = "0.85";
      msg.textContent = "Album key missing; can’t load photos.";
      grid.appendChild(msg);
      return;
    }

    // Populate the album keyword chips now that we have albumKey
    renderAlbumKeywords();

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

      // index badge (helps orientation)
      const badge = document.createElement("div");
      badge.className = "photoIndexBadge";
      badge.textContent = `#${idx + 1}`;
      box.appendChild(badge);

      // selection check (visible in Select mode)
      const chk = document.createElement("div");
      chk.className = "selectCheck";
      chk.textContent = "✓";
      box.appendChild(chk);

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
        if (selectMode) {
          const key = String(idx);
          if (selected.has(key)) selected.delete(key);
          else selected.add(key);

          box.classList.toggle("selected", selected.has(key));
          updateSelectUI();
          return;
        }

        openLightbox(imgs, idx, info && info._lightboxContext ? info._lightboxContext : { band: (info?.band?.name || ''), album: (info?.album?.Name || info?.album?.Title || ''), show: (info?.album?.Name || info?.album?.Title || '') });
      });grid.appendChild(box);
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