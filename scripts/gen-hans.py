# ===== scripts/gen-hans.py — 從繁體字典轉出簡體字典 public/js/locales-hans.js =====
# 需要：pip install opencc-python-reimplemented
# 用法：python3 scripts/gen-hans.py
import json, subprocess, pathlib, opencc
root = pathlib.Path(__file__).resolve().parent.parent
src = subprocess.check_output(['node', '-e', '''
global.self = global; global.I18N = { add(){} };
require('./public/js/locales.js');
process.stdout.write(JSON.stringify(self.LOCALE_HANT));
'''], cwd=root)
hant = json.loads(src)
cc = opencc.OpenCC('t2s')
# 少數用詞依大陸習慣調整
FIX = {'连结': '链接', '伺服器': '服务器', '萤幕': '屏幕', '滑鼠': '鼠标', '预设': '默认', '游戏大厅': '游戏大厅'}
out = {}
for k, v in hant.items():
    s = cc.convert(v)
    for a, b in FIX.items():
        s = s.replace(a, b)
    out[k] = s
body = ('/* ===== locales-hans.js — 由 scripts/gen-hans.py 從繁體自動轉出，請勿手改 ===== */\n'
        '(function (root) {\n  \'use strict\';\n  root.I18N.add(\'zh-Hans\', ' + json.dumps(out, ensure_ascii=False, indent=0) + ');\n'
        '})(typeof self !== \'undefined\' ? self : this);\n')
(root / 'public/js/locales-hans.js').write_text(body, encoding='utf-8')
print('已轉出 %d 條簡體字串' % len(out))
