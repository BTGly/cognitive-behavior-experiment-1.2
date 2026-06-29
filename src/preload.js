export function preloadImages(imagePaths, options = {}) {
  const uniquePaths = [...new Set(imagePaths)].filter(Boolean)
  const timeoutMs = options.timeoutMs || 0
  const promises = uniquePaths.map(path => preloadOneImage(path, timeoutMs))
  return Promise.all(promises).then(results => ({
    total: results.length,
    loaded: results.filter(r => r.status === 'loaded').length,
    failed: results.filter(r => r.status === 'error').length,
    timedOut: results.filter(r => r.status === 'timeout').length,
    results
  }))
}

function preloadOneImage(path, timeoutMs) {
  return new Promise(resolve => {
    const img = new Image()
    let settled = false
    let timer = null

    const finish = status => {
      if (settled) return
      settled = true
      img.onload = null
      img.onerror = null
      if (timer) clearTimeout(timer)
      resolve({ path, status })
    }

    if (timeoutMs > 0) {
      timer = setTimeout(() => finish('timeout'), timeoutMs)
    }

    img.onload = () => finish('loaded')
    img.onerror = () => finish('error')
    img.src = path

    if (img.complete) {
      finish(img.naturalWidth > 0 ? 'loaded' : 'error')
    }
  })
}
