import { useEffect, useMemo, useState } from 'react'
import { TODAY } from '../constants'
import { formatBookTokenLabel, getMPMBooks } from '../bookUtils'

function cloneSimRows(rows) {
  return (rows || []).map((row) => ({
    ...row,
    books: (row.books || []).map((book) =>
      book && typeof book === 'object' ? { ...book } : book
    ),
  }))
}

function addDaysToIsoDate(baseIso, days) {
  const date = new Date(`${baseIso}T00:00:00`)
  date.setDate(date.getDate() + Number(days || 0))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`
}

function simulate(level, grade, startNo, schedule, speed, startDateStr, remainingHours, endDateStr) {
  const allBooks = getMPMBooks(level, grade)
  const startBook = `${level}${grade}${String(startNo).padStart(2, '0')}`
  let idx = allBooks.indexOf(startBook)
  if (idx === -1) return { error: '找不到起始書號' }

  const startDate = new Date(startDateStr)
  const endDate = endDateStr ? new Date(endDateStr) : null

  let currentDate = new Date(startDate)
  let balance = Number(remainingHours || 0)
  let bookProgress = 0
  const rows = []

  const MAX_ITER = 500
  let iter = 0

  while (idx < allBooks.length && iter++ < MAX_ITER) {
    if (endDate && currentDate > endDate) break

    const dow = currentDate.getDay()
    const schedIdx = dow === 0 ? 6 : dow - 1
    const hoursToday = Number(schedule[schedIdx] || 0)

    if (hoursToday > 0) {
      const booksToday = []
      let temp = hoursToday * Number(speed || 1)

      while (temp > 0 && idx < allBooks.length) {
        const book = allBooks[idx]
        if (bookProgress === 0.5) {
          if (temp >= 0.5) {
            booksToday.push({ book, half: '2/2' })
            idx += 1
            temp -= 0.5
            bookProgress = 0
          } else {
            break
          }
        } else if (temp >= 1) {
          booksToday.push({ book, half: null })
          idx += 1
          temp -= 1
        } else if (Math.abs(temp - 0.5) < 0.001) {
          booksToday.push({ book, half: '1/2' })
          bookProgress = 0.5
          temp = 0
        } else {
          break
        }
      }

      balance -= hoursToday

      const d = new Date(currentDate)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`

      rows.push({
        date: dateStr,
        dow: ['一', '二', '三', '四', '五', '六', '日'][schedIdx],
        hours: hoursToday,
        books: booksToday,
      })

      if (idx >= allBooks.length) break
    }

    currentDate.setDate(currentDate.getDate() + 1)
  }

  return { rows, balance }
}

function SimulationModal({
  open,
  student,
  onClose,
  onSaveSimulation,
}) {
  const [form, setForm] = useState(null)
  const [simResult, setSimResult] = useState(null)
  const [saveMsg, setSaveMsg] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !student) return

    const tomorrow = new Date(`${TODAY}T00:00:00`)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(tomorrow.getDate()).padStart(2, '0')}`

    const defaultEndDate = addDaysToIsoDate(tomorrowStr, 7)

    setForm({
      level: student.level,
      grade: Number(student.grade),
      startNo: Number(student.confirmedNo || 1),
      speed: Number(student.speed || 1),
      hours: Number(student.currentRemainingHours || student.confirmedHours || 0),
      orderAlertGapKByPerson: Number(student.orderAlertGapKByPerson || 0),
      startDate: tomorrowStr,
      endDate: defaultEndDate,
      schedule: (student.schedule || []).map((h) => Number(h || 0)),
    })
    setSimResult(null)
    setSaveMsg('')
    setSaving(false)
  }, [open, student?.id])

  const totalUsed = useMemo(() => {
    return (simResult?.rows || []).reduce((sum, row) => sum + Number(row.hours || 0), 0)
  }, [simResult])

  const resultRowsWithBalance = useMemo(() => {
    let remaining = Number(form?.hours || 0)
    return (simResult?.rows || []).map((row) => {
      remaining -= Number(row.hours || 0)
      return {
        ...row,
        remainingAfter: remaining,
      }
    })
  }, [simResult, form?.hours])

  if (!open || !student || !form) return null

  function updateField(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }

      const normalizedStartDate =
        key === 'startDate' || key === 'endDate'
          ? next.startDate && next.startDate < TODAY
            ? TODAY
            : next.startDate
          : next.startDate

      next.startDate = normalizedStartDate || TODAY

      if (key === 'startDate' && !String(prev.endDate || '').trim()) {
        next.endDate = addDaysToIsoDate(next.startDate, 7)
      }

      if (next.endDate && next.endDate < next.startDate) {
        next.endDate = next.startDate
      }

      return next
    })
  }

  function handleRequestClose() {
    if (saving) {
      window.alert('同步中，請等待完成後再關閉')
      return
    }

    onClose?.()
  }

  function updateSchedule(index, value) {
    setForm((prev) => {
      const nextSchedule = [...prev.schedule]
      nextSchedule[index] = Number(value || 0)
      return {
        ...prev,
        schedule: nextSchedule,
      }
    })
  }

  function handleRunSimulation() {
    const result = simulate(
      form.level,
      Number(form.grade),
      Number(form.startNo),
      form.schedule,
      Number(form.speed),
      form.startDate,
      Number(form.hours),
      form.endDate
    )

    if (result.error) {
      setSimResult({ error: result.error, rows: [] })
      return
    }

    setSimResult({
      ...result,
      rows: cloneSimRows(result.rows || []),
    })
  }

  function deleteSimRow(index) {
    setSimResult((prev) => {
      if (!prev) return prev
      const nextRows = cloneSimRows(prev.rows || [])
      nextRows.splice(index, 1)
      return {
        ...prev,
        rows: nextRows,
      }
    })
  }

  async function handleSaveSimulation() {
    if (!simResult?.rows?.length || !onSaveSimulation) return
    setSaving(true)
    setSaveMsg('⏳ 儲存中…')
    const result = await onSaveSimulation(student.id, form, simResult.rows)
    if (result?.ok) {
      setSaveMsg('✅ 已套用設定並儲存為新的學習進度表')
      setSaving(false)
      onClose?.()
      return
    }

    setSaveMsg(`⚠ ${result?.message || '儲存失敗'}`)
    setSaving(false)
  }

  return (
    <div className="modal-overlay open">
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">📊 進度推演 / 調整</div>
            <div className="modal-subtitle">
              {student.name} · {student.grade}年級
            </div>
          </div>
          <button
            className="close-btn"
            title={saving ? '同步中，請等待完成後再關閉' : ''}
            onClick={handleRequestClose}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-form">
            <div className="section-title">個人化學習進度設定</div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Level</label>
                <select
                  className="form-control"
                  value={form.level}
                  onChange={(e) => updateField('level', e.target.value)}
                >
                  <option value="GK">GK</option>
                  <option value="GV">GV</option>
                  <option value="GA">GA</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">年級</label>
                <select
                  className="form-control"
                  value={form.grade}
                  onChange={(e) => updateField('grade', Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6].map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">起始書號 (No)</label>
                <input
                  className="form-control"
                  type="number"
                  min="1"
                  max="88"
                  value={form.startNo}
                  onChange={(e) => updateField('startNo', Number(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">速度 (本/時)</label>
                <select
                  className="form-control"
                  value={form.speed}
                  onChange={(e) => updateField('speed', Number(e.target.value))}
                >
                  <option value="0.5">0.5 本/時</option>
                  <option value="1">1 本/時</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">每週時程 (小時/天)</label>
              <div className="schedule-grid">
                {['一', '二', '三', '四', '五', '六', '日'].map((day, index) => (
                  <div className="day-input-wrap" key={day}>
                    <div className="day-label">{day}</div>
                    <input
                      className="day-input"
                      type="number"
                      min="0"
                      max="8"
                      value={form.schedule[index]}
                      onChange={(e) => updateSchedule(index, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="section-title modal-section-gap">時間設定</div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">起始日期</label>
                <input
                  className="form-control"
                  type="date"
                  min={TODAY}
                  value={form.startDate}
                  onChange={(e) => updateField('startDate', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">結束日期 (可空)</label>
                <input
                  className="form-control"
                  type="date"
                  min={form.startDate || TODAY}
                  value={form.endDate}
                  onChange={(e) => updateField('endDate', e.target.value)}
                />
              </div>
            </div>

            <div className="modal-run-bar">
              <button className="btn btn-outline modal-run-btn" onClick={handleRunSimulation}>
                ▶ 執行推演
              </button>
            </div>
          </div>

          <div className="modal-result">
            {!simResult ? (
              <div className="result-placeholder">
                <div className="icon">📈</div>
                <div>設定參數後，點擊「執行推演」</div>
              </div>
            ) : simResult.error ? (
              <div className="empty-block error">{simResult.error}</div>
            ) : (
              <>
                <table className="result-table">
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>星期</th>
                      <th>時數</th>
                      <th>書號</th>
                      <th>剩餘時數</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultRowsWithBalance.map((row, index) => (
                      <tr key={`${row.date}-${index}`}>
                        <td>{row.date}</td>
                        <td>星期{row.dow}</td>
                        <td>{row.hours}hr</td>
                        <td>
                          {(row.books || []).map((book, bookIndex) => (
                            <span className="book-tag" key={`${row.date}-${index}-${bookIndex}`}>
                              {formatBookTokenLabel(book)}
                            </span>
                          ))}
                        </td>
                        <td className={row.remainingAfter < 0 ? 'sim-balance-danger' : ''}>
                          {row.remainingAfter} hr
                        </td>
                        <td>
                          <button
                            className="btn btn-outline btn-sm"
                            disabled={saving}
                            onClick={() => deleteSimRow(index)}
                          >
                            刪除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="summary-box">
                  <div className="summary-item">
                    <div className="s-label">原始剩餘時數</div>
                    <div className="s-value">{Number(form.hours || 0)} hr</div>
                  </div>
                  <div className="summary-item">
                    <div className="s-label">累計消耗時數</div>
                    <div className="s-value">{totalUsed} hr</div>
                  </div>
                  <div className="summary-item">
                    <div className="s-label">最終剩餘時數</div>
                    <div className="s-value">{Number(form.hours || 0) - totalUsed} hr</div>
                  </div>
                </div>

                <div className="save-bar">
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={saving || !(simResult.rows || []).length}
                    onClick={handleSaveSimulation}
                  >
                    💾 套用設定並儲存為新的學習進度表
                  </button>
                  <span className="save-ok-msg show">{saveMsg}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SimulationModal