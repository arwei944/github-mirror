import { useState, useEffect, useCallback } from 'react'
import { Icon } from '../App'
import api from '../api'

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

const STATUS_COLORS = {
  completed: { dot: 'var(--mac-green)', text: '已完成' },
  success: { dot: 'var(--mac-green)', text: '成功' },
  failure: { dot: 'var(--mac-red)', text: '失败' },
  cancelled: { dot: 'var(--mac-text-secondary)', text: '已取消' },
  skipped: { dot: 'var(--mac-text-secondary)', text: '已跳过' },
  in_progress: { dot: 'var(--mac-orange)', text: '运行中' },
  queued: { dot: 'var(--mac-orange)', text: '排队中' },
  requested: { dot: 'var(--mac-accent)', text: '已请求' },
  pending: { dot: 'var(--mac-orange)', text: '等待中' },
  running: { dot: 'var(--mac-orange)', text: '运行中' },
  action_required: { dot: 'var(--mac-orange)', text: '需要操作' },
  stale: { dot: 'var(--mac-text-secondary)', text: '过期' },
  timed_out: { dot: 'var(--mac-red)', text: '超时' },
}

function getStatusInfo(status, conclusion) {
  if (status === 'in_progress' || status === 'queued' || status === 'running' || status === 'pending' || status === 'requested') {
    return STATUS_COLORS[status] || STATUS_COLORS.pending
  }
  return STATUS_COLORS[conclusion] || STATUS_COLORS[status] || { dot: 'var(--mac-text-secondary)', text: status || '未知' }
}

function CreateReleaseModal({ repoName, onClose, onCreated }) {
  const [tag, setTag] = useState('')
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [draft, setDraft] = useState(false)
  const [prerelease, setPrerelease] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!tag.trim()) return
    setSubmitting(true)
    try {
      await api.post(`/api/github/repos/${repoName}/releases`, {
        tag_name: tag.trim(),
        name: name.trim() || tag.trim(),
        body: body.trim(),
        draft,
        prerelease,
      })
      onCreated()
    } catch (err) {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div className="glass animate-fade-in" style={{
        width: 520, maxHeight: '80vh', overflowY: 'auto', padding: 20,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>新建发布</h2>
          <button className="btn-icon" onClick={onClose}>{Icon.back(16)}</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)', display: 'block', marginBottom: 4 }}>标签 (Tag)</label>
            <input
              type="text"
              value={tag}
              onChange={e => setTag(e.target.value)}
              placeholder="例如: v1.0.0"
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
                fontSize: 13, color: 'var(--mac-text)', outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)', display: 'block', marginBottom: 4 }}>发布名称</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="留空则使用标签名"
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
                fontSize: 13, color: 'var(--mac-text)', outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)', display: 'block', marginBottom: 4 }}>描述</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="描述此版本的变更..."
              rows={5}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
                fontSize: 13, color: 'var(--mac-text)', outline: 'none',
                resize: 'vertical', fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={draft}
                onChange={e => setDraft(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              草稿
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={prerelease}
                onChange={e => setPrerelease(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              预发布
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button className="btn-secondary" onClick={onClose}>取消</button>
            <button className="btn-primary" onClick={handleSubmit} disabled={!tag.trim() || submitting}>
              {submitting ? '创建中...' : '创建发布'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Actions({ githubRepos }) {
  const [activeTab, setActiveTab] = useState('actions')
  const [selectedRepo, setSelectedRepo] = useState('')
  const [workflows, setWorkflows] = useState([])
  const [releases, setReleases] = useState([])
  const [loading, setLoading] = useState(false)
  const [showCreateRelease, setShowCreateRelease] = useState(false)
  const [secrets, setSecrets] = useState([])
  const [secretsLoading, setSecretsLoading] = useState(false)
  const [artifacts, setArtifacts] = useState([])
  const [artifactsLoading, setArtifactsLoading] = useState(false)
  const [showTriggerModal, setShowTriggerModal] = useState(false)
  const [triggerWorkflowId, setTriggerWorkflowId] = useState('')
  const [triggerRef, setTriggerRef] = useState('main')
  const [triggerInputs, setTriggerInputs] = useState('')
  const [triggering, setTriggering] = useState(false)
  const [showCreateSecret, setShowCreateSecret] = useState(false)
  const [newSecretName, setNewSecretName] = useState('')
  const [newSecretValue, setNewSecretValue] = useState('')
  const [newSecretKeyId, setNewSecretKeyId] = useState('')
  const [creatingSecret, setCreatingSecret] = useState(false)
  const [actionLoading, setActionLoading] = useState({})
  // Variables state
  const [variables, setVariables] = useState([])
  const [variablesLoading, setVariablesLoading] = useState(false)
  const [showCreateVariable, setShowCreateVariable] = useState(false)
  const [newVarName, setNewVarName] = useState('')
  const [newVarValue, setNewVarValue] = useState('')
  const [creatingVariable, setCreatingVariable] = useState(false)
  const [editingVariable, setEditingVariable] = useState(null)
  const [editVarValue, setEditVarValue] = useState('')
  const [savingVariable, setSavingVariable] = useState(false)
  // Caches state
  const [caches, setCaches] = useState([])
  const [cachesLoading, setCachesLoading] = useState(false)
  const [clearingCaches, setClearingCaches] = useState(false)

  const repoName = selectedRepo || (githubRepos.length > 0 ? githubRepos[0].name : '')

  useEffect(() => {
    if (!repoName) return
    setLoading(true)
    Promise.all([
      api.get(`/api/github/repos/${repoName}/actions/runs`).catch(() => []),
      api.get(`/api/github/repos/${repoName}/releases`).catch(() => []),
    ]).then(([wf, rel]) => {
      setWorkflows(wf || [])
      setReleases(rel || [])
      setLoading(false)
    })
  }, [repoName])

  const refreshReleases = () => {
    api.get(`/api/github/repos/${repoName}/releases`).then(data => {
      setReleases(data || [])
    })
  }

  const handleCancelRun = async (runId) => {
    setActionLoading(prev => ({ ...prev, ['cancel-' + runId]: true }))
    try {
      await api.post(`/api/github/repos/${repoName}/actions/runs/${runId}/cancel`)
      const wf = await api.get(`/api/github/repos/${repoName}/actions/runs`).catch(() => [])
      setWorkflows(wf || [])
    } catch (err) {
      // ignore
    } finally {
      setActionLoading(prev => ({ ...prev, ['cancel-' + runId]: false }))
    }
  }

  const handleRerun = async (runId) => {
    setActionLoading(prev => ({ ...prev, ['rerun-' + runId]: true }))
    try {
      await api.post(`/api/github/repos/${repoName}/actions/runs/${runId}/rerun`)
      const wf = await api.get(`/api/github/repos/${repoName}/actions/runs`).catch(() => [])
      setWorkflows(wf || [])
    } catch (err) {
      // ignore
    } finally {
      setActionLoading(prev => ({ ...prev, ['rerun-' + runId]: false }))
    }
  }

  const handleRerunFailed = async (runId) => {
    setActionLoading(prev => ({ ...prev, ['rerun-failed-' + runId]: true }))
    try {
      await api.post(`/api/github/repos/${repoName}/actions/runs/${runId}/rerun-failed-jobs`)
      const wf = await api.get(`/api/github/repos/${repoName}/actions/runs`).catch(() => [])
      setWorkflows(wf || [])
    } catch (err) {
      // ignore
    } finally {
      setActionLoading(prev => ({ ...prev, ['rerun-failed-' + runId]: false }))
    }
  }

  const handleToggleWorkflow = async (workflowId, currentState) => {
    const key = 'toggle-' + workflowId
    setActionLoading(prev => ({ ...prev, [key]: true }))
    try {
      if (currentState === 'disabled_manually') {
        await api.put(`/api/github/repos/${repoName}/actions/workflows/${workflowId}/enable`)
      } else {
        await api.put(`/api/github/repos/${repoName}/actions/workflows/${workflowId}/disable`)
      }
      const wf = await api.get(`/api/github/repos/${repoName}/actions/runs`).catch(() => [])
      setWorkflows(wf || [])
    } catch (err) {
      // ignore
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  const handleOpenTrigger = (workflowId) => {
    setTriggerWorkflowId(workflowId)
    setTriggerRef('main')
    setTriggerInputs('')
    setShowTriggerModal(true)
  }

  const handleTriggerWorkflow = async () => {
    if (!triggerRef.trim()) return
    setTriggering(true)
    try {
      let inputs = {}
      if (triggerInputs.trim()) {
        try { inputs = JSON.parse(triggerInputs.trim()) } catch (e) { /* ignore parse error */ }
      }
      await api.post(`/api/github/repos/${repoName}/actions/workflows/${triggerWorkflowId}/dispatches`, {
        ref: triggerRef.trim(),
        inputs,
      })
      setShowTriggerModal(false)
    } catch (err) {
      // ignore
    } finally {
      setTriggering(false)
    }
  }

  const loadSecrets = useCallback(() => {
    setSecretsLoading(true)
    api.get(`/api/github/repos/${repoName}/actions/secrets`)
      .then(data => { setSecrets(data?.secrets || data || []); setSecretsLoading(false) })
      .catch(() => { setSecrets([]); setSecretsLoading(false) })
  }, [repoName])

  const loadArtifacts = useCallback(() => {
    setArtifactsLoading(true)
    api.get(`/api/github/repos/${repoName}/actions/artifacts`)
      .then(data => { setArtifacts(data?.artifacts || data || []); setArtifactsLoading(false) })
      .catch(() => { setArtifacts([]); setArtifactsLoading(false) })
  }, [repoName])

  useEffect(() => {
    if (activeTab === 'secrets' && secrets.length === 0 && !secretsLoading) loadSecrets()
  }, [activeTab, secrets.length, secretsLoading, loadSecrets])

  useEffect(() => {
    if (activeTab === 'artifacts' && artifacts.length === 0 && !artifactsLoading) loadArtifacts()
  }, [activeTab, artifacts.length, artifactsLoading, loadArtifacts])

  const handleCreateSecret = async () => {
    if (!newSecretName.trim() || !newSecretValue.trim()) return
    setCreatingSecret(true)
    try {
      await api.put(`/api/github/repos/${repoName}/actions/secrets/${newSecretName.trim()}`, {
        encrypted_value: newSecretValue.trim(),
        key_id: newSecretKeyId.trim() || undefined,
      })
      setShowCreateSecret(false)
      setNewSecretName('')
      setNewSecretValue('')
      setNewSecretKeyId('')
      loadSecrets()
    } catch (err) {
      // ignore
    } finally {
      setCreatingSecret(false)
    }
  }

  const handleDeleteSecret = async (secretName) => {
    if (!window.confirm(`确定要删除 Secret "${secretName}" 吗？`)) return
    try {
      await api.del(`/api/github/repos/${repoName}/actions/secrets/${secretName}`)
      setSecrets(prev => prev.filter(s => s.name !== secretName))
    } catch (err) {
      // ignore
    }
  }

  const handleDeleteArtifact = async (artifactId) => {
    if (!window.confirm('确定要删除此 Artifact 吗？')) return
    try {
      await api.del(`/api/github/repos/${repoName}/actions/artifacts/${artifactId}`)
      setArtifacts(prev => prev.filter(a => a.id !== artifactId))
    } catch (err) {
      // ignore
    }
  }

  // Variables functions
  const loadVariables = useCallback(() => {
    setVariablesLoading(true)
    api.get(`/api/github/repos/${repoName}/actions/variables`)
      .then(data => { setVariables(data?.variables || data || []); setVariablesLoading(false) })
      .catch(() => { setVariables([]); setVariablesLoading(false) })
  }, [repoName])

  const handleCreateVariable = async () => {
    if (!newVarName.trim() || !newVarValue.trim()) return
    setCreatingVariable(true)
    try {
      await api.post(`/api/github/repos/${repoName}/actions/variables`, {
        name: newVarName.trim(),
        value: newVarValue.trim(),
      })
      setShowCreateVariable(false)
      setNewVarName('')
      setNewVarValue('')
      loadVariables()
    } catch (err) {
      // ignore
    } finally {
      setCreatingVariable(false)
    }
  }

  const handleEditVariable = (variable) => {
    setEditingVariable(variable.name)
    setEditVarValue('')
  }

  const handleSaveVariable = async (varName) => {
    if (!editVarValue.trim()) return
    setSavingVariable(true)
    try {
      await api.patch(`/api/github/repos/${repoName}/actions/variables/${varName}`, {
        name: varName,
        value: editVarValue.trim(),
      })
      setEditingVariable(null)
      setEditVarValue('')
      loadVariables()
    } catch (err) {
      // ignore
    } finally {
      setSavingVariable(false)
    }
  }

  const handleDeleteVariable = async (varName) => {
    if (!window.confirm(`确定要删除 Variable "${varName}" 吗？`)) return
    try {
      await api.del(`/api/github/repos/${repoName}/actions/variables/${varName}`)
      setVariables(prev => prev.filter(v => v.name !== varName))
    } catch (err) {
      // ignore
    }
  }

  // Caches functions
  const loadCaches = useCallback(() => {
    setCachesLoading(true)
    api.get(`/api/github/repos/${repoName}/actions/caches`)
      .then(data => { setCaches(data?.actions_caches || data || []); setCachesLoading(false) })
      .catch(() => { setCaches([]); setCachesLoading(false) })
  }, [repoName])

  const handleClearAllCaches = async () => {
    if (!window.confirm('确定要清除全部缓存吗？此操作不可撤销。')) return
    setClearingCaches(true)
    try {
      await api.del(`/api/github/repos/${repoName}/actions/caches`)
      setCaches([])
    } catch (err) {
      // ignore
    } finally {
      setClearingCaches(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'variables' && variables.length === 0 && !variablesLoading) loadVariables()
  }, [activeTab, variables.length, variablesLoading, loadVariables])

  useEffect(() => {
    if (activeTab === 'caches' && caches.length === 0 && !cachesLoading) loadCaches()
  }, [activeTab, caches.length, cachesLoading, loadCaches])

  const tabItems = [
    { key: 'actions', label: 'Actions' },
    { key: 'releases', label: '发布' },
    { key: 'secrets', label: 'Secrets' },
    { key: 'artifacts', label: 'Artifacts' },
    { key: 'variables', label: 'Variables' },
    { key: 'caches', label: '缓存' },
  ]

  return (
    <div>
      {/* Sort & Filter Bar */}
      <div className="sort-bar">
        {/* Tab selector */}
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {tabItems.map(t => (
            <button
              key={t.key}
              className={`sort-btn ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 16, background: 'var(--mac-border)' }} />

        {/* Repo selector */}
        <select
          value={repoName}
          onChange={e => setSelectedRepo(e.target.value)}
          style={{
            padding: '4px 8px', borderRadius: 6, border: '1px solid var(--mac-border)',
            background: 'var(--mac-bg)', fontSize: 12, color: 'var(--mac-text)',
            outline: 'none', cursor: 'pointer',
          }}
        >
          {githubRepos.map(r => (
            <option key={r.name} value={r.name}>{r.name}</option>
          ))}
        </select>

        <div style={{ flex: 1 }} />

        {activeTab === 'releases' && (
          <button
            className="btn-primary"
            onClick={() => setShowCreateRelease(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {Icon.plus(13)} 新建发布
          </button>
        )}
        {activeTab === 'secrets' && (
          <button
            className="btn-primary"
            onClick={() => { setShowCreateSecret(true); setNewSecretName(''); setNewSecretValue(''); setNewSecretKeyId('') }}
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {Icon.plus(13)} 新建 Secret
          </button>
        )}
        {activeTab === 'variables' && (
          <button
            className="btn-primary"
            onClick={() => { setShowCreateVariable(true); setNewVarName(''); setNewVarValue('') }}
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {Icon.plus(13)} 新建 Variable
          </button>
        )}
        {activeTab === 'caches' && caches.length > 0 && (
          <button
            className="btn-secondary"
            onClick={handleClearAllCaches}
            disabled={clearingCaches}
            style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--mac-red)' }}
          >
            {Icon.trash(13)} {clearingCaches ? '清除中...' : '清除全部缓存'}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="card-grid-scroll">
        <div style={{ padding: '16px 24px 48px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--mac-text-secondary)', gap: 8 }}>
              <span style={{ animation: 'pulse-dot 1s infinite' }}>&#9679;</span> 加载中...
            </div>
          ) : activeTab === 'actions' ? (
            /* Actions Tab */
            workflows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 64, color: 'var(--mac-text-secondary)' }}>
                <div style={{ fontSize: 36, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{Icon.activity(36)}</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>暂无工作流运行记录</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>GitHub Actions 运行记录将在这里显示</div>
              </div>
            ) : activeTab === 'variables' ? (
            /* Variables Tab */
            variablesLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--mac-text-secondary)', gap: 8 }}>
                <span style={{ animation: 'pulse-dot 1s infinite' }}>&#9679;</span> 加载中...
              </div>
            ) : variables.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 64, color: 'var(--mac-text-secondary)' }}>
                <div style={{ fontSize: 36, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{Icon.tag(36)}</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>暂无 Variables</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>点击「新建 Variable」创建第一个变量</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {variables.map(variable => (
                  <div key={variable.name} className="glass animate-fade-in" style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: 'var(--mac-text-secondary)', flexShrink: 0 }}>{Icon.tag(16)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {editingVariable === variable.name ? (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                              type="text"
                              value={editVarValue}
                              onChange={e => setEditVarValue(e.target.value)}
                              placeholder="输入新值"
                              style={{
                                flex: 1, padding: '6px 12px', borderRadius: 8,
                                border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
                                fontSize: 13, color: 'var(--mac-text)', outline: 'none',
                                fontFamily: 'monospace',
                              }}
                            />
                            <button
                              className="btn-primary"
                              onClick={() => handleSaveVariable(variable.name)}
                              disabled={savingVariable || !editVarValue.trim()}
                              style={{ fontSize: 10, padding: '4px 10px', flexShrink: 0 }}
                            >
                              {savingVariable ? '...' : '保存'}
                            </button>
                            <button
                              className="btn-secondary"
                              onClick={() => { setEditingVariable(null); setEditVarValue('') }}
                              style={{ fontSize: 10, padding: '4px 10px', flexShrink: 0 }}
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{variable.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--mac-text-secondary)', marginTop: 2, fontFamily: 'monospace' }}>
                              {'*'.repeat(8)}
                            </div>
                          </>
                        )}
                        {variable.updated_at && !editingVariable && (
                          <div style={{ fontSize: 11, color: 'var(--mac-text-secondary)', marginTop: 2 }}>
                            更新于 {timeAgo(variable.updated_at)}
                          </div>
                        )}
                      </div>
                      {editingVariable !== variable.name && (
                        <>
                          <button
                            className="btn-secondary"
                            onClick={() => handleEditVariable(variable)}
                            style={{ fontSize: 10, padding: '2px 8px', flexShrink: 0 }}
                          >
                            {Icon.code(10)} 编辑
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={() => handleDeleteVariable(variable.name)}
                            style={{ fontSize: 10, padding: '2px 8px', color: 'var(--mac-red)', flexShrink: 0 }}
                          >
                            {Icon.trash(10)} 删除
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'caches' ? (
            /* Caches Tab */
            cachesLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--mac-text-secondary)', gap: 8 }}>
                <span style={{ animation: 'pulse-dot 1s infinite' }}>&#9679;</span> 加载中...
              </div>
            ) : caches.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 64, color: 'var(--mac-text-secondary)' }}>
                <div style={{ fontSize: 36, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{Icon.folder(36)}</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>暂无缓存</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Actions 缓存将在这里显示</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {caches.map(cache => (
                  <div key={cache.id} className="glass animate-fade-in" style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: 'var(--mac-text-secondary)', flexShrink: 0 }}>{Icon.folder(16)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cache.key}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                          {cache.size_in_bytes !== undefined && (
                            <span>{(cache.size_in_bytes / 1024 / 1024).toFixed(2)} MB</span>
                          )}
                          <span>{timeAgo(cache.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {workflows.map(run => {
                  const statusInfo = getStatusInfo(run.status, run.conclusion)
                  return (
                    <div key={run.id} className="glass animate-fade-in" style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: statusInfo.dot,
                          animation: (run.status === 'in_progress' || run.status === 'queued') ? 'pulse-dot 1.2s ease-in-out infinite' : 'none',
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {run.name || run.display_title || '工作流'}
                            </span>
                            <span style={{
                              fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 500,
                              background: `${statusInfo.dot}18`, color: statusInfo.dot,
                            }}>
                              {statusInfo.text}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3, fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                            {run.head_branch && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                {Icon.gitBranch(11)} {run.head_branch}
                              </span>
                            )}
                            {run.event && (
                              <span>{run.event}</span>
                            )}
                            <span>{timeAgo(run.created_at)}</span>
                          </div>
                        </div>
                        {run.html_url && (
                          <a href={run.html_url} target="_blank" rel="noopener noreferrer"
                            style={{ color: 'var(--mac-accent)', fontSize: 11, textDecoration: 'none', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                            查看 {Icon.external(10)}
                          </a>
                        )}
                        {(run.status === 'in_progress' || run.status === 'queued') && (
                          <button
                            className="btn-secondary"
                            onClick={() => handleCancelRun(run.id)}
                            disabled={actionLoading['cancel-' + run.id]}
                            style={{ fontSize: 10, padding: '2px 8px', color: 'var(--mac-red)', flexShrink: 0 }}
                          >
                            {actionLoading['cancel-' + run.id] ? '...' : '取消'}
                          </button>
                        )}
                        {(run.conclusion === 'failure' || run.conclusion === 'cancelled' || run.conclusion === 'timed_out') && (
                          <>
                            <button
                              className="btn-secondary"
                              onClick={() => handleRerun(run.id)}
                              disabled={actionLoading['rerun-' + run.id]}
                              style={{ fontSize: 10, padding: '2px 8px', flexShrink: 0 }}
                            >
                              {actionLoading['rerun-' + run.id] ? '...' : '重试'}
                            </button>
                            {run.conclusion === 'failure' && (
                              <button
                                className="btn-secondary"
                                onClick={() => handleRerunFailed(run.id)}
                                disabled={actionLoading['rerun-failed-' + run.id]}
                                style={{ fontSize: 10, padding: '2px 8px', flexShrink: 0 }}
                              >
                                {actionLoading['rerun-failed-' + run.id] ? '...' : '重新运行失败'}
                              </button>
                            )}
                          </>
                        )}
                        {run.workflow_id && (
                          <button
                            className="btn-secondary"
                            onClick={() => handleOpenTrigger(run.workflow_id)}
                            style={{ fontSize: 10, padding: '2px 8px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}
                          >
                            {Icon.zap(10)} 触发
                          </button>
                        )}
                        {run.workflow_id && (
                          <button
                            className="btn-secondary"
                            onClick={() => handleToggleWorkflow(run.workflow_id, run.workflow_id)}
                            disabled={actionLoading['toggle-' + run.workflow_id]}
                            style={{ fontSize: 10, padding: '2px 8px', flexShrink: 0 }}
                          >
                            {actionLoading['toggle-' + run.workflow_id] ? '...' : '启用/禁用'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          ) : activeTab === 'secrets' ? (
            /* Secrets Tab */
            secretsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--mac-text-secondary)', gap: 8 }}>
                <span style={{ animation: 'pulse-dot 1s infinite' }}>&#9679;</span> 加载中...
              </div>
            ) : secrets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 64, color: 'var(--mac-text-secondary)' }}>
                <div style={{ fontSize: 36, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{Icon.lock(36)}</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>暂无 Secrets</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>点击「新建 Secret」创建第一个密钥</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {secrets.map(secret => (
                  <div key={secret.name} className="glass animate-fade-in" style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: 'var(--mac-text-secondary)', flexShrink: 0 }}>{Icon.lock(16)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{secret.name}</div>
                        {secret.updated_at && (
                          <div style={{ fontSize: 11, color: 'var(--mac-text-secondary)', marginTop: 2 }}>
                            更新于 {timeAgo(secret.updated_at)}
                          </div>
                        )}
                      </div>
                      <button
                        className="btn-secondary"
                        onClick={() => handleDeleteSecret(secret.name)}
                        style={{ fontSize: 10, padding: '2px 8px', color: 'var(--mac-red)', flexShrink: 0 }}
                      >
                        {Icon.trash(10)} 删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'artifacts' ? (
            /* Artifacts Tab */
            artifactsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--mac-text-secondary)', gap: 8 }}>
                <span style={{ animation: 'pulse-dot 1s infinite' }}>&#9679;</span> 加载中...
              </div>
            ) : artifacts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 64, color: 'var(--mac-text-secondary)' }}>
                <div style={{ fontSize: 36, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{Icon.folder(36)}</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>暂无 Artifacts</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>工作流运行产物将在这里显示</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {artifacts.map(artifact => (
                  <div key={artifact.id} className="glass animate-fade-in" style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: 'var(--mac-text-secondary)', flexShrink: 0 }}>{Icon.folder(16)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{artifact.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                          {artifact.size_in_bytes !== undefined && (
                            <span>{(artifact.size_in_bytes / 1024 / 1024).toFixed(2)} MB</span>
                          )}
                          {artifact.expired && (
                            <span style={{ color: 'var(--mac-red)' }}>已过期</span>
                          )}
                          <span>{timeAgo(artifact.created_at)}</span>
                        </div>
                      </div>
                      {!artifact.expired && artifact.archive_download_url && (
                        <a href={artifact.archive_download_url} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--mac-accent)', textDecoration: 'none', flexShrink: 0 }}>
                          {Icon.external(10)} 下载
                        </a>
                      )}
                      <button
                        className="btn-secondary"
                        onClick={() => handleDeleteArtifact(artifact.id)}
                        style={{ fontSize: 10, padding: '2px 8px', color: 'var(--mac-red)', flexShrink: 0 }}
                      >
                        {Icon.trash(10)} 删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Releases Tab */
            releases.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 64, color: 'var(--mac-text-secondary)' }}>
                <div style={{ fontSize: 36, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{Icon.release(36)}</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>暂无发布记录</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>点击「新建发布」创建第一个版本</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {releases.map(rel => (
                  <div key={rel.id} className="glass animate-fade-in" style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ color: 'var(--mac-accent)', flexShrink: 0, marginTop: 2 }}>{Icon.release(18)}</span>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{rel.name || rel.tag_name}</span>
                          <code style={{
                            fontFamily: 'monospace', fontSize: 11, padding: '1px 6px',
                            borderRadius: 4, background: 'var(--mac-gray)', color: 'var(--mac-text-secondary)',
                          }}>
                            {rel.tag_name}
                          </code>
                          {rel.draft && (
                            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 6, background: 'var(--mac-gray)', color: 'var(--mac-text-secondary)', fontWeight: 500 }}>
                              草稿
                            </span>
                          )}
                          {rel.prerelease && (
                            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 6, background: 'rgba(255,149,0,0.12)', color: 'var(--mac-orange)', fontWeight: 500 }}>
                              预发布
                            </span>
                          )}
                        </div>

                        {rel.body && (
                          <div style={{ fontSize: 12, color: 'var(--mac-text-secondary)', marginTop: 4, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {rel.body}
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                          <span>{timeAgo(rel.published_at || rel.created_at)}</span>
                          {rel.author && (
                            <span>由 {rel.author.login} 发布</span>
                          )}
                        </div>

                        {/* Assets */}
                        {rel.assets && rel.assets.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                            {rel.assets.map(asset => (
                              <a
                                key={asset.id}
                                href={asset.browser_download_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 4,
                                  fontSize: 11, color: 'var(--mac-accent)', textDecoration: 'none',
                                  padding: '2px 8px', borderRadius: 6,
                                  border: '1px solid var(--mac-border)',
                                  transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--mac-surface-hover)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                {Icon.external(10)} {asset.name}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Trigger Workflow Modal */}
      {showTriggerModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setShowTriggerModal(false)}>
          <div className="glass animate-fade-in" style={{
            width: 480, maxHeight: '80vh', overflowY: 'auto', padding: 20,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>触发工作流</h2>
              <button className="btn-icon" onClick={() => setShowTriggerModal(false)}>{Icon.back(16)}</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)', display: 'block', marginBottom: 4 }}>分支 / Tag (ref)</label>
                <input
                  type="text"
                  value={triggerRef}
                  onChange={e => setTriggerRef(e.target.value)}
                  placeholder="main"
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8,
                    border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
                    fontSize: 13, color: 'var(--mac-text)', outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)', display: 'block', marginBottom: 4 }}>输入参数 (JSON, 可选)</label>
                <textarea
                  value={triggerInputs}
                  onChange={e => setTriggerInputs(e.target.value)}
                  placeholder='{"key": "value"}'
                  rows={4}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8,
                    border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
                    fontSize: 13, color: 'var(--mac-text)', outline: 'none',
                    resize: 'vertical', fontFamily: 'monospace',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button className="btn-secondary" onClick={() => setShowTriggerModal(false)}>取消</button>
                <button className="btn-primary" onClick={handleTriggerWorkflow} disabled={!triggerRef.trim() || triggering}>
                  {triggering ? '触发中...' : '触发'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Variable Modal */}
      {showCreateVariable && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setShowCreateVariable(false)}>
          <div className="glass animate-fade-in" style={{
            width: 480, maxHeight: '80vh', overflowY: 'auto', padding: 20,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>新建 Variable</h2>
              <button className="btn-icon" onClick={() => setShowCreateVariable(false)}>{Icon.back(16)}</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)', display: 'block', marginBottom: 4 }}>名称 *</label>
                <input
                  type="text"
                  value={newVarName}
                  onChange={e => setNewVarName(e.target.value)}
                  placeholder="VARIABLE_NAME"
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8,
                    border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
                    fontSize: 13, color: 'var(--mac-text)', outline: 'none',
                    fontFamily: 'monospace',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)', display: 'block', marginBottom: 4 }}>值 *</label>
                <textarea
                  value={newVarValue}
                  onChange={e => setNewVarValue(e.target.value)}
                  placeholder="变量值"
                  rows={3}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8,
                    border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
                    fontSize: 13, color: 'var(--mac-text)', outline: 'none',
                    resize: 'vertical', fontFamily: 'monospace',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button className="btn-secondary" onClick={() => setShowCreateVariable(false)}>取消</button>
                <button className="btn-primary" onClick={handleCreateVariable} disabled={!newVarName.trim() || !newVarValue.trim() || creatingVariable}>
                  {creatingVariable ? '创建中...' : '创建'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Secret Modal */}
      {showCreateSecret && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setShowCreateSecret(false)}>
          <div className="glass animate-fade-in" style={{
            width: 480, maxHeight: '80vh', overflowY: 'auto', padding: 20,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>新建 Secret</h2>
              <button className="btn-icon" onClick={() => setShowCreateSecret(false)}>{Icon.back(16)}</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)', display: 'block', marginBottom: 4 }}>名称 *</label>
                <input
                  type="text"
                  value={newSecretName}
                  onChange={e => setNewSecretName(e.target.value)}
                  placeholder="SECRET_NAME"
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8,
                    border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
                    fontSize: 13, color: 'var(--mac-text)', outline: 'none',
                    fontFamily: 'monospace',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)', display: 'block', marginBottom: 4 }}>加密值 *</label>
                <textarea
                  value={newSecretValue}
                  onChange={e => setNewSecretValue(e.target.value)}
                  placeholder="加密后的值"
                  rows={3}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8,
                    border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
                    fontSize: 13, color: 'var(--mac-text)', outline: 'none',
                    resize: 'vertical', fontFamily: 'monospace',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)', display: 'block', marginBottom: 4 }}>密钥 ID (可选)</label>
                <input
                  type="text"
                  value={newSecretKeyId}
                  onChange={e => setNewSecretKeyId(e.target.value)}
                  placeholder="key_id"
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8,
                    border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
                    fontSize: 13, color: 'var(--mac-text)', outline: 'none',
                    fontFamily: 'monospace',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button className="btn-secondary" onClick={() => setShowCreateSecret(false)}>取消</button>
                <button className="btn-primary" onClick={handleCreateSecret} disabled={!newSecretName.trim() || !newSecretValue.trim() || creatingSecret}>
                  {creatingSecret ? '创建中...' : '创建'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Release Modal */}
      {showCreateRelease && (
        <CreateReleaseModal
          repoName={repoName}
          onClose={() => setShowCreateRelease(false)}
          onCreated={() => { setShowCreateRelease(false); refreshReleases() }}
        />
      )}
    </div>
  )
}
