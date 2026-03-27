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
  const DISMISS_KEY = "vm_webview_banner_dismissed_v1";

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

  function installWebviewBanner() {
    if (!(isMessenger || isFacebook || isInstagram || isTwitterX)) return;
    try {
      if (window.localStorage && window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch (_) {}
    if (document.getElementById("vmWebviewBanner")) return;

    const style = document.createElement("style");
    style.id = "vmWebviewBannerStyle";
    style.textContent = `
      .vmWebviewBanner{
        position: fixed;
        top: max(10px, calc(var(--vv-top, 0px) + 10px));
        left: 50%;
        transform: translateX(-50%);
        width: min(640px, calc(100vw - 24px));
        z-index: 20000;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 14px;
        border-radius: 16px;
        border: 1px solid rgba(255,95,135,0.34);
        background: linear-gradient(180deg, rgba(28,10,19,0.96), rgba(14,8,15,0.94));
        box-shadow: 0 18px 36px rgba(0,0,0,0.34), 0 0 0 1px rgba(255,255,255,0.03) inset;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        color: rgba(245,236,242,0.94);
        font-family: "Orbitron", system-ui, sans-serif;
      }
      .vmWebviewBannerText{
        min-width: 0;
        font-size: 11px;
        font-weight: 800;
        line-height: 1.35;
        letter-spacing: .04em;
        text-transform: none;
      }
      .vmWebviewBannerClose{
        flex: 0 0 auto;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.06);
        color: rgba(245,236,242,0.92);
        border-radius: 999px;
        padding: 7px 10px;
        font-family: "Orbitron", system-ui, sans-serif;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: .08em;
        cursor: pointer;
      }
      .vmWebviewBannerClose:hover{
        background: rgba(255,255,255,0.10);
      }
      @media (max-width: 560px){
        .vmWebviewBanner{
          align-items: flex-start;
          padding: 10px 12px;
          gap: 10px;
        }
        .vmWebviewBannerText{
          font-size: 10px;
        }
        .vmWebviewBannerClose{
          padding: 6px 9px;
          font-size: 9px;
        }
      }
    `;
    document.head.appendChild(style);

    const banner = document.createElement("div");
    banner.id = "vmWebviewBanner";
    banner.className = "vmWebviewBanner";
    banner.innerHTML = `
      <div class="vmWebviewBannerText" style="font-size:18px">System detected.</div>
      <button type="button" class="vmWebviewBannerClose" aria-label="Dismiss notice">Close</button>
    `;
    document.body.appendChild(banner);

    const closeBtn = banner.querySelector(".vmWebviewBannerClose");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        try {
          if (window.localStorage) window.localStorage.setItem(DISMISS_KEY, "1");
        } catch (_) {}
        try { banner.remove(); } catch (_) {}
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installWebviewBanner, { once: true });
  } else {
    installWebviewBanner();
  }
})();
