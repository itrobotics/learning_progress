/* global __APP_VERSION__, __BUILD_TIME__ */
import { useEffect, useMemo, useState } from 'react'
import './App.css'
import TopNav from './components/TopNav'
import StudentSidebar from './components/StudentSidebar'
import OrderSummaryView from './components/OrderSummaryView'
import StudentDetailPanel from './components/StudentDetailPanel'
import SimulationModal from './components/SimulationModal'
import SettingsModal from './components/SettingsModal'
import StudentManageModal from './components/StudentManageModal'
import { APP_SETTINGS_DEFAULT, BRANCHES, TODAY } from './constants'
import {
  fetchStudents,
  fetchSettings,
  fetchBookOrderStates,
  fetchSchedule,
  confirmProgress,
  adjustStudentHours,
  saveBookOrderStates,
  saveSchedule,
  addStudent as addStudentApi,
  updateStudent,
  deleteStudent as deleteStudentApi,
  saveSettings as saveSettingsApi,
} from './api'
import { normalizeSheetDate, nowTWDateTimeString } from './dateUtils'
import { getMainBookCode, bookCodeToSet, formatBookTokenLabel, generateClientRowId } from './bookUtils'
import { buildOrderSummaryData } from './orderUtils'
import { calcStudentStatus } from './studentUtils'

function parsePositiveInt(v, fallback) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

function parseBooleanSetting(v, fallback = false) {
  if (typeof v === 'boolean') return v
  const normalized = String(v ?? '').trim().toLowerCase()
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === '') return false
  return fallback
}

function normalizeTermDate(v, fallback) {
  const s = String(v || '').trim()
  if (!s) return fallback

  const full = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (full) {
    const yy = Number(full[1])
    const mm = Number(full[2])
    const dd = Number(full[3])
    if (yy < 2000 || yy > 2100 || mm < 1 || mm > 12 || dd < 1 || dd > 31) return fallback
    return `${String(yy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  }

  const old = s.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (old) {
    const mm = Number(old[1])
    const dd = Number(old[2])
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return fallback
    const fallbackYear = String(fallback || '').match(/^(\d{4})-/)?.[1] || String(new Date().getFullYear())
    return `${fallbackYear}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  }

  return fallback
}

function applySystemSettings(raw = {}) {
  return {
    upTermStart: normalizeTermDate(raw.upTermStart, APP_SETTINGS_DEFAULT.upTermStart),
    upTermEnd: normalizeTermDate(raw.upTermEnd, APP_SETTINGS_DEFAULT.upTermEnd),
    downTermStart: normalizeTermDate(raw.downTermStart, APP_SETTINGS_DEFAULT.downTermStart),
    downTermEnd: normalizeTermDate(raw.downTermEnd, APP_SETTINGS_DEFAULT.downTermEnd),
    rowPerPage: parsePositiveInt(raw.rowPerPage, APP_SETTINGS_DEFAULT.rowPerPage),
    lowHoursThreshold: parsePositiveInt(raw.lowHoursThreshold, APP_SETTINGS_DEFAULT.lowHoursThreshold),
    orderAlertGapK: parsePositiveInt(raw.orderAlertGapK, APP_SETTINGS_DEFAULT.orderAlertGapK),
    bookAlertDays: parsePositiveInt(raw.bookAlertDays, APP_SETTINGS_DEFAULT.bookAlertDays),
    scheduleLoadPastDays: parsePositiveInt(
      raw.scheduleLoadPastDays,
      APP_SETTINGS_DEFAULT.scheduleLoadPastDays
    ),
    scheduleLoadFutureDays: parsePositiveInt(
      raw.scheduleLoadFutureDays,
      APP_SETTINGS_DEFAULT.scheduleLoadFutureDays
    ),
    marqueeMsgYanShou: String(raw.marqueeMsgYanShou || ''),
    marqueeEnabledYanShou: parseBooleanSetting(
      raw.marqueeEnabledYanShou,
      APP_SETTINGS_DEFAULT.marqueeEnabledYanShou
    ),
    marqueeColorYanShou: String(raw.marqueeColorYanShou || APP_SETTINGS_DEFAULT.marqueeColorYanShou),
    marqueeSpeedYanShou: parsePositiveInt(raw.marqueeSpeedYanShou, APP_SETTINGS_DEFAULT.marqueeSpeedYanShou),
    marqueeMsgAnHe: String(raw.marqueeMsgAnHe || ''),
    marqueeEnabledAnHe: parseBooleanSetting(
      raw.marqueeEnabledAnHe,
      APP_SETTINGS_DEFAULT.marqueeEnabledAnHe
    ),
    marqueeColorAnHe: String(raw.marqueeColorAnHe || APP_SETTINGS_DEFAULT.marqueeColorAnHe),
    marqueeSpeedAnHe: parsePositiveInt(raw.marqueeSpeedAnHe, APP_SETTINGS_DEFAULT.marqueeSpeedAnHe),
    marqueeMsgDaZhi: String(raw.marqueeMsgDaZhi || ''),
    marqueeEnabledDaZhi: parseBooleanSetting(
      raw.marqueeEnabledDaZhi,
      APP_SETTINGS_DEFAULT.marqueeEnabledDaZhi
    ),
    marqueeColorDaZhi: String(raw.marqueeColorDaZhi || APP_SETTINGS_DEFAULT.marqueeColorDaZhi),
    marqueeSpeedDaZhi: parsePositiveInt(raw.marqueeSpeedDaZhi, APP_SETTINGS_DEFAULT.marqueeSpeedDaZhi),
  }
}

function normalizeProgressStatus(st) {
  const v = String(st || '').trim().toLowerCase()
  if (!v || v === 'none' || v === 'null') return 'none'
  if (v === 'planed' || v === 'planned' || v === 'pending') return 'pending'
  if (v === 'learned') return 'match'
  if (v === 'match' || v === 'behind' || v === 'ahead') return v
  return 'none'
}

function normalizeScheduleRows(rows) {
  return (rows || []).map((r) => ({
    rowId: r.rowId || '',
    date: normalizeSheetDate(r.date),
    dow: r.dow || '',
    hours: Number(r.hours),
    books: (
      Array.isArray(r.books)
        ? r.books
        : (r.books ? String(r.books).split(',').map((b) => b.trim()).filter(Boolean) : [])
    ),
    status: normalizeProgressStatus(r.status || 'pending'),
    note: r.note || '',
    confirmedAt: r.confirmedAt ? normalizeSheetDate(r.confirmedAt) : null,
  }))
}

function addDaysToIsoDate(baseIso, diffDays) {
  const date = new Date(`${baseIso}T00:00:00`)
  date.setDate(date.getDate() + Number(diffDays || 0))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`
}

function getScheduleLoadWindow(appSettings) {
  return {
    startDate: addDaysToIsoDate(TODAY, -Number(appSettings?.scheduleLoadPastDays || 0)),
    endDate: addDaysToIsoDate(TODAY, Number(appSettings?.scheduleLoadFutureDays || 0)),
  }
}

function getDefaultMatrixScope(appSettings, todayIso = TODAY) {
  const today = String(todayIso || '').substring(0, 10)
  const upStart = String(appSettings?.upTermStart || '').substring(0, 10)
  const upEnd = String(appSettings?.upTermEnd || '').substring(0, 10)
  const downStart = String(appSettings?.downTermStart || '').substring(0, 10)
  const downEnd = String(appSettings?.downTermEnd || '').substring(0, 10)

  if (today && upStart && upEnd && today >= upStart && today <= upEnd) return 'up'
  if (today && downStart && downEnd && today >= downStart && today <= downEnd) return 'down'
  return 'year'
}

function getBookAlertSetCodes(student, bookAlertDays) {
  const setCodes = new Set()
  const today = new Date()
  const threshold = new Date(today)
  threshold.setDate(threshold.getDate() + Number(bookAlertDays || 30))
  const thresholdIso = threshold.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
  const todayIso = today.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })

  const upcoming = (student.scheduleTable || []).filter((r) => {
    const rowDate = String(r.date || '').substring(0, 10)
    return normalizeProgressStatus(r.status) === 'pending' && rowDate > todayIso && rowDate <= thresholdIso
  })

  upcoming.forEach((r) => {
    ;(r.books || []).forEach((b) => {
      const mainCode = getMainBookCode(b)
      const setInfo = bookCodeToSet(mainCode)
      if (!setInfo) return
      if (setInfo.no !== setInfo.setStart) return
      setCodes.add(setInfo.setKey)
    })
  })

  return Array.from(setCodes).sort()
}

function normalizeStudentRecord(remote, nextSettings) {
  const currentRemainingHours = Number(
    remote.currentRemainingHours !== undefined &&
      remote.currentRemainingHours !== null &&
      remote.currentRemainingHours !== ''
      ? remote.currentRemainingHours
      : remote.confirmedHours
  ) || 0

  const scheduleLoaded = Array.isArray(remote.scheduleTable)
  const scheduleTable = normalizeScheduleRows(scheduleLoaded ? remote.scheduleTable : [])

  return {
    ...remote,
    currentRemainingHours,
    confirmedHours: currentRemainingHours,
    initHours: Number(remote.initHours || 0),
    scheduleTable,
    scheduleLoaded,
    scheduleLoading: false,
    loadedScheduleStartDate: '',
    loadedScheduleEndDate: '',
    orderAlertGapKByPerson: Number(remote.orderAlertGapKByPerson || 0),
    status: calcStudentStatus(
      {
        ...remote,
        currentRemainingHours,
      },
      nextSettings
    ),
  }
}

function hasScheduleWindowLoaded(student, startDate, endDate) {
  return (
    !!student?.scheduleLoaded &&
    String(student.loadedScheduleStartDate || '') === String(startDate || '') &&
    String(student.loadedScheduleEndDate || '') === String(endDate || '')
  )
}

function getPendingConfirmState(student) {
  if (!student?.scheduleLoaded) return ''

  let earliestDueDate = ''
  ;(student.scheduleTable || []).forEach((row) => {
    const rowDate = String(row.date || '').substring(0, 10)
    if (normalizeProgressStatus(row.status) !== 'pending') return
    if (!rowDate || rowDate > TODAY) return
    if (!earliestDueDate || rowDate < earliestDueDate) {
      earliestDueDate = rowDate
    }
  })

  if (!earliestDueDate) return ''
  return earliestDueDate < TODAY ? 'overdue' : 'today'
}

function App() {
  const appVersion =
    typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__ ? __APP_VERSION__ : 'unknown'
  const buildTime =
    typeof __BUILD_TIME__ !== 'undefined' && __BUILD_TIME__ ? __BUILD_TIME__ : 'unknown'
  const buildInfoText =
    appVersion && appVersion !== 'unknown'
      ? `v${appVersion} / Build: ${buildTime}`
      : `Build: ${buildTime}`

  const [students, setStudents] = useState([])
  const [settings, setSettings] = useState(APP_SETTINGS_DEFAULT)
  const [bookOrderStateMap, setBookOrderStateMap] = useState({})
  const [bookOrderUpdatedAtMap, setBookOrderUpdatedAtMap] = useState({})
  const [currentBranch, setCurrentBranch] = useState('延壽')
  const [currentFilter, setCurrentFilter] = useState('all')
  const [currentSearch, setCurrentSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [collapsedLevels, setCollapsedLevels] = useState({})
  const [matrixLevelState, setMatrixLevelState] = useState({})
  const [matrixScopeState, setMatrixScopeState] = useState({})
  const [studentSyncLockMap, setStudentSyncLockMap] = useState({})
  const [studentSyncMsgMap, setStudentSyncMsgMap] = useState({})
  const [simulationStudent, setSimulationStudent] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [studentManageOpen, setStudentManageOpen] = useState(false)
  const [studentManageMode, setStudentManageMode] = useState('create')
  const [studentManageTarget, setStudentManageTarget] = useState(null)
  const [studentManageSaving, setStudentManageSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeModule, setActiveModule] = useState('schedule')
  const [orderSearch, setOrderSearch] = useState('')
  const [orderTimePreset, setOrderTimePreset] = useState('all')
  const [orderDateStart, setOrderDateStart] = useState('')
  const [orderDateEnd, setOrderDateEnd] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [loadedBranches, setLoadedBranches] = useState({})
  const [globalsLoaded, setGlobalsLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadInitialData() {
      try {
        setLoading(true)
        setErrorMsg('')
        setGlobalsLoaded(false)
        setLoadedBranches({})
        setStudents([])
        setSelectedId(null)

        const [studentsRes, settingsRes, bookOrderRes] = await Promise.all([
          fetchStudents(currentBranch),
          fetchSettings(),
          fetchBookOrderStates(),
        ])

        if (settingsRes?.error) throw new Error(settingsRes.error)
        if (bookOrderRes?.error) throw new Error(bookOrderRes.error)

        const nextSettings = applySystemSettings(settingsRes.settings || {})
        const nextBookOrderStateMap = {}
        const nextBookOrderUpdatedAtMap = {}

        ;(bookOrderRes.rows || []).forEach((r) => {
          const sid = String(r.studentId || '').trim()
          const code = String(r.bookCode || '').trim().toUpperCase()
          const st = String(r.state || '').trim()
          if (!sid || !code) return
          if (st !== 'needOrder' && st !== 'inStock') return
          const key = `${sid}__${code}`
          nextBookOrderStateMap[key] = st
          nextBookOrderUpdatedAtMap[key] = String(r.updatedAt || '').trim()
        })

        const rawStudents = Array.isArray(studentsRes) ? studentsRes : studentsRes?.students || []
        const normalizedStudents = rawStudents.map((remote) =>
          normalizeStudentRecord(remote, nextSettings)
        )

        if (cancelled) return
        setSettings(nextSettings)
        setBookOrderStateMap(nextBookOrderStateMap)
        setBookOrderUpdatedAtMap(nextBookOrderUpdatedAtMap)
        setStudents(normalizedStudents)
        setLoadedBranches({ [currentBranch]: true })
        setGlobalsLoaded(true)
      } catch (error) {
        if (!cancelled) {
          setErrorMsg(error.message || '載入失敗')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadInitialData()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  useEffect(() => {
    let cancelled = false

    async function loadBranchStudents() {
      if (!globalsLoaded || loadedBranches[currentBranch]) return

      try {
        setLoading(true)
        setErrorMsg('')

        const studentsRes = await fetchStudents(currentBranch)
        const rawStudents = Array.isArray(studentsRes) ? studentsRes : studentsRes?.students || []
        const normalizedStudents = rawStudents.map((remote) =>
          normalizeStudentRecord(remote, settings)
        )

        if (cancelled) return

        setStudents((prev) => {
          const otherBranches = prev.filter((student) => student.branch !== currentBranch)
          return [...otherBranches, ...normalizedStudents]
        })
        setLoadedBranches((prev) => ({
          ...prev,
          [currentBranch]: true,
        }))
      } catch (error) {
        if (!cancelled) {
          setErrorMsg(error.message || '載入失敗')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadBranchStudents()
    return () => {
      cancelled = true
    }
  }, [currentBranch, globalsLoaded, loadedBranches, settings])

  const enrichedStudents = useMemo(() => {
    return students.map((student) => {
      const bookAlertSetCodes = student.scheduleLoaded
        ? getBookAlertSetCodes(student, settings.bookAlertDays)
        : []
      return {
        ...student,
        bookAlertSetCodes,
        bookAlertSetRanges: bookAlertSetCodes
          .map((code) => bookCodeToSet(code)?.setRange || code)
          .filter(Boolean),
        hasBookAlert: !!student.bookAlert || bookAlertSetCodes.length > 0,
        pendingConfirmState: getPendingConfirmState(student),
      }
    })
  }, [students, settings.bookAlertDays])

  const filteredStudents = useMemo(() => {
    return enrichedStudents.filter((student) => {
      const matchBranch = student.branch === currentBranch
      const matchSearch =
        !currentSearch ||
        student.name?.includes(currentSearch) ||
        String(student.grade || '').includes(currentSearch)

      const matchFilter =
        currentFilter === 'all' ||
        (currentFilter === 'warn' &&
          (student.status === 'warn' || student.status === 'danger')) ||
        (currentFilter === 'todayPending' && student.pendingConfirmState === 'today') ||
        (currentFilter === 'overduePending' && student.pendingConfirmState === 'overdue')

      return matchBranch && matchSearch && matchFilter
    })
  }, [enrichedStudents, currentBranch, currentSearch, currentFilter])

  const selectedStudent = useMemo(() => {
    return enrichedStudents.find((student) => student.id === selectedId) || null
  }, [enrichedStudents, selectedId])

  const branchStudents = useMemo(() => {
    return enrichedStudents.filter((student) => student.branch === currentBranch)
  }, [enrichedStudents, currentBranch])

  useEffect(() => {
    const hasSelected = branchStudents.some((student) => student.id === selectedId)
    if (!hasSelected) {
      setSelectedId(branchStudents[0]?.id || null)
    }
  }, [branchStudents, selectedId])

  const kpis = useMemo(() => {
    return {
      total: branchStudents.length,
      warn: branchStudents.filter((s) => s.status === 'warn' || s.status === 'danger').length,
    }
  }, [branchStudents])

  const mobileStudentLabel = selectedStudent?.name
    ? `目前學生：${selectedStudent.name}`
    : '選擇學生'
  const mobileModuleLabel = activeModule === 'schedule' ? '學習進度' : '訂購總覽'
  const mobileDrawerSummary = `${currentBranch}｜${mobileModuleLabel}｜${mobileStudentLabel}`

  const currentMarquee = useMemo(() => {
    if (currentBranch === '延壽') {
      return {
        enabled: !!settings.marqueeEnabledYanShou,
        message: String(settings.marqueeMsgYanShou || '').trim(),
        color: String(settings.marqueeColorYanShou || '#166534'),
        speed: Number(settings.marqueeSpeedYanShou || 16),
      }
    }
    if (currentBranch === '安和') {
      return {
        enabled: !!settings.marqueeEnabledAnHe,
        message: String(settings.marqueeMsgAnHe || '').trim(),
        color: String(settings.marqueeColorAnHe || '#166534'),
        speed: Number(settings.marqueeSpeedAnHe || 16),
      }
    }
    return {
      enabled: !!settings.marqueeEnabledDaZhi,
      message: String(settings.marqueeMsgDaZhi || '').trim(),
      color: String(settings.marqueeColorDaZhi || '#166534'),
      speed: Number(settings.marqueeSpeedDaZhi || 16),
    }
  }, [currentBranch, settings])

  const orderFilters = useMemo(
    () => ({
      search: orderSearch,
      timePreset: orderTimePreset,
      startDate: orderDateStart,
      endDate: orderDateEnd,
    }),
    [orderSearch, orderTimePreset, orderDateStart, orderDateEnd]
  )

  const orderSummaryRows = useMemo(() => {
    return buildOrderSummaryData({
      students: enrichedStudents,
      branch: currentBranch,
      filters: orderFilters,
      bookOrderStateMap,
      bookOrderUpdatedAtMap,
    })
  }, [enrichedStudents, currentBranch, orderFilters, bookOrderStateMap, bookOrderUpdatedAtMap])

  function toggleLevel(level) {
    setCollapsedLevels((prev) => ({
      ...prev,
      [level]: !prev[level],
    }))
  }

  function handleSelectStudent(id) {
    setSelectedId(id)
    setMobileSidebarOpen(false)

    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
    }
  }

  function handleToggleMobileDrawer() {
    setMobileSidebarOpen((prev) => !prev)
  }

  function handleCloseMobileDrawer() {
    setMobileSidebarOpen(false)
  }

  function handleSelectBranchMobile(branch) {
    setCurrentBranch(branch)
    setMobileSidebarOpen(false)
  }

  function handleSelectModuleMobile(module) {
    setActiveModule(module)
    setMobileSidebarOpen(false)
  }

  function handleOpenSettingsMobile() {
    setMobileSidebarOpen(false)
    handleOpenSettings()
  }

  function handleRefreshMobile() {
    setMobileSidebarOpen(false)
    handleRefresh()
  }

  async function preloadBranchSchedules(branch) {
    const { startDate, endDate } = getScheduleLoadWindow(settings)
    const branchStudentsToLoad = students.filter(
      (item) => item.branch === branch && !hasScheduleWindowLoaded(item, startDate, endDate)
    )

    if (!branchStudentsToLoad.length) return

    const targetIds = new Set(branchStudentsToLoad.map((item) => item.id))

    setStudents((prev) =>
      prev.map((item) =>
        targetIds.has(item.id)
          ? {
              ...item,
              scheduleLoading: true,
            }
          : item
      )
    )

    const results = await Promise.allSettled(
      branchStudentsToLoad.map((item) => fetchSchedule(item.id, startDate, endDate))
    )

    let firstError = ''
    const scheduleMap = new Map()

    results.forEach((result, index) => {
      const student = branchStudentsToLoad[index]
      if (result.status === 'fulfilled') {
        scheduleMap.set(student.id, normalizeScheduleRows(result.value?.rows || []))
      } else if (!firstError) {
        firstError = result.reason?.message || '載入學習進度表失敗'
      }
    })

    setStudents((prev) =>
      prev.map((item) => {
        if (!targetIds.has(item.id)) return item

        const scheduleTable = scheduleMap.get(item.id)
        if (!scheduleTable) {
          return {
            ...item,
            scheduleLoading: false,
          }
        }

        return {
          ...item,
          scheduleTable,
          scheduleLoaded: true,
          scheduleLoading: false,
          loadedScheduleStartDate: startDate,
          loadedScheduleEndDate: endDate,
        }
      })
    )

    if (firstError) {
      setErrorMsg(firstError)
    }
  }

  async function ensureScheduleLoaded(studentId) {
    const existing = students.find((item) => item.id === studentId)
    if (!existing) return []

    const { startDate, endDate } = getScheduleLoadWindow(settings)

    if (hasScheduleWindowLoaded(existing, startDate, endDate)) {
      return existing.scheduleTable || []
    }

    if (existing.scheduleLoading) {
      return existing.scheduleTable || []
    }

    setStudents((prev) =>
      prev.map((item) =>
        item.id === studentId
          ? {
              ...item,
              scheduleLoading: true,
            }
          : item
      )
    )

    try {
      const result = await fetchSchedule(studentId, startDate, endDate)
      const scheduleTable = normalizeScheduleRows(result?.rows || [])

      setStudents((prev) =>
        prev.map((item) =>
          item.id === studentId
            ? {
                ...item,
                scheduleTable,
                scheduleLoaded: true,
                scheduleLoading: false,
                loadedScheduleStartDate: startDate,
                loadedScheduleEndDate: endDate,
              }
            : item
        )
      )

      return scheduleTable
    } catch (error) {
      setStudents((prev) =>
        prev.map((item) =>
          item.id === studentId
            ? {
                ...item,
                scheduleLoading: false,
              }
            : item
        )
      )
      setErrorMsg(error.message || '載入學習進度表失敗')
      throw error
    }
  }

  useEffect(() => {
    if (!selectedId) return

    const target = students.find((item) => item.id === selectedId)
    const { startDate, endDate } = getScheduleLoadWindow(settings)
    const currentBranchStudents = students.filter((item) => item.branch === currentBranch)

    if (
      !target ||
      target.branch !== currentBranch ||
      !currentBranchStudents.length ||
      currentBranchStudents.every((item) => hasScheduleWindowLoaded(item, startDate, endDate)) ||
      currentBranchStudents.some((item) => item.scheduleLoading)
    ) {
      return
    }

    preloadBranchSchedules(currentBranch).catch((error) => {
      setErrorMsg(error.message || '載入學習進度表失敗')
    })
  }, [
    selectedId,
    currentBranch,
    students,
    settings.scheduleLoadPastDays,
    settings.scheduleLoadFutureDays,
  ])

  async function handleConfirmRow(payload) {
    const student = students.find((item) => item.id === payload.studentId)
    if (!student) return { ok: false, message: '找不到學生資料' }

    const forceInStockBooks = Array.from(
      new Set((payload.forceInStockBooks || []).map((book) => String(book || '').trim().toUpperCase()))
    ).filter(Boolean)

    if (forceInStockBooks.length) {
      const forceEntries = forceInStockBooks.map((bookCode) => ({
        bookCode,
        state: 'inStock',
      }))

      try {
        await saveBookOrderStates({
          studentId: payload.studentId,
          entries: forceEntries,
          operator: '主任',
        })

        applyBookOrderEntriesLocal(payload.studentId, forceEntries)

        const nowStr = nowTWDateTimeString()
        setBookOrderUpdatedAtMap((prev) => {
          const next = { ...prev }
          forceInStockBooks.forEach((code) => {
            next[`${payload.studentId}__${code}`] = nowStr
          })
          return next
        })
      } catch (error) {
        return { ok: false, message: error.message || '自動轉為 inStock 失敗，無法確認進度' }
      }
    }

    const targetIndex = payload.rowId
      ? (student.scheduleTable || []).findIndex((row) => row.rowId === payload.rowId)
      : Number(payload.rowIndex)

    const existingRow = (student.scheduleTable || [])[targetIndex]
    if (!existingRow) return { ok: false, message: '找不到待確認進度列' }

    const confirmedAt = nowTWDateTimeString()
    const nextRow = {
      ...existingRow,
      status: payload.status,
      note: payload.note || '',
      books: payload.books || [],
      hours: Number(payload.hours || 0),
      confirmedAt,
    }

    const newRemaining =
      Number(student.currentRemainingHours ?? student.confirmedHours ?? 0) - Number(nextRow.hours || 0)

    setStudents((prev) =>
      prev.map((item) => {
        if (item.id !== payload.studentId) return item

        const scheduleTable = [...(item.scheduleTable || [])]
        scheduleTable[targetIndex] = nextRow

        return {
          ...item,
          scheduleTable,
          currentRemainingHours: newRemaining,
          confirmedHours: newRemaining,
          status: calcStudentStatus(
            {
              ...item,
              currentRemainingHours: newRemaining,
            },
            settings
          ),
        }
      })
    )

    try {
      await confirmProgress({
        studentId: payload.studentId,
        rowId: nextRow.rowId || '',
        date: nextRow.date,
        hours: nextRow.hours,
        books: nextRow.books,
        status: nextRow.status,
        note: nextRow.note,
        confirmedAt,
        confirmedNo: student.confirmedNo,
        currentRemainingHours: newRemaining,
        confirmedHours: newRemaining,
      })
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error.message || '同步失敗' }
    }
  }

  async function handleAdjustHours(payload) {
    try {
      const result = await adjustStudentHours({
        studentId: payload.studentId,
        deltaHours: payload.deltaHours,
        note: payload.note || ' ',
        operator: '主任',
      })

      setStudents((prev) =>
        prev.map((item) => {
          if (item.id !== payload.studentId) return item

          const currentRemainingHours = Number(result.afterHours)
          const initHours = Number(result.afterInitHours)

          return {
            ...item,
            currentRemainingHours,
            confirmedHours: currentRemainingHours,
            initHours,
            status: calcStudentStatus(
              {
                ...item,
                currentRemainingHours,
              },
              settings
            ),
          }
        })
      )

      return { ok: true }
    } catch (error) {
      return { ok: false, message: error.message || '時數調整失敗' }
    }
  }

  function handleRefresh() {
    setRefreshKey((prev) => prev + 1)
  }

  function handleOpenSettings() {
    setMobileSidebarOpen(false)
    setSettingsOpen(true)
  }

  function handleOpenCreateStudent() {
    setErrorMsg('')
    setStudentManageMode('create')
    setStudentManageTarget(null)
    setStudentManageOpen(true)
  }

  function handleOpenEditStudent(student) {
    if (!student) return
    setErrorMsg('')
    setStudentManageMode('edit')
    setStudentManageTarget(student)
    setStudentManageOpen(true)
  }

  function handleCloseStudentManage() {
    if (studentManageSaving) return
    setStudentManageOpen(false)
    setStudentManageTarget(null)
  }

  function handleOpenSimulation(student) {
    setErrorMsg('')
    setSimulationStudent(student || null)
  }

  async function handleSaveSettings(nextSettingsForm) {
    try {
      const result = await saveSettingsApi(nextSettingsForm)
      const appliedSettings = applySystemSettings(result?.settings || nextSettingsForm)

      setSettings(appliedSettings)
      setStudents((prev) =>
        prev.map((item) => ({
          ...item,
          status: calcStudentStatus(item, appliedSettings),
        }))
      )

      return { ok: true }
    } catch (error) {
      return { ok: false, message: error.message || '儲存失敗' }
    }
  }

  async function handleSaveSimulation(studentId, form, rows) {
    try {
      const student = students.find((item) => item.id === studentId)
      if (!student) return { ok: false, message: '找不到學生資料' }

      const currentScheduleTable = student.scheduleLoaded
        ? student.scheduleTable || []
        : await ensureScheduleLoaded(studentId)

      const newRows = (rows || []).map((row) => ({
        rowId: generateClientRowId(),
        date: row.date,
        dow: row.dow,
        hours: Number(row.hours || 0),
        books: (row.books || []).map((book) => formatBookTokenLabel(book)).filter(Boolean),
        status: 'pending',
        note: '',
        confirmedAt: null,
      }))

      const keptRows = currentScheduleTable.filter((row) => {
        const rowDate = String(row.date || '').substring(0, 10)
        const isConfirmed =
          row.status === 'match' || row.status === 'behind' || row.status === 'ahead'
        if (rowDate < String(new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }))) {
          return true
        }
        return isConfirmed
      })

      const scheduleTable = [...keptRows, ...newRows].sort((a, b) => {
        const ad = String(a.date || '').substring(0, 10)
        const bd = String(b.date || '').substring(0, 10)
        if (ad !== bd) return ad > bd ? 1 : -1
        const ap = a.status === 'pending' ? 0 : 1
        const bp = b.status === 'pending' ? 0 : 1
        return ap - bp
      })

      const currentRemainingHours = Number(form.hours || 0)

      setStudents((prev) =>
        prev.map((item) => {
          if (item.id !== studentId) return item
          return {
            ...item,
            level: form.level,
            grade: Number(form.grade),
            confirmedNo: Number(form.startNo),
            speed: Number(form.speed),
            currentRemainingHours,
            confirmedHours: currentRemainingHours,
            orderAlertGapKByPerson: Number(form.orderAlertGapKByPerson || 0),
            schedule: [...(form.schedule || [])],
            scheduleTable,
            status: calcStudentStatus(
              {
                ...item,
                currentRemainingHours,
              },
              settings
            ),
          }
        })
      )

      const scheduleWindow = getScheduleLoadWindow(settings)

      await Promise.all([
        updateStudent({
          id: studentId,
          level: form.level,
          grade: Number(form.grade),
          confirmedNo: Number(form.startNo),
          speed: Number(form.speed),
          currentRemainingHours,
          confirmedHours: currentRemainingHours,
          orderAlertGapKByPerson: Number(form.orderAlertGapKByPerson || 0),
          mon: Number(form.schedule?.[0] || 0),
          tue: Number(form.schedule?.[1] || 0),
          wed: Number(form.schedule?.[2] || 0),
          thu: Number(form.schedule?.[3] || 0),
          fri: Number(form.schedule?.[4] || 0),
          sat: Number(form.schedule?.[5] || 0),
          sun: Number(form.schedule?.[6] || 0),
        }),
        saveSchedule({
          studentId,
          today: nowTWDateTimeString().substring(0, 10),
          replaceStartDate: scheduleWindow.startDate,
          replaceEndDate: scheduleWindow.endDate,
          rows: scheduleTable.map((row) => ({
            rowId: row.rowId || '',
            studentId,
            date: row.date,
            hours: row.hours,
            books: row.books,
            status: row.status,
            note: row.note || '',
            confirmedAt: row.confirmedAt || '',
          })),
        }),
      ])

      return { ok: true }
    } catch (error) {
      return { ok: false, message: error.message || '儲存失敗' }
    }
  }

  async function handleSaveStudent(payload, mode) {
    try {
      setStudentManageSaving(true)

      let result
      if (mode === 'edit') {
        result = await updateStudent(payload)
      } else {
        result = await addStudentApi(payload)
      }

      setCurrentBranch(payload.branch || currentBranch)
      setSelectedId(payload.id)
      setStudentManageOpen(false)
      setStudentManageTarget(null)

      // 方案 A：使用後端回傳的學生資料直接更新，避免重新載入整個列表
      if (mode === 'edit' && result?.student) {
        setStudents((prev) =>
          prev.map((s) => (s.id === result.student.id ? { ...s, ...result.student } : s))
        )
      } else {
        // 新增模式或後端未回傳學生資料時，仍需重新載入
        setRefreshKey((prev) => prev + 1)
      }

      return { ok: true }
    } catch (error) {
      return { ok: false, message: error.message || '學生資料儲存失敗' }
    } finally {
      setStudentManageSaving(false)
    }
  }

  async function handleDeleteStudent(studentId) {
    try {
      setStudentManageSaving(true)
      await deleteStudentApi({ studentId })

      if (selectedId === studentId) {
        setSelectedId(null)
      }

      setStudentManageOpen(false)
      setStudentManageTarget(null)
      setRefreshKey((prev) => prev + 1)
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error.message || '刪除學生失敗' }
    } finally {
      setStudentManageSaving(false)
    }
  }

  function applyBookOrderEntriesLocal(studentId, entries) {
    setBookOrderStateMap((prev) => {
      const next = { ...prev }
      ;(entries || []).forEach((entry) => {
        const code = String(entry.bookCode || '').trim().toUpperCase()
        if (!code) return
        const key = `${studentId}__${code}`
        const state = String(entry.state || '').trim()
        if (state === 'needOrder' || state === 'inStock') next[key] = state
        else delete next[key]
      })
      return next
    })
  }

  async function handleSyncMatrix(studentId) {
    const entries = Object.entries(bookOrderStateMap)
      .filter(([key, state]) => key.startsWith(`${studentId}__`) && (state === 'needOrder' || state === 'inStock'))
      .map(([key, state]) => ({
        bookCode: key.split('__')[1],
        state,
      }))

    if (!entries.length) {
      setStudentSyncMsgMap((prev) => ({ ...prev, [studentId]: 'ℹ 無可同步書號' }))
      return
    }

    setStudentSyncLockMap((prev) => ({ ...prev, [studentId]: true }))
    setStudentSyncMsgMap((prev) => ({ ...prev, [studentId]: '⏳ 同步中…' }))

    try {
      await saveBookOrderStates({
        studentId,
        entries,
        operator: '主任',
      })

      const nowStr = nowTWDateTimeString()
      setBookOrderUpdatedAtMap((prev) => {
        const next = { ...prev }
        entries.forEach((entry) => {
          const code = String(entry.bookCode || '').trim().toUpperCase()
          if (!code) return
          next[`${studentId}__${code}`] = nowStr
        })
        return next
      })

      setStudentSyncMsgMap((prev) => ({
        ...prev,
        [studentId]: `✅ 已同步（送出 ${entries.length} 筆）`,
      }))
    } catch (error) {
      setStudentSyncMsgMap((prev) => ({
        ...prev,
        [studentId]: `⚠ 同步失敗：${error.message || '未知錯誤'}`,
      }))
    } finally {
      setStudentSyncLockMap((prev) => ({ ...prev, [studentId]: false }))
    }
  }

  function handleMatrixCellClick(studentId, level, grade, no) {
    const code = `${level}${grade}${String(no).padStart(2, '0')}`
    const current = bookOrderStateMap[`${studentId}__${code}`] || ''
    const nextState = current === 'inStock' ? '' : 'inStock'
    applyBookOrderEntriesLocal(studentId, [{ bookCode: code, state: nextState }])
  }

  function handleOrderPrompt(studentId, context) {
    const entries = []
    ;(context?.sets || []).forEach((range) => {
      for (let no = range.start; no <= range.end; no += 1) {
        const code = `${context.level}${context.grade}${String(no).padStart(2, '0')}`
        if (bookOrderStateMap[`${studentId}__${code}`] === 'inStock') continue
        entries.push({ bookCode: code, state: 'needOrder' })
      }
    })
    applyBookOrderEntriesLocal(studentId, entries)
  }

  return (
    <div className="app-shell">
      <TopNav
        currentBranch={currentBranch}
        setCurrentBranch={setCurrentBranch}
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        onOpenSettings={handleOpenSettings}
        onRefresh={handleRefresh}
        mobileDrawerOpen={mobileSidebarOpen}
        onToggleMobileDrawer={handleToggleMobileDrawer}
      />

      {currentMarquee.enabled && currentMarquee.message ? (
        <div className="branch-marquee-wrap" title={`${currentBranch}分校公告`}>
          <div
            className="branch-marquee-track"
            style={{
              color: currentMarquee.color,
              animationDuration: `${currentMarquee.speed}s`,
            }}
          >
            <span>{currentMarquee.message}</span>
            <span aria-hidden="true">{currentMarquee.message}</span>
          </div>
        </div>
      ) : null}

      <div
        className={`mobile-drawer-backdrop ${mobileSidebarOpen ? 'open' : ''}`}
        onClick={handleCloseMobileDrawer}
      />
      <aside
        className={`mobile-drawer ${mobileSidebarOpen ? 'open' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mobile-drawer-header">
          <div className="mobile-drawer-title">功能選單</div>
          <button className="mobile-drawer-close" onClick={handleCloseMobileDrawer}>
            ✕
          </button>
        </div>

        <div className="mobile-drawer-section">
          <label className="mobile-drawer-label" htmlFor="mobile-branch-select">
            branch
          </label>
          <select
            id="mobile-branch-select"
            className="mobile-drawer-select"
            value={currentBranch}
            onChange={(e) => handleSelectBranchMobile(e.target.value)}
          >
            {BRANCHES.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
        </div>

        <div className="mobile-drawer-section">
          <div className="mobile-drawer-label">功能</div>
          <div className="nav-menu mobile-drawer-nav-menu">
            <button
              className={`nav-menu-btn ${activeModule === 'schedule' ? 'active' : ''}`}
              onClick={() => handleSelectModuleMobile('schedule')}
            >
              📚 學習進度
            </button>
            <button
              className={`nav-menu-btn ${activeModule === 'order' ? 'active' : ''}`}
              onClick={() => handleSelectModuleMobile('order')}
            >
              📦 書籍訂購
            </button>
          </div>
        </div>

        <div className="mobile-drawer-section">
          <div className="mobile-drawer-label">系統</div>
          <div className="mobile-drawer-action-list">
            <button className="mobile-drawer-action-btn" onClick={handleOpenSettingsMobile}>
              ⚙️ 系統設定
            </button>
            <button className="mobile-drawer-action-btn" onClick={handleRefreshMobile}>
              🔄 重新整理
            </button>
          </div>
        </div>

        <div className="mobile-drawer-section mobile-drawer-student-section">
          <div className="mobile-drawer-label">學生</div>
          <StudentSidebar
            loading={loading}
            errorMsg={errorMsg}
            currentSearch={currentSearch}
            setCurrentSearch={setCurrentSearch}
            currentFilter={currentFilter}
            setCurrentFilter={setCurrentFilter}
            filteredStudents={filteredStudents}
            collapsedLevels={collapsedLevels}
            toggleLevel={toggleLevel}
            selectedId={selectedId}
            setSelectedId={handleSelectStudent}
            onOpenCreateStudent={handleOpenCreateStudent}
          />
        </div>
      </aside>

      <div className="main-layout">
        <StudentSidebar
          loading={loading}
          errorMsg={errorMsg}
          currentSearch={currentSearch}
          setCurrentSearch={setCurrentSearch}
          currentFilter={currentFilter}
          setCurrentFilter={setCurrentFilter}
          filteredStudents={filteredStudents}
          collapsedLevels={collapsedLevels}
          toggleLevel={toggleLevel}
          selectedId={selectedId}
          setSelectedId={handleSelectStudent}
          onOpenCreateStudent={handleOpenCreateStudent}
        />

        <main className="content">
          {activeModule === 'schedule' ? (
            <>
              <div className="kpi-row">
                <div className="kpi-card">
                  <div className="kpi-icon blue">👥</div>
                  <div>
                    <div className="kpi-label">學生總數</div>
                    <div className="kpi-value">{kpis.total}</div>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon orange">⚠️</div>
                  <div>
                    <div
                      className="kpi-label"
                      title={`統計目前剩餘學習時數小於或等於 ${settings.lowHoursThreshold} 小時的學生人數。`}
                    >
                      時數不足預警
                    </div>
                    <div className="kpi-value warn">{kpis.warn}</div>
                  </div>
                </div>
              </div>

              <StudentDetailPanel
                selectedStudent={selectedStudent}
                settings={settings}
                bookOrderStateMap={bookOrderStateMap}
                matrixLevel={matrixLevelState[selectedId] || selectedStudent?.level || 'GK'}
                setMatrixLevel={(level) =>
                  setMatrixLevelState((prev) => ({ ...prev, [selectedId]: level }))
                }
                matrixScope={matrixScopeState[selectedId] || getDefaultMatrixScope(settings)}
                setMatrixScope={(scope) =>
                  setMatrixScopeState((prev) => ({ ...prev, [selectedId]: scope }))
                }
                syncLocked={!!studentSyncLockMap[selectedId]}
                syncMsg={studentSyncMsgMap[selectedId] || ''}
                onSyncMatrix={handleSyncMatrix}
                onMatrixCellClick={handleMatrixCellClick}
                onOrderPrompt={handleOrderPrompt}
                onOpenSimulation={handleOpenSimulation}
                onOpenStudentManage={handleOpenEditStudent}
                onConfirmRow={handleConfirmRow}
                onAdjustHours={handleAdjustHours}
                scheduleLoading={!!selectedStudent?.scheduleLoading}
              />
            </>
          ) : (
            <>
              <OrderSummaryView
                currentBranch={currentBranch}
                orderSearch={orderSearch}
                setOrderSearch={setOrderSearch}
                orderTimePreset={orderTimePreset}
                setOrderTimePreset={setOrderTimePreset}
                orderDateStart={orderDateStart}
                setOrderDateStart={setOrderDateStart}
                orderDateEnd={orderDateEnd}
                setOrderDateEnd={setOrderDateEnd}
                orderSummaryRows={orderSummaryRows}
              />
            </>
          )}
        </main>
      </div>

      <SimulationModal
        open={!!simulationStudent}
        student={simulationStudent}
        onClose={() => setSimulationStudent(null)}
        onSaveSimulation={handleSaveSimulation}
      />

      <StudentManageModal
        open={studentManageOpen}
        mode={studentManageMode}
        student={studentManageMode === 'edit' ? studentManageTarget : null}
        currentBranch={currentBranch}
        saving={studentManageSaving}
        defaultOrderAlertGapK={Number(settings.orderAlertGapK || 0)}
        onClose={handleCloseStudentManage}
        onSave={handleSaveStudent}
        onDelete={handleDeleteStudent}
      />

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
      />

      <div className="build-info">{buildInfoText}</div>
    </div>
  )
}

export default App