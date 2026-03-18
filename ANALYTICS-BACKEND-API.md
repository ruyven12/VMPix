# Analytics Backend API

This document defines the backend counterpart required for the site-wide analytics system.

Important repo note:
- this workspace is currently a static frontend site
- the deployed admin/backend code used by the Wrestling tools is not present here
- because of that, the endpoints below are specified here but are not implemented in this repo

Use this document as the implementation contract for the backend repo/service that will receive analytics events and power the Admin analytics view.

## Status

Current status:
- frontend analytics collection is wired in this repo
- backend analytics ingest/reporting is still required outside this repo

## Base Direction

The backend should replace any legacy analytics sheet flow and become the single source of truth for:
- raw event ingest
- event validation
- event storage
- summary rollups
- Admin reporting

The Google Sheet should not be used as the primary analytics destination in the new model.

## Required Endpoints

### 1. Collect Single Event

- `POST /analytics/collect`

Purpose:
- accepts one analytics event from the frontend

Request body:

```json
{
  "event_name": "page_view",
  "occurred_at": "2026-03-17T12:34:56.789Z",
  "client_time": "Mon Mar 17 2026 08:34:56 GMT-0400",
  "session_id": "sess_123",
  "visitor_id": "vis_123",
  "pageview_id": "pv_123",
  "route": "/wrestling/shows/081224",
  "pathname": "/wrestling/shows/081224",
  "hash": "",
  "section": "wrestling",
  "subsection": "shows",
  "source": "site_shell",
  "event_version": 1,
  "referrer": "",
  "utm_source": "",
  "utm_medium": "",
  "utm_campaign": "",
  "utm_term": "",
  "utm_content": "",
  "device_type": "desktop",
  "viewport_w": 1440,
  "viewport_h": 900,
  "language": "en-US",
  "timezone": "America/New_York",
  "entity_type": "show",
  "entity_id": "081224",
  "entity_label": "Limitless Wrestling",
  "meta": {}
}
```

Response:

```json
{
  "ok": true,
  "ingested": 1
}
```

### 2. Collect Batch Events

- `POST /analytics/batch`

Purpose:
- accepts multiple events from the frontend buffer

Request body:

```json
{
  "events": [
    {
      "event_name": "page_view",
      "occurred_at": "2026-03-17T12:34:56.789Z",
      "session_id": "sess_123",
      "visitor_id": "vis_123",
      "route": "/music",
      "section": "music",
      "source": "site_shell",
      "event_version": 1
    }
  ]
}
```

Response:

```json
{
  "ok": true,
  "accepted": 1,
  "rejected": 0
}
```

### 3. Admin Overview

- `GET /admin/analytics/overview`

Purpose:
- returns high-level summary metrics for Admin

Suggested query params:
- `range=24h|7d|30d`

Response:

```json
{
  "ok": true,
  "range": "7d",
  "totals": {
    "events": 1234,
    "pageviews": 456,
    "visitors": 78,
    "sessions": 132
  },
  "sections": [
    { "section": "music", "pageviews": 220, "events": 640 },
    { "section": "wrestling", "pageviews": 180, "events": 500 }
  ],
  "lastIngestAt": "2026-03-17T13:12:01.000Z"
}
```

### 4. Admin Routes Report

- `GET /admin/analytics/routes`

Purpose:
- returns top routes for a time window

Suggested query params:
- `range=24h|7d|30d`
- `limit=25`

Response:

```json
{
  "ok": true,
  "items": [
    {
      "route": "/wrestling/shows/081224",
      "section": "wrestling",
      "pageviews": 42,
      "events": 97
    }
  ]
}
```

### 5. Admin Entities Report

- `GET /admin/analytics/entities`

Purpose:
- returns top entities like bands, shows, people, and matches

Suggested query params:
- `range=24h|7d|30d`
- `entity_type=band|show|person|match|album|photo`
- `limit=25`

Response:

```json
{
  "ok": true,
  "items": [
    {
      "entity_type": "person",
      "entity_id": "alec-price",
      "entity_label": "Alec Price",
      "events": 28
    }
  ]
}
```

### 6. Admin Recent Events

- `GET /admin/analytics/events`

Purpose:
- returns recent raw events for debugging

Suggested query params:
- `limit=100`
- `section=music|wrestling|contact|pricing|admin`
- `event_name=...`

Response:

```json
{
  "ok": true,
  "items": [
    {
      "event_name": "wrestling_person_open",
      "occurred_at": "2026-03-17T13:10:00.000Z",
      "route": "/wrestling/people/alec-price",
      "section": "wrestling",
      "subsection": "people",
      "entity_type": "person",
      "entity_id": "alec-price",
      "entity_label": "Alec Price",
      "source": "wrestling_people",
      "meta": {
        "appearance_count": 8
      }
    }
  ]
}
```

### 7. Admin Reset Analytics

- `POST /admin/analytics/reset`

Purpose:
- fully clears the analytics dataset used by the Admin view
- must remove both raw events and any derived rollups, cached reports, or materialized summary data

Required reset scope:
- overview totals:
  - `events`
  - `pageviews`
  - `visitors`
  - `sessions`
- routes report:
  - top routes list
- entities report:
  - top entries / top entities list
- recent events feed:
  - recent raw events list

Response:

```json
{
  "ok": true,
  "beforeCount": 1234,
  "cleared": {
    "events": 1234,
    "pageviews": 456,
    "visitors": 78,
    "sessions": 132,
    "routes": 25,
    "entities": 25,
    "recentEvents": 50
  }
}
```

Post-reset expectations:
- `GET /admin/analytics/overview` returns zero totals
- `GET /admin/analytics/routes` returns an empty `items` array
- `GET /admin/analytics/entities` returns an empty `items` array
- `GET /admin/analytics/events` returns an empty `items` array

## Validation Rules

The backend should:
- require `event_name`
- require `occurred_at`
- require `session_id`
- require `visitor_id`
- require `route`
- require `section`
- require `source`
- require `event_version`

The backend should reject or sanitize:
- oversized `meta`
- unexpected top-level secrets
- auth tokens or passwords
- malformed timestamps

Suggested limits:
- max body size per single-event request: `32 KB`
- max batch size: `100 events`
- max serialized event size: `16 KB`

## Auth Rules

Frontend ingest endpoints:
- should be public
- should be rate-limited
- should not require admin auth

Admin reporting endpoints:
- should require the same admin auth pattern already used by:
  - `/admin/auth`
  - `/admin/verify`
  - `/admin/people-index/rebuild`

## Storage Model

Recommended minimum:

### Raw events table

Columns:
- `id`
- `occurred_at`
- `received_at`
- `event_name`
- `event_version`
- `visitor_id`
- `session_id`
- `pageview_id`
- `route`
- `pathname`
- `hash`
- `section`
- `subsection`
- `source`
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
- `meta_json`

### Daily rollup tables

Suggested rollups:
- by `date + section`
- by `date + route`
- by `date + event_name`
- by `date + entity_type + entity_id`

## Admin UI Data Requirements

The future Admin analytics panel in this repo will need:
- overview totals
- top routes
- top entities
- recent raw events
- latest ingest timestamp

That means the backend should be optimized for:
- fast summary reads
- stable date-range filters
- recent-event inspection

## Frontend Integration Expectation

Once the backend exists, the frontend can point:
- `window.VMPIX_ANALYTICS_ENDPOINT`

to either:
- `POST /analytics/collect`
- or a batch endpoint wrapper depending on the final transport choice

The current frontend already buffers analytics events locally and is ready for this endpoint to be connected.

## Done Means

This backend step is complete when the backend repo/service provides:
- `POST /analytics/collect`
- optionally `POST /analytics/batch`
- `GET /admin/analytics/overview`
- `GET /admin/analytics/routes`
- `GET /admin/analytics/entities`
- `GET /admin/analytics/events`

and the Google Sheet is no longer required for analytics storage.

