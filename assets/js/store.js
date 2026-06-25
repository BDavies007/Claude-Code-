/* store.js — localStorage-backed CRUD + simple pub/sub event emitter.
   Exposed as window.BGORS.store. No ES modules (works over file://). */
(function (global) {
  "use strict";

  global.BGORS = global.BGORS || {};

  var STORAGE_KEY = "bgors.data.v1";

  // Collections we persist. Each is an array of plain objects with an `id`.
  var COLLECTIONS = ["sites", "operations", "tasks"];

  // ---- internal state ----
  var state = null;           // { sites: [], operations: [], tasks: [], meta: {} }
  var listeners = {};         // event -> [fn]

  // ---- pub/sub ----
  function on(event, fn) {
    (listeners[event] = listeners[event] || []).push(fn);
    return function off() {
      listeners[event] = (listeners[event] || []).filter(function (f) { return f !== fn; });
    };
  }
  function emit(event, payload) {
    (listeners[event] || []).forEach(function (fn) {
      try { fn(payload); } catch (e) { console.error("listener error for " + event, e); }
    });
    // also fire a generic change event for any data mutation
    if (event !== "change") (listeners["change"] || []).forEach(function (fn) {
      try { fn({ event: event, payload: payload }); } catch (e) { console.error(e); }
    });
  }

  // ---- ids ----
  function uid(prefix) {
    return (prefix || "id") + "_" +
      Date.now().toString(36) + "_" +
      Math.random().toString(36).slice(2, 8);
  }

  // ---- persistence ----
  function emptyState() {
    return { sites: [], operations: [], tasks: [], meta: { seeded: false } };
  }

  function load() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) { state = emptyState(); return state; }
      var parsed = JSON.parse(raw);
      state = emptyState();
      COLLECTIONS.forEach(function (c) {
        if (Array.isArray(parsed[c])) state[c] = parsed[c];
      });
      if (parsed.meta && typeof parsed.meta === "object") state.meta = parsed.meta;
    } catch (e) {
      console.error("Failed to load state, starting fresh.", e);
      state = emptyState();
    }
    return state;
  }

  function persist() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to persist state (storage full or unavailable).", e);
    }
  }

  function ensureLoaded() { if (!state) load(); }

  // ---- generic helpers ----
  function all(collection) {
    ensureLoaded();
    return (state[collection] || []).slice(); // shallow copy to discourage external mutation
  }
  function get(collection, id) {
    ensureLoaded();
    return (state[collection] || []).filter(function (r) { return r.id === id; })[0] || null;
  }
  function create(collection, record) {
    ensureLoaded();
    var rec = Object.assign({}, record);
    if (!rec.id) rec.id = uid(collection.slice(0, 3));
    state[collection].push(rec);
    persist();
    emit(collection + ":create", rec);
    return rec;
  }
  function update(collection, id, patch) {
    ensureLoaded();
    var idx = state[collection].findIndex(function (r) { return r.id === id; });
    if (idx === -1) return null;
    state[collection][idx] = Object.assign({}, state[collection][idx], patch, { id: id });
    persist();
    emit(collection + ":update", state[collection][idx]);
    return state[collection][idx];
  }
  function remove(collection, id) {
    ensureLoaded();
    var before = state[collection].length;
    state[collection] = state[collection].filter(function (r) { return r.id !== id; });
    var removed = state[collection].length !== before;
    if (removed) { persist(); emit(collection + ":delete", { id: id }); }
    return removed;
  }

  // ---- domain-specific cascade: deleting a site removes its ops & tasks ----
  function deleteSite(id) {
    ensureLoaded();
    state.operations = state.operations.filter(function (o) { return o.siteId !== id; });
    state.tasks = state.tasks.filter(function (t) { return t.siteId !== id; });
    var ok = remove("sites", id);
    persist();
    return ok;
  }

  // ---- meta / reset ----
  function getMeta() { ensureLoaded(); return Object.assign({}, state.meta); }
  function setMeta(patch) { ensureLoaded(); state.meta = Object.assign({}, state.meta, patch); persist(); }

  function replaceAll(data) {
    state = emptyState();
    COLLECTIONS.forEach(function (c) { if (Array.isArray(data[c])) state[c] = data[c]; });
    if (data.meta) state.meta = data.meta;
    persist();
    emit("reset", null);
  }

  function clearAll() {
    state = emptyState();
    persist();
    emit("reset", null);
  }

  global.BGORS.store = {
    STORAGE_KEY: STORAGE_KEY,
    on: on,
    emit: emit,
    uid: uid,
    load: load,
    all: all,
    get: get,
    create: create,
    update: update,
    remove: remove,
    deleteSite: deleteSite,
    getMeta: getMeta,
    setMeta: setMeta,
    replaceAll: replaceAll,
    clearAll: clearAll
  };
})(window);
