import { TODAY } from './constants'
import { buildBookProgressMap, formatBookTokenLabel, parseBookToken, validateMPMBook } from './bookUtils'
import { dateStrToISO } from './dateUtils'

export function getCurrentRemainingHours(student) {
  if (!student) return 0
  const value =
    student.currentRemainingHours !== undefined &&
    student.currentRemainingHours !== null &&
    student.currentRemainingHours !== ''
      ? student.currentRemainingHours
      : student.confirmedHours

  return Number(value || 0)
}

export function getTotalLearnedHours(student) {
  const purchased = Number(student?.initHours || 0)
  const remaining = getCurrentRemainingHours(student)
  return purchased - remaining
}

export function calcRealRemainingHours(student) {
  return getCurrentRemainingHours(student)
}

export function normalizeOrderAlertGapK(value, fallback = 4) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : Number(fallback || 4)
}

export function getStudentOrderAlertGapK(student, appSettings) {
  const globalK = normalizeOrderAlertGapK(appSettings?.orderAlertGapK, 4)
  if (!student) return globalK
  const personalK = normalizeOrderAlertGapK(student.orderAlertGapKByPerson, 0)
  return personalK > 0 ? personalK : globalK
}

export function calcStudentStatus(student, appSettings) {
  const real = calcRealRemainingHours(student)
  if (real <= 0) return 'danger'
  if (real <= Number(appSettings?.lowHoursThreshold || 4)) return 'warn'
  return 'ok'
}

export function normalizeProgressStatus(status) {
  const v = String(status || '').trim().toLowerCase()
  if (!v || v === 'none' || v === 'null') return 'none'
  if (v === 'planed' || v === 'planned' || v === 'pending') return 'pending'
  if (v === 'learned') return 'match'
  if (v === 'match' || v === 'behind' || v === 'ahead') return v
  return 'none'
}

export function isConfirmedProgressStatus(status) {
  const v = normalizeProgressStatus(status)
  return v === 'match' || v === 'behind' || v === 'ahead'
}

export function getLastConfirmedDate(student) {
  const confirmed = (student?.scheduleTable || []).filter(
    (row) => isConfirmedProgressStatus(row.status) && row.confirmedAt
  )
  if (!confirmed.length) return student?.confirmedAt || null
  confirmed.sort((a, b) => (a.confirmedAt > b.confirmedAt ? -1 : 1))
  return dateStrToISO(confirmed[0].confirmedAt)
}

export function getNextPendingRow(student) {
  const pending = (student?.scheduleTable || []).filter(
    (row) => normalizeProgressStatus(row.status) === 'pending'
  )
  if (!pending.length) return null

  pending.sort((a, b) => (dateStrToISO(a.date) > dateStrToISO(b.date) ? 1 : -1))
  const confirmable = pending.filter((row) => dateStrToISO(row.date) <= TODAY)
  return confirmable.length ? confirmable[confirmable.length - 1] : null
}

export function getCurrentBook(student) {
  const confirmed = (student?.scheduleTable || [])
    .filter((row) => isConfirmedProgressStatus(row.status) && Array.isArray(row.books) && row.books.length)
    .sort((a, b) => {
      const ad = dateStrToISO(a.date)
      const bd = dateStrToISO(b.date)
      if (ad !== bd) return ad > bd ? 1 : -1
      const ac = dateStrToISO(a.confirmedAt || '')
      const bc = dateStrToISO(b.confirmedAt || '')
      if (ac !== bc) return ac > bc ? 1 : -1
      return 0
    })

  for (let rowIdx = confirmed.length - 1; rowIdx >= 0; rowIdx -= 1) {
    const row = confirmed[rowIdx]
    const books = row.books || []

    for (let i = books.length - 1; i >= 0; i -= 1) {
      const normalized = formatBookTokenLabel(books[i])
      if (!normalized) continue
      if (parseBookToken(normalized)) return normalized
    }
  }

  const level = String(student?.level || '')
    .trim()
    .toUpperCase()
  const grade = Number(student?.grade)
  const confirmedNo = Math.floor(Number(student?.confirmedNo || 0))

  if (/^(GK|GV|GA)$/.test(level) && Number.isFinite(grade) && Number.isFinite(confirmedNo) && confirmedNo > 0) {
    const fallback = `${level}${grade}${String(confirmedNo).padStart(2, '0')}`
    if (validateMPMBook(fallback).valid) return fallback
  }

  return '—'
}

export function getDepletionDate(student) {
  let remaining = calcRealRemainingHours(student)
  if (remaining <= 0) return TODAY

  const weeklyTotal = (student.schedule || []).reduce((a, b) => a + Number(b || 0), 0)
  if (weeklyTotal <= 0) return TODAY

  const start = new Date(`${TODAY}T00:00:00`)
  for (let i = 0; i < 3660; i += 1) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const dow = d.getDay()
    const schedIdx = dow === 0 ? 6 : dow - 1
    const h = Number((student.schedule && student.schedule[schedIdx]) || 0)
    if (h <= 0) continue
    remaining -= h
    if (remaining <= 0) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`
    }
  }

  return TODAY
}

export function getLearnedBookProgressMap(student) {
  return buildBookProgressMap(
    student?.scheduleTable || [],
    (row) => isConfirmedProgressStatus(row.status) && Array.isArray(row.books)
  )
}

export function getPlannedBookProgressMap(student) {
  return buildBookProgressMap(
    student?.scheduleTable || [],
    (row) => normalizeProgressStatus(row.status) === 'pending' && Array.isArray(row.books)
  )
}

export function getLearnedBookSet(student) {
  return new Set([...getLearnedBookProgressMap(student).keys()])
}

export function getPlannedBookSet(student) {
  return new Set([...getPlannedBookProgressMap(student).keys()])
}