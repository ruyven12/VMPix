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

  // NOTE: You already set --vh via visualViewport in index.html.
  // Keeping this here as a fallback in case any page omits that script.
  function setVh() {
    const vh = window.innerHeight * 0.01;
    html.style.setProperty("--vh", `${vh}px`);
    // Provide best-effort VisualViewport offsets for in-app browsers.
    const vv = window.visualViewport;
    const top = vv && typeof vv.offsetTop === "number" ? vv.offsetTop : 0;
    const bottom = vv && typeof vv.offsetTop === "number" && vv.height
      ? Math.max(0, (window.innerHeight - (vv.height + vv.offsetTop)))
      : 0;
    html.style.setProperty("--vv-top", `${top}px`);
    html.style.setProperty("--vv-bottom", `${bottom}px`);
  }
  setVh();
  window.addEventListener("resize", setVh, { passive: true });
  window.addEventListener("orientationchange", setVh, { passive: true });
})();