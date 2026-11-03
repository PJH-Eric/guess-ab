/* ===== art/pack-animal.js — 動物主題包（可愛手繪，20 隻）=====
 * 大象、長頸鹿、獅子、烏龜、鯨魚、貓頭鷹、蝴蝶、蝸牛、螃蟹、猴子、斑馬、章魚、刺蝟、鱷魚、蜜蜂、袋鼠、孔雀、海星、河馬、駱駝
 */
(function (root) {
  'use strict';
  var P = 'pack-animal', S = '#26405E';
  function st(w) { return 'stroke="' + S + '" stroke-width="' + (w || 3) + '" stroke-linejoin="round" stroke-linecap="round"'; }
  function gd(k, a, b) {
    return '<defs><linearGradient id="' + P + '-' + k + '-g" gradientUnits="userSpaceOnUse" x1="0" y1="10" x2="0" y2="90">' +
      '<stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient></defs>';
  }
  function f(k) { return 'fill="url(#' + P + '-' + k + '-g)"'; }
  function hl(cx, cy, rx, ry, rot) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="#fff" opacity="0.7"' +
      (rot ? ' transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')"' : '') + '/>';
  }
  function eye(x, y, r) { r = r || 3.4; return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + S + '"/><circle cx="' + (x - r * 0.3) + '" cy="' + (y - r * 0.35) + '" r="' + (r * 0.38) + '" fill="#fff"/>'; }
  function cheek(x, y) { return '<ellipse cx="' + x + '" cy="' + y + '" rx="4" ry="2.6" fill="#FF8FA3" opacity="0.55"/>'; }
  function smile(x, y, w) { return '<path d="M' + (x - w) + ',' + y + ' Q' + x + ',' + (y + w * 0.9) + ' ' + (x + w) + ',' + y + '" fill="none" ' + st(2.2) + '/>'; }
  /* 聯集：外框先畫、填色後畫，使重疊處沒有內線 */
  function un(shapes, fill, w) {
    var a = '', b = '';
    shapes.forEach(function (s) { a += '<' + s + ' fill="' + fill + '" ' + st(w || 3) + '/>'; b += '<' + s + ' fill="' + fill + '"/>'; });
    return a + b;
  }
  function pts(cx, cy, r, r2, n, rot) {
    var out = [], i, a, rr, t = n * 2;
    for (i = 0; i < t; i++) { a = (rot || 0) * Math.PI / 180 + i * 2 * Math.PI / t - Math.PI / 2; rr = i % 2 ? r2 : r; out.push((cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1)); }
    return out.join(' ');
  }
  var items = [];
  function add(key, n, tone, tag, color, svg) { items.push({ key: key, n: n, tone: tone, tag: tag, color: color, svg: svg }); }

  /* 大象 */
  (function () {
    var g = '#A9BCD6';
    add('elephant', ['大象', '大象', 'Elephant'], 'cool', 'trunk', '#9BB0C9', gd('elephant', '#C3D2E6', '#8CA3C2') +
      '<rect x="36" y="68" width="14" height="24" rx="6" fill="#8CA3C2" ' + st(3) + '/><rect x="64" y="68" width="14" height="24" rx="6" fill="#8CA3C2" ' + st(3) + '/>' +
      '<path d="M84,50 Q96,52 92,66" fill="none" ' + st(3) + '/>' +
      un(['ellipse cx="58" cy="56" rx="32" ry="24"'], g) +
      '<path d="M22,44 C20,62 16,76 14,84 Q13,92 21,90 Q27,88 26,80 Q28,66 36,58Z" fill="' + g + '" ' + st(3) + '/>' +
      un(['circle cx="34" cy="42" r="21"'], g) +
      '<path d="M24,52 C16,60 12,76 14,84 Q14,91 21,89 Q27,87 26,80 Q26,68 34,58Z" fill="' + g + '" ' + st(3) + '/>' +
      '<ellipse cx="50" cy="40" rx="12" ry="16" fill="#8CA3C2" ' + st(3) + '/><ellipse cx="50" cy="41" rx="6.5" ry="10" fill="#FFB3C1" opacity="0.7"/>' +
      '<path d="M22,56 Q14,60 12,66" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>' +
      eye(30, 38) + cheek(24, 49) + hl(26, 28, 6, 3, -30));
  })();

  /* 長頸鹿 */
  add('giraffe', ['長頸鹿', '长颈鹿', 'Giraffe'], 'warm', 'tall', '#F0B24A', gd('giraffe', '#FFD98A', '#EBA73A') +
    '<rect x="30" y="68" width="8" height="24" rx="4" fill="#EBA73A" ' + st(3) + '/><rect x="44" y="72" width="8" height="20" rx="4" fill="#EBA73A" ' + st(3) + '/>' +
    '<rect x="60" y="72" width="8" height="20" rx="4" fill="#EBA73A" ' + st(3) + '/><rect x="74" y="68" width="8" height="24" rx="4" fill="#EBA73A" ' + st(3) + '/>' +
    '<path d="M28,62 Q16,64 16,78" fill="none" ' + st(3) + '/><circle cx="16" cy="79" r="3.4" fill="#8A5A3C" ' + st(2) + '/>' +
    '<line x1="62" y1="8" x2="62" y2="16" ' + st(3) + '/><line x1="74" y1="8" x2="74" y2="16" ' + st(3) + '/><circle cx="62" cy="7" r="3.2" fill="#8A5A3C" ' + st(2) + '/><circle cx="74" cy="7" r="3.2" fill="#8A5A3C" ' + st(2) + '/>' +
    un(['path d="M54,70 L58,28 L74,28 L76,70Z"', 'ellipse cx="55" cy="68" rx="26" ry="14"', 'ellipse cx="68" cy="24" rx="15" ry="11"', 'ellipse cx="82" cy="28" rx="8" ry="6.5"'], '#F7C562') +
    '<ellipse cx="55" cy="15" rx="0" ry="0"/>' +
    '<ellipse cx="57" cy="22" rx="4" ry="6" fill="#F7C562" ' + st(2.5) + ' transform="rotate(-30 57 22)"/>' +
    '<circle cx="64" cy="42" r="3.6" fill="#B5733A"/><circle cx="68" cy="56" r="4" fill="#B5733A"/><circle cx="44" cy="66" r="4.4" fill="#B5733A"/><circle cx="60" cy="72" r="3.8" fill="#B5733A"/><circle cx="72" cy="66" r="3.6" fill="#B5733A"/><circle cx="68" cy="33" r="2.8" fill="#B5733A"/>' +
    eye(71, 22, 3) + '<circle cx="85" cy="27" r="1.2" fill="' + S + '"/>' + cheek(76, 30) + hl(62, 40, 2.5, 6, 6));

  /* 獅子 */
  (function () {
    var m = '', i, a;
    for (i = 0; i < 12; i++) { a = i * Math.PI / 6; m += 'circle cx="' + (50 + 30 * Math.cos(a)).toFixed(1) + '" cy="' + (52 + 30 * Math.sin(a)).toFixed(1) + '" r="13"|'; }
    var mane = m.split('|').filter(Boolean);
    add('lion', ['獅子', '狮子', 'Lion'], 'warm', 'mane', '#E8923A', gd('lion', '#F7B35E', '#D97A25') +
      un(mane, '#E8923A') + un(['circle cx="50" cy="52" r="32"'], '#E8923A') +
      '<circle cx="32" cy="30" r="8" fill="#F5C77E" ' + st(3) + '/><circle cx="68" cy="30" r="8" fill="#F5C77E" ' + st(3) + '/>' +
      un(['circle cx="50" cy="54" r="25"'], '#F8D08A') +
      '<ellipse cx="50" cy="63" rx="13" ry="10" fill="#FFF3DC"/>' +
      '<path d="M45,56 H55 L50,62Z" fill="#8A4B2A" ' + st(2) + '/><path d="M50,62 V66 M50,66 Q45,70 41,66 M50,66 Q55,70 59,66" fill="none" ' + st(2.2) + '/>' +
      eye(40, 47) + eye(60, 47) + cheek(32, 58) + cheek(68, 58) + hl(38, 36, 5, 2.5, -30));
  })();

  /* 烏龜 */
  add('turtle', ['烏龜', '乌龟', 'Turtle'], 'cool', 'dome', '#6BBF6A', gd('turtle', '#92DD8B', '#4AA64F') +
    '<ellipse cx="34" cy="80" rx="9" ry="8" fill="#B9E0A0" ' + st(3) + '/><ellipse cx="72" cy="80" rx="9" ry="8" fill="#B9E0A0" ' + st(3) + '/>' +
    '<path d="M86,66 L96,64 L88,72Z" fill="#B9E0A0" ' + st(2.5) + '/>' +
    un(['circle cx="17" cy="56" r="12"'], '#B9E0A0') + eye(13, 53, 2.8) + smile(15, 60, 3.5) + cheek(21, 59) +
    '<path d="M22,74 C20,32 88,30 88,74Z" ' + f('turtle') + ' ' + st(3) + '/>' +
    '<rect x="22" y="72" width="66" height="8" rx="4" fill="#F1E0A8" ' + st(3) + '/>' +
    '<polygon points="55,40 66,46 66,58 55,64 44,58 44,46" fill="#7CCB78" ' + st(2.5) + '/>' +
    '<path d="M44,46 L34,42 M44,58 L32,62 M66,46 L76,44 M66,58 L78,62 M55,40 V34" fill="none" ' + st(2.5) + '/>' + hl(40, 46, 5, 2.5, -30));

  /* 鯨魚 */
  add('whale', ['鯨魚', '鲸鱼', 'Whale'], 'cool', 'spout', '#4C8FD6', gd('whale', '#7DB4EE', '#3677C0') +
    '<clipPath id="' + P + '-whale-c"><ellipse cx="44" cy="62" rx="36" ry="26"/></clipPath>' +
    '<path d="M44,36 V22 M44,22 Q36,14 30,18 M44,22 Q52,14 58,18" fill="none" stroke="#7DB4EE" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M74,62 Q88,60 88,44 Q84,48 80,48 Q82,38 90,34 Q76,34 70,50Z" fill="#4C8FD6" ' + st(3) + '/>' +
    '<ellipse cx="44" cy="62" rx="36" ry="26" ' + f('whale') + ' ' + st(3) + '/>' +
    '<g clip-path="url(#' + P + '-whale-c)"><ellipse cx="40" cy="86" rx="38" ry="16" fill="#D6EBFA"/><path d="M14,76 H70 M20,82 H66" ' + st(1.8) + ' opacity="0.3"/></g>' +
    '<ellipse cx="44" cy="62" rx="36" ry="26" fill="none" ' + st(3) + '/>' +
    '<path d="M40,72 Q50,84 58,74Z" fill="#3677C0" ' + st(2.5) + '/>' +
    eye(24, 56) + smile(22, 68, 6) + cheek(34, 64) + hl(36, 44, 8, 3, -8));

  /* 貓頭鷹 */
  add('owl', ['貓頭鷹', '猫头鹰', 'Owl'], 'warm', 'ear-tufts', '#A9743F', gd('owl', '#CF9A62', '#8F5E2E') +
    '<path d="M50,12 L62,20 C84,22 90,50 86,66 C82,86 66,90 50,90 C34,90 18,86 14,66 C10,50 16,22 38,20Z" ' + f('owl') + ' ' + st(3) + '/>' +
    '<path d="M32,60 Q50,50 68,60 Q70,80 50,86 Q30,80 32,60Z" fill="#F2DDB5"/>' +
    '<path d="M42,66 q4,4 8,0 q4,4 8,0 M40,74 q5,4 10,0 q5,4 10,0" fill="none" stroke="#C99B5E" stroke-width="2" stroke-linecap="round"/>' +
    '<ellipse cx="14" cy="60" rx="7" ry="16" fill="#8F5E2E" ' + st(3) + ' transform="rotate(8 14 60)"/><ellipse cx="86" cy="60" rx="7" ry="16" fill="#8F5E2E" ' + st(3) + ' transform="rotate(-8 86 60)"/>' +
    '<circle cx="36" cy="40" r="13" fill="#fff" ' + st(3) + '/><circle cx="64" cy="40" r="13" fill="#fff" ' + st(3) + '/>' +
    eye(38, 41, 6) + eye(62, 41, 6) +
    '<path d="M44,48 L56,48 L50,58Z" fill="#FFB020" ' + st(2.5) + '/>' +
    '<path d="M38,90 H46 M54,90 H62" ' + st(3) + '/>');

  /* 蝴蝶 */
  add('butterfly', ['蝴蝶', '蝴蝶', 'Butterfly'], 'cool', 'wings', '#8F7CE8', gd('butterfly', '#B7A6FA', '#7863DA') +
    '<path d="M48,44 C30,2 2,14 8,38 C10,50 30,52 48,48Z" ' + f('butterfly') + ' ' + st(3) + '/><path d="M52,44 C70,2 98,14 92,38 C90,50 70,52 52,48Z" ' + f('butterfly') + ' ' + st(3) + '/>' +
    '<path d="M48,52 C30,52 14,60 20,78 C26,92 46,86 48,60Z" fill="#F7A6D0" ' + st(3) + '/><path d="M52,52 C70,52 86,60 80,78 C74,92 54,86 52,60Z" fill="#F7A6D0" ' + st(3) + '/>' +
    '<circle cx="24" cy="28" r="6" fill="#fff" opacity="0.9"/><circle cx="76" cy="28" r="6" fill="#fff" opacity="0.9"/><circle cx="30" cy="74" r="4.5" fill="#fff" opacity="0.9"/><circle cx="70" cy="74" r="4.5" fill="#fff" opacity="0.9"/>' +
    '<path d="M46,28 Q40,14 34,12 M54,28 Q60,14 66,12" fill="none" ' + st(2.5) + '/><circle cx="33" cy="11" r="2.6" fill="' + S + '"/><circle cx="67" cy="11" r="2.6" fill="' + S + '"/>' +
    '<ellipse cx="50" cy="52" rx="5.5" ry="22" fill="' + S + '"/><circle cx="50" cy="30" r="6.5" fill="' + S + '"/>' + eye(48.5, 29, 1.6).replace(S, '#fff'));

  /* 蝸牛 */
  add('snail', ['蝸牛', '蜗牛', 'Snail'], 'warm', 'spiral', '#C77DC7', gd('snail', '#E3A0E3', '#AA5CAA') +
    '<path d="M22,44 L18,30 M30,44 L34,30" fill="none" ' + st(3) + '/><circle cx="18" cy="28" r="4.2" fill="#fff" ' + st(2.5) + '/><circle cx="34" cy="28" r="4.2" fill="#fff" ' + st(2.5) + '/><circle cx="18" cy="28" r="1.8" fill="' + S + '"/><circle cx="34" cy="28" r="1.8" fill="' + S + '"/>' +
    '<path d="M6,82 C6,72 16,70 20,62 C22,54 18,46 24,42 C30,38 34,44 32,52 C32,60 38,64 42,70 H88 Q96,70 96,79 Q96,88 88,88 H12 Q6,88 6,82Z" fill="#F7E3B5" ' + st(3) + '/>' +
    '<circle cx="60" cy="52" r="26" ' + f('snail') + ' ' + st(3) + '/>' +
    '<path d="M60,52 m0,0 a4,4 0 0 1 7,2 a10,10 0 0 1 -12,10 a16,16 0 0 1 -9,-22 a21,21 0 0 1 30,-6" fill="none" ' + st(2.8) + '/>' +
    cheek(14, 70) + smile(17, 76, 3.5) + hl(48, 36, 6, 3, -35));

  /* 螃蟹 */
  add('crab', ['螃蟹', '螃蟹', 'Crab'], 'warm', 'claws', '#E5534B', gd('crab', '#FF8277', '#D23C34') +
    '<path d="M24,66 L10,74 M28,72 L16,84 M76,66 L90,74 M72,72 L84,84 M36,76 L30,90 M64,76 L70,90" fill="none" stroke="' + S + '" stroke-width="3.2" stroke-linecap="round"/>' +
    '<path d="M32,56 L24,46 M68,56 L76,46" fill="none" ' + st(5) + '/><path d="M32,56 L24,46 M68,56 L76,46" fill="none" stroke="#E5534B" stroke-width="2"/>' +
    '<g transform="translate(4,2)"><path d="M6,42 C0,28 6,14 14,16 L18,26 L24,14 C32,18 30,34 22,44Z" fill="#E5534B" ' + st(3) + '/></g>' +
    '<g transform="translate(96,2) scale(-1,1)"><path d="M6,42 C0,28 6,14 14,16 L18,26 L24,14 C32,18 30,34 22,44Z" fill="#E5534B" ' + st(3) + '/></g>' +
    '<line x1="40" y1="46" x2="38" y2="34" ' + st(3) + '/><line x1="60" y1="46" x2="62" y2="34" ' + st(3) + '/>' +
    '<ellipse cx="50" cy="62" rx="30" ry="20" ' + f('crab') + ' ' + st(3) + '/>' +
    '<circle cx="38" cy="32" r="7" fill="#fff" ' + st(3) + '/><circle cx="62" cy="32" r="7" fill="#fff" ' + st(3) + '/><circle cx="39" cy="33" r="3.2" fill="' + S + '"/><circle cx="61" cy="33" r="3.2" fill="' + S + '"/>' +
    smile(50, 62, 7) + cheek(32, 62) + cheek(68, 62) + hl(36, 54, 6, 2.5, -20));

  /* 猴子 */
  add('monkey', ['猴子', '猴子', 'Monkey'], 'warm', 'big-ears', '#7A4B2B', gd('monkey', '#A56E43', '#6A3F22') +
    '<path d="M70,80 Q94,80 92,56 Q90,46 82,50" fill="none" stroke="' + S + '" stroke-width="9" stroke-linecap="round"/><path d="M70,80 Q94,80 92,56 Q90,46 82,50" fill="none" stroke="#8A5A3C" stroke-width="3.4" stroke-linecap="round"/>' +
    un(['ellipse cx="50" cy="82" rx="20" ry="13"'], '#8A5A3C') + '<ellipse cx="50" cy="84" rx="11" ry="8" fill="#F2CF9C"/>' +
    '<circle cx="14" cy="42" r="12" fill="#8A5A3C" ' + st(3) + '/><circle cx="86" cy="42" r="12" fill="#8A5A3C" ' + st(3) + '/><circle cx="14" cy="42" r="6" fill="#F2CF9C"/><circle cx="86" cy="42" r="6" fill="#F2CF9C"/>' +
    '<circle cx="50" cy="42" r="30" fill="#8A5A3C" ' + st(3) + '/>' +
    '<path d="M50,30 C40,22 28,30 30,42 C30,50 36,54 38,60 C40,66 60,66 62,60 C64,54 70,50 70,42 C72,30 60,22 50,30Z" fill="#F2CF9C" ' + st(3) + '/>' +
    eye(40, 42) + eye(60, 42) + '<circle cx="46" cy="53" r="1.6" fill="' + S + '"/><circle cx="54" cy="53" r="1.6" fill="' + S + '"/>' + smile(50, 58, 6) + hl(36, 22, 7, 2.6, -25));

  /* 斑馬 */
  add('zebra', ['斑馬', '斑马', 'Zebra'], 'cool', 'stripes', '#F2F2F2', gd('zebra', '#FFFFFF', '#DCE3EC') +
    '<path d="M26,28 L16,8 L40,18Z" fill="#fff" ' + st(3) + '/><path d="M74,28 L84,8 L60,18Z" fill="#fff" ' + st(3) + '/>' +
    '<path d="M25,22 L20,13 L32,18Z" fill="' + S + '"/><path d="M75,22 L80,13 L68,18Z" fill="' + S + '"/>' +
    '<path d="M26,26 C26,10 74,10 74,26 C80,50 72,72 66,84 Q50,94 34,84 C28,72 20,50 26,26Z" ' + f('zebra') + ' ' + st(3) + '/>' +
    '<path d="M44,13 Q50,3 56,13 L54,32 Q50,36 46,32Z" fill="' + S + '"/>' +
    '<path d="M25,38 Q34,38 38,46 M24,52 Q32,52 36,60 M28,66 Q33,66 35,72 M75,38 Q66,38 62,46 M76,52 Q68,52 64,60 M72,66 Q67,66 65,72" fill="none" stroke="' + S + '" stroke-width="3.4" stroke-linecap="round"/>' +
    '<ellipse cx="50" cy="76" rx="15" ry="12" fill="#5C6B80" ' + st(3) + '/>' +
    '<circle cx="44" cy="76" r="2.4" fill="#26405E"/><circle cx="56" cy="76" r="2.4" fill="#26405E"/>' +
    eye(38, 44) + eye(62, 44) + hl(40, 26, 5, 2, -10));

  /* 章魚 */
  (function () {
    var t = '', paths = ['M30,56 Q16,64 20,80 Q22,88 14,86', 'M40,62 Q32,76 36,88', 'M50,64 Q50,78 50,90', 'M60,62 Q68,76 64,88', 'M70,56 Q84,64 80,80 Q78,88 86,86'], i;
    for (i = 0; i < paths.length; i++) t += '<path d="' + paths[i] + '" fill="none" stroke="' + S + '" stroke-width="13" stroke-linecap="round"/>';
    for (i = 0; i < paths.length; i++) t += '<path d="' + paths[i] + '" fill="none" stroke="#F0708F" stroke-width="7" stroke-linecap="round"/>';
    add('octopus', ['章魚', '章鱼', 'Octopus'], 'warm', 'tentacles', '#C45AB3', gd('octopus', '#E97FD2', '#B04AA0') + t.replace(/#F0708F/g, '#D470C4') +
      '<ellipse cx="50" cy="38" rx="30" ry="29" ' + f('octopus') + ' ' + st(3) + '/>' +
      '<circle cx="40" cy="38" r="6.5" fill="#fff" ' + st(2.5) + '/><circle cx="60" cy="38" r="6.5" fill="#fff" ' + st(2.5) + '/><circle cx="41" cy="39" r="3.4" fill="' + S + '"/><circle cx="59" cy="39" r="3.4" fill="' + S + '"/>' +
      smile(50, 50, 6) + cheek(30, 48) + cheek(70, 48) + '<circle cx="62" cy="14" r="3" fill="#fff" opacity="0.7"/>' + hl(34, 20, 8, 3.2, -30));
  })();

  /* 刺蝟 */
  (function () {
    var p = [], i, a, r;
    for (i = 0; i <= 18; i++) { a = (200 + i * 10) * Math.PI / 180; r = i % 2 ? 31 : 38; p.push((54 + r * Math.cos(a)).toFixed(1) + ',' + (60 + (r * 0.92) * Math.sin(a)).toFixed(1)); }
    var spikes = p.join(' ') + ' 88,72 78,86 32,86 24,72';
    add('hedgehog', ['刺蝟', '刺猬', 'Hedgehog'], 'warm', 'spikes', '#8C7B75', gd('hedgehog', '#B09E96', '#6E5E58') +
      '<ellipse cx="42" cy="86" rx="8" ry="5" fill="#E8C9A0" ' + st(2.5) + '/><ellipse cx="70" cy="86" rx="8" ry="5" fill="#E8C9A0" ' + st(2.5) + '/>' +
      '<polygon points="' + spikes + '" ' + f('hedgehog') + ' ' + st(3) + '/>' +
      '<path d="M26,46 Q8,64 14,74 Q22,82 44,80 L56,52Z" fill="#F2D7B0" ' + st(3) + '/>' +
      '<circle cx="14" cy="68" r="4.6" fill="' + S + '"/><circle cx="12.6" cy="66.6" r="1.4" fill="#fff"/>' +
      '<circle cx="32" cy="60" r="12" fill="#F2D7B0"/>' +
      '<circle cx="30" cy="58" r="3.4" fill="' + S + '"/><circle cx="29" cy="57" r="1.2" fill="#fff"/><ellipse cx="38" cy="70" rx="4.2" ry="2.6" fill="#FF8FA3" opacity="0.55"/>' +
      '<path d="M16,76 Q24,80 32,76" fill="none" ' + st(2.2) + '/>' +
      '<circle cx="46" cy="52" r="6" fill="#F2D7B0" ' + st(2.5) + '/>');
  })();

  /* 鱷魚 */
  add('crocodile', ['鱷魚', '鳄鱼', 'Crocodile'], 'cool', 'long', '#3E9B6A', gd('crocodile', '#6FCB95', '#2F8056') +
    '<path d="M50,38 L54,28 L60,38 L68,30 L72,40 L80,36 L82,46" fill="#2F8056" ' + st(3) + '/>' +
    '<rect x="30" y="64" width="12" height="16" rx="5" fill="#3E9B6A" ' + st(3) + '/><rect x="62" y="64" width="12" height="16" rx="5" fill="#3E9B6A" ' + st(3) + '/>' +
    un(['ellipse cx="58" cy="56" rx="30" ry="15"', 'path d="M72,50 Q92,50 94,64 Q86,62 74,62Z"', 'path d="M6,50 Q6,42 16,42 H36 Q42,34 52,38 V66 H16 Q6,66 6,58Z"'], '#52B07F') +
    '<path d="M8,60 H38" stroke="' + S + '" stroke-width="2.6" fill="none"/>' +
    '<path d="M10,60 L13,64 L16,60 L19,64 L22,60 L25,64 L28,60 L31,64 L34,60" fill="#fff" ' + st(2) + '/>' +
    '<ellipse cx="60" cy="68" rx="20" ry="7" fill="#C8EBB0" opacity="0.8"/>' +
    '<circle cx="42" cy="42" r="6.4" fill="#fff" ' + st(3) + '/><circle cx="43" cy="43" r="3.1" fill="' + S + '"/><circle cx="12" cy="49" r="1.6" fill="' + S + '"/>' +
    hl(56, 46, 9, 2.6, -8));

  /* 蜜蜂 */
  add('bee', ['蜜蜂', '蜜蜂', 'Bee'], 'warm', 'stripe-fly', '#FFE45E', gd('bee', '#FFF08A', '#FFD22E') +
    '<clipPath id="' + P + '-bee-c"><ellipse cx="52" cy="60" rx="30" ry="24"/></clipPath>' +
    '<ellipse cx="40" cy="30" rx="11" ry="19" fill="#E3F4FF" ' + st(3) + ' transform="rotate(-22 40 30)"/><ellipse cx="62" cy="30" rx="11" ry="19" fill="#E3F4FF" ' + st(3) + ' transform="rotate(22 62 30)"/>' +
    '<path d="M78,66 L92,72 L80,74Z" fill="' + S + '" ' + st(2) + '/>' +
    '<path d="M38,82 L36,92 M52,84 L52,92 M66,82 L68,92" ' + st(3) + ' fill="none"/>' +
    '<ellipse cx="52" cy="60" rx="30" ry="24" ' + f('bee') + '/>' +
    '<g clip-path="url(#' + P + '-bee-c)"><rect x="44" y="30" width="9" height="60" fill="' + S + '"/><rect x="62" y="30" width="9" height="60" fill="' + S + '"/></g>' +
    '<ellipse cx="52" cy="60" rx="30" ry="24" fill="none" ' + st(3) + '/>' +
    '<path d="M28,40 Q22,28 16,28 M36,38 Q34,26 30,22" fill="none" ' + st(2.5) + '/><circle cx="15" cy="28" r="2.8" fill="' + S + '"/><circle cx="29" cy="21" r="2.8" fill="' + S + '"/>' +
    eye(31, 56) + smile(34, 66, 4.5) + cheek(26, 64) + hl(40, 46, 5, 2.4, -25));

  /* 袋鼠 */
  add('kangaroo', ['袋鼠', '袋鼠', 'Kangaroo'], 'warm', 'pouch', '#CF7F4F', gd('kangaroo', '#EDA877', '#BC6C3C') +
    '<path d="M36,70 Q12,76 8,90 Q22,92 42,84Z" fill="#CF7F4F" ' + st(3) + '/>' +
    '<ellipse cx="54" cy="10" rx="4" ry="9" fill="#CF7F4F" ' + st(3) + ' transform="rotate(-12 54 12)"/><ellipse cx="66" cy="10" rx="4" ry="9" fill="#CF7F4F" ' + st(3) + ' transform="rotate(14 66 12)"/>' +
    un(['ellipse cx="52" cy="62" rx="20" ry="24"', 'ellipse cx="58" cy="26" rx="14" ry="13"', 'ellipse cx="70" cy="32" rx="9" ry="6.5"', 'ellipse cx="52" cy="80" rx="19" ry="12"', 'rect x="50" y="84" width="40" height="9" rx="4.5"'], '#D98E5C') +
    '<path d="M40,62 Q52,72 64,62 Q64,80 52,82 Q40,80 40,62Z" fill="#F7D6AE" ' + st(2.5) + '/>' +
    '<ellipse cx="68" cy="52" rx="5" ry="7" fill="#D98E5C" ' + st(3) + ' transform="rotate(-30 68 52)"/>' +
    eye(61, 24) + '<circle cx="76" cy="30" r="2" fill="' + S + '"/>' + cheek(64, 32) + hl(54, 18, 4, 2, -20));

  /* 孔雀 */
  (function () {
    var s = '', i, a, x, y, cols;
    for (i = 0; i < 9; i++) {
      a = (-80 + i * 20) * Math.PI / 180;
      x = 50 + 36 * Math.sin(a); y = 62 - 36 * Math.cos(a);
      s += '<ellipse cx="' + (50 + 21 * Math.sin(a)).toFixed(1) + '" cy="' + (62 - 21 * Math.cos(a)).toFixed(1) + '" rx="8" ry="18" fill="#2AB5B0" ' + st(2.6) + ' transform="rotate(' + (-80 + i * 20) + ' ' + (50 + 21 * Math.sin(a)).toFixed(1) + ' ' + (62 - 21 * Math.cos(a)).toFixed(1) + ')"/>';
    }
    for (i = 0; i < 9; i++) {
      a = (-80 + i * 20) * Math.PI / 180;
      x = 50 + 34 * Math.sin(a); y = 62 - 34 * Math.cos(a);
      s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4.8" fill="#FFD166"/><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.4" fill="#3F6FD8"/>';
    }
    add('peacock', ['孔雀', '孔雀', 'Peacock'], 'cool', 'fan', '#2AB5B0', gd('peacock', '#5ED3CE', '#1F9892') + s +
      un(['ellipse cx="50" cy="76" rx="14" ry="15"', 'path d="M44,72 Q42,52 50,48 Q58,52 56,72Z"', 'circle cx="50" cy="46" r="8"'], '#3F8CE0') +
      '<path d="M50,38 V32 M46,39 L43,33 M54,39 L57,33" ' + st(2.2) + ' fill="none"/><circle cx="50" cy="31" r="2" fill="#FFD166"/><circle cx="43" cy="32" r="2" fill="#FFD166"/><circle cx="57" cy="32" r="2" fill="#FFD166"/>' +
      eye(46.5, 45, 2.4) + eye(53.5, 45, 2.4) + '<path d="M48,49 L52,49 L50,53Z" fill="#FFB020" ' + st(1.6) + '/>' +
      '<path d="M44,90 H48 M52,90 H56" ' + st(3) + '/>' + hl(44, 72, 3, 6, 10));
  })();

  /* 海星 */
  (function () {
    var p = pts(50, 52, 44, 20, 5, 0);
    add('starfish', ['海星', '海星', 'Starfish'], 'warm', 'star5', '#FF7F5C', gd('starfish', '#FFA68A', '#F2603A') +
      '<polygon points="' + p + '" fill="' + S + '" stroke="' + S + '" stroke-width="13" stroke-linejoin="round"/>' +
      '<polygon points="' + p + '" fill="#FF7F5C" stroke="#FF7F5C" stroke-width="7" stroke-linejoin="round"/>' +
      '<circle cx="50" cy="26" r="2.6" fill="#FFD3C2"/><circle cx="50" cy="35" r="2.2" fill="#FFD3C2"/><circle cx="74" cy="46" r="2.6" fill="#FFD3C2"/><circle cx="66" cy="49" r="2.2" fill="#FFD3C2"/>' +
      '<circle cx="26" cy="46" r="2.6" fill="#FFD3C2"/><circle cx="34" cy="49" r="2.2" fill="#FFD3C2"/><circle cx="68" cy="78" r="2.6" fill="#FFD3C2"/><circle cx="32" cy="78" r="2.6" fill="#FFD3C2"/>' +
      eye(42, 54) + eye(58, 54) + smile(50, 62, 5) + cheek(36, 61) + cheek(64, 61) + hl(44, 36, 4, 2, -25));
  })();

  /* 河馬 */
  add('hippo', ['河馬', '河马', 'Hippo'], 'cool', 'wide-snout', '#9C8FB5', gd('hippo', '#BDB2D6', '#8478A2') +
    '<circle cx="26" cy="26" r="9" fill="#9C8FB5" ' + st(3) + '/><circle cx="74" cy="26" r="9" fill="#9C8FB5" ' + st(3) + '/><circle cx="26" cy="26" r="4" fill="#E9B8C8"/><circle cx="74" cy="26" r="4" fill="#E9B8C8"/>' +
    '<circle cx="34" cy="38" r="9" fill="#9C8FB5" ' + st(3) + '/><circle cx="66" cy="38" r="9" fill="#9C8FB5" ' + st(3) + '/>' +
    '<path d="M10,60 C10,34 90,34 90,60 C90,78 78,88 50,88 C22,88 10,78 10,60Z" ' + f('hippo') + ' ' + st(3) + '/>' +
    '<ellipse cx="50" cy="68" rx="34" ry="19" fill="#CDBFE0" ' + st(3) + '/>' +
    '<ellipse cx="38" cy="64" rx="3.6" ry="4.6" fill="' + S + '"/><ellipse cx="62" cy="64" rx="3.6" ry="4.6" fill="' + S + '"/>' +
    '<path d="M38,78 Q50,84 62,78" fill="none" ' + st(2.4) + '/><rect x="42" y="78" width="6" height="5" rx="1.6" fill="#fff" ' + st(1.6) + '/><rect x="52" y="78" width="6" height="5" rx="1.6" fill="#fff" ' + st(1.6) + '/>' +
    eye(34, 38, 3.2) + eye(66, 38, 3.2) + cheek(20, 62) + cheek(80, 62) + hl(44, 48, 6, 2.5, -10));

  /* 駱駝 */
  add('camel', ['駱駝', '骆驼', 'Camel'], 'warm', 'humps', '#E2C48D', gd('camel', '#F2DDB0', '#D3AF70') +
    '<rect x="30" y="64" width="9" height="28" rx="4" fill="#D3AF70" ' + st(3) + '/><rect x="42" y="66" width="9" height="26" rx="4" fill="#D3AF70" ' + st(3) + '/>' +
    '<rect x="62" y="66" width="9" height="26" rx="4" fill="#D3AF70" ' + st(3) + '/><rect x="74" y="64" width="9" height="28" rx="4" fill="#D3AF70" ' + st(3) + '/>' +
    '<path d="M86,52 Q94,58 90,72" fill="none" ' + st(3) + '/>' +
    un(['ellipse cx="56" cy="56" rx="32" ry="15"', 'ellipse cx="46" cy="38" rx="12" ry="15"', 'ellipse cx="70" cy="38" rx="12" ry="15"', 'path d="M30,60 Q22,40 20,26 L32,22 Q36,42 44,52Z"', 'ellipse cx="22" cy="22" rx="12" ry="9"'], '#E8CC96') +
    '<ellipse cx="12" cy="25" rx="5" ry="4.2" fill="#F7E7C6" ' + st(2.5) + '/><circle cx="12" cy="24" r="1.2" fill="' + S + '"/>' +
    '<ellipse cx="30" cy="14" rx="3.4" ry="4.6" fill="#E8CC96" ' + st(2.5) + '/>' +
    eye(24, 20, 3) + smile(18, 29, 3.6) + '<path d="M42,66 Q56,74 70,66" fill="none" stroke="#fff" stroke-width="2" opacity="0.6"/>' + hl(46, 30, 4, 6, 10));

  root.GuessArt.add(P, { style: 'cute', items: items });
})(typeof self !== 'undefined' ? self : this);
