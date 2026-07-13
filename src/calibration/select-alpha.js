import { logisticP8, invLogisticAlpha } from './logistic.js'

export const FORMAL_PLAN = [
  // Every difficulty is selected from the participant's pretest curve.
  { difficulty_id: 'D1', target_p8: 0.00, n_trials: 82,  label_digit: 3, selection_mode: 'target_p8' },
  { difficulty_id: 'D2', target_p8: 0.16, n_trials: 165, label_digit: 3, selection_mode: 'target_p8' },
  { difficulty_id: 'D3', target_p8: 0.34, n_trials: 578, label_digit: 3, selection_mode: 'target_p8' },
  { difficulty_id: 'D4', target_p8: 0.66, n_trials: 209, label_digit: 8, selection_mode: 'target_p8' },
  { difficulty_id: 'D5', target_p8: 0.84, n_trials: 38,  label_digit: 8, selection_mode: 'target_p8' },
  { difficulty_id: 'D6', target_p8: 1.00, n_trials: 28,  label_digit: 8, selection_mode: 'target_p8' }
]

export const P8_WINDOWS = {
  D1: [0.00, 0.18],
  D2: [0.08, 0.24],
  D3: [0.26, 0.42],
  D4: [0.56, 0.74],
  D5: [0.76, 0.92],
  D6: [0.82, 1.00]
}

const TARGET_GAP_WARN = 0.05
const TARGET_GAP_STRONG_WARN = 0.08
const TARGET_GAP_HARD = 0.15
const ALLOW_DUPLICATE_ALPHA_ACROSS_D = false

const RESERVED_ANCHOR_ALPHAS = new Set()
for (const cfg of FORMAL_PLAN) {
  if (cfg.selection_mode === 'fixed_anchor' && cfg.anchor_alphas) {
    for (const a of cfg.anchor_alphas) {
      RESERVED_ANCHOR_ALPHAS.add(parseFloat(a.toFixed(2)))
    }
  }
}

function labelSideOk(alphaValue, labelDigitValue, boundary = 0.50) {
  const a = parseFloat(alphaValue)
  const ld = parseInt(labelDigitValue)
  if (ld === 3) return a < boundary
  if (ld === 8) return a > boundary
  return false
}

function labelTypeFromDigit(labelDigitValue) {
  return parseInt(labelDigitValue) === 3 ? 'normal' : 'defect'
}

export function selectAlphas(
  alphaCounts,
  alphaToImages,
  mu,
  sigma,
  monoPredictP8
) {
  const predictP8ForSelection = (a) => {
    const pLogistic = logisticP8(a, mu, sigma)
    let pMono
    try { pMono = monoPredictP8(a) } catch (e) { pMono = pLogistic }
    return Math.max(0.0, Math.min(1.0, 0.75 * pLogistic + 0.25 * pMono))
  }

  const availableAlphas = Object.keys(alphaToImages).sort((a, b) => parseFloat(a) - parseFloat(b))
  const neededByAlpha = {}
  const selectedAlphasUsed = new Set()
  const selected = {}
  const selectedInfo = {}

  function candidateRows(labelDigitValue, targetP8, nNeed, usedAlphas, excludeReserved) {
    const rows = []
    for (const aStr of availableAlphas) {
      const a = parseFloat(parseFloat(aStr).toFixed(2))
      if (!labelSideOk(a, labelDigitValue)) continue
      if (excludeReserved && RESERVED_ANCHOR_ALPHAS.has(a)) continue
      if (!ALLOW_DUPLICATE_ALPHA_ACROSS_D && usedAlphas.has(a)) continue
      const availableN = (alphaToImages[aStr] || []).length
      const remainN = availableN - (neededByAlpha[a] || 0)
      if (remainN < nNeed) continue
      const p8Pred = predictP8ForSelection(a)
      const p8Logistic = logisticP8(a, mu, sigma)
      let p8Mono
      try { p8Mono = monoPredictP8(a) } catch (e) { p8Mono = p8Logistic }
      rows.push({
        alpha: a,
        p8Pred, p8Logistic, p8Mono,
        targetGap: Math.abs(p8Pred - parseFloat(targetP8)),
        availableN, remainN
      })
    }
    return rows
  }

  function summarizeChoice(cfg, chosen, rows, selectionMode, chosenRank, duplicateFallback, reservedFallback) {
    const dname = cfg.difficulty_id
    const targetP8 = parseFloat(cfg.target_p8)
    const cfgLabel = parseInt(cfg.label_digit)
    const nTrials = parseInt(cfg.n_trials)
    const p8Values = rows.map(r => r.p8Pred)
    const feasibleP8Min = Math.min(...p8Values)
    const feasibleP8Max = Math.max(...p8Values)
    const targetReachable = feasibleP8Min <= targetP8 && targetP8 <= feasibleP8Max
    const targetGap = chosen.targetGap
    const [lowWin, highWin] = P8_WINDOWS[dname] || [0.0, 1.0]
    const p8WindowOk = lowWin <= chosen.p8Pred && chosen.p8Pred <= highWin
    const warningParts = []
    if (selectionMode === 'fixed_anchor' && chosenRank > 0) warningParts.push('anchor_fallback_used')
    if (duplicateFallback) warningParts.push('duplicate_alpha_fallback_used')
    if (reservedFallback) warningParts.push('reserved_anchor_fallback_used')
    if (!targetReachable) warningParts.push('target_not_reachable')
    if (targetGap > TARGET_GAP_WARN) warningParts.push('target_gap=' + targetGap.toFixed(3))
    if (!p8WindowOk) warningParts.push('outside_p8_window')
    const warningMsg = warningParts.join(';')
    const expectedCorrect = cfgLabel === 3 ? 1.0 - chosen.p8Pred : chosen.p8Pred
    let anchorCandidates = ''
    if (selectionMode === 'fixed_anchor' && cfg.anchor_alphas) {
      anchorCandidates = cfg.anchor_alphas.map(a => a.toFixed(2)).join('/')
    }
    return {
      difficulty_id: dname,
      selection_mode: selectionMode,
      selected_alpha: chosen.alpha,
      target_p8: targetP8,
      fitted_p8: chosen.p8Pred,
      fitted_p8_logistic: chosen.p8Logistic,
      fitted_p8_mono: chosen.p8Mono,
      target_gap: targetGap,
      ideal_alpha_logistic: invLogisticAlpha(targetP8, mu, sigma),
      label_digit: cfgLabel,
      n_trials: nTrials,
      candidate_count: rows.length,
      feasible_p8_min: feasibleP8Min,
      feasible_p8_max: feasibleP8Max,
      target_reachable_by_side: targetReachable,
      target_feasible: targetReachable && targetGap <= TARGET_GAP_STRONG_WARN,
      expected_correct: expectedCorrect,
      p8_window_low: lowWin,
      p8_window_high: highWin,
      p8_window_ok: p8WindowOk,
      anchor_fixed_used: selectionMode === 'fixed_anchor',
      anchor_candidates: anchorCandidates,
      anchor_fallback_used: selectionMode === 'fixed_anchor' && chosenRank > 0,
      duplicate_fallback_used: duplicateFallback,
      reserved_anchor_fallback_used: reservedFallback,
      warning_msg: warningMsg
    }
  }

  function chooseFixedAnchor(cfg, usedAlphas) {
    const dname = cfg.difficulty_id
    const targetP8 = parseFloat(cfg.target_p8)
    const cfgLabel = parseInt(cfg.label_digit)
    const nNeed = parseInt(cfg.n_trials)
    const anchorAlphas = (cfg.anchor_alphas || []).map(a => parseFloat(parseFloat(a).toFixed(2)))
    let rows = []
    let duplicateFallback = false
    for (const a of anchorAlphas) {
      if (!labelSideOk(a, cfgLabel)) continue
      if (!ALLOW_DUPLICATE_ALPHA_ACROSS_D && usedAlphas.has(a)) continue
      const availableN = (alphaToImages[String(a)] || []).length
      const remainN = availableN - (neededByAlpha[a] || 0)
      if (remainN < nNeed) continue
      const p8Pred = predictP8ForSelection(a)
      const p8Logistic = logisticP8(a, mu, sigma)
      let p8Mono
      try { p8Mono = monoPredictP8(a) } catch (e) { p8Mono = p8Logistic }
      rows.push({ alpha: a, p8Pred, p8Logistic, p8Mono, targetGap: Math.abs(p8Pred - targetP8), availableN, remainN })
    }
    if (rows.length === 0 && !ALLOW_DUPLICATE_ALPHA_ACROSS_D) {
      duplicateFallback = true
      return chooseAnchorAllowDuplicate(cfg, true)
    }
    if (rows.length === 0) throw new Error(`${dname} fixed anchor 没有可用 alpha：${anchorAlphas.join(',')}`)
    const byAlpha = {}
    for (const r of rows) byAlpha[r.alpha] = r
    let chosen = null, chosenRank = 999
    for (let idx = 0; idx < anchorAlphas.length; idx++) {
      if (byAlpha[anchorAlphas[idx]] !== undefined) {
        chosen = byAlpha[anchorAlphas[idx]]
        chosenRank = idx
        break
      }
    }
    return summarizeChoice(cfg, chosen, rows, 'fixed_anchor', chosenRank, duplicateFallback, false)
  }

  function chooseAnchorAllowDuplicate(cfg, duplicateFallback) {
    const dname = cfg.difficulty_id
    const cfgLabel = parseInt(cfg.label_digit)
    const nNeed = parseInt(cfg.n_trials)
    const anchorAlphas = (cfg.anchor_alphas || []).map(a => parseFloat(parseFloat(a).toFixed(2)))
    const rows = []
    for (const a of anchorAlphas) {
      if (!labelSideOk(a, cfgLabel)) continue
      const availableN = (alphaToImages[String(a)] || []).length
      const remainN = availableN - (neededByAlpha[a] || 0)
      if (remainN < nNeed) continue
      const p8Pred = predictP8ForSelection(a)
      const p8Logistic = logisticP8(a, mu, sigma)
      let p8Mono
      try { p8Mono = monoPredictP8(a) } catch (e) { p8Mono = p8Logistic }
      rows.push({ alpha: a, p8Pred, p8Logistic, p8Mono, targetGap: Math.abs(p8Pred - cfg.target_p8), availableN, remainN })
    }
    if (rows.length === 0) throw new Error(`${dname} fixed anchor 没有可用 alpha：${anchorAlphas.join(',')}`)
    const byAlpha = {}
    for (const r of rows) byAlpha[r.alpha] = r
    let chosen = null, chosenRank = 999
    for (let idx = 0; idx < anchorAlphas.length; idx++) {
      if (byAlpha[anchorAlphas[idx]] !== undefined) {
        chosen = byAlpha[anchorAlphas[idx]]
        chosenRank = idx
        break
      }
    }
    return summarizeChoice(cfg, chosen, rows, 'fixed_anchor', chosenRank, duplicateFallback, false)
  }

  function chooseTargetP8(cfg, usedAlphas) {
    const targetP8 = parseFloat(cfg.target_p8)
    const cfgLabel = parseInt(cfg.label_digit)
    const nNeed = parseInt(cfg.n_trials)
    let rows = candidateRows(cfgLabel, targetP8, nNeed, usedAlphas, true)
    let reservedFallback = false
    let duplicateFallback = false
    if (rows.length === 0) {
      reservedFallback = true
      rows = candidateRows(cfgLabel, targetP8, nNeed, usedAlphas, false)
    }
    if (rows.length === 0 && !ALLOW_DUPLICATE_ALPHA_ACROSS_D) {
      duplicateFallback = true
      rows = candidateRows(cfgLabel, targetP8, nNeed, new Set(), false)
    }
    if (rows.length === 0) throw new Error(`${cfg.difficulty_id} 没有可用 alpha。`)
    const [lowWin, highWin] = P8_WINDOWS[cfg.difficulty_id] || [0.0, 1.0]
    const windowRows = rows.filter(r => lowWin <= r.p8Pred && r.p8Pred <= highWin)
    if (windowRows.length > 0) rows = windowRows
    const idealAlpha = invLogisticAlpha(targetP8, mu, sigma)
    rows.sort((a, b) => {
      if (a.targetGap !== b.targetGap) return a.targetGap - b.targetGap
      return Math.abs(a.alpha - idealAlpha) - Math.abs(b.alpha - idealAlpha)
    })
    const chosen = rows[0]
    return summarizeChoice(cfg, chosen, rows, 'target_p8', 0, duplicateFallback, reservedFallback)
  }

  for (const cfg of FORMAL_PLAN) {
    let info
    if (cfg.selection_mode === 'fixed_anchor') {
      info = chooseFixedAnchor(cfg, selectedAlphasUsed)
    } else {
      info = chooseTargetP8(cfg, selectedAlphasUsed)
    }
    const dname = cfg.difficulty_id
    const chosenAlpha = info.selected_alpha
    selected[dname] = chosenAlpha
    selectedInfo[dname] = info
    neededByAlpha[chosenAlpha] = (neededByAlpha[chosenAlpha] || 0) + parseInt(cfg.n_trials)
    selectedAlphasUsed.add(chosenAlpha)
  }

  return { selected, selectedInfo }
}
