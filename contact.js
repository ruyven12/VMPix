// contact.js
// Contact section module (stub)
(function () {
  'use strict';

  let _mount = null;

  function render(mountEl) {
    if (!mountEl) return;
    _mount = mountEl;

    // Contact styles (icons, glow, mobile scaling) — injected once
    if (!document.getElementById('contactStyles')) {
      const s = document.createElement('style');
      s.id = 'contactStyles';
      s.textContent = `
        .contactWrap{
          max-width:760px;
          margin:0 auto;
          opacity:.9;
          font-size:16px;
          line-height:1.7;
          letter-spacing:.04em;
        }
        .contactTitle{
          font-size:22px;
          letter-spacing:.06em;
          text-transform:uppercase;
          text-shadow:
            0 0 10px rgba(255,70,110,.25),
            0 0 18px rgba(255,70,110,.15);
        }
        .contactIntro{
          opacity:.75;
          margin-bottom:18px;
        }
        .contactLinks{
          display:flex;
          gap:14px;
          flex-wrap:wrap;
          margin-bottom:18px;
        }
        .contactBtn{
          display:flex;
          align-items:center;
          gap:8px;
          padding:8px 14px;
          border:1px solid rgba(255,70,110,.45);
          border-radius:18px;
          color:#fff;
          text-decoration:none;
          font-size:14px;
          opacity:.9;
          box-shadow:
            0 0 0 1px rgba(255,70,110,.15) inset,
            0 0 14px rgba(255,70,110,.18);
          transition:all .2s ease;
        }
        .contactBtn:hover{
          opacity:1;
          box-shadow:
            0 0 0 1px rgba(255,70,110,.25) inset,
            0 0 20px rgba(255,70,110,.35);
        }
        .contactBtn svg{
          width:16px;
          height:16px;
          fill:currentColor;
        }
        .contactEmail{
          opacity:.8;
          font-size:15px;
        }
        .contactEmail a{
          color:#fff;
          text-decoration:none;
          border-bottom:1px dotted rgba(255,70,110,.45);
        }

        @media (max-width:520px){
          .contactTitle{ font-size:18px; }
          .contactWrap{ font-size:15px; padding:0 6px; }
        }
      `;
      document.head.appendChild(s);
    }

    mountEl.innerHTML = `
      <div class="contactWrap">
        <strong class="contactTitle">Contact</strong><br><br>
        <div class="contactIntro">
          You can find or reach me using the links below.
        </div>

        <div class="contactLinks">
          <a class="contactBtn" href="https://www.facebook.com/VMPix" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24"><path d="M22 12a10 10 0 1 0-11.5 9.9v-7h-2v-3h2V9.5c0-2 1.2-3.1 3-3.1.9 0 1.8.1 1.8.1v2h-1c-1 0-1.3.6-1.3 1.2V12h2.3l-.4 3h-1.9v7A10 10 0 0 0 22 12z"/></svg>
            Facebook
          </a>

          <a class="contactBtn" href="https://www.instagram.com/vmpix1" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5.5A4.5 4.5 0 1 0 16.5 12 4.5 4.5 0 0 0 12 7.5zm0 7.4A2.9 2.9 0 1 1 14.9 12 2.9 2.9 0 0 1 12 14.9zM17.8 6.2a1.1 1.1 0 1 0 1.1 1.1 1.1 1.1 0 0 0-1.1-1.1z"/></svg>
            Instagram
          </a>

          <a class="contactBtn" href="https://x.com/vmpix1" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24"><path d="M18.9 2H22l-6.7 7.7L23 22h-6.7l-5.3-6.5L5.6 22H2.5l7.2-8.2L1 2h6.8l4.8 5.9L18.9 2z"/></svg>
            X
          </a>
        </div>

        <div class="contactEmail">
          Email: <a href="mailto:none@none.com">none@none.com</a>
        </div>
      </div>
    `;
  }
  function onEnter() {}
  function destroy() {
    if (_mount) {
      _mount.innerHTML = '';
      _mount = null;
    }
  }

  window.Contact = { render, onEnter, destroy };
})();
