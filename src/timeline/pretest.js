import { loadCSV } from '../csv.js'
import { conditionPath, assetPath, normalizePath } from '../paths.js'
import { getDateStr, readFormParams } from '../config.js'
import { normalizeLabelType } from '../calibration/formal-generator.js'
import { pretestBlockFeedbackTimeline } from '../task/feedback.js'
import HoldResponseTrialPlugin from '../task/hold-response-trial.js'

export async function buildPretestTimeline(jsPsych) {
  const params = readFormParams()
  if (!params.run_pretest) return { timeline: [], pretestRecords: [] }

  const manifest = await loadCSV(conditionPath('pilot_manifest.csv'))
  const pretestRecords = []
  const timeline = []

  let globalIndex = 0

  const totalBlocks = manifest.length

  for (let groupIndex = 0; groupIndex < manifest.length; groupIndex++) {
    const groupRow = manifest[groupIndex]
    const csvPath = 'assets/' + groupRow.csv_path
    const groupTrials = await loadCSV(csvPath)

    for (const row of groupTrials) {
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
        phase: 'pretest',
        trial_index: globalIndex,
        block_id: parseInt(groupRow.group_id) + 1,
        trial_in_block: parseInt(row.trial_in_group) + 1,
        difficulty_id: '',
        difficulty_rank: 0,
        alpha: row.alpha,
        label_digit: parseInt(row.label_digit),
        label_type: normalizeLabelType(row.label_type, row.label_digit),
        sample_type: normalizeLabelType(row.sample_type || row.label_type, row.label_digit),
        image_path: rawImagePath,
        participant: params.participant,
        date: getDateStr(),
        on_finish: (data) => {
          pretestRecords.push({ ...data })
        }
      }

      timeline.push(trial)
      globalIndex++
    }

    timeline.push(pretestBlockFeedbackTimeline(groupIndex + 1, totalBlocks))
  }

  return { timeline, pretestRecords }
}
