/* ===== scripts/edge-check.cjs — 線上邊界：競速時間到、互猜回合上限（開發用；先用 GUESS_TEST_FAST=1 PORT=3101 node server.js 開快速伺服器）===== */
const { chromium } = require('playwright');
const BASE = 'http://localhost:3101/';
(async () => {
  const b = await chromium.launch();
  let A, B;
  const mk = async (w, h, lang) => { const c = await b.newContext({ viewport: { width: w, height: h } }); await c.addInitScript(l => localStorage.setItem('guess-ab:v1', JSON.stringify({ ver: 8, lang: l, musicOn: false, sfxOn: false })), lang); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); await p.goto(BASE); await p.waitForTimeout(300); await p.evaluate(() => OnlineUI.enterLobby()); await p.waitForTimeout(700); return p; };
  const room = async (A, B, mode, settings) => { await A.evaluate(o => Net.send({ type: 'create', mode: o.mode, name: 'A', settings: o.settings }), { mode, settings }); await A.waitForTimeout(400); const id = await A.evaluate(() => OnlineUI.room.id); await B.evaluate(id => Net.send({ type: 'join', roomId: id, name: 'B', want: 'player' }), id); await B.waitForTimeout(400); for (const p of [A, B]) await p.evaluate(() => Net.send({ type: 'ready', value: true })); await A.waitForTimeout(600); };
  A = await mk(390, 844, 'zh-Hant'); B = await mk(1180, 820, 'en');
  if (process.env.SKIPRACE) {} else {
  /* 競速：3 分鐘＝9 秒，A 猜一次、B 不猜 → 時間到 A 第一 */
  await room(A, B, 'race', { tier: 0, cs: 'digits', minutes: 3 });
  await A.evaluate(() => { const n = OnlineUI.room.game.spec.n; Net.send({ type: 'guess', code: [0, 1, 2, 3] }); });
  await A.waitForTimeout(9500);
  await A.waitForTimeout(10);
  const race = await Promise.all([A, B].map(p => p.evaluate(() => ({ title: (document.getElementById('res-title') || {}).textContent, sub: (document.querySelector('.res-sub') || {}).textContent }))));
  await A.screenshot({ path: 'tmp/edge-race-A.png' }); await B.screenshot({ path: 'tmp/edge-race-B.png' });
  console.log('race', JSON.stringify(race));
  for (const p of [A, B]) await p.evaluate(() => { Result.hide(); Net.send({ type: 'leave' }); }); await A.waitForTimeout(500);
  }
  /* 互猜：上限 2 回合，雙方都猜錯 → 比最好 A/B */
  await room(A, B, 'duel', { tier: 0, cs: 'digits', turnSec: 15 });
  for (const p of [A, B]) await p.evaluate(() => { const g = OnlineUI.room.game; Net.send({ type: 'secret', code: g.players[OnlineUI.room.you.seat].myDefault }); });
  await A.waitForTimeout(600);
  for (let i = 0; i < 4; i++) {
    for (const p of [A, B]) await p.evaluate(() => { const r = OnlineUI.room, g = r.game; if (r.status !== 'playing' || g.turn !== r.you.seat) return; const n = g.spec.n; const opp = g.players[1 - r.you.seat]; Net.send({ type: 'guess', code: [n - 1, n - 2, n - 3, n - 4] }); });
    await A.waitForTimeout(400);
  }
  await A.waitForTimeout(900);
  console.log(await A.evaluate(() => JSON.stringify({ st: OnlineUI.room.status, phase: OnlineUI.room.game.phase, turn: OnlineUI.room.game.turn, you: OnlineUI.room.you.seat, h: OnlineUI.room.game.players.map(p => p.count), round: OnlineUI.room.game.round })));
  const duel = await Promise.all([A, B].map(p => p.evaluate(() => ({ title: (document.getElementById('res-title') || {}).textContent, sub: (document.querySelector('.res-sub') || {}).textContent, counter: document.getElementById('counter').textContent }))));
  await A.screenshot({ path: 'tmp/edge-duel-A.png' });
  console.log('duel', JSON.stringify(duel), JSON.stringify([A.errs, B.errs]));
  await b.close();
})();
