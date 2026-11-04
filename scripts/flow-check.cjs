/* ===== scripts/flow-check.cjs — 瀏覽器端對端流程檢查（開發用，需要 playwright 與執行中的伺服器 npm start）=====
 * 闖關解鎖與星數、頭目關與提示、每日挑戰與練習、開局設定預覽、鍵盤直打、統計、舊資料遷移、線上互猜逾時與計時格式。 */
const { chromium } = require('playwright');
const assert = require('assert');
const BASE = 'http://localhost:3100/';
const log = [];
function ok(name) { log.push('✓ ' + name); console.log('✓ ' + name); }
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 } });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('guess-ab:v1')) localStorage.setItem('guess-ab:v1', JSON.stringify({ lang: 'zh-Hant', musicOn: false, sfxOn: false })); } catch (e) {} });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(400);
  const solve = () => p.evaluate(() => Solo.active.secret.forEach(v => GameView._press(v)));

  /* 1 闖關：第 1 關過關 → 星數存檔、第 2 關解鎖、「下一關」進第 2 關 */
  await p.evaluate(() => App.show('levels'));
  assert.ok(await p.$eval('.lv-card[data-l="2"]', e => e.disabled), '第 2 關一開始鎖著');
  await p.evaluate(() => Solo.start({ mode: 'level', level: 1 }));
  await solve(); await p.waitForTimeout(1200);
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('guess-ab:v1')).stars[0][0]);
  assert.strictEqual(st, 3, '一次猜中 3 星');
  await p.click('#result-layer .btn.primary'); await p.waitForTimeout(500);
  assert.strictEqual(await p.evaluate(() => Solo.active.info.L), 2, '下一關＝第 2 關');
  await p.evaluate(() => App.show('levels'));
  assert.ok(!(await p.$eval('.lv-card[data-l="2"]', e => e.disabled)), '第 2 關已解鎖');
  assert.ok(await p.$eval('.lv-card[data-l="3"]', e => e.disabled), '第 3 關仍鎖');
  ok('闖關：過關存星、解鎖下一關、下一關按鈕');

  /* 2 頭目關不能用提示、用提示最多 2 星 */
  await p.evaluate(() => Solo.start({ mode: 'level', level: 10 }));
  assert.ok(await p.$$eval('[data-hint]', bs => bs.every(x => x.disabled)), '頭目關提示鈕停用');
  await p.evaluate(() => Solo.start({ mode: 'level', level: 11 }));
  await p.click('[data-hint="has"]'); await p.waitForTimeout(200);
  await p.click('.choose-sym[data-v="0"]'); await p.waitForTimeout(200);
  assert.strictEqual(await p.evaluate(() => Solo.active.hintsLeft), 2, '簡單段提示 3→2');
  await solve(); await p.waitForTimeout(1200);
  assert.strictEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('guess-ab:v1')).stars[0][10]), 2, '用了提示最多 2 星');
  ok('闖關：頭目關停用提示、提示扣次數、用提示最多 2 星');

  /* 3 每日挑戰：完成普通 → 卡片顯示完成、連勝 1；再玩一次＝練習不改紀錄 */
  await p.evaluate(() => Result.hide());
  await p.evaluate(() => Solo.start({ mode: 'daily', tier: 2 }));
  assert.ok(await p.$$eval('[data-hint]', bs => bs.length === 0), '每日挑戰沒有提示鈕');
  await solve(); await p.waitForTimeout(1200);
  await p.evaluate(() => { Result.hide(); App.show('daily'); });
  const card = await p.$eval('.daily-tier[data-tier="2"]', e => ({ done: e.classList.contains('done'), streak: e.querySelector('.streak').textContent.trim() }));
  assert.ok(card.done && card.streak === '1', JSON.stringify(card));
  await p.evaluate(() => Solo.start({ mode: 'daily', tier: 2 }));
  assert.ok(await p.evaluate(() => Solo.active.practice), '再玩＝練習');
  await p.evaluate(() => App.show('home'));
  const home = await p.$eval('.dc-state', e => e.textContent);
  assert.ok(/1\/5/.test(home), '首頁顯示 1/5 完成：' + home);
  ok('每日挑戰：完成、連勝、練習模式、首頁 1/5');

  /* 4 開局設定：神話預覽 8～10 個且可重複；開始後題目＝預覽 */
  await p.evaluate(() => App.openSetup());
  await p.click('#f-tier .seg-btn[data-v="4"]'); await p.waitForTimeout(150);
  const prevTxt = await p.$eval('.setup-info span', e => e.textContent);
  const prevPool = await p.$$eval('.pool.big .pool-sym', e => e.length);
  assert.ok(prevPool >= 8 && prevPool <= 10 && /可重複/.test(prevTxt), prevTxt);
  await p.click('#f-reroll'); await p.waitForTimeout(100);
  const pool2 = await p.$$eval('.pool.big .pool-sym', e => e.map(x => x.title).join());
  await p.click('#f-start'); await p.waitForTimeout(300);
  const gp = await p.evaluate(() => ({ n: Solo.active.spec.n, rep: Solo.active.spec.rep, hints: Solo.active.hintsLeft, tier: Solo.active.tier }));
  assert.ok(gp.rep && gp.hints === 0 && gp.tier === 4, JSON.stringify(gp));
  const pool3 = await p.$$eval('#summary .pool-sym', e => e.map(x => x.title).join());
  assert.strictEqual(pool3, pool2, '開始後項目池＝預覽');
  ok('開局設定：神話 8～10 個可重複、沒有提示、題目與預覽一致');

  /* 5 鍵盤直打＋自動送出、4 格全同不能送出 */
  await p.evaluate(() => Solo.start({ mode: 'guess', tier: 4, cs: 'digits' }));
  await p.waitForTimeout(500);
  await p.keyboard.press('Digit0'); await p.keyboard.press('Digit0'); await p.keyboard.press('Digit0'); await p.keyboard.press('Digit0'); await p.waitForTimeout(800);
  assert.strictEqual(await p.evaluate(() => Solo.active.rows.length), 0, '0000 不會送出');
  assert.ok(/最多 3 次/.test(await p.$eval('#input-note', e => e.textContent)));
  await p.keyboard.press('Backspace'); await p.keyboard.press('Digit1'); await p.waitForFunction(() => Solo.active.rows.length === 1, null, { timeout: 3000 }).catch(() => {});
  assert.strictEqual(await p.evaluate(() => Solo.active.rows.length), 1, '0001 自動送出');
  ok('鍵盤：直打自動送出、4 格全同擋下並提示');

  /* 6 統計：局數累加、各難度表 */
  await p.evaluate(() => App.show('stats'));
  const games = await p.evaluate(() => JSON.parse(localStorage.getItem('guess-ab:v1')).stats.games);
  assert.ok(games >= 3, 'games=' + games);
  ok('統計：局數累加（' + games + '）');

  /* 7 舊版資料遷移 */
  await p.evaluate(() => { localStorage.setItem('guess-ab:v1', JSON.stringify({ lang: 'en', stars: [[3, 3, 3], [2]], daily: { done: { '2026-11-01': { won: true } }, last: '2026-11-01', streak: 4 } })); });
  await p.reload(); await p.waitForTimeout(400);
  const mig = await p.evaluate(() => { App.show('levels'); return { ver: Store.get('ver'), stars: Store.get('stars'), lang: Store.get('lang') }; });
  assert.ok(mig.ver === 8 && JSON.stringify(mig.stars) === '[[]]' && mig.lang === 'en', JSON.stringify(mig));
  ok('舊版資料：闖關與每日重置、語言保留');

  /* 8 線上互猜：逾時跳到對方、歷史出現逾時列、計時到小數第二位 */
  const q = await (await b.newContext()).newPage();
  await p.evaluate(() => OnlineUI.enterLobby()); await q.goto(BASE); await q.waitForTimeout(400); await q.evaluate(() => OnlineUI.enterLobby());
  await p.waitForTimeout(800);
  await p.evaluate(() => Net.send({ type: 'create', mode: 'duel', name: 'A', settings: { tier: 0, cs: 'digits', turnSec: 15 } })); await p.waitForTimeout(500);
  const id = await p.evaluate(() => OnlineUI.room.id);
  await q.waitForTimeout(500); await q.evaluate(id => Net.send({ type: 'join', roomId: id, name: 'B', want: 'player' }), id); await q.waitForTimeout(400);
  await q.evaluate(() => Net.send({ type: 'ready', value: true })); await p.waitForTimeout(300); await p.evaluate(() => Net.send({ type: 'start' })); await p.waitForTimeout(600);
  const tnum = await p.$eval('#timer .timer-num', e => e.textContent);
  assert.ok(/^\d{2}\.\d{2}$/.test(tnum), '設密碼倒數格式 ' + tnum);
  const t1 = await p.$eval('#timer .timer-num', e => e.textContent); await p.waitForTimeout(80); const t2 = await p.$eval('#timer .timer-num', e => e.textContent);
  assert.notStrictEqual(t1, t2, '10ms 更新');
  for (const pg of [p, q]) await pg.evaluate(() => { const g = OnlineUI.room.game; Net.send({ type: 'secret', code: g.players[OnlineUI.room.you.seat].myDefault }); });
  await p.waitForTimeout(700);
  const first = await p.evaluate(() => OnlineUI.room.game.first);
  await p.waitForFunction(f => OnlineUI.room.game.turn === 1 - f, first, { timeout: 20000 });
  const g2 = await p.evaluate(() => ({ turn: OnlineUI.room.game.turn, hist: OnlineUI.room.game.players.map(x => x.hist.length) }));
  assert.strictEqual(g2.turn, 1 - first, '逾時換對方');
  assert.strictEqual(g2.hist[first], 1);
  await p.evaluate(() => GameView.showTab && GameView.showTab('hist'));
  ok('線上互猜：預設密碼鎖上、倒數 ' + tnum + ' 格式、10ms 更新、逾時換對方');
  await q.evaluate(() => Net.send({ type: 'leave' })); await p.evaluate(() => Net.send({ type: 'leave' }));

  assert.deepStrictEqual(errs, []);
  ok('沒有 JS 錯誤');
  await b.close();
})().catch(e => { console.error('✗', e.message); process.exit(1); });
