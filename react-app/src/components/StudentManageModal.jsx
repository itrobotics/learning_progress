import { useEffect, useMemo, useState } from 'react'
import { BRANCHES, LEVELS, WEEKDAYS } from '../constants'

function buildInitialForm(student, currentBranch, defaultOrderAlertGapK = 0) {
  const hasStudent = !!student
  const initialPurchasedHours = Number(
    student?.initHours ?? student?.currentRemainingHours ?? student?.confirmedHours ?? 0
  )

  return {
    id: String(student?.id || '').trim(),
    name: String(student?.name || '').trim(),
    branch: String(student?.branch || currentBranch || BRANCHES[0] || '').trim(),
    level: String(student?.level || 'GK').trim() || 'GK',
    grade: Number(student?.grade ?? 0),
    speed: Number(student?.speed || 1),
    confirmedNo: Number(student?.confirmedNo ?? 1),
    currentRemainingHours: Number(student?.currentRemainingHours ?? student?.confirmedHours ?? initialPurchasedHours),
    initHours: initialPurchasedHours,
    orderAlertGapKByPerson: Number(
      hasStudent ? student?.orderAlertGapKByPerson || 0 : defaultOrderAlertGapK || 0
    ),
    school: String(student?.school || student?.elementarySchool || student?.schoolName || '').trim(),
    note: String(student?.note || '').trim(),
    schedule: Array.isArray(student?.schedule)
      ? student.schedule.map((hours) => Number(hours || 0))
      : [0, 0, 0, 0, 0, 0, 0],
  }
}

function StudentManageModal({
  open,
  mode,
  student,
  currentBranch,
  saving,
  defaultOrderAlertGapK,
  onClose,
  onSave,
  onDelete,
}) {
  const [form, setForm] = useState(buildInitialForm(null, currentBranch, defaultOrderAlertGapK))
  const [errorMsg, setErrorMsg] = useState('')
  const [actionMsg, setActionMsg] = useState('')

  useEffect(() => {
    if (!open) return
    setForm(buildInitialForm(student, currentBranch, defaultOrderAlertGapK))
    setErrorMsg('')
    setActionMsg('')
  }, [open, student, currentBranch, defaultOrderAlertGapK])

  const isEdit = mode === 'edit'
  const title = isEdit ? '✏️ 編輯學生資料' : '➕ 新增學生'

  const totalWeeklyHours = useMemo(() => {
    return (form.schedule || []).reduce((sum, hours) => sum + Number(hours || 0), 0)
  }, [form.schedule])

  if (!open) return null

  function updateField(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  function updatePurchasedHours(value) {
    const next = Number(value || 0)
    setForm((prev) => ({
      ...prev,
      initHours: next,
      currentRemainingHours: isEdit ? prev.currentRemainingHours : next,
    }))
  }

  function updateSchedule(index, value) {
    setForm((prev) => {
      const schedule = [...prev.schedule]
      schedule[index] = Number(value || 0)
      return {
        ...prev,
        schedule,
      }
    })
  }

  async function handleSave() {
    const payload = {
      id: String(form.id || '').trim(),
      name: String(form.name || '').trim(),
      branch: String(form.branch || '').trim(),
      level: String(form.level || 'GK').trim() || 'GK',
      grade: Number(form.grade ?? 0),
      speed: Number(form.speed || 1),
      confirmedNo: Number(form.confirmedNo),
      currentRemainingHours: Number(form.currentRemainingHours || 0),
      confirmedHours: Number(form.currentRemainingHours || 0),
      initHours: Number(form.initHours || 0),
      orderAlertGapKByPerson: Number(form.orderAlertGapKByPerson || 0),
      school: String(form.school || '').trim(),
      elementarySchool: String(form.school || '').trim(),
      note: String(form.note || '').trim(),
      mon: Number(form.schedule?.[0] || 0),
      tue: Number(form.schedule?.[1] || 0),
      wed: Number(form.schedule?.[2] || 0),
      thu: Number(form.schedule?.[3] || 0),
      fri: Number(form.schedule?.[4] || 0),
      sat: Number(form.schedule?.[5] || 0),
      sun: Number(form.schedule?.[6] || 0),
    }

    if (!payload.id) {
      setErrorMsg('請輸入學生編號')
      return
    }

    if (!payload.name) {
      setErrorMsg('請輸入學生姓名')
      return
    }

    if (!payload.branch) {
      setErrorMsg('請選擇分校')
      return
    }

    if (payload.confirmedNo <= 0) {
      setErrorMsg('起始書號需大於 0')
      return
    }

    if (!isEdit && (payload.currentRemainingHours < 0 || payload.initHours < 0)) {
      setErrorMsg('時數不可為負數')
      return
    }

    setErrorMsg('')
    setActionMsg('⏳ 儲存中…')
    const result = await onSave?.(payload, mode)
    if (result?.ok) {
      setActionMsg('✅ 已儲存')
      return
    }
    setActionMsg('')
    setErrorMsg(result?.message || '儲存失敗')
  }

  async function handleDelete() {
    if (!student?.id || !onDelete) return
    const ok = window.confirm(`確定要刪除學生「${student.name}」(${student.id})？`)
    if (!ok) return

    setErrorMsg('')
    setActionMsg('⏳ 刪除中…')
    const result = await onDelete(student.id)
    if (result?.ok) {
      setActionMsg('✅ 已刪除')
      return
    }
    setActionMsg('')
    setErrorMsg(result?.message || '刪除失敗')
  }

  return (
    <div className="modal-overlay open">
      <div className="modal settings-modal student-manage-modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">{title}</div>
            <div className="modal-subtitle">
              資料來源：Sheet「學生設定」｜ confirmedHours 會與剩餘學習時數同步
            </div>
          </div>
          <button className="close-btn" disabled={saving} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="settings-body student-manage-body">
          <div className="section-title">基本資料</div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">學生編號</label>
              <input
                className="form-control"
                type="text"
                value={form.id}
                disabled={isEdit || saving}
                onChange={(e) => updateField('id', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">學生姓名</label>
              <input
                className="form-control"
                type="text"
                value={form.name}
                disabled={saving}
                onChange={(e) => updateField('name', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">分校</label>
              <select
                className="form-control"
                value={form.branch}
                disabled={saving}
                onChange={(e) => updateField('branch', e.target.value)}
              >
                {BRANCHES.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">國小</label>
              <input
                className="form-control"
                type="text"
                value={form.school}
                disabled={saving}
                onChange={(e) => updateField('school', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">備註</label>
            <textarea
              className="form-control"
              rows={3}
              value={form.note}
              disabled={saving}
              onChange={(e) => updateField('note', e.target.value)}
              placeholder="可填寫該學生應注意事項"
            />
          </div>

          <div className="section-title modal-section-gap">學習設定</div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Level</label>
              <select
                className="form-control"
                value={form.level}
                disabled={saving}
                onChange={(e) => updateField('level', e.target.value)}
              >
                {LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">年級</label>
              <select
                className="form-control"
                value={form.grade}
                disabled={saving}
                onChange={(e) => updateField('grade', Number(e.target.value))}
              >
                {[0, 1, 2, 3, 4, 5, 6].map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">起始書號</label>
              <input
                className="form-control"
                type="number"
                min="1"
                value={form.confirmedNo}
                disabled={saving}
                onChange={(e) => updateField('confirmedNo', Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">速度 (本/時)</label>
              <select
                className="form-control"
                value={form.speed}
                disabled={saving}
                onChange={(e) => updateField('speed', Number(e.target.value))}
              >
                <option value="0.5">0.5 本/時</option>
                <option value="1">1 本/時</option>
                <option value="2">2 本/時</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">已購時數</label>
              <input
                className="form-control"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={form.initHours}
                disabled={saving}
                onChange={(e) => updatePurchasedHours(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">剩餘學習時數</label>
              <input
                className="form-control"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={form.currentRemainingHours}
                disabled={saving}
                onChange={(e) => updateField('currentRemainingHours', Number(e.target.value))}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">訂購預警 K</label>
              <input
                className="form-control"
                type="number"
                min="0"
                step="1"
                value={form.orderAlertGapKByPerson}
                disabled={saving}
                onChange={(e) =>
                  updateField('orderAlertGapKByPerson', Number(e.target.value))
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">每週總時數</label>
              <div className="student-manage-summary">{totalWeeklyHours} hr / 週</div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">每週時程 (小時/天)</label>
            <div className="schedule-grid">
              {WEEKDAYS.map((day, index) => (
                <div className="day-input-wrap" key={day}>
                  <div className="day-label">{day}</div>
                  <input
                    className="day-input"
                    type="number"
                    min="0"
                    max="8"
                    value={form.schedule[index]}
                    disabled={saving}
                    onChange={(e) => updateSchedule(index, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          {!!errorMsg && <div className="form-error">{errorMsg}</div>}

          <div className="student-manage-actions">
            <div className="student-manage-msg">{actionMsg}</div>
            <div className="student-manage-btns">
              {isEdit && (
                <button className="btn btn-danger btn-sm" disabled={saving} onClick={handleDelete}>
                  刪除學生
                </button>
              )}
              <button className="btn btn-outline btn-sm" disabled={saving} onClick={onClose}>
                關閉
              </button>
              <button className="btn btn-primary btn-sm" disabled={saving} onClick={handleSave}>
                {isEdit ? '更新學生' : '新增學生'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StudentManageModal