import { useState, useMemo } from 'react'
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

function StatusDot({ status }) {
  const cls = { success: 'status-running', running: 'status-building', error: 'status-error', skipped: 'status-idle', idle: 'status-idle' }
  return <span className={`status-dot ${cls[status] || 'status-idle'}`} />
}

const SORT_OPTIONS = [
  { key: 'updated', label: '最近更新' },
  { key: 'stars', label: '最多星标' },
  { key: 'name-asc', label: '名称(A-Z)' },
  { key: 'name-desc', label: '名称(Z-A)' },
  { key: 'size', label: '最大' },
  { key: 'created', label: '最近创建' },
]

const FILTER_OPTIONS = [
  { key: 'all', label: '全部' },
  { key: 'public', label: '公开' },
  { key: 'private', label: '私有' },
  { key: 'archived', label: '已归档' },
]

function RepoCard({ repo, isDeployed, config, lastDeploy, hfStatus, onSelect, onDelete }) {
  const [hovered, setHovered] = useState(false)

  const handleStar = async (e) => {
    e.stopPropagation()
    try {
      const method = repo.viewer_has_starred ? 'del' : 'put'
      await api[method](`/api/github/repos/${repo.name}/star`)
    } catch (err) { /* ignore */ }
  }

  const handleFork = async (e) => {
    e.stopPropagation()
    try {
      await api.post(`/api/github/repos/${repo.name}/forks`)
    } catch (err) { /* ignore */ }
  }

  const handleWatch = async (e) => {
    e.stopPropagation()
    try {
      const method = repo.viewer_has_watched ? 'del' : 'put'
      await api[method](`/api/github/repos/${repo.name}/subscription`)
    } catch (err) { /* ignore */ }
  }

  return (
    <div
      className="project-card glass animate-fade-in"
      onClick={() => onSelect(repo.name)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          {isDeployed && <StatusDot status={lastDeploy?.status || 'idle'} />}
          {!isDeployed && <span style={{ width: 7, height: 7, borderRadius: 2, background: 'var(--mac-gray)', display: 'inline-block', flexShrink: 0 }} />}
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {repo.name}
          </span>
          {repo.visibility === 'private' && <span style={{ color: 'var(--mac-text-secondary)', flexShrink: 0 }}>{Icon.lock(10)}</span>}
        </div>
        {hfStatus && (
          <span style={{
            fontSize: 9, padding: '1px 6px', borderRadius: 6, flexShrink: 0, fontWeight: 500,
            background: hfStatus === 'RUNNING' ? 'rgba(52,199,89,0.12)' : 'var(--mac-gray)',
            color: hfStatus === 'RUNNING' ? 'var(--mac-green)' : 'var(--mac-text-secondary)',
          }}>{hfStatus}</span>
        )}
      </div>

      {/* Description */}
      {repo.description && (
        <div style={{
          fontSize: 12, color: 'var(--mac-text-secondary)', lineHeight: 1.4, marginBottom: 8,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{repo.description}</div>
      )}

      {/* Language + topics */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {repo.language && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--mac-text-secondary)' }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: langColor(repo.language), display: 'inline-block' }} />
            {repo.language}
          </span>
        )}
        {repo.topics?.slice(0, 3).map(t => (
          <span key={t} style={{ padding: '1px 7px', borderRadius: 8, background: 'var(--mac-accent)', color: 'white', fontSize: 9, fontWeight: 500 }}>{t}</span>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--mac-text-secondary)' }}>
        {repo.stargazers_count > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>{Icon.star(11)} {repo.stargazers_count}</span>
        )}
        {repo.forks_count > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>{Icon.fork(11)} {repo.forks_count}</span>
        )}
        {repo.open_issues_count > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>{Icon.issue(11)} {repo.open_issues_count}</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10 }}>{timeAgo(repo.updated_at)}</span>
      </div>

      {/* Hover actions */}
      {hovered && (
        <div className="card-hover-actions" onClick={e => e.stopPropagation()}>
          <button
            onClick={handleStar}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '3px 10px' }}
          >
            {Icon.star(11)} {repo.viewer_has_starred ? '取消 Star' : 'Star'}
          </button>
          <button
            onClick={handleFork}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '3px 10px' }}
          >
            {Icon.fork(11)} Fork
          </button>
          <button
            onClick={handleWatch}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '3px 10px' }}
          >
            {Icon.watch(11)} {repo.viewer_has_watched ? '取消关注' : 'Watch'}
          </button>
          <button
            onClick={(e) => onDelete(repo.name, e)}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '3px 10px', color: 'var(--mac-red)', marginLeft: 'auto' }}
          >
            {Icon.trash(11)} 删除
          </button>
        </div>
      )}
    </div>
  )
}

export default function Repos({ githubRepos, projects, hfSpaces, onSelectRepo }) {
  const [sortBy, setSortBy] = useState('updated')
  const [filterBy, setFilterBy] = useState('all')
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '', description: '', homepage: '', private: false,
    auto_init: true, has_issues: true, has_wiki: true, has_projects: true,
  })
  const [creating, setCreating] = useState(false)
  const [createMessage, setCreateMessage] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const projectMap = Object.fromEntries(projects.map(p => [p.name, p]))
  const getHfStatus = (name) => hfSpaces.find(s => s.name === name)?.stage || null

  const filtered = useMemo(() => {
    let list = [...githubRepos]

    // Filter
    if (filterBy === 'public') list = list.filter(r => r.visibility === 'public')
    else if (filterBy === 'private') list = list.filter(r => r.visibility === 'private')
    else if (filterBy === 'archived') list = list.filter(r => r.archived)

    // Search
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q)
      )
    }

    // Sort
    switch (sortBy) {
      case 'updated':
        list.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        break
      case 'stars':
        list.sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
        break
      case 'name-asc':
        list.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'name-desc':
        list.sort((a, b) => b.name.localeCompare(a.name))
        break
      case 'size':
        list.sort((a, b) => (b.size || 0) - (a.size || 0))
        break
      case 'created':
        list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        break
      default:
        break
    }

    return list
  }, [githubRepos, filterBy, search, sortBy, refreshKey])

  const handleCreateRepo = async () => {
    if (!createForm.name.trim()) return
    setCreating(true)
    setCreateMessage('')
    try {
      await api.post('/api/github/repos', createForm)
      setCreateMessage('创建成功')
      setShowCreateModal(false)
      setCreateForm({
        name: '', description: '', homepage: '', private: false,
        auto_init: true, has_issues: true, has_wiki: true, has_projects: true,
      })
      setRefreshKey(k => k + 1)
    } catch (err) {
      setCreateMessage('创建失败: ' + (err.message || '未知错误'))
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteRepo = async (repoName, e) => {
    e.stopPropagation()
    if (!window.confirm(`确定要删除仓库 "${repoName}" 吗？此操作不可撤销。`)) return
    try {
      await api.del('/api/github/repos/' + repoName)
      setRefreshKey(k => k + 1)
    } catch (err) {
      // ignore
    }
  }

  return (
    <div>
      {/* Sort & Filter Bar */}
      <div className="sort-bar">
        {/* Sort buttons */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)', fontWeight: 500, marginRight: 2 }}>排序</span>
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              className={`sort-btn ${sortBy === opt.key ? 'active' : ''}`}
              onClick={() => setSortBy(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 16, background: 'var(--mac-border)', margin: '0 4px' }} />

        {/* Filter buttons */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.key}
              className={`filter-btn ${filterBy === opt.key ? 'active' : ''}`}
              onClick={() => setFilterBy(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="search-input"
            placeholder="搜索仓库..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--mac-text-secondary)' }}>
            {Icon.search(13)}
          </span>
        </div>

        {/* New repo button */}
        <button
          className="btn-primary"
          onClick={() => setShowCreateModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '4px 12px', whiteSpace: 'nowrap' }}
        >
          {Icon.plus(13)} 新建仓库
        </button>
      </div>

      {/* Card Grid */}
      <div className="card-grid-scroll">
        <div style={{ padding: '20px 24px 48px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {filtered.map(repo => (
              <RepoCard
                key={repo.name}
                repo={repo}
                isDeployed={!!projectMap[repo.name]}
                config={projectMap[repo.name]?.config || {}}
                lastDeploy={projectMap[repo.name]?.last_deploy}
                hfStatus={getHfStatus(repo.name)}
                onSelect={onSelectRepo}
                onDelete={handleDeleteRepo}
              />
            ))}
          </div>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 64, color: 'var(--mac-text-secondary)' }}>
              <div style={{ fontSize: 36, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{Icon.search(36)}</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>没有找到匹配的仓库</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>试试其他关键词或筛选条件</div>
            </div>
          )}
        </div>
      </div>

      {/* Create repo modal */}
      {showCreateModal && (
        <div
          className="animate-fade-in"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            backdropFilter: 'blur(8px)',
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="glass"
            style={{
              width: 480, maxHeight: '80vh', overflow: 'auto',
              padding: 24, display: 'flex', flexDirection: 'column', gap: 16,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>新建仓库</span>
              <button className="btn-icon" onClick={() => setShowCreateModal(false)}>{Icon.back(14)}</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)' }}>仓库名称 *</label>
              <input
                type="text"
                value={createForm.name}
                onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="my-awesome-project"
                style={{
                  padding: '6px 12px', borderRadius: 'var(--mac-radius)', border: '1px solid var(--mac-border)',
                  background: 'var(--mac-bg)', color: 'var(--mac-text)', fontSize: 13, outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)' }}>描述</label>
              <textarea
                value={createForm.description}
                onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="仓库描述..."
                rows={2}
                style={{
                  padding: '6px 12px', borderRadius: 'var(--mac-radius)', border: '1px solid var(--mac-border)',
                  background: 'var(--mac-bg)', color: 'var(--mac-text)', fontSize: 13, outline: 'none',
                  resize: 'vertical', fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)' }}>主页</label>
              <input
                type="text"
                value={createForm.homepage}
                onChange={e => setCreateForm({ ...createForm, homepage: e.target.value })}
                placeholder="https://example.com"
                style={{
                  padding: '6px 12px', borderRadius: 'var(--mac-radius)', border: '1px solid var(--mac-border)',
                  background: 'var(--mac-bg)', color: 'var(--mac-text)', fontSize: 13, outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
              {[
                { key: 'private', label: '私有仓库' },
                { key: 'auto_init', label: '初始化 README' },
                { key: 'has_issues', label: 'Issues' },
                { key: 'has_wiki', label: 'Wiki' },
                { key: 'has_projects', label: 'Projects' },
              ].map(item => (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--mac-text)', minWidth: 100 }}>{item.label}</span>
                  <button
                    onClick={() => setCreateForm({ ...createForm, [item.key]: !createForm[item.key] })}
                    style={{
                      width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: createForm[item.key] ? 'var(--mac-green)' : 'var(--mac-gray)',
                      position: 'relative', transition: 'background 0.2s',
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 2,
                      left: createForm[item.key] ? 18 : 2,
                      width: 16, height: 16, borderRadius: 8,
                      background: 'white', transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                  <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                    {createForm[item.key] ? '开启' : '关闭'}
                  </span>
                </div>
              ))}
            </div>

            {createMessage && (
              <div style={{
                fontSize: 12, padding: '6px 12px', borderRadius: 'var(--mac-radius)',
                background: createMessage.includes('失败') ? 'rgba(255,59,48,0.1)' : 'rgba(52,199,89,0.1)',
                color: createMessage.includes('失败') ? 'var(--mac-red)' : 'var(--mac-green)',
              }}>
                {createMessage}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="btn-secondary"
                onClick={() => { setShowCreateModal(false); setCreateMessage('') }}
                style={{ fontSize: 13, padding: '6px 16px' }}
              >
                取消
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateRepo}
                disabled={creating || !createForm.name.trim()}
                style={{ fontSize: 13, padding: '6px 16px' }}
              >
                {creating ? '创建中...' : '创建仓库'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
