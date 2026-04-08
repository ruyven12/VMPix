// archive-entity-layer.js
// VMPix Archive System — safe starter layer
// Purpose:
// - Adds a non-breaking visual "archive intelligence" layer to the mockup only
// - Creates a projection ring + entity silhouette placeholder using CSS only
// - Designed to be replaced later with AE-exported assets (WebM/MP4) without changing page logic
//
// Usage (mockup page only):
//   1) Add this file to /archive-system/archive-entity-layer.js
//   2) Add <script src="archive-system/archive-entity-layer.js"></script> before </body>
//   3) Add <div id="archiveEntityLayer"></div> inside the mockup screen/container
//
// Notes:
// - This file is intentionally defensive: if the container is missing, it exits quietly.
// - It does NOT modify your music/wrestling logic.
// - It is safe to remove later.

(function () {
  'use strict';

  const ENABLE_ENTITY = true;
  if (!ENABLE_ENTITY) return;

  const CONFIG = {
    mountId: 'archiveEntityLayer',
    opacity: 0.82,
    bottomOffsetPx: 32,
    ringSizePx: 360,
    entityHeightPx: 250,
    entityVideoWidthPx: 750,
    entityVideoBottomPx: -30,
    entityVideoOpacity: 0.78,
    entityVideoScale: 1.16,
    ringVideoSrc: '',
    entityVideoSrc: 'archive-system/entity/entity-core.webm',
    debugOutline: false,
  };

  let rootEl = null;

  function injectStyles() {
    if (document.getElementById('archiveEntityLayerStyles')) return;

    const style = document.createElement('style');
    style.id = 'archiveEntityLayerStyles';
    style.textContent = `
      #${CONFIG.mountId} {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 0;
        overflow: hidden;
      }

      #${CONFIG.mountId}.is-debug {
        outline: 1px dashed rgba(0, 255, 255, 0.22);
        outline-offset: -1px;
      }

      #${CONFIG.mountId} .ae-root {
        position: absolute;
        inset: 0;
        pointer-events: none;
        opacity: ${CONFIG.opacity};
      }

      #${CONFIG.mountId} .ae-core {
        position: absolute;
        left: 50%;
        bottom: ${CONFIG.bottomOffsetPx}px;
        transform: translateX(-50%);
        width: clamp(300px, 42vmin, ${CONFIG.ringSizePx}px);
        aspect-ratio: 1 / 1;
        display: grid;
        place-items: center;
        pointer-events: none;
      }

      #${CONFIG.mountId} .ae-entity-video-wrap {
        position: absolute;
        left: 50%;
        bottom: ${CONFIG.entityVideoBottomPx}px;
        transform: translateX(-50%) scale(${CONFIG.entityVideoScale});
        width: min(${CONFIG.entityVideoWidthPx}px, 128vmin);
        display: grid;
        place-items: center;
        pointer-events: none;
        z-index: 1;
      }

      #${CONFIG.mountId} .ae-entity-video {
        display: block;
        width: 100%;
        height: auto;
        object-fit: contain;
        opacity: ${CONFIG.entityVideoOpacity};
        pointer-events: none;
        mix-blend-mode: screen;
        filter:
          drop-shadow(0 0 12px rgba(115, 235, 255, 0.28))
          drop-shadow(0 0 36px rgba(115, 235, 255, 0.16));
      }

      #${CONFIG.mountId} .ae-light-column {
        position: absolute;
        left: 50%;
        bottom: 88px;
        transform: translateX(-50%);
        width: min(240px, 44vw);
        height: min(420px, 48vh);
        background:
          linear-gradient(
            to top,
            rgba(125, 220, 255, 0.16) 0%,
            rgba(125, 220, 255, 0.10) 18%,
            rgba(125, 220, 255, 0.04) 54%,
            rgba(125, 220, 255, 0.00) 100%
          );
        filter: blur(14px);
        clip-path: polygon(30% 100%, 70% 100%, 58% 0%, 42% 0%);
        animation: aeColumnBreath 4.8s ease-in-out infinite;
      }

      #${CONFIG.mountId} .ae-ring {
        position: absolute;
        inset: auto 0 0 0;
        margin: auto;
        width: 100%;
        z-index: 2;
        aspect-ratio: 1 / 1;
        border-radius: 50%;
        transform: perspective(900px) rotateX(72deg);
        border: 2px solid rgba(115, 235, 255, 0.42);
        box-shadow:
          0 0 12px rgba(115, 235, 255, 0.30),
          0 0 32px rgba(115, 235, 255, 0.16),
          inset 0 0 16px rgba(115, 235, 255, 0.10);
        background:
          radial-gradient(circle at center, rgba(125, 220, 255, 0.08), rgba(125, 220, 255, 0.00) 58%),
          repeating-radial-gradient(
            circle at center,
            rgba(115, 235, 255, 0.14) 0 2px,
            rgba(115, 235, 255, 0.00) 2px 18px
          );
        animation:
          aeRingPulse 3.8s ease-in-out infinite,
          aeRingRotate 18s linear infinite;
      }

      #${CONFIG.mountId} .ae-ring::after {
        content: "";
        position: absolute;
        inset: 10% 10%;
        border-radius: 50%;
        border: 1px solid rgba(255, 90, 120, 0.20);
        box-shadow: 0 0 18px rgba(255, 90, 120, 0.16);
      }

      #${CONFIG.mountId} .ae-scanline {
        position: absolute;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, transparent, rgba(115, 235, 255, 0.65), transparent);
        opacity: 0;
        filter: blur(0.2px);
        animation: aeScanDrop 6.4s ease-in-out infinite;
      }

      @keyframes aeRingPulse {
        0%, 100% { opacity: 0.78; transform: perspective(900px) rotateX(72deg) scale(1); }
        50%      { opacity: 1;    transform: perspective(900px) rotateX(72deg) scale(1.035); }
      }

      @keyframes aeRingRotate {
        from { rotate: 0deg; }
        to   { rotate: 360deg; }
      }

      @keyframes aeColumnBreath {
        0%, 100% { opacity: 0.55; transform: translateX(-50%) scaleY(1); }
        50%      { opacity: 0.78; transform: translateX(-50%) scaleY(1.04); }
      }

      @keyframes aeScanDrop {
        0%   { top: 10%; opacity: 0; }
        8%   { opacity: 0.4; }
        18%  { opacity: 0.14; }
        28%  { top: 78%; opacity: 0; }
        100% { top: 78%; opacity: 0; }
      }

      @media (prefers-reduced-motion: reduce) {
        #${CONFIG.mountId} .ae-scanline,
        #${CONFIG.mountId} .ae-light-column {
          animation: none !important;
        }
      }

      @media (max-width: 768px) {
        #${CONFIG.mountId} .ae-core {
          bottom: 14px;
          width: clamp(280px, 78vmin, 460px);
        }

        #${CONFIG.mountId} .ae-entity-video-wrap {
          bottom: -18px;
          width: min(900px, 185vw);
          transform: translateX(-50%) scale(1.34);
        }

        #${CONFIG.mountId} .ae-light-column {
          bottom: 70px;
          width: min(280px, 64vmin);
          height: min(420px, 44vh);
        }
      }
    `;
    document.head.appendChild(style);
  }

  function buildMarkup() {
    const entityVideoHtml = CONFIG.entityVideoSrc
      ? `
          <div class="ae-entity-video-wrap">
            <video
              class="ae-entity-video"
              src="${CONFIG.entityVideoSrc}"
              autoplay
              loop
              muted
              playsinline
              preload="auto"
              aria-hidden="true"
            ></video>
          </div>
        `
      : '';

    return `
      <div class="ae-root" aria-hidden="true">
        <div class="ae-light-column"></div>

        <div class="ae-core">
          ${entityVideoHtml}
        </div>

        <div class="ae-scanline" style="animation-delay: 0s;"></div>
        <div class="ae-scanline" style="animation-delay: 2.4s;"></div>
      </div>
    `;
  }

  function renderFallback() {
    if (!rootEl) return;
    rootEl.innerHTML = buildMarkup();
  }

  function renderVideoVersion() {
    renderFallback();

    if (!rootEl || !CONFIG.entityVideoSrc) return;

    const video = rootEl.querySelector('.ae-entity-video');
    if (!video) return;

    const hideVideo = () => {
      rootEl.classList.remove('is-video-active');
      video.style.display = 'none';
    };

    const showVideoMode = () => {
      rootEl.classList.add('is-video-active');
      video.style.display = '';
    };

    video.addEventListener('error', hideVideo, { once: true });
    video.addEventListener('loadeddata', showVideoMode, { once: true });
    video.addEventListener('playing', showVideoMode, { once: true });

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(hideVideo);
    }
  }

  function init() {
    injectStyles();

    const mount = document.getElementById(CONFIG.mountId);
    if (!mount) return;

    rootEl = mount;
    if (CONFIG.debugOutline) rootEl.classList.add('is-debug');

    if (CONFIG.ringVideoSrc || CONFIG.entityVideoSrc) {
      renderVideoVersion();
    } else {
      renderFallback();
    }
  }

  function destroy() {
    if (rootEl) rootEl.innerHTML = '';
    rootEl = null;
  }

  window.ArchiveEntityLayer = {
    init,
    destroy,
    CONFIG,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
