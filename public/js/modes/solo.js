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

  function t(k, p) { return root.I18N.t(k, p); }
  function app() { return root.App; }

  function kindOf(cs) { var c = Core.charset(cs); return c ? c.kind : 'digits'; }
  function tierName(tier) { return t('tier.' + tier); }
  function specLine(spec) { return K.specLine(spec); }
  function stop() { if (cur) cur.dead = true; }

  function reactTo(a, b) {
    if (a === 4) return [t('say.win'), 'happy'];
    if (a + b === 4) return [t('say.allIn'), 'surprise'];
    if (a >= 2) return [t('say.close'), 'happy'];
    if (!a && !b) return [t('say.none'), 'think'];
    return [t('say.keep'), 'idle'];
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
    var html = '<div class="sum-mode"><b>' + K.esc(c.title) + '</b><span>' + K.esc(c.sub || '') + '</span></div>';
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
    } else if (c.noHintNote) {
      html += '<p class="note">' + K.esc(c.noHintNote) + '</p>';
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
    var c = { mode: o.mode, opt: o, rows: [], hintsUsed: 0, over: false, dead: false, startedAt: Date.now() };
    if (o.mode === 'level') {
      var info = Levels.level(o.level);
      c.info = info; c.spec = info.spec; c.tier = info.tier; c.par = info.par; c.boss = info.boss;
      c.hintsLeft = info.hints;
      c.sub = tierName(info.tier) + (info.boss ? '・' + t('level.boss') : '');
    } else if (o.mode === 'daily') {
      var date = Core.taipeiDate();
      var d = Levels.dailyInfo(date, o.tier);
      c.info = d; c.spec = d.spec; c.tier = d.tier; c.par = d.par; c.date = date;
      c.practice = !!root.Store.dailyDone(date, d.tier);
      c.sub = date + (c.practice ? '・' + t('daily.practice') : '');
      c.noHintNote = t('daily.noHint');
    } else if (o.mode === 'classic') {
      /* 經典模式：數字 0～9 不重複，設定寫死；不用提示、不算進各難度統計 */
      c.classic = true;
      c.spec = Core.classicSpec('classic:' + Core.randomSeed());
      c.tier = null;
      c.par = Table.par(2, c.spec.n, false);
      c.hintsLeft = 0;
      c.noHintNote = t('classic.noHint');
      c.sub = t('classic.sub');
    } else {
      c.spec = o.spec || Core.tierSpec(o.tier, o.cs, o.seed || ('solo:' + Core.randomSeed()));
      c.tier = o.tier;
      c.par = Table.par(o.tier, c.spec.n, c.spec.rep);
      c.hintsLeft = Levels.HINTS[o.tier];
      if (!c.hintsLeft) c.noHintNote = t('hint.none');
      c.sub = tierName(o.tier);
    }
    c.title = titleOf(c);
    c.secret = Core.secretFor(c.spec);
    cur = c;
    app().show('game');
    app().setTitle(c.title);
    G.setup({ spec: c.spec, tier: c.tier, purpose: 'guess', onSubmit: onSubmit, greet: t(c.mode === 'daily' ? 'say.greetDaily' : 'say.greetGuess') + (c.spec.rep ? ' ' + t('say.repNote') : '') });
    /* 闖關最前面幾關的開局線索 */
    if (c.info && c.info.clues) {
      var r = Core.rngFrom(c.spec.seed + ':clue');
      var s = r.int(4), v = c.secret[s];
      c.rows.push({ hint: true, icon: 'key', html: K.esc(t('hint.clueRow', { n: s + 1 })) + ' <span class="h-sym">' + K.sym(c.spec, v, 'hist-sym') + '</span>' });
      G.setNotes(v, 1);
    }
    G.setInput(true);
    G.setCounter(t('game.count', { n: 0 }));
    refresh();
    if (root.GameAnalytics) root.GameAnalytics.start({ mode: 'solo', difficulty: c.classic ? 'classic' : 't' + c.tier, variant: c.spec.cs }, c.spec.seed);
  }

  function onSubmit(code) {
    var c = cur; if (!c || c.over) return;
    var r = Core.evaluate(c.secret, code);
    var n = myCount() + 1;
    c.rows.push({ n: n, guess: code, a: r.a, b: r.b });
    G.feedback(r.a, r.b);
    var say = reactTo(r.a, r.b);
    G.say(say[0], say[1]);
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
        html = K.esc(t('hint.posRow', { n: x + 1 })) + ' <span class="h-sym">' + K.sym(c.spec, v, 'hist-sym') + '</span>';
      } else if (kind === 'has') {
        var cnt = c.secret.filter(function (s) { return s === x; }).length;
        html = '<span class="h-sym">' + K.sym(c.spec, x, 'hist-sym') + '</span> ' + K.esc(cnt ? (c.spec.rep ? t('hint.hasCount', { n: cnt }) : t('hint.hasYes')) : t('hint.hasNo'));
        G.setNotes(x, cnt ? 1 : 2);
      } else {
        html = K.esc(t('hint.attrRow', { n: x + 1, v: t('attr.' + attrOf(c.spec, c.secret[x])) }));
      }
      c.hintsUsed++;
      if (c.hintsLeft !== Infinity) c.hintsLeft--;
      c.rows.push({ hint: true, icon: kind === 'pos' ? 'hint-pos' : kind === 'has' ? 'hint-has' : 'hint-attr', html: html });
      root.Sound.play('hint');
      G.say(t('say.hint'), 'think');
      refresh(true);
      G.showTab('hist');
    });
  }

  /* ---------- 結束 ---------- */
  function finish(why) {
    var c = cur; if (!c || c.over) return;
    c.over = true;
    G.setInput(false, '');
    var n = myCount();
    var won = why === 'win';
    var spec = c.spec;
    var o = { spec: spec, answers: [{ label: t('res.answer'), code: c.secret }], lines: [], again: { onClick: function () { start(c.mode === 'guess' ? { mode: 'guess', tier: c.tier, cs: c.opt.cs } : c.opt); } },
      room: { note: t('res.noRoom') }, home: { onClick: function () { stop(); app().show('home'); } } };
    o.kind = won ? 'win' : 'lose';
    o.title = won ? t('res.solved', { n: n }) : t('res.giveup');
    o.mood = won ? 'happy' : 'shake';
    if (won) o.lines.push(t('res.vsPar', { n: n, p: c.par }));
    if (c.hintsUsed) o.lines.push(t('res.hintsUsed', { n: c.hintsUsed }));
    if (!c.practice) root.Store.record({ kind: kindOf(spec.cs), tier: c.tier, won: won, guesses: n });
    if (c.mode === 'level') {
      var L = c.info.L;
      if (won) {
        var stars = Levels.stars(c.info, n, c.hintsUsed);
        o.stars = stars;
        if (root.Store.setStars(0, L, stars)) o.lines.push(t('res.newBest'));
        o.again = L < Levels.COUNT ? { label: t('res.nextLevel'), onClick: function () { start({ mode: 'level', level: L + 1 }); } } : { label: t('res.retry'), onClick: function () { start(c.opt); } };
        setTimeout(function () { for (var s = 0; s < stars; s++) setTimeout(function () { root.Sound.play('star'); }, s * 180); }, 500);
      } else o.again = { label: t('res.retry'), onClick: function () { start(c.opt); } };
    }
    if (c.mode === 'daily') {
      if (!c.practice) {
        var p = c.date.split('-').map(Number);
        var prev = Core.taipeiDate(Date.UTC(p[0], p[1] - 1, p[2]) - 86400000);
        o.streak = root.Store.recordDaily(c.date, prev, c.tier, won, n).streak;
      } else o.lines.push(t('daily.practiceNote'));
      o.again = { label: t('res.practice'), onClick: function () { start({ mode: 'daily', tier: c.tier }); } };
    }
    root.Sound.play(won ? 'win' : 'lose');
    G.say(won ? t('say.win') : t('say.lose'), o.mood);
    renderSummary();
    if (root.GameAnalytics) root.GameAnalytics.end({ result: won ? 'win' : 'lose' }, spec.seed);
    setTimeout(function () { if (cur === c) root.Result.show(o); }, why === 'giveup' ? 50 : 650);
  }

  function confirmRestart() {
    K.Modal({ title: t('restart.title'), body: '<p>' + K.esc(t('restart.body')) + '</p>', actions: [
      { label: t('common.cancel'), kind: 'ghost' },
      { label: t('sum.restart'), kind: 'primary', onClick: function () { start(cur.mode === 'guess' ? { mode: 'guess', tier: cur.tier, cs: cur.opt.cs } : cur.opt); } }] });
  }
  function pause() {
    if (!cur || cur.over) return;
    var paused = cur;
    var wasEnabled = G.enabled;
    G.setInput(false);
    K.Modal({
      title: t('pause.title'), cls: 'pause', body: '<p class="center">' + K.esc(t('pause.body')) + '</p>',
      actions: [
        { label: t('pause.resume'), kind: 'primary', icon: 'play' },
        { label: t('sum.restart'), icon: 'refresh', onClick: function () { paused.leaving = true; start(paused.mode === 'guess' ? { mode: 'guess', tier: paused.tier, cs: paused.opt.cs } : paused.opt); } },
        { label: t('res.home'), kind: 'ghost', icon: 'home', onClick: function () { paused.leaving = true; stop(); app().show('home'); } }
      ],
      onClose: function () { if (cur === paused && !paused.over && !paused.leaving && wasEnabled) G.setInput(true); }
    });
  }

  function init() {
    G = root.GameView; K = root.Kit;
    root.I18N.onChange(function () { if (cur && !cur.dead && app().screen === 'game') { cur.title = titleOf(cur); app().setTitle(cur.title); refresh(true); } });
  }

  root.Solo = { init: init, start: start, stop: stop, pause: pause, get active() { return cur && !cur.dead ? cur : null; } };
})(typeof self !== 'undefined' ? self : this);
