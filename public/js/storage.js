/* ===== storage.js — 本機儲存（全部包 try/catch：無痕、被擋時照樣能玩）=====
 * key 前綴 guess-ab:v1。設定、暱稱、頭像、闖關星數、每日挑戰、戰績統計。
 * 壞資料自動回預設，不會讓遊戲當掉。
 */
(function (root) {
  'use strict';
  var KEY = 'guess-ab:v1';
  var DEFAULTS = {
    nickname: '', avatar: 0, lang: '',
    musicOn: true, musicVol: 0.45, sfxOn: true, sfxVol: 0.8, vibrate: true,
    reduceMotion: false, colorAssist: false,
    inputMode: 'both',            // both／wheel／keypad
    autoSubmit: true, showKeys: 'auto', historyKeys: true,
    lastSetup: { mode: 'guess', tier: 2, cs: 'digits', n: 10, rep: false, first: 'random' },
    lastTier: 0,
    stars: [[], [], [], []],      // 每個難度 100 關的星數（0＝未通關）
    daily: { last: '', streak: 0, best: 0, bestSteps: {}, done: {} },
    stats: { games: 0, wins: 0, sumGuess: 0, fastest: 0, byKind: {}, dist: {}, byTier: {} }
  };
  var data = null;
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load() {
    if (data) return data;
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { raw = null; }
    if (!raw || typeof raw !== 'object') raw = {};
    data = clone(DEFAULTS);
    Object.keys(DEFAULTS).forEach(function (k) {
      if (raw[k] === undefined) return;
      if (typeof DEFAULTS[k] !== typeof raw[k]) return;
      if (Array.isArray(DEFAULTS[k]) !== Array.isArray(raw[k])) return;
      if (typeof DEFAULTS[k] === 'object' && !Array.isArray(DEFAULTS[k])) data[k] = Object.assign(clone(DEFAULTS[k]), raw[k]);
      else data[k] = raw[k];
    });
    if (!Array.isArray(data.stars) || data.stars.length !== 4) data.stars = [[], [], [], []];
    return data;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* 忽略 */ } }
  var listeners = [];
  function get(k) { return load()[k]; }
  function set(k, v) { load()[k] = v; save(); listeners.forEach(function (f) { try { f(k, v); } catch (e) { /* 忽略 */ } }); }
  function onChange(f) { listeners.push(f); }
  /** 恢復預設設定（暱稱、頭像、語言、進度與戰績保留） */
  function resetSettings() {
    var d = load();
    var keep = { nickname: d.nickname, avatar: d.avatar, lang: d.lang, lastSetup: d.lastSetup, lastTier: d.lastTier, stars: d.stars, daily: d.daily, stats: d.stats };
    data = Object.assign(clone(DEFAULTS), keep);
    save();
    listeners.forEach(function (f) { try { f('*', null); } catch (e) { /* 忽略 */ } });
  }

  /* ---------- 闖關 ---------- */
  function starsOf(tier, L) { var a = load().stars[tier] || []; return a[L - 1] || 0; }
  function setStars(tier, L, s) {
    var d = load();
    var a = d.stars[tier] || (d.stars[tier] = []);
    if ((a[L - 1] || 0) < s) { a[L - 1] = s; save(); return true; }
    return false;
  }
  function unlocked(tier, L) { return L === 1 || starsOf(tier, L - 1) > 0; }
  function tierProgress(tier) { var a = load().stars[tier] || []; var c = 0, s = 0; for (var i = 0; i < 100; i++) { if (a[i]) { c++; s += a[i]; } } return { cleared: c, stars: s }; }

  /* ---------- 每日挑戰 ---------- */
  function dailyDone(date) { return load().daily.done[date] || null; }
  function recordDaily(date, prevDate, won, steps) {
    var d = load().daily;
    if (d.done[date]) return d;
    d.done[date] = { won: !!won, steps: steps };
    var keys = Object.keys(d.done).sort();
    if (keys.length > 60) keys.slice(0, keys.length - 60).forEach(function (k) { delete d.done[k]; });
    if (won) {
      d.streak = (d.last === prevDate && d.streakWon !== false) ? d.streak + 1 : 1;
      d.best = Math.max(d.best, d.streak);
    } else d.streak = 0;
    d.streakWon = !!won;
    d.last = date;
    save();
    return d;
  }
  /** 今天之前最後一天不是昨天＝連勝已中斷（只用於顯示） */
  function liveStreak(today, yesterday) {
    var d = load().daily;
    if (d.last === today || d.last === yesterday) return d.streak;
    return 0;
  }

  /* ---------- 戰績 ---------- */
  function record(o) {
    /* o: { kind, tier, won, guesses } — 只計「玩家自己猜」的局 */
    var s = load().stats;
    s.games++;
    if (o.won) {
      s.wins++;
      s.sumGuess += o.guesses;
      if (!s.fastest || o.guesses < s.fastest) s.fastest = o.guesses;
      var b = String(Math.min(13, o.guesses));
      s.dist[b] = (s.dist[b] || 0) + 1;
    }
    var k = s.byKind[o.kind] || (s.byKind[o.kind] = { games: 0, wins: 0, sumGuess: 0, fastest: 0, dist: {} });
    k.games++;
    if (o.won) {
      k.wins++; k.sumGuess += o.guesses;
      if (!k.fastest || o.guesses < k.fastest) k.fastest = o.guesses;
      var kb = String(Math.min(13, o.guesses));
      k.dist[kb] = (k.dist[kb] || 0) + 1;
    }
    if (o.tier != null && o.tier >= 0) {
      var t = s.byTier[o.tier] || (s.byTier[o.tier] = { games: 0, wins: 0, best: 0 });
      t.games++; if (o.won) { t.wins++; if (!t.best || o.guesses < t.best) t.best = o.guesses; }
    }
    save();
  }

  /* 每個瀏覽器分頁一個祕密 id：斷線重連靠它認出同一個人 */
  function clientId() {
    var id = '';
    try { id = sessionStorage.getItem('guess-ab:cid') || ''; } catch (e) { id = ''; }
    if (!id) {
      id = 'c' + Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
      try { sessionStorage.setItem('guess-ab:cid', id); } catch (e) { /* 忽略 */ }
    }
    return id;
  }

  root.Store = {
    get: get, set: set, onChange: onChange, resetSettings: resetSettings, DEFAULTS: DEFAULTS, save: save,
    starsOf: starsOf, setStars: setStars, unlocked: unlocked, tierProgress: tierProgress,
    dailyDone: dailyDone, recordDaily: recordDaily, liveStreak: liveStreak, record: record, clientId: clientId,
    _reload: function () { data = null; return load(); }
  };
})(typeof self !== 'undefined' ? self : this);
