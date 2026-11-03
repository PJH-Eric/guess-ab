/* ===== i18n.js — 語系切換（繁體中文／简体中文／English）=====
 * 字典在 locales.js（繁中、英文手寫）與 locales-hans.js（由 scripts/gen-hans.py 從繁中轉出）。
 * HTML 用 data-i18n="key"、data-i18n-attr="aria-label=key;title=key2" 標記。
 */
(function (root) {
  'use strict';
  var LANGS = ['zh-Hant', 'zh-Hans', 'en'];
  var dict = { 'zh-Hant': {}, 'zh-Hans': {}, en: {} };
  var lang = 'zh-Hant';
  var listeners = [];

  function detect() {
    var saved = root.Store && root.Store.get('lang');
    if (LANGS.indexOf(saved) >= 0) return saved;
    return 'zh-Hant';
  }
  function add(l, table) { Object.assign(dict[l], table); }
  function fmt(s, params) {
    if (!params) return s;
    return String(s).replace(/\{(\w+)\}/g, function (m, k) { return params[k] != null ? params[k] : m; });
  }
  function t(key, params) {
    var s = dict[lang][key];
    if (s == null) s = dict['zh-Hant'][key];
    if (s == null) return key;
    if (typeof s === 'function') return s(params || {});
    return fmt(s, params);
  }
  function has(key) { return dict[lang][key] != null || dict['zh-Hant'][key] != null; }
  function apply(scope) {
    scope = scope || document;
    scope.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    scope.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var p = pair.split('=');
        if (p.length === 2) el.setAttribute(p[0].trim(), t(p[1].trim()));
      });
    });
    if (scope === document) {
      document.documentElement.lang = lang;
      document.title = t('doc.title');
      var md = document.querySelector('meta[name="description"]');
      if (md) md.setAttribute('content', t('doc.desc'));
    }
  }
  function setLang(l) {
    if (LANGS.indexOf(l) < 0 || l === lang) return;
    lang = l;
    if (root.Store) root.Store.set('lang', l);
    apply(document);
    listeners.forEach(function (f) { try { f(l); } catch (e) { console.error(e); } });
  }
  function onChange(f) { listeners.push(f); }
  function init() { lang = detect(); apply(document); }
  /** 依目前語言從 [繁, 簡, 英] 陣列取字 */
  function pick(arr) { return arr ? (lang === 'en' ? arr[2] : lang === 'zh-Hans' ? arr[1] : arr[0]) : ''; }

  root.I18N = { LANGS: LANGS, add: add, t: t, has: has, apply: apply, setLang: setLang, onChange: onChange, init: init, pick: pick, get lang() { return lang; } };
})(typeof self !== 'undefined' ? self : this);
