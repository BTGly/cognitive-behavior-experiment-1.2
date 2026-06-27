const BASE_DIR = (() => {
  const base = document.querySelector('base')
  if (base) return base.getAttribute('href') || '.'
  return '.'
})()

export function assetPath(relativePath) {
  const p = relativePath.replace(/\\/g, '/')
  return BASE_DIR + '/assets/' + p
}

export function conditionPath(filename) {
  return BASE_DIR + '/conditions/' + filename
}

export function normalizePath(path) {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/')
}

export function getBaseDir() {
  return BASE_DIR
}
