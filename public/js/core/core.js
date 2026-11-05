/* ===== core/core.js — 規則核心（瀏覽器與伺服器共用）=====
 * 內容：種子亂數、字元集規格、項目池、出題、A/B 判定、合法性檢查。
 *
 * 規則核心只認「池內索引」0..n-1：一局的 4 格密碼 / 猜測都是索引陣列。
 * 畫面再用 spec.pool[索引] 換成字元集裡的符號 id，最後交給美術登記表畫出來。
 *
 * 位數固定 4（任何模式都一樣）。
 *
 * v0.8：玩家不再自己設定項目數與重複，改由五段難度（幼幼／簡單／普通／困難／神話）自動隨機決定；
 *       所有模式項目池最多 10 個（神話 8～10 個）；可重複時同一個符號最多出現 3 次。
 * v0.9：可重複的局，項目池直接列出重複的項目（例如兩個 1），池裡有幾個就是密碼裡最多幾個（可以更少）。
 *       spec.n＝不同項目數（索引範圍），spec.cnt[i]＝第 i 個項目的次數上限，spec.size＝含重複的項目總數（≤10）。
 */
(function (root, factory) {
  'use strict';
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.GuessCore = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LEN = 4;

  /* ---------- 種子亂數 ---------- */
  function hashString(str) {
    /* FNV-1a 32 位元 */
    var h = 0x811c9dc5;
    str = String(str);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }
  function mulberry32(seed) {
    var a = seed >>> 0;
    var rng = function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rng.int = function (n) { return Math.floor(rng() * n); };
    return rng;
  }
  function rngFrom(seedStr) { return mulberry32(hashString(seedStr)); }
  function randomSeed() {
    var s = '';
    try {
      var c = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : null;
      if (c) { var u = new Uint32Array(2); c.getRandomValues(u); s = u[0].toString(36) + u[1].toString(36); }
    } catch (e) { s = ''; }
    if (!s) s = Math.random().toString(36).slice(2) + Date.now().toString(36);
    return s;
  }

  /* ---------- 字元集 ---------- */
  /* 主題包：前 8 包可愛手繪、後 4 包現實世界寫實風 */
  var PACKS = ['food', 'fruit', 'wear', 'home', 'go', 'learn', 'play', 'animal', 'flag', 'space', 'tw', 'landmark'];
  var CUTE_PACKS = PACKS.slice(0, 8);
  var REAL_PACKS = PACKS.slice(8);
  var PACK_SIZE = 20;

  var N_MIN = 4, N_MAX = 10, MAX_SAME = 3;
  var CHARSETS = {
    digits: { kind: 'digits', size: 10, min: N_MIN, max: N_MAX },
    letters: { kind: 'letters', size: 26, min: N_MIN, max: N_MAX },
    gems: { kind: 'gems', size: 12, min: N_MIN, max: N_MAX },
    mix: { kind: 'mix', size: PACKS.length * PACK_SIZE, min: N_MIN, max: N_MAX }
  };
  PACKS.forEach(function (p) {
    CHARSETS['pack-' + p] = { kind: 'pack', pack: p, size: PACK_SIZE, min: N_MIN, max: N_MAX };
  });

  /* ---------- 五段難度 ---------- */
  var TIERS = 5;
  /** 一般模式：每段的項目數範圍與「可重複」機率 */
  var TIER_N = [[4, 5], [5, 6], [6, 7], [7, 8], [8, 10]];
  var TIER_REP = [0, 0, 0.3, 0.6, 1];
  /** 字元集可選「random」＝每局隨機換一種 */
  function resolveCs(cs, rng) {
    if (cs === 'random') return CHARSET_IDS[rng.int(CHARSET_IDS.length)];
    return CHARSETS[cs] ? cs : 'digits';
  }
  /** 依難度隨機產生一局的規格（項目數、重複、項目池都由 seed 決定） */
  function tierSpec(tier, cs, seed, nRange, extra) {
    tier = Math.max(0, Math.min(TIERS - 1, tier | 0));
    var r = rngFrom(seed + ':tier');
    var range = nRange || TIER_N[tier];
    var n = range[0] + r.int(range[1] - range[0] + 1);
    var rep = r() < TIER_REP[tier];
    return makeSpec({ cs: resolveCs(cs, r), n: n, rep: rep, wordChance: extra && extra.wordChance }, seed);
  }
  /** 經典模式：寫死數字 0～9 全部 10 個、不重複（不看難度、不能調整） */
  var CLASSIC = { cs: 'digits', n: 10, rep: false };
  function classicSpec(seed) { return makeSpec(CLASSIC, seed); }
  var CHARSET_IDS = ['digits', 'letters', 'gems'].concat(PACKS.map(function (p) { return 'pack-' + p; })).concat(['mix']);

  function charset(id) { return CHARSETS[id] || null; }
  function clampN(cs, n) {
    var c = CHARSETS[cs];
    if (!c) return 10;
    n = Math.round(Number(n));
    if (!isFinite(n)) n = Math.min(10, c.max);
    return Math.max(c.min, Math.min(c.max, n));
  }

  /** 符號 id → { set, index }（大混搭的 id＝包序×20＋包內序） */
  function symbolRef(cs, id) {
    if (cs === 'mix') return { set: 'pack-' + PACKS[Math.floor(id / PACK_SIZE)], index: id % PACK_SIZE };
    return { set: cs, index: id };
  }

  /* ---------- 規格與項目池 ---------- */
  /** 抽項目池：從字元集不放回抽 n 個，再依標準順序排序 */
  function makePool(rng, cs, n) {
    var c = CHARSETS[cs];
    var all = [];
    for (var i = 0; i < c.size; i++) all.push(i);
    for (var j = all.length - 1; j > 0; j--) {
      var k = rng.int(j + 1);
      var t = all[j]; all[j] = all[k]; all[k] = t;
    }
    return all.slice(0, n).sort(function (a, b) { return a - b; });
  }

  /**
   * 建立一局的規格。
   * @param {{cs:string,n:number,rep:boolean}} opt
   * @param {string} seed  例如 'solo:xxxx'、'lv:2:37:0'、'daily:2026-11-03'
   */
  function makeSpec(opt, seed) {
    var cs = CHARSETS[opt.cs] ? opt.cs : 'digits';
    var rep = !!opt.rep;
    var cnt = null, n;
    if (rep && Array.isArray(opt.cnt) && validCnt(opt.cnt)) {
      /* 已經決定好的重複對應（例如伺服器傳來的） */
      cnt = opt.cnt.slice();
      n = cnt.length;
    } else {
      /* opt.n＝含重複的項目總數 */
      var size = clampN(cs, opt.n);
      if (rep) {
        cnt = makeCnt(rngFrom(seed + ':cnt'), size);
        n = cnt.length;
      } else n = size;
    }
    var given = opt.pool && validPool(cs, n, opt.pool);
    /* 字母題：大約一半先選一個真的英文單字，再讓項目池包含它的字母 */
    var word = null;
    if (cs === 'letters' && !given) {
      var wr = rngFrom(seed + ':word');
      if (wr() < (opt.wordChance != null ? opt.wordChance : WORD_CHANCE)) word = pickWord(wr, !!cnt && Math.max.apply(null, cnt) >= 2);
    }
    var pool = given ? opt.pool.slice() : word ? poolWithWord(rngFrom(seed + ':pool'), word, n) : makePool(rngFrom(seed + ':pool'), cs, n);
    if (word && cnt) fitCnt(cnt, pool, word);
    var spec = { cs: cs, n: n, rep: rep, pool: pool, size: n, seed: String(seed) };
    if (word) spec.word = word;
    if (cnt) { spec.cnt = cnt; spec.size = cnt.reduce(function (s, x) { return s + x; }, 0); }
    return spec;
  }
  /* ---------- 英文單字（字母題） ---------- */
  var WORD_CHANCE = 0.5;
  var _words;
  function words() {
    if (_words !== undefined) return _words;
    _words = null;
    if (typeof module === 'object' && module.exports && typeof require === 'function') { try { _words = require('./words.js'); } catch (e) { _words = null; } }
    if (!_words && typeof self !== 'undefined' && self.GuessWords) _words = self.GuessWords;
    return _words;
  }
  /** 'BOOK' → [1, 14, 14, 10]（A＝0） */
  function letterIds(w) { var out = []; for (var i = 0; i < w.length; i++) out.push(w.charCodeAt(i) - 65); return out; }
  function pickWord(rng, canDouble) {
    var W = words(); if (!W) return null;
    var list = canDouble ? W.DISTINCT.concat(W.REPEAT) : W.DISTINCT;
    return list[rng.int(list.length)][0];
  }
  /** 項目池＝單字用到的字母＋其他隨機字母，共 n 個，依 A→Z 排序 */
  function poolWithWord(rng, w, n) {
    var need = [];
    letterIds(w).forEach(function (id) { if (need.indexOf(id) < 0) need.push(id); });
    var rest = [];
    for (var i = 0; i < 26; i++) if (need.indexOf(i) < 0) rest.push(i);
    for (var j = rest.length - 1; j > 0; j--) { var k = rng.int(j + 1); var t = rest[j]; rest[j] = rest[k]; rest[k] = t; }
    return need.concat(rest.slice(0, n - need.length)).sort(function (a, b) { return a - b; });
  }
  /** 單字裡重複的字母，次數上限要夠：跟其他項目交換次數（總數不變） */
  function fitCnt(cnt, pool, w) {
    var c = {};
    letterIds(w).forEach(function (id) { c[id] = (c[id] || 0) + 1; });
    Object.keys(c).forEach(function (id) {
      var k = c[id], i = pool.indexOf(Number(id));
      if (cnt[i] >= k) return;
      for (var j = 0; j < cnt.length; j++) if (j !== i && cnt[j] >= k) { var t = cnt[i]; cnt[i] = cnt[j]; cnt[j] = t; return; }
    });
  }
  /** 4 格密碼剛好拼成單字表裡的單字 → [單字, 繁中, 簡中]，否則 null */
  function wordOfCode(spec, code) {
    var W = words();
    if (!W || !spec || spec.cs !== 'letters' || !code || code.length !== LEN) return null;
    var s = '';
    for (var i = 0; i < code.length; i++) s += String.fromCharCode(65 + spec.pool[code[i]]);
    return W.lookup(s);
  }
  /** 用這局項目池拼得出來的單字（換成密碼索引），互相出題的預設密碼用 */
  function formableWords(spec) {
    var W = words();
    if (!W || !spec || spec.cs !== 'letters') return [];
    var list = spec.rep ? W.DISTINCT.concat(W.REPEAT) : W.DISTINCT, out = [];
    list.forEach(function (e) {
      var code = letterIds(e[0]).map(function (id) { return spec.pool.indexOf(id); });
      if (code.indexOf(-1) >= 0) return;
      if (validate(code, spec.n, spec.rep, spec.cnt).ok) out.push(code);
    });
    return out;
  }

  /** 可重複的局：總數 size 裡挑 1～3 個（且不同項目至少留 4 個）當重複的複本，同一個最多 MAX_SAME 次 */
  function makeCnt(rng, size) {
    var extra = 1 + rng.int(Math.max(1, Math.min(3, size - LEN)));
    var d = Math.max(LEN, size - extra);
    extra = size - d;
    var cnt = [];
    for (var i = 0; i < d; i++) cnt.push(1);
    for (var e = 0; e < extra; e++) {
      var open = [];
      for (var j = 0; j < d; j++) if (cnt[j] < MAX_SAME) open.push(j);
      cnt[open[rng.int(open.length)]]++;
    }
    return cnt;
  }
  function validCnt(cnt) {
    if (cnt.length < LEN || cnt.length > N_MAX) return false;
    var sum = 0;
    for (var i = 0; i < cnt.length; i++) {
      if (!Number.isInteger(cnt[i]) || cnt[i] < 1 || cnt[i] > MAX_SAME) return false;
      sum += cnt[i];
    }
    return sum <= N_MAX;
  }
  /** 項目池照次數展開成要顯示的索引清單（例如 cnt [2,1,1] → [0,0,1,2]） */
  function poolList(spec) {
    var out = [];
    for (var i = 0; i < spec.n; i++) for (var k = 0; k < (spec.cnt ? spec.cnt[i] : 1); k++) out.push(i);
    return out;
  }
  /** 第 i 個項目在密碼裡最多幾次 */
  function maxOf(spec, i) { return spec.cnt ? spec.cnt[i] : spec.rep ? MAX_SAME : 1; }
  function validPool(cs, n, pool) {
    var c = CHARSETS[cs];
    if (!Array.isArray(pool) || pool.length !== n) return false;
    var seen = {};
    for (var i = 0; i < pool.length; i++) {
      var v = pool[i];
      if (!Number.isInteger(v) || v < 0 || v >= c.size || seen[v]) return false;
      seen[v] = 1;
    }
    return true;
  }

  /** 可能空間大小 */
  /** 可重複時排除「4 格都一樣」（同一符號最多 3 次） */
  function spaceSize(n, rep, cnt) {
    if (rep && cnt) {
      /* 依次數上限逐格計數（n ≤ 10，直接數） */
      var total = 0, used = new Array(n).fill(0);
      (function walk(k) {
        if (k === LEN) { total++; return; }
        for (var v = 0; v < n; v++) if (used[v] < cnt[v]) { used[v]++; walk(k + 1); used[v]--; }
      })(0);
      return total;
    }
    return rep ? Math.pow(n, LEN) - n : n * (n - 1) * (n - 2) * (n - 3);
  }

  /* ---------- 出題 ---------- */
  function makeSecret(rng, n, rep, cnt) {
    var out = [];
    if (rep && cnt) {
      /* 從展開後的項目池不放回抽 4 個：池裡有幾個，密碼裡就最多幾個 */
      var bag = [];
      for (var q = 0; q < n; q++) for (var m = 0; m < cnt[q]; m++) bag.push(q);
      for (var p = 0; p < LEN; p++) {
        var w = p + rng.int(bag.length - p);
        var tmp = bag[p]; bag[p] = bag[w]; bag[w] = tmp;
        out.push(bag[p]);
      }
      return out;
    }
    if (rep) {
      do {
        out = [];
        for (var i = 0; i < LEN; i++) out.push(rng.int(n));
      } while (out[0] === out[1] && out[1] === out[2] && out[2] === out[3]);
      return out;
    }
    var all = [];
    for (var a = 0; a < n; a++) all.push(a);
    for (var j = 0; j < LEN; j++) {
      var k = j + rng.int(n - j);
      var t = all[j]; all[j] = all[k]; all[k] = t;
      out.push(all[j]);
    }
    return out;
  }
  function secretFor(spec) {
    if (spec.word && spec.cs === 'letters') {
      var code = letterIds(spec.word).map(function (id) { return spec.pool.indexOf(id); });
      if (code.indexOf(-1) < 0 && validate(code, spec.n, spec.rep, spec.cnt).ok) return code;
    }
    return makeSecret(rngFrom(spec.seed + ':secret'), spec.n, spec.rep, spec.cnt); }

  /* ---------- 判定 ---------- */
  var _cs = new Int16Array(64), _cg = new Int16Array(64);
  /** 先算 A；每次出現只能配對一次，B＝共有符號數（多重集合取小）− A。 */
  function evaluate(secret, guess) {
    var a = 0, common = 0, i;
    for (i = 0; i < LEN; i++) {
      if (secret[i] === guess[i]) a++;
      _cs[secret[i]]++; _cg[guess[i]]++;
    }
    for (i = 0; i < LEN; i++) {
      var s = secret[i];
      if (_cs[s] > 0) { common += Math.min(_cs[s], _cg[s]); _cs[s] = 0; }
    }
    for (i = 0; i < LEN; i++) { _cs[secret[i]] = 0; _cg[guess[i]] = 0; }
    return { a: a, b: common - a };
  }
  /** 回饋編碼（0..24） */
  function fbCode(a, b) { return a * 5 + b; }

  /** 合法性：長度、範圍、（不重複規格）不得重複 */
  function validate(guess, n, rep, cnt) {
    if (!Array.isArray(guess) || guess.length !== LEN) return { ok: false, reason: 'length' };
    for (var i = 0; i < LEN; i++) {
      var v = guess[i];
      if (!Number.isInteger(v) || v < 0 || v >= n) return { ok: false, reason: 'unknown' };
    }
    if (rep && cnt) {
      /* 可重複：同一個項目不能超過項目池裡的個數 */
      var c = {};
      for (var z = 0; z < LEN; z++) { c[guess[z]] = (c[guess[z]] || 0) + 1; if (c[guess[z]] > cnt[guess[z]]) return { ok: false, reason: 'tooMany' }; }
      return { ok: true };
    }
    if (!rep) {
      for (var x = 0; x < LEN; x++) for (var y = x + 1; y < LEN; y++) if (guess[x] === guess[y]) return { ok: false, reason: 'duplicate' };
    } else if (guess[0] === guess[1] && guess[1] === guess[2] && guess[2] === guess[3]) {
      return { ok: false, reason: 'tooMany' };
    }
    return { ok: true };
  }

  /* ---------- 日期（台北時間） ---------- */
  function taipeiDate(ms) {
    var d = new Date((ms == null ? Date.now() : ms) + 8 * 3600 * 1000);
    var y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate();
    return y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function dayNumber(dateStr) {
    var p = String(dateStr).split('-').map(Number);
    return Math.floor(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000);
  }

  return {
    LEN: LEN, MAX_SAME: MAX_SAME, N_MIN: N_MIN, N_MAX: N_MAX, TIERS: TIERS, TIER_N: TIER_N, TIER_REP: TIER_REP, tierSpec: tierSpec, resolveCs: resolveCs, CLASSIC: CLASSIC, classicSpec: classicSpec,
    PACKS: PACKS, CUTE_PACKS: CUTE_PACKS, REAL_PACKS: REAL_PACKS, PACK_SIZE: PACK_SIZE,
    CHARSETS: CHARSETS, CHARSET_IDS: CHARSET_IDS,
    hashString: hashString, mulberry32: mulberry32, rngFrom: rngFrom, randomSeed: randomSeed,
    charset: charset, clampN: clampN, symbolRef: symbolRef,
    makePool: makePool, makeSpec: makeSpec, validPool: validPool, validCnt: validCnt, poolList: poolList, maxOf: maxOf, spaceSize: spaceSize,
    makeSecret: makeSecret, secretFor: secretFor, wordOfCode: wordOfCode, formableWords: formableWords, WORD_CHANCE: WORD_CHANCE, evaluate: evaluate, fbCode: fbCode, validate: validate,
    taipeiDate: taipeiDate, dayNumber: dayNumber
  };
});
