let scriptUrlCache = null

async function getScriptUrl() {
  if (scriptUrlCache) return scriptUrlCache

  const res = await fetch('./config.json')
  if (!res.ok) {
    throw new Error(`載入 config.json 失敗：HTTP ${res.status}`)
  }

  const config = await res.json()
  const scriptUrl = String(config?.scriptUrl || '').trim()
  if (!scriptUrl) {
    throw new Error('config.json 缺少 scriptUrl')
  }

  scriptUrlCache = scriptUrl
  return scriptUrlCache
}

async function apiGet(params) {
  const scriptUrl = await getScriptUrl()
  const url = `${scriptUrl}?${new URLSearchParams(params).toString()}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  const data = await res.json()
  if (data?.error) {
    throw new Error(data.error)
  }
  return data
}

async function apiPost(data) {
  const scriptUrl = await getScriptUrl()
  const res = await fetch(scriptUrl, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  const result = await res.json()
  if (result?.error) {
    throw new Error(result.error)
  }
  return result
}

export async function fetchStudents(branch) {
  const params = branch
    ? { action: 'getStudents', branch }
    : { action: 'getStudents' }
  return apiGet(params)
}

export async function fetchAllData(branch) {
  const params = branch
    ? { action: 'getAllData', branch }
    : { action: 'getAllData' }
  return apiGet(params)
}

export async function fetchSettings() {
  return apiGet({ action: 'getSettings' })
}

export async function fetchBookOrderStates(studentId) {
  const params = studentId
    ? { action: 'getBookOrderStates', studentId }
    : { action: 'getBookOrderStates' }
  return apiGet(params)
}

export async function fetchSchedule(studentId, startDate, endDate) {
  const params = {
    action: 'getSchedule',
    studentId,
  }

  if (startDate) params.startDate = startDate
  if (endDate) params.endDate = endDate

  return apiGet(params)
}

export async function saveSettings(settings) {
  return apiPost({
    action: 'saveSettings',
    settings,
  })
}

export async function confirmProgress(payload) {
  return apiPost({
    action: 'confirmProgress',
    ...payload,
  })
}

export async function undoConfirmProgress(payload) {
  return apiPost({
    action: 'undoConfirmProgress',
    ...payload,
  })
}

export async function adjustStudentHours(payload) {
  return apiPost({
    action: 'adjustStudentHours',
    ...payload,
  })
}

export async function saveSchedule(payload) {
  return apiPost({
    action: 'saveSchedule',
    ...payload,
  })
}

export async function saveBookOrderStates(payload) {
  return apiPost({
    action: 'saveBookOrderStates',
    ...payload,
  })
}

export async function addStudent(payload) {
  return apiPost({
    action: 'addStudent',
    ...payload,
  })
}

export async function updateStudent(payload) {
  return apiPost({
    action: 'updateStudent',
    ...payload,
  })
}

export async function deleteStudent(payload) {
  return apiPost({
    action: 'deleteStudent',
    ...payload,
  })
}
