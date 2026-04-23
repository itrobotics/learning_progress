import { TODAY } from './constants'
import { bookCodeToSet } from './bookUtils'

export function parseOrderUpdatedAt(value) {
  const raw = String(value || '').trim()
  if (!raw) return null

  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/)
  if (m) {
    return new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4] || 0),
      Number(m[5] || 0),
      Number(m[6] || 0)
    )
  }

  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

export function matchesOrderTimeFilter(updatedAt, filters) {
  const preset = String(filters?.timePreset || 'all')
  if (preset === 'all') return true

  const updated = parseOrderUpdatedAt(updatedAt)
  if (!updated) return false

  if (preset === 'custom') {
    const start = filters?.startDate ? new Date(`${filters.startDate}T00:00:00`) : null
    const end = filters?.endDate ? new Date(`${filters.endDate}T23:59:59`) : null
    if (start && updated < start) return false
    if (end && updated > end) return false
    return true
  }

  const dayMap = { '30': 30, '90': 90, '180': 183 }
  const days = dayMap[preset]
  if (!days) return true

  const threshold = new Date(`${TODAY}T00:00:00`)
  threshold.setDate(threshold.getDate() - days)
  return updated >= threshold
}

export function buildOrderSummaryData({
  students,
  branch,
  filters = {},
  bookOrderStateMap = {},
  bookOrderUpdatedAtMap = {},
}) {
  const studentMap = {}
  ;(students || []).forEach((s) => {
    studentMap[s.id] = s
  })

  const setMap = {}

  Object.entries(bookOrderStateMap).forEach(([key, state]) => {
    if (state !== 'needOrder') return

    const dunder = key.indexOf('__')
    if (dunder < 0) return

    const sid = key.slice(0, dunder)
    const bookCode = key.slice(dunder + 2)
    const student = studentMap[sid]

    if (!student || student.branch !== branch) return

    const updatedAt = bookOrderUpdatedAtMap[key] || ''
    if (!matchesOrderTimeFilter(updatedAt, filters)) return

    const setInfo = bookCodeToSet(bookCode)
    if (!setInfo) return

    if (!setMap[setInfo.setKey]) {
      setMap[setInfo.setKey] = {
        setInfo,
        studentIds: new Set(),
      }
    }

    setMap[setInfo.setKey].studentIds.add(sid)
  })

  let rows = Object.values(setMap).map((entry) => {
    const studentNames = [...entry.studentIds].map((sid) => {
      const student = studentMap[sid]
      return student ? student.name : sid
    })

    return {
      ...entry,
      studentNames,
    }
  })

  const search = String(filters?.search || '').trim().toUpperCase()
  if (search) {
    rows = rows.filter(({ setInfo, studentNames }) => {
      if (String(setInfo.level || '').toUpperCase().includes(search)) return true
      return studentNames.some((name) => String(name || '').toUpperCase().includes(search))
    })
  }

  const levelOrder = { GK: 0, GV: 1, GA: 2 }
  return rows.sort((a, b) => {
    const al = levelOrder[a.setInfo.level] ?? 9
    const bl = levelOrder[b.setInfo.level] ?? 9
    if (al !== bl) return al - bl
    if (a.setInfo.grade !== b.setInfo.grade) return a.setInfo.grade - b.setInfo.grade
    return a.setInfo.setStart - b.setInfo.setStart
  })
}