import { useEffect, useState } from 'react'

function SettingsModal({ open, settings, onClose, onSave }) {
  const [form, setForm] = useState(settings)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(settings)
      setMsg('')
      setSaving(false)
    }
  }, [open, settings])

  if (!open) return null

  function updateField(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  async function handleSave() {
    if (!onSave) return
    setSaving(true)
    setMsg('⏳ 設定同步中…')
    const result = await onSave(form)
    if (result?.ok) {
      setMsg('✅ 設定已儲存')
      setSaving(false)
      onClose?.()
      return
    }

    setMsg(`⚠ ${result?.message || '儲存失敗'}`)
    setSaving(false)
  }

  function handleRequestClose() {
    if (saving) {
      window.alert('同步中，請等待完成後再關閉')
      return
    }

    onClose?.()
  }

  return (
    <div className="modal-overlay open">
      <div className="modal settings-modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">⚙️ 系統全域設定</div>
            <div className="modal-subtitle">對應 Google Sheets 的 setting 分頁</div>
          </div>
          <button
            className="close-btn"
            title={saving ? '同步中，請等待完成後再關閉' : ''}
            onClick={handleRequestClose}
          >
            ✕
          </button>
        </div>

        <div className="settings-body">
          <div className="section-title">學期設定</div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">上學期開始日期</label>
              <input
                className="form-control"
                value={form.upTermStart || ''}
                onChange={(e) => updateField('upTermStart', e.target.value)}
                placeholder="2025/08/01 或 2025-08-01"
              />
            </div>
            <div className="form-group">
              <label className="form-label">上學期結束日期</label>
              <input
                className="form-control"
                value={form.upTermEnd || ''}
                onChange={(e) => updateField('upTermEnd', e.target.value)}
                placeholder="2026/01/31 或 2026-01-31"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">下學期開始日期</label>
              <input
                className="form-control"
                value={form.downTermStart || ''}
                onChange={(e) => updateField('downTermStart', e.target.value)}
                placeholder="2026/02/01 或 2026-02-01"
              />
            </div>
            <div className="form-group">
              <label className="form-label">下學期結束日期</label>
              <input
                className="form-control"
                value={form.downTermEnd || ''}
                onChange={(e) => updateField('downTermEnd', e.target.value)}
                placeholder="2026/07/31 或 2026-07-31"
              />
            </div>
          </div>

          <div className="section-title modal-section-gap">顯示設定</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">每頁筆數</label>
              <input
                className="form-control"
                type="number"
                min="1"
                step="1"
                value={form.rowPerPage || ''}
                onChange={(e) => updateField('rowPerPage', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">時數不足預警</label>
              <input
                className="form-control"
                type="number"
                min="1"
                step="1"
                value={form.lowHoursThreshold || ''}
                onChange={(e) => updateField('lowHoursThreshold', e.target.value)}
              />
            </div>
          </div>

          <div className="section-title modal-section-gap">進度載入設定</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">載入今天前幾天進度</label>
              <input
                className="form-control"
                type="number"
                min="1"
                step="1"
                value={form.scheduleLoadPastDays || ''}
                onChange={(e) => updateField('scheduleLoadPastDays', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">載入今天後幾天進度</label>
              <input
                className="form-control"
                type="number"
                min="1"
                step="1"
                value={form.scheduleLoadFutureDays || ''}
                onChange={(e) => updateField('scheduleLoadFutureDays', e.target.value)}
              />
            </div>
          </div>

          <div className="section-title modal-section-gap">訂購設定</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">學習矩陣-預警無庫存書的提示窗口大小 K</label>
              <input
                className="form-control"
                type="number"
                min="1"
                step="1"
                value={form.orderAlertGapK || ''}
                onChange={(e) => updateField('orderAlertGapK', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">學習進度表-提前提醒需要新套書的天數</label>
              <input
                className="form-control"
                type="number"
                min="1"
                step="1"
                value={form.bookAlertDays || ''}
                onChange={(e) => updateField('bookAlertDays', e.target.value)}
              />
            </div>
          </div>

          <div className="section-title modal-section-gap">分校跑馬燈訊息</div>

          <div className="form-group">
            <label className="form-label">延壽分校跑馬燈訊息</label>
            <textarea
              className="form-control"
              rows={2}
              value={form.marqueeMsgYanShou || ''}
              onChange={(e) => updateField('marqueeMsgYanShou', e.target.value)}
              placeholder="輸入延壽分校要顯示的提醒訊息"
            />
            <label className="radio-label" style={{ marginTop: 6 }}>
              <input
                type="checkbox"
                checked={!!form.marqueeEnabledYanShou}
                onChange={(e) => updateField('marqueeEnabledYanShou', e.target.checked)}
              />
              啟用延壽分校跑馬燈
            </label>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">延壽分校跑馬燈顏色</label>
              <input
                className="form-control"
                type="color"
                value={form.marqueeColorYanShou || '#166534'}
                onChange={(e) => updateField('marqueeColorYanShou', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">延壽分校跑馬燈速度</label>
              <select
                className="form-control"
                value={form.marqueeSpeedYanShou || '16'}
                onChange={(e) => updateField('marqueeSpeedYanShou', e.target.value)}
              >
                <option value="24">慢（24秒）</option>
                <option value="16">中（16秒）</option>
                <option value="8">快（8秒）</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">安和分校跑馬燈訊息</label>
            <textarea
              className="form-control"
              rows={2}
              value={form.marqueeMsgAnHe || ''}
              onChange={(e) => updateField('marqueeMsgAnHe', e.target.value)}
              placeholder="輸入安和分校要顯示的提醒訊息"
            />
            <label className="radio-label" style={{ marginTop: 6 }}>
              <input
                type="checkbox"
                checked={!!form.marqueeEnabledAnHe}
                onChange={(e) => updateField('marqueeEnabledAnHe', e.target.checked)}
              />
              啟用安和分校跑馬燈
            </label>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">安和分校跑馬燈顏色</label>
              <input
                className="form-control"
                type="color"
                value={form.marqueeColorAnHe || '#166534'}
                onChange={(e) => updateField('marqueeColorAnHe', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">安和分校跑馬燈速度</label>
              <select
                className="form-control"
                value={form.marqueeSpeedAnHe || '16'}
                onChange={(e) => updateField('marqueeSpeedAnHe', e.target.value)}
              >
                <option value="24">慢（24秒）</option>
                <option value="16">中（16秒）</option>
                <option value="8">快（8秒）</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">大直分校跑馬燈訊息</label>
            <textarea
              className="form-control"
              rows={2}
              value={form.marqueeMsgDaZhi || ''}
              onChange={(e) => updateField('marqueeMsgDaZhi', e.target.value)}
              placeholder="輸入大直分校要顯示的提醒訊息"
            />
            <label className="radio-label" style={{ marginTop: 6 }}>
              <input
                type="checkbox"
                checked={!!form.marqueeEnabledDaZhi}
                onChange={(e) => updateField('marqueeEnabledDaZhi', e.target.checked)}
              />
              啟用大直分校跑馬燈
            </label>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">大直分校跑馬燈顏色</label>
              <input
                className="form-control"
                type="color"
                value={form.marqueeColorDaZhi || '#166534'}
                onChange={(e) => updateField('marqueeColorDaZhi', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">大直分校跑馬燈速度</label>
              <select
                className="form-control"
                value={form.marqueeSpeedDaZhi || '16'}
                onChange={(e) => updateField('marqueeSpeedDaZhi', e.target.value)}
              >
                <option value="24">慢（24秒）</option>
                <option value="16">中（16秒）</option>
                <option value="8">快（8秒）</option>
              </select>
            </div>
          </div>

          <div className="confirm-action-row modal-inline-actions">
            <span className="confirm-saved-msg modal-msg">{msg}</span>
            <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
              儲存設定
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal