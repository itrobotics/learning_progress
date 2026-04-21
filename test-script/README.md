# MPM 自動化測試 — 執行說明

## 環境需求
- Python 3.9+
- Chrome / Chromium

## 安裝

```bash
pip install -r requirements.txt
playwright install chromium
```

## 執行方式

### 全部測試（有頭模式，可看瀏覽器操作）
```bash
pytest test_mpm.py -v --headed
```

### 全部測試（無頭模式，速度更快）
```bash
pytest test_mpm.py -v
```

### 只跑特定模組
```bash
# 只跑搜尋篩選
pytest test_mpm.py::TestSearchFilter -v --headed

# 只跑今日進度確認
pytest test_mpm.py::TestConfirmProgress -v --headed

# 只跑 K 值判斷
pytest test_mpm.py::TestKValueJudgement -v --headed
```

### 只跑特定 TC
```bash
pytest test_mpm.py -k "TC35" -v --headed
```

### 產出 HTML 報告
```bash
pip install pytest-html
pytest test_mpm.py -v --headed --html=report.html --self-contained-html
```

## 注意事項

1. **測試資料**：部分測試（TC32~TC40 今日進度確認）需要測試帳號中有 pending 進度，若無資料會自動 skip。

2. **不用還原資料**：儲值、確認進度等寫入操作不需回滾，測試設計上已避免影響正式學生。

3. **Selector 微調**：此腳本的 selector 採用 `role`、`text`、`placeholder` 等語意選擇器，具備一定容錯性。若某些測試因 React 組件 class name 不同而失敗，可用以下方式定位真實 selector：
   ```bash
   playwright codegen https://itrobotics.github.io/learning_progress/
   ```

4. **TC11 說明**：快取測試採觀察性驗證，若需精確驗證可搭配 `page.route()` 攔截網路請求計數。

## 測試架構

| 模組 | Class | TC 數量 |
|------|-------|---------|
| 搜尋篩選 | TestSearchFilter | 8 |
| 分校切換 | TestBranchSwitch | 5 |
| 新增學生 | TestAddStudent | 9 |
| 編輯學生 | TestEditStudent | 2 |
| 儲值時數 | TestAddHours | 7 |
| 今日進度確認 | TestConfirmProgress | 9 |
| 生成學習進度表 | TestGenerateSchedule | 7 |
| 書號學習矩陣 | TestBookMatrix | 5 |
| K 值判斷 | TestKValueJudgement | 3 |
| 書籍訂購模組 | TestBookOrderModule | 6 |
| 系統設定 | TestSystemSettings | 4 |
| 進度表載入 | TestScheduleLoading | 4 |
| **合計** | | **69 個自動化測試** |
