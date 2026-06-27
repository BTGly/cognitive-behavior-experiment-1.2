export function betaSmoothP8(k, n, priorA = 1.0, priorB = 1.0) {
  if (n <= 0) return null
  return (k + priorA) / (n + priorA + priorB)
}

export function buildMonotonicP8Curve(alphaCounts) {
  const sortedAlphas = Object.keys(alphaCounts).sort((a, b) => parseFloat(a) - parseFloat(b))
  const points = []
  for (const a of sortedAlphas) {
    const n = alphaCounts[a].n
    const k = alphaCounts[a].k
    if (n <= 0) continue
    points.push({
      alpha: parseFloat(a),
      n, k,
      pObs: k / n,
      pBeta: betaSmoothP8(k, n)
    })
  }

  if (points.length === 0) {
    throw new Error('没有有效 alpha 点，无法做单调校准。')
  }

  const blocks = []
  for (let i = 0; i < points.length; i++) {
    const pt = points[i]
    const w = Math.max(pt.n, 1.0)
    blocks.push({
      start: i, end: i, w, yw: w * pt.pBeta, value: pt.pBeta
    })
    while (blocks.length >= 2 && blocks[blocks.length - 2].value > blocks[blocks.length - 1].value) {
      const b2 = blocks.pop()
      const b1 = blocks.pop()
      const wNew = b1.w + b2.w
      const ywNew = b1.yw + b2.yw
      blocks.push({
        start: b1.start, end: b2.end, w: wNew, yw: ywNew, value: ywNew / wNew
      })
    }
  }

  const monoValues = new Array(points.length).fill(null)
  for (const b of blocks) {
    for (let j = b.start; j <= b.end; j++) {
      monoValues[j] = b.value
    }
  }

  const xs = points.map(p => p.alpha)
  const obsMap = {}
  const betaMap = {}
  const monoMap = {}
  for (let i = 0; i < points.length; i++) {
    const a = parseFloat(points[i].alpha.toFixed(2))
    obsMap[a] = points[i].pObs
    betaMap[a] = points[i].pBeta
    monoMap[a] = monoValues[i]
  }

  function monoPredict(a) {
    const av = parseFloat(a)
    if (av <= xs[0]) return monoValues[0]
    if (av >= xs[xs.length - 1]) return monoValues[monoValues.length - 1]
    for (let i = 0; i < xs.length - 1; i++) {
      const x0 = xs[i], x1 = xs[i + 1]
      if (x0 <= av && av <= x1) {
        const y0 = monoValues[i], y1 = monoValues[i + 1]
        if (x1 === x0) return y0
        const t = (av - x0) / (x1 - x0)
        return y0 + t * (y1 - y0)
      }
    }
    return monoValues[monoValues.length - 1]
  }

  return { obsMap, betaMap, monoMap, monoPredict }
}
