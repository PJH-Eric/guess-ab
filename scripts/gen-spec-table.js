/* ===== scripts/gen-spec-table.js — 離線模擬產生「規格表」=====
 * 難度只看（項目數 n、是否重複），與字元集無關。
 * 對每個規格讓「困難」電腦猜隨機密碼，記錄平均步數，寫入 public/js/core/spec-table.js。
 * v0.8 起項目數只有 4～10，每個規格都直接模擬 400 局。
 * 用法：node scripts/gen-spec-table.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const Core = require('../public/js/core/core.js');
const AI = require('./lib/solver.js');

const SAMPLE_N = [4, 5, 6, 7, 8, 9, 10];
function sim(n, rep) {
  const size = Core.spaceSize(n, rep);
  const games = 400;
  const rng = Core.mulberry32(n * 31 + (rep ? 7 : 0));
  let tot = 0, max = 0;
  for (let i = 0; i < games; i++) {
    const secret = Core.makeSecret(rng, n, rep);
    const st = AI.simulate({ level: 3, n: n, rep: rep, rng: Core.mulberry32(i * 977 + n) }, secret, 80);
    tot += st; max = Math.max(max, st);
  }
  return { avg: tot / games, max: max, games: games };
}

const out = { u: {}, r: {} };
for (const rep of [false, true]) {
  const pts = [];
  for (const n of SAMPLE_N) {
    const t0 = Date.now();
    const r = sim(n, rep);
    pts.push({ n, x: Math.log(Core.spaceSize(n, rep)), y: r.avg, max: r.max });
    console.log((rep ? '可重複' : '不重複') + ' n=' + n + ' 平均 ' + r.avg.toFixed(2) + ' 最多 ' + r.max + '（' + r.games + ' 局，' + ((Date.now() - t0) / 1000).toFixed(1) + ' 秒）');
  }
  for (let n = 4; n <= 10; n++) {
    const x = Math.log(Core.spaceSize(n, rep));
    let i = 0;
    while (i < pts.length - 2 && pts[i + 1].x < x) i++;
    const a = pts[i], b = pts[i + 1];
    const y = a.x === b.x ? a.y : a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
    out[rep ? 'r' : 'u'][n] = Math.round(y * 100) / 100;
  }
}

const file = path.join(__dirname, '..', 'public', 'js', 'core', 'spec-table.js');
const body = `/* ===== core/spec-table.js — 由 scripts/gen-spec-table.js 自動產生，請勿手改 =====
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
  var AVG = ${JSON.stringify(out)};
  /* 幼幼／簡單／普通／困難／神話 */
  var PAR = [1.6, 1.4, 1.2, 1.1, 1];
  function avg(n, rep) { var t = AVG[rep ? 'r' : 'u']; return t[Math.max(4, Math.min(10, n))]; }
  function par(tier, n, rep) { return Math.max(2, Math.round(avg(n, rep) * PAR[Math.max(0, Math.min(4, tier))])); }
  return { AVG: AVG, PAR: PAR, avg: avg, par: par };
});
`;
fs.writeFileSync(file, body, 'utf8');
console.log('已寫入 ' + file);
