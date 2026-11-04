/* ===== scripts/contrast-check.cjs — 主要畫面文字對比檢查（WCAG：一般字 4.5、大字 3；開發用，需執行中的伺服器）===== */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1180, height: 820 } });
  await c.addInitScript(() => localStorage.setItem('guess-ab:v1', JSON.stringify({ ver: 8, lang: 'zh-Hant', musicOn: false, sfxOn: false })));
  const p = await c.newPage(); await p.goto('http://localhost:3100/'); await p.waitForTimeout(400);
  const scenes = { home: () => {}, solo: () => App.show('solo'), setup: () => App.openSetup(), levels: () => App.show('levels'), daily: () => App.show('daily'), stats: () => App.show('stats'), help: () => App.show('help'), game: () => Solo.start({ mode: 'level', level: 12 }), lobby: () => OnlineUI.enterLobby() };
  const all = {};
  for (const [k, f] of Object.entries(scenes)) {
    await p.evaluate(f); await p.waitForTimeout(700);
    all[k] = await p.evaluate(() => {
      const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(',').map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
      const lum = c => { const f = x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
      const bgOf = el => { for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.backgroundImage !== 'none' && !/radial/.test(cs.backgroundImage)) return null; const c = parse(cs.backgroundColor); if (c && c.a > .9) return c; } return { r: 255, g: 244, b: 224 }; };
      const out = [];
      document.querySelectorAll('body *').forEach(el => {
        if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
        const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
        const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity < .5) return;
        if (el.closest('[disabled], .disabled, [aria-disabled=true], .modal-layer') ) return;
        const fg = parse(cs.color), bg = bgOf(el); if (!fg || !bg) return;
        const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
        const big = parseFloat(cs.fontSize) >= 18.6 || (parseFloat(cs.fontSize) >= 14 && +cs.fontWeight >= 700);
        if (ratio < (big ? 3 : 4.5)) out.push(ratio.toFixed(2) + ' ' + el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] + ' "' + el.textContent.trim().slice(0, 18) + '" ' + cs.color);
      });
      return Array.from(new Set(out)).slice(0, 12);
    });
  }
  console.log(JSON.stringify(all, null, 1));
  await b.close();
})();
