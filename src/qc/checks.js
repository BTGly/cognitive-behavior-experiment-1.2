export function checkBlockDistribution(blockDistributionRows, totalTrials) {
  const warnings = []
  for (const row of blockDistributionRows) {
    if (row.defect_rate < 0.10 || row.defect_rate > 0.40) {
      warnings.push(`Block ${row.block_id} defect rate extreme: ${row.defect_rate}`)
    }
  }
  const totalNormal = blockDistributionRows.reduce((s, r) => s + r.normal_n, 0)
  const totalDefect = blockDistributionRows.reduce((s, r) => s + r.defect_n, 0)
  if (totalNormal + totalDefect !== totalTrials) {
    warnings.push(`Total trials mismatch: ${totalNormal + totalDefect} vs ${totalTrials}`)
  }
  return warnings
}

export function verifyPretestRecords(pretestRecords) {
  if (pretestRecords.length === 0) return { valid: false, msg: 'No pretest records' }
  const alphas = new Set(pretestRecords.map(r => parseFloat(parseFloat(r.alpha).toFixed(2))))
  return {
    valid: alphas.size >= 6,
    nAlphas: alphas.size,
    nRecords: pretestRecords.length,
    msg: alphas.size >= 6 ? 'ok' : `Only ${alphas.size} alpha levels (< 6 required)`
  }
}
