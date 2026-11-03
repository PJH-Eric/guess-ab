/* ===== ai-worker.js — 在背景執行緒跑電腦推理，大空間計算也不會卡住畫面 ===== */
/* global importScripts, GuessCore, GuessAI */
'use strict';
importScripts('core/core.js', 'core/ai.js');
self.onmessage = function (e) {
  var m = e.data || {};
  try {
    var ai = GuessAI.createAI({ level: m.level, n: m.n, rep: m.rep, rng: GuessCore.rngFrom(m.seed + ':' + (m.history || []).length) });
    self.postMessage({ id: m.id, guess: ai.next(m.history || []) });
  } catch (err) {
    self.postMessage({ id: m.id, error: String(err && err.message || err) });
  }
};
