/* ===== scripts/spectate-check.cjs — 三端（桌機房主／手機玩家／平板觀戰，三種語言）跑一局競速：暴力猜中、10 秒收尾倒數、結算標題（開發用，需執行中的伺服器）===== */
const { chromium } = require('playwright');
const assert = require('assert');
const BASE = 'http://localhost:3100/';
(async () => {
  const b = await chromium.launch();
  const mk = async (w, h, lang) => { const c = await b.newContext({ viewport: { width: w, height: h } }); await c.addInitScript(l => localStorage.setItem('guess-ab:v1', JSON.stringify({ ver: 8, lang: l, musicOn: false, sfxOn: false })), lang); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); await p.goto(BASE); await p.waitForTimeout(300); await p.evaluate(() => OnlineUI.enterLobby()); await p.waitForTimeout(700); return p; };
  const A = await mk(1180, 820, 'zh-Hant'), B = await mk(390, 844, 'en'), S = await mk(820, 1180, 'zh-Hans');
  await A.evaluate(() => Net.send({ type: 'create', mode: 'race', name: '房主', settings: { tier: 0, cs: 'pack-fruit', minutes: 3 } })); await A.waitForTimeout(500);
  const id = await A.evaluate(() => OnlineUI.room.id);
  await B.evaluate(id => Net.send({ type: 'join', roomId: id, name: 'Bob', want: 'player' }), id);
  await S.evaluate(id => Net.send({ type: 'join', roomId: id, name: '观众', want: 'spectator' }), id); await A.waitForTimeout(500);
  await A.evaluate(() => Net.send({ type: 'ready', value: true })); await B.evaluate(() => Net.send({ type: 'ready', value: true })); await A.waitForTimeout(800);
  /* B 暴力猜到中 */
  const solved = await B.evaluate(async () => {
    const n = OnlineUI.room.game.spec.n, all = [];
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) for (let c = 0; c < n; c++) for (let d = 0; d < n; d++) if (new Set([a, b, c, d]).size === 4) all.push([a, b, c, d]);
    for (const code of all) {
      Net.send({ type: 'guess', code });
      await new Promise(r => setTimeout(r, 25));
      const me = OnlineUI.room.game.players[OnlineUI.room.you.seat];
      if (me.solved) return me.count;
    }
    return 0;
  });
  assert.ok(solved > 0, 'B 猜中');
  await A.waitForTimeout(400);
  const fin = await A.evaluate(() => ({ num: document.querySelector('#timer .timer-num').textContent, finishAt: OnlineUI.room.game.finishAt }));
  assert.ok(fin.finishAt && /^\d\.\d{2}$|^10\.00$/.test(fin.num), '收尾倒數 ' + fin.num);
  const specView = await S.evaluate(() => ({ tabs: document.querySelectorAll('#g-hist .h-row, .h-row').length, why: document.getElementById('input-note') && document.getElementById('input-note').textContent, timer: document.querySelector('#timer .timer-num').textContent }));
  await S.screenshot({ path: 'tmp/L4-spec.png' });
  await A.screenshot({ path: 'tmp/L4-host-finishing.png' });
  await B.screenshot({ path: 'tmp/L4-solver.png' });
  await A.waitForTimeout(10600);
  const res = await Promise.all([A, B, S].map(p => p.evaluate(() => { const t = document.getElementById('res-title'); return t ? t.textContent : null; })));
  await S.screenshot({ path: 'tmp/L4-spec-result.png' });
  await A.screenshot({ path: 'tmp/L4-host-result.png' });
  console.log(JSON.stringify({ solved, fin, specView, res, errs: [A.errs, B.errs, S.errs] }));
  await b.close();
})().catch(e => { console.error('✗', e.message); process.exit(1); });
