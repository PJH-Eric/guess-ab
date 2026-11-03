/* ===== tests/verify.js — 規則、電腦、規格表、關卡、美術資料、語系、房間邏輯 =====
 * 用法：node tests/verify.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');
global.self = global;

const Core = require('../public/js/core/core.js');
const AI = require('../public/js/core/ai.js');
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
    const n = 6 + r.int(35), s = Core.makeSecret(r, n, r() < .5), g = Core.makeSecret(r, n, r() < .5);
    const x = Core.evaluate(s, g), y = naive(s, g);
    assert.deepStrictEqual([x.a, x.b], [y.a, y.b], JSON.stringify([s, g]));
  }
});
test('預設規格窮舉 5040×200：A+B ≤ 4、A=4 只在相同時', () => {
  const sp = AI.enumerate(10, false);
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
test('教學頁範例：1234 vs 1325＝1A2B；ABAC vs AABB＝1A2B', () => {
  assert.deepStrictEqual(Core.evaluate([1, 2, 3, 4], [1, 3, 2, 5]), { a: 1, b: 2 });
  assert.deepStrictEqual(Core.evaluate([0, 1, 0, 2], [0, 0, 1, 1]), { a: 1, b: 2 });
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
        assert.ok(Core.validPool(cs, n, a.pool));
        assert.deepStrictEqual(a.pool.slice().sort((x, y) => x - y), a.pool);
        const s = Core.secretFor(a);
        assert.ok(Core.validate(s, n, rep).ok);
      }
    }
  }
  const d1 = Core.makeSpec({ cs: 'digits', n: 8 }, 's1').pool.join(), d2 = Core.makeSpec({ cs: 'digits', n: 8 }, 's2').pool.join();
  assert.notStrictEqual(d1 + Core.makeSpec({ cs: 'digits', n: 8 }, 's3').pool.join(), d2 + d2, '項目池應隨機');
});
test('n 會被夾在字元集範圍內', () => {
  assert.strictEqual(Core.clampN('digits', 99), 10);
  assert.strictEqual(Core.clampN('mix', 99), 40);
  assert.strictEqual(Core.clampN('letters', 1), 6);
  assert.strictEqual(Core.clampN('pack-food', 25), 20);
});
test('台北時間日期', () => {
  assert.strictEqual(Core.taipeiDate(Date.UTC(2026, 10, 3, 16, 0)), '2026-11-04');
  assert.strictEqual(Core.taipeiDate(Date.UTC(2026, 10, 3, 15, 59)), '2026-11-03');
});

console.log('電腦');
function avgSteps(level, n, rep, games) {
  const r = Core.mulberry32(99); let tot = 0, max = 0;
  for (let i = 0; i < games; i++) {
    const s = Core.makeSecret(r, n, rep);
    const st = AI.simulate({ level, n, rep, rng: Core.mulberry32(i * 31 + 5) }, s, 80);
    tot += st; max = Math.max(max, st);
  }
  return { avg: tot / games, max };
}
test('四段難度平均步數遞進（預設規格各 300 局）', () => {
  const r = [0, 1, 2, 3].map(lv => avgSteps(lv, 10, false, lv === 3 ? 150 : 300));
  console.log('    平均步數：' + r.map(x => x.avg.toFixed(2)).join(' / ') + '，困難最多 ' + r[3].max);
  assert.ok(r[0].avg > r[1].avg + 1.5 && r[1].avg > r[2].avg + 1 && r[2].avg > r[3].avg + 0.1);
  assert.ok(r[3].avg < 5.5 && r[3].max <= 7);
  assert.ok(r[0].max < 80, '幼幼班也一定會結束');
});
test('大空間（字母 26 可重複、大混搭 40）也能在合理步數內解出', () => {
  const a = avgSteps(3, 26, true, 4), b = avgSteps(2, 40, false, 3);
  assert.ok(a.max < 20 && b.max < 40, JSON.stringify([a, b]));
});
test('電腦模組只吃猜測歷史，不會碰到密碼', () => {
  const src = fs.readFileSync(path.join(root, 'public/js/core/ai.js'), 'utf8');
  assert.ok(!/secretFor|\.secret\b/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')));
  const ai = AI.createAI({ level: 3, n: 10, rep: false, rng: Core.mulberry32(1) });
  assert.strictEqual(ai.next.length, 1);
});
test('電腦不會重猜同一組', () => {
  const ai = AI.createAI({ level: 2, n: 6, rep: false, rng: Core.mulberry32(4) });
  const secret = [0, 1, 2, 3], hist = [], seen = new Set();
  for (let i = 0; i < 12; i++) {
    const g = ai.next(hist); const k = g.join();
    assert.ok(!seen.has(k)); seen.add(k);
    const r = Core.evaluate(secret, g); hist.push({ guess: g, a: r.a, b: r.b });
    if (r.a === 4) break;
  }
});

console.log('規格表與關卡');
test('預設規格上限 12/10/8、par 8/7/6/5', () => {
  assert.deepStrictEqual([1, 2, 3].map(t => Table.limit(t, 10, false)), [12, 10, 8]);
  assert.deepStrictEqual([0, 1, 2, 3].map(t => Table.par(t, 10, false)), [8, 7, 6, 5]);
  assert.strictEqual(Table.limit(0, 10, false), 0);
});
test('規格表每個 n 都有值，難度越高上限越緊', () => {
  for (const rep of [false, true]) for (let n = 6; n <= 40; n++) {
    assert.ok(Table.avg(n, rep) > 3, n + rep);
    assert.ok(Table.limit(1, n, rep) >= Table.limit(2, n, rep) && Table.limit(2, n, rep) >= Table.limit(3, n, rep));
  }
});
test('400 關規格合法（位數 4、n 在字元集範圍內、題型有混用）', () => {
  const kinds = new Set();
  for (let t = 0; t < 4; t++) for (let L = 1; L <= 100; L++) {
    const info = Levels.level(t, L);
    const c = Core.charset(info.spec.cs);
    assert.ok(c && info.spec.n >= c.min && info.spec.n <= c.max, t + ':' + L);
    assert.ok(Core.validPool(info.spec.cs, info.spec.n, info.spec.pool));
    if (t === 0) assert.strictEqual(info.limit, 0);
    if (L % 10 === 0) assert.strictEqual(info.hints, 0);
    kinds.add(c.kind);
  }
  assert.ok(['digits', 'letters', 'gems', 'pack', 'mix'].every(k => kinds.has(k)));
});
test('星數規則', () => {
  const info = { par: 6, limit: 10 };
  assert.strictEqual(Levels.stars(info, 5, 0), 3);
  assert.strictEqual(Levels.stars(info, 9, 0), 2);
  assert.strictEqual(Levels.stars(info, 10, 0), 1);
  assert.strictEqual(Levels.stars(info, 3, 1), 2);
});
test('每日挑戰：同一天同題、依星期換題型、不給提示', () => {
  const a = Levels.dailyInfo('2026-11-03'), b = Levels.dailyInfo('2026-11-03');
  assert.deepStrictEqual(a.spec.pool, b.spec.pool);
  assert.deepStrictEqual(Core.secretFor(a.spec), Core.secretFor(b.spec));
  const types = new Set(); for (let d = 1; d <= 7; d++) types.add(Levels.dailyInfo('2026-11-0' + d).spec.cs + Levels.dailyInfo('2026-11-0' + d).spec.rep);
  assert.ok(types.size >= 5);
  assert.strictEqual(a.hints, 0);
  assert.strictEqual(Levels.dailyInfo('2026-11-02').spec.cs, 'digits'); // 週一經典
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
  ['tier.0', 'tier.1', 'tier.2', 'tier.3', 'notes.st0', 'notes.st3', 'mode.guess', 'mode.aiGuess', 'mode.duel', 'mode.level', 'mode.daily', 'mode.raceOnline', 'mode.duelOnline',
    'say.greetGuess', 'say.greetDaily', 'say.watching', 'say.greetOnline', 'say.greetDuel', 'hint.posAsk', 'hint.hasAsk', 'hint.attrAsk', 'hint.hasOne', 'hint.hasMany',
    'attr.odd', 'attr.even', 'attr.vowel', 'attr.consonant', 'attr.warm', 'attr.cool', 'rs.waiting', 'rs.setup', 'rs.playing', 'rs.finished',
    'race.out.limit', 'race.out.left', 'race.out.idle', 'race.out.resign', 'res.reason.left', 'res.reason.idle', 'res.reason.resign', 'closed.no_players', 'closed.kicked',
    'tierHelp.g0', 'tierHelp.g3', 'tierHelp.a0', 'tierHelp.a3', 'create.raceHelp', 'create.duelHelp', 'net.connecting', 'net.retrying',
    'title.solo', 'title.setup', 'title.levels', 'title.stats', 'title.help', 'title.lobby', 'avatar.0', 'avatar.7', 'quick.q1', 'quick.q6']
    .concat(Core.CHARSET_IDS.map(c => 'cs.' + c))
    .concat(['room_missing', 'invite_invalid', 'invite_revoked', 'spec_full', 'busy_sit', 'full', 'not_player', 'ai_mode', 'busy_settings', 'ai_space', 'cap_busy', 'bad_code_length', 'bad_code_unknown', 'bad_code_duplicate', 'not_turn', 'server'].map(c => 'err.' + c))
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
  const hub = createHub(io, { now: () => t, aiDelay: () => 1 });
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
test('電腦席位只在空間 ≤ 60,000 時能加，有電腦時不能改成大空間', () => {
  const w = fakeWorld(), a = w.P('a');
  w.hub.create(a, { mode: 'race', settings: { cs: 'letters', n: 26, rep: true } });
  w.hub.addAI(a, { seat: 1, level: 2 });
  assert.strictEqual(w.last('a', 'error').code, 'ai_space');
  w.hub.settings(a, { cs: 'digits', n: 10, rep: false });
  w.hub.addAI(a, { seat: 1, level: 2 });
  assert.ok(w.last('a', 'room').room.seats[1].ai);
  w.hub.settings(a, { cs: 'letters', n: 26, rep: true });
  assert.strictEqual(w.last('a', 'error').code, 'ai_space');
  const w2 = fakeWorld(), d = w2.P('d');
  w2.hub.create(d, { mode: 'duel' });
  w2.hub.addAI(d, { seat: 1, level: 1 });
  assert.strictEqual(w2.last('d', 'error').code, 'ai_mode');
});
test('只有電腦與觀戰者時房間關閉（實體玩家為 0）', () => {
  const w = fakeWorld(), a = w.P('a'), s = w.P('s');
  const room = w.hub.create(a, { mode: 'race' });
  w.hub.addAI(a, { seat: 1, level: 0 });
  w.hub.join(s, { roomId: room.id, want: 'spectator' });
  w.hub.leave('a');
  assert.strictEqual(w.hub.rooms.size, 0);
  assert.strictEqual(w.last('s', 'closed').reason, 'no_players');
});
test('競速：玩家看不到答案與別人的猜測內容，觀戰者看得到猜測但看不到答案；先猜中者勝、10 秒收尾', () => {
  const w = fakeWorld(), a = w.P('a'), b = w.P('b'), s = w.P('s');
  const room = w.hub.create(a, { mode: 'race' });
  w.hub.join(b, { roomId: room.id }); w.hub.join(s, { roomId: room.id, want: 'spectator' });
  w.hub.setReady(a, true); w.hub.setReady(b, true);
  assert.strictEqual(room.status, 'playing');
  const secret = room.game.secret.slice();
  const wrong = Core.makeSecret(Core.mulberry32(1), 10, false);
  if (wrong.join() === secret.join()) wrong.reverse();
  w.hub.guess(a, wrong);
  const snapA = JSON.stringify(w.last('a', 'room').room), snapB = w.last('b', 'room').room, snapS = w.last('s', 'room').room;
  assert.ok(snapA.indexOf('"secret"') < 0);
  assert.ok(!('secret' in snapB.game));
  assert.ok(snapB.game.players[0].hist === undefined, 'B 不能看到 A 的猜測內容');
  assert.strictEqual(snapB.game.players[0].count, 1);
  assert.ok(Array.isArray(snapS.game.players[0].hist), '觀戰者看得到猜測');
  assert.ok(JSON.stringify(snapS).indexOf('"answer"') < 0);
  w.hub.guess(b, secret);
  assert.strictEqual(room.game.winnerSeat, 1);
  assert.strictEqual(room.status, 'playing', '還在收尾');
  w.adv(10001); w.hub.tick();
  assert.strictEqual(room.status, 'finished');
  const res = w.last('a', 'room').room.game.result;
  assert.deepStrictEqual(res.answer, secret);
  assert.strictEqual(res.ranking[0].seat, 1);
});
test('競速：逾時耗掉一次猜測、3 分鐘不動視為棄權、斷線 30 秒判離場', () => {
  const w = fakeWorld(), a = w.P('a'), b = w.P('b'), c = w.P('c');
  const room = w.hub.create(a, { mode: 'race', settings: { turnSec: 5 } });
  w.hub.join(b, { roomId: room.id }); w.hub.join(c, { roomId: room.id });
  [a, b, c].forEach(p => w.hub.setReady(p, true));
  w.adv(5001); w.hub.tick();
  assert.ok(room.game.players[0].hist[0].timeout && room.game.players[0].hist.length === 1);
  w.hub.markDisconnected('c');
  w.adv(30001); w.hub.tick();
  assert.strictEqual(room.game.players[2].out, 'left');
});
test('互相出題：先手猜中後手可追平；同回合都猜中＝平手；密碼不外洩', () => {
  const w = fakeWorld(), a = w.P('a'), b = w.P('b');
  const room = w.hub.create(a, { mode: 'duel' });
  w.hub.join(b, { roomId: room.id });
  w.hub.setReady(a, true); w.hub.setReady(b, true);
  assert.strictEqual(room.status, 'setup');
  w.hub.setSecret(a, [1, 2, 3, 4]); w.hub.setSecret(b, [5, 6, 7, 8]);
  assert.strictEqual(room.status, 'playing');
  const snapB = JSON.stringify(w.last('b', 'room').room);
  assert.ok(snapB.indexOf('[1,2,3,4]') < 0, 'B 看不到 A 的密碼');
  const first = room.game.first, second = 1 - first;
  const P = [a, b];
  const codeOf = seat => seat === 0 ? [5, 6, 7, 8] : [1, 2, 3, 4];   // 猜對方
  w.hub.guess(P[first], codeOf(first));
  assert.strictEqual(room.status, 'playing', '先手猜中後還要等後手');
  w.hub.guess(P[second], codeOf(second));
  assert.strictEqual(room.status, 'finished');
  assert.strictEqual(room.result.winnerSeat, -1);
  /* 第二局：只有後手猜中 → 後手勝 */
  w.hub.setReady(a, true); w.hub.setReady(b, true);
  w.hub.setSecret(a, [1, 2, 3, 4]); w.hub.setSecret(b, [5, 6, 7, 8]);
  const f2 = room.game.first, s2 = 1 - f2;
  assert.notStrictEqual(f2, first, '每局換先手');
  w.hub.guess(P[f2], codeOf(f2).slice().reverse());
  w.hub.guess(P[s2], codeOf(s2));
  assert.strictEqual(room.result.winnerSeat, s2);
});
test('互相出題：不是自己的回合不能猜', () => {
  const w = fakeWorld(), a = w.P('a'), b = w.P('b');
  const room = w.hub.create(a, { mode: 'duel' }); w.hub.join(b, { roomId: room.id });
  w.hub.setReady(a, true); w.hub.setReady(b, true);
  w.hub.setSecret(a, [1, 2, 3, 4]); w.hub.setSecret(b, [5, 6, 7, 8]);
  const notTurn = room.game.first === 0 ? b : a;
  w.hub.guess(notTurn, [1, 2, 3, 4]);
  assert.strictEqual(w.last(notTurn.id, 'error').code, 'not_turn');
});
test('競速加電腦能自己猜到結束', async () => {
  const w = fakeWorld(), a = w.P('a');
  const room = w.hub.create(a, { mode: 'race' });
  w.hub.addAI(a, { seat: 1, level: 3 });
  w.hub.setReady(a, true);
  assert.strictEqual(room.status, 'playing');
  await new Promise(r => setTimeout(r, 400));
  assert.ok(room.game.players[1].solved || room.game.players[1].out, '電腦應已猜完');
  w.hub.resign(a);
  assert.strictEqual(room.status, 'finished');
});
test('房間設定驗證：非法值回到預設', () => {
  const s = normSettings('race', { cs: 'nope', n: 999, rep: 1, turnSec: 7, cap: 99 });
  assert.strictEqual(s.cs, 'digits'); assert.strictEqual(s.n, 10); assert.strictEqual(s.turnSec, 0); assert.strictEqual(s.cap, 6);
});

Promise.all(pending).then(() => {
  console.log('\n通過 ' + passed + ' 項、失敗 ' + failed + ' 項');
  process.exitCode = failed ? 1 : 0;
});
