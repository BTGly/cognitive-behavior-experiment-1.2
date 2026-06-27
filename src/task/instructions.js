export function instructionTimeline(text, advanceKey = 'Enter') {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `<div class="instruction-text">${text}</div>`,
    choices: [advanceKey],
    response_ends_trial: true
  }
}

export const WELCOME_TEXT = `
  <h1>欢迎参加本实验</h1>
  <p>本实验是一个模拟异常检测任务。</p>
  <p>你可以把自己想象成一名质检员：<br>
  屏幕上会快速出现一张图像，<br>
  你需要判断它更像"正常样本"还是"缺陷样本"。</p>
  <p>在本实验中：<br>
  <b>正常样本 = 数字 3</b> &nbsp;&nbsp;&nbsp; <b>缺陷样本 = 数字 8</b></p>
  <p>实验主要包括：<br>
  1. 练习：熟悉按键和规则<br>
  2. 预实验：估计你的个人难度水平<br>
  3. 正式实验：完成主要判断任务</p>
  <p>准备好后，请按 Enter 开始。</p>
`

export const PRACTICE_INTRO = `
  <h1>练习阶段</h1>
  <p>接下来你将进行一些练习，熟悉实验流程。</p>
  <p>按键规则：</p>
  <p><b>F 键</b> = 判断为正常样本（数字 3）</p>
  <p><b>K 键</b> = 判断为缺陷样本（数字 8）</p>
  <p>图片出现后请尽快按键判断。<br>
  按住按键的时间代表你的信心程度：<br>
  按得越久 = 越有把握。</p>
  <p>准备好后，请按 Enter 开始练习。</p>
`

export const PRETEST_INTRO = `
  <h1>预实验阶段</h1>
  <p>接下来你将完成 180 个预实验 trial。</p>
  <p>预实验的结果将用于估算你的个人难度水平，<br>
  以便在正式实验中为你选择合适的题目。</p>
  <p>请认真完成每一题。</p>
  <p>准备好后，请按 Enter 开始预实验。</p>
`

export const FORMAL_INTRO = `
  <h1>正式实验</h1>
  <p>正式实验共 11 个 block，每个 block 100 题。</p>
  <p>每个 block 结束后你可以短暂休息。</p>
  <p>请保持注意力集中，认真完成每一题。</p>
  <p>准备好后，请按 Enter 开始正式实验。</p>
`

export const ENDING_TEXT = `
  <h1>实验结束</h1>
  <p>感谢你的参与！</p>
  <p>你的数据将会被自动保存。</p>
  <p>请等待数据下载完成。</p>
`
