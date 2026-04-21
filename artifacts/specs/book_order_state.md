# `book_order_state` 規格（重整版）

## 1. 目的
定義「書籍訂購狀態」的資料邏輯與同步規則，確保前端 UI、`book_order_state` 分頁、學習進度判斷一致。

---

## 2. 資料邊界

### 2.1 `book_order_state` 分頁只管理
- `needOrder`
- `inStock`
- 空值 `''`（未標記）

### 2.2 不屬於 `book_order_state` 的狀態
- `planned / pending`
- `learned / match / behind / ahead`
- `none`

上述狀態屬於「學習進度表」語意，不寫入 `book_order_state`。

---

## 3. 套書規則
- 訂購以套為單位：**8 本 1 套**
- 套範圍：`No` 每 8 本分組（`1~8`, `9~16`, `17~24`, ...）

---

## 4. UI 操作規則

## 4.1 點單格（手動）
- 僅切換：`inStock <-> ''`
- 不直接由單格切成 `needOrder`
- `inStock` 代表人工確認庫存，優先保留

## 4.2 點「訂購此套」
- 針對該套合法書號，將空白/未標記改為 `needOrder`
- 若該格是 `inStock`，不得覆寫

---

## 5. K 判斷與自動清理（reconcile）

## 5.1 K 判斷用途
- 由學習進度（planned/pending 與 learned）計算「哪些套目前需要訂購」
- K 來源改為「**學生個別值優先，否則使用全域值**」
  - 全域：`setting.orderAlertGapK`
  - 個人：`學生設定.orderAlertGapKByPerson`
  - 規則：`orderAlertGapKByPerson > 0` 時優先；否則沿用全域 K

## 5.2 K 判斷的書號單位
- K 判斷以 **主書號** 為單位，不以 half token 數量為單位
- 例如：
  - `GK378` → 算 1 本
  - `GK378(1/2)` → 算 1 本
  - `GK378(2/2)` → 算 1 本
  - `GK378(1/2) + GK378(2/2)` → 仍算同 1 本
- 也就是：
  - K 看的是 **前 K 個 pending 的唯一主書號**
  - 不是看字串 token 數量

## 5.3 K window 形成規則
- 先決定 K window 起點基準 `maxLearnedNo`
- 規則如下：

### 5.3.1 起點優先順序
1. **優先使用目前使用書號**
   - 來源為學生目前正在使用的書號（例如由已確認進度推得的 `getCurrentBook(student)`）
   - 若可解析出主書號，則以該主書號的數字部分作為 `maxLearnedNo`
   - 例如：
     - `GV317` → `maxLearnedNo = 17`
     - `GV317(1/2)` → `maxLearnedNo = 17`
     - `GV317(2/2)` → `maxLearnedNo = 17`

2. **若目前使用書號無法解析**
   - fallback 回原本規則：
   - 取該 `level + grade` 下最後已學過的最大書號 `maxLearnedNo`

3. **若兩者都不存在**
   - 視同 `maxLearnedNo = 0`

### 5.3.2 K window 掃描方式
- 接著由 `maxLearnedNo + 1` 起，往後掃合法書號
- 掃描時只納入同時符合以下條件者：
  - 是合法書號
  - 尚未 learned
  - 屬於 `planned / pending`
- 掃到的這些「唯一主書號」中，取 **最多 K 個**，形成 K window

## 5.4 K window 三種情況
### A. K window 內一個 pending 都找不到
- 不出現提示

### B. K window 內找到的 pending 不足 K 個
- 仍要用「實際找到的這些 pending」做判斷
- 若這些 pending **全部都是 `inStock`**
  - 不提示
- 若其中 **任一個不是 `inStock`**
  - 提示訂購

### C. K window 內剛好找到滿 K 個 pending
- 這是一般情況
- 直接判斷這 K 個 pending 是否全部 `inStock`
- 若不是全部 `inStock`
  - 提示訂購

## 5.5 訂購提示判斷
- K window 不為空時，將其中書號依「每 8 本一套」映射到套書
- 若某套中有任一格不是 `inStock`
  - 顯示「須要訂購此套」
- 若 K window 內所有格都已 `inStock`
  - 不顯示提示

## 5.6 自動清理規則
- 若某套「現在不用買」，該套內原本 `needOrder` 需清成空值 `''`

## 5.7 不可自動改動
- `inStock` 僅可由人工點格改變
- reconcile 不可把 `inStock` 改掉

---

## 6. 同步模式（新版）

## 6.1 前端策略
- 採 **optimistic UI**：先改本地 UI
- 不再每次點格就立即送 Sheet
- 改由「同步學習矩陣狀態」按鈕，做 **整位學生全量同步**
- K 值顯示於學生詳情「時數狀況」後：
  - `訂購預警 K：{目前生效K}`

## 6.2 同步按鈕行為
- 按鈕名稱：**同步學習矩陣狀態**
- 按鈕位置：學習矩陣（Learning History）工具列旁
- 同步資料來源：**狀態索引掃描（bookOrderStateMap）**
- 同步資料：`entries = [{ bookCode, state }]`
- 同步語意：**upsert**
  - 有列就更新 state
  - 無列且 state 為 `needOrder/inStock` 就新增
  - 有列且 UI 為空值 `''` 就清空該列 state
- 組裝方式：
  - 直接掃 `bookOrderStateMap` 中該學生所有 key
  - `needOrder/inStock` 一律送出
  - 曾存在於 Sheet 但本地已清空者，送出 `state=''` 清理

## 6.3 同步期間鎖定
- 在 API 返回前，以下元件一律 disabled：
- 「同步學習矩陣狀態」按鈕
- 學習矩陣格子（不可點）
- 「訂購此套」按鈕
- 返回後才恢復 enabled（成功/失敗都要解鎖）

## 6.4 「設定/推演進度」K 設定
- 在基本設定新增欄位：`訂購預警 K`
- 輸入限制：最小值 `2`
- 預設值：
  - 若學生已有 `orderAlertGapKByPerson`，顯示該值
  - 否則使用 `setting.orderAlertGapK`（系統內部初值）
- 互動流程：
  - `套用設定`：只更新本地生效參數（不直接推演）
  - `執行推演`：以目前生效參數產生推演結果
- 儲存「學習進度表」時，會一併回寫 `學生設定.orderAlertGapKByPerson`

---

## 7. 後端 `saveBookOrderStates` 規則

對每筆 `{ studentId, bookCode, state }`：

1. `bookCode` 正規化為大寫  
2. 若 `state` 非 `needOrder/inStock`，視為空值 `''`  
3. 以 `(studentId, bookCode)` 找既有列  
   - 找到：更新 `state/updatedAt/updatedBy`
   - 找不到且 `state` 為 `needOrder/inStock`：**新增新列**（append）後寫入狀態
   - 找不到且 `state` 為空值 `''`：不新增空白列
4. 回傳同步摘要：
   - `inserted`, `updated`
   - `insertedCodes[]`, `updatedCodes[]`

---

## 8. 一致性預期（驗收）

1. 按「訂購此套」後，空白格可變 `needOrder`（先反映在 UI）
2. 按「同步學習矩陣狀態」後，`book_order_state` 與該學生 UI 現值一致（以 `bookOrderStateMap` 該學生 key 為準）
3. 若 `book_order_state` 無該書號，且 state 為 `needOrder/inStock`，必須新增列
4. 若 UI 為空值 `''` 且 Sheet 已有該書號，需更新為空值 `''`（不刪列）
5. 若某套不用買，該套舊 `needOrder` 會被清空
6. `inStock` 不會被 K/reconcile 自動覆寫
7. 同步期間格子與按鈕會 disabled，返回後恢復
8. K 判斷符合「個人優先、全域後備」規則
9. K 判斷以「唯一主書號」為單位，half 不可重複算本數
10. K window 起點符合：
   - 優先以「目前使用書號」作為 `maxLearnedNo`
   - 若目前使用書號無法解析，才 fallback 到最後已學過書號
11. K window 規則符合：
   - `window = 0` → 不提示
   - `0 < window < K` → 用實際找到的 pending 判斷是否都 `inStock`
   - `window = K` → 一般情況照常判斷
12. 在「設定/推演進度」可調整 K（最小值2），且可持久化到學生設定
13. 「套用設定」與「執行推演」為分離流程；未套用時可執行推演（使用目前生效值）
