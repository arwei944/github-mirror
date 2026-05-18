import { useState, useEffect } from 'react'
import React from 'react'
import { Icon } from '../App'
import api from '../api'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { timeAgo } from '../utils/timeAgo'

const LANG_COLORS = {
  Python: '#3572A5', JavaScript: '#f1e05a', TypeScript: '#3178c6', HTML: '#e34c26', CSS: '#563d7c',
  Java: '#b07219', 'C++': '#f34b7d', C: '#555555', Go: '#00ADD8', Rust: '#dea584',
  Ruby: '#701516', PHP: '#4F5D95', Swift: '#F05138', Kotlin: '#A97BFF', Shell: '#89e051',
  Dart: '#00B4AB', Vue: '#41b883', Svelte: '#ff3e00', Jupyter: '#DA5B0B', Lua: '#000080',
}
function langColor(lang) { return LANG_COLORS[lang] || '#86868b' }

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

// File type icon helper
function getFileIcon(name) {
  if (!name) return '📄'
  const ext = name.split('.').pop().toLowerCase()
  const icons = {
    js: '🟨', jsx: '🟨', ts: '🔷', tsx: '🔷', py: '🐍', rb: '💎', go: '🔵',
    rs: '🦀', java: '☕', css: '🎨', scss: '🎨', html: '🌐', md: '📝',
    json: '📋', yaml: '📋', yml: '📋', toml: '📋', lock: '🔒',
    png: '🖼️', jpg: '🖼️', gif: '🖼️', svg: '🖼️',
    dockerfile: '🐳', docker: '🐳', gitignore: '🙈',
    sh: '🖥️', bash: '🖥️', zsh: '🖥️',
    txt: '📄', csv: '📊', sql: '🗃️',
  }
  return icons[ext] || icons[name.toLowerCase()] || '📄'
}

// README renderer component
function ReadmeViewer({ content, repoName }) {
  if (!content) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--mac-text-secondary)' }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>📖</div>
        <div style={{ fontSize: 12 }}>此仓库没有 README</div>
      </div>
    )
  }
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  return (
    <div style={{ padding: '0 4px' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }) {
            if (!inline) {
              const match = /language-(\w+)/.exec(className || '')
              const lang = match ? match[1] : ''
              return (
                <div style={{ position: 'relative', margin: '12px 0' }}>
                  {lang && <div style={{ position: 'absolute', top: 0, right: 0, padding: '2px 8px', fontSize: 10, color: 'var(--mac-text-secondary)', background: 'var(--mac-surface)', borderRadius: '0 8px 0 8px' }}>{lang}</div>}
                  <pre style={{
                    background: 'var(--mac-bg)', border: '1px solid var(--mac-border)', borderRadius: 8,
                    padding: '12px 14px', overflow: 'auto', fontSize: 12, lineHeight: 1.6,
                    fontFamily: 'SF Mono, Monaco, Menlo, Consolas, monospace',
                  }}><code>{String(children).replace(/\n$/, '')}</code></pre>
                </div>
              )
            }
            return <code style={{ background: 'var(--mac-bg)', padding: '2px 6px', borderRadius: 4, fontSize: '0.9em', color: 'var(--mac-accent)' }} {...props}>{children}</code>
          },
          a({ href, children }) {
            return <a href={href} target="_blank" rel="noopener" style={{ color: 'var(--mac-accent)' }}>{children}</a>
          },
          table({ children }) {
            return <div style={{ overflow: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>{children}</table></div>
          },
          th({ children }) {
            return <th style={{ padding: '6px 12px', border: '1px solid var(--mac-border)', background: 'var(--mac-surface)', fontWeight: 600, textAlign: 'left' }}>{children}</th>
          },
          td({ children }) {
            return <td style={{ padding: '6px 12px', border: '1px solid var(--mac-border)' }}>{children}</td>
          },
          img({ src, alt }) {
            return <img src={src} alt={alt || ''} style={{ maxWidth: '100%', borderRadius: 8, margin: '8px 0' }} />
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

// File browser component
function FileBrowser({ repoName, branch }) {
  const [contents, setContents] = useState([])
  const [currentPath, setCurrentPath] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/api/github/repos/${repoName}/contents/${currentPath}`).then(data => {
      setContents(Array.isArray(data) ? data : [])
    }).catch(() => setContents([])).finally(() => setLoading(false))
  }, [repoName, currentPath, branch])

  if (loading) return <div style={{ padding: 20, textAlign: 'center', color: 'var(--mac-text-secondary)', fontSize: 12 }}>加载中...</div>

  const folders = contents.filter(c => c.type === 'dir')
  const files = contents.filter(c => c.type === 'file')

  return (
    <div>
      {/* Breadcrumb */}
      {currentPath && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12, fontSize: 12 }}>
          <span style={{ cursor: 'pointer', color: 'var(--mac-accent)' }} onClick={() => setCurrentPath('')}>根目录</span>
          {currentPath.split('/').filter(Boolean).map((part, i, arr) => (
            <React.Fragment key={i}>
              <span style={{ color: 'var(--mac-text-secondary)' }}>/</span>
              <span style={{ cursor: 'pointer', color: i === arr.length - 1 ? 'var(--mac-text)' : 'var(--mac-accent)' }}
                onClick={() => setCurrentPath(arr.slice(0, i + 1).join('/'))}>{part}</span>
            </React.Fragment>
          ))}
        </div>
      )}
      {/* File list */}
      <div style={{ border: '1px solid var(--mac-border)', borderRadius: 8, overflow: 'hidden' }}>
        {[...folders, ...files].map((item, i) => (
          <div key={i} onClick={() => item.type === 'dir' && setCurrentPath(item.path)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              borderBottom: '1px solid var(--mac-border)', cursor: item.type === 'dir' ? 'pointer' : 'default',
              fontSize: 12, color: 'var(--mac-text)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--mac-surface-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span>{getFileIcon(item.name)}</span>
            <span style={{ flex: 1, fontWeight: item.type === 'dir' ? 500 : 400 }}>{item.name}</span>
            {item.size && <span style={{ color: 'var(--mac-text-secondary)', fontSize: 10 }}>{(item.size / 1024).toFixed(1)} KB</span>}
          </div>
        ))}
        {contents.length === 0 && (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--mac-text-secondary)', fontSize: 12 }}>空目录</div>
        )}
      </div>
    </div>
  )
}

// Commit timeline component
function CommitTimeline({ repoName, branch }) {
  const [commits, setCommits] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = branch && branch !== 'default' ? `?branch=${branch}` : ''
    api.get(`/api/github/repos/${repoName}/commits${params}`).then(data => {
      setCommits(Array.isArray(data) ? data : [])
    }).catch(() => setCommits([])).finally(() => setLoading(false))
  }, [repoName, branch])

  if (loading) return <div style={{ padding: 20, textAlign: 'center', color: 'var(--mac-text-secondary)', fontSize: 12 }}>加载中...</div>

  return (
    <div>
      {commits.map((commit, i) => {
        // 后端返回扁平结构: message, author.name, author.date, author.avatar_url, sha
        const message = commit.message || commit.commit?.message || 'No message'
        const authorName = commit.author?.name || commit.commit?.author?.name || 'Unknown'
        const authorDate = commit.author?.date || commit.commit?.author?.date
        const avatarUrl = commit.author?.avatar_url || commit.committer?.avatar_url
        const sha = commit.sha || commit.sha_full?.slice(0, 7) || ''
        
        return (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--mac-border)' }}>
            <img src={avatarUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'var(--mac-gray)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--mac-text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {message.split('\n')[0]}
              </div>
              <div style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                <span style={{ color: 'var(--mac-accent)' }}>{authorName}</span>
                {' · '}{timeAgo(authorDate)}
              </div>
            </div>
            <code style={{ fontSize: 10, color: 'var(--mac-text-secondary)', background: 'var(--mac-bg)', padding: '2px 8px', borderRadius: 6, flexShrink: 0 }}>
              {sha.slice(0, 7)}
            </code>
          </div>
        )
      })}
      {commits.length === 0 && (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--mac-text-secondary)', fontSize: 12 }}>暂无提交记录</div>
      )}
    </div>
  )
}

// Releases list component
function ReleasesList({ repoName }) {
  const [releases, setReleases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/api/github/repos/${repoName}/releases`).then(data => {
      setReleases(Array.isArray(data) ? data : [])
    }).catch(() => setReleases([])).finally(() => setLoading(false))
  }, [repoName])

  if (loading) return <div style={{ padding: 20, textAlign: 'center', color: 'var(--mac-text-secondary)', fontSize: 12 }}>加载中...</div>

  return (
    <div>
      {releases.map((rel, i) => (
        <div key={i} style={{ padding: '14px 0', borderBottom: '1px solid var(--mac-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 16 }}>📦</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--mac-accent)' }}>{rel.tag_name}</span>
            {rel.name && <span style={{ fontSize: 12, color: 'var(--mac-text)' }}>{rel.name}</span>}
          </div>
          <p style={{ fontSize: 12, color: 'var(--mac-text-secondary)', margin: '0 0 8px', lineHeight: 1.5 }}>
            {rel.body?.slice(0, 200) || '暂无描述'}{rel.body?.length > 200 ? '...' : ''}
          </p>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--mac-text-secondary)' }}>
            <span>{timeAgo(rel.published_at)}</span>
            <span>👤 {rel.author?.login || 'Unknown'}</span>
          </div>
        </div>
      ))}
      {releases.length === 0 && (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--mac-text-secondary)', fontSize: 12 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📦</div>
          暂无发布版本
        </div>
      )}
    </div>
  )
}

export default function RepoDetail({ repoName, projects, hfSpaces, onBack, onRefresh, onNavigate }) {
  const [detail, setDetail] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState({})
  const [license, setLicense] = useState(null)
  const [community, setCommunity] = useState(null)
  const [readme, setReadme] = useState('')
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)

  useEffect(() => {
    setDetail(null)
    setActiveTab('overview')
    setLicense(null)
    setCommunity(null)
    setReadme('')
    setBranches([])
    setSelectedBranch('')
    api.get(`/api/github/repos/${repoName}/detail`).then(data => {
      setDetail(data)
      // Fetch license and community after repo data is loaded
      api.get(`/api/github/repos/${repoName}/license`).then(lic => setLicense(lic)).catch(() => {})
      api.get(`/api/github/repos/${repoName}/community/profile`).then(com => setCommunity(com)).catch(() => {})
    })
    // Fetch README and branches
    api.get(`/api/github/repos/${repoName}/readme`).then(data => {
      setReadme(data?.content || '')
    }).catch(() => setReadme(''))
    api.get(`/api/github/repos/${repoName}/branches`).then(data => {
      const list = Array.isArray(data) ? data : []
      setBranches(list)
      if (list.length > 0) setSelectedBranch(list[0].name)
    }).catch(() => setBranches([]))
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
    { key: 'overview', label: '概览' },
    { key: 'files', label: '文件' },
    { key: 'commits', label: '提交' },
    { key: 'issues', label: 'Issues' },
    { key: 'pulls', label: 'PRs' },
    { key: 'stats', label: '统计' },
    { key: 'releases', label: 'Releases' },
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
            className="btn-primary"
            onClick={async () => {
              setSyncing(true)
              try {
                const result = await api.post(`/api/github/repos/${repoName}/sync`)
                setSyncResult(result)
              } catch (err) {
                setSyncResult({ status: 'error', message: err.message })
              } finally {
                setSyncing(false)
              }
            }}
            disabled={syncing}
            style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '4px 10px' }}
          >
            {syncing ? '同步中...' : '📥 同步文件'}
          </button>
          {syncResult && (
            <div style={{
              padding: '4px 10px', borderRadius: 8,
              background: syncResult.status === 'ok' ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)',
              fontSize: 11, color: syncResult.status === 'ok' ? 'var(--mac-green)' : 'var(--mac-red)',
            }}>
              {syncResult.status === 'ok'
                ? `✓ ${syncResult.synced_files}/${syncResult.total_files}`
                : `✗ ${syncResult.message}`
              }
            </div>
          )}
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
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`detail-tab ${activeTab === t.key ? 'active' : ''}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Branch selector (visible on files/commits tabs) */}
        {(activeTab === 'files' || activeTab === 'commits') && branches.length > 0 && (
          <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} style={{
            background: 'var(--mac-surface)', border: '1px solid var(--mac-border)',
            borderRadius: 8, padding: '4px 8px', color: 'var(--mac-text)', fontSize: 11, outline: 'none',
            marginBottom: 8,
          }}>
            {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
          </select>
        )}

        {/* Tab Content */}
        <div className="glass detail-tab-content">
          {activeTab === 'overview' && <ReadmeViewer content={readme} repoName={repoName} />}
          {activeTab === 'files' && <FileBrowser repoName={repoName} branch={selectedBranch} />}
          {activeTab === 'commits' && <CommitTimeline repoName={repoName} branch={selectedBranch} />}
          {activeTab === 'issues' && (
            <div style={{ textAlign: 'center', padding: 30 }}>
              <button onClick={() => onNavigate?.('issues')} style={{ background: 'var(--mac-accent)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 13 }}>
                前往 Issues 页面 →
              </button>
            </div>
          )}
          {activeTab === 'pulls' && (
            <div style={{ textAlign: 'center', padding: 30 }}>
              <button onClick={() => onNavigate?.('pulls')} style={{ background: 'var(--mac-accent)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 13 }}>
                前往 Pull Requests 页面 →
              </button>
            </div>
          )}
          {activeTab === 'stats' && (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--mac-text-secondary)', fontSize: 12 }}>
              <button onClick={() => onNavigate?.('analytics')} style={{ background: 'var(--mac-accent)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 13 }}>
                前往数据分析页面 →
              </button>
            </div>
          )}
          {activeTab === 'releases' && <ReleasesList repoName={repoName} />}
        </div>
      </div>
    </div>
  )
}
