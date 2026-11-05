/* ===== ui/game.js — 遊戲主畫面（保險箱密碼鎖、符號鍵盤、猜測歷史、筆記板）=====
 * 所有模式共用這一份畫面；控制器（單機／線上）呼叫：
 *   GameView.setup(cfg)        開一局：規格、上限、送出時要做什麼
 *   GameView.setTabs(tabs)     猜測歷史（可多個分頁：我的／對手的／各玩家）
 *   GameView.setInput(on, why) 能不能輸入（輪到誰、電腦思考中…）
 *   GameView.say(text, mood)   小精靈說話
 *   GameView.feedback(a, b)    猜完的 A/B 動畫與音效
 *
 * 快速輸入：
 *   點符號自動填入下一個空格；點已填的格子清除重填；填滿合法自動送出（設定可關）
 *   鍵盤：數字／字母直接打，圖案寶石用配發的快速鍵；Backspace、Delete、←→、Space、Enter、↑↓ 翻歷史
 */
(function (root) {
  'use strict';
  var doc = root.document;
  var Core = root.GuessCore;
  var K, $;
  var KEYS = '1234567890QWERTYUIOPASDFGHJKLZXCVBNM,.;/'.split('');
  var CODE_EXTRA = { Comma: ',', Period: '.', Semicolon: ';', Slash: '/' };

  var cfg = null;          // 目前這一局的設定
  var input = [null, null, null, null];
  var cursor = 0;
  var enabled = false;
  var notes = [];          // 每個項目的筆記狀態 0 未知 1 有 2 沒有 3 可能
  var tabs = [];
  var activeTab = 0;
  var recallIdx = -1;
  var submitTimer = null;
  var lastSeenCount = 0;

  function S(k) { return root.Store.get(k); }
  function t(k, p) { return root.I18N.t(k, p); }

  /* ---------- 快速鍵 ---------- */
  function keyLabel(i) {
    if (!cfg) return '';
    var id = cfg.spec.pool[i];
    if (cfg.spec.cs === 'digits') return String(id);
    if (cfg.spec.cs === 'letters') return String.fromCharCode(65 + id);
    return KEYS[i] || '';
  }
  function indexFromEvent(e) {
    if (!cfg) return -1;
    var code = e.code || '', ch = null;
    if (/^Digit\d$/.test(code)) ch = code.slice(5);
    else if (/^Numpad\d$/.test(code)) ch = code.slice(6);
    else if (/^Key[A-Z]$/.test(code)) ch = code.slice(3);
    else if (CODE_EXTRA[code]) ch = CODE_EXTRA[code];
    if (ch == null) return -1;
    for (var i = 0; i < cfg.spec.n; i++) if (keyLabel(i) === ch) return i;
    return -1;
  }

  /* ---------- 畫面建立 ---------- */
  function buildSlots() {
    var box = $('slots');
    box.innerHTML = '';
    for (var s = 0; s < Core.LEN; s++) {
      var w = K.h('<div class="wheel" data-s="' + s + '" tabindex="0" role="spinbutton" aria-valuemin="0">' +
        '<button type="button" class="wheel-arrow up" tabindex="-1" aria-hidden="true">' + K.icon('back', 'rot-up') + '</button>' +
        '<div class="wheel-win"><div class="wheel-ghost prev"></div><div class="wheel-cur"></div><div class="wheel-ghost next"></div></div>' +
        '<button type="button" class="wheel-arrow down" tabindex="-1" aria-hidden="true">' + K.icon('back', 'rot-down') + '</button>' +
        '<span class="wheel-no">' + (s + 1) + '</span></div>');
      box.appendChild(w);
      bindWheel(w, s);
    }
  }
  function bindWheel(w, s) {
    var y0 = null, moved = 0, acc = 0, pid = null;
    w.querySelector('.up').addEventListener('click', function (e) { e.stopPropagation(); rotate(s, -1); });
    w.querySelector('.down').addEventListener('click', function (e) { e.stopPropagation(); rotate(s, 1); });
    var win = w.querySelector('.wheel-win');
    win.addEventListener('pointerdown', function (e) {
      if (!enabled) return;
      y0 = e.clientY; moved = 0; acc = 0; pid = e.pointerId;
      try { win.setPointerCapture(pid); } catch (er) { /* 忽略 */ }
    });
    win.addEventListener('pointermove', function (e) {
      if (y0 == null || e.pointerId !== pid) return;
      var dy = e.clientY - y0;
      y0 = e.clientY; acc += dy; moved += Math.abs(dy);
      var step = Math.max(18, win.clientHeight / 3);
      while (acc > step) { acc -= step; rotate(s, -1); }
      while (acc < -step) { acc += step; rotate(s, 1); }
    });
    function end() {
      if (y0 == null) return;
      var wasTap = moved < 6;
      y0 = null;
      if (wasTap) tapSlot(s);
    }
    win.addEventListener('pointerup', end);
    win.addEventListener('pointercancel', function () { y0 = null; });
    w.addEventListener('wheel', function (e) {
      if (!enabled) return;
      e.preventDefault();
      rotate(s, e.deltaY > 0 ? 1 : -1);
    }, { passive: false });
    w.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); rotate(s, -1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); rotate(s, 1); }
    });
    w.addEventListener('focus', function () { if (enabled) { cursor = s; renderSlots(); } });
  }

  function buildKeys() {
    var box = $('keys');
    var n = cfg.spec.n;
    var repeatDigits = K.isRepeatDigits(cfg.spec);
    box.classList.toggle('repeat-digits', repeatDigits);
    box.innerHTML = '';
    fitCols();
    for (var i = 0; i < n; i++) {
      var b = K.h('<button type="button" class="key" data-i="' + i + '">' + K.sym(cfg.spec, i, 'key-sym') +
        '<span class="key-cap">' + K.esc(keyLabel(i)) + '</span><span class="key-note" aria-hidden="true"></span><span class="key-used" aria-hidden="true"></span>' + (repeatDigits ? '<span class="key-remaining" aria-hidden="true"></span>' : maxBadge(i)) + '</button>');
      b.setAttribute('aria-label', K.symName(cfg.spec, i) + maxLabel(i));
      box.appendChild(b);
    }
  }
  /** 依鍵盤區實際大小算出「每顆鍵最大」的排法：符號鍵越大越好按，但不超過 92px、不小於手指大小 */
  function fitCols() {
    if (!cfg) return;
    var box = $('keys');
    var n = cfg.spec.n;
    var cs = getComputedStyle(box);
    var gap = parseFloat(cs.columnGap) || 6;
    var W = box.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0) - 6;
    var H = box.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0) - 4;
    if (W <= 0) return;
    /* 鍵的上限：一般 92px，空間很大時放大到 112px */
    var cap = Math.min(112, Math.max(92, Math.floor(H / 4)));
    var aspect = H > 60 ? W / H : 4;
    var best = { s: 0, cols: Math.min(n, 5), fit: Infinity };
    for (var cols = 1; cols <= n; cols++) {
      var rows = Math.ceil(n / cols);
      var s = Math.min(cap, (W - gap * (cols - 1)) / cols, H > 60 ? (H - gap * (rows - 1)) / rows : cap);
      var fit = Math.abs(Math.log((cols / rows) / aspect));   // 排列形狀越接近按鍵區形狀越好
      /* 鍵越大越好；一樣大（例如都到上限）時選形狀最接近的，避免排成一長條 */
      if (s > best.s + 0.5 || (s >= best.s - 0.5 && fit < best.fit)) best = { s: s, cols: cols, fit: fit };
    }
    /* 數字次數標籤需要額外高度；放不下時沿用自訂捲動區。 */
    var minSize = K.isRepeatDigits(cfg.spec) ? 64 : 40;
    var size = Math.floor(best.s);
    var cols2 = best.cols;
    if (size < minSize) { size = minSize; cols2 = Math.max(1, Math.floor((W + gap) / (minSize + gap))); }
    /* 欄數平均分配每一排 */
    var r2 = Math.ceil(n / cols2); cols2 = Math.ceil(n / r2);
    box.style.setProperty('--cols', String(cols2));
    box.style.setProperty('--ks', size + 'px');
  }
  function colsFor(n) {
    if (n <= 6) return 6;
    if (n <= 8) return Math.ceil(n / 2) <= 4 ? 4 : n;
    if (n <= 10) return 5;
    if (n <= 12) return 6;
    if (n <= 16) return 8;
    if (n <= 20) return 10;
    if (n <= 26) return 9;
    return 10;
  }

  /** 項目池裡有重複的項目：角落標「×2」，提醒這個最多可以用幾次 */
  function maxBadge(i) { var m = cfg.spec.cnt ? cfg.spec.cnt[i] : 1; return m > 1 ? '<span class="key-max" aria-hidden="true">×' + m + '</span>' : ''; }
  function maxLabel(i) { var m = cfg.spec.cnt ? cfg.spec.cnt[i] : 1; return m > 1 ? '（' + t('pool.maxN', { n: m }) + '）' : ''; }
  function buildNotes() {
    var box = $('notes');
    box.innerHTML = '';
    for (var i = 0; i < cfg.spec.n; i++) {
      var b = K.h('<button type="button" class="note" data-i="' + i + '" aria-haspopup="listbox" aria-expanded="false">' + K.sym(cfg.spec, i, 'note-sym') + '<span class="note-mark" aria-hidden="true"></span>' + maxBadge(i) + '</button>');
      box.appendChild(b);
    }
    renderNotes();
  }

  /* ---------- 狀態 → 畫面 ---------- */
  function dupSet() {
    var d = {};
    if (cfg.spec.cnt) {
      /* 可重複：同一個項目不能超過項目池裡的個數 */
      var c = {};
      input.forEach(function (v) { if (v != null) c[v] = (c[v] || 0) + 1; });
      input.forEach(function (v, s) { if (v != null && c[v] > cfg.spec.cnt[v]) d[s] = 1; });
      return d;
    }
    if (cfg.spec.rep) {
      /* 舊規格：同一個符號最多 3 次，4 格全一樣才算不合法 */
      if (input.every(function (v) { return v != null && v === input[0]; })) d = { 0: 1, 1: 1, 2: 1, 3: 1 };
      return d;
    }
    var seen = {};
    input.forEach(function (v, s) { if (v == null) return; if (seen[v] != null) { d[s] = 1; d[seen[v]] = 1; } else seen[v] = s; });
    return d;
  }
  function renderSlots() {
    var dup = dupSet();
    var n = cfg.spec.n;
    doc.querySelectorAll('#slots .wheel').forEach(function (w) {
      var s = Number(w.getAttribute('data-s'));
      var v = input[s];
      w.querySelector('.wheel-cur').innerHTML = v == null ? '<span class="wheel-q">?</span>' : K.sym(cfg.spec, v, 'wheel-sym');
      w.querySelector('.prev').innerHTML = v == null ? '' : K.sym(cfg.spec, (v - 1 + n) % n, 'wheel-sym');
      w.querySelector('.next').innerHTML = v == null ? '' : K.sym(cfg.spec, (v + 1) % n, 'wheel-sym');
      w.classList.toggle('cursor', enabled && s === cursor);
      w.classList.toggle('filled', v != null);
      w.classList.toggle('dup', !!dup[s]);
      w.setAttribute('aria-label', t('game.slotN', { n: s + 1 }) + '：' + (v == null ? t('game.empty') : K.symName(cfg.spec, v)));
      w.setAttribute('aria-valuetext', v == null ? t('game.empty') : K.symName(cfg.spec, v));
      w.setAttribute('aria-valuemax', String(n - 1));
      w.tabIndex = enabled ? 0 : -1;
    });
    /* 鍵盤上的「已選」狀態 */
    var used = {};
    input.forEach(function (v) { if (v != null) used[v] = (used[v] || 0) + 1; });
    doc.querySelectorAll('#keys .key').forEach(function (b) {
      var i = Number(b.getAttribute('data-i'));
      var c = used[i] || 0;
      var cap = Core.maxOf(cfg.spec, i);
      var repeatDigits = K.isRepeatDigits(cfg.spec);
      b.classList.toggle('used', !cfg.spec.rep && c > 0 || !!cfg.spec.cnt && c >= cap);
      b.classList.toggle('used-rep', cfg.spec.rep && c > 0 && !(cfg.spec.cnt && c >= cap));
      /* 有次數上限的項目顯示「1/2」，角標就先收起來 */
      b.querySelector('.key-used').textContent = !repeatDigits && cfg.spec.rep && c > 0 ? (cfg.spec.cnt && cap > 1 ? c + '/' + cap : '×' + c) : '';
      b.classList.toggle('has-used', c > 0);
      if (repeatDigits) {
        var remaining = Math.max(0, cap - c);
        var label = t(!remaining ? 'game.digitExhausted' : c ? 'game.digitRemaining' : 'game.digitAvailable', { n: remaining });
        b.querySelector('.key-remaining').textContent = label;
        b.setAttribute('aria-label', K.symName(cfg.spec, i) + '：' + label);
      }
      b.disabled = !enabled || repeatDigits && c >= cap;
      b.setAttribute('aria-pressed', c > 0 ? 'true' : 'false');
    });
    var full = input.every(function (v) { return v != null; });
    var valid = full && !Object.keys(dup).length;
    $('k-submit').disabled = !enabled || !valid;
    $('k-back').disabled = !enabled || input.every(function (v) { return v == null; });
    $('k-clear').disabled = $('k-back').disabled;
    var note = '';
    if (Object.keys(dup).length) note = t(cfg.spec.cnt ? 'game.overPoolNote' : cfg.spec.rep ? 'game.tooManyNote' : 'game.dupNote');
    $('input-note').textContent = note;
    $('input-note').classList.toggle('warn', !!note);
  }
  /** 點筆記方塊：跳出 4 個狀態的小選單直接選（順序：一定有、一定沒有、可能有、清除標記） */
  var NOTE_ICON = ['', 'check', 'cross', 'question'];
  function openNoteMenu(btn) {
    var i = Number(btn.getAttribute('data-i'));
    /* 矮螢幕（手機橫向）放不下 4 列，改成 2×2，選單要寬一點 */
    var compact = root.innerHeight <= 480;
    K.menu(btn, {
      cls: compact ? 'note-menu compact' : 'note-menu',
      minW: compact ? 300 : 200,
      label: K.symName(cfg.spec, i),
      value: notes[i] || 0,
      items: [1, 2, 3, 0].map(function (st) {
        return { value: st, label: t(st ? 'notes.st' + st : 'notes.clear'), icon: '<span class="note-opt-mark" data-st="' + st + '" aria-hidden="true">' + (st ? K.icon(NOTE_ICON[st]) : '') + '</span>' };
      }),
      onPick: function (st) {
        if (!cfg) return;
        if ((notes[i] || 0) !== st) root.Sound.play('pop');
        notes[i] = st;
        renderNotes();
      }
    });
  }
  function renderNotes() {
    var marks = ['', K.icon('check'), K.icon('cross'), K.icon('question')];
    doc.querySelectorAll('#notes .note').forEach(function (b) {
      var i = Number(b.getAttribute('data-i'));
      var st = notes[i] || 0;
      b.setAttribute('data-st', st);
      b.querySelector('.note-mark').innerHTML = marks[st];
      b.setAttribute('aria-label', K.symName(cfg.spec, i) + '：' + t('notes.st' + st));
    });
    doc.querySelectorAll('#keys .key').forEach(function (b) {
      var i = Number(b.getAttribute('data-i'));
      var st = notes[i] || 0;
      b.setAttribute('data-note', st);
      b.querySelector('.key-note').innerHTML = marks[st];
    });
  }

  /* ---------- 輸入動作 ---------- */
  function nextEmpty(from) {
    for (var k = 0; k < Core.LEN; k++) { var s = (from + k) % Core.LEN; if (input[s] == null) return s; }
    return -1;
  }
  function pressKey(i) {
    if (!enabled || !cfg) return;
    recallIdx = -1;
    var cntNow = input.filter(function (v) { return v === i; }).length;
    /* 數字重複局用完即停用；實體鍵盤也不會意外刪除已填數字。 */
    if (K.isRepeatDigits(cfg.spec) && cntNow >= Core.maxOf(cfg.spec, i)) return;
    if (!cfg.spec.rep || cfg.spec.cnt && cntNow >= cfg.spec.cnt[i]) {
      /* 不重複，或已經用到項目池裡的個數：再點一下＝從最後放的那一格拿掉 */
      var at = input.lastIndexOf(i);
      if (at >= 0) {
        /* 已用過的符號：再點一下＝從原本的格子拿掉 */
        input[at] = null; cursor = at;
        root.Sound.play('back');
        renderSlots();
        return;
      }
    }
    var s = input[cursor] == null ? cursor : nextEmpty(cursor);
    if (s < 0) s = cursor;
    input[s] = i;
    var ne = nextEmpty(s + 1);
    cursor = ne < 0 ? s : ne;
    root.Sound.play('key');
    root.Sound.vibrate(8);
    renderSlots();
    pulseSlot(s);
    maybeAutoSubmit();
  }
  function tapSlot(s) {
    if (!enabled) return;
    recallIdx = -1;
    if (input[s] != null) { input[s] = null; root.Sound.play('back'); }
    cursor = s;
    renderSlots();
  }
  function rotate(s, d) {
    if (!enabled) return;
    var n = cfg.spec.n;
    var v = input[s];
    input[s] = v == null ? (d > 0 ? 0 : n - 1) : (v + d + n) % n;
    cursor = s;
    root.Sound.play('tick');
    root.Sound.vibrate(4);
    renderSlots();
  }
  function backspace() {
    if (!enabled) return;
    for (var s = Core.LEN - 1; s >= 0; s--) if (input[s] != null) { input[s] = null; cursor = s; root.Sound.play('back'); break; }
    renderSlots();
  }
  function clearAll() {
    if (!enabled) return;
    input = [null, null, null, null]; cursor = 0; recallIdx = -1;
    root.Sound.play('back');
    renderSlots();
  }
  function moveCursor(d) { if (!enabled) return; cursor = (cursor + d + Core.LEN) % Core.LEN; renderSlots(); }
  function pulseSlot(s) {
    var w = doc.querySelector('#slots .wheel[data-s="' + s + '"]');
    if (!w) return;
    w.classList.remove('pop'); void w.offsetWidth; w.classList.add('pop');
  }
  function maybeAutoSubmit() {
    if (!S('autoSubmit')) return;
    var full = input.every(function (v) { return v != null; });
    if (!full) return;
    var v = Core.validate(input, cfg.spec.n, cfg.spec.rep, cfg.spec.cnt);
    if (!v.ok) { root.Sound.play('error'); shake(); return; }
    clearTimeout(submitTimer);
    submitTimer = setTimeout(submit, 140);
  }
  function submit() {
    clearTimeout(submitTimer);
    if (!enabled || !cfg) return;
    var v = Core.validate(input, cfg.spec.n, cfg.spec.rep, cfg.spec.cnt);
    if (!v.ok) { root.Sound.play('error'); shake(); renderSlots(); return; }
    var code = input.slice();
    input = [null, null, null, null]; cursor = 0; recallIdx = -1;
    root.Sound.play('submit');
    renderSlots();
    cfg.onSubmit(code);
  }
  function shake() {
    var el = $('slots');
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  }
  /** 把某次猜測帶回輸入格（點歷史列、↑↓） */
  function recall(code) {
    if (!enabled || !code) return;
    input = code.slice(); cursor = Core.LEN - 1;
    var ne = nextEmpty(0); if (ne >= 0) cursor = ne;
    root.Sound.play('tick');
    renderSlots();
  }
  function myGuesses() {
    var tab = tabs.filter(function (x) { return x.mine; })[0];
    return tab ? tab.rows.filter(function (r) { return r.guess; }) : [];
  }
  function recallStep(d) {
    var list = myGuesses();
    if (!list.length) return;
    if (recallIdx < 0) recallIdx = d < 0 ? list.length - 1 : 0;
    else recallIdx = Math.max(0, Math.min(list.length - 1, recallIdx + d));
    var keep = recallIdx;
    recall(list[keep].guess);
    recallIdx = keep;
  }

  /* ---------- 歷史 ---------- */
  function fbHtml(a, b) {
    var s = '<span class="fb" aria-hidden="true">';
    for (var i = 0; i < a; i++) s += '<i class="fb-a">' + K.icon('key') + '</i>';
    for (var j = 0; j < b; j++) s += '<i class="fb-b">' + K.icon('lock') + '</i>';
    if (!a && !b) s += '<i class="fb-none">' + K.icon('cross') + '</i>';
    return s + '</span><b class="fb-text">' + a + 'A' + b + 'B</b>';
  }
  function rowHtml(r, idx, spec) {
    if (r.hint) {
      return '<li class="h-row hint"><span class="h-no">' + K.icon(r.icon || 'question') + '</span><span class="h-hint">' + (r.html || K.esc(r.text)) + '</span></li>';
    }
    if (r.timeout) return '<li class="h-row timeout"><span class="h-no">' + r.n + '</span><span class="h-code">' + K.icon('timer') + ' ' + K.esc(t('game.timeoutRow')) + '</span></li>';
    var code = r.guess.map(function (v) { return '<span class="h-sym">' + K.sym(spec, v, 'hist-sym') + '</span>'; }).join('');
    var label = r.guess.map(function (v) { return K.symName(spec, v); }).join('、') + '：' + r.a + 'A' + r.b + 'B';
    return '<li class="h-row' + (r.a === 4 ? ' solved' : '') + (r.mineRecall ? ' recallable' : '') + '" data-idx="' + idx + '" aria-label="' + K.esc(label) + '"' + (r.mineRecall ? ' tabindex="0" role="button"' : '') + '><span class="h-no">' + r.n + '</span><span class="h-code">' + code + '</span><span class="h-fb">' + fbHtml(r.a, r.b) + '</span></li>';
  }
  function renderHistory() {
    var tb = $('hist-tabs');
    tb.innerHTML = '';
    tb.hidden = tabs.length <= 1;
    tabs.forEach(function (tab, i) {
      var b = K.h('<button type="button" role="tab" class="tab" aria-selected="' + (i === activeTab) + '" data-t="' + i + '"></button>');
      b.innerHTML = (tab.icon || '') + '<span>' + K.esc(tab.label) + '</span><b class="tab-n">' + tab.rows.filter(function (r) { return !r.hint; }).length + '</b>';
      tb.appendChild(b);
    });
    var tab = tabs[activeTab] || { rows: [] };
    var list = $('history');
    var nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
    if (!tab.rows.length) {
      list.innerHTML = '<li class="h-empty">' + K.esc(tab.empty || t('game.noHistory')) + '</li>';
    } else {
      list.innerHTML = tab.rows.map(function (r, i) {
        if (tab.mine && r.guess) r.mineRecall = true;
        return rowHtml(r, i, tab.spec || cfg.spec);
      }).join('');
    }
    if (nearBottom || tab.rows.length !== tab._lastLen) list.scrollTop = list.scrollHeight;
    tab._lastLen = tab.rows.length;
    /* 窄版「開鎖」分頁：鍵盤上方顯示最近 3 次猜測，不用切到歷史分頁也看得到 */
    var mine = tabs.filter(function (x) { return x.focus; })[0] || tabs[0];
    var rec = $('recent');
    if (rec) {
      var rows = mine ? mine.rows.filter(function (r) { return !r.hint; }).slice(-3) : [];
      rec.innerHTML = rows.map(function (r) { return rowHtml(r, -1, mine.spec || cfg.spec).replace(' recallable', ''); }).join('');
      rec.hidden = !rows.length;
    }
    /* 手機分頁的未讀提示 */
    var total = tabs.reduce(function (s, x) { return s + x.rows.length; }, 0);
    var badge = $('gt-hist-badge');
    var app = $('app');
    if (app.getAttribute('data-gt') === 'hist') lastSeenCount = total;
    var unseen = total - lastSeenCount;
    badge.hidden = unseen <= 0;
    badge.textContent = unseen > 9 ? '9+' : String(unseen);
  }

  /* ---------- 小精靈 ---------- */
  var MOODS = { idle: 0, think: 1, happy: 2, shake: 3, surprise: 4, sleep: 5 };
  function say(text, mood) {
    $('bubble').textContent = text || '';
    $('bubble').hidden = !text;
    $('mascot').innerHTML = root.GuessArt.svg('mascot', MOODS[mood || 'idle'] || 0, 'mascot-svg');
    var m = $('mascot');
    m.classList.remove('bounce'); void m.offsetWidth; m.classList.add('bounce');
  }

  /* ---------- 對外 ---------- */
  function setup(c) {
    cfg = c;
    input = [null, null, null, null]; cursor = 0; recallIdx = -1;
    notes = new Array(c.spec.n).fill(0);
    tabs = []; activeTab = 0; lastSeenCount = 0;
    setWatch(null);
    var safe = $('safe');
    safe.setAttribute('data-tier', c.tier == null ? 'free' : String(c.tier));
    safe.setAttribute('data-purpose', c.purpose || 'guess');
    $('k-submit-text').textContent = c.purpose === 'secret' ? t('game.lock') : t('game.submit');
    $('notes-box').hidden = c.notes === false;
    buildSlots(); buildKeys(); buildNotes();
    setCounter('');
    setTimer(0);
    setStopwatch(null);
    say(c.greet || '', c.mood || 'idle');
    enabled = false;
    renderSlots();
    renderHistory();
    showTab('play');
  }
  /**
   * 觀戰模式：輸入區換成即時戰況看板，格子顯示最新一筆猜測。
   * @param {string|null} html  看板內容；null＝關閉觀戰模式
   * @param {number[]} [code]   要顯示在格子上的最新猜測
   * @param {string} [note]     格子下方的說明（誰剛猜了幾 A 幾 B）
   */
  var watchHtml = '';
  function setWatch(html, code, note) {
    var on = html != null && !!cfg;
    $('pad').classList.toggle('watching', on);
    $('safe').classList.toggle('watching', on);
    $('watch').hidden = !on;
    if (!on) { $('watch').innerHTML = ''; watchHtml = ''; return; }
    if (watchHtml !== html) { watchHtml = html; $('watch').innerHTML = html; }
    input = code ? code.slice() : [null, null, null, null];
    renderSlots();
    $('input-note').textContent = note || '';
    $('input-note').classList.remove('warn');
  }
  function setInput(on, why) {
    enabled = !!on && !!cfg;
    $('pad').classList.toggle('locked', !enabled);
    $('pad').setAttribute('data-why', why || '');
    $('safe').classList.toggle('locked', !enabled);
    if (!enabled) clearTimeout(submitTimer);
    renderSlots();
  }
  function setTabs(list, keepActive) {
    tabs = list || [];
    if (!keepActive || activeTab >= tabs.length) {
      var mi = tabs.findIndex(function (x) { return x.focus; });
      activeTab = mi >= 0 ? mi : 0;
    }
    renderHistory();
  }
  function setCounter(text) { $('counter').textContent = text || ''; $('counter').hidden = !text; }
  /**
   * 用時碼錶（正數）：
   *   null            → 收起來
   *   { since: 時間戳 } → 從這個本機時間開始一直跑
   *   { ms: 毫秒 }      → 停在這個時間（暫停、結束）
   */
  var swState = null;
  function setStopwatch(o) {
    var el = $('stopwatch');
    var key = o ? (o.since != null ? 's' + o.since : 'm' + o.ms) : '';
    if (key === swState && el.innerHTML) return;   // 線上每次更新都會呼叫，沒變就不重畫
    if (!o && swState === '') return;
    swState = key;
    if (!o) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.setAttribute('aria-label', t('game.elapsed'));
    el.innerHTML = K.icon('timer') + (o.since != null ? K.clockHtml('since', o.since, 'sw-num') : '<b class="clk sw-num">' + K.fmtTime(o.ms || 0) + '</b>');
  }
  var timerTick = null;
  /** 倒數條＋數字：deadline（伺服器毫秒時間戳）、總長、與伺服器的時差；10ms 一個 tick、秒數到小數第二位 */
  function setTimer(deadline, total, offset) {
    var el = $('timer');
    clearInterval(timerTick);
    var num = el.querySelector('.timer-num');
    if (!deadline) { el.hidden = true; num.removeAttribute('data-until'); return; }
    el.hidden = false;
    var local = deadline - (offset || 0);      // 換成本機時間
    num.setAttribute('data-until', String(local));
    var bar = el.querySelector('.timer i');
    var lastSec = -1, lastTxt = '', lastLow = null;
    function step() {
      var left = local - Date.now();
      var f = Math.max(0, Math.min(1, left / total));
      bar.style.transform = 'scaleX(' + f.toFixed(4) + ')';
      var txt = K.fmtTime(left);
      if (txt !== lastTxt) { lastTxt = txt; num.textContent = txt; }   // 只在數字真的變了才寫 DOM
      var low = left < Math.min(10000, total * 0.2);
      if (low !== lastLow) { lastLow = low; el.classList.toggle('low', low); }
      var sec = Math.max(0, Math.ceil(left / 1000));
      if (sec !== lastSec) { lastSec = sec; el.setAttribute('aria-label', t('game.timeLeft', { s: K.fmtTime(left) })); }
      if (left <= 0) clearInterval(timerTick);
    }
    step();
    timerTick = setInterval(step, 10);
  }
  function feedback(a, b) {
    root.Sound.feedback(a, b);
    var w = $('slots');
    w.classList.remove('flash-a', 'flash-b', 'flash-0'); void w.offsetWidth;
    w.classList.add(a ? 'flash-a' : b ? 'flash-b' : 'flash-0');
  }
  function setNotes(i, st) { if (!cfg) return; notes[i] = st; renderNotes(); }
  function getNotes() { return notes.slice(); }
  function showTab(name) {
    $('app').setAttribute('data-gt', name);
    doc.querySelectorAll('#g-tabs [data-gt]').forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-gt') === name ? 'true' : 'false'); });
    if (name === 'hist') { lastSeenCount = tabs.reduce(function (s, x) { return s + x.rows.length; }, 0); renderHistory(); }
    K.refreshScroll();
  }
  function setKeyCaps() { $('keys').classList.toggle('show-caps', S('showKeys') === 'on' || (S('showKeys') === 'auto' && root.matchMedia && root.matchMedia('(hover: hover) and (pointer: fine)').matches)); }
  function applyInputMode() {
    var m = S('inputMode');
    $('app').setAttribute('data-input', m);
  }
  /** 讓使用者挑一個位置或一個項目（提示道具用） */
  function choose(kind, title, cb) {
    var body = doc.createElement('div');
    body.className = 'choose-grid ' + kind;
    if (kind === 'pos') {
      for (var s = 0; s < Core.LEN; s++) body.appendChild(K.h('<button type="button" class="btn choose-pos" data-v="' + s + '">' + t('game.slotN', { n: s + 1 }) + '</button>'));
    } else {
      for (var i = 0; i < cfg.spec.n; i++) {
        var b = K.h('<button type="button" class="key choose-sym" data-v="' + i + '">' + K.sym(cfg.spec, i, 'key-sym') + '</button>');
        b.setAttribute('aria-label', K.symName(cfg.spec, i));
        body.appendChild(b);
      }
    }
    var m = K.Modal({ title: title, body: body, cls: 'choose', actions: [{ label: t('common.cancel'), kind: 'ghost' }] });
    body.addEventListener('click', function (e) {
      var b = e.target.closest('[data-v]'); if (!b) return;
      m.close();
      cb(Number(b.getAttribute('data-v')));
    });
  }

  function bind() {
    $('keys').addEventListener('click', function (e) {
      var b = e.target.closest('.key'); if (!b || b.disabled) return;
      pressKey(Number(b.getAttribute('data-i')));
    });
    $('notes').addEventListener('click', function (e) {
      var b = e.target.closest('.note'); if (!b || !cfg) return;
      openNoteMenu(b);
    });
    $('notes-reset').addEventListener('click', function () { if (!cfg) return; notes = new Array(cfg.spec.n).fill(0); renderNotes(); });
    $('k-back').addEventListener('click', backspace);
    $('k-clear').addEventListener('click', clearAll);
    $('k-submit').addEventListener('click', submit);
    $('hist-tabs').addEventListener('click', function (e) {
      var b = e.target.closest('[data-t]'); if (!b) return;
      activeTab = Number(b.getAttribute('data-t'));
      renderHistory();
    });
    function rowRecall(e) {
      var li = e.target.closest('.h-row.recallable'); if (!li) return;
      var tab = tabs[activeTab]; if (!tab) return;
      var r = tab.rows[Number(li.getAttribute('data-idx'))];
      if (r && r.guess) { recall(r.guess); if ($('app').getAttribute('data-gt') !== 'play' && root.matchMedia('(max-width: 899px)').matches) showTab('play'); }
    }
    $('history').addEventListener('click', rowRecall);
    $('history').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rowRecall(e); } });
    $('g-tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-gt]'); if (b) showTab(b.getAttribute('data-gt')); });

    doc.addEventListener('keydown', function (e) {
      if ($('app').getAttribute('data-screen') !== 'game' || !cfg) return;
      if (K.Modal.top()) return;
      var tg = e.target;
      if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable)) return;
      if (e.altKey || e.metaKey) return;
      if (e.ctrlKey && e.key !== 'Backspace') return;
      if (!enabled) return;
      if (e.key === 'Enter' && !(tg && tg.closest && tg.closest('button:not(.wheel-arrow)')) ) { e.preventDefault(); submit(); return; }
      if (e.key === 'Backspace') { e.preventDefault(); if (e.ctrlKey) clearAll(); else backspace(); return; }
      if (e.key === 'Delete') { e.preventDefault(); clearAll(); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); moveCursor(-1); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); moveCursor(1); return; }
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && S('historyKeys')) { e.preventDefault(); recallStep(e.key === 'ArrowUp' ? -1 : 1); return; }
      if (e.key === ' ' && !(tg && tg.closest && tg.closest('button'))) { e.preventDefault(); if (input[cursor] != null) { input[cursor] = null; renderSlots(); } return; }
      var i = indexFromEvent(e);
      if (i >= 0) { e.preventDefault(); pressKey(i); flashKey(i); }
    });
    root.Store.onChange(function (k) { if (k === 'showKeys' || k === '*') setKeyCaps(); if (k === 'inputMode' || k === '*') applyInputMode(); });
    setKeyCaps(); applyInputMode();
  }
  function flashKey(i) {
    var b = doc.querySelector('#keys .key[data-i="' + i + '"]');
    if (!b) return;
    b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit');
  }

  function init() {
    K = root.Kit;
    $ = function (id) { return doc.getElementById(id); };
    bind();
    if (root.ResizeObserver) new ResizeObserver(function () { fitCols(); }).observe($('keys'));
    else root.addEventListener('resize', fitCols);
    root.I18N.onChange(function () { if (cfg) { buildKeys(); buildNotes(); renderSlots(); renderHistory(); $('k-submit-text').textContent = cfg.purpose === 'secret' ? t('game.lock') : t('game.submit'); } });
  }

  root.GameView = {
    init: init, setup: setup, setInput: setInput, setWatch: setWatch, setTabs: setTabs, setCounter: setCounter, setStopwatch: setStopwatch, setTimer: setTimer,
    say: say, feedback: feedback, setNotes: setNotes, getNotes: getNotes, showTab: showTab, choose: choose,
    recall: recall, keyLabel: keyLabel, fbHtml: fbHtml, rowHtml: rowHtml,
    get cfg() { return cfg; }, get input() { return input.slice(); }, get enabled() { return enabled; },
    _press: pressKey, _submit: submit
  };
})(typeof self !== 'undefined' ? self : this);
