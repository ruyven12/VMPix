import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTdi19qTDyPeBGzq0PpkdlDS_bNg34XpdRiXy8aBa-Jlu-jg2Wzkj1SnLXtRVFU4TGOh5KHJPK8Lwhc/pub?gid=2035925093&single=true&output=csv';

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      options[key] = true;
      continue;
    }
    options[key] = value;
    i += 1;
  }
  return options;
}

function parseCsv(text) {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      row.push(current);
      current = '';
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }

  if (!rows.length) return [];
  const headers = rows.shift().map((value) => String(value || '').trim());

  return rows.map((cells) => {
    const entry = {};
    headers.forEach((header, index) => {
      entry[header] = String(cells[index] || '');
    });
    return entry;
  });
}

async function loadCsv(source) {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch roster CSV: ${response.status} ${response.statusText}`);
    }
    return response.text();
  }

  return fs.readFileSync(source, 'utf8');
}

function buildIndexByName(indexData) {
  const lookup = new Map();
  const people = Array.isArray(indexData?.people) ? indexData.people : [];

  for (const person of people) {
    const name = String(person?.name || '').trim();
    if (!name) continue;
    lookup.set(name, {
      photoCount: Number(person?.photoCount || 0),
      albumCount: Array.isArray(person?.albums) ? person.albums.length : 0
    });
  }

  return lookup;
}

async function main() {
  const cwd = process.cwd();
  const options = parseArgs(process.argv.slice(2));

  const csvSource = options.csv
    ? (/^https?:\/\//i.test(options.csv) ? options.csv : path.resolve(cwd, options.csv))
    : DEFAULT_CSV_URL;
  const indexPath = options.index
    ? path.resolve(cwd, options.index)
    : path.resolve(cwd, '_tmp_people_index.json');
  const outputPath = options.output
    ? path.resolve(cwd, options.output)
    : path.resolve(cwd, 'archive-explorer-people-data.js');

  const csvText = await loadCsv(csvSource);
  const roster = parseCsv(csvText);
  const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const indexByName = buildIndexByName(indexData);

  const output = roster.map((row) => {
    const name = String(row.name || '').trim();
    const counts = indexByName.get(name);
    return {
      name,
      category: String(row.category || ''),
      aliases: String(row.aliases || ''),
      bands: String(row.bands || ''),
      instrument: String(row.instrument || ''),
      photoCount: counts ? counts.photoCount : 0,
      albumCount: counts ? counts.albumCount : 0
    };
  });

  fs.writeFileSync(
    outputPath,
    `window.ARCHIVE_MOCKUP_PEOPLE = ${JSON.stringify(output)};`,
    'utf8'
  );

  console.log(`Refreshed ${path.basename(outputPath)} with ${output.length} roster rows.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
