/* ===== scripts/rwd-audit.cjs — 全畫面 RWD 巡檢（開發用，需要 playwright 與執行中的伺服器）=====
 * 用法：node scripts/rwd-audit.cjs [round]   → tmp/audit/<round>/*.png 與 report.json
 * 每個畫面 × 裝置 × 語言檢查：JS 錯誤、水平溢出、按鈕文字被截斷、原生控制項外露、主要操作在畫面內、彈窗塞得下。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const round = process.argv[2] || 'r';
const out = path.join(__dirname, '..', 'tmp', 'audit', round);
fs.mkdirSync(out, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:3100/';
const VIEWS = [['phone', 390, 844], ['phoneS', 360, 640], ['phoneL', 844, 390], ['tabP', 820, 1180], ['tabL', 1180, 820], ['desk', 1440, 900]];
const LANGS = (process.env.LANGS || 'zh-Hant,en').split(',');

/* 線上場景要第二位玩家：另開一個瀏覽器分頁，用房號加入並按準備 */
let BROWSER = null;
async function second(p, extra) {
  const id = await p.evaluate(() => OnlineUI.room && OnlineUI.room.id);
  const ctx = await BROWSER.newContext({ viewport: { width: 800, height: 600 } });
  const q = await ctx.newPage();
  await q.goto(BASE); await q.waitForTimeout(300);
  await q.evaluate(() => OnlineUI.enterLobby()); await q.waitForTimeout(700);
  await q.evaluate(id => Net.send({ type: 'join', roomId: id, name: '第二位玩家', want: 'player' }), id); await q.waitForTimeout(400);
  await q.evaluate(() => Net.send({ type: 'ready', value: true })); await q.waitForTimeout(200);
  if (extra) await extra(q);
  return ctx;
}
const SCENES = {
  home: async p => {},
  solo: async p => p.evaluate(() => App.show('solo')),
  setup: async p => p.evaluate(() => App.openSetup()),
  levels: async p => p.evaluate(() => App.show('levels')),
  daily: async p => p.evaluate(() => App.show('daily')),
  stats: async p => p.evaluate(() => App.show('stats')),
  help: async p => p.evaluate(() => App.show('help')),
  game: async p => { await p.evaluate(() => Solo.start({ mode: 'guess', tier: 1, cs: 'pack-tw' })); await p.evaluate(() => { [0, 1, 2, 3].forEach(v => GameView._press(v)); }); await p.waitForTimeout(400); await p.evaluate(() => { GameView._press(4); GameView._press(1); }); },
  gameMyth: async p => { await p.evaluate(() => Solo.start({ mode: 'guess', tier: 4, cs: 'mix' })); await p.evaluate(() => [0, 0, 0, 0].forEach(v => GameView._press(v))); },
  gameL50: async p => { await p.evaluate(() => Solo.start({ mode: 'level', level: 50 })); },
  gameHist: async p => { await SCENES.game(p); await p.evaluate(() => GameView.showTab('hist')); },
  result: async p => { await p.evaluate(() => Solo.start({ mode: 'level', level: 1 })); await p.evaluate(() => Solo.active.secret.forEach(v => GameView._press(v))); await p.waitForTimeout(1200); },
  dailyGame: async p => { await p.evaluate(() => Solo.start({ mode: 'daily', tier: 3 })); },
  settings: async p => { await p.click('#btn-settings'); },
  pause: async p => { await SCENES.game(p); await p.evaluate(() => Solo.pause()); },
  hint: async p => { await SCENES.game(p); await p.evaluate(() => { const b = document.querySelector('[data-hint="has"]'); b && b.click(); }); },
  side: async p => { await SCENES.game(p); await p.evaluate(() => App.openSide()); },
  lobby: async p => { await p.evaluate(() => OnlineUI.enterLobby()); await p.waitForTimeout(900); },
  room: async p => { await SCENES.lobby(p); await p.evaluate(() => Net.send({ type: 'create', mode: 'race', name: '測試玩家名字很長很長', settings: { tier: 3, cs: 'pack-landmark', minutes: 3 } })); await p.waitForTimeout(700); },
  roomDuel: async p => { await SCENES.lobby(p); await p.evaluate(() => Net.send({ type: 'create', mode: 'duel', name: '測試玩家', settings: { tier: 2, cs: 'random', turnSec: 15 } })); await p.waitForTimeout(700); },
  online: async p => { await SCENES.room(p); p._c2 = await second(p); await p.evaluate(() => Net.send({ type: 'ready', value: true })); await p.waitForTimeout(900); },
  duelSetup: async p => { await SCENES.roomDuel(p); p._c2 = await second(p); await p.evaluate(() => Net.send({ type: 'ready', value: true })); await p.waitForTimeout(900); },
  duelPlay: async p => { await SCENES.duelSetup(p); await p.evaluate(() => { const g = OnlineUI.room.game; const me = g.players[OnlineUI.room.you.seat]; Net.send({ type: 'secret', code: me.myDefault }); }); const q = p._c2.pages()[0]; await q.evaluate(() => { const g = OnlineUI.room.game; Net.send({ type: 'secret', code: g.players[OnlineUI.room.you.seat].myDefault }); }); await p.waitForTimeout(900); }
};
const ONLY = process.env.SCENES ? process.env.SCENES.split(',') : Object.keys(SCENES);

(async () => {
  const browser = await chromium.launch(); BROWSER = browser;
  const report = [];
  for (const lang of LANGS) for (const [vn, w, h] of VIEWS) for (const sn of ONLY) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: vn !== 'desk', isMobile: vn.startsWith('phone') });
    await ctx.addInitScript(l => { try { localStorage.setItem('guess-ab:v1', JSON.stringify({ lang: l, musicOn: false, sfxOn: false })); } catch (e) {} }, lang);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !/WebSocket|ERR_CONNECTION/.test(m.text())) errs.push(m.text()); });
    await p.goto(BASE); await p.waitForTimeout(350);
    try { await SCENES[sn](p); } catch (e) { errs.push('scene: ' + e.message); }
    await p.waitForTimeout(450);
    const issues = await p.evaluate(sn => {
      const out = [];
      const vw = innerWidth, vh = innerHeight;
      const vis = el => { const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false; for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } return true; };
      const inDrawer = el => !!el.closest('.side') && document.getElementById('app').getAttribute('data-side') !== 'open' && innerWidth < 900 && !el.closest('.room-side');
      document.querySelectorAll('body *').forEach(el => {
        if (!vis(el) || inDrawer(el) || el.closest('#sb-layer')) return;
        const r = el.getBoundingClientRect();
        if (r.right > vw + 1 || r.left < -1) { if (!el.closest('.scroll, .chat-quick, .tabs, .table-wrap')) out.push('overflow-x: ' + el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] + ' [' + Math.round(r.left) + ',' + Math.round(r.right) + ']'); }
      });
      document.querySelectorAll('button, .btn, .seg-btn, .tab, .chip, .menu-opt').forEach(el => {
        if (!vis(el) || inDrawer(el)) return;
        if (el.scrollWidth > el.clientWidth + 2 && !el.closest('.tabs, .chat-quick')) out.push('clipped: ' + (el.textContent || '').trim().slice(0, 30));
      });
      document.querySelectorAll('select, textarea, input[type=checkbox], input[type=radio], input[type=range]').forEach(el => { if (vis(el)) out.push('native: ' + el.tagName); });
      const modal = document.querySelector('.modal');
      if (modal) { const r = modal.getBoundingClientRect(); if (r.top < -1 || r.bottom > vh + 1 || r.left < -1 || r.right > vw + 1) out.push('modal-out'); }
      if (/^game|duelPlay|pause|hint|online|dailyGame/.test(sn) && document.getElementById('app').getAttribute('data-gt') === 'play') {
        const k = document.querySelector('#keys .key');
        const sub = document.getElementById('k-submit');
        const wl = document.querySelector('#slots .wheel');
        if (!k || !vis(k) || k.getBoundingClientRect().height < 30 || k.getBoundingClientRect().bottom > vh) out.push('keys-hidden-or-small');
        if (!vis(sub) || sub.getBoundingClientRect().bottom > vh + 1) out.push('submit-offscreen');
        if (!wl || wl.getBoundingClientRect().height < 50) out.push('wheel-small');
      }
      const top = document.getElementById('topbar').getBoundingClientRect();
      ['btn-settings', 'btn-lang'].forEach(id => { const b = document.getElementById(id); if (!vis(b) || b.getBoundingClientRect().right > vw) out.push('top-' + id); });
      return Array.from(new Set(out)).slice(0, 12);
    }, sn);
    const file = lang + '-' + vn + '-' + sn + '.png';
    await p.screenshot({ path: path.join(out, file) });
    const all = errs.map(e => 'js: ' + e).concat(issues);
    report.push({ lang, view: vn, scene: sn, file, issues: all });
    if (all.length) console.log('✗ ' + lang + ' ' + vn + ' ' + sn + '：' + all.join(' ｜ '));
    if (p._c2) await p._c2.close();
    await ctx.close();
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
  const bad = report.filter(r => r.issues.length).length;
  console.log('巡檢 ' + report.length + ' 個畫面，有問題 ' + bad + ' 個 → ' + path.relative(process.cwd(), out));
  await browser.close();
})();
