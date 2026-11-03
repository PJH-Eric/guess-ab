/* 產生符號對照表截圖：node scripts/art-sheet.cjs pack-food [pack-fruit ...] → tmp/art-<id>.png */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const ids = process.argv.slice(2);
if (!ids.length) { console.error('用法：node scripts/art-sheet.cjs <setId> ...'); process.exit(1); }
fs.mkdirSync(path.join(root, 'tmp'), { recursive: true });
(async () => {
  const browser = await chromium.launch();
  for (const id of ids) {
    const file = path.join(root, 'public/js/art', id + '.js');
    const code = fs.readFileSync(path.join(root, 'public/js/art/registry.js'), 'utf8') + '\n' + fs.readFileSync(file, 'utf8');
    const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:12px;background:#FFF4E0;font:12px sans-serif;color:#26405E}
      .g{display:flex;flex-wrap:wrap;gap:8px}.c{width:92px;text-align:center}.t{background:#FFFBF3;border:2px solid #E8D9BF;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:6px;padding:4px}
      .t svg.big{width:64px;height:64px}.t svg.small{width:36px;height:36px}h1{font-size:16px}</style><body><h1 id="h"></h1><div class="g" id="g"></div>
      <script>${code}
      const s=GuessArt.get(${JSON.stringify(id)});document.getElementById('h').textContent=${JSON.stringify(id)}+' ('+s.items.length+' 個, '+s.style+')';
      document.getElementById('g').innerHTML=s.items.map((it,i)=>'<div class="c"><div class="t">'+GuessArt.svg(${JSON.stringify(id)},i,'big')+GuessArt.svg(${JSON.stringify(id)},i,'small')+'</div>'+(i+1)+'. '+it.n[0]+'<br>'+it.tag+' '+it.color+'</div>').join('');
      </script>`;
    const page = await browser.newPage({ viewport: { width: 1020, height: 400 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.setContent(html);
    await page.screenshot({ path: path.join(root, 'tmp', 'art-' + id + '.png'), fullPage: true });
    console.log(id, errs.length ? 'ERRORS: ' + errs.join('; ') : 'ok', '→ tmp/art-' + id + '.png');
    await page.close();
  }
  await browser.close();
})();
