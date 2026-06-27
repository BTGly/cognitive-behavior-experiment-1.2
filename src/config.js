export function createParamForm() {
  const externalParams = readExternalParams()
  const participant = escapeAttr(externalParams.participant || 'S001')
  const practiceCount = escapeAttr(externalParams.practice_count || '24')
  const startGroup = escapeAttr(externalParams.start_group || '1')
  const endGroup = escapeAttr(externalParams.end_group || '11')
  const uploadCode = escapeAttr(externalParams.upload_code || externalParams.upload_key || '')

  const formHtml = `
    <div class="param-form">
      <h1>模糊辨别实验</h1>
      <label>被试编号: <input type="text" id="participant" value="${participant}" autocomplete="off"></label>
      <label>练习次数: <input type="number" id="practice_count" value="${practiceCount}" min="0" max="80"></label>
      <label>起始组: <input type="number" id="start_group" value="${startGroup}" min="1" max="11"></label>
      <label>结束组: <input type="number" id="end_group" value="${endGroup}" min="1" max="11"></label>
      <label>上传授权码: <input type="password" id="upload_code" value="${uploadCode}" autocomplete="off"></label>
      <br>
      <button id="start-btn">开始实验</button>
    </div>
  `
  return formHtml
}

export function readFormParams() {
  const participantEl = document.getElementById('participant')
  const practiceCountEl = document.getElementById('practice_count')
  const startGroupEl = document.getElementById('start_group')
  const endGroupEl = document.getElementById('end_group')
  const runPretestEl = document.getElementById('run_pretest')
  const uploadCodeEl = document.getElementById('upload_code')

  if (!participantEl && window.__experimentParams) {
    return window.__experimentParams
  }

  const practiceCount = parseInt(practiceCountEl?.value)
  const startGroup = parseInt(startGroupEl?.value)
  const endGroup = parseInt(endGroupEl?.value)

  const params = {
    participant: participantEl?.value.trim() || 'S001',
    practice_count: Number.isNaN(practiceCount) ? 24 : practiceCount,
    start_group: Number.isNaN(startGroup) ? 1 : startGroup,
    end_group: Number.isNaN(endGroup) ? 11 : endGroup,
    run_pretest: 1,  // 预实验强制必做，不可跳过
    upload_code: uploadCodeEl?.value.trim() || ''
  }
  window.__experimentParams = params
  return params
}

export function getDateStr() {
  const d = new Date()
  const pad2 = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}_${pad2(d.getHours())}h${pad2(d.getMinutes())}m${pad2(d.getSeconds())}s`
}

function readExternalParams() {
  const params = new URLSearchParams(window.location.search)
  const hash = window.location.hash || ''
  const hashQuery = hash.startsWith('#?') ? hash.slice(2) : hash.startsWith('#') ? hash.slice(1) : ''
  if (hashQuery) {
    const hashParams = new URLSearchParams(hashQuery)
    for (const [key, value] of hashParams.entries()) {
      if (!params.has(key)) params.set(key, value)
    }
  }

  return Object.fromEntries(params.entries())
}

function isEnabledParam(value, defaultValue) {
  if (value === undefined || value === null || value === '') return defaultValue
  return !['0', 'false', 'no', 'off'].includes(String(value).toLowerCase())
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
