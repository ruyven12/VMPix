# Analytics Schema

This document defines the site-wide analytics model that will replace the legacy music-backed analytics setup.

Use this as the source of truth for:
- frontend event payloads
- route classification
- event naming
- backend ingest validation
- Admin reporting

## Step 2 Status

Current status: schema locked for first-pass implementation.

This schema is designed to support:
- shell-level route tracking
- Music interactions
- Wrestling interactions
- site page interactions
- Admin usage reporting

## Design Rules

- every event uses the same base envelope
- pageviews come from the shared shell/router layer
- feature files only send meaningful interaction events
- analytics is anonymous by default
- the schema must tolerate blank optional fields
- the top-level keys stay stable even if `meta` evolves

## Base Event Shape

Every event should follow this shape:

```json
{
  "event_name": "page_view",
  "occurred_at": "2026-03-17T12:34:56.789Z",
  "client_time": "2026-03-17T08:34:56.789-04:00",
  "session_id": "sess_...",
  "visitor_id": "vis_...",
  "pageview_id": "pv_...",
  "route": "/wrestling/shows/2025/example-show",
  "pathname": "/wrestling/shows/2025/example-show",
  "hash": "",
  "section": "wrestling",
  "subsection": "shows",
  "source": "site_shell",
  "event_version": 1,
  "referrer": "https://facebook.com/",
  "utm_source": "",
  "utm_medium": "",
  "utm_campaign": "",
  "utm_term": "",
  "utm_content": "",
  "device_type": "mobile",
  "viewport_w": 390,
  "viewport_h": 844,
  "language": "en-US",
  "timezone": "America/New_York",
  "entity_type": "show",
  "entity_id": "show_abc123",
  "entity_label": "Example Show",
  "meta": {}
}
```

## Required Fields

- `event_name`
- `occurred_at`
- `session_id`
- `visitor_id`
- `route`
- `section`
- `source`
- `event_version`

## Recommended Fields

- `client_time`
- `pageview_id`
- `pathname`
- `hash`
- `subsection`
- `referrer`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_term`
- `utm_content`
- `device_type`
- `viewport_w`
- `viewport_h`
- `language`
- `timezone`
- `entity_type`
- `entity_id`
- `entity_label`
- `meta`

## Field Definitions

### Event identity

- `event_name`
  - normalized event name from the controlled list below
- `event_version`
  - schema version for reporting compatibility
  - first implementation uses `1`

### Time fields

- `occurred_at`
  - ISO timestamp generated in UTC
- `client_time`
  - browser-local timestamp string for debugging and timezone sanity checks

### Visitor/session fields

- `visitor_id`
  - anonymous persistent browser id
  - stored in `localStorage`
- `session_id`
  - anonymous session id
  - stored in `sessionStorage`
- `pageview_id`
  - generated for each route view
  - reused by interaction events until the route changes

### Route fields

- `route`
  - canonical route string used for reporting
- `pathname`
  - `window.location.pathname`
- `hash`
  - `window.location.hash`
- `section`
  - top-level site section
- `subsection`
  - deeper route grouping when applicable
- `source`
  - frontend origin of the event

### Attribution/context fields

- `referrer`
  - `document.referrer`
- `utm_*`
  - captured from the URL when present
- `device_type`
  - coarse classification only
  - `desktop`, `tablet`, or `mobile`
- `viewport_w`
  - current viewport width
- `viewport_h`
  - current viewport height
- `language`
  - browser language
- `timezone`
  - browser timezone if available

### Entity fields

- `entity_type`
  - what object the event refers to
- `entity_id`
  - stable key when available
- `entity_label`
  - human-readable title/name for reporting

### Extension field

- `meta`
  - extra event-specific data
  - should not duplicate top-level fields

## Controlled Section Values

- `home`
- `music`
- `wrestling`
- `calendar`
- `about`
- `pricing`
- `contact`
- `admin`

## Controlled Subsection Values

Use these when applicable:

- `bands`
- `shows`
- `people`
- `project`
- `origins`
- `dashboard`
- `tools`

Additional subsection values can be added later if they stay route-based and consistent.

## Controlled Source Values

- `site_shell`
- `music_archive`
- `music_bands`
- `music_shows`
- `music_people`
- `wrestling_archive`
- `wrestling_shows`
- `wrestling_people`
- `home_page`
- `calendar_page`
- `about_page`
- `pricing_page`
- `contact_page`
- `admin_panel`

## Controlled Entity Types

- `page`
- `band`
- `album`
- `photo`
- `show`
- `person`
- `match`
- `segment`
- `tool`

## First-Pass Event Families

### Navigation / shell events

- `page_view`
- `route_change`
- `nav_click`

### Music events

- `music_band_open`
- `music_show_open`
- `music_album_open`
- `music_photo_open`
- `music_person_open`
- `music_search`

### Wrestling events

- `wrestling_show_open`
- `wrestling_person_open`
- `wrestling_match_open`
- `wrestling_segment_open`
- `wrestling_search`
- `wrestling_shop_click`

### Site page events

- `contact_view`
- `contact_submit`
- `pricing_view`
- `pricing_cta_click`
- `calendar_view`
- `calendar_event_click`

### Admin events

- `admin_view`
- `admin_auth_success`
- `admin_auth_failure`
- `admin_tool_run`
- `admin_analytics_view`

## First-Pass Implementation Scope

These are the first events to actually wire during the migration:

- `page_view`
- `nav_click`
- `music_band_open`
- `music_show_open`
- `music_album_open`
- `music_photo_open`
- `wrestling_show_open`
- `wrestling_person_open`
- `pricing_cta_click`
- `contact_submit`
- `admin_view`
- `admin_tool_run`

## Legacy Event Mapping

Legacy music events should migrate to these new names:

- `band_click` -> `music_band_open`
- `show_open` -> `music_show_open`
- `album_open` -> `music_album_open`
- `photo_open` -> `music_photo_open`

## Route Classification Rules

The shell should classify routes using these rules:

- `/`
  - `section=home`
- `/music`
  - `section=music`
- `/music/shows/...`
  - `section=music`
  - `subsection=shows`
- `/music/people/...`
  - `section=music`
  - `subsection=people`
- `/music/bands/...`
  - `section=music`
  - `subsection=bands`
- `/wrestling`
  - `section=wrestling`
- `/wrestling/shows/...`
  - `section=wrestling`
  - `subsection=shows`
- `/wrestling/people/...`
  - `section=wrestling`
  - `subsection=people`
- `/calendar`
  - `section=calendar`
- `/about`
  - `section=about`
- `/pricing`
  - `section=pricing`
- `/contact`
  - `section=contact`
- `/admin`
  - `section=admin`
  - `subsection=dashboard`

## Meta Field Rules

Use `meta` only for event-specific details.

Good examples:

```json
{ "index": 4, "total": 19 }
```

```json
{ "tool_name": "people_index_rebuild" }
```

```json
{ "query": "Alec Price" }
```

Do not duplicate:
- `route`
- `section`
- `source`
- `entity_type`
- `entity_id`

## Privacy / Data Boundaries

Do not collect:
- passwords
- auth tokens
- private form message bodies by default
- secret query parameters

Allowed:
- anonymous ids
- route and section data
- coarse device information
- public entity names and ids
- search terms if operationally useful

## Reporting Questions This Schema Supports

This schema is designed to answer:
- which sections/routes are used most
- which bands, shows, and people are opened most
- whether Wrestling usage is growing relative to Music
- which site CTAs are used
- which Admin tools are actually used
- which traffic sources are sending visits

## Step 2 Done Means

Step 2 is considered complete when:
- the event names are finalized
- the base schema is finalized
- route classification rules are finalized
- legacy music event mapping is finalized
- privacy boundaries are finalized
- the first-pass implementation scope is finalized

