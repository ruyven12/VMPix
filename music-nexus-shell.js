(function () {
  "use strict";

  var STYLE_ID = "musicNexusShellStyles";
  var bandsRootObserver = null;
  var scheduled = false;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "body.route-music [data-hud-main-text]{",
      "  display:inline-block;",
      "  font-family:'Orbitron',system-ui,sans-serif;",
      "  font-size:clamp(15px,1.3vw,18px) !important;",
      "  letter-spacing:.26em !important;",
      "  text-transform:uppercase !important;",
      "  white-space:nowrap;",
      "}",
      "body.route-music #musicInfoStrip{",
      "  max-width:min(1120px, calc(100% - 20px)) !important;",
      "  margin:0 auto 8px !important;",
      "  padding:0 10px 8px !important;",
      "  background:linear-gradient(180deg, rgba(17,6,14,.76), rgba(8,4,10,.34)) !important;",
      "  border:1px solid rgba(255,84,126,.28) !important;",
      "  border-radius:22px !important;",
      "  box-shadow:0 0 0 1px rgba(255,84,126,.10) inset, 0 18px 38px rgba(0,0,0,.28), 0 0 26px rgba(255,84,126,.10) !important;",
      "}",
      "body.route-music #archiveModeToggleMount{",
      "  padding:8px 0 2px !important;",
      "}",
      "body.route-music #archiveModeToggleMount .archiveHeaderWrap{",
      "  margin:0 !important;",
      "}",
      "body.route-music #archiveModeToggleMount .archiveModeToggle{",
      "  width:min(100%, 540px);",
      "  display:grid !important;",
      "  grid-template-columns:repeat(3, minmax(0, 1fr));",
      "  gap:10px !important;",
      "  padding:6px !important;",
      "  border-radius:18px !important;",
      "  background:linear-gradient(180deg, rgba(35,10,22,.92), rgba(12,6,12,.68)) !important;",
      "  box-shadow:0 0 0 1px rgba(255,84,126,.24) inset, 0 0 20px rgba(255,84,126,.10) !important;",
      "}",
      "body.route-music #archiveModeToggleMount .archiveModeBtn{",
      "  min-width:0 !important;",
      "  width:100%;",
      "  padding:11px 12px !important;",
      "  border-radius:14px !important;",
      "  border:1px solid rgba(255,110,150,.16) !important;",
      "  background:linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.01)) !important;",
      "  color:rgba(255,221,230,.76) !important;",
      "  font-size:11px !important;",
      "  font-weight:800 !important;",
      "  letter-spacing:.18em !important;",
      "  text-transform:uppercase !important;",
      "  box-shadow:none !important;",
      "  transition:transform .18s ease, border-color .18s ease, color .18s ease, background .18s ease, box-shadow .18s ease;",
      "}",
      "body.route-music #archiveModeToggleMount .archiveModeBtn:hover{",
      "  color:rgba(255,244,247,.96) !important;",
      "  border-color:rgba(255,118,156,.34) !important;",
      "  transform:translateY(-1px);",
      "}",
      "body.route-music #archiveModeToggleMount .archiveModeBtn.is-active{",
      "  color:rgba(255,246,249,.98) !important;",
      "  border-color:rgba(255,128,165,.54) !important;",
      "  background:linear-gradient(180deg, rgba(255,98,142,.24), rgba(255,58,106,.14)) !important;",
      "  box-shadow:0 0 0 1px rgba(255,255,255,.06) inset, 0 0 18px rgba(255,88,132,.18) !important;",
      "}",
      "body.route-music .bandsShellV31{",
      "  width:100%;",
      "  max-width:1120px;",
      "  margin:0 auto;",
      "  display:grid;",
      "  gap:18px;",
      "  color:rgba(246,236,242,.94);",
      "}",
      "body.route-music .bandsShellTopGrid{",
      "  display:grid;",
      "  grid-template-columns:minmax(0, 1fr) minmax(240px, 286px);",
      "  gap:18px;",
      "  align-items:stretch;",
      "}",
      "body.route-music .bandsShellPanel{",
      "  position:relative;",
      "  min-width:0;",
      "  border-radius:22px;",
      "  border:1px solid rgba(255,86,128,.24);",
      "  background:linear-gradient(180deg, rgba(22,8,16,.92), rgba(10,6,12,.80));",
      "  box-shadow:0 0 0 1px rgba(255,86,128,.08) inset, 0 20px 38px rgba(0,0,0,.24), 0 0 24px rgba(255,86,128,.08);",
      "  overflow:hidden;",
      "}",
      "body.route-music .bandsShellPanel::before{",
      "  content:'';",
      "  position:absolute;",
      "  inset:0;",
      "  pointer-events:none;",
      "  background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,0) 18%);",
      "  opacity:.5;",
      "}",
      "body.route-music .bandsShellPanel > *{",
      "  position:relative;",
      "  z-index:1;",
      "}",
      "body.route-music .bandsFilterShell{",
      "  padding:18px 18px 16px;",
      "  display:grid;",
      "  gap:16px;",
      "}",
      "body.route-music .bandsFilterIntro{",
      "  display:grid;",
      "  gap:10px;",
      "}",
      "body.route-music #bands-overall{",
      "  display:grid;",
      "  gap:10px;",
      "}",
      "body.route-music #bands-overall .reimagingStatsTitle{",
      "  margin:0 !important;",
      "  text-align:left !important;",
      "  font-size:clamp(18px, 1.8vw, 24px) !important;",
      "  letter-spacing:.16em !important;",
      "  color:rgba(255,240,244,.96) !important;",
      "}",
      "body.route-music #bands-overall .reimagingStatsSeparator{",
      "  margin:0 !important;",
      "  height:2px !important;",
      "  background:linear-gradient(90deg, rgba(255,255,255,0), rgba(255,100,144,.72) 46%, rgba(255,255,255,0)) !important;",
      "  box-shadow:0 0 10px rgba(255,90,136,.22) !important;",
      "}",
      "body.route-music #bands-overall .reimagingStatsIntro{",
      "  margin:0 !important;",
      "  text-align:left !important;",
      "  font-size:12px !important;",
      "  line-height:1.65 !important;",
      "  letter-spacing:.04em !important;",
      "  color:rgba(240,218,226,.76) !important;",
      "}",
      "body.route-music .bandsControlBlock{",
      "  display:grid;",
      "  gap:10px;",
      "}",
      "body.route-music .bandsBlockLabel{",
      "  font-family:'Orbitron',system-ui,sans-serif;",
      "  font-size:10px;",
      "  font-weight:800;",
      "  letter-spacing:.22em;",
      "  text-transform:uppercase;",
      "  color:rgba(255,184,202,.64);",
      "}",
      "body.route-music #region-pills,",
      "body.route-music #letter-groups{",
      "  display:flex;",
      "  flex-wrap:wrap;",
      "  gap:10px;",
      "  min-width:0;",
      "}",
      "body.route-music .region-pill,",
      "body.route-music .letter-pill{",
      "  appearance:none;",
      "  border:1px solid rgba(255,120,162,.18);",
      "  border-radius:999px;",
      "  background:rgba(255,255,255,.03);",
      "  color:rgba(255,233,239,.78);",
      "  font-family:'Orbitron',system-ui,sans-serif;",
      "  font-size:10px;",
      "  font-weight:800;",
      "  letter-spacing:.16em;",
      "  text-transform:uppercase;",
      "  padding:10px 14px;",
      "  cursor:pointer;",
      "  transition:transform .18s ease, border-color .18s ease, background .18s ease, color .18s ease, box-shadow .18s ease;",
      "}",
      "body.route-music .region-pill:hover,",
      "body.route-music .letter-pill:hover{",
      "  transform:translateY(-1px);",
      "  border-color:rgba(255,132,172,.34);",
      "  color:rgba(255,246,248,.96);",
      "}",
      "body.route-music .region-pill.active,",
      "body.route-music .letter-pill.active{",
      "  border-color:rgba(255,130,168,.52);",
      "  color:rgba(255,248,249,.98);",
      "  background:linear-gradient(180deg, rgba(255,104,148,.20), rgba(255,56,102,.12));",
      "  box-shadow:0 0 0 1px rgba(255,255,255,.05) inset, 0 0 16px rgba(255,86,132,.14);",
      "}",
      "body.route-music #status-legend{",
      "  display:grid !important;",
      "  grid-template-columns:repeat(3, minmax(0, 1fr));",
      "  gap:10px;",
      "  align-items:stretch;",
      "}",
      "body.route-music .bandsLegendItem{",
      "  min-width:0;",
      "  padding:11px 12px;",
      "  border-radius:16px;",
      "  border:1px solid rgba(255,118,158,.14);",
      "  background:rgba(255,255,255,.025);",
      "  display:grid;",
      "  gap:8px;",
      "}",
      "body.route-music .bandsLegendMeta{",
      "  display:flex;",
      "  align-items:center;",
      "  gap:8px;",
      "  min-width:0;",
      "}",
      "body.route-music .bandsLegendDot{",
      "  width:10px;",
      "  height:10px;",
      "  border-radius:999px;",
      "  flex:0 0 auto;",
      "  box-shadow:0 0 10px rgba(255,255,255,.10);",
      "}",
      "body.route-music .bandsLegendDot.is-done{",
      "  background:#59f098;",
      "  box-shadow:0 0 10px rgba(89,240,152,.32);",
      "}",
      "body.route-music .bandsLegendDot.is-progress{",
      "  background:#ffd15d;",
      "  box-shadow:0 0 10px rgba(255,209,93,.28);",
      "}",
      "body.route-music .bandsLegendDot.is-untouched{",
      "  background:#94a3b8;",
      "  box-shadow:0 0 10px rgba(148,163,184,.22);",
      "}",
      "body.route-music .bandsLegendLabel{",
      "  min-width:0;",
      "  font-family:'Orbitron',system-ui,sans-serif;",
      "  font-size:10px;",
      "  font-weight:800;",
      "  letter-spacing:.14em;",
      "  text-transform:uppercase;",
      "  color:rgba(255,229,235,.84);",
      "}",
      "body.route-music .bandsLegendCount{",
      "  font-family:'Orbitron',system-ui,sans-serif;",
      "  font-size:18px;",
      "  font-weight:900;",
      "  line-height:1;",
      "  color:rgba(255,244,247,.98);",
      "}",
      "body.route-music #bands-total{",
      "  grid-column:1 / -1;",
      "  padding-top:2px;",
      "  font-family:'Orbitron',system-ui,sans-serif !important;",
      "  font-size:10px !important;",
      "  font-weight:800 !important;",
      "  letter-spacing:.16em !important;",
      "  text-transform:uppercase !important;",
      "  color:rgba(255,197,212,.66) !important;",
      "  text-align:left !important;",
      "}",
      "body.route-music .bandsSnapshotPanel{",
      "  padding:18px 18px 16px;",
      "  display:grid;",
      "  gap:12px;",
      "  align-content:start;",
      "  min-height:100%;",
      "}",
      "body.route-music .bandsSnapshotEyebrow{",
      "  font-family:'Orbitron',system-ui,sans-serif;",
      "  font-size:10px;",
      "  font-weight:800;",
      "  letter-spacing:.22em;",
      "  text-transform:uppercase;",
      "  color:rgba(255,191,206,.62);",
      "}",
      "body.route-music .bandsSnapshotRegion{",
      "  font-family:'Orbitron',system-ui,sans-serif;",
      "  font-size:24px;",
      "  font-weight:900;",
      "  line-height:1;",
      "  letter-spacing:.10em;",
      "  text-transform:uppercase;",
      "  color:rgba(255,241,245,.97);",
      "}",
      "body.route-music .bandsSnapshotCopy{",
      "  font-size:12px;",
      "  line-height:1.62;",
      "  letter-spacing:.04em;",
      "  color:rgba(240,220,228,.72);",
      "}",
      "body.route-music .bandsSnapshotStats{",
      "  display:grid;",
      "  grid-template-columns:repeat(2, minmax(0, 1fr));",
      "  gap:10px;",
      "}",
      "body.route-music .bandsSnapshotStat{",
      "  min-width:0;",
      "  padding:12px 12px 11px;",
      "  border-radius:16px;",
      "  border:1px solid rgba(255,120,160,.14);",
      "  background:rgba(255,255,255,.025);",
      "  display:grid;",
      "  gap:6px;",
      "}",
      "body.route-music .bandsSnapshotStatLabel{",
      "  font-family:'Orbitron',system-ui,sans-serif;",
      "  font-size:9px;",
      "  font-weight:800;",
      "  letter-spacing:.18em;",
      "  text-transform:uppercase;",
      "  color:rgba(255,193,210,.62);",
      "}",
      "body.route-music .bandsSnapshotStatValue{",
      "  font-family:'Orbitron',system-ui,sans-serif;",
      "  font-size:18px;",
      "  font-weight:900;",
      "  line-height:1;",
      "  color:rgba(255,246,248,.97);",
      "}",
      "body.route-music .bandsLowerShell{",
      "  padding:18px;",
      "  display:grid;",
      "  gap:16px;",
      "}",
      "body.route-music .bandsLowerHead{",
      "  display:flex;",
      "  align-items:center;",
      "  justify-content:space-between;",
      "  gap:18px;",
      "}",
      "body.route-music .bandsLowerCopy{",
      "  min-width:0;",
      "  display:grid;",
      "  gap:6px;",
      "}",
      "body.route-music .bandsLowerEyebrow{",
      "  font-family:'Orbitron',system-ui,sans-serif;",
      "  font-size:10px;",
      "  font-weight:800;",
      "  letter-spacing:.22em;",
      "  text-transform:uppercase;",
      "  color:rgba(255,193,208,.62);",
      "}",
      "body.route-music .bandsRouteTitle{",
      "  font-family:'Orbitron',system-ui,sans-serif;",
      "  font-size:clamp(18px, 1.7vw, 24px);",
      "  font-weight:900;",
      "  letter-spacing:.10em;",
      "  text-transform:uppercase;",
      "  color:rgba(255,245,247,.98);",
      "  overflow-wrap:anywhere;",
      "}",
      "body.route-music .bandsRouteCopy{",
      "  max-width:680px;",
      "  font-size:12px;",
      "  line-height:1.6;",
      "  letter-spacing:.04em;",
      "  color:rgba(240,220,228,.70);",
      "}",
      "body.route-music .bandsRouteTarget{",
      "  position:relative;",
      "  width:118px;",
      "  height:118px;",
      "  flex:0 0 auto;",
      "  border-radius:50%;",
      "  border:1px solid rgba(255,108,148,.18);",
      "  background:radial-gradient(circle at 50% 50%, rgba(255,112,154,.12), rgba(255,112,154,0) 58%);",
      "  overflow:hidden;",
      "}",
      "body.route-music .bandsRouteTarget::before,",
      "body.route-music .bandsRouteTarget::after{",
      "  content:'';",
      "  position:absolute;",
      "  inset:50%;",
      "  transform:translate(-50%, -50%);",
      "  border-radius:50%;",
      "}",
      "body.route-music .bandsRouteTarget::before{",
      "  width:78px;",
      "  height:78px;",
      "  border:1px solid rgba(255,130,170,.34);",
      "  box-shadow:0 0 16px rgba(255,96,140,.12);",
      "}",
      "body.route-music .bandsRouteTarget::after{",
      "  width:18px;",
      "  height:18px;",
      "  background:radial-gradient(circle, rgba(255,223,231,.98), rgba(255,108,148,.88) 62%, rgba(255,108,148,0) 100%);",
      "  box-shadow:0 0 18px rgba(255,102,146,.36);",
      "}",
      "body.route-music #results{",
      "  width:100%;",
      "  min-width:0;",
      "  min-height:240px;",
      "}",
      "body.route-music .bandsLoading{",
      "  margin:0;",
      "}",
      "body.route-music .bandsEmptyState{",
      "  padding:22px 18px;",
      "  border-radius:18px;",
      "  border:1px solid rgba(255,118,158,.14);",
      "  background:rgba(255,255,255,.025);",
      "  font-size:12px;",
      "  line-height:1.7;",
      "  letter-spacing:.04em;",
      "  color:rgba(240,220,228,.74);",
      "}",
      "body.route-music.inBandDetail .bandsShellTopGrid,",
      "body.route-music.inAlbumPhotos .bandsShellTopGrid,",
      "body.route-music .inBandDetail .bandsShellTopGrid,",
      "body.route-music .inAlbumPhotos .bandsShellTopGrid{",
      "  display:none !important;",
      "}",
      "body.route-music.inBandDetail .bandsLowerShell,",
      "body.route-music.inAlbumPhotos .bandsLowerShell{",
      "  padding-top:10px;",
      "}",
      "@media (max-width: 900px){",
      "  body.route-music .bandsShellTopGrid{",
      "    grid-template-columns:1fr;",
      "  }",
      "  body.route-music .bandsLowerHead{",
      "    align-items:flex-start;",
      "  }",
      "}",
      "@media (max-width: 700px){",
      "  body.route-music #musicInfoStrip{",
      "    max-width:calc(100% - 14px) !important;",
      "    padding:0 8px 8px !important;",
      "    border-radius:18px !important;",
      "  }",
      "  body.route-music #archiveModeToggleMount .archiveModeToggle{",
      "    gap:8px !important;",
      "  }",
      "  body.route-music #archiveModeToggleMount .archiveModeBtn{",
      "    padding:10px 8px !important;",
      "    font-size:10px !important;",
      "    letter-spacing:.10em !important;",
      "  }",
      "  body.route-music .bandsFilterShell,",
      "  body.route-music .bandsSnapshotPanel,",
      "  body.route-music .bandsLowerShell{",
      "    padding:16px 14px;",
      "  }",
      "  body.route-music #status-legend,",
      "  body.route-music .bandsSnapshotStats{",
      "    grid-template-columns:1fr;",
      "  }",
      "  body.route-music .bandsLowerHead{",
      "    flex-direction:column;",
      "  }",
      "  body.route-music .bandsRouteTarget{",
      "    width:92px;",
      "    height:92px;",
      "  }",
      "}",
      "@media (max-width: 520px){",
      "  body.route-music [data-hud-main-text]{",
      "    white-space:normal;",
      "    text-align:center;",
      "    letter-spacing:.18em !important;",
      "  }",
      "  body.route-music #archiveModeToggleMount .archiveModeToggle{",
      "    width:100%;",
      "    gap:6px !important;",
      "    padding:6px !important;",
      "  }",
      "  body.route-music #archiveModeToggleMount .archiveModeBtn{",
      "    font-size:9px !important;",
      "    letter-spacing:.08em !important;",
      "  }",
      "  body.route-music .region-pill,",
      "  body.route-music .letter-pill{",
      "    width:100%;",
      "    justify-content:center;",
      "  }",
      "}",
      "@media (prefers-reduced-motion: reduce){",
      "  body.route-music #archiveModeToggleMount .archiveModeBtn,",
      "  body.route-music .region-pill,",
      "  body.route-music .letter-pill{",
      "    transition:none !important;",
      "  }",
      "}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function setTitleText() {
    var el = document.querySelector("[data-hud-main-text]");
    if (!el) return;
    if (String(el.textContent || "").trim() !== "THE MUSIC NEXUS") {
      el.textContent = "THE MUSIC NEXUS";
    }
  }

  function normalizeModeTabs() {
    var host = document.getElementById("archiveModeToggleMount");
    if (!host) return;
    var toggle = host.querySelector(".archiveModeToggle");
    if (!toggle) return;

    var order = ["bands", "people", "shows"];
    var buttons = Array.prototype.slice.call(toggle.querySelectorAll(".archiveModeBtn[data-mode]"));
    if (!buttons.length) return;

    order.forEach(function (mode) {
      var btn = buttons.find(function (item) {
        return String(item.getAttribute("data-mode") || "").toLowerCase() === mode;
      });
      if (btn) {
        toggle.appendChild(btn);
        btn.style.display = "inline-flex";
        btn.hidden = false;
        btn.removeAttribute("aria-hidden");
        btn.removeAttribute("tabindex");
      }
    });

    buttons.forEach(function (btn) {
      var mode = String(btn.getAttribute("data-mode") || "").toLowerCase();
      if (order.indexOf(mode) === -1) {
        btn.style.display = "none";
        btn.hidden = true;
        btn.setAttribute("aria-hidden", "true");
        btn.setAttribute("tabindex", "-1");
      }
    });
  }

  function buildBandsShell() {
    var root = document.getElementById("bands-root");
    if (!root || root.dataset.v31Shell === "1") return root;

    var overall = root.querySelector("#bands-overall");
    var total = root.querySelector("#bands-total");
    var regionPills = root.querySelector("#region-pills");
    var letterGroups = root.querySelector("#letter-groups");
    var loader = root.querySelector("#bands-loading");
    var results = root.querySelector("#results");
    if (!overall || !total || !regionPills || !letterGroups || !results) return root;

    var shell = document.createElement("div");
    shell.className = "bandsShellV31";

    var topGrid = document.createElement("div");
    topGrid.className = "bandsShellTopGrid";

    var leftPanel = document.createElement("section");
    leftPanel.className = "bandsShellPanel bandsFilterShell";

    var intro = document.createElement("div");
    intro.className = "bandsFilterIntro";
    intro.appendChild(overall);

    var regionBlock = document.createElement("div");
    regionBlock.className = "bandsControlBlock";
    regionBlock.innerHTML = '<div class="bandsBlockLabel">Region Filter</div>';
    regionBlock.appendChild(regionPills);

    var letterBlock = document.createElement("div");
    letterBlock.className = "bandsControlBlock";
    letterBlock.innerHTML = '<div class="bandsBlockLabel">Letter Groupings</div>';
    letterBlock.appendChild(letterGroups);

    var legend = document.createElement("div");
    legend.id = "status-legend";
    legend.innerHTML = [
      '<div class="bandsLegendItem">',
      '  <div class="bandsLegendMeta"><span class="bandsLegendDot is-done" aria-hidden="true"></span><span class="bandsLegendLabel">Done</span></div>',
      '  <div class="bandsLegendCount" id="bands-count-done">0</div>',
      '</div>',
      '<div class="bandsLegendItem">',
      '  <div class="bandsLegendMeta"><span class="bandsLegendDot is-progress" aria-hidden="true"></span><span class="bandsLegendLabel">In Progress</span></div>',
      '  <div class="bandsLegendCount" id="bands-count-progress">0</div>',
      '</div>',
      '<div class="bandsLegendItem">',
      '  <div class="bandsLegendMeta"><span class="bandsLegendDot is-untouched" aria-hidden="true"></span><span class="bandsLegendLabel">Not Touched</span></div>',
      '  <div class="bandsLegendCount" id="bands-count-untouched">0</div>',
      '</div>'
    ].join("");
    legend.appendChild(total);

    leftPanel.appendChild(intro);
    leftPanel.appendChild(regionBlock);
    leftPanel.appendChild(letterBlock);
    leftPanel.appendChild(legend);

    var rightPanel = document.createElement("aside");
    rightPanel.className = "bandsShellPanel bandsSnapshotPanel";
    rightPanel.innerHTML = [
      '<div class="bandsSnapshotEyebrow">Region Snapshot</div>',
      '<div class="bandsSnapshotRegion" id="bands-snapshot-region">Local</div>',
      '<div class="bandsSnapshotCopy" id="bands-snapshot-copy">Choose a letter grouping to load the live archive list.</div>',
      '<div class="bandsSnapshotStats">',
      '  <div class="bandsSnapshotStat"><div class="bandsSnapshotStatLabel">Scope</div><div class="bandsSnapshotStatValue" id="bands-snapshot-scope">0</div></div>',
      '  <div class="bandsSnapshotStat"><div class="bandsSnapshotStatLabel">Done</div><div class="bandsSnapshotStatValue" id="bands-snapshot-done">0</div></div>',
      '  <div class="bandsSnapshotStat"><div class="bandsSnapshotStatLabel">In Progress</div><div class="bandsSnapshotStatValue" id="bands-snapshot-progress">0</div></div>',
      '  <div class="bandsSnapshotStat"><div class="bandsSnapshotStatLabel">Not Touched</div><div class="bandsSnapshotStatValue" id="bands-snapshot-untouched">0</div></div>',
      '</div>'
    ].join("");

    topGrid.appendChild(leftPanel);
    topGrid.appendChild(rightPanel);

    var lowerPanel = document.createElement("section");
    lowerPanel.className = "bandsShellPanel bandsLowerShell";
    lowerPanel.innerHTML = [
      '<div class="bandsLowerHead">',
      '  <div class="bandsLowerCopy">',
      '    <div class="bandsLowerEyebrow">Bands / Current Route</div>',
      '    <div class="bandsRouteTitle" id="bands-route-title">Local / Awaiting Letter Group</div>',
      '    <div class="bandsRouteCopy" id="bands-route-copy">Choose a letter grouping to load the live archive list.</div>',
      '  </div>',
      '  <div class="bandsRouteTarget" aria-hidden="true"></div>',
      '</div>'
    ].join("");

    if (loader) lowerPanel.appendChild(loader);
    lowerPanel.appendChild(results);

    shell.appendChild(topGrid);
    shell.appendChild(lowerPanel);

    while (root.firstChild) {
      root.removeChild(root.firstChild);
    }
    root.appendChild(shell);
    root.dataset.v31Shell = "1";

    return root;
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function getActiveText(root, selector) {
    var el = root.querySelector(selector);
    return el ? String(el.textContent || "").trim() : "";
  }

  function updateBandsSnapshot(root) {
    if (!root || root.dataset.v31Shell !== "1") return;

    var body = document.body;
    var results = root.querySelector("#results");
    var loader = root.querySelector("#bands-loading");
    if (!results) return;

    var region = getActiveText(root, ".region-pill.active") || "Local";
    var letter = getActiveText(root, ".letter-pill.active");
    var cards = Array.prototype.slice.call(results.querySelectorAll(".band-card"));
    var doneCount = cards.filter(function (card) { return card.classList.contains("setsGood"); }).length;
    var progressCount = cards.filter(function (card) { return card.classList.contains("setsPartial"); }).length;
    var untouchedCount = cards.filter(function (card) { return card.classList.contains("setsNone"); }).length;
    var scopeCount = cards.length;
    var routeTitle = region + " / " + (letter || "Awaiting Letter Group");
    var routeCopy = letter
      ? (scopeCount ? (scopeCount + " bands are live in this slice of the archive.") : "No bands are currently listed in this letter grouping.")
      : "Choose a letter grouping to load the live archive list.";

    if (body.classList.contains("inBandDetail")) {
      var bandName = getActiveText(results, ".bandDetailNamePill .name");
      routeTitle = bandName || routeTitle;
      routeCopy = bandName
        ? "Viewing the band detail shell and current albums in archive."
        : "Viewing the active band detail shell.";
    } else if (body.classList.contains("inAlbumPhotos")) {
      var albumTitle = getActiveText(results, ".albumKeywordTitle") || getActiveText(results, ".albumRowTitle");
      routeTitle = albumTitle || routeTitle;
      routeCopy = albumTitle
        ? "Viewing the selected album and photo archive."
        : "Viewing the selected album and photo archive.";
    }

    setText("bands-count-done", String(doneCount));
    setText("bands-count-progress", String(progressCount));
    setText("bands-count-untouched", String(untouchedCount));
    setText("bands-snapshot-region", region);
    setText("bands-snapshot-scope", String(scopeCount));
    setText("bands-snapshot-done", String(doneCount));
    setText("bands-snapshot-progress", String(progressCount));
    setText("bands-snapshot-untouched", String(untouchedCount));
    setText("bands-route-title", routeTitle);
    setText("bands-route-copy", routeCopy);

    var total = document.getElementById("bands-total");
    if (total) {
      total.textContent = letter
        ? (scopeCount + " bands in current scope")
        : "Select a letter grouping to inspect this region.";
    }

    var snapshotCopy = document.getElementById("bands-snapshot-copy");
    if (snapshotCopy) {
      snapshotCopy.textContent = letter
        ? "Tracking the active " + region + " / " + letter + " slice of the archive."
        : "The snapshot locks to the active region and updates when a letter grouping is selected.";
    }

    if (!cards.length && (!loader || !loader.isConnected) && !body.classList.contains("inBandDetail") && !body.classList.contains("inAlbumPhotos")) {
      var empty = results.querySelector(".bandsEmptyState");
      if (!empty) {
        empty = document.createElement("div");
        empty.className = "bandsEmptyState";
        results.appendChild(empty);
      }
      empty.textContent = letter
        ? "No bands are currently listed in " + region + " / " + letter + "."
        : "Choose a letter grouping to load the archive list for " + region + ".";
    } else {
      var oldEmpty = results.querySelector(".bandsEmptyState");
      if (oldEmpty && oldEmpty.parentNode === results) {
        oldEmpty.parentNode.removeChild(oldEmpty);
      }
    }
  }

  function ensureBandsObserver(root) {
    if (!root || root.dataset.v31Observed === "1") return;
    if (bandsRootObserver) {
      try { bandsRootObserver.disconnect(); } catch (_) {}
      bandsRootObserver = null;
    }

    bandsRootObserver = new MutationObserver(function () {
      window.requestAnimationFrame(function () {
        updateBandsSnapshot(root);
      });
    });

    bandsRootObserver.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });

    root.dataset.v31Observed = "1";
  }

  function syncBandsShell() {
    if (!document.body || !document.body.classList.contains("route-music")) return;
    ensureStyles();
    setTitleText();
    normalizeModeTabs();

    var root = buildBandsShell();
    if (!root) return;

    updateBandsSnapshot(root);
    ensureBandsObserver(root);
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(function () {
      scheduled = false;
      syncBandsShell();
    });
  }

  document.addEventListener("DOMContentLoaded", scheduleSync, { once: true });

  var docObserver = new MutationObserver(function () {
    scheduleSync();
  });

  if (document.documentElement) {
    docObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  scheduleSync();
})();
