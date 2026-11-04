/* ===== core/levels.js — 闖關（50 關）與每日挑戰（五個難度各一題）的規格 =====
 * v0.8：闖關不再選難度，每 10 關換一段難度（幼幼→簡單→普通→困難→神話），項目池最多 10 個；
 *       每 10 關是頭目關（不能用提示）。不限猜測次數，星數看步數。
 */
(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  var Core = isNode ? require('./core.js') : root.GuessCore;
  var Table = isNode ? require('./spec-table.js') : root.GuessSpecTable;
  var mod = factory(Core, Table);
  if (isNode) module.exports = mod; else root.GuessLevels = mod;
})(typeof self !== 'undefined' ? self : this, function (Core, Table) {
  'use strict';

  var COUNT = 50;
  /** 提示次數：幼幼無限／簡單 3／普通 2／困難 1／神話 0 */
  var HINTS = [Infinity, 3, 2, 1, 0];
  /** 闖關各段的項目數（段內逐關增加） */
  var LEVEL_N = [[4, 5], [5, 6], [6, 7], [7, 8], [8, 10]];
  /** 闖關字元集輪替（幼幼段先用可愛圖案） */
  var ROTATE = ['pack-fruit', 'digits', 'pack-animal', 'gems', 'pack-food', 'letters', 'pack-go', 'pack-flag', 'pack-play', 'pack-space',
    'pack-home', 'pack-tw', 'pack-wear', 'pack-landmark', 'pack-learn', 'mix'];

  function tierOf(L) { return Math.min(4, Math.floor((L - 1) / 10)); }

  /** 第 L 關（1..50）的題型 */
  function specFor(L) {
    var tier = tierOf(L);
    var k = (L - 1) % 10;                     // 段內第幾關（0..9）
    var range = LEVEL_N[tier];
    var n = range[0] + Math.floor(k * (range[1] - range[0] + 1) / 10);
    var r = Core.rngFrom('lvrep:' + L);
    var rep = r() < Core.TIER_REP[tier];
    var cs = ROTATE[(L - 1) % ROTATE.length];
    return { tier: tier, cs: cs, n: n, rep: rep };
  }

  /** 一關的完整設定 */
  function level(L) {
    var t = specFor(L);
    var spec = Core.makeSpec({ cs: t.cs, n: t.n, rep: t.rep }, 'lv:' + L);
    var boss = L % 10 === 0;
    var clues = L <= 5 ? 1 : 0;              // 最前面幾關送一個位置線索
    return { L: L, tier: t.tier, spec: spec, boss: boss, hints: boss ? 0 : HINTS[t.tier], clues: clues, par: Math.max(2, Table.par(t.tier, spec.n, t.rep) - (boss ? 1 : 0)) };
  }

  /** 星數：3★ 在標準步數內、2★ 多 2 步內、1★ 過關；用過提示最高 2★ */
  function stars(info, used, hintsUsed) {
    var s = used <= info.par ? 3 : used <= info.par + 2 ? 2 : 1;
    if (hintsUsed > 0) s = Math.min(s, 2);
    return s;
  }

  /* ---------- 每日挑戰：五個難度各一題，台北時間切日、全球同題 ---------- */
  function dailyInfo(dateStr, tier) {
    tier = Math.max(0, Math.min(4, tier | 0));
    var day = Core.dayNumber(dateStr);
    var ids = Core.CHARSET_IDS;
    var cs = ids[(day * 3 + tier * 5) % ids.length];
    var spec = Core.tierSpec(tier, cs, 'daily:' + dateStr + ':' + tier);
    return { date: dateStr, tier: tier, spec: spec, hints: 0, par: Table.par(tier, spec.n, spec.rep) };
  }

  return { COUNT: COUNT, HINTS: HINTS, tierOf: tierOf, specFor: specFor, level: level, stars: stars, dailyInfo: dailyInfo };
});
