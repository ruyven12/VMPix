import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const INDEX_HTML = path.join(ROOT, 'index.html');
const API_BASE = process.env.MUSIC_ARCHIVE_API_BASE || 'https://music-archive-3lfa.onrender.com';

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
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

function cleanFolderPath(value) {
  return String(value || '').replace(/[:]/g, '').trim();
}

function toSlug(value) {
  return String(value || '')
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s-]+/gi, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function toMMDDYY(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [yyyy, mm, dd] = s.split('-');
    return `${mm}${dd}${yyyy.slice(2)}`;
  }
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return '';
  const mm = m[1].padStart(2, '0');
  const dd = m[2].padStart(2, '0');
  const yy = (m[3].length === 4 ? m[3].slice(2) : m[3]).padStart(2, '0');
  return `${mm}${dd}${yy}`;
}

function parseAlbumNameToShowBits(name) {
  const raw = String(name || '').trim();
  const m = raw.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[-–—]\s*(.+)$/);
  if (m) {
    const dateStr = m[1].trim();
    const showName = m[2].trim();
    return { show_date: dateStr, show_name: showName, mmddyy: toMMDDYY(dateStr) };
  }
  return { show_date: '', show_name: raw, mmddyy: '' };
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function ensureRouteFile(relativeDir) {
  const dir = path.join(ROOT, relativeDir);
  await mkdir(dir, { recursive: true });
  await copyFile(INDEX_HTML, path.join(dir, 'index.html'));
}

async function loadBands() {
  const text = await fetchText(`${API_BASE}/sheet/bands`);
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const header = parseCsvLine(lines.shift() || '').map((value) => value.trim().toLowerCase());
  const idxBand = header.indexOf('band');
  const idxSmug = header.indexOf('smug_folder');
  const idxRegion = header.indexOf('region');
  const rows = [];
  for (const line of lines) {
    const cols = parseCsvLine(line);
    rows.push({
      band: String(cols[idxBand] || '').trim(),
      smug_folder: cleanFolderPath(cols[idxSmug] || ''),
      region: String(cols[idxRegion] || 'Local').trim() || 'Local',
    });
  }
  return rows.filter((row) => row.band && row.smug_folder);
}

async function fetchFolderAlbums(folderPath, region) {
  const baseSlug = toSlug(folderPath);
  const url = `${API_BASE}/smug/${encodeURIComponent(baseSlug)}?folder=${encodeURIComponent(folderPath)}&region=${encodeURIComponent(region || '')}&count=200&start=1`;
  const data = await fetchJson(url);
  const albumsRaw = (data && data.Response && (data.Response.Album || data.Response.Albums)) || [];
  if (Array.isArray(albumsRaw)) return albumsRaw;
  return albumsRaw ? [albumsRaw] : [];
}

async function main() {
  const bands = await loadBands();
  const bandRoutes = new Set();
  const albumRoutes = new Set();
  const concurrency = 4;
  let index = 0;

  async function worker() {
    while (index < bands.length) {
      const current = bands[index];
      index += 1;
      const bandSlug = toSlug(current.smug_folder || current.band);
      if (!bandSlug) continue;
      bandRoutes.add(path.join('music', 'bands', bandSlug));

      try {
        const albums = await fetchFolderAlbums(current.smug_folder, current.region);
        for (const album of albums) {
          const dateSlug = parseAlbumNameToShowBits(album?.Name || album?.Title || '').mmddyy;
          if (!dateSlug) continue;
          albumRoutes.add(path.join('music', 'bands', bandSlug, dateSlug));
        }
      } catch (error) {
        console.warn(`Skipping albums for ${current.band}: ${error.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  for (const route of bandRoutes) {
    await ensureRouteFile(route);
  }
  for (const route of albumRoutes) {
    await ensureRouteFile(route);
  }

  console.log(`Generated ${bandRoutes.size} band routes and ${albumRoutes.size} band/date routes.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
