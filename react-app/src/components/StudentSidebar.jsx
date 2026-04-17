import { LEVELS } from '../constants'
import { calcRealRemainingHours, getCurrentBook } from '../studentUtils'

function StudentSidebar({
  loading,
  errorMsg,
  currentSearch,
  setCurrentSearch,
  currentFilter,
  setCurrentFilter,
  filteredStudents,
  collapsedLevels,
  toggleLevel,
  selectedId,
  setSelectedId,
  onOpenCreateStudent,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <input
          className="search-box"
          type="text"
          placeholder="🔍 搜尋學生姓名或年級…"
          value={currentSearch}
          onChange={(e) => setCurrentSearch(e.target.value)}
        />
        <div className="filter-row">
          <button
            className={`filter-btn ${currentFilter === 'all' ? 'active' : ''}`}
            onClick={() => setCurrentFilter('all')}
          >
            全部
          </button>
          <button
            className={`filter-btn ${currentFilter === 'warn' ? 'active' : ''}`}
            onClick={() => setCurrentFilter('warn')}
          >
            ⚠ 時數預警
          </button>
          <button
            className={`filter-btn ${currentFilter === 'todayPending' ? 'active' : ''}`}
            onClick={() => setCurrentFilter('todayPending')}
          >
             今待確認
          </button>
          <button
            className={`filter-btn ${currentFilter === 'overduePending' ? 'active' : ''}`}
            onClick={() => setCurrentFilter('overduePending')}
          >
            ⏰ 逾期未確認
          </button>
        </div>
        <button className="btn btn-primary btn-sm sidebar-add-btn" onClick={onOpenCreateStudent}>
          ＋ 新增學生
        </button>
      </div>

      <div className="student-list">
        {loading && <div className="empty-block">資料讀取中…</div>}
        {!loading && errorMsg && <div className="empty-block error">⚠ {errorMsg}</div>}
        {!loading &&
          !errorMsg &&
          LEVELS.map((level) => {
            const group = filteredStudents.filter((student) => student.level === level)
            if (!group.length) return null

            const isCollapsed = !!collapsedLevels[level]
            const warnCount = group.filter((student) => student.status !== 'ok').length

            return (
              <div className="level-group" key={level}>
                <div className="level-group-header" onClick={() => toggleLevel(level)}>
                  <span className={`level-badge ${level}`}>{level}</span>
                  <span className="level-group-name">
                    {warnCount > 0 && <span className="warn-badge">⚠ {warnCount}</span>}
                  </span>
                  <span className="level-group-count">{group.length}</span>
                  <span className="level-group-toggle">{isCollapsed ? '▶' : '▼'}</span>
                </div>

                {!isCollapsed && (
                  <div className="level-group-body">
                    {group.map((student) => (
                      <button
                        key={student.id}
                        className={`student-item ${selectedId === student.id ? 'active' : ''}`}
                        onClick={() => setSelectedId(student.id)}
                      >
                        <div className="student-avatar">{student.name?.[0] || '?'}</div>
                        <div className="student-info">
                          <div className="student-name-row">
                            <div className="student-name">{student.name}</div>
                            {student.pendingConfirmState === 'today' && (
                              <span className="student-pending-badge" title="今日有待確認進度">
                                🕒 今待確認
                              </span>
                            )}
                            {student.pendingConfirmState === 'overdue' && (
                              <span className="student-pending-badge" title="有逾期未確認進度">
                                ⏰ 逾期
                              </span>
                            )}
                          </div>
                          <div className="student-meta">
                            {student.id} . {getCurrentBook(student)} . 剩
                            {calcRealRemainingHours(student)}hr
                          </div>
                        </div>
                        <div className="status-dots">
                          {(student.status === 'warn' || student.status === 'danger') && (
                            <span
                              className={`status-dot ${
                                student.status === 'danger' ? 'dot-danger' : 'dot-warn'
                              }`}
                              title={student.status === 'danger' ? '剩餘時數已不足' : '剩餘時數偏低'}
                            />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
      </div>
    </aside>
  )
}

export default StudentSidebar