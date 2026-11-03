/* ===== art/pack-flag.js — 國旗包（寫實風，20 面）=====
 * 旗面依官方比例，寬約 90（瑞士為正方形），置中；加極淡外框與布料光影。
 */
(function (root) {
  'use strict';
  var P = 'pack-flag';

  function pg(cx, cy, r, rot, n, r2) { // 正多邊形／星形頂點字串（r2 有值時為星形）
    var pts = [], i, a, rr, total = r2 ? n * 2 : n;
    for (i = 0; i < total; i++) {
      a = (rot || 0) * Math.PI / 180 + (i * 2 * Math.PI / total) - Math.PI / 2;
      rr = r2 ? (i % 2 ? r2 : r) : r;
      pts.push((cx + rr * Math.cos(a)).toFixed(2) + ',' + (cy + rr * Math.sin(a)).toFixed(2));
    }
    return pts.join(' ');
  }
  function star(cx, cy, R, rot, fill) { return '<polygon points="' + pg(cx, cy, R, rot, 5, R * 0.382) + '" fill="' + fill + '"/>'; }
  function rect(x, y, w, h, fill) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + fill + '"/>'; }

  /** 包成旗面：key、寬、高、內容（座標 0..w × 0..h） */
  function flag(key, w, h, inner) {
    var x0 = (100 - w) / 2, y0 = (100 - h) / 2, id = P + '-' + key + '-';
    return '<defs>' +
      '<linearGradient id="' + id + 'sh" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#fff" stop-opacity="0.28"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/>' +
      '<stop offset="0.72" stop-color="#000" stop-opacity="0.06"/><stop offset="1" stop-color="#000" stop-opacity="0.2"/></linearGradient>' +
      '<clipPath id="' + id + 'c"><rect x="0" y="0" width="' + w + '" height="' + h + '"/></clipPath></defs>' +
      '<g transform="translate(' + x0 + ',' + y0 + ')">' +
      '<g clip-path="url(#' + id + 'c)">' + inner + '</g>' +
      '<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="url(#' + id + 'sh)"/>' +
      '<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="none" stroke="#1B2A3F" stroke-opacity="0.28" stroke-width="1"/></g>';
  }

  /* 英國旗（可縮放）：w×h，2:1 */
  function jack(w, h, id) {
    var hw = w / 2, hh = h / 2, t = h * 0.2, r = h * 0.12;
    return rect(0, 0, w, h, '#012169') +
      '<path d="M0,0 L' + w + ',' + h + ' M' + w + ',0 L0,' + h + '" stroke="#fff" stroke-width="' + (h * 0.2) + '"/>' +
      '<path d="M0,0 L' + w + ',' + h + ' M' + w + ',0 L0,' + h + '" stroke="#C8102E" stroke-width="' + (h * 0.07) + '"/>' +
      rect(hw - t / 2 * 1.5, 0, t * 1.5, h, '#fff') + rect(0, hh - t / 2 * 1.5, w, t * 1.5, '#fff') +
      rect(hw - r / 2 * 1.5, 0, r * 1.5, h, '#C8102E') + rect(0, hh - r / 2 * 1.5, w, r * 1.5, '#C8102E');
  }

  /* 南韓卦：三條橫線（solid / broken），以 (cx,cy) 為中心、旋轉 rot */
  function trigram(cx, cy, rot, pattern) {
    var s = '', i, y, L = 11, T = 2.2, G = 1.9;
    for (i = 0; i < 3; i++) {
      y = (i - 1) * (T + G) - T / 2;
      if (pattern[i] === '1') s += rect(-L / 2, y, L, T, '#000');
      else s += rect(-L / 2, y, L * 0.42, T, '#000') + rect(L / 2 - L * 0.42, y, L * 0.42, T, '#000');
    }
    return '<g transform="translate(' + cx + ',' + cy + ') rotate(' + rot + ')">' + s + '</g>';
  }

  var items = [];
  function add(key, n, tone, tag, color, svg) { items.push({ key: key, n: n, tone: tone, tag: tag, color: color, svg: svg }); }

  /* 1 台灣 3:2 */
  (function () {
    var rays = pg(22.5, 15, 11.5, 0, 12, 6.5);
    add('taiwan', ['台灣', '台湾', 'Taiwan'], 'cool', 'tw', '#000095', flag('taiwan', 90, 60,
      rect(0, 0, 90, 60, '#FE0000') + rect(0, 0, 45, 30, '#000095') +
      '<polygon points="' + rays + '" fill="#fff"/>' +
      '<circle cx="22.5" cy="15" r="6.6" fill="#000095"/><circle cx="22.5" cy="15" r="5.4" fill="#fff"/>'));
  })();

  /* 2 日本 3:2 */
  add('japan', ['日本', '日本', 'Japan'], 'warm', 'jp', '#BC002D', flag('japan', 90, 60,
    rect(0, 0, 90, 60, '#fff') + '<circle cx="45" cy="30" r="18" fill="#BC002D"/>'));

  /* 3 美國 19:10 */
  (function () {
    var h = 47.4, sh = h / 13, s = rect(0, 0, 90, h, '#fff'), i, j;
    for (i = 0; i < 13; i += 2) s += rect(0, i * sh, 90, sh + 0.05, '#B22234');
    s += rect(0, 0, 36, sh * 7, '#3C3B6E');
    for (i = 0; i < 4; i++) for (j = 0; j < 5; j++) s += star(4.2 + j * 6.9 + (i % 2 ? 0 : 0), 3.7 + i * 6.4, 2.1, 0, '#fff');
    add('usa', ['美國', '美国', 'United States'], 'cool', 'us', '#3C3B6E', flag('usa', 90, h, s));
  })();

  /* 4 英國 2:1 */
  add('uk', ['英國', '英国', 'United Kingdom'], 'warm', 'gb', '#C8102E', flag('uk', 90, 45, jack(90, 45)));

  /* 5 法國 3:2 */
  add('france', ['法國', '法国', 'France'], 'cool', 'fr', '#0055A4', flag('france', 90, 60,
    rect(0, 0, 30, 60, '#0055A4') + rect(30, 0, 30, 60, '#fff') + rect(60, 0, 30, 60, '#EF4135')));

  /* 6 德國 5:3 */
  add('germany', ['德國', '德国', 'Germany'], 'warm', 'de', '#FFCE00', flag('germany', 90, 54,
    rect(0, 0, 90, 18, '#000') + rect(0, 18, 90, 18, '#DD0000') + rect(0, 36, 90, 18, '#FFCE00')));

  /* 7 加拿大 2:1 */
  add('canada', ['加拿大', '加拿大', 'Canada'], 'warm', 'ca', '#FFFFFF', flag('canada', 90, 45,
    rect(0, 0, 90, 45, '#D80621') + rect(22.5, 0, 45, 45, '#fff') +
    '<g transform="translate(45,23) scale(1.12)"><polygon fill="#D80621" points="0,-11 2.2,-6.4 4.8,-7.6 4,-2 8.6,-4.6 7.4,-0.9 9.8,0.6 4.8,3.6 5.4,5.6 0.9,4.8 0.9,10.6 -0.9,10.6 -0.9,4.8 -5.4,5.6 -4.8,3.6 -9.8,0.6 -7.4,-0.9 -8.6,-4.6 -4,-2 -4.8,-7.6 -2.2,-6.4"/></g>'));

  /* 8 巴西 10:7 */
  add('brazil', ['巴西', '巴西', 'Brazil'], 'cool', 'br', '#009C3B', flag('brazil', 90, 63,
    rect(0, 0, 90, 63, '#009C3B') +
    '<polygon points="45,6 83,31.5 45,57 7,31.5" fill="#FFDF00"/>' +
    '<circle cx="45" cy="31.5" r="15.5" fill="#002776"/>' +
    '<path d="M29.8,34 Q45,26 60.2,37.2" fill="none" stroke="#fff" stroke-width="2.6"/>' +
    '<circle cx="39" cy="38" r="0.8" fill="#fff"/><circle cx="43" cy="40.5" r="0.8" fill="#fff"/><circle cx="50" cy="39" r="0.8" fill="#fff"/><circle cx="54" cy="36.5" r="0.8" fill="#fff"/>' +
    '<circle cx="46" cy="23" r="0.8" fill="#fff"/><circle cx="37" cy="29" r="0.8" fill="#fff"/><circle cx="53" cy="27" r="0.8" fill="#fff"/><circle cx="58" cy="31" r="0.8" fill="#fff"/>'));

  /* 9 南韓 3:2 */
  add('korea', ['南韓', '韩国', 'South Korea'], 'warm', 'kr', '#CD2E3A', flag('korea', 90, 60,
    rect(0, 0, 90, 60, '#fff') +
    '<g transform="rotate(-33.7 45 30)">' +
    '<path d="M30,30 A15,15 0 0 1 60,30 A7.5,7.5 0 0 1 45,30 A7.5,7.5 0 0 0 30,30Z" fill="#CD2E3A"/>' +
    '<path d="M60,30 A15,15 0 0 1 30,30 A7.5,7.5 0 0 0 45,30 A7.5,7.5 0 0 1 60,30Z" fill="#0047A0"/></g>' +
    trigram(23.4, 15.6, -56.3, '111') + trigram(66.6, 44.4, 123.7, '000') +
    trigram(66.6, 15.6, 56.3, '010') + trigram(23.4, 44.4, -123.7, '101')));

  /* 10 墨西哥 7:4 */
  add('mexico', ['墨西哥', '墨西哥', 'Mexico'], 'warm', 'mx', '#CE1126', flag('mexico', 90, 51.4,
    rect(0, 0, 30, 51.4, '#006847') + rect(30, 0, 30, 51.4, '#fff') + rect(60, 0, 30, 51.4, '#CE1126') +
    '<ellipse cx="45" cy="28" rx="9" ry="5.2" fill="#6B8E23" opacity="0.9"/>' +
    '<path d="M36.5,27 Q40,37 45,36 Q50,37 53.5,27" fill="none" stroke="#2E7D32" stroke-width="2"/>' +
    '<ellipse cx="45" cy="24" rx="5" ry="4.2" fill="#8B5A2B"/><circle cx="41.5" cy="19.5" r="2.4" fill="#8B5A2B"/>' +
    '<path d="M39,23 Q33,20 35,15 Q40,18 42,22Z" fill="#A9743F"/><path d="M51,23 Q57,20 55,15 Q50,18 48,22Z" fill="#A9743F"/>' +
    '<path d="M39.5,19 L37,20.4 L40,21Z" fill="#E0A030"/>' +
    '<ellipse cx="45" cy="28.5" rx="3.5" ry="1.4" fill="#C9A227"/>'));

  /* 11 印度 3:2 */
  (function () {
    var s = rect(0, 0, 90, 20, '#FF9933') + rect(0, 20, 90, 20, '#fff') + rect(0, 40, 90, 20, '#138808'), i, a;
    s += '<circle cx="45" cy="30" r="8" fill="none" stroke="#000080" stroke-width="1.1"/><circle cx="45" cy="30" r="1.4" fill="#000080"/>';
    for (i = 0; i < 24; i++) {
      a = i * Math.PI / 12;
      s += '<line x1="45" y1="30" x2="' + (45 + 8 * Math.cos(a)).toFixed(2) + '" y2="' + (30 + 8 * Math.sin(a)).toFixed(2) + '" stroke="#000080" stroke-width="0.6"/>';
    }
    add('india', ['印度', '印度', 'India'], 'warm', 'in', '#FF9933', flag('india', 90, 60, s));
  })();

  /* 12 澳洲 2:1 */
  add('australia', ['澳洲', '澳大利亚', 'Australia'], 'cool', 'au', '#012169', flag('australia', 90, 45,
    rect(0, 0, 90, 45, '#012169') + '<g transform="scale(0.5)">' + jack(90, 45) + '</g>' +
    '<polygon points="' + pg(22.5, 34, 7, 0, 7, 3.4) + '" fill="#fff"/>' +
    star(67, 7, 3.6, 0, '#fff') + star(57.5, 19, 3.6, 0, '#fff') + star(76.5, 21, 3.6, 0, '#fff') + star(67, 37, 3.6, 0, '#fff') + star(72, 24, 1.9, 0, '#fff')));

  /* 13 瑞典 8:5 */
  add('sweden', ['瑞典', '瑞典', 'Sweden'], 'cool', 'se', '#006AA7', flag('sweden', 90, 56.25,
    rect(0, 0, 90, 56.25, '#006AA7') + rect(28.1, 0, 11.3, 56.25, '#FECC00') + rect(0, 22.5, 90, 11.25, '#FECC00')));

  /* 14 希臘 3:2 */
  (function () {
    var s = rect(0, 0, 90, 60, '#0D5EAF'), i, u = 60 / 9;
    for (i = 1; i < 9; i += 2) s += rect(0, i * u, 90, u, '#fff');
    s += rect(0, 0, u * 5, u * 5, '#0D5EAF') + rect(u * 2, 0, u, u * 5, '#fff') + rect(0, u * 2, u * 5, u, '#fff');
    add('greece', ['希臘', '希腊', 'Greece'], 'cool', 'gr', '#0D5EAF', flag('greece', 90, 60, s));
  })();

  /* 15 土耳其 3:2 */
  add('turkey', ['土耳其', '土耳其', 'Turkey'], 'warm', 'tr', '#E30A17', flag('turkey', 90, 60,
    rect(0, 0, 90, 60, '#E30A17') + '<circle cx="34" cy="30" r="15" fill="#fff"/><circle cx="38.8" cy="30" r="12" fill="#E30A17"/>' +
    star(50, 30, 6.5, 90, '#fff')));

  /* 16 南非 3:2 */
  add('southafrica', ['南非', '南非', 'South Africa'], 'cool', 'za', '#007749', flag('southafrica', 90, 60,
    rect(0, 0, 90, 30, '#E03C31') + rect(0, 30, 90, 30, '#001489') +
    '<path d="M-4,-3 L34,30 L-4,63 M34,30 L95,30" fill="none" stroke="#fff" stroke-width="16" stroke-linejoin="miter"/>' +
    '<path d="M-4,-3 L34,30 L-4,63 M34,30 L95,30" fill="none" stroke="#007749" stroke-width="10" stroke-linejoin="miter"/>' +
    '<polygon points="0,7 0,53 26,30" fill="#FFB612"/><polygon points="0,13 0,47 18,30" fill="#000"/>'));

  /* 17 阿根廷 14:9 */
  (function () {
    var s = rect(0, 0, 90, 58, '#74ACDF') + rect(0, 19.3, 90, 19.4, '#fff'), i, a, rays = '';
    rays = '<polygon points="' + pg(45, 29, 9.5, 0, 16, 6.2) + '" fill="#F6B40E"/>';
    s += rays + '<circle cx="45" cy="29" r="5.3" fill="#F6B40E" stroke="#C98A00" stroke-width="0.6"/>' +
      '<circle cx="43.2" cy="28" r="0.7" fill="#8A5A00"/><circle cx="46.8" cy="28" r="0.7" fill="#8A5A00"/>' +
      '<path d="M43,31 Q45,32.4 47,31" fill="none" stroke="#8A5A00" stroke-width="0.6"/>';
    add('argentina', ['阿根廷', '阿根廷', 'Argentina'], 'cool', 'ar', '#74ACDF', flag('argentina', 90, 58, s));
  })();

  /* 18 中國 3:2 */
  (function () {
    var s = rect(0, 0, 90, 60, '#DE2910') + star(15, 15, 9, 0, '#FFDE00'), c = [[30, 6], [36, 13], [36, 22], [30, 29]], i, rot;
    for (i = 0; i < 4; i++) {
      rot = Math.atan2(c[i][0] - 15, -(c[i][1] - 15)) * 180 / Math.PI + 180;
      s += star(c[i][0], c[i][1], 3, rot, '#FFDE00');
    }
    add('china', ['中國', '中国', 'China'], 'warm', 'cn', '#DE2910', flag('china', 90, 60, s));
  })();

  /* 19 西班牙 3:2 */
  add('spain', ['西班牙', '西班牙', 'Spain'], 'warm', 'es', '#F1BF00', flag('spain', 90, 60,
    rect(0, 0, 90, 15, '#AA151B') + rect(0, 15, 90, 30, '#F1BF00') + rect(0, 45, 90, 15, '#AA151B') +
    rect(20, 22, 3, 17, '#E7E1D2') + rect(37, 22, 3, 17, '#E7E1D2') +
    rect(19.2, 21, 4.6, 2, '#AA151B') + rect(36.2, 21, 4.6, 2, '#AA151B') +
    '<path d="M25,24 H35 V32 Q35,38.5 30,40 Q25,38.5 25,32Z" fill="#AA151B" stroke="#7B5A00" stroke-width="0.8"/>' +
    '<rect x="25" y="24" width="5" height="7" fill="#F1F1F1"/><rect x="30" y="31" width="5" height="7" fill="#F1F1F1" opacity="0.9"/>' +
    '<path d="M25.5,24 L25.5,19.5 L27.5,21.5 L30,18 L32.5,21.5 L34.5,19.5 L34.5,24Z" fill="#D9A400" stroke="#7B5A00" stroke-width="0.7"/>'));

  /* 20 瑞士（正方形） */
  add('switzerland', ['瑞士', '瑞士', 'Switzerland'], 'warm', 'ch', '#DA291C', flag('switzerland', 80, 80,
    rect(0, 0, 80, 80, '#DA291C') + rect(32.5, 15, 15, 50, '#fff') + rect(15, 32.5, 50, 15, '#fff')));

  root.GuessArt.add(P, { style: 'real', items: items });
})(typeof self !== 'undefined' ? self : this);
