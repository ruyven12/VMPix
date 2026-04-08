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

      #${CONFIG.mountId} .ae-entity {
        position: absolute;
        left: 50%;
        bottom: 58px;
        transform: translateX(-50%);
        z-index: 3;
        width: auto;
        height: clamp(170px, 28vmin, ${CONFIG.entityHeightPx}px);
        filter:
          drop-shadow(0 0 8px rgba(125, 220, 255, 0.30))
          drop-shadow(0 0 16px rgba(125, 220, 255, 0.18));
        opacity: 0.74;
        animation:
          aeEntityFlicker 5.4s linear infinite,
          aeEntityFloat 4.2s ease-in-out infinite;
        transition: opacity 180ms ease;
      }

      #${CONFIG.mountId}.is-video-active .ae-entity {
        opacity: 0;
      }

      #${CONFIG.mountId} .ae-entity svg {
        display: block;
        width: auto;
        height: 100%;
      }

      #${CONFIG.mountId} .ae-pin {
        position: absolute;
        width: 10px;
        height: 10px;
        margin: -5px 0 0 -5px;
        border-radius: 50%;
        background: rgba(255, 78, 110, 0.92);
        box-shadow:
          0 0 6px rgba(255, 78, 110, 0.84),
          0 0 16px rgba(255, 78, 110, 0.42);
        animation: aePinPulse 2.2s ease-in-out infinite;
      }

      #${CONFIG.mountId} .ae-pin.is-large {
        width: 14px;
        height: 14px;
        margin: -7px 0 0 -7px;
        box-shadow:
          0 0 8px rgba(255, 78, 110, 0.94),
          0 0 20px rgba(255, 78, 110, 0.50);
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

      @keyframes aeEntityFloat {
        0%, 100% { transform: translateX(-50%) translateY(0); }
        50%      { transform: translateX(-50%) translateY(-6px); }
      }

      @keyframes aeEntityFlicker {
        0%, 8%, 12%, 100% { opacity: 0.72; }
        9%                { opacity: 0.58; }
        10%               { opacity: 0.80; }
        11%               { opacity: 0.62; }
        46%               { opacity: 0.76; }
        47%               { opacity: 0.66; }
        48%               { opacity: 0.78; }
      }

      @keyframes aePinPulse {
        0%, 100% { transform: scale(1); opacity: 0.88; }
        50%      { transform: scale(1.22); opacity: 1; }
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
        #${CONFIG.mountId} .ae-ring,
        #${CONFIG.mountId} .ae-entity,
        #${CONFIG.mountId} .ae-pin,
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

        #${CONFIG.mountId} .ae-entity {
          bottom: 46px;
          height: clamp(160px, 31vmin, 250px);
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

  function makeEntitySvg() {
    return `
      <svg viewBox="0 0 220 300" aria-hidden="true">
        <defs>
          <filter id="aeGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.4" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <g fill="none" filter="url(#aeGlow)">
          <path d="M110 36
                   C132 36, 150 54, 150 76
                   C150 93, 140 108, 124 115
                   L138 140
                   C150 162, 155 184, 152 204
                   L148 236
                   C147 248, 154 263, 166 278

                   M110 36
                   C88 36, 70 54, 70 76
                   C70 93, 80 108, 96 115
                   L82 140
                   C70 162, 65 184, 68 204
                   L72 236
                   C73 248, 66 263, 54 278"
                stroke="rgba(135,235,255,0.85)"
                stroke-width="4.8"
                stroke-linecap="round"
                stroke-linejoin="round"/>

          <circle cx="110" cy="72" r="34"
                  stroke="rgba(135,235,255,0.92)"
                  stroke-width="4.8"/>

          <path d="M86 110
                   C90 138, 98 156, 110 168
                   C122 156, 130 138, 134 110"
                stroke="rgba(135,235,255,0.88)"
                stroke-width="4.8"
                stroke-linecap="round"/>

          <path d="M80 144 C56 160, 44 178, 42 204 C40 220, 46 232, 58 236"
                stroke="rgba(135,235,255,0.84)"
                stroke-width="4.8"
                stroke-linecap="round"/>
          <path d="M140 144 C164 160, 176 178, 178 204 C180 220, 174 232, 162 236"
                stroke="rgba(135,235,255,0.84)"
                stroke-width="4.8"
                stroke-linecap="round"/>

          <path d="M98 170 C88 198, 84 220, 88 250"
                stroke="rgba(135,235,255,0.84)"
                stroke-width="4.8"
                stroke-linecap="round"/>
          <path d="M122 170 C132 198, 136 220, 132 250"
                stroke="rgba(135,235,255,0.84)"
                stroke-width="4.8"
                stroke-linecap="round"/>

          <path d="M88 250 C78 256, 74 266, 78 276"
                stroke="rgba(135,235,255,0.84)"
                stroke-width="4.8"
                stroke-linecap="round"/>
          <path d="M132 250 C142 256, 146 266, 142 276"
                stroke="rgba(135,235,255,0.84)"
                stroke-width="4.8"
                stroke-linecap="round"/>
        </g>
      </svg>
    `;
  }

  function buildPinsHtml() {
    const pins = [
      { x: 32, y: 25, large: true, delay: '0s' },
      { x: 72, y: 20, large: false, delay: '.45s' },
      { x: 24, y: 52, large: false, delay: '.9s' },
      { x: 74, y: 52, large: false, delay: '1.4s' },
      { x: 50, y: 46, large: true, delay: '1.8s' },
      { x: 52, y: 84, large: false, delay: '.7s' }
    ];

    return pins.map((p) => {
      const cls = 'ae-pin' + (p.large ? ' is-large' : '');
      return `<span class="${cls}" style="left:${p.x}%; top:${p.y}%; animation-delay:${p.delay};"></span>`;
    }).join('');
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

          <div class="ae-entity">
            ${makeEntitySvg()}
            ${buildPinsHtml()}
          </div>
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
