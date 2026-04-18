import { APP_SETTINGS_DEFAULT, TODAY } from './constants'

export function dateStrToISO(slashDate) {
  if (!slashDate) return ''
  const s = String(slashDate).trim().replace(/\//g, '-')
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) {
    return `${m[1]}-${String(Number(m[2])).padStart(2, '0')}-${String(Number(m[3])).padStart(2, '0')}`
  }
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) {
    return toTWDateTimeString(d).substring(0, 10)
  }
  return s.substring(0, 10)
}

export function toTWDateTimeString(input) {
  if (!input) return ''

  const raw = String(input).trim()
  const m = raw.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
  )

  if (m) {
    const mo = String(Number(m[2])).padStart(2, '0')
    const dd = String(Number(m[3])).padStart(2, '0')
    const hh = String(Number(m[4] || 0)).padStart(2, '0')
    const mm = String(Number(m[5] || 0)).padStart(2, '0')
    const ss = String(Number(m[6] || 0)).padStart(2, '0')
    return `${m[1]}-${mo}-${dd} ${hh}:${mm}:${ss}`
  }

  const d = input instanceof Date ? input : new Date(input)
  if (!Number.isNaN(d.getTime())) {
    const fmt = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    return fmt.format(d)
  }

  return raw
}

export function normalizeSheetDate(d) {
  return toTWDateTimeString(d)
}

export function formatDateTimeForUI(d) {
  if (!d) return '—'
  return normalizeSheetDate(d).replace(/-/g, '/')
}

export function formatDateForUI(d) {
  const iso = dateStrToISO(d)
  if (!iso) return '—'
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return String(d)
  return `${Number(m[1])}/${Number(m[2])}/${Number(m[3])}`
}

export function nowTWDateTimeString() {
  return toTWDateTimeString(new Date())
}

export function parseMdToNum(md) {
  const m = String(md || '').match(/^(\d{2})\/(\d{2})$/)
  if (!m) return null
  return Number(m[1]) * 100 + Number(m[2])
}

function normalizeTermBoundary(value) {
  const iso = dateStrToISO(value)
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  return ''
}

export function getCurrentTermRange(todayIso = TODAY, appSettings = APP_SETTINGS_DEFAULT) {
  const today = dateStrToISO(todayIso) || TODAY
  const upStart = normalizeTermBoundary(appSettings.upTermStart)
  const upEnd = normalizeTermBoundary(appSettings.upTermEnd)
  const downStart = normalizeTermBoundary(appSettings.downTermStart)
  const downEnd = normalizeTermBoundary(appSettings.downTermEnd)

  if (upStart && upEnd && today >= upStart && today <= upEnd) {
    return { start: upStart, end: upEnd, label: '上學期' }
  }

  if (downStart && downEnd && today >= downStart && today <= downEnd) {
    return { start: downStart, end: downEnd, label: '下學期' }
  }

  if (upStart && upEnd) {
    return { start: upStart, end: upEnd, label: '上學期' }
  }

  if (downStart && downEnd) {
    return { start: downStart, end: downEnd, label: '下學期' }
  }

  const y = Number(String(today).split('-')[0]) || new Date().getFullYear()
  return { start: `${y}-02-01`, end: `${y}-07-31`, label: '下學期' }
}

export function inCurrentTerm(dateStr, appSettings = APP_SETTINGS_DEFAULT, todayIso = TODAY) {
  const iso = dateStrToISO(dateStr)
  if (!iso) return false
  const term = getCurrentTermRange(todayIso, appSettings)
  return iso >= term.start && iso <= term.end
}

export function getDowZh(dateStr, dowHint) {
  const hint = String(dowHint || '').trim()
  if (/^[一二三四五六日]$/.test(hint)) return hint
  if (/^[0-6]$/.test(hint)) return ['日', '一', '二', '三', '四', '五', '六'][Number(hint)]

  const iso = dateStrToISO(dateStr)
  const d = iso ? new Date(`${iso}T00:00:00`) : null
  if (d && !Number.isNaN(d.getTime())) {
    return ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  }
  return hint || '—'
}