# VMPix Reset Workflow

This is the quick reset and rebuild reference for the Music and Wrestling sides of this workspace.

## Workspace

Run commands from:

`C:\Users\deysx\Documents\GitHub\VMPix`

```powershell
cd C:\Users\deysx\Documents\GitHub\VMPix
```

## Wrestling

The Wrestling frontend in this repo reads from the deployed backend at:

`https://wrestling-archive.onrender.com`

### Main rebuild step

Rebuild the live Wrestling people index:

```powershell
Invoke-WebRequest "https://wrestling-archive.onrender.com/admin/people-index/rebuild?force=1"
```

### Local follow-up step

Refresh the local people data file used in this repo:

```powershell
node .\scripts\refresh-archive-explorer-people-data.mjs
```

### Wrestling note

If Wrestling still looks stale after the backend rebuild, the stale part is likely on the backend side or in the source temp JSON being used locally.

## Music

### 1. Rebuild the music unknown people bucket

This reads `_people_index_live.json` and writes `_tmp_people_index.json`.

```powershell
node .\scripts\build-music-people-unknown.mjs
```

### 2. Refresh music band data

This reads `_tmp_bands.csv` and writes `archive-explorer-band-data.js`.

```powershell
node .\scripts\refresh-archive-explorer-band-data.mjs
```

### 3. Refresh people data

This reads `_tmp_people_index.json` and writes `archive-explorer-people-data.js`.

```powershell
node .\scripts\refresh-archive-explorer-people-data.mjs
```

### 4. Regenerate music band routes

This regenerates band and band/date route pages.

```powershell
node .\scripts\generate-music-band-routes.mjs
```

## Full Reset Order

Use this when you want the broadest reset pass available from this repo:

```powershell
cd C:\Users\deysx\Documents\GitHub\VMPix
Invoke-WebRequest "https://wrestling-archive.onrender.com/admin/people-index/rebuild?force=1"
node .\scripts\build-music-people-unknown.mjs
node .\scripts\refresh-archive-explorer-band-data.mjs
node .\scripts\refresh-archive-explorer-people-data.mjs
node .\scripts\generate-music-band-routes.mjs
```

## What These Commands Do Not Cover

This repo does not currently contain a checked-in command here for downloading fresh copies of:

- `_tmp_bands.csv`
- `_people_index_live.json`
- `_tmp_people_index.json`

If the site still does not reflect updates after running the reset flow, check:

1. Whether the temp/source files were refreshed first.
2. Whether the backend still has stale data.
3. Whether the frontend deploy or browser cache is still serving older files.

## Recommended Troubleshooting Order

1. Run the full reset order.
2. Hard refresh the browser.
3. Check whether the local source temp files changed.
4. Check whether the deployed backend data changed.
5. If needed, confirm whether a deploy step is still missing outside this repo.
