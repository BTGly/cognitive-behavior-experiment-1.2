import { loadCSV } from '../csv.js'
import { conditionPath, assetPath, normalizePath } from '../paths.js'
import { getDateStr, readFormParams } from '../config.js'
import { trialFeedbackTimeline } from '../task/feedback.js'

export async function buildPracticeTimeline(jsPsych) {
  const params = readFormParams()
  const practiceCount = Math.max(0, Math.min(80, params.practice_count || 24))
  if (practiceCount <= 0) return []

  const allRows = await loadCSV(conditionPath('practice_data.csv'))
  const rows = allRows.slice(0, practiceCount)

  const timeline = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rawImagePath = normalizePath(row.image_path)
    const imageAssetPath = assetPath(rawImagePath)

    const trial = {
      type: 'hold-response-trial',
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
      label_type: row.label_type,
      sample_type: row.label_type,
      image_path: rawImagePath,
      participant: params.participant,
      date: getDateStr()
    }

    timeline.push(trial)

    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: () => {
        const lastData = jsPsych.data.get().filter({}).values.slice(-1)[0]
        if (!lastData) return '<div>---</div>'
        const correct = lastData.manual_accuracy
        let text, cls
        if (correct === 1) { text = '正确！'; cls = 'feedback-correct' }
        else if (correct === 0) { text = '错误'; cls = 'feedback-incorrect' }
        else { text = '超时'; cls = 'feedback-timeout' }
        return `<div class="${cls}" style="font-size:28px;">${text}</div>`
      },
      choices: ['NO_KEYS'],
      trial_duration: 800,
      response_ends_trial: false
    })
  }

  return timeline
}
