/* 數字重複局：點按／實體鍵盤、剩餘次數、刪除、回填與其他種類隔離。
 * 執行中的伺服器 npm start；需要開發環境的 playwright。
 */
'use strict';
const { chromium } = require('playwright');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:3100/';
const out = path.join(__dirname, '..', 'tmp', 'repeat-digits');
const views = [['phone', 390, 844], ['phoneS', 360, 640], ['phoneL', 844, 390], ['tabP', 820, 1180], ['tabL', 1180, 820], ['desk', 1440, 900]];

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage({ viewport: { width: 1180, height: 820 } });
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.goto(BASE);
    await p.waitForFunction(() => window.Solo && window.GameView && GameView.cfg === null);
    await p.evaluate(() => { Store.set('autoSubmit', false); Store.set('musicOn', false); Store.set('sfxOn', false); });
    const start = cs => p.evaluate(cs => {
      const spec = GuessCore.makeSpec({ cs, rep: true, pool: [2, 5, 7, 9], cnt: [3, 1, 1, 1] }, 'repeat-keyboard');
      Solo.start({ mode: 'guess', tier: 4, cs, spec });
    }, cs);
    const input = () => p.evaluate(() => GameView.input);
    const label = () => p.locator('#keys .key[data-i="0"] .key-remaining').textContent();
    const key = p.locator('#keys .key[data-i="0"]');

    await start('digits');
    assert.equal(await p.locator('#keys .key').count(), 4, '每個數字一顆鍵');
    assert.equal(await p.locator('#summary .pool .pool-sym').count(), 4, '項目池合併數字');
    assert.equal(await p.locator('#summary .pool-digit b').textContent(), '×3');
    assert.equal(await label(), '可用 3 次');
    await key.click();
    assert.equal(await label(), '剩 2 次');
    await p.keyboard.press('Digit2');
    await p.locator('body').dispatchEvent('keydown', { key: '2', code: 'Numpad2', bubbles: true });
    assert.deepStrictEqual(await input(), [0, 0, 0, null]);
    assert.equal(await key.isDisabled(), true);
    assert.equal(await label(), '已用完');
    await p.screenshot({ path: path.join(out, 'exhausted.png') });
    await p.keyboard.press('Digit2');
    assert.deepStrictEqual(await input(), [0, 0, 0, null], '超額按鍵不刪除輸入');
    await p.locator('#slots .wheel[data-s="1"] .wheel-win').click();
    assert.equal(await key.isDisabled(), false);
    assert.equal(await label(), '剩 1 次');
    await key.click();
    assert.equal(await key.isDisabled(), true);
    await p.keyboard.press('Backspace');
    assert.equal(await label(), '剩 1 次');
    await p.keyboard.press('Delete');
    assert.equal(await label(), '可用 3 次');
    await p.evaluate(() => GameView.recall([0, 0, 0, 1]));
    assert.equal(await key.isDisabled(), true, '歷史回填也套用上限');
    await p.keyboard.press('Delete');
    await key.click();
    await p.evaluate(() => I18N.setLang('en'));
    assert.deepStrictEqual(await input(), [0, null, null, null], '切換語言保留輸入');
    assert.equal(await label(), '2 left');
    assert.match(await key.getAttribute('aria-label'), /2 left/);
    await p.evaluate(() => I18N.setLang('zh-Hans'));
    assert.equal(await label(), '剩 2 次');
    await p.evaluate(() => I18N.setLang('zh-Hant'));

    await p.evaluate(() => {
      GameView.setup({ spec: Solo.active.spec, purpose: 'secret', onSubmit: code => { window.submittedCode = code; } });
      GameView.setInput(true);
      GameView.recall([0, 0, 0, 1]);
    });
    await p.locator('#k-submit').click();
    assert.deepStrictEqual(await p.evaluate(() => window.submittedCode), [0, 0, 0, 1], '出題使用相同輸入規則');
    assert.equal(await label(), '可用 3 次', '送出後恢復次數');
    assert.equal(await key.isDisabled(), false);
    await p.evaluate(() => GameView.setInput(false));
    await p.keyboard.press('Digit2');
    assert.deepStrictEqual(await input(), [null, null, null, null], '非自己的回合禁止輸入');

    for (const cs of ['letters', 'gems', 'pack-animal', 'mix']) {
      await start(cs);
      assert.equal(await p.locator('#keys .key-remaining').count(), 0, cs + ' 保留原鍵盤');
      assert.equal(await p.locator('#keys .key-max').textContent(), '×3');
      assert.equal(await p.locator('#summary .pool .pool-sym').count(), 6);
      assert.equal(await p.locator('#summary .pool-map-it').count(), 1);
      await p.evaluate(() => { GameView._press(0); GameView._press(0); GameView._press(0); });
      assert.equal(await key.isDisabled(), false, cs + ' 用完仍可點按刪除');
      assert.equal(await key.locator('.key-used').textContent(), '3/3');
      await key.click();
      assert.deepStrictEqual(await input(), [0, 0, null, null]);
    }
    await p.evaluate(() => Solo.start({ mode: 'classic' }));
    assert.equal(await p.locator('#keys .key-remaining').count(), 0);
    await key.click(); await key.click();
    assert.deepStrictEqual(await input(), [null, null, null, null], '經典數字保留點按刪除');

    await start('digits');
    await p.evaluate(() => Solo.active.secret.forEach(v => GameView._press(v)));
    await p.locator('#k-submit').click();
    await p.waitForFunction(() => Solo.active.over);
    await p.locator('#result-layer .btn.primary').click();
    await p.waitForFunction(() => Solo.active && !Solo.active.over);
    assert.deepStrictEqual(await input(), [null, null, null, null], '再來一局清空輸入');

    for (const lang of ['zh-Hant', 'en']) for (const [name, width, height] of views) {
      await p.setViewportSize({ width, height });
      await p.evaluate(lang => I18N.setLang(lang), lang);
      await start('digits');
      await p.evaluate(() => App.closeSide());
      await key.click();
      await p.waitForTimeout(200);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, name + ' 無水平溢出');
      assert.equal(await p.locator('#keys .key-remaining').evaluateAll(els => els.every(el => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().bottom <= el.parentElement.getBoundingClientRect().bottom)), true, name + ' 次數標籤完整');
      await p.screenshot({ path: path.join(out, lang + '-' + name + '.png') });
      await p.evaluate(() => { if (innerWidth < 900) App.openSide(); });
      await p.waitForTimeout(200);
      assert.equal(await p.locator('#summary .pool-digit').count(), 4);
      await p.screenshot({ path: path.join(out, lang + '-' + name + '-pool.png') });
      await p.evaluate(() => {
        App.closeSide();
        Solo.start({ mode: 'guess', tier: 4, cs: 'digits', spec: GuessCore.makeSpec({ cs: 'digits', rep: true, pool: [0, 1, 2, 3, 4, 5, 6, 7, 8], cnt: [2, 1, 1, 1, 1, 1, 1, 1, 1] }, 'many-keys') });
      });
      await p.waitForTimeout(200);
      await p.locator('#keys .key').last().scrollIntoViewIfNeeded();
      assert.equal(await p.locator('#keys .key-remaining').evaluateAll(els => els.every(el => el.scrollWidth <= el.clientWidth)), true, name + ' 多按鍵標籤完整');
      assert.equal(await p.locator('#k-submit').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight), true, name + ' 多按鍵保留送出按鈕');
      await p.screenshot({ path: path.join(out, lang + '-' + name + '-many.png') });
    }
    assert.deepStrictEqual(errors, []);
    console.log('✓ 數字重複局輸入、刪除、語系、回填、結算重開及其他種類隔離；12 組 RWD 與項目池截圖通過');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
