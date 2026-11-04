/* ===== core/core.js — 規則核心（瀏覽器與伺服器共用）=====
 * 內容：種子亂數、字元集規格、項目池、出題、A/B 判定、合法性檢查。
 *
 * 規則核心只認「池內索引」0..n-1：一局的 4 格密碼 / 猜測都是索引陣列。
 * 畫面再用 spec.pool[索引] 換成字元集裡的符號 id，最後交給美術登記表畫出來。
 *
 * 位數固定 4（任何模式都一樣）。
 *
 * v0.8：玩家不再自己設定項目數與重複，改由五段難度（幼幼／簡單／普通／困難／神話）自動隨機決定；
 *       一般模式項目池最多 8 個、闖關最多 10 個；可重複時同一個符號最多出現 3 次。
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
  var TIER_N = [[4, 5], [5, 6], [6, 7], [7, 8], [8, 8]];
  var TIER_REP = [0, 0, 0.3, 0.6, 1];
  /** 字元集可選「random」＝每局隨機換一種 */
  function resolveCs(cs, rng) {
    if (cs === 'random') return CHARSET_IDS[rng.int(CHARSET_IDS.length)];
    return CHARSETS[cs] ? cs : 'digits';
  }
  /** 依難度隨機產生一局的規格（項目數、重複、項目池都由 seed 決定） */
  function tierSpec(tier, cs, seed, nRange) {
    tier = Math.max(0, Math.min(TIERS - 1, tier | 0));
    var r = rngFrom(seed + ':tier');
    var range = nRange || TIER_N[tier];
    var n = range[0] + r.int(range[1] - range[0] + 1);
    var rep = r() < TIER_REP[tier];
    return makeSpec({ cs: resolveCs(cs, r), n: n, rep: rep }, seed);
  }
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
    var n = clampN(cs, opt.n);
    var rep = !!opt.rep;
    var pool = opt.pool && validPool(cs, n, opt.pool) ? opt.pool.slice() : makePool(rngFrom(seed + ':pool'), cs, n);
    return { cs: cs, n: n, rep: rep, pool: pool, seed: String(seed) };
  }
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
  function spaceSize(n, rep) {
    return rep ? Math.pow(n, LEN) - n : n * (n - 1) * (n - 2) * (n - 3);
  }

  /* ---------- 出題 ---------- */
  function makeSecret(rng, n, rep) {
    var out = [];
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
  function secretFor(spec) { return makeSecret(rngFrom(spec.seed + ':secret'), spec.n, spec.rep); }

  /* ---------- 判定 ---------- */
  var _cs = new Int16Array(64), _cg = new Int16Array(64);
  /** A＝位置與符號都對；B＝共有符號數（多重集合取小）− A */
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
  function validate(guess, n, rep) {
    if (!Array.isArray(guess) || guess.length !== LEN) return { ok: false, reason: 'length' };
    for (var i = 0; i < LEN; i++) {
      var v = guess[i];
      if (!Number.isInteger(v) || v < 0 || v >= n) return { ok: false, reason: 'unknown' };
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
    LEN: LEN, MAX_SAME: MAX_SAME, N_MIN: N_MIN, N_MAX: N_MAX, TIERS: TIERS, TIER_N: TIER_N, TIER_REP: TIER_REP, tierSpec: tierSpec, resolveCs: resolveCs,
    PACKS: PACKS, CUTE_PACKS: CUTE_PACKS, REAL_PACKS: REAL_PACKS, PACK_SIZE: PACK_SIZE,
    CHARSETS: CHARSETS, CHARSET_IDS: CHARSET_IDS,
    hashString: hashString, mulberry32: mulberry32, rngFrom: rngFrom, randomSeed: randomSeed,
    charset: charset, clampN: clampN, symbolRef: symbolRef,
    makePool: makePool, makeSpec: makeSpec, validPool: validPool, spaceSize: spaceSize,
    makeSecret: makeSecret, secretFor: secretFor, evaluate: evaluate, fbCode: fbCode, validate: validate,
    taipeiDate: taipeiDate, dayNumber: dayNumber
  };
});
