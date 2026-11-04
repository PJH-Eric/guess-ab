/* ===== scripts/reconnect-check.cjs — 互猜中斷線自動重連、重新整理自動回房、回來後照樣能猜（開發用，需執行中的伺服器）===== */
const { chromium } = require('playwright');
const assert = require('assert');
const BASE = 'http://localhost:3100/';
(async () => {
  const b = await chromium.launch();
  const mk = async () => { const c = await b.newContext({ viewport: { width: 1180, height: 820 } }); await c.addInitScript(() => { if (!localStorage.getItem('guess-ab:v1')) localStorage.setItem('guess-ab:v1', JSON.stringify({ ver: 8, lang: 'zh-Hant', musicOn: false, sfxOn: false })); }); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); await p.goto(BASE); await p.waitForTimeout(300); await p.evaluate(() => OnlineUI.enterLobby()); await p.waitForTimeout(700); return p; };
  const A = await mk(), B = await mk();
  await A.evaluate(() => Net.send({ type: 'create', mode: 'duel', name: 'A', settings: { tier: 1, cs: 'gems', turnSec: 30 } })); await A.waitForTimeout(400);
  const id = await A.evaluate(() => OnlineUI.room.id);
  await B.evaluate(id => Net.send({ type: 'join', roomId: id, name: 'B', want: 'player' }), id); await B.waitForTimeout(400);
  for (const p of [A, B]) await p.evaluate(() => Net.send({ type: 'ready', value: true })); await A.waitForTimeout(500);
  for (const p of [A, B]) await p.evaluate(() => { const g = OnlineUI.room.game; Net.send({ type: 'secret', code: g.players[OnlineUI.room.you.seat].myDefault }); });
  await A.waitForTimeout(600);
  const before = await A.evaluate(() => ({ seat: OnlineUI.room.you.seat, turn: OnlineUI.room.game.turn, dl: OnlineUI.room.game.deadline }));
  /* 1. 斷線（關 WebSocket）再自動重連 */
  await A.evaluate(() => Net.ws.close());
  await A.waitForTimeout(4000);
  const after = await A.evaluate(() => ({ status: Net.status, seat: OnlineUI.room && OnlineUI.room.you.seat, screen: App.screen, timer: document.querySelector('#timer .timer-num').textContent, timerHidden: document.getElementById('timer').hidden }));
  assert.strictEqual(after.status, 'open'); assert.strictEqual(after.seat, before.seat); assert.strictEqual(after.screen, 'game');
  console.log('重連', JSON.stringify(after));
  /* 2. 重新整理頁面（同一分頁 sessionStorage 保留） */
  await A.reload(); await A.waitForTimeout(500);
  const auto = await A.evaluate(() => ({ screen: App.screen, inRoom: !!OnlineUI.room }));
  console.log('重新整理後（沒點線上）', JSON.stringify(auto));
  await A.evaluate(() => OnlineUI.enterLobby()); await A.waitForTimeout(1500);
  const rej = await A.evaluate(() => ({ screen: App.screen, seat: OnlineUI.room && OnlineUI.room.you.seat, status: OnlineUI.room && OnlineUI.room.status, canInput: GameView.enabled, timer: document.querySelector('#timer .timer-num').textContent }));
  console.log('重新整理後進線上', JSON.stringify(rej));
  await A.screenshot({ path: 'tmp/recon-A.png' });
  /* 3. 輪到的人可以猜 */
  const turnP = (await A.evaluate(() => OnlineUI.room.game.turn === OnlineUI.room.you.seat)) ? A : B;
  const okGuess = await turnP.evaluate(async () => { const n = OnlineUI.room.game.spec.n; const c0 = OnlineUI.room.game.players[OnlineUI.room.you.seat].count; Net.send({ type: 'guess', code: [0, 1, 2, 3] }); await new Promise(r => setTimeout(r, 500)); return OnlineUI.room.game.players[OnlineUI.room.you.seat].count === c0 + 1; });
  console.log('重連後照樣能猜', okGuess, JSON.stringify([A.errs, B.errs]));
  await b.close();
})().catch(e => { console.error('✗', e.message); process.exit(1); });
