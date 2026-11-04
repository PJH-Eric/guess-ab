/* ===== scripts/perf-check.cjs — 量首頁、單機、線上競速倒數時的 CPU 與重排次數（開發用，需執行中的伺服器）===== */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const mk = async () => { const c = await b.newContext({ viewport: { width: 1180, height: 820 } }); await c.addInitScript(() => localStorage.setItem('guess-ab:v1', JSON.stringify({ ver: 8, lang: 'zh-Hant', musicOn: false, sfxOn: false }))); const p = await c.newPage(); await p.goto('http://localhost:3100/'); await p.waitForTimeout(300); return p; };
  const A = await mk(), B = await mk();
  const measure = async (p, label) => { const s = await p.context().newCDPSession(p); await s.send('Performance.enable'); const g = async () => Object.fromEntries((await s.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value])); const a = await g(); await p.waitForTimeout(3000); const z = await g(); console.log(label, 'CPU 佔用 %', ((z.TaskDuration - a.TaskDuration) / 3 * 100).toFixed(1), 'script', ((z.ScriptDuration - a.ScriptDuration) * 33).toFixed(1), 'layout', ((z.LayoutDuration - a.LayoutDuration) * 33).toFixed(1), 'style', ((z.RecalcStyleDuration - a.RecalcStyleDuration) * 33).toFixed(1), '版面重排', z.LayoutCount - a.LayoutCount, '樣式重算', z.RecalcStyleCount - a.RecalcStyleCount); };
  await measure(A, '首頁閒置');
  await A.evaluate(() => Solo.start({ mode: 'guess', tier: 4, cs: 'mix' })); await A.waitForTimeout(500);
  await measure(A, '單機遊戲');
  for (const p of [A, B]) { await p.evaluate(() => OnlineUI.enterLobby()); } await A.waitForTimeout(800);
  await A.evaluate(() => Net.send({ type: 'create', mode: 'race', name: 'A', settings: { tier: 4, cs: 'mix', minutes: 5 } })); await A.waitForTimeout(400);
  const id = await A.evaluate(() => OnlineUI.room.id);
  await B.evaluate(id => Net.send({ type: 'join', roomId: id, name: 'B' }), id); await B.waitForTimeout(400);
  for (const p of [A, B]) await p.evaluate(() => Net.send({ type: 'ready', value: true })); await A.waitForTimeout(800);
  await measure(A, '線上競速（倒數中）');
  await A.evaluate(() => { GameView.setTimer(0); }); await measure(A, '關掉上方倒數條');
  await A.evaluate(() => { Kit.clockHtml = () => '<b>-</b>'; }); await A.waitForTimeout(1100); await measure(A, '再拿掉側欄時鐘');
  const muts = await A.evaluate(() => new Promise(res => { const c = {}; const mo = new MutationObserver(l => l.forEach(m => { const t = m.target.nodeType === 3 ? m.target.parentElement : m.target; const k = (t.id || String(t.className).split(' ')[0] || t.tagName) + ':' + m.type + (m.attributeName ? '.' + m.attributeName : ''); c[k] = (c[k] || 0) + 1; })); mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); setTimeout(() => { mo.disconnect(); res(c); }, 1000); }));
  console.log(JSON.stringify(muts));
  const anims = await A.evaluate(() => document.getAnimations().map(a => (a.effect && a.effect.target ? (a.effect.target.id || a.effect.target.className.baseVal || a.effect.target.className) : '?') + ':' + a.animationName + ':' + a.playState).slice(0, 20));
  console.log(JSON.stringify(anims));
  await b.close();
})();
