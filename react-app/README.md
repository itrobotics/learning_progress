# 艾思－學習進度管理系統
 
此專案使用 **React + Vite** 開發，並支援部署到 **GitHub Pages**。

## 專案位置

- GitHub Repo: `https://github.com/itrobotics/learning_progress.git`
- 預期 GitHub Pages 網址：
  - `https://itrobotics.github.io/learning_progress/`

---

## 本機開發

### 安裝套件

```bash
npm install
```

### 啟動開發模式

```bash
npm run dev
```

### 建置正式版

```bash
npm run build
```

---

## 版本管理方式

此專案的發布版本建議用以下 2 種資訊判讀：

- `package.json` 的 `version`
- 畫面右下角顯示的 `Build Time`

例如：

- `v0.1.0 / Build: 2026/04/17 09:20`

### 建議流程

每次準備發布前：

1. 修改 `package.json` 的 `version`
2. commit 原始碼
3. push 到 `main`
4. GitHub Actions 自動 build 並部署到 GitHub Pages

---

## 為什麼 `dist/assets/index-xxxx.js` 每次都不同

Vite 會在 build 時產生帶有 hash 的檔名，例如：

- `index-CrW1AITy.js`

這是正常機制，用途是：

- 避免瀏覽器快取舊版檔案
- 確保部署後載入新版內容

只要 build 內容改變，檔名就會改變。  
這不是人工版本號，不需要手動管理。

---

## GitHub Pages 部署方式

此專案已加入 GitHub Actions workflow：

- `.github/workflows/deploy-learning-progress.yml`

用途：

- 當 `main` branch 有新的 push
- 自動安裝套件
- 自動 build
- 自動部署到 GitHub Pages

### Workflow 重要設定

建置時會帶入：

```bash
VITE_BASE=/learning_progress/
```

這是因為 GitHub Pages 使用的是 project site 路徑：

- `/learning_progress/`

若沒有正確設定 base，靜態資源路徑可能會錯。

---

## GitHub Pages 啟用方式

請到 GitHub Repo：

- `Settings`
- `Pages`

確認來源為：

- **GitHub Actions**

不是選 branch，不是手動上傳 `dist`。

---

## 靜態資源路徑注意事項

GitHub Pages 使用 project path 時，不可直接假設網站掛在 `/` 根目錄。

本專案已修正：

- favicon 使用 `%BASE_URL%`
- navbar logo 使用 `import.meta.env.BASE_URL`

如果之後新增圖片、圖示或其他 public 資源，建議遵循相同原則。

### 建議寫法

#### 在 `index.html`

```html
html<link rel="icon" href="%BASE_URL%ais-logo.png" />
```

#### 在 React 元件

```javascript
const logoSrc = `${import.meta.env.BASE_URL}ais-logo.png`
```

---

## 發布檢查清單

發布前建議確認：

- `package.json` 的 `version` 已更新
- `npm run build` 成功
- 畫面右下角版本與 build time 正常顯示
- logo / favicon 在 GitHub Pages 子路徑下能正常載入
- push 到 `main` 後 GitHub Actions 執行成功

---

## 備註

- `dist/` 是 build 產物，不是主要開發來源
- 平常應以原始碼做版本控制
- GitHub Pages 看到的是 build 後結果，不是手動管理 hash 檔名