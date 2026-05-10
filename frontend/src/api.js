const BASE = ''
const pendingRequests = new Map()

function getCacheKey(method, url, body) {
  return `${method}:${url}:${body || ''}`
}

async function requestWithRetry(url, options, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(BASE + url, options)
      if (response.ok) {
        const contentType = response.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          return await response.json()
        }
        return await response.text()
      }
      const status = response.status
      const data = await response.json().catch(() => null)

      // 5xx errors: retry with exponential backoff
      if (status >= 500 && i < retries) {
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000))
        continue
      }

      // Error with code mapping
      const errorInfo = data || {}
      throw { status, ...errorInfo }
    } catch (err) {
      if (err.status && err.status < 500) throw err
      if (i === retries) throw err
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000))
    }
  }
}

function deduplicatedRequest(method, url, options) {
  const body = options.body || ''
  const cacheKey = getCacheKey(method, url, body)

  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)
  }

  const promise = requestWithRetry(url, options)
    .finally(() => {
      pendingRequests.delete(cacheKey)
    })

  pendingRequests.set(cacheKey, promise)
  return promise
}

const api = {
  get: (url) => deduplicatedRequest('GET', url, {}),
  post: (url, body) => deduplicatedRequest('POST', url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  put: (url, body) => deduplicatedRequest('PUT', url, {
    method: 'PUT',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  }),
  patch: (url, body) => deduplicatedRequest('PATCH', url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  del: (url) => deduplicatedRequest('DELETE', url, { method: 'DELETE' }),
}

export default api
