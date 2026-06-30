export function createParamForm() {
  const externalParams = readExternalParams()
  const participant = escapeAttr(externalParams.participant || '')
  const practiceCount = escapeAttr(externalParams.practice_count || '24')
  const allowGroupOverride = externalParams.allow_group_override === '1' ||
    /^TEST_/i.test(externalParams.participant || '')
  const startGroup = escapeAttr(allowGroupOverride ? (externalParams.start_group || '1') : '1')
  const endGroup = escapeAttr(allowGroupOverride ? (externalParams.end_group || '11') : '11')
  const groupControls = allowGroupOverride
    ? `<details style="margin-top:12px;font-size:13px;color:#aaa;">
        <summary style="cursor:pointer;">主试高级设置</summary>
        <p style="font-size:12px;color:#888;">仅主试测试/补救时使用。正式被试默认 1–11，由系统按服务器进度续跑。</p>
        <label>起始组: <input type="number" id="start_group" value="${startGroup}" min="1" max="11"></label>
        <label>结束组: <input type="number" id="end_group" value="${endGroup}" min="1" max="11"></label>
      </details>`
    : `<input type="hidden" id="start_group" value="1">
       <input type="hidden" id="end_group" value="11">`

  const formHtml = `
    <div class="param-form">
      <h1>认知行为实验 1.2</h1>
      <p style="font-size:13px;color:#aaa;margin-bottom:16px;">
        被试编号格式：<b>S</b> + 三位数字（如 S001）<br>
        如果已有实验记录，输入同一编号可跳过预实验。<br>
        已做过正式实验的被试，保持默认 1–11 即可，系统会自动从下一轮继续。
      </p>
      <label>被试编号: <input type="text" id="participant" value="${participant}" placeholder="如 S001" autocomplete="off" style="width:140px;"></label>
      <label>上传授权码: <input type="password" id="upload_code" value="" placeholder="请询问主试" autocomplete="off"></label>
      <label>练习次数: <input type="number" id="practice_count" value="${practiceCount}" min="0" max="80"></label>
      <input type="hidden" id="allow_group_override" value="${allowGroupOverride ? '1' : '0'}">
      ${groupControls}
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
  const uploadCodeEl = document.getElementById('upload_code')
  const allowGroupOverrideEl = document.getElementById('allow_group_override')

  if (!participantEl && window.__experimentParams) {
    return window.__experimentParams
  }

  const practiceCount = parseInt(practiceCountEl?.value)
  const startGroup = parseInt(startGroupEl?.value)
  const endGroup = parseInt(endGroupEl?.value)

  const params = {
    participant: participantEl?.value.trim() || '',
    practice_count: Number.isNaN(practiceCount) ? 24 : practiceCount,
    start_group: Number.isNaN(startGroup) ? 1 : startGroup,
    end_group: Number.isNaN(endGroup) ? 11 : endGroup,
    allow_group_override: allowGroupOverrideEl?.value === '1',
    run_pretest: 1,  // 预实验强制必做，不可跳过
    upload_code: uploadCodeEl?.value.trim() || ''
  }
  window.__experimentParams = params
  return params
}

export function validateParams(params) {
  const errors = []

  if (/^TEST_\d{3}$/.test(params.participant)) {
    // 测试模式，允许
  } else if (!/^S\d{3}$/.test(params.participant)) {
    errors.push('被试编号格式错误。正式被试请输入 S + 三位数字（如 S001），测试请输入 TEST_ + 三位数字（如 TEST_001）。')
  }

  const sg = params.start_group
  const eg = params.end_group
  if (!Number.isInteger(sg) || !Number.isInteger(eg) ||
      sg < 1 || eg > 11 || sg > eg) {
    errors.push('起始组/结束组必须满足 1 ≤ 起始组 ≤ 结束组 ≤ 11。')
  }
  if (/^S\d{3}$/.test(params.participant) &&
      !params.allow_group_override &&
      (sg !== 1 || eg !== 11)) {
    errors.push('正式被试不能手动设置起始组/结束组。请保持默认 1–11，由系统按服务器进度自动续跑。')
  }

  const pc = params.practice_count
  if (!Number.isInteger(pc) || pc < 0 || pc > 80) {
    errors.push('练习次数必须在 0–80 之间。')
  }

  if (!params.upload_code) {
    errors.push('上传授权码不能为空。')
  }

  return errors
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

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
