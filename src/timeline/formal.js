import { getDateStr, readFormParams } from '../config.js'
import { blockFeedbackTimeline } from '../task/feedback.js'
import { assetPath, normalizePath } from '../paths.js'

export function buildFormalTimeline(jsPsych, formalBlocks) {
  const params = readFormParams()
  const timeline = []
  const dateStr = getDateStr()

  const blockIds = Object.keys(formalBlocks).sort((a, b) => parseInt(a) - parseInt(b))
  const startGroup = params.start_group || 1
  const endGroup = params.end_group || 11

  const activeBlockIds = blockIds.filter(id => {
    const n = parseInt(id)
    return n >= startGroup && n <= endGroup
  })

  for (let bi = 0; bi < activeBlockIds.length; bi++) {
    const blockId = activeBlockIds[bi]
    const trials = formalBlocks[blockId]
    const blockNum = parseInt(blockId)

    for (const row of trials) {
      const rawImagePath = normalizePath(row.image_path)
      const imageAssetPath = assetPath(rawImagePath)

      timeline.push({
        type: 'hold-response-trial',
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
        label_type: row.label_type,
        sample_type: row.sample_type,
        image_path: rawImagePath,
        participant: params.participant,
        date: dateStr
      })
    }

    if (bi < activeBlockIds.length - 1) {
      timeline.push(blockFeedbackTimeline(blockNum, trials))
    }
  }

  return timeline
}
