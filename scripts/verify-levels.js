/* ===== scripts/verify-levels.js — 驗證 400 關都能被困難電腦在上限內解出 =====
 * 解不出來的關卡把「重試序號」加一重新出題，結果寫入 public/js/core/levels-meta.js（請提交）。
 * 用法：node scripts/verify-levels.js        （--check 只檢查不寫檔）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const Core = require('../public/js/core/core.js');
const AI = require('../public/js/core/ai.js');
const Levels = require('../public/js/core/levels.js');

const check = process.argv.includes('--check');
const retry = [[], [], [], []];
let bumped = 0, fails = 0;
const t0 = Date.now();
for (let tier = 0; tier < 4; tier++) {
  for (let L = 1; L <= 100; L++) {
    let r = check ? Levels.retryOf(tier, L) : 0, ok = false;
    for (; r < 20; r++) {
      const info = Levels.level(tier, L, r);
      const secret = Core.secretFor(info.spec);
      const max = info.limit || 30;
      const steps = AI.simulate({ level: 3, n: info.spec.n, rep: info.spec.rep, rng: Core.rngFrom('verify:' + tier + ':' + L + ':' + r) }, secret, max);
      if (steps <= max) { ok = true; break; }
      if (check) break;
    }
    if (!ok) { fails++; console.error('✗ 難度 ' + tier + ' 第 ' + L + ' 關解不出來'); }
    if (r > 0) bumped++;
    retry[tier].push(r);
  }
  console.log('難度 ' + tier + ' 完成（' + ((Date.now() - t0) / 1000).toFixed(1) + ' 秒）');
}
if (!check) {
  const file = path.join(__dirname, '..', 'public', 'js', 'core', 'levels-meta.js');
  fs.writeFileSync(file, `/* ===== core/levels-meta.js — 由 scripts/verify-levels.js 自動產生，請勿手改 =====
 * 每關的「重試序號」：確保困難電腦能在上限內解出該關答案。
 */
(function (root) {
  'use strict';
  var META = { retry: ${JSON.stringify(retry)} };
  if (typeof module === 'object' && module.exports) module.exports = META; else root.GuessLevelsMeta = META;
})(typeof self !== 'undefined' ? self : this);
`, 'utf8');
}
console.log((check ? '檢查' : '產生') + '完成：重新出題 ' + bumped + ' 關、失敗 ' + fails + ' 關');
process.exitCode = fails ? 1 : 0;
