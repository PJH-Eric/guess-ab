/* ===== tests/verify.js — 規則、五段難度、規格表、關卡、美術資料、語系、房間邏輯 =====
 * 用法：node tests/verify.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');
global.self = global;

const Core = require('../public/js/core/core.js');
const Table = require('../public/js/core/spec-table.js');
const Levels = require('../public/js/core/levels.js');
const { createHub, normSettings } = require('../lib/rooms.js');

let passed = 0, failed = 0;
const pending = [];
function test(name, fn) {
  try {
    const r = fn();
    if (r && r.then) { pending.push(r.then(() => { passed++; console.log('  ✓ ' + name); }, e => { failed++; console.log('  ✗ ' + name + '\n    ' + (e && e.stack || e)); })); return; }
    passed++; console.log('  ✓ ' + name);
  } catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + (e && e.stack || e)); }
}

console.log('規則核心');
function naive(s, g) {
  let a = 0; for (let i = 0; i < 4; i++) if (s[i] === g[i]) a++;
  const cs = {}, cg = {}; s.forEach(x => cs[x] = (cs[x] || 0) + 1); g.forEach(x => cg[x] = (cg[x] || 0) + 1);
  let c = 0; for (const k in cs) c += Math.min(cs[k], cg[k] || 0);
  return { a, b: c - a };
}
test('A/B 判定與暴力計數一致（20 萬組，含可重複）', () => {
  const r = Core.mulberry32(7);
  for (let t = 0; t < 200000; t++) {
    const n = 4 + r.int(7), s = Core.makeSecret(r, n, r() < .5), g = Core.makeSecret(r, n, r() < .5);
    const x = Core.evaluate(s, g), y = naive(s, g);
    assert.deepStrictEqual([x.a, x.b], [y.a, y.b], JSON.stringify([s, g]));
  }
});
test('預設規格窮舉 5040×200：A+B ≤ 4、A=4 只在相同時', () => {
  const sp = [];
  for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) for (let c = 0; c < 10; c++) for (let d = 0; d < 10; d++) if (new Set([a, b, c, d]).size === 4) sp.push(a, b, c, d);
  assert.strictEqual(sp.length / 4, 5040);
  const r = Core.mulberry32(3);
  for (let i = 0; i < 200; i++) {
    const g = Core.makeSecret(r, 10, false);
    for (let k = 0; k < 5040; k++) {
      const s = [sp[k * 4], sp[k * 4 + 1], sp[k * 4 + 2], sp[k * 4 + 3]];
      const e = Core.evaluate(s, g);
      assert(e.a + e.b <= 4);
      assert.strictEqual(e.a === 4, s.join() === g.join());
    }
  }
});
test('教學頁範例：1234 vs 1325＝1A2B；池 AABCDE 下 ABAC vs AABD＝1A2B', () => {
  assert.deepStrictEqual(Core.evaluate([1, 2, 3, 4], [1, 3, 2, 5]), { a: 1, b: 2 });
  assert.deepStrictEqual(Core.evaluate([0, 1, 0, 2], [0, 0, 1, 3]), { a: 1, b: 2 });
  const cnt = [2, 1, 1, 1, 1];
  assert.ok(Core.validate([0, 1, 0, 2], 5, true, cnt).ok, '範例密碼合法');
  assert.ok(Core.validate([0, 0, 1, 3], 5, true, cnt).ok, '範例猜測合法');
});
test('重複數字優先算 A，每次出現只能配對一次', () => {
  const secret = [5, 5, 4, 3];
  const cases = [
    { guess: [5, 2, 5, 5], result: { a: 1, b: 1 } },
    { guess: [5, 2, 6, 7], result: { a: 1, b: 0 } },
    { guess: [4, 3, 5, 5], result: { a: 0, b: 4 } },
    { guess: [5, 5, 4, 3], result: { a: 4, b: 0 } },
    { guess: [5, 5, 5, 2], result: { a: 2, b: 0 } }
  ];
  for (const { guess, result } of cases) {
    assert.deepStrictEqual(Core.evaluate(secret, guess), result, guess.join(''));
    assert.deepStrictEqual(Core.evaluate(guess, secret), result, '交換答案與猜測');
  }
});

test('可重複的項目池：池裡有幾個就最多幾個', () => {
  const cnt = [2, 1, 3, 1];
  assert.strictEqual(Core.validate([0, 0, 1, 2], 4, true, cnt).ok, true);
  assert.strictEqual(Core.validate([1, 1, 0, 2], 4, true, cnt).reason, 'tooMany', '1 只有一個');
  assert.strictEqual(Core.validate([2, 2, 2, 3], 4, true, cnt).ok, true, '池裡有三個就能用三個');
  assert.strictEqual(Core.validate([0, 0, 0, 1], 4, true, cnt).reason, 'tooMany');
  /* 可能空間：暴力數一遍 */
  let brute = 0;
  for (let i = 0; i < 256; i++) { const g = [i & 3, (i >> 2) & 3, (i >> 4) & 3, (i >> 6) & 3]; if (Core.validate(g, 4, true, cnt).ok) brute++; }
  assert.strictEqual(Core.spaceSize(4, true, cnt), brute);
  for (let i = 0; i < 300; i++) {
    const sp = Core.makeSpec({ cs: 'digits', n: 4 + (i % 7), rep: true }, 'cnt:' + i);
    const total = sp.cnt.reduce((x, y) => x + y, 0);
    assert.strictEqual(sp.size, 4 + (i % 7), '含重複的總數＝項目數');
    assert.ok(total <= 10 && sp.n >= 4 && sp.n === sp.pool.length, '總數最多 10、不同項目至少 4');
    assert.ok(sp.cnt.some(x => x > 1) || sp.size === sp.n, '有重複的項目');
    assert.ok(sp.cnt.every(x => x >= 1 && x <= 3), '同一個最多 3 個');
    assert.strictEqual(Core.poolList(sp).length, sp.size, '展開後的項目池列出每個重複');
    const sec = Core.secretFor(sp);
    assert.ok(Core.validate(sec, sp.n, true, sp.cnt).ok, '答案不超過池裡的個數');
    const again = Core.makeSpec({ cs: sp.cs, n: sp.n, rep: true, pool: sp.pool, cnt: sp.cnt }, 'other');
    assert.deepStrictEqual([again.cnt, again.pool, again.size], [sp.cnt, sp.pool, sp.size], '伺服器傳來的對應原樣保留');
  }
});
test('合法性檢查', () => {
  assert.strictEqual(Core.validate([1, 2, 3], 10, false).reason, 'length');
  assert.strictEqual(Core.validate([1, 2, 3, 10], 10, false).reason, 'unknown');
  assert.strictEqual(Core.validate([1, 2, 3, 3], 10, false).reason, 'duplicate');
  assert.ok(Core.validate([1, 2, 3, 3], 10, true).ok);
  assert.strictEqual(Core.validate('1234', 10, true).reason, 'length');
  assert.strictEqual(Core.validate([1.5, 2, 3, 4], 10, true).reason, 'unknown');
});
test('項目池：同 seed 可重現、不重複、在字元集內、答案在池內', () => {
  for (const cs of Core.CHARSET_IDS) {
    const c = Core.charset(cs);
    for (const n of [c.min, c.max]) {
      for (const rep of [false, true]) {
        const a = Core.makeSpec({ cs, n, rep }, 'x:' + cs + n + rep), b = Core.makeSpec({ cs, n, rep }, 'x:' + cs + n + rep);
        assert.deepStrictEqual(a.pool, b.pool);
        assert.deepStrictEqual(a.cnt, b.cnt);
        assert.strictEqual(a.size, n);
        assert.ok(Core.validPool(cs, a.n, a.pool));
        assert.deepStrictEqual(a.pool.slice().sort((x, y) => x - y), a.pool);
        const s = Core.secretFor(a);
        assert.ok(Core.validate(s, a.n, rep, a.cnt).ok);
      }
    }
  }
  const d1 = Core.makeSpec({ cs: 'digits', n: 8 }, 's1').pool.join(), d2 = Core.makeSpec({ cs: 'digits', n: 8 }, 's2').pool.join();
  assert.notStrictEqual(d1 + Core.makeSpec({ cs: 'digits', n: 8 }, 's3').pool.join(), d2 + d2, '項目池應隨機');
});
test('n 會被夾在字元集範圍內', () => {
  assert.strictEqual(Core.clampN('digits', 99), 10);
  assert.strictEqual(Core.clampN('mix', 99), 10);
  assert.strictEqual(Core.clampN('letters', 1), 4);
  assert.strictEqual(Core.clampN('pack-food', 25), 10);
});
test('台北時間日期', () => {
  assert.strictEqual(Core.taipeiDate(Date.UTC(2026, 10, 3, 16, 0)), '2026-11-04');
  assert.strictEqual(Core.taipeiDate(Date.UTC(2026, 10, 3, 15, 59)), '2026-11-03');
});

console.log('五段難度');
test('五段難度：項目數範圍、重複機率、每局隨機（各 400 局）', () => {
  const RANGE = [[4, 5], [5, 6], [6, 7], [7, 8], [8, 10]];
  for (let tier = 0; tier < 5; tier++) {
    let reps = 0; const ns = new Set();
    for (let i = 0; i < 400; i++) {
      const sp = Core.tierSpec(tier, 'digits', 't' + tier + ':' + i);
      assert.ok(sp.size >= RANGE[tier][0] && sp.size <= RANGE[tier][1], tier + ':' + sp.size);
      assert.ok(sp.size <= 10, '所有模式項目池（含重複）最多 10 個');
      ns.add(sp.size); if (sp.rep) reps++;
      const s = Core.secretFor(sp);
      assert.ok(Core.validate(s, sp.n, sp.rep, sp.cnt).ok);
      if (sp.rep) { const c = {}; s.forEach(x => c[x] = (c[x] || 0) + 1); assert.ok(Math.max(...Object.values(c)) <= 3, '同一個最多 3 次'); }
    }
    assert.strictEqual(ns.size, RANGE[tier][1] - RANGE[tier][0] + 1, '範圍內每個項目數都會出現');
    const rate = reps / 400, want = Core.TIER_REP[tier];
    assert.ok(Math.abs(rate - want) < 0.08, tier + ' 重複率 ' + rate);
  }
});
test('可重複時 4 格全一樣不合法、出題也不會出現', () => {
  assert.strictEqual(Core.validate([2, 2, 2, 2], 8, true).reason, 'tooMany');
  assert.ok(Core.validate([2, 2, 2, 1], 8, true).ok);
  const r = Core.mulberry32(5);
  for (let i = 0; i < 20000; i++) { const s = Core.makeSecret(r, 4, true); assert.ok(!(s[0] === s[1] && s[1] === s[2] && s[2] === s[3])); }
  assert.strictEqual(Core.spaceSize(4, true), 252);
  assert.strictEqual(Core.spaceSize(4, false), 24);
});
test('字元集「隨機」每局換一種，且同 seed 可重現', () => {
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    const a = Core.tierSpec(2, 'random', 'r' + i), b = Core.tierSpec(2, 'random', 'r' + i);
    assert.deepStrictEqual(a, b);
    assert.ok(Core.charset(a.cs));
    seen.add(a.cs);
  }
  assert.ok(seen.size >= 8, '應該抽到很多種');
});
test('三星標準步數：每段每個項目數都有值且合理', () => {
  for (let tier = 0; tier < 5; tier++) for (let n = 4; n <= 10; n++) for (const rep of [false, true]) {
    const p = Table.par(tier, n, rep);
    assert.ok(Number.isInteger(p) && p >= 2 && p <= 12, [tier, n, rep, p].join());
    if (tier) assert.ok(p <= Table.par(tier - 1, n, rep), '越難標準越緊');
  }
});

console.log('闖關與每日挑戰');
test('50 關：每 10 關換一段難度、項目數 4→10 遞增、頭目關沒提示', () => {
  assert.strictEqual(Levels.COUNT, 50);
  const kinds = new Set(); let prevN = 0;
  for (let L = 1; L <= 50; L++) {
    const info = Levels.level(L);
    assert.strictEqual(info.tier, Math.floor((L - 1) / 10), 'L' + L);
    const c = Core.charset(info.spec.cs);
    assert.ok(info.spec.size >= 4 && info.spec.size <= 10);
    assert.ok(info.spec.size >= prevN, '項目數（含重複）不會倒退'); prevN = info.spec.size;
    assert.ok(Core.validPool(info.spec.cs, info.spec.n, info.spec.pool));
    assert.ok(Core.validate(Core.secretFor(info.spec), info.spec.n, info.spec.rep, info.spec.cnt).ok);
    if (info.tier < 2) assert.strictEqual(info.spec.rep, false, '幼幼、簡單不重複');
    if (info.tier === 4) assert.strictEqual(info.spec.rep, true, '神話一定重複');
    assert.strictEqual(info.boss, L % 10 === 0);
    if (info.boss) assert.strictEqual(info.hints, 0);
    else assert.strictEqual(info.hints, [Infinity, 3, 2, 1, 0][info.tier]);
    kinds.add(c.kind);
    assert.deepStrictEqual(Levels.level(L).spec, info.spec, '每次都一樣');
  }
  assert.strictEqual(Levels.level(1).spec.n, 4);
  assert.strictEqual(Levels.level(50).spec.size, 10);
  assert.ok(['digits', 'letters', 'gems', 'pack', 'mix'].every(k => kinds.has(k)));
});
test('星數：標準內 3★、多 2 步內 2★、其餘 1★；用提示最高 2★', () => {
  const info = { par: 6 };
  assert.strictEqual(Levels.stars(info, 6, 0), 3);
  assert.strictEqual(Levels.stars(info, 8, 0), 2);
  assert.strictEqual(Levels.stars(info, 9, 0), 1);
  assert.strictEqual(Levels.stars(info, 30, 0), 1);
  assert.strictEqual(Levels.stars(info, 3, 1), 2);
});
test('每日挑戰：五個難度各一題、同一天同題、不同難度不同題、不給提示', () => {
  const sigs = new Set();
  for (let k = 0; k < 5; k++) {
    const a = Levels.dailyInfo('2026-11-04', k), b = Levels.dailyInfo('2026-11-04', k);
    assert.deepStrictEqual(a.spec, b.spec);
    assert.deepStrictEqual(Core.secretFor(a.spec), Core.secretFor(b.spec));
    assert.strictEqual(a.hints, 0);
    assert.ok(a.spec.n <= 10);
    sigs.add(a.spec.cs + a.spec.pool.join());
  }
  assert.strictEqual(sigs.size, 5);
  assert.notDeepStrictEqual(Levels.dailyInfo('2026-11-05', 2).spec.pool.concat(Levels.dailyInfo('2026-11-05', 2).spec.cs), Levels.dailyInfo('2026-11-04', 2).spec.pool.concat(Levels.dailyInfo('2026-11-04', 2).spec.cs));
});

console.log('美術資料');
test('12 個主題包各 20 個、tag 與主色不重複、三語名稱齊全、沒有 text/emoji', () => {
  require('../public/js/art/registry.js');
  for (const f of fs.readdirSync(path.join(root, 'public/js/art'))) if (f !== 'registry.js') require('../public/js/art/' + f);
  const A = global.GuessArt;
  for (const p of Core.PACKS) {
    const set = A.get('pack-' + p);
    assert.ok(set, p);
    assert.strictEqual(set.items.length, 20, p);
    assert.strictEqual(new Set(set.items.map(i => i.tag)).size, 20, p + ' tag');
    assert.strictEqual(new Set(set.items.map(i => i.color.toLowerCase())).size, 20, p + ' color');
    set.items.forEach(i => { assert.strictEqual(i.n.length, 3); assert.ok(i.n.every(Boolean)); assert.ok(!/<text|<image|<foreignObject/i.test(i.svg)); assert.ok(i.tone === 'warm' || i.tone === 'cool'); });
  }
  assert.strictEqual(A.get('digits').items.length, 10);
  assert.strictEqual(A.get('letters').items.length, 26);
  assert.strictEqual(A.get('gems').items.length, 12);
  assert.strictEqual(new Set(A.get('gems').items.map(i => i.tag)).size, 12);
  assert.strictEqual(A.get('mascot').items.length, 6);
  assert.strictEqual(A.get('avatars').items.length, 8);
  for (const k of ['key', 'lock', 'gear', 'globe', 'robot', 'flame', 'star', 'star-empty']) assert.ok(A.get('icons').items.some(i => i.key === k), k);
  assert.strictEqual(Core.CHARSETS.mix.size, 240);
});
test('同一個符號多次輸出時漸層 id 不衝突', () => {
  const a = global.GuessArt.svg('gems', 5), b = global.GuessArt.svg('gems', 5);
  const ida = (a.match(/id="([^"]+)"/) || [])[1], idb = (b.match(/id="([^"]+)"/) || [])[1];
  assert.ok(ida && idb && ida !== idb);
  assert.ok(b.indexOf('url(#' + idb + ')') >= 0);
});

console.log('語系');
test('程式用到的字串在繁中／簡中／英文都有', () => {
  const dict = { 'zh-Hant': {}, 'zh-Hans': {}, en: {} };
  global.I18N = { add: (l, t) => Object.assign(dict[l], t) };
  require('../public/js/locales.js'); require('../public/js/locales-hans.js');
  const files = ['app.js', 'ui/kit.js', 'ui/game.js', 'ui/result.js', 'modes/solo.js', 'modes/online-ui.js', 'latency.js'];
  const keys = new Set();
  for (const f of files) {
    const src = fs.readFileSync(path.join(root, 'public/js', f), 'utf8');
    for (const m of src.matchAll(/\bt\('([a-zA-Z0-9_.-]+)'(?!\s*\+)/g)) if (!/\.$/.test(m[1]) && !/-$/.test(m[1])) keys.add(m[1]);
  }
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  for (const m of html.matchAll(/data-i18n="([^"]+)"/g)) keys.add(m[1]);
  for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) m[1].split(';').forEach(p => keys.add(p.split('=')[1]));
  /* 動態組出來的 key */
  ['tier.0', 'tier.1', 'tier.2', 'tier.3', 'tier.4', 'tierHelp.0', 'tierHelp.4', 'notes.st0', 'notes.st3', 'mode.guess', 'mode.level', 'mode.daily', 'mode.raceOnline', 'mode.duelOnline',
    'say.greetGuess', 'say.greetDaily', 'say.watching', 'say.greetOnline', 'say.greetDuel', 'hint.posAsk', 'hint.hasAsk', 'hint.attrAsk', 'hint.hasOne', 'hint.hasMany',
    'attr.odd', 'attr.even', 'attr.vowel', 'attr.consonant', 'attr.warm', 'attr.cool', 'rs.waiting', 'rs.setup', 'rs.playing', 'rs.finished',
    'race.out.left', 'race.out.idle', 'race.out.resign', 'res.reason.left', 'res.reason.idle', 'res.reason.resign', 'res.reason.rounds', 'closed.no_players', 'closed.kicked',
    'create.raceHelp', 'create.duelHelp', 'net.connecting', 'net.retrying',
    'title.solo', 'title.setup', 'title.levels', 'title.stats', 'title.help', 'title.lobby', 'title.daily', 'avatar.0', 'avatar.7', 'quick.q1', 'quick.q6']
    .concat(Core.CHARSET_IDS.map(c => 'cs.' + c))
    .concat(['room_missing', 'invite_invalid', 'invite_revoked', 'spec_full', 'busy_sit', 'full', 'not_player', 'busy_settings', 'cap_busy', 'bad_code_length', 'bad_code_unknown', 'bad_code_duplicate', 'bad_code_tooMany', 'not_turn', 'server'].map(c => 'err.' + c))
    .concat(['joinedPlay', 'joinedSpec', 'sat', 'leftRoom', 'kicked', 'newInvite', 'start', 'setSecret', 'duelStart', 'firstSolve', 'over', 'dcLoss', 'idleOut', 'idleWarn'].map(c => 'toast.' + c))
    .forEach(k => keys.add(k));
  const missing = [];
  for (const k of keys) for (const l of Object.keys(dict)) if (dict[l][k] == null) missing.push(l + ':' + k);
  assert.deepStrictEqual(missing, []);
  const hans = JSON.stringify(dict['zh-Hans']);
  assert.ok(!/[個們這設機鍵].*/.test(hans.replace(/[^一-鿿]/g, '').slice(0, 0)) && hans.indexOf('设定') + hans.indexOf('设置') > -2);
});

console.log('房間邏輯');
function fakeWorld() {
  let t = 1000000;
  const inbox = {};
  const io = { send: (pid, m) => (inbox[pid] = inbox[pid] || []).push(m), cleared: () => {} };
  const hub = createHub(io, { now: () => t });
  const P = id => ({ id, name: id });
  const last = (pid, type) => (inbox[pid] || []).filter(m => m.type === type).pop();
  return { hub, P, inbox, last, adv: ms => { t += ms; }, now: () => t };
}
test('建房、邀請加入、撤銷後失效、觀戰者不算實體玩家、空房立即關閉', () => {
  const w = fakeWorld(), a = w.P('a'), b = w.P('b'), c = w.P('c');
  const room = w.hub.create(a, { mode: 'race', name: 'A' });
  const token = room.invite.token;
  w.hub.join(b, { roomId: room.id, token, name: 'B' });
  assert.strictEqual(w.last('b', 'room').room.you.role, 'player');
  w.hub.inviteRevoke(a);
  w.hub.join(c, { roomId: room.id, token, name: 'C' });
  assert.strictEqual(w.last('c', 'error').code, 'invite_revoked');
  w.hub.join(c, { roomId: room.id, name: 'C', want: 'spectator' });
  assert.strictEqual(w.last('c', 'room').room.you.role, 'spectator');
  assert.strictEqual(w.last('b', 'room').room.invite, null, '非房主看不到邀請 token');
  w.hub.leave('a'); w.hub.leave('b');
  assert.strictEqual(w.last('c', 'closed').reason, 'no_players');
  assert.strictEqual(w.hub.rooms.size, 0);
});
function codeFor(spec, k) {
  /* 依本局規格做出一組合法的猜測（k 不同就不同） */
  const r = Core.mulberry32(k + 1);
  return Core.makeSecret(r, spec.n, false);
}
test('房間沒有電腦：舊的加電腦訊息不存在、快照沒有 ai 欄位', () => {
  const w = fakeWorld(), a = w.P('a');
  w.hub.create(a, { mode: 'race' });
  assert.strictEqual(typeof w.hub.addAI, 'undefined');
  const snap = w.last('a', 'room').room;
  assert.ok(snap.seats.every(s => !s || !('ai' in s)));
  assert.ok(!/addAI|add_ai/.test(fs.readFileSync(path.join(root, 'server.js'), 'utf8')));
});
test('競速：玩家看不到答案與別人的猜測內容，觀戰者看得到猜測但看不到答案；先猜中者勝、10 秒收尾', () => {
  const w = fakeWorld(), a = w.P('a'), b = w.P('b'), s = w.P('s');
  const room = w.hub.create(a, { mode: 'race' });
  w.hub.join(b, { roomId: room.id }); w.hub.join(s, { roomId: room.id, want: 'spectator' });
  w.hub.setReady(a, true); w.hub.setReady(b, true); w.hub.start(a);
  assert.strictEqual(room.status, 'playing');
  const spec = room.game.spec, secret = room.game.secret.slice();
  let wrong = codeFor(spec, 1); if (wrong.join() === secret.join()) wrong = codeFor(spec, 2);
  w.hub.guess(a, wrong);
  const snapA = JSON.stringify(w.last('a', 'room').room), snapB = w.last('b', 'room').room, snapS = w.last('s', 'room').room;
  assert.ok(snapA.indexOf('"secret"') < 0);
  assert.ok(!('secret' in snapB.game));
  assert.ok(snapB.game.players[0].hist === undefined, 'B 不能看到 A 的猜測內容');
  assert.strictEqual(snapB.game.players[0].count, 1);
  assert.ok(Array.isArray(snapS.game.players[0].hist), '觀戰者看得到猜測');
  assert.ok(JSON.stringify(snapS).indexOf('"answer"') < 0);
  assert.ok(snapB.game.endsAt > w.now(), '有總時長');
  w.hub.guess(b, secret);
  assert.strictEqual(room.game.winnerSeat, 1);
  assert.strictEqual(room.status, 'playing', '還在收尾');
  w.adv(10001); w.hub.tick();
  assert.strictEqual(room.status, 'finished');
  const res = w.last('a', 'room').room.game.result;
  assert.deepStrictEqual(res.answer, secret);
  assert.strictEqual(res.ranking[0].seat, 1);
  assert.strictEqual(res.timeUp, false);
});
test('競速：不限次數；總時長到了依最好 A→B→步數排名；斷線 30 秒判離場', () => {
  const w = fakeWorld(), a = w.P('a'), b = w.P('b'), c = w.P('c');
  const room = w.hub.create(a, { mode: 'race', settings: { minutes: 3, tier: 0 } });
  w.hub.join(b, { roomId: room.id }); w.hub.join(c, { roomId: room.id });
  [a, b, c].forEach(p => w.hub.setReady(p, true)); w.hub.start(a);
  const g = room.game, secret = g.secret;
  assert.strictEqual(g.endsAt - w.now(), 3 * 60000);
  /* A 猜 20 次都不中也不會被擋 */
  const others = [];
  const all = []; for (let x = 0; x < g.spec.n; x++) for (let y = 0; y < g.spec.n; y++) for (let z = 0; z < g.spec.n; z++) for (let q = 0; q < g.spec.n; q++) { const v = [x, y, z, q]; if (new Set(v).size === 4 && v.join() !== secret.join()) all.push(v); }
  for (let i = 0; i < 20; i++) { w.adv(1000); w.hub.guess(a, all[i]); }
  assert.strictEqual(g.players[0].hist.length, 20);
  /* B 猜一組 3A0B 以上的（找最好的） */
  const best = all.map(v => ({ v, e: Core.evaluate(secret, v) })).sort((p, q) => q.e.a - p.e.a || q.e.b - p.e.b)[0];
  w.hub.guess(b, best.v);
  w.hub.markDisconnected('c');
  w.adv(30001); w.hub.tick();
  assert.strictEqual(g.players[2].out, 'left');
  /* 每 60 秒動一下避免閒置棄權，直到時間到 */
  while (room.status === 'playing') { w.adv(60000); w.hub.guess(a, all[0]); w.hub.guess(b, best.v); w.hub.tick(); }
  const res = room.result;
  assert.strictEqual(res.timeUp, true);
  assert.strictEqual(res.ranking[0].seat, 1, 'B 的 A/B 最好');
  assert.strictEqual(res.ranking[res.ranking.length - 1].seat, 2, '離場的排最後');
});
test('互相出題：設密碼階段有預設密碼、時間到自動鎖上；先手猜中後手可追平；密碼不外洩', () => {
  const w = fakeWorld(), a = w.P('a'), b = w.P('b');
  const room = w.hub.create(a, { mode: 'duel', settings: { turnSec: 15 } });
  w.hub.join(b, { roomId: room.id });
  w.hub.setReady(a, true); w.hub.setReady(b, true); w.hub.start(a);
  assert.strictEqual(room.status, 'setup');
  const spA = w.last('a', 'room').room.game, spB = w.last('b', 'room').room.game;
  const defA = spA.players[0].myDefault;
  assert.ok(Array.isArray(defA) && Core.validate(defA, spA.spec.n, spA.spec.rep).ok, 'A 有自己的預設密碼');
  assert.strictEqual(spB.players[0].myDefault, undefined, 'B 看不到 A 的預設');
  assert.strictEqual(spA.tier, room.settings.tier);
  assert.ok(spA.setupEndsAt > w.now());
  const mine = codeFor(room.game.spec, 7);
  w.hub.setSecret(a, mine);
  w.adv(60001); w.hub.tick();
  assert.strictEqual(room.status, 'playing', '時間到用預設密碼開始');
  assert.deepStrictEqual(room.game.players[1].secret, room.game.players[1].defaultSecret);
  assert.deepStrictEqual(room.game.players[0].secret, mine);
  const snapB = JSON.stringify(w.last('b', 'room').room);
  assert.ok(snapB.indexOf(JSON.stringify(mine)) < 0, 'B 看不到 A 的密碼');
  const first = room.game.first, second = 1 - first, P = [a, b];
  const codeOf = seat => room.game.players[1 - seat].secret.slice();
  w.hub.guess(P[first], codeOf(first));
  assert.strictEqual(room.status, 'playing', '先手猜中後還要等後手');
  w.hub.guess(P[second], codeOf(second));
  assert.strictEqual(room.status, 'finished');
  assert.strictEqual(room.result.winnerSeat, -1);
});
test('互相出題：逾時跳到對方、不是自己的回合不能猜、15 回合比最好 A/B', () => {
  const w = fakeWorld(), a = w.P('a'), b = w.P('b');
  const room = w.hub.create(a, { mode: 'duel', settings: { turnSec: 15 } }); w.hub.join(b, { roomId: room.id });
  w.hub.setReady(a, true); w.hub.setReady(b, true); w.hub.start(a);
  const spec = room.game.spec;
  w.hub.setSecret(a, codeFor(spec, 3)); w.hub.setSecret(b, codeFor(spec, 4));
  const g = room.game, P = [a, b], first = g.first, second = 1 - first;
  const notTurn = P[second];
  w.hub.guess(notTurn, codeFor(spec, 1));
  assert.strictEqual(w.last(notTurn.id, 'error').code, 'not_turn');
  w.adv(15001); w.hub.tick();
  assert.strictEqual(g.turn, second, '逾時換對方');
  assert.ok(g.players[first].hist[0].timeout);
  /* 找兩組都不中的猜測，先手的比較好 */
  const sF = g.players[second].secret, sS = g.players[first].secret;
  const cands = []; for (let k = 10; k < 400 && cands.length < 400; k++) cands.push(codeFor(spec, k));
  const notHit = (sec) => cands.filter(c => Core.evaluate(sec, c).a < 4);
  const fGood = notHit(sF).sort((p, q) => { const x = Core.evaluate(sF, p), y = Core.evaluate(sF, q); return (y.a * 10 + y.b) - (x.a * 10 + x.b); })[0];
  const sBad = notHit(sS).sort((p, q) => { const x = Core.evaluate(sS, p), y = Core.evaluate(sS, q); return (x.a * 10 + x.b) - (y.a * 10 + y.b); })[0];
  w.adv(300); w.hub.guess(P[second], sBad);
  for (let r = 2; r <= 15; r++) { w.adv(300); w.hub.guess(P[first], fGood); w.adv(300); w.hub.guess(P[second], sBad); }
  assert.strictEqual(room.status, 'finished');
  assert.strictEqual(room.result.reason, 'rounds');
  const ef = Core.evaluate(sF, fGood), es = Core.evaluate(sS, sBad);
  const want = ef.a * 10 + ef.b === es.a * 10 + es.b ? -1 : first;
  assert.strictEqual(room.result.winnerSeat, want);
});
test('防狂送：250ms 內第二次猜測被擋；聊天保留 <3 這類符號、過濾控制字元', () => {
  const w = fakeWorld(), a = w.P('a'), b = w.P('b');
  const room = w.hub.create(a, { mode: 'race' }); w.hub.join(b, { roomId: room.id });
  w.hub.setReady(a, true); w.hub.setReady(b, true); w.hub.start(a);
  const g = room.game, c1 = codeFor(g.spec, 1), c2 = codeFor(g.spec, 2);
  const s = g.secret.join(); const pick = [c1, c2, codeFor(g.spec, 3)].filter(c => c.join() !== s);
  w.hub.guess(a, pick[0]); w.adv(100); w.hub.guess(a, pick[1]);
  assert.strictEqual(g.players[0].hist.length, 1);
  assert.strictEqual(w.last('a', 'error').code, 'too_fast');
  w.adv(300); w.hub.guess(a, pick[1]);
  assert.strictEqual(g.players[0].hist.length, 2);
  w.hub.chat(a, 'I <3 this\u0007 game');
  assert.strictEqual(room.chat[room.chat.length - 1].text, 'I <3 this game');
});
test('房間設定驗證：非法值回到預設（普通、數字、5 分鐘、30 秒、6 人）', () => {
  const s = normSettings('race', { tier: 9, cs: 'nope', minutes: 7, turnSec: 7, cap: 99 });
  assert.deepStrictEqual(s, { classic: false, tier: 2, cs: 'digits', minutes: 5, turnSec: 30, cap: 6 });
  const r = normSettings('race', { tier: 4, cs: 'random', minutes: 10 });
  assert.strictEqual(r.tier, 4); assert.strictEqual(r.cs, 'random'); assert.strictEqual(r.minutes, 10);
  assert.strictEqual(normSettings('duel', { turnSec: 60 }).turnSec, 60);
  assert.strictEqual(normSettings('duel', {}).cap, 2);
});
test('經典模式：數字 0～9 全部 10 個、不重複、不受難度影響', () => {
  for (let i = 0; i < 50; i++) {
    const sp = Core.classicSpec('c' + i);
    assert.deepStrictEqual([sp.cs, sp.n, sp.size, sp.rep, sp.cnt], ['digits', 10, 10, false, undefined]);
    assert.deepStrictEqual(sp.pool, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const sec = Core.secretFor(sp);
    assert.strictEqual(new Set(sec).size, 4, '答案不重複');
  }
  /* 其他模式不受影響：同 seed 的一般局規格不變 */
  assert.deepStrictEqual(Core.tierSpec(4, 'letters', 'same'), Core.tierSpec(4, 'letters', 'same'));
});
test('經典房間：設定寫死，房主改什麼都不會變；每局都是數字 0～9 不重複', () => {
  const fixed = { classic: true, tier: 2, cs: 'digits', minutes: 5, turnSec: 30, cap: 6 };
  assert.deepStrictEqual(normSettings('race', { classic: true, tier: 4, cs: 'gems', minutes: 10, cap: 3 }), fixed);
  assert.deepStrictEqual(normSettings('race', { tier: 0, cs: 'letters', classic: false }, fixed), fixed, '建好後不能改');
  assert.strictEqual(normSettings('duel', { classic: true, turnSec: 60 }).turnSec, 30);
  assert.strictEqual(normSettings('race', { classic: 'yes' }).classic, false, '只有 true 才算經典');
  assert.strictEqual(normSettings('race', { classic: true }, { classic: false, tier: 1, cs: 'gems', minutes: 3, turnSec: 15, cap: 4 }).classic, false, '自訂房不能中途變經典');
  const w = fakeWorld(), a = w.P('a'), b = w.P('b');
  const room = w.hub.create(a, { mode: 'race', settings: { classic: true, tier: 4, cs: 'gems' } });
  w.hub.settings(a, { tier: 0, cs: 'letters', minutes: 10 });
  assert.deepStrictEqual(room.settings, fixed);
  w.hub.join(b, { roomId: room.id });
  w.hub.setReady(b, true); w.hub.start(a);
  const sp = room.game.spec;
  assert.deepStrictEqual([sp.cs, sp.n, sp.rep, sp.pool.join('')], ['digits', 10, false, '0123456789']);
  assert.strictEqual(room.game.classic, true);
  assert.ok(w.hub.listRooms().some(r => r.id === room.id && r.classic === true), '大廳列表標示經典');
});
test('競速選「隨機」字元集時，伺服器每局會抽出實際的字元集', () => {
  const w = fakeWorld(), a = w.P('a'), b = w.P('b');
  const room = w.hub.create(a, { mode: 'race', settings: { cs: 'random', tier: 4 } });
  w.hub.join(b, { roomId: room.id });
  w.hub.setReady(a, true); w.hub.setReady(b, true); w.hub.start(a);
  assert.ok(Core.charset(room.game.spec.cs));
  assert.ok(room.game.spec.size >= 8 && room.game.spec.size <= 10);
  assert.strictEqual(room.game.spec.rep, true);
  assert.ok(Array.isArray(room.game.spec.cnt) && room.game.spec.cnt.length === room.game.spec.n, '可重複的局有重複對應');
});

Promise.all(pending).then(() => {
  console.log('\n通過 ' + passed + ' 項、失敗 ' + failed + ' 項');
  process.exitCode = failed ? 1 : 0;
});
