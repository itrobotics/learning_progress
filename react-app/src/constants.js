export const TODAY = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })

export const APP_SETTINGS_DEFAULT = {
  upTermStart: '2025-08-01',
  upTermEnd: '2026-01-31',
  downTermStart: '2026-02-01',
  downTermEnd: '2026-07-31',
  rowPerPage: 25,
  lowHoursThreshold: 4,
  orderAlertGapK: 4,
  bookAlertDays: 30,
  scheduleLoadPastDays: 30,
  scheduleLoadFutureDays: 60,
  marqueeMsgYanShou: '',
  marqueeEnabledYanShou: false,
  marqueeColorYanShou: '#166534',
  marqueeSpeedYanShou: 16,
  marqueeMsgAnHe: '',
  marqueeEnabledAnHe: false,
  marqueeColorAnHe: '#166534',
  marqueeSpeedAnHe: 16,
  marqueeMsgDaZhi: '',
  marqueeEnabledDaZhi: false,
  marqueeColorDaZhi: '#166534',
  marqueeSpeedDaZhi: 16,
}

export const RANGES = {
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

export const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

export const LEVEL_NAMES = {
  GK: '數學',
  GV: '語文',
  GA: '美語',
}

export const LEVELS = ['GK', 'GV', 'GA']
export const BRANCHES = ['延壽', '安和', '大直']