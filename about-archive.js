// about-archive.js
// Placeholder About module for the HUD.
// Currently mirrors your existing "typed text" behavior so nothing changes visually.

(function(){
  "use strict";

  const COPY = `About The Site

This site is a nearly-100% automated website using coding that reads from the native SmugMug system and creates it in a better customizable UI. This website was also created in assistance with ChatGPT. It is also an ever-evolving website and will need work like anything else. If it breaks, let me know.`;

  function render(mountEl){
    if (!mountEl) return;

    // About styles (mobile scaling + subtle glow) — injected once
    if (!document.getElementById('aboutArchiveStyles')) {
      const s = document.createElement('style');
      s.id = 'aboutArchiveStyles';
      s.textContent = `
        .aboutArchiveWrap{
          max-width:760px;
          margin:0 auto;
          opacity:.9;
          font-size:16px;
          line-height:1.7;
          letter-spacing:.04em;
          text-transform:none;
        }
        .aboutArchiveTitle{
          font-size:22px;
          letter-spacing:.06em;
          text-transform:uppercase;
          text-shadow:
            0 0 10px rgba(255,70,110,0.22),
            0 0 18px rgba(255,70,110,0.14);
        }
        .aboutArchiveBody{
          font-size:16px;
          opacity:.78;
          white-space:pre-wrap;
          text-transform:none;
          text-shadow: 0 0 10px rgba(255,70,110,0.08);
        }

        /* Mobile scaling */
        @media (max-width: 520px){
          .aboutArchiveWrap{
            font-size:15px;
            line-height:1.65;
            padding:0 6px;
          }
          .aboutArchiveTitle{
            font-size:18px;
            letter-spacing:.05em;
          }
          .aboutArchiveBody{
            font-size:15px;
          }
        }
      `;
      document.head.appendChild(s);
    }

    mountEl.innerHTML = `
      <div class="aboutArchiveWrap">
        <strong class="aboutArchiveTitle">About The Site</strong><br>
        <div class="aboutArchiveBody">
This site is a nearly-100% automated website using coding that reads from the native SmugMug system and creates it in a better customizable UI. This website was also created in assistance with ChatGPT. It is also an ever-evolving website and will need work like anything else. If it breaks, let me know.<br><br>
        </div>
		<strong class="aboutArchiveTitle">About The Person</strong><br>
		<div class="aboutArchiveBody">
Coming soon!<br>
        </div>
      </div>
    `;
  }

  function onEnter(){}
  function destroy(){}

  window.AboutArchive = { render, onEnter, destroy, COPY };
})();
