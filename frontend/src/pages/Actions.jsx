import { useState, useEffect } from 'react'
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

  const tabItems = [
    { key: 'actions', label: 'Actions' },
    { key: 'releases', label: '发布' },
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
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {workflows.map(run => {
                  const statusInfo = getStatusInfo(run.status, run.conclusion)
                  return (
                    <div key={run.id} className="glass animate-fade-in" style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {/* Status dot */}
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
                      </div>
                    </div>
                  )
                })}
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
