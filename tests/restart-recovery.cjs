'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const test = require('node:test');

function start(filename) {
  const child = spawn(process.execPath, ['-e', `
    const { server } = require('./server.js');
    server.listen(0, '127.0.0.1', () => console.log(server.address().port));
  `], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, GUESS_ROOM_DB_PATH: filename, GUESS_COUNTDOWN_MS: '0' },
    stdio: ['ignore', 'pipe', 'inherit']
  });
  const port = Promise.race([
    once(child.stdout, 'data').then(([data]) => Number(String(data).trim())),
    once(child, 'exit').then(([code]) => { throw new Error(`Server exited before listening (${code})`); })
  ]);
  return { child, port };
}

async function stop(child) {
  if (child.exitCode != null || child.signalCode != null) return;
  const done = once(child, 'exit');
  child.kill('SIGKILL');
  await done;
}

function client(port, name) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const messages = [];
  const waiters = new Set();
  let socketError;
  ws.onopen = () => send({ type: 'hello', name, clientId: `restart-test-${name}` });
  ws.onerror = error => {
    socketError = error;
    for (const waiter of waiters) waiter.fail(error);
  };
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    messages.push(message);
    for (const waiter of waiters) if (waiter.match(message)) waiter.finish(message);
  };

  function send(message) { ws.send(JSON.stringify(message)); }
  function wait(match) {
    if (socketError) return Promise.reject(socketError);
    const existing = messages.findLast(match);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => waiter.fail(new Error(`${name} did not receive ${match}; received ${messages.map(m => m.code || m.type).join(', ')}`)), 4000);
      const waiter = {
        match,
        finish(message) { clearTimeout(timer); waiters.delete(waiter); resolve(message); },
        fail(error) { clearTimeout(timer); waiters.delete(waiter); reject(error); }
      };
      waiters.add(waiter);
    });
  }
  return { send, wait, close: () => ws.close() };
}

test('a forced restart preserves both seats, the turn, the acknowledged guess, and the revoked invite', { timeout: 20000 }, async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'guess-ab-restart-'));
  const filename = path.join(directory, 'rooms.sqlite');
  let server;
  try {
    server = start(filename);
    const port = await server.port;
    let host = client(port, 'Host');
    let guest = client(port, 'Guest');
    await Promise.all([host.wait(m => m.type === 'welcome'), guest.wait(m => m.type === 'welcome')]);
    host.send({ type: 'create', mode: 'duel', settings: { tier: 0, cs: 'pack-fruit', turnSec: 30 } });
    const { room } = await host.wait(m => m.type === 'room');
    guest.send({ type: 'join', roomId: room.id, token: room.invite.token });
    await guest.wait(m => m.type === 'room');
    guest.send({ type: 'ready', value: true });
    await host.wait(m => m.type === 'room' && m.room.seats[1]?.ready);
    host.send({ type: 'start' });
    await host.wait(m => m.type === 'room' && m.room.status === 'setup');
    const guestSetup = (await guest.wait(m => m.type === 'room' && m.room.status === 'setup')).room;
    const secret = guestSetup.game.players[1].myDefault;
    host.send({ type: 'secret', code: [0, 1, 2, 3] });
    guest.send({ type: 'secret', code: secret });
    await host.wait(m => m.type === 'room' && m.room.status === 'playing');
    host.send({ type: 'guess', code: secret.slice().reverse() });
    await host.wait(m => m.type === 'room' && m.room.game?.players[0]?.count === 1);
    host.send({ type: 'invite_revoke' });
    const before = (await host.wait(m => m.type === 'room' && m.room.invite?.revoked)).room;
    await stop(server.child);

    server = start(filename);
    const restarted = await server.port;
    host = client(restarted, 'Host');
    const waiting = (await host.wait(m => m.type === 'room')).room;
    assert.equal(waiting.id, before.id);
    assert.equal(waiting.you.host, true);
    assert.ok(waiting.recovering != null);
    host.send({ type: 'guess', code: [1, 2, 3, 4] });
    assert.equal((await host.wait(m => m.type === 'error')).code, 'not_started');
    guest = client(restarted, 'Guest');
    const resumed = (await guest.wait(m => m.type === 'room' && m.room.recovering == null)).room;
    assert.equal(resumed.id, before.id);
    assert.equal(resumed.you.seat, 1);
    assert.equal(resumed.game.turn, before.game.turn);
    assert.deepEqual(resumed.game.players[0].hist, before.game.players[0].hist);
    assert.equal(resumed.game.players[0].mySecret, undefined);
    assert.ok((await host.wait(m => m.type === 'room' && m.room.invite?.revoked)).room.invite.revoked);
    assert.ok(Math.abs((resumed.game.deadline - resumed.serverNow) - (before.game.deadline - before.serverNow)) < 2000);
    guest.send({ type: 'leave' });
    await guest.wait(m => m.type === 'left');
    host.send({ type: 'leave' });
    await host.wait(m => m.type === 'left');
    await stop(server.child);
    server = start(filename);
    const next = await server.port;
    host = client(next, 'Host');
    await host.wait(m => m.type === 'lobby');
    host.close();
    const health = await fetch(`http://127.0.0.1:${next}/health`).then(response => response.json());
    assert.equal(health.rooms, 0);
  } finally {
    if (server) await stop(server.child);
    rmSync(directory, { recursive: true, force: true });
  }
});
