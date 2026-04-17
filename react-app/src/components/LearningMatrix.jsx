import { getCurrentTermRange, inCurrentTerm } from '../dateUtils'
import {
  getCurrentBook,
  getLearnedBookProgressMap,
  getPlannedBookProgressMap,
  getStudentOrderAlertGapK,
} from '../studentUtils'
import {
  getLegalNoSet,
  getLevelMaxNo,
  getSetRangeByNo,
  isBookProgressComplete,
} from '../bookUtils'

function getBookOrderState(bookOrderStateMap, studentId, bookCode) {
  return bookOrderStateMap?.[`${studentId}__${String(bookCode || '').toUpperCase()}`] || ''
}

function getOrderPromptContext(student, level, grade, settings, bookOrderStateMap, scope) {
  const k = getStudentOrderAlertGapK(student, settings)
  const scopedStudent =
    scope === 'term'
      ? {
          ...student,
          scheduleTable: (student.scheduleTable || []).filter((row) =>
            inCurrentTerm(row.date, settings)
          ),
        }
      : student

  const learnedMap = getLearnedBookProgressMap(scopedStudent)
  const plannedMap = getPlannedBookProgressMap(scopedStudent)
  const legalNoSet = getLegalNoSet(level)
  const maxNo = getLevelMaxNo(level)

  let maxLearnedNo = 0
  const currentBookMatch = String(getCurrentBook(student) || '').match(/^(GK|GV|GA)(\d)(\d{2})/)
  if (
    currentBookMatch &&
    currentBookMatch[1] === level &&
    Number(currentBookMatch[2]) === Number(grade)
  ) {
    maxLearnedNo = Number(currentBookMatch[3])
  } else {
    for (const code of learnedMap.keys()) {
      const m = String(code).match(/^(GK|GV|GA)(\d)(\d{2})$/)
      if (!m || m[1] !== level || Number(m[2]) !== Number(grade)) continue
      maxLearnedNo = Math.max(maxLearnedNo, Number(m[3]))
    }
  }

  const candidates = []
  for (let no = maxLearnedNo + 1; no <= maxNo; no += 1) {
    if (!legalNoSet.has(no)) continue
    const code = `${level}${grade}${String(no).padStart(2, '0')}`
    if (!plannedMap.has(code)) continue
    candidates.push({
      no,
      code,
      state: getBookOrderState(bookOrderStateMap, student.id, code),
    })
  }

  const kCells = candidates.slice(0, Math.max(1, k))
  if (!kCells.length) return null
  if (kCells.every((cell) => cell.state === 'inStock')) return null

  const setNeedsOrder = new Set()
  kCells.forEach((cell) => {
    if (cell.state !== 'inStock') {
      setNeedsOrder.add(getSetRangeByNo(cell.no).start)
    }
  })

  const sets = Array.from(setNeedsOrder)
    .sort((a, b) => a - b)
    .map((start) => ({ start, end: start + 7 }))

  return { level, grade: Number(grade), sets }
}

function LearningMatrix({
  student,
  settings,
  matrixLevel,
  setMatrixLevel,
  matrixScope,
  setMatrixScope,
  bookOrderStateMap,
  syncLocked,
  syncMsg,
  onSync,
  onCellClick,
  onOrderPrompt,
}) {
  const currentLevel = matrixLevel || student.level || 'GK'
  const currentScope = matrixScope || 'all'
  const term = getCurrentTermRange(undefined, settings)

  const scopedStudent =
    currentScope === 'term'
      ? {
          ...student,
          scheduleTable: (student.scheduleTable || []).filter((row) =>
            inCurrentTerm(row.date, settings)
          ),
        }
      : student

  const learnedMap = getLearnedBookProgressMap(scopedStudent)
  const plannedMap = getPlannedBookProgressMap(scopedStudent)
  const legalNoSet = getLegalNoSet(currentLevel)
  const maxNo = getLevelMaxNo(currentLevel)

  const promptContext = getOrderPromptContext(
    student,
    currentLevel,
    student.grade,
    settings,
    bookOrderStateMap,
    currentScope
  )

  const promptLabel = promptContext
    ? promptContext.sets
        .map(
          (range) =>
            `${currentLevel}${student.grade}${String(range.start).padStart(2, '0')}~${currentLevel}${student.grade}${String(range.end).padStart(2, '0')}`
        )
        .join('、')
    : ''

  return (
    <section className="detail-section">
      <div className="section-header">
        <div>
          <div className="section-title">🧭 書號學習矩陣</div>
          <div className="section-sub">
            綠底 X＝整本已完成 ◐＝半本已完成 ○＝已排入學習進度但尚未確認 黃底 ○＝有庫存
            紅底 ○＝無庫存 顯示範圍：{term.label}（{term.start} ～ {term.end}）
          </div>
        </div>
      </div>

      <div className="history-toolbar">
        <span className="history-toolbar-label">Level：</span>
        {['GK', 'GV', 'GA'].map((level) => (
          <button
            key={level}
            className={`history-tab ${level === currentLevel ? 'active' : ''}`}
            onClick={() => setMatrixLevel(level)}
          >
            {level}
          </button>
        ))}

        <span className="history-toolbar-label scope">範圍：</span>
        <button
          className={`history-tab ${currentScope === 'all' ? 'active' : ''}`}
          onClick={() => setMatrixScope('all')}
        >
          全部
        </button>
        <button
          className={`history-tab ${currentScope === 'term' ? 'active' : ''}`}
          onClick={() => setMatrixScope('term')}
        >
          本學期
        </button>

        <button className="btn btn-outline btn-sm" disabled={syncLocked} onClick={onSync}>
          🔄 同步學習矩陣狀態
        </button>
        <span className={`history-sync-msg ${syncMsg?.startsWith('⚠') ? 'error' : ''}`}>
          {syncMsg || ''}
        </span>
      </div>

      <div className="history-wrap">
        <table className="history-table">
          <thead>
            <tr>
              <th className="sticky-col">Grade</th>
              {Array.from({ length: maxNo }, (_, index) => index + 1).map((no) => (
                <th key={no} className={no % 8 === 0 ? 'set-boundary-right' : ''}>
                  {String(no).padStart(2, '0')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }, (_, index) => index + 1).map((grade) => (
              <tr key={grade}>
                <td className="history-grade sticky-col">{grade}</td>
                {Array.from({ length: maxNo }, (_, index) => index + 1).map((no) => {
                  const boundaryClass = no % 8 === 0 ? 'set-boundary-right' : ''
                  const legal = legalNoSet.has(no)
                    if (!legal) {
                      return (
                        <td
                          key={no}
                          className={`cell-illegal ${boundaryClass}`.trim()}
                          title="此書號不適用"
                        />
                      )
                    }

                  const book = `${currentLevel}${grade}${String(no).padStart(2, '0')}`
                  const learnedInfo = learnedMap.get(book)
                  if (learnedInfo) {
                    return (
                      <td
                        key={no}
                          className={`${
                            isBookProgressComplete(learnedInfo) ? 'cell-learned' : 'cell-half-learned'
                          } ${boundaryClass}`.trim()}
                          title={
                            isBookProgressComplete(learnedInfo)
                              ? `${book}：整本已完成`
                              : `${book}：半本已完成`
                          }
                        >
                          {isBookProgressComplete(learnedInfo) ? 'X' : '◐'}
                        </td>
                    )
                  }

                  const planned = plannedMap.has(book)
                    if (!planned) {
                      return (
                        <td
                          key={no}
                          className={`cell-legal ${boundaryClass}`.trim()}
                          title={`${book}：尚未排入學習進度`}
                        />
                      )
                    }

                  const state = getBookOrderState(bookOrderStateMap, student.id, book)
                  const cls =
                    state === 'inStock'
                      ? 'cell-stock planned-book pending-book inStock yellow-stock'
                      : state === 'needOrder'
                        ? 'cell-order planned-book pending-book needOrder'
                        : 'cell-plan planned-book pending-book white-circle'

                  return (
                    <td
                      key={no}
                      className={`${cls} ${boundaryClass} ${syncLocked ? 'cell-disabled' : ''}`.trim()}
                      title={
                        syncLocked
                          ? `${book}：同步中，暫時不可操作`
                          : state === 'inStock'
                            ? `${book}：有庫存`
                            : state === 'needOrder'
                              ? `${book}：需訂購`
                              : `${book}：已排入學習進度但尚未確認`
                      }
                      data-book-state={state || 'planned'}
                      onClick={() => {
                        if (!syncLocked) onCellClick(currentLevel, grade, no)
                      }}
                    >
                      ○
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {promptContext ? (
        <div className="history-alert">
          ⚠ 提示：須要訂購此套 {promptLabel}
          <button
            className="btn btn-outline btn-sm"
            style={{ marginLeft: 10 }}
            disabled={syncLocked}
            onClick={() => onOrderPrompt(promptContext)}
          >
            訂購此套
          </button>
        </div>
      ) : null}
    </section>
  )
}

export default LearningMatrix