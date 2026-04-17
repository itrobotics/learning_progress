function OrderSummaryView({
  currentBranch,
  orderSearch,
  setOrderSearch,
  orderTimePreset,
  setOrderTimePreset,
  orderDateStart,
  setOrderDateStart,
  orderDateEnd,
  setOrderDateEnd,
  orderSummaryRows,
}) {
  return (
    <div className="detail-card">
      <div className="detail-header">
        <div>
          <div className="detail-title">📦 待訂套書總覽</div>
          <div className="detail-sub">{currentBranch} 分校</div>
          <div className="detail-sub">實際的書籍訂購是在[書號學習矩陣]，此處僅是查詢</div>
        </div>
      </div>

      <div className="order-filter-bar">
        <span className="order-filter-label">搜尋</span>
        <input
          className="order-search-input"
          type="text"
          placeholder="搜尋學生姓名或 Level（GA / GV / GK）"
          value={orderSearch}
          onChange={(e) => setOrderSearch(e.target.value)}
        />
        <span className="order-filter-label">時間篩選</span>
        <select
          className="order-filter-select"
          value={orderTimePreset}
          onChange={(e) => setOrderTimePreset(e.target.value)}
        >
          <option value="all">全部</option>
          <option value="30">30 天</option>
          <option value="90">90 天</option>
          <option value="180">半年</option>
          <option value="custom">自選</option>
        </select>

        {orderTimePreset === 'custom' && (
          <div className="order-custom-range">
            <input
              className="order-date-input"
              type="date"
              value={orderDateStart}
              onChange={(e) => setOrderDateStart(e.target.value)}
            />
            <span className="order-range-sep">～</span>
            <input
              className="order-date-input"
              type="date"
              value={orderDateEnd}
              onChange={(e) => setOrderDateEnd(e.target.value)}
            />
          </div>
        )}

        <button
          className="filter-btn"
          onClick={() => {
            setOrderSearch('')
            setOrderTimePreset('all')
            setOrderDateStart('')
            setOrderDateEnd('')
          }}
        >
          清除篩選
        </button>
      </div>

      <div className="order-summary-wrap">
        {!orderSummaryRows.length ? (
          <div className="empty-state">
            <div className="es-icon">📭</div>
            <div className="es-text">{currentBranch} 分校目前無待訂套書</div>
          </div>
        ) : (
          <table className="order-table">
            <thead>
              <tr>
                <th>Level</th>
                <th>年級</th>
                <th>套書範圍</th>
                <th>需訂學生數</th>
                <th>學生名單</th>
              </tr>
            </thead>
            <tbody>
              {orderSummaryRows.map(({ setInfo, studentIds, studentNames }) => (
                <tr key={setInfo.setKey}>
                  <td>
                    <span className={`level-badge ${setInfo.level}`}>{setInfo.level}</span>
                  </td>
                  <td>{setInfo.grade} 年級</td>
                  <td>
                    <span className="order-set-badge">{setInfo.setRange}</span>
                  </td>
                  <td>
                    <span className="order-count-badge">{studentIds.size}</span>
                  </td>
                  <td>
                    {studentNames.map((name) => (
                      <span className="order-student-tag" key={`${setInfo.setKey}-${name}`}>
                        {name}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default OrderSummaryView