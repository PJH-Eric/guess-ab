# 美術資料格式（符號 SVG）

所有符號都是「純資料」的 JS 檔，放在 `public/js/art/`，瀏覽器以一般 `<script>` 載入。

```js
/* 檔頭註解：說明此包 */
(function (root) {
  'use strict';
  root.GuessArt.add('pack-food', {
    style: 'cute',                 // 'cute'＝可愛手繪；'real'＝寫實；'glyph'＝字形；'gem'＝寶石
    items: [
      { key: 'onigiri', n: ['飯糰', '饭团', 'Rice ball'], tone: 'cool', tag: 'triangle', color: '#ffffff',
        svg: '<path d="..." fill="#fff" stroke="#26405E" stroke-width="3"/>' },
      // …
    ]
  });
})(typeof self !== 'undefined' ? self : this);
```

規則：
- `svg` 是 `viewBox="0 0 100 100"` 內的內容（**不含** `<svg>` 外框），背景透明；主體佔約 8～92 的範圍，置中。
- 只用 `path / circle / ellipse / rect / polygon / polyline / line / g / defs / linearGradient / radialGradient / stop`。不得用 `<text>`、emoji、外部圖片、filter、mask、clipPath（clipPath 可用，但 id 必須帶前綴）。
- 漸層等 `id` 一律以 `<setId>-<key>-` 為前綴，例如 `id="pack-food-onigiri-g1"`，避免衝突。
- `n`：[繁中, 簡中, 英文] 名稱。
- `tone`：`warm` 或 `cool`（主色屬暖色系或冷色系），提示道具「屬性」會用到。
- `tag`：輪廓標籤（英文小寫，如 `round`、`tall`、`triangle`），**同一包內不可重複**。
- `color`：主色 hex，**同一包內兩兩差異要明顯**。
- 可愛風（cute）：深海藍 `#26405E` 描邊約 3、圓潤、柔和漸層、一塊白色高光，**不畫卡通臉**以外的雜訊（食物、物品不要畫臉；動物可以有眼睛）。
- 寫實風（real）：參考真實物品的形狀、比例與配色，用漸層與陰影做立體感，邊線用同色系的深色細線（約 1～1.5），不要卡通臉。國旗依官方比例、配色，旗面置中（約 90×60）並加極淡的外框，避免白色旗面消失。
- 必須在 40px 大小下仍可清楚辨認；同包任兩個都不能相似（輪廓與主色都要不同）。
- 檔案用 UTF-8（無 BOM）。

檢查工具：`node scripts/art-sheet.cjs <setId> [<setId>...]` 會在 `tmp/art-<setId>.png` 產生 64px 與 36px 兩種尺寸的對照表，請打開圖片檢查。
