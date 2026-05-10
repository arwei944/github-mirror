import { useState, useEffect } from 'react'
import { Icon } from '../App'
import api from '../api'

const LANG_COLORS = {
  Python: '#3572A5', JavaScript: '#f1e05a', TypeScript: '#3178c6', HTML: '#e34c26', CSS: '#563d7c',
  Java: '#b07219', 'C++': '#f34b7d', C: '#555555', Go: '#00ADD8', Rust: '#dea584',
  Ruby: '#701516', PHP: '#4F5D95', Swift: '#F05138', Kotlin: '#A97BFF', Shell: '#89e051',
  Dart: '#00B4AB', Vue: '#41b883', Svelte: '#ff3e00', Jupyter: '#DA5B0B', Lua: '#000080',
}
function langColor(lang) { return LANG_COLORS[lang] || '#86868b' }

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

function formatSize(kb) { return kb < 1024 ? `${kb} KB` : `${(kb / 1024).toFixed(1)} MB` }

function LanguageBar({ languages }) {
  const total = Object.values(languages).reduce((a, b) => a + b, 0)
  if (!total) return null
  const entries = Object.entries(languages).sort((a, b) => b[1] - a[1]).slice(0, 5)
  return (
    <div>
      <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', gap: 1 }}>
        {entries.map(([name, val]) => (
          <div key={name} style={{ flex: val, background: langColor(name), borderRadius: 2, minWidth: 4 }} title={`${name}: ${((val / total) * 100).toFixed(1)}%`} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: 6, fontSize: 11, color: 'var(--mac-text-secondary)' }}>
        {entries.map(([name, val]) => (
          <span key={name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: langColor(name), display: 'inline-block' }} />
            {name} {((val / total) * 100).toFixed(1)}%
          </span>
        ))}
      </div>
    </div>
  )
}

export default function RepoDetail({ repoName, projects, hfSpaces, onBack, onRefresh }) {
  const [detail, setDetail] = useState(null)
  const [tab, setTab] = useState('readme')
  const [loading, setLoading] = useState({})
  const [license, setLicense] = useState(null)
  const [community, setCommunity] = useState(null)

  useEffect(() => {
    setDetail(null)
    setTab('readme')
    setLicense(null)
    setCommunity(null)
    api.get(`/api/github/repos/${repoName}/detail`).then(data => {
      setDetail(data)
      // Fetch license and community after repo data is loaded
      api.get(`/api/github/repos/${repoName}/license`).then(lic => setLicense(lic)).catch(() => {})
      api.get(`/api/github/repos/${repoName}/community/profile`).then(com => setCommunity(com)).catch(() => {})
    })
  }, [repoName])

  if (!detail) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--mac-text-secondary)', gap: 8 }}>
      <span style={{ animation: 'pulse-dot 1s infinite' }}>●</span> 加载中...
    </div>
  )

  const project = projects.find(p => p.name === repoName)
  const isDeployed = !!project
  const config = project?.config || {}
  const hfStatus = hfSpaces.find(s => s.name === repoName)?.stage || null

  const addProject = async () => {
    await api.post(`/api/projects/${repoName}`, {
      auto_deploy: false,
      branch: detail.default_branch,
      hf_space: '',
      description: detail.description,
    })
    onRefresh?.()
  }

  const removeProject = async () => {
    await api.del(`/api/projects/${repoName}`)
    onRefresh?.()
  }

  const toggleAuto = async () => {
    if (!project) return
    await api.post(`/api/projects/${repoName}`, { ...config, auto_deploy: !config.auto_deploy })
    onRefresh?.()
  }

  const deploy = async () => {
    setLoading(prev => ({ ...prev, deploy: true }))
    await api.post(`/api/projects/${repoName}/deploy`)
    setTimeout(() => {
      onRefresh?.()
      setLoading(prev => ({ ...prev, deploy: false }))
    }, 3000)
  }

  const handleStar = async () => {
    try {
      const method = detail.viewer_has_starred ? 'del' : 'put'
      await api[method](`/api/github/repos/${repoName}/star`)
      const updated = await api.get(`/api/github/repos/${repoName}/detail`)
      if (updated) setDetail(updated)
    } catch (err) { /* ignore */ }
  }

  const handleFork = async () => {
    try {
      await api.post(`/api/github/repos/${repoName}/forks`)
    } catch (err) { /* ignore */ }
  }

  const handleWatch = async () => {
    try {
      const method = detail.viewer_has_watched ? 'del' : 'put'
      await api[method](`/api/github/repos/${repoName}/subscription`)
      const updated = await api.get(`/api/github/repos/${repoName}/detail`)
      if (updated) setDetail(updated)
    } catch (err) { /* ignore */ }
  }

  const tabs = [
    { key: 'readme', label: 'README' },
    { key: 'commits', label: `提交 (${detail.commits?.length || 0})` },
    { key: 'branches', label: `分支 (${detail.branches?.length || 0})` },
    { key: 'contributors', label: '贡献者' },
  ]

  return (
    <div className="detail-content animate-fade-in">
      {/* Detail Header */}
      <div className="detail-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <button onClick={onBack} className="btn-icon" title="返回" style={{ flexShrink: 0 }}>
            {Icon.back(18)}
          </button>
          <span style={{ color: 'var(--mac-text-secondary)', flexShrink: 0 }}>{Icon.github(18)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>{detail.name}</h1>
              {detail.archived && <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 8, background: 'var(--mac-orange)', color: 'white', fontWeight: 500 }}>已归档</span>}
              {hfStatus && <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 8, background: hfStatus === 'RUNNING' ? 'rgba(52,199,89,0.12)' : 'var(--mac-gray)', color: hfStatus === 'RUNNING' ? 'var(--mac-green)' : 'var(--mac-text-secondary)', fontWeight: 500 }}>{hfStatus}</span>}
              {license && license.name && <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 8, background: 'var(--mac-gray)', color: 'var(--mac-text-secondary)', fontWeight: 500 }}>&#128196; {license.name}</span>}
              {community && community.health_percentage > 0 && <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 8, background: 'rgba(52,199,89,0.12)', color: 'var(--mac-green)', fontWeight: 500 }}>&#128154; 健康度 {community.health_percentage}%</span>}
            </div>
            <p style={{ fontSize: 13, color: 'var(--mac-text-secondary)', margin: '4px 0 0', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {detail.description || '暂无描述'}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            onClick={handleStar}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '4px 10px' }}
          >
            {Icon.star(13)} {detail.viewer_has_starred ? '取消 Star' : 'Star'}
          </button>
          <button
            onClick={handleFork}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '4px 10px' }}
          >
            {Icon.fork(13)} Fork
          </button>
          <button
            onClick={handleWatch}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '4px 10px' }}
          >
            {Icon.watch(13)} {detail.viewer_has_watched ? '取消关注' : 'Watch'}
          </button>
          <a href={detail.html_url} target="_blank" rel="noopener noreferrer" className="detail-gh-link">
            在 GitHub 打开 {Icon.external(10)}
          </a>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="detail-scroll">
        {/* Stats Row */}
        <div className="glass" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 20, fontSize: 13, color: 'var(--mac-text-secondary)', marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{Icon.star()} <b style={{ color: 'var(--mac-text)' }}>{detail.stargazers_count}</b> 星标</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{Icon.fork()} <b style={{ color: 'var(--mac-text)' }}>{detail.forks_count}</b> 派生</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{Icon.issue()} <b style={{ color: 'var(--mac-text)' }}>{detail.open_issues_count}</b> 问题</span>
            {detail.size > 0 && <span>📦 {formatSize(detail.size)}</span>}
            {detail.license && <span>📄 {detail.license}</span>}
            <span>{detail.visibility === 'private' ? '🔒 私有' : '🌐 公开'}</span>
          </div>

          {/* Language bar */}
          {Object.keys(detail.languages || {}).length > 0 && <LanguageBar languages={detail.languages} />}

          {/* Meta info */}
          <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: 'var(--mac-text-secondary)', flexWrap: 'wrap' }}>
            <span>默认分支：<code style={{ fontFamily: 'monospace', background: 'var(--mac-gray)', padding: '1px 5px', borderRadius: 3 }}>{detail.default_branch}</code></span>
            <span>创建：{new Date(detail.created_at).toLocaleDateString('zh-CN')}</span>
            <span>推送：{timeAgo(detail.pushed_at)}</span>
            {detail.homepage && (
              <a href={detail.homepage} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--mac-accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                {Icon.external(10)} 主页
              </a>
            )}
          </div>

          {/* Topics */}
          {detail.topics?.length > 0 && (
            <div style={{ display: 'flex', gap: 5, marginTop: 10, flexWrap: 'wrap' }}>
              {detail.topics.map(t => (
                <span key={t} style={{ padding: '2px 8px', borderRadius: 8, background: 'var(--mac-accent)', color: 'white', fontSize: 10, fontWeight: 500 }}>{t}</span>
              ))}
            </div>
          )}

          {/* Deploy controls */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--mac-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            {isDeployed ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <button className={`toggle ${config.auto_deploy ? 'active' : ''}`} onClick={toggleAuto} />
                  <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>自动部署</span>
                </div>
                <button className="btn-primary" onClick={deploy} disabled={loading.deploy}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 12px' }}>
                  {Icon.deploy(13)} {loading.deploy ? '部署中...' : '立即部署'}
                </button>
                <button onClick={removeProject} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mac-text-secondary)', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--mac-red)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--mac-text-secondary)'}>
                  {Icon.trash(12)} 移除
                </button>
              </>
            ) : (
              <button className="btn-primary" onClick={addProject} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 12px' }}>
                + 添加到部署管理
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 0 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`detail-tab ${tab === t.key ? 'active' : ''}`}>
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
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--mac-text-secondary)' }}>暂无 README 文件</div>
            )
          )}
          {tab === 'commits' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {!detail.commits || detail.commits.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48, color: 'var(--mac-text-secondary)' }}>暂无提交记录</div>
              ) : detail.commits.map(c => (
                <div key={c.sha} className="detail-row">
                  {c.avatar && <img src={c.avatar} alt="" style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.message}</div>
                    <div style={{ color: 'var(--mac-text-secondary)', fontSize: 10, marginTop: 1 }}>{c.author} · {timeAgo(c.date)}</div>
                  </div>
                  <code style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--mac-accent)', background: 'var(--mac-gray)', padding: '2px 6px', borderRadius: 3, flexShrink: 0 }}>{c.sha}</code>
                </div>
              ))}
            </div>
          )}
          {tab === 'branches' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {!detail.branches || detail.branches.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48, color: 'var(--mac-text-secondary)' }}>暂无分支信息</div>
              ) : detail.branches.map(b => (
                <div key={b.name} className="detail-row">
                  <span style={{ color: 'var(--mac-text-secondary)' }}>{Icon.gitBranch(13)}</span>
                  <code style={{ fontFamily: 'monospace', fontWeight: b.name === detail.default_branch ? 600 : 400, fontSize: 12 }}>{b.name}</code>
                  {b.name === detail.default_branch && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'var(--mac-accent)', color: 'white' }}>默认</span>}
                  {b.protected && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(255,149,0,0.15)', color: 'var(--mac-orange)' }}>受保护</span>}
                </div>
              ))}
            </div>
          )}
          {tab === 'contributors' && (
            <div>
              {!detail.contributors || detail.contributors.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48, color: 'var(--mac-text-secondary)' }}>暂无贡献者信息</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                  {detail.contributors.map(c => (
                    <a key={c.login} href={c.html_url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, textDecoration: 'none', color: 'var(--mac-text)', padding: 10, borderRadius: 10, transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--mac-surface-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <img src={c.avatar} alt={c.login} style={{ width: 44, height: 44, borderRadius: '50%' }} />
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{c.login}</span>
                      <span style={{ fontSize: 10, color: 'var(--mac-text-secondary)' }}>{c.contributions} 次提交</span>
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
