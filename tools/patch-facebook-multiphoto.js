const fs = require("fs");

const target = process.argv[2];
if (!target) {
  console.error("Usage: node patch-facebook-multiphoto.js <server.js>");
  process.exit(1);
}

let src = fs.readFileSync(target, "utf8");
src = src.replace(/\r\n/g, "\n");

const normalizePattern = /function _normalizeFacebookDraft\(input\) \{[\s\S]*?\n\}/;

const normalizeReplacement = `function _normalizeFacebookSelectedPhotos(input) {
  return (Array.isArray(input) ? input : []).map((item) => {
    const row = item && typeof item === "object" ? item : {};
    return {
      id: _safeString(row.id, 160),
      entity_id: _safeString(row.entity_id, 160),
      title: _safeString(row.title, 240),
      image_url: _safeString(row.image_url, 2000),
      route_url: _safeString(row.route_url, 2000),
      route_path: _safeString(row.route_path, 2000)
    };
  }).filter((item) => item.image_url && _isHttpUrl(item.image_url));
}

function _normalizeFacebookDraft(input) {
  const body = input && typeof input === "object" ? input : {};
  const section = _safeString(body.section, 32).toLowerCase();
  const entityType = _safeString(body.entity_type, 32).toLowerCase() || "show";
  const entityId = _safeString(body.entity_id, 160);
  const entityLabel = _safeString(body.entity_label, 240);
  const caption = _safeString(body.caption, 5000);
  const linkUrl = _safeString(body.link_url, 2000);
  const imageUrl = _safeString(body.image_url, 2000);
  const selectedPhotos = _normalizeFacebookSelectedPhotos(body.selected_photos);
  const meta = _safeMeta(body.meta);
  const errors = [];
  const isNormalPost = entityType === "normal_post";

  if (!section) errors.push("section is required");
  if (!entityType) errors.push("entity_type is required");
  if (!entityId) errors.push("entity_id is required");
  if (!entityLabel) errors.push("entity_label is required");
  if (!caption) errors.push("caption is required");
  if (linkUrl && !_isHttpUrl(linkUrl)) errors.push("link_url must be a valid http(s) URL");
  if (!isNormalPost && !selectedPhotos.length && (!imageUrl || !_isHttpUrl(imageUrl))) {
    errors.push("image_url must be a valid http(s) URL");
  }

  const finalMessage = [caption, linkUrl].filter(Boolean).join("\\n\\n").trim();
  if (!finalMessage) errors.push("final publish message is empty");

  return {
    ok: errors.length === 0,
    errors,
    draft: {
      section,
      entity_type: entityType,
      entity_id: entityId,
      entity_label: entityLabel,
      caption,
      link_url: linkUrl,
      image_url: imageUrl,
      selected_photos: selectedPhotos,
      final_message: finalMessage,
      meta,
      post_kind: isNormalPost ? "feed" : (selectedPhotos.length > 1 ? "multi_photo" : "photo")
    }
  };
}`;

if (!normalizePattern.test(src)) {
  console.error("Could not find normalize block");
  process.exit(1);
}
src = src.replace(normalizePattern, normalizeReplacement);


const photoReplacement = `async function _facebookUploadPhoto(connectionRecord, imageUrl, options) {
  const pageId = _safeString(connectionRecord && connectionRecord.page && connectionRecord.page.id, 120);
  const pageAccessToken = _safeString(connectionRecord && connectionRecord.page_access_token, 2000);
  if (!pageId || !pageAccessToken) throw new Error("facebook page is not connected");

  const opts = options && typeof options === "object" ? options : {};
  const url = new URL(\`\${_facebookGraphBase()}/\${encodeURIComponent(pageId)}/photos\`);
  const body = new URLSearchParams();
  body.set("url", String(imageUrl || "").trim());
  body.set("access_token", pageAccessToken);
  if (opts.caption) body.set("caption", String(opts.caption).trim());
  if (opts.published === false) body.set("published", "false");

  const r = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });
  const text = await r.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }
  if (!r.ok) {
    const msg = data && data.error && data.error.message ? data.error.message : \`HTTP \${r.status}\`;
    throw new Error(msg || "facebook photo publish failed");
  }
  return data || {};
}

async function _facebookPostPhoto(connectionRecord, draft) {
  return _facebookUploadPhoto(connectionRecord, draft.image_url, {
    caption: String(draft.final_message || "").trim()
  });
}

async function _facebookPostMultiPhoto(connectionRecord, draft) {
  const pageId = _safeString(connectionRecord && connectionRecord.page && connectionRecord.page.id, 120);
  const pageAccessToken = _safeString(connectionRecord && connectionRecord.page_access_token, 2000);
  if (!pageId || !pageAccessToken) throw new Error("facebook page is not connected");

  const selectedPhotos = Array.isArray(draft && draft.selected_photos) ? draft.selected_photos : [];
  if (!selectedPhotos.length) {
    throw new Error("selected_photos are required for a multi-photo post");
  }

  const uploaded = [];
  for (let i = 0; i < selectedPhotos.length; i++) {
    const photo = selectedPhotos[i];
    const result = await _facebookUploadPhoto(connectionRecord, photo && photo.image_url, {
      published: false
    });
    const mediaId = _safeString(result && result.id, 240);
    if (!mediaId) throw new Error("facebook multi-photo upload did not return a media id");
    uploaded.push({
      media_fbid: mediaId,
      source_url: _safeString(photo && photo.image_url, 2000)
    });
  }

  const url = new URL(\`\${_facebookGraphBase()}/\${encodeURIComponent(pageId)}/feed\`);
  const body = new URLSearchParams();
  body.set("message", String(draft.final_message || "").trim());
  body.set("access_token", pageAccessToken);
  uploaded.forEach((item, index) => {
    body.set(\`attached_media[\${index}]\`, JSON.stringify({ media_fbid: item.media_fbid }));
  });

  const r = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });
  const text = await r.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }
  if (!r.ok) {
    const msg = data && data.error && data.error.message ? data.error.message : \`HTTP \${r.status}\`;
    throw new Error(msg || "facebook multi-photo publish failed");
  }
  data.uploaded_photos = uploaded;
  return data || {};
}

async function _facebookPostFeed(connectionRecord, draft) {`;

const photoStart = src.indexOf('async function _facebookPostPhoto(connectionRecord, draft) {');
const photoFeedStart = src.indexOf('async function _facebookPostFeed(connectionRecord, draft) {');
if (photoStart < 0 || photoFeedStart < 0 || photoFeedStart <= photoStart) {
  console.error("Could not find photo publish block");
  process.exit(1);
}
src = src.slice(0, photoStart) + photoReplacement + src.slice(photoFeedStart);

const previewReplacement = `        link_url: normalized.draft.link_url,
        image_url: normalized.draft.image_url,
        selected_photos: normalized.draft.selected_photos,
        photo_count: Array.isArray(normalized.draft.selected_photos) ? normalized.draft.selected_photos.length : 0,
        final_message: normalized.draft.final_message,
        meta: normalized.draft.meta`;

const previewNeedle = `        link_url: normalized.draft.link_url,\n        image_url: normalized.draft.image_url,\n        final_message: normalized.draft.final_message,\n        meta: normalized.draft.meta`;
if (!src.includes(previewNeedle)) {
  console.error("Could not find preview block");
  process.exit(1);
}
src = src.replace(previewNeedle, previewReplacement);

const historyNeedle = `    historyItem.image_url = draft.image_url;\n    historyItem.link_url = draft.link_url;\n    historyItem.caption = draft.caption;\n    historyItem.final_message = draft.final_message;\n    historyItem.meta = draft.meta;`;

const historyReplacement = `    historyItem.image_url = draft.image_url;
    historyItem.link_url = draft.link_url;
    historyItem.caption = draft.caption;
    historyItem.final_message = draft.final_message;
    historyItem.meta = Object.assign({}, draft.meta || {}, {
      selected_photos: Array.isArray(draft.selected_photos) ? draft.selected_photos : [],
      photo_count: Array.isArray(draft.selected_photos) ? draft.selected_photos.length : 0
    });`;

if (!src.includes(historyNeedle)) {
  console.error("Could not find history block");
  process.exit(1);
}
src = src.replace(historyNeedle, historyReplacement);

const publishNeedle = `    const publishResult = draft.post_kind === "feed"\n      ? await _facebookPostFeed(record, draft)\n      : await _facebookPostPhoto(record, draft);\n    historyItem.status = "success";\n    historyItem.facebook_post_id = _safeString((publishResult && (publishResult.post_id || publishResult.id)), 240);\n    historyItem.facebook_photo_id = draft.post_kind === "photo"\n      ? _safeString(publishResult && publishResult.id, 240)\n      : "";`;

const publishReplacement = `    const publishResult = draft.post_kind === "feed"
      ? await _facebookPostFeed(record, draft)
      : (draft.post_kind === "multi_photo"
        ? await _facebookPostMultiPhoto(record, draft)
        : await _facebookPostPhoto(record, draft));
    historyItem.status = "success";
    historyItem.facebook_post_id = _safeString((publishResult && (publishResult.post_id || publishResult.id)), 240);
    historyItem.facebook_photo_id = draft.post_kind === "photo"
      ? _safeString(publishResult && publishResult.id, 240)
      : "";
    if (draft.post_kind === "multi_photo") {
      historyItem.meta = Object.assign({}, historyItem.meta || {}, {
        uploaded_photo_ids: Array.isArray(publishResult && publishResult.uploaded_photos)
          ? publishResult.uploaded_photos.map((item) => _safeString(item && item.media_fbid, 240)).filter(Boolean)
          : []
      });
    }`;

if (!src.includes(publishNeedle)) {
  console.error("Could not find publish block");
  process.exit(1);
}
src = src.replace(publishNeedle, publishReplacement);

const responseNeedle = `    return res.json({\n      ok: true,\n      publish_id: historyItem.id,\n      facebook_post_id: historyItem.facebook_post_id || null,\n      facebook_photo_id: historyItem.facebook_photo_id || null,\n      published_at: historyItem.created_at\n    });`;

const responseReplacement = `    return res.json({
      ok: true,
      publish_id: historyItem.id,
      facebook_post_id: historyItem.facebook_post_id || null,
      facebook_photo_id: historyItem.facebook_photo_id || null,
      photo_count: Array.isArray(draft.selected_photos) ? draft.selected_photos.length : (draft.image_url ? 1 : 0),
      published_at: historyItem.created_at
    });`;

if (!src.includes(responseNeedle)) {
  console.error("Could not find publish response block");
  process.exit(1);
}
src = src.replace(responseNeedle, responseReplacement);

fs.writeFileSync(target, src, "utf8");
console.log("Patched multi-photo Facebook publish flow:", target);
