# Analytics Migration

This note freezes the current analytics setup before the site-wide migration begins.

## Step 1 Status

Current status: legacy analytics identified and ready to replace in phases.

Primary goals:
- retire the old music-backed analytics loader
- replace per-file legacy event helpers with one shared site-wide client
- move reporting into the protected Admin route instead of relying on any old separate analytics UI

## Current Legacy Analytics Touchpoints

### Legacy loader

The current analytics loader is pulled from the music backend:

- `index.html`
  - loads `https://music-archive-3lfa.onrender.com/analytics.js?v=1`
- `music/index.html`
  - also loads `https://music-archive-3lfa.onrender.com/analytics.js?v=1`

Important note:
- the generated `music/.../index.html` route files are copies of the site shell, so they inherit the same loader automatically

### Legacy event wrappers

Music currently owns analytics event calls through local helper functions that expect `window.trackEvent(...)` to exist:

- `music-archive-bands.js`
  - defines `safetrack(...)`
  - sends `band_click`
  - sends `album_open`
  - sends `photo_open`
- `music-archive-shows.js`
  - defines `safeTrack(...)`
  - sends `band_click`
  - sends `show_open`

Current wrapper assumptions:
- both helpers infer route from `location.hash` or `location.pathname`
- both helpers merge in local context like `view` and `source`
- both helpers silently no-op if `window.trackEvent` is missing

### Music backend coupling

The repo is currently coupled to the music backend in several places:

- `music-archive-bands.js`
  - default API base points to `https://music-archive-3lfa.onrender.com`
- `music-archive-shows.js`
  - default API base points to `https://music-archive-3lfa.onrender.com`
- `music-archive-people.js`
  - default API base points to `https://music-archive-3lfa.onrender.com`
- `hud-app.js`
  - backend warmup / keepalive includes music backend URLs
- `scripts/generate-music-band-routes.mjs`
  - route generation defaults to the music backend

Important distinction:
- not all music backend usage is analytics usage
- for this migration, only the analytics loader and event plumbing are legacy analytics targets

## Current Route / Admin Reality

There is no live standalone Analytics route in this repo right now.

Current top-level routes in `hud-app.js`:
- `home`
- `music`
- `wrestling`
- `calendar`
- `about`
- `pricing`
- `contact`
- `admin`

The protected Admin route is the intended home for future analytics reporting.

## What Gets Replaced

These are legacy analytics targets that should be removed or rewritten during migration:

1. External legacy loader from the music backend
2. Music-specific `safetrack(...)` / `safeTrack(...)` wrappers
3. Direct reliance on `window.trackEvent(...)` as the site-wide contract
4. Old music event names as the long-term reporting schema

## What Stays

These are not Step 1 removal targets:

- music content/data API usage
- wrestling backend auth and admin access flow
- route generation for static music pages
- existing Admin shell structure

## Replacement Direction

The migration target is:

1. one shared VMPix analytics client loaded by the site shell
2. centralized route/pageview tracking in the shell/router
3. normalized event names across Music, Wrestling, site pages, and Admin
4. Admin-based analytics reporting fed by the new backend endpoints

## Proposed File Touch Order

When implementation starts, use this order:

1. `index.html`
   - swap legacy analytics loader for the new shared client
2. `hud-app.js`
   - add central route tracking and Admin analytics entry points
3. `music-archive-bands.js`
   - migrate legacy music events to the shared client
4. `music-archive-shows.js`
   - migrate legacy music events to the shared client
5. `wrestling-archive.js`
   - add route-aware analytics integration where needed
6. `wrestling-archive-shows.js`
   - add Wrestling show/detail events
7. `wrestling-archive-people.js`
   - add Wrestling people events
8. `home.js`, `contact.js`, `pricing.js`, `calendar.js`
   - add lightweight interaction coverage
9. `music/index.html` and generated `music/.../index.html`
   - remove remaining legacy loader dependence once the new client is live everywhere

## Legacy Event Mapping

These legacy event names should be migrated to the new schema:

- `band_click` -> `music_band_open`
- `show_open` -> `music_show_open`
- `album_open` -> `music_album_open`
- `photo_open` -> `music_photo_open`

## Step 1 Done Means

Step 1 is considered complete when:
- the legacy loader and helper touchpoints are documented
- the repo has a fixed replacement target list
- the future Admin destination is confirmed
- the frontend edit order is defined

