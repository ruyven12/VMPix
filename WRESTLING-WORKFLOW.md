# Wrestling Workflow

This workspace is an active source of truth for the VMPix Wrestling frontend.

## What Lives Here
- `hud-app.js` controls route-level app shell behavior, admin access, and the protected Wrestling rebuild UI.
- `wrestling-archive.js` controls the Wrestling shell and subroute handling.
- `wrestling-archive-shows.js` controls Wrestling shows loading, detail views, and related search/shop behavior.
- `wrestling-archive-people.js` controls Wrestling people indexing and performer views.
- `index.html` loads the site shell and route entrypoints.

## Current Architecture
- This repo is a static frontend site.
- The Wrestling frontend talks to the deployed backend at `https://wrestling-archive.onrender.com`.
- Because the backend repo is not currently in this workspace, some fixes can only be completed here up to the frontend boundary.

## Default Working Rule
- When a new request is about archive fixes and the user does not name a section, assume the request applies to Wrestling first.

## Preferred Change Order
1. Fix broken user-facing behavior.
2. Confirm which backend endpoint or payload the UI depends on.
3. Improve the rebuild or validation path if manual steps are causing repeat work.
4. Keep changes consistent with the existing VMPix route shell and design language.

## Known Wrestling Endpoints Used Here
- `/sheet/shows`
- `/admin/auth`
- `/admin/verify`
- `/admin/people-index/rebuild`
- SmugMug helper endpoints exposed by the Wrestling backend

## Admin / Rebuild Notes
- The admin interface in `hud-app.js` already includes a protected Wrestling people-index rebuild trigger.
- If Wrestling people data appears stale, the rebuild path should be treated as the first operational check before larger UI rewrites.

## When Backend Work Is Still Needed
- If a frontend bug is caused by missing or malformed backend data, complete the frontend-safe portion here and clearly note the exact backend follow-up needed.
- Avoid pushing manual edit instructions to the user when the issue can be solved in this repo.

## Long-Term Goal
- Bring the Wrestling backend code and deploy configuration into this workspace so future threads can handle frontend, backend, rebuild flow, and deploy setup end-to-end.
