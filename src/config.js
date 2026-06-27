export function createParamForm() {
  const formHtml = `
    <div class="param-form">
      <h1>模糊辨别实验</h1>
      <label>被试编号: <input type="text" id="participant" value="S001" autocomplete="off"></label>
      <label>练习次数: <input type="number" id="practice_count" value="24" min="0" max="80"></label>
      <label>起始组: <input type="number" id="start_group" value="1" min="1" max="11"></label>
      <label>结束组: <input type="number" id="end_group" value="11" min="1" max="11"></label>
      <label>运行预实验: <input type="checkbox" id="run_pretest" checked></label>
      <br>
      <button id="start-btn">开始实验</button>
    </div>
  `
  return formHtml
}

export function readFormParams() {
  return {
    participant: document.getElementById('participant').value.trim() || 'S001',
    practice_count: parseInt(document.getElementById('practice_count').value) || 24,
    start_group: parseInt(document.getElementById('start_group').value) || 1,
    end_group: parseInt(document.getElementById('end_group').value) || 11,
    run_pretest: document.getElementById('run_pretest').checked ? 1 : 0
  }
}

export function getDateStr() {
  const d = new Date()
  const pad2 = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}_${pad2(d.getHours())}h${pad2(d.getMinutes())}m${pad2(d.getSeconds())}s`
}
