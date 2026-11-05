/* ===== audio.js — 音效與背景音樂（Web Audio 即時合成，不需要音檔）=====
 * 精緻密碼鎖風：撥輪喀喀、按鍵、送出、A 叮、B 噠、解鎖和弦、錯誤嗡、猜錯搖晃。
 * BGM：木琴風可愛小調，輕鬆循環。第一次使用者手勢後才解鎖 AudioContext。
 * 之後要換成正式音檔，只要改 play() 的實作即可（介面不變）。
 */
(function (root) {
  'use strict';
  var ctx = null, master = null, sfxGain = null, musicGain = null;
  var musicTimer = null, musicStep = 0, nextTime = 0;

  function S(k) { return root.Store ? root.Store.get(k) : null; }

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(function () {}); return ctx; }
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.connect(master);
    applyVolumes();
    return ctx;
  }
  function applyVolumes() {
    if (!ctx) return;
    sfxGain.gain.value = S('sfxOn') ? Number(S('sfxVol')) : 0;
    musicGain.gain.value = S('musicOn') ? Number(S('musicVol')) * 0.35 : 0;
  }

  function tone(freq, start, dur, opt) {
    opt = opt || {};
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = opt.type || 'sine';
    o.frequency.setValueAtTime(freq, start);
    if (opt.slide) o.frequency.exponentialRampToValueAtTime(opt.slide, start + dur);
    var v = opt.vol == null ? 0.3 : opt.vol;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(v, start + (opt.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(opt.dest || sfxGain);
    o.start(start); o.stop(start + dur + 0.02);
  }
  function noise(start, dur, vol, hp) {
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 2000;
    var g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(start);
  }

  var SFX = {
    tick: function (t) { noise(t, 0.025, 0.35, 3500); tone(1800, t, 0.03, { type: 'square', vol: 0.05 }); },
    key: function (t) { tone(660, t, 0.07, { type: 'triangle', vol: 0.18 }); noise(t, 0.02, 0.12, 4000); },
    back: function (t) { tone(440, t, 0.07, { type: 'triangle', vol: 0.15, slide: 330 }); },
    submit: function (t) { noise(t, 0.05, 0.3, 1500); tone(220, t, 0.12, { type: 'square', vol: 0.08 }); },
    a: function (t) { tone(1318, t, 0.25, { type: 'sine', vol: 0.22 }); tone(1975, t, 0.18, { type: 'sine', vol: 0.08 }); },
    b: function (t) { tone(784, t, 0.12, { type: 'triangle', vol: 0.18 }); },
    none: function (t) { tone(330, t, 0.15, { type: 'triangle', vol: 0.12, slide: 260 }); },
    win: function (t) {
      noise(t, 0.08, 0.35, 900);
      [523, 659, 784, 1046].forEach(function (f, i) { tone(f, t + 0.12 + i * 0.09, 0.5, { type: 'triangle', vol: 0.2 }); });
      tone(1568, t + 0.55, 0.6, { type: 'sine', vol: 0.12 });
    },
    lose: function (t) { [392, 330, 262].forEach(function (f, i) { tone(f, t + i * 0.16, 0.3, { type: 'triangle', vol: 0.16 }); }); },
    error: function (t) { tone(150, t, 0.16, { type: 'sawtooth', vol: 0.08 }); tone(140, t + 0.08, 0.14, { type: 'sawtooth', vol: 0.06 }); },
    hint: function (t) { tone(988, t, 0.12, { vol: 0.15 }); tone(1318, t + 0.08, 0.2, { vol: 0.12 }); },
    star: function (t) { tone(1568, t, 0.2, { vol: 0.15 }); tone(2093, t + 0.06, 0.25, { vol: 0.1 }); },
    pop: function (t) { tone(880, t, 0.06, { type: 'sine', vol: 0.15, slide: 1320 }); },
    chat: function (t) { tone(1046, t, 0.08, { vol: 0.1 }); tone(1318, t + 0.07, 0.1, { vol: 0.08 }); },
    count: function (t) { tone(660, t, 0.14, { type: 'sine', vol: 0.16 }); },
    go: function (t) { tone(988, t, 0.1, { type: 'sine', vol: 0.18 }); tone(1318, t + 0.08, 0.28, { type: 'sine', vol: 0.16 }); },
    turn: function (t) { tone(784, t, 0.1, { vol: 0.14 }); tone(1046, t + 0.1, 0.16, { vol: 0.12 }); }
  };

  function play(name) {
    if (!S('sfxOn')) return;
    if (!ensure()) return;
    var f = SFX[name]; if (!f) return;
    try { f(ctx.currentTime + 0.005); } catch (e) { /* 忽略 */ }
  }
  /** 一串 A/B 回饋音：A 先、B 後，間隔一點 */
  function feedback(a, b) {
    if (!S('sfxOn') || !ensure()) return;
    var t = ctx.currentTime + 0.02, i;
    if (!a && !b) { SFX.none(t); return; }
    for (i = 0; i < a; i++) SFX.a(t + i * 0.11);
    for (i = 0; i < b; i++) SFX.b(t + (a + i) * 0.11);
  }

  /* ---------- BGM：木琴風循環小調（C 大調，8 小節） ---------- */
  var MEL = [72, 0, 76, 79, 77, 76, 74, 0, 72, 74, 76, 0, 74, 72, 71, 0, 69, 0, 72, 76, 74, 72, 71, 72, 74, 0, 79, 77, 76, 74, 72, 0];
  var BASS = [48, 55, 52, 55, 53, 57, 55, 59];
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function scheduleMusic() {
    if (!ctx) return;
    var beat = 0.27;
    while (nextTime < ctx.currentTime + 0.6) {
      var m = MEL[musicStep % MEL.length];
      if (m) {
        tone(mtof(m), nextTime, 0.35, { type: 'triangle', vol: 0.22, dest: musicGain });
        tone(mtof(m + 12), nextTime, 0.12, { type: 'sine', vol: 0.05, dest: musicGain });
      }
      if (musicStep % 4 === 0) tone(mtof(BASS[Math.floor(musicStep / 4) % BASS.length]), nextTime, 0.9, { type: 'sine', vol: 0.18, dest: musicGain });
      nextTime += beat;
      musicStep++;
    }
  }
  function startMusic() {
    if (!S('musicOn')) return;
    if (!ensure() || musicTimer) return;
    nextTime = ctx.currentTime + 0.1;
    musicTimer = setInterval(scheduleMusic, 200);
  }
  function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }
  function refresh() {
    applyVolumes();
    if (S('musicOn')) { if (ctx) startMusic(); } else stopMusic();
  }
  function vibrate(ms) { try { if (S('vibrate') && root.navigator && root.navigator.vibrate) root.navigator.vibrate(ms); } catch (e) { /* 忽略 */ } }

  /* 第一次使用者手勢後解鎖音訊 */
  function unlock() {
    ensure();
    startMusic();
    root.removeEventListener('pointerdown', unlock, true);
    root.removeEventListener('keydown', unlock, true);
  }
  if (root.addEventListener) {
    root.addEventListener('pointerdown', unlock, true);
    root.addEventListener('keydown', unlock, true);
    root.document && root.document.addEventListener('visibilitychange', function () {
      if (!ctx) return;
      if (root.document.hidden) ctx.suspend().catch(function () {}); else ctx.resume().catch(function () {});
    });
  }

  root.Sound = { play: play, feedback: feedback, refresh: refresh, vibrate: vibrate, startMusic: startMusic, stopMusic: stopMusic };
})(typeof self !== 'undefined' ? self : this);
