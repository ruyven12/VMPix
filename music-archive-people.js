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

  // Used only for enriching the People→Albums drill-in with show posters (fail-soft).
  const SHOWS_CSV_ENDPOINT = `${API_BASE}/sheet/shows`;
  const PEOPLE_SHOWS_CSV_TTL_MS = 1000 * 60 * 60 * 12; // 12h
  const PEOPLE_SHOWS_CSV_CACHE_KEY = 'musicArchive_people_shows_csv_v1';

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

  // People index: Map(personName -> Set(albumKey))
  let _peopleIndex = null;

  // Album stub cache: Map(albumKey -> { title?, url?, urlPath?, niceUrl? })
  let _albumStubByKey = new Map();

  // Album meta cache: Map(albumKey -> { title, url })
  let _albumMetaByKey = new Map();
  // Photo count cache: Map(personName -> Number)
  let _photoCountByPerson = new Map();

  // Shows poster lookup (date|title -> poster_url)
  let _showsPosterMap = null;

  // Header totals (computed client-side)
  let _peopleTotals = { people: 0, photos: 0, albums: 0 };

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

  function _dateToIso(d) {
    // Accepts M/D/YY, M/D/YYYY, etc. Returns YYYY-MM-DD or ''
    const s = String(d || '').trim();
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!m) return '';
    let mm = parseInt(m[1], 10);
    let dd = parseInt(m[2], 10);
    let yy = parseInt(m[3], 10);
    if (!Number.isFinite(mm) || !Number.isFinite(dd) || !Number.isFinite(yy)) return '';
    if (yy < 100) yy = 2000 + yy;
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return '';
    const p2 = (x) => String(x).padStart(2, '0');
    return `${yy}-${p2(mm)}-${p2(dd)}`;
  }

  function _parseAlbumTitleForShow(title) {
    const s = String(title || '').trim();
    const m = s.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})\s*-\s*(.+)$/);
    if (!m) return { showDate: '', showTitle: '' };
    return { showDate: m[1].trim(), showTitle: m[2].trim() };
  }

  function _showKey(dateStr, titleStr) {
    const iso = _dateToIso(dateStr);
    if (!iso) return '';
    const t = _normKey(titleStr);
    if (!t) return '';
    return `${iso}|${t}`;
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
    if (!panelRoot) return;
    const el = panelRoot.querySelector('#peopleTotals');
    if (!el) return;
    const t = totals || { people: 0, photos: 0, albums: 0 };
    el.textContent = `${_fmtInt(t.people)} PEOPLE \u2022 ${_fmtInt(t.photos)} PHOTOS \u2022 ${_fmtInt(t.albums)} ALBUMS`;
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

      sessionStorage.setItem(PEOPLE_INDEX_CACHE_KEY, JSON.stringify({ t: Date.now(), v, p }));
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

    const res = await fetch(url);
    const txt = await res.text();
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

  async function ensureShowsPosterMap() {
    if (_showsPosterMap && typeof _showsPosterMap.get === 'function') return _showsPosterMap;
    try {
      const { text, ct } = await fetchTextWithSessionCache(
        SHOWS_CSV_ENDPOINT,
        PEOPLE_SHOWS_CSV_TTL_MS,
        PEOPLE_SHOWS_CSV_CACHE_KEY
      );
      if (!text || !text.trim()) {
        _showsPosterMap = new Map();
        return _showsPosterMap;
      }

      const raw = String(text || '').trim();
      let rows = null;

      // JSON first (mirrors shows module behavior; fail-soft)
      if ((ct && String(ct).includes('application/json')) || /^[\s]*[\[{]/.test(raw)) {
        try {
          const parsed = JSON.parse(raw);
          rows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.rows) ? parsed.rows : null);
        } catch (_) {
          // ignore; try CSV below
        }
      }

      const map = new Map();

      if (Array.isArray(rows)) {
        for (const r of rows) {
          const d = (r?.show_date || r?.date || '').trim();
          const t = (r?.show_name || r?.title || '').trim();
          const p = (r?.poster_url || r?.show_url || '').trim();
          const k = _showKey(d, t);
          if (k && p) map.set(k, p);
        }
        _showsPosterMap = map;
        return map;
      }

      // CSV fallback
      const lines = raw.split(/\r?\n/).filter((l) => l.trim());
      const headerLine = lines.shift();
      if (!headerLine) {
        _showsPosterMap = map;
        return map;
      }
      const header = parseCsvLine(headerLine).map((h) => h.trim());
      const headerLower = header.map((h) => h.toLowerCase());

      const nameIdx = headerLower.indexOf('show_name') !== -1 ? headerLower.indexOf('show_name') : headerLower.indexOf('title');
      const dateIdx = headerLower.indexOf('show_date') !== -1 ? headerLower.indexOf('show_date') : headerLower.indexOf('date');
      const posterIdx = headerLower.indexOf('poster_url') !== -1 ? headerLower.indexOf('poster_url') : headerLower.indexOf('show_url');

      for (const line of lines) {
        const cols = parseCsvLine(line);
        const d = dateIdx !== -1 ? String(cols[dateIdx] || '').trim() : '';
        const t = nameIdx !== -1 ? String(cols[nameIdx] || '').trim() : '';
        const p = posterIdx !== -1 ? String(cols[posterIdx] || '').trim() : '';
        const k = _showKey(d, t);
        if (k && p) map.set(k, p);
      }

      _showsPosterMap = map;
      return map;
    } catch (_) {
      _showsPosterMap = new Map();
      return _showsPosterMap;
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

    /* Person drill-in: Timeline + album cards (items 1,2,3,5) */
    .peopleTimelineWrap{
      position: relative;
      width: 100%;
      max-width: 980px;
      margin: 0 auto;
      box-sizing: border-box;
      padding: 4px 0 0 0;
    }
    .peopleTimelineWrap:before{
      content: '';
      position: absolute;
      left: 28px;
      top: 6px;
      bottom: 6px;
      width: 1px;
      background: rgba(255,70,110,0.18);
      box-shadow: 0 0 14px rgba(255,70,110,0.10);
      pointer-events: none;
    }
    .peopleTimelineItem{
      display: grid;
      grid-template-columns: 84px 86px 1fr;
      gap: 12px;
      align-items: center;
      padding: 10px 12px;
      margin: 10px 0;
      border-radius: 14px;
      background: rgba(0,0,0,0.14);
      box-shadow: 0 0 0 1px rgba(255,70,110,0.18) inset;
    }
    .peopleTimelineDateCol{
      position: relative;
      min-height: 54px;
      display:flex;
      align-items:center;
      justify-content:flex-end;
      padding-right: 2px;
    }
    .peopleTimelineNode{
      position: absolute;
      left: 24px;
      top: 50%;
      width: 10px;
      height: 10px;
      transform: translate(-50%, -50%);
      border-radius: 999px;
      background: rgba(255,70,110,0.55);
      box-shadow: 0 0 0 2px rgba(0,0,0,0.55), 0 0 18px rgba(255,70,110,0.22);
    }
    .peopleTimelineDatePill{
      margin-left: 0;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(0,0,0,0.18);
      box-shadow: 0 0 0 1px rgba(255,255,255,0.10) inset;
      font-weight: 900;
      font-size: 11px;
      letter-spacing: .10em;
      text-transform: uppercase !important;
      white-space: nowrap;
    }
    .peopleTimelinePosterCol{
      width: 86px;
      display:flex;
      align-items:center;
      justify-content:center;
    }
    .peoplePosterBox{
      width: 78px;
      height: 78px;
      border-radius: 14px;
      overflow: hidden;
      background: rgba(0,0,0,0.16);
      box-shadow: 0 0 0 1px rgba(255,70,110,0.16) inset;
      display:flex;
      align-items:center;
      justify-content:center;
      flex: 0 0 auto;
    }
    .peoplePosterImg{
      width: 100%;
      height: 100%;
      object-fit: cover;
      display:block;
    }
    .peoplePosterPlaceholder{
      width: 100%;
      height: 100%;
      display:flex;
      align-items:center;
      justify-content:center;
      font-weight: 900;
      font-size: 11px;
      letter-spacing: .12em;
      text-transform: uppercase !important;
      opacity: .55;
    }
    .peopleTimelineContent{
      min-width: 0;
      display:flex;
      flex-direction: column;
      gap: 6px;
      align-items: flex-start;
    }
    .peopleTimelineTitle{
      font-weight: 900;
      font-size: 13px;
      letter-spacing: .02em;
      line-height: 1.25;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
    }
    .peopleTimelineActions{ display:flex; gap: 10px; align-items:center; }
    .peopleOpenBtn{
      text-decoration:none;
      display:inline-block;
      font-weight:800;
      font-size:11px;
      letter-spacing:.12em;
      text-transform:uppercase !important;
      padding:8px 10px;
      border-radius:10px;
      background:rgba(0,0,0,0.18);
      box-shadow:0 0 0 1px rgba(255,70,110,0.25) inset;
    }
    @media (max-width: 720px){
      .peopleTimelineItem{ grid-template-columns: 78px 80px 1fr; padding: 10px; }
      .peoplePosterBox{ width: 72px; height: 72px; border-radius: 12px; }
      .peopleTimelineWrap:before{ left: 26px; }
      .peopleTimelineNode{ left: 22px; }
      .peopleTimelineDatePill{ margin-left: 0; }
    }
  `;
  document.head.appendChild(s);
}
  function renderPeopleList(indexMap) {
    if (!panelRoot) return;
    const listEl = panelRoot.querySelector('#peopleList');
    const metaEl = panelRoot.querySelector('#peopleMeta');
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
}
  function renderPersonAlbumsShell(personName) {
    if (!panelRoot) return;
    const listEl = panelRoot.querySelector('#peopleList');
    const metaEl = panelRoot.querySelector('#peopleMeta');
    if (metaEl) metaEl.textContent = 'Person';

    // Hide A–Z while drilling in
    try {
      const navEl = panelRoot.querySelector('#peopleLetterNav');
      if (navEl) navEl.style.display = 'none';
      const fm = panelRoot.querySelector('#peopleFilterMeta');
      if (fm) fm.textContent = '';
    } catch (_) {}

    if (!listEl) return;

    listEl.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin:6px 0 10px;">
        <button type="button" id="peopleBackBtn"
          style="cursor:pointer; border:0; background:rgba(0,0,0,0.18); box-shadow:0 0 0 1px rgba(255,70,110,0.25) inset; border-radius:10px; padding:8px 10px; font-weight:800; font-size:11px; letter-spacing:.12em; text-transform:uppercase;">
          ← Back
        </button>
        <div style="flex:1; min-width:0; text-align:right;">
          <div style="font-weight:900; font-size:13px; letter-spacing:.02em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${_eh(personName)}
          </div>
          <div id="peopleAlbumCount" style="opacity:.75; font-size:11px; letter-spacing:.10em; text-transform:uppercase; margin-top:3px;"></div>
        </div>
      </div>

      <div id="peopleAlbumsList"></div>
    `;
  }

  function renderPersonAlbumsList(items) {
    if (!panelRoot) return;
    const albumsEl = panelRoot.querySelector('#peopleAlbumsList');
    const countEl = panelRoot.querySelector('#peopleAlbumCount');
    if (countEl) countEl.textContent = `Albums: ${items.length}`;

    if (!albumsEl) return;

    if (!items.length) {
      albumsEl.innerHTML = `<div style="opacity:.7; font-size:12px; line-height:1.4;">No albums found for this person.</div>`;
      return;
    }

    // Timeline layout: left date rail + poster tile + content (title + open)
    albumsEl.innerHTML = `
      <div class="peopleTimelineWrap">
        ${items.map((a) => {
          const dateLabel = _eh(a.showDate || '—');
          const title = _eh(a.title || `Album ${a.albumKey}`);
          const href = a.url ? _eh(a.url) : '';
          const posterUrl = a.posterUrl ? _eh(a.posterUrl) : '';

          const poster = posterUrl
            ? `<div class="peoplePosterBox"><img class="peoplePosterImg" src="${posterUrl}" alt="Poster" loading="lazy" /></div>`
            : `<div class="peoplePosterBox"><div class="peoplePosterPlaceholder">Poster</div></div>`;

          const openBtn = href
            ? `<a class="peopleOpenBtn" href="${href}" target="_blank" rel="noopener noreferrer">Open</a>`
            : `<div style="opacity:.6; font-size:11px;">Album key: ${_eh(a.albumKey)}</div>`;

          return `
            <div class="peopleTimelineItem">
              <div class="peopleTimelineDateCol">
                <div class="peopleTimelineNode"></div>
                <div class="peopleTimelineDatePill">${dateLabel}</div>
              </div>
              <div class="peopleTimelinePosterCol">
                ${poster}
              </div>
              <div class="peopleTimelineContent">
                <div class="peopleTimelineTitle" title="${title}">${title}</div>
                <div class="peopleTimelineActions">${openBtn}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
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

    // Best-effort shows poster lookup (fail-soft)
    let posterMap = null;
    try { posterMap = await ensureShowsPosterMap(); } catch (_) { posterMap = new Map(); }

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

      // Derive show date/title from album title (common pattern: M/D/YY - Show Name)
      const parsed = _parseAlbumTitleForShow(title || '');
      const showDate = parsed.showDate || '';
      const showTitle = parsed.showTitle || (title || `Album ${key}`);

      // Prefer show poster for the card image (fail-soft)
      let posterUrl = '';
      try {
        const sk = _showKey(showDate, showTitle);
        if (sk && posterMap && typeof posterMap.get === 'function') posterUrl = String(posterMap.get(sk) || '').trim();
      } catch (_) {}

      // Normalize URL: if it's a relative path and we are not on SmugMug domain, leave it as-is;
      // if it's missing, we just omit the link.
      items.push({
        albumKey: key,
        title: showTitle || `Album ${key}`,
        url: url || '',
        showDate,
        posterUrl,
        _iso: _dateToIso(showDate)
      });

      done += 1;
      if (statusEl && (done % 6 === 0 || done === albumKeys.length)) {
        statusEl.textContent = `Loading albums… ${done}/${albumKeys.length}`;
      }
    }

    if (token !== _lastRenderToken) return;

    // Sort by show date (newest first) when available; otherwise by title
    items.sort((a, b) => {
      const ai = String(a._iso || '');
      const bi = String(b._iso || '');
      if (ai && bi) return bi.localeCompare(ai);
      if (ai && !bi) return -1;
      if (!ai && bi) return 1;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });

    if (statusEl) statusEl.textContent = '';
    renderPersonAlbumsList(items);
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
  }

  function unbindEvents() {
    if (!panelRoot) return;
    panelRoot.removeEventListener('click', onRootClick);
  }

  function onRootClick(e) {
    const t = e && e.target ? e.target : null;
    if (!t || !panelRoot) return;

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

  async function loadPeopleIndexFromServer({ force = false, full = false, token } = {}) {
    if (!panelRoot) return new Map();

    const metaEl = panelRoot.querySelector('#peopleMeta');
    const statusEl = panelRoot.querySelector('#peopleStatus');

    if (metaEl) metaEl.textContent = 'Server index';
    if (statusEl) statusEl.textContent = force ? 'Rebuilding…' : 'Loading…';

    // IMPORTANT: only force rebuild when explicitly requested.
    // Otherwise, we want the server's memory/disk cache for speed.
    const qs = [];
    if (force) qs.push('force=1');
    if (full) qs.push('full=1');
    const url = `${API_BASE}/index/people${qs.length ? ("?" + qs.join("&")) : ""}`;
    const r = await fetch(url);
    const data = await r.json();

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
  }

  // ================== PUBLIC MODULE API ==================
  function render() {
    return `
      <div id="people-root" style="width:100%;">
        <div class="peopleHeaderTop">
          <div class="peopleHeaderTitle">People</div>
          <div id="peopleStatus" class="peopleHeaderStatus"></div>
          ${SHOW_REBUILD_BUTTON ? `
            <button type="button" id="peopleRebuildBtn"
              style="cursor:pointer; border:0; background:rgba(0,0,0,0.18); box-shadow:0 0 0 1px rgba(255,70,110,0.25) inset; border-radius:10px; padding:8px 10px; font-weight:900; font-size:10px; letter-spacing:.14em; text-transform:uppercase;">
              Rebuild
            </button>
          ` : ''}
        </div>

        <!-- Centered totals pill (full-width row) -->
        <div class="peopleTotalsRow">
          <div id="peopleTotals" style="opacity:.85; font-size:11px; letter-spacing:.12em; text-transform:uppercase; padding:7px 10px; border-radius:999px; display:inline-flex; align-items:center; gap:8px; background:rgba(0,0,0,0.18); box-shadow:0 0 0 1px rgba(255,70,110,0.22) inset;">0 PEOPLE • 0 PHOTOS • 0 ALBUMS</div>
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

      // If the People index was restored from session, we likely *don't* have photo counts
      // (they are not stored in session). Quietly refresh from the server to seed counts
      // and update the UI (replacing placeholders like —).
      try {
        const needsCounts = !_photoCountByPerson || typeof _photoCountByPerson.size !== 'number' || _photoCountByPerson.size === 0;
        if (needsCounts && !_buildPromise) {
          _buildPromise = loadPeopleIndexFromServer({ force: false, token })
            .then((idx) => {
              _peopleIndex = idx || new Map();
              // Persist photo counts too so header totals don't regress to 0 on refresh.
              try { savePeopleIndexToSession(_peopleIndex, _photoCountByPerson); } catch (_) {}
              return _peopleIndex;
            })
            .catch((err) => {
              console.warn('[people] server counts refresh failed:', err);
              return _peopleIndex || new Map();
            })
            .finally(() => {
              _buildPromise = null;
            });

          _buildPromise.then((idx) => {
            if (token !== _lastRenderToken) return;
            if (_view && _view.mode === 'person' && _view.person) {
              showPerson(_view.person, token);
            } else {
              renderPeopleList(idx || new Map());
            }
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
