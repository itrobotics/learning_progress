const SHEET_ID = '14Yz06z4e8g3DxiRb7Bh8hnY6GSjs6Ghni1pB98exYVk';
const TZ = 'Asia/Taipei';

const DEFAULT_SETTINGS = {
  upTermStart: '08/01',
  upTermEnd: '01/31',
  downTermStart: '02/01',
  downTermEnd: '07/31',
  rowPerPage: '25',
  lowHoursThreshold: '4',
  orderAlertGapK: '4',
  bookAlertDays: '30',
  scheduleLoadPastDays: '30',
  scheduleLoadFutureDays: '60',
  marqueeMsgYanShou: '',
  marqueeEnabledYanShou: 'false',
  marqueeColorYanShou: '#166534',
  marqueeSpeedYanShou: '16',
  marqueeMsgAnHe: '',
  marqueeEnabledAnHe: 'false',
  marqueeColorAnHe: '#166534',
  marqueeSpeedAnHe: '16',
  marqueeMsgDaZhi: '',
  marqueeEnabledDaZhi: 'false',
  marqueeColorDaZhi: '#166534',
  marqueeSpeedDaZhi: '16'
};

const STUDENT_REQUIRED_COLUMNS = ['orderAlertGapKByPerson', 'note'];
const SCHEDULE_REQUIRED_COLUMNS = ['rowId'];

function normalizeProgressStatus_(st) {
  const v = String(st || '').trim().toLowerCase();
  if (!v || v === 'none' || v === 'null') return 'none';
  if (v === 'planed' || v === 'planned' || v === 'pending') return 'pending';
  if (v === 'learned') return 'match';
  if (v === 'match' || v === 'behind' || v === 'ahead') return v;
  return 'none';
}

function ensureStudentColumns_(ss) {
  const sh = ss.getSheetByName('學生設定');
  if (!sh) return null;

  const rows = sh.getDataRange().getValues();
  if (!rows.length) return sh;

  const headers = (rows[0] || []).map(h => String(h || '').trim());
  let lastCol = headers.length;

  STUDENT_REQUIRED_COLUMNS.forEach(col => {
    if (headers.indexOf(col) >= 0) return;
    lastCol += 1;
    sh.getRange(1, lastCol).setValue(col);
    headers.push(col);
  });

  return sh;
}

function generateRowId_() {
  return Utilities.getUuid();
}

function clearManagedSheetValidations_(sh) {
  if (!sh) return;
  const maxRows = sh.getMaxRows();
  const maxCols = sh.getMaxColumns();
  if (maxRows <= 0 || maxCols <= 0) return;
  sh.getRange(1, 1, maxRows, maxCols).clearDataValidations();
}

function ensureScheduleColumns_(ss) {
  const sh = ss.getSheetByName('學習進度表');
  if (!sh) return null;

  const rows = sh.getDataRange().getValues();
  if (!rows.length) {
    sh.appendRow(['studentId', 'date', 'hours', 'books', 'status', 'note', 'confirmedAt', 'rowId']);
    return sh;
  }

  const headers = (rows[0] || []).map(h => String(h || '').trim());
  let lastCol = headers.length;

  SCHEDULE_REQUIRED_COLUMNS.forEach(col => {
    if (headers.indexOf(col) >= 0) return;
    lastCol += 1;
    sh.getRange(1, lastCol).setValue(col);
    headers.push(col);
  });

  const rowIdIdx = headers.indexOf('rowId');
  if (rowIdIdx >= 0 && rows.length > 1) {
    const idValues = [];
    let needsFill = false;
    for (let i = 1; i < rows.length; i++) {
      const existing = String(rows[i][rowIdIdx] || '').trim();
      const value = existing || generateRowId_();
      if (!existing) needsFill = true;
      idValues.push([value]);
    }
    if (needsFill) {
      sh.getRange(2, rowIdIdx + 1, idValues.length, 1).setValues(idValues);
    }
  }

  return sh;
}

function normalizeSettingKey_(k) {
  const key = String(k || '').trim();
  const lower = key.toLowerCase();
  const map = {
    uptermstart: 'upTermStart',
    uptermend: 'upTermEnd',
    downtermstart: 'downTermStart',
    downtermend: 'downTermEnd',
    rowperpage: 'rowPerPage',
    lowhoursthreshold: 'lowHoursThreshold',
    orderalertgapk: 'orderAlertGapK',
    bookalertdays: 'bookAlertDays',
    scheduleloadpastdays: 'scheduleLoadPastDays',
    scheduleloadfuturedays: 'scheduleLoadFutureDays',
    marqueemsgyanshou: 'marqueeMsgYanShou',
    marqueeenabledyanshou: 'marqueeEnabledYanShou',
    marqueecoloryanshou: 'marqueeColorYanShou',
    marqueespeedyanshou: 'marqueeSpeedYanShou',
    marqueemsganhe: 'marqueeMsgAnHe',
    marqueeenabledanhe: 'marqueeEnabledAnHe',
    marqueecoloranhe: 'marqueeColorAnHe',
    marqueespeedanhe: 'marqueeSpeedAnHe',
    marqueemsgdazhi: 'marqueeMsgDaZhi',
    marqueeenableddazhi: 'marqueeEnabledDaZhi',
    marqueecolordazhi: 'marqueeColorDaZhi',
    marqueespeeddazhi: 'marqueeSpeedDaZhi',
    '時數不足預警數量': 'lowHoursThreshold',
    '新套書預警天數': 'bookAlertDays'
  };
  return map[lower] || key;
}

function ensureBookOrderStateSheet_(ss) {
  let sh = ss.getSheetByName('book_order_state');
  if (!sh) sh = ss.insertSheet('book_order_state');

  const headers = ['studentId', 'bookCode', 'state', 'updatedAt', 'updatedBy'];
  const current = sh.getDataRange().getValues();
  if (!current.length || String(current[0][0]).trim() !== 'studentId') {
    sh.clear();
    sh.appendRow(headers);
  }
  return sh;
}

function getBookOrderStates(studentId) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName('book_order_state');
  if (!sh) return {rows: []};
  const rows = sh.getDataRange().getValues();
  const headers = rows[0] || [];
  const sidIdx = headers.indexOf('studentId');
  const codeIdx = headers.indexOf('bookCode');
  const stateIdx = headers.indexOf('state');
  const atIdx = headers.indexOf('updatedAt');
  const byIdx = headers.indexOf('updatedBy');

  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const sid = String(rows[i][sidIdx] || '').trim();
    const code = String(rows[i][codeIdx] || '').trim();
    const state = String(rows[i][stateIdx] || '').trim();
    if (!sid || !code) continue;
    if (studentId && sid !== studentId) continue;
    if (state !== 'needOrder' && state !== 'inStock') continue;

    result.push({
      studentId: sid,
      bookCode: code,
      state,
      updatedAt: atIdx >= 0 ? fmtDateTime(rows[i][atIdx]) : '',
      updatedBy: byIdx >= 0 ? String(rows[i][byIdx] || '') : ''
    });
  }
  return {rows: result};
}

function saveBookOrderStates(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const studentId = String(data.studentId || '').trim();
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const operator = String(data.operator || 'system').trim() || 'system';
    if (!studentId) return {error: 'studentId required'};
    if (!entries.length) return {success: true, updated: 0};

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sh = ensureBookOrderStateSheet_(ss);
    const rows = sh.getDataRange().getValues();
    const headers = rows[0] || [];
    const sidIdx = headers.indexOf('studentId');
    const codeIdx = headers.indexOf('bookCode');
    const stateIdx = headers.indexOf('state');
    const atIdx = headers.indexOf('updatedAt');
    const byIdx = headers.indexOf('updatedBy');

    const rowMap = {};
    for (let i = 1; i < rows.length; i++) {
      const sid = String(rows[i][sidIdx] || '').trim();
      const code = String(rows[i][codeIdx] || '').trim().toUpperCase();
      if (!sid || !code) continue;
      rowMap[`${sid}__${code}`] = i + 1;
    }

    let updated = 0;
    let inserted = 0;
    let ignored = 0;
    const updatedCodes = [];
    const insertedCodes = [];
    const ignoredCodes = [];
    const requestedCodes = [];

    const updateOps = [];
    const insertOps = [];

    entries.forEach(e => {
      const code = String(e.bookCode || '').trim().toUpperCase();
      let state = String(e.state || '').trim();
      if (!code) return;
      requestedCodes.push(code);
      if (state !== 'needOrder' && state !== 'inStock') state = '';

      const key = `${studentId}__${code}`;
      const targetRow = rowMap[key];

      if (targetRow) {
        updateOps.push({ row: targetRow, code, state });
        updated++;
        updatedCodes.push(code);
      } else if (state === 'needOrder' || state === 'inStock') {
        insertOps.push({ code, state });
        inserted++;
        insertedCodes.push(code);
      } else {
        // state 為空值且不存在列時，不新增空白列
        ignored++;
        ignoredCodes.push(code);
      }
    });

    // 更新既有列
    updateOps.forEach(op => {
      const nowStr = fmtDateTime(new Date());
      sh.getRange(op.row, stateIdx + 1).setValue(op.state);
      if (atIdx >= 0) sh.getRange(op.row, atIdx + 1).setValue(nowStr);
      if (byIdx >= 0) sh.getRange(op.row, byIdx + 1).setValue(operator);
    });

    // 批次新增新列（避免逐筆 appendRow）
    if (insertOps.length) {
      const startRow = sh.getLastRow() + 1;
      const appendValues = insertOps.map(op => [
        studentId,
        op.code,
        op.state,
        fmtDateTime(new Date()),
        operator
      ]);
      sh.getRange(startRow, 1, appendValues.length, 5).setValues(appendValues);
    }

    SpreadsheetApp.flush();

    // 寫入後驗證：確認 insertedCodes 實際落地
    const afterRows = sh.getDataRange().getValues();
    const persistedSet = new Set();
    for (let i = 1; i < afterRows.length; i++) {
      const sid = String(afterRows[i][sidIdx] || '').trim();
      const code = String(afterRows[i][codeIdx] || '').trim().toUpperCase();
      if (sid !== studentId || !code) continue;
      persistedSet.add(code);
    }
    const missingPersistedInsertedCodes = insertedCodes.filter(code => !persistedSet.has(code));

    return {
      success: true,
      requested: requestedCodes.length,
      requestedCodes,
      updated,
      inserted,
      ignored,
      updatedCodes,
      insertedCodes,
      ignoredCodes,
      missingPersistedInsertedCodes
    };
  } finally {
    lock.releaseLock();
  }
}

function getSystemSettings() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName('setting');
  const result = Object.assign({}, DEFAULT_SETTINGS);
  if (!sh) return result;

  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const rawKey = rows[i][0];
    if (!rawKey) continue;
    const key = normalizeSettingKey_(rawKey);
    const val = rows[i][1];
    result[key] = String(val === undefined || val === null ? '' : val).trim();
  }
  return result;
}

function normalizeSettingValue_(key, value) {
  const raw = String(value === undefined || value === null ? '' : value).trim();

  if (key === 'upTermStart' || key === 'upTermEnd' || key === 'downTermStart' || key === 'downTermEnd') {
    const full = raw.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
    if (!full) throw new Error(`${key} 格式需為 YYYY-MM-DD`);
    const yy = Number(full[1]);
    const mm = Number(full[2]);
    const dd = Number(full[3]);
    if (yy < 2000 || yy > 2100 || mm < 1 || mm > 12 || dd < 1 || dd > 31) {
      throw new Error(`${key} 日期範圍不合法`);
    }
    return `${String(yy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }

  if (
    key === 'rowPerPage' ||
    key === 'lowHoursThreshold' ||
    key === 'orderAlertGapK' ||
    key === 'bookAlertDays' ||
    key === 'scheduleLoadPastDays' ||
    key === 'scheduleLoadFutureDays' ||
    key === 'marqueeSpeedYanShou' ||
    key === 'marqueeSpeedAnHe' ||
    key === 'marqueeSpeedDaZhi'
  ) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`${key} 需為大於 0 的數字`);
    return String(Math.floor(n));
  }

  if (
    key === 'marqueeEnabledYanShou' ||
    key === 'marqueeEnabledAnHe' ||
    key === 'marqueeEnabledDaZhi'
  ) {
    const normalized = String(raw).trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') return 'true';
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === '') return 'false';
    throw new Error(`${key} 需為 true 或 false`);
  }

  if (
    key === 'marqueeColorYanShou' ||
    key === 'marqueeColorAnHe' ||
    key === 'marqueeColorDaZhi'
  ) {
    if (raw && !raw.match(/^#[0-9A-Fa-f]{6}$/)) {
      throw new Error(`${key} 格式需為 #RRGGBB`);
    }
    return raw || '#166534';
  }

  return raw;
}

function saveSettings(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sh = ensureSettingSheet_(ss);
    const settings = data.settings || {};
    const rows = sh.getDataRange().getValues();

    const rowMap = {};
    for (let i = 1; i < rows.length; i++) {
      const key = normalizeSettingKey_(rows[i][0]);
      if (key) rowMap[key] = i + 1;
    }

    const saved = {};
    Object.keys(DEFAULT_SETTINGS).forEach(key => {
      if (settings[key] === undefined) return;
      const normalizedValue = normalizeSettingValue_(key, settings[key]);
      const targetRow = rowMap[key];
      if (targetRow) {
        sh.getRange(targetRow, 2).setValue(normalizedValue);
      } else {
        sh.appendRow([key, normalizedValue]);
      }
      saved[key] = normalizedValue;
    });

    SpreadsheetApp.flush();
    return {
      success: true,
      settings: Object.assign({}, getSystemSettings(), saved)
    };
  } finally {
    lock.releaseLock();
  }
}

function ensureSettingSheet_(ss) {
  let sh = ss.getSheetByName('setting');
  if (!sh) sh = ss.insertSheet('setting');

  const rows = sh.getDataRange().getValues();
  if (!rows.length) {
    sh.appendRow(['key', 'value']);
  } else {
    const h1 = String(rows[0][0] || '').trim().toLowerCase();
    const h2 = String(rows[0][1] || '').trim().toLowerCase();
    if (h1 !== 'key' || h2 !== 'value') {
      sh.clear();
      sh.appendRow(['key', 'value']);
    }
  }

  const kvRows = sh.getDataRange().getValues();
  const existing = new Set();
  for (let i = 1; i < kvRows.length; i++) {
    const k = normalizeSettingKey_(kvRows[i][0]);
    if (k) existing.add(k);
  }
  Object.keys(DEFAULT_SETTINGS).forEach(k => {
    if (!existing.has(k)) sh.appendRow([k, DEFAULT_SETTINGS[k]]);
  });

  return sh;
}

// ── 日期格式化（台灣時區）──
// Apps Script 的 getValues() 回傳 Date 物件，但 instanceof Date 可能失效
// 改用 getFullYear 判斷
function parseDateSafe_(v) {
  if (!v) return null;

  if (typeof v.getFullYear === 'function') {
    const t = v.getTime();
    return isNaN(t) ? null : v;
  }

  const s = String(v).trim();
  if (!s) return null;

  // 支援 yyyy-M-d / yyyy/M/d / yyyy-MM-dd
  const m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const hh = Number(m[4] || 0);
    const mm = Number(m[5] || 0);
    const ss = Number(m[6] || 0);
    const parsed = new Date(y, mo, d, hh, mm, ss);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  try {
    const parsed = new Date(s);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch (e) {
    return null;
  }
}

function fmtDateOnly(v) {
  if (!v) return '';
  const d = parseDateSafe_(v);
  if (d) return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');

  // 最後保底：盡量正規化為 yyyy-MM-dd
  const s = String(v).trim();
  const m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (m) {
    return [m[1], String(Number(m[2])).padStart(2, '0'), String(Number(m[3])).padStart(2, '0')].join('-');
  }
  return s;
}

function fmtDateTime(v) {
  if (!v) return '';
  const d = parseDateSafe_(v);
  if (d) return Utilities.formatDate(d, TZ, 'yyyy-MM-dd HH:mm:ss');

  const s = String(v).trim();
  const m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (m) {
    const y = m[1];
    const mo = String(Number(m[2])).padStart(2, '0');
    const d2 = String(Number(m[3])).padStart(2, '0');
    const hh = String(Number(m[4] || 0)).padStart(2, '0');
    const mm = String(Number(m[5] || 0)).padStart(2, '0');
    const ss = String(Number(m[6] || 0)).padStart(2, '0');
    return `${y}-${mo}-${d2} ${hh}:${mm}:${ss}`;
  }

  return s;
}

function corsResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    const branch = e.parameter.branch || '';
    if (action === 'getAllData') return corsResponse(getAllData(branch));
    if (action === 'getSettings') return corsResponse({settings: getSystemSettings()});
    if (action === 'getBookOrderStates') return corsResponse(getBookOrderStates(e.parameter.studentId || ''));
    if (action === 'getStudents') return corsResponse(getStudents(branch));
    if (action === 'getSchedule') {
      return corsResponse(
        getSchedule(
          e.parameter.studentId,
          e.parameter.startDate || '',
          e.parameter.endDate || ''
        )
      );
    }
    return corsResponse({error: 'unknown action: ' + action});
  } catch(err) {
    return corsResponse({error: err.message});
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    if (action === 'saveSchedule') return corsResponse(saveSchedule(data));
    if (action === 'confirmProgress') return corsResponse(confirmProgress(data));
    if (action === 'adjustStudentHours') return corsResponse(adjustStudentHours(data));
    if (action === 'saveBookOrderStates') return corsResponse(saveBookOrderStates(data));
    if (action === 'addStudent') return corsResponse(addStudent(data));
    if (action === 'updateStudent') return corsResponse(updateStudent(data));
    if (action === 'deleteStudent') return corsResponse(deleteStudent(data));
    if (action === 'saveSettings') return corsResponse(saveSettings(data));
    if (action === 'setupSheets') return corsResponse(setupSheets());
    return corsResponse({error: 'unknown action: ' + action});
  } catch(err) {
    return corsResponse({error: err.message});
  }
}

function getAllData(branch) {
  const students = getStudents(branch);
  students.forEach(s => {
    s.scheduleTable = getSchedule(s.id).rows;
  });
  return {
    students,
    settings: getSystemSettings(),
    bookOrderStates: getBookOrderStates().rows
  };
}

function getStudents(branch) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName('學生設定');
  if (!sh) return [];
  const rows = sh.getDataRange().getValues();
  const headers = rows[0];
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = r[idx]; });
    if (branch && obj.branch !== branch) continue;
    obj.grade = Number(obj.grade);
    obj.speed = Number(obj.speed);
    obj.confirmedNo = Number(obj.confirmedNo);

    // initHours：主任可調整的初始(剩餘)時數
    obj.initHours = Number(obj.initHours || 0);

    // currentRemainingHours：目前剩餘時數（新欄位）
    // 相容舊欄位 confirmedHours
    const currentRemainingRaw =
      (obj.currentRemainingHours !== '' && obj.currentRemainingHours !== undefined)
        ? obj.currentRemainingHours
        : obj.confirmedHours;
    obj.currentRemainingHours = Number(currentRemainingRaw || 0);

    // 相容舊前端：先保留 confirmedHours 同值輸出
    obj.confirmedHours = obj.currentRemainingHours;

    obj.schedule = [
      Number(obj.mon), Number(obj.tue), Number(obj.wed),
      Number(obj.thu), Number(obj.fri), Number(obj.sat), Number(obj.sun)
    ];

    const personalGapRaw =
      obj.orderAlertGapKByPerson !== undefined ? obj.orderAlertGapKByPerson :
      (obj.orderAlertGapK_byperson !== undefined ? obj.orderAlertGapK_byperson : obj.orderAlertGapK_byperseon);
    obj.orderAlertGapKByPerson = Number(personalGapRaw || 0);
    obj.note = String(obj.note || '').trim();

    result.push(obj);
  }
  return result;
}

function getSchedule(studentId, startDate, endDate) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName('學習進度表');
  if (!sh) return {rows: []};
  const rows = sh.getDataRange().getValues();
  const headers = rows[0];
  const result = [];
  const normalizedStartDate = fmtDateOnly(startDate);
  const normalizedEndDate = fmtDateOnly(endDate);

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      if (h === 'date') {
        obj[h] = fmtDateOnly(r[idx]);
      } else if (h === 'confirmedAt') {
        obj[h] = fmtDateTime(r[idx]);
      } else if (h === 'books') {
        const raw = r[idx];
        obj[h] = raw ? String(raw).split(',').map(b => b.trim()).filter(Boolean) : [];
      } else if (h === 'hours') {
        obj[h] = Number(r[idx]);
      } else if (h === 'status') {
        obj[h] = normalizeProgressStatus_(r[idx]);
      } else {
        obj[h] = r[idx];
      }
    });
    if (studentId && obj.studentId !== studentId) continue;

    const rowDate = fmtDateOnly(obj.date);
    if (normalizedStartDate && rowDate && rowDate < normalizedStartDate) continue;
    if (normalizedEndDate && rowDate && rowDate > normalizedEndDate) continue;

    result.push(obj);
  }
  return {rows: result};
}

function confirmProgress(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sh = ensureScheduleColumns_(ss) || ss.getSheetByName('學習進度表');
    const rows = sh.getDataRange().getValues();
    const headers = rows[0];
    const dateCol       = headers.indexOf('date');
    const sidCol        = headers.indexOf('studentId');
    const statusCol     = headers.indexOf('status');
    const noteCol       = headers.indexOf('note');
    const confirmedAtCol= headers.indexOf('confirmedAt');
    const hoursCol      = headers.indexOf('hours');
    const booksCol      = headers.indexOf('books');
    const rowIdCol      = headers.indexOf('rowId');

    let targetRow = -1;
    const reqRowId = String(data.rowId || '').trim();

    if (reqRowId && rowIdCol >= 0) {
      for (let i = 1; i < rows.length; i++) {
        const rowRowId = String(rows[i][rowIdCol] || '').trim();
        if (rowRowId === reqRowId) {
          targetRow = i + 1;
          break;
        }
      }
    }

    if (targetRow < 0) {
      let fallbackRow = -1;
      const reqDate = fmtDateOnly(data.date);
      for (let i = 1; i < rows.length; i++) {
        const rowSid = rows[i][sidCol];
        const rowDate = fmtDateOnly(rows[i][dateCol]);
        if (rowSid !== data.studentId || rowDate !== reqDate) continue;

        const rowStatus = normalizeProgressStatus_(rows[i][statusCol]);
        if (rowStatus === 'pending' || rowStatus === 'none') {
          targetRow = i + 1;
          break;
        }

        if (fallbackRow < 0) fallbackRow = i + 1;
      }

      if (targetRow < 0) targetRow = fallbackRow;
    }

    const booksStr = Array.isArray(data.books) ? data.books.join(',') : data.books;
    const dateValue = fmtDateOnly(data.date);
    const confirmedAtValue = data.confirmedAt ? fmtDateTime(data.confirmedAt) : fmtDateTime(new Date());
    const normalizedStatus = normalizeProgressStatus_(data.status);

    if (targetRow < 0) {
      sh.appendRow([
        data.studentId, dateValue, data.hours, booksStr,
        normalizedStatus, data.note || '', confirmedAtValue, generateRowId_()
      ]);
    } else {
      sh.getRange(targetRow, dateCol + 1).setValue(dateValue);
      sh.getRange(targetRow, statusCol + 1).setValue(normalizedStatus);
      sh.getRange(targetRow, noteCol + 1).setValue(data.note || '');
      sh.getRange(targetRow, confirmedAtCol + 1).setValue(confirmedAtValue);
      sh.getRange(targetRow, hoursCol + 1).setValue(data.hours);
      sh.getRange(targetRow, booksCol + 1).setValue(booksStr);
    }

    if (
      data.confirmedNo !== undefined ||
      data.currentRemainingHours !== undefined ||
      data.confirmedHours !== undefined ||
      data.initHours !== undefined
    ) {
      const studentSh = ss.getSheetByName('學生設定');
      const sRows = studentSh.getDataRange().getValues();
      const sHeaders = sRows[0];
      const sidIdx = sHeaders.indexOf('id');
      const cNoIdx = sHeaders.indexOf('confirmedNo');
      const cHrIdx = sHeaders.indexOf('confirmedHours'); // 舊欄位（相容）
      const initHrIdx = sHeaders.indexOf('initHours');
      const curHrIdx = sHeaders.indexOf('currentRemainingHours');

      for (let i = 1; i < sRows.length; i++) {
        if (sRows[i][sidIdx] === data.studentId) {
          if (cNoIdx >= 0 && data.confirmedNo !== undefined) {
            studentSh.getRange(i + 1, cNoIdx + 1).setValue(data.confirmedNo);
          }

          if (initHrIdx >= 0 && data.initHours !== undefined) {
            studentSh.getRange(i + 1, initHrIdx + 1).setValue(data.initHours);
          }

          // 新欄位優先，舊欄位相容同步
          const newCurrentRemaining =
            data.currentRemainingHours !== undefined ? data.currentRemainingHours : data.confirmedHours;
          if (newCurrentRemaining !== undefined) {
            if (curHrIdx >= 0) studentSh.getRange(i + 1, curHrIdx + 1).setValue(newCurrentRemaining);
            if (cHrIdx >= 0) studentSh.getRange(i + 1, cHrIdx + 1).setValue(newCurrentRemaining);
          }

          break;
        }
      }
    }

    SpreadsheetApp.flush();
    return {success: true, targetRow};
  } finally {
    lock.releaseLock();
  }
}

function saveSchedule(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sh = ensureScheduleColumns_(ss) || ss.getSheetByName('學習進度表');
    const allRows = sh.getDataRange().getValues();
    const headers = allRows[0];
    const sidCol = headers.indexOf('studentId');
    const dateCol = headers.indexOf('date');
    const statusCol = headers.indexOf('status');
    const lastCol = headers.length;
    const today = data.today || '';

    const replaceStartDate = fmtDateOnly(data.replaceStartDate || '');
    const replaceEndDate = fmtDateOnly(data.replaceEndDate || '');

    const keptRows = [];
    for (let i = 1; i < allRows.length; i++) {
      const row = allRows[i];
      if (row[sidCol] === data.studentId) {
        const rowDate = fmtDateOnly(row[dateCol]);
        const rowStatus = normalizeProgressStatus_(row[statusCol]);
        const isPending = rowStatus === 'pending' || rowStatus === 'none';
        const inReplaceWindow =
          (!replaceStartDate || rowDate >= replaceStartDate) &&
          (!replaceEndDate || rowDate <= replaceEndDate);

        if (replaceStartDate || replaceEndDate) {
          if (isPending && inReplaceWindow) {
            continue;
          }
        } else if (isPending && rowDate > today) {
          continue;
        }
      }
      keptRows.push(row);
    }

    const incoming = data.rows || [];
    const newRows = incoming
      .filter(r => normalizeProgressStatus_(r.status) === 'pending')
      .map(r => {
        const booksStr = Array.isArray(r.books) ? r.books.join(',') : r.books;
        const rowObj = {
          studentId: r.studentId,
          date: fmtDateOnly(r.date),
          hours: r.hours,
          books: booksStr,
          status: 'pending',
          note: r.note || '',
          confirmedAt: r.confirmedAt ? fmtDateTime(r.confirmedAt) : '',
          rowId: r.rowId || generateRowId_()
        };
        return headers.map(h => rowObj[h] !== undefined ? rowObj[h] : '');
      });

    const finalRows = keptRows.concat(newRows);

    if (sh.getLastRow() > 1) {
      sh.getRange(2, 1, sh.getLastRow() - 1, lastCol).clearContent();
    }
    if (finalRows.length) {
      sh.getRange(2, 1, finalRows.length, lastCol).setValues(finalRows);
    }

    SpreadsheetApp.flush();
    return {
      success: true,
      added: newRows.length
    };
  } finally {
    lock.releaseLock();
  }
}

function buildStudentPayload_(data) {
  const studentId = String(data.id || '').trim();
  const currentRemainingHours =
    data.currentRemainingHours !== undefined
      ? Number(data.currentRemainingHours || 0)
      : Number(data.confirmedHours || 0);
  const confirmedHours = currentRemainingHours;
  const initHours =
    data.initHours !== undefined ? Number(data.initHours || 0) : currentRemainingHours;

  return {
    id: studentId,
    name: String(data.name || '').trim(),
    branch: String(data.branch || '').trim(),
    level: String(data.level || 'GK').trim() || 'GK',
    grade: Number(data.grade || 1),
    speed: Number(data.speed || 1),
    confirmedNo: Number(data.confirmedNo || data.startNo || 1),
    initHours,
    currentRemainingHours,
    confirmedHours,
    school: String(data.school || data.elementarySchool || data.schoolName || '').trim(),
    elementarySchool: String(data.elementarySchool || data.school || data.schoolName || '').trim(),
    note: String(data.note || '').trim(),
    orderAlertGapKByPerson: Number(data.orderAlertGapKByPerson || 0),
    mon: Number(data.mon || 0),
    tue: Number(data.tue || 0),
    wed: Number(data.wed || 0),
    thu: Number(data.thu || 0),
    fri: Number(data.fri || 0),
    sat: Number(data.sat || 0),
    sun: Number(data.sun || 0)
  };
}

function addStudent(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sh = ensureStudentColumns_(ss) || ss.getSheetByName('學生設定');
    if (!sh) return {error: '找不到學生設定工作表'};

    const rows = sh.getDataRange().getValues();
    const headers = rows[0] || [];
    const sidCol = headers.indexOf('id');
    if (sidCol < 0) return {error: '學生設定缺少 id 欄位'};

    const payload = buildStudentPayload_(data);
    if (!payload.id) return {error: 'student id required'};
    if (!payload.name) return {error: 'student name required'};

    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][sidCol] || '').trim() === payload.id) {
        return {error: 'student already exists: ' + payload.id};
      }
    }

    const row = headers.map(h => payload[h] !== undefined ? payload[h] : '');
    sh.appendRow(row);
    SpreadsheetApp.flush();

    const student = getStudents('').filter(s => String(s.id || '').trim() === payload.id)[0] || payload;
    return {success: true, student};
  } finally {
    lock.releaseLock();
  }
}

function updateStudent(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ensureStudentColumns_(ss) || ss.getSheetByName('學生設定');
  const rows = sh.getDataRange().getValues();
  const headers = rows[0];
  const sidCol = headers.indexOf('id');
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][sidCol] !== data.id) continue;
    const nextRow = rows[i].slice();
    let changed = false;
    const normalizedPayload = buildStudentPayload_(Object.assign({}, rows[i].reduce(function (acc, value, idx) {
      acc[headers[idx]] = value;
      return acc;
    }, {}), data));
    headers.forEach((h, idx) => {
      if (data[h] !== undefined || normalizedPayload[h] !== undefined && (h === 'currentRemainingHours' || h === 'confirmedHours' || h === 'initHours' || h === 'school' || h === 'elementarySchool')) {
        const nextValue = normalizedPayload[h] !== undefined ? normalizedPayload[h] : data[h];
        nextRow[idx] = nextValue;
        changed = true;
      }
    });
    if (changed) {
      sh.getRange(i + 1, 1, 1, headers.length).setValues([nextRow]);
      SpreadsheetApp.flush();
    }
    const student = getStudents('').filter(s => String(s.id || '').trim() === data.id)[0];
    return {success: true, student: student || null};
  }
  return {error: 'student not found: ' + data.id};
}

function deleteRowsByStudentId_(sh, studentId, headerName) {
  if (!sh) return 0;
  const rows = sh.getDataRange().getValues();
  if (!rows.length) return 0;
  const headers = rows[0];
  const sidIdx = headers.indexOf(headerName || 'studentId');
  if (sidIdx < 0) return 0;

  let deleted = 0;
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][sidIdx] || '').trim() !== studentId) continue;
    sh.deleteRow(i + 1);
    deleted++;
  }
  return deleted;
}

function deleteStudent(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const studentId = String(data.id || data.studentId || '').trim();
    if (!studentId) return {error: 'studentId required'};

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const studentSh = ensureStudentColumns_(ss) || ss.getSheetByName('學生設定');
    if (!studentSh) return {error: '找不到學生設定工作表'};

    const rows = studentSh.getDataRange().getValues();
    const headers = rows[0] || [];
    const sidIdx = headers.indexOf('id');
    if (sidIdx < 0) return {error: '學生設定缺少 id 欄位'};

    let deletedStudent = false;
    for (let i = rows.length - 1; i >= 1; i--) {
      if (String(rows[i][sidIdx] || '').trim() !== studentId) continue;
      studentSh.deleteRow(i + 1);
      deletedStudent = true;
    }

    if (!deletedStudent) return {error: 'student not found: ' + studentId};

    const deletedScheduleRows = deleteRowsByStudentId_(ss.getSheetByName('學習進度表'), studentId, 'studentId');
    const deletedBookOrderRows = deleteRowsByStudentId_(ss.getSheetByName('book_order_state'), studentId, 'studentId');

    SpreadsheetApp.flush();
    return {
      success: true,
      studentId,
      deletedScheduleRows,
      deletedBookOrderRows
    };
  } finally {
    lock.releaseLock();
  }
}

function ensureHoursLogSheet_(ss) {
  let sh = ss.getSheetByName('時數異動紀錄');
  if (!sh) sh = ss.insertSheet('時數異動紀錄');

  const headers = ['at', 'studentId', 'name', 'type', 'deltaHours', 'beforeHours', 'afterHours', 'beforeInitHours', 'afterInitHours', 'operator', 'note'];
  const current = sh.getDataRange().getValues();
  if (!current.length || !current[0].length || String(current[0][0]).trim() !== 'at') {
    sh.clear();
    sh.appendRow(headers);
  }
  return sh;
}

function adjustStudentHours(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const studentId = String(data.studentId || '').trim();
    const deltaHours = Number(data.deltaHours);
    const note = String(data.note || '').trim();
    const operator = String(data.operator || '').trim() || 'system';

    if (!studentId) return {error: 'studentId required'};
    if (!Number.isInteger(deltaHours) || deltaHours === 0) {
      return {error: 'deltaHours must be integer and not 0'};
    }

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const studentSh = ss.getSheetByName('學生設定');
    const sRows = studentSh.getDataRange().getValues();
    const sHeaders = sRows[0];

    const sidIdx = sHeaders.indexOf('id');
    const nameIdx = sHeaders.indexOf('name');
    const initHrIdx = sHeaders.indexOf('initHours');
    const curHrIdx = sHeaders.indexOf('currentRemainingHours');
    const cHrIdx = sHeaders.indexOf('confirmedHours');

    if (sidIdx < 0) return {error: '學生設定缺少 id 欄位'};

    for (let i = 1; i < sRows.length; i++) {
      if (String(sRows[i][sidIdx]) !== studentId) continue;

      const currentRaw = (curHrIdx >= 0) ? sRows[i][curHrIdx] : (cHrIdx >= 0 ? sRows[i][cHrIdx] : 0);
      const beforeHours = Number(currentRaw || 0);
      const beforeInitHours = Number((initHrIdx >= 0 ? sRows[i][initHrIdx] : beforeHours) || 0);

      const afterHours = beforeHours + deltaHours;
      const afterInitHours = beforeInitHours + deltaHours;

      if (afterHours < 0 || afterInitHours < 0) {
        return {error: 'adjustment would make hours negative'};
      }

      if (curHrIdx >= 0) studentSh.getRange(i + 1, curHrIdx + 1).setValue(afterHours);
      if (cHrIdx >= 0) studentSh.getRange(i + 1, cHrIdx + 1).setValue(afterHours);
      if (initHrIdx >= 0) studentSh.getRange(i + 1, initHrIdx + 1).setValue(afterInitHours);

      const logSh = ensureHoursLogSheet_(ss);
      const studentName = nameIdx >= 0 ? sRows[i][nameIdx] : '';
      logSh.appendRow([
        fmtDateTime(new Date()),
        studentId,
        studentName,
        'recharge',
        deltaHours,
        beforeHours,
        afterHours,
        beforeInitHours,
        afterInitHours,
        operator,
        note
      ]);

      SpreadsheetApp.flush();
      return {
        success: true,
        studentId,
        deltaHours,
        beforeHours,
        afterHours,
        beforeInitHours,
        afterInitHours
      };
    }

    return {error: 'student not found: ' + studentId};
  } finally {
    lock.releaseLock();
  }
}

function normalizeScheduleStatusSheet_(ss) {
  const sh = ss.getSheetByName('學習進度表');
  if (!sh) return {updated: 0};

  const rows = sh.getDataRange().getValues();
  if (!rows.length) return {updated: 0};

  const headers = rows[0];
  const statusIdx = headers.indexOf('status');
  if (statusIdx < 0) return {updated: 0};

  let updated = 0;
  for (let i = 1; i < rows.length; i++) {
    const raw = rows[i][statusIdx];
    const rawText = String(raw || '').trim().toLowerCase();
    if (!rawText) continue; // 空白不補成 none

    // 明確的 none/null 一律清空，避免 none 落地
    if (rawText === 'none' || rawText === 'null') {
      sh.getRange(i + 1, statusIdx + 1).clearContent();
      updated++;
      continue;
    }

    const normalized = normalizeProgressStatus_(raw);
    if (normalized === 'none') continue;

    if (String(raw || '') !== normalized) {
      sh.getRange(i + 1, statusIdx + 1).setValue(normalized);
      updated++;
    }
  }
  return {updated};
}

function setupSheets() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh1 = ss.getSheetByName('學生設定');
  if (!sh1) sh1 = ss.insertSheet('學生設定');
  let sh2 = ss.getSheetByName('學習進度表');
  if (!sh2) sh2 = ss.insertSheet('學習進度表');
  ensureHoursLogSheet_(ss);
  ensureSettingSheet_(ss);
  ensureBookOrderStateSheet_(ss);
  ensureStudentColumns_(ss);
  ensureScheduleColumns_(ss);
  const migrated = normalizeScheduleStatusSheet_(ss);
  SpreadsheetApp.flush();
  return {success: true, message: 'Sheets ready', migratedStatusRows: migrated.updated};
}
