/* ===== ui/kit.js — 自訂 UI 元件（不使用原生控制項外觀）=====
 * Kit.icon / Kit.sym      圖示與符號 SVG
 * Kit.Modal               彈出視窗（遮罩、焦點鎖定、Esc 關閉、關閉後回到原焦點）
 * Kit.toast               浮動訊息
 * Kit.menu                自製下拉選單（取代 <select>）
 * Kit.switch / stepper / segmented   開關、加減按鈕、分段選擇
 * 自訂捲軸                凡是 .scroll 容器都會隱藏原生捲軸並畫上自訂滑塊（可拖曳、可點軌道）
 */
(function (root) {
  'use strict';
  var doc = root.document;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function h(html) { var t = doc.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function t(k, p) { return root.I18N.t(k, p); }

  /* ---------- 圖示與符號 ---------- */
  var iconIndex = null;
  function icon(key, cls) {
    if (!iconIndex) {
      iconIndex = {};
      var set = root.GuessArt.get('icons');
      (set ? set.items : []).forEach(function (it, i) { iconIndex[it.key] = i; });
    }
    var i = iconIndex[key];
    if (i == null) return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 100 100" aria-hidden="true"></svg>';
    return root.GuessArt.svg('icons', i, 'ico ' + (cls || ''));
  }
  /** 本局第 i 個項目（池內索引）的 SVG */
  function sym(spec, i, cls) {
    if (i == null || i < 0) return '';
    var ref = root.GuessCore.symbolRef(spec.cs, spec.pool[i]);
    return root.GuessArt.svg(ref.set, ref.index, cls);
  }
  function symItem(spec, i) {
    var ref = root.GuessCore.symbolRef(spec.cs, spec.pool[i]);
    var set = root.GuessArt.get(ref.set);
    return set ? set.items[ref.index] : null;
  }
  function symName(spec, i) { var it = symItem(spec, i); return it ? root.I18N.pick(it.n) : '?'; }
  /** 字元集代表圖示（選單、關卡卡片用） */
  function csIcon(cs, cls) {
    if (cs === 'digits') return root.GuessArt.svg('digits', 1, cls);
    if (cs === 'letters') return root.GuessArt.svg('letters', 0, cls);
    if (cs === 'gems') return root.GuessArt.svg('gems', 5, cls);
    if (cs === 'mix') return root.GuessArt.svg('pack-space', 3, cls);
    var rep = { 'pack-food': 2, 'pack-fruit': 0, 'pack-wear': 1, 'pack-home': 0, 'pack-go': 0, 'pack-learn': 1, 'pack-play': 4, 'pack-animal': 0, 'pack-flag': 0, 'pack-space': 6, 'pack-tw': 0, 'pack-landmark': 0 };
    return root.GuessArt.svg(cs, rep[cs] || 0, cls);
  }

  /* ---------- 浮動訊息 ---------- */
  function toast(text, kind, ms) {
    var box = doc.getElementById('toasts');
    if (!box) return;
    var el = h('<div class="toast ' + (kind || '') + '" role="status"></div>');
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(function () { el.classList.add('out'); setTimeout(function () { el.remove(); }, 300); }, ms || 2600);
  }

  /* ---------- 彈出視窗 ---------- */
  var stack = [];
  function focusables(el) {
    return Array.prototype.filter.call(el.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])'), function (x) { return x.offsetParent !== null || x === doc.activeElement; });
  }
  /**
   * @param {{title:string, body:string|Node, actions?:Array<{label,kind,onClick,close}>, cls?:string, onClose?:function, dismissable?:boolean, label?:string}} o
   */
  function Modal(o) {
    var prev = doc.activeElement;
    var mask = h('<div class="modal-mask ' + (o.cls || '') + '"><div class="modal" role="dialog" aria-modal="true"><header class="modal-head"><h2 class="modal-title"></h2>' +
      (o.dismissable === false ? '' : '<button type="button" class="icon-btn modal-x" aria-label="' + esc(t('common.close')) + '">' + icon('close') + '</button>') +
      '</header><div class="modal-body scroll"></div><footer class="modal-foot"></footer></div></div>');
    var dlg = mask.querySelector('.modal');
    var id = 'm' + Math.random().toString(36).slice(2, 8);
    mask.querySelector('.modal-title').id = id;
    dlg.setAttribute('aria-labelledby', id);
    mask.querySelector('.modal-title').textContent = o.title || '';
    var body = mask.querySelector('.modal-body');
    if (typeof o.body === 'string') body.innerHTML = o.body; else if (o.body) body.appendChild(o.body);
    var foot = mask.querySelector('.modal-foot');
    (o.actions || []).forEach(function (a) {
      var b = h('<button type="button" class="btn ' + (a.kind || '') + '"></button>');
      b.innerHTML = (a.icon ? icon(a.icon) : '') + '<span>' + esc(a.label) + '</span>';
      if (a.disabled) { b.disabled = true; if (a.note) b.title = a.note; }
      b.addEventListener('click', function () { if (a.onClick) a.onClick(api); if (a.close !== false) close(); });
      foot.appendChild(b);
    });
    if (!foot.children.length) foot.remove();
    var bg = Array.prototype.filter.call(doc.body.children, function (n) { return n !== mask && !n.inert; });
    bg.forEach(function (n) { n.inert = true; });
    doc.body.appendChild(mask);
    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      doc.removeEventListener('keydown', onKey, true);
      mask.classList.add('out');
      setTimeout(function () { mask.remove(); }, 160);
      bg.forEach(function (n) { n.inert = false; });
      stack.splice(stack.indexOf(api), 1);
      if (prev && prev.isConnected && prev.focus) { try { prev.focus({ preventScroll: true }); } catch (e) { /* 忽略 */ } }
      if (o.onClose) o.onClose();
    }
    function onKey(e) {
      if (stack[stack.length - 1] !== api) return;
      if (e.key === 'Escape' && o.dismissable !== false) { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key === 'Tab') {
        var f = focusables(dlg);
        if (!f.length) { e.preventDefault(); return; }
        var i = f.indexOf(doc.activeElement);
        if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    }
    doc.addEventListener('keydown', onKey, true);
    var x = mask.querySelector('.modal-x'); if (x) x.addEventListener('click', close);
    if (o.dismissable !== false) mask.addEventListener('pointerdown', function (e) { if (e.target === mask) close(); });
    var api = { el: mask, body: body, close: close };
    stack.push(api);
    setTimeout(function () { var f = focusables(dlg); var first = dlg.querySelector('[data-autofocus]') || f[f.length > 1 && x ? 1 : 0] || f[0]; if (first) first.focus({ preventScroll: true }); }, 30);
    return api;
  }
  Modal.top = function () { return stack[stack.length - 1] || null; };
  Modal.closeAll = function () { stack.slice().reverse().forEach(function (m) { m.close(); }); };

  /* ---------- 下拉選單 ---------- */
  /**
   * @param {HTMLElement} btn  觸發按鈕
   * @param {{items:Array<{value,label,icon?,group?,disabled?}>, value:any, onPick:function, label?:string, wide?:boolean}} o
   */
  function menu(btn, o) {
    if (btn._menuOpen) return;
    var pop = h('<div class="menu-pop scroll" role="listbox" tabindex="-1"></div>');
    if (o.label) pop.setAttribute('aria-label', o.label);
    if (o.wide) pop.classList.add('wide');
    var opts = [];
    var lastGroup = null;
    o.items.forEach(function (it) {
      if (it.group && it.group !== lastGroup) { pop.appendChild(h('<div class="menu-group" role="presentation">' + esc(it.group) + '</div>')); lastGroup = it.group; }
      var b = h('<div class="menu-opt" role="option" tabindex="-1"></div>');
      b.innerHTML = (it.icon || '') + '<span>' + esc(it.label) + '</span>' + (it.value === o.value ? icon('check', 'menu-check') : '');
      b.setAttribute('aria-selected', it.value === o.value ? 'true' : 'false');
      if (it.disabled) b.setAttribute('aria-disabled', 'true');
      b.addEventListener('click', function () { if (it.disabled) return; done(); o.onPick(it.value); });
      pop.appendChild(b); opts.push(b);
    });
    doc.body.appendChild(pop);
    btn._menuOpen = true;
    btn.setAttribute('aria-expanded', 'true');
    function place() {
      var r = btn.getBoundingClientRect(), vw = root.innerWidth, vh = root.innerHeight;
      var w = Math.max(r.width, o.wide ? 280 : 180);
      w = Math.min(w, vw - 16);
      pop.style.width = w + 'px';
      var left = Math.min(Math.max(8, r.left), vw - w - 8);
      var below = vh - r.bottom - 8, above = r.top - 8;
      var mh = Math.min(420, Math.max(below, above) - 8);
      pop.style.maxHeight = mh + 'px';
      pop.style.left = left + 'px';
      if (below >= Math.min(pop.scrollHeight, 240) || below >= above) { pop.style.top = (r.bottom + 6) + 'px'; pop.style.bottom = ''; }
      else { pop.style.top = ''; pop.style.bottom = (vh - r.top + 6) + 'px'; }
    }
    place();
    var cur = Math.max(0, o.items.findIndex(function (it) { return it.value === o.value; }));
    function focus(i) { cur = (i + opts.length) % opts.length; opts[cur].focus(); opts[cur].scrollIntoView({ block: 'nearest' }); }
    setTimeout(function () { focus(cur); }, 10);
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(); btn.focus(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); focus(cur + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); focus(cur - 1); }
      else if (e.key === 'Home') { e.preventDefault(); focus(0); }
      else if (e.key === 'End') { e.preventDefault(); focus(opts.length - 1); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts[cur].click(); btn.focus(); }
      else if (e.key === 'Tab') { done(); }
    }
    function onDown(e) { if (!pop.contains(e.target) && e.target !== btn && !btn.contains(e.target)) done(); }
    function done() {
      if (!btn._menuOpen) return;
      btn._menuOpen = false;
      btn.setAttribute('aria-expanded', 'false');
      pop.remove();
      doc.removeEventListener('keydown', onKey, true);
      doc.removeEventListener('pointerdown', onDown, true);
      root.removeEventListener('resize', done);
    }
    doc.addEventListener('keydown', onKey, true);
    doc.addEventListener('pointerdown', onDown, true);
    root.addEventListener('resize', done);
    return { close: done };
  }

  /* ---------- 開關、加減、分段 ---------- */
  function switchHtml(id, on, label) {
    return '<button type="button" class="switch" role="switch" id="' + id + '" aria-checked="' + (on ? 'true' : 'false') + '"' + (label ? ' aria-label="' + esc(label) + '"' : '') + '><span class="switch-knob"></span></button>';
  }
  function bindSwitch(el, onChange) {
    el.addEventListener('click', function () {
      var v = el.getAttribute('aria-checked') !== 'true';
      el.setAttribute('aria-checked', v ? 'true' : 'false');
      onChange(v);
    });
  }
  function stepperHtml(id, value, label) {
    return '<div class="stepper" id="' + id + '" role="group" aria-label="' + esc(label || '') + '">' +
      '<button type="button" class="step-btn" data-d="-1" aria-label="' + esc(t('common.minus')) + '">' + icon('minus') + '</button>' +
      '<output class="step-val" aria-live="polite">' + esc(value) + '</output>' +
      '<button type="button" class="step-btn" data-d="1" aria-label="' + esc(t('common.plus')) + '">' + icon('plus') + '</button></div>';
  }
  function bindStepper(el, get, set, min, max) {
    function sync() {
      var v = get();
      el.querySelector('.step-val').textContent = v;
      el.querySelector('[data-d="-1"]').disabled = v <= min();
      el.querySelector('[data-d="1"]').disabled = v >= max();
    }
    el.addEventListener('click', function (e) {
      var b = e.target.closest('.step-btn'); if (!b || b.disabled) return;
      set(Math.max(min(), Math.min(max(), get() + Number(b.getAttribute('data-d')))));
      sync();
      if (root.Sound) root.Sound.play('key');
    });
    sync();
    return sync;
  }
  function segHtml(id, items, value, label) {
    return '<div class="seg" id="' + id + '" role="radiogroup" aria-label="' + esc(label || '') + '">' + items.map(function (it) {
      var on = it.value === value;
      return '<button type="button" role="radio" class="seg-btn" aria-checked="' + on + '" tabindex="' + (on ? 0 : -1) + '" data-v="' + esc(it.value) + '">' + (it.icon || '') + '<span>' + esc(it.label) + '</span></button>';
    }).join('') + '</div>';
  }
  function bindSeg(el, onChange) {
    var btns = Array.prototype.slice.call(el.querySelectorAll('.seg-btn'));
    function pick(b) {
      btns.forEach(function (x) { var on = x === b; x.setAttribute('aria-checked', on); x.tabIndex = on ? 0 : -1; });
      onChange(b.getAttribute('data-v'));
    }
    el.addEventListener('click', function (e) { var b = e.target.closest('.seg-btn'); if (b && !b.disabled) { pick(b); if (root.Sound) root.Sound.play('key'); } });
    el.addEventListener('keydown', function (e) {
      var i = btns.indexOf(doc.activeElement); if (i < 0) return;
      var d = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      var nb = btns[(i + d + btns.length) % btns.length];
      nb.focus(); pick(nb);
    });
  }

  /* ---------- 自訂捲軸 ---------- */
  var layer = null, items = new Map(), queued = false;
  function attach(el) {
    if (items.has(el)) return;
    var track = doc.createElement('div'), thumb = doc.createElement('div');
    track.className = 'sb-track'; thumb.className = 'sb-thumb'; track.appendChild(thumb); layer.appendChild(track);
    var it = { track: track, thumb: thumb };
    items.set(el, it);
    thumb.addEventListener('pointerdown', function (e) {
      e.preventDefault(); thumb.setPointerCapture(e.pointerId); thumb.classList.add('drag');
      var y0 = e.clientY, s0 = el.scrollTop, k = (el.scrollHeight - el.clientHeight) / Math.max(1, track.clientHeight - thumb.offsetHeight);
      function mv(ev) { el.scrollTop = s0 + (ev.clientY - y0) * k; }
      function up() { thumb.classList.remove('drag'); thumb.removeEventListener('pointermove', mv); thumb.removeEventListener('pointerup', up); thumb.removeEventListener('pointercancel', up); }
      thumb.addEventListener('pointermove', mv); thumb.addEventListener('pointerup', up); thumb.addEventListener('pointercancel', up);
    });
    track.addEventListener('pointerdown', function (e) {
      if (e.target !== track) return;
      var r = thumb.getBoundingClientRect();
      el.scrollTop += (e.clientY < r.top ? -1 : 1) * el.clientHeight * 0.85;
    });
    el.addEventListener('scroll', schedule, { passive: true });
  }
  function visible(el) {
    for (var n = el; n && n !== doc.body; n = n.parentElement) {
      if (n.hidden || n.inert && false) return false;
      var cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    }
    return true;
  }
  function update() {
    queued = false;
    items.forEach(function (it, el) {
      if (!el.isConnected) { it.track.remove(); items.delete(el); return; }
      var r = el.getBoundingClientRect();
      var max = el.scrollHeight - el.clientHeight;
      if (max <= 2 || r.width === 0 || r.height < 40 || !visible(el)) { it.track.style.display = 'none'; return; }
      var th = Math.max(32, (r.height - 8) * el.clientHeight / el.scrollHeight), room = r.height - 8 - th;
      var tr = it.track.style;
      tr.display = 'block'; tr.top = (r.top + 4) + 'px'; tr.height = (r.height - 8) + 'px'; tr.left = (r.right - 9) + 'px';
      var z = 0;
      for (var n = el; n; n = n.parentElement) { var zi = parseInt(getComputedStyle(n).zIndex, 10); if (!isNaN(zi)) { z = zi; } }
      tr.zIndex = String(z + 1);
      it.thumb.style.height = th + 'px'; it.thumb.style.transform = 'translateY(' + (room * el.scrollTop / max) + 'px)';
    });
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(update); } }
  function scan(node) {
    if (node.nodeType !== 1) return;
    if (node.classList.contains('scroll')) attach(node);
    node.querySelectorAll('.scroll').forEach(attach);
  }
  function bootScroll() {
    layer = doc.createElement('div'); layer.id = 'sb-layer'; layer.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(layer);
    scan(doc.body);
    new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(scan); }); schedule(); })
      .observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'style', 'data-screen', 'data-side'] });
    root.addEventListener('resize', schedule);
    root.addEventListener('orientationchange', schedule);
    setInterval(schedule, 700);
  }
  if (doc) { if (doc.body) bootScroll(); else doc.addEventListener('DOMContentLoaded', bootScroll); }

  root.Kit = {
    esc: esc, h: h, icon: icon, sym: sym, symItem: symItem, symName: symName, csIcon: csIcon, toast: toast, Modal: Modal, menu: menu,
    switchHtml: switchHtml, bindSwitch: bindSwitch, stepperHtml: stepperHtml, bindStepper: bindStepper,
    segHtml: segHtml, bindSeg: bindSeg, refreshScroll: schedule
  };
})(typeof self !== 'undefined' ? self : this);
