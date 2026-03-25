const fs = require("fs");

const targetPath = process.argv[2];

if (!targetPath) {
  console.error("Usage: node tools/patch-facebook-pageid-fallback.js <path-to-server.js>");
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
`const FACEBOOK_PAGE_NAME_TARGET = String(process.env.FACEBOOK_PAGE_NAME_TARGET || "Voodoo Media").trim();
const META_APP_ID = String(process.env.META_APP_ID || "").trim();
`,
`const FACEBOOK_PAGE_NAME_TARGET = String(process.env.FACEBOOK_PAGE_NAME_TARGET || "Voodoo Media").trim();
const FACEBOOK_PAGE_ID_TARGET = String(process.env.FACEBOOK_PAGE_ID_TARGET || "766767130020404").trim();
const META_APP_ID = String(process.env.META_APP_ID || "").trim();
`,
  "page target constants"
);

replaceOnce(
`  return {
    page_target: FACEBOOK_PAGE_NAME_TARGET,
    app_id_configured: !!META_APP_ID,
`,
`  return {
    page_target: FACEBOOK_PAGE_NAME_TARGET,
    page_id_target: FACEBOOK_PAGE_ID_TARGET || null,
    app_id_configured: !!META_APP_ID,
`,
  "facebook config summary"
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

async function _fetchFacebookPageById(userAccessToken, pageId) {
  const id = _safeString(pageId, 120);
  if (!id) return null;
  const url = new URL(\`\${_facebookGraphBase()}/\${encodeURIComponent(id)}\`);
  url.searchParams.set("fields", "id,name,access_token,tasks");
  url.searchParams.set("access_token", String(userAccessToken || "").trim());
  const data = await _facebookJson(url.toString());
  return data && typeof data === "object" ? data : null;
}
`,
  "insert page lookup helper"
);

replaceOnce(
`function _findTargetFacebookPage(pages) {
  const items = Array.isArray(pages) ? pages : [];
  const target = String(FACEBOOK_PAGE_NAME_TARGET || "").trim().toLowerCase();
  if (!items.length) return null;
  if (!target) return items[0] || null;
`,
`function _findTargetFacebookPage(pages) {
  const items = Array.isArray(pages) ? pages : [];
  const target = String(FACEBOOK_PAGE_NAME_TARGET || "").trim().toLowerCase();
  const targetId = String(FACEBOOK_PAGE_ID_TARGET || "").trim();
  if (!items.length) return null;
  if (targetId) {
    const byId = items.find((page) => _safeString(page && page.id, 120) === targetId);
    if (byId) return byId;
  }
  if (!target) return items[0] || null;
`,
  "find target page by id"
);

replaceOnce(
`    const pages = await _fetchFacebookManagedPages(userAccessToken);
    let grantedScopeInfo = { granted: [], declined: [] };
`,
`    let pages = await _fetchFacebookManagedPages(userAccessToken);
    let grantedScopeInfo = { granted: [], declined: [] };
`,
  "pages mutable"
);

replaceOnce(
`    const page = _findTargetFacebookPage(pages);
    if (!page || !page.id || !page.access_token) {
`,
`    let page = _findTargetFacebookPage(pages);
    if ((!page || !page.id || !page.access_token) && FACEBOOK_PAGE_ID_TARGET) {
      try {
        const directPage = await _fetchFacebookPageById(userAccessToken, FACEBOOK_PAGE_ID_TARGET);
        if (directPage && directPage.id) {
          const existingIndex = pages.findIndex((item) => _safeString(item && item.id, 120) === _safeString(directPage.id, 120));
          if (existingIndex >= 0) pages[existingIndex] = Object.assign({}, pages[existingIndex], directPage);
          else pages = pages.concat([directPage]);
          page = _findTargetFacebookPage(pages);
        }
      } catch (directErr) {
        console.warn("facebook direct page lookup failed:", directErr && directErr.message ? directErr.message : directErr);
      }
    }
    if (!page || !page.id || !page.access_token) {
`,
  "callback page fallback"
);

fs.writeFileSync(targetPath, text, "utf8");
console.log(`Patched ${targetPath}`);
