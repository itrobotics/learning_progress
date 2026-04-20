import { BRANCHES } from '../constants'

function TopNav({
  currentBranch,
  setCurrentBranch,
  activeModule,
  setActiveModule,
  onOpenSettings,
  onRefresh,
  mobileDrawerOpen,
  onToggleMobileDrawer,
}) {
  const logoSrc = `${import.meta.env.BASE_URL}ais-logo.png`
  const manualUrl = `${import.meta.env.BASE_URL}manuals/MPM系統使用者手冊.html`
  const fullTitle = '艾思-學習進度管理系統 (MPM數學專用)'
  const mobileTitle = '艾思 MPM 進度系統'

  return (
    <nav className="topnav">
        <div className="logo-wrap">
          <img className="logo-image" src={logoSrc} alt="艾思程式教育 Logo" />
          <div className="logo">
            <span className="logo-text-desktop">{fullTitle}</span>
            <span className="logo-text-mobile">{mobileTitle}</span>
          </div>
        </div>
      <div className="topnav-right">
        <button
          className={`topnav-mobile-menu-btn ${mobileDrawerOpen ? 'open' : ''}`}
          onClick={onToggleMobileDrawer}
        >
          ☰ 選單
        </button>
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

        <button
          className="top-action-btn"
          onClick={() => window.open(manualUrl, '_blank', 'noopener,noreferrer')}
        >
          help ?
        </button>
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