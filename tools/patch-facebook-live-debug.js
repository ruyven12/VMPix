const fs = require("fs");

const targetPath = process.argv[2];

if (!targetPath) {
  console.error("Usage: node tools/patch-facebook-live-debug.js <path-to-server.js>");
  process.exit(1);
}

let text = fs.readFileSync(targetPath, "utf8");

function replaceOnce(from, to, label) {
  if (!text.includes(from)) {
    console.error(`Missing expected block: ${label}`);
    process.exit(2);
  }
  text = text.replace(from, to);
}

replaceOnce(
`async function _fetchFacebookUserProfile(userAccessToken) {
  const url = new URL(\`\${_facebookGraphBase()}/me\`);
  url.searchParams.set("fields", "id,name");
  url.searchParams.set("access_token", String(userAccessToken || "").trim());
  return _facebookJson(url.toString());
}
`,
`async function _fetchFacebookUserProfile(userAccessToken) {
  const url = new URL(\`\${_facebookGraphBase()}/me\`);
  url.searchParams.set("fields", "id,name");
  url.searchParams.set("access_token", String(userAccessToken || "").trim());
  return _facebookJson(url.toString());
}

async function _fetchFacebookLiveDebug(userAccessToken) {
  const token = String(userAccessToken || "").trim();
  if (!token) {
    return {
      user: null,
      accounts: [],
      granted: [],
      declined: [],
      errors: ["missing user token"]
    };
  }

  const out = {
    user: null,
    accounts: [],
    granted: [],
    declined: [],
    errors: []
  };

  try {
    const user = await _fetchFacebookUserProfile(token);
    out.user = {
      id: _safeString(user && user.id, 120),
      name: _safeString(user && user.name, 160)
    };
  } catch (err) {
    out.errors.push(\`me: \${err && err.message ? err.message : String(err || "unknown error")}\`);
  }

  try {
    const pages = await _fetchFacebookManagedPages(token);
    out.accounts = _facebookPageSummaries(pages);
  } catch (err) {
    out.errors.push(\`me/accounts: \${err && err.message ? err.message : String(err || "unknown error")}\`);
  }

  try {
    const scopes = await _fetchFacebookGrantedScopes(token);
    out.granted = Array.isArray(scopes && scopes.granted) ? scopes.granted : [];
    out.declined = Array.isArray(scopes && scopes.declined) ? scopes.declined : [];
  } catch (err) {
    out.errors.push(\`me/permissions: \${err && err.message ? err.message : String(err || "unknown error")}\`);
  }

  return out;
}
`,
  "insert live debug helper"
);

replaceOnce(
`app.get("/__vm/diagnostics", (req, res) => {
  allowCors(res, req);
  const connection = _toPublicFacebookConnectionState(_readFacebookConnectionRecord());
  return res.json({
    ok: true,
    build: SERVER_BUILD_TAG,
    facebook: {
      page_target: FACEBOOK_PAGE_NAME_TARGET,
      app_id_configured: !!META_APP_ID,
      app_secret_configured: !!META_APP_SECRET,
      redirect_uri_configured: !!META_REDIRECT_URI,
      oauth_success_redirect_configured: !!META_OAUTH_SUCCESS_REDIRECT,
      oauth_error_redirect_configured: !!META_OAUTH_ERROR_REDIRECT,
      debug_mode: _facebookDebugEnabled(),
      graph_version: META_GRAPH_VERSION || null,
      last_error: connection.last_error || "",
      last_available_pages: Array.isArray(connection.last_available_pages) ? connection.last_available_pages : []
    }
  });
});
`,
`app.get("/__vm/diagnostics", async (req, res) => {
  allowCors(res, req);
  const rawConnection = _readFacebookConnectionRecord();
  const connection = _toPublicFacebookConnectionState(rawConnection);
  let liveDebug = null;
  if (_facebookDebugEnabled() && rawConnection && rawConnection.user_access_token) {
    try {
      liveDebug = await _fetchFacebookLiveDebug(rawConnection.user_access_token);
    } catch (err) {
      liveDebug = {
        user: null,
        accounts: [],
        granted: [],
        declined: [],
        errors: [err && err.message ? err.message : String(err || "unknown error")]
      };
    }
  }
  return res.json({
    ok: true,
    build: SERVER_BUILD_TAG,
    facebook: {
      page_target: FACEBOOK_PAGE_NAME_TARGET,
      app_id_configured: !!META_APP_ID,
      app_secret_configured: !!META_APP_SECRET,
      redirect_uri_configured: !!META_REDIRECT_URI,
      oauth_success_redirect_configured: !!META_OAUTH_SUCCESS_REDIRECT,
      oauth_error_redirect_configured: !!META_OAUTH_ERROR_REDIRECT,
      debug_mode: _facebookDebugEnabled(),
      graph_version: META_GRAPH_VERSION || null,
      last_error: connection.last_error || "",
      last_available_pages: Array.isArray(connection.last_available_pages) ? connection.last_available_pages : [],
      granted_scopes: Array.isArray(connection.granted_scopes) ? connection.granted_scopes : [],
      declined_scopes: Array.isArray(connection.declined_scopes) ? connection.declined_scopes : [],
      debug_user: connection.debug_user || null,
      live_debug: liveDebug
    }
  });
});
`,
  "make diagnostics async with live debug"
);

fs.writeFileSync(targetPath, text, "utf8");
console.log(`Patched ${targetPath}`);
