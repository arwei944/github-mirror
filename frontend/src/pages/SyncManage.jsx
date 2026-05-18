import { useState, useEffect, useCallback } from 'react'
import { timeAgo } from '../utils/timeAgo'

// 简单的 API 请求（不使用 api.js 的复杂逻辑）
const fetchApi = async (url, options = {}) => {
  try {
    const res = await fetch(url, options)
    if (!res.ok) throw new Error(await res.text())
    return await res.json()
  } catch (e) {
    console.error(e)
    return null
  }
}

export default function SyncManage({ repos, onSelectRepo }) {
  const [syncStatuses, setSyncStatuses] = useState({})
  const [syncing, setSyncing] = useState(false)
  const [dataSyncing, setDataSyncing] = useState(null)
  const [deployDialog, setDeployDialog] = useState(null) // { repo_name, repo_full_name }
  const [deployForm, setDeployForm] = useState({ hf_space_name: '', space_type: 'docker' })
  const [deployStatus, setDeployStatus] = useState(null)
  const [detectResult, setDetectResult] = useState(null)
  const [activeTab, setActiveTab] = useState('sync') // 'sync' or 'deploy'

  // 加载同步状态
  const loadSyncStatus = useCallback(async () => {
    const data = await fetchApi('/api/sync/status')
    if (data) {
      const map = {}
      data.forEach(s => { map[s.repo_name] = s })
      setSyncStatuses(map)
    }
  }, [])

  useEffect(() => { loadSyncStatus() }, [loadSyncStatus])

  // 批量同步所有仓库
  const handleSyncAll = async () => {
    setSyncing(true)
    const repoNames = (repos || []).map(r => r.name)
    await fetchApi('/api/sync/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repos: repoNames }),
    })
    // 轮询状态
    const timer = setInterval(loadSyncStatus, 3000)
    setTimeout(() => { clearInterval(timer); setSyncing(false) }, 60000)
  }

  // 同步单个仓库
  const handleSyncOne = async (repoName) => {
    await fetchApi(`/api/sync/repos/${repoName}`, { method: 'POST' })
    loadSyncStatus()
  }

  // 同步数据
  const handleSyncData = async (repoName) => {
    setDataSyncing(repoName)
    await fetchApi(`/api/sync/data/${repoName}`, { method: 'POST' })
    setDataSyncing(null)
  }

  // 打开部署对话框
  const handleOpenDeploy = async (repo) => {
    setDeployDialog(repo)
    setDeployForm({ hf_space_name: repo.name, space_type: 'docker' })
    setDeployStatus(null)
    // 自动检测项目类型
    const result = await fetchApi(`/api/deploy/detect/${repo.name}`)
    setDetectResult(result)
  }

  // 执行部署
  const handleDeploy = async () => {
    if (!deployDialog) return
    setDeployStatus('deploying')
    const result = await fetchApi('/api/deploy/hf-space', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        github_repo: `${deployDialog.full_name || deployDialog.name}`,
        hf_space_name: deployForm.hf_space_name,
        space_type: deployForm.space_type,
      }),
    })
    if (result) {
      setDeployStatus('started')
      // 轮询部署状态
      const timer = setInterval(async () => {
        const status = await fetchApi(`/api/deploy/hf-space/${deployForm.hf_space_name}/status`)
        if (status && status.status === 'completed') {
          setDeployStatus('completed')
          clearInterval(timer)
        } else if (status && status.status === 'error') {
          setDeployStatus('error')
          clearInterval(timer)
        }
      }, 5000)
      setTimeout(() => clearInterval(timer), 300000) // 5 分钟超时
    } else {
      setDeployStatus('error')
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return '\u2705'
      case 'syncing': case 'cloning': case 'detecting': case 'creating_space': case 'pushing': return '\u23F3'
      case 'error': return '\u274C'
      default: return '\u2B1C'
    }
  }

  const getStatusLabel = (status) => {
    const labels = {
      'idle': '\u672A\u540C\u6B65', 'syncing': '\u540C\u6B65\u4E2D', 'completed': '\u5DF2\u540C\u6B65',
      'error': '\u5931\u8D25', 'cloning': '\u514B\u9686\u4E2D', 'detecting': '\u68C0\u6D4B\u4E2D',
      'creating_space': '\u521B\u5EFA Space', 'pushing': '\u63A8\u9001\u4E2D', 'not_synced': '\u672A\u540C\u6B65',
    }
    return labels[status] || status
  }

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, color: 'var(--mac-text)' }}>
        {'\uD83D\uDD04'} 同步管理
      </h2>

      {/* Tab 切换 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['sync', 'deploy'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 500,
              background: activeTab === tab ? 'var(--mac-accent)' : 'var(--mac-surface)',
              color: activeTab === tab ? '#fff' : 'var(--mac-text)',
            }}>
            {tab === 'sync' ? '\uD83D\uDCE6 代码同步' : '\uD83D\uDE80 一键部署'}
          </button>
        ))}
      </div>

      {activeTab === 'sync' && (
        <>
          {/* 操作栏 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
            <button onClick={handleSyncAll} disabled={syncing}
              style={{
                padding: '8px 20px', borderRadius: 8, border: 'none', cursor: syncing ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 500,
                background: syncing ? 'var(--mac-border)' : 'var(--mac-accent)', color: '#fff',
              }}>
              {syncing ? '\u23F3 同步中...' : '\uD83D\uDCE5 批量同步所有仓库'}
            </button>
            <span style={{ fontSize: 12, color: 'var(--mac-text-secondary)' }}>
              将仓库源代码克隆到本地存储
            </span>
          </div>

          {/* 仓库列表 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {(repos || []).map((repo, i) => {
              const fullName = repo.full_name || `${repo.name}`
              const status = syncStatuses[fullName]
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                  borderRadius: 10, background: i % 2 === 0 ? 'transparent' : 'var(--mac-surface)',
                }}>
                  <span style={{ fontSize: 16 }}>{getStatusIcon(status?.status)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--mac-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {repo.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                      {getStatusLabel(status?.status)}
                      {status?.total_files > 0 && ` \u00B7 ${status.total_files} 文件`}
                      {status?.last_sync && ` \u00B7 ${timeAgo(status.last_sync)}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => handleSyncOne(repo.name)} title="同步源代码"
                      style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--mac-border)', background: 'var(--mac-surface)', cursor: 'pointer', fontSize: 11, color: 'var(--mac-text)' }}>
                      {'\uD83D\uDCE5'} 代码
                    </button>
                    <button onClick={() => handleSyncData(repo.name)} disabled={dataSyncing === repo.name} title="同步 API 数据"
                      style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--mac-border)', background: 'var(--mac-surface)', cursor: dataSyncing === repo.name ? 'not-allowed' : 'pointer', fontSize: 11, color: 'var(--mac-text)' }}>
                      {dataSyncing === repo.name ? '\u23F3' : '\uD83D\uDCBE'} 数据
                    </button>
                    <button onClick={() => handleOpenDeploy(repo)} title="一键部署到 HF Space"
                      style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: 'var(--mac-accent)', color: '#fff', cursor: 'pointer', fontSize: 11 }}>
                      {'\uD83D\uDE80'} 部署
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {activeTab === 'deploy' && (
        <div className="glass" style={{ padding: 24, borderRadius: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{'\uD83D\uDE80'} 一键部署到 HF Space</h3>
          <p style={{ fontSize: 13, color: 'var(--mac-text-secondary)', marginBottom: 16 }}>
            选择要部署的仓库，自动检测项目类型并生成 Dockerfile，一键部署到 HuggingFace Space。
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(repos || []).map((repo, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px', borderRadius: 10, background: 'var(--mac-bg)',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{repo.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                    {repo.language || 'Unknown'} {'\u2B50'} {repo.stargazers_count || 0}
                  </div>
                </div>
                <button onClick={() => handleOpenDeploy(repo)}
                  style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: 'var(--mac-accent)', color: '#fff', cursor: 'pointer', fontSize: 12 }}>
                  {'\uD83D\uDE80'} 部署
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 部署对话框 */}
      {deployDialog && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setDeployDialog(null)}>
          <div className="glass" style={{
            padding: 24, borderRadius: 16, maxWidth: 480, width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{'\uD83D\uDE80'} 部署到 HF Space</h3>
            <p style={{ fontSize: 12, color: 'var(--mac-text-secondary)', marginBottom: 16 }}>
              {deployDialog.full_name || deployDialog.name}
            </p>

            {/* 检测结果 */}
            {detectResult && (
              <div style={{
                padding: 12, borderRadius: 8, background: 'var(--mac-bg)',
                marginBottom: 16, fontSize: 12,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{'\uD83D\uDD0D'} 检测结果</div>
                <div style={{ color: 'var(--mac-text-secondary)' }}>
                  类型: <span style={{ color: 'var(--mac-accent)', fontWeight: 600 }}>{detectResult.framework || detectResult.type}</span>
                  {detectResult.has_dockerfile && ' \u00B7 已有 Dockerfile'}
                </div>
              </div>
            )}

            {/* 表单 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>HF Space 名称</label>
              <input
                value={deployForm.hf_space_name}
                onChange={e => setDeployForm(prev => ({ ...prev, hf_space_name: e.target.value }))}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--mac-border)',
                  background: 'var(--mac-bg)', color: 'var(--mac-text)', fontSize: 13, outline: 'none',
                  boxSizing: 'border-box',
                }}
                placeholder="my-awesome-project"
              />
              <div style={{ fontSize: 11, color: 'var(--mac-text-secondary)', marginTop: 2 }}>
                部署地址: huggingface.co/spaces/HF_USER/{deployForm.hf_space_name}
              </div>
            </div>

            {/* 部署状态 */}
            {deployStatus === 'started' && (
              <div style={{ padding: 12, borderRadius: 8, background: 'rgba(0,122,255,0.1)', marginBottom: 16, fontSize: 12, textAlign: 'center' }}>
                {'\u23F3'} 正在部署中，请稍候...
              </div>
            )}
            {deployStatus === 'completed' && (
              <div style={{ padding: 12, borderRadius: 8, background: 'rgba(52,199,89,0.1)', marginBottom: 16, fontSize: 12, textAlign: 'center' }}>
                {'\u2705'} 部署成功！
                <a href={`https://huggingface.co/spaces/HF_USER/${deployForm.hf_space_name}`}
                   target="_blank" rel="noopener noreferrer"
                   style={{ color: 'var(--mac-accent)', marginLeft: 8 }}>
                  打开 Space {'\u2192'}
                </a>
              </div>
            )}
            {deployStatus === 'error' && (
              <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,59,48,0.1)', marginBottom: 16, fontSize: 12, textAlign: 'center', color: '#ff3b30' }}>
                {'\u274C'} 部署失败，请重试
              </div>
            )}

            {/* 按钮 */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeployDialog(null)}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--mac-border)', background: 'transparent', color: 'var(--mac-text)', cursor: 'pointer', fontSize: 13 }}>
                取消
              </button>
              <button onClick={handleDeploy} disabled={deployStatus === 'deploying' || deployStatus === 'started' || !deployForm.hf_space_name}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: (deployStatus === 'deploying' || deployStatus === 'started') ? 'var(--mac-border)' : 'var(--mac-accent)',
                  color: '#fff', cursor: (deployStatus === 'deploying' || deployStatus === 'started') ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 500,
                }}>
                {deployStatus === 'deploying' ? '\u23F3 部署中...' : deployStatus === 'started' ? '\u23F3 等待中...' : '\uD83D\uDE80 开始部署'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
