/* ===== art/pack-play.js — 「樂」主題包（可愛手繪，20 個）=====
 * 吉他、鋼琴、鼓、麥克風、足球、籃球、遊戲機、骰子、風箏、相機、氣球、拼圖、喇叭、網球拍、保齡球、撲克牌、溜冰鞋、釣竿、帳篷、摩天輪
 */
(function (root) {
  'use strict';
  var P = 'pack-play', S = '#26405E';
  function st(w) { return 'stroke="' + S + '" stroke-width="' + (w || 3) + '" stroke-linejoin="round" stroke-linecap="round"'; }
  function gd(k, a, b) {
    return '<defs><linearGradient id="' + P + '-' + k + '-g" gradientUnits="userSpaceOnUse" x1="0" y1="10" x2="0" y2="90">' +
      '<stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient></defs>';
  }
  function f(k) { return 'fill="url(#' + P + '-' + k + '-g)"'; }
  function hl(cx, cy, rx, ry, rot) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="#fff" opacity="0.75"' +
      (rot ? ' transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')"' : '') + '/>';
  }
  function pg(cx, cy, r, rot, n) {
    var pts = [], i, a;
    for (i = 0; i < n; i++) { a = (rot * Math.PI / 180) + i * 2 * Math.PI / n - Math.PI / 2; pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1)); }
    return pts.join(' ');
  }
  var items = [];
  function add(key, n, tone, tag, color, svg) { items.push({ key: key, n: n, tone: tone, tag: tag, color: color, svg: svg }); }

  /* 吉他 */
  add('guitar', ['吉他', '吉他', 'Guitar'], 'warm', 'diagonal', '#C46A2B', gd('guitar', '#E8A15B', '#B5651D') +
    '<g transform="rotate(38 50 50)">' +
    '<rect x="45" y="14" width="10" height="42" rx="3" fill="#7A4A22" ' + st(3) + '/>' +
    '<ellipse cx="50" cy="50" rx="15" ry="13" ' + f('guitar') + ' ' + st(3) + '/>' +
    '<ellipse cx="50" cy="72" rx="20" ry="19" ' + f('guitar') + ' ' + st(3) + '/>' +
    '<ellipse cx="50" cy="50" rx="13.5" ry="11.5" ' + f('guitar') + '/><ellipse cx="50" cy="72" rx="18.5" ry="17.5" ' + f('guitar') + '/>' +
    '<rect x="45" y="46" width="10" height="10" ' + f('guitar') + '/>' +
    '<circle cx="50" cy="66" r="6.5" fill="' + S + '"/>' +
    '<rect x="41" y="80" width="18" height="5" rx="2.5" fill="#5B3A22" ' + st(2) + '/>' +
    '<line x1="48" y1="20" x2="48" y2="80" stroke="#fff" stroke-width="1" opacity="0.8"/><line x1="52" y1="20" x2="52" y2="80" stroke="#fff" stroke-width="1" opacity="0.8"/>' +
    '<rect x="42" y="3" width="16" height="16" rx="5" fill="#5B3A22" ' + st(3) + '/>' +
    '<circle cx="46" cy="8" r="1.8" fill="#FFD166"/><circle cx="54" cy="8" r="1.8" fill="#FFD166"/><circle cx="46" cy="14" r="1.8" fill="#FFD166"/><circle cx="54" cy="14" r="1.8" fill="#FFD166"/>' +
    hl(41, 76, 3.5, 7, 15) + '</g>');

  /* 鋼琴 */
  (function () {
    var s = gd('piano', '#6A70A8', '#2C3050') +
      '<rect x="8" y="16" width="84" height="34" rx="7" ' + f('piano') + ' ' + st(3) + '/>' +
      '<rect x="14" y="22" width="72" height="12" rx="3" fill="#fff" opacity="0.18"/>' +
      '<rect x="8" y="46" width="84" height="38" rx="6" fill="#fff" ' + st(3) + '/>', i, x;
    for (i = 1; i < 7; i++) { x = 8 + 84 * i / 7; s += '<line x1="' + x.toFixed(1) + '" y1="48" x2="' + x.toFixed(1) + '" y2="84" ' + st(2) + '/>'; }
    [1, 2, 4, 5, 6].forEach(function (k) { x = 8 + 84 * k / 7; s += '<rect x="' + (x - 4.5).toFixed(1) + '" y="46" width="9" height="22" rx="2.5" fill="' + S + '"/>'; });
    s += '<rect x="14" y="88" width="10" height="4" rx="2" fill="' + S + '"/><rect x="76" y="88" width="10" height="4" rx="2" fill="' + S + '"/>';
    add('piano', ['鋼琴', '钢琴', 'Piano'], 'cool', 'keys', '#3A3F63', s);
  })();

  /* 鼓 */
  add('drum', ['鼓', '鼓', 'Drum'], 'cool', 'cylinder', '#3B82C4', gd('drum', '#6FB1E6', '#2F6DAE') +
    '<path d="M16,40 V70 Q16,86 50,86 Q84,86 84,70 V40Z" ' + f('drum') + ' ' + st(3) + '/>' +
    '<ellipse cx="50" cy="40" rx="34" ry="12" fill="#fff" ' + st(3) + '/>' +
    '<polyline points="19,53 34,72 50,54 66,72 81,53" fill="none" stroke="#fff" stroke-width="2.5" stroke-linejoin="round" opacity="0.9"/>' +
    '<line x1="22" y1="12" x2="56" y2="38" stroke="' + S + '" stroke-width="9" stroke-linecap="round"/><line x1="22" y1="12" x2="56" y2="38" stroke="#F3D9A4" stroke-width="4" stroke-linecap="round"/>' +
    '<line x1="78" y1="12" x2="44" y2="38" stroke="' + S + '" stroke-width="9" stroke-linecap="round"/><line x1="78" y1="12" x2="44" y2="38" stroke="#F3D9A4" stroke-width="4" stroke-linecap="round"/>' +
    hl(26, 62, 3, 8, 0));

  /* 麥克風 */
  add('mic', ['麥克風', '麦克风', 'Microphone'], 'cool', 'lollipop', '#9AA7B8', gd('mic', '#D5DCE6', '#8794A8') +
    '<path d="M38,52 L62,52 L57,90 Q50,95 43,90Z" fill="#4A5B7A" ' + st(3) + '/>' +
    '<circle cx="50" cy="30" r="21" ' + f('mic') + ' ' + st(3) + '/>' +
    '<ellipse cx="50" cy="30" rx="9" ry="21" fill="none" stroke="' + S + '" stroke-width="1.6" opacity="0.5"/><ellipse cx="50" cy="30" rx="21" ry="9" fill="none" stroke="' + S + '" stroke-width="1.6" opacity="0.5"/>' +
    '<rect x="34" y="46" width="32" height="9" rx="4" fill="#E5484D" ' + st(3) + '/>' +
    hl(41, 22, 4.5, 7, 35));

  /* 足球 */
  (function () {
    var s = gd('soccer', '#FFFFFF', '#DDE5EF') + '<clipPath id="' + P + '-soccer-c"><circle cx="50" cy="50" r="40"/></clipPath>' +
      '<circle cx="50" cy="50" r="40" ' + f('soccer') + '/><g clip-path="url(#' + P + '-soccer-c)">' +
      '<polygon points="' + pg(50, 50, 13, 0, 5) + '" fill="' + S + '"/>', i, a;
    for (i = 0; i < 5; i++) {
      a = (i * 72 - 90) * Math.PI / 180;
      s += '<line x1="' + (50 + 13 * Math.cos(a)).toFixed(1) + '" y1="' + (50 + 13 * Math.sin(a)).toFixed(1) + '" x2="' + (50 + 30 * Math.cos(a)).toFixed(1) + '" y2="' + (50 + 30 * Math.sin(a)).toFixed(1) + '" ' + st(2.5) + '/>' +
        '<polygon points="' + pg(50 + 43 * Math.cos(a), 50 + 43 * Math.sin(a), 11, i * 72 + 180, 5) + '" fill="' + S + '"/>';
    }
    s += '</g><circle cx="50" cy="50" r="40" fill="none" ' + st(3) + '/>' + hl(34, 30, 6, 3.5, -35);
    add('soccer', ['足球', '足球', 'Soccer ball'], 'cool', 'ball-pent', '#FFFFFF', s);
  })();

  /* 籃球 */
  add('basketball', ['籃球', '篮球', 'Basketball'], 'warm', 'ball-lines', '#F28C28', gd('basketball', '#FFB35C', '#E5731A') +
    '<circle cx="50" cy="50" r="40" ' + f('basketball') + '/>' +
    '<line x1="50" y1="10" x2="50" y2="90" ' + st(2.8) + '/><line x1="10" y1="50" x2="90" y2="50" ' + st(2.8) + '/>' +
    '<path d="M21.7,21.7 Q42,50 21.7,78.3" fill="none" ' + st(2.8) + '/><path d="M78.3,21.7 Q58,50 78.3,78.3" fill="none" ' + st(2.8) + '/>' +
    '<circle cx="50" cy="50" r="40" fill="none" ' + st(3) + '/>' + hl(33, 30, 6, 3.5, -35));

  /* 遊戲機（手把） */
  add('console', ['遊戲機', '游戏机', 'Game controller'], 'cool', 'gamepad', '#5D5FD1', gd('console', '#8C8EF0', '#4547B5') +
    '<path d="M22,30 Q30,26 40,31 L60,31 Q70,26 78,30 Q94,34 94,58 Q93,76 82,76 Q74,76 69,66 L31,66 Q26,76 18,76 Q7,76 6,58 Q6,34 22,30Z" ' + f('console') + ' ' + st(3) + '/>' +
    '<path d="M27,39 H33 V46 H40 V52 H33 V59 H27 V52 H20 V46 H27Z" fill="#fff" ' + st(2) + '/>' +
    '<circle cx="71" cy="53" r="5.5" fill="#FFD166" ' + st(2) + '/><circle cx="82" cy="44" r="5.5" fill="#FF6B8B" ' + st(2) + '/>' +
    '<rect x="44" y="42" width="5" height="5" rx="2" fill="#fff" opacity="0.8"/><rect x="52" y="42" width="5" height="5" rx="2" fill="#fff" opacity="0.8"/>' +
    hl(26, 36, 8, 2.5, -8));

  /* 骰子 */
  add('dice', ['骰子', '骰子', 'Dice'], 'warm', 'cube', '#E53935', gd('dice', '#FF7A72', '#D12C28') +
    '<g transform="rotate(-12 50 50)"><rect x="14" y="14" width="72" height="72" rx="16" ' + f('dice') + ' ' + st(3) + '/>' +
    '<circle cx="33" cy="33" r="6.5" fill="#fff"/><circle cx="67" cy="33" r="6.5" fill="#fff"/><circle cx="50" cy="50" r="6.5" fill="#fff"/><circle cx="33" cy="67" r="6.5" fill="#fff"/><circle cx="67" cy="67" r="6.5" fill="#fff"/>' +
    hl(24, 24, 5, 2.5, -40) + '</g>');

  /* 風箏 */
  add('kite', ['風箏', '风筝', 'Kite'], 'warm', 'diamond', '#F6C945', gd('kite', '#FFE27A', '#F2B92E') +
    '<g transform="rotate(14 50 40)">' +
    '<path d="M50,8 L78,38 L50,70 L22,38Z" ' + f('kite') + '/>' +
    '<polygon points="50,38 78,38 50,70" fill="#EF6F4C"/><polygon points="50,8 50,38 22,38" fill="#EF6F4C"/>' +
    '<path d="M50,8 L78,38 L50,70 L22,38Z" fill="none" ' + st(3) + '/>' +
    '<line x1="50" y1="8" x2="50" y2="70" ' + st(2.5) + '/><line x1="22" y1="38" x2="78" y2="38" ' + st(2.5) + '/>' +
    '<path d="M50,70 Q40,76 50,82 Q60,88 48,94" fill="none" ' + st(3) + '/>' +
    '<polygon points="42,80 50,82 44,87" fill="#5BC0EB" ' + st(2) + '/><polygon points="58,86 50,84 56,79" fill="#5BC0EB" ' + st(2) + '/></g>');

  /* 相機 */
  add('camera', ['相機', '相机', 'Camera'], 'warm', 'box-lens', '#E8DCC0', gd('camera', '#F7EEDA', '#D5C5A0') +
    '<rect x="34" y="16" width="32" height="18" rx="6" fill="#B5835A" ' + st(3) + '/>' +
    '<rect x="8" y="26" width="84" height="60" rx="14" ' + f('camera') + ' ' + st(3) + '/>' +
    '<rect x="15" y="31" width="16" height="9" rx="3" fill="#FFD166" ' + st(2) + '/><circle cx="76" cy="38" r="4" fill="#E5484D" ' + st(2) + '/>' +
    '<circle cx="50" cy="58" r="22" fill="#E0E7F1" ' + st(3) + '/><circle cx="50" cy="58" r="14" fill="#2F6DAE" ' + st(3) + '/>' +
    '<circle cx="50" cy="58" r="7" fill="#1E3A5F"/><circle cx="44.5" cy="52.5" r="4" fill="#fff"/>');

  /* 氣球 */
  add('balloon', ['氣球', '气球', 'Balloon'], 'warm', 'teardrop', '#F0568C', gd('balloon', '#FF8FB2', '#E03474') +
    '<path d="M50,8 C74,8 84,28 80,46 C76,60 62,68 53,70 L57,77 L43,77 L47,70 C38,68 24,60 20,46 C16,28 26,8 50,8Z" ' + f('balloon') + ' ' + st(3) + '/>' +
    '<path d="M50,77 Q40,83 50,87 Q60,91 51,95" fill="none" ' + st(2.5) + '/>' + hl(36, 28, 5, 11, 25));

  /* 拼圖 */
  add('puzzle', ['拼圖', '拼图', 'Puzzle piece'], 'cool', 'jigsaw', '#7AC74F', gd('puzzle', '#A5E07A', '#5BAA35') +
    '<g transform="translate(-6,-4)"><path d="M20,28 H42 C42,20 46,16 52,16 C58,16 62,20 62,28 H80 V46 C88,44 92,48 92,54 C92,60 88,64 80,62 V80 H62 C62,88 58,92 52,92 C46,92 42,88 42,80 H20 V62 C28,64 32,60 32,54 C32,48 28,44 20,46Z" ' + f('puzzle') + ' ' + st(3) + '/>' +
    hl(32, 38, 6, 3, -20) + '</g>');

  /* 喇叭（擴音器） */
  add('megaphone', ['喇叭', '喇叭', 'Megaphone'], 'cool', 'cone', '#6EC6F0', gd('megaphone', '#A5E0FA', '#4BA9DB') +
    '<g transform="translate(-4,0)"><rect x="32" y="58" width="14" height="26" rx="5" fill="#E5484D" ' + st(3) + '/>' +
    '<path d="M24,38 L74,14 Q86,10 86,24 V76 Q86,90 74,86 L24,62Z" ' + f('megaphone') + ' ' + st(3) + '/>' +
    '<path d="M46,29 L58,23 V77 L46,71Z" fill="#fff" opacity="0.85"/>' +
    '<rect x="10" y="36" width="16" height="28" rx="5" fill="#FFD166" ' + st(3) + '/>' +
    '<ellipse cx="84" cy="50" rx="7" ry="38" fill="#fff" ' + st(3) + '/><ellipse cx="84" cy="50" rx="3" ry="30" fill="#BFE6F7"/></g>');

  /* 網球拍 */
  add('racket', ['網球拍', '网球拍', 'Tennis racket'], 'cool', 'racket', '#C6E03A', gd('racket', '#E2F26B', '#A5C21E') +
    '<clipPath id="' + P + '-racket-c"><ellipse cx="50" cy="32" rx="19" ry="25"/></clipPath>' +
    '<g transform="rotate(35 50 50)">' +
    '<rect x="44" y="52" width="12" height="38" rx="5" fill="#E5484D" ' + st(3) + '/>' +
    '<path d="M42,55 L50,66 L58,55Z" fill="#A5C21E" ' + st(3) + '/>' +
    '<ellipse cx="50" cy="32" rx="19" ry="25" fill="#fff" fill-opacity="0.55"/>' +
    '<g clip-path="url(#' + P + '-racket-c)" stroke="' + S + '" stroke-width="1.2" opacity="0.55"><line x1="40" y1="5" x2="40" y2="60"/><line x1="50" y1="5" x2="50" y2="60"/><line x1="60" y1="5" x2="60" y2="60"/><line x1="25" y1="18" x2="75" y2="18"/><line x1="25" y1="28" x2="75" y2="28"/><line x1="25" y1="38" x2="75" y2="38"/><line x1="25" y1="48" x2="75" y2="48"/></g>' +
    '<ellipse cx="50" cy="32" rx="19" ry="25" fill="none" stroke="' + S + '" stroke-width="10" stroke-linejoin="round"/><ellipse cx="50" cy="32" rx="19" ry="25" fill="none" ' + f('racket').replace('fill=', 'stroke=') + ' stroke-width="4.5"/></g>' +
    '<circle cx="76" cy="78" r="11" fill="#E6F04A" ' + st(3) + '/><path d="M67,72 Q74,78 68,86 M85,70 Q78,78 84,87" fill="none" stroke="#fff" stroke-width="2"/>');

  /* 保齡球 */
  add('bowling', ['保齡球', '保龄球', 'Bowling'], 'warm', 'ball-pin', '#B5379B', gd('bowling', '#D86AC0', '#8E2578') +
    '<path d="M70,8 C78,8 80,18 76,26 C73,32 80,38 82,48 C84,60 80,70 70,70 C60,70 56,60 58,48 C60,38 67,32 64,26 C60,18 62,8 70,8Z" fill="#fff" ' + st(3) + '/>' +
    '<path d="M65,27 Q70,31 75,27" fill="none" stroke="#E5484D" stroke-width="3.5" stroke-linecap="round"/><path d="M64,33 Q70,37 76,33" fill="none" stroke="#E5484D" stroke-width="3.5" stroke-linecap="round"/>' +
    '<circle cx="38" cy="62" r="28" ' + f('bowling') + ' ' + st(3) + '/>' +
    '<circle cx="30" cy="52" r="3.6" fill="' + S + '"/><circle cx="41" cy="48" r="3.6" fill="' + S + '"/><circle cx="38" cy="59" r="3.6" fill="' + S + '"/>' +
    hl(24, 70, 4, 7, 40));

  /* 撲克牌 */
  (function () {
    var heart = function (tf) { return '<path transform="' + tf + '" d="M0,12 C-20,-4 -14,-20 0,-9 C14,-20 20,-4 0,12Z" fill="#E5484D"/>'; };
    add('cards', ['撲克牌', '扑克牌', 'Playing cards'], 'warm', 'cards', '#F2F2F7',
      '<g transform="rotate(-16 44 54)"><rect x="22" y="16" width="44" height="64" rx="7" fill="#5B8DEF" ' + st(3) + '/><rect x="27" y="21" width="34" height="54" rx="4" fill="none" stroke="#fff" stroke-width="2"/><polygon points="44,32 54,48 44,64 34,48" fill="#fff" opacity="0.85"/></g>' +
      '<g transform="rotate(14 56 54)"><rect x="34" y="18" width="46" height="66" rx="7" fill="#fff" ' + st(3) + '/>' +
      heart('translate(57,52) scale(1.25)') + heart('translate(44,30) scale(0.4)') + '</g>');
  })();

  /* 溜冰鞋 */
  add('skate', ['溜冰鞋', '溜冰鞋', 'Roller skate'], 'cool', 'boot', '#B28DFF', gd('skate', '#CDB3FF', '#9068E8') +
    '<path d="M20,10 H50 Q56,10 56,16 V42 Q56,54 68,56 Q88,60 90,70 V76 H20Z" ' + f('skate') + ' ' + st(3) + '/>' +
    '<rect x="20" y="10" width="36" height="9" rx="3" fill="#fff" ' + st(2.5) + '/>' +
    '<path d="M46,26 H56 M46,33 H56 M48,40 H58" ' + st(2.5).replace(S, '#fff') + ' fill="none"/>' +
    '<rect x="14" y="74" width="80" height="9" rx="3" fill="#4A5B7A" ' + st(3) + '/>' +
    '<circle cx="28" cy="88" r="6" fill="#FF6B6B" ' + st(2.5) + '/><circle cx="44" cy="88" r="6" fill="#FF6B6B" ' + st(2.5) + '/><circle cx="64" cy="88" r="6" fill="#FF6B6B" ' + st(2.5) + '/><circle cx="80" cy="88" r="6" fill="#FF6B6B" ' + st(2.5) + '/>' +
    hl(28, 40, 3, 10, 0));

  /* 釣竿 */
  add('fishing', ['釣竿', '钓竿', 'Fishing rod'], 'warm', 'rod', '#A98A5F', gd('fishing', '#C9A97C', '#8A6B42') +
    '<path d="M10,88 L78,14" stroke="' + S + '" stroke-width="9" stroke-linecap="round" fill="none"/><path d="M10,88 L78,14" stroke="#C9A97C" stroke-width="4" stroke-linecap="round" fill="none"/>' +
    '<path d="M10,88 L26,70" stroke="#7A4A22" stroke-width="5" stroke-linecap="round" fill="none"/>' +
    '<circle cx="34" cy="66" r="9" fill="#9AA7B8" ' + st(3) + '/><circle cx="34" cy="66" r="3" fill="' + S + '"/>' +
    '<path d="M78,14 Q94,38 82,60" fill="none" stroke="' + S + '" stroke-width="2" stroke-linecap="round"/>' +
    '<circle cx="82" cy="68" r="8" fill="#fff" ' + st(3) + '/><path d="M74,68 A8,8 0 0 1 90,68Z" fill="#E5484D" ' + st(3) + '/>' +
    '<path d="M46,90 q6,-7 12,0 t12,0 t12,0" fill="none" stroke="#4FC3F7" stroke-width="3.5" stroke-linecap="round"/>');

  /* 帳篷 */
  add('tent', ['帳篷', '帐篷', 'Tent'], 'cool', 'a-frame', '#2A9D8F', gd('tent', '#5CC7B9', '#1F7F73') +
    '<line x1="50" y1="14" x2="50" y2="4" ' + st(2.5) + '/><polygon points="50,4 62,8 50,12" fill="#E5484D" ' + st(2) + '/>' +
    '<path d="M50,14 L94,86 H6Z" ' + f('tent') + ' ' + st(3) + '/>' +
    '<path d="M50,42 L70,86 H30Z" fill="#17665C" ' + st(3) + '/><line x1="50" y1="42" x2="50" y2="86" ' + st(2.5) + '/>' +
    '<path d="M30,86 L50,42 L40,86Z" fill="#FFD166" opacity="0.0"/>' + hl(36, 44, 3, 11, 28));

  /* 摩天輪 */
  (function () {
    var s = '<circle cx="50" cy="44" r="33" fill="#FFE3EC" ' + st(3) + '/>' +
      '<line x1="50" y1="44" x2="28" y2="92" ' + st(3.5) + '/><line x1="50" y1="44" x2="72" y2="92" ' + st(3.5) + '/><line x1="20" y1="92" x2="80" y2="92" ' + st(3.5) + '/>', i, a, cols = ['#FF8FA3', '#FFD166', '#7AC74F', '#4D96FF'];
    for (i = 0; i < 8; i++) { a = (i * 45 + 22.5) * Math.PI / 180; s += '<line x1="50" y1="44" x2="' + (50 + 33 * Math.cos(a)).toFixed(1) + '" y2="' + (44 + 33 * Math.sin(a)).toFixed(1) + '" ' + st(2) + '/>'; }
    for (i = 0; i < 8; i++) { a = (i * 45 + 22.5) * Math.PI / 180; s += '<circle cx="' + (50 + 33 * Math.cos(a)).toFixed(1) + '" cy="' + (44 + 33 * Math.sin(a)).toFixed(1) + '" r="6.5" fill="' + cols[i % 4] + '" ' + st(2.5) + '/>'; }
    s += '<circle cx="50" cy="44" r="6" fill="#FFD166" ' + st(3) + '/>';
    add('ferris', ['摩天輪', '摩天轮', 'Ferris wheel'], 'warm', 'wheel', '#FFC4D6', s);
  })();

  root.GuessArt.add(P, { style: 'cute', items: items });
})(typeof self !== 'undefined' ? self : this);
