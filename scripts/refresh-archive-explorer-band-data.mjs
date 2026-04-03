import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      options[key] = true;
      continue;
    }
    options[key] = value;
    index += 1;
  }
  return options;
}

function parseCsv(text) {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
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
      if (char === '\r' && next === '\n') index += 1;
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
    headers.forEach((header, columnIndex) => {
      entry[header] = String(cells[columnIndex] || '');
    });
    return entry;
  });
}

function normalizeBandRow(row) {
  return {
    name: String(row.band || '').trim(),
    smugFolder: String(row.smug_folder || '').trim(),
    region: String(row.region || '').trim(),
    logoUrl: String(row.logo_url || '').trim(),
    location: String(row.location || '').trim(),
    state: String(row.state || '').trim(),
    country: String(row.country || '').trim(),
    vox1: String(row.vox_1 || '').trim(),
    vox2: String(row.vox_2 || '').trim(),
    vox3: String(row.vox_3 || '').trim(),
    guitar1: String(row.guitar_1 || '').trim(),
    guitar2: String(row.guitar_2 || '').trim(),
    guitar3: String(row.guitar_3 || '').trim(),
    bass: String(row.bass || '').trim(),
    drum: String(row.drum || '').trim(),
    keys: String(row.keys || '').trim(),
    past1: String(row.past_1 || '').trim(),
    past2: String(row.past_2 || '').trim(),
    past3: String(row.past_3 || '').trim(),
    past4: String(row.past_4 || '').trim(),
    past5: String(row.past_5 || '').trim(),
    past6: String(row.past_6 || '').trim(),
    totalSets: String(row.total_sets || '').trim(),
    archivedSets: String(row.sets_archive || '').trim(),
    status: String(row.status || '').trim()
  };
}

async function main() {
  const cwd = process.cwd();
  const options = parseArgs(process.argv.slice(2));
  const csvPath = options.csv
    ? path.resolve(cwd, options.csv)
    : path.resolve(cwd, '_tmp_bands.csv');
  const outputPath = options.output
    ? path.resolve(cwd, options.output)
    : path.resolve(cwd, 'archive-explorer-band-data.js');

  const csvText = fs.readFileSync(csvPath, 'utf8');
  const bands = parseCsv(csvText)
    .map(normalizeBandRow)
    .filter((entry) => entry.name);

  fs.writeFileSync(
    outputPath,
    `window.ARCHIVE_MOCKUP_BANDS = ${JSON.stringify(bands)};`,
    'utf8'
  );

  console.log(`Refreshed ${path.basename(outputPath)} with ${bands.length} bands.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
