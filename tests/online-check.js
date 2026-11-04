/* ===== tests/online-check.js — 線上端對端測試（真的開伺服器、用 WebSocket 連）=====
 * 用法：node tests/online-check.js   （Node 22 以上內建 WebSocket）
 * 驗證：建房、邀請加入、觀戰、互相出題完整一局、密碼不外洩、聊天頻道、離開後空房關閉、/health。
 */
'use strict';
process.env.PORT = '0';
const assert = require('assert');
const { server } = require('../server.js');

function client(port, name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:' + port + '/ws');
    const msgs = [];
    const waiters = [];
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.type === 'hb') { ws.send(JSON.stringify({ type: 'hb' })); return; }
      msgs.push(m);
      for (const w of waiters.slice()) if (w.pred(m)) { waiters.splice(waiters.indexOf(w), 1); w.res(m); }
    };
    ws.onerror = reject;
    ws.onopen = () => {
      const c = {
        ws, msgs,
        send: o => ws.send(JSON.stringify(o)),
        wait: (pred, ms) => new Promise((res, rej) => {
          const hit = msgs.slice().reverse().find(pred);
          if (hit && !ms) { /* 只等新的 */ }
          const w = { pred, res };
          waiters.push(w);
          setTimeout(() => rej(new Error(name + ' 等不到訊息')), ms || 4000);
        }),
        room: () => { const r = msgs.filter(m => m.type === 'room').pop(); return r && r.room; }
      };
      c.send({ type: 'hello', name: name, clientId: 'test-' + name + '-' + Math.random().toString(36).slice(2) });
      c.wait(m => m.type === 'welcome').then(() => resolve(c), reject);
    };
  });
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const health = await (await fetch('http://127.0.0.1:' + port + '/health')).json();
  assert.strictEqual(health.ok, true);
  const presence = await fetch('http://127.0.0.1:' + port + '/api/presence');
  assert.notStrictEqual(presence.status, 200, '不提供 /api/presence');

  const A = await client(port, '甲'), B = await client(port, '乙'), S = await client(port, '丙');
  A.send({ type: 'create', mode: 'duel', name: '甲', settings: { tier: 0, cs: 'pack-fruit', turnSec: 30 } });
  const r1 = await A.wait(m => m.type === 'room');
  const id = r1.room.id, token = r1.room.invite.token;
  assert.ok(token, '房主拿得到邀請 token');
  B.send({ type: 'join', roomId: id, token: token, name: '乙', want: 'player' });
  const rb = await B.wait(m => m.type === 'room' && m.room.you.role === 'player');
  assert.strictEqual(rb.room.invite, null);
  S.send({ type: 'join', roomId: id, name: '丙', want: 'spectator' });
  await S.wait(m => m.type === 'room' && m.room.you.role === 'spectator');

  A.send({ type: 'ready', value: true }); B.send({ type: 'ready', value: true });
  const setup = await A.wait(m => m.type === 'room' && m.room.status === 'setup');
  const n = setup.room.game.spec.pool.length;
  assert.ok(n >= 4 && n <= 5 && setup.room.game.spec.rep === false, '幼幼：4～5 個項目、不重複');
  const setupB = (B.room() && B.room().status === 'setup') ? B.room() : (await B.wait(m => m.type === 'room' && m.room.status === 'setup')).room;
  const defB = setupB.game.players[1].myDefault;
  assert.ok(Array.isArray(defB) && defB.length === 4, '乙拿到預設密碼');
  assert.strictEqual(setup.room.game.players[1].myDefault, undefined, '甲看不到乙的預設密碼');
  A.send({ type: 'secret', code: [0, 1, 2, 3] });
  B.send({ type: 'secret', code: defB });
  const play = await B.wait(m => m.type === 'room' && m.room.status === 'playing');
  assert.strictEqual(play.room.game.players[0].mySecret, undefined, '乙看不到甲的密碼');
  const sp = await S.wait(m => m.type === 'room' && m.room.status === 'playing');
  assert.ok(JSON.stringify(sp.room).indexOf('mySecret') < 0, '觀戰者看不到密碼');

  /* 聊天：對局中觀戰者發言，玩家收不到 */
  S.send({ type: 'chat', text: '觀戰頻道測試' });
  await S.wait(m => m.type === 'chat');
  await new Promise(r => setTimeout(r, 200));
  assert.ok(!A.msgs.some(m => m.type === 'chat' && m.msg.text === '觀戰頻道測試'), '玩家不該收到觀戰頻道');

  const first = play.room.game.first;
  const P = [A, B], codeFor = seat => seat === 0 ? defB.slice() : [0, 1, 2, 3];
  let miss = codeFor(first).slice().reverse();
  if (miss.join() === codeFor(first).join() || new Set(miss).size < 4) miss = [0, 1, 2, 3].join() === codeFor(first).join() ? [1, 0, 2, 3] : [0, 1, 2, 3];
  P[first].send({ type: 'guess', code: miss });
  await P[1 - first].wait(m => m.type === 'room' && m.room.game && m.room.game.turn === 1 - first);
  P[1 - first].send({ type: 'guess', code: codeFor(1 - first) });
  const fin = await A.wait(m => m.type === 'room' && m.room.status === 'finished');
  assert.strictEqual(fin.room.game.result.winnerSeat, 1 - first);
  assert.deepStrictEqual(fin.room.game.result.secrets, [[0, 1, 2, 3], defB]);

  /* 撤銷邀請後，用舊 token 加入會失敗 */
  A.send({ type: 'invite_revoke' });
  await A.wait(m => m.type === 'room' && m.room.invite && m.room.invite.revoked);
  const D = await client(port, '丁');
  D.send({ type: 'join', roomId: id, token: token, name: '丁' });
  const e = await D.wait(m => m.type === 'error');
  assert.strictEqual(e.code, 'invite_revoked');

  /* 兩位玩家離開 → 房間關閉，觀戰者收到 closed */
  A.send({ type: 'leave' }); B.send({ type: 'leave' });
  const cl = await S.wait(m => m.type === 'closed');
  assert.strictEqual(cl.reason, 'no_players');
  const rooms = await (await fetch('http://127.0.0.1:' + port + '/api/rooms')).json();
  assert.strictEqual(rooms.rooms.length, 0);

  for (const c of [A, B, S, D]) c.ws.close();
  server.close();
  console.log('✓ 線上端對端測試全部通過（建房、邀請、觀戰、互相出題一局、密碼不外洩、觀戰頻道、撤銷邀請、空房關閉）');
  process.exit(0);
})().catch(err => { console.error('✗ 線上測試失敗：', err && err.stack || err); process.exit(1); });
