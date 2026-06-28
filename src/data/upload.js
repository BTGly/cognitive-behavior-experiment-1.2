export const DEFAULT_UPLOAD_API_BASE = 'https://exp-api.cognitive-testing.cn'

export function getUploadApiBase() {
  if (window.__UPLOAD_ENDPOINT) {
    return new URL('.', window.__UPLOAD_ENDPOINT).href.replace(/\/+$/, '')
  }
  return (window.__UPLOAD_API_BASE || DEFAULT_UPLOAD_API_BASE).replace(/\/+$/, '')
}

export function getUploadEndpoint() {
  return `${getUploadApiBase()}/api/upload-session`
}

export async function sha256Blob(blob) {
  if (!window.crypto?.subtle) {
    throw new Error('当前浏览器不支持 SHA-256 校验。请使用 Chrome 或 Edge。')
  }
  const buffer = await blob.arrayBuffer()
  const digest = await window.crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function uploadSessionZip({ blob, filename, metadata, uploadCode, endpoint }) {
  if (!uploadCode) {
    return { skipped: true, reason: 'missing_upload_code' }
  }

  const form = new FormData()
  form.append('metadata', JSON.stringify(metadata))
  form.append('file', blob, filename)

  const response = await fetch(endpoint || getUploadEndpoint(), {
    method: 'POST',
    headers: {
      'X-Upload-Token': uploadCode
    },
    body: form
  })

  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = { detail: text }
  }

  if (!response.ok) {
    const detail = payload?.detail || `HTTP ${response.status}`
    throw new Error(`上传失败：${detail}`)
  }

  return payload || { ok: true }
}
