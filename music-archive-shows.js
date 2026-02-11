// music-archive-shows.js
(function () {
  "use strict";

  // ----- Analytics helper (never throws) -----
  function safeTrack(event, fields) {
    try {
      if (typeof window.trackEvent === "function") {
        window.trackEvent(event, fields || {});
      }
    } catch (_) {}
  }

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
/* ===== Typography fix: Orbitron without forced uppercase (Shows only) ===== */
.showsWrap,
.showsWrap *{
  font-family: "Orbitron", system-ui, sans-serif;
  text-transform: none !important;
}


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


      /* Hide/collapse the top years bar when sticky years are in use */
      #showsYearsMount.isHidden{ display:none !important; }
      #showsYearsMount.isCollapsed{
        height:0 !important;
        padding:0 !important;
        margin:0 !important;
        border:0 !important;
        overflow:hidden !important;
        opacity:0 !important;
      }

      /* Condensed years nav + menu (used by mountYearsPillsOverflow) */
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
      /* Make the content area the scroller so cards never scroll behind the years bar */
      #showsYearContent{
        flex: 1 1 auto;
        min-height: 0; /* critical for flexbox scrolling */
        overflow-y: auto;
        overflow-x: hidden;
        padding-bottom: 84px; /* room for bottom nav on small screens */
      }

      /* Sticky year selector that lives INSIDE the scrollable content area */
      .showsYearSticky{
        position: sticky;
        top: 0;
        z-index: 40;

        display:flex;
        padding: 10px 10px;
        margin: 0 auto 10px;
        flex-wrap: wrap;
        gap: 12px;
        justify-content: center;
        align-items: center;

        backdrop-filter: blur(6px);
        background: rgba(0,0,0,0.18);
        border-bottom: 1px solid rgba(255,255,255,0.06);
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

        /* polish */
        transition: border-color .22s ease, box-shadow .22s ease, background .22s ease, transform .18s ease;
        will-change: transform;
      }

      /* header feels clickable */
      .showTileHeader{
        cursor: pointer;
        transition: background .18s ease, transform .18s ease;
      }
      .showTileHeader:hover{
        background: rgba(255,255,255,0.03);
        transform: translateY(-1px);
      }

      /* open state highlight */
      .showTile.isOpen{
        border-color: rgba(34,197,94,0.28);
        background: rgba(255,255,255,0.05);
        box-shadow: 0 0 0 1px rgba(34,197,94,0.10), 0 12px 26px rgba(0,0,0,0.30);
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
        padding: 10px 12px;
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(0,0,0,0.16);

        display:flex;
        flex-direction:row;
        align-items:center;
        justify-content:space-between;
        gap: 10px;

        min-height: 44px;
        text-align:left;

        /* Bands on this bill are informational for now (no click behavior) */
        cursor: default;
        transition: transform .16s ease, background .16s ease, border-color .16s ease, box-shadow .16s ease;
        user-select: none;
      }

      .bandCard:hover{
        transform: none;
        background: rgba(255,255,255,0.05);
        border-color: rgba(255,255,255,0.16);
        box-shadow: none;
      }

      .bandCard:active{
        transform: none;
      }

      .bandCard:focus-visible{
        outline: none;
      }

/* Status tint (replaces pulsing dot) */
      .bandCard.isGood{
        background: rgba(34,197,94,0.10);
        border-color: rgba(34,197,94,0.22);
      }
      .bandCard.isBad{
        background: rgba(239,68,68,0.10);
        border-color: rgba(239,68,68,0.20);
      }

      .bandLogo{
        width: 28px !important;
        height: 28px !important;
        object-fit: cover !important;
        border-radius: 8px !important;
        background: rgba(255,255,255,0.06);
        flex: 0 0 auto;
      }

      .bandName{
        font-size: 12px;
        color: rgba(255,255,255,0.90);
        line-height: 1.15;
        word-break: break-word;
        flex: 1 1 auto;
        text-align: left;
        margin-right: 6px;
      }

      .bandAction{
        flex: 0 0 auto;
        font-size: 14px;
        font-weight: 900;
        color: rgba(255,255,255,0.82);
        opacity: 0.75;
        letter-spacing: 0.02em;
      }
      .bandCard:hover .bandAction{
        opacity: 0.95;
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

      /* ===== Focused Show Detail (Bands-style shell) ===== */
      .showsDetail{ width:100%; }
      .showsBackBtn{
        cursor:pointer;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap: 8px;
        padding: 8px 14px;
        margin: 10px auto 12px;
        border-radius: 999px;
        border:1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.90);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
      }
      .showsBackBtn:hover{ background: rgba(255,255,255,0.10); }

      .showsDetailShell{
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 18px;
        background: rgba(255,255,255,0.04);
        overflow: hidden;
        box-shadow: 0 10px 28px rgba(0,0,0,0.35);
      }

      .showsDetailTop{
        display:grid;
        grid-template-columns: 280px 1fr;
        gap: 14px;
        padding: 14px;
        align-items: start;
      }
      @media (max-width: 860px){
        .showsDetailTop{ grid-template-columns: 1fr; }
      }

      .showsDetailPosterPane{
        border-radius: 16px;
        border:1px solid rgba(255,255,255,0.10);
        background: rgba(0,0,0,0.18);
        padding: 10px;
        display:flex;
        justify-content:center;
      }
      .showsDetailImg{
        width: 100%;
        max-width: 320px;
        height: auto;
        border-radius: 14px;
        box-shadow: 0 10px 26px rgba(0,0,0,0.38);
        display:block;
      }

      .showsDetailInfoPane{
        border-radius: 16px;
        border:1px solid rgba(255,255,255,0.10);
        background: rgba(0,0,0,0.16);
        padding: 12px;
        min-width: 0;
      }

      .showsDetailKicker{
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.18em;
        color: rgba(255,255,255,0.55);
        text-align:center;
        margin: 2px 0 8px;
      }
      .showsDetailTitle{
        font-size: 16px;
        font-weight: 800;
        color: rgba(255,255,255,0.94);
        text-align:center;
        margin: 0 0 10px;
        text-wrap: balance;
      }

      .showsDetailPills{
        display:grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      @media (max-width: 520px){
        .showsDetailPills{ grid-template-columns: 1fr; }
      }

      .showsDetailPill{
        border-radius: 999px;
        padding: 10px 12px;
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(255,255,255,0.04);
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        min-height: 54px;
      }
      .showsDetailPillLabel{
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.12em;
        color: rgba(255,255,255,0.48);
        margin: 0 0 3px;
        text-align:center;
      }
      .showsDetailPillValue{
        font-size: 12px;
        font-weight: 700;
        color: rgba(255,255,255,0.86);
        text-align:center;
        line-height: 1.2;
      }

      .showsDetailSection{
        padding: 0 14px 14px;
      }
      .showsDetailSectionTitle{
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.12em;
        color: rgba(255,255,255,0.62);
        margin: 10px 4px 10px;
      }

      .showsDetailBands{ margin-top: 6px; }

/* Shows detail: 2-column band grid (premium scan) */
.showsDetailBands.bandGrid{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  align-items: start;
}
@media (max-width: 760px){
  .showsDetailBands.bandGrid{ grid-template-columns: 1fr; }
}
      .showsDetailEmpty{
        color: rgba(255,255,255,0.70);
        font-size: 12px;
        padding: 10px 6px;
        text-align:center;
        border: 1px dashed rgba(255,255,255,0.14);
        border-radius: 12px;
        background: rgba(0,0,0,0.12);
      }
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

  // ===== Poster -> Detail "Hero" animation (FLIP) =====
  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (_) {
      return false;
    }
  }

  function animatePosterHero(fromImgEl, toImgEl) {
    try {
      if (!fromImgEl || !toImgEl) return Promise.resolve(false);
      if (prefersReducedMotion()) return Promise.resolve(false);

      // Helper: wait until destination image has a measurable box (often 0px tall until it loads)
      const waitForDestRect = async () => {
        // First try a few animation frames (covers immediate layout timing)
        for (let i = 0; i < 8; i++) {
          const r = toImgEl.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) return r;
          await new Promise((res) => requestAnimationFrame(res));
        }

        // If still not measurable, wait for the image to load/decode (common in webviews)
        if (!toImgEl.complete || !toImgEl.naturalWidth) {
          await new Promise((res) => {
            let done = false;
            const finish = () => {
              if (done) return;
              done = true;
              try { toImgEl.removeEventListener("load", finish); } catch (_) {}
              try { toImgEl.removeEventListener("error", finish); } catch (_) {}
              res();
            };
            try { toImgEl.addEventListener("load", finish, { once: true }); } catch (_) {}
            try { toImgEl.addEventListener("error", finish, { once: true }); } catch (_) {}
            // Safety timeout so we never hang
            setTimeout(finish, 1200);
          });

          // Give layout one more frame
          await new Promise((res) => requestAnimationFrame(res));
        }

        return toImgEl.getBoundingClientRect();
      };

      const fromRect = fromImgEl.getBoundingClientRect();
      if (!fromRect.width || !fromRect.height) return Promise.resolve(false);

      return (async () => {
        const toRect = await waitForDestRect();
        if (!toRect.width || !toRect.height) return false;

        // Build a fixed-position "ghost" image over the source poster.
        const ghost = fromImgEl.cloneNode(true);
        ghost.removeAttribute("loading");
        ghost.style.position = "fixed";
        ghost.style.top = fromRect.top + "px";
        ghost.style.left = fromRect.left + "px";
        ghost.style.width = fromRect.width + "px";
        ghost.style.height = fromRect.height + "px";
        ghost.style.margin = "0";
        ghost.style.zIndex = "9999";
        ghost.style.pointerEvents = "none";
        ghost.style.transformOrigin = "top left";
        ghost.style.willChange = "transform, opacity";
        ghost.style.boxShadow = window.getComputedStyle(fromImgEl).boxShadow || "none";
        ghost.style.borderRadius = window.getComputedStyle(fromImgEl).borderRadius || "0px";
        ghost.style.objectFit = "cover";

        document.body.appendChild(ghost);

        // Hide the destination image until the ghost arrives (keep layout intact).
        const prevOpacity = toImgEl.style.opacity;
        toImgEl.style.opacity = "0";

        const dx = toRect.left - fromRect.left;
        const dy = toRect.top - fromRect.top;
        const sx = toRect.width / fromRect.width;
        const sy = toRect.height / fromRect.height;

        const duration = 460;
        const easing = "cubic-bezier(0.2, 0.9, 0.2, 1)";

        const anim = ghost.animate(
          [
            { transform: "translate3d(0px,0px,0px) scale(1,1)", opacity: 1 },
            { transform: `translate3d(${dx}px,${dy}px,0px) scale(${sx},${sy})`, opacity: 1 },
          ],
          { duration, easing, fill: "forwards" }
        );

        return await new Promise((resolve) => {
          const done = () => {
            try { ghost.remove(); } catch (_) {}
            try { toImgEl.style.opacity = prevOpacity || ""; } catch (_) {}
            resolve(true);
          };

          // Fade in the real destination image near the end of the move
          const revealAt = Math.max(0, duration - 90);
          setTimeout(() => {
            try {
              toImgEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: "linear", fill: "forwards" });
              toImgEl.style.opacity = "1";
            } catch (_) {
              toImgEl.style.opacity = "1";
            }
          }, revealAt);

          if (anim && typeof anim.addEventListener === "function") {
            anim.addEventListener("finish", done, { once: true });
            anim.addEventListener("cancel", done, { once: true });
          } else {
            setTimeout(done, duration + 30);
          }
        });
      })();
    } catch (_) {
      return Promise.resolve(false);
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
  // /sheet/shows may return CSV, JSON, or (in some cases) a JS-ish object string.
  // We fetch as TEXT first so we can detect & parse safely without crashing the UI.
  const res = await fetch(SHOWS_ENDPOINT, { cache: "no-store" });
  const ct = String(res.headers.get("content-type") || "").toLowerCase();
  const text = await res.text();
  if (!text || !text.trim()) return [];

  const raw = text.trim();

  // ---- Try JSON first if it looks like JSON ----
  if (ct.includes("application/json") || /^[\s]*[\[{]/.test(raw)) {
    try {
      const parsed = JSON.parse(raw);
      // Normalize: accept either { rows: [...] } or a direct array
      const rows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.rows) ? parsed.rows : null);
      if (rows && Array.isArray(rows)) return rows;
      // If it's an object but not in the expected shape, fall through to CSV parsing.
    } catch (e) {
      // Some backends accidentally send JS object literals (unquoted keys, single quotes).
      // We'll do a conservative "best effort" conversion rather than hard-crashing.
      try {
        let fixed = raw;

        // Quote bare keys: { show_name: ... } -> { "show_name": ... }
        fixed = fixed.replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":');

        // Convert single-quoted strings to double-quoted strings: 'x' -> "x"
        // (keeps escaped quotes reasonably safe for our purposes)
        fixed = fixed.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_m, g1) => {
          const inner = String(g1).replace(/"/g, '\\"');
          return `"${inner}"`;
        });

        const parsed2 = JSON.parse(fixed);
        const rows2 = Array.isArray(parsed2) ? parsed2 : (Array.isArray(parsed2?.rows) ? parsed2.rows : null);
        if (rows2 && Array.isArray(rows2)) return rows2;
      } catch (_e2) {
        // Fall through to CSV parsing below.
      }
    }
  }

  // ---- Otherwise treat as CSV ----
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
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
  for (let n = 1; n <= 20; n++) bandIdxs.push(headerLower.indexOf(`band_${n}`));

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

    // Skip fully-empty rows (common in Sheets exports)
    if (row.title || row.poster_url || row.date || row.venue || row.city || row.state || row.bands.length) {
      rows.push(row);
    }
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
  const bands = Array.isArray(show?.bands) ? show.bands.filter(Boolean) : [];
  const bandCount = bands.length;

  const safe = (v) => String(v || "").split('"').join("&quot;");

  containerEl.innerHTML = `
    <div class="showsDetail">
      <button type="button" class="showsBackBtn" data-action="back">← Back to ${year}</button>

      <div class="showsDetailShell">
        <div class="showsDetailTop">
          <div class="showsDetailPosterPane">
            ${posterUrl ? `<img class="showsDetailImg" src="${safe(posterUrl)}" alt="${safe(title) || "Show"}" />` : ``}
          </div>

          <div class="showsDetailInfoPane">
            <div class="showsDetailKicker">Show:</div>
            <div class="showsDetailTitle">${safe(title)}</div>

            <div class="showsDetailPills">
              ${date ? `
                <div class="showsDetailPill">
                  <div class="showsDetailPillLabel">Date</div>
                  <div class="showsDetailPillValue">${safe(date)}</div>
                </div>
              ` : ``}

              ${venueLine ? `
                <div class="showsDetailPill">
                  <div class="showsDetailPillLabel">Venue</div>
                  <div class="showsDetailPillValue">${safe(venueLine)}</div>
                </div>
              ` : ``}

              <div class="showsDetailPill">
                <div class="showsDetailPillLabel">Band Amount</div>
                <div class="showsDetailPillValue">${safe(String(bandCount))}</div>
              </div>

            </div>
          </div>
        </div>

        <div class="showsDetailSection">
          <div class="showsDetailSectionTitle">BANDS ON THIS BILL:</div>
          <div class="showsDetailBands bandGrid" data-detail-bands="1">
            ${bandCount ? `` : `<div class="showsDetailEmpty">No bands listed for this show.</div>`}
          </div>
        </div>
      </div>
    </div>
  `;

  // Populate bands list in the focused view (Bands-side style: logo + name + green/red tint).
  const bandsHost = containerEl.querySelector('[data-detail-bands="1"]');
  if (bandsHost && bandCount) {
    const mmddyy = toMMDDYY(show?.date);
    bandsHost.innerHTML = "";

    ensureBandsIndex().then((bandsIndex) => {
      (bands || []).forEach((bandName) => {
        const info = (bandsIndex && bandsIndex.get)
          ? (bandsIndex.get(normName(bandName)) || { name: bandName })
          : { name: bandName };

        const card = document.createElement("div");
        card.className = "bandCard";
        card.setAttribute("data-band", bandName);

        const img = document.createElement("img");
        img.className = "bandLogo";
        img.alt = bandName;
        img.loading = "lazy";
        img.src = info.logo_url || "";
        applyLogoFallback(img, bandName);

        const nm = document.createElement("div");
        nm.className = "bandName";
        nm.textContent = bandName;

        card.appendChild(img);
        card.appendChild(nm);

        // Analytics: band click (from show detail)
        card.addEventListener("click", (e) => {
          try { e.preventDefault(); e.stopPropagation(); } catch (_) {}
          safeTrack("band_click", {
            band: String(bandName || ""),
            show: String(title || ""),
            year: String(year || ""),
            category: "show_detail"
          });
        });

        bandsHost.appendChild(card);

        bandHasAlbumForCode(info, mmddyy).then((has) => {
          card.classList.toggle("isGood", !!has);
          card.classList.toggle("isBad", !has);
        });
      });
    });
  }
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
    let headers = splitCSVLine(lines[0]).map((h) => String(h || "").trim());
    // Guard against blank/duplicate headers (weird CSV exports).
    const seen = {};
    headers = headers.map((h, idx) => {
      let key = h || `col_${idx}`;
      if (seen[key]) {
        seen[key] += 1;
        key = `${key}_${seen[key]}`;
      } else {
        seen[key] = 1;
      }
      return key;
    });

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

  // ===== Bands list: render on-demand (only when a show is opened) =====
  function getBandCountForShow(show){
    try { return Array.isArray(show?.bands) ? show.bands.length : 0; } catch (_) { return 0; }
  }

  function updateBandsButtonForTile(tile){
    if (!tile) return;
    const btn = tile.querySelector(".bandsToggle");
    if (!btn) return;
    const count = Number(tile.getAttribute("data-band-count") || "0");
    const open = tile.classList.contains("isOpen");
    btn.textContent = `Bands (${count}) ${open ? "▴" : "▾"}`;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
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

  // If blank upfront, show a placeholder immediately.
  if (!String(imgEl.src || "").trim()) {
    try {
      imgEl.src = makeLogoDataUri(name);
      imgEl.style.opacity = "0.75";
    } catch (_) {}
  }
}

function ensureTileBandsLoaded(tile){
    if (!tile) return;
    if (tile._bandsLoaded) return;

    const bandGrid = tile._bandGridEl;
    const show = tile._showData;
    const showMMDDYY = tile._showMMDDYY || toMMDDYY(show?.date);

    if (!bandGrid || !show) return;

    tile._bandsLoaded = true;
    bandGrid.innerHTML = "";

    ensureBandsIndex().then((bandsIndex) => {
      (show.bands || []).forEach((bandName) => {
        const info = (bandsIndex && bandsIndex.get) ? (bandsIndex.get(normName(bandName)) || { name: bandName }) : { name: bandName };

        const card = document.createElement("div");
        card.className = "bandCard";
        card.setAttribute("data-band", bandName);

        const img = document.createElement("img");
        img.className = "bandLogo";
        img.alt = bandName;
        img.loading = "lazy";
        img.src = info.logo_url || "";
        applyLogoFallback(img, bandName);

        const nm = document.createElement("div");
        nm.className = "bandName";
        nm.textContent = bandName;

        card.appendChild(img);
        card.appendChild(nm);

        bandGrid.appendChild(card);

        // async album check -> tint row green/red
        bandHasAlbumForCode(info, showMMDDYY).then((has) => {
          card.classList.toggle("isGood", !!has);
          card.classList.toggle("isBad", !has);
        });
      });
    });
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

// ===== Concurrency limiter (prevents request stampede) =====
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
      .finally(() => {
        active--;
        next();
      });
  };

  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
}

// Allow only N folder album requests at once
const limitNet = pLimit(4); // 3–4 is ideal


// ===== Folder album list cache (huge perf win) =====
// Cache albums per folder+region so we don't refetch the same 200 albums for every date check.
const FOLDER_ALBUMS_CACHE = new Map(); // key -> { albums, ts }
const FOLDER_ALBUMS_TTL_MS = 1000 * 60 * 30; // 30 min

async function fetchFolderAlbumsCached(folderPath, region) {
  const clean = cleanFolderPath(folderPath || "");
  if (!clean) return [];

  const key = `${region || ""}||${clean}`;
  const now = Date.now();

  const hit = FOLDER_ALBUMS_CACHE.get(key);
  if (hit && hit.albums && (now - (hit.ts || 0)) < FOLDER_ALBUMS_TTL_MS) {
    return hit.albums;
  }

  const albums = await fetchFolderAlbums(clean, region);
  FOLDER_ALBUMS_CACHE.set(key, { albums, ts: now });
  return albums;
}


  
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
      const res = await fetch(url, { signal: ac ? ac.signal : undefined, cache: "no-store" });
      const ct = String(res.headers.get("content-type") || "").toLowerCase();
      const bodyText = await res.text();

      if (!res.ok) {
        if (attempt <= maxRetries && retryStatuses.has(res.status)) {
          // If we're being rate-limited, honor Retry-After when present.
          let retryAfterMs = 0;
          try {
            if (res.status === 429) {
              const ra = String(res.headers.get("retry-after") || "").trim();
              // Retry-After is usually seconds; ignore invalid values.
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

      if (bodyText && /^[\s]*</.test(bodyText)) {
        throw new Error(`Expected JSON but got HTML (${ct || "unknown"})`);
      }

      return JSON.parse(bodyText || "null");
    } catch (err) {
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


  // get all albums inside a SmugMug folder using the same backend pattern as script.js
  async function fetchFolderAlbums(folderPath, region) {
    const clean = cleanFolderPath(folderPath || "");
    if (!clean) return [];
    const baseSlug = toSlug(clean || "");
    const url = `${API_BASE}/smug/${encodeURIComponent(baseSlug)}?folder=${encodeURIComponent(clean)}&region=${encodeURIComponent(region || "")}&count=200&start=1`;

    // Use the same hardened JSON fetch helper (handles HTML surprises + rate-limit backoff).
    const data = await limitNet(() => fetchJsonSafe(url, { retries: 2 }));

    const albumsRaw = (data && data.Response && (data.Response.Album || data.Response.Albums)) || [];
    if (Array.isArray(albumsRaw)) return albumsRaw;
    return albumsRaw ? [albumsRaw] : [];
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

      const albums = await fetchFolderAlbumsCached(folderPath, region);

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

      // Bands render is deferred until the tile is opened (better perf + smoother accordion)
      const showMMDDYY = toMMDDYY(s.date);
      tile._bandGridEl = bandGrid;
      tile._showData = s;
      tile._showMMDDYY = showMMDDYY;
      tile._bandsLoaded = false;
      tile.setAttribute("data-band-count", String(getBandCountForShow(s)));
      updateBandsButtonForTile(tile);

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

    // Condense the visible year pills and push the rest into a "More" menu
    const YEARS_MAX_VISIBLE = 6;

	
	let currentYearShows = [];
	let currentYearPretty = []; // same shows but with prettyDate + venueLine
	let currentYearPrettyById = new Map(); // showId -> pretty show data


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

// ===== Sticky year selector (inside the scrollable content area) =====
function ensureStickyYears() {
  // Remove any existing sticky years first
  try {
    if (contentEl._stickyYearCleanup) {
      contentEl._stickyYearCleanup();
      contentEl._stickyYearCleanup = null;
    }
  } catch (_) {}

  // If there's no years UI mounted yet, nothing to clone.
  if (!mountEl || !mountEl.innerHTML) return;

  // Build sticky container and clone the years UI HTML.
  const sticky = document.createElement("div");
  sticky.className = "showsYearSticky";
  sticky.innerHTML = mountEl.innerHTML;

  // Insert at top of the scrollable content.
  contentEl.insertBefore(sticky, contentEl.firstChild);

  // Delegate clicks inside sticky years UI back to the same handler.
  const onStickyClick = (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    // Mirror behavior from mountYearsPillsOverflow
    if (btn.dataset.yearsMore === "1") {
      const menu = sticky.querySelector(".yearsMenu");
      if (!menu) return;
      const isOpen = menu.classList.contains("isOpen");
      menu.classList.toggle("isOpen", !isOpen);
      btn.setAttribute("aria-expanded", !isOpen ? "true" : "false");
      return;
    }

    const yearStr = btn.dataset.year;
    if (!yearStr) return;
    const year = Number(yearStr);
    if (!Number.isFinite(year)) return;

    // Close menu if open
    try {
      const menu = sticky.querySelector(".yearsMenu");
      const moreBtn = sticky.querySelector('[data-years-more="1"]');
      if (menu) menu.classList.remove("isOpen");
      if (moreBtn) moreBtn.setAttribute("aria-expanded", "false");
    } catch (_) {}

    // Select the year
    handleSelectYear(year);
  };

  sticky.addEventListener("click", onStickyClick);

  // Close sticky menu on outside click + ESC
  const onDocClick = (e) => {
    const menu = sticky.querySelector(".yearsMenu");
    if (!menu) return;
    if (!sticky.contains(e.target)) {
      menu.classList.remove("isOpen");
      const moreBtn = sticky.querySelector('[data-years-more="1"]');
      if (moreBtn) moreBtn.setAttribute("aria-expanded", "false");
    }
  };
  const onDocKey = (e) => {
    if (e.key !== "Escape") return;
    const menu = sticky.querySelector(".yearsMenu");
    if (!menu) return;
    menu.classList.remove("isOpen");
    const moreBtn = sticky.querySelector('[data-years-more="1"]');
    if (moreBtn) moreBtn.setAttribute("aria-expanded", "false");
  };

  document.addEventListener("click", onDocClick, { capture: true });
  document.addEventListener("keydown", onDocKey);

  contentEl._stickyYearCleanup = () => {
    try { sticky.removeEventListener("click", onStickyClick); } catch (_) {}
    try { document.removeEventListener("click", onDocClick, { capture: true }); } catch (_) {}
    try { document.removeEventListener("keydown", onDocKey); } catch (_) {}
    try { sticky.remove(); } catch (_) {}
  };
}

// Clicking a poster toggles a dropdown inside that card (years row stays)

// Clicking anywhere in the show header “bubble” (and the poster) opens the focused detail view.
// The band accordion/dropdown behavior has been removed.
contentEl.addEventListener("click", (e) => {
  // Back from detail view
  const back = e.target.closest('[data-action="back"]');
  if (back) {
    e.preventDefault();
    e.stopPropagation();

    // Restore years mount visibility immediately
    try {
      mountEl.classList.remove("isHidden");
      mountEl.classList.remove("isCollapsed");
    } catch (_) {}

    const snap = contentEl._showsLastGridSnap || null;
    handleSelectYear(activeYear);
    if (snap) {
      setTimeout(() => restoreScrollSnapshot(snap), 0);
      setTimeout(() => restoreScrollSnapshot(snap), 50);
    }
    return;
  }

  // If the sticky year selector handled the click, do nothing here.
  if (e.target && e.target.closest && e.target.closest('.showsYearSticky')) return;

  // If we're in detail mode, ignore other clicks
  if (contentEl.querySelector(".showsDetail")) return;

  // Click on the show header bubble (including poster) -> focused detail view
  const header = e.target.closest(".showTileHeader");
  if (!header) return;

  const tile = header.closest(".showTile");
  if (!tile) return;

  // Source poster image for hero animation (may be null if no poster)
  const _heroFromPosterEl = header.querySelector("img.showPoster");

  e.preventDefault();
  e.stopPropagation();

  // Save scroll so we can return to the same spot in the grid
  contentEl._showsLastGridSnap = saveScrollSnapshot(mountEl);

  // Cleanup sticky selector while in detail view (prevents orphan listeners)
  try {
    if (contentEl._stickyYearCleanup) {
      contentEl._stickyYearCleanup();
      contentEl._stickyYearCleanup = null;
    }
  } catch (_) {}

  // Hide the big years bar while focused in a show
  try {
    mountEl.classList.add("isCollapsed");
    mountEl.classList.add("isHidden");
  } catch (_) {}

  const showId = tile.getAttribute("data-show-id") || "";
  const baseShow = tile._showData || null;
  const pretty =
    showId && currentYearPrettyById && currentYearPrettyById.get
      ? currentYearPrettyById.get(showId)
      : null;

  const show = pretty || Object.assign({}, baseShow || {}, {
    venueLine: buildVenueText(baseShow || {}),
    prettyDate: (baseShow && baseShow.date) ? String(baseShow.date) : "",
  });

  // Analytics: show open
  safeTrack("show_open", {
    show: String(show && (show.show_name || show.name || show.title || show.event || "") ? (show.show_name || show.name || show.title || show.event || "") : ""),
    year: String(activeYear || ""),
    category: "shows",
    extra: String(showId || "")
  });

  renderPosterDetail({ year: activeYear, show, containerEl: contentEl });

  // Ensure focused view starts at the top
  try { contentEl.scrollTop = 0; } catch (_) {}

  // Hero animation: clicked poster -> focused detail poster (FLIP)
  // Run after the detail DOM is painted so we can measure the destination rect.
  if (_heroFromPosterEl) {
    try {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const toImg = contentEl.querySelector(".showsDetailImg");
          if (toImg) animatePosterHero(_heroFromPosterEl, toImg);
        });
      });
    } catch (_) {}
  }
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
    maxVisible: YEARS_MAX_VISIBLE,
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
    content.innerHTML = `<div class="showsWip">Loading the machine up, this takes up to 30 seconds to load due to server loadup. This will be fixed soon!</div>`;

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

	// Build lookup so focused detail view can pull the pretty fields reliably
	currentYearPrettyById = new Map();
	(currentYearPretty || []).forEach((ps) => {
	  try { currentYearPrettyById.set(makeShowId(ps), ps); } catch (_) {}
	});

    renderShowsGridForYear({ year, shows: showsForYear, containerEl: content });

    // Recreate sticky year selector inside the scrollable content (so it stays visible while scrolling)
    ensureStickyYears();
    // Hide the top (non-sticky) years bar while browsing the grid (sticky years stays visible)
    try {
      mountEl.classList.add("isCollapsed");
      mountEl.classList.add("isHidden");
    } catch (_) {}

    // Restore previously-open tile (if any) after re-render
    const st = loadShowsState();
    if (st.openShowId) {
      const toOpen = content.querySelector(`.showTile[data-show-id="${cssEscape(st.openShowId)}"]`);
      if (toOpen) {
        toOpen.classList.add("isOpen");
        ensureTileBandsLoaded(toOpen);
        updateBandsButtonForTile(toOpen);
      }
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
      maxVisible: YEARS_MAX_VISIBLE,
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