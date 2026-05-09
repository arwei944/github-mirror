const BASE = ''
const api = {
  get: (url) => fetch(BASE + url).then(r => r.ok ? r.json() : r.json().catch(() => null)),
  post: (url, body) => fetch(BASE + url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) }).then(r => r.json()),
  put: (url) => fetch(BASE + url, { method: 'PUT' }).then(r => ({ ok: r.ok })),
  del: (url) => fetch(BASE + url, { method: 'DELETE' }).then(r => r.json()),
}
export default api
