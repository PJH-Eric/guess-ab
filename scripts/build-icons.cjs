/* ===== scripts/build-icons.cjs — 由 public/favicon.svg 產生整套 PNG／ICO 圖示（開發用）=====
 * 輸出：public/favicon-96.png、apple-touch-icon.png(180)、icons/icon-192.png、icons/icon-512.png、favicon.ico(16/32/48)
 * 需要 Microsoft Edge／Chrome（或設定 EDGE_PATH）。用法：node scripts/build-icons.cjs */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const pub = path.join(__dirname, '..', 'public');
const edge = process.env.EDGE_PATH || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
if (!edge) { console.error('找不到 Edge／Chrome，請設定 EDGE_PATH'); process.exit(1); }
const url = p => 'file:///' + p.split(path.sep).join('/').split('/').map(encodeURIComponent).join('/').replace('%3A', ':');
const svgUrl = url(path.join(pub, 'favicon.svg'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'icons-'));

/* size：輸出邊長；pad：四周留白比例；bg：背景色（null＝透明，一般網頁圖示用；Apple／PWA 圖示要實底） */
function render(size, pad, bg) {
  const inner = Math.round(size * (1 - pad * 2));
  const page = path.join(tmp, 'i' + size + '.html');
  fs.writeFileSync(page, '<!doctype html><body style="margin:0;width:' + size + 'px;height:' + size + 'px;background:' + (bg || 'transparent') + ';display:flex;align-items:center;justify-content:center;overflow:hidden"><img src="' + svgUrl + '" width="' + inner + '" height="' + inner + '">');
  const out = path.join(tmp, 'i' + size + (bg ? 'b' : 't') + '.png');
  spawnSync(edge, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--default-background-color=00000000', '--window-size=' + size + ',' + size, '--screenshot=' + out, url(page)], { timeout: 60000 });
  const b = fs.existsSync(out) ? fs.readFileSync(out) : null;
  if (!b || b.readUInt32BE(16) !== size || b.readUInt32BE(20) !== size) throw new Error(size + 'px 圖示產生失敗或尺寸不符：' + (b ? b.readUInt32BE(16) + 'x' + b.readUInt32BE(20) : '無檔案'));
  return b;
}
const CREAM = '#FFF4E0';
const files = {
  'favicon-96.png': render(96, 0, null),
  'apple-touch-icon.png': render(180, 0.1, CREAM),
  'icons/icon-192.png': render(192, 0.1, CREAM),
  'icons/icon-512.png': render(512, 0.1, CREAM)
};
fs.mkdirSync(path.join(pub, 'icons'), { recursive: true });
for (const [name, buf] of Object.entries(files)) { fs.writeFileSync(path.join(pub, name), buf); console.log('✓ ' + name + ' ' + (buf.length / 1024).toFixed(1) + ' KB'); }

/* favicon.ico：16／32／48 三張，內嵌 PNG */
const sizes = [16, 32, 48];
const pngs = sizes.map(s => render(s, 0, null));
const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const dir = sizes.map((s, i) => {
  const e = Buffer.alloc(16);
  e[0] = s; e[1] = s; e[2] = 0; e[3] = 0; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
  e.writeUInt32LE(pngs[i].length, 8); e.writeUInt32LE(offset, 12); offset += pngs[i].length; return e;
});
fs.writeFileSync(path.join(pub, 'favicon.ico'), Buffer.concat([head, ...dir, ...pngs]));
console.log('✓ favicon.ico 16/32/48');
fs.rmSync(tmp, { recursive: true, force: true });
