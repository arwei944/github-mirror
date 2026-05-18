import { useState, useCallback } from 'react'
import { Icon } from '../App'
import api from '../api'
import { timeAgo } from '../utils/timeAgo'

function StatusDot({ status }) {
  const cls = { success: 'status-running', running: 'status-building', error: 'status-error', skipped: 'status-idle', idle: 'status-idle' }
  return <span className={`status-dot ${cls[status] || 'status-idle'}`} />
}

function DeployCard({ project, hfStatus, onToggleAuto, onDeploy, onRemove }) {
  const [deploying, setDeploying] = useState(false)

  const handleDeploy = async () => {
    setDeploying(true)
    await api.post(`/api/projects/${project.name}/deploy`)
    setTimeout(() => {
      onDeploy?.()
      setDeploying(false)
    }, 3000)
  }

  const handleToggleAuto = async () => {
    await api.post(`/api/projects/${project.name}`, {
      ...project.config,
      auto_deploy: !project.config.auto_deploy,
    })
    onToggleAuto?.()
  }

  const handleRemove = async () => {
    await api.del(`/api/projects/${project.name}`)
    onRemove?.()
  }

  return (
    <div className="glass animate-fade-in" style={{ padding: 14 }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <StatusDot status={project.last_deploy?.status || 'idle'} />
        <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project.name}
        </span>
        {hfStatus && (
          <span style={{
            fontSize: 9, padding: '1px 6px', borderRadius: 6, fontWeight: 500,
            background: hfStatus === 'RUNNING' ? 'rgba(52,199,89,0.12)' : 'var(--mac-gray)',
            color: hfStatus === 'RUNNING' ? 'var(--mac-green)' : 'var(--mac-text-secondary)',
          }}>{hfStatus}</span>
        )}
      </div>

      {/* Description */}
      {project.config?.description && (
        <div style={{ fontSize: 12, color: 'var(--mac-text-secondary)', lineHeight: 1.4, marginBottom: 8 }}>
          {project.config.description}
        </div>
      )}

      {/* Meta info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--mac-text-secondary)', marginBottom: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {Icon.gitBranch(11)} {project.config?.branch || 'main'}
        </span>
        {project.last_deploy && (
          <span>{timeAgo(project.last_deploy.finished_at || project.last_deploy.started_at)}</span>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: '1px solid var(--mac-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <button
            className={`toggle toggle-sm ${project.config?.auto_deploy ? 'active' : ''}`}
            onClick={handleToggleAuto}
          />
          <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>自动部署</span>
        </div>
        <button
          className="btn-primary"
          onClick={handleDeploy}
          disabled={deploying}
          style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '3px 10px' }}
        >
          {Icon.deploy(11)} {deploying ? '部署中...' : '立即部署'}
        </button>
        <button
          onClick={handleRemove}
          className="btn-icon"
          title="移除"
          style={{ marginLeft: 'auto' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--mac-red)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--mac-text-secondary)'}
        >
          {Icon.trash(12)}
        </button>
      </div>
    </div>
  )
}

export default function Deploy({ githubRepos, projects, hfSpaces, onRefresh }) {
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const projectMap = Object.fromEntries(projects.map(p => [p.name, p]))
  const getHfStatus = (name) => hfSpaces.find(s => s.name === name)?.stage || null

  // Available repos (not yet deployed)
  const availableRepos = githubRepos.filter(r => !projectMap[r.name])

  const filteredProjects = projects.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleAddProject = async (repo) => {
    await api.post(`/api/projects/${repo.name}`, {
      auto_deploy: false,
      branch: repo.default_branch || 'main',
      hf_space: '',
      description: repo.description || '',
    })
    setShowAdd(false)
    onRefresh?.()
  }

  const handleToggleAuto = useCallback(() => { onRefresh?.() }, [onRefresh])
  const handleDeploy = useCallback(() => { onRefresh?.() }, [onRefresh])
  const handleRemove = useCallback(() => { onRefresh?.() }, [onRefresh])

  return (
    <div>
      {/* Header bar */}
      <div className="sort-bar">
        <span style={{ fontSize: 14, fontWeight: 600 }}>部署管理</span>
        <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)', marginLeft: 8 }}>
          共 {projects.length} 个项目
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative', marginRight: 8 }}>
          <input
            type="text"
            className="search-input"
            placeholder="搜索项目..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--mac-text-secondary)' }}>
            {Icon.search(13)}
          </span>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowAdd(!showAdd)}
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        >
          {Icon.plus(13)} 添加项目
        </button>
      </div>

      {/* Add project panel */}
      {showAdd && (
        <div style={{ padding: '12px 24px', background: 'var(--mac-surface)', borderBottom: '1px solid var(--mac-border)' }}>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8, color: 'var(--mac-text-secondary)' }}>
            选择要添加的仓库
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
            {availableRepos.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--mac-text-secondary)', padding: 16 }}>
                所有仓库都已添加
              </div>
            ) : (
              availableRepos.map(repo => (
                <button
                  key={repo.name}
                  onClick={() => handleAddProject(repo)}
                  className="btn-secondary"
                  style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  {repo.visibility === 'private' && Icon.lock(10)}
                  {repo.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Deploy grid */}
      <div className="card-grid-scroll">
        <div style={{ padding: '20px 24px 48px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {filteredProjects.map(project => (
              <DeployCard
                key={project.name}
                project={project}
                hfStatus={getHfStatus(project.name)}
                onToggleAuto={handleToggleAuto}
                onDeploy={handleDeploy}
                onRemove={handleRemove}
              />
            ))}
          </div>
          {filteredProjects.length === 0 && (
            <div style={{ textAlign: 'center', padding: 64, color: 'var(--mac-text-secondary)' }}>
              <div style={{ fontSize: 36, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{Icon.deploy(36)}</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>暂无部署项目</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>点击上方「添加项目」按钮开始</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
