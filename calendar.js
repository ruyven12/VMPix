// calendar.js
// Public Google Calendar (Option B): fetch a public ICS feed and render upcoming events.
// Intentionally vanilla (no build tools) to match the rest of the site.
//
// Config (set anywhere BEFORE this file loads, e.g., a <script> in index.html if you want):
//   window.VMPIX_CALENDAR_ICS_URL = 'https://calendar.google.com/calendar/ical/f94c8ef1cb0b3c7e3185134a306540e3b9f3847f3a595d166ca0e4c9b01014a3%40group.calendar.google.com/public/basic.ics';
//   window.VMPIX_CALENDAR_TITLE = 'Calendar';
// Optional fallback (helps if Google blocks CORS on the ICS URL):
//   window.VMPIX_CALENDAR_ICS_FALLBACK_JINA = true; // default true
//   (fallback requests https://r.jina.ai/http(s)://...)

(function(){
  'use strict';

  const DEFAULT_TITLE = 'Calendar';

  function getConfig(){
    const url = (typeof window.VMPIX_CALENDAR_ICS_URL === 'string') ? window.VMPIX_CALENDAR_ICS_URL.trim() : '';
    const title = (typeof window.VMPIX_CALENDAR_TITLE === 'string' && window.VMPIX_CALENDAR_TITLE.trim())
      ? window.VMPIX_CALENDAR_TITLE.trim()
      : DEFAULT_TITLE;
    const allowFallback = (typeof window.VMPIX_CALENDAR_ICS_FALLBACK_JINA === 'boolean')
      ? window.VMPIX_CALENDAR_ICS_FALLBACK_JINA
      : true;
    return { url, title, allowFallback };
  }

  function ensureStyles(){
    if (document.getElementById('vmCalendarStyles')) return;
    const style = document.createElement('style');
    style.id = 'vmCalendarStyles';
    style.textContent = `
      .vmCalWrap{ max-width: 720px; margin: 0 auto; padding: 12px 12px 18px; }
      .vmCalHdr{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom: 10px; }
      .vmCalTitle{ font-size: 18px; letter-spacing: .02em; opacity: .95; }
      .vmCalMeta{ font-size: 12px; opacity: .65; }
      .vmCalActions{ display:flex; align-items:center; gap:8px; }
      .vmCalBtn{ appearance:none; border: 1px solid rgba(255,255,255,.18); background: rgba(0,0,0,.18); color: inherit; border-radius: 999px; padding: 6px 10px; font-size: 12px; cursor: pointer; }
      .vmCalBtn:hover{ border-color: rgba(255,255,255,.30); background: rgba(0,0,0,.26); }
      .vmCalBtn:active{ transform: translateY(1px); }

      .vmCalNote{ font-size: 12px; opacity: .8; line-height: 1.35; margin: 10px 0 0; }
      .vmCalErr{ font-size: 12px; opacity: .9; line-height: 1.35; margin: 10px 0 0; }
      .vmCalErr code{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 11px; }

      .vmCalList{ display:flex; flex-direction:column; gap:10px; margin-top: 12px; }
      .vmCalItem{ border: 1px solid rgba(255,255,255,.14); background: rgba(0,0,0,.14); border-radius: 14px; padding: 10px 12px; }
      .vmCalTop{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
      .vmCalWhen{ font-size: 12px; opacity: .8; white-space: nowrap; }
      .vmCalName{ font-size: 14px; line-height: 1.25; opacity: .98; }
      .vmCalLoc{ font-size: 12px; opacity: .72; margin-top: 4px; }
      .vmCalDesc{ font-size: 12px; opacity: .70; margin-top: 8px; line-height: 1.35; white-space: pre-wrap; }

      .vmCalSkel{ border: 1px dashed rgba(255,255,255,.18); background: rgba(0,0,0,.10); border-radius: 14px; padding: 12px; font-size: 12px; opacity: .78; }
    `;
    document.head.appendChild(style);
  }

  // ICS lines can be folded (a newline followed by a space/tab continues the previous line)
  function unfoldICS(text){
    return String(text || '').replace(/\r?\n[\t ]/g, '');
  }

  function parseICSDate(value){
    // Formats:
    //  - YYYYMMDD (date-only)
    //  - YYYYMMDDTHHMMSSZ (UTC)
    //  - YYYYMMDDTHHMMSS (floating/local)
    const v = String(value || '').trim();
    if (!v) return null;

    // date-only
    if (/^\d{8}$/.test(v)){
      const y = Number(v.slice(0,4));
      const m = Number(v.slice(4,6)) - 1;
      const d = Number(v.slice(6,8));
      // Treat as local midnight
      return new Date(y, m, d, 0, 0, 0);
    }

    const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
    if (!m) return null;

    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const hh = Number(m[4]);
    const mm = Number(m[5]);
    const ss = Number(m[6]);
    const isUTC = !!m[7];

    if (isUTC) return new Date(Date.UTC(y, mo, d, hh, mm, ss));
    return new Date(y, mo, d, hh, mm, ss);
  }

  function safeText(v){
    return String(v || '')
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\')
      .trim();
  }

  function parseICS(icsText){
    const unfolded = unfoldICS(icsText);
    const lines = unfolded.split(/\r?\n/);

    const events = [];
    let cur = null;

    for (let i = 0; i < lines.length; i++){
      const line = lines[i];
      if (!line) continue;

      if (line === 'BEGIN:VEVENT'){
        cur = { summary: '', location: '', description: '', start: null, end: null, uid: '' };
        continue;
      }
      if (line === 'END:VEVENT'){
        if (cur && cur.start){
          events.push(cur);
        }
        cur = null;
        continue;
      }
      if (!cur) continue;

      // Split key;params:value
      const idx = line.indexOf(':');
      if (idx === -1) continue;

      const left = line.slice(0, idx);
      const val = line.slice(idx + 1);

      const key = left.split(';')[0].toUpperCase();

      if (key === 'SUMMARY') cur.summary = safeText(val);
      else if (key === 'LOCATION') cur.location = safeText(val);
      else if (key === 'DESCRIPTION') cur.description = safeText(val);
      else if (key === 'UID') cur.uid = safeText(val);
      else if (key === 'DTSTART') cur.start = parseICSDate(val);
      else if (key === 'DTEND') cur.end = parseICSDate(val);
    }

    return events;
  }

  function formatWhen(start, end){
    if (!start) return '';

    const isDateOnly = start.getHours() === 0 && start.getMinutes() === 0 && start.getSeconds() === 0 && (!end || (end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0));

    if (isDateOnly){
      return start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }

    const datePart = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const timePart = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

    let range = timePart;
    if (end && !isNaN(end.getTime())){
      range += ' – ' + end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }

    return datePart + ' • ' + range;
  }

  async function fetchICS(url, allowFallback){
    const direct = await fetch(url, { cache: 'no-store' });
    if (direct.ok){
      return await direct.text();
    }

    // If direct returns non-2xx, still try fallback (some hosts respond w/ 403 to JS fetch).
    if (!allowFallback) throw new Error('Calendar feed request failed (' + direct.status + ')');

    const normalized = url.replace(/^https?:\/\//i, (m) => m.toLowerCase());
    const fallbackUrl = 'https://r.jina.ai/' + normalized;
    const fb = await fetch(fallbackUrl, { cache: 'no-store' });
    if (!fb.ok){
      throw new Error('Calendar feed request failed (' + direct.status + '), fallback failed (' + fb.status + ')');
    }
    return await fb.text();
  }

  function renderSkeleton(m, title){
    m.innerHTML = `
      <div class="vmCalWrap">
        <div class="vmCalHdr">
          <div>
            <div class="vmCalTitle">${title}</div>
            <div class="vmCalMeta">Loading…</div>
          </div>
          <div class="vmCalActions">
            <button class="vmCalBtn" type="button" data-cal-refresh>Refresh</button>
          </div>
        </div>
        <div class="vmCalSkel">Fetching public calendar feed…</div>
      </div>
    `;
  }

  function renderNeedsConfig(m, title){
    m.innerHTML = `
      <div class="vmCalWrap">
        <div class="vmCalHdr">
          <div>
            <div class="vmCalTitle">${title}</div>
            <div class="vmCalMeta">Not configured</div>
          </div>
        </div>
        <div class="vmCalSkel">
          To enable this tab, set <code>window.VMPIX_CALENDAR_ICS_URL</code> to your public Google Calendar ICS URL.
          <div class="vmCalNote" style="margin-top:8px;">
            Google Calendar → Settings → (your calendar) → <b>Integrate calendar</b> → <b>Public address in iCal format</b>.
          </div>
        </div>
      </div>
    `;
  }

  function renderEvents(m, title, events, sourceUrl){
    const now = new Date();
    const upcoming = events
      .filter(e => e && e.start && !isNaN(e.start.getTime()))
      .filter(e => e.start.getTime() >= (now.getTime() - (2 * 60 * 60 * 1000))) // include last ~2h
      .sort((a,b) => a.start.getTime() - b.start.getTime())
      .slice(0, 25);

    const countText = upcoming.length ? (upcoming.length + ' upcoming') : 'No upcoming events found';

    const listHtml = upcoming.length ? upcoming.map(ev => {
      const when = formatWhen(ev.start, ev.end);
      const name = ev.summary || '(Untitled event)';
      const loc = ev.location ? `<div class="vmCalLoc">${escapeHtml(ev.location)}</div>` : '';
      const desc = ev.description ? `<div class="vmCalDesc">${escapeHtml(ev.description)}</div>` : '';
      return `
        <div class="vmCalItem">
          <div class="vmCalTop">
            <div class="vmCalName">${escapeHtml(name)}</div>
            <div class="vmCalWhen">${escapeHtml(when)}</div>
          </div>
          ${loc}
          ${desc}
        </div>
      `;
    }).join('') : `<div class="vmCalSkel">No events to show yet.</div>`;

    m.innerHTML = `
      <div class="vmCalWrap">
        <div class="vmCalHdr">
          <div>
            <div class="vmCalTitle">${title}</div>
            <div class="vmCalMeta">${escapeHtml(countText)}</div>
          </div>
          <div class="vmCalActions">
            <button class="vmCalBtn" type="button" data-cal-refresh>Refresh</button>
            ${sourceUrl ? `<a class="vmCalBtn" href="${escapeAttr(sourceUrl)}" target="_blank" rel="noopener">ICS</a>` : ''}
          </div>
        </div>
        <div class="vmCalList">${listHtml}</div>
      </div>
    `;
  }

  function renderError(m, title, message){
    m.innerHTML = `
      <div class="vmCalWrap">
        <div class="vmCalHdr">
          <div>
            <div class="vmCalTitle">${title}</div>
            <div class="vmCalMeta">Could not load</div>
          </div>
          <div class="vmCalActions">
            <button class="vmCalBtn" type="button" data-cal-refresh>Try again</button>
          </div>
        </div>
        <div class="vmCalSkel">
          Calendar feed failed to load.
          <div class="vmCalErr" style="margin-top:8px;">${escapeHtml(message || 'Unknown error')}</div>
          <div class="vmCalNote" style="margin-top:10px;">
            If this is a Google Calendar ICS URL, it may block browser fetch requests (CORS). This module will try a fallback automatically.
            If it still fails, we can route it through one of your Render backends as a tiny proxy endpoint.
          </div>
        </div>
      </div>
    `;
  }

  function escapeHtml(s){
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(s){
    // Minimal: reuse escapeHtml
    return escapeHtml(s);
  }

  let _mount = null;
  let _bound = false;
  let _isDestroyed = false;

  async function loadAndRender(){
    if (!_mount || _isDestroyed) return;
    const cfg = getConfig();

    if (!cfg.url){
      renderNeedsConfig(_mount, cfg.title);
      return;
    }

    renderSkeleton(_mount, cfg.title);

    try{
      const icsText = await fetchICS(cfg.url, cfg.allowFallback);
      const events = parseICS(icsText);
      renderEvents(_mount, cfg.title, events, cfg.url);
    }catch(err){
      renderError(_mount, cfg.title, (err && err.message) ? err.message : String(err));
    }

    wireRefresh();
  }

  function wireRefresh(){
    if (!_mount || _isDestroyed) return;
    if (_bound) return;
    const btn = _mount.querySelector('[data-cal-refresh]');
    if (!btn) return;

    _bound = true;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      _bound = false;
      loadAndRender();
    });
  }

  window.CalendarArchive = {
    render(m){
      ensureStyles();
      _mount = m;
      _isDestroyed = false;
      _bound = false;
      const cfg = getConfig();
      renderSkeleton(_mount, cfg.title);
    },
    onEnter(){
      loadAndRender();
    },
    destroy(){
      _isDestroyed = true;
      _bound = false;
      _mount = null;
    }
  };
})();
