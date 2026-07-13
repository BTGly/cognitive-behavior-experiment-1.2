import { createParamForm, readFormParams, getDateStr } from '../config.js'

function textScreen(text) {
  return `<div class="instruction-text">${escapeHtml(text)}</div>`
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function createWelcomeTimeline(jsPsych) {
  const welcome = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: textScreen('欢迎参加本实验\n\n本实验是一个模拟异常检测任务。\n\n你可以把自己想象成一名质检员：\n屏幕上会快速出现一张图像，\n你需要判断它更像“正常样本”还是“缺陷样本”。\n\n在本实验中：\n正常样本 = 数字 3    缺陷样本 = 数字 8\n\n实验主要包括：\n1. 练习：熟悉按键和规则\n2. 预实验：估计你的个人难度水平\n3. 正式实验：完成主要判断任务\n\n准备好后，请按 Enter 开始。'),
    choices: ['Enter'],
    response_ends_trial: true,
    on_finish: () => {
      const params = readFormParams()
      jsPsych.data.addProperties({
        participant: params.participant,
        date: getDateStr()
      })
    }
  }
  return welcome
}

export function practiceIntroTimeline() {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: textScreen('环节1：练习\n\n这是正式任务前的练习环节。\n\n请判断图像更像正常样本还是缺陷样本：\n\nF = 正常样本（3）    K = 缺陷样本（8）\n\n图像出现后即可按键作答，图像只呈现 0.2 秒。\n图像消失后，左右按键提示仍会保留，你可以继续完成判断。\n\n按住时长表示你的自信程度：\n越确定，按住越久；\n最长按住 1 秒，松开即确认。\n\n练习阶段会显示对错反馈，\n帮助你熟悉规则。\n\n准备好后，请按 Enter 开始练习。'),
    choices: ['Enter'],
    response_ends_trial: true
  }
}

export function pretestIntroTimeline() {
  return [
    {
      type: jsPsychHtmlKeyboardResponse,
      stimulus: textScreen('环节2：预实验\n\n接下来是预实验环节。\n\n预实验的目的不是考察你的成绩，\n而是了解你对不同难度图像的判断情况。\n\n请始终根据你的第一感觉判断。\n正式实验的难度会根据你的预实验结果自动调整。\n\n准备好后，请按 Enter 继续。'),
      choices: ['Enter'],
      response_ends_trial: true
    },
    {
      type: jsPsychHtmlKeyboardResponse,
      stimulus: textScreen('预实验作答规则 ①\n\n请先注视屏幕中央的“+”。\n\n图像出现后即可按键作答，图像只呈现 0.2 秒。\n图像消失后，左右按键提示仍会保留，你可以继续完成判断。\n\n预实验不显示对错反馈。\n请根据第一感觉判断。\n\n准备好后，请按 Enter 继续。'),
      choices: ['Enter'],
      response_ends_trial: true
    },
    {
      type: jsPsychHtmlKeyboardResponse,
      stimulus: textScreen('预实验作答规则 ②\n\n图像出现后即可按键作答，图像只呈现 0.2 秒。\n图像消失后，左右按键提示仍会保留，你可以继续完成判断。\n\nF = 正常样本（3）  K = 缺陷样本（8）\n\n按住时长表示你的自信程度：\n越确定，按住越久。\n\n最长按住 1 秒，\n松开即确认。\n\n请不要刻意猜比例，\n每一题都根据当前图像判断。\n\n准备好后，请按 Enter 开始预实验。'),
      choices: ['Enter'],
      response_ends_trial: true
    }
  ]
}

export function pretestResumeIntroTimeline(resume) {
  const completed = (resume?.completed_blocks || []).join('、')
  const nextBlock = resume?.next_block
  const partialCount = parseInt(resume?.discarded_partial_blocks?.[String(nextBlock)] || 0)
  const discardedText = partialCount > 0
    ? `\n\n上次第 ${nextBlock} 组未完成的 ${partialCount} 题不会计入结果，本次将整组重新开始。`
    : ''
  const nextText = nextBlock
    ? `本次将从预实验第 ${nextBlock} 组开始。`
    : '三组预实验均已恢复，本次将直接生成正式实验排程。'

  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: textScreen(`预实验进度已恢复\n\n服务器已恢复完成的预实验组：${completed || '无'}。\n${nextText}${discardedText}\n\n请按 Enter 继续。`),
    choices: ['Enter'],
    response_ends_trial: true
  }
}

export function formalIntroTimeline() {
  return [
    {
      type: jsPsychHtmlKeyboardResponse,
      stimulus: textScreen('环节3：正式实验\n\n接下来你将完成一个模拟异常检测任务。\n\n请把自己想象成一名质检员：\n屏幕上会快速出现一张图像，\n你需要判断它更像“正常样本”还是“缺陷样本”。\n\n在本实验中：\n\n正常样本 = 数字 3    缺陷样本 = 数字 8\n\n准备好后，请按 Enter 继续。'),
      choices: ['Enter'],
      response_ends_trial: true
    },
    {
      type: jsPsychHtmlKeyboardResponse,
      stimulus: textScreen('在正式实验中，\n正常样本会比缺陷样本更多。\n\n也就是说，你会更常看到正常样本，\n但缺陷样本仍然会随机出现。\n\n请注意：\n不要机械地按照比例猜测，\n每一题都要根据当前图像本身作答。\n\n准备好后，请按 Enter 继续。'),
      choices: ['Enter'],
      response_ends_trial: true
    },
    {
      type: jsPsychHtmlKeyboardResponse,
      stimulus: textScreen('正式作答规则\n\n请先注视屏幕中央的“+”。\n\n图像出现后即可按键作答，图像只呈现 0.2 秒。\n图像消失后，左右按键提示仍会保留，你可以继续完成判断。\n\n按住时长表示你的自信程度：\n越确定，按住越久；\n最长按住 1 秒，松开即确认。\n\n正式实验不显示对错反馈。\n\n准备好后，请按 Enter 开始正式实验。'),
      choices: ['Enter'],
      response_ends_trial: true
    }
  ]
}

export function endingTimeline(downloadHandler) {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: textScreen('实验结束！感谢您的参与。\n\n数据正在打包下载中...'),
    choices: ['NO_KEYS'],
    trial_duration: 500,
    response_ends_trial: false,
    on_finish: () => {
      if (downloadHandler) downloadHandler()
    }
  }
}
