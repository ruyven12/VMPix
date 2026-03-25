const fs = require("fs");

const targetPath = process.argv[2];

if (!targetPath) {
  console.error("Usage: node tools/patch-facebook-debug.js <path-to-server.js>");
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
`  return {
    connected: !!src.connected,
    page: {
      id: _safeString(page.id, 120),
      name: _safeString(page.name, 160)
    },
      token_status: _safeString(src.token_status, 48) || "not_connected",
      last_checked_at: _safeString(src.last_checked_at, 80) || null,
      last_publish_at: _safeString(src.last_publish_at, 80) || null,
      user_token_expires_at: _safeString(src.user_token_expires_at, 80) || null,
      last_available_pages: Array.isArray(src.last_available_pages) ? src.last_available_pages.map((item) => ({
        id: _safeString(item && item.id, 120),
        name: _safeString(item && item.name, 160),
        tasks: Array.isArray(item && item.tasks) ? item.tasks.map((task) => _safeString(task, 80)).filter(Boolean) : []
      })) : [],
      last_error: _safeString(src.last_error, 500) || "",
      scopes: Array.isArray(src.scopes) ? src.scopes.map((scope) => _safeString(scope, 80)).filter(Boolean) : [],
      updated_at: _safeString(src.updated_at, 80) || null
    };
}
`,
`  return {
    connected: !!src.connected,
    page: {
      id: _safeString(page.id, 120),
      name: _safeString(page.name, 160)
    },
      token_status: _safeString(src.token_status, 48) || "not_connected",
      last_checked_at: _safeString(src.last_checked_at, 80) || null,
      last_publish_at: _safeString(src.last_publish_at, 80) || null,
      user_token_expires_at: _safeString(src.user_token_expires_at, 80) || null,
      last_available_pages: Array.isArray(src.last_available_pages) ? src.last_available_pages.map((item) => ({
        id: _safeString(item && item.id, 120),
        name: _safeString(item && item.name, 160),
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
`,
  "_toPublicFacebookConnectionState"
);

replaceOnce(
`    last_available_pages: [],
    last_error: "",
    scopes: [],
    updated_at: null
  };
}
`,
`    last_available_pages: [],
    last_error: "",
    scopes: [],
    granted_scopes: [],
    declined_scopes: [],
    debug_user: null,
    updated_at: null
  };
}
`,
  "_defaultFacebookConnectionRecord"
);

replaceOnce(
`      last_error: _safeString(parsed.last_error, 500) || "",
      scopes: scopes.map((scope) => _safeString(scope, 80)).filter(Boolean),
      updated_at: _safeString(parsed.updated_at, 80) || null
    };
`,
`      last_error: _safeString(parsed.last_error, 500) || "",
      scopes: scopes.map((scope) => _safeString(scope, 80)).filter(Boolean),
      granted_scopes: Array.isArray(parsed.granted_scopes) ? parsed.granted_scopes.map((scope) => _safeString(scope, 80)).filter(Boolean) : [],
      declined_scopes: Array.isArray(parsed.declined_scopes) ? parsed.declined_scopes.map((scope) => _safeString(scope, 80)).filter(Boolean) : [],
      debug_user: parsed.debug_user && typeof parsed.debug_user === "object" ? {
        id: _safeString(parsed.debug_user.id, 120),
        name: _safeString(parsed.debug_user.name, 160)
      } : null,
      updated_at: _safeString(parsed.updated_at, 80) || null
    };
`,
  "_readFacebookConnectionRecord"
);

replaceOnce(
`    last_error: _safeString(next.last_error, 500) || "",
    scopes: Array.isArray(next.scopes) ? next.scopes.map((scope) => _safeString(scope, 80)).filter(Boolean) : [],
    updated_at: new Date().toISOString()
  };
`,
`    last_error: _safeString(next.last_error, 500) || "",
    scopes: Array.isArray(next.scopes) ? next.scopes.map((scope) => _safeString(scope, 80)).filter(Boolean) : [],
    granted_scopes: Array.isArray(next.granted_scopes) ? next.granted_scopes.map((scope) => _safeString(scope, 80)).filter(Boolean) : [],
    declined_scopes: Array.isArray(next.declined_scopes) ? next.declined_scopes.map((scope) => _safeString(scope, 80)).filter(Boolean) : [],
    debug_user: next.debug_user && typeof next.debug_user === "object" ? {
      id: _safeString(next.debug_user.id, 120),
      name: _safeString(next.debug_user.name, 160)
    } : null,
    updated_at: new Date().toISOString()
  };
`,
  "_writeFacebookConnectionState"
);

replaceOnce(
`async function _fetchFacebookManagedPages(userAccessToken) {
  const url = new URL(\`\${_facebookGraphBase()}/me/accounts\`);
  url.searchParams.set("fields", "id,name,access_token,tasks");
  url.searchParams.set("access_token", String(userAccessToken || "").trim());
  const data = await _facebookJson(url.toString());
  return Array.isArray(data && data.data) ? data.data : [];
}
`,
`async function _fetchFacebookManagedPages(userAccessToken) {
  const url = new URL(\`\${_facebookGraphBase()}/me/accounts\`);
  url.searchParams.set("fields", "id,name,access_token,tasks");
  url.searchParams.set("access_token", String(userAccessToken || "").trim());
  const data = await _facebookJson(url.toString());
  return Array.isArray(data && data.data) ? data.data : [];
}

async function _fetchFacebookGrantedScopes(userAccessToken) {
  const url = new URL(\`\${_facebookGraphBase()}/me/permissions\`);
  url.searchParams.set("access_token", String(userAccessToken || "").trim());
  const data = await _facebookJson(url.toString());
  const granted = [];
  const declined = [];
  (Array.isArray(data && data.data) ? data.data : []).forEach((item) => {
    const permission = _safeString(item && item.permission, 80);
    const status = _safeString(item && item.status, 40).toLowerCase();
    if (!permission) return;
    if (status === "granted") granted.push(permission);
    else if (status === "declined") declined.push(permission);
  });
  return { granted, declined };
}

async function _fetchFacebookUserProfile(userAccessToken) {
  const url = new URL(\`\${_facebookGraphBase()}/me\`);
  url.searchParams.set("fields", "id,name");
  url.searchParams.set("access_token", String(userAccessToken || "").trim());
  return _facebookJson(url.toString());
}
`,
  "facebook scope helpers"
);

replaceOnce(
`    const pages = await _fetchFacebookManagedPages(userAccessToken);
    const page = _findTargetFacebookPage(pages);
`,
`    const pages = await _fetchFacebookManagedPages(userAccessToken);
    let grantedScopeInfo = { granted: [], declined: [] };
    let debugUser = null;
    try {
      grantedScopeInfo = await _fetchFacebookGrantedScopes(userAccessToken);
    } catch (scopeErr) {
      console.warn("facebook permissions lookup failed:", scopeErr && scopeErr.message ? scopeErr.message : scopeErr);
    }
    try {
      debugUser = await _fetchFacebookUserProfile(userAccessToken);
    } catch (userErr) {
      console.warn("facebook user profile lookup failed:", userErr && userErr.message ? userErr.message : userErr);
    }
    const page = _findTargetFacebookPage(pages);
`,
  "callback fetches"
);

replaceOnce(
`          last_available_pages: availablePages,
          last_error: \`unable to find target page "\${FACEBOOK_PAGE_NAME_TARGET}"\`
        }));
`,
`          last_available_pages: availablePages,
          last_error: \`unable to find target page "\${FACEBOOK_PAGE_NAME_TARGET}"\`,
          granted_scopes: grantedScopeInfo.granted,
          declined_scopes: grantedScopeInfo.declined,
          debug_user: debugUser
        }));
`,
  "callback failure state"
);

replaceOnce(
`      scopes: Array.isArray(statePayload.scopes) ? statePayload.scopes : _facebookRequestedScopes()
    });
`,
`      scopes: Array.isArray(statePayload.scopes) ? statePayload.scopes : _facebookRequestedScopes(),
      granted_scopes: grantedScopeInfo.granted,
      declined_scopes: grantedScopeInfo.declined,
      debug_user: debugUser
    });
`,
  "callback success state"
);

fs.writeFileSync(targetPath, text, "utf8");
console.log(`Patched ${targetPath}`);
