/* ===== lobby-link.js — 「返回遊戲大廳」網址解析 =====
 * 優先序：?lobby=網址 → 本分頁先前記住的 → 來源頁(referrer) → 預設的遊戲大廳網址
 * 只接受 http(s) 絕對網址或相對路徑，避免 javascript: 之類的注入。
 */
(function (root) {
  'use strict';

  function resolve(queryValue, stored, referrer) {
    var raw = String(queryValue || stored || referrer || '').trim();
    if (!raw || !/^(https?:\/\/|\/|\.{1,2}\/)/i.test(raw)) return null;
    return raw;
  }

  var query = '', stored = '';
  try { query = new URLSearchParams(root.location ? root.location.search : '').get('lobby') || ''; } catch (e) {}
  try { stored = root.sessionStorage.getItem('guess-ab.lobby') || ''; } catch (e) {}

  var url = resolve(query, stored, root.document ? root.document.referrer : '');
  /* 沒有來源資訊時（直接開啟、本機、書籤），預設回到遊戲大廳，首頁一律看得到「遊戲大廳」按鈕 */
  if (!url) url = 'https://pjh-eric.github.io/game-lobby/';
  if (url && root.location && url.indexOf(root.location.origin + root.location.pathname) === 0) url = null;
  try { if (url && query) root.sessionStorage.setItem('guess-ab.lobby', url); } catch (e) {}

  root.LobbyLink = { url: url, resolve: resolve };
})(typeof self !== 'undefined' ? self : this);
