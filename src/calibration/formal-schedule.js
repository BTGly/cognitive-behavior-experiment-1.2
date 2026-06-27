import { FORMAL_PLAN } from './select-alpha.js'
import { generateFormalTrials, splitBlocks } from './formal-generator.js'
import { loadFormalImagePool } from '../data/formal-pool.js'

function computeFormalScheduleHash(formalBlocks) {
  const stable = JSON.stringify(formalBlocks, Object.keys(formalBlocks).sort())
  let hash = 0
  for (let i = 0; i < stable.length; i++) {
    const ch = stable.charCodeAt(i)
    hash = ((hash << 5) - hash) + ch
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

export async function buildFormalSchedule({ selected, pretestUsedPaths, subjectSeed }) {
  const totalPlanned = FORMAL_PLAN.reduce((s, c) => s + parseInt(c.n_trials), 0)
  const alphaToImages = await loadFormalImagePool(pretestUsedPaths)

  const formalTrials = generateFormalTrials(
    selected, alphaToImages, pretestUsedPaths, totalPlanned, subjectSeed
  )

  const { formalBlocks, blockDistributionRows } = splitBlocks(formalTrials, 11, 100, subjectSeed)

  const formalScheduleHash = computeFormalScheduleHash(formalBlocks)

  return {
    formalSeed: subjectSeed,
    nBlocks: 11,
    blockSize: 100,
    totalTrials: totalPlanned,
    formalPlan: FORMAL_PLAN,
    formalBlocks,
    blockDistributionRows,
    formalScheduleHash
  }
}
