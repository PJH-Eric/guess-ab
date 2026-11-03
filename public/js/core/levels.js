/* ===== core/levels.js — 闖關（四難度各 100 關）與每日挑戰的規格 =====
 * 每關的字元集／項目數／是否重複由 specFor 決定（混用字元集，位數固定 4）。
 * 答案 seed＝'lv:難度:關卡:重試序號'；重試序號由 scripts/verify-levels.js 離線驗證後寫進 levels-meta.js，
 * 確保每關都能被困難電腦在上限內解出。
 */
(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  var Core = isNode ? require('./core.js') : root.GuessCore;
  var Table = isNode ? require('./spec-table.js') : root.GuessSpecTable;
  var Meta = null;
  if (isNode) { try { Meta = require('./levels-meta.js'); } catch (e) { Meta = null; } } else Meta = root.GuessLevelsMeta || null;
  var mod = factory(Core, Table, Meta);
  if (isNode) module.exports = mod; else root.GuessLevels = mod;
})(typeof self !== 'undefined' ? self : this, function (Core, Table, Meta) {
  'use strict';

  var TIERS = 4;
  var COUNT = 100;
  var HINTS = [Infinity, 3, 2, 1];

  function band(L, list) { for (var i = 0; i < list.length; i++) if (L <= list[i][0]) return list[i][1]; return list[list.length - 1][1]; }
  function packAt(i, cuteOnly) { var arr = cuteOnly ? Core.CUTE_PACKS : Core.PACKS; return 'pack-' + arr[((i % arr.length) + arr.length) % arr.length]; }
  /** n 超過字元集上限時換一個裝得下的字元集 */
  function fit(cs, n) {
    var c = Core.charset(cs);
    if (c && n <= c.max) return cs;
    return n <= 26 ? 'letters' : 'mix';
  }

  /** 第 L 關（1..100）的題型 */
  function specFor(tier, L) {
    var n, rep = false, cs;
    var turn = Math.floor((L - 1) / 3);
    if (tier === 0) {
      n = band(L, [[25, 6], [50, 8], [100, 10]]);
      if (L <= 60) cs = packAt(turn, true);
      else cs = ['digits', packAt(turn, false), 'gems'][L % 3];
    } else if (tier === 1) {
      n = band(L, [[25, 8], [60, 10], [100, 12]]);
      cs = ['digits', packAt(turn, false), 'gems'][L % 3];
    } else if (tier === 2) {
      n = band(L, [[25, 10], [60, 12], [100, 14]]);
      rep = L >= 41 && L % 3 === 0;
      cs = ['digits', 'letters', packAt(turn, false), 'gems', 'mix'][L % 5];
    } else {
      n = L <= 30 ? 12 : L <= 70 ? 16 : Math.min(26, 20 + Math.floor((L - 71) / 5));
      rep = L >= 21 && L % 2 === 0;
      cs = ['letters', packAt(turn, false), 'mix', 'gems', 'digits'][L % 5];
    }
    cs = fit(cs, n);
    return { cs: cs, n: n, rep: rep };
  }

  function retryOf(tier, L) { return Meta && Meta.retry && Meta.retry[tier] ? (Meta.retry[tier][L - 1] || 0) : 0; }

  /** 一關的完整設定 */
  function level(tier, L, retry) {
    var t = specFor(tier, L);
    var r = retry == null ? retryOf(tier, L) : retry;
    var spec = Core.makeSpec(t, 'lv:' + tier + ':' + L + ':' + r);
    var boss = L % 10 === 0;
    var clues = tier === 0 ? (L <= 30 ? 2 : L <= 60 ? 1 : 0) : 0;
    var par = Table.par(tier, t.n, t.rep) - (boss ? 1 : 0);
    return {
      tier: tier, L: L, spec: spec, boss: boss,
      limit: Table.limit(tier, t.n, t.rep),
      hints: boss ? 0 : HINTS[tier],
      clues: clues,
      par: Math.max(2, par)
    };
  }

  /** 星數：3★ par 內、2★ 不超過上限−1、1★ 通關；用過提示最高 2★ */
  function stars(info, used, hintsUsed) {
    var s = 1;
    if (used <= info.par) s = 3;
    else if (!info.limit || used <= info.limit - 1) s = 2;
    if (hintsUsed > 0) s = Math.min(s, 2);
    return s;
  }

  /* ---------- 每日挑戰 ---------- */
  /** 依星期固定的題型；圖案包依週次輪替 12 包 */
  function dailyInfo(dateStr) {
    var day = Core.dayNumber(dateStr);
    var wd = new Date(day * 86400000).getUTCDay(); // 0=週日
    var week = Math.floor((day + 3) / 7);
    var map = {
      1: { cs: 'digits', n: 10, rep: false },
      2: { cs: packAt(week * 2, false), n: 10, rep: false },
      3: { cs: 'letters', n: 10, rep: false },
      4: { cs: 'gems', n: 8, rep: true },
      5: { cs: 'digits', n: 10, rep: true },
      6: { cs: packAt(week * 2 + 1, false), n: 12, rep: false },
      0: { cs: 'letters', n: 12, rep: true }
    };
    var t = map[wd];
    var spec = Core.makeSpec(t, 'daily:' + dateStr);
    return { date: dateStr, weekday: wd, spec: spec, limit: Table.limit(2, t.n, t.rep), hints: 0, par: Table.par(2, t.n, t.rep) };
  }

  return { TIERS: TIERS, COUNT: COUNT, HINTS: HINTS, specFor: specFor, level: level, stars: stars, dailyInfo: dailyInfo, retryOf: retryOf };
});
