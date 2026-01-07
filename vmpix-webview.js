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

  if (isMessenger || isFacebook || isInstagram) html.classList.add("webview");
  if (isMessenger) html.classList.add("messenger");
  if (isFacebook) html.classList.add("facebook");
  if (isInstagram) html.classList.add("instagram");

  // Mark touch devices to disable hover-only patterns if you choose later
  if (matchMedia("(hover: none)").matches) html.classList.add("touch");

  // NOTE: You already set --vh via visualViewport in index.html.
  // Keeping this here as a fallback in case any page omits that script.
  function setVh() {
    const vh = window.innerHeight * 0.01;
    html.style.setProperty("--vh", `${vh}px`);
  }
  setVh();
  window.addEventListener("resize", setVh, { passive: true });
  window.addEventListener("orientationchange", setVh, { passive: true });
})();