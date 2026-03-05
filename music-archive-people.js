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
  const SHOW_REBUILD_BUTTON = true;

  // ================== CONFIG (match music-archive-bands.js) ==================
  const DEFAULT_API_BASE = 'https://music-archive-3lfa.onrender.com';
  const API_BASE =
    (typeof window !== 'undefined' &&
      typeof window.MUSIC_ARCHIVE_API_BASE === 'string' &&
      window.MUSIC_ARCHIVE_API_BASE.trim())
      ? window.MUSIC_ARCHIVE_API_BASE.trim().replace(/\/$/, '')
      : DEFAULT_API_BASE;

  const CSV_ENDPOINT = `${API_BASE}/sheet/bands`;

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
  let _peopleStatsCollapsed = false;

  // When using the server-side people index, we seed this cache up-front.

  // View state
  let _view = { mode: 'list', person: '', albumKeys: [] };

  // Letter filter (A-Z). null = All
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
    let m = raw.match(/^\s*(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\s*(?:[-–—:]\s*)?(.*)$/);
    if (m) {
      const yyyy = m[1];
      const mm = String(m[2]).padStart(2, '0');
      const dd = String(m[3]).padStart(2, '0');
      const rest = String(m[4] || '').trim();
      return { dateText: `${mm}/${dd}/${yyyy.slice(-2)}`, restTitle: rest };
    }

    // M/D/YY ... or M-D-YYYY ...
    m = raw.match(/^\s*(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\s*(?:[-–—:]\s*)?(.*)$/);
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
    parts.push(btn('ALL', 'ALL', false));
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

  function renderPeopleStatsTiles() {
    if (!panelRoot) return;

    const t = _peopleTotals || { people: 0, photos: 0, albums: 0 };

    const elPeople = panelRoot.querySelector('#peopleStatPeople');
    const elPhotos = panelRoot.querySelector('#peopleStatPhotos');
    const elAlbums = panelRoot.querySelector('#peopleStatAlbums');
    const elTotal = panelRoot.querySelector('#peopleStatTotalShots');
    const elPct = panelRoot.querySelector('#peopleStatPercent');

    if (elPeople) elPeople.textContent = _fmtInt(t.people);
    if (elPhotos) elPhotos.textContent = _fmtInt(t.photos);
    if (elAlbums) elAlbums.textContent = _fmtInt(t.albums);

    // Total Shots + Percent need the Stats CSV.
    // Render best-effort immediately; update once loaded.
    const applyTotalAndPct = (totalShots) => {
      const total = Number(totalShots);
      if (elTotal) elTotal.textContent = _fmtInt(Number.isFinite(total) ? total : 0);
      const pct = (Number.isFinite(total) && total > 0)
        ? (Number(t.photos || 0) / total) * 100
        : 0;
      if (elPct) elPct.textContent = _fmtPct(pct, 2);
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
  const limitNet = pLimit(2);

  // ---- Session cache (Bands CSV) ----
  const PEOPLE_BANDS_CSV_CACHE_KEY = 'vm_music_people_bands_csv_v1';
  const PEOPLE_BANDS_CSV_TTL_MS = 1000 * 60 * 30;

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
    return fetchJsonSafe(url, { retries: 2 });
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
    // Different payload shapes across endpoints.
    // We accept any direct URL here; if absent, we leave blank.
    return (
      _pickFirst(albumImage, ['ThumbnailUrl', 'ThumbUrl', 'SmallUrl', 'MediumUrl', 'LargestUrl', 'X3LargeUrl', 'XLargeUrl', 'LargeUrl', 'WebUri', 'Url', 'URL', 'Uri']) ||
      _pickFirst(albumImage && albumImage.Image, ['ThumbnailUrl', 'ThumbUrl', 'SmallUrl', 'MediumUrl', 'LargestUrl', 'X3LargeUrl', 'XLargeUrl', 'LargeUrl', 'WebUri', 'Url', 'URL', 'Uri']) ||
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

    /* ===== People: Stats tiles (no click/routing) ===== */
    .peopleStatsBlock{
      width: min(980px, 96%);
      margin: 0 auto 8px;
      padding: 10px 10px 12px;
      border-radius: 18px;
      background: rgba(0,0,0,0.10);
      box-shadow: 0 0 0 1px rgba(255,70,110,0.16) inset;
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      position: relative;
      overflow: hidden;
    }
    /* Remove the thin horizontal "scan" lines inside the stats block */
    .peopleStatsBlock::before,
    .peopleStatsBlock::after{
      display:none;
    }

    .peopleStatsHdr{
      width: 100%;
      text-align:center;
      font-weight: 900;
      font-size: 12px;
      letter-spacing: .16em;
      text-transform: uppercase;
      opacity: .90;
      margin: 0 0 10px 0;
      position: relative;
      z-index: 2;
    }

    .peopleStatsHdrToggle{
      cursor: pointer;
      user-select: none;
      display:flex;
      align-items:center;
      justify-content:center;
      gap: 10px;
    }
    .peopleStatsToggleIcon{
      display:inline-block;
      transition: transform 160ms ease, opacity 160ms ease;
      opacity: .85;
    }
    .peopleStatsCollapsible.is-collapsed .peopleStatsToggleIcon{
      transform: rotate(-90deg);
    }
    .peopleStatsTiles{
      width: 100%;
      display:grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
      align-items: stretch;
      justify-items: stretch;
      pointer-events: none;
      user-select: none;
      position: relative;
      z-index: 2;
    }
    .peopleStatTile{
      border-radius: 16px;
      padding: 10px 10px 9px;
      background: rgba(0,0,0,0.18);
      border: 1px solid rgba(255,70,110,0.18);
      box-shadow: 0 14px 32px rgba(0,0,0,0.34);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      overflow: hidden;
      position: relative;
      text-align:center;
    }
    .peopleStatTile::before{
      content:"";
      position:absolute;
      inset: 0;
      background:
        radial-gradient(120px 80px at 50% 20%, rgba(255,70,110,0.14), transparent 60%),
        radial-gradient(120px 80px at 50% 110%, rgba(0,210,255,0.06), transparent 60%);
      opacity: .60;
      pointer-events:none;
    }
    .peopleStatLabel{
      font-size: 10px;
      letter-spacing: .18em;
      text-transform: uppercase;
      opacity: .80;
      position: relative;
      z-index: 2;
    }
    .peopleStatValue{
      font-weight: 900;
      font-size: 28px;
      letter-spacing: .06em;
      line-height: 1.05;
      margin: 8px 0 6px;
      color: rgba(255,210,210,0.92);
      text-shadow: 0 0 18px rgba(255,70,110,0.14);
      position: relative;
      z-index: 2;
    }
    .peopleStatSub{
      font-size: 10px;
      letter-spacing: .16em;
      text-transform: uppercase;
      opacity: .62;
      position: relative;
      z-index: 2;
    }
    @media (max-width: 980px){
      .peopleStatsTiles{ grid-template-columns: repeat(3, minmax(0,1fr)); }
    }
    @media (max-width: 640px){
      .peopleStatsTiles{ grid-template-columns: repeat(2, minmax(0,1fr)); }
      .peopleStatValue{ font-size: 24px; }
      .peopleStatsBlock::before{ top: 40px; }
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
      font-size: 11px;
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
    /* Timeline autosize (safe override): aligns date rail, node, and shrinks date column so cards line up */
    .peopleTimelineWrap{ --peopleTlX: 24px; }
    .peopleTimelineWrap:before{ left: var(--peopleTlX); }
    .peopleTimelineNode{ left: var(--peopleTlX); }

    .peopleTimelineItem{ grid-template-columns: auto 86px 1fr; column-gap: 12px; }
    .peopleTimelineDateCol{
      justify-content: flex-end;
      min-width: 52px;
      padding-left: calc(var(--peopleTlX) + 10px);
      padding-right: 2px;
      box-sizing: border-box;
    }
    .peopleTimelineDatePill{ margin-left: 0 !important; }

    @media (max-width: 720px){
      .peopleTimelineWrap{ --peopleTlX: 22px; }
      .peopleTimelineItem{ grid-template-columns: auto 80px 1fr; padding: 10px; }
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
      object-fit: cover;
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
    #peopleTopStats{ width: 100%; margin: 10px auto 10px; }
    .peopleTopStatsHdr{ display:flex; align-items:baseline; justify-content:center; gap:10px; margin-bottom: 8px; }
    .peopleTopStatsTitle{
      font-family: "Orbitron", system-ui, sans-serif;
      font-size: 12px;
      letter-spacing: .16em;
      text-transform: uppercase;
      opacity: .86;
    }
    .peopleTopStatsSub{
      font-family: "Orbitron", system-ui, sans-serif;
      font-size: 10px;
      letter-spacing: .18em;
      text-transform: uppercase;
      opacity: .62;
    }
    .peopleTopStatsGrid{
      width: 100%;
      display:grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      align-items: stretch;
      justify-items: stretch;
      pointer-events: none;
      user-select: none;
    }
    .peopleTopStatCard{
      position: relative;
      border-radius: 16px;
      padding: 12px 12px 11px;
      background: rgba(0,0,0,0.18);
      border: 1px solid rgba(255,70,110,0.18);
      box-shadow: 0 12px 28px rgba(0,0,0,0.32);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      overflow: hidden;
    }
    .peopleTopStatCard::before{
      content:"";
      position:absolute;
      left: 0;
      top: 10px;
      bottom: 10px;
      width: 2px;
      border-radius: 999px;
      background: rgba(255,70,110,0.65);
      box-shadow: 0 0 12px rgba(255,70,110,0.18);
      opacity: .85;
      pointer-events:none;
    }
    .peopleTopStatRank{
      font-family: "Orbitron", system-ui, sans-serif;
      font-size: 18px;
      letter-spacing: 0;
      text-transform: none;
      opacity: .95;
      line-height: 1;
      margin-bottom: 6px;
    }
    .peopleTopStatName{
      font-weight: 900;
      font-size: 13px;
      letter-spacing: .02em;
      opacity: .95;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .peopleTopStatMeta{
      margin-top: 8px;
      font-family: "Orbitron", system-ui, sans-serif;
      font-size: 10px;
      letter-spacing: .14em;
      text-transform: uppercase;
      opacity: .70;
      display:flex;
      flex-wrap:wrap;
      align-items:center;
      justify-content:flex-start;
      gap: 6px;
    }
    .peopleTopStatMeta .k{ opacity: .95; font-weight: 900; }
    .peopleTopStatMeta .lbl{ opacity: .72; }
    .peopleTopStatMeta .dot{ opacity: .45; }

    @media (max-width: 720px){
      .peopleTopStatsGrid{ grid-template-columns: 1fr; }
      .peopleTopStatCard{ border-radius: 18px; }
      .peopleTopStatName{ font-size: 14px; }
    }

  

/* Person album accordion (caption-match shots) */
.peopleTimelineItem{ cursor: pointer; }
.peopleTimelineItem.is-open{ box-shadow: 0 0 0 1px rgba(255,70,110,0.28) inset, 0 10px 26px rgba(0,0,0,0.35); }
.peopleAlbumDrop{
  grid-column: 1 / -1;
  margin-top: 10px;
  background: rgba(0,0,0,0.22);
  border-radius: 18px;
  padding: 12px;
  box-shadow: 0 0 0 1px rgba(255,70,110,0.18) inset;
}
.peopleAlbumDropHdr{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 10px;
  margin-bottom: 10px;
  opacity: .92;
  font-family: "Orbitron", system-ui, sans-serif;
  font-size: 10px;
  letter-spacing: .14em;
  text-transform: uppercase;
}
.peopleAlbumDropCount{ opacity: .78; }
.peopleAlbumDropGrid{
  display:grid;
  grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  gap: 10px;
}
.peopleShotThumb{
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  border: 0;
  padding: 0;
  border-radius: 14px;
  cursor: pointer;
  overflow: hidden;
  background: rgba(0,0,0,0.20);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.08) inset, 0 14px 30px rgba(0,0,0,0.35);
}
.peopleShotThumb img{
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transform: translateZ(0);
}
.peopleShotBadge{
  position:absolute;
  top: 8px;
  left: 8px;
  font-family: "Orbitron", system-ui, sans-serif;
  font-size: 10px;
  letter-spacing: .08em;
  padding: 3px 7px;
  border-radius: 999px;
  background: rgba(0,0,0,0.45);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.12) inset;
  color: rgba(255,255,255,0.92);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

/* People Lightbox */
.peopleLightbox{
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0,0,0,0.86);
  display: none;
  align-items: center;
  justify-content: center;
  padding: 18px;
}
.peopleLightbox.is-open{ display:flex; }
.peopleLightboxInner{
  width: min(1200px, 96vw);
  max-height: 90vh;
  display:flex;
  flex-direction: column;
  gap: 10px;
}
.peopleLightboxTop{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 10px;
  font-family: "Orbitron", system-ui, sans-serif;
  font-size: 10px;
  letter-spacing: .14em;
  text-transform: uppercase;
  opacity: .9;
}
.peopleLightboxBtn{
  cursor:pointer;
  border:0;
  background: rgba(0,0,0,0.25);
  box-shadow: 0 0 0 1px rgba(255,70,110,0.25) inset;
  color: rgba(255,255,255,0.92);
  border-radius: 10px;
  padding: 8px 10px;
  font-weight: 900;
  font-size: 10px;
  letter-spacing: .14em;
  text-transform: uppercase;
  display:inline-flex;
  align-items:center;
  gap: 8px;
}
.peopleLightboxStage{
  flex: 1;
  min-height: 0;
  display:flex;
  align-items:center;
  justify-content:center;
  background: rgba(0,0,0,0.18);
  border-radius: 18px;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.06) inset;
  overflow: hidden;
}
.peopleLightboxStage img{
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display:block;
}
.peopleLightboxNav{
  display:flex;
  justify-content: space-between;
  gap: 10px;
}
.peopleLightboxNav .peopleLightboxBtn{ flex: 1; justify-content:center; }

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

    // Render A–Z nav (with empty letters dimmed)
    renderPeopleLetterNav(indexMap);

    const letter = _getPeopleLetter();
    const entries = letter
      ? allEntries.filter((p) => _letterForName(p.name) === letter)
      : allEntries;

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
      listEl.innerHTML = `<div style="opacity:.7; font-size:12px; line-height:1.4;">No people under <strong>${_eh(L || '')}</strong>.</div>`;
      return;
    }

      listEl.innerHTML = entries
    .map((p) => {
      const photosTxt = (p.photos === null) ? '—' : String(p.photos);
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


// Top 3 stats (display-only; no click/routing)
function renderTopStats(indexMap){
  if (!panelRoot) return;
  const host = panelRoot.querySelector('#peopleTopStats');
  if (!host) return;

  // Always reset (prevents stale content across filters/rebuilds)
  host.style.display = '';

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
    </div>
    <div class="peopleTopStatsGrid">
      ${top.map((t, i) => {
        const photosTxt = (t.photos === null) ? '—' : String(t.photos);
        const albumsTxt = String(t.albums || 0);
        const medal = (i === 0) ? '🥇' : (i === 1) ? '🥈' : '🥉';
        const ariaRank = (i === 0) ? 'Gold medal' : (i === 1) ? 'Silver medal' : 'Bronze medal';
        return `
          <div class="peopleTopStatCard" role="group" aria-label="${_eh(ariaRank)} ${_eh(t.name)}">
            <div class="peopleTopStatRank" style="text-align:center" aria-hidden="true">${_eh(medal)}   ${_eh(t.name)}</div>
            <div class="peopleTopStatMeta">
              <span class="lbl">Photos</span> <span class="k">${_eh(photosTxt)}</span>
              <span class="dot">•</span>
              <span class="lbl">Albums</span> <span class="k">${_eh(albumsTxt)}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

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


    // Hide A–Z while drilling in
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
          style="cursor:pointer; border:0; background:rgba(0,0,0,0.18); box-shadow:0 0 0 1px rgba(255,70,110,0.25) inset; border-radius:12px; padding:9px 12px; font-weight:900; font-size:11px; letter-spacing:.12em; text-transform:uppercase;">
          ← Back
        </button>
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
        const mainTitle = _eh(split.restTitle || rawTitle);
        const href = a.url ? _eh(a.url) : '';

        return `
          <div class="peopleTimelineItem" data-albumkey="${_eh(a.albumKey)}">
            <div class="peopleTimelineNode" style="top: 26px;"></div>

            <div class="peopleTimelineDateCol">
              ${dateTxt ? `<div class="peopleTimelineDatePill">${dateTxt}</div>` : ''}
            </div>

            <div class="peopleTimelinePosterCol">
              <div class="peoplePosterBox" data-albumkey="${_eh(a.albumKey)}">
                <div class="peoplePosterFallback">${_eh((mainTitle || 'A').trim()[0] || 'A')}</div>
              </div>
            </div>

            <div class="peopleTimelineBody">
              <div class="peopleTimelineTitle" title="${_eh(split.restTitle || rawTitle)}">${mainTitle}</div>
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
  drop.innerHTML = `<div style="opacity:.75; font-size:12px; padding:8px 2px;">Loading shots…</div>`;

  const who = _safeTrim(personName);
  const cached = _albumCaptionMatchCache.get(key);
  let shots = (cached && cached.forPerson === _normKey(who) && Array.isArray(cached.shots)) ? cached.shots : null;

  if (!shots){
    shots = await fetchCaptionMatchShotsForPerson(key, who, { maxPages: 10, pageSize: 200 }).catch(() => []);
    _albumCaptionMatchCache.set(key, { forPerson: _normKey(who), shots: Array.isArray(shots) ? shots : [] });
  }

  if (!panelRoot) return;
  // If user switched albums while loading, abort
  if (_openPersonAlbumKey !== key) return;

  const list = Array.isArray(shots) ? shots : [];
  _peopleLightboxList = list;
  drop.innerHTML = `
    <div class="peopleAlbumDropHdr">
      <div>Tagged shots (caption match)</div>
      <div class="peopleAlbumDropCount">${list.length}</div>
    </div>
    <div class="peopleAlbumDropGrid">
      ${list.map((s, i) => {
        const ik = _safeTrim(s.imageKey);
        const tu = _safeTrim(s.thumbUrl);
        if (!ik || !tu) return '';
        return `
          <button type="button" class="peopleShotThumb" data-imagekey="${_eh(ik)}" data-idx="${i}">
            <span class="peopleShotBadge">#${i + 1}</span>
            <img src="${_eh(tu)}" alt="" loading="lazy" decoding="async"/>
          </button>
        `;
      }).join('')}
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

    if (statusEl) statusEl.textContent = 'Loading albums…';
    if (albumsEl) albumsEl.innerHTML = `<div style="opacity:.7; font-size:12px; line-height:1.4;">Loading…</div>`;

    // Build album list using stubs when available; fetch meta when needed.
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
        statusEl.textContent = `Loading albums… ${done}/${albumKeys.length}`;
      }
    }

    if (token !== _lastRenderToken) return;

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
  const raw = String(captionText || '').trim();
  if (!raw) return [];
  // Semicolon-delimited (your vmpix convention); also allow commas as a fallback.
  const parts = raw.split(';').join(';').split(';').map((x) => String(x || '').trim()).filter(Boolean);
  return parts;
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
  const u = String(url || '');
  // Many SmugMug image URLs include "/<size>/" or "/<size>/<file>".
  // Prefer original "O" if present, otherwise leave untouched.
  // Example: .../XL/filename-XL.jpg -> .../O/filename-O.jpg
  return u
    .replace(/\/([A-Z]{1,4})\//g, '/O/')
    .replace(/-([A-Z]{1,4})\.(jpg|jpeg|png|webp)(\?.*)?$/i, '-O.$2$3');
}

function _bestFullUrlFromImageDetail(detailJson){
  const resp = detailJson && detailJson.Response ? detailJson.Response : detailJson;
  const img = resp && resp.Image ? resp.Image : null;
  if (!img) return '';

  const url =
    _pickFirst(img, ['OriginalUrl','LargestUrl','X3LargeUrl','X2LargeUrl','XLargeUrl','LargeUrl','WebUri','Url','URL','Uri']) ||
    '';

  if (!url) return '';
  // Prefer the direct OriginalUrl if present; else try to upgrade.
  if (img.OriginalUrl) return String(img.OriginalUrl).trim();
  return _upgradeSmugToOriginal(url);
}

async function _getFullUrlForImageKey(imageKey){
  const k = _safeTrim(imageKey);
  if (!k) return '';
  if (_peopleFullUrlByImageKey.has(k)) return _peopleFullUrlByImageKey.get(k) || '';
  try{
    const detail = await fetchJsonSafe(`${API_BASE}/smug/image/${encodeURIComponent(k)}`, { retries: 1 });
    const full = _bestFullUrlFromImageDetail(detail);
    _peopleFullUrlByImageKey.set(k, full || '');
    return full || '';
  }catch(_){
    _peopleFullUrlByImageKey.set(k, '');
    return '';
  }
}

function _ensurePeopleLightbox(){
  if (_peopleLightboxEl && _peopleLightboxImg) return;

  const el = document.createElement('div');
  el.className = 'peopleLightbox';
  el.innerHTML = `
    <div class="peopleLightboxInner" role="dialog" aria-modal="true" aria-label="Photo viewer">
      <div class="peopleLightboxTop">
        <div id="peopleLightboxCounter">Photo</div>
        <button type="button" class="peopleLightboxBtn" data-peoplelb="close">Close ✕</button>
      </div>
      <div class="peopleLightboxStage">
        <img id="peopleLightboxImg" alt="" />
      </div>
      <div class="peopleLightboxNav">
        <button type="button" class="peopleLightboxBtn" data-peoplelb="prev">← Prev</button>
        <button type="button" class="peopleLightboxBtn" data-peoplelb="next">Next →</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  _peopleLightboxEl = el;
  _peopleLightboxImg = el.querySelector('#peopleLightboxImg');

  // Close on backdrop click
  el.addEventListener('click', (ev) => {
    const tgt = ev.target;
    if (!tgt) return;
    if (tgt === el) _closePeopleLightbox();
  });

  // Keyboard controls
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
  if (counter) counter.textContent = `Photo ${idx + 1} / ${list.length}`;

  // Show thumb immediately while full-res loads
  const thumb = _safeTrim(item.thumbUrl);
  if (thumb) {
    try { _peopleLightboxImg.src = thumb; } catch(_) {}
  }

  const full = await _getFullUrlForImageKey(imageKey);
  if (full) {
    try { _peopleLightboxImg.src = full; } catch(_) {}
  }
}

function openPeopleLightbox(list, index){
  _ensurePeopleLightbox();
  _peopleLightboxList = Array.isArray(list) ? list : [];
  _peopleLightboxIndex = Math.max(0, Number(index || 0));
  if (!_peopleLightboxEl) return;
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
    }

    // Stats collapsible toggle
    const statsBtn = t.closest ? t.closest('#peopleStatsToggle') : null;
    if (statsBtn) {
      e.preventDefault();
      _peopleStatsCollapsed = !_peopleStatsCollapsed;
      try {
        const wrap = panelRoot && panelRoot.querySelector('#peopleStatsWrap');
        const content = panelRoot && panelRoot.querySelector('#peopleStatsContent');
        if (wrap) wrap.classList.toggle('is-collapsed', !!_peopleStatsCollapsed);
        if (statsBtn) statsBtn.setAttribute('aria-expanded', _peopleStatsCollapsed ? 'false' : 'true');
        if (content) content.style.display = _peopleStatsCollapsed ? 'none' : '';
        try { sessionStorage.setItem('vm_music_people_stats_collapsed_v1', _peopleStatsCollapsed ? '1' : '0'); } catch (_) {}
      } catch (_) {}
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
      if (statusEl) statusEl.textContent = 'Rebuilding…';

      // Reset view to list on rebuild
      _view = { mode: 'list', person: '', albumKeys: [] };
      _peopleIndex = null;
      _albumMetaByKey = new Map();

      try { sessionStorage.removeItem(PEOPLE_INDEX_CACHE_KEY); } catch (_) {}

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
          if (wrap) wrap.classList.toggle('is-collapsed', !!_peopleStatsCollapsed);
          if (statsTgl) statsTgl.setAttribute('aria-expanded', _peopleStatsCollapsed ? 'false' : 'true');
          if (content) content.style.display = _peopleStatsCollapsed ? 'none' : '';
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
    if (statusEl) statusEl.textContent = force ? 'Rebuilding…' : 'Loading…';

    // IMPORTANT: only force rebuild when explicitly requested.
    // Otherwise, we want the server's memory/disk cache for speed.
    const qs = [];
    if (force) qs.push('force=1');
    if (full) qs.push('full=1');

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
    const timeoutMs = 60_000; // 60s max polling
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

      // If the server returns a cached empty build (0 albums scanned),
      // retry once with force=1 to avoid users getting stuck with "0 people indexed".
      try {
        const scanned0 = !Number(data?.albumsScanned || 0);
        const people0 = Array.isArray(data?.people) && data.people.length === 0;
        if (!force && scanned0 && people0) {
          return await loadPeopleIndexFromServer({ force: true, token });
        }
      } catch (_) {}

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
      const scanned = Number.isFinite(Number(data?.albumsScanned)) ? Number(data.albumsScanned) : null;
      if (metaEl) {
        const left = `${idx.size} people indexed`;
        const extra = scanned !== null ? ` • albums scanned: ${scanned}` : '';
        const right = gen ? ` • ${gen.replace('T', ' ').replace('Z', '')}` : '';
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
          <div class="peopleHeaderTitle">The Individual Index</div>
          <div id="peopleStatus" class="peopleHeaderStatus"></div>
          ${SHOW_REBUILD_BUTTON ? `
            <button type="button" id="peopleRebuildBtn"
              style="cursor:pointer; border:0; background:rgba(0,0,0,0.18); box-shadow:0 0 0 1px rgba(255,70,110,0.25) inset; border-radius:10px; padding:8px 10px; font-weight:900; font-size:10px; letter-spacing:.14em; text-transform:uppercase;">
              Rebuild
            </button>
          ` : ''}
        </div>

        <!-- People Stats + Top 3 (collapsible) -->
        <div id="peopleStatsWrap" class="peopleStatsCollapsible" aria-label="People Stats">
          <!-- Centered header is the click target -->
          <div id="peopleStatsToggle" class="peopleStatsHdr peopleStatsHdrToggle" role="button" tabindex="0"
               aria-expanded="true" aria-controls="peopleStatsContent">
            <span>Stats</span>
            <span class="peopleStatsToggleIcon" aria-hidden="true">▾</span>
          </div>

          <div id="peopleStatsContent" class="peopleStatsContent">
            <!-- People Stats (tiles) -->
            <div class="peopleStatsBlock" aria-label="People Stats tiles">
              <div class="peopleStatsTiles" role="group" aria-label="People stats tiles">
                <div class="peopleStatTile">
                  <div id="peopleStatPeople" class="peopleStatValue">0</div>
                  <div class="peopleStatSub">People Tagged</div>
                </div>
                <div class="peopleStatTile">
                  <div id="peopleStatPhotos" class="peopleStatValue">0</div>
                  <div class="peopleStatSub">Photos Indexed</div>
                </div>
                <div class="peopleStatTile">
                  <div id="peopleStatAlbums" class="peopleStatValue">0</div>
                  <div class="peopleStatSub">Albums</div>
                </div>
                <div class="peopleStatTile">
                  <div id="peopleStatTotalShots" class="peopleStatValue">0</div>
                  <div class="peopleStatSub">Total Shots</div>
                </div>
                <div class="peopleStatTile">
                  <div id="peopleStatPercent" class="peopleStatValue">0%</div>
                  <div class="peopleStatSub">Total Shots Indexed</div>
                </div>
              </div>
            </div>

            <!-- Top 3 (display-only; no click/routing) -->
            <div id="peopleTopStats"></div>
          </div>
        </div>

        <!-- A–Z filter (darkens letters with no entries) -->
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

    // Restore stats collapse state (session-scoped)
    try {
      const raw = sessionStorage.getItem('vm_music_people_stats_collapsed_v1');
      _peopleStatsCollapsed = raw === '1';
    } catch (_) { _peopleStatsCollapsed = false; }

    try {
      const wrap = panelRoot && panelRoot.querySelector('#peopleStatsWrap');
      const btn = panelRoot && panelRoot.querySelector('#peopleStatsToggle');
      const content = panelRoot && panelRoot.querySelector('#peopleStatsContent');
      if (wrap) wrap.classList.toggle('is-collapsed', !!_peopleStatsCollapsed);
      if (btn) btn.setAttribute('aria-expanded', _peopleStatsCollapsed ? 'false' : 'true');
      if (content) content.style.display = _peopleStatsCollapsed ? 'none' : '';
    } catch (_) {}

    // Ensure events only bound once per mount
    unbindEvents();
    bindEvents();

    const statusEl = panelRoot && panelRoot.querySelector('#peopleStatus');
    const token = ++_lastRenderToken;

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

      // If the People index was restored from session, do a quiet refresh from the server.
      // This seeds photo counts *and* picks up any newer server index (generatedAt changes).
      try {
        if (!_buildPromise && !_peopleQuietRefreshDone) {
          _peopleQuietRefreshDone = true;
          const prevGen = _peopleIndexGeneratedAt || '';
          _buildPromise = loadPeopleIndexFromServer({ force: false, token, ifNewerThan: prevGen })
            .then((idx) => {
              _peopleIndex = idx || new Map();
              try { savePeopleIndexToSession(_peopleIndex, _photoCountByPerson); } catch (_) {}
              // Only rerender if server had newer data.
              if ((_peopleIndexGeneratedAt || '') !== (prevGen || '')) {
                if (_view && _view.mode === 'person' && _view.person) showPerson(_view.person, token);
                else renderPeopleList(_peopleIndex);
              }
              return _peopleIndex;
            })
            .catch((err) => {
              console.warn('[people] server refresh failed:', err);
              return _peopleIndex || new Map();
            })
            .finally(() => {
              _buildPromise = null;
            });
        }
      } catch (_) {}
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
      renderPeopleList(idx || new Map());
    });
  }

  function destroy() {
    // Soft reset only. (We keep built caches in memory for fast return.)
    unbindEvents();
    panelRoot = null;
    _lastRenderToken += 1;
  }

  window.MusicArchivePeople = { render, onMount, destroy };
})();
