import { FORMAL_PLAN as FORMAL_PLAN_SRC } from '../calibration/select-alpha.js'

export function computePretestAlphaSummary(pretestRecords) {
  const alphaCounts = {}
  for (const r of pretestRecords) {
    if (parseInt(r.response_timeout) === 1) continue
    const cd = r.choice_digit
    if (cd === null || cd === undefined || cd === '') continue
    const a = parseFloat(parseFloat(r.alpha).toFixed(2))
    if (!alphaCounts[a]) alphaCounts[a] = { n: 0, k: 0 }
    alphaCounts[a].n++
    if (parseInt(cd) === 8) alphaCounts[a].k++
  }

  const rows = []
  for (const a of Object.keys(alphaCounts).sort((x, y) => parseFloat(x) - parseFloat(y))) {
    const s = alphaCounts[a]
    rows.push({
      alpha: a,
      n_valid: s.n,
      n_choose8: s.k,
      p8_observed: s.n > 0 ? +(s.k / s.n).toFixed(6) : ''
    })
  }
  return { alphaCounts, summaryRows: rows }
}

export function buildCalibrationSummary(selectedInfo, mu, sigma, nll, expectedMetrics, FORMAL_PLAN) {
  const plan = FORMAL_PLAN || FORMAL_PLAN_SRC
  const rows = []
  for (const cfg of plan) {
    const dname = cfg.difficulty_id
    const info = selectedInfo[dname]
    rows.push({
      difficulty_id: dname,
      selection_mode: info.selection_mode,
      selected_alpha: info.selected_alpha.toFixed(2),
      target_p8: cfg.target_p8,
      fitted_p8_at_selected_alpha: info.fitted_p8,
      fitted_p8_logistic: info.fitted_p8_logistic,
      fitted_p8_mono: info.fitted_p8_mono,
      expected_correct_at_selected_alpha: info.expected_correct,
      target_gap: info.target_gap,
      label_digit: cfg.label_digit,
      n_trials: cfg.n_trials,
      candidate_count: info.candidate_count,
      feasible_p8_min: info.feasible_p8_min,
      feasible_p8_max: info.feasible_p8_max,
      target_reachable_by_side: info.target_reachable_by_side,
      target_feasible: info.target_feasible,
      anchor_fixed_used: info.anchor_fixed_used,
      anchor_candidates: info.anchor_candidates,
      anchor_fallback_used: info.anchor_fallback_used,
      duplicate_fallback_used: info.duplicate_fallback_used,
      reserved_anchor_fallback_used: info.reserved_anchor_fallback_used,
      p8_window_low: info.p8_window_low,
      p8_window_high: info.p8_window_high,
      p8_window_ok: info.p8_window_ok,
      warning_msg: info.warning_msg,
      mu, sigma, nll,
      expected_accuracy_overall: expectedMetrics.expectedAccuracy,
      expected_fpr: expectedMetrics.expectedFpr,
      expected_tpr: expectedMetrics.expectedTpr,
      expected_auc_binary: expectedMetrics.expectedAucBinary,
      expected_balanced_accuracy: expectedMetrics.expectedBalancedAccuracy,
      expected_mcc: expectedMetrics.expectedMcc,
      auc_qc_status: expectedMetrics.aucQcStatus,
      mcc_qc_status: expectedMetrics.mccQcStatus,
      auc_target: expectedMetrics.AUC_TARGET,
      auc_soft_floor: expectedMetrics.AUC_SOFT,
      auc_hard_floor: expectedMetrics.AUC_HARD,
      mcc_target: expectedMetrics.MCC_TARGET,
      mcc_soft_floor: expectedMetrics.MCC_SOFT,
      mcc_hard_floor: expectedMetrics.MCC_HARD
    })
  }
  return rows
}

export function computeExpectedMetrics(selectedInfo, totalPlannedTrials, FORMAL_PLAN) {
  const plan = FORMAL_PLAN || FORMAL_PLAN_SRC
  let expectedCorrectTotal = 0
  let normalTrialsN = 0
  let defectTrialsN = 0
  let expectedFp = 0
  let expectedTp = 0

  for (const cfg of plan) {
    const dname = cfg.difficulty_id
    const n = parseInt(cfg.n_trials)
    const cfgLabel = parseInt(cfg.label_digit)
    const p8 = selectedInfo[dname].fitted_p8
    expectedCorrectTotal += n * selectedInfo[dname].expected_correct
    if (cfgLabel === 3) {
      normalTrialsN += n
      expectedFp += n * p8
    } else {
      defectTrialsN += n
      expectedTp += n * p8
    }
  }

  const expectedAccuracy = expectedCorrectTotal / totalPlannedTrials
  const expectedFpr = expectedFp / normalTrialsN
  const expectedTpr = expectedTp / defectTrialsN
  const expectedAucBinary = 0.5 + 0.5 * (expectedTpr - expectedFpr)
  const expectedBalancedAccuracy = expectedAucBinary

  const tp = expectedTp
  const fn = defectTrialsN - expectedTp
  const fp = expectedFp
  const tn = normalTrialsN - expectedFp
  const den = Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn))
  const expectedMcc = den > 0 ? (tp * tn - fp * fn) / den : 0.0

  const AUC_TARGET = 0.60, AUC_SOFT = 0.58, AUC_HARD = 0.56
  const MCC_TARGET = 0.20, MCC_SOFT = 0.15, MCC_HARD = 0.10

  function qcStatus(value, target, softFloor, hardFloor) {
    if (value >= target) return 'pass'
    if (value >= softFloor) return 'soft_pass'
    if (value >= hardFloor) return 'warning_low'
    return 'fail'
  }

  return {
    expectedAccuracy,
    expectedFpr,
    expectedTpr,
    expectedAucBinary,
    expectedBalancedAccuracy,
    expectedMcc,
    aucQcStatus: qcStatus(expectedAucBinary, AUC_TARGET, AUC_SOFT, AUC_HARD),
    mccQcStatus: qcStatus(expectedMcc, MCC_TARGET, MCC_SOFT, MCC_HARD),
    AUC_TARGET, AUC_SOFT, AUC_HARD,
    MCC_TARGET, MCC_SOFT, MCC_HARD
  }
}
