import { useEffect, useMemo, useState } from 'react'
import { formatDateForUI, formatDateTimeForUI, getDowZh, parseTwDateTimeToDate } from '../dateUtils'
import LearningMatrix from './LearningMatrix'
import {
  calcRealRemainingHours,
  getCurrentBook,
  getDepletionDate,
  getLastConfirmedDate,
  getNextPendingRow,
  getStudentOrderAlertGapK,
  getTotalLearnedHours,
  normalizeProgressStatus,
} from '../studentUtils'

function statusBadgeMeta(status) {
  const normalized = normalizeProgressStatus(status)

  if (normalized === 'match') {
    return { className: 'sb-match', label: '符合進度' }
  }
  if (normalized === 'behind') {
    return { className: 'sb-behind', label: '落後進度' }
  }
  if (normalized === 'ahead') {
    return { className: 'sb-ahead', label: '超前進度' }
  }
  if (normalized === 'pending') {
    return { className: 'sb-pending', label: '待確認' }
  }

  return { className: 'sb-pending', label: '未規劃' }
}

function studentStatusMeta(status) {
  if (status === 'danger') {
    return { className: 'badge-red', label: '緊急補充' }
  }
  if (status === 'warn') {
    return { className: 'badge-orange', label: '時數預警' }
  }
  return { className: 'badge-green', label: '正常' }
}

function StudentDetailPanel({
  selectedStudent,
  settings,
  bookOrderStateMap,
  matrixLevel,
  setMatrixLevel,
  matrixScope,
  setMatrixScope,
  syncLocked,
  syncMsg,
  onSyncMatrix,
  onMatrixCellClick,
  onOrderPrompt,
  onOpenSimulation,
  onOpenStudentManage,
  onConfirmRow,
  onUndoConfirmRow,
  onDeletePendingRow,
  onAdjustHours,
  scheduleLoading,
  onRefreshPanelData,
  panelRefreshing,
  panelRefreshMsg,
}) {
  const [schedulePage, setSchedulePage] = useState(1)
  const [confirmStatus, setConfirmStatus] = useState('')
  const [confirmNote, setConfirmNote] = useState('')
  const [confirmBooks, setConfirmBooks] = useState('')
  const [confirmHours, setConfirmHours] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [adjustHours, setAdjustHours] = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [adjustMsg, setAdjustMsg] = useState('')
  const [undoMsg, setUndoMsg] = useState('')
  const [actionLocked, setActionLocked] = useState(false)
  const [expandedScheduleRowKey, setExpandedScheduleRowKey] = useState('')

  const pageSize = Number(settings?.rowPerPage || 25)

  const orderedScheduleRows = useMemo(() => {
    const rows = (selectedStudent?.scheduleTable || []).map((row, index) => ({
      ...row,
      __originalIndex: index,
    }))

    rows.sort((a, b) => {
      const aDate = String(a.date || '').substring(0, 10)
      const bDate = String(b.date || '').substring(0, 10)
      if (aDate !== bDate) return aDate > bDate ? 1 : -1

      const aPending = normalizeProgressStatus(a.status) === 'pending'
      const bPending = normalizeProgressStatus(b.status) === 'pending'
      if (aPending !== bPending) return aPending ? -1 : 1
      if (aPending && bPending) return b.__originalIndex - a.__originalIndex
      return a.__originalIndex - b.__originalIndex
    })

    return rows
  }, [selectedStudent])

  const nextPendingRow = useMemo(() => {
    return selectedStudent ? getNextPendingRow(selectedStudent) : null
  }, [selectedStudent])

  const nextPendingBookText = useMemo(() => {
    const books = (nextPendingRow?.books || []).filter(Boolean)
    if (!books.length) return '無'
    return books.join('、')
  }, [nextPendingRow])

  useEffect(() => {
    setSchedulePage(1)
    setAdjustHours('')
    setAdjustNote('')
    setAdjustMsg('')
    setUndoMsg('')
    setActionLocked(false)
    setExpandedScheduleRowKey('')
  }, [selectedStudent?.id])

  const nextPendingSyncKey = useMemo(() => {
    if (!nextPendingRow) return ''
    return JSON.stringify({
      rowId: nextPendingRow.rowId || '',
      books: nextPendingRow.books || [],
      hours: Number(nextPendingRow.hours ?? 0),
      note: String(nextPendingRow.note || ''),
    })
  }, [nextPendingRow])

  useEffect(() => {
    if (!nextPendingRow) {
      setConfirmStatus('')
      setConfirmNote('')
      setConfirmBooks('')
      setConfirmHours('')
      setConfirmError('')
      return
    }

    setConfirmStatus('')
    setConfirmNote(String(nextPendingRow.note || ''))
    setConfirmBooks((nextPendingRow.books || []).join(', '))
    setConfirmHours(String(nextPendingRow.hours ?? ''))
    setConfirmError('')
  }, [nextPendingSyncKey])

  const totalPages = Math.max(1, Math.ceil(orderedScheduleRows.length / pageSize))
  const currentPage = Math.min(totalPages, Math.max(1, schedulePage))
  const pageRows = orderedScheduleRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  useEffect(() => {
    setExpandedScheduleRowKey('')
  }, [currentPage])

  if (!selectedStudent) {
    return (
      <div className="detail-card">
        <div className="empty-state">
          <div className="es-icon">👆</div>
          <div className="es-text">請從左側選擇學生以查看詳情</div>
        </div>
      </div>
    )
  }

  const badge = studentStatusMeta(selectedStudent.status)
  const depletionInfo = getDepletionDate(selectedStudent)
  const lastConfirmed = getLastConfirmedDate(selectedStudent)
  const schoolName =
    selectedStudent.school ||
    selectedStudent.elementarySchool ||
    selectedStudent.schoolName ||
    '未填'

  const weeklyScheduleItems = ['一', '二', '三', '四', '五', '六', '日']
    .map((day, index) =>
      Number(selectedStudent.schedule?.[index] || 0) > 0
        ? {
            key: `week-${day}`,
            label: `週${day} ${Number(selectedStudent.schedule[index])}hr`,
          }
        : null
    )
    .filter(Boolean)

  const depletionTooltip =
    '按照每週排課節奏，從今天開始一天一天扣剩餘時數，扣到 0（或以下）的那一天。'
  const depletionDateIso = /^\d{4}-\d{2}-\d{2}$/.test(depletionInfo) ? depletionInfo : ''
  const hasScheduleLoaded = !!selectedStudent.scheduleLoaded
  const showScheduleLoading = !!scheduleLoading || !hasScheduleLoaded

  async function handleConfirmSubmit() {
    if (actionLocked) return
    if (!nextPendingRow) return

    const books = confirmBooks
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean)

    const hours = Number(confirmHours)

    if (!confirmStatus) {
      setConfirmError('請先選擇學習狀態')
      return
    }

    if (!books.length) {
      setConfirmError('請填入至少一個書號')
      return
    }

    if (!Number.isFinite(hours) || hours < 0) {
      setConfirmError('請填入合法時數')
      return
    }

    if (confirmStatus === 'behind' && !confirmNote.trim()) {
      setConfirmError('落後進度時備註為必填')
      return
    }

    const nonInStockBooks = books.filter(
      (book) => (bookOrderStateMap?.[`${selectedStudent.id}__${book}`] || '') !== 'inStock'
    )

    if (nonInStockBooks.length) {
      const shouldForceInStock = window.confirm(
        `以下書號目前不是 inStock：\n${nonInStockBooks.join(', ')}\n\n是否要先自動改成 inStock，再執行確認進度？`
      )
      if (!shouldForceInStock) {
        return
      }
    }

    setConfirmError('')

    if (!onConfirmRow) return

    const result = await onConfirmRow({
      studentId: selectedStudent.id,
      rowId: nextPendingRow.rowId,
      rowIndex: selectedStudent.scheduleTable.findIndex((row) => row.rowId === nextPendingRow.rowId),
      status: confirmStatus,
      note: confirmNote.trim(),
      books,
      forceInStockBooks: nonInStockBooks,
      hours,
    })

    if (!result?.ok) {
      setConfirmError(result?.message || '確認失敗')
    }
  }

  async function handleAdjustHours() {
    if (actionLocked) return
    const deltaHours = Number(adjustHours)
    if (!Number.isInteger(deltaHours) || deltaHours <= 0) {
      setAdjustMsg('⚠ 請輸入大於 0 的整數時數')
      return
    }

    if (!onAdjustHours) return

    setAdjustMsg('⏳ 同步中…')
    const result = await onAdjustHours({
      studentId: selectedStudent.id,
      deltaHours,
      note: adjustNote.trim(),
    })

    if (result?.ok) {
      setAdjustMsg(`✅ 已調整 +${deltaHours}hr`)
      setAdjustHours('')
      setAdjustNote('')
      return
    }

    setAdjustMsg(`⚠ ${result?.message || '調整失敗'}`)
  }

  function getUndoMeta(row) {
    const rowId = String(row?.rowId || '').trim()
    if (!rowId) return { show: false, allowed: false, reason: '此列缺少 rowId，無法還原' }

    const status = normalizeProgressStatus(row?.status)
    const isConfirmed = status === 'match' || status === 'behind' || status === 'ahead'
    if (!isConfirmed) return { show: false, allowed: false, reason: '' }

    const raw = String(row?.confirmedAt || '').trim()
    if (!raw) return { show: true, allowed: false, reason: '缺少確認時間' }

    const parsed = parseTwDateTimeToDate(raw)
    if (parsed && !Number.isFinite(parsed.getTime())) {
      return { show: true, allowed: false, reason: '確認時間格式異常' }
    }

    return { show: true, allowed: true, reason: '' }
  }

  function getDeleteMeta(row) {
    const rowId = String(row?.rowId || '').trim()
    if (!rowId) return { show: false, allowed: false, reason: '此列缺少 rowId，無法刪除' }
    const status = normalizeProgressStatus(row?.status)
    if (status !== 'pending') return { show: false, allowed: false, reason: '' }
    return { show: true, allowed: true, reason: '' }
  }

  async function handleUndoConfirm(row) {
    if (actionLocked) return
    const meta = getUndoMeta(row)
    if (!meta.allowed) {
      setUndoMsg(`⚠ ${meta.reason || '此列無法還原'}`)
      return
    }
    if (!onUndoConfirmRow) return

    const ok = window.confirm('確定要還原成未確認嗎？\n此操作會把該列時數加回剩餘時數。')
    if (!ok) return

    setActionLocked(true)
    try {
      setUndoMsg('⏳ 還原中，請稍候…')
      const result = await onUndoConfirmRow({
        studentId: selectedStudent.id,
        rowId: row.rowId,
      })

      if (result?.ok) {
        setUndoMsg(`✅ ${result?.message || '已還原為未確認'}`)
        return
      }
      setUndoMsg(`⚠ ${result?.message || '還原失敗'}`)
    } finally {
      setActionLocked(false)
    }
  }

  async function handleDeletePending(row) {
    if (actionLocked) return
    const meta = getDeleteMeta(row)
    if (!meta.allowed) {
      setUndoMsg(`⚠ ${meta.reason || '此列無法刪除'}`)
      return
    }
    if (!onDeletePendingRow) return

    const ok = window.confirm('確定要刪除這筆待確認列嗎？\n此操作不會調整時數。')
    if (!ok) return

    setActionLocked(true)
    try {
      setUndoMsg('⏳ 刪除中，請稍候…')
      const result = await onDeletePendingRow({
        studentId: selectedStudent.id,
        rowId: row.rowId,
      })
      if (result?.ok) {
        setUndoMsg(`✅ ${result?.message || '已刪除待確認列'}`)
        return
      }
      setUndoMsg(`⚠ ${result?.message || '刪除失敗'}`)
    } finally {
      setActionLocked(false)
    }
  }

  return (
    <div className="detail-card">
      <div className="detail-header">
        <div>
          <div className="detail-title">
            {selectedStudent.name}
            <span className="detail-sub-inline">
              · {selectedStudent.grade}年級 · {selectedStudent.level}
            </span>
          </div>
          <div className="detail-sub">
            學生編號：{selectedStudent.id} ｜ 分校：{selectedStudent.branch} ｜ 國小：{schoolName}
            <br />
            速度：{selectedStudent.speed} 本/時 ｜ 每週時程：
            {weeklyScheduleItems.length ? (
              <span className="weekly-schedule-list">
                {weeklyScheduleItems.map((item, index) => (
                  <span key={item.key} className="weekly-schedule-token">
                    {index > 0 ? '、' : ''}
                    {item.label}
                  </span>
                ))}
              </span>
            ) : (
              '未設定'
            )}
            {String(selectedStudent.note || '').trim() ? (
              <>
                <br />
                備註：{String(selectedStudent.note || '').trim()}
              </>
            ) : null}
          </div>
        </div>

        <div className="detail-action-row">
          <button className="btn btn-outline btn-sm" onClick={() => onOpenStudentManage?.(selectedStudent)}>
            編輯學生
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => onOpenSimulation?.(selectedStudent)}>
            生成學習進度表
          </button>
        </div>
      </div>

      <div className="info-grid info-grid-extended">
        <div className="info-cell">
          <div className="ic-label">最新已確認書號</div>
          <div className="ic-value">{getCurrentBook(selectedStudent)}</div>
        </div>
        <div className="info-cell">
          <div className="ic-label">今日待確認書號（預計）</div>
          <div className="ic-value small">{nextPendingBookText}</div>
        </div>
        <div className="info-cell">
          <div className="ic-label">剩餘學習時數</div>
          <div className="ic-value">{calcRealRemainingHours(selectedStudent)} hr</div>
        </div>
        <div className="info-cell">
          <div className="ic-label">已購時數</div>
          <div className="ic-value">{Number(selectedStudent.initHours || 0)} hr</div>
        </div>
        <div className="info-cell">
          <div className="ic-label">總學習時數</div>
          <div className="ic-value">{getTotalLearnedHours(selectedStudent)} hr</div>
        </div>
        <div className="info-cell">
          <div className="ic-label" title={depletionTooltip}>
            預計耗盡日 ⓘ
          </div>
          <div className="ic-value small depletion-date-text" title={depletionTooltip}>
            {depletionInfo}
          </div>
        </div>
        <div className="info-cell">
          <div className="ic-label">時數狀況</div>
          <div className="ic-value">
            <span className={`badge ${badge.className}`}>{badge.label}</span>
          </div>
        </div>
        <div className="info-cell">
          <div className="ic-label">學習矩陣-訂購預警窗口 K</div>
          <div className="ic-value">{getStudentOrderAlertGapK(selectedStudent, settings)}</div>
        </div>
        <div className="info-cell">
          <div className="ic-label">需要套書</div>
          <div className="ic-value small schedule-hint-text">
            {showScheduleLoading
              ? '載入進度表中…'
              : selectedStudent.bookAlertSetRanges?.length
                ? selectedStudent.bookAlertSetRanges.join('、')
                : '無'}
          </div>
        </div>
      </div>

      <div className="inline-toolbar">
        <span className="inline-toolbar-label">💰 儲值時數</span>
        <input
          className="inline-input small"
          type="number"
          min="0"
          step="1"
          placeholder="時數"
          value={adjustHours}
          onChange={(e) => setAdjustHours(e.target.value)}
        />
        <input
          className="inline-input"
          type="text"
          placeholder="備註（可空）"
          value={adjustNote}
          onChange={(e) => setAdjustNote(e.target.value)}
        />
        <button className="btn btn-outline btn-sm" disabled={actionLocked} onClick={handleAdjustHours}>
          調整時數
        </button>
        <span className="inline-msg">{adjustMsg}</span>
      </div>

      <section className="detail-section">
        <div className="section-header">
          <div>
            <div className="section-title">📋 今日進度確認</div>
            <div className="section-sub">
              上次確認：{lastConfirmed ? formatDateTimeForUI(lastConfirmed) : '尚無紀錄'}
            </div>
          </div>
        </div>

        {showScheduleLoading ? (
          <div className="empty-block">
            <div className="es-text">載入進度表中…</div>
          </div>
        ) : !nextPendingRow ? (
          <div className="empty-block">
            <div className="es-text">目前沒有待確認的進度列。</div>
          </div>
        ) : (
          <>
            <div className="pending-row-card">
              <div className="pending-meta-grid">
                <div className="meta-item">
                  <div className="meta-label">日期</div>
                  <div className="meta-value">
                    {formatDateForUI(nextPendingRow.date)}（星期
                    {getDowZh(nextPendingRow.date, nextPendingRow.dow)}）
                  </div>
                </div>
                <div className="meta-item">
                  <div className="meta-label">實際時數</div>
                  <div className="meta-value">
                    <input
                      className="inline-input tiny"
                      type="number"
                      min="0"
                      step="0.5"
                      value={confirmHours}
                      onChange={(e) => setConfirmHours(e.target.value)}
                    />{' '}
                    hr
                  </div>
                </div>
              </div>

              <div className="pending-books-block">
                <div className="meta-label">實際書號</div>
                <input
                  className="inline-input full"
                  type="text"
                  value={confirmBooks}
                  onChange={(e) => setConfirmBooks(e.target.value)}
                  placeholder="例：GK303, GK304"
                />
                <div className="pending-original-books">
                  推演原值：
                  {(nextPendingRow.books || []).map((book) => (
                    <span className="book-tag" key={`${nextPendingRow.rowId}-${book}`}>
                      {book}
                    </span>
                  ))}
                </div>
              </div>

              <div className="radio-group">
                <span className="radio-group-label">學習狀態：</span>
                <label className="radio-label">
                  <input
                    type="radio"
                    name={`confirm_${selectedStudent.id}`}
                    value="match"
                    checked={confirmStatus === 'match'}
                    onChange={(e) => setConfirmStatus(e.target.value)}
                  />
                  符合進度
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name={`confirm_${selectedStudent.id}`}
                    value="behind"
                    checked={confirmStatus === 'behind'}
                    onChange={(e) => setConfirmStatus(e.target.value)}
                  />
                  落後進度
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name={`confirm_${selectedStudent.id}`}
                    value="ahead"
                    checked={confirmStatus === 'ahead'}
                    onChange={(e) => setConfirmStatus(e.target.value)}
                  />
                  超前進度
                </label>
              </div>

              <div className="note-row">
                <span className="note-label">備註：</span>
                <input
                  className={`note-input ${
                    confirmStatus === 'behind' && !confirmNote.trim() ? 'required-err' : ''
                  }`}
                  type="text"
                  placeholder="（落後時必填）"
                  value={confirmNote}
                  onChange={(e) => setConfirmNote(e.target.value)}
                />
              </div>

              {confirmStatus === 'behind' ? (
                <div className={`note-hint ${!confirmNote.trim() ? 'show' : ''}`}>
                  提示：落後進度時，備註為必填。
                </div>
              ) : null}

              {confirmError ? <div className="form-error">{confirmError}</div> : null}

              <div className="confirm-action-row">
                <button className="btn btn-success" disabled={actionLocked} onClick={handleConfirmSubmit}>
                  ✅ 確認
                </button>
                <button
                  className="btn btn-outline"
                  disabled={actionLocked || !nextPendingRow?.rowId}
                  onClick={() => handleDeletePending(nextPendingRow)}
                >
                  🗑 刪除此列
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="detail-section">
        <div className="section-header">
          <div>
            <div className="section-title">📅 學習進度表（全覽）</div>
            <div className="section-sub">
              {orderedScheduleRows.length} 筆（第 {currentPage}/{totalPages} 頁）
            </div>
          </div>

          <div className="pager-row">
            <button
              className="btn btn-outline btn-sm"
              disabled={!!panelRefreshing || actionLocked}
              onClick={() => onRefreshPanelData?.(selectedStudent.id)}
            >
              {panelRefreshing ? '更新中…' : '更新'}
            </button>
            <button
              className="btn btn-outline btn-sm"
              disabled={actionLocked || currentPage <= 1}
              onClick={() => setSchedulePage((prev) => Math.max(1, prev - 1))}
            >
              上一頁
            </button>
            <button
              className="btn btn-outline btn-sm"
              disabled={actionLocked || currentPage >= totalPages}
              onClick={() => setSchedulePage((prev) => Math.min(totalPages, prev + 1))}
            >
              下一頁
            </button>
          </div>
        </div>

        {panelRefreshMsg ? <div className="section-sub">{panelRefreshMsg}</div> : null}
        {undoMsg ? <div className="section-sub">{undoMsg}</div> : null}

        {showScheduleLoading ? (
          <div className="empty-block">
            <div className="es-text">載入進度表中…</div>
          </div>
        ) : !orderedScheduleRows.length ? (
          <div className="empty-block">
            <div className="es-text">尚無進度表資料。</div>
          </div>
        ) : (
          <>
            <div className="schedule-mobile-list">
              {pageRows.map((row) => {
                const statusMeta = statusBadgeMeta(row.status)
                const rowDate = String(row.date || '').substring(0, 10)
                const isDepletionRow = !!depletionDateIso && rowDate === depletionDateIso
                const isAfterDepletionRow = !!depletionDateIso && rowDate > depletionDateIso
                const rowClassName = [
                  isDepletionRow ? 'depletion-row' : '',
                  isAfterDepletionRow ? 'post-depletion-row' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                const rowKey = row.rowId || `${row.date}-${row.__originalIndex}`
                const expanded = expandedScheduleRowKey === rowKey

                return (
                  <div key={rowKey} className={`schedule-mobile-card ${rowClassName}`.trim()}>
                    <button
                      className="schedule-mobile-summary"
                      onClick={() => setExpandedScheduleRowKey(expanded ? '' : rowKey)}
                    >
                      <div className="schedule-mobile-summary-main">
                        <div className="schedule-mobile-date">
                          {formatDateForUI(row.date)}（星期{getDowZh(row.date, row.dow)}）
                        </div>
                        <div className="schedule-mobile-hours">{row.hours}hr</div>
                      </div>
                      <div className="schedule-mobile-summary-side">
                        <span className={`status-badge ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
                        <span className="schedule-mobile-expand-icon">{expanded ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {expanded ? (
                      <div className="schedule-mobile-detail">
                        <div className="schedule-mobile-field">
                          <div className="schedule-mobile-field-label">預計書號</div>
                          <div className="schedule-mobile-field-value">
                            {(row.books || []).length ? (
                              (row.books || []).map((book) => (
                                <span className="book-tag" key={`${row.rowId}-${book}`}>
                                  {book}
                                </span>
                              ))
                            ) : (
                              '—'
                            )}
                          </div>
                        </div>

                        <div className="schedule-mobile-field">
                          <div className="schedule-mobile-field-label">備註</div>
                          <div className="schedule-mobile-field-value">{row.note || '—'}</div>
                        </div>

                        <div className="schedule-mobile-field">
                          <div className="schedule-mobile-field-label">確認時間</div>
                          <div className="schedule-mobile-field-value">
                            {formatDateTimeForUI(row.confirmedAt)}
                          </div>
                        </div>

                        {getDeleteMeta(row).show ? (
                          <div className="schedule-mobile-field">
                            <div className="schedule-mobile-field-label">操作</div>
                            <div className="schedule-mobile-field-value">
                              <button
                                className="btn btn-outline btn-sm"
                                disabled={actionLocked || !getDeleteMeta(row).allowed}
                                title={getDeleteMeta(row).reason || ''}
                                onClick={() => handleDeletePending(row)}
                              >
                                刪除待確認列
                              </button>
                            </div>
                          </div>
                        ) : getUndoMeta(row).show ? (
                          <div className="schedule-mobile-field">
                            <div className="schedule-mobile-field-label">操作</div>
                            <div className="schedule-mobile-field-value">
                              <button
                                className="btn btn-outline btn-sm"
                                disabled={actionLocked || !getUndoMeta(row).allowed}
                                title={getUndoMeta(row).reason || ''}
                                onClick={() => handleUndoConfirm(row)}
                              >
                                還原成未確認
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>

            <div className="table-wrap schedule-desktop-table">
              <table className="sched-table">
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>星期</th>
                    <th>時數</th>
                    <th>預計書號</th>
                    <th>學習狀態</th>
                    <th>備註</th>
                    <th>確認時間</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => {
                    const statusMeta = statusBadgeMeta(row.status)
                    const rowDate = String(row.date || '').substring(0, 10)
                    const isDepletionRow = !!depletionDateIso && rowDate === depletionDateIso
                    const isAfterDepletionRow = !!depletionDateIso && rowDate > depletionDateIso
                    const rowClassName = [
                      isDepletionRow ? 'depletion-row' : '',
                      isAfterDepletionRow ? 'post-depletion-row' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')

                    return (
                      <tr key={row.rowId || `${row.date}-${row.__originalIndex}`} className={rowClassName}>
                        <td>{formatDateForUI(row.date)}</td>
                        <td>星期{getDowZh(row.date, row.dow)}</td>
                        <td>{row.hours}hr</td>
                        <td>
                          {(row.books || []).length ? (
                            (row.books || []).map((book) => (
                              <span className="book-tag" key={`${row.rowId}-${book}`}>
                                {book}
                              </span>
                            ))
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <span className={`status-badge ${statusMeta.className}`}>
                            {statusMeta.label}
                          </span>
                        </td>
                        <td>{row.note || '—'}</td>
                        <td>{formatDateTimeForUI(row.confirmedAt)}</td>
                        <td>
                          {getDeleteMeta(row).show ? (
                            <button
                              className="btn btn-outline btn-sm"
                              disabled={actionLocked || !getDeleteMeta(row).allowed}
                              title={getDeleteMeta(row).reason || ''}
                              onClick={() => handleDeletePending(row)}
                            >
                              刪除
                            </button>
                          ) : getUndoMeta(row).show ? (
                            <button
                              className="btn btn-outline btn-sm"
                              disabled={actionLocked || !getUndoMeta(row).allowed}
                              title={getUndoMeta(row).reason || ''}
                              onClick={() => handleUndoConfirm(row)}
                            >
                              還原
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {showScheduleLoading ? (
        <section className="detail-section">
          <div className="empty-block">
            <div className="es-text">載入學習矩陣中…</div>
          </div>
        </section>
      ) : (
        <LearningMatrix
          student={selectedStudent}
          settings={settings}
          matrixLevel={matrixLevel}
          setMatrixLevel={setMatrixLevel}
          matrixScope={matrixScope}
          setMatrixScope={setMatrixScope}
          bookOrderStateMap={bookOrderStateMap}
          syncLocked={syncLocked}
          syncMsg={syncMsg}
          onSync={() => onSyncMatrix?.(selectedStudent.id)}
          onCellClick={(level, grade, no) => onMatrixCellClick?.(selectedStudent.id, level, grade, no)}
          onOrderPrompt={(context) => onOrderPrompt?.(selectedStudent.id, context)}
        />
      )}
    </div>
  )
}

export default StudentDetailPanel