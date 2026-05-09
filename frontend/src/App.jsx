import { useState, useEffect, useCallback } from 'react'

const api = {
  get: (url) => fetch(url).then(r => r.json()),
  post: (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  del: (url) => fetch(url, { method: 'DELETE' }).then(r => r.json()),
}

// ============ macOS Icons ============
const Icon = {
  chevron: (cls = '') => (
    <svg className={`w-3.5 h-3.5 ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  ),
  deploy: (cls = '') => (
    <svg className={`w-3.5 h-3.5 ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  github: (cls = '') => (
    <svg className={`w-4 h-4 ${cls}`} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  ),
  refresh: (cls = '') => (
    <svg className={`w-3.5 h-3.5 ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  settings: (cls = '') => (
    <svg className={`w-4 h-4 ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  close: (cls = '') => (
    <svg className={`w-4 h-4 ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  check: (cls = '') => (
    <svg className={`w-3 h-3 ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  x: (cls = '') => (
    <svg className={`w-3 h-3 ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  trash: (cls = '') => (
    <svg className={`w-3.5 h-3.5 ${cls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  ),
}

// ============ Status Dot ============
function StatusDot({ status }) {
  const cls = {
    success: 'status-running',
    running: 'status-building',
    error: 'status-error',
    skipped: 'status-idle',
    idle: 'status-idle',
  }
  return <span className={`status-dot ${cls[status] || 'status-idle'}`} />
}

// ============ Modal ============
function Modal({ open, onClose, title, width = '480px', children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="glass animate-fade-in" style={{ width, maxWidth: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--mac-border)' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mac-text-secondary)', padding: 4, borderRadius: 4, display: 'flex' }}>{Icon.close()}</button>
        </div>
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  )
}

// ============ Deploy Detail ============
function DeployDetail({ repoName, deployId, onClose }) {
  const [log, setLog] = useState(null)
  useEffect(() => { api.get(`/api/projects/${repoName}/deploys/${deployId}`).then(setLog) }, [repoName, deployId])
  if (!log) return <div style={{ textAlign: 'center', padding: 32, color: 'var(--mac-text-secondary)', fontSize: 13 }}>Loading...</div>

  const duration = log.finished_at && log.started_at ? ((new Date(log.finished_at) - new Date(log.started_at)) / 1000).toFixed(1) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
        <div><span style={{ color: 'var(--mac-text-secondary)' }}>ID </span><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{log.deploy_id}</span></div>
        <div><span style={{ color: 'var(--mac-text-secondary)' }}>Trigger </span>{log.trigger}</div>
        <div><span style={{ color: 'var(--mac-text-secondary)' }}>Branch </span><span style={{ fontFamily: 'monospace' }}>{log.branch}</span></div>
        <div><span style={{ color: 'var(--mac-text-secondary)' }}>Status </span><StatusDot status={log.status} /> <span style={{ marginLeft: 4 }}>{log.status}</span></div>
        {duration && <div><span style={{ color: 'var(--mac-text-secondary)' }}>Duration </span>{duration}s</div>}
      </div>
      <div style={{ borderTop: '1px solid var(--mac-border)', paddingTop: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--mac-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Steps</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {log.steps.map((step, i) => (
            <div key={i} className="glass" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
              <span style={{ color: step.success ? 'var(--mac-green)' : 'var(--mac-red)', flexShrink: 0 }}>{step.success ? Icon.check() : Icon.x()}</span>
              <span style={{ fontWeight: 500, flexShrink: 0 }}>{step.name}</span>
              {step.message && <span style={{ color: 'var(--mac-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{step.message}</span>}
            </div>
          ))}
        </div>
      </div>
      {log.error && (
        <div style={{ borderTop: '1px solid var(--mac-border)', paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--mac-red)', marginBottom: 8 }}>Error</div>
          <pre style={{ fontSize: 11, color: 'var(--mac-red)', background: 'var(--mac-gray)', padding: 12, borderRadius: 8, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{log.error}</pre>
        </div>
      )}
    </div>
  )
}

// ============ Deploy History ============
function DeployHistory({ repoName }) {
  const [logs, setLogs] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const load = useCallback(() => api.get(`/api/projects/${repoName}/deploys?limit=20`).then(setLogs), [repoName])
  useEffect(() => { load() }, [load])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--mac-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deploy History</span>
        <button onClick={load} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mac-text-secondary)', padding: 4, borderRadius: 4, display: 'flex' }}>{Icon.refresh()}</button>
      </div>
      {logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--mac-text-secondary)', fontSize: 12 }}>No deployments yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 240, overflowY: 'auto' }}>
          {logs.map(log => (
            <button key={log.deploy_id} onClick={() => setSelectedId(log.deploy_id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--mac-text)', fontSize: 12, textAlign: 'left', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--mac-surface-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              <StatusDot status={log.status} />
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--mac-text-secondary)' }}>{log.deploy_id}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--mac-text-secondary)' }}>{log.trigger}</span>
              <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)', flexShrink: 0 }}>{log.started_at?.slice(5, 16)}</span>
            </button>
          ))}
        </div>
      )}
      <Modal open={!!selectedId} onClose={() => setSelectedId(null)} title={`${repoName} — Deploy Detail`}>
        {selectedId && <DeployDetail repoName={repoName} deployId={selectedId} />}
      </Modal>
    </div>
  )
}

// ============ Main App ============
export default function App() {
  const [githubRepos, setGithubRepos] = useState([])
  const [projects, setProjects] = useState([])
  const [hfSpaces, setHfSpaces] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState({})
  const [filter, setFilter] = useState('all')

  const loadAll = useCallback(async () => {
    const [g, p, h] = await Promise.all([
      api.get('/api/github/repos').catch(() => []),
      api.get('/api/projects').catch(() => []),
      api.get('/api/hf/spaces').catch(() => []),
    ])
    setGithubRepos(g)
    setProjects(p)
    setHfSpaces(h)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { const t = setInterval(loadAll, 15000); return () => clearInterval(t) }, [loadAll])

  const projectMap = Object.fromEntries(projects.map(p => [p.name, p]))
  const getHfStatus = (name) => hfSpaces.find(s => s.name === name)?.stage || null

  const addProject = async (repo) => {
    await api.post(`/api/projects/${repo.name}`, {
      auto_deploy: false,
      branch: repo.default_branch || 'main',
      hf_space: '',
      description: repo.description || '',
    })
    loadAll()
  }

  const removeProject = async (name) => {
    await api.del(`/api/projects/${name}`)
    if (expanded === name) setExpanded(null)
    loadAll()
  }

  const toggleAuto = async (name) => {
    const p = projectMap[name]
    if (!p) return
    await api.post(`/api/projects/${name}`, { ...p.config, auto_deploy: !p.config.auto_deploy })
    loadAll()
  }

  const deploy = async (name) => {
    setLoading(prev => ({ ...prev, [name]: true }))
    await api.post(`/api/projects/${name}/deploy`)
    setTimeout(loadAll, 3000)
    setLoading(prev => ({ ...prev, [name]: false }))
  }

  const filtered = filter === 'all' ? githubRepos
    : filter === 'deployed' ? githubRepos.filter(r => projectMap[r.name])
    : githubRepos.filter(r => !projectMap[r.name])

  const stats = { total: githubRepos.length, deployed: projects.length, auto: projects.filter(p => p.config.auto_deploy).length }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mac-bg)' }}>
      {/* Header */}
      <header className="glass" style={{ position: 'sticky', top: 0, zIndex: 40, borderRadius: 0, borderBottom: '1px solid var(--mac-border)', backdropFilter: 'blur(24px)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>⚙️</span>
            <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>Deploy Service</span>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'var(--mac-accent)', color: 'white', fontWeight: 500 }}>v1.0.0</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--mac-text-secondary)' }}>
            <span>{stats.total} repos</span>
            <span>{stats.deployed} deployed</span>
            <span>{stats.auto} auto</span>
            <button onClick={loadAll} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mac-text-secondary)', padding: 4, borderRadius: 4, display: 'flex' }}>{Icon.refresh()}</button>
          </div>
        </div>
      </header>

      {/* Filter Bar */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '16px 24px 0' }}>
        <div style={{ display: 'flex', gap: 4, fontSize: 12 }}>
          {[
            { key: 'all', label: 'All' },
            { key: 'deployed', label: 'Deployed' },
            { key: 'available', label: 'Available' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{
                padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                background: filter === f.key ? 'var(--mac-accent)' : 'transparent',
                color: filter === f.key ? 'white' : 'var(--mac-text-secondary)',
                transition: 'all 0.15s',
              }}>
              {f.label}
              <span style={{ marginLeft: 4, opacity: 0.7 }}>
                {f.key === 'all' ? stats.total : f.key === 'deployed' ? stats.deployed : stats.total - stats.deployed}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Repo List */}
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '12px 24px 48px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(repo => {
            const isDeployed = !!projectMap[repo.name]
            const config = projectMap[repo.name]?.config || {}
            const lastDeploy = projectMap[repo.name]?.last_deploy
            const hfStatus = getHfStatus(repo.name)
            const isExpanded = expanded === repo.name
            const isDeploying = loading[repo.name]

            return (
              <div key={repo.name} className="glass animate-fade-in" style={{ overflow: 'hidden' }}>
                {/* Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px' }}>
                  {/* Expand */}
                  <button onClick={() => setExpanded(isExpanded ? null : repo.name)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mac-text-secondary)', padding: 2, display: 'flex', transition: 'transform 0.15s', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>
                    {Icon.chevron()}
                  </button>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: 'var(--mac-text-secondary)' }}>{Icon.github()}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>{repo.name}</span>
                      {isDeployed && <StatusDot status={lastDeploy?.status || 'idle'} />}
                      {hfStatus && hfStatus !== 'RUNNING' && <StatusDot status={hfStatus === 'BUILDING' ? 'running' : 'idle'} />}
                      {!isDeployed && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--mac-gray)', color: 'var(--mac-text-secondary)' }}>not deployed</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 2, fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                      <span>{repo.language || '—'}</span>
                      {repo.visibility === 'private' && <span>🔒</span>}
                      {isDeployed && <span>branch: <span style={{ fontFamily: 'monospace' }}>{config.branch}</span></span>}
                      {hfStatus && <span style={{ fontFamily: 'monospace' }}>{hfStatus}</span>}
                      {lastDeploy && <span>{lastDeploy.started_at?.slice(5, 16)}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  {isDeployed ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button className={`toggle ${config.auto_deploy ? 'active' : ''}`} onClick={() => toggleAuto(repo.name)} />
                        <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>Auto</span>
                      </div>
                      <button className="btn-primary" onClick={() => deploy(repo.name)} disabled={isDeploying}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '5px 12px' }}>
                        {Icon.deploy()} Deploy
                      </button>
                      <button onClick={() => removeProject(repo.name)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mac-text-secondary)', padding: 4, borderRadius: 4, display: 'flex' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--mac-red)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--mac-text-secondary)'}>
                        {Icon.trash()}
                      </button>
                    </div>
                  ) : (
                    <button className="btn-secondary" onClick={() => addProject(repo)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '5px 12px' }}>
                      + Add
                    </button>
                  )}
                </div>

                {/* Expanded */}
                {isExpanded && isDeployed && (
                  <div style={{ borderTop: '1px solid var(--mac-border)', padding: '12px 16px 16px' }} className="animate-fade-in">
                    <DeployHistory repoName={repo.name} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 64, color: 'var(--mac-text-secondary)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚙️</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>No repositories found</div>
          </div>
        )}
      </main>
    </div>
  )
}
