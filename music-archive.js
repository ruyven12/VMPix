// music-archive.js
// Phase 2 clean baseline (DEDUPED)
// - Keeps HUD neon frame visible on Music route
// - Removes HUD main container fill only (Music only) — border stays
// - Allows Music-only frame height + vertical placement control
// - OPTION B: Re-parent #hudMainMount so .neonFrameTextInner can be display:none (glass removed)
// - Displays: THE WORLD OF MUSIC

(function(){
  "use strict";

  let _mount = null;

  // restore state
  let _prevWrapDisplay = null;
  let _prevHudMainBg = null;
    // HUD main container (big translucent box) restore
  let _prevHudMainTransform = null;

  // HUD main sizing restore (Music-only)
  let _prevHudMainMinHeight = null;
  let _prevHudMainHeight = null;
  let _prevHudStubMinHeight = null;
  let _prevHudStubHeight = null;


  // inner glass panel restore
  let _prevGlassDisplay = null;

  // mount re-parenting restore (Option B)
  let _prevMountParent = null;
  let _prevMountNextSibling = null;
  let _prevMountStyle = null;

  // glassOuter restore (in case it has backgrounds/shadows set elsewhere)
  let _prevOuterBg = null;
  let _prevOuterShadow = null;
  let _prevOuterPos = null;

  // spacing (wrap position) restore
  let _prevWrapTransform = null;
  let _prevMenuAlign = null;
  let _prevMenuPaddingTop = null;
  let _prevFrameHeight = null;
  let _prevOrnHeight = null;
  
  // ------------------------------------------------------------
  // ORANGE BOX (info strip) restore — Music route only
  // ------------------------------------------------------------
  let _orangeBoxEl = null;
  let _prevHudMainPadding = null;


  // ---- Music-only tuning ----
  const MUSIC_FRAME_HEIGHT = '110px'; // adjust safely (100px–130px)

  // 👉 VERTICAL POSITION ADJUSTMENT FOR THE NEON FRAME (MUSIC ONLY)
  // Negative values move the frame UP, positive values move it DOWN.
  const MUSIC_FRAME_Y_OFFSET = '0px';

  // 👉 TITLE POSITION INSIDE THE FRAME (MUSIC ONLY)
  // Negative = move title UP, positive = move title DOWN.
  const MUSIC_TITLE_Y_OFFSET = '0px';

  // 👉 OPTIONAL: add breathing room inside the frame (MUSIC ONLY)
  // Use small values like '6px'–'14px'. Set to '0px' for none.
  const MUSIC_TITLE_PADDING_Y = '0px';
  const MUSIC_TITLE_VISUAL_NUDGE = '-64px';
  
    // ------------------------------------------------------------
  // HUDSTUB MAIN (big translucent box) tuning knobs (Music only)
  // Edit these safely later
  // ------------------------------------------------------------

  // Background for the BIG HUD container.
  // Use 'transparent' to remove the fill, or an rgba for translucent glass.
  const HUD_MAIN_BG = 'rgba(0,0,0,0.15)'; // e.g. 'rgba(0,0,0,0.15)'

  // Manual nudges for the BIG HUD container (small values!)
  const HUD_MAIN_X_OFFSET = '0px';
  const HUD_MAIN_Y_OFFSET = '0px';
    // 👉 HEIGHT CONTROL for the BIG translucent HUD region (Music only)
  // Use min-height for safety (won't clip). If you want strict height, set HUD_MAIN_USE_STRICT_HEIGHT = true.
  const HUD_MAIN_MIN_HEIGHT = '450px';         // <- THIS is the main dial (try 420–720px)
  const HUD_MAIN_USE_STRICT_HEIGHT = true;    // true = force exact height (can clip)


  
    // ------------------------------------------------------------
  // ORANGE BOX (info strip) tuning knobs (Music only)
  // Edit these safely later — no other code changes needed.
  // ------------------------------------------------------------
  const ORANGE_BOX_HEIGHT = '56px';        // strip height (try 48–72px)
  // 👉 Manual position nudges (Music only)
  // Use small values like '-20px' to '20px' while dialing in.
  const ORANGE_BOX_X_OFFSET = '0px';   // left/right
  const ORANGE_BOX_Y_OFFSET = '0px';   // up/down
  const ORANGE_BOX_MARGIN_TOP = '5px';    // space below neon title frame
  const ORANGE_BOX_MAX_WIDTH = '96%';      // keep inside the big HUD container

  // Border styling to match the outside vibe (thin neon red)
  const ORANGE_BOX_BORDER = '1px solid rgba(255, 70, 110, 0.55)';
  const ORANGE_BOX_RADIUS = '10px';
  const ORANGE_BOX_BG = 'rgba(0,0,0,0.12)';  // very subtle fill (set to 'transparent' if you want none)
  const ORANGE_BOX_GLOW = '0 0 0 1px rgba(255,70,110,0.12) inset, 0 0 18px rgba(255,70,110,0.10)';


  // Ensure neon frame is visible on Music route
  function ensureFrameVisibleForMusic(){
    const wrap = document.querySelector('.neonFrameWrap');
    if (!wrap) return;

    if (_prevWrapDisplay === null) {
      _prevWrapDisplay = wrap.style.display || "";
    }
    wrap.style.display = 'block'; // override route-music CSS

    // Music-only positioning
    if (_prevWrapTransform === null) {
      _prevWrapTransform = wrap.style.transform || "";
    }
    wrap.style.transform = `translateY(${MUSIC_FRAME_Y_OFFSET})`;

    // If the parent is centering, force top alignment for Music
    const menuHero = document.querySelector('.menuHero');
    if (menuHero){
      if (_prevMenuAlign === null) _prevMenuAlign = menuHero.style.alignItems || "";
      if (_prevMenuPaddingTop === null) _prevMenuPaddingTop = menuHero.style.paddingTop || "";
      menuHero.style.alignItems = 'flex-start';
      menuHero.style.paddingTop = '0px';
    }
  }

  function restoreFrameVisibility(){
    const wrap = document.querySelector('.neonFrameWrap');
    if (wrap){
      wrap.style.display = _prevWrapDisplay || "";
      wrap.style.transform = _prevWrapTransform || "";
    }
    _prevWrapDisplay = null;
    _prevWrapTransform = null;

    const menuHero = document.querySelector('.menuHero');
    if (menuHero){
      menuHero.style.alignItems = _prevMenuAlign || "";
      menuHero.style.paddingTop = _prevMenuPaddingTop || "";
    }
    _prevMenuAlign = null;
    _prevMenuPaddingTop = null;
  }

  // Apply Music-only frame height
  function applyMusicFrameHeight(){
    const frame = document.querySelector('.neonFrame');
    const orn   = document.querySelector('.hudOrn');

    if (frame){
      _prevFrameHeight = frame.style.height || "";
      frame.style.height = MUSIC_FRAME_HEIGHT;
    }
    if (orn){
      _prevOrnHeight = orn.style.height || "";
      orn.style.height = MUSIC_FRAME_HEIGHT;
    }
  }

  function restoreFrameHeight(){
    const frame = document.querySelector('.neonFrame');
    const orn   = document.querySelector('.hudOrn');

    if (frame) frame.style.height = _prevFrameHeight || "";
    if (orn)   orn.style.height   = _prevOrnHeight || "";

    _prevFrameHeight = null;
    _prevOrnHeight = null;
  }

  function render(mountEl){
    if (!mountEl) return;
    _mount = mountEl;

    // Music-only: HUD main container (big translucent box) controls
const hudMainBox = document.querySelector('.hudStub.hudMain');
const hudStubBox = hudMainBox ? hudMainBox.closest('.hudStub') : document.querySelector('.hudStub');

if (hudMainBox){
  // store for restore (only once per route entry)
  if (_prevHudMainBg === null) _prevHudMainBg = hudMainBox.style.background || "";
  if (_prevHudMainTransform === null) _prevHudMainTransform = hudMainBox.style.transform || "";
  if (_prevHudMainMinHeight === null) _prevHudMainMinHeight = hudMainBox.style.minHeight || "";
  if (_prevHudMainHeight === null) _prevHudMainHeight = hudMainBox.style.height || "";

  // background control (translucent fill)
  hudMainBox.style.background = HUD_MAIN_BG;

  // position nudge control (small!)
  hudMainBox.style.transform = `translate(${HUD_MAIN_X_OFFSET}, ${HUD_MAIN_Y_OFFSET})`;

  // ✅ height control (this is your GREEN BOX dial)
  hudMainBox.style.minHeight = HUD_MAIN_MIN_HEIGHT;
  hudMainBox.style.height = HUD_MAIN_USE_STRICT_HEIGHT ? HUD_MAIN_MIN_HEIGHT : "";
}

if (hudStubBox){
  // Some themes size the translucent region on the outer .hudStub instead.
  if (_prevHudStubMinHeight === null) _prevHudStubMinHeight = hudStubBox.style.minHeight || "";
  if (_prevHudStubHeight === null) _prevHudStubHeight = hudStubBox.style.height || "";

  hudStubBox.style.minHeight = HUD_MAIN_MIN_HEIGHT;
  hudStubBox.style.height = HUD_MAIN_USE_STRICT_HEIGHT ? HUD_MAIN_MIN_HEIGHT : "";
}



    ensureFrameVisibleForMusic();
    applyMusicFrameHeight();

    // ------------------------------------------------------------
    // OPTION B (TEST / NOW DEFAULT):
    // Hide the entire .neonFrameTextInner box (glass layer),
    // BUT first move #hudMainMount out of it so our text still shows.
    //
    // EDIT THIS "BOX" BEHAVIOR HERE:
    // - Want the glass back? Comment out `glassInner.style.display = 'none';`
    // - Want title nudged? Adjust MUSIC_TITLE_Y_OFFSET above.
    // - Want extra padding? Adjust MUSIC_TITLE_PADDING_Y above.
    // ------------------------------------------------------------
    const glassInner = document.querySelector('.neonFrameTextInner');
    const glassOuter = document.querySelector('.neonFrameText');

    if (glassInner && glassOuter) {

      // store + sanitize outer (some themes add a window bg/shadow here)
if (_prevOuterBg === null) _prevOuterBg = glassOuter.style.background || "";
if (_prevOuterShadow === null) _prevOuterShadow = glassOuter.style.boxShadow || "";
if (_prevOuterPos === null) _prevOuterPos = glassOuter.style.position || "";

glassOuter.style.background = 'transparent';
glassOuter.style.boxShadow = 'none';
if (!glassOuter.style.position) glassOuter.style.position = 'relative';

// ✅ CENTER LOCK FOR OPTION B
// Make the OUTER box a true full-height flex-center container
glassOuter.style.display = 'flex';
glassOuter.style.alignItems = 'center';
glassOuter.style.justifyContent = 'center';
glassOuter.style.height = '100%';
glassOuter.style.padding = '0';
glassOuter.style.margin = '0';


      // store mount original position for restore (only once)
      if (_prevMountParent === null) {
        _prevMountParent = mountEl.parentNode;
        _prevMountNextSibling = mountEl.nextSibling;
        _prevMountStyle = mountEl.getAttribute('style') || "";
      }

      // move mount to the outer layer (so we can hide the inner)
      glassOuter.appendChild(mountEl);

      // make mount fill the frame and center its contents
      mountEl.style.display = 'flex';
      mountEl.style.alignItems = 'center';
      mountEl.style.justifyContent = 'center';
      mountEl.style.width = '100%';
      mountEl.style.height = '100%';
      mountEl.style.position = 'relative';
      mountEl.style.zIndex = '2';
      mountEl.style.paddingTop = MUSIC_TITLE_PADDING_Y;
      mountEl.style.paddingBottom = MUSIC_TITLE_PADDING_Y;

      // now safe to truly remove the inner glass container
      if (_prevGlassDisplay === null) _prevGlassDisplay = glassInner.style.display || "";
      glassInner.style.display = 'none';
    }

    // Simple title only (baseline)
    _mount.innerHTML =
  `<span data-hud-main-text
     style="font-size:20px; line-height:1; letter-spacing:.14em; text-transform:uppercase;
            display:inline-block; transform:translateY(${MUSIC_TITLE_VISUAL_NUDGE});">
     The World of Music
   </span>`;
   
       // ------------------------------------------------------------
    // ORANGE BOX (info strip) — CREATE AREA ONLY (no content yet)
    //
    // WHERE TO EDIT STYLE LATER:
    // - Change the constants near the top: ORANGE_BOX_*
    // - This block only wires it into the DOM (safe/reversible)
    // ------------------------------------------------------------
    const hudMain = document.querySelector('.hudStub.hudMain');
    if (hudMain && !_orangeBoxEl) {

      // Save existing padding so we can restore on destroy
      if (_prevHudMainPadding === null) {
        _prevHudMainPadding = hudMain.style.padding || "";
      }

      // Ensure there's room for the strip beneath the neon title frame.
      // NOTE: This only affects the Music route and is restored on destroy.
      // If you already have padding you want to keep, tell me and we’ll preserve it.
      hudMain.style.padding = '0 18px 18px';

      _orangeBoxEl = document.createElement('div');
      _orangeBoxEl.id = 'musicInfoStrip'; // orange box

      // Base geometry
      _orangeBoxEl.style.height = ORANGE_BOX_HEIGHT;
      _orangeBoxEl.style.maxWidth = ORANGE_BOX_MAX_WIDTH;
      _orangeBoxEl.style.margin = `${ORANGE_BOX_MARGIN_TOP} auto 0`;
	  _orangeBoxEl.style.transform = `translate(${ORANGE_BOX_X_OFFSET}, ${ORANGE_BOX_Y_OFFSET})`; // <- YOUR DIALS
      _orangeBoxEl.style.width = '100%';

      // Border / look (matches outside vibe)
      _orangeBoxEl.style.border = ORANGE_BOX_BORDER;
      _orangeBoxEl.style.borderRadius = ORANGE_BOX_RADIUS;
      _orangeBoxEl.style.background = ORANGE_BOX_BG;
      _orangeBoxEl.style.boxShadow = ORANGE_BOX_GLOW;

      // Keep it visually clean for now (no text/content yet)
      _orangeBoxEl.style.pointerEvents = 'none';

      hudMain.appendChild(_orangeBoxEl);
    }



  }

  function onEnter(){
    // no-op for now
  }

  function destroy(){
    // restore HUD main box (background + transform + sizing)
const hudMainBox = document.querySelector('.hudStub.hudMain');
const hudStubBox = hudMainBox ? hudMainBox.closest('.hudStub') : document.querySelector('.hudStub');

if (hudMainBox){
  hudMainBox.style.background = _prevHudMainBg || "";
  hudMainBox.style.transform = _prevHudMainTransform || "";
  hudMainBox.style.minHeight = _prevHudMainMinHeight || "";
  hudMainBox.style.height = _prevHudMainHeight || "";
}
if (hudStubBox){
  hudStubBox.style.minHeight = _prevHudStubMinHeight || "";
  hudStubBox.style.height = _prevHudStubHeight || "";
}

_prevHudMainBg = null;
_prevHudMainTransform = null;
_prevHudMainMinHeight = null;
_prevHudMainHeight = null;
_prevHudStubMinHeight = null;
_prevHudStubHeight = null;



    restoreFrameHeight();

    // restore glass + mount position (Option B)
    const glassInner = document.querySelector('.neonFrameTextInner');
    const glassOuter = document.querySelector('.neonFrameText');

    // unhide inner
    if (glassInner){
      glassInner.style.display = _prevGlassDisplay || "";
    }
    _prevGlassDisplay = null;

    // restore outer styles
    if (glassOuter){
      glassOuter.style.background = _prevOuterBg || "";
      glassOuter.style.boxShadow = _prevOuterShadow || "";
      glassOuter.style.position = _prevOuterPos || "";
    }
    _prevOuterBg = null;
    _prevOuterShadow = null;
    _prevOuterPos = null;

    // move mount back where it originally lived
    if (_mount && _prevMountParent) {
      // restore style attribute exactly (removes our flex/transform/padding, etc.)
      _mount.setAttribute('style', _prevMountStyle || "");

      // reinsert back at original spot
      if (_prevMountNextSibling && _prevMountNextSibling.parentNode === _prevMountParent) {
        _prevMountParent.insertBefore(_mount, _prevMountNextSibling);
      } else {
        _prevMountParent.appendChild(_mount);
      }
    }

    _prevMountParent = null;
    _prevMountNextSibling = null;
    _prevMountStyle = null;
	
	    // ------------------------------------------------------------
    // ORANGE BOX cleanup (Music only)
    // ------------------------------------------------------------
    if (_orangeBoxEl && _orangeBoxEl.parentNode) {
      _orangeBoxEl.parentNode.removeChild(_orangeBoxEl);
    }
    _orangeBoxEl = null;

    const hudMain = document.querySelector('.hudStub.hudMain');
    if (hudMain) {
      hudMain.style.padding = _prevHudMainPadding || "";
    }
    _prevHudMainPadding = null;

    restoreFrameVisibility();

    if (_mount){
      _mount.innerHTML = "";
      _mount = null;
    }
  }

  window.MusicArchive = { render, onEnter, destroy };
})();
