// music-archive-people.js
// Step 2-3 (People tab):
// - Build a People index (album counts only) from SmugMug album keywords (on-demand).
// - Step 3: Click a person to view the albums they appear in (album-level drill-in).
// - Fail-soft: if any album/folder/meta fails, continue.
// - Surgical: does not touch Bands/Shows modules or Buy Photos behavior.

(function () {
  'use strict';

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

  // People index: Map(personName -> Set(albumKey))
  let _peopleIndex = null;

  // Album stub cache: Map(albumKey -> { title?, url?, urlPath?, niceUrl? })
  let _albumStubByKey = new Map();

  // Album meta cache: Map(albumKey -> { title, url })
  let _albumMetaByKey = new Map();

  // When using the server-side people index, we seed this cache up-front.

  // View state
  let _view = { mode: 'list', person: '', albumKeys: [] };

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
  // Stores a compact mapping: { personName: [albumKey, ...], ... }
  // Keeps rebuilds from happening on every People click.
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
      return map.size ? map : null;
    } catch (_) {
      return null;
    }
  }

  function savePeopleIndexToSession(map) {
    try {
      if (!map || typeof map.forEach !== 'function') return;
      const v = {};
      map.forEach((set, person) => {
        const p = String(person || '').trim();
        if (!p) return;
        const arr = Array.from(set || []).map((k) => String(k || '').trim()).filter(Boolean);
        if (arr.length) v[p] = arr;
      });
      sessionStorage.setItem(PEOPLE_INDEX_CACHE_KEY, JSON.stringify({ t: Date.now(), v }));
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

  function renderPeopleList(indexMap) {
    if (!panelRoot) return;
    const listEl = panelRoot.querySelector('#peopleList');
    const metaEl = panelRoot.querySelector('#peopleMeta');
    if (!listEl) return;

    const entries = Array.from(indexMap.entries()).map(([name, set]) => ({ name, albums: set.size }));
    entries.sort((a, b) => a.name.localeCompare(b.name));

    if (metaEl) metaEl.textContent = `${entries.length} people indexed`;

    if (!entries.length) {
      listEl.innerHTML = `<div style="opacity:.7; font-size:12px; line-height:1.4;">No people found yet. Add semicolon-delimited names to photo captions.</div>`;
      return;
    }

    listEl.innerHTML = entries
      .map(
        (p) => `
        <button type="button" class="peopleCard" data-person="${_eh(p.name)}"
          style="width:100%; text-align:left; cursor:pointer; padding:10px 12px; border:0; border-radius:10px; background:rgba(0,0,0,0.18); box-shadow:0 0 0 1px rgba(255,70,110,0.25) inset; margin:8px 0;">
          <div style="font-weight:800; font-size:13px; letter-spacing:.02em;">${_eh(p.name)}</div>
          <div style="opacity:.75; font-size:11px; letter-spacing:.10em; text-transform:uppercase; margin-top:3px;">Albums: ${p.albums}</div>
        </button>
      `
      )
      .join('');
  }

  function renderPersonAlbumsShell(personName) {
    if (!panelRoot) return;
    const listEl = panelRoot.querySelector('#peopleList');
    const metaEl = panelRoot.querySelector('#peopleMeta');
    if (metaEl) metaEl.textContent = 'Person';

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

    // Keep this simple and safe: title + open link (if available)
    albumsEl.innerHTML = items
      .map((a) => {
        const title = _eh(a.title || `Album ${a.albumKey}`);
        const href = a.url ? _eh(a.url) : '';
        const openBtn = href
          ? `<a href="${href}" target="_blank" rel="noopener noreferrer"
                style="text-decoration:none; display:inline-block; margin-top:8px; font-weight:800; font-size:11px; letter-spacing:.12em; text-transform:uppercase; padding:8px 10px; border-radius:10px; background:rgba(0,0,0,0.18); box-shadow:0 0 0 1px rgba(255,70,110,0.25) inset;">
                Open
              </a>`
          : `<div style="opacity:.6; font-size:11px; margin-top:8px;">Album key: ${_eh(a.albumKey)}</div>`;

        return `
          <div class="peopleAlbumCard"
            style="padding:12px; border-radius:12px; background:rgba(0,0,0,0.14); box-shadow:0 0 0 1px rgba(255,70,110,0.20) inset; margin:10px 0;">
            <div style="font-weight:900; font-size:13px; letter-spacing:.02em;">${title}</div>
            ${openBtn}
          </div>
        `;
      })
      .join('');
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

    // Sort albums by title for now (stable + predictable)
    items.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));

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

      loadPeopleIndexFromServer({ force: true, token })
        .then((idx) => {
          if (token !== _lastRenderToken) return;
          if (statusEl) statusEl.textContent = '';
          _peopleIndex = idx || new Map();
          try { savePeopleIndexToSession(_peopleIndex); } catch (_) {}
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

  async function loadPeopleIndexFromServer({ force = false, token } = {}) {
    if (!panelRoot) return new Map();

    const metaEl = panelRoot.querySelector('#peopleMeta');
    const statusEl = panelRoot.querySelector('#peopleStatus');

    if (metaEl) metaEl.textContent = 'Server index';
    if (statusEl) statusEl.textContent = force ? 'Rebuilding…' : 'Loading…';

    const url = `${API_BASE}/index/people${force ? '?force=1' : ''}`;
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
    if (statusEl) statusEl.textContent = '';

    // Audible cue (optional)
    try { if (typeof window.vmDing === 'function') window.vmDing(); } catch (_) {}

    return idx;
  }

  // ================== PUBLIC MODULE API ==================
  function render() {
    return `
      <div id="people-root" style="width:100%;">
        <div style="display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin-bottom:10px;">
          <div>
            <div style="font-weight:900; font-size:14px; letter-spacing:.14em; text-transform:uppercase;">People</div>
            <div id="peopleMeta" style="opacity:.7; font-size:11px; letter-spacing:.08em; text-transform:uppercase; margin-top:4px;">On-demand index</div>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <button type="button" id="peopleRebuildBtn"
              style="cursor:pointer; border:0; background:rgba(0,0,0,0.18); box-shadow:0 0 0 1px rgba(255,70,110,0.25) inset; border-radius:10px; padding:8px 10px; font-weight:900; font-size:10px; letter-spacing:.14em; text-transform:uppercase;">
              Rebuild
            </button>
            <div id="peopleStatus" style="opacity:.75; font-size:11px; letter-spacing:.10em; text-transform:uppercase; white-space:nowrap;"></div>
          </div>
        </div>

        <div id="peopleList"></div>
      </div>
    `;
  }

  function onMount(panelEl) {
    panelRoot = panelEl || document.getElementById('musicContentPanel') || document.body;

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
      return;
    }

    // Phase 2: load server-cached people index (fast)
    if (!_buildPromise) {
      _buildPromise = loadPeopleIndexFromServer({ force: false, token })
        .then((idx) => {
          _peopleIndex = idx || new Map();
          try { savePeopleIndexToSession(_peopleIndex); } catch (_) {}
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
