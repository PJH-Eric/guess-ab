/* ===== app.js — 畫面切換、首頁、單機選單、開局設定、闖關、統計、教學、設定、語言 =====
 * 首頁、單機與本機電腦一律不連線；只有進入「跟別人玩」或點邀請連結才連到伺服器。
 */
(function (root) {
  'use strict';
  var doc = root.document;
  var Core = root.GuessCore, Table = root.GuessSpecTable, Levels = root.GuessLevels;
  var K, Store = root.Store;
  var screen = 'boot';
  var setupState = null;
  var levelTier = 0;
  var statsTab = 'all';

  function $(id) { return doc.getElementById(id); }
  function t(k, p) { return root.I18N.t(k, p); }
  function esc(s) { return K.esc(s); }

  /* ---------- 圖示填充：data-icon ---------- */
  function fillIcons(scope) {
    (scope || doc).querySelectorAll('[data-icon]').forEach(function (el) {
      if (el.getAttribute('data-filled') === el.getAttribute('data-icon')) return;
      el.innerHTML = K.icon(el.getAttribute('data-icon'));
      el.setAttribute('data-filled', el.getAttribute('data-icon'));
    });
  }

  /* ---------- 畫面切換 ---------- */
  var SCREENS = ['home', 'solo', 'setup', 'levels', 'stats', 'help', 'lobby', 'room', 'game'];
  function show(name, opt) {
    opt = opt || {};
    if (SCREENS.indexOf(name) < 0) name = 'home';
    var prev = screen;
    screen = name;
    $('app').setAttribute('data-screen', name);
    SCREENS.forEach(function (s) { var el = $('scr-' + s); if (el) el.hidden = s !== name; });
    if (name !== 'game') { root.Result.hide(); closeSide(); }
    if (name === 'game' && !(root.OnlineUI && root.OnlineUI.inRoom())) {
      /* 單機：側欄放回遊戲畫面、不顯示聊天室 */
      var side = $('side');
      if (side.parentElement !== $('scr-game')) $('scr-game').insertBefore(side, $('g-center'));
      $('chatbox').hidden = true;
    }
    var renderer = RENDER[name];
    if (renderer) renderer();
    updateTop();
    if (root.ServerOutage) root.ServerOutage.setScreen(name === 'lobby' || name === 'room' ? name : (name === 'game' && root.OnlineUI && root.OnlineUI.inRoom() ? 'room' : name));
    if (root.GameAnalytics) root.GameAnalytics.pageView(name);
    if (!opt.fromPop && prev !== name && name !== 'game') {
      try { root.history.pushState({ s: name }, ''); } catch (e) { /* 忽略 */ }
    } else if (!opt.fromPop && name === 'game' && prev !== 'game') {
      try { root.history.pushState({ s: 'game' }, ''); } catch (e) { /* 忽略 */ }
    }
    var main = $('scr-' + name);
    if (main && main.scrollTop) main.scrollTop = 0;
    fillIcons();
    K.refreshScroll();
    if (opt.focus !== false) {
      var h = main && main.querySelector('h1, h2');
      if (h && name !== 'game') { h.tabIndex = -1; try { h.focus({ preventScroll: true }); } catch (e) { /* 忽略 */ } }
    }
  }
  function setTitle(text) { $('top-title').textContent = text || ''; }
  function updateTop() {
    var inGame = screen === 'game';
    var online = root.OnlineUI && root.OnlineUI.inRoom();
    $('btn-lobby').hidden = screen !== 'home' || !root.LobbyLink || !root.LobbyLink.url;
    if (!$('btn-lobby').hidden) $('btn-lobby').href = root.LobbyLink.url;
    $('btn-back').hidden = screen === 'home' || screen === 'boot';
    $('btn-side').hidden = !inGame;
    $('btn-pause').hidden = !(inGame && !online && root.Solo.active && !root.Solo.active.over);
    if (screen === 'home') setTitle('');
    else if (!inGame && screen !== 'room') setTitle(t('title.' + screen));
  }

  /* ---------- 側欄（手機與平板直向是抽屜） ---------- */
  function openSide() { $('app').setAttribute('data-side', 'open'); $('side-backdrop').hidden = false; $('btn-side').setAttribute('aria-expanded', 'true'); var b = $('side-close'); if (b) b.focus({ preventScroll: true }); if (root.OnlineUI) root.OnlineUI.sideOpened(); }
  function closeSide() { $('app').setAttribute('data-side', 'closed'); $('side-backdrop').hidden = true; $('btn-side').setAttribute('aria-expanded', 'false'); }

  /* ---------- 返回 ---------- */
  function goBack() {
    if (K.Modal.top()) { K.Modal.top().close(); return; }
    switch (screen) {
      case 'solo': case 'stats': case 'help': show('home'); break;
      case 'setup': case 'levels': show('solo'); break;
      case 'lobby': root.OnlineUI.exitLobby(); break;
      case 'room': root.OnlineUI.confirmLeave(); break;
      case 'game':
        if (root.OnlineUI && root.OnlineUI.inRoom()) { root.OnlineUI.confirmLeave(); break; }
        var a = root.Solo.active;
        if (a && !a.over && (a.rows.length || a.aiRows.length || a.mySecret)) {
          K.Modal({ title: t('leave.title'), body: '<p>' + esc(t('leave.body')) + '</p>', actions: [
            { label: t('common.stay'), kind: 'ghost' },
            { label: t('leave.ok'), kind: 'danger', onClick: function () { root.Solo.stop(); show(a.mode === 'level' ? 'levels' : a.mode === 'daily' ? 'home' : 'setup'); } }] });
        } else { root.Solo.stop(); show(a && a.mode === 'level' ? 'levels' : a && a.mode === 'daily' ? 'home' : a ? 'setup' : 'home'); }
        break;
      default: show('home');
    }
  }

  /* ---------- 首頁 ---------- */
  function todayInfo() {
    var today = Core.taipeiDate();
    var y = Core.taipeiDate(Date.now() - 86400000);
    return { info: Levels.dailyInfo(today), done: Store.dailyDone(today), streak: Store.liveStreak(today, y) };
  }
  function renderHome() {
    var d = todayInfo();
    var info = d.info;
    $('scr-home').innerHTML =
      '<div class="home">' +
      '<div class="hero"><div class="hero-art">' + root.GuessArt.svg('mascot', 0, 'hero-mascot') +
      '<div class="hero-dials" aria-hidden="true"><span>' + root.GuessArt.svg('digits', 1) + '</span><span>' + root.GuessArt.svg('letters', 0) + '</span><span>' + root.GuessArt.svg('pack-fruit', 0) + '</span><span>' + root.GuessArt.svg('gems', 5) + '</span></div></div>' +
      '<h1 id="home-title" class="logo"><span class="logo-main">' + esc(t('home.title')) + '</span><span class="logo-ab">1A2B</span></h1>' +
      '<p class="tagline">' + esc(t('home.tagline')) + '</p></div>' +
      '<div class="home-main">' +
      '<button type="button" class="big-btn b-solo" id="h-solo">' + K.icon('user') + '<span><b>' + esc(t('home.solo')) + '</b><small>' + esc(t('home.soloSub')) + '</small></span></button>' +
      '<button type="button" class="big-btn b-online" id="h-online">' + K.icon('users') + '<span><b>' + esc(t('home.online')) + '</b><small>' + esc(t('home.onlineSub')) + '</small></span></button>' +
      '<button type="button" class="big-btn b-help" id="h-help">' + K.icon('book') + '<span><b>' + esc(t('home.help')) + '</b><small>' + esc(t('home.helpSub')) + '</small></span></button>' +
      '</div>' +
      '<div class="home-sub">' +
      '<button type="button" class="daily-card" id="h-daily"><span class="dc-ico">' + K.csIcon(info.spec.cs, 'dc-cs') + '</span><span class="dc-text"><b>' + esc(t('home.daily')) + '</b><small>' + esc(t('cs.' + info.spec.cs) + '・' + t('spec.n', { n: info.spec.n }) + (info.spec.rep ? '・' + t('spec.rep') : '')) + '</small></span>' +
      '<span class="dc-state">' + (d.done ? '<i class="done">' + K.icon('check') + esc(t('home.dailyDone')) + '</i>' : '<i>' + esc(t('home.dailyGo')) + '</i>') + '<i class="streak">' + K.icon('flame') + d.streak + '</i></span></button>' +
      '<button type="button" class="small-card" id="h-stats">' + K.icon('chart') + '<span>' + esc(t('home.stats')) + '</span></button>' +
      '</div></div>';
    $('h-solo').onclick = function () { show('solo'); };
    $('h-online').onclick = function () { root.OnlineUI.enterLobby(); };
    $('h-help').onclick = function () { show('help'); };
    $('h-daily').onclick = function () { root.Solo.start({ mode: 'daily' }); };
    $('h-stats').onclick = function () { show('stats'); };
  }

  /* ---------- 單機選單 ---------- */
  function renderSolo() {
    var items = [
      ['guess', 'key', 'solo.guess', 'solo.guessSub'],
      ['aiGuess', 'robot', 'solo.aiGuess', 'solo.aiGuessSub'],
      ['duel', 'users', 'solo.duel', 'solo.duelSub'],
      ['levels', 'map', 'solo.levels', 'solo.levelsSub'],
      ['daily', 'calendar', 'solo.daily', 'solo.dailySub']
    ];
    $('scr-solo').innerHTML = '<div class="page"><h1 class="page-title">' + esc(t('title.solo')) + '</h1><div class="mode-grid">' +
      items.map(function (it) {
        return '<button type="button" class="mode-card" data-m="' + it[0] + '"><span class="mc-ico">' + K.icon(it[1]) + '</span><span class="mc-text"><b>' + esc(t(it[2])) + '</b><small>' + esc(t(it[3])) + '</small></span></button>';
      }).join('') + '</div></div>';
    $('scr-solo').querySelectorAll('[data-m]').forEach(function (b) {
      b.addEventListener('click', function () {
        var m = b.getAttribute('data-m');
        if (m === 'levels') show('levels');
        else if (m === 'daily') root.Solo.start({ mode: 'daily' });
        else openSetup(m);
      });
    });
  }

  /* ---------- 開局設定 ---------- */
  function csItems() {
    var list = [];
    ['digits', 'letters', 'gems'].forEach(function (c) { list.push({ value: c, label: t('cs.' + c), icon: K.csIcon(c, 'menu-ico'), group: t('csg.basic') }); });
    Core.CUTE_PACKS.forEach(function (p) { list.push({ value: 'pack-' + p, label: t('cs.pack-' + p), icon: K.csIcon('pack-' + p, 'menu-ico'), group: t('csg.cute') }); });
    Core.REAL_PACKS.forEach(function (p) { list.push({ value: 'pack-' + p, label: t('cs.pack-' + p), icon: K.csIcon('pack-' + p, 'menu-ico'), group: t('csg.real') }); });
    list.push({ value: 'mix', label: t('cs.mix'), icon: K.csIcon('mix', 'menu-ico'), group: t('csg.mix') });
    return list;
  }
  function openSetup(mode) {
    var last = Store.get('lastSetup') || {};
    setupState = { mode: mode, tier: last.tier != null ? last.tier : 2, cs: Core.charset(last.cs) ? last.cs : 'digits', n: last.n || 10, rep: !!last.rep, first: last.first || 'random', seed: Core.randomSeed() };
    setupState.n = Core.clampN(setupState.cs, setupState.n);
    show('setup');
  }
  function renderSetup() {
    var s = setupState;
    if (!s) { openSetup('guess'); return; }
    var c = Core.charset(s.cs);
    var tierItems = [0, 1, 2, 3].map(function (x) { return { value: String(x), label: t('tier.' + x) }; });
    var spec = Core.makeSpec({ cs: s.cs, n: s.n, rep: s.rep }, 'solo:' + s.seed);
    var size = Core.spaceSize(s.n, s.rep);
    var limit = Table.limit(s.tier, s.n, s.rep);
    var html = '<div class="page setup"><h1 class="page-title">' + esc(t('mode.' + s.mode)) + '</h1>' +
      '<div class="form">' +
      '<div class="field"><span class="f-label" id="lb-tier">' + esc(t(s.mode === 'guess' ? 'setup.tier' : 'setup.aiTier')) + '</span>' + K.segHtml('f-tier', tierItems, String(s.tier), t('setup.tier')) +
      '<small class="f-help">' + esc(t('tierHelp.' + (s.mode === 'guess' ? 'g' : 'a') + s.tier)) + '</small></div>' +
      '<div class="field"><span class="f-label">' + esc(t('setup.cs')) + '</span><button type="button" class="select-btn" id="f-cs" aria-haspopup="listbox" aria-expanded="false">' + K.csIcon(s.cs, 'menu-ico') + '<span>' + esc(t('cs.' + s.cs)) + '</span>' + K.icon('back', 'chev') + '</button></div>' +
      '<div class="field row2"><div><span class="f-label">' + esc(t('setup.n')) + '</span>' + K.stepperHtml('f-n', s.n, t('setup.n')) + '<small class="f-help">' + esc(t('setup.nRange', { min: c.min, max: c.max })) + '</small></div>' +
      '<div><span class="f-label" id="lb-rep">' + esc(t('setup.rep')) + '</span><div class="switch-row">' + K.switchHtml('f-rep', s.rep, t('setup.rep')) + '<span>' + esc(s.rep ? t('setup.repOn') : t('setup.repOff')) + '</span></div></div></div>' +
      (s.mode === 'duel' ? '<div class="field"><span class="f-label">' + esc(t('setup.first')) + '</span>' + K.segHtml('f-first', [{ value: 'random', label: t('first.random') }, { value: 'me', label: t('first.me') }, { value: 'ai', label: t('first.ai') }], s.first, t('setup.first')) + '</div>' : '') +
      '<div class="field"><span class="f-label">' + esc(t('setup.pool')) + '<button type="button" class="link-btn" id="f-reroll">' + K.icon('shuffle') + esc(t('setup.reroll')) + '</button></span>' +
      '<div class="pool big">' + spec.pool.map(function (id, i) { return '<span class="pool-sym" title="' + esc(K.symName(spec, i)) + '">' + K.sym(spec, i, 'pool-svg') + '</span>'; }).join('') + '</div></div>' +
      '<p class="setup-info">' + K.icon('question') + '<span>' + esc(t('setup.info', { size: size.toLocaleString(), limit: limit ? t('sum.limitN', { n: limit }) : t('sum.unlimited') })) + '</span></p>' +
      '</div><div class="page-actions"><button type="button" class="btn primary big" id="f-start">' + K.icon('play') + '<span>' + esc(t('setup.start')) + '</span></button></div></div>';
    $('scr-setup').innerHTML = html;
    function save() { Store.set('lastSetup', { mode: s.mode, tier: s.tier, cs: s.cs, n: s.n, rep: s.rep, first: s.first }); }
    K.bindSeg($('f-tier'), function (v) { s.tier = Number(v); save(); renderSetupKeep(); });
    if ($('f-first')) K.bindSeg($('f-first'), function (v) { s.first = v; save(); });
    K.bindStepper($('f-n'), function () { return s.n; }, function (v) { s.n = v; save(); renderSetupKeep('f-n'); }, function () { return c.min; }, function () { return c.max; });
    K.bindSwitch($('f-rep'), function (v) { s.rep = v; save(); renderSetupKeep('f-rep'); });
    $('f-cs').addEventListener('click', function () {
      K.menu($('f-cs'), { items: csItems(), value: s.cs, wide: true, label: t('setup.cs'), onPick: function (v) { s.cs = v; s.n = Core.clampN(v, s.n); save(); renderSetupKeep('f-cs'); } });
    });
    $('f-reroll').addEventListener('click', function () { s.seed = Core.randomSeed(); root.Sound.play('tick'); renderSetupKeep('f-reroll'); });
    $('f-start').addEventListener('click', function () {
      root.Solo.start({ mode: s.mode, tier: s.tier, cs: s.cs, n: s.n, rep: s.rep, first: s.first, seed: 'solo:' + s.seed });
      s.seed = Core.randomSeed();
    });
    fillIcons($('scr-setup'));
  }
  function renderSetupKeep(focusId) {
    var y = $('scr-setup').scrollTop;
    var active = focusId || (doc.activeElement && doc.activeElement.id);
    renderSetup();
    $('scr-setup').scrollTop = y;
    var el = active && $(active);
    if (el) { var b = el.matches('.stepper') ? el.querySelector('.step-val') : el; try { (el.matches('.seg') ? el.querySelector('[aria-checked="true"]') : el.matches('.stepper') ? el : el).focus({ preventScroll: true }); } catch (e) { /* 忽略 */ } }
    K.refreshScroll();
  }

  /* ---------- 闖關 ---------- */
  function renderLevels() {
    var tier = levelTier;
    var prog = Store.tierProgress(tier);
    var tierItems = [0, 1, 2, 3].map(function (x) { return { value: String(x), label: t('tier.' + x) }; });
    var cards = '';
    for (var L = 1; L <= 100; L++) {
      var sp = Levels.specFor(tier, L);
      var st = Store.starsOf(tier, L);
      var open = Store.unlocked(tier, L);
      var boss = L % 10 === 0;
      cards += '<button type="button" class="lv-card' + (boss ? ' boss' : '') + (st ? ' cleared' : '') + '" data-l="' + L + '"' + (open ? '' : ' disabled aria-disabled="true"') +
        ' aria-label="' + esc(t('level.aria', { n: L, cs: t('cs.' + sp.cs), k: sp.n, rep: sp.rep ? t('spec.rep') : t('spec.norep'), s: st })) + (open ? '' : '，' + esc(t('level.locked'))) + '">' +
        '<b class="lv-no">' + L + '</b><span class="lv-cs">' + K.csIcon(sp.cs, 'lv-svg') + '</span><span class="lv-spec">' + sp.n + (sp.rep ? '<i class="rep-mark">' + K.icon('refresh') + '</i>' : '') + '</span>' +
        '<span class="lv-stars">' + (open ? [0, 1, 2].map(function (i) { return '<i class="' + (i < st ? 'on' : '') + '">' + K.icon(i < st ? 'star' : 'star-empty') + '</i>'; }).join('') : '<i class="lock">' + K.icon('lock') + '</i>') + '</span></button>';
    }
    $('scr-levels').innerHTML = '<div class="page levels"><div class="lv-head"><h1 class="page-title">' + esc(t('title.levels')) + '</h1>' +
      K.segHtml('lv-tier', tierItems, String(tier), t('setup.tier')) +
      '<p class="lv-prog">' + esc(t('level.progress', { c: prog.cleared, s: prog.stars })) + '</p></div>' +
      '<div class="lv-grid scroll" id="lv-grid">' + cards + '</div></div>';
    K.bindSeg($('lv-tier'), function (v) { levelTier = Number(v); Store.set('lastTier', levelTier); renderLevels(); var b = $('lv-tier').querySelector('[aria-checked="true"]'); if (b) b.focus(); });
    $('lv-grid').addEventListener('click', function (e) {
      var b = e.target.closest('.lv-card'); if (!b || b.disabled) return;
      root.Solo.start({ mode: 'level', level: { tier: levelTier, L: Number(b.getAttribute('data-l')) } });
    });
    /* 捲到第一個還沒通關的關卡 */
    var first = $('lv-grid').querySelector('.lv-card:not(.cleared):not([disabled])');
    if (first) setTimeout(function () { first.scrollIntoView({ block: 'center' }); }, 30);
  }

  /* ---------- 統計 ---------- */
  function renderStats() {
    var s = Store.get('stats');
    var daily = Store.get('daily');
    var tabs = [{ value: 'all', label: t('stats.all') }, { value: 'digits', label: t('cs.digits') }, { value: 'letters', label: t('cs.letters') }, { value: 'gems', label: t('cs.gems') }, { value: 'pack', label: t('stats.pack') }, { value: 'mix', label: t('cs.mix') }];
    var src = statsTab === 'all' ? s : (s.byKind[statsTab] || { games: 0, wins: 0, sumGuess: 0, fastest: 0, dist: {} });
    var avg = src.wins ? (src.sumGuess / src.wins).toFixed(1) : '—';
    var rate = src.games ? Math.round(src.wins * 100 / src.games) + '%' : '—';
    var dist = src.dist || {};
    var maxV = 0; for (var k = 1; k <= 13; k++) maxV = Math.max(maxV, dist[k] || 0);
    var bars = '';
    for (var b = 1; b <= 13; b++) {
      var v = dist[b] || 0;
      bars += '<div class="bar-row"><span class="bar-k">' + (b === 13 ? '13+' : b) + '</span><span class="bar"><i style="width:' + (maxV ? Math.max(v ? 4 : 0, v * 100 / maxV) : 0) + '%"></i></span><span class="bar-v">' + v + '</span></div>';
    }
    var tierRows = [0, 1, 2, 3].map(function (x) {
      var r = s.byTier[x] || { games: 0, wins: 0, best: 0 };
      var p = Store.tierProgress(x);
      return '<tr><th scope="row">' + esc(t('tier.' + x)) + '</th><td>' + r.games + '</td><td>' + r.wins + '</td><td>' + (r.best || '—') + '</td><td>' + p.cleared + '/100</td><td>' + p.stars + '</td></tr>';
    }).join('');
    $('scr-stats').innerHTML = '<div class="page stats"><h1 class="page-title">' + esc(t('title.stats')) + '</h1>' +
      K.segHtml('st-tab', tabs, statsTab, t('title.stats')) +
      '<div class="stat-grid">' +
      stat('chart', t('stats.games'), src.games) + stat('trophy', t('stats.rate'), rate) + stat('key', t('stats.avg'), avg) + stat('timer', t('stats.fastest'), src.fastest || '—') +
      (statsTab === 'all' ? stat('flame', t('stats.streak'), daily.streak || 0) + stat('star', t('stats.bestStreak'), daily.best || 0) : '') +
      '</div><section class="panel"><h2 class="box-title">' + K.icon('chart') + esc(t('stats.dist')) + '</h2><div class="bars" role="img" aria-label="' + esc(t('stats.distAria')) + '">' + bars + '</div></section>' +
      (statsTab === 'all' ? '<section class="panel"><h2 class="box-title">' + K.icon('map') + esc(t('stats.byTier')) + '</h2><div class="table-wrap scroll"><table class="tbl"><thead><tr><th></th><th>' + esc(t('stats.games')) + '</th><th>' + esc(t('stats.wins')) + '</th><th>' + esc(t('stats.fastest')) + '</th><th>' + esc(t('stats.levels')) + '</th><th>' + esc(t('stats.stars')) + '</th></tr></thead><tbody>' + tierRows + '</tbody></table></div></section>' : '') +
      '<p class="note">' + esc(t('stats.note')) + '</p></div>';
    K.bindSeg($('st-tab'), function (v) { statsTab = v; renderStats(); var bt = $('st-tab').querySelector('[aria-checked="true"]'); if (bt) bt.focus(); });
  }
  function stat(ico, label, v) { return '<div class="stat">' + K.icon(ico) + '<b>' + esc(v) + '</b><span>' + esc(label) + '</span></div>'; }

  /* ---------- 教學（純圖文） ---------- */
  function codeRow(set, ids) { return '<span class="ex-code">' + ids.map(function (i) { return '<span class="h-sym">' + root.GuessArt.svg(set, i, 'hist-sym') + '</span>'; }).join('') + '</span>'; }
  function renderHelp() {
    var fb = root.GameView.fbHtml;
    var html = '<div class="page help"><h1 class="page-title">' + esc(t('title.help')) + '</h1>' +
      sec('key', 'help.goalT', '<p>' + esc(t('help.goal')) + '</p>') +
      sec('lock', 'help.abT', '<p>' + esc(t('help.ab')) + '</p><div class="ex"><div class="ex-row"><span class="ex-l">' + esc(t('help.secret')) + '</span>' + codeRow('digits', [1, 2, 3, 4]) + '</div>' +
        '<div class="ex-row"><span class="ex-l">' + esc(t('help.guess')) + '</span>' + codeRow('digits', [1, 3, 2, 5]) + '<span class="h-fb">' + fb(1, 2) + '</span></div></div>' +
        '<p class="small">' + esc(t('help.abWhy')) + '</p>') +
      sec('refresh', 'help.repT', '<p>' + esc(t('help.rep')) + '</p><div class="ex"><div class="ex-row"><span class="ex-l">' + esc(t('help.secret')) + '</span>' + codeRow('letters', [0, 1, 0, 2]) + '</div>' +
        '<div class="ex-row"><span class="ex-l">' + esc(t('help.guess')) + '</span>' + codeRow('letters', [0, 0, 1, 1]) + '<span class="h-fb">' + fb(1, 2) + '</span></div></div><p class="small">' + esc(t('help.repWhy')) + '</p>') +
      sec('grid', 'help.kindsT', '<p>' + esc(t('help.kinds')) + '</p><div class="kinds">' + root.GuessCore.CHARSET_IDS.map(function (c) { return '<span class="kind">' + K.csIcon(c, 'kind-svg') + '<small>' + esc(t('cs.' + c)) + '</small></span>'; }).join('') + '</div>') +
      sec('enter', 'help.inputT', '<ul class="tips"><li>' + esc(t('help.in1')) + '</li><li>' + esc(t('help.in2')) + '</li><li>' + esc(t('help.in3')) + '</li><li>' + esc(t('help.in4')) + '</li><li>' + esc(t('help.in5')) + '</li></ul>') +
      sec('pencil', 'help.notesT', '<p>' + esc(t('help.notes')) + '</p>') +
      sec('question', 'help.hintT', '<p>' + esc(t('help.hint')) + '</p>') +
      sec('map', 'help.modesT', '<ul class="tips"><li>' + esc(t('help.m1')) + '</li><li>' + esc(t('help.m2')) + '</li><li>' + esc(t('help.m3')) + '</li><li>' + esc(t('help.m4')) + '</li><li>' + esc(t('help.m5')) + '</li></ul>') +
      sec('users', 'help.onlineT', '<ul class="tips"><li>' + esc(t('help.o1')) + '</li><li>' + esc(t('help.o2')) + '</li><li>' + esc(t('help.o3')) + '</li></ul>') +
      '<div class="page-actions"><button type="button" class="btn primary big" id="help-go">' + K.icon('play') + '<span>' + esc(t('help.go')) + '</span></button></div></div>';
    $('scr-help').innerHTML = html;
    $('help-go').onclick = function () { openSetup('guess'); };
  }
  function sec(ico, title, body) { return '<section class="panel help-sec"><h2 class="box-title">' + K.icon(ico) + esc(t(title)) + '</h2>' + body + '</section>'; }

  /* ---------- 設定 ---------- */
  function openSettings() {
    var s = function (k) { return Store.get(k); };
    var body = doc.createElement('div');
    body.className = 'settings';
    body.innerHTML =
      '<div class="set-group"><h3>' + esc(t('set.sound')) + '</h3>' +
      setRow('set-music', t('set.music'), K.switchHtml('set-music', s('musicOn'), t('set.music'))) +
      setRow('set-musicVol', t('set.musicVol'), K.stepperHtml('set-musicVol', Math.round(s('musicVol') * 10), t('set.musicVol'))) +
      setRow('set-sfx', t('set.sfx'), K.switchHtml('set-sfx', s('sfxOn'), t('set.sfx'))) +
      setRow('set-sfxVol', t('set.sfxVol'), K.stepperHtml('set-sfxVol', Math.round(s('sfxVol') * 10), t('set.sfxVol'))) +
      setRow('set-vib', t('set.vibrate'), K.switchHtml('set-vib', s('vibrate'), t('set.vibrate'))) + '</div>' +
      '<div class="set-group"><h3>' + esc(t('set.input')) + '</h3>' +
      setRow('set-auto', t('set.auto'), K.switchHtml('set-auto', s('autoSubmit'), t('set.auto')), t('set.autoHelp')) +
      setRow('set-hk', t('set.histKeys'), K.switchHtml('set-hk', s('historyKeys'), t('set.histKeys'))) +
      '<div class="set-row col"><span>' + esc(t('set.inputMode')) + '</span>' + K.segHtml('set-im', [{ value: 'both', label: t('im.both') }, { value: 'keypad', label: t('im.keypad') }, { value: 'wheel', label: t('im.wheel') }], s('inputMode'), t('set.inputMode')) + '</div>' +
      '<div class="set-row col"><span>' + esc(t('set.keys')) + '</span>' + K.segHtml('set-keys', [{ value: 'auto', label: t('keys.auto') }, { value: 'on', label: t('keys.on') }, { value: 'off', label: t('keys.off') }], s('showKeys'), t('set.keys')) + '</div></div>' +
      '<div class="set-group"><h3>' + esc(t('set.view')) + '</h3>' +
      setRow('set-rm', t('set.reduce'), K.switchHtml('set-rm', s('reduceMotion'), t('set.reduce'))) +
      setRow('set-ca', t('set.assist'), K.switchHtml('set-ca', s('colorAssist'), t('set.assist')), t('set.assistHelp')) +
      '<div class="set-row col"><span>' + esc(t('set.lang')) + '</span>' + K.segHtml('set-lang', [{ value: 'zh-Hant', label: '繁體中文' }, { value: 'zh-Hans', label: '简体中文' }, { value: 'en', label: 'English' }], root.I18N.lang, t('set.lang')) + '</div></div>';
    var m = K.Modal({ title: t('set.title'), body: body, cls: 'settings-modal', actions: [
      { label: t('set.reset'), kind: 'ghost', icon: 'refresh', close: false, onClick: function (api) { Store.resetSettings(); api.close(); applySettings(); openSettings(); } },
      { label: t('common.done'), kind: 'primary', icon: 'check' }] });
    K.bindSwitch($('set-music'), function (v) { Store.set('musicOn', v); root.Sound.refresh(); });
    K.bindStepper($('set-musicVol'), function () { return Math.round(Store.get('musicVol') * 10); }, function (v) { Store.set('musicVol', v / 10); root.Sound.refresh(); }, function () { return 0; }, function () { return 10; });
    K.bindSwitch($('set-sfx'), function (v) { Store.set('sfxOn', v); root.Sound.refresh(); root.Sound.play('key'); });
    K.bindStepper($('set-sfxVol'), function () { return Math.round(Store.get('sfxVol') * 10); }, function (v) { Store.set('sfxVol', v / 10); root.Sound.refresh(); }, function () { return 0; }, function () { return 10; });
    K.bindSwitch($('set-vib'), function (v) { Store.set('vibrate', v); root.Sound.vibrate(20); });
    K.bindSwitch($('set-auto'), function (v) { Store.set('autoSubmit', v); });
    K.bindSwitch($('set-hk'), function (v) { Store.set('historyKeys', v); });
    K.bindSeg($('set-im'), function (v) { Store.set('inputMode', v); });
    K.bindSeg($('set-keys'), function (v) { Store.set('showKeys', v); });
    K.bindSwitch($('set-rm'), function (v) { Store.set('reduceMotion', v); applySettings(); });
    K.bindSwitch($('set-ca'), function (v) { Store.set('colorAssist', v); applySettings(); });
    K.bindSeg($('set-lang'), function (v) { askLang(v, function () { m.close(); }); });
    fillIcons(body);
  }
  function setRow(id, label, ctrl, help) {
    return '<div class="set-row"><label class="set-label" for="' + id + '">' + esc(label) + (help ? '<small>' + esc(help) + '</small>' : '') + '</label>' + ctrl + '</div>';
  }
  function applySettings() {
    $('app').classList.toggle('reduce-motion', !!Store.get('reduceMotion') || (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches));
    $('app').classList.toggle('color-assist', !!Store.get('colorAssist'));
    root.Sound.refresh();
  }

  /* ---------- 語言 ---------- */
  function askLang(v, after) {
    if (v === root.I18N.lang) return;
    root.I18N.setLang(v);
    if (after) after();
  }
  function openLangMenu() {
    K.menu($('btn-lang'), { label: t('top.lang'), value: root.I18N.lang, items: [{ value: 'zh-Hant', label: '繁體中文' }, { value: 'zh-Hans', label: '简体中文' }, { value: 'en', label: 'English' }], onPick: function (v) { askLang(v); } });
  }
  function onLang() {
    var r = RENDER[screen];
    if (r && screen !== 'game') r();
    updateTop();
    fillIcons();
  }

  /* ---------- 返回鍵與瀏覽器上一頁 ---------- */
  function onPop(e) {
    var st = e.state && e.state.s;
    if (K.Modal.top()) { K.Modal.top().close(); try { root.history.pushState({ s: screen }, ''); } catch (er) { /* 忽略 */ } return; }
    if (screen === 'home' || st === 'root') {
      if (root.LobbyLink && root.LobbyLink.url) { root.location.href = root.LobbyLink.url; return; }
      try { root.history.pushState({ s: 'home' }, ''); } catch (er) { /* 忽略 */ }
      if (screen !== 'home') show('home', { fromPop: true });
      return;
    }
    /* 其他畫面：用自己的返回邏輯（離開對局會先確認） */
    try { root.history.pushState({ s: screen }, ''); } catch (er) { /* 忽略 */ }
    goBack();
  }

  var RENDER = { home: renderHome, solo: renderSolo, setup: renderSetup, levels: renderLevels, stats: renderStats, help: renderHelp,
    lobby: function () { root.OnlineUI.renderLobby(); }, room: function () { root.OnlineUI.renderRoom(); } };

  function boot() {
    K = root.Kit;
    root.I18N.init();
    fillIcons();
    root.GameView.init();
    root.Solo.init();
    root.OnlineUI.init();
    levelTier = Store.get('lastTier') || 0;
    applySettings();
    $('btn-settings').addEventListener('click', openSettings);
    $('btn-lang').addEventListener('click', openLangMenu);
    $('btn-back').addEventListener('click', goBack);
    $('btn-side').addEventListener('click', function () { if ($('app').getAttribute('data-side') === 'open') closeSide(); else openSide(); });
    $('side-close').addEventListener('click', closeSide);
    $('side-backdrop').addEventListener('click', closeSide);
    $('btn-pause').addEventListener('click', function () { root.Solo.pause(); });
    doc.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || K.Modal.top() || doc.querySelector('.menu-pop')) return;
      if ($('app').getAttribute('data-side') === 'open') { closeSide(); return; }
      if (screen === 'game' && !root.Result.visible()) {
        if (root.OnlineUI.inRoom()) return;
        e.preventDefault(); root.Solo.pause();
      }
    });
    root.I18N.onChange(onLang);
    root.addEventListener('popstate', onPop);
    try { root.history.replaceState({ s: 'root' }, ''); root.history.pushState({ s: 'home' }, ''); } catch (e) { /* 忽略 */ }
    $('boot').hidden = true;
    /* 邀請連結：?room=XXXX&invite=token → 先到大廳確認暱稱再加入 */
    var q = new URLSearchParams(root.location.search);
    if (q.get('room')) { show('home', { fromPop: true, focus: false }); root.OnlineUI.enterLobby({ room: q.get('room'), token: q.get('invite') || '' }); }
    else show('home', { fromPop: true });
    if (root.GameAnalytics) root.GameAnalytics.pageView('home');
  }

  root.App = { show: show, setTitle: setTitle, updateTop: updateTop, openSide: openSide, closeSide: closeSide, fillIcons: fillIcons, get screen() { return screen; }, openSetup: openSetup, openSettings: openSettings };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof self !== 'undefined' ? self : this);
