import { useState, useEffect, useCallback } from 'react'

const api = {
  get: (url) => fetch(url).then(r => r.json()),
  post: (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  del: (url) => fetch(url, { method: 'DELETE' }).then(r => r.json()),
}

// ============ Icons ============
const Icon = {
  github: (s=16) => (
    <svg width={s} height={s} fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
  ),
  star: (s=14) => (
    <svg width={s} height={s} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
  ),
  fork: (s=14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/></svg>
  ),
  issue: (s=14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
  ),
  deploy: (s=14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
  ),
  refresh: (s=14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
  ),
  back: (s=16) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
  ),
  close: (s=16) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
  ),
  trash: (s=14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
  ),
  check: (s=12) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
  ),
  x: (s=12) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
  ),
  external: (s=12) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
  ),
  lock: (s=12) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
  ),
  code: (s=12) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
  ),
  gitBranch: (s=12) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 01-9 9"/></svg>
  ),
  users: (s=12) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
  ),
}

// ============ Helpers ============
const LANG_COLORS = {
  Python:'#3572A5', JavaScript:'#f1e05a', TypeScript:'#3178c6', HTML:'#e34c26', CSS:'#563d7c',
  Java:'#b07219', 'C++':'#f34b7d', C:'#555555', Go:'#00ADD8', Rust:'#dea584',
  Ruby:'#701516', PHP:'#4F5D95', Swift:'#F05138', Kotlin:'#A97BFF', Shell:'#89e051',
  Dart:'#00B4AB', Vue:'#41b883', Svelte:'#ff3e00', Jupyter:'#DA5B0B', Lua:'#000080',
}

function langColor(lang) { return LANG_COLORS[lang] || '#86868b' }
function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff/60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff/3600)} 小时前`
  if (diff < 2592000) return `${Math.floor(diff/86400)} 天前`
  return new Date(dateStr).toLocaleDateString('zh-CN')
}
function formatSize(kb) {
  if (kb < 1024) return `${kb} KB`
  return `${(kb/1024).toFixed(1)} MB`
}

// ============ Status Dot ============
function StatusDot({ status }) {
  const cls = { success:'status-running', running:'status-building', error:'status-error', skipped:'status-idle', idle:'status-idle' }
  return <span className={`status-dot ${cls[status]||'status-idle'}`} />
}

// ============ Language Bar ============
function LanguageBar({ languages }) {
  const total = Object.values(languages).reduce((a,b) => a+b, 0)
  if (!total) return null
  const entries = Object.entries(languages).sort((a,b) => b[1]-a[1]).slice(0, 5)
  return (
    <div>
      <div style={{ display:'flex', height:6, borderRadius:3, overflow:'hidden', gap:1 }}>
        {entries.map(([name, val]) => (
          <div key={name} style={{ flex: val, background: langColor(name), borderRadius: 2, minWidth: 4 }} title={`${name}: ${((val/total)*100).toFixed(1)}%`} />
        ))}
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 12px', marginTop:6, fontSize:11, color:'var(--mac-text-secondary)' }}>
        {entries.map(([name, val]) => (
          <span key={name} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ width:8, height:8, borderRadius:2, background:langColor(name), display:'inline-block' }} />
            {name} {((val/total)*100).toFixed(1)}%
          </span>
        ))}
      </div>
    </div>
  )
}

// ============ Project Card ============
function ProjectCard({ repo, isDeployed, config, lastDeploy, hfStatus, isDeploying, onAdd, onRemove, onToggleAuto, onDeploy, onClick }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div className="glass project-card animate-fade-in"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor:'pointer', position:'relative', display:'flex', flexDirection:'column', gap:12, padding:16 }}>
      {/* Top: name + status */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ color:'var(--mac-text-secondary)', flexShrink:0 }}>{Icon.github(14)}</span>
            <span style={{ fontSize:14, fontWeight:600, letterSpacing:'-0.01em', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{repo.name}</span>
            {repo.visibility === 'private' && <span style={{ color:'var(--mac-text-secondary)', flexShrink:0 }}>{Icon.lock(10)}</span>}
          </div>
          {repo.description && (
            <div style={{ fontSize:12, color:'var(--mac-text-secondary)', marginTop:4, lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{repo.description}</div>
          )}
        </div>
        {isDeployed && <StatusDot status={lastDeploy?.status || 'idle'} />}
      </div>

      {/* Language + topics */}
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', fontSize:11, color:'var(--mac-text-secondary)' }}>
        {repo.language && (
          <span style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ width:10, height:10, borderRadius:2, background:langColor(repo.language), display:'inline-block' }} />
            {repo.language}
          </span>
        )}
        {repo.topics?.slice(0,3).map(t => (
          <span key={t} style={{ padding:'1px 8px', borderRadius:10, background:'var(--mac-accent)', color:'white', fontSize:10, fontWeight:500 }}>{t}</span>
        ))}
      </div>

      {/* Stats row */}
      <div style={{ display:'flex', alignItems:'center', gap:14, fontSize:11, color:'var(--mac-text-secondary)' }}>
        {repo.stargazers_count > 0 && <span style={{ display:'flex', alignItems:'center', gap:3 }}>{Icon.star(12)} {repo.stargazers_count}</span>}
        {repo.forks_count > 0 && <span style={{ display:'flex', alignItems:'center', gap:3 }}>{Icon.fork(12)} {repo.forks_count}</span>}
        <span style={{ display:'flex', alignItems:'center', gap:3 }}>{Icon.issue(12)} {repo.open_issues_count}</span>
        <span style={{ marginLeft:'auto', fontSize:10 }}>{timeAgo(repo.updated_at)}</span>
      </div>

      {/* Deploy status bar */}
      {isDeployed && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:8, borderTop:'1px solid var(--mac-border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--mac-text-secondary)' }}>
            {hfStatus && <span style={{ fontFamily:'monospace', fontSize:10, padding:'1px 6px', borderRadius:4, background: hfStatus==='RUNNING' ? 'rgba(52,199,89,0.12)' : hfStatus==='BUILDING' ? 'rgba(255,149,0,0.12)' : 'var(--mac-gray)' }}>{hfStatus}</span>}
            {lastDeploy && <span>{timeAgo(lastDeploy.started_at)}</span>}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <button className={`toggle ${config.auto_deploy?'active':''}`} onClick={() => onToggleAuto(repo.name)} />
              <span style={{ fontSize:10, color:'var(--mac-text-secondary)' }}>自动</span>
            </div>
            <button className="btn-primary" onClick={() => onDeploy(repo.name)} disabled={isDeploying}
              style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, padding:'4px 10px' }}>
              {Icon.deploy(12)} 部署
            </button>
          </div>
        </div>
      )}

      {/* Not deployed: add button */}
      {!isDeployed && hovered && (
        <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'10px 16px', borderTop:'1px solid var(--mac-border)', background:'var(--mac-surface)', borderRadius:'0 0 var(--mac-radius) var(--mac-radius)', display:'flex', justifyContent:'flex-end' }} onClick={e => e.stopPropagation()}>
          <button className="btn-secondary" onClick={() => onAdd(repo)} style={{ fontSize:11, padding:'4px 12px' }}>+ 添加部署</button>
        </div>
      )}

      {/* Remove button */}
      {isDeployed && hovered && (
        <button onClick={e => { e.stopPropagation(); onRemove(repo.name) }}
          style={{ position:'absolute', top:8, right:8, background:'none', border:'none', cursor:'pointer', color:'var(--mac-text-secondary)', padding:4, borderRadius:4, display:'flex', opacity:0.6 }}
          onMouseEnter={e => e.currentTarget.style.color='var(--mac-red)'}
          onMouseLeave={e => e.currentTarget.style.color='var(--mac-text-secondary)'}>
          {Icon.trash(12)}
        </button>
      )}
    </div>
  )
}

// ============ Detail Page ============
function DetailPage({ repoName, onBack }) {
  const [detail, setDetail] = useState(null)
  const [tab, setTab] = useState('readme')
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState({})

  useEffect(() => {
    api.get(`/api/github/repos/${repoName}/detail`).then(setDetail)
    api.get('/api/projects').then(setProjects)
  }, [repoName])

  if (!detail) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', color:'var(--mac-text-secondary)', gap:8 }}>
      <span style={{ animation:'pulse-dot 1s infinite' }}>●</span> 加载中...
    </div>
  )

  const project = projects.find(p => p.name === repoName)
  const isDeployed = !!project
  const config = project?.config || {}

  const addProject = async () => {
    await api.post(`/api/projects/${repoName}`, { auto_deploy:false, branch:detail.default_branch, hf_space:'', description:detail.description })
    api.get('/api/projects').then(setProjects)
  }
  const removeProject = async () => {
    await api.del(`/api/projects/${repoName}`)
    api.get('/api/projects').then(setProjects)
  }
  const toggleAuto = async () => {
    if (!project) return
    await api.post(`/api/projects/${repoName}`, { ...config, auto_deploy:!config.auto_deploy })
    api.get('/api/projects').then(setProjects)
  }
  const deploy = async () => {
    setLoading(prev => ({...prev, deploy:true}))
    await api.post(`/api/projects/${repoName}/deploy`)
    setTimeout(() => { api.get('/api/projects').then(setProjects); setLoading(prev => ({...prev, deploy:false})) }, 3000)
  }

  const tabs = [
    { key:'readme', label:'README' },
    { key:'commits', label:`提交 (${detail.commits.length})` },
    { key:'branches', label:`分支 (${detail.branches.length})` },
    { key:'contributors', label:'贡献者' },
  ]

  return (
    <div className="animate-fade-in" style={{ minHeight:'100vh', background:'var(--mac-bg)' }}>
      {/* Header */}
      <header className="glass" style={{ position:'sticky', top:0, zIndex:40, borderRadius:0, borderBottom:'1px solid var(--mac-border)', backdropFilter:'blur(24px)' }}>
        <div style={{ maxWidth:960, margin:'0 auto', padding:'12px 24px', display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={onBack} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--mac-text-secondary)', display:'flex', alignItems:'center', gap:4, fontSize:13, padding:'4px 8px', borderRadius:6, transition:'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background='var(--mac-surface-hover)'}
            onMouseLeave={e => e.currentTarget.style.background='none'}>
            {Icon.back()} 返回
          </button>
          <div style={{ width:1, height:16, background:'var(--mac-border)' }} />
          <span style={{ color:'var(--mac-text-secondary)' }}>{Icon.github(16)}</span>
          <span style={{ fontSize:15, fontWeight:600, letterSpacing:'-0.02em' }}>{detail.full_name}</span>
          {detail.archived && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'var(--mac-orange)', color:'white', fontWeight:500 }}>已归档</span>}
          <a href={detail.html_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4, fontSize:12, color:'var(--mac-accent)', textDecoration:'none' }}>
            在 GitHub 打开 {Icon.external(10)}
          </a>
        </div>
      </header>

      <main style={{ maxWidth:960, margin:'0 auto', padding:'20px 24px 48px' }}>
        {/* Info Card */}
        <div className="glass" style={{ padding:20, marginBottom:16 }}>
          <h1 style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.02em', margin:'0 0 6px' }}>{detail.name}</h1>
          <p style={{ fontSize:14, color:'var(--mac-text-secondary)', margin:'0 0 16px', lineHeight:1.5 }}>{detail.description || '暂无描述'}</p>

          {/* Stats */}
          <div style={{ display:'flex', gap:20, fontSize:13, color:'var(--mac-text-secondary)', marginBottom:16 }}>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}>{Icon.star()} <b style={{ color:'var(--mac-text)' }}>{detail.stargazers_count}</b> 星标</span>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}>{Icon.fork()} <b style={{ color:'var(--mac-text)' }}>{detail.forks_count}</b> 派生</span>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}>{Icon.issue()} <b style={{ color:'var(--mac-text)' }}>{detail.open_issues_count}</b> 问题</span>
            {detail.size > 0 && <span style={{ display:'flex', alignItems:'center', gap:4 }}>📦 {formatSize(detail.size)}</span>}
            {detail.license && <span style={{ display:'flex', alignItems:'center', gap:4 }}>📄 {detail.license}</span>}
          </div>

          {/* Languages */}
          {Object.keys(detail.languages).length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--mac-text-secondary)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>语言构成</div>
              <LanguageBar languages={detail.languages} />
            </div>
          )}

          {/* Meta info */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:8, fontSize:12, color:'var(--mac-text-secondary)' }}>
            <div><span style={{ fontWeight:500, color:'var(--mac-text)' }}>可见性</span>：{detail.visibility === 'private' ? '🔒 私有' : '🌐 公开'}</div>
            <div><span style={{ fontWeight:500, color:'var(--mac-text)' }}>默认分支</span>：<code style={{ fontFamily:'monospace', background:'var(--mac-gray)', padding:'1px 6px', borderRadius:4 }}>{detail.default_branch}</code></div>
            <div><span style={{ fontWeight:500, color:'var(--mac-text)' }}>创建时间</span>：{new Date(detail.created_at).toLocaleDateString('zh-CN')}</div>
            <div><span style={{ fontWeight:500, color:'var(--mac-text)' }}>最后推送</span>：{timeAgo(detail.pushed_at)}</div>
            {detail.homepage && <div><span style={{ fontWeight:500, color:'var(--mac-text)' }}>主页</span>：<a href={detail.homepage} target="_blank" rel="noopener noreferrer" style={{ color:'var(--mac-accent)', textDecoration:'none' }}>{detail.homepage}</a></div>}
          </div>

          {/* Topics */}
          {detail.topics?.length > 0 && (
            <div style={{ display:'flex', gap:6, marginTop:12, flexWrap:'wrap' }}>
              {detail.topics.map(t => <span key={t} style={{ padding:'3px 10px', borderRadius:10, background:'var(--mac-accent)', color:'white', fontSize:11, fontWeight:500 }}>{t}</span>)}
            </div>
          )}

          {/* Deploy controls */}
          <div style={{ marginTop:16, paddingTop:16, borderTop:'1px solid var(--mac-border)', display:'flex', alignItems:'center', gap:12 }}>
            {isDeployed ? (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <button className={`toggle ${config.auto_deploy?'active':''}`} onClick={toggleAuto} />
                  <span style={{ fontSize:12, color:'var(--mac-text-secondary)' }}>自动部署</span>
                </div>
                <button className="btn-primary" onClick={deploy} disabled={loading.deploy}
                  style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, padding:'5px 14px' }}>
                  {Icon.deploy(14)} {loading.deploy ? '部署中...' : '立即部署'}
                </button>
                <button onClick={removeProject} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'var(--mac-text-secondary)', display:'flex', alignItems:'center', gap:4, fontSize:12 }}
                  onMouseEnter={e => e.currentTarget.style.color='var(--mac-red)'}
                  onMouseLeave={e => e.currentTarget.style.color='var(--mac-text-secondary)'}>
                  {Icon.trash(12)} 移除部署
                </button>
              </>
            ) : (
              <button className="btn-primary" onClick={addProject} style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, padding:'5px 14px' }}>
                + 添加到部署管理
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:2, marginBottom:12 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding:'7px 16px', borderRadius:'8px 8px 0 0', border:'none', cursor:'pointer', fontSize:12, fontWeight:500,
                background: tab===t.key ? 'var(--mac-surface)' : 'transparent',
                color: tab===t.key ? 'var(--mac-text)' : 'var(--mac-text-secondary)',
                borderBottom: tab===t.key ? '2px solid var(--mac-accent)' : '2px solid transparent',
                transition:'all 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="glass" style={{ padding:20, minHeight:300 }}>
          {tab === 'readme' && (
            detail.readme_html ? (
              <div className="readme-body" dangerouslySetInnerHTML={{ __html: detail.readme_html }} />
            ) : (
              <div style={{ textAlign:'center', padding:48, color:'var(--mac-text-secondary)' }}>暂无 README 文件</div>
            )
          )}

          {tab === 'commits' && (
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              {detail.commits.length === 0 ? (
                <div style={{ textAlign:'center', padding:48, color:'var(--mac-text-secondary)' }}>暂无提交记录</div>
              ) : detail.commits.map(c => (
                <div key={c.sha} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 12px', borderRadius:8, fontSize:12, transition:'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--mac-surface-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background='none'}>
                  {c.avatar && <img src={c.avatar} alt="" style={{ width:24, height:24, borderRadius:'50%' }} />}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.message}</div>
                    <div style={{ color:'var(--mac-text-secondary)', fontSize:11, marginTop:1 }}>{c.author} · {timeAgo(c.date)}</div>
                  </div>
                  <code style={{ fontFamily:'monospace', fontSize:11, color:'var(--mac-accent)', background:'var(--mac-gray)', padding:'2px 8px', borderRadius:4, flexShrink:0 }}>{c.sha}</code>
                </div>
              ))}
            </div>
          )}

          {tab === 'branches' && (
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              {detail.branches.length === 0 ? (
                <div style={{ textAlign:'center', padding:48, color:'var(--mac-text-secondary)' }}>暂无分支信息</div>
              ) : detail.branches.map(b => (
                <div key={b.name} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:8, fontSize:12, transition:'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--mac-surface-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background='none'}>
                  <span style={{ color:'var(--mac-text-secondary)' }}>{Icon.gitBranch(14)}</span>
                  <code style={{ fontFamily:'monospace', fontWeight: b.name===detail.default_branch ? 600 : 400 }}>{b.name}</code>
                  {b.name === detail.default_branch && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:'var(--mac-accent)', color:'white' }}>默认</span>}
                  {b.protected && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:'rgba(255,149,0,0.15)', color:'var(--mac-orange)' }}>受保护</span>}
                </div>
              ))}
            </div>
          )}

          {tab === 'contributors' && (
            <div>
              {detail.contributors.length === 0 ? (
                <div style={{ textAlign:'center', padding:48, color:'var(--mac-text-secondary)' }}>暂无贡献者信息</div>
              ) : (
                <div style={{ display:'flex', flexWrap:'wrap', gap:16 }}>
                  {detail.contributors.map(c => (
                    <a key={c.login} href={c.html_url} target="_blank" rel="noopener noreferrer"
                      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, textDecoration:'none', color:'var(--mac-text)', padding:12, borderRadius:12, transition:'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--mac-surface-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background='none'}>
                      <img src={c.avatar} alt={c.login} style={{ width:48, height:48, borderRadius:'50%' }} />
                      <span style={{ fontSize:12, fontWeight:500 }}>{c.login}</span>
                      <span style={{ fontSize:10, color:'var(--mac-text-secondary)' }}>{c.contributions} 次提交</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// ============ Main App ============
export default function App() {
  const [githubRepos, setGithubRepos] = useState([])
  const [projects, setProjects] = useState([])
  const [hfSpaces, setHfSpaces] = useState([])
  const [loading, setLoading] = useState({})
  const [filter, setFilter] = useState('all')
  const [selectedRepo, setSelectedRepo] = useState(null)
  const [search, setSearch] = useState('')

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
    await api.post(`/api/projects/${repo.name}`, { auto_deploy:false, branch:repo.default_branch||'main', hf_space:'', description:repo.description||'' })
    loadAll()
  }
  const removeProject = async (name) => { await api.del(`/api/projects/${name}`); loadAll() }
  const toggleAuto = async (name) => {
    const p = projectMap[name]; if (!p) return
    await api.post(`/api/projects/${name}`, { ...p.config, auto_deploy:!p.config.auto_deploy }); loadAll()
  }
  const deploy = async (name) => {
    setLoading(prev => ({...prev,[name]:true}))
    await api.post(`/api/projects/${name}/deploy`)
    setTimeout(loadAll, 3000); setLoading(prev => ({...prev,[name]:false}))
  }

  const filtered = (filter === 'all' ? githubRepos
    : filter === 'deployed' ? githubRepos.filter(r => projectMap[r.name])
    : githubRepos.filter(r => !projectMap[r.name])
  ).filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()) || (r.description||'').toLowerCase().includes(search.toLowerCase()))

  const stats = { total:githubRepos.length, deployed:projects.length, auto:projects.filter(p => p.config.auto_deploy).length }

  // Detail page
  if (selectedRepo) return <DetailPage repoName={selectedRepo} onBack={() => setSelectedRepo(null)} />

  return (
    <div style={{ minHeight:'100vh', background:'var(--mac-bg)' }}>
      {/* Header */}
      <header className="glass" style={{ position:'sticky', top:0, zIndex:40, borderRadius:0, borderBottom:'1px solid var(--mac-border)', backdropFilter:'blur(24px)' }}>
        <div style={{ maxWidth:1080, margin:'0 auto', padding:'12px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:20 }}>⚙️</span>
            <span style={{ fontSize:16, fontWeight:600, letterSpacing:'-0.02em' }}>部署服务</span>
            <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'var(--mac-accent)', color:'white', fontWeight:500 }}>v1.0.0</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:16, fontSize:12, color:'var(--mac-text-secondary)' }}>
            <span>{stats.total} 个仓库</span>
            <span>{stats.deployed} 已部署</span>
            <span>{stats.auto} 自动部署</span>
            <button onClick={loadAll} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--mac-text-secondary)', padding:4, borderRadius:4, display:'flex' }}>{Icon.refresh(14)}</button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth:1080, margin:'0 auto', padding:'16px 24px 48px' }}>
        {/* Filter + Search */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, marginBottom:16, flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:4, fontSize:12 }}>
            {[
              { key:'all', label:'全部' },
              { key:'deployed', label:'已部署' },
              { key:'available', label:'未部署' },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                style={{ padding:'5px 14px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:500,
                  background: filter===f.key ? 'var(--mac-accent)' : 'transparent',
                  color: filter===f.key ? 'white' : 'var(--mac-text-secondary)', transition:'all 0.15s' }}>
                {f.label}
                <span style={{ marginLeft:4, opacity:0.7 }}>
                  {f.key==='all' ? stats.total : f.key==='deployed' ? stats.deployed : stats.total-stats.deployed}
                </span>
              </button>
            ))}
          </div>
          <div style={{ position:'relative' }}>
            <input type="text" placeholder="搜索项目..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ padding:'6px 12px 6px 32px', borderRadius:8, border:'1px solid var(--mac-border)', background:'var(--mac-surface)', fontSize:12, color:'var(--mac-text)', outline:'none', width:200, transition:'border-color 0.15s' }}
              onFocus={e => e.target.style.borderColor='var(--mac-accent)'}
              onBlur={e => e.target.style.borderColor='var(--mac-border)'} />
            <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--mac-text-secondary)', fontSize:12 }}>🔍</span>
          </div>
        </div>

        {/* Card Grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:12 }}>
          {filtered.map(repo => (
            <ProjectCard key={repo.name} repo={repo}
              isDeployed={!!projectMap[repo.name]}
              config={projectMap[repo.name]?.config || {}}
              lastDeploy={projectMap[repo.name]?.last_deploy}
              hfStatus={getHfStatus(repo.name)}
              isDeploying={loading[repo.name]}
              onAdd={addProject} onRemove={removeProject} onToggleAuto={toggleAuto} onDeploy={deploy}
              onClick={() => setSelectedRepo(repo.name)} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:64, color:'var(--mac-text-secondary)' }}>
            <div style={{ fontSize:36, marginBottom:8 }}>🔍</div>
            <div style={{ fontSize:14, fontWeight:500 }}>没有找到匹配的项目</div>
            <div style={{ fontSize:12, marginTop:4 }}>试试其他关键词或筛选条件</div>
          </div>
        )}
      </div>
    </div>
  )
}
