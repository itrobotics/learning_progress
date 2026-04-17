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
              <label className="form-label">上學期開始</label>
              <input
                className="form-control"
                value={form.upTermStart || ''}
                onChange={(e) => updateField('upTermStart', e.target.value)}
                placeholder="08/01"
              />
            </div>
            <div className="form-group">
              <label className="form-label">上學期結束</label>
              <input
                className="form-control"
                value={form.upTermEnd || ''}
                onChange={(e) => updateField('upTermEnd', e.target.value)}
                placeholder="01/31"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">下學期開始</label>
              <input
                className="form-control"
                value={form.downTermStart || ''}
                onChange={(e) => updateField('downTermStart', e.target.value)}
                placeholder="02/01"
              />
            </div>
            <div className="form-group">
              <label className="form-label">下學期結束</label>
              <input
                className="form-control"
                value={form.downTermEnd || ''}
                onChange={(e) => updateField('downTermEnd', e.target.value)}
                placeholder="07/31"
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