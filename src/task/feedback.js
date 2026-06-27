export function trialFeedbackTimeline(correct, showTime = 0.8) {
  let text, cls
  if (correct === true) {
    text = '正确！'
    cls = 'feedback-correct'
  } else if (correct === false) {
    text = '错误'
    cls = 'feedback-incorrect'
  } else {
    text = '超时'
    cls = 'feedback-timeout'
  }
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `<div class="${cls}" style="font-size:28px;">${text}</div>`,
    choices: ['NO_KEYS'],
    trial_duration: showTime * 1000,
    response_ends_trial: false
  }
}

export function blockFeedbackTimeline(blockId, blockData) {
  const normalN = blockData.filter(t => t.label_digit === 3).length
  const defectN = blockData.filter(t => t.label_digit === 8).length
  const correctN = blockData.filter(t => t.manual_accuracy === 1).length
  const totalN = blockData.length
  const accuracy = totalN > 0 ? (correctN / totalN * 100).toFixed(1) : '0'
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
      <div class="block-feedback">
        <h2>第 ${blockId} 组 完成</h2>
        <p>正确率: ${accuracy}% (${correctN}/${totalN})</p>
        <p>正常题: ${normalN} 题 | 缺陷题: ${defectN} 题</p>
        <p>按 Enter 继续</p>
      </div>
    `,
    choices: ['Enter'],
    response_ends_trial: true
  }
}
