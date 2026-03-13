// music-archive-people.js
// Step 2-3 (People tab):
// - Build a People index (album counts only) from SmugMug album keywords (on-demand).
// - Step 3: Click a person to view the albums they appear in (album-level drill-in).
// - Fail-soft: if any album/folder/meta fails, continue.
// - Surgical: does not touch Bands/Shows modules or Buy Photos behavior.

(function () {
  'use strict';

  // UI safety: hide destructive controls from public UI.
  // Keep rebuild logic in-place for easy re-enable later.
  const SHOW_REBUILD_BUTTON = false;

  // ================== CONFIG (match music-archive-bands.js) ==================
  const DEFAULT_API_BASE = 'https://music-archive-3lfa.onrender.com';
  const API_BASE =
    (typeof window !== 'undefined' &&
      typeof window.MUSIC_ARCHIVE_API_BASE === 'string' &&
      window.MUSIC_ARCHIVE_API_BASE.trim())
      ? window.MUSIC_ARCHIVE_API_BASE.trim().replace(/\/$/, '')
      : DEFAULT_API_BASE;

  const CSV_ENDPOINT = `${API_BASE}/sheet/bands`;
  const PEOPLE_SHOWS_CSV_ENDPOINT = `${API_BASE}/sheet/shows`;
  const PEOPLE_MATCH_PREVIEW_LIMIT = 8;

  // where each region actually lives on SmugMug (kept from your script.js)
  const REGION_FOLDER_BASE = {
    Local: 'Music/Archives/Bands/Local',
    Regional: 'Music/Archives/Bands/Regional',
    National: 'Music/Archives/Bands/National',
    International: 'Music/Archives/Bands/International',
  };
  
    // ================== STATE ==================
  let panelRoot = null;
  let _buildPromise = null;

  // Prevent bursty duplicate loads (e.g., multiple onMount calls in quick succession)
  // without changing the server/cache behavior.
  let _peopleIndexLoadPromise = null;
  let _peopleIndexLastLoadAt = 0;
  let _peopleQuietRefreshDone = false;

  // People index: Map(personName -> Set(albumKey))
  let _peopleIndex = null;

  // People index generatedAt (from server), used to detect newer data
  let _peopleIndexGeneratedAt = '';

  // Album stub cache: Map(albumKey -> { title?, url?, urlPath?, niceUrl? })
  let _albumStubByKey = new Map();

  // Album meta cache: Map(albumKey -> { title, url })
  let _albumMetaByKey = new Map();

  // Show lookup cache used for People timeline metadata.
  let _peopleShowsLookupPromise = null;
  let _peopleShowsLookup = new Map();
  let _peopleBandNameLookupPromise = null;
  let _peopleBandNameByFolder = new Map();

  // Album thumb cache: Map(albumKey -> imageUrl)
  let _albumThumbByKey = new Map();

// Person-view album accordion + caption-match shots cache
let _openPersonAlbumKey = '';
const _albumCaptionMatchCache = new Map(); // albumKey -> { forPerson: string, shots: Array<{imageKey, thumbUrl}> }

// Lightbox (People caption-match shots)
let _peopleLightboxEl = null;
let _peopleLightboxImg = null;
let _peopleLightboxIndex = 0;
let _peopleLightboxList = [];
const _peopleFullUrlByImageKey = new Map(); // imageKey -> full-res URL

  // Photo count cache: Map(personName -> Number)
  let _photoCountByPerson = new Map();

  // Header totals (computed client-side)
  let _peopleTotals = { people: 0, photos: 0, albums: 0 };

  // People Stats (from Stats CSV)
  // Static override (per project request) to avoid relying on /sheet/stats parsing.
  // Keep the loader code in place for easy re-enable later.
  let _statsTotalShots = 61289; // Number|null
  let _statsLoadPromise = null;

  // People stats collapsible UI state
  let _peopleStatsCollapsed = true;

  // When using the server-side people index, we seed this cache up-front.

  // View state
  let _view = { mode: 'list', person: '', albumKeys: [] };

  // Letter filter (A-Z). null = no selection / blank state
  let _peopleLetter = null;

  // Re-render token to avoid stale async writes
  let _lastRenderToken = 0;

  // ================== UTIL ==================
  function _eh(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function _cssEscape(s) {
    const v = String(s || '');
    try {
      if (typeof CSS !== 'undefined' && CSS && typeof CSS.escape === 'function') return CSS.escape(v);
    } catch (_) {}
    // Minimal fallback: escape quotes and backslashes.
    return v.replace(/\\/g, '\\\\').replace(/\"/g, '\\"');
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

  function cleanFolderPath(s) {
    return (s || '').replace(/[:]/g, '').trim();
  }

  const toSlug = (s) =>
    (s || '')
      .trim()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9\s-]+/gi, '')
      .replace(/\s+/g, '-')
      .toLowerCase();

  function _normKey(s) {
    return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function _coerceArray(x) {
    if (!x) return [];
    if (Array.isArray(x)) return x;
    return [x];
  }

  function _safeTrim(x) {
    return String(x || '').trim();
  }

  function _pickFirst(obj, keys) {
    for (const k of keys) {
      if (!obj) continue;
      const v = obj[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
  }

  function _resolveAlbumUrlFromMeta(album) {
    if (!album) return '';
    const direct = _pickFirst(album, ['WebUri', 'Url', 'URL', 'Uri', 'AlbumUri', 'AlbumURL']);
    if (direct) return direct;

    const urlPath = _pickFirst(album, ['UrlPath', 'URLPath', 'Path', 'WebPath']);
    if (urlPath) {
      // If it's a full URL already
      if (/^https?:\/\//i.test(urlPath)) return urlPath;
      // If it looks like a SmugMug path starting with '/'
      if (urlPath[0] === '/') {
        // If the page already runs on a SmugMug domain, relative is fine.
        return urlPath;
      }
    }

    return '';
  }

  function _fmtInt(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0';
    try { return Math.round(x).toLocaleString(); } catch (_) { return String(Math.round(x)); }
  }

  // Try to extract a leading date from an album/show title.
  // Supports patterns like:
  //   "5/3/25 - The Benefit..."
  //   "05-03-2025 The Benefit..."
  //   "2025-05-03 - ..."
  // Returns { dateText, restTitle }
  function _splitDateFromTitle(title) {
    const raw = String(title || '').trim();
    if (!raw) return { dateText: '', restTitle: '' };

    // YYYY-MM-DD ...
    let m = raw.match(/^\s*(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\s*(?:[-\u2013\u2014:]\s*)?(.*)$/);
    if (m) {
      const yyyy = m[1];
      const mm = String(m[2]).padStart(2, '0');
      const dd = String(m[3]).padStart(2, '0');
      const rest = String(m[4] || '').trim();
      return { dateText: `${mm}/${dd}/${yyyy.slice(-2)}`, restTitle: rest };
    }

    // M/D/YY ... or M-D-YYYY ...
    m = raw.match(/^\s*(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\s*(?:[-\u2013\u2014:]\s*)?(.*)$/);
    if (m) {
      const mm = String(m[1]).padStart(2, '0');
      const dd = String(m[2]).padStart(2, '0');
      let yy = String(m[3] || '').trim();
      if (yy.length === 4) yy = yy.slice(-2);
      const rest = String(m[4] || '').trim();
      return { dateText: `${mm}/${dd}/${yy}`, restTitle: rest };
    }

    return { dateText: '', restTitle: raw };
  }

function _dateSortValueFromDateText(dateText){
  const s = String(dateText || '').trim();
  // Expect MM/DD/YY
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!m) return 0;
  const mm = Number(m[1]);
  const dd = Number(m[2]);
  const yy = Number(m[3]);
  if (!Number.isFinite(mm) || !Number.isFinite(dd) || !Number.isFinite(yy)) return 0;
  const yyyy = (yy >= 70) ? (1900 + yy) : (2000 + yy);
  return (yyyy * 10000) + (mm * 100) + dd;
}

function _ordinalSuffix(day) {
  const n = Number(day);
  if (!Number.isFinite(n)) return '';
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function _formatLongDateFromShort(dateText) {
  const s = String(dateText || '').trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!m) return s;

  const mm = Number(m[1]);
  const dd = Number(m[2]);
  const yy = Number(m[3]);
  if (!Number.isFinite(mm) || !Number.isFinite(dd) || !Number.isFinite(yy)) return s;

  const yyyy = (yy >= 70) ? (1900 + yy) : (2000 + yy);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNames[mm - 1];
  if (!monthName) return s;

  return `${monthName} ${dd}${_ordinalSuffix(dd)}, ${yyyy}`;
}


  function _letterForName(name) {
    const s = String(name || '').trim();
    if (!s) return '#';
    const ch = s[0].toUpperCase();
    return (ch >= 'A' && ch <= 'Z') ? ch : '#';
  }

  function _setPeopleLetter(letter) {
    const v = String(letter || '').trim().toUpperCase();
    _peopleLetter = (!v || v === 'ALL') ? null : v;
  }

  function _getPeopleLetter() {
    return _peopleLetter || null;
  }

  function renderPeopleLetterNav(indexMap) {
    if (!panelRoot) return;
    const navEl = panelRoot.querySelector('#peopleLetterNav');
    if (!navEl) return;

    // Only show on list view
    try {
      navEl.style.display = (_view && _view.mode === 'person') ? 'none' : '';
    } catch (_) {}

    const counts = {};
    for (let i = 65; i <= 90; i++) counts[String.fromCharCode(i)] = 0;
    counts['#'] = 0;

    try {
      if (indexMap && typeof indexMap.forEach === 'function') {
        indexMap.forEach((_set, name) => {
          const L = _letterForName(name);
          if (!(L in counts)) counts[L] = 0;
          counts[L] += 1;
        });
      }
    } catch (_) {}

    const active = _getPeopleLetter();
    const btn = (label, key, disabled) => {
      const isActive = (!key && !active) || (key && active === key);
      const dis = !!disabled;
      return `
        <button type="button"
          class="peopleLetterBtn${isActive ? ' is-active' : ''}${dis ? ' is-disabled' : ''}"
          data-letter="${_eh(key || 'ALL')}"
          ${dis ? 'disabled' : ''}>
          ${_eh(label)}
        </button>
      `;
    };

    const parts = [];
    for (let i = 65; i <= 90; i++) {
      const L = String.fromCharCode(i);
      parts.push(btn(L, L, counts[L] === 0));
    }
    parts.push(btn('#', '#', counts['#'] === 0));

    navEl.innerHTML = parts.join('');
  }

  function _renderPeopleFilterMeta(totalCount, shownCount) {
    if (!panelRoot) return;
    const el = panelRoot.querySelector('#peopleFilterMeta');
    if (!el) return;
    const t = Number(totalCount) || 0;
    const s = Number(shownCount) || 0;
    const L = _getPeopleLetter();
    if (!L) {
      el.textContent = '';
      return;
    }
    el.textContent = `Showing ${_fmtInt(s)} of ${_fmtInt(t)} (${L})`;
  }
  function _computePeopleTotals(indexMap) {
    const idx = indexMap && typeof indexMap.forEach === 'function' ? indexMap : new Map();
    const albumSet = new Set();
    let photos = 0;
    let people = 0;
    try {
      idx.forEach((set, name) => {
        people += 1;
        try {
          const v = _photoCountByPerson && _photoCountByPerson.has(name) ? Number(_photoCountByPerson.get(name)) : 0;
          if (Number.isFinite(v)) photos += v;
        } catch (_) {}
        try {
          if (set && typeof set.forEach === 'function') {
            set.forEach((k) => {
              const kk = String(k || '').trim();
              if (kk) albumSet.add(kk);
            });
          }
        } catch (_) {}
      });
    } catch (_) {}
    return { people, photos, albums: albumSet.size };
  }

  function _renderPeopleTotals(totals) {
    // Back-compat: keep the old totals pill if it still exists in markup.
    if (!panelRoot) return;
    const el = panelRoot.querySelector('#peopleTotals');
    if (el) {
      const t = totals || { people: 0, photos: 0, albums: 0 };
      el.textContent = `${_fmtInt(t.people)} PEOPLE \u2022 ${_fmtInt(t.photos)} PHOTOS \u2022 ${_fmtInt(t.albums)} ALBUMS`;
    }

    // New People Stats tiles.
    try { renderPeopleStatsTiles(); } catch (_) {}
  }

  // ================== PEOPLE STATS (tiles) ==================
  // NOTE: bumped cache key to avoid persisting a previously cached error/empty response.
  const PEOPLE_STATS_CSV_CACHE_KEY = 'vm_music_people_stats_csv_v2';
  const PEOPLE_STATS_CSV_TTL_MS = 1000 * 60 * 60 * 6; // 6h

  function _parseNumLoose(s) {
    const v = String(s ?? '').replace(/[,\s]/g, '').trim();
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }

  function _parseTotalShotsFromStatsCsv(csvText) {
    const raw = String(csvText || '').trim();
    if (!raw) return null;

    const lines = raw.split(/\r?\n/).filter((l) => String(l || '').trim());
    if (lines.length < 2) return null;

    const header = parseCsvLine(lines[0]).map((h) => String(h || '').trim());
    // Prefer a column named "Total"; fall back to the last column.
    let idx = header.findIndex((h) => String(h || '').toLowerCase() === 'total');
    if (idx < 0) idx = Math.max(0, header.length - 1);

    // Find the first data row that yields a valid number in the chosen column.
    for (let i = 1; i < lines.length; i++) {
      const row = parseCsvLine(lines[i]);
      const cell = (idx >= 0 && idx < row.length) ? row[idx] : '';
      const n = _parseNumLoose(cell);
      if (Number.isFinite(n)) return n;
    }
    return null;
  }

  async function loadPeopleStatsTotalShots() {
    if (_statsTotalShots !== null) return _statsTotalShots;
    if (_statsLoadPromise) return _statsLoadPromise;

    _statsLoadPromise = (async () => {
      try {
        const url = `${API_BASE}/sheet/stats`;
        const txt = await fetchTextWithSessionCache(url, PEOPLE_STATS_CSV_TTL_MS, PEOPLE_STATS_CSV_CACHE_KEY);
        const total = _parseTotalShotsFromStatsCsv(txt);
        _statsTotalShots = (total !== null) ? total : 0;
        return _statsTotalShots;
      } catch (_) {
        _statsTotalShots = 0;
        return _statsTotalShots;
      } finally {
        _statsLoadPromise = null;
      }
    })();

    return _statsLoadPromise;
  }

  function _fmtPct(n, digits) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0%';
    const d = Number.isFinite(Number(digits)) ? Math.max(0, Math.min(4, Number(digits))) : 2;
    try { return `${x.toFixed(d)}%`; } catch (_) { return `${Math.round(x * 100) / 100}%`; }
  }

  function _fmtPeopleGeneratedAt(value) {
    const raw = String(value || '').trim();
    if (!raw) return 'Last updated: --';

    const date = new Date(raw);
    if (!Number.isFinite(date.getTime())) return 'Last updated: --';

    try {
      const formatted = new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(date);
      return `Last updated: ${formatted}`;
    } catch (_) {
      return `Last updated: ${date.toLocaleString()}`;
    }
  }

  function renderPeopleStatsTiles() {
    if (!panelRoot) return;

    const t = _peopleTotals || { people: 0, photos: 0, albums: 0 };

    const elPeople = panelRoot.querySelector('#peopleStatPeople');
    const elPhotos = panelRoot.querySelector('#peopleStatPhotos');
    const elAlbums = panelRoot.querySelector('#peopleStatAlbums');
    const elTotal = panelRoot.querySelector('#peopleStatTotalShots');
    const elPct = panelRoot.querySelector('#peopleStatPercent');
    const elUpdated = panelRoot.querySelector('#peopleStatUpdated');
    const elBarFill = panelRoot.querySelector('#peopleDashBarFill');

    if (elPeople) elPeople.textContent = _fmtInt(t.people);
    if (elPhotos) elPhotos.textContent = _fmtInt(t.photos);
    if (elAlbums) elAlbums.textContent = _fmtInt(t.albums);
    if (elUpdated) {
      const updatedText = _fmtPeopleGeneratedAt(_peopleIndexGeneratedAt);
      elUpdated.textContent = updatedText;
      elUpdated.title = String(_peopleIndexGeneratedAt || '').trim() || updatedText;
    }

    // Total Shots + Percent need the Stats CSV.
    // Render best-effort immediately; update once loaded.
    const applyTotalAndPct = (totalShots) => {
      const total = Number(totalShots);
      if (elTotal) elTotal.textContent = _fmtInt(Number.isFinite(total) ? total : 0);
      const pct = (Number.isFinite(total) && total > 0)
        ? (Number(t.photos || 0) / total) * 100
        : 0;
      const pctText = _fmtPct(pct, 2);
      const pctWhole = `${Math.round(pct)}%`;

      if (elPct) elPct.textContent = pctText;
        const clampedPct = Math.max(0, Math.min(100, pct));

      if (elBarFill) elBarFill.style.width = `${clampedPct}%`;
      try {
        const statsBlock = panelRoot && panelRoot.querySelector('.peopleStatsBlock');
        if (statsBlock) {
          statsBlock.style.setProperty('--people-index-pct', `${clampedPct}%`);
          statsBlock.style.setProperty('--people-gauge-pct', `${clampedPct}`);
        }
      } catch (_) {}
    };

    if (_statsTotalShots !== null) {
      applyTotalAndPct(_statsTotalShots);
    } else {
      applyTotalAndPct(0);
      // Fire-and-forget; safe rerender.
      loadPeopleStatsTotalShots().then(applyTotalAndPct).catch(() => {});
    }
  }

  // ---- Concurrency limiter (prevents request stampede) ----
  function pLimit(max) {
    let active = 0;
    const queue = [];
    const next = () => {
      if (active >= max || !queue.length) return;
      active++;
      const { fn, resolve, reject } = queue.shift();
      Promise.resolve()
        .then(fn)
        .then(resolve, reject)
        .finally(() => {
          active--;
          next();
        });
    };
    return (fn) =>
      new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
        next();
      });
  }

  // Keep conservative to avoid bursts in webviews
  const limitNet = pLimit(1);

  // ---- Session cache (Bands CSV) ----
  const PEOPLE_BANDS_CSV_CACHE_KEY = 'vm_music_people_bands_csv_v1';
  const PEOPLE_BANDS_CSV_TTL_MS = 1000 * 60 * 30;
  const PEOPLE_SHOWS_CSV_CACHE_KEY = 'vm_music_people_shows_csv_v1';
  const PEOPLE_SHOWS_CSV_TTL_MS = 1000 * 60 * 30;

  // ---- Session cache (People index) ----
  // Stores a compact mapping:
  //   {
  //     t: <timestamp>,
  //     v: { personName: [albumKey, ...], ... },
  //     p: { personName: <photoCount>, ... }   // optional (new)
  //   }
  // Keeps rebuilds from happening on every People click, AND preserves photo counts
  // so the header totals don't fall back to 0 after a refresh.
  const PEOPLE_INDEX_CACHE_KEY = 'vm_music_people_index_v1';
  const PEOPLE_INDEX_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

  function loadPeopleIndexFromSession() {
    try {
      const now = Date.now();
      const raw = sessionStorage.getItem(PEOPLE_INDEX_CACHE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || !obj.t || !obj.v) return null;
      if (now - Number(obj.t) > PEOPLE_INDEX_TTL_MS) return null;

      const v = obj.v;
      if (!v || typeof v !== 'object') return null;

      const map = new Map();
      for (const [person, keys] of Object.entries(v)) {
        const p = String(person || '').trim();
        if (!p) continue;
        const arr = Array.isArray(keys) ? keys : [];
        const set = new Set(arr.map((k) => String(k || '').trim()).filter(Boolean));
        if (set.size) map.set(p, set);
      }

      // Restore photo counts if present (newer cache schema)
      try {
        const pObj = obj.p && typeof obj.p === 'object' ? obj.p : null;
        if (pObj) {
          _photoCountByPerson = new Map();
          for (const [person, cnt] of Object.entries(pObj)) {
            const name = String(person || '').trim();
            if (!name) continue;
            const n = Number(cnt);
            _photoCountByPerson.set(name, Number.isFinite(n) ? n : 0);
          }
        }
      } catch (_) {}

      try { _peopleIndexGeneratedAt = (obj && obj.g) ? String(obj.g) : ''; } catch (_) {}

      return map.size ? map : null;
    } catch (_) {
      return null;
    }
  }

  function savePeopleIndexToSession(map, photoMap) {
    try {
      if (!map || typeof map.forEach !== 'function') return;
      const v = {};
      map.forEach((set, person) => {
        const p = String(person || '').trim();
        if (!p) return;
        const arr = Array.from(set || []).map((k) => String(k || '').trim()).filter(Boolean);
        if (arr.length) v[p] = arr;
      });

      // Persist photo counts too (if available) so totals remain correct after refresh.
      const pm = (photoMap && typeof photoMap.forEach === 'function') ? photoMap : _photoCountByPerson;
      const p = {};
      try {
        if (pm && typeof pm.forEach === 'function') {
          pm.forEach((cnt, name) => {
            const k = String(name || '').trim();
            if (!k) return;
            const n = Number(cnt);
            p[k] = Number.isFinite(n) ? n : 0;
          });
        }
      } catch (_) {}

      sessionStorage.setItem(PEOPLE_INDEX_CACHE_KEY, JSON.stringify({ t: Date.now(), v, p, g: _peopleIndexGeneratedAt || '' }));
    } catch (_) {}
  }


  function resetPeopleIndexCacheState() {
    _peopleIndex = null;
    _buildPromise = null;
    _peopleIndexLoadPromise = null;
    _peopleIndexLastLoadAt = 0;
    _peopleIndexGeneratedAt = '';
    _peopleQuietRefreshDone = false;
    _albumMetaByKey = new Map();
    try { sessionStorage.removeItem(PEOPLE_INDEX_CACHE_KEY); } catch (_) {}
  }

  function quietlyRefreshPeopleIndex(token) {
    if (_peopleQuietRefreshDone) return;
    _peopleQuietRefreshDone = true;
    const prevGeneratedAt = String(_peopleIndexGeneratedAt || '');

    loadPeopleIndexFromServer({ force: false, token })
      .then((idx) => {
        if (token !== _lastRenderToken) return;
        const nextGeneratedAt = String(_peopleIndexGeneratedAt || '');
        if (!idx || !idx.size || nextGeneratedAt === prevGeneratedAt) return;
        _peopleIndex = idx;
        try { savePeopleIndexToSession(_peopleIndex, _photoCountByPerson); } catch (_) {}
        if (_view && _view.mode === 'person' && _view.person) {
          showPerson(_view.person, token);
        } else {
          renderPeopleList(_peopleIndex);
        }
      })
      .catch((err) => {
        console.warn('[people] quiet refresh failed:', err);
      });
  }

  async function fetchTextWithSessionCache(url, ttlMs, cacheKey) {
    try {
      const now = Date.now();
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && obj.t && obj.v && now - obj.t < ttlMs) return String(obj.v);
      }
    } catch (_) {}

    const res = await fetch(url, { cache: 'no-store' });
    const txt = await res.text();

    // Never cache error payloads (prevents persisting "stats sheet error" etc.).
    if (!res || !res.ok) {
      const msg = String(txt || '').slice(0, 180).replace(/\s+/g, ' ').trim();
      throw new Error(`HTTP ${res ? res.status : 0} (${url})${msg ? ': ' + msg : ''}`);
    }

    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), v: txt }));
    } catch (_) {}
    return txt;
  }

  // ================== SMUGMUG API HELPERS (match bands module) ==================
  async function fetchJsonSafe(url, opts) {
    const o = opts || {};
    const timeoutMs = Number(o.timeoutMs || 25000);
    const maxRetries = Number(o.retries || 1);
    const retryStatuses = new Set([429, 500, 502, 503, 504]);

    let attempt = 0;
    while (true) {
      attempt++;
      const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const t = ac ? setTimeout(() => { try { ac.abort(); } catch (_) {} }, timeoutMs) : null;
      try {
        const res = await fetch(url, { signal: ac ? ac.signal : undefined });
        const ct = String(res.headers.get('content-type') || '').toLowerCase();
        const bodyText = await res.text();

        if (!res.ok) {
          if (attempt <= maxRetries && retryStatuses.has(res.status)) {
            let retryAfterMs = 0;
            try {
              if (res.status === 429) {
                const ra = String(res.headers.get('retry-after') || '').trim();
                const secs = Number(ra);
                if (Number.isFinite(secs) && secs > 0) retryAfterMs = Math.min(15000, Math.round(secs * 1000));
              }
            } catch (_) {}

            const expBackoff = Math.min(1500, 250 * Math.pow(2, attempt - 1));
            const jitter = Math.floor(Math.random() * 250);
            const backoff = Math.max(expBackoff, retryAfterMs) + jitter;
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }
          const snippet = bodyText.slice(0, 180).replace(/\s+/g, ' ').trim();
          throw new Error(`HTTP ${res.status} ${res.statusText || ''} (${ct || 'unknown'}): ${snippet}`);
        }

        if (bodyText && /^[\s]*</.test(bodyText)) {
          throw new Error(`Expected JSON but got HTML (${ct || 'unknown'})`);
        }

        try {
          return JSON.parse(bodyText || 'null');
        } catch (e) {
          throw new Error(`Invalid JSON: ${String(e && e.message ? e.message : e)}`);
        }
      } catch (err) {
        if (attempt <= maxRetries) {
          const expBackoff = Math.min(1500, 250 * Math.pow(2, attempt - 1));
          const jitter = Math.floor(Math.random() * 250);
          const backoff = expBackoff + jitter;
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        throw err;
      } finally {
        try { if (t) clearTimeout(t); } catch (_) {}
      }
    }
  }

  async function fetchFolderAlbums(folderPath, region) {
    const safeFolder = cleanFolderPath(folderPath || '');
    const baseSlug = toSlug(safeFolder || '');
    const url = `${API_BASE}/smug/${encodeURIComponent(baseSlug)}?folder=${encodeURIComponent(
      safeFolder
    )}&region=${encodeURIComponent(region || '')}&count=200&start=1`;

    const data = await fetchJsonSafe(url, { retries: 2 });
    const albumsRaw = (data && data.Response && (data.Response.Album || data.Response.Albums)) || [];
    if (Array.isArray(albumsRaw)) return albumsRaw;
    return albumsRaw ? [albumsRaw] : [];
  }

  // ================== PEOPLE CAPTION PARSING (photo-level) ==================
  // We read semicolon-delimited names from *photo Caption* metadata.
  // Example caption: "Rich Yanok; Box Rox"
  function parsePeopleCaption(caption) {
    const raw = String(caption || '').trim();
    if (!raw) return [];
    const parts = raw.split(';').map(s => String(s || '').trim()).filter(Boolean);
    // Deduplicate case-insensitively while preserving first seen casing
    const seen = new Set();
    const out = [];
    for (const p of parts) {
      const k = p.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(p);
    }
    return out;
  }

  async function fetchAlbumImagesPage(albumKey, count, start) {
  if (!albumKey) return null;
  const c = count || 200;
  const s = start || 1;
  const url = `${API_BASE}/smug/album/${encodeURIComponent(albumKey)}?count=${encodeURIComponent(c)}&start=${encodeURIComponent(s)}`;
  return fetchJsonSafe(url, { retries: 0 });
}

  function extractAlbumImagesFromPage(pageJson) {
    const resp = pageJson && pageJson.Response ? pageJson.Response : pageJson;
    const raw = (resp && (resp.AlbumImage || resp.AlbumImages)) ? (resp.AlbumImage || resp.AlbumImages) : [];
    if (Array.isArray(raw)) return raw;
    return raw ? [raw] : [];
  }

  function extractImageKeyFromAlbumImage(albumImage) {
    if (!albumImage) return '';
    const k = albumImage.ImageKey || (albumImage.Image && albumImage.Image.ImageKey) || albumImage.imageKey;
    return String(k || '').trim();
  }

  function extractCaptionFromAlbumImage(albumImage) {
    // Try a few common shapes. Some payloads may not include Caption unless expanded.
    return _pickFirst(albumImage, ['Caption', 'caption', 'Description', 'description']) ||
      _pickFirst(albumImage && albumImage.Image, ['Caption', 'caption', 'Description', 'description']) ||
      '';
  }

  function _extractThumbUrlFromAlbumImage(albumImage) {
    if (!albumImage) return '';
    // Prefer aspect-preserving preview sizes first.
    // SmugMug Thumbnail/Thumb URLs are often square-cropped, which makes the
    // People lightbox look like it is forcing photos into a square before the
    // full-res upgrade completes. Keep thumb-sized URLs as a last fallback only.
    return (
      _pickFirst(albumImage, ['LargestUrl', 'X3LargeUrl', 'XLargeUrl', 'LargeUrl', 'MediumUrl', 'SmallUrl', 'ThumbnailUrl', 'ThumbUrl', 'WebUri', 'Url', 'URL', 'Uri']) ||
      _pickFirst(albumImage && albumImage.Image, ['LargestUrl', 'X3LargeUrl', 'XLargeUrl', 'LargeUrl', 'MediumUrl', 'SmallUrl', 'ThumbnailUrl', 'ThumbUrl', 'WebUri', 'Url', 'URL', 'Uri']) ||
      ''
    );
  }

  async function fetchAlbumThumbUrl(albumKey) {
    const k = _safeTrim(albumKey);
    if (!k) return '';
    if (_albumThumbByKey.has(k)) return _albumThumbByKey.get(k) || '';

    try {
      const pageJson = await limitNet(() => fetchAlbumImagesPage(k, 1, 1).catch(() => null));
      if (!pageJson) {
        _albumThumbByKey.set(k, '');
        return '';
      }
      const images = extractAlbumImagesFromPage(pageJson);
      const first = images && images.length ? images[0] : null;
      const url = _extractThumbUrlFromAlbumImage(first);
      const out = String(url || '').trim();
      _albumThumbByKey.set(k, out);
      return out;
    } catch (_) {
      _albumThumbByKey.set(k, '');
      return '';
    }
  }

  // Fallback (heavier): fetch full image detail to read Caption if the album-image payload didn't include it.
  async function fetchImageCaptionByKey(imageKey) {
    if (!imageKey) return '';
    try {
      const detail = await fetchJsonSafe(`${API_BASE}/smug/image/${encodeURIComponent(imageKey)}`, { retries: 1 });
      const resp = detail && detail.Response ? detail.Response : detail;
      const img = resp && resp.Image ? resp.Image : (resp && resp.Response && resp.Response.Image ? resp.Response.Image : null);
      if (!img) return '';
      return _pickFirst(img, ['Caption', 'caption', 'Description', 'description']) || '';
    } catch (_) {
      return '';
    }
  }

  async function fetchPeopleFromAlbumByCaptions(albumKey, opts) {
    const o = opts || {};
    const maxPages = Math.max(1, Number(o.maxPages || 2));                 // safety cap
    const maxDetailFetches = Math.max(0, Number(o.maxDetailFetches || 40)); // safety cap
    const count = Math.max(50, Math.min(200, Number(o.pageSize || 200)));

    const people = new Set();
    let start = 1;
    let page = 0;
    let detailUsed = 0;

    while (page < maxPages) {
      page += 1;

      const pageJson = await limitNet(() => fetchAlbumImagesPage(albumKey, count, start).catch(() => null));
      if (!pageJson) break;

      const images = extractAlbumImagesFromPage(pageJson);
      if (!images.length) break;

      for (const it of images) {
        const directCaption = extractCaptionFromAlbumImage(it);
        let caption = directCaption;

        // If caption isn't present in this payload, optionally do a limited number of detail fetches.
        if (!caption && detailUsed < maxDetailFetches) {
          const imageKey = extractImageKeyFromAlbumImage(it);
          if (imageKey) {
            detailUsed += 1;
            caption = await limitNet(() => fetchImageCaptionByKey(imageKey));
          }
        }

        const names = parsePeopleCaption(caption);
        for (const n of names) people.add(n);
      }

      // Pagination: stop if fewer than requested (last page)
      if (images.length < count) break;
      start += count;
    }

    return Array.from(people.values());
  }


  async function fetchAlbumMetaLight(albumKey) {
    if (!albumKey) return null;
    if (_albumMetaByKey.has(albumKey)) return _albumMetaByKey.get(albumKey);

    try {
      const metaJson = await fetchJsonSafe(`${API_BASE}/smug/album-meta/${encodeURIComponent(albumKey)}`, { retries: 1 }).catch(
        () => null
      );
      const album = metaJson && metaJson.Response && metaJson.Response.Album;
      if (!album) return null;

      const title = _pickFirst(album, ['Title', 'Name', 'AlbumName']) || `Album ${albumKey}`;
      const url = _resolveAlbumUrlFromMeta(album);

      const out = { title, url, albumKey };
      _albumMetaByKey.set(albumKey, out);
      return out;
    } catch (err) {
      console.warn('[people] fetchAlbumMetaLight failed', albumKey, err);
      return null;
    }
  }

  // ================== PEOPLE INDEX BUILD ==================
  async function loadBandFoldersFromCsv() {
    const text = await fetchTextWithSessionCache(CSV_ENDPOINT, PEOPLE_BANDS_CSV_TTL_MS, PEOPLE_BANDS_CSV_CACHE_KEY);
    if (!text || !text.trim()) return [];

    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const headerLine = lines.shift();
    if (!headerLine) return [];

    const header = parseCsvLine(headerLine).map((h) => h.trim().toLowerCase());
    const smugFolderIdx = header.indexOf('smug_folder');
    const regionIdx = header.indexOf('region');

    if (smugFolderIdx === -1) return [];

    const seen = new Set();
    const out = [];
    for (const line of lines) {
      const cols = parseCsvLine(line);
      const folder = (cols[smugFolderIdx] || '').trim();
      if (!folder) continue;
      const region = (regionIdx !== -1 ? (cols[regionIdx] || '').trim() : '') || '';
      const key = `${_normKey(folder)}|${_normKey(region)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ folder, region });
    }
    return out;
  }

  function _normalizePeopleShowDate(dateText) {
    const s = String(dateText || '').trim();
    if (!s) return '';

    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      const mm = Number(m[1]);
      const dd = Number(m[2]);
      let yyyy = Number(m[3]);
      if (!Number.isFinite(mm) || !Number.isFinite(dd) || !Number.isFinite(yyyy)) return '';
      if (yyyy < 100) yyyy = yyyy >= 70 ? 1900 + yyyy : 2000 + yyyy;
      return `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }

    m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
    if (m) {
      return `${String(Number(m[1])).padStart(4, '0')}-${String(Number(m[2])).padStart(2, '0')}-${String(Number(m[3])).padStart(2, '0')}`;
    }

    return '';
  }

  function _normalizePeopleShowTitle(titleText) {
    return String(titleText || '')
      .toLowerCase()
      .replace(/[`"']/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function _peopleShowLookupKey(dateText, titleText) {
    const d = _normalizePeopleShowDate(dateText);
    const t = _normalizePeopleShowTitle(titleText);
    if (!d || !t) return '';
    return `${d}|${t}`;
  }

  function _peopleBandFolderKeyFromUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    try {
      const parsed = new URL(raw, (typeof window !== 'undefined' && window.location && window.location.href) ? window.location.href : 'https://vmpix.onrender.com');
      const parts = String(parsed.pathname || '').split('/').filter(Boolean);
      if (parts.length >= 2) return _normKey(decodeURIComponent(parts[parts.length - 2] || ''));
    } catch (_) {}
    return '';
  }

  async function ensurePeopleBandNameLookup() {
    if (_peopleBandNameLookupPromise) return _peopleBandNameLookupPromise;

    _peopleBandNameLookupPromise = (async () => {
      const text = await fetchTextWithSessionCache(CSV_ENDPOINT, PEOPLE_BANDS_CSV_TTL_MS, PEOPLE_BANDS_CSV_CACHE_KEY);
      const lookup = new Map();
      if (!text || !text.trim()) {
        _peopleBandNameByFolder = lookup;
        return lookup;
      }

      const lines = text.split(/\r?\n/).filter((l) => String(l || '').trim());
      const headerLine = lines.shift();
      if (!headerLine) {
        _peopleBandNameByFolder = lookup;
        return lookup;
      }

      const header = parseCsvLine(headerLine).map((h) => String(h || '').trim().toLowerCase());
      const bandIdx = header.indexOf('band');
      const folderIdx = header.indexOf('smug_folder');
      if (bandIdx === -1 || folderIdx === -1) {
        _peopleBandNameByFolder = lookup;
        return lookup;
      }

      for (const line of lines) {
        const cols = parseCsvLine(line);
        const bandName = _safeTrim(cols[bandIdx]);
        const folder = _normKey(cols[folderIdx]);
        if (!bandName || !folder || lookup.has(folder)) continue;
        lookup.set(folder, bandName);
      }

      _peopleBandNameByFolder = lookup;
      return lookup;
    })().catch((err) => {
      console.warn('[people] band lookup failed', err);
      _peopleBandNameByFolder = new Map();
      return _peopleBandNameByFolder;
    });

    return _peopleBandNameLookupPromise;
  }

  async function ensurePeopleShowsLookup() {
    if (_peopleShowsLookupPromise) return _peopleShowsLookupPromise;

    _peopleShowsLookupPromise = (async () => {
      const text = await fetchTextWithSessionCache(PEOPLE_SHOWS_CSV_ENDPOINT, PEOPLE_SHOWS_CSV_TTL_MS, PEOPLE_SHOWS_CSV_CACHE_KEY);
      const lookup = new Map();
      if (!text || !text.trim()) {
        _peopleShowsLookup = lookup;
        return lookup;
      }

      let rows = [];
      const raw = String(text || '').trim();
      if (/^[\[{]/.test(raw)) {
        try {
          const parsed = JSON.parse(raw);
          rows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.rows) ? parsed.rows : []);
        } catch (_) {
          rows = [];
        }
      }

      if (!rows.length) {
        const lines = raw.split(/\r?\n/).filter((l) => String(l || '').trim());
        const headerLine = lines.shift();
        if (headerLine) {
          const header = parseCsvLine(headerLine).map((h) => String(h || '').trim().toLowerCase());
          const nameIdx = header.indexOf('show_name') !== -1 ? header.indexOf('show_name') : header.indexOf('title');
          const dateIdx = header.indexOf('show_date') !== -1 ? header.indexOf('show_date') : header.indexOf('date');
          const bandIdxs = [];
          for (let n = 1; n <= 20; n++) bandIdxs.push(header.indexOf(`band_${n}`));
          rows = lines.map((line) => {
            const cols = parseCsvLine(line);
            return {
              title: nameIdx !== -1 ? (cols[nameIdx] || '').trim() : '',
              date: dateIdx !== -1 ? (cols[dateIdx] || '').trim() : '',
              bands: bandIdxs.map((ix) => (ix !== -1 ? (cols[ix] || '').trim() : '')).filter(Boolean),
            };
          });
        }
      }

      for (const row of rows) {
        const title = _safeTrim(row && row.title);
        const date = _safeTrim(row && row.date);
        const bands = Array.isArray(row && row.bands) ? row.bands.map((b) => _safeTrim(b)).filter(Boolean) : [];
        const key = _peopleShowLookupKey(date, title);
        if (!key || !bands.length) continue;
        if (!lookup.has(key)) lookup.set(key, bands);
      }

      _peopleShowsLookup = lookup;
      return lookup;
    })().catch((err) => {
      console.warn('[people] shows lookup failed', err);
      _peopleShowsLookup = new Map();
      return _peopleShowsLookup;
    });

    return _peopleShowsLookupPromise;
  }

  function _peopleAppearsWithTextForAlbum(item) {
    const urlBandKey = _peopleBandFolderKeyFromUrl(item && item.url);
    const bandName = urlBandKey ? (_peopleBandNameByFolder.get(urlBandKey) || '') : '';
    if (bandName) return `(appears with ${bandName})`;

    const rawTitle = String(item && item.title || '');
    const split = _splitDateFromTitle(rawTitle);
    const key = _peopleShowLookupKey(split.dateText || '', split.restTitle || rawTitle || '');
    if (!key) return '';
    const bands = _peopleShowsLookup.get(key) || [];
    if (!Array.isArray(bands) || !bands.length) return '';
    return `(appears with ${bands.join(' / ')})`;
  }

  async function hydratePeopleTimelineAppearsWith(items) {
    if (!panelRoot || !_view || _view.mode !== 'person') return;
    const renderPerson = _safeTrim(_view.person);
    if (!renderPerson || !Array.isArray(items) || !items.length) return;

    await Promise.all([ensurePeopleBandNameLookup(), ensurePeopleShowsLookup()]);

    if (!panelRoot || !_view || _view.mode !== 'person' || _safeTrim(_view.person) !== renderPerson) return;

    for (const item of items) {
      const albumKey = _safeTrim(item && item.albumKey);
      if (!albumKey) continue;
      const line = panelRoot.querySelector(`.peopleTimelineAppearsWith[data-albumkey="${_cssEscape(albumKey)}"]`);
      if (!line) continue;
      const text = _peopleAppearsWithTextForAlbum(item);
      if (text) {
        line.textContent = text;
        line.style.display = '';
      } else {
        line.textContent = '';
        line.style.display = 'none';
      }
    }
  }

  function _rememberAlbumStub(albumKey, albumObj) {
    if (!albumKey || !albumObj) return;
    if (_albumStubByKey.has(albumKey)) return;

    const title = _pickFirst(albumObj, ['Title', 'Name', 'AlbumName']);
    const urlPath = _pickFirst(albumObj, ['UrlPath', 'URLPath', 'Path']);
    const url = _pickFirst(albumObj, ['WebUri', 'Url', 'URL', 'Uri']);

    const stub = {
      albumKey,
      title: title || '',
      url: url || '',
      urlPath: urlPath || '',
    };

    // Best-effort resolved URL (relative paths are OK on SmugMug domain)
    stub.niceUrl = stub.url || (stub.urlPath ? stub.urlPath : '');

    _albumStubByKey.set(albumKey, stub);
  }

  // ================== STYLES (People list rows) ==================
function ensurePeopleStyles() {
  if (document.getElementById('musicPeopleStyles')) return;
  const s = document.createElement('style');
  s.id = 'musicPeopleStyles';
  s.textContent = `
    /* People header (clean, centered) */
    .peopleHeaderTop{
      position: relative;
      display:flex;
      align-items:center;
      justify-content:center;
      gap:12px;
      margin: 0 0 8px 0;
      width: 100%;
    }
    .peopleHeaderTitle{
      font-weight:900;
      font-size:16px;
      letter-spacing:.14em;
      text-transform:uppercase;
      text-align:center;
    }
    .peopleHeaderStatus{
      position:absolute;
      right:0;
      top:50%;
      transform: translateY(-50%);
      opacity:.75;
      font-size:11px;
      letter-spacing:.10em;
      text-transform:uppercase;
      white-space:nowrap;
      pointer-events:none;
    }
    .peopleTotalsRow{
      width:100%;
      display:flex;
      justify-content:center;
      margin: 0 0 10px 0;
    }

        /* ===== People: Stats dashboard (pass two polish) ===== */
    .peopleStatsBlock{
      width: min(1020px, 96%);
      margin: 0 auto 12px;
      padding: 14px;
      border-radius: 22px;
      position: relative;
      overflow: hidden;
      background:
        linear-gradient(180deg, rgba(22, 6, 14, 0.88), rgba(8, 3, 8, 0.84));
      border: 1px solid rgba(255,70,110,0.34);
      box-shadow:
        0 0 0 1px rgba(255,70,110,0.16) inset,
        0 0 26px rgba(255,70,110,0.14),
        0 18px 44px rgba(0,0,0,0.42);
      backdrop-filter: blur(9px);
      -webkit-backdrop-filter: blur(9px);
    }

    .peopleStatsBlock::before{
      content:"";
      position:absolute;
      inset: 0;
      pointer-events:none;
      background:
        radial-gradient(120% 90% at 50% 0%, rgba(255,70,110,0.14), transparent 52%),
        radial-gradient(80% 120% at 50% 100%, rgba(0,210,255,0.05), transparent 55%);
      opacity:.95;
    }

    .peopleStatsBlock::after{
      content:"";
      position:absolute;
      inset: 10px;
      border-radius: 17px;
      border: 1px solid rgba(255,70,110,0.18);
      box-shadow:
        0 0 18px rgba(255,70,110,0.08) inset,
        0 0 0 1px rgba(255,255,255,0.02);
      pointer-events:none;
    }


    .peopleArchiveIntro{
      width: 100%;
      margin: 8px auto 14px;
      padding: 14px 18px 16px;
      text-align: center;
    }

    .peopleArchiveIntroTitle{
      position: relative;
      z-index: 2;
      margin: 0 0 8px;
      font-family: "Orbitron", system-ui, sans-serif;
      font-size: 13px;
      line-height: 1.2;
      font-weight: 900;
      letter-spacing: .1em;
      text-transform: uppercase;
      color: rgba(232,236,244,0.96);
      text-shadow: 0 0 14px rgba(255,92,138,0.10);
      display:flex;
      align-items:center;
      justify-content:center;
      gap: 14px;
    }

    .peopleArchiveIntroTitle::before,
    .peopleArchiveIntroTitle::after{
      content:"";
      flex: 1 1 0;
      max-width: 235px;
      min-width: 44px;
      height: 1px;
      border-radius: 999px;
      background: linear-gradient(90deg, rgba(255,70,110,0), rgba(255,70,110,0.45), rgba(255,70,110,0));
      box-shadow: 0 0 12px rgba(255,70,110,0.16);
      opacity: .9;
    }

    .peopleArchiveIntroBody{
      position: relative;
      z-index: 2;
      max-width: 980px;
      margin: 0 auto;
      font-size: 12px;
      line-height: 1.22;
      color: rgba(190,201,220,0.9);
    }

    @media (max-width: 720px){
      .peopleArchiveIntro{
        padding: 12px 12px 14px;
        margin-bottom: 12px;
      }
      .peopleArchiveIntroTitle{
        font-size: 11px;
        letter-spacing: .08em;
        gap: 10px;
      }
      .peopleArchiveIntroTitle::before,
      .peopleArchiveIntroTitle::after{
        max-width: 110px;
        min-width: 24px;
      }
      .peopleArchiveIntroBody{
        font-size: 11px;
        line-height: 1.2;
      }
    }

    .peopleStatsHdr{
      width: 100%;
      text-align:center;
      font-weight: 900;
      font-size: 13px;
      letter-spacing: .24em;
      text-transform: uppercase;
      opacity: .94;
      margin: 0 0 14px 0;
      position: relative;
      z-index: 2;
    }

    .peopleStatsHdrToggle{
      cursor: pointer;
      user-select: none;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap: 10px;
      margin: 0 auto 14px;
      padding: 10px 16px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(8,12,24,0.42);
      color: rgba(196,211,232,0.78);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.04),
        0 10px 22px rgba(0,0,0,0.22);
      transition: transform 140ms ease, filter 180ms ease, box-shadow 180ms ease, border-color 180ms ease, background 180ms ease, color 180ms ease;
    }

    .peopleStatsHdrToggle:hover{
      filter: brightness(1.08);
      transform: translateY(-1px);
    }

    .peopleStatsHdrToggle:focus-visible{
      outline: none;
      border-color: rgba(130,210,255,0.42);
      box-shadow:
        0 0 0 2px rgba(74,164,255,0.18),
        0 12px 24px rgba(0,0,0,0.24);
    }

    .peopleStatsCollapsible:not(.is-collapsed) .peopleStatsHdrToggle{
      background: linear-gradient(180deg, rgba(42,10,28,0.88), rgba(20,8,18,0.84));
      border-color: rgba(255,92,138,0.34);
      color: rgba(245,240,246,0.96);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.08),
        0 0 0 1px rgba(255,92,138,0.12),
        0 14px 28px rgba(0,0,0,0.28);
    }

    .peopleStatsToggleIcon{
      display:inline-block;
      font-size: 12px;
      line-height: 1;
      transition: transform 160ms ease, opacity 160ms ease;
      opacity: .85;
    }

    .peopleStatsCollapsible.is-collapsed .peopleStatsHdrToggle{
      background: rgba(8,12,24,0.34);
      border-color: rgba(255,255,255,0.08);
      color: rgba(173,189,210,0.68);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.02),
        0 8px 18px rgba(0,0,0,0.18);
    }

    .peopleStatsCollapsible.is-collapsed .peopleStatsToggleIcon{
      transform: rotate(-90deg);
    }

    .peopleStatsDashboard{
      position: relative;
      z-index: 2;
      display: grid;
	  padding: 15px;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      align-items: stretch;
    }

    .peopleDashCard{
      position: relative;
      min-height: 94px;
      border-radius: 16px;
      padding: 15px 12px 13px;
      text-align: center;
      overflow: hidden;
      background:
        radial-gradient(circle at top center, rgba(88, 166, 255, 0.16), transparent 58%),
        linear-gradient(180deg, rgba(11, 18, 38, 0.94), rgba(8, 11, 24, 0.88));
      border: 1px solid rgba(112, 168, 255, 0.22);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.08),
        0 12px 28px rgba(0,0,0,0.34);
    }

    .peopleDashCard::before{
      content:"";
      position:absolute;
      inset: 0;
      pointer-events:none;
      background:
        radial-gradient(140px 80px at 50% 10%, rgba(96,178,255,0.14), transparent 60%),
        linear-gradient(180deg, rgba(255,255,255,0.035), transparent 38%);
      opacity:.95;
    }

    .peopleDashCard::after{
      content:"";
      position:absolute;
      left: 12px;
      right: 12px;
      top: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(126,208,255,0.34), transparent);
      opacity: .82;
      pointer-events:none;
    }

    .peopleStatValue{
      position: relative;
      z-index: 2;
      font-weight: 900;
      font-size: 24px;
      line-height: 1;
      letter-spacing: .03em;
      margin: 2px 0 10px;
      color: rgba(244,247,255,0.98);
      text-shadow:
        0 0 12px rgba(91,168,255,0.16),
        0 0 24px rgba(255,70,110,0.06);
      white-space: nowrap;
    }

    .peopleStatSub{
      position: relative;
      z-index: 2;
      font-size: 12px;
      letter-spacing: .12em;
      text-transform: uppercase !important;
      color: rgba(190,206,228,0.84);
      line-height: 1.35;
      white-space: nowrap;
    }

    .peopleDashBottom{
      position: relative;
      z-index: 2;
      display: grid;
      grid-template-columns: 1fr;
      padding: 13px; 
	  gap: 14px;
      margin-top: 1px;
      align-items: stretch;
    }

    .peopleDashProgress,
    .peopleDashGauge{
      position: relative;
      overflow: hidden;
      border-radius: 16px;
      background:
        radial-gradient(circle at top left, rgba(88, 166, 255, 0.10), transparent 42%),
        linear-gradient(180deg, rgba(10, 16, 35, 0.94), rgba(8, 11, 24, 0.88));
      border: 1px solid rgba(112,168,255,0.18);
      box-shadow:
        0 0 0 1px rgba(255,255,255,0.05) inset,
        0 10px 24px rgba(0,0,0,0.32);
    }

    .peopleDashProgress::after,
    .peopleDashGauge::after{
      content:"";
      position:absolute;
      left: 12px;
      right: 12px;
      top: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(126,208,255,0.28), transparent);
      opacity: .72;
      pointer-events:none;
    }

    .peopleDashProgress{
      padding: 18px 18px 17px;
      min-height: 120px;
      display:flex;
      flex-direction:column;
      justify-content:center;
    }

    .peopleDashProgress::before,
    .peopleDashGauge::before{
      content:"";
      position:absolute;
      inset: 0;
      pointer-events:none;
      background:
        radial-gradient(150px 90px at 25% 18%, rgba(90,166,255,0.10), transparent 58%);
      opacity:.95;
    }

    .peopleDashProgressLabel{
      position: relative;
      z-index: 2;
      font-size: 11px;
      letter-spacing: .12em;
      text-transform: uppercase !important;
      color: rgba(196,211,232,0.84);
      margin-bottom: 0;
      white-space: nowrap;
    }

    .peopleDashProgressRow{
      position: relative;
      z-index: 2;
      display:grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items:center;
      gap: 10px;
      margin-bottom: 14px;
    }

    .peopleDashProgressMeta{
      min-width: 0;
      justify-self: center;
      text-align: center;
      font-size: 11px;
      letter-spacing: .08em;
      color: rgba(196,211,232,0.74);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .peopleDashProgressRight{
      justify-self: end;
    }

    .peopleDashProgressPct{
      font-size: 1rem;
      font-weight: 800;
      letter-spacing: .08em;
      color: rgba(244,247,255,0.98);
      text-shadow:
        0 0 14px rgba(255,70,110,0.18),
        0 0 28px rgba(91,168,255,0.10);
      white-space: nowrap;
    }

    .peopleDashProgressPctSub{
      font-size: 11px;
      letter-spacing: .12em;
      text-transform: uppercase !important;
      opacity: .70;
      white-space: nowrap;
      padding-bottom: 3px;
    }

    .peopleDashBar{
      position: relative;
      z-index: 2;
      height: 12px;
      border-radius: 999px;
      overflow: hidden;
      background: linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.05));
      box-shadow:
        inset 0 0 0 1px rgba(255,255,255,0.06),
        inset 0 1px 4px rgba(0,0,0,0.20),
        0 0 12px rgba(91,168,255,0.05);
    }

    .peopleDashBarFill{
      height: 100%;
      width: var(--people-index-pct, 0%);
      min-width: 0;
      border-radius: inherit;
      background:
        linear-gradient(90deg, rgba(255,82,128,0.98), rgba(255,126,176,0.98) 55%, rgba(255,198,218,0.96));
      box-shadow:
        0 0 14px rgba(255,70,110,0.28),
        0 0 28px rgba(255,70,110,0.12);
      transition: width 260ms ease;
    }

    .peopleDashGauge{
      min-height: 114px;
      display:flex;
      align-items:center;
      justify-content:center;
      padding: 14px;
    }

    .peopleDashGaugeInner{
      position: relative;
      z-index: 2;
      width: 104px;
      height: 104px;
      border-radius: 999px;
      display:flex;
      align-items:center;
      justify-content:center;
      background:
        radial-gradient(circle at 50% 50%, rgba(22,8,14,0.94) 52%, rgba(12,4,9,0.99) 100%);
      border: 1px solid rgba(255,70,110,0.28);
      box-shadow:
        0 0 0 9px rgba(255,70,110,0.05),
        0 0 24px rgba(255,70,110,0.14),
        inset 0 0 18px rgba(255,70,110,0.08);
    }

    .peopleDashGaugeInner::before{
      content:"";
      position:absolute;
      inset: -11px;
      border-radius: 999px;
      border: 2px solid rgba(255,70,110,0.18);
      box-shadow: 0 0 18px rgba(255,70,110,0.10);
    }

    .peopleDashGaugeInner::after{
      content:"";
      position:absolute;
      inset: -2px;
      border-radius: 999px;
      background:
        conic-gradient(
          from -90deg,
          rgba(255,70,110,0.95) 0deg,
          rgba(255,120,150,0.92) calc((var(--people-gauge-pct, 0) / 100) * 360deg),
          rgba(255,255,255,0.08) calc((var(--people-gauge-pct, 0) / 100) * 360deg),
          rgba(255,255,255,0.08) 360deg
        );
      -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 8px), #000 calc(100% - 7px));
      mask: radial-gradient(farthest-side, transparent calc(100% - 8px), #000 calc(100% - 7px));
      opacity: .92;
      pointer-events:none;
    }

    .peopleDashGaugeValue{
      font-size: 29px;
      font-weight: 900;
      line-height: 1;
      letter-spacing: .01em;
      color: rgba(255,232,238,0.97);
      text-shadow:
        0 0 12px rgba(255,70,110,0.18),
        0 0 24px rgba(255,70,110,0.08);
      white-space: nowrap;
      position: relative;
      z-index: 2;
    }

    @media (max-width: 980px){
      .peopleStatsDashboard{
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .peopleDashBottom{
        grid-template-columns: 1fr;
      }
      .peopleDashGauge{
        min-height: 130px;
      }
    }

    @media (max-width: 640px){
      .peopleStatsDashboard{
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .peopleDashCard{
        min-height: 86px;
        padding: 14px 10px 12px;
      }
      .peopleStatValue{
        font-size: 22px;
      }
      .peopleStatSub{
        font-size: 11px;
        letter-spacing: .10em;
      }
      .peopleDashProgressPct{
        font-size: 28px;
      }
      .peopleDashProgress{
        padding: 16px 14px 15px;
      }
      .peopleDashProgressRow{
        grid-template-columns: 1fr;
        justify-items: center;
      }
      .peopleDashProgressLabel,
      .peopleDashProgressMeta,
      .peopleDashProgressRight{
        justify-self: center;
      }
      .peopleDashProgressMeta{
        max-width: 100%;
      }
      .peopleDashGaugeInner{
        width: 90px;
        height: 90px;
      }
      .peopleDashGaugeValue{
        font-size: 24px;
      }
    }

    
    .peopleLetterRow{
      width:100%;
      display:flex;
      justify-content:center;
      margin: 0 0 8px 0;
    }
    .peopleLetterNav{
      width: min(980px, 96%);
      display:flex;
      flex-wrap:wrap;
      align-items:center;
	  font-family: "Orbitron", system-ui, sans-serif;
      justify-content:center;
      gap: 6px;
      padding: 6px 8px;
      border-radius: 999px;
      background: rgba(0,0,0,0.14);
      box-shadow: 0 0 0 1px rgba(255,70,110,0.18) inset;
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
    }
    .peopleLetterBtn{
      appearance:none;
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(0,0,0,0.12);
      color: rgba(226,232,240,0.90);
      border-radius: 999px;
      padding: 5px 9px;
      font-size: 12px;
	  font-family: "Orbitron", system-ui, sans-serif;
      letter-spacing: .12em;
      text-transform: uppercase !important;
      cursor: pointer;
      transition: transform 120ms ease, box-shadow 180ms ease, border-color 180ms ease, filter 180ms ease, opacity 180ms ease;
    }
    .peopleLetterBtn:hover{
      border-color: rgba(255,70,110,0.45);
      box-shadow: 0 0 0 1px rgba(255,70,110,0.14), 0 0 18px rgba(255,70,110,0.12);
      filter: brightness(1.04);
    }
    .peopleLetterBtn:active{ transform: translateY(1px); }
    .peopleLetterBtn.is-active{
      border-color: rgba(255,70,110,0.70);
      box-shadow: 0 0 0 1px rgba(255,70,110,0.18), 0 0 22px rgba(255,70,110,0.18);
    }
    .peopleLetterBtn.is-disabled{
      opacity: .28;
      filter: saturate(.6);
      cursor: default;
      pointer-events: none;
    }
    .peopleFilterMeta{
      width:100%;
      text-align:center;
      font-size: 11px;
      letter-spacing: .12em;
      opacity: .70;
      text-transform: uppercase !important;
      margin: 0 0 10px 0;
    }

    /* ===== People list: responsive columns ===== */
    #people-root.is-list #peopleList{
      width: min(980px, 96%);
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    #people-root.is-list .peopleRow{ width: 100%; }
    @media (max-width: 1199px){
      #people-root.is-list #peopleList{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 699px){
      #people-root.is-list #peopleList{ grid-template-columns: 1fr; }
    }


/* People list: row layout (name left, counts right) */
    #people-root, #people-root *{
      font-family: "Orbitron", system-ui, sans-serif;
      text-transform: none !important;
    }

    .peopleRow{
      width:100%;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 12px;
      padding: 10px 12px;
      border: 0;
      border-radius: 14px;
      text-align:left;
	  font-family: "Orbitron", system-ui, sans-serif;
      cursor:pointer;
      background: rgba(0,0,0,0.16);
      box-shadow: 0 0 0 1px rgba(255,70,110,0.22) inset, 0 12px 26px rgba(0,0,0,0.28);
      transition: transform 140ms ease, box-shadow 180ms ease, filter 180ms ease;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
    .peopleRow:hover{
      transform: translateY(-1px);
      box-shadow: 0 0 0 1px rgba(255,70,110,0.40) inset, 0 16px 34px rgba(0,0,0,0.42);
      filter: brightness(1.03);
    }
    .peopleRow:active{ transform: translateY(0px); }

    .peopleName{
      font-weight: 800;
      color: #ff466e;
      font-size: 13px;
      letter-spacing: .02em;
      line-height: 1.2;
    }

    .peopleMetrics{
      display:flex;
      align-items:center;
      gap: 10px;
      flex: 0 0 auto;
    }
    .peopleMetric{
      display:inline-flex;
      align-items:center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(0,0,0,0.18);
      box-shadow: 0 0 0 1px rgba(255,255,255,0.10) inset;
      color: rgba(226,232,240,0.88);
      font-size: 12px;
      letter-spacing: .02em;
      white-space: nowrap;
    }
    .peopleMetric svg{
      width: 14px;
      height: 14px;
      display:block;
      opacity: .92;
      filter: drop-shadow(0 0 8px rgba(255,70,110,0.18));
    }
    .peopleMetric .num{
      font-weight: 800;
      letter-spacing: .06em;
    }

    @media (max-width: 520px){
      .peopleRow{ padding: 10px 10px; }
      .peopleMetric{ padding: 6px 9px; font-size: 11px; }
      .peopleName{ font-size: 12.5px; }
    }
    /* Timeline autosize (safe override): keep the rail aligned without allowing the grid to overflow horizontally */
    .peopleTimelineWrap{
      --peopleTlX: 24px;
      width: min(980px, 96%);
      margin: 0 auto;
      overflow-x: hidden;
      box-sizing: border-box;
    }
    .peopleTimelineWrap:before{ left: var(--peopleTlX); }
    .peopleTimelineNode{ left: var(--peopleTlX); }

    .peopleTimelineItem{
      grid-template-columns: 36px 86px minmax(0, 1fr);
      column-gap: 12px;
      overflow: visible;
      box-sizing: border-box;
    }
    .peopleTimelineDateCol,
    .peopleTimelinePosterCol,
    .peopleTimelineBody{
      min-width: 0;
      box-sizing: border-box;
    }
    .peopleTimelineDateCol{
      justify-content: flex-start;
      padding-left: 0;
      padding-right: 0;
    }
    .peopleTimelineDatePill{ margin-left: 0 !important; max-width: 100%; }
    .peopleTimelineMetaDate{
      font-size: 12px;
      color: rgba(226,232,240,0.72);
      letter-spacing: .03em;
      line-height: 1.35;
      text-transform: none !important;
      white-space: normal;
    }
    .peopleTimelineAppearsWith{
      display: none;
      margin-top: 5px;
      font-size: 11px;
      color: rgba(255,170,194,0.82);
      letter-spacing: .02em;
      line-height: 1.35;
      text-transform: none !important;
      white-space: normal;
    }

    @media (max-width: 720px){
      .peopleTimelineWrap{ --peopleTlX: 22px; width: min(980px, 100%); }
      .peopleTimelineItem{ grid-template-columns: 32px 80px minmax(0, 1fr); padding: 10px; }
      .peopleTimelinePosterCol{ width: 80px; }
      .peoplePosterBox{ width: 72px; height: 72px; border-radius: 12px; }
    }

    /* ===== People person-view timeline (mockup style) ===== */
    .peopleTimelineWrap{
      position: relative;
      width: 100%;
      padding: 6px 0 2px;
    }
    .peopleTimelineWrap:before{
      content:"";
      position:absolute;
      top: 2px;
      bottom: 2px;
      left: var(--peopleTlX);
      width: 2px;
      background: linear-gradient(to bottom, rgba(255,70,110,0.10), rgba(255,70,110,0.70), rgba(255,70,110,0.10));
      box-shadow: 0 0 18px rgba(255,70,110,0.24);
      border-radius: 999px;
    }
    .peopleTimelineNode{
      position:absolute;
      left: var(--peopleTlX);
      transform: translateX(-50%);
      width: 16px;
      height: 16px;
      border-radius: 999px;
      background: rgba(255,70,110,0.18);
      box-shadow: 0 0 0 2px rgba(255,70,110,0.55), 0 0 24px rgba(255,70,110,0.35);
    }
    .peopleTimelineNode:before{
      content:"";
      position:absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: rgba(255,70,110,0.92);
      box-shadow: 0 0 16px rgba(255,70,110,0.65);
    }

    .peopleTimelineItem{
      position: relative;
      display:grid;
      align-items: stretch;
      width: 100%;
      border-radius: 20px;
      padding: 12px;
      margin: 14px 0;
      background: rgba(0,0,0,0.16);
      box-shadow: 0 0 0 1px rgba(255,70,110,0.24) inset, 0 18px 44px rgba(0,0,0,0.44);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }

    .peopleTimelineDateCol{
      display:flex;
      align-items:flex-start;
      justify-content:flex-end;
      padding-top: 4px;
    }
    .peopleTimelineDatePill{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding: 7px 12px;
      border-radius: 999px;
      border: 1px solid rgba(255,70,110,0.28);
      background: rgba(0,0,0,0.18);
      box-shadow: 0 0 0 1px rgba(255,70,110,0.12) inset, 0 0 22px rgba(255,70,110,0.12);
      font-weight: 900;
      letter-spacing: .10em;
      color: rgba(226,232,240,0.92);
      font-size: 12px;
      white-space: nowrap;
    }
    .peopleTimelinePosterCol{
      display:flex;
      align-items:center;
      justify-content:center;
    }
    .peoplePosterBox{
      width: 86px;
      height: 86px;
      border-radius: 16px;
      overflow:hidden;
      background: radial-gradient(120% 160% at 0% 0%, rgba(255,70,110,0.18) 0%, rgba(0,0,0,0.30) 55%, rgba(0,0,0,0.18) 100%);
      box-shadow: 0 0 0 1px rgba(255,70,110,0.30) inset, 0 16px 32px rgba(0,0,0,0.40);
      display:flex;
      align-items:center;
      justify-content:center;
      position: relative;
    }
    .peoplePosterImg{
      width: 100%;
      height: 100%;
      object-fit: contain;
      display:block;
      filter: saturate(1.02) contrast(1.02);
    }
    .peoplePosterFallback{
      font-weight: 900;
      letter-spacing: .12em;
      font-size: 16px;
      color: rgba(226,232,240,0.70);
    }

    .peopleTimelineBody{
      display:flex;
      flex-direction:column;
      gap: 6px;
      padding: 2px 4px;
      min-width: 0;
    }
    .peopleTimelineTitle{
      font-size: 22px;
      font-weight: 900;
      letter-spacing: .02em;
      color: rgba(226,232,240,0.96);
      line-height: 1.15;
      text-shadow: 0 0 26px rgba(255,70,110,0.12);
      text-transform: none !important;
      font-variant: normal;
      white-space: nowrap;
      overflow:hidden;
      text-overflow: ellipsis;
    }
    .peopleTimelineKicker{
      opacity: .70;
      font-size: 12px;
      letter-spacing: .14em;
      text-transform: uppercase !important;
    }
    .peopleTimelinePerson{
      font-weight: 900;
      font-size: 18px;
      letter-spacing: .02em;
      color: rgba(226,232,240,0.92);
      white-space: nowrap;
      overflow:hidden;
      text-overflow: ellipsis;
    }
    .peopleTimelineSub{
      opacity: .70;
      font-size: 12px;
      letter-spacing: .08em;
    }
    .peopleTimelineActions{
      margin-top: 10px;
      display:flex;
      justify-content:flex-end;
    }
    .peopleTimelineBtn{
      text-decoration:none;
      display:inline-flex;
      align-items:center;
      gap: 10px;
      padding: 10px 16px;
      border-radius: 16px;
      border: 1px solid rgba(255,70,110,0.34);
      background: rgba(0,0,0,0.16);
      box-shadow: 0 0 0 1px rgba(255,70,110,0.12) inset, 0 0 26px rgba(255,70,110,0.10);
      font-weight: 900;
      letter-spacing: .10em;
      text-transform: uppercase !important;
      color: rgba(226,232,240,0.92);
      cursor: pointer;
      transition: transform 140ms ease, box-shadow 180ms ease, border-color 180ms ease, filter 180ms ease;
      user-select:none;
    }
    .peopleTimelineBtn:hover{
      border-color: rgba(255,70,110,0.62);
      box-shadow: 0 0 0 1px rgba(255,70,110,0.18) inset, 0 0 32px rgba(255,70,110,0.16);
      filter: brightness(1.03);
      transform: translateY(-1px);
    }
    .peopleTimelineBtn:active{ transform: translateY(0px); }
    .peopleTimelineBtn svg{
      width: 16px;
      height: 16px;
      display:block;
      opacity: .88;
    }

    @media (max-width: 920px){
      .peopleTimelineTitle{ font-size: 18px; }
    }
    @media (max-width: 720px){
      .peopleTimelineTitle{ font-size: 16px; }
      .peopleTimelinePerson{ font-size: 15px; }
      .peopleTimelineBtn{ padding: 9px 14px; border-radius: 14px; }
    }

    /* ===== People: Top stats (display-only; no click/routing) ===== */
    #peopleTopStats{ width: 100%; margin: 12px auto 14px; }
    .peopleTopStatsHdr{
      display:flex;
      align-items:center;
      justify-content:center;
      flex-wrap: wrap;
      gap: 8px 12px;
      margin-bottom: 12px;
      text-align: center;
    }
    .peopleTopStatsTitle{
      font-family: "Orbitron", system-ui, sans-serif;
      font-size: 11px;
      letter-spacing: .18em;
      text-transform: uppercase;
      color: rgba(240,244,255,0.92);
      text-shadow: 0 0 12px rgba(84,180,255,0.16);
      opacity: .92;
    }
    .peopleTopStatsSub{
      font-family: "Orbitron", system-ui, sans-serif;
      font-size: 9px;
      letter-spacing: .12em;
      text-transform: uppercase;
      color: rgba(184,205,232,0.72);
      opacity: .9;
    }
    .peopleTopStatsGrid{
      width: 100%;
      display:grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      align-items: stretch;
      justify-items: stretch;
      pointer-events: none;
      user-select: none;
    }
    .peopleTopStatCard{
      position: relative;
      display:flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 92px;
      border-radius: 16px;
      padding: 14px 14px 13px;
      background:
        radial-gradient(circle at top center, rgba(77,160,255,0.18), transparent 56%),
        linear-gradient(180deg, rgba(8,14,30,0.88), rgba(6,10,22,0.72));
      border: 1px solid rgba(106,168,255,0.2);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.08),
        0 14px 34px rgba(0,0,0,0.34);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      overflow: hidden;
    }
    .peopleTopStatCard::before{
      content:"";
      position:absolute;
      left: 12px;
      right: 12px;
      top: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(122,202,255,0.72), transparent);
      box-shadow: 0 0 16px rgba(122,202,255,0.18);
      opacity: .95;
      pointer-events:none;
    }
    .peopleTopStatCard::after{
      content:"";
      position:absolute;
      inset: 1px;
      border-radius: inherit;
      border: 1px solid rgba(255,255,255,0.03);
      pointer-events:none;
    }
    .peopleTopStatCard:nth-child(1){
      border-color: rgba(255,212,120,0.28);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.1),
        0 16px 38px rgba(0,0,0,0.36),
        0 0 0 1px rgba(255,212,120,0.06);
    }
    .peopleTopStatCard:nth-child(2){
      border-color: rgba(152,212,255,0.24);
    }
    .peopleTopStatCard:nth-child(3){
      border-color: rgba(255,156,120,0.24);
    }
    .peopleTopStatRankRow{
      display:flex;
      align-items:center;
      justify-content:center;
      gap: 8px;
      width: 100%;
      min-width: 0;
    }
    .peopleTopStatRank{
      font-family: "Orbitron", system-ui, sans-serif;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width: 28px;
      height: 28px;
      border-radius: 999px;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      font-size: 14px;
      letter-spacing: 0;
      text-transform: none;
      opacity: .98;
      line-height: 1;
      flex: 0 0 auto;
    }
    .peopleTopStatName{
      font-family: "Orbitron", system-ui, sans-serif;
      font-weight: 900;
      font-size: 15px;
      letter-spacing: .01em;
      color: rgba(244,247,255,0.96);
      text-shadow: 0 1px 12px rgba(69,145,255,0.12);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
      text-align: left;
    }
    .peopleTopStatMeta{
      font-family: "Orbitron", system-ui, sans-serif;
      font-size: 11px;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: rgba(198,214,236,0.74);
      display:flex;
      flex-wrap:wrap;
      align-items:center;
      justify-content:center;
      gap: 4px 8px;
    }
    .peopleTopStatMeta .k{
      color: rgba(245,248,255,0.96);
      opacity: 1;
      font-weight: 900;
    }
    .peopleTopStatMeta .lbl{ opacity: .64; }
    .peopleTopStatMeta .dot{ opacity: .34; }

    @media (max-width: 720px){
      .peopleTopStatsGrid{ grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
      .peopleTopStatCard{ min-height: 84px; border-radius: 16px; padding: 12px 8px 11px; }
      .peopleTopStatRankRow{ gap: 6px; }
      .peopleTopStatRank{ width: 24px; height: 24px; font-size: 12px; }
      .peopleTopStatName{ font-size: 12px; }
      .peopleTopStatMeta{ font-size: 9px; gap: 3px 6px; }
    }

/* Person album accordion (caption-match shots) */
.peopleTimelineItem{ cursor: pointer; }
.peopleTimelineItem.is-open{ box-shadow: 0 0 0 1px rgba(255,70,110,0.28) inset, 0 10px 26px rgba(0,0,0,0.35); }
.peopleAlbumDrop{
  grid-column: 1 / -1;
  width: 100%;
  min-width: 0;
  display:grid;
  grid-template-columns: minmax(0, 1fr);
  margin-top: 10px;
  background: rgba(0,0,0,0.22);
  border-radius: 16px;
  padding: 12px;
  box-sizing: border-box;
  box-shadow: 0 0 0 1px rgba(255,70,110,0.18) inset;
}
.peopleAlbumDropLayout{
  display:grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}
.peopleAlbumDropRail{
  min-width: 0;
}
.peopleAlbumDropBody{
  min-width: 0;
}
.peopleAlbumDropHdr{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.peopleAlbumDropMeta{
  min-width: 0;
}
.peopleAlbumDropLabel{
  font-family: "Orbitron", system-ui, sans-serif;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: rgba(245,248,255,0.96);
}
.peopleAlbumDropHint{
  margin-top: 4px;
  font-size: 10px;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: rgba(198,214,236,0.68);
}
.peopleAlbumDropActions{
  flex: 0 0 auto;
}
.peopleAlbumDropToggle{
  border: 0;
  border-radius: 999px;
  padding: 7px 11px;
  cursor: pointer;
  background: rgba(255,255,255,0.08);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.12) inset;
  color: rgba(245,248,255,0.92);
  font-family: "Orbitron", system-ui, sans-serif;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.peopleAlbumDropToggle:hover{
  background: rgba(255,255,255,0.12);
}
.peopleAlbumDropGrid{
  display:grid;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: 14px;
  align-items:start;
}
.peopleShotThumb{
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  border: 0;
  padding: 8px 8px 24px;
  border-radius: 16px;
  cursor: pointer;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(16,22,38,0.92), rgba(10,14,24,0.92));
  box-shadow: 0 0 0 1px rgba(118,164,255,0.14) inset, 0 14px 28px rgba(0,0,0,0.30), 0 4px 10px rgba(0,0,0,0.22);
  transition: transform 160ms ease, box-shadow 180ms ease, filter 180ms ease;
}
.peopleShotThumb:hover{
  transform: translateY(-2px);
  box-shadow: 0 0 0 1px rgba(118,164,255,0.20) inset, 0 18px 34px rgba(0,0,0,0.34), 0 6px 14px rgba(0,0,0,0.24);
  filter: brightness(1.03);
}
.peopleShotThumb img{
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center center;
  display: block;
  transform: translateZ(0);
  border-radius: 9px;
  background: rgba(4,8,16,0.72);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.05) inset;
}
.peopleShotThumb.is-hidden{ display:none; }
@media (min-width: 1100px){
  .peopleAlbumDropGrid{
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
@media (min-width: 721px) and (max-width: 1099px){
  .peopleAlbumDropGrid{
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 520px){
  .peopleAlbumDropGrid{
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .peopleShotThumb{
    padding: 8px 8px 26px;
    border-radius: 16px;
  }
}

.peopleShotBadge{
  position:absolute;
  left: 10px;
  right: 10px;
  bottom: 8px;
  font-family: "Orbitron", system-ui, sans-serif;
  font-size: 10px;
  letter-spacing: .08em;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(12,18,30,0.72);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.10) inset;
  color: rgba(255,255,255,0.92);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  text-align: center;
}

/* People Lightbox */
.peopleLightbox{
  position: fixed;
  inset: 0;
  z-index: 9999;
  background:
    radial-gradient(120% 120% at 50% 48%, rgba(16,24,39,0.16) 0%, rgba(0,0,0,0.54) 44%, rgba(0,0,0,0.92) 100%),
    rgba(0,0,0,0.92);
  display: none;
  align-items: center;
  justify-content: center;
  padding: 0;
  overflow: hidden;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.peopleLightbox.is-open{ display:flex; }
.peopleLightboxInner{
  width: min(1280px, 96vw);
  height: min(860px, 92vh);
  max-height: 92vh;
  display:flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: space-between;
  gap: 10px;
  position: relative;
}
.peopleLightboxTop{
  display:flex;
  align-items:center;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 14px 8px;
  font-family: "Orbitron", system-ui, sans-serif;
  font-size: 10px;
  letter-spacing: .14em;
  text-transform: uppercase;
  opacity: .9;
}
.peopleLightboxActions{
  display:flex;
  align-items:center;
  gap: 10px;
}
.peopleLightboxBtn{
  cursor:pointer;
  border: 1px solid rgba(148,163,184,0.25);
  background: rgba(8,12,22,0.62);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.04), 0 0 14px rgba(148,163,184,0.06);
  color: rgba(226,232,240,0.92);
  border-radius: 999px;
  padding: 7px 13px;
  min-height: auto;
  font-weight: 900;
  font-size: 12px;
  letter-spacing: .12em;
  text-transform: uppercase;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap: 6px;
  touch-action: manipulation;
}
.peopleLightboxBtn:hover{
  border-color: rgba(244,114,182,0.34);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06), 0 0 18px rgba(244,114,182,0.10);
}
.peopleLightboxStage{
  position: relative;
  flex: 1;
  min-height: 0;
  display:flex;
  align-items:center;
  justify-content:center;
  padding: 6px 72px;
  overflow: hidden;
}
.peopleLightboxStage::before{
  content:"";
  position:absolute;
  inset:0;
  border-radius:24px;
  pointer-events:none;
  background:
    radial-gradient(90% 85% at 50% 50%, rgba(103,203,255,0.06) 0%, rgba(0,0,0,0) 54%),
    linear-gradient(180deg, rgba(255,255,255,0.015), rgba(255,255,255,0));
  border:1px solid rgba(255,255,255,0.04);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.015);
}
.peopleLightboxStage img{
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  display:block;
  object-fit: contain;
  border-radius: 18px;
  border: 1px solid rgba(148,163,184,0.18);
  background: rgba(6,10,18,0.60);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.04), 0 24px 60px rgba(0,0,0,0.62), 0 0 26px rgba(56,189,248,0.08);
  position: relative;
  z-index: 1;
}
.peopleLightboxStage .peopleLightboxBtn{
  position:absolute;
  top:50%;
  transform: translateY(-50%);
  width: 56px;
  height: 56px;
  padding: 0;
  font-size: 19px;
  line-height: 1;
  background: rgba(6,10,18,0.72);
  border: 1px solid rgba(125,211,252,0.18);
  color: rgba(226,232,240,0.92);
  backdrop-filter: blur(10px);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.04), 0 0 18px rgba(56,189,248,0.10);
  z-index: 2;
}
.peopleLightboxStage .peopleLightboxBtn:hover{
  border-color: rgba(125,211,252,0.42);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06), 0 0 24px rgba(56,189,248,0.16);
}
.peopleLightboxBtn.peopleLightboxPrev{ left: 6px; }
.peopleLightboxBtn.peopleLightboxNext{ right: 6px; }
.peopleLightboxStripWrap{
  padding: 0 10px 10px;
}
.peopleLightboxStrip{
  padding: 12px 14px 14px;
  overflow-x: auto;
  overflow-y: hidden;
  display:flex;
  gap: 8px;
  align-items:center;
  scroll-behavior: smooth;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(8,12,22,0.82), rgba(8,12,22,0.60));
  border: 1px solid rgba(125,211,252,0.14);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.03), 0 0 18px rgba(56,189,248,0.06);
}
.peopleLightboxStrip::-webkit-scrollbar{
  height:10px;
}
.peopleLightboxStrip::-webkit-scrollbar-track{
  background: rgba(255,255,255,0.08);
  border-radius:999px;
}
.peopleLightboxStrip::-webkit-scrollbar-thumb{
  background: rgba(148,163,184,0.48);
  border-radius:999px;
}
.peopleLightboxThumb{
  width: 60px;
  height: 60px;
  border-radius: 12px;
  object-fit: cover;
  border: 1px solid rgba(255,255,255,0.12);
  opacity: .68;
  cursor:pointer;
  flex: 0 0 auto;
  transition: opacity 140ms ease, transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
  background: rgba(255,255,255,0.04);
  box-shadow: 0 8px 16px rgba(0,0,0,0.24);
}
.peopleLightboxThumb:hover{
  opacity: .92;
  transform: translateY(-1px);
  border-color: rgba(125,211,252,0.32);
  box-shadow: 0 10px 22px rgba(0,0,0,0.30), 0 0 16px rgba(56,189,248,0.10);
}
.peopleLightboxThumb.active{
  opacity: 1;
  border-color: rgba(125,211,252,0.84);
  box-shadow: 0 0 0 1px rgba(125,211,252,0.28), 0 0 20px rgba(56,189,248,0.16);
}
@media (max-width: 640px){
  .peopleLightboxInner{
    height: 94vh;
  }
  .peopleLightboxTop{
    justify-content:flex-start;
    flex-wrap:wrap;
  }
  .peopleLightboxActions{
    flex-wrap:wrap;
  }
  .peopleLightboxStage{
    padding: 6px 46px;
  }
  .peopleLightboxStage .peopleLightboxBtn{
    width: 44px;
    height: 44px;
    font-size:16px;
  }
  .peopleLightboxBtn.peopleLightboxPrev{ left: 2px; }
  .peopleLightboxBtn.peopleLightboxNext{ right: 2px; }
  .peopleLightboxStrip{ padding-bottom: 10px; }
  .peopleLightboxThumb{ width: 52px; height: 52px; }
}

`;
  document.head.appendChild(s);
}
  function renderPeopleList(indexMap) {
    if (!panelRoot) return;
    const listEl = panelRoot.querySelector('#peopleList');
    const metaEl = panelRoot.querySelector('#peopleMeta');
    // List mode: enable responsive multi-column layout (CSS is keyed off this class).
    try {
      const root = panelRoot.querySelector('#people-root');
      if (root) {
        root.classList.add('is-list');
        root.classList.remove('is-person');
      }
    } catch (_) {}
    if (!listEl) return;

    const allEntries = Array.from(indexMap.entries()).map(([name, set]) => ({
      name,
      albums: set.size,
      photos: (() => {
        try {
          const n = _photoCountByPerson && _photoCountByPerson.has(name) ? Number(_photoCountByPerson.get(name)) : NaN;
          return Number.isFinite(n) ? n : null;
        } catch (_) { return null; }
      })()
    }));
    allEntries.sort((a, b) => a.name.localeCompare(b.name));

    // Render A-Z nav (with empty letters dimmed)
    renderPeopleLetterNav(indexMap);

    const letter = _getPeopleLetter();
    const entries = letter
      ? allEntries.filter((p) => _letterForName(p.name) === letter)
      : [];

    // Filter meta (only shows when a letter is selected)
    _renderPeopleFilterMeta(allEntries.length, entries.length);

    if (metaEl) metaEl.textContent = `${allEntries.length} people indexed`;

    // Header totals (photos + unique albums)
    _peopleTotals = _computePeopleTotals(indexMap);
    _renderPeopleTotals(_peopleTotals);

    // Top 3 (display-only)
    renderTopStats(indexMap);

    if (!allEntries.length) {
      listEl.innerHTML = `<div style="opacity:.7; font-size:12px; line-height:1.4;">No people found yet. This can be because the server is rebuilding the person database or there's something wrong. Give it a bit.</div>`;
      return;
    }

    if (!entries.length) {
      const L = _getPeopleLetter();
      if (!L) {
        listEl.innerHTML = ``;
        return;
      }
      listEl.innerHTML = `<div style="opacity:.7; font-size:12px; line-height:1.4;">No people under <strong>${_eh(L || '')}</strong>.</div>`;
      return;
    }

      listEl.innerHTML = entries
    .map((p) => {
        const photosTxt = (p.photos === null) ? '\u2014' : String(p.photos);
      const albumsTxt = String(p.albums);

      return `
      <button type="button" class="peopleRow" data-person="${_eh(p.name)}" aria-label="Open ${_eh(p.name)}">
        <div class="peopleName">${_eh(p.name)}</div>

        <div class="peopleMetrics" aria-hidden="true">
          <div class="peopleMetric" title="Photos">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
            <span class="num">${_eh(photosTxt)}</span>
          </div>

          <div class="peopleMetric" title="Albums">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20"></path>
              <path d="M4 16.5A2.5 2.5 0 0 0 6.5 19H20"></path>
              <path d="M4 3h16v13H6.5A2.5 2.5 0 0 0 4 18.5z"></path>
            </svg>
            <span class="num">${_eh(albumsTxt)}</span>
          </div>
        </div>
      </button>
    `;
    })
    .join('');
  }


// Top 3 stats (display-only; no click/routing)
function renderTopStats(indexMap){
  if (!panelRoot) return;
  const host = panelRoot.querySelector('#peopleTopStats');
  if (!host) return;

  // Respect the panel's current collapsed state when re-rendering.
  host.style.display = _peopleStatsCollapsed ? 'none' : ''; 

  const all = Array.from(indexMap.entries()).map(([name, set]) => {
    let photos = null;
    try{
      const n = (_photoCountByPerson && _photoCountByPerson.has(name)) ? Number(_photoCountByPerson.get(name)) : NaN;
      photos = Number.isFinite(n) ? n : null;
    }catch(_){ photos = null; }
    return { name, albums: (set && typeof set.size === 'number') ? set.size : 0, photos };
  });

  if (!all.length){
    host.innerHTML = '';
    return;
  }

  // Prefer photoCount desc; if missing, fall back to albums desc; then name asc for stability.
  all.sort((a,b) => {
    const ap = (a.photos === null) ? -1 : a.photos;
    const bp = (b.photos === null) ? -1 : b.photos;
    if (bp != ap) return bp - ap;
    if (b.albums != a.albums) return b.albums - a.albums;
    return String(a.name).localeCompare(String(b.name));
  });

  const top = all.slice(0, 3);

  // If absolutely no meaningful stats (all null photos and 0 albums), don't show the block.
  const hasAny = top.some(t => (t.photos !== null && t.photos > 0) || (t.albums > 0));
  if (!hasAny){
    host.innerHTML = '';
    return;
  }

  host.innerHTML = `
    <div class="peopleTopStatsHdr">
      <div class="peopleTopStatsTitle">Top 3 Most Photographed</div>
	  <div class="peopleTopStatsSub">(not complete, working on it)</div>
    </div>
    <div class="peopleTopStatsGrid">
      ${top.map((t, i) => {
        const photosTxt = (t.photos === null) ? '\u2014' : String(t.photos);
        const albumsTxt = String(t.albums || 0);
        const medal = (i === 0) ? '\u{1F947}' : (i === 1) ? '\u{1F948}' : '\u{1F949}';
        const ariaRank = (i === 0) ? 'Gold medal' : (i === 1) ? 'Silver medal' : 'Bronze medal';
        return `
          <div class="peopleTopStatCard" role="group" aria-label="${_eh(ariaRank)} ${_eh(t.name)}">
            <div class="peopleTopStatRankRow">
              <div class="peopleTopStatRank" aria-hidden="true">${_eh(medal)}</div>
              <div class="peopleTopStatName">${_eh(t.name)}</div>
            </div>
            <div class="peopleTopStatMeta">
              <span class="lbl">Photos</span> <span class="k">${_eh(photosTxt)}</span>
              <span class="dot">\u2022</span>
              <span class="lbl">Albums</span> <span class="k">${_eh(albumsTxt)}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

  function renderPersonAlbumsShell(personName) {
    if (!panelRoot) return;
    const listEl = panelRoot.querySelector('#peopleList');
    const metaEl = panelRoot.querySelector('#peopleMeta');
    if (metaEl) metaEl.textContent = 'Person';

    // Person mode: disable list grid layout.
    try {
      const root = panelRoot.querySelector('#people-root');
      if (root) {
        root.classList.add('is-person');
        root.classList.remove('is-list');
      }
    } catch (_) {}


    // Hide A-Z while drilling in
    try {
      const navEl = panelRoot.querySelector('#peopleLetterNav');
      if (navEl) navEl.style.display = 'none';
      const fm = panelRoot.querySelector('#peopleFilterMeta');
      if (fm) fm.textContent = '';
      const ts = panelRoot.querySelector('#peopleTopStats');
      if (ts) ts.style.display = 'none';
    } catch (_) {}

    if (!listEl) return;

    listEl.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin:6px 0 10px;">
        <button type="button" id="peopleBackBtn"
          style="cursor:pointer; border:0; background:rgba(0,0,0,0.18); box-shadow:0 0 0 1px rgba(255,70,110,0.25) inset; border-radius:12px; padding:9px 12px; font-weight:900; font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:#FFFFFF;">Back</button>
        <div style="flex:1; min-width:0; text-align:right;">
          <div style="font-weight:900; font-size:13px; letter-spacing:.02em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${_eh(personName)}
          </div>
          <div id="peopleAlbumCount" style="opacity:.75; font-size:11px; letter-spacing:.10em; text-transform:uppercase; margin-top:3px;"></div>
        </div>
      </div>

      <div id="peopleAlbumsList" class="peopleTimelineWrap"></div>
    `;
  }

  function renderPersonAlbumsList(items, personName) {
    if (!panelRoot) return;
    const albumsEl = panelRoot.querySelector('#peopleAlbumsList');
    const countEl = panelRoot.querySelector('#peopleAlbumCount');
    if (countEl) countEl.textContent = `Albums: ${items.length}`;

    if (!albumsEl) return;

    if (!items.length) {
      albumsEl.innerHTML = `<div style="opacity:.7; font-size:12px; line-height:1.4;">No albums found for this person.</div>`;
      return;
    }

    // Mockup-style timeline cards: date pill + poster + show title
    albumsEl.innerHTML = items
      .map((a, idx) => {
        const rawTitle = String(a.title || `Album ${a.albumKey}`);
        const split = _splitDateFromTitle(rawTitle);
        const dateTxt = _eh(split.dateText || '');
        const longDateTxt = _eh(_formatLongDateFromShort(split.dateText || ''));
        const mainTitle = _eh(split.restTitle || rawTitle);
        const href = a.url ? _eh(a.url) : '';

        return `
          <div class="peopleTimelineItem" data-albumkey="${_eh(a.albumKey)}">
            <div class="peopleTimelineNode" style="top: 26px;"></div>

            <div class="peopleTimelineDateCol"></div>

            <div class="peopleTimelinePosterCol">
              <div class="peoplePosterBox" data-albumkey="${_eh(a.albumKey)}">
                <div class="peoplePosterFallback">${_eh((mainTitle || 'A').trim()[0] || 'A')}</div>
              </div>
            </div>

            <div class="peopleTimelineBody">
              <div class="peopleTimelineTitle" title="${_eh(split.restTitle || rawTitle)}">${mainTitle}</div>
              <div class="peopleTimelineAppearsWith" data-albumkey="${_eh(a.albumKey)}"></div>
              ${dateTxt ? `<div class="peopleTimelineMetaDate">${longDateTxt}</div>` : ''}
            </div>

            <div class="peopleAlbumDrop" data-albumdrop="1" style="display:none"></div>
          </div>
        `;
      })
      .join('');

    // Best-effort poster thumbnails (non-blocking)
    try {
      hydrateAlbumThumbs(items.slice(0, 24).map((x) => x.albumKey));
    } catch (_) {}
    try {
      hydratePeopleTimelineAppearsWith(items);
    } catch (_) {}
  }

  

function _closeOpenPersonAlbum(){
  if (!panelRoot) return;
  if (!_openPersonAlbumKey) return;
  const key = _openPersonAlbumKey;
  _openPersonAlbumKey = '';
  try{
    const item = panelRoot.querySelector(`.peopleTimelineItem[data-albumkey="${_cssEscape(key)}"]`);
    if (item) item.classList.remove('is-open');
    const drop = item ? item.querySelector('.peopleAlbumDrop[data-albumdrop="1"]') : null;
    if (drop) {
      drop.style.display = 'none';
      drop.innerHTML = '';
    }
  }catch(_){}
}

async function _openPersonAlbum(albumKey, personName){
  if (!panelRoot) return;
  const key = _safeTrim(albumKey);
  if (!key) return;

  // toggle off
  if (_openPersonAlbumKey && _openPersonAlbumKey === key){
    _closeOpenPersonAlbum();
    return;
  }

  // close any previous
  _closeOpenPersonAlbum();
  _openPersonAlbumKey = key;

  const item = panelRoot.querySelector(`.peopleTimelineItem[data-albumkey="${_cssEscape(key)}"]`);
  if (!item) return;

  item.classList.add('is-open');
  const drop = item.querySelector('.peopleAlbumDrop[data-albumdrop="1"]');
  if (!drop) return;
  drop.style.display = '';
  drop.innerHTML = `<div style="opacity:.75; font-size:12px; padding:8px 2px;">Loading shots...</div>`;

  const who = _safeTrim(personName);
  const cached = _albumCaptionMatchCache.get(key);
  let shots = (cached && cached.forPerson === _normKey(who) && Array.isArray(cached.shots)) ? cached.shots : null;

  if (!shots){
    shots = await fetchCaptionMatchShotsForPerson(key, who, { maxPages: 10, pageSize: 200 }).catch(() => []);
    _albumCaptionMatchCache.set(key, { forPerson: _normKey(who), shots: Array.isArray(shots) ? shots : [] });
  }

  if (!panelRoot) return;
  if (_openPersonAlbumKey !== key) return;

  const list = Array.isArray(shots) ? shots : [];
  const previewCount = Math.min(PEOPLE_MATCH_PREVIEW_LIMIT, list.length);
  const hasMoreShots = list.length > previewCount;
  _peopleLightboxList = list;
  drop.innerHTML =     `
    <div class="peopleAlbumDropLayout">
      <div class="peopleAlbumDropRail">
        <div class="peopleAlbumDropHdr">
          <div class="peopleAlbumDropMeta">
            <div class="peopleAlbumDropLabel">${list.length} tagged shots</div>
            <div class="peopleAlbumDropHint">Caption match</div>
          </div>
          <div class="peopleAlbumDropActions">
            ${hasMoreShots ? `<button type="button" class="peopleAlbumDropToggle" data-people-toggle-shots="1" data-preview-count="${previewCount}" aria-expanded="false">Show all</button>` : ''}
          </div>
        </div>
      </div>
      <div class="peopleAlbumDropBody">
        <div class="peopleAlbumDropGrid" data-preview-count="${previewCount}" data-expanded="0">
          ${list.map((s, i) => {
            const ik = _safeTrim(s.imageKey);
            const tu = _safeTrim(s.thumbUrl);
            if (!ik || !tu) return '';
            return `
              <button type="button" class="peopleShotThumb${i >= previewCount ? ' is-hidden' : ''}" data-imagekey="${_eh(ik)}" data-idx="${i}" aria-label="Open tagged shot ${i + 1}">
                <span class="peopleShotBadge">#${i + 1}</span>
                <img src="${_eh(tu)}" alt="" loading="lazy" decoding="async"/>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

async function hydrateAlbumThumbs(albumKeys) {
    if (!panelRoot) return;
    const keys = Array.isArray(albumKeys) ? albumKeys : [];
    if (!keys.length) return;

    // Fill in-place for any boxes currently in the DOM.
    for (const k of keys) {
      const key = _safeTrim(k);
      if (!key) continue;

      const box = panelRoot.querySelector(`.peoplePosterBox[data-albumkey="${_cssEscape(key)}"]`);
      if (!box) continue;
      if (box.getAttribute('data-hasimg') === '1') continue;

      const url = await fetchAlbumThumbUrl(key);
      if (!panelRoot) return;
      if (!url) continue;

      // Swap fallback with img
      try {
        box.innerHTML = `<img class="peoplePosterImg" src="${_eh(url)}" alt="" loading="lazy" decoding="async"/>`;
        box.setAttribute('data-hasimg', '1');
      } catch (_) {}
    }
  }

  async function showPerson(personName, token) {
    if (!_peopleIndex) return;
    const set = _peopleIndex.get(personName);
    const albumKeys = set ? Array.from(set.values()) : [];
    _view = { mode: 'person', person: personName, albumKeys };

    renderPersonAlbumsShell(personName);

    const statusEl = panelRoot && panelRoot.querySelector('#peopleStatus');
    const albumsEl = panelRoot && panelRoot.querySelector('#peopleAlbumsList');

    if (statusEl) statusEl.textContent = 'Loading albums...';
    if (albumsEl) albumsEl.innerHTML = `<div style="opacity:.7; font-size:12px; line-height:1.4;">Loading albums...</div>`;
    const items = [];
    let done = 0;

    for (const k of albumKeys) {
      if (token !== _lastRenderToken) return;

      const key = _safeTrim(k);
      if (!key) continue;

      // Start with stub (if we saw it during folder scan)
      const stub = _albumStubByKey.get(key);
      let title = stub && stub.title ? stub.title : '';
      let url = stub && stub.niceUrl ? stub.niceUrl : '';

      // If we loaded the server index, it may have already provided title/url.
      // Use it before hitting the network.
      try {
        const cached = _albumMetaByKey && typeof _albumMetaByKey.get === 'function' ? _albumMetaByKey.get(key) : null;
        if (cached) {
          title = title || cached.title || '';
          url = url || cached.url || '';
        }
      } catch (_) {}

      // If missing title/url, fetch meta (light)
      if (!title || !url) {
        const meta = await limitNet(() => fetchAlbumMetaLight(key));
        if (meta) {
          title = title || meta.title || '';
          url = url || meta.url || '';
        }
      }

      // Normalize URL: if it's a relative path and we are not on SmugMug domain, leave it as-is;
      // if it's missing, we just omit the link.
      items.push({ albumKey: key, title: title || `Album ${key}`, url: url || '' });

      done += 1;
      if (statusEl && (done % 6 === 0 || done === albumKeys.length)) {
        statusEl.textContent = `Loading albums... ${done}/${albumKeys.length}`;
      }
    }

    // Sort albums newest-first (by leading date in title when present), then title for stability.
    items.sort((a, b) => {
      const as = _splitDateFromTitle(String(a.title || ''));
      const bs = _splitDateFromTitle(String(b.title || ''));
      const ad = _dateSortValueFromDateText(as.dateText);
      const bd = _dateSortValueFromDateText(bs.dateText);
      if (bd !== ad) return bd - ad;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });

    if (statusEl) statusEl.textContent = '';
    renderPersonAlbumsList(items, personName);
  }

// ================== PERSON ALBUM CAPTION MATCH SHOTS ==================
function _captionNamesFromString(captionText){
  return parsePeopleCaption(captionText);
}

function _captionHasPerson(captionText, personName){
  const who = _normKey(personName);
  if (!who) return false;
  const parts = _captionNamesFromString(captionText);
  for (const p of parts){
    if (_normKey(p) === who) return true;
  }
  return false;
}

async function fetchCaptionMatchShotsForPerson(albumKey, personName, opts){
  const k = _safeTrim(albumKey);
  const who = _safeTrim(personName);
  if (!k || !who) return [];
  const o = opts || {};
  const maxPages = Math.max(1, Number(o.maxPages || 6));
  const pageSize = Math.min(200, Math.max(25, Number(o.pageSize || 200)));

  const out = [];
  const seen = new Set();

  for (let page = 1; page <= maxPages; page++){
    const start = 1 + ((page - 1) * pageSize);
    const pageJson = await limitNet(() => fetchAlbumImagesPage(k, pageSize, start).catch(() => null));
    const images = pageJson ? extractAlbumImagesFromPage(pageJson) : [];
    if (!images || !images.length) break;

    for (const it of images){
      const imageKey = extractImageKeyFromAlbumImage(it);
      if (!imageKey || seen.has(imageKey)) continue;

      let caption = extractCaptionFromAlbumImage(it);
      if (!caption) {
        // fallback: fetch image detail caption (bounded by server, but we keep pages small)
        caption = await fetchImageCaptionByKey(imageKey);
      }

      if (!_captionHasPerson(caption, who)) continue;

      const thumbUrl = _extractThumbUrlFromAlbumImage(it);
      if (!thumbUrl) continue;

      seen.add(imageKey);
      out.push({ imageKey, thumbUrl });
    }

    // stop early if last page
    try{
      const resp = pageJson && pageJson.Response ? pageJson.Response : pageJson;
      const totalPages = Number(resp?.Pages || resp?.TotalPages || 0);
      if (totalPages && page >= totalPages) break;
    }catch(_){}
  }

  return out;
}

// ================== PEOPLE LIGHTBOX (full-res) ==================
function _upgradeSmugToOriginal(url){
  const u = String(url || '').trim();
  if (!u) return '';
  // Many SmugMug image URLs include "/<size>/" or "/<size>/<file>".
  // Prefer original "O" if present, otherwise leave untouched.
  // Example: .../XL/filename-XL.jpg -> .../O/filename-O.jpg
  return u
    .replace(/\/(S|M|L|XL|X2|X3|Th|T|Ti|Sm|Me|La|Xl|O)\//gi, '/O/')
    .replace(/-(S|M|L|XL|X2|X3|Th|T|Ti|Sm|Me|La|Xl|O)\.(jpg|jpeg|png|webp)(\?.*)?$/i, '-O.$2$3');
}

function _looksLikeDirectImageUrl(url){
  const u = String(url || '').trim();
  if (!u) return false;
  if (/\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(u)) return true;
  if (/\/photos\.smugmug\.com\//i.test(u)) return true;
  if (/^https?:\/\/[^\s]+\/i-[A-Za-z0-9]+\/[A-Za-z0-9]+\//i.test(u)) return true;
  return false;
}

function _bestFullUrlFromImageDetail(detailJson, fallbackThumbUrl){
  const resp = detailJson && detailJson.Response ? detailJson.Response : detailJson;
  const img = resp && resp.Image ? resp.Image : null;

  const candidates = img ? [
    img.OriginalUrl,
    img.LargestImageUrl,
    img.OriginalImageUrl,
    img.OriginalSizeUrl,
    img.ArchivedSizeUrl,
    img.ImageUrl,
    img.LargestUrl,
    img.X3LargeUrl,
    img.X2LargeUrl,
    img.XLargeUrl,
    img.LargeUrl,
    img.MediumUrl,
    img.SmallUrl,
    img.ThumbnailUrl,
    img.TinyUrl,
    img.Url,
    img.URL,
  ] : [];

  for (const candidate of candidates) {
    const url = String(candidate || '').trim();
    if (!url || !_looksLikeDirectImageUrl(url)) continue;
    if (img && img.OriginalUrl && url === String(img.OriginalUrl).trim()) return url;
    return _upgradeSmugToOriginal(url);
  }

  const thumb = String(fallbackThumbUrl || '').trim();
  if (_looksLikeDirectImageUrl(thumb)) return _upgradeSmugToOriginal(thumb);
  return '';
}

async function _getFullUrlForImageKey(imageKey, fallbackThumbUrl){
  const k = _safeTrim(imageKey);
  const thumb = _safeTrim(fallbackThumbUrl);
  if (!k) return _looksLikeDirectImageUrl(thumb) ? _upgradeSmugToOriginal(thumb) : '';
  if (_peopleFullUrlByImageKey.has(k)) {
    const cached = _peopleFullUrlByImageKey.get(k) || '';
    return cached || (_looksLikeDirectImageUrl(thumb) ? _upgradeSmugToOriginal(thumb) : '');
  }
  try{
    const detail = await fetchJsonSafe(`${API_BASE}/smug/image/${encodeURIComponent(k)}`, { retries: 1 });
    const full = _bestFullUrlFromImageDetail(detail, thumb);
    _peopleFullUrlByImageKey.set(k, full || '');
    return full || '';
  }catch(_){
    const fallback = _looksLikeDirectImageUrl(thumb) ? _upgradeSmugToOriginal(thumb) : '';
    _peopleFullUrlByImageKey.set(k, fallback || '');
    return fallback || '';
  }
}

function _peopleLightboxFilename(item, index, fullUrl){
  const rawKey = _safeTrim(item && item.imageKey) || ('photo-' + (Number(index || 0) + 1));
  const base = rawKey.replace(/\.(jpg|jpeg|png|webp)$/i, '') || ('photo-' + (Number(index || 0) + 1));
  const match = String(fullUrl || '').match(/\.(jpg|jpeg|png|webp)(?:\?|$)/i);
  const ext = ((match && match[1]) ? match[1] : 'jpg').toLowerCase();
  return base + '.' + (ext === 'jpeg' ? 'jpg' : ext);
}

async function _downloadPeopleImageFile(url, filename){
  const src = String(url || '').trim();
  const name = String(filename || 'photo.jpg').trim() || 'photo.jpg';
  if (!src || src === '#') return false;

  const fetchUrl = API_BASE + '/show-poster?url=' + encodeURIComponent(src);
  try {
    const res = await fetch(fetchUrl, { cache: 'no-store', credentials: 'omit' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    return true;
  } catch (_) {
    return false;
  }
}

function _ensurePeopleLightbox(){
  if (_peopleLightboxEl && _peopleLightboxImg) return;

  const el = document.createElement('div');
  el.className = 'peopleLightbox';
  el.innerHTML = 
`
    <div class="peopleLightboxInner" role="dialog" aria-modal="true" aria-label="Photo viewer">
      <div class="peopleLightboxTop">
        <div class="peopleLightboxActions">
          <div id="peopleLightboxCounter">1 / 1</div>
          <button type="button" class="peopleLightboxBtn" data-peoplelb="close">Close</button>
        </div>
      </div>
      <div class="peopleLightboxStage">
        <button type="button" class="peopleLightboxBtn peopleLightboxPrev" data-peoplelb="prev" aria-label="Previous photo">&#8592;</button>
        <img id="peopleLightboxImg" alt="" />
        <button type="button" class="peopleLightboxBtn peopleLightboxNext" data-peoplelb="next" aria-label="Next photo">&#8594;</button>
      </div>
      <div class="peopleLightboxStripWrap">
        <div class="peopleLightboxStrip" id="peopleLightboxStrip"></div>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  _peopleLightboxEl = el;
  _peopleLightboxImg = el.querySelector('#peopleLightboxImg');
  _peopleLightboxEl._strip = el.querySelector('#peopleLightboxStrip');
  _peopleLightboxEl._dlBtn = el.querySelector('[data-peoplelb="download"]');

  el.addEventListener('click', (ev) => {
    const tgt = ev.target;
    if (!tgt) return;

    const btn = tgt.closest ? tgt.closest('[data-peoplelb]') : null;
    if (btn) {
      ev.preventDefault();
      ev.stopPropagation();
      const act = _safeTrim(btn.getAttribute('data-peoplelb'));
      if (act === 'close') { _closePeopleLightbox(); return; }
      if (act === 'prev') { _peopleLightboxShow(_peopleLightboxIndex - 1); return; }
      if (act === 'next') { _peopleLightboxShow(_peopleLightboxIndex + 1); return; }
      if (act === 'download') {
        const src = _safeTrim(_peopleLightboxEl && _peopleLightboxEl._downloadUrl);
        const filename = _safeTrim(_peopleLightboxEl && _peopleLightboxEl._downloadName) || ('photo-' + (_peopleLightboxIndex + 1) + '.jpg');
        _downloadPeopleImageFile(src, filename);
        return;
      }
      if (act === 'thumb') {
        const idx = Number(btn.getAttribute('data-idx') || 0);
        _peopleLightboxShow(idx);
        return;
      }
    }

    const img = _peopleLightboxImg;
    const strip = _peopleLightboxEl ? _peopleLightboxEl._strip : null;
    if (img && (tgt === img || (tgt.closest && tgt.closest('#peopleLightboxImg')))) return;
    if (strip && (tgt === strip || (tgt.closest && tgt.closest('#peopleLightboxStrip')))) return;

    _closePeopleLightbox();
  });

  window.addEventListener('keydown', (ev) => {
    if (!_peopleLightboxEl || !_peopleLightboxEl.classList.contains('is-open')) return;
    if (ev.key === 'Escape') { ev.preventDefault(); _closePeopleLightbox(); return; }
    if (ev.key === 'ArrowLeft') { ev.preventDefault(); _peopleLightboxShow(_peopleLightboxIndex - 1); return; }
    if (ev.key === 'ArrowRight') { ev.preventDefault(); _peopleLightboxShow(_peopleLightboxIndex + 1); return; }
  });
}

function _closePeopleLightbox(){
  if (!_peopleLightboxEl) return;
  _peopleLightboxEl.classList.remove('is-open');
  try { document.body.style.overflow = ''; } catch(_) {}
}

async function _peopleLightboxShow(nextIndex){
  if (!_peopleLightboxEl || !_peopleLightboxImg) return;
  const list = Array.isArray(_peopleLightboxList) ? _peopleLightboxList : [];
  if (!list.length) return;

  const idx = (nextIndex < 0) ? (list.length - 1) : (nextIndex >= list.length) ? 0 : nextIndex;
  _peopleLightboxIndex = idx;

  const item = list[idx] || {};
  const imageKey = _safeTrim(item.imageKey);
  const counter = _peopleLightboxEl.querySelector('#peopleLightboxCounter');
  const strip = _peopleLightboxEl._strip;
  const dlBtn = _peopleLightboxEl._dlBtn;
  try { _peopleLightboxImg.removeAttribute('src'); } catch(_) {}
  if (counter) counter.textContent = (idx + 1) + ' / ' + list.length;
  if (strip) {
    try {
      Array.from(strip.querySelectorAll('.peopleLightboxThumb')).forEach((thumbEl, thumbIdx) => {
        thumbEl.classList.toggle('active', thumbIdx === idx);
      });
      const active = strip.querySelector('.peopleLightboxThumb.active');
      if (active && active.scrollIntoView) {
        active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    } catch(_) {}
  }
  const thumb = _safeTrim(item.thumbUrl);
  const full = await _getFullUrlForImageKey(imageKey, thumb);
  const filename = _peopleLightboxFilename(item, idx, full || thumb);
  try {
    _peopleLightboxEl._downloadUrl = full || '';
    _peopleLightboxEl._downloadName = filename;
    if (dlBtn) {
      dlBtn.style.pointerEvents = full ? 'auto' : 'none';
      dlBtn.style.opacity = full ? '1' : '0.55';
    }
  } catch(_) {}
  if (full) {
    try { _peopleLightboxImg.src = full; } catch(_) {}
  }
}

function openPeopleLightbox(list, index){
  _ensurePeopleLightbox();
  _peopleLightboxList = Array.isArray(list) ? list : [];
  _peopleLightboxIndex = Math.max(0, Number(index || 0));
  if (!_peopleLightboxEl) return;

  const strip = _peopleLightboxEl._strip;
  if (strip) {
    try {
      strip.innerHTML = _peopleLightboxList.map((item, idx) => {
        const thumb = _safeTrim(item && item.thumbUrl);
        const active = idx === _peopleLightboxIndex ? ' active' : '';
        return '<img class="peopleLightboxThumb' + active + '" data-peoplelb="thumb" data-idx="' + idx + '" src="' + escapeHtml(thumb) + '" alt="Thumbnail ' + (idx + 1) + '" loading="lazy" decoding="async" />';
      }).join('');
    } catch(_) {}
  }

  _peopleLightboxEl.classList.add('is-open');
  try { document.body.style.overflow = 'hidden'; } catch(_) {}
  _peopleLightboxShow(_peopleLightboxIndex);
}



  async function buildPeopleIndex(onProgress) {
    const folders = await loadBandFoldersFromCsv();
    // If CSV is empty, still try region bases (fail-soft)
    const folderList = folders && folders.length
      ? folders
      : Object.keys(REGION_FOLDER_BASE).map((r) => ({ folder: REGION_FOLDER_BASE[r], region: r }));

    const people = new Map();

    let folderDone = 0;
    let albumDone = 0;
    let albumsWithPeople = 0;

    for (const f of folderList) {
      folderDone += 1;
      const folderPath = String(f.folder || '').trim();
      if (!folderPath) continue;
      const region = String(f.region || '').trim();

      const albums = await limitNet(() => fetchFolderAlbums(folderPath, region).catch(() => []));
      const arr = _coerceArray(albums).filter(Boolean);

      if (typeof onProgress === 'function') {
        onProgress({ phase: 'folders', folderDone, folderTotal: folderList.length, albumDone, albumsWithPeople });
      }

      for (const a of arr) {
        const albumKey = (a && (a.AlbumKey || a.Key || a.albumKey)) ? String(a.AlbumKey || a.Key || a.albumKey).trim() : '';
        if (!albumKey) continue;

        _rememberAlbumStub(albumKey, a);

        albumDone += 1;

        // Phase 1 (debug): read semicolon-delimited people names from photo captions in the album.
        const names = await fetchPeopleFromAlbumByCaptions(albumKey, {
          maxPages: 10,         // Phase 2: scan deeper per album (still bounded)
          pageSize: 200,
          maxDetailFetches: 200 // Phase 2: higher cap for fallback detail lookups
        }).catch(() => []);

        const clean = _coerceArray(names).map((x) => String(x || '').trim()).filter(Boolean);
        if (clean.length) {
          albumsWithPeople += 1;
          for (const nm of clean) {
            if (!people.has(nm)) people.set(nm, new Set());
            people.get(nm).add(albumKey);
          }
        }

        if (typeof onProgress === 'function' && (albumDone % 5 === 0)) {
          onProgress({ phase: 'albums', folderDone, folderTotal: folderList.length, albumDone, albumsWithPeople });
        }
      }
    }

    if (typeof onProgress === 'function') {
      onProgress({ phase: 'done', folderDone, folderTotal: folderList.length, albumDone, albumsWithPeople });
    }

    return people;
  }

  // ================== EVENTS ==================
  function bindEvents() {
    if (!panelRoot) return;

    // Delegated click handler
    panelRoot.addEventListener('click', onRootClick);
    panelRoot.addEventListener('keydown', onRootKeydown);
  }

  function unbindEvents() {
    if (!panelRoot) return;
    panelRoot.removeEventListener('click', onRootClick);
    panelRoot.removeEventListener('keydown', onRootKeydown);
  }

  function onRootClick(e) {
    const t = e && e.target ? e.target : null;
    if (!t || !panelRoot) return;

    // People lightbox controls
    const lbBtn = t.closest ? t.closest('[data-peoplelb]') : null;
    if (lbBtn) {
      e.preventDefault();
      const act = _safeTrim(lbBtn.getAttribute('data-peoplelb'));
      if (act === 'close') { _closePeopleLightbox(); return; }
      if (act === 'prev') { _peopleLightboxShow(_peopleLightboxIndex - 1); return; }
      if (act === 'next') { _peopleLightboxShow(_peopleLightboxIndex + 1); return; }
      if (act === 'thumb') {
        const idx = Number(btn.getAttribute('data-idx') || 0);
        _peopleLightboxShow(idx);
        return;
      }
      if (act === 'thumb') {
        const idx = Number(btn.getAttribute('data-idx') || 0);
        _peopleLightboxShow(idx);
        return;
      }
    }

    // Stats collapsible toggle
    const statsBtn = t.closest ? t.closest('#peopleStatsToggle') : null;
    if (statsBtn) {
      e.preventDefault();
      _peopleStatsCollapsed = !_peopleStatsCollapsed;
      try {
        const wrap = panelRoot && panelRoot.querySelector('#peopleStatsWrap');
        const content = panelRoot && panelRoot.querySelector('#peopleStatsContent');
        const topStats = panelRoot && panelRoot.querySelector('#peopleTopStats');
        if (wrap) wrap.classList.toggle('is-collapsed', !!_peopleStatsCollapsed);
        if (statsBtn) statsBtn.setAttribute('aria-expanded', _peopleStatsCollapsed ? 'false' : 'true');
        if (content) content.style.display = _peopleStatsCollapsed ? 'none' : '';
        if (topStats) topStats.style.display = _peopleStatsCollapsed ? 'none' : '';
        try { sessionStorage.setItem('vm_music_people_stats_collapsed_v1', _peopleStatsCollapsed ? '1' : '0'); } catch (_) {}
      } catch (_) {}
      return;
    }

    const toggleShotsBtn = t.closest ? t.closest('[data-people-toggle-shots="1"]') : null;
    if (toggleShotsBtn) {
      e.preventDefault();
      e.stopPropagation();
      const drop = t.closest ? t.closest('.peopleAlbumDrop[data-albumdrop="1"]') : null;
      const grid = drop ? drop.querySelector('.peopleAlbumDropGrid') : null;
      const thumbs = grid ? Array.from(grid.querySelectorAll('.peopleShotThumb[data-imagekey]')) : [];
      const previewCount = Math.max(0, Number(toggleShotsBtn.getAttribute('data-preview-count') || 0));
      const expand = toggleShotsBtn.getAttribute('aria-expanded') !== 'true';
      thumbs.forEach((el, idx) => {
        el.classList.toggle('is-hidden', !expand && idx >= previewCount);
      });
      toggleShotsBtn.setAttribute('aria-expanded', expand ? 'true' : 'false');
      if (grid) grid.setAttribute('data-expanded', expand ? '1' : '0');
      toggleShotsBtn.textContent = expand ? 'Show less' : 'Show all';
      return;
    }

    // Shot thumbnail (caption match grid)
    const shotBtn = t.closest ? t.closest('.peopleShotThumb[data-imagekey]') : null;
    if (shotBtn) {
      e.preventDefault();
      e.stopPropagation();
      const idx = Number(shotBtn.getAttribute('data-idx') || 0);
      openPeopleLightbox(_peopleLightboxList, idx);
      return;
    }

    // Album accordion (person view)
    const albumItem = t.closest ? t.closest('.peopleTimelineItem[data-albumkey]') : null;
    if (albumItem && _view && _view.mode === 'person') {
      // Don't toggle when clicking inside the expanded drop content (except thumbnails handled above)
      const inDrop = t.closest ? t.closest('.peopleAlbumDrop[data-albumdrop="1"]') : null;
      if (inDrop) return;
      e.preventDefault();
      const key = _safeTrim(albumItem.getAttribute('data-albumkey'));
      if (key) {
        // Build list for lightbox from the cached album matches (if present)
        const cached = _albumCaptionMatchCache.get(key);
        const who = _view && _view.person ? String(_view.person) : '';
        const list = (cached && cached.forPerson === _normKey(who) && Array.isArray(cached.shots)) ? cached.shots : [];
        _peopleLightboxList = list;
        _openPersonAlbum(key, who);
      }
      return;
    }

    // Rebuild index (server-side, force)
    const rebuildBtn = t.closest ? t.closest('#peopleRebuildBtn') : null;
    if (rebuildBtn) {
      e.preventDefault();
      const token = ++_lastRenderToken;
      const statusEl = panelRoot.querySelector('#peopleStatus');
      if (statusEl) statusEl.textContent = 'Rebuilding...';

      // Reset view to list on rebuild
      _view = { mode: 'list', person: '', albumKeys: [] };
      resetPeopleIndexCacheState();

      loadPeopleIndexFromServer({ force: true, full: true, token })
        .then((idx) => {
          if (token !== _lastRenderToken) return;
          if (statusEl) statusEl.textContent = '';
          _peopleIndex = idx || new Map();
          // Persist photo counts too so header totals don't regress to 0 on refresh.
          try { savePeopleIndexToSession(_peopleIndex, _photoCountByPerson); } catch (_) {}
          renderPeopleList(_peopleIndex);
          try { if (typeof window.vmDing === 'function') window.vmDing(); } catch (_) {}
        })
        .catch((err) => {
          console.warn('[people] rebuild failed:', err);
          if (token !== _lastRenderToken) return;
          if (statusEl) statusEl.textContent = '';
          _peopleIndex = new Map();
          renderPeopleList(_peopleIndex);
        });
      return;
    }

    // Back button
    const backBtn = t.closest ? t.closest('#peopleBackBtn') : null;
    if (backBtn) {
      e.preventDefault();
      _view = { mode: 'list', person: '', albumKeys: [] };
      const statusEl = panelRoot.querySelector('#peopleStatus');
      if (statusEl) statusEl.textContent = '';
      if (_peopleIndex) renderPeopleList(_peopleIndex);
      return;
    }

    // Letter filter
    const letterBtn = t.closest ? t.closest('#peopleLetterNav [data-letter]') : null;
    if (letterBtn) {
      e.preventDefault();
      const L = _safeTrim(letterBtn.getAttribute('data-letter'));
      _setPeopleLetter(L);
      if (_peopleIndex) renderPeopleList(_peopleIndex);
      return;
    }

    // Person card
    const card = t.closest ? t.closest('[data-person]') : null;
    if (card) {
      const name = _safeTrim(card.getAttribute('data-person'));
      if (!name) return;
      e.preventDefault();

      // Token guard for async render
      const token = ++_lastRenderToken;

      // Keep header stable
      const statusEl = panelRoot.querySelector('#peopleStatus');
      if (statusEl) statusEl.textContent = '';

      showPerson(name, token);
    }
  }

  
  function onRootKeydown(e) {
    const t = e && e.target ? e.target : null;
    if (!t || !panelRoot) return;

    const statsTgl = t.closest ? t.closest('#peopleStatsToggle') : null;
    if (statsTgl && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      // Trigger the same logic as click (delegated)
      try { statsTgl.click(); } catch (_) {
        _peopleStatsCollapsed = !_peopleStatsCollapsed;
        try {
          const wrap = panelRoot && panelRoot.querySelector('#peopleStatsWrap');
          const content = panelRoot && panelRoot.querySelector('#peopleStatsContent');
          const topStats = panelRoot && panelRoot.querySelector('#peopleTopStats');
          if (wrap) wrap.classList.toggle('is-collapsed', !!_peopleStatsCollapsed);
          if (statsTgl) statsTgl.setAttribute('aria-expanded', _peopleStatsCollapsed ? 'false' : 'true');
          if (content) content.style.display = _peopleStatsCollapsed ? 'none' : '';
          if (topStats) topStats.style.display = _peopleStatsCollapsed ? 'none' : '';
          try { sessionStorage.setItem('vm_music_people_stats_collapsed_v1', _peopleStatsCollapsed ? '1' : '0'); } catch (_) {}
        } catch (_) {}
      }
    }
  }

async function loadPeopleIndexFromServer({ force = false, full = false, token, ifNewerThan = '' } = {}) {
    if (!panelRoot) return new Map();

    // De-dupe rapid calls. If we just started a load very recently, reuse it.
    // (This is the main fix for the "many requests very fast" symptom.)
    try {
      const now = Date.now();
      if (!force && _peopleIndexLoadPromise && (now - (_peopleIndexLastLoadAt || 0) < 2500)) {
        return await _peopleIndexLoadPromise;
      }
      _peopleIndexLastLoadAt = now;
    } catch (_) {}

    const metaEl = panelRoot.querySelector('#peopleMeta');
    const statusEl = panelRoot.querySelector('#peopleStatus');

    if (metaEl) metaEl.textContent = 'Server index';
    if (statusEl) statusEl.textContent = force ? 'Rebuilding...' : 'Loading...';

    // IMPORTANT: only force rebuild when explicitly requested.
    // Otherwise, we want the server's memory/disk cache for speed.
    const qs = [];
    if (force) qs.push('force=1');
    // Intentionally ignore "full" so rebuilds always use the faster incremental server path.

    // Cache-bust every request (prevents browser/proxy cached JSON during rebuild testing)
    qs.push(`cb=${Date.now()}`);
    const url = `${API_BASE}/index/people?${qs.join("&")}`;

    // Helper: fetch JSON with explicit no-store so we always see the freshest response.
    const fetchNoStore = async (u) => {
      const rr = await fetch(u, { cache: 'no-store' });
      let j = null;
      try { j = await rr.json(); } catch (_) {}
      return { rr, j };
    };

    // 1) Try once (force/full optionally)
    const run = (async () => {
      let { rr: r, j: data } = await fetchNoStore(url);

    // 2) If a rebuild is already in progress, poll until it completes (or we timeout).
    // Server behavior: when a build is running and force=1 is requested, it can reply 202 "building".
    // Also, non-force requests can return cached payload with cache.building=true.
const started = Date.now();
const timeoutMs = 1000 * 60 * 8; // 8 minutes max polling
const pollDelayMs = 2000;

    const isBuilding = (resp, json) => {
      if (resp && resp.status === 202) return true;
      if (json && (json.status === 'building' || json.message === 'People index rebuild already in progress.')) return true;
      if (json && json.cache && json.cache.building) return true;
      return false;
    };

      if (isBuilding(r, data)) {
      // While building, poll non-force endpoint until generatedAt changes (or build flag clears).
      const basePrev = String(ifNewerThan || _peopleIndexGeneratedAt || '');
        while (Date.now() - started < timeoutMs) {
          await new Promise((res) => setTimeout(res, pollDelayMs));
          const pollUrl = `${API_BASE}/index/people?cb=${Date.now()}`;
          const out = await fetchNoStore(pollUrl);
          r = out.rr; data = out.j;
          const gen = data && data.generatedAt ? String(data.generatedAt) : '';
          if (!isBuilding(r, data) && (!basePrev || (gen && gen !== basePrev))) break;
        }
      }

      // Track server generatedAt for cache comparisons
      try { _peopleIndexGeneratedAt = data && data.generatedAt ? String(data.generatedAt) : (_peopleIndexGeneratedAt || ''); } catch (_) {}


      if (token && token !== _lastRenderToken) return new Map();

      const peopleArr = Array.isArray(data?.people) ? data.people : [];

      const idx = new Map();
      _albumMetaByKey = new Map();

      for (const p of peopleArr) {
      const name = _safeTrim(p?.name);
      if (!name) continue;
      try {
        const pc = Number(p?.photoCount);
        _photoCountByPerson.set(name, Number.isFinite(pc) ? pc : 0);
      } catch (_) { _photoCountByPerson.set(name, 0); }

      const albums = Array.isArray(p?.albums) ? p.albums : [];
      const set = new Set();
      for (const a of albums) {
        const k = _safeTrim(a?.albumKey);
        if (!k) continue;
        set.add(k);
        // Seed meta cache so person drill-in is instant.
        _albumMetaByKey.set(k, { title: a?.title || '', url: a?.url || '' });
      }
      if (set.size) idx.set(name, set);
      }

      const gen = data?.generatedAt ? String(data.generatedAt) : '';
	  
	  try {
  const layer = data && data.cache && data.cache.layer ? String(data.cache.layer) : '';
  if (metaEl) {
    metaEl.textContent = layer ? `Server index (${layer})` : 'Server index';
  }
  if (statusEl) {
    statusEl.textContent = force
      ? (layer ? `Rebuilt from ${layer}.` : 'Rebuild complete.')
      : (layer ? `Loaded from ${layer}.` : '');
  }
} catch (_) {}

      const scanned = Number.isFinite(Number(data?.albumsScanned)) ? Number(data.albumsScanned) : null;
      if (metaEl) {
        const left = `${idx.size} people indexed`;
        const extra = scanned !== null ? ` - albums scanned: ${scanned}` : "";
        const right = gen ? ` - ${gen.replace('T', ' ').replace('Z', '')}` : "";
        metaEl.textContent = `${left}${extra}${right}`;
      }

      // Totals (photos + unique albums)
      _peopleTotals = _computePeopleTotals(idx);
      _renderPeopleTotals(_peopleTotals);
      if (statusEl) statusEl.textContent = '';

      // Audible cue (optional)
      try { if (typeof window.vmDing === 'function') window.vmDing(); } catch (_) {}

      return idx;
    })();

    _peopleIndexLoadPromise = run;
    try {
      return await run;
    } finally {
      // Release only if no newer run replaced it.
      if (_peopleIndexLoadPromise === run) _peopleIndexLoadPromise = null;
    }
  }

  // ================== PUBLIC MODULE API ==================
  function render() {
    return `
      <div id="people-root" style="width:100%;">
        <div class="peopleHeaderTop">
          
          <div id="peopleStatus" class="peopleHeaderStatus"></div>
          ${SHOW_REBUILD_BUTTON ? `
            <button type="button" id="peopleRebuildBtn"
              style="cursor:pointer; border:0; background:rgba(0,0,0,0.18); box-shadow:0 0 0 1px rgba(255,70,110,0.25) inset; border-radius:10px; padding:8px 10px; font-weight:900; font-size:10px; letter-spacing:.14em; text-transform:uppercase;">
              Rebuild
            </button>
          ` : ''}
        </div>
        <div class="peopleArchiveIntro" aria-label="People Archive Introduction">
          <div class="peopleArchiveIntroTitle">The Archive - Filter By Band</div>
          <div class="peopleArchiveIntroBody">
            Welcome to the Archives, sorted by Band. The band section is split up into regions - Local being Maine-based,
            Regional being New England-based, National being USA-based, and International being around the world. From
            there it is split into letter groupings. Green boxes are fully done bands, Yellow are in progress, and Grey is not
            touched yet.
          </div>
        </div>
        <!-- A-Z filter (darkens letters with no entries) -->
        <div class="peopleLetterRow">
          <div id="peopleLetterNav" class="peopleLetterNav" aria-label="People A to Z filter"></div>
        </div>
        <div id="peopleFilterMeta" class="peopleFilterMeta"></div>

        <div id="peopleList"></div>
      </div>
    `;
  }
  function onMount(panelEl) {
    panelRoot = panelEl || document.getElementById('musicContentPanel') || document.body;

    // Styles (once)
    try { ensurePeopleStyles(); } catch (_) {}

    // Default to collapsed whenever the People page opens.
    _peopleStatsCollapsed = true;

    try {
      const wrap = panelRoot && panelRoot.querySelector('#peopleStatsWrap');
      const btn = panelRoot && panelRoot.querySelector('#peopleStatsToggle');
      const content = panelRoot && panelRoot.querySelector('#peopleStatsContent');
      const topStats = panelRoot && panelRoot.querySelector('#peopleTopStats');
      if (wrap) wrap.classList.toggle('is-collapsed', !!_peopleStatsCollapsed);
      if (btn) btn.setAttribute('aria-expanded', _peopleStatsCollapsed ? 'false' : 'true');
      if (content) content.style.display = _peopleStatsCollapsed ? 'none' : '';
      if (topStats) topStats.style.display = _peopleStatsCollapsed ? 'none' : '';
    } catch (_) {}

    // Ensure events only bound once per mount
    unbindEvents();
    bindEvents();

    const statusEl = panelRoot && panelRoot.querySelector('#peopleStatus');
    const token = ++_lastRenderToken;


    try {
      const pendingPerson = _safeTrim(window.__vmMusicPendingPerson || '');
      if (pendingPerson) {
        _view = { mode: 'person', person: pendingPerson, albumKeys: [] };
        window.__vmMusicPendingPerson = '';
      }
    } catch (_) {}
    // Fast path: session-cached index (prevents rebuilds on every click)
    if (!_peopleIndex) {
      try { _peopleIndex = loadPeopleIndexFromSession(); } catch (_) {}
    }

    // If we already built it, render immediately.
    if (_peopleIndex) {
      if (token !== _lastRenderToken) return;
      if (statusEl) statusEl.textContent = '';
      if (_view && _view.mode === 'person' && _view.person) {
        // Restore detail view (fast path)
        showPerson(_view.person, token);
      } else {
        renderPeopleList(_peopleIndex);
      }

      // Keep the last completed People index stable on normal visits.
      // Rebuilds should only happen from the explicit rebuild button.
      quietlyRefreshPeopleIndex(token);
      return;
    }

    // Phase 2: load server-cached people index (fast)
    if (!_buildPromise) {
      _buildPromise = loadPeopleIndexFromServer({ force: false, token })
        .then((idx) => {
          _peopleIndex = idx || new Map();
          // Persist photo counts too so header totals don't regress to 0 on refresh.
          try { savePeopleIndexToSession(_peopleIndex, _photoCountByPerson); } catch (_) {}
          return _peopleIndex;
        })
        .catch((err) => {
          console.warn('[people] server index failed:', err);
          _peopleIndex = new Map();
          return _peopleIndex;
        })
        .finally(() => {
          _buildPromise = null;
        });
    }

    _buildPromise.then((idx) => {
      if (token !== _lastRenderToken) return;
      if (statusEl) statusEl.textContent = '';
      if (_view && _view.mode === 'person' && _view.person) {
        showPerson(_view.person, token);
      } else {
        renderPeopleList(idx || new Map());
      }
    });
  }

  function openPerson(personName) {
    const who = _safeTrim(personName);
    if (!who) return;
    _view = { mode: 'person', person: who, albumKeys: [] };

    if (!panelRoot) return;

    const token = ++_lastRenderToken;
    const statusEl = panelRoot.querySelector('#peopleStatus');
    if (statusEl) statusEl.textContent = '';

    if (_peopleIndex) {
      showPerson(who, token);
      return;
    }

    if (_buildPromise) {
      _buildPromise.then(() => {
        if (token !== _lastRenderToken) return;
        if (_peopleIndex) showPerson(who, token);
      }).catch(() => {});
    }
  }

  function destroy() {
    // Soft reset only. (We keep built caches in memory for fast return.)
    unbindEvents();
    panelRoot = null;
    _lastRenderToken += 1;
  }

  window.MusicArchivePeople = { render, onMount, destroy, openPerson };
})();


