(function () {
  'use strict';

  const API_BASE = (function () {
    try {
      const w = window;
      const v = String((w && w.WRESTLING_ARCHIVE_API_BASE) || '').trim();
      if (v) return v.replace(/\/$/, '');
    } catch (_) {}
    return 'https://wrestling-archive.onrender.com';
  })();

  const SHOWS_ENDPOINT = `${API_BASE}/sheet/shows`;
  const _WAKE_KEY = `vm_wake_${String(API_BASE).replace(/[^a-z0-9]/gi, '_')}_v1_people`;
  const _WAKE_TTL_MS = 1000 * 60 * 10;

  let _wakePromise = null;
  let _panel = null;
  let _root = null;
  let _mountToken = 0;
  let SHOWS = [];
  let _peopleMap = new Map();
  let _view = { mode: 'list', person: '' };
  let _activeLetter = null;

  const _sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]));
  }

  function parseCsvLine(line) {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  }

  async function _fetchWithTimeout(url, opts) {
    const timeoutMs = Number(opts && opts.timeoutMs) || 20000;
    const options = Object.assign({}, opts || {});
    delete options.timeoutMs;

    let ac = null;
    let t = null;
    try {
      if (typeof AbortController !== 'undefined') {
        ac = new AbortController();
        options.signal = options.signal || ac.signal;
        t = setTimeout(() => {
          try { ac.abort(); } catch (_) {}
        }, timeoutMs);
      }
    } catch (_) {}

    try {
      return await fetch(url, options);
    } finally {
      if (t) clearTimeout(t);
    }
  }

  async function _wakeBackendOnce() {
    try {
      const raw = sessionStorage.getItem(_WAKE_KEY);
      if (raw) {
        const ts = Number(raw);
        if (Number.isFinite(ts) && (Date.now() - ts) < _WAKE_TTL_MS) return;
      }
    } catch (_) {}

    if (_wakePromise) return _wakePromise;

    _wakePromise = (async () => {
      const candidates = [
        `${API_BASE}/health`,
        `${API_BASE}/ping`,
        `${API_BASE}/`,
        SHOWS_ENDPOINT,
      ];
      for (let i = 0; i < candidates.length; i++) {
        try {
          await _fetchWithTimeout(candidates[i], { method: 'GET', cache: 'no-store', timeoutMs: 6000 });
          break;
        } catch (_) {
          await _sleep(250);
        }
      }
      try { sessionStorage.setItem(_WAKE_KEY, String(Date.now())); } catch (_) {}
    })().finally(() => {
      _wakePromise = null;
    });

    return _wakePromise;
  }

  async function _fetchWithRetry(url, opts) {
    const attempts = Math.max(1, Number(opts && opts.attempts) || 3);
    const timeoutMs = Number(opts && opts.timeoutMs) || 25000;
    const baseDelayMs = Number(opts && opts.baseDelayMs) || 700;
    const options = Object.assign({}, opts && opts.fetchOptions ? opts.fetchOptions : {});

    try { _wakeBackendOnce(); } catch (_) {}

    let lastErr = null;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await _fetchWithTimeout(url, Object.assign({}, options, { timeoutMs }));
        if (res && (res.status === 502 || res.status === 503 || res.status === 504)) {
          lastErr = new Error(`HTTP ${res.status}`);
        } else {
          return res;
        }
      } catch (e) {
        lastErr = e;
      }
      if (i < attempts - 1) {
        const backoff = baseDelayMs * Math.pow(1.6, i);
        await _sleep(Math.min(3500, backoff));
      }
    }
    throw lastErr || new Error('fetch failed');
  }

  function render() {
    return `
      <div id="waPeopleRoot" style="width:100%; max-width:1200px; margin:0 auto;">
        <div class="waPeopleHead">
          <div id="waPeopleBootPanel" class="vmpixBootPanel" role="status" aria-live="polite" style="margin-top:8px;">
            <div class="vmpixBootRow">
              <div class="vmpixSpinner" aria-hidden="true"></div>
              <div class="vmpixBootText">
                <div class="vmpixBootTitle">Indexing performers...</div>
                <div class="vmpixBootSub">Building a first-pass people index from the Wrestling archive sheet.</div>
              </div>
            </div>
            <div class="vmpixShimmer" aria-hidden="true"></div>
          </div>

          <div class="waPeopleIntro" aria-label="Wrestling Performers Introduction">
            <div class="waPeopleIntroDivider" aria-hidden="true"></div>
            <div class="waPeopleIntroTitle">The Archive - Filter By Performer</div>
            <div class="waPeopleIntroBody">Welcome to the Wrestling people side. This first pass reads performer names from the event sheet, groups them into a searchable index, and lets you jump straight into the exact show or match album where they appear.</div>
            <div class="waPeopleIntroDivider" aria-hidden="true"></div>
          </div>

          <div id="waPeopleMeta" class="waPeopleMeta"></div>
          <div id="waPeopleLetterNav" class="waPeopleLetterNav" aria-label="Performer letters"></div>
        </div>

        <div id="waPeopleBody" class="waPeopleBody"></div>
      </div>
    `;
  }

  function ensureStyles() {
    if (document.getElementById('waPeopleStyles')) return;
    const s = document.createElement('style');
    s.id = 'waPeopleStyles';
    s.textContent = `
      .waPeopleHead{
        text-align:center;
        padding:2px 4px 10px;
      }
      .waPeopleIntro{
        width:100%;
        max-width:980px;
        margin:12px auto 18px;
        text-align:center;
      }
      .waPeopleIntroTitle{
        font-family:"Orbitron", system-ui, sans-serif !important;
        font-size:24px;
        font-weight:900;
        letter-spacing:.12em;
        color:rgba(236,241,250,0.95);
        margin-bottom:12px;
      }
      .waPeopleIntroDivider{
        position:relative;
        display:block;
        height:2px;
        width:min(100%, 960px);
        margin:0 auto 14px;
        border-radius:999px;
        background:linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,84,120,0.18) 10%, rgba(255,84,120,0.62) 50%, rgba(255,84,120,0.18) 90%, rgba(255,255,255,0) 100%);
        box-shadow:0 0 10px rgba(255,84,120,0.26), 0 0 18px rgba(255,84,120,0.16);
        overflow:hidden;
      }
      .waPeopleIntroDivider::after{
        content:"";
        position:absolute;
        inset:0;
        border-radius:inherit;
        background:linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,220,228,0.40) 50%, rgba(255,255,255,0) 100%);
        opacity:.9;
      }
      .waPeopleIntroBody{
        max-width:920px;
        margin:0 auto 16px;
        font-size:13px;
        font-weight:700;
        letter-spacing:.04em;
        line-height:1.25;
        color:rgba(212,223,242,0.78);
        text-transform:none !important;
      }
      .waPeopleMeta{
        text-align:center;
        font-size:12px;
        letter-spacing:.12em;
        text-transform:uppercase;
        color:rgba(215,226,245,0.76);
        margin:0 auto 14px;
      }
      .waPeopleLetterNav{
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        justify-content:center;
        margin:0 auto 18px;
      }
      .waPeopleLetterBtn{
        appearance:none;
        border:1px solid rgba(255,70,110,0.22);
        background:rgba(8,10,20,0.50);
        color:rgba(232,239,248,0.82);
        border-radius:999px;
        padding:7px 11px;
        min-width:36px;
        font:inherit;
        font-size:11px;
        font-weight:900;
        letter-spacing:.14em;
        text-transform:uppercase;
        cursor:pointer;
        box-shadow:0 0 0 1px rgba(255,70,110,0.10) inset;
      }
      .waPeopleLetterBtn.is-active{
        color:#fff7fb;
        border-color:rgba(255,110,145,0.72);
        background:linear-gradient(180deg, rgba(255,112,146,0.92) 0%, rgba(228,65,100,0.80) 100%);
        box-shadow:0 0 16px rgba(255,80,128,0.40), 0 0 0 1px rgba(255,214,226,0.20) inset;
      }
      .waPeopleLetterBtn.is-disabled{
        opacity:.3;
        cursor:default;
      }
      .waPeopleBody{
        width:100%;
        max-width:1140px;
        margin:0 auto;
      }
      .waPeopleGrid{
        display:grid;
        grid-template-columns:repeat(3, minmax(0, 1fr));
        gap:16px;
      }
      .waPeopleCard{
        appearance:none;
        width:100%;
        border:1px solid rgba(98,122,188,0.28);
        background:
          radial-gradient(120% 140% at 100% 0%, rgba(255,84,120,0.10) 0%, rgba(255,84,120,0.03) 30%, rgba(0,0,0,0) 65%),
          linear-gradient(180deg, rgba(18,23,45,0.82) 0%, rgba(12,15,30,0.78) 100%);
        border-radius:18px;
        padding:18px 18px 16px;
        text-align:left;
        color:inherit;
        cursor:pointer;
        box-shadow:0 0 0 1px rgba(115,160,255,0.08) inset, 0 18px 40px rgba(0,0,0,0.24);
      }
      .waPeopleCard:hover{
        border-color:rgba(115,160,255,0.42);
        box-shadow:0 0 0 1px rgba(128,185,255,0.12) inset, 0 0 18px rgba(100,160,255,0.16);
      }
      .waPeopleCardName{
        font-size:21px;
        font-weight:900;
        letter-spacing:.04em;
        color:#f0f6ff;
        line-height:1.05;
      }
      .waPeopleCardMeta{
        margin-top:10px;
        font-size:11px;
        font-weight:900;
        letter-spacing:.14em;
        text-transform:uppercase;
        color:rgba(142,206,255,0.84);
      }
      .waPeopleCardSub{
        margin-top:9px;
        font-size:13px;
        line-height:1.35;
        color:rgba(216,226,242,0.76);
      }
      .waPeopleEmpty{
        width:min(760px, 100%);
        margin:0 auto;
        border:1px solid rgba(255,70,110,0.18);
        border-radius:18px;
        padding:20px 18px;
        background:rgba(10,12,24,0.58);
        color:rgba(226,233,244,0.72);
        text-align:center;
        font-size:13px;
        line-height:1.55;
      }
      .waPeopleDetailHead{
        width:min(1040px, 100%);
        margin:0 auto 18px;
        text-align:left;
      }
      .waPeopleBack{
        appearance:none;
        border:1px solid rgba(255,70,110,0.24);
        background:rgba(10,12,24,0.52);
        color:#f7fbff;
        border-radius:999px;
        padding:9px 14px;
        font:inherit;
        font-size:11px;
        font-weight:900;
        letter-spacing:.14em;
        text-transform:uppercase;
        cursor:pointer;
        margin-bottom:14px;
      }
      .waPeopleBack:hover{
        border-color:rgba(255,110,145,0.72);
        box-shadow:0 0 12px rgba(255,80,128,0.18);
      }
      .waPeopleDetailTitle{
        font-size:28px;
        font-weight:900;
        letter-spacing:.04em;
        color:#f2f7ff;
      }
      .waPeopleDetailMeta{
        margin-top:8px;
        font-size:12px;
        font-weight:900;
        letter-spacing:.14em;
        text-transform:uppercase;
        color:rgba(147,205,255,0.80);
      }
      .waPeopleDetailList{
        display:grid;
        grid-template-columns:1fr;
        gap:14px;
        width:min(1040px, 100%);
        margin:0 auto;
      }
      .waPeopleAppearanceCard{
        appearance:none;
        width:100%;
        border:1px solid rgba(98,122,188,0.26);
        background:linear-gradient(180deg, rgba(18,23,45,0.82) 0%, rgba(12,15,30,0.78) 100%);
        border-radius:18px;
        padding:16px 18px;
        text-align:left;
        color:inherit;
        cursor:pointer;
        box-shadow:0 0 0 1px rgba(115,160,255,0.08) inset;
        display:grid;
        grid-template-columns:minmax(0, 1fr) auto;
        gap:12px;
        align-items:center;
      }
      .waPeopleAppearanceCard:hover{
        border-color:rgba(115,160,255,0.42);
        box-shadow:0 0 0 1px rgba(128,185,255,0.12) inset, 0 0 16px rgba(100,160,255,0.14);
      }
      .waPeopleAppearanceEyebrow{
        font-size:11px;
        font-weight:900;
        letter-spacing:.14em;
        text-transform:uppercase;
        color:rgba(255,92,124,0.82);
      }
      .waPeopleAppearanceTitle{
        margin-top:6px;
        font-size:24px;
        font-weight:900;
        line-height:1.05;
        color:#f2f6ff;
      }
      .waPeopleAppearanceSub{
        margin-top:8px;
        font-size:13px;
        line-height:1.4;
        color:rgba(217,227,243,0.76);
      }
      .waPeopleJump{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        border:1px solid rgba(255,70,110,0.20);
        border-radius:999px;
        padding:10px 14px;
        font-size:11px;
        font-weight:900;
        letter-spacing:.14em;
        text-transform:uppercase;
        color:#f8fbff;
        background:rgba(10,12,24,0.46);
      }
      @media (max-width: 980px){
        .waPeopleGrid{
          grid-template-columns:repeat(2, minmax(0, 1fr));
        }
      }
      @media (max-width: 760px){
        .waPeopleIntro{
          margin:10px auto 14px;
          padding:0 6px;
        }
        .waPeopleIntroDivider{
          margin:0 auto 10px;
        }
        .waPeopleIntroTitle{
          font-size:20px;
          letter-spacing:.08em;
        }
        .waPeopleIntroBody{
          margin:0 auto 12px;
          font-size:12px;
          line-height:1.3;
        }
        .waPeopleGrid{
          grid-template-columns:1fr;
          gap:12px;
        }
        .waPeopleCard{
          padding:16px 16px 14px;
        }
        .waPeopleCardName{
          font-size:18px;
        }
        .waPeopleAppearanceCard{
          grid-template-columns:1fr;
        }
        .waPeopleAppearanceTitle{
          font-size:20px;
        }
        .waPeopleDetailTitle{
          font-size:22px;
        }
      }
      @media (max-width: 520px){
        .waPeopleIntroTitle{
          font-size:16px;
          letter-spacing:.05em;
        }
        .waPeopleIntroBody{
          margin:0 auto 10px;
          font-size:11px;
        }
        .waPeopleMeta{
          font-size:10px;
          letter-spacing:.10em;
        }
        .waPeopleLetterNav{
          gap:6px;
        }
        .waPeopleLetterBtn{
          font-size:10px;
          padding:6px 9px;
          min-width:32px;
        }
      }
    `;
    document.head.appendChild(s);
  }

  function slugifyPersonName(name) {
    return String(name || '')
      .trim()
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function showDateSlugFromRaw(raw) {
    const v = String(raw || '').trim();
    if (!v) return '';

    const m1 = v.match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\s*$/);
    if (m1) {
      const mm = String(m1[1]).padStart(2, '0');
      const dd = String(m1[2]).padStart(2, '0');
      let yy = String(m1[3]);
      if (yy.length === 4) yy = yy.slice(2);
      return mm + dd + yy;
    }

    const m2 = v.match(/^\s*(\d{4})-(\d{2})-(\d{2})\s*$/);
    if (m2) return String(m2[2]) + String(m2[3]) + String(m2[1]).slice(2);
    return '';
  }

  function normalizeMatchSlug(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\-_ ]+/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function getMatchRouteSlug(urlCell, idx) {
    const raw = String(urlCell || '').trim();
    if (raw && !/^https?:\/\//i.test(raw) && !raw.startsWith('/')) {
      const clean = normalizeMatchSlug(raw);
      if (clean) return clean;
    }
    return `match-${String(Number(idx) || 1)}`;
  }

  function getMatchField(obj, i, field) {
    const n = Number(i);
    const keys = [
      `match-${n}_${field}`,
      `match_${n}_${field}`,
      `match-${n}-${field}`,
      `match_${n}-${field}`,
      `part_${n}_${field}`,
    ];
    for (let x = 0; x < keys.length; x++) {
      const v = obj && Object.prototype.hasOwnProperty.call(obj, keys[x]) ? obj[keys[x]] : '';
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return '';
  }

  function formatPrettyDate(raw) {
    const str = String(raw || '').trim();
    if (!str) return '';

    let year = 0;
    let month = 0;
    let day = 0;
    let m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (m) {
      month = Number(m[1]);
      day = Number(m[2]);
      year = Number(m[3].length === 2 ? ('20' + m[3]) : m[3]);
    } else {
      m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return str;
      year = Number(m[1]);
      month = Number(m[2]);
      day = Number(m[3]);
    }

    const dt = new Date(year, month - 1, day);
    if (Number.isNaN(dt.getTime())) return str;
    const suffix =
      day % 10 === 1 && day !== 11 ? 'st' :
      day % 10 === 2 && day !== 12 ? 'nd' :
      day % 10 === 3 && day !== 13 ? 'rd' : 'th';
    return `${dt.toLocaleString('en-US', { month: 'long' })} ${day}${suffix}, ${year}`;
  }

  function dateSortValue(raw) {
    const str = String(raw || '').trim();
    if (!str) return 0;

    let year = 0;
    let month = 0;
    let day = 0;
    let m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (m) {
      month = Number(m[1]);
      day = Number(m[2]);
      year = Number(m[3].length === 2 ? ('20' + m[3]) : m[3]);
    } else {
      m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return 0;
      year = Number(m[1]);
      month = Number(m[2]);
      day = Number(m[3]);
    }
    return year * 10000 + month * 100 + day;
  }

  function splitPeopleNames(raw) {
    const source = String(raw || '').trim();
    if (!source) return [];
    return Array.from(new Set(
      source
        .split(/[;,]/)
        .map((v) => String(v || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
    ));
  }

  function buildMatchHeader(type, stip, partTitle) {
    const t = String(type || '').trim();
    const s = String(stip || '').trim();
    const p = String(partTitle || '').trim();
    return s || p || t || 'Match Album';
  }

  async function loadShowsFromCsv() {
    try {
      const res = await _fetchWithRetry(SHOWS_ENDPOINT, {
        attempts: 3,
        timeoutMs: 25000,
        baseDelayMs: 750,
        fetchOptions: { cache: 'no-store' }
      });
      const text = await res.text();
      if (!text.trim()) return [];

      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const headerLine = lines.shift();
      const header = parseCsvLine(headerLine);
      const rows = [];

      lines.forEach((line) => {
        const cols = parseCsvLine(line);
        const row = {};
        header.forEach((colName, i) => {
          row[String(colName || '').trim().toLowerCase()] = String(cols[i] || '').trim();
        });
        row.date = row.show_date || row.date || '';
        rows.push(row);
      });

      return rows;
    } catch (err) {
      console.error('Error loading wrestling people CSV:', err);
      return [];
    }
  }

  function buildPeopleIndex(rows) {
    const people = new Map();

    (rows || []).forEach((row) => {
      const showDateRaw = String((row && (row.show_date || row.date)) || '').trim();
      const showSlug = showDateSlugFromRaw(showDateRaw);
      const showTitle = String((row && (row.show_name || row.show || row.title || row.event || row.event_name)) || '').trim() || `Show ${showSlug || ''}`.trim();
      const showDatePretty = formatPrettyDate(showDateRaw);
      const sortValue = dateSortValue(showDateRaw);

      for (let idx = 1; idx <= 12; idx++) {
        const peopleCell = getMatchField(row, idx, 'people');
        const names = splitPeopleNames(peopleCell);
        if (!names.length) continue;

        const type = getMatchField(row, idx, 'type');
        const stip = getMatchField(row, idx, 'stip');
        const partTitle = getMatchField(row, idx, 'title');
        const urlCell = getMatchField(row, idx, 'url');
        const partSlug = getMatchRouteSlug(urlCell, idx);
        const detailTitle = buildMatchHeader(type, stip, partTitle);

        names.forEach((personName) => {
          const key = personName.toLowerCase();
          if (!people.has(key)) {
            people.set(key, {
              person: personName,
              slug: slugifyPersonName(personName),
              appearances: []
            });
          }
          people.get(key).appearances.push({
            showSlug,
            showTitle,
            showDateRaw,
            showDatePretty,
            sortValue,
            partIndex: idx,
            partSlug,
            type,
            stip,
            partTitle,
            detailTitle,
            route: showSlug ? `/wrestling/shows/${showSlug}/${partSlug}` : '/wrestling/shows'
          });
        });
      }
    });

    people.forEach((entry) => {
      entry.appearances.sort((a, b) => {
        if (b.sortValue !== a.sortValue) return b.sortValue - a.sortValue;
        return a.partIndex - b.partIndex;
      });
    });

    return people;
  }

  function getPersonSlugFromPath() {
    try {
      const parts = String(window.location.pathname || '').trim().replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
      if (String(parts[0] || '').toLowerCase() !== 'wrestling') return '';
      if (String(parts[1] || '').toLowerCase() !== 'people') return '';
      return slugifyPersonName(parts[2] || '');
    } catch (_) {
      return '';
    }
  }

  function syncPeoplePath(personName, opts) {
    const slug = slugifyPersonName(personName);
    const path = slug ? `/wrestling/people/${slug}` : '/wrestling/people';
    const target = path + (window.location.search || '');
    const method = (opts && opts.replace) ? 'replaceState' : 'pushState';
    try {
      window.history[method]({}, '', target);
    } catch (_) {}
  }

  function findPersonBySlug(slug) {
    const clean = slugifyPersonName(slug);
    if (!clean) return '';
    let match = '';
    _peopleMap.forEach((entry) => {
      if (!match && entry && entry.slug === clean) match = entry.person;
    });
    return match;
  }

  function fmtInt(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0';
    try { return Math.round(x).toLocaleString(); } catch (_) { return String(Math.round(x)); }
  }

  function letterForName(name) {
    const s = String(name || '').trim();
    if (!s) return '#';
    const ch = s[0].toUpperCase();
    return (ch >= 'A' && ch <= 'Z') ? ch : '#';
  }

  function renderMeta() {
    const metaEl = _root && _root.querySelector('#waPeopleMeta');
    if (!metaEl) return;
    const totalPeople = _peopleMap.size;
    let totalAppearances = 0;
    _peopleMap.forEach((entry) => {
      totalAppearances += Array.isArray(entry && entry.appearances) ? entry.appearances.length : 0;
    });
    metaEl.textContent = `${fmtInt(totalPeople)} performers indexed • ${fmtInt(totalAppearances)} match and segment appearances`;
  }

  function renderLetterNav() {
    const nav = _root && _root.querySelector('#waPeopleLetterNav');
    if (!nav) return;
    if (_view.mode === 'person') {
      nav.style.display = 'none';
      return;
    }
    nav.style.display = '';

    const counts = {};
    for (let i = 65; i <= 90; i++) counts[String.fromCharCode(i)] = 0;

    _peopleMap.forEach((entry) => {
      const L = letterForName(entry.person);
      counts[L] = (counts[L] || 0) + 1;
    });

    const makeBtn = (label, key, disabled) => {
      const isActive = (!key && !_activeLetter) || (_activeLetter === key);
      return `
        <button type="button" class="waPeopleLetterBtn${isActive ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}" data-letter="${escapeHtml(key || 'ALL')}" ${disabled ? 'disabled' : ''}>${escapeHtml(label)}</button>
      `;
    };

    const parts = [makeBtn('All', '', false)];
    for (let i = 65; i <= 90; i++) {
      const L = String.fromCharCode(i);
      parts.push(makeBtn(L, L, !counts[L]));
    }
    nav.innerHTML = parts.join('');
  }

  function renderPeopleList() {
    const body = _root && _root.querySelector('#waPeopleBody');
    if (!body) return;

    const entries = Array.from(_peopleMap.values())
      .filter((entry) => !_activeLetter || letterForName(entry.person) === _activeLetter)
      .sort((a, b) => a.person.localeCompare(b.person));

    if (!entries.length) {
      body.innerHTML = `<div class="waPeopleEmpty">No performers matched that letter yet. Try another letter or switch back to All.</div>`;
      return;
    }

    body.innerHTML = `
      <div class="waPeopleGrid">
        ${entries.map((entry) => {
          const latest = entry.appearances && entry.appearances[0] ? entry.appearances[0] : null;
          return `
            <button type="button" class="waPeopleCard" data-person="${escapeHtml(entry.person)}" aria-label="Open ${escapeHtml(entry.person)}">
              <div class="waPeopleCardName">${escapeHtml(entry.person)}</div>
              <div class="waPeopleCardMeta">${fmtInt(entry.appearances.length)} appearances</div>
              <div class="waPeopleCardSub">${latest ? `${escapeHtml(latest.showDatePretty || latest.showDateRaw)} • ${escapeHtml(latest.showTitle)}` : 'No appearances available yet.'}</div>
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderPersonDetail(personName) {
    const body = _root && _root.querySelector('#waPeopleBody');
    if (!body) return;

    const entry = _peopleMap.get(String(personName || '').toLowerCase());
    if (!entry) {
      _view = { mode: 'list', person: '' };
      syncPeoplePath('', { replace: true });
      renderLetterNav();
      renderPeopleList();
      return;
    }

    const appearances = Array.isArray(entry.appearances) ? entry.appearances : [];
    body.innerHTML = `
      <div class="waPeopleDetailHead">
        <button type="button" class="waPeopleBack" data-action="back">Back to performers</button>
        <div class="waPeopleDetailTitle">${escapeHtml(entry.person)}</div>
        <div class="waPeopleDetailMeta">${fmtInt(appearances.length)} indexed appearances</div>
      </div>
      <div class="waPeopleDetailList">
        ${appearances.map((item) => `
          <button type="button" class="waPeopleAppearanceCard" data-route="${escapeHtml(item.route)}" aria-label="Open ${escapeHtml(item.detailTitle)}">
            <div>
              <div class="waPeopleAppearanceEyebrow">${escapeHtml(item.showTitle)}</div>
              <div class="waPeopleAppearanceTitle">${escapeHtml(item.detailTitle)}</div>
              <div class="waPeopleAppearanceSub">${escapeHtml(item.showDatePretty || item.showDateRaw)}${item.type ? ` • ${escapeHtml(item.type)}` : ''}</div>
            </div>
            <div class="waPeopleJump">Open Match</div>
          </button>
        `).join('')}
      </div>
    `;
  }

  function renderCurrentView() {
    renderMeta();
    renderLetterNav();
    if (_view.mode === 'person' && _view.person) renderPersonDetail(_view.person);
    else renderPeopleList();
  }

  function openPerson(personName, opts) {
    const who = String(personName || '').trim();
    if (!who) return;
    _view = { mode: 'person', person: who };
    if (!opts || opts.syncUrl !== false) syncPeoplePath(who, { replace: !!(opts && opts.replace) });
    renderCurrentView();
    try {
      const panel = _panel || document.getElementById('wrestlingContentPanel');
      if (panel) panel.scrollTop = 0;
    } catch (_) {}
  }

  function backToList(opts) {
    _view = { mode: 'list', person: '' };
    syncPeoplePath('', { replace: !!(opts && opts.replace) });
    renderCurrentView();
  }

  function jumpToRoute(route) {
    const target = String(route || '').trim();
    if (!target) return;
    try {
      window.history.pushState({}, '', target + (window.location.search || ''));
    } catch (_) {}
    try {
      window.WrestlingArchive && window.WrestlingArchive.setMode && window.WrestlingArchive.setMode('shows', { replace: true, preservePath: true });
    } catch (_) {}
  }

  function bindEvents() {
    if (!_root || _root._waPeopleBound) return;
    _root._waPeopleBound = true;
    _root.addEventListener('click', (e) => {
      const target = e.target;
      const letterBtn = target && target.closest ? target.closest('[data-letter]') : null;
      if (letterBtn) {
        const raw = String(letterBtn.getAttribute('data-letter') || '').trim().toUpperCase();
        _activeLetter = (!raw || raw === 'ALL') ? null : raw;
        renderCurrentView();
        return;
      }

      const personCard = target && target.closest ? target.closest('[data-person]') : null;
      if (personCard) {
        openPerson(personCard.getAttribute('data-person'));
        return;
      }

      const backBtn = target && target.closest ? target.closest('[data-action="back"]') : null;
      if (backBtn) {
        backToList();
        return;
      }

      const routeCard = target && target.closest ? target.closest('[data-route]') : null;
      if (routeCard) jumpToRoute(routeCard.getAttribute('data-route'));
    });
  }

  async function onMount(panelEl) {
    ensureStyles();
    _panel = panelEl || document.getElementById('wrestlingContentPanel') || document.body;
    const _myMountToken = ++_mountToken;

    _root = _panel.querySelector('#waPeopleRoot');
    if (!_root) {
      _panel.innerHTML = render();
      _root = _panel.querySelector('#waPeopleRoot');
    }

    bindEvents();
    try { _wakeBackendOnce(); } catch (_) {}

    SHOWS = await loadShowsFromCsv();
    if (_myMountToken !== _mountToken) return;

    _peopleMap = buildPeopleIndex(SHOWS);

    try {
      const bp = _root.querySelector('#waPeopleBootPanel');
      if (bp && bp.parentNode) bp.parentNode.removeChild(bp);
    } catch (_) {}

    const personSlug = getPersonSlugFromPath();
    if (personSlug) {
      const personName = findPersonBySlug(personSlug);
      _view = personName ? { mode: 'person', person: personName } : { mode: 'list', person: '' };
    } else {
      _view = { mode: 'list', person: '' };
    }

    renderCurrentView();
  }

  function destroy() {
    SHOWS = [];
    _peopleMap = new Map();
    _panel = null;
    _root = null;
    _view = { mode: 'list', person: '' };
    _activeLetter = null;
  }

  window.WrestlingArchivePeople = { render, onMount, destroy, openPerson };
})();
