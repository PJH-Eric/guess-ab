# 把巡檢截圖拼成總覽圖（開發用）：python3 scripts/sheet.py tmp/audit/r1 zh-Hant phone → tmp/audit/r1/_sheet-zh-Hant-phone.png
import sys, glob, os
from PIL import Image
d, lang, view = sys.argv[1], sys.argv[2], sys.argv[3]
files = sorted(glob.glob(os.path.join(d, f'{lang}-{view}-*.png')))
ims = [Image.open(f) for f in files]
w, h = ims[0].size
scale = min(1.0, 1800 / (w * min(len(ims), 6)))
tw, th = int(w * scale), int(h * scale)
cols = min(len(ims), 6 if w < 900 else 4)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (tw + 6), rows * (th + 6)), 'white')
for i, im in enumerate(ims):
    sheet.paste(im.resize((tw, th)), ((i % cols) * (tw + 6), (i // cols) * (th + 6)))
out = os.path.join(d, f'_sheet-{lang}-{view}.png')
sheet.save(out)
print(out, [os.path.basename(f).split('-')[-1][:-4] for f in files])
