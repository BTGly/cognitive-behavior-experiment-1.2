import { loadCSV } from './csv.js'
import { conditionPath, assetPath, normalizePath } from './paths.js'
import { createParamForm, readFormParams, getDateStr, validateParams } from './config.js'
import { seedFromParticipant } from './random.js'
import { preloadImages } from './preload.js'
import { fitLogisticGrid } from './calibration/logistic.js'
import { buildMonotonicP8Curve } from './calibration/monotonic.js'
import { selectAlphas, FORMAL_PLAN, P8_WINDOWS } from './calibration/select-alpha.js'
import { buildFormalSchedule } from './calibration/formal-schedule.js'
import { loadFormalImagePool } from './data/formal-pool.js'
import { computePretestAlphaSummary, buildCalibrationSummary, computeExpectedMetrics } from './data/summaries.js'
import { verifyPretestRecords } from './qc/checks.js'
import { buildAllDataZip, downloadBlob, downloadCSV } from './data/export-csv.js'
import { getUploadEndpoint, getUploadApiBase, sha256Blob, uploadSessionZip } from './data/upload.js'
import { RAW_DATA_FIELDS } from './data/schemas.js'

import {
  createWelcomeTimeline, practiceIntroTimeline,
  pretestIntroTimeline, formalIntroTimeline, endingTimeline
} from './timeline/welcome.js'
import { buildPracticeTimeline } from './timeline/practice.js'
import { buildPretestTimeline } from './timeline/pretest.js'
import { buildFormalTimeline } from './timeline/formal.js'

// ---- Calibration v2 helpers ----

function hasV2FormalSchedule(cache) {
  return !!(
    cache &&
    cache.schema_version === 2 &&
    cache.calibration?.selected &&
    cache.formal_schedule?.formalBlocks
  )
}

function getCalibrationPayload(cache) {
  return cache?.calibration || null
}

// ---- Entry ----

showParamForm()

function showParamForm() {
  const target = document.getElementById('jspsych-target')
  target.innerHTML = createParamForm()
  document.getElementById('start-btn')?.addEventListener('click', () => {
    const startBtn = document.getElementById('start-btn')
    if (startBtn) {
      startBtn.disabled = true
      startBtn.textContent = '加载中...'
    }
    startExperiment().catch(showStartupError)
  })
}

async function startExperiment() {
  console.log('jsPsych Blur Experiment starting...')

  const target = document.getElementById('jspsych-target')
  const params = readFormParams()

  // Validate all parameters before proceeding
  const paramErrors = validateParams(params)
  if (paramErrors.length > 0) {
    target.innerHTML = `<div class="instruction-text" style="color:#f44336;">
      <h2>参数错误</h2>
      ${paramErrors.map(e => `<p>${escapeHtml(e)}</p>`).join('')}
      <button onclick="location.reload()" style="font-size:18px;padding:8px 30px;margin-top:16px;cursor:pointer;">返回参数页</button>
    </div>`
    return
  }

  const fullscreenWasRequested = await requestFullscreen()

  let downloadTriggered = false
  let runPhase = 'initial'
  let abortTriggered = false
  let abortInfo = null
  target.innerHTML = ''
  let formalBlocks = {}
  let blockDistributionRows = []
  let calibrationSummaryRows = []
  let pretestAlphaSummaryRows = []
  let pretestRecords = []
  let scheduleSource = 'none'
  let formalScheduleHash = null
  let completedFormalBlocksToSkip = []

  // Check if subject already has calibration + formal schedule on server
  let existingCalibration = null
  let scheduleFromServer = null
  if (params.upload_code) {
    target.innerHTML = '<div class="instruction-text">正在检查校准数据...</div>'
    try {
      existingCalibration = await fetchStoredCalibration(params.participant, params.upload_code)
    } catch (err) {
      target.innerHTML = `<div class="instruction-text" style="color:#f44336;">
        <h2>校准检查失败</h2>
        <p>${escapeHtml(err.message)}</p>
        <p style="color:#888;font-size:14px;">请检查上传授权码后刷新页面重试。</p>
      </div>`
      return
    }

    if (hasV2FormalSchedule(existingCalibration)) {
      scheduleFromServer = existingCalibration.formal_schedule
      formalScheduleHash = existingCalibration.formal_schedule_hash || null
      console.log('Using stored formal schedule for', params.participant)
    } else if (existingCalibration && !hasV2FormalSchedule(existingCalibration)) {
      // Any non-v2 cache → block
      target.innerHTML = `<div class="instruction-text" style="color:#f44336;">
        <h2>检测到旧版或不完整校准缓存</h2>
        <p>该被试编号（${escapeHtml(params.participant)}）的校准缓存版本无效，缺少正式实验排程。</p>
        <p>请联系实验负责人清除旧缓存后重新开始。</p>
        <p style="color:#888;font-size:14px;">（按 Esc 或关闭全屏可退出）</p>
      </div>`
      const btn = document.createElement('button')
      btn.textContent = '重新开始'
      btn.onclick = () => location.reload()
      target.querySelector('.instruction-text')?.appendChild(document.createElement('br'))
      target.querySelector('.instruction-text')?.appendChild(btn)
      return
    }
  }

  // Check formal block progress (only if v2 cache exists)
  let progress = null
  if (scheduleFromServer && params.upload_code) {
    try {
      progress = await fetchStoredProgress(params.participant, params.upload_code)
    } catch (err) {
      target.innerHTML = `<div class="instruction-text" style="color:#f44336;">
        <h2>进度检查失败</h2>
        <p>${escapeHtml(err.message)}</p>
        <p style="color:#888;font-size:14px;">请稍后重试。</p>
      </div>`
      return
    }

    if (progress?.progress_conflict) {
      target.innerHTML = `<div class="instruction-text" style="color:#f44336;">
        <h2>进度冲突</h2>
        <p>该被试存在多个不同的正式实验排程（hash 不一致），请人工检查。</p>
        <p style="color:#888;font-size:14px;">检测到 hash：${(progress.hashes || []).join(', ')}</p>
      </div>`
      return
    }

    const isTestSubject = /^TEST_/i.test(params.participant)

    if (!isTestSubject && progress?.is_complete) {
      target.innerHTML = `<div class="instruction-text">
        <h2>实验已完成</h2>
        <p>该被试已完成全部 11 轮正式实验。</p>
        <p style="color:#888;font-size:14px;">无需再次参加。</p>
      </div>`
      return
    }

    const completedSet = new Set(progress.completed_blocks || [])
    const hasCompletedProgress = completedSet.size > 0
    const isDefaultFullRange = params.start_group === 1 && params.end_group === 11
    const autoSkipCompleted = !isTestSubject && isDefaultFullRange && hasCompletedProgress
    const missingBlocks = []
    for (let b = 1; b <= 11; b++) {
      if (!completedSet.has(b)) missingBlocks.push(b)
    }

    // Auto-resume: default 1-11 runs all unfinished blocks and skips completed blocks.
    // This also handles non-contiguous progress, e.g. completed [2] → run [1,3,4...11].
    if (autoSkipCompleted && missingBlocks.length > 0) {
      params.start_group = missingBlocks[0]
      params.end_group = 11
      params.skip_completed_blocks = [...completedSet]
      window.__experimentParams = params
      completedFormalBlocksToSkip = [...completedSet]
      console.log(`Auto-resume: running unfinished blocks ${missingBlocks.join(',')}, skipping completed ${completedFormalBlocksToSkip.join(',')}`)
      target.innerHTML = `<div class="instruction-text" style="color:#4caf50;">
        <p>检测到该被试已完成 ${[...completedSet].sort((a,b)=>a-b).join('、')} 轮。</p>
        <p>本次自动运行未完成轮次：${missingBlocks.join('、')}。</p>
        <p style="color:#888;font-size:14px;">2 秒后自动继续</p>
      </div>`
      await new Promise(r => setTimeout(r, 2000))
      target.innerHTML = ''
    }

    const requestedStart = params.start_group
    const requestedEnd = params.end_group
    const requestedRange = []
    for (let b = requestedStart; b <= requestedEnd; b++) requestedRange.push(b)

    const effectiveRequestedStart = params.start_group
    const effectiveRequestedEnd = params.end_group
    requestedRange.length = 0
    for (let b = effectiveRequestedStart; b <= effectiveRequestedEnd; b++) requestedRange.push(b)

    if (!isTestSubject) {
      // Check overlap with completed blocks
      const overlap = autoSkipCompleted ? [] : requestedRange.filter(b => completedSet.has(b))
      if (overlap.length > 0) {
        const next = progress.next_start_group
        target.innerHTML = `<div class="instruction-text" style="color:#f44336;">
          <h2>轮次重叠</h2>
          <p>你选择的 ${effectiveRequestedStart}–${effectiveRequestedEnd} 与已完成轮次 ${[...completedSet].sort((a,b)=>a-b).join('、')} 重叠。</p>
          ${next ? `<p>下一轮应从第 ${next} 轮开始。</p>` : '<p>该被试已完成全部轮次。</p>'}
          <button onclick="location.reload()" style="font-size:18px;padding:8px 30px;margin-top:16px;cursor:pointer;">重新选择</button>
        </div>`
        return
      }

      // Check skipping blocks
      if (!autoSkipCompleted && progress.next_start_group !== null && effectiveRequestedStart > progress.next_start_group) {
        target.innerHTML = `<div class="instruction-text" style="color:#f44336;">
          <h2>跳块检测</h2>
          <p>该被试下一轮应从第 ${progress.next_start_group} 轮开始。</p>
          <p>你选择的起始轮次 ${effectiveRequestedStart} 跳过了第 ${progress.next_start_group}–${effectiveRequestedStart - 1} 轮，不能跳过已完成和未完成之间的 block。</p>
          <button onclick="location.reload()" style="font-size:18px;padding:8px 30px;margin-top:16px;cursor:pointer;">重新选择</button>
        </div>`
        return
      }
    } else {
      // TEST_ subjects: show progress info but allow override
      if (progress.next_start_group !== null) {
        console.log(`TEST mode: completed ${[...completedSet].sort((a,b)=>a-b).join(',') || 'none'}, continuing with requested range ${effectiveRequestedStart}-${effectiveRequestedEnd}`)
      }
    }
  }
  target.innerHTML = ''

  const jsPsych = initJsPsych({
    display_element: target,
    show_progress_bar: false,
    auto_update_progress_bar: false,
    on_finish: () => {
      if (abortTriggered) return
      if (runPhase === 'initial') {
        runFormalPhase().catch(showStartupError)
      } else {
        safeTriggerDownload()
      }
    }
  })
  const safeTriggerDownload = () => {
    if (downloadTriggered) return
    downloadTriggered = true
    teardownAbortControls()
    triggerDownload(jsPsych, abortInfo)
  }

  const abortExperiment = (reason) => {
    if (abortTriggered || downloadTriggered) return
    abortTriggered = true
    console.warn('Experiment aborted:', reason)

    jsPsych.__dataCollector = {
      pretestRecords,
      calibrationSummaryRows,
      blockDistributionRows,
      formalBlocks,
      pretestAlphaSummary: pretestAlphaSummaryRows,
      scheduleSource,
      startGroup: params.start_group,
      endGroup: params.end_group,
      formalScheduleHash,
      completedBlocks: [],
      partialBlocks: [],
      formalBlockCounts: {}
    }

    if (!abortInfo) {
      abortInfo = {
        participant: params.participant,
        date: getDateStr(),
        phase: 'experiment_abort',
        abort_reason: reason,
        abort_time: new Date().toISOString()
      }
    }

    try {
      if (typeof jsPsych.endExperiment === 'function') {
        jsPsych.endExperiment('')
      }
    } catch (err) {
      console.warn('jsPsych endExperiment failed:', err)
    }

    target.innerHTML = '<div class="instruction-text">实验已提前结束。\n\n数据正在打包下载中...</div>'
    safeTriggerDownload()
  }

  const onAbortKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      abortExperiment('escape_key')
    }
  }

  const onFullscreenChange = () => {
    if (fullscreenWasRequested && !document.fullscreenElement) {
      abortExperiment('fullscreen_exit')
    }
  }

  function teardownAbortControls() {
    document.removeEventListener('keydown', onAbortKeyDown, true)
    document.removeEventListener('fullscreenchange', onFullscreenChange)
  }

  document.addEventListener('keydown', onAbortKeyDown, true)
  document.addEventListener('fullscreenchange', onFullscreenChange)

  const subjectSeed = seedFromParticipant(params.participant)

  const welcomeTrial = createWelcomeTimeline(jsPsych)
  const practiceIntro = practiceIntroTimeline()
  const pretestIntro = pretestIntroTimeline()

  const practiceTimeline = await buildPracticeTimeline(jsPsych)

  // Build pretest only if no stored formal schedule
  let pretestTimeline = []
  if (scheduleFromServer) {
    console.log('Skipping pretest — using stored formal schedule')
    pretestRecords = []
  } else {
    const pretestResult = await buildPretestTimeline(jsPsych)
    pretestTimeline = pretestResult.timeline
    pretestRecords = pretestResult.pretestRecords
  }

  const initialTimeline = [welcomeTrial]

  if (practiceTimeline.length > 0) {
    const practiceImages = practiceTimeline
      .filter(t => typeof t.stimulus === 'string')
      .map(t => t.stimulus)
    target.innerHTML = '<div class="instruction-text">正在加载练习图片...</div>'
    const practicePreload = await preloadImages(practiceImages, { timeoutMs: 15000 })
    console.log('Practice preload:', practicePreload)
    initialTimeline.push(practiceIntro)
    initialTimeline.push(...practiceTimeline)
  }

  if (pretestTimeline.length > 0) {
    const pretestImages = pretestTimeline
      .filter(t => typeof t.stimulus === 'string')
      .map(t => t.stimulus)
    target.innerHTML = '<div class="instruction-text">正在加载预实验图片...</div>'
    const pretestPreload = await preloadImages(pretestImages, { timeoutMs: 15000 })
    console.log('Pretest preload:', pretestPreload)
    initialTimeline.push(...pretestIntro)
    initialTimeline.push(...pretestTimeline)
  }

  async function runFormalPhase() {
    let selected = null
    let selectedInfo = null
    const pretestUsedPaths = new Set()
    const finalTimeline = []
    let formalSchedule = scheduleFromServer

    if (pretestRecords.length > 0) {
      // === FIRST RUN: pretest → calibrate → build schedule → upload ===
      const pretestSummary = computePretestAlphaSummary(pretestRecords)
      pretestAlphaSummaryRows = pretestSummary.summaryRows
      const { valid } = verifyPretestRecords(pretestRecords)

      if (valid && Object.keys(pretestSummary.alphaCounts).length >= 6) {
        const { mu, sigma, nll } = fitLogisticGrid(pretestSummary.alphaCounts)
        console.log('Logistic fit: mu=', mu, 'sigma=', sigma, 'nll=', nll)

        const { monoPredict } = buildMonotonicP8Curve(pretestSummary.alphaCounts)

        for (const r of pretestRecords) {
          if (r.image_path) pretestUsedPaths.add(normalizePath(r.image_path))
        }

        const selectionResult = selectAlphas(
          pretestSummary.alphaCounts, await loadFormalImagePool(pretestUsedPaths),
          mu, sigma, monoPredict
        )
        selected = selectionResult.selected
        selectedInfo = selectionResult.selectedInfo
        console.log('Selected alphas:', selected)

        const totalPlannedTrials = FORMAL_PLAN.reduce((s, c) => s + parseInt(c.n_trials), 0)
        const expectedMetrics = computeExpectedMetrics(selectedInfo, totalPlannedTrials, FORMAL_PLAN)
        calibrationSummaryRows = buildCalibrationSummary(selectedInfo, mu, sigma, nll, expectedMetrics, FORMAL_PLAN)

        // Block if AUC is too low (matches Python behavior)
        if (expectedMetrics.aucQcStatus === 'fail') {
          abortInfo = {
            participant: params.participant,
            date: getDateStr(),
            phase: 'qc_fail',
            abort_reason: 'auc_too_low',
            expected_auc_binary: expectedMetrics.expectedAucBinary,
            auc_threshold: expectedMetrics.AUC_HARD,
            mu, sigma, nll,
            abort_time: new Date().toISOString()
          }
          jsPsych.__dataCollector = {
            pretestRecords,
            calibrationSummaryRows,
            blockDistributionRows: [],
            formalBlocks: {},
            pretestAlphaSummary: pretestAlphaSummaryRows,
            scheduleSource: 'qc_fail',
            startGroup: params.start_group,
            endGroup: params.end_group,
            formalScheduleHash: null
          }
          target.innerHTML = `<div class="instruction-text" style="color:#f44336;">
            <h2>校准质量过低</h2>
            <p>预期 AUC = ${expectedMetrics.expectedAucBinary.toFixed(3)}，低于最低阈值 ${expectedMetrics.AUC_HARD}。</p>
            <p>预实验数据将自动下载以供检查。本次不进入正式实验。</p>
            <p style="color:#888;font-size:14px;">请重新进行预实验。</p>
          </div>`
          safeTriggerDownload()
          return
        }

        // Build formal schedule FIRST, then upload
        formalSchedule = await buildFormalSchedule({
          selected,
          pretestUsedPaths,
          subjectSeed
        })
        formalBlocks = formalSchedule.formalBlocks
        blockDistributionRows = formalSchedule.blockDistributionRows
        formalScheduleHash = formalSchedule.formalScheduleHash || null
        scheduleSource = 'newly_generated_after_pretest'
        console.log('Formal schedule generated:', formalBlocks ? Object.keys(formalBlocks).length : 0, 'blocks')

        // Upload full artifact (calibration + formal schedule)
        // MUST complete before entering formal experiment — server is the single source of truth.
        if (params.upload_code) {
          const isTestSubject = /^TEST_/i.test(params.participant)

          function buildArtifact() {
            return {
              schema_version: 2,
              subject_id: params.participant,
              stored_at: new Date().toISOString(),
              calibration: { mu, sigma, nll, selected, selectedInfo, pretestAlphaSummaryRows },
              pretest: { pretestUsedPaths: [...pretestUsedPaths] },
              formal_schedule: formalSchedule,
              formal_schedule_hash: formalScheduleHash,
              provenance: {
                app_version: 'web-static',
                generator: 'buildFormalSchedule',
                created_at: new Date().toISOString(),
                requested_start_group: params.start_group,
                requested_end_group: params.end_group
              }
            }
          }

          if (!isTestSubject) {
            const existingCal = await fetchStoredCalibration(params.participant, params.upload_code)
            if (hasV2FormalSchedule(existingCal)) {
              target.innerHTML = `<div class="instruction-text" style="color:#f44336;">
                <h2>该被试编号已有正式排程</h2>
                <p>为避免覆盖或混用正式实验顺序，本次实验已停止。</p>
                <p>请确认被试编号是否填写错误，或联系实验负责人处理。</p>
                <button onclick="location.reload()" style="font-size:18px;padding:8px 30px;margin-top:16px;cursor:pointer;">重新选择</button>
              </div>`
              return
            } else {
              const ok = await uploadCalibration(params.participant, buildArtifact(), params.upload_code)
              if (!ok) {
                target.innerHTML = `<div class="instruction-text" style="color:#f44336;">
                  <h2>校准数据保存失败</h2>
                  <p>正式实验排程未能保存到服务器。没有服务器保存的正式排程，后续将无法续做实验。</p>
                  <p>请检查网络连接和上传授权码后重试。</p>
                  <p style="color:#888;font-size:14px;">（联系实验负责人获取帮助）</p>
                </div>`
                return
              }
            }
          } else {
            const ok = await uploadCalibration(params.participant, buildArtifact(), params.upload_code)
            if (!ok) {
              target.innerHTML = `<div class="instruction-text" style="color:#f44336;">
                <h2>校准数据保存失败</h2>
                <p>正式实验排程未能保存到服务器。没有服务器保存的正式排程，后续将无法续做实验。</p>
                <p>请检查网络连接和上传授权码后重试。</p>
                <p style="color:#888;font-size:14px;">（联系实验负责人获取帮助）</p>
              </div>`
              return
            }
          }
        }
      } else {
        console.warn('Pretest invalid, skipping formal experiment')
        target.innerHTML = `<div class="instruction-text">
          <h2>预实验数据不足</h2>
          <p>预实验结果未能产生足够的有效数据（需要至少6个不同的模糊等级）。</p>
          <p>无法生成个性化的正式实验参数。</p>
          <p>请刷新页面重新开始，并在预实验中认真完成每个试次。</p>
          <p style="color:#888;font-size:14px;">（按 Esc 或关闭全屏可退出）</p>
        </div>`
        return
      }
    } else if (scheduleFromServer) {
      // === RETURNING SUBJECT: read only, never regenerate ===
      const cal = getCalibrationPayload(existingCalibration)
      formalBlocks = scheduleFromServer.formalBlocks
      blockDistributionRows = scheduleFromServer.blockDistributionRows
      scheduleSource = 'server_calibration_cache'
      selected = cal.selected
      selectedInfo = cal.selectedInfo
      pretestAlphaSummaryRows = cal.pretestAlphaSummaryRows || []
      const totalPlannedTrials = FORMAL_PLAN.reduce((s, c) => s + parseInt(c.n_trials), 0)
      const expectedMetrics = computeExpectedMetrics(selectedInfo, totalPlannedTrials, FORMAL_PLAN)
      calibrationSummaryRows = buildCalibrationSummary(
        selectedInfo,
        cal.mu ?? null,
        cal.sigma ?? null,
        cal.nll ?? null,
        expectedMetrics,
        FORMAL_PLAN
      )
      console.log('Using stored calibration for', params.participant)
    }

    if (selected && selectedInfo && formalBlocks && Object.keys(formalBlocks).length > 0) {
      const formalIntro = formalIntroTimeline()

      finalTimeline.push(...formalIntro)

      const formalImagePaths = new Set()
      for (const blockId of Object.keys(formalBlocks)) {
        for (const t of formalBlocks[blockId]) {
          formalImagePaths.add(assetPath(t.image_path))
        }
      }
      target.innerHTML = '<div class="instruction-text">正在加载正式实验图片...</div>'
      const formalPreload = await preloadImages([...formalImagePaths], { timeoutMs: 20000 })
      console.log('Formal preload:', formalPreload)

      const formalTrialTimeline = buildFormalTimeline(jsPsych, formalBlocks, {
        skipCompletedBlocks: completedFormalBlocksToSkip
      })
      finalTimeline.push(...formalTrialTimeline)
    }

    jsPsych.__dataCollector = {
      pretestRecords,
      calibrationSummaryRows,
      blockDistributionRows,
      formalBlocks,
      pretestAlphaSummary: pretestAlphaSummaryRows,
      scheduleSource,
      startGroup: params.start_group,
      endGroup: params.end_group,
      formalScheduleHash
    }

    finalTimeline.push(endingTimeline(() => {
      safeTriggerDownload()
    }))

    runPhase = 'final'
    target.innerHTML = ''
    jsPsych.run(finalTimeline)
  }

  target.innerHTML = ''
  jsPsych.run(initialTimeline)
}

async function requestFullscreen() {
  const element = document.documentElement
  if (document.fullscreenElement || !element.requestFullscreen) return false

  try {
    await element.requestFullscreen()
    return true
  } catch (err) {
    console.warn('Fullscreen request failed:', err)
    return false
  }
}

function showStartupError(err) {
  console.error('Experiment setup failed:', err)
  document.body.innerHTML = `<div style="color:red;padding:40px;font-size:20px;">
    <h1>实验初始化失败</h1>
    <p>${err.message}</p>
    <p>请检查控制台以获取详细信息。</p>
  </div>`
}

function triggerDownload(jsPsych, abortInfo = null) {
  const collector = jsPsych.__dataCollector || {}
  let allData = jsPsych.data.get().filter({}).values()
  if (abortInfo) {
    allData = [...allData, abortInfo]
  }
  const params = readFormParams()
  const dateStr = getDateStr()

  setTimeout(async () => {
    const msgEl = document.querySelector('.instruction-text')
    const progress = computeFormalProgress(allData)
    const summaries = {
      pretestAlphaSummary: collector.pretestAlphaSummary || [],
      calibrationSummary: collector.calibrationSummaryRows || [],
      blockDistribution: collector.blockDistributionRows || [],
      formalBlocks: collector.formalBlocks || {},
      scheduleSource: collector.scheduleSource || 'none',
      startGroup: collector.startGroup || params.start_group,
      endGroup: collector.endGroup || params.end_group,
      formalScheduleHash: collector.formalScheduleHash || null,
      completedBlocks: progress.completed_blocks,
      partialBlocks: progress.partial_blocks,
      formalBlockCounts: progress.formal_block_counts
    }

    try {
      const { blob, filename } = await buildAllDataZip(params.participant, allData, summaries, { dateStr })
      downloadBlob(blob, filename)
      console.log('Data download complete.')

      if (msgEl) {
        msgEl.innerHTML = '实验结束！感谢您的参与。<br><br>数据已下载到本机。<br><br>正在上传到服务器...'
      }

      if (params.upload_code) {
        try {
          const sha256 = await sha256Blob(blob)
          const metadata = buildUploadMetadata(params, allData, abortInfo, dateStr, sha256, {
            scheduleSource: collector.scheduleSource || 'none',
            formalScheduleHash: collector.formalScheduleHash || ''
          })
          const uploadResult = await uploadSessionZip({
            blob,
            filename,
            metadata,
            uploadCode: params.upload_code,
            endpoint: getUploadEndpoint()
          })
          console.log('Data upload complete:', uploadResult)
          if (msgEl) {
            msgEl.innerHTML = '实验结束！感谢您的参与。<br><br>数据已下载到本机，并已上传到服务器。<br><br>你可以关闭此页面。'
          }
        } catch (uploadErr) {
          console.error('Upload failed:', uploadErr)
          if (msgEl) {
            msgEl.innerHTML = `实验结束！感谢您的参与。<br><br>数据已下载到本机，但上传服务器失败。<br><br>请保留刚刚下载的 ZIP 文件。<br><br>${escapeHtml(uploadErr.message || uploadErr)}`
          }
        }
      } else if (msgEl) {
        msgEl.innerHTML = '实验结束！感谢您的参与。<br><br>数据已下载到本机。<br><br>未填写上传授权码，因此没有上传到服务器。'
      }
    } catch (err) {
      console.error('ZIP download failed, saving raw CSV:', err)
      downloadCSV(allData, RAW_DATA_FIELDS, `${params.participant}_raw_data_${dateStr}.csv`)
      if (msgEl) {
        msgEl.innerHTML = `实验结束，但 ZIP 打包失败。<br><br>已尝试下载 raw CSV 作为兜底。<br><br>${escapeHtml(err.message || err)}`
      }
    }
  }, 100)
}

function computeFormalProgress(allData, blockSize = 100) {
  const counts = {}
  for (const row of allData) {
    if (row.phase !== 'formal') continue
    const b = parseInt(row.block_id)
    if (!Number.isInteger(b) || b < 1 || b > 11) continue
    counts[b] = (counts[b] || 0) + 1
  }
  const completed = []
  const partial = []
  for (let b = 1; b <= 11; b++) {
    const n = counts[b] || 0
    if (n >= blockSize) completed.push(b)
    else if (n > 0) partial.push(b)
  }
  return {
    completed_blocks: completed,
    partial_blocks: partial,
    formal_block_counts: Object.fromEntries(
      Object.entries(counts).map(([k, v]) => [String(k), v])
    )
  }
}

function buildUploadMetadata(params, allData, abortInfo, dateStr, sha256, extraFields = {}) {
  const trialRows = allData.filter(row => row.phase && row.choice_digit !== undefined)
  const validTrialRows = trialRows.filter(row => parseInt(row.response_timeout) !== 1)
  const progress = computeFormalProgress(allData)

  return {
    session_id: safeId(`${params.participant}_${dateStr}_start${params.start_group}_end${params.end_group}`),
    participant: params.participant,
    subject_id: params.participant,
    run_pretest: params.run_pretest,
    start_group: params.start_group,
    end_group: params.end_group,
    trial_count: trialRows.length,
    valid_trial_count: validTrialRows.length,
    abort_reason: abortInfo?.abort_reason || '',
    sha256,
    created_at: new Date().toISOString(),
    app_version: 'web-static',
    schedule_source: extraFields.scheduleSource || 'none',
    formal_schedule_hash: extraFields.formalScheduleHash || '',
    completed_blocks: progress.completed_blocks,
    partial_blocks: progress.partial_blocks,
    formal_block_counts: progress.formal_block_counts
  }
}

function safeId(value) {
  return String(value || 'UNKNOWN')
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .slice(0, 120) || 'UNKNOWN'
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ---- Calibration cache helpers ----

function getCalibrationApiBase() {
  return getUploadApiBase()
}

async function fetchStoredCalibration(subjectId, uploadCode) {
  try {
    const url = `${getCalibrationApiBase()}/api/subject/${encodeURIComponent(subjectId)}/calibration`
    const headers = uploadCode ? { 'X-Upload-Token': uploadCode } : {}
    const resp = await fetch(url, { headers })
    if (resp.status === 401) {
      throw new Error('上传授权码错误，请检查后重新输入。')
    }
    if (resp.status === 404) return null
    if (!resp.ok) {
      throw new Error(`校准缓存检查失败（${resp.status}），请稍后重试。`)
    }
    return await resp.json()
  } catch (err) {
    if (err.message.includes('授权码') || err.message.includes('检查失败')) {
      throw err
    }
    console.warn('Calibration fetch error:', err)
    return null
  }
}

async function uploadCalibration(subjectId, data, uploadCode) {
  try {
    const url = `${getCalibrationApiBase()}/api/calibration/${encodeURIComponent(subjectId)}`
    const resp = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Upload-Token': uploadCode },
      body: JSON.stringify(data)
    })
    if (!resp.ok) {
      console.warn('Calibration upload failed:', resp.status)
      return false
    }
    console.log('Calibration stored on server for', subjectId)
    return true
  } catch (err) {
    console.warn('Calibration upload error:', err)
    return false
  }
}

async function fetchStoredProgress(subjectId, uploadCode) {
  try {
    const url = `${getCalibrationApiBase()}/api/subject/${encodeURIComponent(subjectId)}/progress`
    const headers = uploadCode ? { 'X-Upload-Token': uploadCode } : {}
    const resp = await fetch(url, { headers })
    if (resp.status === 401) {
      throw new Error('上传授权码错误，请检查后重新输入。')
    }
    if (resp.status === 404) return null
    if (!resp.ok) {
      throw new Error(`进度查询失败（${resp.status}），请稍后重试。`)
    }
    return await resp.json()
  } catch (err) {
    if (err.message.includes('授权码') || err.message.includes('进度查询')) {
      throw err
    }
    console.warn('Progress fetch error:', err)
    return null
  }
}
