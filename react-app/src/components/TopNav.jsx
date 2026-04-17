import { BRANCHES } from '../constants'

function TopNav({
  currentBranch,
  setCurrentBranch,
  activeModule,
  setActiveModule,
  onOpenSettings,
  onRefresh,
}) {
  const logoSrc = `${import.meta.env.BASE_URL}ais-logo.png`

  return (
    <nav className="topnav">
      <div className="logo-wrap">
        <img className="logo-image" src={logoSrc} alt="艾思程式教育 Logo" />
        <div className="logo">艾思-學習進度管理系統 (MPM數學專用)</div>
      </div>
      <div className="topnav-right">
        <div className="branch-tabs">
          {BRANCHES.map((branch) => (
            <button
              key={branch}
              className={`branch-btn ${currentBranch === branch ? 'active' : ''}`}
              onClick={() => setCurrentBranch(branch)}
            >
              {branch}
            </button>
          ))}
        </div>

        <div className="nav-menu">
          <button
            className={`nav-menu-btn ${activeModule === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveModule('schedule')}
          >
            📚 學習進度
          </button>
          <button
            className={`nav-menu-btn ${activeModule === 'order' ? 'active' : ''}`}
            onClick={() => setActiveModule('order')}
          >
            📦 書籍訂購
          </button>
        </div>

        <button className="top-action-btn" onClick={onOpenSettings}>
          ⚙️ 系統設定
        </button>
        <button className="top-action-btn" onClick={onRefresh}>
          🔄 重新整理
        </button>
      </div>
    </nav>
  )
}

export default TopNav