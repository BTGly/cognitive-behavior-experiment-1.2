import { loadCSV } from '../csv.js'
import { normalizePath } from '../paths.js'

export async function loadFormalImagePool(pretestUsedPaths) {
  const masterManifest = await loadCSV('assets/stimuli_master_pool/manifest.csv?v=20260713-pool17600')
  const alphaToImages = {}
  for (const row of masterManifest) {
    const a = parseFloat(parseFloat(row.alpha).toFixed(2))
    if (!alphaToImages[a]) alphaToImages[a] = []
    const relPath = 'stimuli_master_pool/' + row.alpha_dir + '/' + row.filename
    alphaToImages[a].push({
      rank: parseInt(row.rank),
      image_path: relPath
    })
  }
  for (const a of Object.keys(alphaToImages)) {
    alphaToImages[a].sort((x, y) => x.rank - y.rank)
    alphaToImages[a] = alphaToImages[a].filter(item =>
      !pretestUsedPaths.has(normalizePath(item.image_path))
    )
  }
  return alphaToImages
}
