# Facebook Admin Contract

This is the shared Facebook Page posting contract for VMPix.

## Scope

- One shared Facebook posting system for Music and Wrestling
- First content type: shows only
- First post type: image + caption + link
- Admin UI lives in the VMPix frontend shell
- OAuth, token storage, and posting live on the backend

## First Backend Anchor

The Wrestling backend is the first implementation anchor because it already has:

- `POST /admin/auth`
- `GET /admin/verify`
- protected admin tooling patterns

Music should mirror the same Facebook contract after the Wrestling-side flow is proven.

## Phase 1 Env Vars

These should be configured on the backend:

- `META_APP_ID`
- `META_APP_SECRET`
- `META_REDIRECT_URI`
- `META_GRAPH_VERSION`
- `FACEBOOK_PAGE_NAME_TARGET`
- `META_OAUTH_STATE_SECRET`
- `META_OAUTH_SUCCESS_REDIRECT`
- `META_OAUTH_ERROR_REDIRECT`

Suggested initial target:

- `FACEBOOK_PAGE_NAME_TARGET=Voodoo Media`

## Phase 1 Persisted State

The backend stores lightweight Facebook connection state server-side. This is not the final publishing implementation, but it gives the Admin shell a stable status contract.

Suggested stored fields:

- `connected`
- `page.id`
- `page.name`
- `token_status`
- `last_checked_at`
- `last_publish_at`
- `scopes`
- `updated_at`

## Phase 1 Endpoint

`GET /admin/facebook/status`

Requires the same admin bearer token pattern as the existing Wrestling admin endpoints.

Example response:

```json
{
  "ok": true,
  "config": {
    "page_target": "Voodoo Media",
    "app_id_configured": true,
    "app_secret_configured": true,
    "redirect_uri_configured": true,
    "graph_version": "v22.0",
    "connect_ready": true
  },
  "connection": {
    "connected": false,
    "page": {
      "id": "",
      "name": ""
    },
    "token_status": "not_connected",
    "last_checked_at": null,
    "last_publish_at": null,
    "scopes": [],
    "updated_at": null
  }
}
```

## Current Connect Endpoints

`POST /admin/facebook/connect/start`

Requires admin auth and returns a Meta authorize URL.

Example response:

```json
{
  "ok": true,
  "authorize_url": "https://www.facebook.com/dialog/oauth?...",
  "page_target": "Voodoo Media",
  "scopes": [
    "pages_show_list",
    "pages_manage_posts",
    "pages_read_engagement"
  ]
}
```

`GET /admin/facebook/connect/callback`

- Handles the Meta redirect
- Exchanges the code for a user token
- Attempts long-lived token exchange
- Fetches manageable Pages
- Selects the target Page by name
- Stores the Page access token server-side
- Redirects back to the configured success/error URL when available

`POST /admin/facebook/disconnect`

- Clears the stored Facebook connection record

## Next Endpoints

After Phase 1, the next backend endpoints are:

- `POST /admin/facebook/preview`
- `POST /admin/facebook/publish`
- `GET /admin/facebook/history`

## Current Frontend Composer Modes

The VMPix admin shell now treats `entity_type` as a posting mode selector.

Current mode list:

- `normal_post`
- `single_photo`
- `multiple_photos`
- `throwback`

Only `normal_post` has been mapped in the frontend so far.

## Normal Post Contract

`normal_post` is a caption-first Facebook post.

Frontend behavior:

- preview is built locally in the VMPix admin shell
- no image is shown in preview
- caption is the primary post body
- `link_url` is optional
- `entity_label` can be derived from the first non-empty caption line when no visible title field is shown
- `entity_id` can be derived client-side from caption/title context when no visible ID field is shown

Backend requirement for both endpoints:

- `POST /admin/facebook/preview`
- `POST /admin/facebook/publish`

must allow `normal_post` payloads with:

- `section`
- `entity_type=normal_post`
- `entity_id`
- `entity_label`
- `caption`
- optional `link_url`

and must not require:

- `image_url`

### Publishing Rule

For `normal_post`, the backend should build the outgoing Facebook message as:

1. caption only when `link_url` is empty
2. caption + blank line + `link_url` when `link_url` is present

### Validation Rule

Only image-oriented modes should require or validate `image_url`.

That means `image_url` validation should be applied to:

- `single_photo`
- `multiple_photos`
- `throwback` when it is implemented as an image post

and should be skipped for:

- `normal_post`

### Current Gap

As of March 25, 2026, the frontend `normal_post` composer has been updated locally in this repo, but the Wrestling backend publish endpoint is still returning:

- `image_url must be a valid http(s) URL`

for `normal_post` publish attempts.

The backend counterpart needed is:

- branch on `entity_type`
- bypass `image_url` required validation when `entity_type === "normal_post"`
- publish a text/link post instead of an image post for that mode
