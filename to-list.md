# TODO List（pending 還原問題）

## 目標
- 修正「還原後未回到 pending」問題，確保流程：
  1. status 變成 pending
  2. remaining hours 先加回
  3. 回到原本 pending 的運作邏輯

## 已完成（今天）
- [x] GAS 新增 `undoConfirmProgress` action 與流程
- [x] undo 邏輯包含：status -> pending、confirmedAt 清空、remaining hours 回補
- [x] 前端新增還原按鈕與操作流程
- [x] 前端加入 7 天限制與基本防呆
- [x] build 驗證通過
- [x] GAS Sheet ID 已改為：`1tpqECd9DbeRB8f_a_BuRv6SjXZzHpQY7WI7v3K9VJWo`

## 待完成（明天）
- [ ] 確認 GAS Web App 是否為最新部署版本（不是只存檔）
- [ ] 驗證目前 `config.json` 的 scriptUrl 對應到正確部署
- [ ] 直接測試 `undoConfirmProgress` 回傳是否包含 `newStatus: "pending"`
- [ ] 若未回傳 pending：重新 Deploy 新版並再次驗證
- [ ] 前端加強診斷訊息（顯示 rowId、後端回傳 newStatus、錯誤來源）
- [ ] 完整回歸測試：
  - [ ] 還原後該列顯示 pending
  - [ ] remaining hours 有加回
  - [ ] 待確認區可再次操作該列

## 驗收標準
- [ ] 按下「還原」後，該列在 UI 與 Sheet 都是 `pending`
- [ ] `confirmedAt` 已清空
- [ ] remaining hours 正確回補
- [ ] 重新整理頁面後仍維持正確狀態
