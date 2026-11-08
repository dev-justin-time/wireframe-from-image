// Loaded by every page under pages/ in <head>, before anything else.
//
// This is a classic script on purpose: the pages load it with a plain
// <script src>, not as a module, so it must not use import/export.
//
// The pages are separate documents, so a failure used to disappear into the
// console of whichever page happened to be open. This keeps failures
// addressable: each one is recorded in window.blueprintErrors with the page and
// time that produced it, printed to the console, and mirrored into
// sessionStorage so navigating between pages does not discard the history of
// the tab. It draws nothing, so no page's layout or markup is touched.
//
//   window.blueprintErrors          the live array (most recent last)
//   window.blueprintReport(error)   record an error a page caught itself
//   window.reportClientError(...)   alias, so a dispatcher can call one name
//   window.blueprintExportErrors()  the whole tab's log as a JSON string
//   window.blueprintClearErrors()   start over
(function () {
  'use strict';

  var LIMIT = 50;
  var KEY = 'blueprint-errors';

  function load() {
    try {
      var raw = window.sessionStorage.getItem(KEY);
      var saved = raw ? JSON.parse(raw) : [];
      return Array.isArray(saved) ? saved.slice(-LIMIT) : [];
    } catch (error) {
      return [];
    }
  }

  function save() {
    try {
      window.sessionStorage.setItem(KEY, JSON.stringify(errors));
    } catch (error) {
      // Private mode, or the quota is gone: the in-memory log still works.
    }
  }

  var errors = load();

  function messageOf(error) {
    if (error && error.message) return error.message;
    return String(error);
  }

  function record(kind, error, context) {
    var message = messageOf(error);
    var page = window.location.pathname;
    // A repeating animation-frame error would otherwise fill the buffer in
    // milliseconds and evict the first, useful failure. Identical repeats count
    // on the entry already there instead.
    for (var index = errors.length - 1; index >= 0 && index >= errors.length - 8; index -= 1) {
      var seen = errors[index];
      if (seen.kind === kind && seen.message === message && seen.page === page) {
        seen.count = (seen.count || 1) + 1;
        seen.at = new Date().toISOString();
        save();
        return seen;
      }
    }

    var entry = {
      kind: kind,
      message: message,
      stack: error && error.stack ? error.stack : null,
      page: page,
      at: new Date().toISOString(),
      context: context || null,
    };
    errors.push(entry);
    while (errors.length > LIMIT) errors.shift();
    console.error('[' + kind + '] ' + entry.message, entry);
    save();
    return entry;
  }

  // A resource that fails to load (missing stylesheet, image, script) fires an
  // error event with no error object, so the URL has to come from the target.
  function detail(event) {
    if (event && event.error) return event.error;
    var target = (event && event.target) || {};
    var url = target.src || target.href || 'resource';
    return new Error(url + ' failed to load');
  }

  window.blueprintErrors = errors;
  window.blueprintReport = function (error, context) {
    return record('reported', error, context);
  };
  window.reportClientError = window.blueprintReport;

  window.blueprintExportErrors = function () {
    return JSON.stringify(errors, null, 2);
  };

  window.blueprintClearErrors = function () {
    errors.length = 0;
    save();
  };

  // Capture phase, because resource failures do not bubble.
  window.addEventListener('error', function (event) {
    record('error', detail(event));
  }, true);

  window.addEventListener('unhandledrejection', function (event) {
    record('unhandledrejection', event.reason);
  });
}());
