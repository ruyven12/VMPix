// about-archive.js
// Placeholder About module for the HUD.
// Currently mirrors your existing "typed text" behavior so nothing changes visually.

(function(){
  "use strict";

  const COPY = `About The Site

This site is a nearly-100% automated website using coding that reads from the native SmugMug system and creates it in a better customizable UI. This website was also created in assistance with ChatGPT. It is also an ever-evolving website and will need work like anything else. If it breaks, let me know.`;

  function render(mountEl){
    if (!mountEl) return;
    mountEl.innerHTML = `
      <div style="max-width:760px; margin:0 auto; opacity:.9; font-size:16px; line-height:1.7; letter-spacing:.04em; text-transform:none;">
        <strong style="font-size:20px; letter-spacing:.06em;">About The Site</strong><br><br>
        <div style="font-size:16px; opacity:.75; white-space:pre-wrap;">
			This site is a nearly-100% automated website using coding that reads from the native SmugMug system and creates it in a better customizable UI. This website was also created in assistance with ChatGPT. It is also an ever-evolving website and will need work like anything else. If it breaks, let me know.
        </div>
      </div>
    `;
  }

  function onEnter(){}
  function destroy(){}

  window.AboutArchive = { render, onEnter, destroy, COPY };
})();
