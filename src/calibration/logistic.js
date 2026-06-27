export function logisticP8(alphaValue, mu, sigma) {
  const a = parseFloat(alphaValue)
  const s = Math.max(parseFloat(sigma), 0.005)
  const z = (a - parseFloat(mu)) / s
  if (z > 60) return 1.0
  if (z < -60) return 0.0
  return 1.0 / (1.0 + Math.exp(-z))
}

export function fitLogisticGrid(alphaCounts) {
  const eps = 1e-6
  let bestNll = null
  let bestMu = 0.5
  let bestSigma = 0.1

  const muGrid = []
  for (let i = 0; i <= 100; i++) muGrid.push(0.25 + i * 0.005)
  const sigmaGrid = []
  for (let i = 0; i <= 140; i++) sigmaGrid.push(0.02 + i * 0.002)

  for (const mu of muGrid) {
    for (const sigma of sigmaGrid) {
      let nll = 0.0
      for (const [a, stat] of Object.entries(alphaCounts)) {
        const n = stat.n
        const k = stat.k
        if (n <= 0) continue
        let p = logisticP8(a, mu, sigma)
        p = Math.max(eps, Math.min(1.0 - eps, p))
        nll -= k * Math.log(p) + (n - k) * Math.log(1.0 - p)
      }
      if (bestNll === null || nll < bestNll) {
        bestNll = nll
        bestMu = mu
        bestSigma = sigma
      }
    }
  }

  const muStart = bestMu - 0.03
  const muEnd = bestMu + 0.03
  const sigmaStart = Math.max(0.005, bestSigma - 0.03)
  const sigmaEnd = bestSigma + 0.03

  const muGrid2 = []
  const nMu = Math.round((muEnd - muStart) / 0.001)
  for (let i = 0; i <= nMu; i++) muGrid2.push(muStart + i * 0.001)
  const sigmaGrid2 = []
  const nSigma = Math.round((sigmaEnd - sigmaStart) / 0.001)
  for (let i = 0; i <= nSigma; i++) sigmaGrid2.push(sigmaStart + i * 0.001)

  for (const mu of muGrid2) {
    for (const sigma of sigmaGrid2) {
      if (sigma <= 0) continue
      let nll = 0.0
      for (const [a, stat] of Object.entries(alphaCounts)) {
        const n = stat.n
        const k = stat.k
        if (n <= 0) continue
        let p = logisticP8(a, mu, sigma)
        p = Math.max(eps, Math.min(1.0 - eps, p))
        nll -= k * Math.log(p) + (n - k) * Math.log(1.0 - p)
      }
      if (nll < bestNll) {
        bestNll = nll
        bestMu = mu
        bestSigma = sigma
      }
    }
  }

  return { mu: bestMu, sigma: bestSigma, nll: bestNll }
}

export function invLogisticAlpha(targetP8, mu, sigma) {
  const p = Math.max(1e-6, Math.min(1.0 - 1e-6, parseFloat(targetP8)))
  return parseFloat(mu) + Math.max(parseFloat(sigma), 0.005) * Math.log(p / (1.0 - p))
}
