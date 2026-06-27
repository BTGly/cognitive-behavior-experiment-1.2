import { loadCSV } from './csv.js'
import { conditionPath, assetPath, normalizePath } from './paths.js'
import { createParamForm, readFormParams, getDateStr } from './config.js'
import { seedFromParticipant } from './random.js'
import { getPreloadTimeline } from './preload.js'
import { fitLogisticGrid } from './calibration/logistic.js'
import { buildMonotonicP8Curve } from './calibration/monotonic.js'
import { selectAlphas, FORMAL_PLAN } from './calibration/select-alpha.js'
import { generateFormalTrials, splitBlocks } from './calibration/formal-generator.js'
import { computePretestAlphaSummary, buildCalibrationSummary, computeExpectedMetrics } from './data/summaries.js'
import { verifyPretestRecords } from './qc/checks.js'
import { downloadAllData, downloadCSV } from './data/export-csv.js'
import { RAW_DATA_FIELDS } from './data/schemas.js'
import HoldResponseTrialPlugin from './task/hold-response-trial.js'

import {
  createWelcomeTimeline, practiceIntroTimeline,
  pretestIntroTimeline, formalIntroTimeline, endingTimeline
} from './timeline/welcome.js'
import { buildPracticeTimeline } from './timeline/practice.js'
import { buildPretestTimeline } from './timeline/pretest.js'
import { buildFormalTimeline } from './timeline/formal.js'

;(async function () {
  console.log('jsPsych Blur Experiment starting...')

  let downloadTriggered = false

  const jsPsych = initJsPsych({
    show_progress_bar: true,
    auto_update_progress_bar: false,
    on_finish: () => {
      if (!downloadTriggered) {
        downloadTriggered = true
        triggerDownload(jsPsych)
      }
    }
  })

  jsPsych.registerPlugin(HoldResponseTrialPlugin)

  const params = readFormParams()
  const subjectSeed = seedFromParticipant(params.participant)

  const paramFormTrial = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: createParamForm(),
    choices: ['NO_KEYS'],
    trial_duration: 999999999,
    response_ends_trial: false,
    on_load: () => {
      document.getElementById('start-btn')?.addEventListener('click', () => {
        jsPsych.finishTrial()
      })
    }
  }

  const welcomeTrial = createWelcomeTimeline(jsPsych)
  const practiceIntro = practiceIntroTimeline()
  const pretestIntro = pretestIntroTimeline()
  const formalIntro = formalIntroTimeline()

  const practiceTimeline = await buildPracticeTimeline(jsPsych)

  const pretestResult = await buildPretestTimeline(jsPsych)
  const pretestTimeline = pretestResult.timeline
  const pretestRecords = pretestResult.pretestRecords

  const totalTimeline = [paramFormTrial, welcomeTrial, practiceIntro]

  if (practiceTimeline.length > 0) {
    const practiceImages = practiceTimeline
      .filter(t => t.stimulus)
      .map(t => t.stimulus)
    totalTimeline.push(getPreloadTimeline(practiceImages))
    totalTimeline.push(...practiceTimeline)
  }

  if (pretestTimeline.length > 0) {
    totalTimeline.push(pretestIntro)
    totalTimeline.push(...pretestTimeline)
  }

  let formalBlocks = {}
  let blockDistributionRows = []
  let calibrationSummaryRows = []
  let pretestAlphaSummaryRows = []

  if (pretestRecords.length > 0) {
    const pretestSummary = computePretestAlphaSummary(pretestRecords)
    pretestAlphaSummaryRows = pretestSummary.summaryRows
    const { valid } = verifyPretestRecords(pretestRecords)

    if (valid && Object.keys(pretestSummary.alphaCounts).length >= 6) {
      const { mu, sigma, nll } = fitLogisticGrid(pretestSummary.alphaCounts)
      console.log('Logistic fit: mu=', mu, 'sigma=', sigma, 'nll=', nll)

      const { monoPredict } = buildMonotonicP8Curve(pretestSummary.alphaCounts)

      const pretestUsedPaths = new Set()
      for (const r of pretestRecords) {
        if (r.image_path) pretestUsedPaths.add(normalizePath(r.image_path))
      }

      const masterManifest = await loadCSV('assets/stimuli_master_pool/manifest.csv')
      const alphaToImages = {}
      for (const row of masterManifest) {
        const a = parseFloat(parseFloat(row.alpha).toFixed(2))
        if (!alphaToImages[a]) alphaToImages[a] = []
        const relPath = 'stimuli_master_pool/' + row.alpha_dir + '/' + row.filename
        alphaToImages[a].push({
          rank: parseInt(row.rank),
          image_path: relPath
        })
      }
      for (const a of Object.keys(alphaToImages)) {
        alphaToImages[a].sort((x, y) => x.rank - y.rank)
        alphaToImages[a] = alphaToImages[a].filter(item =>
          !pretestUsedPaths.has(normalizePath(item.image_path))
        )
      }

      const { selected, selectedInfo } = selectAlphas(
        pretestSummary.alphaCounts, alphaToImages, mu, sigma, monoPredict
      )
      console.log('Selected alphas:', selected)

      const totalPlannedTrials = FORMAL_PLAN.reduce((s, c) => s + parseInt(c.n_trials), 0)
      const expectedMetrics = computeExpectedMetrics(selectedInfo, totalPlannedTrials, FORMAL_PLAN)
      calibrationSummaryRows = buildCalibrationSummary(selectedInfo, mu, sigma, nll, expectedMetrics, FORMAL_PLAN)

      const formalTrials = generateFormalTrials(
        selected, alphaToImages, pretestUsedPaths, totalPlannedTrials, subjectSeed
      )
      console.log('Formal trials generated:', formalTrials.length)

      const blockResult = splitBlocks(formalTrials, 11, 100, subjectSeed)
      formalBlocks = blockResult.formalBlocks
      blockDistributionRows = blockResult.blockDistributionRows

      totalTimeline.push(formalIntro)

      const formalImagePaths = new Set()
      for (const blockId of Object.keys(formalBlocks)) {
        for (const t of formalBlocks[blockId]) {
          formalImagePaths.add(assetPath(t.image_path))
        }
      }
      totalTimeline.push(getPreloadTimeline([...formalImagePaths]))

      const formalTrialTimeline = buildFormalTimeline(jsPsych, formalBlocks)
      totalTimeline.push(...formalTrialTimeline)
    } else {
      console.warn('Pretest invalid, skipping formal experiment')
    }
  }

  jsPsych.__dataCollector = {
    pretestRecords,
    calibrationSummaryRows,
    blockDistributionRows,
    formalBlocks,
    pretestAlphaSummary: pretestAlphaSummaryRows
  }

  totalTimeline.push(endingTimeline(() => {
    triggerDownload(jsPsych)
  }))

  jsPsych.run(totalTimeline)
})().catch(err => {
  console.error('Experiment setup failed:', err)
  document.body.innerHTML = `<div style="color:red;padding:40px;font-size:20px;">
    <h1>实验初始化失败</h1>
    <p>${err.message}</p>
    <p>请检查控制台以获取详细信息。</p>
  </div>`
})

function triggerDownload(jsPsych) {
  const collector = jsPsych.__dataCollector || {}
  const allData = jsPsych.data.get().filter({}).values
  const params = readFormParams()
  const dateStr = getDateStr()

  setTimeout(() => {
    downloadAllData(params.participant, allData, {
      pretestAlphaSummary: collector.pretestAlphaSummary || [],
      calibrationSummary: collector.calibrationSummaryRows || [],
      blockDistribution: collector.blockDistributionRows || [],
      formalBlocks: collector.formalBlocks || {}
    }, { dateStr }).then(() => {
      console.log('Data download complete.')
      const msgEl = document.querySelector('.instruction-text')
      if (msgEl) {
        msgEl.innerHTML = `
          <h1>实验结束</h1>
          <p>感谢你的参与！</p>
          <p>数据已下载完成。</p>
          <p>你可以关闭此页面。</p>
        `
      }
    }).catch(err => {
      console.error('Download failed, saving raw CSV:', err)
      downloadCSV(allData, RAW_DATA_FIELDS, `${params.participant}_raw_data_${dateStr}.csv`)
    })
  }, 100)
}
