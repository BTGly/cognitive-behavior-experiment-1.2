import { loadCSV } from '../csv.js'
import { conditionPath, assetPath, normalizePath } from '../paths.js'
import { getDateStr, readFormParams } from '../config.js'
import { practiceEndTimeline, practiceFeedbackTimeline } from '../task/feedback.js'
import { createRNG, seedFromParticipant } from '../random.js'
import { normalizeLabelType } from '../calibration/formal-generator.js'
import HoldResponseTrialPlugin from '../task/hold-response-trial.js'

export async function buildPracticeTimeline(jsPsych) {
  const params = readFormParams()
  const practiceCount = Math.max(0, Math.min(80, params.practice_count))
  if (practiceCount <= 0) return []

  const allRows = await loadCSV(conditionPath('practice_data.csv'))
  const rows = allRows.slice(0, practiceCount)

  // Shuffle practice trials deterministically per subject
  const rng = createRNG(seedFromParticipant(params.participant) + 9999)
  const shuffled = rng.shuffle(rows)

  const timeline = []
  const practiceState = { points: 0 }

  for (let i = 0; i < shuffled.length; i++) {
    const row = shuffled[i]
    const rawImagePath = normalizePath(row.image_path)
    const imageAssetPath = assetPath(rawImagePath)

    const trial = {
      type: HoldResponseTrialPlugin,
      stimulus: imageAssetPath,
      stimulus_ms: 200,
      fixation_ms: Math.round(parseFloat(row.show_time) * 1000),
      show_time: parseFloat(row.show_time),
      response_timeout: 2.0,
      max_hold: 1.0,
      phase: 'practice',
      trial_index: i,
      block_id: 0,
      trial_in_block: i + 1,
      difficulty_id: '',
      difficulty_rank: 0,
      alpha: row.alpha,
      label_digit: parseInt(row.label_digit),
      label_type: normalizeLabelType(row.label_type, row.label_digit),
      sample_type: normalizeLabelType(row.sample_type || row.label_type, row.label_digit),
      image_path: rawImagePath,
      participant: params.participant,
      date: getDateStr()
    }

    timeline.push(trial)
    timeline.push(practiceFeedbackTimeline(jsPsych, practiceState, practiceCount))
  }

  timeline.push(practiceEndTimeline(practiceState, practiceCount, params.run_pretest === 1))

  return timeline
}
