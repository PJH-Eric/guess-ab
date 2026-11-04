/* ===== ui/result.js — 結算（疊在遊戲畫面上的 overlay，不切換頁面、不卸載棋盤）=====
 * 固定三顆按鈕：再來一局／回到房間／回到首頁（目前模式不能用的會停用並說明原因）。
 * 內容：勝負或名次＋答案＋猜測次數＋小精靈表情；闖關另顯示星數、每日另顯示連勝、競速顯示排名。
 */
(function (root) {
  'use strict';
  var doc = root.document;
  var prevFocus = null, onKey = null;

  function t(k, p) { return root.I18N.t(k, p); }

  /**
   * @param {{kind:'win'|'lose'|'draw'|'rank', title:string, sub?:string, mood:string,
   *   spec:object, answers?:Array<{label:string, code:number[]}>, lines?:string[], stars?:number, starsMax?:number,
   *   streak?:number, ranking?:Array, again:{label?,onClick?,disabled?,note?}, room:{onClick?,disabled?,note?}, home:{onClick}}} o
   */
  function show(o) {
    var K = root.Kit;
    var layer = doc.getElementById('result-layer');
    prevFocus = doc.activeElement;
    var mascotIdx = { idle: 0, think: 1, happy: 2, shake: 3, surprise: 4, sleep: 5 }[o.mood || 'idle'] || 0;
    // data-result-share：共用的 result-share.js 會在卡片底部加上「分享結果」，把這張結算卡做成分享圖片
    var html = '<div class="result-card" role="dialog" aria-modal="true" aria-labelledby="res-title" data-result-share>' +
      '<div class="res-head res-' + o.kind + '">' + root.GuessArt.svg('mascot', mascotIdx, 'res-mascot') +
      '<div><h2 id="res-title" class="res-title">' + K.esc(o.title) + '</h2>' + (o.sub ? '<p class="res-sub">' + K.esc(o.sub) + '</p>' : '') + '</div></div>';
    if (o.stars != null) {
      html += '<div class="res-stars" aria-label="' + K.esc(t('res.starsAria', { n: o.stars })) + '">';
      for (var i = 0; i < (o.starsMax || 3); i++) html += '<i class="' + (i < o.stars ? 'on' : '') + '" style="--d:' + (i * 0.18) + 's">' + K.icon(i < o.stars ? 'star' : 'star-empty') + '</i>';
      html += '</div>';
    }
    (o.answers || []).forEach(function (ans) {
      html += '<div class="res-answer"><span class="res-label">' + K.esc(ans.label) + '</span><span class="res-code">' +
        ans.code.map(function (v) { return '<span class="h-sym">' + K.sym(o.spec, v, 'res-sym') + '</span>'; }).join('') + '</span></div>';
    });
    if (o.lines && o.lines.length) html += '<ul class="res-lines">' + o.lines.map(function (l) { return '<li>' + K.esc(l) + '</li>'; }).join('') + '</ul>';
    if (o.streak != null) html += '<p class="res-streak">' + K.icon('flame') + '<span>' + K.esc(t('res.streak', { n: o.streak })) + '</span></p>';
    if (o.ranking && o.ranking.length) {
      html += '<ol class="res-ranks scroll">' + o.ranking.map(function (r) {
        return '<li class="' + (r.me ? 'me' : '') + '"><b class="rk">' + r.rank + '</b>' + (r.avatar != null ? root.GuessArt.svg('avatars', r.avatar, 'rk-av') : '') +
          '<span class="rk-name">' + K.esc(r.name) + '</span><span class="rk-info">' + K.esc(r.info) + '</span></li>';
      }).join('') + '</ol>';
    }
    html += '<div class="res-actions">' +
      btn('again', 'primary', 'refresh', o.again && o.again.label || t('res.again'), o.again) +
      btn('room', '', 'users', t('res.room'), o.room) +
      btn('home', 'ghost', 'home', t('res.home'), o.home) + '</div>';
    html += '</div>';
    layer.innerHTML = html;
    layer.hidden = false;
    doc.body.classList.add('result-open');   // 讓提示移到上方（不用 :has，避免整頁樣式重算）
    layer.classList.remove('in'); void layer.offsetWidth; layer.classList.add('in');
    ['again', 'room', 'home'].forEach(function (k) {
      var b = layer.querySelector('[data-act="' + k + '"]');
      if (b && o[k] && o[k].onClick && !o[k].disabled) b.addEventListener('click', function () { hide(); o[k].onClick(); });
    });
    var first = layer.querySelector('.res-actions button:not([disabled])');
    if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 60);
    onKey = function (e) {
      if (layer.hidden) return;
      // 分享圖片視窗開著時，由它自己困住焦點
      if (doc.querySelector('.result-share-dialog-layer:not([hidden])')) return;
      if (e.key === 'Tab') {
        var f = Array.prototype.slice.call(layer.querySelectorAll('button:not([disabled])'));
        if (!f.length) return;
        var i = f.indexOf(doc.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    };
    doc.addEventListener('keydown', onKey, true);
    root.Kit.refreshScroll();
  }
  function btn(act, kind, ico, label, cfg) {
    var K = root.Kit;
    var dis = !cfg || cfg.disabled || !cfg.onClick;
    var note = cfg && cfg.note ? cfg.note : '';
    return '<button type="button" class="btn ' + kind + '" data-act="' + act + '"' + (dis ? ' disabled aria-disabled="true"' : '') + (note ? ' title="' + K.esc(note) + '"' : '') + '>' +
      K.icon(ico) + '<span>' + K.esc(label) + '</span>' + (dis && note ? '<small class="btn-note">' + K.esc(note) + '</small>' : '') + '</button>';
  }
  function hide() {
    var layer = doc.getElementById('result-layer');
    if (layer.hidden) return;
    layer.hidden = true;
    doc.body.classList.remove('result-open');
    layer.innerHTML = '';
    if (onKey) doc.removeEventListener('keydown', onKey, true);
    onKey = null;
  }
  function visible() { return !doc.getElementById('result-layer').hidden; }

  root.Result = { show: show, hide: hide, visible: visible };
})(typeof self !== 'undefined' ? self : this);
