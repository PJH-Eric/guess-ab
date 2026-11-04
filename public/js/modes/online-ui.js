/* ===== modes/online-ui.js — 線上大廳、房間、對局畫面 =====
 * 只有使用者按「跟別人玩」或點邀請連結才連線；離開線上模式就關閉連線、停止背景計時。
 * 祕密（答案、對方密碼）只在伺服器，這裡只顯示伺服器給的快照。
 */
(function (root) {
  'use strict';
  var doc = root.document;
  var Core = root.GuessCore;
  var K, G, Net;
  var room = null;          // 最新房間快照
  var rooms = [];             // 大廳房間列表
  var invite = null;          // 待確認的邀請 { room, token }
  var shownResult = 0;        // 已顯示結算的局號
  var setupKey = '';          // 目前 GameView 對應的局（局號＋階段）
  var unread = 0;
  var connected = false;
  var clockOffset = 0;
  var wantGame = false;       // 對局結束後是否還停在遊戲畫面（看結算）
  var avatarSel = 0;

  function $(id) { return doc.getElementById(id); }
  function t(k, p) { return root.I18N.t(k, p); }
  function esc(s) { return K.esc(s); }
  function app() { return root.App; }
  function myName() { return root.Store.get('nickname') || ''; }

  /* ---------- 進出大廳 ---------- */
  function enterLobby(inv) {
    if (inv) invite = inv;
    if (!Net.enabled) { app().show('lobby'); return; }
    Net.connect(myName());
    app().show('lobby');
    if (Net.status === 'open') Net.send({ type: 'lobby' });
  }
  function exitLobby() {
    if (room) { confirmLeave(); return; }
    Net.close();
    connected = false;
    invite = null;
    app().show('home');
  }
  function inRoom() { return !!room; }

  /* ---------- 大廳 ---------- */
  function statusLine() {
    if (!Net.enabled) return '<div class="net-status bad">' + K.icon('cross') + '<span>' + esc(t('net.disabled')) + '</span></div>';
    var s = Net.status;
    if (s === 'open') return '<div class="net-status ok">' + K.icon('check') + '<span>' + esc(t('net.open')) + '</span></div>';
    if (s === 'waking') return '<div class="net-status wake">' + root.GuessArt.svg('mascot', 5, 'wake-mascot') + '<span>' + esc(t('net.waking', { n: '\u0001' })).replace('\u0001', K.clockHtml('since', Net.wakeT0 || Date.now())) + '</span></div>';
    if (s === 'failed') return '<div class="net-status bad">' + K.icon('cross') + '<span>' + esc(t('net.failed')) + '</span><button type="button" class="btn small" id="net-retry">' + esc(t('net.retry')) + '</button></div>';
    return '<div class="net-status wake">' + K.icon('timer') + '<span>' + esc(t('net.' + (s === 'retrying' ? 'retrying' : 'connecting'), { n: Net.statusN || 0 })) + '</span></div>';
  }
  function avatarPicker(id) {
    var html = '<div class="avatar-pick" id="' + id + '" role="radiogroup" aria-label="' + esc(t('lobby.avatar')) + '">';
    for (var i = 0; i < 8; i++) html += '<button type="button" role="radio" class="av-btn" data-av="' + i + '" aria-checked="' + (i === avatarSel) + '" tabindex="' + (i === avatarSel ? 0 : -1) + '" aria-label="' + esc(t('avatar.' + i)) + '">' + root.GuessArt.svg('avatars', i, 'av-svg') + '</button>';
    return html + '</div>';
  }
  function bindAvatar(el) {
    var btns = Array.prototype.slice.call(el.querySelectorAll('.av-btn'));
    function pick(i) { avatarSel = i; root.Store.set('avatar', i); btns.forEach(function (b, k) { b.setAttribute('aria-checked', k === i); b.tabIndex = k === i ? 0 : -1; }); }
    el.addEventListener('click', function (e) { var b = e.target.closest('.av-btn'); if (b) { pick(Number(b.getAttribute('data-av'))); root.Sound.play('pop'); } });
    el.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!d) return; e.preventDefault();
      var n = (avatarSel + d + 8) % 8; pick(n); btns[n].focus();
    });
  }
  function roomRow(r) {
    var full = r.players >= r.cap;
    var busy = r.status !== 'waiting';
    return '<li class="room-row">' +
      '<span class="rr-cs">' + (r.cs === 'random' ? K.icon('shuffle', 'rr-svg') : K.csIcon(r.cs, 'rr-svg')) + '</span>' +
      '<span class="rr-main"><b>' + esc(r.hostName || '—') + '</b><small>' + esc(t('mode.' + r.mode + 'Online')) + '・' + esc(t('tier.' + r.tier)) + '・' + esc(r.cs === 'random' ? t('csg.random') : t('cs.' + r.cs)) +
        (r.mode === 'race' && r.minutes ? '・' + esc(t('room.minN', { n: r.minutes })) : r.mode === 'duel' && r.turnSec ? '・' + esc(t('room.secPerTurn', { n: r.turnSec })) : '') + '</small></span>' +
      '<span class="rr-meta"><i>' + K.icon('users') + r.players + '/' + r.cap + '</i><i>' + K.icon('eye') + r.spectators + '</i><i class="st st-' + r.status + '">' + esc(t('rs.' + r.status)) + '</i></span>' +
      '<span class="rr-act">' +
      '<button type="button" class="btn small primary" data-join="' + esc(r.id) + '"' + (full || busy ? ' disabled' : '') + '>' + esc(t('lobby.join')) + '</button>' +
      '<button type="button" class="btn small ghost" data-watch="' + esc(r.id) + '"' + (r.specFull ? ' disabled' : '') + '>' + esc(t('lobby.watch')) + '</button></span></li>';
  }
  function renderLobby() {
    avatarSel = root.Store.get('avatar') || 0;
    var ok = Net.enabled && Net.status === 'open';
    var html = '<div class="page lobby"><h1 class="page-title">' + esc(t('title.lobby')) + '</h1>' + statusLine() +
      '<section class="panel profile"><h2 class="box-title">' + K.icon('user') + esc(t('lobby.profile')) + '</h2>' +
      '<label class="field"><span class="f-label">' + esc(t('lobby.name')) + '</span><span class="input-wrap"><input id="lb-name" type="text" maxlength="16" autocomplete="nickname" value="' + esc(myName()) + '" placeholder="' + esc(t('lobby.namePh')) + '"></span></label>' +
      '<div class="field"><span class="f-label">' + esc(t('lobby.avatar')) + '</span>' + avatarPicker('lb-av') + '</div></section>';
    if (invite) {
      html += '<section class="panel invite-box" aria-live="polite"><h2 class="box-title">' + K.icon('link') + esc(t('lobby.invited', { id: invite.room })) + '</h2><p>' + esc(t('lobby.invitedSub')) + '</p>' +
        '<div class="row-btns"><button type="button" class="btn primary" id="inv-play"' + (ok ? '' : ' disabled') + '>' + K.icon('play') + '<span>' + esc(t('lobby.invPlay')) + '</span></button>' +
        '<button type="button" class="btn" id="inv-watch"' + (ok ? '' : ' disabled') + '>' + K.icon('eye') + '<span>' + esc(t('lobby.invWatch')) + '</span></button>' +
        '<button type="button" class="btn ghost" id="inv-cancel">' + esc(t('common.cancel')) + '</button></div></section>';
    }
    html += '<div class="lobby-actions"><button type="button" class="big-btn b-online small" id="lb-quick"' + (ok ? '' : ' disabled') + '>' + K.icon('play') + '<span><b>' + esc(t('lobby.quick')) + '</b><small>' + esc(t('lobby.quickSub')) + '</small></span></button>' +
      '<button type="button" class="big-btn b-solo small" id="lb-create"' + (ok ? '' : ' disabled') + '>' + K.icon('plus') + '<span><b>' + esc(t('lobby.create')) + '</b><small>' + esc(t('lobby.createSub')) + '</small></span></button></div>' +
      '<section class="panel"><h2 class="box-title">' + K.icon('grid') + esc(t('lobby.rooms')) + '<button type="button" class="link-btn" id="lb-refresh"' + (ok ? '' : ' disabled') + '>' + K.icon('refresh') + esc(t('lobby.refresh')) + '</button></h2>' +
      (rooms.length ? '<ul class="room-list">' + rooms.map(roomRow).join('') + '</ul>' : '<p class="empty">' + esc(ok ? t('lobby.noRooms') : t('lobby.waitConn')) + '</p>') + '</section></div>';
    $('scr-lobby').innerHTML = html;
    var nm = $('lb-name');
    nm.addEventListener('change', function () { root.Store.set('nickname', nm.value.trim().slice(0, 16)); Net.send({ type: 'name', name: nm.value }); });
    bindAvatar($('lb-av'));
    var rt = $('net-retry'); if (rt) rt.onclick = function () { Net.connect(myName()); renderLobby(); };
    $('lb-quick').onclick = function () { saveName(); Net.send({ type: 'quick', name: myName(), avatar: avatarSel }); };
    $('lb-create').onclick = openCreate;
    $('lb-refresh').onclick = function () { Net.send({ type: 'lobby' }); };
    $('scr-lobby').querySelectorAll('[data-join]').forEach(function (b) { b.onclick = function () { saveName(); Net.send({ type: 'join', roomId: b.getAttribute('data-join'), name: myName(), avatar: avatarSel, want: 'player' }); }; });
    $('scr-lobby').querySelectorAll('[data-watch]').forEach(function (b) { b.onclick = function () { saveName(); Net.send({ type: 'join', roomId: b.getAttribute('data-watch'), name: myName(), avatar: avatarSel, want: 'spectator' }); }; });
    if (invite) {
      $('inv-play').onclick = function () { joinInvite('player'); };
      $('inv-watch').onclick = function () { joinInvite('spectator'); };
      $('inv-cancel').onclick = function () { invite = null; clearInviteUrl(); renderLobby(); };
    }
    app().fillIcons($('scr-lobby'));
  }
  function saveName() { var nm = $('lb-name'); if (nm) root.Store.set('nickname', nm.value.trim().slice(0, 16)); }
  function joinInvite(want) {
    saveName();
    Net.send({ type: 'join', roomId: invite.room, token: invite.token, name: myName(), avatar: avatarSel, want: want });
  }
  function clearInviteUrl() { try { root.history.replaceState(root.history.state, '', root.location.pathname); } catch (e) { /* 忽略 */ } }

  /* ---------- 建立房間 ---------- */
  function csMenuItems() {
    var list = [{ value: 'random', label: t('cs.random'), icon: K.icon('shuffle', 'menu-ico'), group: t('csg.random') }];
    ['digits', 'letters', 'gems'].forEach(function (c) { list.push({ value: c, label: t('cs.' + c), icon: K.csIcon(c, 'menu-ico'), group: t('csg.basic') }); });
    Core.CUTE_PACKS.forEach(function (p) { list.push({ value: 'pack-' + p, label: t('cs.pack-' + p), icon: K.csIcon('pack-' + p, 'menu-ico'), group: t('csg.cute') }); });
    Core.REAL_PACKS.forEach(function (p) { list.push({ value: 'pack-' + p, label: t('cs.pack-' + p), icon: K.csIcon('pack-' + p, 'menu-ico'), group: t('csg.real') }); });
    list.push({ value: 'mix', label: t('cs.mix'), icon: K.csIcon('mix', 'menu-ico'), group: t('csg.mix') });
    return list;
  }
  function csIco(cs) { return cs === 'random' ? K.icon('shuffle', 'menu-ico') : K.csIcon(cs, 'menu-ico'); }
  function tierSeg(id, v) { var it = []; for (var x = 0; x < Core.TIERS; x++) it.push({ value: String(x), label: t('tier.' + x) }); return K.segHtml(id, it, String(v), t('setup.tier')); }
  function openCreate() {
    saveName();
    var st = { mode: 'race', tier: 2, cs: 'digits' };
    var body = doc.createElement('div');
    body.className = 'form create-form';
    function draw() {
      body.innerHTML = '<div class="field"><span class="f-label">' + esc(t('create.mode')) + '</span>' + K.segHtml('cr-mode', [{ value: 'race', label: t('mode.raceOnline'), icon: K.icon('flag') }, { value: 'duel', label: t('mode.duelOnline'), icon: K.icon('users') }], st.mode, t('create.mode')) +
        '<small class="f-help">' + esc(t('create.' + st.mode + 'Help')) + '</small></div>' +
        '<div class="field"><span class="f-label">' + esc(t('setup.tier')) + '</span>' + tierSeg('cr-tier', st.tier) + '</div>' +
        '<div class="field"><span class="f-label">' + esc(t('setup.cs')) + '</span><button type="button" class="select-btn" id="cr-cs" aria-haspopup="listbox" aria-expanded="false">' + csIco(st.cs) + '<span>' + esc(t('cs.' + st.cs)) + '</span>' + K.icon('back', 'chev') + '</button></div>';
      K.bindSeg(body.querySelector('#cr-mode'), function (v) { st.mode = v; draw(); });
      K.bindSeg(body.querySelector('#cr-tier'), function (v) { st.tier = Number(v); });
      body.querySelector('#cr-cs').addEventListener('click', function () {
        K.menu(body.querySelector('#cr-cs'), { items: csMenuItems(), value: st.cs, wide: true, onPick: function (v) { st.cs = v; draw(); body.querySelector('#cr-cs').focus(); } });
      });
    }
    draw();
    K.Modal({ title: t('lobby.create'), body: body, actions: [
      { label: t('common.cancel'), kind: 'ghost' },
      { label: t('create.go'), kind: 'primary', icon: 'plus', onClick: function () { Net.send({ type: 'create', mode: st.mode, name: myName(), avatar: avatarSel, settings: { tier: st.tier, cs: st.cs } }); } }] });
  }

  /* ---------- 房間 ---------- */
  function me() { return room ? room.you : null; }
  function seatsHtml() {
    var r = room, you = r.you;
    var host = you.host;
    return r.seats.map(function (s, i) {
      if (!s) {
        var act = '';
        if (you.role === 'spectator' && r.status !== 'playing' && r.status !== 'setup') act += '<button type="button" class="btn small" data-sit="1">' + K.icon('user') + esc(t('room.sit')) + '</button>';
        return '<li class="seat empty"><span class="seat-av">' + K.icon('user') + '</span><span class="seat-name">' + esc(t('room.empty')) + '</span><span class="seat-act">' + act + '</span></li>';
      }
      var isMe = s.id === you.id;
      var badges = '';
      if (s.id === r.hostId) badges += '<i class="b-host" title="' + esc(t('room.host')) + '">' + K.icon('crown') + '</i>';
      if (r.status !== 'playing' && r.status !== 'setup') badges += s.ready ? '<i class="b-ready">' + K.icon('check') + esc(t('room.ready')) + '</i>' : '<i class="b-wait">' + esc(t('room.notReady')) + '</i>';
      if (!s.connected) badges += '<i class="b-dc">' + K.icon('timer') + esc(t('room.dc')) + '</i>';
      var act2 = '';
      if (host && !isMe && r.status !== 'playing' && r.status !== 'setup') act2 = '<button type="button" class="icon-btn small" data-kick="' + esc(s.id) + '" aria-label="' + esc(t('room.kick', { n: s.name })) + '" title="' + esc(t('room.kick', { n: s.name })) + '">' + K.icon('kick') + '</button>';
      return '<li class="seat' + (isMe ? ' me' : '') + (s.ready ? ' ready' : '') + '"><span class="seat-av">' + root.GuessArt.svg('avatars', s.avatar || 0, 'av-svg') + '</span>' +
        '<span class="seat-name" title="' + esc(s.name) + '">' + esc(s.name) + (isMe ? ' <small>(' + esc(t('room.you')) + ')</small>' : '') + '</span><span class="seat-badges">' + badges + '</span><span class="seat-act">' + act2 + '</span></li>';
    }).join('');
  }
  function settingsHtml() {
    var r = room, s = r.settings, host = r.you.host && r.status !== 'playing' && r.status !== 'setup';
    if (!host) {
      return '<dl class="sum-list"><dt>' + esc(t('create.mode')) + '</dt><dd>' + esc(t('mode.' + r.mode + 'Online')) + '</dd><dt>' + esc(t('setup.tier')) + '</dt><dd>' + esc(t('tier.' + s.tier)) + '</dd>' +
        '<dt>' + esc(t('setup.cs')) + '</dt><dd>' + esc(t('cs.' + s.cs)) + '</dd>' +
        (r.mode === 'race' ? '<dt>' + esc(t('room.minutes')) + '</dt><dd>' + esc(t('room.minN', { n: s.minutes })) + '</dd><dt>' + esc(t('room.cap')) + '</dt><dd>' + s.cap + '</dd>'
          : '<dt>' + esc(t('room.turnSec')) + '</dt><dd>' + esc(t('room.secN', { n: s.turnSec })) + '</dd><dt>' + esc(t('room.rounds')) + '</dt><dd>' + esc(t('room.roundsN', { n: 15 })) + '</dd>') + '</dl>';
    }
    return '<div class="form compact">' +
      '<div class="field"><span class="f-label">' + esc(t('setup.tier')) + '</span>' + tierSeg('rs-tier', s.tier) + '<small class="f-help">' + esc(t('room.tierHelp')) + '</small></div>' +
      '<div class="field"><span class="f-label">' + esc(t('setup.cs')) + '</span><button type="button" class="select-btn" id="rs-cs" aria-haspopup="listbox" aria-expanded="false">' + csIco(s.cs) + '<span>' + esc(t('cs.' + s.cs)) + '</span>' + K.icon('back', 'chev') + '</button></div>' +
      (r.mode === 'race'
        ? '<div class="field"><span class="f-label">' + esc(t('room.minutes')) + '</span>' + K.segHtml('rs-min', [3, 5, 10].map(function (v) { return { value: String(v), label: t('room.minN', { n: v }) }; }), String(s.minutes), t('room.minutes')) + '</div>' +
          '<div class="field"><span class="f-label">' + esc(t('room.cap')) + '</span>' + K.stepperHtml('rs-cap', s.cap, t('room.cap')) + '</div>'
        : '<div class="field"><span class="f-label">' + esc(t('room.turnSec')) + '</span>' + K.segHtml('rs-turn', [15, 30, 60].map(function (v) { return { value: String(v), label: t('room.secN', { n: v }) }; }), String(s.turnSec), t('room.turnSec')) +
          '<small class="f-help">' + esc(t('room.duelHelp')) + '</small></div>') + '</div>';
  }
  function inviteUrl() {
    if (!room || !room.invite || room.invite.revoked) return '';
    var base = root.location.origin + root.location.pathname;
    var q = '?room=' + encodeURIComponent(room.id) + '&invite=' + encodeURIComponent(room.invite.token);
    var sv = new URLSearchParams(root.location.search).get('server');
    if (sv) q += '&server=' + encodeURIComponent(sv);
    return base + q;
  }
  function renderRoom() {
    if (!room) { app().show('lobby'); return; }
    var r = room, you = r.you;
    var ready = you.role === 'player' && r.seats[you.seat] && r.seats[you.seat].ready;
    /* 側欄（含聊天）是共用的節點：重畫房間前先把它移回遊戲畫面，免得被 innerHTML 一起清掉 */
    var side = $('side');
    if (side && $('scr-room').contains(side)) $('scr-game').insertBefore(side, $('g-center'));
    var chatScroll = $('chat-list').scrollTop;
    var html = '<div class="room-wrap"><div class="room-side" id="room-side-slot"></div><div class="room-main scroll"><div class="page room">' +
      '<div class="room-head"><h1 class="page-title">' + esc(t('room.title', { id: r.id })) + '</h1><span class="pill">' + esc(t('mode.' + r.mode + 'Online')) + '</span><span class="pill st-' + r.status + '">' + esc(t('rs.' + r.status)) + '</span></div>' +
      '<p class="room-tip">' + esc(t(you.role === 'spectator' ? 'room.tipSpec' : r.mode === 'duel' ? 'room.tipDuel' : 'room.tipRace')) + '</p>' +
      '<ul class="seats">' + seatsHtml() + '</ul>' +
      '<div class="room-actions">' +
      (you.role === 'player' ? '<button type="button" class="btn ' + (ready ? '' : 'primary') + ' big" id="rm-ready">' + K.icon(ready ? 'cross' : 'check') + '<span>' + esc(ready ? t('room.unready') : t('room.imReady')) + '</span></button>' +
        '<button type="button" class="btn ghost" id="rm-stand">' + K.icon('eye') + '<span>' + esc(t('room.stand')) + '</span></button>' : '') +
      (you.role === 'spectator' ? '<button type="button" class="btn primary" id="rm-sit"' + (r.seats.some(function (s) { return !s; }) ? '' : ' disabled') + '>' + K.icon('user') + '<span>' + esc(t('room.sit')) + '</span></button>' : '') +
      (r.status === 'finished' ? '<button type="button" class="btn ghost" id="rm-result">' + K.icon('trophy') + '<span>' + esc(t('room.lastResult')) + '</span></button>' : '') +
      '<button type="button" class="btn danger ghost" id="rm-leave">' + K.icon('exit') + '<span>' + esc(t('room.leave')) + '</span></button></div>' +
      '<div class="room-panels"><section class="panel"><h2 class="box-title">' + K.icon('gear') + esc(t('room.settings')) + (you.host ? '' : '<small>' + esc(t('room.hostOnly')) + '</small>') + '</h2>' + settingsHtml() + '</section>' +
      '<section class="panel"><h2 class="box-title">' + K.icon('link') + esc(t('room.invite')) + '</h2>' + inviteHtml() + '</section>' +
      '<section class="panel"><h2 class="box-title">' + K.icon('eye') + esc(t('room.specs', { n: r.specs.length, max: r.specMax })) + '</h2>' +
      (r.specs.length ? '<ul class="spec-list">' + r.specs.map(function (s) { return '<li>' + root.GuessArt.svg('avatars', s.avatar || 0, 'av-mini') + '<span>' + esc(s.name) + '</span>' + (you.host && s.id !== you.id ? '<button type="button" class="icon-btn small" data-kick="' + esc(s.id) + '" aria-label="' + esc(t('room.kick', { n: s.name })) + '">' + K.icon('kick') + '</button>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="empty">' + esc(t('room.noSpecs')) + '</p>') + '</section></div>' +
      '</div></div></div>';
    $('scr-room').innerHTML = html;
    mountSide('room');
    $('chat-list').scrollTop = chatScroll;
    bindRoom();
    app().setTitle(t('room.title', { id: r.id }));
    app().fillIcons($('scr-room'));
  }
  function inviteHtml() {
    if (!room.you.host) return '<p class="small">' + esc(t('room.inviteHostOnly')) + '</p>';
    var url = inviteUrl();
    if (!url) return '<p class="small">' + esc(t('room.inviteRevoked')) + '</p><button type="button" class="btn small" id="inv-new">' + K.icon('refresh') + esc(t('room.inviteNew')) + '</button>';
    return '<div class="invite-url" id="inv-url" tabindex="0">' + esc(url) + '</div><div class="row-btns">' +
      '<button type="button" class="btn small primary" id="inv-copy">' + K.icon('copy') + esc(t('room.copy')) + '</button>' +
      '<button type="button" class="btn small" id="inv-new">' + K.icon('refresh') + esc(t('room.inviteNew')) + '</button>' +
      '<button type="button" class="btn small ghost danger" id="inv-revoke">' + K.icon('cross') + esc(t('room.revoke')) + '</button></div>';
  }
  function bindRoom() {
    var r = room;
    var q = function (sel) { return $('scr-room').querySelector(sel); };
    var rd = q('#rm-ready'); if (rd) rd.onclick = function () { var s = r.seats[r.you.seat]; Net.send({ type: 'ready', value: !(s && s.ready) }); root.Sound.play('key'); };
    var stb = q('#rm-stand'); if (stb) stb.onclick = function () { Net.send({ type: 'stand' }); };
    var sit = q('#rm-sit'); if (sit) sit.onclick = function () { Net.send({ type: 'sit' }); };
    $('scr-room').querySelectorAll('[data-sit]').forEach(function (b) { b.onclick = function () { Net.send({ type: 'sit' }); }; });
    var res = q('#rm-result'); if (res) res.onclick = function () { wantGame = true; showGame(); showResult(true); };
    q('#rm-leave').onclick = confirmLeave;
    $('scr-room').querySelectorAll('[data-kick]').forEach(function (b) { b.onclick = function () { Net.send({ type: 'kick', target: b.getAttribute('data-kick') }); }; });
    var cp = q('#inv-copy'); if (cp) cp.onclick = function () { copyText(inviteUrl()); };
    var nw = q('#inv-new'); if (nw) nw.onclick = function () { Net.send({ type: 'invite_new' }); };
    var rv = q('#inv-revoke'); if (rv) rv.onclick = function () { Net.send({ type: 'invite_revoke' }); };
    var s = r.settings;
    if (q('#rs-cs')) {
      q('#rs-cs').onclick = function () { K.menu(q('#rs-cs'), { items: csMenuItems(), value: s.cs, wide: true, onPick: function (v) { Net.send({ type: 'settings', cs: v }); } }); };
      K.bindSeg(q('#rs-tier'), function (v) { Net.send({ type: 'settings', tier: Number(v) }); });
      if (q('#rs-min')) K.bindSeg(q('#rs-min'), function (v) { Net.send({ type: 'settings', minutes: Number(v) }); });
      if (q('#rs-turn')) K.bindSeg(q('#rs-turn'), function (v) { Net.send({ type: 'settings', turnSec: Number(v) }); });
      if (q('#rs-cap')) K.bindStepper(q('#rs-cap'), function () { return s.cap; }, function (v) { s.cap = v; Net.send({ type: 'settings', cap: v }); }, function () { return Math.max(2, r.seats.reduce(function (m, x, i) { return x ? i + 1 : m; }, 2)); }, function () { return 6; });
    }
  }
  function copyText(text) {
    function ok() { K.toast(t('room.copied'), 'ok'); }
    try {
      if (root.navigator.clipboard && root.isSecureContext) { root.navigator.clipboard.writeText(text).then(ok, fallback); return; }
    } catch (e) { /* 改用備援 */ }
    fallback();
    function fallback() {
      var el = $('inv-url');
      if (el) { var range = doc.createRange(); range.selectNodeContents(el); var sel = root.getSelection(); sel.removeAllRanges(); sel.addRange(range); }
      try { doc.execCommand('copy'); ok(); } catch (e) { K.toast(t('room.copyManual'), 'warn'); }
    }
  }

  function confirmLeave() {
    if (!room) { exitLobby(); return; }
    var playing = room.status === 'playing' || room.status === 'setup';
    K.Modal({ title: t('room.leaveTitle'), body: '<p>' + esc(t(playing && room.you.role === 'player' ? 'room.leaveBodyPlaying' : 'room.leaveBody')) + '</p>', actions: [
      { label: t('common.stay'), kind: 'ghost' },
      { label: t('room.leave'), kind: 'danger', icon: 'exit', onClick: function () { Net.send({ type: 'leave' }); room = null; forgetRoom(); setupKey = ''; root.Result.hide(); app().show('lobby'); } }] });
  }

  /* ---------- 側欄（摘要＋聊天）在房間與對局畫面共用 ---------- */
  function mountSide(where) {
    var side = $('side');
    var chat = $('chatbox');
    chat.hidden = !room;
    if (where === 'room') {
      var slot = $('room-side-slot');
      if (slot && side.parentElement !== slot) slot.appendChild(side);
      renderRoomSummary();
    } else {
      var game = $('scr-game');
      if (side.parentElement !== game) game.insertBefore(side, $('g-center'));
    }
    renderChatChannel();
  }
  function renderRoomSummary() {
    var r = room; if (!r) return;
    $('summary').innerHTML = '<div class="sum-mode"><b>' + esc(t('mode.' + r.mode + 'Online')) + '</b><span>' + esc(t('room.title', { id: r.id })) + '</span></div>' +
      '<p class="small">' + esc(t(r.you.role === 'spectator' ? 'room.youSpec' : 'room.youPlayer')) + '</p>';
  }

  /* ---------- 聊天 ---------- */
  var QUICK = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'];
  function renderChatChannel() {
    if (!room) return;
    var playing = room.status === 'playing' || room.status === 'setup';
    var spec = room.you.role === 'spectator';
    $('chat-title').textContent = playing && spec ? t('chat.specCh') : t('chat.title');
    $('chat-quick').innerHTML = QUICK.map(function (q) { return '<button type="button" class="chip" data-q="' + q + '">' + esc(t('quick.' + q)) + '</button>'; }).join('');
  }
  function renderChat() {
    if (!room) return;
    var list = $('chat-list');
    list.innerHTML = room.chat.map(chatItem).join('');
    list.scrollTop = list.scrollHeight;
  }
  function chatItem(m) {
    var mine = m.id === (room && room.you.id);
    return '<li class="chat-msg' + (mine ? ' mine' : '') + (m.ch === 'spec' ? ' spec' : '') + '">' + root.GuessArt.svg('avatars', m.avatar || 0, 'av-mini') +
      '<span class="cm-body"><b>' + esc(m.name) + (m.role === 'spectator' ? '<i>' + esc(t('chat.specTag')) + '</i>' : '') + '</b><span>' + esc(m.text) + '</span></span></li>';
  }
  function onChat(m) {
    if (!room) return;
    room.chat.push(m.msg);
    if (room.chat.length > 60) room.chat.shift();
    var list = $('chat-list');
    list.insertAdjacentHTML('beforeend', chatItem(m.msg));
    list.scrollTop = list.scrollHeight;
    if (m.msg.id !== room.you.id) {
      root.Sound.play('chat');
      if ($('app').getAttribute('data-side') !== 'open' && root.matchMedia('(max-width: 899px), (orientation: portrait) and (max-width: 1100px)').matches) { unread++; badge(); }
    }
  }
  function badge() { var b = $('side-badge'); b.hidden = unread <= 0; b.textContent = unread > 9 ? '9+' : String(unread); }
  function sideOpened() { unread = 0; badge(); }

  /* ---------- 對局畫面 ---------- */
  function now() { return Date.now() + clockOffset; }
  function showGame() {
    if (app().screen !== 'game') app().show('game', { focus: false });
    mountSide('game');
  }
  function playerName(i) { var s = room.seats[i]; return s ? s.name : t('room.leftPlayer'); }
  function rowsFrom(hist) {
    var n = 0;
    return (hist || []).map(function (h) { n++; return h.timeout ? { n: n, timeout: true } : { n: n, guess: h.guess, a: h.a, b: h.b }; });
  }
  function syncGame() {
    var r = room, g = r.game;
    if (!g) return;
    var you = r.you;
    var key = r.id + ':' + g.no + ':' + (r.mode === 'duel' ? (g.phase === 'setup' && you.role === 'player' && !(g.players[you.seat] && g.players[you.seat].locked) ? 'secret' : 'play') : 'play');
    var spec = { cs: g.spec.cs, n: g.spec.n, rep: g.spec.rep, pool: g.spec.pool, seed: 'room' };
    if (key !== setupKey) {
      setupKey = key;
      var purpose = key.slice(-6) === 'secret' ? 'secret' : 'guess';
      G.setup({ spec: spec, tier: g.tier, purpose: purpose, onSubmit: onSubmit, greet: purpose === 'secret' ? t('say.greetSecretDefault') : t(you.role === 'spectator' ? 'say.watching' : r.mode === 'duel' ? 'say.greetDuel' : 'say.greetOnline'), notes: you.role === 'player' });
      if (purpose === 'secret') {
        var me = g.players[you.seat];
        G.setInput(true);
        if (me && me.myDefault) G.recall(me.myDefault);
      }
    }
    var tabs = [], canInput = false, why = '', counter = '', deadline = 0, total = 1;
    if (r.mode === 'race') {
      if (you.role === 'player') {
        var mineP = g.players[you.seat];
        tabs.push({ label: t('tab.mine'), icon: K.icon('user'), rows: rowsFrom(mineP && mineP.hist), mine: true, focus: true });
        canInput = r.status === 'playing' && mineP && !mineP.solved && !mineP.out;
        why = mineP && mineP.solved ? t('why.solved') : mineP && mineP.out ? t('why.out') : '';
        counter = t('game.count', { n: mineP ? mineP.count : 0 });
      } else {
        g.players.forEach(function (p, i) { if (p) tabs.push({ label: playerName(i), icon: root.GuessArt.svg('avatars', (r.seats[i] && r.seats[i].avatar) || 0, 'tab-av'), rows: rowsFrom(p.hist) }); });
        why = t('why.spectator');
        counter = t('race.players', { n: g.players.filter(Boolean).length });
      }
      if (r.status === 'playing') { deadline = g.finishAt || g.endsAt; total = g.finishAt ? 10000 : (g.endsAt - g.startedAt); }
    } else {
      var seat = you.seat;
      if (g.phase === 'setup' || r.status === 'setup') {
        var lockedMine = you.role === 'player' && g.players[seat] && g.players[seat].locked;
        canInput = you.role === 'player' && !lockedMine;
        why = lockedMine ? t('why.waitSecret') : you.role === 'spectator' ? t('why.spectator') : '';
        counter = t('game.setSecret');
        if (g.setupEndsAt) { deadline = g.setupEndsAt; total = 60000; }
      } else {
        var other = seat >= 0 ? 1 - seat : 1;
        if (you.role === 'player') {
          tabs.push({ label: t('tab.mine'), icon: K.icon('user'), rows: rowsFrom(g.players[seat].hist), mine: true, focus: true });
          tabs.push({ label: t('tab.opp', { n: playerName(other) }), icon: K.icon('users'), rows: rowsFrom(g.players[other].hist) });
        } else {
          g.players.forEach(function (p, i) { if (p) tabs.push({ label: t('tab.guessesOf', { n: playerName(i) }), rows: rowsFrom(p.hist) }); });
        }
        canInput = r.status === 'playing' && you.role === 'player' && g.turn === seat;
        why = you.role === 'spectator' ? t('why.spectator') : t('why.oppTurn', { n: playerName(g.turn) });
        counter = t('duel.counter', { round: g.round, max: g.maxRounds });
        if (g.deadline && r.status === 'playing') { deadline = g.deadline; total = g.turnSec * 1000; }
      }
    }
    G.setTabs(tabs, true);
    G.setInput(canInput, why);
    G.setCounter(counter);
    G.setTimer(deadline, total, clockOffset);
    renderGameSummary();
  }

  function renderGameSummary() {
    var r = room, g = r.game; if (!g) return;
    var you = r.you;
    var html = '<div class="sum-mode"><b>' + esc(t('mode.' + r.mode + 'Online')) + '</b><span>' + esc(t('room.title', { id: r.id })) + '・' + esc(t('tier.' + g.tier)) + '</span></div>' +
      '<p class="small">' + esc(t('cs.' + g.spec.cs) + '・' + t('spec.n', { n: g.spec.n }) + '・' + (g.spec.rep ? t('spec.rep3') : t('spec.norep'))) + '</p>';
    if (r.mode === 'race' && r.status === 'playing') {
      /* 有人猜中後改顯示 10 秒收尾倒數 */
      var left = (g.finishAt || g.endsAt) - now();
      html += '<p class="race-clock' + (g.finishAt || left <= 30000 ? ' low' : '') + '">' + K.icon('timer') + K.clockHtml('until', Date.now() + left) + '<span>' + esc(t(g.finishAt ? 'race.finishLeft' : 'race.left')) + '</span></p>';
    }
    if (r.mode === 'race') {
      html += '<ul class="race-list">' + g.players.map(function (p, i) {
        if (!p) return '';
        var s = r.seats[i];
        var st = p.solved ? '<i class="ok">' + K.icon('check') + esc(t('race.solvedN', { n: p.solvedN })) + '</i>' : p.out ? '<i class="out">' + esc(t('race.out.' + p.out)) + '</i>' : '';
        var bar = '';
        for (var k = 0; k < 4; k++) bar += '<b class="' + (k < p.bestA ? 'a' : k < p.bestA + p.bestB ? 'b' : '') + '"></b>';
        return '<li class="' + (i === you.seat ? 'me' : '') + (i === g.winnerSeat ? ' winner' : '') + '">' + (s ? root.GuessArt.svg('avatars', s.avatar || 0, 'av-mini') : K.icon('user')) +
          '<span class="rl-name">' + esc(playerName(i)) + '</span>' +
          '<span class="rl-prog" aria-label="' + esc(t('race.progAria', { n: p.count, a: p.bestA, b: p.bestB })) + '"><span class="rl-bar">' + bar + '</span><small>' + esc(t('race.countN', { n: p.count })) + '</small></span>' + st + '</li>';
      }).join('') + '</ul>';
      if (g.finishAt && r.status === 'playing') html += '<p class="note warn">' + K.icon('timer') + esc(t('race.finishing', { n: playerName(g.winnerSeat) })) + '</p>';
    } else {
      var p0 = g.players[0], p1 = g.players[1];
      html += '<ul class="race-list">' + [p0, p1].map(function (p, i) {
        var s = r.seats[i];
        return '<li class="' + (i === you.seat ? 'me' : '') + (g.turn === i && r.status === 'playing' ? ' turn' : '') + '">' + (s ? root.GuessArt.svg('avatars', s.avatar || 0, 'av-mini') : K.icon('user')) + '<span class="rl-name">' + esc(playerName(i)) + (g.first === i ? ' <small>' + esc(t('duel.first')) + '</small>' : '') + '</span>' +
          '<span class="rl-prog"><small>' + (p ? (r.status === 'setup' ? esc(p.locked ? t('duel.locked') : t('duel.setting')) : t('duel.guesses', { n: p.count })) : '') + '</small></span></li>';
      }).join('') + '</ul>';
      var mineSec = you.role === 'player' && g.players[you.seat] && g.players[you.seat].mySecret;
      if (mineSec) html += '<div class="my-secret"><span>' + esc(t('sum.mySecret')) + '</span><div class="sec-code">' + mineSec.map(function (v) { return '<span class="h-sym">' + K.sym(g.spec, v, 'hist-sym') + '</span>'; }).join('') + '</div></div>';
    }
    html += '<div class="pool-row"><span class="pool-label">' + esc(t('sum.pool')) + '</span><div class="pool">' + g.spec.pool.map(function (id, i) { return '<span class="pool-sym">' + K.sym(g.spec, i, 'pool-svg') + '</span>'; }).join('') + '</div></div>';
    html += '<div class="sum-actions">' + (you.role === 'player' && (r.status === 'playing' || r.status === 'setup') ? '<button type="button" class="btn small danger" id="og-resign">' + K.icon('flag') + '<span>' + esc(t('sum.giveup')) + '</span></button>' : '') +
      '<button type="button" class="btn small ghost" id="og-room">' + K.icon('users') + '<span>' + esc(t('res.room')) + '</span></button></div>';
    $('summary').innerHTML = html;
    var rs = $('og-resign');
    if (rs) rs.onclick = function () { K.Modal({ title: t('giveup.title'), body: '<p>' + esc(t('giveup.bodyOnline')) + '</p>', actions: [{ label: t('common.cancel'), kind: 'ghost' }, { label: t('sum.giveup'), kind: 'danger', onClick: function () { Net.send({ type: 'resign' }); } }] }); };
    $('og-room').onclick = function () {
      if (r.status === 'playing' || r.status === 'setup') { K.toast(t('room.playingNow'), 'warn'); return; }
      wantGame = false; root.Result.hide(); app().show('room');
    };
  }

  function onSubmit(code) {
    if (!room || !room.game) return;
    if (room.mode === 'duel' && room.status === 'setup') Net.send({ type: 'secret', code: code });
    else Net.send({ type: 'guess', code: code });
    G.setInput(false, t('why.sending'));
  }

  function showResult(force) {
    var r = room, g = r.game; if (!g || !g.result) return;
    if (!force && shownResult === r.id + ':' + g.no) return;   // 用「房號:局號」，換房間後第 1 局也會顯示
    shownResult = r.id + ':' + g.no;
    var you = r.you, res = g.result;
    var spec = g.spec;
    var o = { spec: spec, answers: [], lines: [], again: {}, room: {}, home: {} };
    if (r.mode === 'race') {
      var myRow = res.ranking.filter(function (x) { return x.seat === you.seat; })[0];
      o.ranking = res.ranking.map(function (x) {
        var s = r.seats[x.seat];
        return { rank: x.rank, name: x.name, avatar: s ? s.avatar : 0, me: x.seat === you.seat && you.role === 'player', info: x.solved ? t('race.solvedN', { n: x.solvedN }) : x.out ? t('race.out.' + x.out) : t('race.best', { a: x.bestA, b: x.bestB }) };
      });
      if (you.role === 'player' && myRow) {
        o.kind = myRow.rank === 1 && myRow.solved ? 'win' : 'rank';
        var alone = !myRow.out && res.ranking.every(function (x) { return x.seat === myRow.seat || x.out === 'left' || x.out === 'idle'; });
        o.title = myRow.rank === 1 ? (myRow.solved ? t('res.raceWin') : res.timeUp ? t('res.timeUpWin') : alone ? t('res.lastStanding') : t('res.rank', { n: 1 })) : t('res.rank', { n: myRow.rank });
        o.mood = myRow.rank === 1 ? 'happy' : myRow.solved ? 'idle' : 'shake';
        o.lines.push(myRow.solved ? t('res.guesses', { n: myRow.solvedN }) : t('res.notSolved'));
        root.Store.record({ kind: (Core.charset(spec.cs) || {}).kind || 'digits', tier: -1, won: !!myRow.solved, guesses: myRow.solved ? myRow.solvedN : 0 });
      } else {
        o.kind = 'rank'; o.title = t('res.raceOver'); o.mood = 'idle';
      }
      if (res.timeUp) o.sub = t('res.timeUp');
      o.answers.push({ label: t('res.answer'), code: res.answer });
    } else {
      var w = res.winnerSeat;
      if (you.role === 'player') {
        o.kind = w < 0 ? 'draw' : w === you.seat ? 'win' : 'lose';
        o.title = w < 0 ? (res.reason === 'rounds' ? t('res.drawRounds') : t('res.draw')) : w === you.seat ? t('res.win') : res.reason === 'solved' ? t('res.oppWin', { n: res.names[w] || '' }) : res.reason === 'rounds' ? t('res.oppWinRounds', { n: res.names[w] || '' }) : t('res.lose');
        o.mood = o.kind === 'win' ? 'happy' : o.kind === 'draw' ? 'surprise' : 'shake';
        root.Store.record({ kind: (Core.charset(spec.cs) || {}).kind || 'digits', tier: -1, won: o.kind === 'win', guesses: res.counts[you.seat] || 0 });
      } else {
        o.kind = w < 0 ? 'draw' : 'rank';
        o.title = w < 0 ? t('res.draw') : t('res.someoneWin', { n: res.names[w] || '' });
        o.mood = 'idle';
      }
      if (res.reason && res.reason !== 'solved') o.sub = t('res.reason.' + res.reason);
      res.secrets.forEach(function (sec, i) { if (sec) o.answers.push({ label: t('res.secretOf', { n: res.names[i] || '' }), code: sec }); });
      o.lines.push(res.names.map(function (n, i) { return t('res.countOf', { n: n || '', c: res.counts[i] }); }).join('・'));
    }
    if (o.kind === 'win') root.Sound.play('win'); else if (o.kind === 'lose') root.Sound.play('lose');
    o.again = you.role === 'player'
      ? { label: t('res.againReady'), onClick: function () { Net.send({ type: 'ready', value: true }); wantGame = false; app().show('room'); } }
      : { note: t('res.specNoAgain') };
    o.room = { onClick: function () { wantGame = false; app().show('room'); } };
    o.home = { onClick: function () { Net.send({ type: 'leave' }); room = null; forgetRoom(); setupKey = ''; Net.close(); app().show('home'); } };
    G.say(o.kind === 'win' ? t('say.win') : o.kind === 'lose' ? t('say.lose') : t('say.over'), o.mood);
    root.Result.show(o);
  }

  /* ---------- 伺服器訊息 ---------- */
  /* 對局中重新整理：同一分頁記住房號，回來時自動連線回原席位（伺服器保留 30 秒） */
  var ROOM_KEY = 'guess-ab:room';
  function rememberRoom(id) { try { sessionStorage.setItem(ROOM_KEY, id); } catch (e) { /* 忽略 */ } }
  function forgetRoom() { try { sessionStorage.removeItem(ROOM_KEY); } catch (e) { /* 忽略 */ } }
  function onRoom(m) {
    if (m.room && m.room.id) rememberRoom(m.room.id);
    var prev = room;
    room = m.room;
    clockOffset = (room.serverNow || Date.now()) - Date.now();
    if (!prev || prev.id !== room.id) { invite = null; clearInviteUrl(); unread = 0; badge(); }
    renderChat();
    var playing = room.status === 'playing' || room.status === 'setup';
    if (playing) {
      if (prev && prev.status === 'finished') root.Result.hide();
      wantGame = true;
      showGame();
      syncGame();
      if (!prev || prev.status !== room.status) renderChatChannel();
      if (root.GameAnalytics) root.GameAnalytics.sync('playing', room.id + ':' + room.game.no, { mode: 'online', spectator: room.you.role === 'spectator', players: room.seats.filter(Boolean).length });
    } else if (room.status === 'finished' && room.game && (wantGame || app().screen === 'game')) {
      showGame();
      syncGame();
      renderChatChannel();
      if (root.GameAnalytics) root.GameAnalytics.sync('finished', room.id + ':' + room.game.no, null, { result: 'complete' });
      showResult(false);
    } else {
      if (app().screen !== 'room') app().show('room', { focus: !prev });
      else renderRoom();
    }
    app().updateTop();
  }
  function onGuessed(m) {
    if (!room || m.seat !== room.you.seat) return;
    G.feedback(m.a, m.b);
    var say = m.a === 4 ? [t('say.win'), 'happy'] : m.a + m.b === 4 ? [t('say.allIn'), 'surprise'] : m.a >= 2 ? [t('say.close'), 'happy'] : (!m.a && !m.b) ? [t('say.none'), 'think'] : [t('say.keep'), 'idle'];
    G.say(say[0], say[1]);
  }
  function onClosed(m) {
    var wasIn = !!room;
    room = null; forgetRoom(); setupKey = '';
    root.Result.hide();
    K.Modal.closeAll();
    if (wasIn) K.toast(t('closed.' + (m.reason || 'no_players')), 'warn', 4000);
    if (Net.status === 'open') Net.send({ type: 'lobby' });
    app().show('lobby');
  }
  function onError(m) {
    var key = 'err.' + m.code;
    K.toast(root.I18N.has(key) ? t(key, m.params) : t('err.generic'), 'warn');
    if (room && room.game) syncGame();
    if (/^invite_|room_missing/.test(m.code)) { invite = null; clearInviteUrl(); if (app().screen === 'lobby') renderLobby(); }
  }
  function onToast(m) {
    var key = 'toast.' + m.code;
    if (!root.I18N.has(key) || m.code === 'setSecret' || m.code === 'over') return;   // 結束由結算視窗呈現，不再疊 toast 蓋住按鈕
    var p = Object.assign({}, m.params);
    if (m.code === 'duelStart' && room) p.first = playerName(m.params.first);
    K.toast(t(key, p), m.code === 'idleWarn' || m.code === 'dcLoss' || m.code === 'idleOut' ? 'warn' : '');
    if (m.code === 'start' || m.code === 'duelStart') root.Sound.play('turn');
  }

  function init() {
    K = root.Kit; G = root.GameView; Net = root.Net;
    Net.on('room', onRoom);
    Net.on('lobby', function (m) { rooms = m.rooms || []; if (!room) forgetRoom();   // 伺服器說你不在房間裡（例如超過 30 秒），就不再自動回房
      if (app().screen === 'lobby') renderLobby(); });
    Net.on('closed', onClosed);
    Net.on('left', function () { room = null; forgetRoom(); setupKey = ''; if (app().screen === 'room' || app().screen === 'game') app().show('lobby'); });
    Net.on('error', onError);
    Net.on('toast', onToast);
    Net.on('chat', onChat);
    Net.on('guessed', onGuessed);
    Net.on('welcome', function () { connected = true; Net.send({ type: 'lobby' }); });
    Net.on('status', function () { if (app().screen === 'lobby') renderLobby(); if (Net.status !== 'open' && room && app().screen === 'game') G.setInput(false, t('why.reconnecting')); });
    $('chat-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = $('chat-input');
      var v = inp.value.trim();
      if (!v || !room) return;
      Net.send({ type: 'chat', text: v });
      inp.value = '';
    });
    $('chat-quick').addEventListener('click', function (e) { var b = e.target.closest('[data-q]'); if (b && room) Net.send({ type: 'chat', text: t('quick.' + b.getAttribute('data-q')) }); });
    root.I18N.onChange(function () {
      if (!room) { if (app().screen === 'lobby') renderLobby(); return; }
      renderChatChannel(); renderChat();
      if (app().screen === 'room') renderRoom();
      else if (app().screen === 'game') { setupKey = ''; syncGame(); }
    });
    var back = null; try { back = sessionStorage.getItem(ROOM_KEY); } catch (e) { back = null; }
    if (back) setTimeout(function () { if (app().screen === 'home' && !room) enterLobby(); }, 0);
    /* 時間顯示需要每秒更新（倒數） */
    setInterval(function () { if (room && room.game && room.status === 'playing' && app().screen === 'game') renderGameSummary(); }, 1000);
  }

  root.OnlineUI = {
    init: init, enterLobby: enterLobby, exitLobby: exitLobby, inRoom: inRoom, confirmLeave: confirmLeave, sideOpened: sideOpened,
    renderLobby: renderLobby, renderRoom: renderRoom, get room() { return room; }
  };
})(typeof self !== 'undefined' ? self : this);
