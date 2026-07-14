import { getDateStr, readFormParams } from '../config.js'
import { blockFeedbackTimeline, formalBlockIntroTimeline } from '../task/feedback.js'
import { assetPath, normalizePath } from '../paths.js'
import { normalizeLabelType } from '../calibration/formal-generator.js'
import HoldResponseTrialPlugin from '../task/hold-response-trial.js'

export function buildFormalTimeline(jsPsych, formalBlocks, options = {}) {
  const params = readFormParams()
  const timeline = []
  const dateStr = getDateStr()

  const blockIds = Object.keys(formalBlocks).sort((a, b) => parseInt(a) - parseInt(b))
  const startGroup = params.start_group || 1
  const endGroup = params.end_group || 11
  const skipCompletedBlocks = new Set((options.skipCompletedBlocks || []).map(b => parseInt(b)))

  const activeBlockIds = blockIds.filter(id => {
    const n = parseInt(id)
    return n >= startGroup && n <= endGroup && !skipCompletedBlocks.has(n)
  })

  if (activeBlockIds.length === 0) {
    throw new Error(`没有可运行的正式 block：start_group=${startGroup}, end_group=${endGroup}，有效 block 范围 1–${blockIds.length}`)
  }

  for (let bi = 0; bi < activeBlockIds.length; bi++) {
    const blockId = activeBlockIds[bi]
    const trials = formalBlocks[blockId]
    const blockNum = parseInt(blockId)
    const blockTiming = { startedAt: null }

    timeline.push(formalBlockIntroTimeline(blockNum, 11, trials.length))

    for (let trialOffset = 0; trialOffset < trials.length; trialOffset++) {
      const row = trials[trialOffset]
      const rawImagePath = normalizePath(row.image_path)
      const imageAssetPath = assetPath(rawImagePath)

      timeline.push({
        type: HoldResponseTrialPlugin,
        stimulus: imageAssetPath,
        stimulus_ms: 200,
        fixation_ms: row.fixation_ms,
        show_time: row.show_time,
        response_timeout: 2.0,
        max_hold: 1.0,
        phase: 'formal',
        trial_index: row.trial_index,
        block_id: row.block_id,
        trial_in_block: row.trial_in_block,
        difficulty_id: row.difficulty_id,
        difficulty_rank: row.difficulty_rank,
        alpha: row.alpha,
        label_digit: row.label_digit,
        label_type: normalizeLabelType(row.label_type, row.label_digit),
        sample_type: normalizeLabelType(row.sample_type || row.label_type, row.label_digit),
        image_path: rawImagePath,
        participant: params.participant,
        date: dateStr,
        on_finish: (data) => {
          if (!blockTiming.startedAt) {
            blockTiming.startedAt = data.trial_started_at || new Date().toISOString()
          }
          data.block_started_at = blockTiming.startedAt

          if (trialOffset === trials.length - 1) {
            const blockEndedAt = data.trial_ended_at || new Date().toISOString()
            data.block_ended_at = blockEndedAt
            data.block_elapsed_ms = elapsedMs(blockTiming.startedAt, blockEndedAt)
          }
        }
      })
    }

    timeline.push(blockFeedbackTimeline(jsPsych, blockNum, 11, trials.length))
  }

  return timeline
}

function elapsedMs(startedAt, endedAt) {
  const elapsed = Date.parse(endedAt) - Date.parse(startedAt)
  return Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null
}
