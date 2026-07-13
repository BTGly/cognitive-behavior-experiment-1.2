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

  const expectedBlocks = 3
  const expectedTrialsPerBlock = 60
  const blockTrials = new Map()
  for (const record of pretestRecords) {
    const blockId = parseInt(record.block_id)
    const trialInBlock = parseInt(record.trial_in_block)
    if (!Number.isInteger(blockId) || blockId < 1 || blockId > expectedBlocks ||
        !Number.isInteger(trialInBlock) || trialInBlock < 1 || trialInBlock > expectedTrialsPerBlock) {
      return { valid: false, msg: 'Invalid pretest block or trial index' }
    }
    if (!blockTrials.has(blockId)) blockTrials.set(blockId, new Set())
    blockTrials.get(blockId).add(trialInBlock)
  }

  const completeBlocks = []
  for (let blockId = 1; blockId <= expectedBlocks; blockId++) {
    if (blockTrials.get(blockId)?.size === expectedTrialsPerBlock) completeBlocks.push(blockId)
  }
  const expectedTotal = expectedBlocks * expectedTrialsPerBlock
  if (pretestRecords.length !== expectedTotal || completeBlocks.length !== expectedBlocks) {
    return {
      valid: false,
      nRecords: pretestRecords.length,
      completeBlocks,
      msg: `Pretest incomplete: ${pretestRecords.length}/${expectedTotal} records, complete blocks ${completeBlocks.join(',') || 'none'}`
    }
  }

  const alphas = new Set(pretestRecords.map(r => parseFloat(parseFloat(r.alpha).toFixed(2))))
  return {
    valid: alphas.size >= 6,
    nAlphas: alphas.size,
    nRecords: pretestRecords.length,
    completeBlocks,
    msg: alphas.size >= 6 ? 'ok' : `Only ${alphas.size} alpha levels (< 6 required)`
  }
}
