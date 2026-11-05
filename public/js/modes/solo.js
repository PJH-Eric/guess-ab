/* ===== modes/solo.js — 單機玩法控制器（不連線、不 ping 後端）=====
 * v0.8：沒有電腦對手，單機只剩「猜密碼」：
 *   guess  自由玩：選難度與猜的種類，項目數與重複由難度隨機決定
 *   level  闖關：50 關，每 10 關換一段難度
 *   daily  每日挑戰：五個難度各一題（台北時間切日、全球同題、不提供提示）
 * 全部不限猜測次數，只比步數。
 */
(function (root) {
  'use strict';
  var Core = root.GuessCore, Table = root.GuessSpecTable, Levels = root.GuessLevels;
  var G, K;
  var cur = null;
  var COUNTDOWN_MS = 3000;

  function t(k, p) { return root.I18N.t(k, p); }
  /** 晚一點才翻譯：切換語言時畫面會重新取字 */
  function tl(k, p) { return function () { return t(k, p); }; }
  function app() { return root.App; }

  function kindOf(cs) { var c = Core.charset(cs); return c ? c.kind : 'digits'; }
  function tierName(tier) { return t('tier.' + tier); }
  function specLine(spec) { return K.specLine(spec); }
  function stop() { if (cur) cur.dead = true; if (G) G.stopCountdown(); }

  /* ---------- 用時碼錶：暫停不算時間，結束就停住 ---------- */
  function swRun(c) { if (c.runSince == null) c.runSince = Date.now(); G.setStopwatch({ since: c.runSince - c.elapsed }); }
  function swFreeze(c) { if (c.runSince != null) { c.elapsed += Date.now() - c.runSince; c.runSince = null; } G.setStopwatch({ ms: c.elapsed }); }

  function reactTo(a, b) {
    if (a === 4) return ['say.win', 'happy'];
    if (a + b === 4) return ['say.allIn', 'surprise'];
    if (a >= 2) return ['say.close', 'happy'];
    if (!a && !b) return ['say.none', 'think'];
    return ['say.keep', 'idle'];
  }
  function subOf(c) {
    if (c.mode === 'level') return tierName(c.tier) + (c.boss ? '・' + t('level.boss') : '');
    if (c.mode === 'daily') return c.date + (c.practice ? '・' + t('daily.practice') : '');
    if (c.mode === 'classic') return t('classic.sub');
    return tierName(c.tier);
  }
  function titleOf(c) {
    if (c.mode === 'level') return t('level.title', { n: c.info.L });
    if (c.mode === 'daily') return t('mode.daily') + '・' + tierName(c.tier);
    if (c.mode === 'classic') return t('mode.classic');
    return t('mode.guess');
  }

  /* ---------- 側欄摘要 ---------- */
  function renderSummary() {
    var c = cur; if (!c) return;
    var html = '<div class="sum-mode"><b>' + K.esc(c.title) + '</b><span>' + K.esc(subOf(c)) + '</span></div>';
    html += '<dl class="sum-list">' +
      '<dt>' + t('sum.tier') + '</dt><dd>' + (c.classic ? '<span class="tier-badge classic">' + K.esc(t('mode.classicShort')) + '</span>' : '<span class="tier-badge t' + c.tier + '">' + K.esc(tierName(c.tier)) + '</span>') + '</dd>' +
      '<dt>' + t('sum.spec') + '</dt><dd>' + K.esc(specLine(c.spec)) + '</dd>' +
      '<dt>' + t('sum.par') + '</dt><dd>' + t('sum.parN', { n: c.par }) + '</dd>' +
      '</dl>';
    html += '<div class="pool-row" aria-label="' + K.esc(t('sum.pool')) + '"><span class="pool-label">' + t('sum.pool') + '</span>' + K.poolHtml(c.spec) + '</div>';
    if (c.hintsLeft != null && c.hintsLeft !== 0 || c.boss) {
      var left = c.hintsLeft === Infinity ? '∞' : c.hintsLeft;
      var dis = c.over || !c.hintsLeft || !G.enabled;
      html += '<div class="hints"><h3 class="box-title">' + K.icon('question') + t('hint.title') + '<span class="hint-left">' + t('hint.left', { n: left }) + '</span></h3>' +
        '<div class="hint-btns">' +
        '<button type="button" class="btn small" data-hint="pos"' + (dis ? ' disabled' : '') + '>' + K.icon('hint-pos') + '<span>' + t('hint.pos') + '</span></button>' +
        '<button type="button" class="btn small" data-hint="has"' + (dis ? ' disabled' : '') + '>' + K.icon('hint-has') + '<span>' + t('hint.has') + '</span></button>' +
        (c.tier >= 3 ? '' : '<button type="button" class="btn small" data-hint="attr"' + (dis ? ' disabled' : '') + '>' + K.icon('hint-attr') + '<span>' + t('hint.attr') + '</span></button>') +
        '</div>' + (c.boss ? '<p class="note">' + t('hint.boss') + '</p>' : '') + '</div>';
    } else if (c.noHintKey) {
      html += '<p class="note">' + K.esc(t(c.noHintKey)) + '</p>';
    }
    html += '<div class="sum-actions">' +
      '<button type="button" class="btn small" id="sum-restart">' + K.icon('refresh') + '<span>' + t('sum.restart') + '</span></button>' +
      (c.over ? '' : '<button type="button" class="btn small danger" id="sum-giveup">' + K.icon('flag') + '<span>' + t('sum.giveup') + '</span></button>') + '</div>';
    var box = document.getElementById('summary');
    box.innerHTML = html;
    box.querySelectorAll('[data-hint]').forEach(function (b) { b.addEventListener('click', function () { useHint(b.getAttribute('data-hint')); }); });
    document.getElementById('sum-restart').addEventListener('click', confirmRestart);
    var gu = document.getElementById('sum-giveup');
    if (gu) gu.addEventListener('click', function () {
      K.Modal({ title: t('giveup.title'), body: '<p>' + K.esc(t('giveup.body')) + '</p>', actions: [
        { label: t('common.cancel'), kind: 'ghost' },
        { label: t('sum.giveup'), kind: 'danger', onClick: function () { finish('giveup'); } }] });
    });
  }

  function refresh(keep) {
    G.setTabs([{ label: t('tab.mine'), icon: K.icon('user'), rows: cur.rows, mine: true, focus: true }], keep);
    renderSummary();
  }
  function myCount() { return cur.rows.filter(function (r) { return !r.hint; }).length; }

  /* ---------- 開局 ---------- */
  /**
   * @param {object} o { mode:'guess'|'level'|'daily', tier, cs, seed, level:L }
   */
  function start(o) {
    stop();
    root.Result.hide();
    var c = { mode: o.mode, opt: o, rows: [], hintsUsed: 0, over: false, dead: false, startedAt: Date.now(), elapsed: 0, runSince: null };
    if (o.mode === 'level') {
      var info = Levels.level(o.level);
      c.info = info; c.spec = info.spec; c.tier = info.tier; c.par = info.par; c.boss = info.boss;
      c.hintsLeft = info.hints;
    } else if (o.mode === 'daily') {
      var date = Core.taipeiDate();
      var d = Levels.dailyInfo(date, o.tier);
      c.info = d; c.spec = d.spec; c.tier = d.tier; c.par = d.par; c.date = date;
      c.practice = !!root.Store.dailyDone(date, d.tier);
      c.noHintKey = 'daily.noHint';
    } else if (o.mode === 'classic') {
      /* 經典模式：數字 0～9 不重複，設定寫死；不用提示、不算進各難度統計 */
      c.classic = true;
      c.spec = Core.classicSpec('classic:' + Core.randomSeed());
      c.tier = null;
      c.par = Table.par(2, c.spec.n, false);
      c.hintsLeft = 0;
      c.noHintKey = 'classic.noHint';
    } else {
      c.spec = o.spec || Core.tierSpec(o.tier, o.cs, o.seed || ('solo:' + Core.randomSeed()));
      c.tier = o.tier;
      c.par = Table.par(o.tier, c.spec.n, c.spec.rep);
      c.hintsLeft = Levels.HINTS[o.tier];
      if (!c.hintsLeft) c.noHintKey = 'hint.none';
    }
    c.title = titleOf(c);
    c.secret = Core.secretFor(c.spec);
    cur = c;
    app().show('game');
    app().setTitle(c.title);
    G.setup({ spec: c.spec, tier: c.tier, purpose: 'guess', onSubmit: onSubmit, greet: function () { return t(c.mode === 'daily' ? 'say.greetDaily' : 'say.greetGuess') + (c.spec.rep ? ' ' + t('say.repNote') : ''); } });
    /* 闖關最前面幾關的開局線索 */
    if (c.info && c.info.clues) {
      var r = Core.rngFrom(c.spec.seed + ':clue');
      var s = r.int(4), v = c.secret[s];
      c.rows.push({ hint: true, icon: 'key', html: function () { return K.esc(t('hint.clueRow', { n: s + 1 })) + ' <span class="h-sym">' + K.sym(c.spec, v, 'hist-sym') + '</span>'; } });
      G.setNotes(v, 1);
    }
    /* 倒數 3 秒才開始：期間鎖住輸入、碼錶停在 0 */
    G.setInput(false);
    G.setCounter(t('game.count', { n: 0 }));
    G.setStopwatch({ ms: 0 });
    c.counting = true;
    refresh();
    G.countdown(Date.now() + COUNTDOWN_MS, function () {
      if (cur !== c || c.dead || c.over) return;
      c.counting = false;
      G.setInput(true);
      swRun(c);
      refresh(true);
    });
    if (root.GameAnalytics) root.GameAnalytics.start({ mode: 'solo', difficulty: c.classic ? 'classic' : 't' + c.tier, variant: c.spec.cs }, c.spec.seed);
  }

  function onSubmit(code) {
    var c = cur; if (!c || c.over) return;
    var r = Core.evaluate(c.secret, code);
    var n = myCount() + 1;
    c.rows.push({ n: n, guess: code, a: r.a, b: r.b });
    G.feedback(r.a, r.b);
    var say = reactTo(r.a, r.b);
    G.say(tl(say[0]), say[1]);
    G.setCounter(t('game.count', { n: n }));
    refresh(true);
    if (r.a === 4) finish('win');
  }

  /* ---------- 提示 ---------- */
  function attrOf(spec, v) {
    var id = spec.pool[v];
    if (spec.cs === 'digits') return id % 2 ? 'odd' : 'even';
    if (spec.cs === 'letters') return 'AEIOU'.indexOf(String.fromCharCode(65 + id)) >= 0 ? 'vowel' : 'consonant';
    var it = K.symItem(spec, v);
    return it && it.tone === 'warm' ? 'warm' : 'cool';
  }
  function useHint(kind) {
    var c = cur; if (!c || c.over || !c.hintsLeft) return;
    G.choose(kind === 'has' ? 'sym' : 'pos', t('hint.' + kind + 'Ask'), function (x) {
      if (c.over || !c.hintsLeft) return;
      var html;
      if (kind === 'pos') {
        c.excluded = c.excluded || [{}, {}, {}, {}];
        var opts = [];
        for (var i = 0; i < c.spec.n; i++) if (i !== c.secret[x] && !c.excluded[x][i]) opts.push(i);
        if (!opts.length) { K.toast(t('hint.posDone'), 'warn'); return; }
        var v = opts[Core.rngFrom(c.spec.seed + ':hp:' + c.hintsUsed).int(opts.length)];
        c.excluded[x][v] = 1;
        html = function () { return K.esc(t('hint.posRow', { n: x + 1 })) + ' <span class="h-sym">' + K.sym(c.spec, v, 'hist-sym') + '</span>'; };
      } else if (kind === 'has') {
        var cnt = c.secret.filter(function (s) { return s === x; }).length;
        html = function () { return '<span class="h-sym">' + K.sym(c.spec, x, 'hist-sym') + '</span> ' + K.esc(cnt ? (c.spec.rep ? t('hint.hasCount', { n: cnt }) : t('hint.hasYes')) : t('hint.hasNo')); };
        G.setNotes(x, cnt ? 1 : 2);
      } else {
        var at = attrOf(c.spec, c.secret[x]);
        html = function () { return K.esc(t('hint.attrRow', { n: x + 1, v: t('attr.' + at) })); };
      }
      c.hintsUsed++;
      if (c.hintsLeft !== Infinity) c.hintsLeft--;
      c.rows.push({ hint: true, icon: kind === 'pos' ? 'hint-pos' : kind === 'has' ? 'hint-has' : 'hint-attr', html: html });
      root.Sound.play('hint');
      G.say(tl('say.hint'), 'think');
      refresh(true);
      G.showTab('hist');
    });
  }

  /* ---------- 結束 ---------- */
  function finish(why) {
    var c = cur; if (!c || c.over) return;
    c.over = true;
    if (c.counting) { c.counting = false; G.stopCountdown(); }
    swFreeze(c);
    G.setInput(false, '');
    var n = myCount();
    var won = why === 'win';
    var spec = c.spec;
    /* 副作用（紀錄、星數、連勝）只做一次；結算內容用 build() 組，切換語言時重組 */
    var stars = null, newBest = false, streak = null;
    if (!c.practice) root.Store.record({ kind: kindOf(spec.cs), tier: c.tier, won: won, guesses: n });
    if (c.mode === 'level' && won) {
      stars = Levels.stars(c.info, n, c.hintsUsed);
      newBest = !!root.Store.setStars(0, c.info.L, stars);
      setTimeout(function () { for (var s = 0; s < stars; s++) setTimeout(function () { root.Sound.play('star'); }, s * 180); }, 500);
    }
    if (c.mode === 'daily' && !c.practice) {
      var p = c.date.split('-').map(Number);
      var prev = Core.taipeiDate(Date.UTC(p[0], p[1] - 1, p[2]) - 86400000);
      streak = root.Store.recordDaily(c.date, prev, c.tier, won, n).streak;
    }
    function again() { start(c.mode === 'guess' ? { mode: 'guess', tier: c.tier, cs: c.opt.cs } : c.opt); }
    function build() {
      var o = { spec: spec, answers: [{ label: t('res.answer'), code: c.secret }], lines: [], again: { onClick: again },
        room: { note: t('res.noRoom') }, home: { onClick: function () { stop(); app().show('home'); } } };
      o.kind = won ? 'win' : 'lose';
      o.title = won ? t('res.solved', { n: n }) : t('res.giveup');
      o.mood = won ? 'happy' : 'shake';
      if (won) o.lines.push(t('res.vsPar', { n: n, p: c.par }));
      o.lines.push(t('res.time', { t: K.fmtTime(c.elapsed) }));
      if (c.hintsUsed) o.lines.push(t('res.hintsUsed', { n: c.hintsUsed }));
      if (c.mode === 'level') {
        var L = c.info.L;
        if (won) {
          o.stars = stars;
          if (newBest) o.lines.push(t('res.newBest'));
          o.again = L < Levels.COUNT ? { label: t('res.nextLevel'), onClick: function () { start({ mode: 'level', level: L + 1 }); } } : { label: t('res.retry'), onClick: function () { start(c.opt); } };
        } else o.again = { label: t('res.retry'), onClick: function () { start(c.opt); } };
      }
      if (c.mode === 'daily') {
        if (c.practice) o.lines.push(t('daily.practiceNote')); else o.streak = streak;
        o.again = { label: t('res.practice'), onClick: function () { start({ mode: 'daily', tier: c.tier }); } };
      }
      return o;
    }
    root.Sound.play(won ? 'win' : 'lose');
    G.say(tl(won ? 'say.win' : 'say.lose'), won ? 'happy' : 'shake');
    renderSummary();
    if (root.GameAnalytics) root.GameAnalytics.end({ result: won ? 'win' : 'lose' }, spec.seed);
    setTimeout(function () { if (cur === c) root.Result.show(build); }, why === 'giveup' ? 50 : 650);
  }

  function confirmRestart() {
    K.Modal({ title: t('restart.title'), body: '<p>' + K.esc(t('restart.body')) + '</p>', actions: [
      { label: t('common.cancel'), kind: 'ghost' },
      { label: t('sum.restart'), kind: 'primary', onClick: function () { start(cur.mode === 'guess' ? { mode: 'guess', tier: cur.tier, cs: cur.opt.cs } : cur.opt); } }] });
  }
  function pause() {
    if (!cur || cur.over || cur.counting) return;   // 倒數中不能暫停
    var paused = cur;
    var wasEnabled = G.enabled;
    G.setInput(false);
    swFreeze(paused);
    K.Modal({
      title: t('pause.title'), cls: 'pause', body: '<p class="center">' + K.esc(t('pause.body')) + '</p>',
      actions: [
        { label: t('pause.resume'), kind: 'primary', icon: 'play' },
        { label: t('sum.restart'), icon: 'refresh', onClick: function () { paused.leaving = true; start(paused.mode === 'guess' ? { mode: 'guess', tier: paused.tier, cs: paused.opt.cs } : paused.opt); } },
        { label: t('res.home'), kind: 'ghost', icon: 'home', onClick: function () { paused.leaving = true; stop(); app().show('home'); } }
      ],
      onClose: function () { if (cur === paused && !paused.over && !paused.leaving) { swRun(paused); if (wasEnabled) G.setInput(true); } }
    });
  }

  function init() {
    G = root.GameView; K = root.Kit;
    root.I18N.onChange(function () { if (cur && !cur.dead && app().screen === 'game') { cur.title = titleOf(cur); app().setTitle(cur.title); G.setCounter(t('game.count', { n: myCount() })); refresh(true); } });
  }

  root.Solo = { init: init, start: start, stop: stop, pause: pause, get active() { return cur && !cur.dead ? cur : null; } };
})(typeof self !== 'undefined' ? self : this);
