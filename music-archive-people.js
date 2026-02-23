// music-archive-people.js
// Step 2 (People tab): build a People index (album counts only) from SmugMug album keywords.
// - On-demand: work begins only when People tab mounts.
// - Fail-soft: if any album/folder fails, continue.
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
  let _peopleIndex = null; // Map(name -> Set(albumKey))
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

  const limitNet = pLimit(2);

  // ---- Session cache (Bands CSV) ----
  const PEOPLE_BANDS_CSV_CACHE_KEY = 'vm_music_people_bands_csv_v1';
  const PEOPLE_BANDS_CSV_TTL_MS = 1000 * 60 * 30;

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

  async function fetchAlbumKeywords(albumKey) {
    if (!albumKey) return [];
    try {
      const metaJson = await fetchJsonSafe(`${API_BASE}/smug/album-meta/${encodeURIComponent(albumKey)}`, { retries: 1 }).catch(
        () => null
      );
      if (!metaJson) return [];
      const album = metaJson && metaJson.Response && metaJson.Response.Album;
      if (!album) return [];

      let ak = [];
      if (Array.isArray(album.KeywordArray) && album.KeywordArray.length) {
        ak = album.KeywordArray
          .map((k) => {
            if (!k) return '';
            if (typeof k === 'string') return k;
            if (typeof k === 'object' && typeof k.Name === 'string') return k.Name;
            if (typeof k === 'object' && typeof k.value === 'string') return k.value;
            return '';
          })
          .filter(Boolean);
      } else if (typeof album.Keywords === 'string' && album.Keywords.trim()) {
        ak = album.Keywords.split(/[,;]+/).map((k) => k.trim()).filter(Boolean);
      }

      const norm = ak.map((k) => String(k || '').trim()).filter(Boolean);
      const seen = new Set();
      const out = [];
      for (const k of norm) {
        const key = k.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(k);
      }
      return out;
    } catch (err) {
      console.warn('[people] fetchAlbumKeywords failed', albumKey, err);
      return [];
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

  function renderPeopleList(indexMap) {
    const listEl = panelRoot && panelRoot.querySelector('#peopleList');
    const metaEl = panelRoot && panelRoot.querySelector('#peopleMeta');
    if (!listEl) return;

    const entries = Array.from(indexMap.entries()).map(([name, set]) => ({ name, albums: set.size }));
    entries.sort((a, b) => a.name.localeCompare(b.name));

    if (metaEl) metaEl.textContent = `${entries.length} people indexed`;

    if (!entries.length) {
      listEl.innerHTML = `<div style="opacity:.7; font-size:12px; line-height:1.4;">No people found yet. (This uses album keywords for now.)</div>`;
      return;
    }

    listEl.innerHTML = entries
      .map(
        (p) => `
        <div class="peopleCard" style="padding:10px 12px; border-radius:10px; background:rgba(0,0,0,0.18); box-shadow:0 0 0 1px rgba(255,70,110,0.25) inset; margin:8px 0;">
          <div style="font-weight:800; font-size:13px; letter-spacing:.02em;">${_eh(p.name)}</div>
          <div style="opacity:.75; font-size:11px; letter-spacing:.10em; text-transform:uppercase; margin-top:3px;">Albums: ${p.albums}</div>
        </div>
      `
      )
      .join('');
  }

  async function buildPeopleIndex(onProgress) {
    const folders = await loadBandFoldersFromCsv();
    // If CSV is empty, still try region bases (fail-soft)
    const folderList = folders && folders.length
      ? folders
      : Object.keys(REGION_FOLDER_BASE).map((r) => ({ folder: REGION_FOLDER_BASE[r], region: r }));

    const albumKeyToKeywords = new Map();
    const people = new Map();

    let folderDone = 0;
    let albumDone = 0;

    for (const f of folderList) {
      folderDone += 1;
      const folderPath = String(f.folder || '').trim();
      if (!folderPath) continue;
      const region = String(f.region || '').trim();

      const albums = await limitNet(() => fetchFolderAlbums(folderPath, region).catch(() => []));
      const arr = (albums || []).filter(Boolean);
      if (typeof onProgress === 'function') {
        onProgress({ phase: 'folders', folderDone, folderTotal: folderList.length, albumDone });
      }

      for (const a of arr) {
        const albumKey = (a && (a.AlbumKey || a.Key || a.albumKey)) ? String(a.AlbumKey || a.Key || a.albumKey).trim() : '';
        if (!albumKey) continue;

        if (!albumKeyToKeywords.has(albumKey)) {
          const kws = await limitNet(() => fetchAlbumKeywords(albumKey).catch(() => []));
          albumKeyToKeywords.set(albumKey, kws || []);
        }

        albumDone += 1;
        const kws = albumKeyToKeywords.get(albumKey) || [];
        for (const raw of kws) {
          const name = String(raw || '').trim();
          if (!name) continue;
          if (!people.has(name)) people.set(name, new Set());
          people.get(name).add(albumKey);
        }

        if (typeof onProgress === 'function' && (albumDone % 10 === 0)) {
          onProgress({ phase: 'albums', folderDone, folderTotal: folderList.length, albumDone });
        }
      }
    }

    if (typeof onProgress === 'function') {
      onProgress({ phase: 'done', folderDone, folderTotal: folderList.length, albumDone });
    }

    return people;
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
          <div id="peopleStatus" style="opacity:.75; font-size:11px; letter-spacing:.10em; text-transform:uppercase; white-space:nowrap;"></div>
        </div>

        <div id="peopleList"></div>
      </div>
    `;
  }

  function onMount(panelEl) {
    panelRoot = panelEl || document.getElementById('musicContentPanel') || document.body;
    const statusEl = panelRoot && panelRoot.querySelector('#peopleStatus');

    const token = ++_lastRenderToken;

    // If we already built it, just render.
    if (_peopleIndex) {
      if (token !== _lastRenderToken) return;
      if (statusEl) statusEl.textContent = '';
      renderPeopleList(_peopleIndex);
      return;
    }

    if (!_buildPromise) {
      if (statusEl) statusEl.textContent = 'Building…';
      _buildPromise = buildPeopleIndex((p) => {
        if (token !== _lastRenderToken) return;
        if (!statusEl) return;
        if (!p) return;
        if (p.phase === 'folders') {
          statusEl.textContent = `Scanning folders… ${p.folderDone}/${p.folderTotal}`;
        } else if (p.phase === 'albums') {
          statusEl.textContent = `Indexing albums… ${p.albumDone}`;
        } else if (p.phase === 'done') {
          statusEl.textContent = '';
        }
      })
        .then((idx) => {
          _peopleIndex = idx || new Map();
          return _peopleIndex;
        })
        .catch((err) => {
          console.warn('[people] build failed:', err);
          _peopleIndex = new Map();
          return _peopleIndex;
        })
        .finally(() => {
          _buildPromise = null;
        });
    } else {
      if (statusEl) statusEl.textContent = 'Building…';
    }

    _buildPromise.then((idx) => {
      if (token !== _lastRenderToken) return;
      if (statusEl) statusEl.textContent = '';
      renderPeopleList(idx || new Map());
    });
  }

  function destroy() {
    // Soft reset only. (We keep the built cache in memory for fast return.)
    panelRoot = null;
    _lastRenderToken += 1;
  }

  window.MusicArchivePeople = { render, onMount, destroy };
})();
