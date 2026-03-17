(function () {
  "use strict";

  var EVENT_VERSION = 1;
  var VISITOR_KEY = "vm_analytics_visitor_v1";
  var SESSION_KEY = "vm_analytics_session_v1";
  var PAGEVIEW_KEY = "vm_analytics_pageview_v1";
  var BUFFER_KEY = "vm_analytics_buffer_v1";
  var MAX_BUFFER_EVENTS = 250;

  function safeGet(storage, key) {
    try {
      return storage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function safeSet(storage, key, value) {
    try {
      storage.setItem(key, value);
    } catch (_) {}
  }

  function safeParse(json, fallback) {
    try {
      return JSON.parse(json);
    } catch (_) {
      return fallback;
    }
  }

  function nowIso() {
    try {
      return new Date().toISOString();
    } catch (_) {
      return "";
    }
  }

  function localTimeIso() {
    try {
      return new Date().toString();
    } catch (_) {
      return "";
    }
  }

  function createId(prefix) {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return prefix + "_" + window.crypto.randomUUID();
      }
    } catch (_) {}

    return prefix + "_" + Math.random().toString(36).slice(2) + "_" + Date.now().toString(36);
  }

  function getVisitorId() {
    var existing = safeGet(window.localStorage, VISITOR_KEY);
    if (existing) return existing;
    var next = createId("vis");
    safeSet(window.localStorage, VISITOR_KEY, next);
    return next;
  }

  function getSessionId() {
    var existing = safeGet(window.sessionStorage, SESSION_KEY);
    if (existing) return existing;
    var next = createId("sess");
    safeSet(window.sessionStorage, SESSION_KEY, next);
    return next;
  }

  function getPageviewId() {
    var existing = safeGet(window.sessionStorage, PAGEVIEW_KEY);
    if (existing) return existing;
    var next = createId("pv");
    safeSet(window.sessionStorage, PAGEVIEW_KEY, next);
    return next;
  }

  function rotatePageviewId() {
    var next = createId("pv");
    safeSet(window.sessionStorage, PAGEVIEW_KEY, next);
    return next;
  }

  function classifyDevice() {
    try {
      var width = Math.max(window.innerWidth || 0, document.documentElement ? document.documentElement.clientWidth || 0 : 0);
      if (width && width <= 767) return "mobile";
      if (width && width <= 1024) return "tablet";
    } catch (_) {}
    return "desktop";
  }

  function getTimeZone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch (_) {
      return "";
    }
  }

  function cleanPath(value) {
    var v = String(value || "").trim();
    if (!v) return "/";
    if (v.charAt(0) === "#") v = v.replace(/^#\/?/, "/");
    if (v.charAt(0) !== "/") v = "/" + v;
    return v.replace(/\/{2,}/g, "/");
  }

  function canonicalRoute(payload) {
    var explicit = payload && payload.route ? cleanPath(payload.route) : "";
    if (explicit && explicit !== "/") return explicit;

    try {
      var pathname = cleanPath(window.location.pathname || "/");
      var hash = String(window.location.hash || "").trim();
      if ((pathname === "/" || pathname === "") && hash) {
        return cleanPath(hash);
      }
      return pathname;
    } catch (_) {
      return "/";
    }
  }

  function classifyRoute(route) {
    var normalized = cleanPath(route || "/");
    var out = {
      route: normalized,
      section: "home",
      subsection: ""
    };

    if (normalized === "/") return out;
    if (normalized === "/music") {
      out.section = "music";
      return out;
    }
    if (normalized.indexOf("/music/") === 0) {
      out.section = "music";
      if (normalized.indexOf("/music/bands/") === 0) out.subsection = "bands";
      else if (normalized.indexOf("/music/shows/") === 0) out.subsection = "shows";
      else if (normalized.indexOf("/music/people/") === 0) out.subsection = "people";
      else if (normalized.indexOf("/music/project") === 0) out.subsection = "project";
      else if (normalized.indexOf("/music/origins") === 0) out.subsection = "origins";
      return out;
    }
    if (normalized === "/wrestling") {
      out.section = "wrestling";
      return out;
    }
    if (normalized.indexOf("/wrestling/") === 0) {
      out.section = "wrestling";
      if (normalized.indexOf("/wrestling/shows/") === 0) out.subsection = "shows";
      else if (normalized.indexOf("/wrestling/people/") === 0) out.subsection = "people";
      return out;
    }
    if (normalized.indexOf("/calendar") === 0) {
      out.section = "calendar";
      return out;
    }
    if (normalized.indexOf("/about") === 0) {
      out.section = "about";
      return out;
    }
    if (normalized.indexOf("/pricing") === 0) {
      out.section = "pricing";
      return out;
    }
    if (normalized.indexOf("/contact") === 0) {
      out.section = "contact";
      return out;
    }
    if (normalized.indexOf("/admin") === 0) {
      out.section = "admin";
      out.subsection = "dashboard";
      return out;
    }

    return out;
  }

  function normalizeLegacyEventName(name) {
    var raw = String(name || "").trim();
    if (!raw) return "unknown_event";

    if (raw === "band_click") return "music_band_open";
    if (raw === "show_open") return "music_show_open";
    if (raw === "album_open") return "music_album_open";
    if (raw === "photo_open") return "music_photo_open";

    return raw;
  }

  function buildEvent(eventName, payload) {
    var route = canonicalRoute(payload || {});
    var routeInfo = classifyRoute(route);
    var meta = payload && typeof payload.meta === "object" && payload.meta ? payload.meta : {};

    return {
      event_name: normalizeLegacyEventName(eventName),
      occurred_at: nowIso(),
      client_time: localTimeIso(),
      session_id: getSessionId(),
      visitor_id: getVisitorId(),
      pageview_id: getPageviewId(),
      route: routeInfo.route,
      pathname: cleanPath((payload && payload.pathname) || (window.location && window.location.pathname) || "/"),
      hash: String((payload && payload.hash) || (window.location && window.location.hash) || ""),
      section: String((payload && payload.section) || routeInfo.section || "home"),
      subsection: String((payload && payload.subsection) || routeInfo.subsection || ""),
      source: String((payload && payload.source) || "site_shell"),
      event_version: EVENT_VERSION,
      referrer: String((payload && payload.referrer) || document.referrer || ""),
      utm_source: String((payload && payload.utm_source) || ""),
      utm_medium: String((payload && payload.utm_medium) || ""),
      utm_campaign: String((payload && payload.utm_campaign) || ""),
      utm_term: String((payload && payload.utm_term) || ""),
      utm_content: String((payload && payload.utm_content) || ""),
      device_type: String((payload && payload.device_type) || classifyDevice()),
      viewport_w: Number((payload && payload.viewport_w) || window.innerWidth || 0),
      viewport_h: Number((payload && payload.viewport_h) || window.innerHeight || 0),
      language: String((payload && payload.language) || navigator.language || ""),
      timezone: String((payload && payload.timezone) || getTimeZone()),
      entity_type: String((payload && payload.entity_type) || ""),
      entity_id: String((payload && payload.entity_id) || ""),
      entity_label: String((payload && payload.entity_label) || ""),
      meta: meta
    };
  }

  function readBuffer() {
    var raw = safeGet(window.localStorage, BUFFER_KEY);
    var parsed = safeParse(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function writeBuffer(events) {
    safeSet(window.localStorage, BUFFER_KEY, JSON.stringify(events.slice(-MAX_BUFFER_EVENTS)));
  }

  function bufferEvent(evt) {
    var events = readBuffer();
    events.push(evt);
    writeBuffer(events);
    window.__VM_ANALYTICS_BUFFER__ = events.slice(-MAX_BUFFER_EVENTS);
  }

  function clearBufferedEvents() {
    try {
      window.localStorage.removeItem(BUFFER_KEY);
    } catch (_) {}
    window.__VM_ANALYTICS_BUFFER__ = [];
    return true;
  }

  function endpointUrl() {
    try {
      var configured = String(window.VMPIX_ANALYTICS_ENDPOINT || "").trim();
      if (configured) return configured;
    } catch (_) {}
    return "";
  }

  function sendEvent(evt) {
    var endpoint = endpointUrl();
    if (!endpoint) return Promise.resolve(false);

    var body = JSON.stringify(evt);

    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: "application/json" });
        var ok = navigator.sendBeacon(endpoint, blob);
        return Promise.resolve(ok);
      }
    } catch (_) {}

    try {
      return fetch(endpoint, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: body
      }).then(function (res) {
        return !!(res && res.ok);
      }).catch(function () {
        return false;
      });
    } catch (_) {
      return Promise.resolve(false);
    }
  }

  function pickUtmParams() {
    try {
      var params = new URLSearchParams(window.location.search || "");
      return {
        utm_source: params.get("utm_source") || "",
        utm_medium: params.get("utm_medium") || "",
        utm_campaign: params.get("utm_campaign") || "",
        utm_term: params.get("utm_term") || "",
        utm_content: params.get("utm_content") || ""
      };
    } catch (_) {
      return {
        utm_source: "",
        utm_medium: "",
        utm_campaign: "",
        utm_term: "",
        utm_content: ""
      };
    }
  }

  function track(eventName, payload) {
    var mergedPayload = Object.assign({}, pickUtmParams(), payload || {});
    var evt = buildEvent(eventName, mergedPayload);
    bufferEvent(evt);

    try {
      window.dispatchEvent(new CustomEvent("vm:analytics", { detail: evt }));
    } catch (_) {}

    sendEvent(evt);
    return evt;
  }

  function beginPageview(payload) {
    rotatePageviewId();
    return track("page_view", payload || {});
  }

  window.VMPixAnalytics = {
    eventVersion: EVENT_VERSION,
    track: track,
    beginPageview: beginPageview,
    classifyRoute: classifyRoute,
    normalizeLegacyEventName: normalizeLegacyEventName,
    getVisitorId: getVisitorId,
    getSessionId: getSessionId,
    getPageviewId: getPageviewId,
    getBufferedEvents: readBuffer,
    clearBufferedEvents: clearBufferedEvents
  };
})();
