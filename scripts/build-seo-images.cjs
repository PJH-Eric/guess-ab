/* ===== scripts/build-seo-images.cjs — 由 scripts/seo-art/*.html 產生 SEO 分享圖與 cover（開發用）=====
 * 需要 Windows 內建的 Microsoft Edge（或設定 EDGE_PATH）。輸出：
 *   docs/marketing/seo.png、cover.png            原圖（保留）
 *   public/assets/images/seo.webp、cover.webp    正式使用（SEO 1200×630、cover 1200×675）
 * 用法：node scripts/build-seo-images.cjs */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const edge = process.env.EDGE_PATH || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
if (!edge) { console.error('找不到 Edge／Chrome，請設定 EDGE_PATH'); process.exit(1); }
const url = p => 'file:///' + p.split(path.sep).join('/').split('/').map(encodeURIComponent).join('/').replace('%3A', ':');
const run = args => spawnSync(edge, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 60000 });
fs.mkdirSync(path.join(root, 'docs', 'marketing'), { recursive: true });
fs.mkdirSync(path.join(root, 'public', 'assets', 'images'), { recursive: true });
for (const [name, w, h] of [['seo', 1200, 630], ['cover', 1200, 675]]) {
  const png = path.join(root, 'docs', 'marketing', name + '.png');
  run(['--window-size=' + w + ',' + h, '--screenshot=' + png, url(path.join(root, 'scripts', 'seo-art', name + '.html'))]);
  if (!fs.existsSync(png)) throw new Error(name + ' 截圖失敗');
  // PNG → WebP：在瀏覽器裡用 canvas 轉（資料網址不會汙染 canvas），再從 DOM 取回 base64
  const b64 = fs.readFileSync(png).toString('base64');
  const page = path.join(require('os').tmpdir(), 'seo-webp-' + name + '.html');
  fs.writeFileSync(page, '<!doctype html><body><script>var i=new Image();i.onload=function(){var c=document.createElement("canvas");c.width=i.naturalWidth;c.height=i.naturalHeight;c.getContext("2d").drawImage(i,0,0);var p=document.createElement("pre");p.id="out";p.textContent=c.width+"x"+c.height+"|"+c.toDataURL("image/webp",0.92);document.body.appendChild(p)};i.src="data:image/png;base64,' + b64 + '"</script>');
  const out = run(['--virtual-time-budget=5000', '--dump-dom', url(page)]).stdout || '';
  const m = out.match(/<pre id="out">(\d+)x(\d+)\|data:image\/webp;base64,([A-Za-z0-9+/=]+)<\/pre>/);
  if (!m) throw new Error(name + ' 轉 WebP 失敗');
  if (+m[1] !== w || +m[2] !== h) throw new Error(name + ' 尺寸不符：' + m[1] + 'x' + m[2]);
  const dest = path.join(root, 'public', 'assets', 'images', name + '.webp');
  fs.writeFileSync(dest, Buffer.from(m[3], 'base64'));
  const buf = fs.readFileSync(dest);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') throw new Error(name + ' 不是有效的 WebP');
  console.log('✓ ' + name + '.webp ' + w + '×' + h + '，' + (buf.length / 1024).toFixed(0) + ' KB');
}
fs.rmSync(require('os').tmpdir() + '/seo-webp-seo.html', { force: true }); fs.rmSync(require('os').tmpdir() + '/seo-webp-cover.html', { force: true });
