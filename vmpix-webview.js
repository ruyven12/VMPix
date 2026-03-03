/* vmpix-webview.js
   Detects in-app browsers (Messenger/Facebook/Instagram) and adds classes to <html>:
   - webview
   - messenger (if Messenger)
   - facebook (if FB app)
   - instagram (if IG app)

   Also adds a CSS variable with the real viewport height for safer layouts:
   --vh = window.innerHeight * 0.01
*/
(function () {
  const ua = navigator.userAgent || "";
  const html = document.documentElement;

  const isMessenger = /\bFBAN\/Messenger\b|\bMessenger\b/i.test(ua);
  const isFacebook = /\bFBAN\/FB4A\b|\bFBAV\/\d+/i.test(ua) && !isMessenger;
  const isInstagram = /\bInstagram\b/i.test(ua);
  // Twitter/X in-app browser UAs commonly include "Twitter" / "TwitterAndroid" / "Twitter for iPhone"
  const isTwitterX = /\bTwitter\b|\bTwitterAndroid\b|\bTwitter for iPhone\b/i.test(ua);

  if (isMessenger || isFacebook || isInstagram || isTwitterX) html.classList.add("webview");
  if (isMessenger) html.classList.add("messenger");
  if (isFacebook) html.classList.add("facebook");
  if (isInstagram) html.classList.add("instagram");
  if (isTwitterX) { html.classList.add("twitter"); html.classList.add("x"); }

  // Mark touch devices to disable hover-only patterns if you choose later
  if (matchMedia("(hover: none)").matches) html.classList.add("touch");

  // Viewport sizing helpers for in-app browsers:
// --vh: 1% of the *visible* viewport height (uses VisualViewport when available)
// --vv-top/--vv-bottom: VisualViewport offsets (helps avoid top/bottom UI overlap)
  function setViewportVars() {
    const vv = window.visualViewport;
    const h = (vv && vv.height) ? vv.height : window.innerHeight;
    const top = (vv && typeof vv.offsetTop === "number") ? vv.offsetTop : 0;
    const bottom = (vv && typeof vv.offsetTop === "number" && vv.height)
      ? Math.max(0, (window.innerHeight - (vv.height + vv.offsetTop)))
      : 0;

    html.style.setProperty("--vh", `${(h * 0.01)}px`);
    html.style.setProperty("--vv-top", `${top}px`);
    html.style.setProperty("--vv-bottom", `${bottom}px`);
  }

  setViewportVars();

  // Debounce via rAF to avoid thrash on mobile UI changes
  let raf = 0;
  function onResize() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(setViewportVars);
  }

  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("orientationchange", onResize, { passive: true });
  window.addEventListener("pageshow", onResize, { passive: true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", onResize, { passive: true });
    window.visualViewport.addEventListener("scroll", onResize, { passive: true });
  }
})();