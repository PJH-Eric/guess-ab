/* ===== core/spec-table.js — 由 scripts/gen-spec-table.js 自動產生，請勿手改 =====
 * 困難推理在各規格（項目數 n、u＝不重複／r＝可重複且同一符號最多 3 次）的平均步數。
 * v0.8 起單機與闖關不限次數，只用來算星數的「標準步數」（par）：平均步數 × 係數後四捨五入。
 */
(function (root, factory) {
  'use strict';
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.GuessSpecTable = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var AVG = {"u":{"4":3.9,"5":3.9,"6":4.06,"7":4.39,"8":4.72,"9":5.11,"10":5.25},"r":{"4":3.83,"5":4.14,"6":4.46,"7":4.76,"8":5.13,"9":5.45,"10":5.72}};
  /* 幼幼／簡單／普通／困難／神話 */
  var PAR = [1.6, 1.4, 1.2, 1.1, 1];
  function avg(n, rep) { var t = AVG[rep ? 'r' : 'u']; return t[Math.max(4, Math.min(10, n))]; }
  function par(tier, n, rep) { return Math.max(2, Math.round(avg(n, rep) * PAR[Math.max(0, Math.min(4, tier))])); }
  return { AVG: AVG, PAR: PAR, avg: avg, par: par };
});
