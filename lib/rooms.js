/* ===== lib/rooms.js — 房間、席位、觀戰、邀請、聊天、對局（純邏輯，不碰 socket）=====
 * 對外只有 createHub(io)：io.send(personId, msg) 負責送訊息給某個人，其餘全在這裡。
 *
 * 兩種玩法：
 *   race 同題競速：2～6 人（可含電腦席位）猜同一組答案，先猜中者勝，之後 10 秒收尾讓其他人繼續猜以排名。
 *   duel 互相出題：固定 2 個真人，各設密碼、輪流猜對方；先手猜中後手可追平一回合，同回合都猜中＝平手。
 *
 * 祕密只存在伺服器：答案／對方密碼不會出現在任何人的快照裡，對局結束才揭曉。
 *
 * 房間生命週期（以「實體玩家」為準，電腦與觀戰者不算）：
 *   - 實體玩家數降到 0 → 立即關房：邀請失效、從大廳移除、廣播 closed、停掉計時與電腦，已關的房間不會復活。
 *   - 對局中斷線超過 30 秒 → 判定離場。
 *   - 連續 3 分鐘無操作 → 視為棄權。
 */
'use strict';

const crypto = require('crypto');
const Core = require('../public/js/core/core.js');
const AI = require('../public/js/core/ai.js');
const Table = require('../public/js/core/spec-table.js');

const CONST = {
  RACE_MAX: 6,
  DUEL_SEATS: 2,
  SPEC_MAX: 20,
  RECONNECT_MS: 30000,
  IDLE_MS: 3 * 60 * 1000,
  IDLE_WARN_MS: 2.5 * 60 * 1000,
  FINISH_MS: 10000,
  TURN_SECS: [0, 5, 10, 15],
  AI_SPACE_MAX: 60000,
  CHAT_KEEP: 80,
  CHAT_MAX: 200,
  AVATARS: 8
};

const ID_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function cleanName(raw, fallback) {
  let s = String(raw == null ? '' : raw).replace(/[\u0000-\u001f\u007f<>&"'`]/g, '').replace(/\s+/g, ' ').trim();
  s = Array.from(s).slice(0, 16).join('');
  return s || fallback || ('玩家' + (100 + Math.floor(Math.random() * 900)));
}
function cleanText(raw) {
  return Array.from(String(raw == null ? '' : raw).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim()).slice(0, CONST.CHAT_MAX).join('');
}
function cleanAvatar(v) { v = Number(v); return Number.isInteger(v) && v >= 0 && v < CONST.AVATARS ? v : 0; }

/** 房間設定（伺服器端驗證） */
function normSettings(mode, raw, prev) {
  raw = raw || {};
  prev = prev || { cs: 'digits', n: 10, rep: false, limit: 0, turnSec: 0, cap: mode === 'duel' ? 2 : 6 };
  const cs = Core.charset(raw.cs) ? raw.cs : prev.cs;
  const n = Core.clampN(cs, raw.n != null ? raw.n : (raw.cs && raw.cs !== prev.cs ? Math.min(prev.n, Core.charset(cs).max) : prev.n));
  const rep = raw.rep != null ? !!raw.rep : prev.rep;
  const auto = Table.limit(2, n, rep);
  let limit = raw.limit != null ? Number(raw.limit) : prev.limit;
  if (!Number.isInteger(limit) || limit < 0 || limit > 60) limit = 0;
  const turnSec = CONST.TURN_SECS.indexOf(Number(raw.turnSec)) >= 0 ? Number(raw.turnSec) : prev.turnSec;
  let cap = mode === 'duel' ? 2 : Number(raw.cap != null ? raw.cap : prev.cap);
  if (!Number.isInteger(cap) || cap < 2 || cap > CONST.RACE_MAX) cap = prev.cap || 6;
  return { cs: cs, n: n, rep: rep, limit: limit, autoLimit: auto, turnSec: turnSec, cap: cap };
}
function effLimit(s) { return s.limit || s.autoLimit; }

function createHub(io, opt) {
  opt = opt || {};
  const now = opt.now || (() => Date.now());
  const aiDelay = opt.aiDelay || (rng => 900 + Math.floor(rng() * 900));
  const rooms = new Map();
  const where = new Map();        // personId → roomId
  let dirty = true;

  const send = (pid, msg) => { try { io.send(pid, msg); } catch (e) { /* 對方已斷線 */ } };
  const markDirty = () => { dirty = true; };

  function newRoomId() {
    for (let k = 0; k < 50; k++) {
      let id = '';
      for (let i = 0; i < 4; i++) id += ID_CHARS[crypto.randomInt(ID_CHARS.length)];
      if (!rooms.has(id)) return id;
    }
    return 'R' + Date.now().toString(36).toUpperCase();
  }
  const newToken = () => crypto.randomBytes(14).toString('base64url');

  /* ---------- 查詢 ---------- */
  const seatOf = (room, pid) => room.seats.findIndex(s => s && !s.ai && s.id === pid);
  const isSpec = (room, pid) => room.specs.has(pid);
  const humanSeats = room => room.seats.filter(s => s && !s.ai);
  const filled = room => room.seats.filter(Boolean);
  const allMembers = room => humanSeats(room).concat(Array.from(room.specs.values()));
  function roleOf(room, pid) { return seatOf(room, pid) >= 0 ? 'player' : isSpec(room, pid) ? 'spectator' : null; }
  function spaceOK(s) { return Core.spaceSize(s.n, s.rep) <= CONST.AI_SPACE_MAX; }

  /* ---------- 快照 ---------- */
  function histView(h) { return h.map(x => x.timeout ? { timeout: true, t: x.t } : { guess: x.guess, a: x.a, b: x.b, t: x.t }); }

  function gameView(room, pid) {
    const g = room.game;
    if (!g) return null;
    const role = roleOf(room, pid);
    const mySeat = seatOf(room, pid);
    const over = room.status === 'finished';
    const base = {
      no: room.gameNo, spec: { cs: g.spec.cs, n: g.spec.n, rep: g.spec.rep, pool: g.spec.pool },
      limit: g.limit, turnSec: g.turnSec, startedAt: g.startedAt, phase: g.phase
    };
    if (room.mode === 'race') {
      base.finishAt = g.finishAt || 0;
      base.winnerSeat = g.winnerSeat;
      base.players = g.players.map((p, i) => {
        if (!p) return null;
        const seeAll = over || role === 'spectator' || i === mySeat;
        const v = {
          seat: i, count: p.hist.length, bestA: p.bestA, bestB: p.bestB, solved: p.solved, solvedN: p.solvedN,
          out: p.out, deadline: p.deadline, idleWarn: p.idleWarn
        };
        if (seeAll) v.hist = histView(p.hist);
        return v;
      });
    } else {
      base.turn = g.turn; base.first = g.first; base.round = g.round; base.deadline = g.deadline;
      base.players = g.players.map((p, i) => p && {
        seat: i, locked: !!p.secret, count: p.hist.length, solved: p.solved, hist: histView(p.hist),
        mySecret: i === mySeat && p.secret ? p.secret : undefined, idleWarn: p.idleWarn
      });
    }
    if (over && room.result) base.result = room.result;
    return base;
  }

  function chatFor(room, pid) {
    const role = roleOf(room, pid);
    const playing = room.status === 'playing' || room.status === 'setup';
    return room.chat.filter(m => !(playing && role === 'player' && m.ch === 'spec')).slice(-30);
  }

  function snapshot(room, pid) {
    const seat = seatOf(room, pid);
    return {
      id: room.id, mode: room.mode, status: room.status, version: room.version, serverNow: now(),
      you: { id: pid, role: roleOf(room, pid), seat: seat, host: room.hostId === pid },
      hostId: room.hostId,
      seats: room.seats.map(s => s && (s.ai
        ? { ai: true, level: s.level, name: s.name, avatar: s.avatar, ready: true, connected: true }
        : { id: s.id, name: s.name, avatar: s.avatar, connected: s.connected, ready: !!s.ready })),
      specs: Array.from(room.specs.values()).map(s => ({ id: s.id, name: s.name, avatar: s.avatar })),
      specMax: CONST.SPEC_MAX,
      settings: Object.assign({}, room.settings, { aiOK: spaceOK(room.settings) }),
      game: gameView(room, pid),
      invite: room.hostId === pid ? { token: room.invite.token, revoked: !!room.invite.revoked } : null,
      chat: chatFor(room, pid)
    };
  }

  function broadcast(room) {
    if (room.closed) return;
    room.version++;
    for (const m of allMembers(room)) if (m.connected) send(m.id, { type: 'room', room: snapshot(room, m.id) });
    markDirty();
  }
  function emit(room, msg, filter) { for (const m of allMembers(room)) if (m.connected && (!filter || filter(m))) send(m.id, msg); }
  function toast(room, code, params) { emit(room, { type: 'toast', code: code, params: params || {} }); }

  function listRooms() {
    const out = [];
    for (const r of rooms.values()) {
      const host = humanSeats(r).find(s => s.id === r.hostId) || humanSeats(r)[0];
      out.push({
        id: r.id, mode: r.mode, hostName: host ? host.name : '', players: filled(r).length, cap: r.settings.cap,
        spectators: r.specs.size, status: r.status, cs: r.settings.cs, n: r.settings.n, rep: r.settings.rep,
        specFull: r.specs.size >= CONST.SPEC_MAX
      });
    }
    out.sort((a, b) => (a.status === 'waiting' ? 0 : 1) - (b.status === 'waiting' ? 0 : 1) || a.id.localeCompare(b.id));
    return out;
  }

  /* ---------- 建立、關閉 ---------- */
  function detach(pid) { where.delete(pid); if (io.cleared) io.cleared(pid); }

  function stopTimers(room) {
    if (room.aiTimers) for (const t of room.aiTimers) clearTimeout(t);
    room.aiTimers = [];
  }

  function closeRoom(room, reason) {
    if (room.closed) return;
    room.closed = true;
    room.invite.revoked = true;
    room.status = 'closed';
    stopTimers(room);
    for (const m of allMembers(room)) {
      if (m.connected) send(m.id, { type: 'closed', roomId: room.id, reason: reason || 'no_players' });
      detach(m.id);
    }
    rooms.delete(room.id);
    markDirty();
  }

  function create(p, msg) {
    if (where.has(p.id)) leave(p.id, true);
    const mode = msg && msg.mode === 'duel' ? 'duel' : 'race';
    const settings = normSettings(mode, msg && msg.settings);
    const room = {
      id: newRoomId(), mode: mode, hostId: p.id, version: 0, status: 'waiting', closed: false, gameNo: 0,
      seats: new Array(settings.cap).fill(null), specs: new Map(), chat: [], result: null, lastChatAt: new Map(),
      settings: settings, invite: { token: newToken(), revoked: false }, game: null, aiTimers: []
    };
    room.seats[0] = { id: p.id, name: cleanName(msg && msg.name, p.name), avatar: cleanAvatar(msg && msg.avatar), connected: true, ready: false, dcAt: 0 };
    rooms.set(room.id, room);
    where.set(p.id, room.id);
    p.roomId = room.id; p.role = 'player';
    broadcast(room);
    return room;
  }

  /** 快速加入：找一間等待中、還有空位的競速房；沒有就自己開一間 */
  function quick(p, msg) {
    for (const r of rooms.values()) {
      if (r.closed || r.mode !== 'race' || r.status === 'playing') continue;
      if (r.seats.some(s => !s)) return join(p, { roomId: r.id, name: msg && msg.name, avatar: msg && msg.avatar, want: 'player' });
    }
    return create(p, { mode: 'race', name: msg && msg.name, avatar: msg && msg.avatar });
  }

  /** 加入：伺服器依 token 與房況決定最後角色 */
  function join(p, msg) {
    const room = rooms.get(String(msg && msg.roomId || '').toUpperCase());
    if (!room || room.closed) return fail(p, 'room_missing');
    const name = cleanName(msg.name, p.name);
    const avatar = cleanAvatar(msg.avatar);
    if (roleOf(room, p.id)) { restore(room, p.id, name, avatar); return room; }
    if (msg.token) {
      if (String(msg.token) !== room.invite.token) return fail(p, 'invite_invalid');
      if (room.invite.revoked) return fail(p, 'invite_revoked');
    }
    if (where.has(p.id)) leave(p.id, true);
    const free = room.seats.findIndex(s => !s);
    const busy = room.status === 'playing' || room.status === 'setup';
    if (msg.want !== 'spectator' && free >= 0 && !busy) {
      seatPlayer(room, p, free, name, avatar);
    } else {
      if (room.specs.size >= CONST.SPEC_MAX) return fail(p, 'spec_full');
      addSpec(room, p, name, avatar);
    }
    toast(room, roleOf(room, p.id) === 'player' ? 'joinedPlay' : 'joinedSpec', { n: name });
    broadcast(room);
    return room;
  }

  function seatPlayer(room, p, idx, name, avatar) {
    room.seats[idx] = { id: p.id, name: name, avatar: avatar, connected: true, ready: false, dcAt: 0 };
    room.specs.delete(p.id);
    where.set(p.id, room.id);
    p.roomId = room.id; p.role = 'player';
    if (!room.hostId || seatOf(room, room.hostId) < 0) room.hostId = p.id;
  }
  function addSpec(room, p, name, avatar) {
    room.specs.set(p.id, { id: p.id, name: name, avatar: avatar, connected: true, dcAt: 0 });
    where.set(p.id, room.id);
    p.roomId = room.id; p.role = 'spectator';
  }
  function restore(room, pid, name, avatar) {
    const s = room.seats[seatOf(room, pid)] || room.specs.get(pid);
    if (!s) return;
    s.connected = true; s.dcAt = 0; if (name) s.name = name; if (avatar != null) s.avatar = avatar;
    where.set(pid, room.id);
    broadcast(room);
  }

  /** 觀戰者坐進空位 */
  function sit(p) {
    const room = roomFor(p.id); if (!room || !isSpec(room, p.id)) return;
    if (room.status === 'playing' || room.status === 'setup') return fail(p, 'busy_sit');
    const free = room.seats.findIndex(s => !s);
    if (free < 0) return fail(p, 'full');
    const sp = room.specs.get(p.id);
    seatPlayer(room, p, free, sp.name, sp.avatar);
    unready(room);
    toast(room, 'sat', { n: sp.name });
    broadcast(room);
  }
  /** 玩家改成觀戰 */
  function stand(p) {
    const room = roomFor(p.id); if (!room) return;
    const seat = seatOf(room, p.id); if (seat < 0) return;
    if (room.status === 'playing' || room.status === 'setup') return fail(p, 'busy_sit');
    if (room.specs.size >= CONST.SPEC_MAX) return fail(p, 'spec_full');
    const s = room.seats[seat];
    freeSeat(room, seat);
    addSpec(room, p, s.name, s.avatar);
    afterMembership(room);
  }

  function unready(room) { for (const s of room.seats) if (s && !s.ai) s.ready = false; }

  function leave(pid, silent) {
    const room = roomFor(pid); if (!room) { where.delete(pid); return; }
    const seat = seatOf(room, pid);
    if (seat >= 0) {
      const name = room.seats[seat].name;
      if (room.status === 'playing' || room.status === 'setup') dropOut(room, seat, 'left');
      freeSeat(room, seat);
      if (!silent) toast(room, 'leftRoom', { n: name });
    } else if (room.specs.has(pid)) {
      room.specs.delete(pid);
    }
    detach(pid);
    afterMembership(room);
  }

  function freeSeat(room, idx) {
    const s = room.seats[idx];
    room.seats[idx] = null;
    if (s && !s.ai && room.hostId === s.id) {
      const nxt = humanSeats(room)[0];
      room.hostId = nxt ? nxt.id : '';
    }
    unready(room);
  }

  /** 人員變動後：沒有實體玩家就關房，否則廣播 */
  function afterMembership(room) {
    if (room.closed) return;
    if (humanSeats(room).length === 0) { closeRoom(room, 'no_players'); return; }
    if (room.status === 'playing' || room.status === 'setup') checkEnd(room);
    broadcast(room);
  }

  function kick(p, targetId) {
    const room = roomFor(p.id); if (!room || room.hostId !== p.id || targetId === p.id) return;
    if (!roleOf(room, targetId)) return;
    const who = room.seats[seatOf(room, targetId)] || room.specs.get(targetId) || {};
    send(targetId, { type: 'closed', roomId: room.id, reason: 'kicked' });
    leave(targetId, true);
    toast(room, 'kicked', { n: who.name || null });
  }

  /* ---------- 電腦席位（只限競速、空間 ≤ 60,000） ---------- */
  const AI_NAMES = ['小鎖', '阿鑰', '密密', '喀喀', '寶寶', '轉轉'];
  function addAI(p, msg) {
    const room = roomFor(p.id); if (!room || room.hostId !== p.id) return;
    if (room.mode !== 'race') return fail(p, 'ai_mode');
    if (room.status === 'playing') return fail(p, 'busy_settings');
    if (!spaceOK(room.settings)) return fail(p, 'ai_space');
    const idx = Number(msg && msg.seat);
    const level = Math.max(0, Math.min(3, Number(msg && msg.level) | 0));
    if (!Number.isInteger(idx) || idx < 0 || idx >= room.seats.length) return;
    const cur = room.seats[idx];
    if (cur && !cur.ai) return fail(p, 'full');
    room.seats[idx] = { ai: true, level: level, name: AI_NAMES[idx % AI_NAMES.length], avatar: (idx + 3) % CONST.AVATARS, ready: true, connected: true };
    unready(room);
    broadcast(room);
  }
  function removeAI(p, msg) {
    const room = roomFor(p.id); if (!room || room.hostId !== p.id) return;
    if (room.status === 'playing') return fail(p, 'busy_settings');
    const idx = Number(msg && msg.seat);
    if (room.seats[idx] && room.seats[idx].ai) { room.seats[idx] = null; unready(room); broadcast(room); }
  }

  /* ---------- 設定 ---------- */
  function settings(p, msg) {
    const room = roomFor(p.id); if (!room || room.hostId !== p.id) return;
    if (room.status === 'playing' || room.status === 'setup') return fail(p, 'busy_settings');
    const next = normSettings(room.mode, msg, room.settings);
    const hasAI = room.seats.some(s => s && s.ai);
    if (hasAI && !spaceOK(next)) return fail(p, 'ai_space');
    if (room.mode === 'race' && next.cap !== room.settings.cap) {
      if (next.cap < room.seats.length) {
        /* 縮小：後面的位子必須是空的 */
        for (let i = next.cap; i < room.seats.length; i++) if (room.seats[i]) return fail(p, 'cap_busy');
        room.seats.length = next.cap;
      } else {
        while (room.seats.length < next.cap) room.seats.push(null);
      }
    }
    room.settings = next;
    unready(room);
    broadcast(room);
  }

  function inviteNew(p) {
    const room = roomFor(p.id); if (!room || room.hostId !== p.id) return;
    room.invite = { token: newToken(), revoked: false };
    toast(room, 'newInvite');
    broadcast(room);
  }
  function inviteRevoke(p) {
    const room = roomFor(p.id); if (!room || room.hostId !== p.id) return;
    room.invite.revoked = true;
    broadcast(room);
  }

  function chat(p, text) {
    const room = roomFor(p.id); if (!room) return;
    const t = cleanText(text); if (!t) return;
    const last = room.lastChatAt.get(p.id) || 0;
    if (now() - last < 350) return;
    room.lastChatAt.set(p.id, now());
    const role = roleOf(room, p.id);
    const who = room.seats[seatOf(room, p.id)] || room.specs.get(p.id);
    const playing = room.status === 'playing' || room.status === 'setup';
    const m = { id: p.id, name: who.name, avatar: who.avatar, role: role, text: t, t: now(), ch: playing && role === 'spectator' ? 'spec' : 'all' };
    room.chat.push(m);
    if (room.chat.length > CONST.CHAT_KEEP) room.chat.shift();
    /* 對局中觀戰頻道不送給玩家 */
    emit(room, { type: 'chat', msg: m }, mem => !(m.ch === 'spec' && seatOf(room, mem.id) >= 0));
  }

  /* ---------- 準備、開局 ---------- */
  function setReady(p, value) {
    const room = roomFor(p.id); if (!room) return;
    const seat = seatOf(room, p.id); if (seat < 0) return;
    if (room.status === 'playing' || room.status === 'setup') return;
    room.seats[seat].ready = value !== false;
    const people = filled(room);
    const need = room.mode === 'duel' ? 2 : 2;
    if (people.length >= need && people.every(s => s.ai || s.ready) && (room.mode !== 'duel' || humanSeats(room).length === 2)) startGame(room);
    else broadcast(room);
  }

  function startGame(room) {
    stopTimers(room);
    room.gameNo++;
    const s = room.settings;
    const spec = Core.makeSpec({ cs: s.cs, n: s.n, rep: s.rep }, 'room:' + room.id + ':' + room.gameNo + ':' + Core.randomSeed());
    const t = now();
    const g = { spec: spec, limit: effLimit(s), turnSec: s.turnSec, startedAt: t, phase: 'play', players: [] };
    room.result = null;
    for (const seat of room.seats) if (seat && !seat.ai) seat.ready = false;
    if (room.mode === 'race') {
      g.secret = Core.secretFor(spec);
      g.winnerSeat = -1; g.finishAt = 0;
      g.players = room.seats.map((seat, i) => seat && {
        hist: [], bestA: 0, bestB: 0, solved: false, solvedN: 0, solvedAt: 0, out: '', lastAct: t, idleWarn: false,
        deadline: s.turnSec ? t + s.turnSec * 1000 : 0,
        ai: seat.ai ? AI.createAI({ level: seat.level, n: spec.n, rep: spec.rep, rng: Core.rngFrom(spec.seed + ':ai' + i) }) : null
      });
      room.status = 'playing';
      room.game = g;
      toast(room, 'start');
      broadcast(room);
      for (let i = 0; i < g.players.length; i++) if (g.players[i] && g.players[i].ai) scheduleAI(room, i);
    } else {
      g.phase = 'setup';
      g.first = (room.gameNo - 1) % 2;
      g.turn = g.first; g.round = 1; g.deadline = 0;
      g.players = room.seats.map(() => ({ hist: [], secret: null, solved: false, lastAct: t, idleWarn: false }));
      room.status = 'setup';
      room.game = g;
      toast(room, 'setSecret');
      broadcast(room);
    }
  }

  /* ---------- 互相出題：設密碼 ---------- */
  function setSecret(p, code) {
    const room = roomFor(p.id); if (!room || room.mode !== 'duel' || room.status !== 'setup') return;
    const seat = seatOf(room, p.id); if (seat < 0) return;
    const g = room.game;
    const v = Core.validate(code, g.spec.n, g.spec.rep);
    if (!v.ok) return fail(p, 'bad_code_' + v.reason);
    g.players[seat].secret = code.slice();
    g.players[seat].lastAct = now();
    if (g.players.every(x => x && x.secret)) {
      g.phase = 'play';
      room.status = 'playing';
      g.startedAt = now();
      g.deadline = g.turnSec ? now() + g.turnSec * 1000 : 0;
      for (const x of g.players) x.lastAct = now();
      toast(room, 'duelStart', { first: g.first });
    }
    broadcast(room);
  }

  /* ---------- 猜 ---------- */
  function guess(p, code) {
    const room = roomFor(p.id); if (!room || room.status !== 'playing') return;
    const seat = seatOf(room, p.id); if (seat < 0) return fail(p, 'not_player');
    const g = room.game;
    const v = Core.validate(code, g.spec.n, g.spec.rep);
    if (!v.ok) return fail(p, 'bad_code_' + v.reason);
    if (room.mode === 'race') raceGuess(room, seat, code.slice(), false);
    else duelGuess(room, seat, code.slice(), false);
  }

  function raceGuess(room, seat, code, timeout) {
    const g = room.game, pl = g.players[seat];
    if (!pl || pl.solved || pl.out) return;
    const t = now();
    pl.lastAct = t; pl.idleWarn = false;
    if (timeout) {
      pl.hist.push({ timeout: true, t: t });
    } else {
      const r = Core.evaluate(g.secret, code);
      pl.hist.push({ guess: code, a: r.a, b: r.b, t: t });
      if (r.a > pl.bestA || (r.a === pl.bestA && r.b > pl.bestB)) { pl.bestA = r.a; pl.bestB = r.b; }
      emit(room, { type: 'guessed', seat: seat, n: pl.hist.length, a: r.a, b: r.b }, mem => seatOf(room, mem.id) === seat);
      if (r.a === Core.LEN) {
        pl.solved = true; pl.solvedN = pl.hist.length; pl.solvedAt = t; pl.deadline = 0;
        if (g.winnerSeat < 0) {
          g.winnerSeat = seat;
          g.finishAt = t + CONST.FINISH_MS;
          toast(room, 'firstSolve', { n: room.seats[seat] ? room.seats[seat].name : '' });
        }
      }
    }
    if (!pl.solved && pl.hist.length >= g.limit) { pl.out = 'limit'; pl.deadline = 0; }
    if (!pl.solved && !pl.out) pl.deadline = g.turnSec ? t + g.turnSec * 1000 : 0;
    checkEnd(room);
    broadcast(room);
    if (pl.ai && !pl.solved && !pl.out && room.status === 'playing') scheduleAI(room, seat);
  }

  function duelGuess(room, seat, code, timeout) {
    const g = room.game;
    if (g.turn !== seat) return fail({ id: room.seats[seat] && room.seats[seat].id }, 'not_turn');
    const me = g.players[seat], opp = g.players[1 - seat];
    const t = now();
    me.lastAct = t; me.idleWarn = false;
    if (timeout) me.hist.push({ timeout: true, t: t });
    else {
      const r = Core.evaluate(opp.secret, code);
      me.hist.push({ guess: code, a: r.a, b: r.b, t: t });
      emit(room, { type: 'guessed', seat: seat, n: me.hist.length, a: r.a, b: r.b });
      if (r.a === Core.LEN) me.solved = true;
    }
    const second = 1 - g.first;
    if (seat === g.first) {
      /* 先手剛猜完：輪到後手（就算先手猜中，後手也有追平的機會） */
      g.turn = second;
    } else {
      /* 後手猜完＝這一回合結束 */
      const f = g.players[g.first], s = g.players[second];
      if (f.solved || s.solved) {
        endDuel(room, f.solved && s.solved ? -1 : (f.solved ? g.first : second), 'solved');
        broadcast(room);
        return;
      }
      if (f.hist.length >= g.limit && s.hist.length >= g.limit) { endDuel(room, -1, 'limit'); broadcast(room); return; }
      g.round++;
      g.turn = g.first;
    }
    g.deadline = g.turnSec ? t + g.turnSec * 1000 : 0;
    broadcast(room);
  }

  /* ---------- 結束 ---------- */
  function dropOut(room, seat, why) {
    const g = room.game; if (!g) return;
    if (room.mode === 'race') {
      const pl = g.players[seat];
      if (pl && !pl.solved && !pl.out) { pl.out = why; pl.deadline = 0; }
      if (pl) pl.leftName = room.seats[seat] ? room.seats[seat].name : '';
    } else {
      endDuel(room, 1 - seat, why);
    }
  }

  function endDuel(room, winnerSeat, reason) {
    const g = room.game;
    if (room.status === 'finished') return;
    room.status = 'finished';
    g.deadline = 0;
    room.result = {
      reason: reason, winnerSeat: winnerSeat,
      secrets: g.players.map(x => x && x.secret),
      names: room.seats.map(s => s && s.name),
      counts: g.players.map(x => x ? x.hist.length : 0)
    };
    toast(room, 'over');
  }

  function raceRanking(room) {
    const g = room.game;
    const rows = [];
    g.players.forEach((p, i) => {
      if (!p) return;
      const seat = room.seats[i];
      rows.push({ seat: i, name: seat ? seat.name : (p.leftName || ''), ai: !!(seat && seat.ai), solved: p.solved, n: p.hist.length, solvedN: p.solvedN, solvedAt: p.solvedAt, bestA: p.bestA, bestB: p.bestB, out: p.out });
    });
    rows.sort((a, b) => {
      if (a.solved !== b.solved) return a.solved ? -1 : 1;
      if (a.solved) {
        if (a.seat === g.winnerSeat) return -1;
        if (b.seat === g.winnerSeat) return 1;
        return a.solvedN - b.solvedN || a.solvedAt - b.solvedAt;
      }
      if (!!a.out !== !!b.out && (a.out === 'left' || b.out === 'left' || a.out === 'idle' || b.out === 'idle')) {
        const aw = a.out === 'left' || a.out === 'idle', bw = b.out === 'left' || b.out === 'idle';
        if (aw !== bw) return aw ? 1 : -1;
      }
      return b.bestA - a.bestA || b.bestB - a.bestB || a.n - b.n;
    });
    rows.forEach((r, k) => { r.rank = k + 1; });
    return rows;
  }

  function checkEnd(room) {
    if (room.status !== 'playing' || room.mode !== 'race') return;
    const g = room.game;
    const t = now();
    const active = g.players.filter(p => p && !p.solved && !p.out);
    const participants = g.players.filter(Boolean);
    const humansLeft = g.players.filter((p, i) => p && !p.out && room.seats[i] && !room.seats[i].ai);
    let end = false;
    if (!active.length) end = true;
    else if (g.finishAt && t >= g.finishAt) end = true;
    else if (participants.length > 1 && g.players.filter(p => p && p.out !== 'left' && p.out !== 'idle').length <= 1 && g.winnerSeat < 0) end = true;
    else if (!humansLeft.length) end = true;
    if (!end) return;
    room.status = 'finished';
    stopTimers(room);
    for (const p of g.players) if (p) p.deadline = 0;
    room.result = { answer: g.secret.slice(), ranking: raceRanking(room), winnerSeat: g.winnerSeat };
    toast(room, 'over');
  }

  /* ---------- 電腦行動 ---------- */
  function scheduleAI(room, seat) {
    const g = room.game, pl = g.players[seat];
    if (!pl || !pl.ai) return;
    const rng = Core.rngFrom(g.spec.seed + ':delay:' + seat + ':' + pl.hist.length);
    const tm = setTimeout(() => {
      if (room.closed || room.status !== 'playing' || room.game !== g) return;
      if (pl.solved || pl.out) return;
      const hist = pl.hist.filter(h => !h.timeout);
      let code;
      try { code = pl.ai.next(hist); } catch (e) { code = Core.makeSecret(rng, g.spec.n, g.spec.rep); }
      raceGuess(room, seat, code, false);
    }, aiDelay(rng));
    if (tm.unref) tm.unref();
    room.aiTimers.push(tm);
  }

  /* ---------- 連線狀態 ---------- */
  function markDisconnected(pid) {
    const room = roomFor(pid); if (!room) return;
    const s = room.seats[seatOf(room, pid)] || room.specs.get(pid);
    if (!s) return;
    s.connected = false; s.dcAt = now();
    if (room.specs.has(pid)) { room.specs.delete(pid); detach(pid); broadcast(room); return; }
    broadcast(room);
  }
  function reconnect(p) {
    const room = roomFor(p.id);
    if (!room) return null;
    const s = room.seats[seatOf(room, p.id)];
    if (!s) return null;
    s.connected = true; s.dcAt = 0;
    p.roomId = room.id; p.role = 'player';
    broadcast(room);
    return room;
  }

  /** 定期呼叫：斷線寬限、逾時、掛機、收尾倒數、關閉空房 */
  function tick() {
    const t = now();
    for (const room of Array.from(rooms.values())) {
      if (room.closed) continue;
      let changed = false;
      for (let i = 0; i < room.seats.length; i++) {
        const s = room.seats[i];
        if (s && !s.ai && !s.connected && t - s.dcAt > CONST.RECONNECT_MS) {
          changed = true;
          if (room.status === 'playing' || room.status === 'setup') { dropOut(room, i, 'left'); toast(room, 'dcLoss', { n: s.name }); }
          freeSeat(room, i);
          detach(s.id);
        }
      }
      if (humanSeats(room).length === 0) { closeRoom(room, 'no_players'); continue; }
      const g = room.game;
      if (g && (room.status === 'playing' || room.status === 'setup')) {
        g.players.forEach((pl, i) => {
          if (!pl || room.status === 'finished') return;
          const seat = room.seats[i];
          if (!seat || seat.ai) return;
          if (room.mode === 'race' && (pl.solved || pl.out)) return;
          if (room.mode === 'duel' && room.status === 'playing' && g.turn !== i) { pl.lastAct = Math.max(pl.lastAct, t - 1000); return; }
          if (room.mode === 'duel' && room.status === 'setup' && pl.secret) return;
          const idle = t - pl.lastAct;
          if (idle > CONST.IDLE_MS) {
            changed = true;
            toast(room, 'idleOut', { n: seat.name });
            if (room.mode === 'race') { pl.out = 'idle'; pl.deadline = 0; } else endDuel(room, 1 - i, 'idle');
          } else if (idle > CONST.IDLE_WARN_MS && !pl.idleWarn) {
            pl.idleWarn = true; changed = true;
            send(seat.id, { type: 'toast', code: 'idleWarn', params: {} });
          }
        });
        if (room.status === 'playing' && room.mode === 'race') {
          g.players.forEach((pl, i) => {
            if (pl && !pl.ai && !pl.solved && !pl.out && pl.deadline && t > pl.deadline) { raceGuess(room, i, null, true); changed = false; }
          });
          const before = room.status;
          checkEnd(room);
          if (room.status !== before) changed = true;
        } else if (room.status === 'playing' && room.mode === 'duel' && g.deadline && t > g.deadline) {
          duelGuess(room, g.turn, null, true);
        }
      }
      if (changed) broadcast(room);
    }
  }

  /* ---------- 其他 ---------- */
  function roomFor(pid) { const id = where.get(pid); const r = id && rooms.get(id); return r && !r.closed ? r : null; }
  function fail(p, code, params) { if (p && p.id) send(p.id, { type: 'error', code: code, params: params || {} }); return null; }
  function sendRoom(pid) { const r = roomFor(pid); if (r) send(pid, { type: 'room', room: snapshot(r, pid) }); }
  function popDirty() { const d = dirty; dirty = false; return d; }
  function stats() {
    let players = 0, spectators = 0;
    for (const r of rooms.values()) { players += humanSeats(r).filter(s => s.connected).length; spectators += r.specs.size; }
    return { rooms: rooms.size, players: players, spectators: spectators };
  }
  function resign(p) {
    const room = roomFor(p.id); if (!room || (room.status !== 'playing' && room.status !== 'setup')) return;
    const seat = seatOf(room, p.id); if (seat < 0) return;
    dropOut(room, seat, 'resign');
    checkEnd(room);
    broadcast(room);
  }

  return {
    CONST, rooms, create, quick, join, sit, stand, leave, kick, addAI, removeAI, settings, inviteNew, inviteRevoke, chat,
    setReady, setSecret, guess, resign, markDisconnected, reconnect, tick, listRooms, roomFor, sendRoom, snapshot,
    popDirty, stats, closeRoom
  };
}

module.exports = { createHub, CONST, cleanName, cleanText, normSettings };
