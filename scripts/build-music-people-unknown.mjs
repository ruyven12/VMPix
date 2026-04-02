import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const inputPath = process.argv[2]
  ? path.resolve(cwd, process.argv[2])
  : path.resolve(cwd, '_people_index_live.json');
const outputPath = process.argv[3]
  ? path.resolve(cwd, process.argv[3])
  : path.resolve(cwd, '_tmp_people_index.json');

const raw = fs.readFileSync(inputPath, 'utf8');
const data = JSON.parse(raw);

const explicitUnknown = data && typeof data.unknown === 'object' ? data.unknown : null;
let unknown = explicitUnknown;

if (!unknown || (!Number(unknown.photoCount) && !(Array.isArray(unknown.albums) && unknown.albums.length))) {
  const albumState = data && typeof data._albumStateByKey === 'object' ? data._albumStateByKey : {};
  const albums = [];
  let photoCount = 0;

  for (const [albumKey, value] of Object.entries(albumState)) {
    const entry = value && typeof value === 'object' ? value : {};
    const stats = entry.stats && typeof entry.stats === 'object' ? entry.stats : {};
    const untagged = Number(stats.shotsUntagged);
    if (!Number.isFinite(untagged) || untagged <= 0) continue;
    photoCount += untagged;
    albums.push({
      albumKey,
      title: String(entry.title || ''),
      url: String(entry.url || ''),
      photoCount: untagged,
      lastUpdated: String(entry.lastUpdated || '')
    });
  }

  unknown = { photoCount, albums, images: [] };
}

data.unknown = {
  photoCount: Number.isFinite(Number(unknown?.photoCount)) ? Number(unknown.photoCount) : 0,
  albums: Array.isArray(unknown?.albums) ? unknown.albums : [],
  images: Array.isArray(unknown?.images) ? unknown.images : []
};

fs.writeFileSync(outputPath, JSON.stringify(data));
console.log(`Wrote ${outputPath}`);
