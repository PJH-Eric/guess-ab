# 密碼鎖 1A2B（guess-ab）

猜出 4 個符號的密碼！可以猜數字、英文字母、彩色寶石、可愛圖案（食衣住行育樂、水果、動物）與現實世界主題（國旗、太空、台灣小吃、世界地標），也能把 12 個主題包全部混在一起。

- 單機：我猜電腦、電腦猜我、和電腦互相出題、闖關（四難度各 100 關）、每日挑戰（台北時間切日、全球同題）
- 電腦：幼幼班／簡單／普通／困難四段（推理強度＋失誤率），任何字元集、項目數、可重複都能玩
- 線上：同題競速（2～6 人，可加電腦）、互相出題（2 人）、觀戰（上限 20 人）、邀請連結、聊天室（對局中觀戰頻道與玩家分開）
- 介面：繁體中文／简体中文／English，手機・平板・桌機直橫向，所有控制項與捲軸都是自訂元件
- 零依賴：伺服器只用 Node 內建模組（`lib/ws.js` 是自己寫的 WebSocket）

完整規格見 [規劃書.md](規劃書.md)。

## 本機執行

需要 Node.js 26.12.1 以上的 26.x。

```bash
npm start          # http://localhost:3100
```

Windows 可直接雙擊 `啟動遊戲.bat`。只想玩單機，也可以用任何靜態伺服器開 `public/`。

## 測試

```bash
npm test                 # 規則、電腦、規格表、關卡、美術資料、語系、房間邏輯＋線上端對端測試
npm run verify:levels    # 確認 400 關都能被困難電腦在上限內解出（約 40 秒）
```

## 產生資料（改了規則或電腦後才需要）

```bash
npm run gen:spec-table   # 各規格的平均步數 → public/js/core/spec-table.js（次數上限、三星門檻）
npm run gen:levels       # 400 關可解性驗證 → public/js/core/levels-meta.js
npm run gen:hans         # 從繁中字典轉出簡體 → public/js/locales-hans.js（需 pip install opencc-python-reimplemented）
```

## 部署（預設拓撲：GitHub Pages ＋ Render）

- 後端：Render Blueprint `render.yaml`（`region: singapore`、`/health`、`NODE_VERSION`）。
  服務環境變數：`GAME_ALLOWED_ORIGIN`＝GitHub Pages 網址（例 `https://pjh-eric.github.io`）。
- 前端：`.github/workflows/pages.yml` 在建置時把 repo Variable `GAME_SERVER_URL`（Render 的 HTTPS 網址）注入 `public/js/config.js`，再注入 GA4 與 SEO 後部署 `public/`。
- 首頁與單機不會連線；只有進入「跟別人玩」或打開邀請連結才喚醒伺服器。沒有 `/api/presence`。

本專案目前只在本機 commit，尚未建立 remote、也沒有部署。
