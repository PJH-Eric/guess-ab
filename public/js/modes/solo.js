/* ===== modes/solo.js — 單機玩法控制器（不連線、不 ping 後端）=====
 *   guess   我猜電腦出的題
 *   aiGuess 電腦猜我出的題（A/B 由系統自動計算）
 *   duel    我和電腦互相出題對猜（先手猜中後手可追平一回合）
 *   level   闖關（四難度各 100 關）
 *   daily   每日挑戰（台北時間切日、不提供提示）
 */
(function (root) {
  'use strict';
  var Core = root.GuessCore, Table = root.GuessSpecTable, Levels = root.GuessLevels;
  var G, K;
  var cur = null;          // 目前這一局
  var aiTimer = null;
  var worker = null, workerFailed = false, reqId = 0, pending = {};

  function t(k, p) { return root.I18N.t(k, p); }
  function app() { return root.App; }

  /* ---------- 電腦推理（Web Worker，不能用時退回主執行緒） ---------- */
  function askAI(level, spec, history, cb) {
    var msg = { level: level, n: spec.n, rep: spec.rep, seed: spec.seed + ':ai', history: history.map(function (h) { return { guess: h.guess, a: h.a, b: h.b }; }) };
    if (!workerFailed && !worker && root.Worker) {
      try {
        worker = new Worker('js/ai-worker.js');
        worker.onmessage = function (e) { var f = pending[e.data.id]; delete pending[e.data.id]; if (f) f(e.data.guess || null); };
        worker.onerror = function () { workerFailed = true; worker = null; Object.keys(pending).forEach(function (k) { var f = pending[k]; delete pending[k]; f(null); }); };
      } catch (e) { workerFailed = true; worker = null; }
    }
    function local() {
      setTimeout(function () {
        var ai = root.GuessAI.createAI({ level: level, n: spec.n, rep: spec.rep, rng: Core.rngFrom(msg.seed + ':' + history.length) });
        cb(ai.next(msg.history));
      }, 20);
    }
    if (!worker) { local(); return; }
    var id = ++reqId;
    pending[id] = function (g) { if (g) cb(g); else local(); };
    msg.id = id;
    worker.postMessage(msg);
  }

  /* ---------- 共用 ---------- */
  function kindOf(cs) { var c = Core.charset(cs); return c ? c.kind : 'digits'; }
  function csName(cs) { return t('cs.' + cs); }
  function tierName(tier) { return t('tier.' + tier); }
  function specLine(spec) { return csName(spec.cs) + '・' + t('spec.n', { n: spec.n }) + '・' + (spec.rep ? t('spec.rep') : t('spec.norep')); }
  function stop() { clearTimeout(aiTimer); aiTimer = null; if (cur) cur.dead = true; }

  function reactTo(a, b, n, limit) {
    if (a === 4) return [t('say.win'), 'happy'];
    if (limit && n >= limit) return [t('say.out'), 'shake'];
    if (a + b === 4) return [t('say.allIn'), 'surprise'];
    if (a >= 2) return [t('say.close'), 'happy'];
    if (!a && !b) return [t('say.none'), 'think'];
    return [t('say.keep'), 'idle'];
  }
  function counterText(n, limit) { return limit ? t('game.countOf', { n: n, max: limit }) : t('game.count', { n: n }); }

  /* ---------- 側欄摘要 ---------- */
  function renderSummary() {
    var c = cur; if (!c) return;
    var html = '<div class="sum-mode"><b>' + K.esc(c.title) + '</b><span>' + K.esc(c.sub || '') + '</span></div>';
    html += '<dl class="sum-list">' +
      '<dt>' + t('sum.spec') + '</dt><dd>' + K.esc(specLine(c.spec)) + '</dd>' +
      (c.tier != null ? '<dt>' + t('sum.tier') + '</dt><dd>' + K.esc(tierName(c.tier)) + '</dd>' : '') +
      '<dt>' + t('sum.limit') + '</dt><dd>' + (c.limit ? t('sum.limitN', { n: c.limit }) : t('sum.unlimited')) + '</dd>' +
      (c.par ? '<dt>' + t('sum.par') + '</dt><dd>' + t('sum.parN', { n: c.par }) + '</dd>' : '') +
      '</dl>';
    html += '<div class="pool-row" aria-label="' + K.esc(t('sum.pool')) + '"><span class="pool-label">' + t('sum.pool') + '</span><div class="pool">' +
      c.spec.pool.map(function (id, i) { return '<span class="pool-sym" title="' + K.esc(K.symName(c.spec, i)) + '">' + K.sym(c.spec, i, 'pool-svg') + '</span>'; }).join('') + '</div></div>';
    if (c.mySecret) {
      html += '<div class="my-secret"><span>' + t('sum.mySecret') + '</span><button type="button" class="link-btn" id="sec-toggle" aria-pressed="' + (!!c.showSecret) + '">' + K.icon('eye') + (c.showSecret ? t('sum.hide') : t('sum.show')) + '</button>' +
        '<div class="sec-code' + (c.showSecret ? '' : ' masked') + '">' + c.mySecret.map(function (v) { return '<span class="h-sym">' + (c.showSecret ? K.sym(c.spec, v, 'hist-sym') : K.icon('lock')) + '</span>'; }).join('') + '</div></div>';
    }
    if (c.hintsLeft != null) {
      var left = c.hintsLeft === Infinity ? '∞' : c.hintsLeft;
      var dis = c.over || !c.hintsLeft || !G.enabled;
      html += '<div class="hints"><h3 class="box-title">' + K.icon('question') + t('hint.title') + '<span class="hint-left">' + t('hint.left', { n: left }) + '</span></h3>' +
        '<div class="hint-btns">' +
        '<button type="button" class="btn small" data-hint="pos"' + (dis ? ' disabled' : '') + '>' + K.icon('hint-pos') + '<span>' + t('hint.pos') + '</span></button>' +
        '<button type="button" class="btn small" data-hint="has"' + (dis ? ' disabled' : '') + '>' + K.icon('hint-has') + '<span>' + t('hint.has') + '</span></button>' +
        (c.tier === 3 ? '' : '<button type="button" class="btn small" data-hint="attr"' + (dis ? ' disabled' : '') + '>' + K.icon('hint-attr') + '<span>' + t('hint.attr') + '</span></button>') +
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
    var st = document.getElementById('sec-toggle');
    if (st) st.addEventListener('click', function () { c.showSecret = !c.showSecret; renderSummary(); });
    document.getElementById('sum-restart').addEventListener('click', function () { confirmRestart(); });
    var gu = document.getElementById('sum-giveup');
    if (gu) gu.addEventListener('click', function () {
      K.Modal({ title: t('giveup.title'), body: '<p>' + K.esc(t('giveup.body')) + '</p>', actions: [
        { label: t('common.cancel'), kind: 'ghost' },
        { label: t('sum.giveup'), kind: 'danger', onClick: function () { finish('giveup'); } }] });
    });
  }

  function tabsFor() {
    var c = cur, list = [];
    if (c.mode === 'aiGuess') {
      list.push({ label: t('tab.ai'), icon: K.icon('robot'), rows: c.aiRows, empty: t('tab.aiEmpty'), focus: true });
    } else if (c.mode === 'duel') {
      list.push({ label: t('tab.mine'), icon: K.icon('user'), rows: c.rows, mine: true, focus: true });
      list.push({ label: t('tab.ai'), icon: K.icon('robot'), rows: c.aiRows, empty: t('tab.aiEmpty') });
    } else {
      list.push({ label: t('tab.mine'), icon: K.icon('user'), rows: c.rows, mine: true, focus: true });
    }
    return list;
  }
  function refresh(keep) {
    G.setTabs(tabsFor(), keep);
    renderSummary();
  }
  function myCount() { return cur.rows.filter(function (r) { return !r.hint; }).length; }

  /* ---------- 開局 ---------- */
  /**
   * @param {object} o { mode, tier, cs, n, rep, first, level:{tier,L}, daily:true, pool? }
   */
  function start(o) {
    stop();
    root.Result.hide();
    var c = { mode: o.mode, opt: o, rows: [], aiRows: [], hintsUsed: 0, over: false, dead: false, startedAt: Date.now() };
    if (o.mode === 'level') {
      var info = Levels.level(o.level.tier, o.level.L);
      c.info = info; c.spec = info.spec; c.tier = info.tier; c.limit = info.limit; c.par = info.par; c.boss = info.boss;
      c.hintsLeft = info.hints; c.title = t('mode.level') + ' ' + t('level.n', { n: info.L }); c.sub = tierName(info.tier) + (info.boss ? '・' + t('level.boss') : '');
    } else if (o.mode === 'daily') {
      var d = Levels.dailyInfo(Core.taipeiDate());
      c.info = d; c.spec = d.spec; c.tier = 2; c.limit = d.limit; c.par = d.par; c.date = d.date;
      c.practice = !!root.Store.dailyDone(d.date);
      c.title = t('mode.daily'); c.sub = d.date + (c.practice ? '・' + t('daily.practice') : '');
      c.noHintNote = t('daily.noHint');
    } else {
      c.spec = Core.makeSpec({ cs: o.cs, n: o.n, rep: o.rep, pool: o.pool }, o.seed || ('solo:' + Core.randomSeed()));
      c.tier = o.tier; c.limit = Table.limit(o.tier, c.spec.n, c.spec.rep);
      c.title = t('mode.' + o.mode); c.sub = tierName(o.tier);
      if (o.mode === 'guess') c.hintsLeft = Levels.HINTS[o.tier];
      else c.noHintNote = t('hint.notHere');
    }
    c.secret = Core.secretFor(c.spec);
    cur = c;
    app().show('game');
    app().setTitle(c.title);
    var greet = { guess: 'say.greetGuess', level: 'say.greetGuess', daily: 'say.greetDaily', aiGuess: 'say.greetSecret', duel: 'say.greetSecret' }[c.mode];
    G.setup({ spec: c.spec, tier: c.tier, purpose: (c.mode === 'aiGuess' || c.mode === 'duel') ? 'secret' : 'guess', onSubmit: onSubmit, greet: t(greet), notes: c.mode !== 'aiGuess' });
    if (c.mode === 'aiGuess' || c.mode === 'duel') {
      c.phase = 'secret';
      G.setInput(true);
      G.setCounter(t('game.setSecret'));
    } else {
      c.phase = 'play';
      /* 幼幼班闖關的開局線索 */
      if (c.info && c.info.clues) {
        var pos = [0, 1, 2, 3];
        var r = Core.rngFrom(c.spec.seed + ':clue');
        for (var k = 0; k < c.info.clues; k++) {
          var j = k + r.int(4 - k); var tmp = pos[k]; pos[k] = pos[j]; pos[j] = tmp;
          var s = pos[k], v = c.secret[s];
          c.rows.push({ hint: true, icon: 'key', html: K.esc(t('hint.clueRow', { n: s + 1 })) + ' <span class="h-sym">' + K.sym(c.spec, v, 'hist-sym') + '</span>' });
          G.setNotes(v, 1);
        }
      }
      G.setInput(true);
      G.setCounter(counterText(0, c.limit));
    }
    refresh();
    if (root.GameAnalytics) root.GameAnalytics.start({ mode: c.mode === 'guess' || c.mode === 'level' || c.mode === 'daily' ? 'solo' : 'ai', difficulty: 't' + (c.tier == null ? 2 : c.tier), variant: c.spec.cs }, c.spec.seed);
  }

  function onSubmit(code) {
    var c = cur; if (!c || c.over) return;
    if (c.phase === 'secret') {
      c.mySecret = code.slice();
      c.showSecret = false;
      if (c.mode === 'aiGuess') {
        c.phase = 'watch';
        G.setup({ spec: c.spec, tier: c.tier, purpose: 'guess', onSubmit: onSubmit, greet: t('say.aiStart'), mood: 'think', notes: false });
        G.setInput(false, t('why.aiThinking'));
        G.setCounter(counterText(0, c.limit));
        refresh();
        aiTurn();
      } else {
        c.phase = 'play';
        var f = c.opt.first === 'me' ? 0 : c.opt.first === 'ai' ? 1 : (Core.rngFrom(c.spec.seed + ':first').int(2));
        c.first = f; c.turn = f;
        G.setup({ spec: c.spec, tier: c.tier, purpose: 'guess', onSubmit: onSubmit, greet: f === 0 ? t('say.youFirst') : t('say.aiFirst'), mood: 'happy' });
        refresh();
        nextDuelTurn();
      }
      return;
    }
    if (c.mode === 'duel') { duelMine(code); return; }
    /* 我猜電腦 / 闖關 / 每日 */
    var r = Core.evaluate(c.secret, code);
    var n = myCount() + 1;
    c.rows.push({ n: n, guess: code, a: r.a, b: r.b });
    G.feedback(r.a, r.b);
    var say = reactTo(r.a, r.b, n, c.limit);
    G.say(say[0], say[1]);
    G.setCounter(counterText(n, c.limit));
    refresh(true);
    if (r.a === 4) finish('win');
    else if (c.limit && n >= c.limit) finish('lose');
  }

  /* ---------- 電腦猜我 ---------- */
  function aiTurn() {
    var c = cur; if (!c || c.over || c.dead) return;
    G.say(t('say.aiThinking'), 'think');
    var started = Date.now();
    askAI(c.tier, c.spec, c.aiRows, function (guess) {
      if (c.dead || c.over || cur !== c || c.paused) return;
      var wait = Math.max(0, 700 - (Date.now() - started));
      aiTimer = setTimeout(function () {
        if (c.dead || c.over || cur !== c || c.paused) return;
        var r = Core.evaluate(c.mySecret, guess);
        var n = c.aiRows.length + 1;
        c.aiRows.push({ n: n, guess: guess, a: r.a, b: r.b });
        G.feedback(r.a, r.b);
        G.setCounter(counterText(n, c.limit));
        refresh(true);
        if (c.mode === 'aiGuess') {
          if (r.a === 4) { finish('aiSolved'); return; }
          if (c.limit && n >= c.limit) { finish('aiFailed'); return; }
          G.say(t('say.aiGot', { a: r.a, b: r.b }), r.a + r.b >= 3 ? 'surprise' : 'idle');
          aiTimer = setTimeout(aiTurn, 650);
        } else {
          afterDuelTurn(1);
        }
      }, wait);
    });
  }

  /* ---------- 互相出題（單機） ---------- */
  function nextDuelTurn() {
    var c = cur; if (!c || c.over) return;
    var mine = myCount(), theirs = c.aiRows.length;
    G.setCounter(t('duel.counter', { round: Math.min(mine, theirs) + 1, max: c.limit || '∞' }));
    if (c.turn === 0) {
      G.setInput(true);
      G.say(t('say.yourTurn'), 'idle');
      root.Sound.play('turn');
    } else {
      G.setInput(false, t('why.aiThinking'));
      aiTurn();
    }
  }
  function duelMine(code) {
    var c = cur;
    if (c.turn !== 0) return;
    var r = Core.evaluate(c.secret, code);
    var n = myCount() + 1;
    c.rows.push({ n: n, guess: code, a: r.a, b: r.b });
    if (r.a === 4) c.meSolved = true;
    G.feedback(r.a, r.b);
    var s = reactTo(r.a, r.b, n, 0);
    G.say(s[0], s[1]);
    refresh(true);
    afterDuelTurn(0);
  }
  function afterDuelTurn(who) {
    var c = cur;
    if (who === 1 && c.aiRows.length && c.aiRows[c.aiRows.length - 1].a === 4) c.aiSolved = true;
    var second = 1 - c.first;
    if (who === c.first) {
      c.turn = second;
      if (who === 0 && c.meSolved) G.say(t('say.flagWait'), 'surprise');
      setTimeout(nextDuelTurn, who === 1 ? 500 : 300);
      return;
    }
    /* 後手猜完＝一回合結束 */
    if (c.meSolved || c.aiSolved) { finish(c.meSolved && c.aiSolved ? 'draw' : c.meSolved ? 'win' : 'aiWin'); return; }
    if (c.limit && myCount() >= c.limit && c.aiRows.length >= c.limit) { finish('drawLimit'); return; }
    c.turn = c.first;
    setTimeout(nextDuelTurn, 400);
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
    var title = t('hint.' + kind + 'Ask');
    G.choose(kind === 'has' ? 'sym' : 'pos', title, function (x) {
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
        html = '<span class="h-sym">' + K.sym(c.spec, x, 'hist-sym') + '</span> ' + K.esc(cnt ? (c.spec.rep ? t(cnt > 1 ? 'hint.hasMany' : 'hint.hasOne') : t('hint.hasYes')) : t('hint.hasNo'));
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
    clearTimeout(aiTimer);
    G.setInput(false, '');
    var n = myCount();
    var won = why === 'win';
    var spec = c.spec;
    var o = { spec: spec, answers: [], lines: [], again: { onClick: function () { start(c.opt); } }, room: { note: t('res.noRoom') }, home: { onClick: function () { stop(); app().show('home'); } } };
    if (c.mode === 'aiGuess') {
      var steps = c.aiRows.length;
      o.kind = why === 'aiFailed' ? 'win' : 'rank';
      o.title = why === 'aiFailed' ? t('res.aiFailed') : why === 'giveup' ? t('res.giveup') : t('res.aiSolved', { n: steps });
      o.mood = why === 'aiFailed' ? 'happy' : 'surprise';
      o.answers.push({ label: t('res.mySecret'), code: c.mySecret || [0, 0, 0, 0] });
      o.lines.push(t('res.aiSteps', { n: steps }));
      if (!c.mySecret) o.answers = [];
    } else if (c.mode === 'duel') {
      var map = { win: ['win', t('res.win'), 'happy'], aiWin: ['lose', t('res.aiWin'), 'shake'], draw: ['draw', t('res.draw'), 'surprise'], drawLimit: ['draw', t('res.drawLimit'), 'think'], giveup: ['lose', t('res.giveup'), 'shake'] }[why] || ['lose', t('res.lose'), 'shake'];
      o.kind = map[0]; o.title = map[1]; o.mood = map[2];
      o.answers.push({ label: t('res.aiSecret'), code: c.secret });
      if (c.mySecret) o.answers.push({ label: t('res.mySecret'), code: c.mySecret });
      o.lines.push(t('res.myGuesses', { n: n }), t('res.aiGuesses', { n: c.aiRows.length }));
      root.Store.record({ kind: kindOf(spec.cs), tier: -1, won: won, guesses: n });
    } else {
      o.kind = won ? 'win' : 'lose';
      o.title = won ? t('res.solved', { n: n }) : why === 'giveup' ? t('res.giveup') : t('res.notSolved');
      o.mood = won ? 'happy' : 'shake';
      o.answers.push({ label: t('res.answer'), code: c.secret });
      o.lines.push(t('res.guesses', { n: n }) + (c.limit ? ' / ' + t('sum.limitN', { n: c.limit }) : ''));
      if (c.hintsUsed) o.lines.push(t('res.hintsUsed', { n: c.hintsUsed }));
      if (!c.practice) root.Store.record({ kind: kindOf(spec.cs), tier: c.mode === 'guess' ? c.tier : c.mode === 'level' ? c.tier : -1, won: won, guesses: n });
      if (c.mode === 'level') {
        var stars = won ? Levels.stars(c.info, n, c.hintsUsed) : 0;
        o.stars = stars;
        if (won) {
          var better = root.Store.setStars(c.info.tier, c.info.L, stars);
          if (better) o.lines.push(t('res.newBest'));
          if (c.info.L < 100) {
            o.again = { label: t('res.nextLevel'), onClick: function () { start({ mode: 'level', level: { tier: c.info.tier, L: c.info.L + 1 } }); } };
          } else o.again = { label: t('res.retry'), onClick: function () { start(c.opt); } };
          if (stars) setTimeout(function () { for (var s = 0; s < stars; s++) setTimeout(function () { root.Sound.play('star'); }, s * 180); }, 500);
        } else o.again = { label: t('res.retry'), onClick: function () { start(c.opt); } };
      }
      if (c.mode === 'daily') {
        if (!c.practice) {
          var prev = Core.taipeiDate(Date.UTC.apply(null, c.date.split('-').map(function (x, i) { return i === 1 ? Number(x) - 1 : Number(x); })) - 8 * 3600 * 1000 - 86400000 + 8 * 3600 * 1000);
          var d = root.Store.recordDaily(c.date, prev, won, n);
          o.streak = d.streak;
        } else {
          o.lines.push(t('daily.practiceNote'));
        }
        o.again = { label: t('res.practice'), onClick: function () { start({ mode: 'daily' }); } };
      }
    }
    if (o.kind === 'win') root.Sound.play('win'); else if (o.kind === 'lose') root.Sound.play('lose');
    G.say(o.kind === 'win' ? t('say.win') : o.kind === 'lose' ? t('say.lose') : t('say.over'), o.mood);
    renderSummary();
    if (root.GameAnalytics) root.GameAnalytics.end({ result: o.kind === 'win' ? 'win' : o.kind === 'draw' ? 'draw' : o.kind === 'lose' ? 'lose' : 'complete' }, spec.seed);
    setTimeout(function () { if (cur === c) root.Result.show(o); }, why === 'giveup' ? 50 : 650);
  }

  function confirmRestart() {
    K.Modal({ title: t('restart.title'), body: '<p>' + K.esc(t('restart.body')) + '</p>', actions: [
      { label: t('common.cancel'), kind: 'ghost' },
      { label: t('sum.restart'), kind: 'primary', onClick: function () { start(cur.opt); } }] });
  }
  function pause() {
    if (!cur || cur.over) return;
    var paused = cur;
    clearTimeout(aiTimer);
    paused.paused = true;
    var wasEnabled = G.enabled;
    G.setInput(false);
    K.Modal({
      title: t('pause.title'), cls: 'pause', body: '<p class="center">' + K.esc(t('pause.body')) + '</p>',
      actions: [
        { label: t('pause.resume'), kind: 'primary', icon: 'play' },
        { label: t('sum.restart'), icon: 'refresh', onClick: function () { paused.restarting = true; start(paused.opt); } },
        { label: t('res.home'), kind: 'ghost', icon: 'home', onClick: function () { paused.leaving = true; stop(); app().show('home'); } }
      ],
      onClose: function () {
        paused.paused = false;
        if (cur !== paused || paused.over || paused.leaving || paused.restarting) return;
        if (wasEnabled) G.setInput(true);
        if ((paused.mode === 'aiGuess' && paused.phase === 'watch') || (paused.mode === 'duel' && paused.phase === 'play' && paused.turn === 1)) aiTurn();
      }
    });
  }

  function init() {
    G = root.GameView; K = root.Kit;
    root.I18N.onChange(function () { if (cur && document.getElementById('app').getAttribute('data-screen') === 'game' && cur.mode) { cur.title = cur.mode === 'level' ? t('mode.level') + ' ' + t('level.n', { n: cur.info.L }) : t('mode.' + cur.mode); app().setTitle(cur.title); refresh(true); } });
  }

  root.Solo = { init: init, start: start, stop: stop, pause: pause, get active() { return cur && !cur.dead ? cur : null; }, askAI: askAI };
})(typeof self !== 'undefined' ? self : this);
