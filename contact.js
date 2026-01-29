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
          text-transform:none;
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
          margin-bottom:16px;
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
          user-select:none;
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
          fill:none;
          stroke:currentColor;
          stroke-width:1.8;
          stroke-linecap:round;
          stroke-linejoin:round;
        }
        .contactBtn.is-ghost{
          opacity:.82;
          border-color: rgba(255,70,110,.28);
          box-shadow: 0 0 0 1px rgba(255,70,110,.10) inset;
        }
        .contactBtn.is-ghost:hover{
          opacity:.95;
          box-shadow:
            0 0 0 1px rgba(255,70,110,.18) inset,
            0 0 16px rgba(255,70,110,.22);
        }

        .contactEmail{
          opacity:.8;
          font-size:15px;
          margin-top:6px;
        }
        .contactEmail a{
          color:#fff;
          text-decoration:none;
          border-bottom:1px dotted rgba(255,70,110,.45);
        }

        .contactToast{
          margin-top:10px;
          opacity:0;
          transform:translateY(-4px);
          transition:opacity 160ms ease, transform 160ms ease;
          font-size:13px;
          letter-spacing:.04em;
        }
        .contactToast.is-on{
          opacity:.78;
          transform:translateY(0);
        }

        @media (max-width:520px){
          .contactTitle{ font-size:18px; }
          .contactWrap{ font-size:15px; padding:0 6px; }
          .contactEmail{ font-size:14px; }
        }
      `;
      document.head.appendChild(s);
    }

    // Re-wire actions each render (we rebuild DOM)
    delete mountEl.dataset.contactWired;

    mountEl.innerHTML = `
      <div class="contactWrap">
        <strong class="contactTitle">Contact</strong><br><br>
        <div class="contactIntro">
          You can find or reach me using the links below.
        </div>

        <div class="contactLinks">
          <a class="contactBtn" href="https://www.facebook.com/VMPix" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 21a9 9 0 1 0-9-9 9 9 0 0 0 9 9z"/>
              <path d="M13 9h2V7h-2c-1.1 0-2 .9-2 2v2H9v2h2v4h2v-4h2l.4-2H13V9z"/>
            </svg>
            Facebook
          </a>

          <a class="contactBtn" href="https://www.instagram.com/vmpix1" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="3"/>
              <path d="M12 16a4 4 0 1 0-4-4 4 4 0 0 0 4 4z"/>
              <path d="M16.5 7.8h.01"/>
            </svg>
            Instagram
          </a>

          <a class="contactBtn" href="https://x.com/vmpix1" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 7l10 10"/>
              <path d="M17 7L7 17"/>
            </svg>
            X
          </a>

          <a class="contactBtn" href="mailto:none@none.com" data-action="email">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="6" width="16" height="12" rx="2"/>
              <path d="M4 8l8 6 8-6"/>
            </svg>
            Gmail
          </a>

          <a class="contactBtn is-ghost" href="#/contact-form" data-action="form">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 7h10"/>
              <path d="M8 11h10"/>
              <path d="M8 15h6"/>
              <path d="M7 20h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3z"/>
            </svg>
            Contact Form (Soon)
          </a>
        </div>

        <div class="contactEmail">
          Email: <a href="mailto:none@none.com" data-action="email-link">none@none.com</a>
          &nbsp;·&nbsp;
          <a class="contactBtn is-ghost" style="display:inline-flex; padding:6px 10px; border-radius:14px; font-size:13px;" href="#copy" data-action="copy-email">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="9" y="9" width="11" height="11" rx="2"/>
              <rect x="4" y="4" width="11" height="11" rx="2"/>
            </svg>
            Copy
          </a>
          <div class="contactToast" id="contactToast">Copied to clipboard</div>
        </div>
      </div>
    `;

    // Actions: copy email + form coming soon
    if (!mountEl.dataset.contactWired) {
      mountEl.dataset.contactWired = '1';

      const email = 'none@none.com';
      const toast = mountEl.querySelector('#contactToast');

      const showToast = (msg) => {
        if (!toast) return;
        if (msg) toast.textContent = msg;
        toast.classList.remove('is-on');
        void toast.offsetWidth;
        toast.classList.add('is-on');
        window.clearTimeout(showToast._t);
        showToast._t = window.setTimeout(() => toast.classList.remove('is-on'), 1200);
      };

      const copyEmail = async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(email);
          } else {
            const ta = document.createElement('textarea');
            ta.value = email;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }
          showToast('Copied to clipboard');
        } catch {
          showToast('Copy failed');
        }
      };

      const copyBtn = mountEl.querySelector('[data-action="copy-email"]');
      if (copyBtn) {
        copyBtn.addEventListener('click', (e) => {
          e.preventDefault();
          copyEmail();
        }, { passive: false });
      }

      const formBtn = mountEl.querySelector('[data-action="form"]');
      if (formBtn) {
        formBtn.addEventListener('click', (e) => {
          e.preventDefault();
          showToast('Contact form coming soon');
        }, { passive: false });
      }
    }
  }
  function onEnter() {}
  function onEnter() {}() {}
  function destroy() {
    if (_mount) {
      _mount.innerHTML = '';
      _mount = null;
    }
  }

  window.Contact = { render, onEnter, destroy };
})();
