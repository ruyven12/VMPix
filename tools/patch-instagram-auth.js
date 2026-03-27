const fs = require("fs");

const target = process.argv[2];
if (!target) {
  throw new Error("usage: node tools/patch-instagram-auth.js <server.js>");
}

let src = fs.readFileSync(target, "utf8");

function insertAfter(anchor, block) {
  const idx = src.indexOf(anchor);
  if (idx < 0) throw new Error(`anchor not found: ${anchor}`);
  const insertAt = idx + anchor.length;
  src = src.slice(0, insertAt) + block + src.slice(insertAt);
}

if (!src.includes("const INSTAGRAM_CONNECTION_FILE = path.join(ANALYTICS_DIR, \"instagram-connection.json\");")) {
  insertAfter(
    "const FACEBOOK_PUBLISH_HISTORY_FILE = path.join(ANALYTICS_DIR, \"facebook-publish-history.ndjson\");\n",
    "const INSTAGRAM_CONNECTION_FILE = path.join(ANALYTICS_DIR, \"instagram-connection.json\");\n"
  );
}

if (!src.includes("const INSTAGRAM_ACCOUNT_NAME_TARGET = String(process.env.INSTAGRAM_ACCOUNT_NAME_TARGET")) {
  insertAfter(
    "const FACEBOOK_PAGE_ID_TARGET = String(process.env.FACEBOOK_PAGE_ID_TARGET || \"766767130020404\").trim();\n",
    "const INSTAGRAM_ACCOUNT_NAME_TARGET = String(process.env.INSTAGRAM_ACCOUNT_NAME_TARGET || \"\").trim();\nconst INSTAGRAM_ACCOUNT_ID_TARGET = String(process.env.INSTAGRAM_ACCOUNT_ID_TARGET || \"\").trim();\n"
  );
}

if (!src.includes("const META_INSTAGRAM_REDIRECT_URI = String(")) {
  insertAfter(
    "const META_REDIRECT_URI = String(\n  process.env.META_REDIRECT_URI || \"https://wrestling-archive.onrender.com/admin/facebook/connect/callback\"\n).trim();\n",
    "const META_INSTAGRAM_REDIRECT_URI = String(\n  process.env.META_INSTAGRAM_REDIRECT_URI || \"https://wrestling-archive.onrender.com/admin/instagram/connect/callback\"\n).trim();\n"
  );
}

if (!src.includes("function _instagramRequestedScopes()")) {
  insertAfter(
    "function _facebookRequestedScopes() {\n  return [\n    \"pages_show_list\",\n    \"pages_manage_posts\",\n    \"pages_read_engagement\",\n    \"business_management\"\n  ];\n}\n",
    `

function _instagramRequestedScopes() {
  return [
    "pages_show_list",
    "pages_read_engagement",
    "instagram_basic",
    "instagram_content_publish"
  ];
}

function _defaultInstagramConnectionRecord() {
  return {
    connected: false,
    page: {
      id: "",
      name: ""
    },
    instagram_account: {
      id: "",
      username: "",
      name: "",
      profile_picture_url: ""
    },
    page_access_token: "",
    user_access_token: "",
    user_token_expires_at: null,
    token_status: "not_connected",
    last_checked_at: null,
    last_publish_at: null,
    last_available_pages: [],
    last_error: "",
    scopes: [],
    granted_scopes: [],
    declined_scopes: [],
    debug_user: null,
    updated_at: null
  };
}

function _toPublicInstagramConnectionState(record) {
  const src = record && typeof record === "object" ? record : _defaultInstagramConnectionRecord();
  const page = src.page && typeof src.page === "object" ? src.page : {};
  const account = src.instagram_account && typeof src.instagram_account === "object" ? src.instagram_account : {};
  return {
    connected: !!src.connected,
    page: {
      id: _safeString(page.id, 120),
      name: _safeString(page.name, 160)
    },
    instagram_account: {
      id: _safeString(account.id, 120),
      username: _safeString(account.username, 160),
      name: _safeString(account.name, 160),
      profile_picture_url: _safeString(account.profile_picture_url, 2000)
    },
    token_status: _safeString(src.token_status, 48) || "not_connected",
    last_checked_at: _safeString(src.last_checked_at, 80) || null,
    last_publish_at: _safeString(src.last_publish_at, 80) || null,
    user_token_expires_at: _safeString(src.user_token_expires_at, 80) || null,
    last_available_pages: Array.isArray(src.last_available_pages) ? src.last_available_pages.map((item) => ({
      id: _safeString(item && item.id, 120),
      name: _safeString(item && item.name, 160),
      instagram_account: item && item.instagram_account && typeof item.instagram_account === "object" ? {
        id: _safeString(item.instagram_account.id, 120),
        username: _safeString(item.instagram_account.username, 160),
        name: _safeString(item.instagram_account.name, 160)
      } : null,
      tasks: Array.isArray(item && item.tasks) ? item.tasks.map((task) => _safeString(task, 80)).filter(Boolean) : []
    })) : [],
    last_error: _safeString(src.last_error, 500) || "",
    scopes: Array.isArray(src.scopes) ? src.scopes.map((scope) => _safeString(scope, 80)).filter(Boolean) : [],
    granted_scopes: Array.isArray(src.granted_scopes) ? src.granted_scopes.map((scope) => _safeString(scope, 80)).filter(Boolean) : [],
    declined_scopes: Array.isArray(src.declined_scopes) ? src.declined_scopes.map((scope) => _safeString(scope, 80)).filter(Boolean) : [],
    debug_user: src.debug_user && typeof src.debug_user === "object" ? {
      id: _safeString(src.debug_user.id, 120),
      name: _safeString(src.debug_user.name, 160)
    } : null,
    updated_at: _safeString(src.updated_at, 80) || null
  };
}

function _readInstagramConnectionRecord() {
  try {
    if (!fs.existsSync(INSTAGRAM_CONNECTION_FILE)) return _defaultInstagramConnectionRecord();
    const raw = fs.readFileSync(INSTAGRAM_CONNECTION_FILE, "utf8");
    if (!raw.trim()) return _defaultInstagramConnectionRecord();
    const parsed = JSON.parse(raw);
    const base = _defaultInstagramConnectionRecord();
    const page = parsed && parsed.page && typeof parsed.page === "object" ? parsed.page : {};
    const account = parsed && parsed.instagram_account && typeof parsed.instagram_account === "object" ? parsed.instagram_account : {};
    return {
      connected: !!parsed.connected,
      page: {
        id: _safeString(page.id, 120),
        name: _safeString(page.name, 160)
      },
      instagram_account: {
        id: _safeString(account.id, 120),
        username: _safeString(account.username, 160),
        name: _safeString(account.name, 160),
        profile_picture_url: _safeString(account.profile_picture_url, 2000)
      },
      page_access_token: _safeString(parsed.page_access_token, 2000),
      user_access_token: _safeString(parsed.user_access_token, 2000),
      user_token_expires_at: _safeString(parsed.user_token_expires_at, 80) || null,
      token_status: _safeString(parsed.token_status, 48) || base.token_status,
      last_checked_at: _safeString(parsed.last_checked_at, 80) || null,
      last_publish_at: _safeString(parsed.last_publish_at, 80) || null,
      last_available_pages: Array.isArray(parsed.last_available_pages) ? parsed.last_available_pages.map((item) => ({
        id: _safeString(item && item.id, 120),
        name: _safeString(item && item.name, 160),
        instagram_account: item && item.instagram_account && typeof item.instagram_account === "object" ? {
          id: _safeString(item.instagram_account.id, 120),
          username: _safeString(item.instagram_account.username, 160),
          name: _safeString(item.instagram_account.name, 160),
          profile_picture_url: _safeString(item.instagram_account.profile_picture_url, 2000)
        } : null,
        tasks: Array.isArray(item && item.tasks) ? item.tasks.map((task) => _safeString(task, 80)).filter(Boolean) : []
      })) : [],
      last_error: _safeString(parsed.last_error, 500) || "",
      scopes: Array.isArray(parsed.scopes) ? parsed.scopes.map((scope) => _safeString(scope, 80)).filter(Boolean) : [],
      granted_scopes: Array.isArray(parsed.granted_scopes) ? parsed.granted_scopes.map((scope) => _safeString(scope, 80)).filter(Boolean) : [],
      declined_scopes: Array.isArray(parsed.declined_scopes) ? parsed.declined_scopes.map((scope) => _safeString(scope, 80)).filter(Boolean) : [],
      debug_user: parsed.debug_user && typeof parsed.debug_user === "object" ? {
        id: _safeString(parsed.debug_user.id, 120),
        name: _safeString(parsed.debug_user.name, 160)
      } : null,
      updated_at: _safeString(parsed.updated_at, 80) || null
    };
  } catch (err) {
    console.error("instagram connection state read failed:", err);
    return _defaultInstagramConnectionRecord();
  }
}

function _writeInstagramConnectionState(nextState) {
  const base = _defaultInstagramConnectionRecord();
  const next = nextState && typeof nextState === "object" ? nextState : {};
  const payload = {
    connected: !!next.connected,
    page: {
      id: _safeString(next.page && next.page.id, 120),
      name: _safeString(next.page && next.page.name, 160)
    },
    instagram_account: {
      id: _safeString(next.instagram_account && next.instagram_account.id, 120),
      username: _safeString(next.instagram_account && next.instagram_account.username, 160),
      name: _safeString(next.instagram_account && next.instagram_account.name, 160),
      profile_picture_url: _safeString(next.instagram_account && next.instagram_account.profile_picture_url, 2000)
    },
    page_access_token: _safeString(next.page_access_token, 2000),
    user_access_token: _safeString(next.user_access_token, 2000),
    user_token_expires_at: _safeString(next.user_token_expires_at, 80) || null,
    token_status: _safeString(next.token_status, 48) || base.token_status,
    last_checked_at: _safeString(next.last_checked_at, 80) || null,
    last_publish_at: _safeString(next.last_publish_at, 80) || null,
    last_available_pages: Array.isArray(next.last_available_pages) ? next.last_available_pages.map((item) => ({
      id: _safeString(item && item.id, 120),
      name: _safeString(item && item.name, 160),
      instagram_account: item && item.instagram_account && typeof item.instagram_account === "object" ? {
        id: _safeString(item.instagram_account.id, 120),
        username: _safeString(item.instagram_account.username, 160),
        name: _safeString(item.instagram_account.name, 160),
        profile_picture_url: _safeString(item.instagram_account.profile_picture_url, 2000)
      } : null,
      tasks: Array.isArray(item && item.tasks) ? item.tasks.map((task) => _safeString(task, 80)).filter(Boolean) : []
    })) : [],
    last_error: _safeString(next.last_error, 500) || "",
    scopes: Array.isArray(next.scopes) ? next.scopes.map((scope) => _safeString(scope, 80)).filter(Boolean) : [],
    granted_scopes: Array.isArray(next.granted_scopes) ? next.granted_scopes.map((scope) => _safeString(scope, 80)).filter(Boolean) : [],
    declined_scopes: Array.isArray(next.declined_scopes) ? next.declined_scopes.map((scope) => _safeString(scope, 80)).filter(Boolean) : [],
    debug_user: next.debug_user && typeof next.debug_user === "object" ? {
      id: _safeString(next.debug_user.id, 120),
      name: _safeString(next.debug_user.name, 160)
    } : null,
    updated_at: new Date().toISOString()
  };
  try {
    _ensureAnalyticsDir();
    fs.writeFileSync(INSTAGRAM_CONNECTION_FILE, JSON.stringify(payload, null, 2), "utf8");
  } catch (err) {
    console.error("instagram connection state write failed:", err);
    throw err;
  }
  return payload;
}

function _instagramConfigSummary() {
  return {
    page_target: FACEBOOK_PAGE_NAME_TARGET,
    page_id_target: FACEBOOK_PAGE_ID_TARGET || null,
    instagram_account_target: INSTAGRAM_ACCOUNT_NAME_TARGET || null,
    instagram_account_id_target: INSTAGRAM_ACCOUNT_ID_TARGET || null,
    app_id_configured: !!META_APP_ID,
    app_secret_configured: !!META_APP_SECRET,
    redirect_uri_configured: !!META_INSTAGRAM_REDIRECT_URI,
    oauth_success_redirect_configured: !!META_OAUTH_SUCCESS_REDIRECT,
    oauth_error_redirect_configured: !!META_OAUTH_ERROR_REDIRECT,
    graph_version: META_GRAPH_VERSION || null,
    connect_ready: !!(META_APP_ID && META_APP_SECRET && META_INSTAGRAM_REDIRECT_URI)
  };
}

function _createInstagramOauthState(payload) {
  return _createFacebookOauthState(payload);
}

function _verifyInstagramOauthState(rawState) {
  return _verifyFacebookOauthState(rawState);
}
`
  );
}

if (!src.includes("async function _fetchFacebookManagedPagesWithInstagram(userAccessToken)")) {
  insertAfter(
    "async function _fetchFacebookManagedPages(userAccessToken) {\n  const url = new URL(`${_facebookGraphBase()}/me/accounts`);\n  url.searchParams.set(\"fields\", \"id,name,access_token,tasks\");\n  url.searchParams.set(\"access_token\", String(userAccessToken || \"\").trim());\n  const data = await _facebookJson(url.toString());\n  return Array.isArray(data && data.data) ? data.data : [];\n}\n",
    `

async function _fetchFacebookManagedPagesWithInstagram(userAccessToken) {
  const url = new URL(`${_facebookGraphBase()}/me/accounts`);
  url.searchParams.set("fields", "id,name,access_token,tasks,instagram_business_account{id,username,name,profile_picture_url}");
  url.searchParams.set("access_token", String(userAccessToken || "").trim());
  const data = await _facebookJson(url.toString());
  return Array.isArray(data && data.data) ? data.data : [];
}

function _instagramPageSummaries(pages) {
  return (Array.isArray(pages) ? pages : []).map((item) => ({
    id: _safeString(item && item.id, 120),
    name: _safeString(item && item.name, 160),
    instagram_account: item && item.instagram_business_account && typeof item.instagram_business_account === "object" ? {
      id: _safeString(item.instagram_business_account.id, 120),
      username: _safeString(item.instagram_business_account.username, 160),
      name: _safeString(item.instagram_business_account.name, 160),
      profile_picture_url: _safeString(item.instagram_business_account.profile_picture_url, 2000)
    } : null,
    tasks: Array.isArray(item && item.tasks) ? item.tasks.map((task) => _safeString(task, 80)).filter(Boolean) : []
  }));
}

function _findTargetInstagramPage(pages) {
  const items = (Array.isArray(pages) ? pages : []).filter((item) => item && item.instagram_business_account && item.instagram_business_account.id);
  if (!items.length) return null;
  const targetPage = _findTargetFacebookPage(items);
  if (targetPage && targetPage.instagram_business_account && targetPage.instagram_business_account.id) return targetPage;
  const accountTargetId = String(INSTAGRAM_ACCOUNT_ID_TARGET || "").trim();
  if (accountTargetId) {
    const byIgId = items.find((item) => _safeString(item && item.instagram_business_account && item.instagram_business_account.id, 120) === accountTargetId);
    if (byIgId) return byIgId;
  }
  const targetName = String(INSTAGRAM_ACCOUNT_NAME_TARGET || "").trim().toLowerCase();
  if (targetName) {
    const norm = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
    const targetNorm = norm(targetName);
    const byName = items.find((item) => {
      const account = item && item.instagram_business_account && typeof item.instagram_business_account === "object" ? item.instagram_business_account : {};
      const username = String(account.username || "").trim().toLowerCase();
      const name = String(account.name || "").trim().toLowerCase();
      return username === targetName || name === targetName || (!!targetNorm && (norm(username) === targetNorm || norm(name) === targetNorm || norm(username).includes(targetNorm) || norm(name).includes(targetNorm)));
    });
    if (byName) return byName;
  }
  return items[0] || null;
}
`
  );
}

if (!src.includes("function _buildInstagramOauthAuthorizeUrl(returnTo)")) {
  insertAfter(
    "function _buildFacebookOauthAuthorizeUrl(returnTo) {\n  const state = _createFacebookOauthState({\n    iat: Date.now(),\n    return_to: _safeString(returnTo, 500) || META_OAUTH_SUCCESS_REDIRECT || \"\",\n    page_target: FACEBOOK_PAGE_NAME_TARGET,\n    scopes: _facebookRequestedScopes()\n  });\n  const url = new URL(_facebookDialogBase());\n  url.searchParams.set(\"client_id\", META_APP_ID);\n  url.searchParams.set(\"redirect_uri\", META_REDIRECT_URI);\n  url.searchParams.set(\"state\", state);\n  url.searchParams.set(\"response_type\", \"code\");\n  url.searchParams.set(\"scope\", _facebookRequestedScopes().join(\",\"));\n  return { url: url.toString(), state };\n}\n",
    `

function _buildInstagramOauthAuthorizeUrl(returnTo) {
  const state = _createInstagramOauthState({
    iat: Date.now(),
    return_to: _safeString(returnTo, 500) || META_OAUTH_SUCCESS_REDIRECT || "",
    page_target: FACEBOOK_PAGE_NAME_TARGET,
    instagram_account_target: INSTAGRAM_ACCOUNT_NAME_TARGET,
    scopes: _instagramRequestedScopes()
  });
  const url = new URL(_facebookDialogBase());
  url.searchParams.set("client_id", META_APP_ID);
  url.searchParams.set("redirect_uri", META_INSTAGRAM_REDIRECT_URI);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", _instagramRequestedScopes().join(","));
  return { url: url.toString(), state };
}
`
  );
}

if (!src.includes("app.get(\"/admin/instagram/status\"")) {
  insertAfter(
    "app.get(\"/admin/facebook/status\", (req, res) => {\n  allowCors(res, req);\n  try {\n    return res.json({\n      ok: true,\n      config: _facebookConfigSummary(),\n      connection: _toPublicFacebookConnectionState(_readFacebookConnectionRecord())\n    });\n  } catch (err) {\n    console.error(\"/admin/facebook/status failed:\", err);\n    return res.status(500).json({ ok: false, error: \"facebook status failed\" });\n  }\n});\n",
    `

app.get("/admin/instagram/status", (req, res) => {
  allowCors(res, req);
  try {
    return res.json({
      ok: true,
      config: _instagramConfigSummary(),
      connection: _toPublicInstagramConnectionState(_readInstagramConnectionRecord())
    });
  } catch (err) {
    console.error("/admin/instagram/status failed:", err);
    return res.status(500).json({ ok: false, error: "instagram status failed" });
  }
});
`
  );
}

if (!src.includes("app.post(\"/admin/instagram/connect/start\"")) {
  insertAfter(
    "app.post(\"/admin/facebook/connect/start\", (req, res) => {\n  allowCors(res, req);\n  if (!_requireAdmin(req, res)) return;\n  try {\n    if (!META_APP_ID || !META_APP_SECRET || !META_REDIRECT_URI) {\n      return res.status(400).json({\n        ok: false,\n        error: \"facebook config incomplete\",\n        config: _facebookConfigSummary()\n      });\n    }\n    const returnTo = _safeString(req.body && req.body.return_to, 500) || META_OAUTH_SUCCESS_REDIRECT || \"\";\n    const auth = _buildFacebookOauthAuthorizeUrl(returnTo);\n    return res.json({\n      ok: true,\n      authorize_url: auth.url,\n      page_target: FACEBOOK_PAGE_NAME_TARGET,\n      scopes: _facebookRequestedScopes()\n    });\n  } catch (err) {\n    console.error(\"/admin/facebook/connect/start failed:\", err);\n    return res.status(500).json({ ok: false, error: \"facebook connect start failed\" });\n  }\n});\n",
    `

app.post("/admin/instagram/connect/start", (req, res) => {
  allowCors(res, req);
  if (!_requireAdmin(req, res)) return;
  try {
    if (!META_APP_ID || !META_APP_SECRET || !META_INSTAGRAM_REDIRECT_URI) {
      return res.status(400).json({
        ok: false,
        error: "instagram config incomplete",
        config: _instagramConfigSummary()
      });
    }
    const returnTo = _safeString(req.body && req.body.return_to, 500) || META_OAUTH_SUCCESS_REDIRECT || "";
    const auth = _buildInstagramOauthAuthorizeUrl(returnTo);
    return res.json({
      ok: true,
      authorize_url: auth.url,
      page_target: FACEBOOK_PAGE_NAME_TARGET,
      instagram_account_target: INSTAGRAM_ACCOUNT_NAME_TARGET || null,
      scopes: _instagramRequestedScopes()
    });
  } catch (err) {
    console.error("/admin/instagram/connect/start failed:", err);
    return res.status(500).json({ ok: false, error: "instagram connect start failed" });
  }
});
`
  );
}

if (!src.includes("app.get(\"/admin/instagram/connect/callback\"")) {
  insertAfter(
    "app.get(\"/admin/facebook/connect/callback\", async (req, res) => {",
    `
app.get("/admin/instagram/connect/callback", async (req, res) => {
  allowCors(res, req);
  const fail = (errorMessage, payload, extraParams) => {
    const message = _safeString(errorMessage, 240) || "instagram connect failed";
    const statePayload = payload && typeof payload === "object" ? payload : null;
    const returnTo = _safeString(
      (statePayload && statePayload.return_to) || META_OAUTH_ERROR_REDIRECT || META_OAUTH_SUCCESS_REDIRECT || "",
      500
    );
    const extras = extraParams && typeof extraParams === "object" ? extraParams : {};
    if (returnTo) return res.redirect(_appendQueryParams(returnTo, Object.assign({ instagram: "error", message }, extras)));
    return res.status(400).json(Object.assign({ ok: false, error: message }, extras));
  };

  try {
    const statePayload = _verifyInstagramOauthState(req.query && req.query.state);
    if (!statePayload) return fail("invalid instagram oauth state");
    if (req.query && req.query.error) {
      const msg = _safeString((req.query.error_description || req.query.error_message || req.query.error), 240) || "instagram authorization denied";
      return fail(msg, statePayload);
    }

    const code = _safeString(req.query && req.query.code, 1200);
    if (!code) return fail("missing instagram authorization code", statePayload);

    const shortToken = await _exchangeFacebookCodeForUserToken(code);
    let userAccessToken = _safeString(shortToken && shortToken.access_token, 2000);
    let expiresAt = null;
    if (!userAccessToken) return fail("instagram user token missing", statePayload);

    try {
      const longToken = await _exchangeForLongLivedUserToken(userAccessToken);
      if (longToken && longToken.access_token) {
        userAccessToken = _safeString(longToken.access_token, 2000) || userAccessToken;
        if (Number.isFinite(Number(longToken.expires_in))) {
          expiresAt = new Date(Date.now() + (Number(longToken.expires_in) * 1000)).toISOString();
        }
      } else if (Number.isFinite(Number(shortToken && shortToken.expires_in))) {
        expiresAt = new Date(Date.now() + (Number(shortToken.expires_in) * 1000)).toISOString();
      }
    } catch (tokenErr) {
      console.warn("instagram long-lived token exchange skipped:", tokenErr && tokenErr.message ? tokenErr.message : tokenErr);
      if (Number.isFinite(Number(shortToken && shortToken.expires_in))) {
        expiresAt = new Date(Date.now() + (Number(shortToken.expires_in) * 1000)).toISOString();
      }
    }

    const pages = await _fetchFacebookManagedPagesWithInstagram(userAccessToken);
    let grantedScopeInfo = { granted: [], declined: [] };
    let debugUser = null;
    try {
      grantedScopeInfo = await _fetchFacebookGrantedScopes(userAccessToken);
    } catch (scopeErr) {
      console.warn("instagram permissions lookup failed:", scopeErr && scopeErr.message ? scopeErr.message : scopeErr);
    }
    try {
      debugUser = await _fetchFacebookUserProfile(userAccessToken);
    } catch (userErr) {
      console.warn("instagram user profile lookup failed:", userErr && userErr.message ? userErr.message : userErr);
    }

    const page = _findTargetInstagramPage(pages);
    if (!page || !page.id || !page.access_token || !(page.instagram_business_account && page.instagram_business_account.id)) {
      const availablePages = _instagramPageSummaries(pages);
      try {
        const previous = _readInstagramConnectionRecord();
        _writeInstagramConnectionState(Object.assign({}, previous, {
          connected: false,
          page: { id: "", name: "" },
          instagram_account: { id: "", username: "", name: "", profile_picture_url: "" },
          page_access_token: "",
          user_access_token: userAccessToken,
          user_token_expires_at: expiresAt,
          token_status: "not_connected",
          last_checked_at: new Date().toISOString(),
          last_available_pages: availablePages,
          last_error: `unable to find a linked Instagram professional account for target page "${FACEBOOK_PAGE_NAME_TARGET}"`,
          scopes: Array.isArray(statePayload.scopes) ? statePayload.scopes : _instagramRequestedScopes(),
          granted_scopes: grantedScopeInfo.granted,
          declined_scopes: grantedScopeInfo.declined,
          debug_user: debugUser
        }));
      } catch (_) {}
      const availableNames = availablePages
        .filter((item) => item && item.instagram_account && item.instagram_account.username)
        .map((item) => `${item.name} -> @${item.instagram_account.username}`);
      return fail(
        `unable to find a linked Instagram professional account for target page "${FACEBOOK_PAGE_NAME_TARGET}"${availableNames.length ? ` (available: ${availableNames.join(", ")})` : ""}`,
        statePayload
      );
    }

    const account = page.instagram_business_account && typeof page.instagram_business_account === "object" ? page.instagram_business_account : {};
    _writeInstagramConnectionState({
      connected: true,
      page: {
        id: _safeString(page.id, 120),
        name: _safeString(page.name, 160)
      },
      instagram_account: {
        id: _safeString(account.id, 120),
        username: _safeString(account.username, 160),
        name: _safeString(account.name, 160),
        profile_picture_url: _safeString(account.profile_picture_url, 2000)
      },
      page_access_token: _safeString(page.access_token, 2000),
      user_access_token: userAccessToken,
      user_token_expires_at: expiresAt,
      token_status: "valid",
      last_checked_at: new Date().toISOString(),
      last_publish_at: null,
      last_available_pages: _instagramPageSummaries(pages),
      last_error: "",
      scopes: Array.isArray(statePayload.scopes) ? statePayload.scopes : _instagramRequestedScopes(),
      granted_scopes: grantedScopeInfo.granted,
      declined_scopes: grantedScopeInfo.declined,
      debug_user: debugUser
    });

    const returnTo = _safeString(statePayload.return_to, 500) || META_OAUTH_SUCCESS_REDIRECT || "";
    if (returnTo) {
      return res.redirect(_appendQueryParams(returnTo, {
        instagram: "connected",
        page_id: _safeString(page.id, 120),
        page_name: _safeString(page.name, 160),
        instagram_id: _safeString(account.id, 120),
        instagram_username: _safeString(account.username, 160)
      }));
    }

    return res.json({
      ok: true,
      connected: true,
      page: {
        id: _safeString(page.id, 120),
        name: _safeString(page.name, 160)
      },
      instagram_account: {
        id: _safeString(account.id, 120),
        username: _safeString(account.username, 160),
        name: _safeString(account.name, 160)
      }
    });
  } catch (err) {
    console.error("/admin/instagram/connect/callback failed:", err);
    return fail(err && err.message ? err.message : "instagram callback failed");
  }
});

`
  );
}

if (!src.includes("app.post(\"/admin/instagram/disconnect\"")) {
  insertAfter(
    "app.post(\"/admin/facebook/disconnect\", (req, res) => {\n  allowCors(res, req);\n  if (!_requireAdmin(req, res)) return;\n  try {\n    const cleared = _writeFacebookConnectionState(_defaultFacebookConnectionRecord());\n    return res.json({\n      ok: true,\n      connection: _toPublicFacebookConnectionState(cleared)\n    });\n  } catch (err) {\n    console.error(\"/admin/facebook/disconnect failed:\", err);\n    return res.status(500).json({ ok: false, error: \"facebook disconnect failed\" });\n  }\n});\n",
    `

app.post("/admin/instagram/disconnect", (req, res) => {
  allowCors(res, req);
  if (!_requireAdmin(req, res)) return;
  try {
    const cleared = _writeInstagramConnectionState(_defaultInstagramConnectionRecord());
    return res.json({
      ok: true,
      connection: _toPublicInstagramConnectionState(cleared)
    });
  } catch (err) {
    console.error("/admin/instagram/disconnect failed:", err);
    return res.status(500).json({ ok: false, error: "instagram disconnect failed" });
  }
});
`
  );
}

fs.writeFileSync(target, src, "utf8");

