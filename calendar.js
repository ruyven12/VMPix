// calendar.js
// Public Google Calendar (Option B): fetch a public ICS feed and render upcoming events.
// Intentionally vanilla (no build tools) to match the rest of the site.
//
// Config (set anywhere BEFORE this file loads, e.g., a <script> in index.html if you want):
//   window.VMPIX_CALENDAR_ICS_URL = 'https://calendar.google.com/calendar/ical/.../public/basic.ics';
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
      /* Calendar module: cyberpunk-minimal (centered hierarchy) */
      .vmCalWrap,
      .vmCalWrap *{
        font-family: "Orbitron", system-ui, sans-serif;
        text-transform: none !important; /* avoid global uppercase rules */
      }

      .vmCalWrap{ max-width: 780px; margin: 0 auto; padding: 12px 12px 18px; }

      /* Header: title centered, actions right */
      .vmCalHdr{
        display:grid;
        grid-template-columns: 1fr auto 1fr;
        align-items:center;
        gap:10px;
        margin-bottom: 12px;
      }
      .vmCalHdrLeft{ height: 1px; }
      .vmCalHdrMid{ text-align:center; }
      .vmCalTitle{ font-size: 18px; letter-spacing: .08em; text-transform: uppercase !important; opacity: .92; }
      .vmCalMeta{ font-size: 11px; letter-spacing: .14em; text-transform: uppercase !important; opacity: .68; margin-top: 2px; }
      .vmCalActions{ display:flex; align-items:center; justify-content:flex-end; gap:8px; }

      .vmCalBtn{
        appearance:none;
        border: 1px solid rgba(255,255,255,.16);
        background: rgba(0,0,0,.14);
        color: rgba(226,232,240,0.90);
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 11px;
        letter-spacing: .12em;
        text-transform: uppercase !important;
        cursor: pointer;
        transition: transform 120ms ease, box-shadow 180ms ease, border-color 180ms ease, filter 180ms ease;
      }
      .vmCalBtn:hover{
        border-color: rgba(255,60,60,.40);
        box-shadow: 0 0 0 1px rgba(255,60,60,.14), 0 0 18px rgba(255,60,60,.16);
        filter: brightness(1.04);
      }
      .vmCalBtn:active{ transform: translateY(1px); }

      .vmCalNote{ font-size: 12px; opacity: .8; line-height: 1.35; margin: 10px 0 0; }
      .vmCalErr{ font-size: 12px; opacity: .9; line-height: 1.35; margin: 10px 0 0; }
      .vmCalErr code{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 11px; }

      .vmCalList{ display:flex; flex-direction:column; gap:12px; margin-top: 12px; }

      /* Event card */
      .vmCalItem{
        --accent: rgba(255,60,60,0.55);
        position: relative;
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(0,0,0,.18);
        border-radius: 16px;
        padding: 14px 14px 12px;
        box-shadow: 0 12px 28px rgba(0,0,0,0.34);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        overflow: hidden;
        transition: transform 140ms ease, border-color 180ms ease, box-shadow 180ms ease, filter 180ms ease;
      }
      /* Left accent bar */
      .vmCalItem::before{
        content:"";
        position:absolute;
        left: 0;
        top: 10px;
        bottom: 10px;
        width: 2px;
        border-radius: 999px;
        background: var(--accent);
        /* Keep compatible with older mobile/webviews (avoid color-mix) */
        box-shadow: 0 0 12px rgba(255,60,60,0.18);
        opacity: .85;
        pointer-events:none;
      }
      /* Subtle top edge highlight */
      .vmCalItem::after{
        content:"";
        position:absolute;
        left: 10px;
        right: 10px;
        top: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent);
        opacity: .55;
        pointer-events:none;
      }

      .vmCalItem:hover{
        transform: translateY(-1px);
        border-color: rgba(255,60,60,.28);
        box-shadow: 0 16px 40px rgba(0,0,0,0.42);
        filter: brightness(1.02);
      }
      .vmCalItem:active{ transform: translateY(0px); }

      /* Event layout: 3-line (Title / Date+Time / Location) */
      .vmCalTop{
        display:flex;
        flex-direction:column;
        align-items:center;
        gap: 6px;
      }

      .vmCalName{
        font-size: 16px;
        font-weight: 600;
        letter-spacing: -0.02em;
        line-height: 1.25;
        opacity: .96;
        text-align: center;
        margin: 0 auto;
        text-wrap: balance;
      }

      .vmCalWhen{
        font-size: 11px;
        letter-spacing: .14em;
        text-transform: none !important;
        opacity: .72;
        white-space: normal;
        text-align: center;
        max-width: 100%;
        overflow-wrap: anywhere;
        word-break: break-word;
        line-height: 1.45;
      }

      /* Status chip (system flag) */
      .vmCalStatus{
        font-size: 10px;
        font-weight: 700;
        letter-spacing: .12em;
        text-transform: uppercase !important;
        opacity: .92;
        border: 1px solid var(--accent);
        background: rgba(0,0,0,0.18);
        border-radius: 999px;
        padding: 3px 9px;
        box-shadow: 0 0 14px rgba(255,60,60,0.10);
      }

      .vmCalItem.vmCalCancelled{ opacity: .62; }
      .vmCalItem.vmCalCancelled::before{ opacity: .35; }
      .vmCalItem.vmCalCancelled .vmCalName{ text-decoration: line-through; opacity: .82; }

      /* Secondary lines */
      .vmCalLoc{
        font-size: 12px;
        opacity: .66;
        margin-top: 10px;
        text-align: center;
      }
      .vmCalDesc{
        font-size: 12px;
        opacity: .62;
        margin-top: 8px;
        line-height: 1.45;
        white-space: pre-wrap;
        text-align: center;
      }

      .vmCalSkel{ border: 1px dashed rgba(255,255,255,.18); background: rgba(0,0,0,.10); border-radius: 14px; padding: 12px; font-size: 12px; opacity: .78; text-align:center; }

      @media (max-width: 520px){
        .vmCalWrap{ padding-left: 10px; padding-right: 10px; }
        .vmCalTop{ padding-top: 2px; }
        .vmCalName{ font-size: 15px; }
      }
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
        cur = { summary: '', location: '', description: '', status: '', start: null, end: null, uid: '' };
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
      else if (key === 'STATUS') cur.status = safeText(val).toUpperCase();
      else if (key === 'DTSTART') cur.start = parseICSDate(val);
      else if (key === 'DTEND') cur.end = parseICSDate(val);
    }

    return events;
  }

  function formatWhen(start, end){
    if (!start) return '';

    const isDateOnly = start.getHours() === 0 && start.getMinutes() === 0 && start.getSeconds() === 0 && (!end || (end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0));

    function daySuffix(n){
      const v = n % 100;
      if (v >= 11 && v <= 13) return 'th';
      switch (n % 10){
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    }

    function formatLongDate(d){
      const weekday = d.toLocaleDateString(undefined, { weekday: 'long' });
      const month = d.toLocaleDateString(undefined, { month: 'long' });
      const dayNum = d.getDate();
      const year = d.getFullYear();
      return `${weekday}, ${month} ${dayNum}${daySuffix(dayNum)}, ${year}`;
    }

    // All-day events in ICS typically use date-only DTSTART/DTEND.
    // Note: DTEND is exclusive for all-day events (end date is the day AFTER the final day).
    if (isDateOnly){
      if (end && !isNaN(end.getTime())){
        const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

        // If multi-day, show inclusive range: Start to (End - 1 day)
        const diffDays = Math.round((endDay.getTime() - startDay.getTime()) / (24 * 60 * 60 * 1000));
        if (diffDays > 1){
          const endInclusive = new Date(endDay);
          endInclusive.setDate(endInclusive.getDate() - 1);
          return formatLongDate(startDay) + ' to ' + formatLongDate(endInclusive);
        }
      }
      return formatLongDate(start);
    }

    const datePart = formatLongDate(start);
    const timeOpts = { hour: 'numeric', minute: '2-digit', hour12: true };
    const startTime = start.toLocaleTimeString(undefined, timeOpts);

    let range = startTime;
    if (end && !isNaN(end.getTime())){
      const sameDay = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth() && start.getDate() === end.getDate();
      const endTime = end.toLocaleTimeString(undefined, timeOpts);
      range += ' – ' + (sameDay ? endTime : (formatLongDate(end) + ' ' + endTime));
    }

    return datePart + ' · ' + range;
  }

  function formatLocationShort(location){
    const raw = String(location || '').trim();
    if (!raw) return '';

    // Typical Google Calendar LOCATION:
    //   "Venue Name, 123 Main St, City, ST 01234, USA"
    // Desired display:
    //   "Venue Name - City, ST"
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
    if (!parts.length) return raw;

    const venue = parts[0] || '';

    // Find a part containing a 2-letter state code (US-style).
    let state = '';
    let stateIdx = -1;
    for (let i = parts.length - 1; i >= 0; i--){
      const m = parts[i].match(/\b([A-Z]{2})\b/);
      if (m){
        state = m[1];
        stateIdx = i;
        break;
      }
    }

    const city = (stateIdx > 0) ? parts[stateIdx - 1] : '';

    if (venue && city && state){
      return `${venue} - ${city}, ${state}`;
    }

    // Fallback: if we can't reliably parse, keep just the venue.
    return venue || raw;
  }



  function extractUserStatus(description){
    const d = String(description || '');

    // Preferred explicit tag in DESCRIPTION:
    //   status: Confirmed
    //   status: Interested
    //   status: Unavailable
    let m = d.match(/(?:^|\n)\s*status\s*[:=]\s*(confirmed|interested|unavailable)\b/i);
    if (m) return capitalize(m[1]);

    // Fallback: look for standalone keyword anywhere (case-insensitive)
    m = d.match(/\b(confirmed|interested|unavailable)\b/i);
    if (m) return capitalize(m[1]);

    return '';
  }

  function statusToBorderColor(status){
    const s = String(status || '').trim().toLowerCase();
    if (s === 'confirmed') return '#34a853'; // green
    if (s === 'interested') return '#fbbc04'; // yellow
    if (s === 'unavailable') return '#ea4335'; // red
    return '';
  }

  function extractBorderColor(description){
    const d = String(description || '');

    // Option B: status-driven border color from DESCRIPTION
    const st = extractUserStatus(d);
    const byStatus = statusToBorderColor(st);
    if (byStatus) return byStatus;

    // Optional explicit override in DESCRIPTION, e.g.:
    //   color: #34a853
    //   border: #34a853
    const m = d.match(/(?:^|\n)\s*(?:color|border)\s*[:=]\s*(#[0-9a-fA-F]{3,8})\s*(?:\n|$)/);
    return m ? m[1] : '';
  }

  function normalizeStatusFromDescription(description){
    return extractUserStatus(description);
  }


  // Remove status tags/keywords from the description so they can be used for styling
  // without being displayed as body text.
  function stripStatusFromDescription(description){
    const d = String(description || '');
    const status = extractUserStatus(d);
    if (!d) return { status, desc: '' };

    // Remove explicit "status: ..." line(s)
    let cleaned = d.replace(/(?:^|\n)\s*status\s*[:=]\s*(confirmed|interested|unavailable)\b\s*(?=\n|$)/ig, '\n');

    // Remove standalone keyword line(s)
    cleaned = cleaned.replace(/(?:^|\n)\s*(confirmed|interested|unavailable)\b\s*(?=\n|$)/ig, '\n');

    // Normalize whitespace/newlines
    cleaned = cleaned.replace(/\r/g, '');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.trim();

    return { status, desc: cleaned };
  }

  function capitalize(s){
    const v = String(s || '').trim();
    if (!v) return '';
    return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
  }

  async function fetchICS(url, allowFallback){
    let directStatus = 0;
    let directErr = null;

    // Many Google Calendar ICS endpoints return 200 but are blocked by CORS.
    // When that happens, browsers log a noisy console error for the blocked request.
    // To keep the console clean (and load faster), skip the direct request for
    // known Google hosts and go straight to the fallback proxy.
    let skipDirect = false;
    try{
      const u = new URL(url, window.location.href);
      const h = String(u.hostname || '').toLowerCase();
      if (h.includes('google.com') || h.includes('googleusercontent.com')){
        skipDirect = true;
      }
    }catch(_e){
      // If URL parsing fails, fall back to attempting a direct fetch.
    }

    // Direct fetch often fails for Google Calendar ICS due to CORS.
    // Important: a CORS block throws (TypeError) and never returns a Response.
    if (!skipDirect){
      try{
        const direct = await fetch(url, { cache: 'no-store' });
        directStatus = direct.status;
        if (direct.ok){
          return await direct.text();
        }
      }catch(err){
        directErr = err;
      }
    } else {
      directErr = new Error('Direct fetch skipped (likely CORS)');
    }

    if (!allowFallback){
      if (directErr) throw new Error('Calendar feed request failed: ' + (directErr.message || String(directErr)));
      throw new Error('Calendar feed request failed (' + directStatus + ')');
    }

    // Fallback: fetch via jina.ai text proxy (adds CORS headers for us)
    // Format: https://r.jina.ai/https://example.com/path
    const normalized = url.replace(/^https?:\/\//i, (m) => m.toLowerCase());
    const fallbackUrl = 'https://r.jina.ai/' + normalized;

    try{
      const fb = await fetch(fallbackUrl, { cache: 'no-store' });
      if (!fb.ok){
        throw new Error('Fallback failed (' + fb.status + ')');
      }
      const raw = await fb.text();
      // jina.ai may prepend metadata; keep only the ICS payload.
      const idx = raw.indexOf('BEGIN:VCALENDAR');
      return (idx >= 0) ? raw.slice(idx) : raw;
    }catch(fbErr){
      const directMsg = directErr
        ? (directErr.message || String(directErr))
        : ('HTTP ' + directStatus);
      throw new Error('Calendar feed request failed (' + directMsg + '), ' + (fbErr.message || String(fbErr)));
    }
  }

  function renderSkeleton(m, title){
    m.innerHTML = `
      <div class="vmCalWrap">
        <div class="vmCalHdr">
          <div class="vmCalHdrLeft"></div>
          <div class="vmCalHdrMid">
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
          <div class="vmCalHdrLeft"></div>
          <div class="vmCalHdrMid">
            <div class="vmCalTitle">${title}</div>
            <div class="vmCalMeta">Not configured</div>
          </div>
          <div class="vmCalActions"></div>
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
      const locText = formatLocationShort(ev.location);
      const loc = locText ? `<div class="vmCalLoc">${escapeHtml(locText)}</div>` : '';

      // Use description only for optional notes; strip status tokens so they are not displayed.
      const cleaned = stripStatusFromDescription(ev.description);
      const desc = cleaned.desc ? `<div class="vmCalDesc">${escapeHtml(cleaned.desc)}</div>` : '';

      const border = extractBorderColor(ev.description);
      const styleAttr = border ? ` style="--accent:${escapeAttr(border)}; border-color:${escapeAttr(border)}"` : '';
      const cancelledClass = (String(ev.status || '').toUpperCase() === 'CANCELLED') ? ' vmCalCancelled' : '';
      return `
        <div class="vmCalItem${cancelledClass}"${styleAttr}>
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
          <div class="vmCalHdrLeft"></div>
          <div class="vmCalHdrMid">
            <div class="vmCalTitle">${title}</div>
            <div class="vmCalMeta">${escapeHtml(countText)}</div>
          </div>
          <div class="vmCalActions">
            <button class="vmCalBtn" type="button" data-cal-refresh>Refresh</button>
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
          <div class="vmCalHdrLeft"></div>
          <div class="vmCalHdrMid">
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
