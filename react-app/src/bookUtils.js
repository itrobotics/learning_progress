import { RANGES } from './constants'

export function getMPMBooks(level, grade) {
  const books = []
  for (const [s, e] of RANGES[level] || []) {
    for (let i = s; i <= e; i += 1) {
      books.push(`${level}${grade}${String(i).padStart(2, '0')}`)
    }
  }
  return books
}

export function parseBookToken(token) {
  const raw = String(token || '').trim().toUpperCase()
  const m = raw.match(/^(GK|GV|GA)(\d)(\d{2})(?:\((1\/2|2\/2)\))?$/)
  if (!m) return null

  const code = `${m[1]}${m[2]}${m[3]}`
  return {
    raw,
    code,
    level: m[1],
    grade: Number(m[2]),
    no: Number(m[3]),
    fraction: m[4] || 'full',
  }
}

export function normalizeBookTokenString(token) {
  const parsed = parseBookToken(token)
  return parsed ? parsed.raw : String(token || '').trim().toUpperCase()
}

export function getMainBookCode(token) {
  const parsed = parseBookToken(token)
  return parsed ? parsed.code : normalizeBookTokenString(token)
}

export function formatBookTokenLabel(token) {
  if (typeof token === 'string') return normalizeBookTokenString(token)
  if (token && typeof token === 'object') {
    const code = normalizeBookTokenString(token.book || '')
    if (!code) return ''
    return token.half ? `${code}(${token.half})` : code
  }
  return ''
}

export function buildBookProgressMap(rows, predicate) {
  const map = new Map()

  ;(rows || [])
    .filter(predicate)
    .forEach((r) => {
      ;(r.books || []).forEach((token) => {
        const parsed = parseBookToken(token)
        if (!parsed) return

        const current = map.get(parsed.code) || {
          full: false,
          half1: false,
          half2: false,
        }

        if (parsed.fraction === 'full') current.full = true
        if (parsed.fraction === '1/2') current.half1 = true
        if (parsed.fraction === '2/2') current.half2 = true

        map.set(parsed.code, current)
      })
    })

  return map
}

export function isBookProgressComplete(info) {
  return !!(info && (info.full || (info.half1 && info.half2)))
}

export function generateClientRowId() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID()
  return `row_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function getLegalNoSet(level) {
  const ranges = RANGES[level] || []
  const set = new Set()

  ranges.forEach(([st, ed]) => {
    for (let n = st; n <= ed; n += 1) set.add(n)
  })

  return set
}

export function getLevelMaxNo(level) {
  if (level === 'GV') return 88
  return 80
}

export function getSetRangeByNo(no) {
  const st = Math.floor((Number(no) - 1) / 8) * 8 + 1
  return { start: st, end: st + 7 }
}

export function bookCodeToSet(bookCode) {
  const m = String(bookCode || '')
    .trim()
    .toUpperCase()
    .match(/^(GK|GV|GA)(\d)(\d{2})$/)

  if (!m) return null

  const level = m[1]
  const grade = Number(m[2])
  const no = Number(m[3])
  const setStart = Math.floor((no - 1) / 8) * 8 + 1
  const setEnd = setStart + 7
  const pad = (n) => String(n).padStart(2, '0')

  return {
    level,
    grade,
    no,
    setStart,
    setEnd,
    setKey: `${level}${grade}${pad(setStart)}`,
    setRange: `${level}${grade}${pad(setStart)}~${level}${grade}${pad(setEnd)}`,
  }
}

export function validateMPMBook(book, options = {}) {
  const b = String(book || '').trim().toUpperCase()
  const parsed = parseBookToken(b)

  if (!parsed) {
    return {
      valid: false,
      normalized: b,
      reason: '格式需為 GK201、GK201(1/2) 或 GK201(2/2)',
    }
  }

  const level = parsed.level
  const grade = parsed.grade
  const no = parsed.no
  const ranges = {
    GK: [
      [1, 40],
      [41, 80],
    ],
    GV: [
      [1, 24],
      [33, 56],
      [65, 88],
    ],
    GA: [
      [1, 24],
      [33, 56],
      [65, 80],
    ],
  }

  if (grade < 0 || grade > 6) {
    return { valid: false, normalized: b, reason: `年級需為 0~6（收到 ${grade}）` }
  }

  if (!ranges[level].some(([s, e]) => no >= s && no <= e)) {
    return {
      valid: false,
      normalized: b,
      reason: `${level} 合法書號範圍不含 ${String(no).padStart(2, '0')}`,
    }
  }

  if (options.expectedLevel && level !== options.expectedLevel) {
    return { valid: false, normalized: b, reason: `Level 需為 ${options.expectedLevel}` }
  }

  if (
    options.expectedGrade !== undefined &&
    options.expectedGrade !== null &&
    String(options.expectedGrade).trim() !== '' &&
    grade !== Number(options.expectedGrade)
  ) {
    return { valid: false, normalized: b, reason: `年級需為 ${options.expectedGrade}` }
  }

  return {
    valid: true,
    normalized: parsed.raw,
    level,
    grade,
    no,
    code: parsed.code,
    fraction: parsed.fraction,
  }
}