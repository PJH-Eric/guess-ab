/* ===== art/registry.js — 符號美術登記表 =====
 * 每個 art/*.js 呼叫 GuessArt.add(setId, { style, items }) 登記一組符號。
 * 規則核心只認「符號 id（索引）」，畫面再用這裡把索引換成 SVG。
 */
(function (root) {
  'use strict';
  var sets = {};
  function add(id, set) { sets[id] = set; }
  function get(id) { return sets[id] || null; }
  /** 回傳完整 <svg> 字串 */
  /* 漸層等 id 每次輸出都加上流水號：同一個符號在頁面出現多次、或第一份藏在隱藏畫面裡時，
     url(#id) 仍會指到「自己這一份」，不會因為參照到 display:none 的定義而變成透明。 */
  var serial = 0;
  function body(it) {
    if (it._tpl == null) {
      var ids = [];
      it.svg.replace(/\bid="([^"]+)"/g, function (m, id) { ids.push(id); return m; });
      var tpl = it.svg;
      ids.forEach(function (id) {
        var esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        tpl = tpl.replace(new RegExp('(id="|url\\(#|href="#)' + esc + '(?=["\\)])', 'g'), '$1' + id + '__U__');
      });
      it._tpl = ids.length ? tpl : '';
    }
    if (!it._tpl) return it.svg;
    var u = '-' + (++serial).toString(36);
    return it._tpl.split('__U__').join(u);
  }
  function svg(setId, index, cls) {
    var s = sets[setId];
    var it = s && s.items[index];
    if (!it) return '<svg class="sym ' + (cls || '') + '" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="30" fill="#ccc"/></svg>';
    return '<svg class="sym sym-' + s.style + ' ' + (cls || '') + '" viewBox="0 0 100 100" aria-hidden="true" focusable="false">' + body(it) + '</svg>';
  }
  root.GuessArt = { sets: sets, add: add, get: get, svg: svg };
})(typeof self !== 'undefined' ? self : this);
