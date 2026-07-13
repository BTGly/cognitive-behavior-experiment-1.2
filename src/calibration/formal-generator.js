import { FORMAL_PLAN } from './select-alpha.js'
import { createRNG } from '../random.js'

export const FIXATION_MS_OPTIONS = [500, 600, 700, 800, 900, 1000]

export function sampleFixationMs(rng) {
  return FIXATION_MS_OPTIONS[Math.floor(rng.next() * FIXATION_MS_OPTIONS.length)]
}

function labelTypeFromDigit(labelDigitValue) {
  return parseInt(labelDigitValue) === 3 ? 'normal' : 'defect'
}

export function normalizeLabelType(value, labelDigit) {
  const d = parseInt(labelDigit)
  if (d === 3) return 'normal'
  if (d === 8) return 'defect'
  if (value === 'abnormal') return 'defect'
  return value || ''
}

function normalizePath(path) {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/')
}

export function generateFormalTrials(selected, alphaToImages, pretestUsedPaths, totalPlanned, seed) {
  const alphaOffsets = {}
  const formalTrials = []
  let globalTrialIndex = 1
  const rng = createRNG(seed)

  for (const cfg of FORMAL_PLAN) {
    const dname = cfg.difficulty_id
    const a = selected[dname]
    const nNeed = parseInt(cfg.n_trials)
    const labelDigitFormal = parseInt(cfg.label_digit)
    const labelTypeFormal = labelTypeFromDigit(labelDigitFormal)
    const aStr = String(a)

    const startIdx = alphaOffsets[a] || 0
    const endIdx = startIdx + nNeed
    const imgs = (alphaToImages[aStr] || []).slice(startIdx, endIdx)
    alphaOffsets[a] = endIdx

    if (imgs.length < nNeed) {
      throw new Error(`${dname} alpha=${a.toFixed(2)} 抽图不足。需要 ${nNeed}，取到 ${imgs.length}。`)
    }

    for (const item of imgs) {
      const fixationMs = sampleFixationMs(rng)
      formalTrials.push({
        trial_index: globalTrialIndex,
        difficulty_id: dname,
        difficulty_rank: parseInt(dname.replace('D', '')),
        phase: 'formal',
        alpha: parseFloat(a).toFixed(2),
        label_digit: labelDigitFormal,
        label_type: labelTypeFormal,
        sample_type: labelTypeFormal,
        show_time: fixationMs / 1000.0,
        fixation_ms: fixationMs,
        stimulus_ms: 200,
        image_path: item.image_path
      })
      globalTrialIndex++
    }
  }

  if (formalTrials.length !== totalPlanned) {
    throw new Error(`正式 trial 数错误：${formalTrials.length}，应该是 ${totalPlanned}。`)
  }

  const formalImagePaths = formalTrials.map(t => normalizePath(t.image_path))
  const uniqueFormalPaths = new Set(formalImagePaths)
  if (formalImagePaths.length !== uniqueFormalPaths.size) {
    throw new Error('正式实验中存在重复图片，请检查抽图逻辑。')
  }

  const overlap = formalImagePaths.filter(p => pretestUsedPaths.has(p))
  if (overlap.length > 0) {
    throw new Error(`正式实验中有 ${overlap.length} 张图片与预实验重复。`)
  }

  return formalTrials
}

export function splitBlocks(formalTrials, nBlocks, blockSize, seed) {
  const rng = createRNG(seed + 1)

  if (formalTrials.length !== nBlocks * blockSize) {
    throw new Error(`正式 trial 总数错误：${formalTrials.length}，应为 ${nBlocks * blockSize}。`)
  }

  const quotaForBlock = (blockId) => blockId <= 5
    ? { D1: 8, D2: 15, D3: 52, D4: 19, D5: 4, D6: 2 }
    : { D1: 7, D2: 15, D3: 53, D4: 19, D5: 3, D6: 3 }

  // Keep every block at the original 75:25 label ratio and near-identical difficulty mix.
  const trialsByDifficulty = {}
  for (const trial of formalTrials) {
    if (!trialsByDifficulty[trial.difficulty_id]) trialsByDifficulty[trial.difficulty_id] = []
    trialsByDifficulty[trial.difficulty_id].push(trial)
  }
  for (const dname of Object.keys(trialsByDifficulty)) {
    trialsByDifficulty[dname] = rng.shuffle(trialsByDifficulty[dname])
  }
  const difficultyOffsets = { D1: 0, D2: 0, D3: 0, D4: 0, D5: 0, D6: 0 }

  const blockDistributionRows = []
  const formalBlocks = {}

  let globalTrialIndex = 1
  for (let b = 1; b <= nBlocks; b++) {
    const quota = quotaForBlock(b)
    const blockTrials = []
    for (const [dname, nNeed] of Object.entries(quota)) {
      const start = difficultyOffsets[dname]
      const end = start + nNeed
      const selectedRows = (trialsByDifficulty[dname] || []).slice(start, end)
      if (selectedRows.length !== nNeed) {
        throw new Error(`Block ${b} 的 ${dname} 数量不足：需要 ${nNeed}，取到 ${selectedRows.length}。`)
      }
      difficultyOffsets[dname] = end
      blockTrials.push(...selectedRows)
    }
    if (blockTrials.length !== blockSize) {
      throw new Error(`Block ${b} trial 数错误：${blockTrials.length}，应为 ${blockSize}。`)
    }
    const blockRng = createRNG(seed + 100 + b)
    const shuffledBlock = blockRng.shuffle(blockTrials)

    let normalN = 0, defectN = 0
    const dCounts = { D1: 0, D2: 0, D3: 0, D4: 0, D5: 0, D6: 0 }

    const trials = []
    for (let j = 0; j < shuffledBlock.length; j++) {
      const row = { ...shuffledBlock[j] }
      row.trial_index = globalTrialIndex
      row.block_id = b
      row.trial_in_block = j + 1
      globalTrialIndex++

      if (row.label_digit === 3) normalN++
      else if (row.label_digit === 8) defectN++
      if (dCounts[row.difficulty_id] !== undefined) dCounts[row.difficulty_id]++

      trials.push(row)
    }

    formalBlocks[b] = trials
    blockDistributionRows.push({
      block_id: b,
      normal_n: normalN,
      defect_n: defectN,
      defect_rate: +(defectN / blockSize).toFixed(4),
      D1: dCounts.D1, D2: dCounts.D2, D3: dCounts.D3,
      D4: dCounts.D4, D5: dCounts.D5, D6: dCounts.D6
    })
  }

  const totalNormal = blockDistributionRows.reduce((s, r) => s + r.normal_n, 0)
  const totalDefect = blockDistributionRows.reduce((s, r) => s + r.defect_n, 0)
  if (totalNormal + totalDefect !== nBlocks * blockSize) {
    throw new Error('总体 label 数量错误。')
  }
  for (const [dname, rows] of Object.entries(trialsByDifficulty)) {
    if (difficultyOffsets[dname] !== rows.length) {
      throw new Error(`${dname} 未被完整分配：已分配 ${difficultyOffsets[dname]}，总计 ${rows.length}。`)
    }
  }

  return { formalBlocks, blockDistributionRows }
}
