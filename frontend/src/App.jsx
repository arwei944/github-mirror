import { useState, useEffect, useCallback, useRef } from 'react'

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
  trash: (s=14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
  ),
  external: (s=12) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
  ),
  lock: (s=12) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
  ),
  gitBranch: (s=12) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 01-9 9"/></svg>
  ),
  search: (s=14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
  ),
  sidebar: (s=16) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>
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
function formatSize(kb) { return kb < 1024 ? `${kb} KB` : `${(kb/1024).toFixed(1)} MB` }

function StatusDot({ status }) {
  const cls = { success:'status-running', running:'status-building', error:'status-error', skipped:'status-idle', idle:'status-idle' }
  return <span className={`status-dot ${cls[status]||'status-idle'}`} />
}

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

// ============ Sidebar ============
function Sidebar({ githubRepos, projects, hfSpaces, filter, setFilter, search, setSearch, selectedRepo, onSelect, loading, onAdd, onRemove, onToggleAuto, onDeploy, onRefresh }) {
  const projectMap = Object.fromEntries(projects.map(p => [p.name, p]))
  const getHfStatus = (name) => hfSpaces.find(s => s.name === name)?.stage || null
  const stats = { total:githubRepos.length, deployed:projects.length, auto:projects.filter(p => p.config.auto_deploy).length }

  const filtered = (filter === 'all' ? githubRepos
    : filter === 'deployed' ? githubRepos.filter(r => projectMap[r.name])
    : githubRepos.filter(r => !projectMap[r.name])
  ).filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()) || (r.description||'').toLowerCase().includes(search.toLowerCase()))

  return (
    <aside className="sidebar">
      {/* Sidebar Header */}
      <div style={{ padding:'16px 16px 12px', borderBottom:'1px solid var(--mac-border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
          <span style={{ fontSize:18 }}>⚙️</span>
          <span style={{ fontSize:15, fontWeight:600, letterSpacing:'-0.02em' }}>部署服务</span>
          <span style={{ fontSize:9, padding:'1px 6px', borderRadius:8, background:'var(--mac-accent)', color:'white', fontWeight:500 }}>v1.3.0</span>
          <button onClick={onRefresh} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'var(--mac-text-secondary)', padding:2, borderRadius:4, display:'flex' }}>{Icon.refresh(13)}</button>
        </div>
        {/* Search */}
        <div style={{ position:'relative' }}>
          <input type="text" placeholder="搜索项目..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ width:'100%', padding:'6px 10px 6px 30px', borderRadius:8, border:'1px solid var(--mac-border)', background:'var(--mac-bg)', fontSize:12, color:'var(--mac-text)', outline:'none', transition:'border-color 0.15s' }}
            onFocus={e => e.target.style.borderColor='var(--mac-accent)'}
            onBlur={e => e.target.style.borderColor='var(--mac-border)'} />
          <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--mac-text-secondary)' }}>{Icon.search(13)}</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display:'flex', gap:2, padding:'8px 16px', borderBottom:'1px solid var(--mac-border)' }}>
        {[
          { key:'all', label:'全部' },
          { key:'deployed', label:'已部署' },
          { key:'available', label:'未部署' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{ flex:1, padding:'5px 0', borderRadius:6, border:'none', cursor:'pointer', fontSize:11, fontWeight:500,
              background: filter===f.key ? 'var(--mac-accent)' : 'transparent',
              color: filter===f.key ? 'white' : 'var(--mac-text-secondary)', transition:'all 0.15s' }}>
            {f.label} {f.key==='all' ? stats.total : f.key==='deployed' ? stats.deployed : stats.total-stats.deployed}
          </button>
        ))}
      </div>

      {/* Repo List */}
      <div className="sidebar-list">
        {filtered.map(repo => {
          const isActive = selectedRepo === repo.name
          const isDeployed = !!projectMap[repo.name]
          const config = projectMap[repo.name]?.config || {}
          const lastDeploy = projectMap[repo.name]?.last_deploy
          const hfStatus = getHfStatus(repo.name)

          return (
            <div key={repo.name}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelect(repo.name)}>
              <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0 }}>
                {isDeployed && <StatusDot status={lastDeploy?.status || 'idle'} />}
                {!isDeployed && <span style={{ width:8, height:8, borderRadius:2, background:'var(--mac-gray)', display:'inline-block', flexShrink:0 }} />}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ fontSize:13, fontWeight: isActive ? 600 : 500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{repo.name}</span>
                    {repo.visibility === 'private' && <span style={{ color:'var(--mac-text-secondary)', flexShrink:0 }}>{Icon.lock(9)}</span>}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:1, fontSize:10, color:'var(--mac-text-secondary)' }}>
                    {repo.language && <span style={{ display:'flex', alignItems:'center', gap:3 }}>
                      <span style={{ width:7, height:7, borderRadius:2, background:langColor(repo.language), display:'inline-block' }} />
                      {repo.language}
                    </span>}
                    <span>{timeAgo(repo.updated_at)}</span>
                  </div>
                </div>
              </div>
              {/* Quick actions on hover */}
              <div className="sidebar-item-actions" onClick={e => e.stopPropagation()}>
                {isDeployed ? (
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <button className={`toggle toggle-sm ${config.auto_deploy?'active':''}`} onClick={() => onToggleAuto(repo.name)} title="自动部署" />
                    <button className="btn-icon" onClick={() => onDeploy(repo.name)} disabled={loading[repo.name]} title="部署">{Icon.deploy(13)}</button>
                  </div>
                ) : (
                  <button className="btn-icon-sm" onClick={() => onAdd(repo)} title="添加部署">+</button>
                )}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:32, color:'var(--mac-text-secondary)', fontSize:12 }}>
            <div style={{ fontSize:24, marginBottom:6 }}>🔍</div>
            没有匹配的项目
          </div>
        )}
      </div>

      {/* Sidebar Footer */}
      <div style={{ padding:'10px 16px', borderTop:'1px solid var(--mac-border)', fontSize:10, color:'var(--mac-text-secondary)', display:'flex', gap:12 }}>
        <span>{stats.total} 仓库</span>
        <span>{stats.deployed} 已部署</span>
        <span>{stats.auto} 自动</span>
      </div>
    </aside>
  )
}

// ============ Detail Content ============
function DetailContent({ repoName, projects, hfSpaces, onAdd, onRemove, onToggleAuto, onDeploy }) {
  const [detail, setDetail] = useState(null)
  const [tab, setTab] = useState('readme')
  const [loading, setLoading] = useState({})

  useEffect(() => {
    setDetail(null)
    setTab('readme')
    api.get(`/api/github/repos/${repoName}/detail`).then(setDetail)
  }, [repoName])

  if (!detail) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--mac-text-secondary)', gap:8 }}>
      <span style={{ animation:'pulse-dot 1s infinite' }}>●</span> 加载中...
    </div>
  )

  const project = projects.find(p => p.name === repoName)
  const isDeployed = !!project
  const config = project?.config || {}
  const hfStatus = hfSpaces.find(s => s.name === repoName)?.stage || null

  const addProject = async () => {
    await api.post(`/api/projects/${repoName}`, { auto_deploy:false, branch:detail.default_branch, hf_space:'', description:detail.description })
    onAdd?.()
  }
  const removeProject = async () => { await api.del(`/api/projects/${repoName}`); onRemove?.() }
  const toggleAuto = async () => {
    if (!project) return
    await api.post(`/api/projects/${repoName}`, { ...config, auto_deploy:!config.auto_deploy })
    onToggleAuto?.()
  }
  const deploy = async () => {
    setLoading(prev => ({...prev, deploy:true}))
    await api.post(`/api/projects/${repoName}/deploy`)
    setTimeout(() => { onDeploy?.(); setLoading(prev => ({...prev, deploy:false})) }, 3000)
  }

  const tabs = [
    { key:'readme', label:'README' },
    { key:'commits', label:`提交 (${detail.commits.length})` },
    { key:'branches', label:`分支 (${detail.branches.length})` },
    { key:'contributors', label:'贡献者' },
  ]

  return (
    <div className="detail-content animate-fade-in">
      {/* Detail Header */}
      <div className="detail-header">
        <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
          <span style={{ color:'var(--mac-text-secondary)', flexShrink:0 }}>{Icon.github(18)}</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <h1 style={{ fontSize:18, fontWeight:700, letterSpacing:'-0.02em', margin:0 }}>{detail.name}</h1>
              {detail.archived && <span style={{ fontSize:9, padding:'2px 7px', borderRadius:8, background:'var(--mac-orange)', color:'white', fontWeight:500 }}>已归档</span>}
              {hfStatus && <span style={{ fontSize:9, padding:'2px 7px', borderRadius:8, background: hfStatus==='RUNNING' ? 'rgba(52,199,89,0.12)' : 'var(--mac-gray)', color: hfStatus==='RUNNING' ? 'var(--mac-green)' : 'var(--mac-text-secondary)', fontWeight:500 }}>{hfStatus}</span>}
            </div>
            <p style={{ fontSize:13, color:'var(--mac-text-secondary)', margin:'4px 0 0', lineHeight:1.4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{detail.description || '暂无描述'}</p>
          </div>
        </div>
        <a href={detail.html_url} target="_blank" rel="noopener noreferrer" className="detail-gh-link">
          在 GitHub 打开 {Icon.external(10)}
        </a>
      </div>

      {/* Scrollable content */}
      <div className="detail-scroll">
        {/* Stats Row */}
        <div className="glass" style={{ padding:16, marginBottom:12 }}>
          <div style={{ display:'flex', gap:20, fontSize:13, color:'var(--mac-text-secondary)', marginBottom:12, flexWrap:'wrap' }}>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}>{Icon.star()} <b style={{ color:'var(--mac-text)' }}>{detail.stargazers_count}</b> 星标</span>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}>{Icon.fork()} <b style={{ color:'var(--mac-text)' }}>{detail.forks_count}</b> 派生</span>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}>{Icon.issue()} <b style={{ color:'var(--mac-text)' }}>{detail.open_issues_count}</b> 问题</span>
            {detail.size > 0 && <span>📦 {formatSize(detail.size)}</span>}
            {detail.license && <span>📄 {detail.license}</span>}
            <span>{detail.visibility === 'private' ? '🔒 私有' : '🌐 公开'}</span>
          </div>
          {Object.keys(detail.languages).length > 0 && <LanguageBar languages={detail.languages} />}
          <div style={{ display:'flex', gap:16, marginTop:10, fontSize:11, color:'var(--mac-text-secondary)', flexWrap:'wrap' }}>
            <span>默认分支：<code style={{ fontFamily:'monospace', background:'var(--mac-gray)', padding:'1px 5px', borderRadius:3 }}>{detail.default_branch}</code></span>
            <span>创建：{new Date(detail.created_at).toLocaleDateString('zh-CN')}</span>
            <span>推送：{timeAgo(detail.pushed_at)}</span>
          </div>
          {detail.topics?.length > 0 && (
            <div style={{ display:'flex', gap:5, marginTop:10, flexWrap:'wrap' }}>
              {detail.topics.map(t => <span key={t} style={{ padding:'2px 8px', borderRadius:8, background:'var(--mac-accent)', color:'white', fontSize:10, fontWeight:500 }}>{t}</span>)}
            </div>
          )}
          {/* Deploy controls */}
          <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid var(--mac-border)', display:'flex', alignItems:'center', gap:10 }}>
            {isDeployed ? (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <button className={`toggle ${config.auto_deploy?'active':''}`} onClick={toggleAuto} />
                  <span style={{ fontSize:11, color:'var(--mac-text-secondary)' }}>自动部署</span>
                </div>
                <button className="btn-primary" onClick={deploy} disabled={loading.deploy}
                  style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, padding:'4px 12px' }}>
                  {Icon.deploy(13)} {loading.deploy ? '部署中...' : '立即部署'}
                </button>
                <button onClick={removeProject} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'var(--mac-text-secondary)', display:'flex', alignItems:'center', gap:3, fontSize:11 }}
                  onMouseEnter={e => e.currentTarget.style.color='var(--mac-red)'}
                  onMouseLeave={e => e.currentTarget.style.color='var(--mac-text-secondary)'}>
                  {Icon.trash(12)} 移除
                </button>
              </>
            ) : (
              <button className="btn-primary" onClick={addProject} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, padding:'4px 12px' }}>
                + 添加到部署管理
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:2, marginBottom:0 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`detail-tab ${tab===t.key ? 'active' : ''}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="glass detail-tab-content">
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
                <div key={c.sha} className="detail-row">
                  {c.avatar && <img src={c.avatar} alt="" style={{ width:22, height:22, borderRadius:'50%', flexShrink:0 }} />}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:500, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.message}</div>
                    <div style={{ color:'var(--mac-text-secondary)', fontSize:10, marginTop:1 }}>{c.author} · {timeAgo(c.date)}</div>
                  </div>
                  <code style={{ fontFamily:'monospace', fontSize:10, color:'var(--mac-accent)', background:'var(--mac-gray)', padding:'2px 6px', borderRadius:3, flexShrink:0 }}>{c.sha}</code>
                </div>
              ))}
            </div>
          )}
          {tab === 'branches' && (
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              {detail.branches.length === 0 ? (
                <div style={{ textAlign:'center', padding:48, color:'var(--mac-text-secondary)' }}>暂无分支信息</div>
              ) : detail.branches.map(b => (
                <div key={b.name} className="detail-row">
                  <span style={{ color:'var(--mac-text-secondary)' }}>{Icon.gitBranch(13)}</span>
                  <code style={{ fontFamily:'monospace', fontWeight: b.name===detail.default_branch ? 600 : 400, fontSize:12 }}>{b.name}</code>
                  {b.name === detail.default_branch && <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:'var(--mac-accent)', color:'white' }}>默认</span>}
                  {b.protected && <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:'rgba(255,149,0,0.15)', color:'var(--mac-orange)' }}>受保护</span>}
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
                      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, textDecoration:'none', color:'var(--mac-text)', padding:10, borderRadius:10, transition:'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--mac-surface-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background='none'}>
                      <img src={c.avatar} alt={c.login} style={{ width:44, height:44, borderRadius:'50%' }} />
                      <span style={{ fontSize:12, fontWeight:500 }}>{c.login}</span>
                      <span style={{ fontSize:10, color:'var(--mac-text-secondary)' }}>{c.contributions} 次提交</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============ Project Card (for main grid) ============
function ProjectCard({ repo, isDeployed, config, lastDeploy, hfStatus, isDeploying, onSelect, onAdd, onRemove, onToggleAuto, onDeploy }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div className="project-card glass animate-fade-in"
      onClick={() => onSelect(repo.name)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      {/* Top row */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, flex:1, minWidth:0 }}>
          {isDeployed && <StatusDot status={lastDeploy?.status || 'idle'} />}
          {!isDeployed && <span style={{ width:7, height:7, borderRadius:2, background:'var(--mac-gray)', display:'inline-block', flexShrink:0 }} />}
          <span style={{ fontSize:14, fontWeight:600, letterSpacing:'-0.01em', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{repo.name}</span>
          {repo.visibility === 'private' && <span style={{ color:'var(--mac-text-secondary)', flexShrink:0 }}>{Icon.lock(10)}</span>}
        </div>
        {hfStatus && <span style={{ fontSize:9, padding:'1px 6px', borderRadius:6, background: hfStatus==='RUNNING' ? 'rgba(52,199,89,0.12)' : 'var(--mac-gray)', color: hfStatus==='RUNNING' ? 'var(--mac-green)' : 'var(--mac-text-secondary)', fontWeight:500, flexShrink:0 }}>{hfStatus}</span>}
      </div>
      {/* Description */}
      {repo.description && (
        <div style={{ fontSize:12, color:'var(--mac-text-secondary)', lineHeight:1.4, marginBottom:8, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{repo.description}</div>
      )}
      {/* Language + topics */}
      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:8 }}>
        {repo.language && (
          <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:11, color:'var(--mac-text-secondary)' }}>
            <span style={{ width:9, height:9, borderRadius:2, background:langColor(repo.language), display:'inline-block' }} />
            {repo.language}
          </span>
        )}
        {repo.topics?.slice(0,3).map(t => (
          <span key={t} style={{ padding:'1px 7px', borderRadius:8, background:'var(--mac-accent)', color:'white', fontSize:9, fontWeight:500 }}>{t}</span>
        ))}
      </div>
      {/* Stats */}
      <div style={{ display:'flex', alignItems:'center', gap:12, fontSize:11, color:'var(--mac-text-secondary)' }}>
        {repo.stargazers_count > 0 && <span style={{ display:'flex', alignItems:'center', gap:3 }}>{Icon.star(11)} {repo.stargazers_count}</span>}
        {repo.forks_count > 0 && <span style={{ display:'flex', alignItems:'center', gap:3 }}>{Icon.fork(11)} {repo.forks_count}</span>}
        <span style={{ display:'flex', alignItems:'center', gap:3 }}>{Icon.issue(11)} {repo.open_issues_count}</span>
        <span style={{ marginLeft:'auto', fontSize:10 }}>{timeAgo(repo.updated_at)}</span>
      </div>
      {/* Hover actions */}
      {hovered && (
        <div className="card-hover-actions" onClick={e => e.stopPropagation()}>
          {isDeployed ? (
            <>
              <button className={`toggle toggle-sm ${config.auto_deploy?'active':''}`} onClick={() => onToggleAuto(repo.name)} title="自动部署" />
              <button className="btn-primary" onClick={() => onDeploy(repo.name)} disabled={isDeploying}
                style={{ display:'flex', alignItems:'center', gap:3, fontSize:10, padding:'3px 10px' }}>
                {Icon.deploy(11)} 部署
              </button>
              <button onClick={() => onRemove(repo.name)} className="btn-icon" title="移除">{Icon.trash(11)}</button>
            </>
          ) : (
            <button className="btn-primary" onClick={() => onAdd(repo)} style={{ fontSize:10, padding:'3px 10px' }}>+ 添加部署</button>
          )}
        </div>
      )}
    </div>
  )
}

// ============ Card Grid (default main view) ============
function CardGrid({ githubRepos, projects, hfSpaces, loading, onSelect, onAdd, onRemove, onToggleAuto, onDeploy }) {
  const projectMap = Object.fromEntries(projects.map(p => [p.name, p]))
  const getHfStatus = (name) => hfSpaces.find(s => s.name === name)?.stage || null
  return (
    <div className="card-grid-scroll">
      <div style={{ padding:'20px 24px 48px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:12 }}>
          {githubRepos.map(repo => (
            <ProjectCard key={repo.name} repo={repo}
              isDeployed={!!projectMap[repo.name]}
              config={projectMap[repo.name]?.config || {}}
              lastDeploy={projectMap[repo.name]?.last_deploy}
              hfStatus={getHfStatus(repo.name)}
              isDeploying={loading[repo.name]}
              onSelect={onSelect} onAdd={onAdd} onRemove={onRemove}
              onToggleAuto={onToggleAuto} onDeploy={onDeploy} />
          ))}
        </div>
        {githubRepos.length === 0 && (
          <div style={{ textAlign:'center', padding:64, color:'var(--mac-text-secondary)' }}>
            <div style={{ fontSize:36, marginBottom:8 }}>📦</div>
            <div style={{ fontSize:14, fontWeight:500 }}>暂无项目</div>
          </div>
        )}
      </div>
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
    setGithubRepos(g); setProjects(p); setHfSpaces(h)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { const t = setInterval(loadAll, 15000); return () => clearInterval(t) }, [loadAll])

  const projectMap = Object.fromEntries(projects.map(p => [p.name, p]))
  const stats = { total:githubRepos.length, deployed:projects.length, auto:projects.filter(p => p.config.auto_deploy).length }

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

  return (
    <div className="app-layout">
      <Sidebar
        githubRepos={githubRepos} projects={projects} hfSpaces={hfSpaces}
        filter={filter} setFilter={setFilter} search={search} setSearch={setSearch}
        selectedRepo={selectedRepo} onSelect={setSelectedRepo}
        loading={loading} onAdd={addProject} onRemove={removeProject}
        onToggleAuto={toggleAuto} onDeploy={deploy} onRefresh={loadAll}
      />
      <main className="main-content">
        {selectedRepo ? (
          <DetailContent
            repoName={selectedRepo} projects={projects} hfSpaces={hfSpaces}
            onAdd={loadAll} onRemove={loadAll} onToggleAuto={loadAll} onDeploy={loadAll}
          />
        ) : (
          <CardGrid
            githubRepos={githubRepos} projects={projects} hfSpaces={hfSpaces}
            loading={loading} onSelect={setSelectedRepo}
            onAdd={addProject} onRemove={removeProject}
            onToggleAuto={toggleAuto} onDeploy={deploy}
          />
        )}
      </main>
    </div>
  )
}
