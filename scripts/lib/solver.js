/* ===== scripts/lib/solver.js — 離線解題器（只給 gen-spec-table.js 算各規格平均步數用，遊戲裡沒有電腦對手）=====
 * 電腦只拿得到自己的猜測歷史 { guess, a, b }，永遠看不到密碼。
 *
 * 難度＝推理強度＋失誤率：
 *   0 幼幼班：只看最近 2 筆回饋、25% 失誤（隨便猜）
 *   （幼幼班／簡單猜超過 14 次後會改看全部回饋且不再失誤，保證一局一定會結束）
 *   1 簡單  ：只看最近 3 筆回饋、15% 失誤
 *   2 普通  ：看全部回饋、5% 失誤、一致候選中隨機
 *   3 困難  ：看全部回饋、不失誤、最小化「最壞分割」（minimax）
 *
 * 空間處理：
 *   ≤ ENUM_MAX：全量枚舉成 Uint8Array 後過濾
 *   >  ENUM_MAX：不枚舉，用「帶剪枝的隨機深度優先搜尋」抽一致候選
 */
(function (root, factory) {
  'use strict';
  var Core = (typeof module === 'object' && module.exports) ? require('../../public/js/core/core.js') : root.GuessCore;
  var mod = factory(Core);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.GuessAI = mod;
})(typeof self !== 'undefined' ? self : this, function (Core) {
  'use strict';

  var LEN = Core.LEN;
  var ENUM_MAX = 500000;
  var LEVELS = [
    { memory: 2, err: 0.25, mode: 'random' },
    { memory: 3, err: 0.15, mode: 'random' },
    { memory: Infinity, err: 0.05, mode: 'random' },
    { memory: Infinity, err: 0, mode: 'minimax' }
  ];

  var spaceCache = {};
  /** 列舉整個空間（快取） */
  function enumerate(n, rep) {
    var key = n + (rep ? 'r' : 'u');
    if (spaceCache[key]) return spaceCache[key];
    var size = Core.spaceSize(n, rep);
    var arr = new Uint8Array(size * LEN);
    var p = 0;
    for (var a = 0; a < n; a++) for (var b = 0; b < n; b++) {
      if (!rep && b === a) continue;
      for (var c = 0; c < n; c++) {
        if (!rep && (c === a || c === b)) continue;
        for (var d = 0; d < n; d++) {
          if (!rep && (d === a || d === b || d === c)) continue;
          if (rep && a === b && b === c && c === d) continue;
          arr[p++] = a; arr[p++] = b; arr[p++] = c; arr[p++] = d;
        }
      }
    }
    spaceCache[key] = arr;
    return arr;
  }

  /* 快速判定（直接讀 Uint8Array，避免建立陣列） */
  var cs = new Int16Array(64), cg = new Int16Array(64);
  function fbArr(arr, i, g) {
    var a = 0, common = 0, k, o = i * LEN;
    for (k = 0; k < LEN; k++) {
      var s = arr[o + k];
      if (s === g[k]) a++;
      cs[s]++; cg[g[k]]++;
    }
    for (k = 0; k < LEN; k++) {
      var t = arr[o + k];
      if (cs[t] > 0) { common += cs[t] < cg[t] ? cs[t] : cg[t]; cs[t] = 0; }
    }
    for (k = 0; k < LEN; k++) { cs[arr[o + k]] = 0; cg[g[k]] = 0; }
    return a * 5 + (common - a);
  }
  function fbPair(s, g) { var r = Core.evaluate(s, g); return r.a * 5 + r.b; }

  /** 枚舉空間中與歷史一致的索引清單 */
  function filterSpace(space, hist) {
    var count = space.length / LEN, out = [];
    outer: for (var i = 0; i < count; i++) {
      for (var h = 0; h < hist.length; h++) {
        if (fbArr(space, i, hist[h].guess) !== hist[h].code) continue outer;
      }
      out.push(i);
    }
    return out;
  }
  function codeAt(space, i) { var o = i * LEN; return [space[o], space[o + 1], space[o + 2], space[o + 3]]; }

  /**
   * 帶剪枝的隨機 DFS：找一個與歷史一致的密碼（大空間用）。
   * 剪枝：每筆歷史的 A 與「共有數」只會隨填入而增加、且每格最多 +1。
   */
  function sampleConsistent(n, rep, hist, rng, budget) {
    var code = [0, 0, 0, 0];
    var used = new Int16Array(64);
    var steps = 0;
    var H = hist.map(function (h) {
      var cnt = new Int16Array(64);
      for (var k = 0; k < LEN; k++) cnt[h.guess[k]]++;
      return { g: h.guess, A: h.a, C: h.a + h.b, cnt: cnt, partA: 0, partC: 0, seen: new Int16Array(64) };
    });
    var order = [];
    for (var i = 0; i < n; i++) order.push(i);
    function dfs(pos) {
      if (++steps > budget) return false;
      if (pos === LEN) {
        for (var q = 0; q < H.length; q++) if (H[q].partA !== H[q].A || H[q].partC !== H[q].C) return false;
        return true;
      }
      var ord = order.slice();
      for (var j = ord.length - 1; j > 0; j--) { var k = rng.int(j + 1); var t = ord[j]; ord[j] = ord[k]; ord[k] = t; }
      var left = LEN - pos - 1;
      for (var x = 0; x < ord.length; x++) {
        var s = ord[x];
        if (!rep && used[s]) continue;
        if (rep && used[s] >= 3) continue;
        var ok = true, q2;
        for (q2 = 0; q2 < H.length; q2++) {
          var h = H[q2];
          var na = h.partA + (h.g[pos] === s ? 1 : 0);
          var nc = h.partC + (h.seen[s] < h.cnt[s] ? 1 : 0);
          if (na > h.A || nc > h.C || na + left < h.A || nc + left < h.C) { ok = false; break; }
        }
        if (!ok) continue;
        for (q2 = 0; q2 < H.length; q2++) {
          var hh = H[q2];
          hh._da = hh.g[pos] === s ? 1 : 0; hh._dc = hh.seen[s] < hh.cnt[s] ? 1 : 0;
          hh.partA += hh._da; hh.partC += hh._dc; hh.seen[s]++;
          hh['_s' + pos] = [hh._da, hh._dc];
        }
        used[s]++; code[pos] = s;
        if (dfs(pos + 1)) return true;
        used[s]--;
        for (q2 = 0; q2 < H.length; q2++) {
          var h3 = H[q2], d = h3['_s' + pos];
          h3.partA -= d[0]; h3.partC -= d[1]; h3.seen[s]--;
        }
      }
      return false;
    }
    return dfs(0) ? code.slice() : null;
  }

  function randomCode(n, rep, rng) { return Core.makeSecret(rng, n, rep); }

  /** minimax：從 guesses 中挑「最壞分割最小」的，平手時偏好候選內、再看期望大小 */
  function pickMinimax(guesses, cands, candSet) {
    var best = null, bestMax = Infinity, bestSum = Infinity, bestIn = false;
    var bucket = new Int32Array(25);
    for (var gi = 0; gi < guesses.length; gi++) {
      var g = guesses[gi];
      bucket.fill(0);
      for (var ci = 0; ci < cands.length; ci++) bucket[fbPair(cands[ci], g)]++;
      var mx = 0, sum = 0;
      for (var b = 0; b < 25; b++) { if (b === 20) continue; if (bucket[b] > mx) mx = bucket[b]; sum += bucket[b] * bucket[b]; }
      var inS = candSet ? candSet.has(g.join(',')) : false;
      if (mx < bestMax || (mx === bestMax && (sum < bestSum || (sum === bestSum && inS && !bestIn)))) {
        best = g; bestMax = mx; bestSum = sum; bestIn = inS;
      }
    }
    return best;
  }

  function sampleArr(arr, k, rng) {
    if (arr.length <= k) return arr.slice();
    var copy = arr.slice(), out = [];
    for (var i = 0; i < k; i++) { var j = i + rng.int(copy.length - i); var t = copy[i]; copy[i] = copy[j]; copy[j] = t; out.push(copy[i]); }
    return out;
  }

  /**
   * @param {{level:number, n:number, rep:boolean, rng:function}} opt
   */
  function createAI(opt) {
    var lv = LEVELS[Math.max(0, Math.min(3, opt.level | 0))];
    var n = opt.n, rep = !!opt.rep, rng = opt.rng || Core.mulberry32(1);
    var size = Core.spaceSize(n, rep);
    var big = size > ENUM_MAX;

    function next(history) {
      var hist = (history || []).map(function (h) { return { guess: h.guess, a: h.a, b: h.b, code: h.a * 5 + h.b }; });
      var asked = {};
      hist.forEach(function (h) { asked[h.guess.join(',')] = 1; });
      var late = hist.length >= 14;
      var used = (lv.memory === Infinity || late) ? hist : hist.slice(-lv.memory);

      /* 失誤：完全隨機猜一個（但不重猜同一組） */
      if (lv.err && !late && rng() < lv.err) {
        for (var t = 0; t < 20; t++) { var r = randomCode(n, rep, rng); if (!asked[r.join(',')]) return r; }
      }

      if (!hist.length) {
        /* 第一手：4 個不同符號（可重複規格也一樣，資訊量最大） */
        return Core.makeSecret(rng, n, false);
      }

      if (!big) {
        var space = enumerate(n, rep);
        var idx = filterSpace(space, used);
        idx = idx.filter(function (i) { return !asked[codeAt(space, i).join(',')]; });
        if (!idx.length) return randomCode(n, rep, rng);
        if (lv.mode !== 'minimax' || idx.length === 1) return codeAt(space, idx[rng.int(idx.length)]);
        if (idx.length === 2) return codeAt(space, idx[0]);
        var cands = sampleArr(idx, 1200, rng).map(function (i) { return codeAt(space, i); });
        var guesses;
        if (idx.length <= 1500) {
          /* 候選全體＋整個空間抽樣 */
          guesses = cands.slice();
          var total = space.length / LEN, extra = Math.min(600, total);
          for (var e = 0; e < extra; e++) guesses.push(codeAt(space, rng.int(total)));
        } else {
          guesses = sampleArr(cands, 300, rng);
        }
        var set = new Set(cands.map(function (c) { return c.join(','); }));
        return pickMinimax(guesses, cands, set) || cands[0];
      }

      /* 大空間：抽樣一致候選 */
      var samples = [], seen = {};
      var want = lv.mode === 'minimax' ? 160 : 1;
      for (var s = 0; s < want * 3 && samples.length < want; s++) {
        var c = sampleConsistent(n, rep, used, rng, 60000);
        if (!c) break;
        var key = c.join(',');
        if (seen[key] || asked[key]) continue;
        seen[key] = 1; samples.push(c);
      }
      if (!samples.length) return randomCode(n, rep, rng);
      if (lv.mode !== 'minimax' || samples.length < 3) return samples[0];
      var set2 = new Set(samples.map(function (c) { return c.join(','); }));
      return pickMinimax(samples.slice(0, 80), samples, set2) || samples[0];
    }

    return { next: next, level: opt.level | 0, big: big };
  }

  /** 模擬一局（測試與規格表用）：回傳用了幾步 */
  function simulate(opt, secret, maxSteps) {
    var ai = createAI(opt), hist = [];
    for (var step = 1; step <= (maxSteps || 60); step++) {
      var g = ai.next(hist);
      var r = Core.evaluate(secret, g);
      hist.push({ guess: g, a: r.a, b: r.b });
      if (r.a === LEN) return step;
    }
    return Infinity;
  }

  return { createAI: createAI, simulate: simulate, enumerate: enumerate, sampleConsistent: sampleConsistent, ENUM_MAX: ENUM_MAX, LEVELS: LEVELS };
});
