const BASE = ''
const api = {
  get: (url) => fetch(BASE + url).then(r => r.ok ? r.json() : r.json().catch(() => null)),
  post: (url, body) => fetch(BASE + url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) }).then(r => r.json()),
  put: (url, body) => fetch(BASE + url, { method: 'PUT', headers: body ? {'Content-Type':'application/json'} : {}, body: body ? JSON.stringify(body) : undefined }).then(r => r.ok ? r.json().catch(() => ({ok: r.ok})) : r.json().catch(() => null)),
  patch: (url, body) => fetch(BASE + url, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) }).then(r => r.json()),
  del: (url) => fetch(BASE + url, { method: 'DELETE' }).then(r => r.json()),
}
export default api
