import { useState, useEffect, useMemo } from 'react'
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

const STATE_OPTIONS = [
  { key: 'open', label: '待处理' },
  { key: 'closed', label: '已关闭' },
  { key: 'all', label: '全部' },
]

function getStateLabel(pr) {
  if (pr.state === 'open') return { text: '待处理', color: 'var(--mac-green)', bg: 'rgba(52,199,89,0.12)' }
  if (pr.merged_at) return { text: '已合并', color: 'var(--mac-accent)', bg: 'rgba(0,113,227,0.12)' }
  return { text: '已关闭', color: 'var(--mac-red)', bg: 'rgba(255,59,48,0.12)' }
}

function CreatePRModal({ repoName, branches, onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [head, setHead] = useState('')
  const [base, setBase] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim() || !head || !base) return
    setSubmitting(true)
    try {
      await api.post(`/api/github/repos/${repoName}/pulls`, {
        title: title.trim(),
        body: body.trim(),
        head,
        base,
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
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>新建 Pull Request</h2>
          <button className="btn-icon" onClick={onClose}>{Icon.back(16)}</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Branch selector */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)', display: 'block', marginBottom: 4 }}>源分支 (head)</label>
              <select
                value={head}
                onChange={e => setHead(e.target.value)}
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 8,
                  border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
                  fontSize: 12, color: 'var(--mac-text)', outline: 'none',
                }}
              >
                <option value="">选择分支</option>
                {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
              </select>
            </div>
            <span style={{ color: 'var(--mac-text-secondary)', marginTop: 16, fontSize: 18 }}>&rarr;</span>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)', display: 'block', marginBottom: 4 }}>目标分支 (base)</label>
              <select
                value={base}
                onChange={e => setBase(e.target.value)}
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 8,
                  border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
                  fontSize: 12, color: 'var(--mac-text)', outline: 'none',
                }}
              >
                <option value="">选择分支</option>
                {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)', display: 'block', marginBottom: 4 }}>标题</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="PR 标题"
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
              placeholder="描述 PR 的详细内容..."
              rows={5}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
                fontSize: 13, color: 'var(--mac-text)', outline: 'none',
                resize: 'vertical', fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button className="btn-secondary" onClick={onClose}>取消</button>
            <button className="btn-primary" onClick={handleSubmit} disabled={!title.trim() || !head || !base || submitting}>
              {submitting ? '创建中...' : '创建 PR'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Pulls({ githubRepos, onSelectPull }) {
  const [selectedRepo, setSelectedRepo] = useState('')
  const [stateFilter, setStateFilter] = useState('open')
  const [search, setSearch] = useState('')
  const [pulls, setPulls] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const repoName = selectedRepo || (githubRepos.length > 0 ? githubRepos[0].name : '')

  useEffect(() => {
    if (!repoName) return
    setLoading(true)
    Promise.all([
      api.get(`/api/github/repos/${repoName}/pulls?state=${stateFilter}`).catch(() => []),
      api.get(`/api/github/repos/${repoName}/branches`).catch(() => []),
    ]).then(([prList, brList]) => {
      setPulls(prList || [])
      setBranches(brList || [])
      setLoading(false)
    })
  }, [repoName, stateFilter])

  const filtered = useMemo(() => {
    if (!search) return pulls
    const q = search.toLowerCase()
    return pulls.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (`#${p.number}`).includes(q) ||
      (p.head?.ref || '').toLowerCase().includes(q) ||
      (p.base?.ref || '').toLowerCase().includes(q)
    )
  }, [pulls, search])

  const handleCreated = () => {
    setShowCreate(false)
    api.get(`/api/github/repos/${repoName}/pulls?state=${stateFilter}`).then(data => {
      setPulls(data || [])
    })
  }

  return (
    <div>
      {/* Sort & Filter Bar */}
      <div className="sort-bar">
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

        <div style={{ width: 1, height: 16, background: 'var(--mac-border)' }} />

        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {STATE_OPTIONS.map(opt => (
            <button
              key={opt.key}
              className={`filter-btn ${stateFilter === opt.key ? 'active' : ''}`}
              onClick={() => setStateFilter(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ position: 'relative', marginRight: 8 }}>
          <input
            type="text"
            className="search-input"
            placeholder="搜索 PR..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--mac-text-secondary)' }}>
            {Icon.search(13)}
          </span>
        </div>

        <button
          className="btn-primary"
          onClick={() => setShowCreate(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        >
          {Icon.plus(13)} 新建 PR
        </button>
      </div>

      {/* PR List */}
      <div className="card-grid-scroll">
        <div style={{ padding: '16px 24px 48px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--mac-text-secondary)', gap: 8 }}>
              <span style={{ animation: 'pulse-dot 1s infinite' }}>&#9679;</span> 加载中...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 64, color: 'var(--mac-text-secondary)' }}>
              <div style={{ fontSize: 36, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{Icon.pr(36)}</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>暂无 Pull Request</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>点击「新建 PR」创建第一个</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filtered.map(pr => {
                const stateInfo = getStateLabel(pr)
                return (
                  <div
                    key={pr.number}
                    className="glass animate-fade-in"
                    style={{
                      padding: '12px 16px', cursor: 'pointer',
                      transition: 'box-shadow 0.15s, transform 0.15s',
                    }}
                    onClick={() => onSelectPull && onSelectPull(repoName, pr.number)}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--mac-shadow-lg)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--mac-shadow)'; e.currentTarget.style.transform = 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ flexShrink: 0, marginTop: 2, color: stateInfo.color }}>
                        {Icon.pr(16)}
                      </span>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--mac-text)' }}>
                            {pr.title}
                          </span>
                          <span style={{
                            fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 600,
                            background: stateInfo.bg, color: stateInfo.color,
                          }}>
                            {stateInfo.text}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                          <span style={{ fontWeight: 500 }}>#{pr.number}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{pr.head?.ref || '?'}</span>
                            <span>&rarr;</span>
                            <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{pr.base?.ref || '?'}</span>
                          </span>
                          {pr.user && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              {pr.user.avatar_url && (
                                <img src={pr.user.avatar_url} alt="" style={{ width: 16, height: 16, borderRadius: '50%' }} />
                              )}
                              {pr.user.login}
                            </span>
                          )}
                          <span>{timeAgo(pr.created_at)}</span>
                        </div>

                        {/* Additions / Deletions */}
                        {(pr.additions !== undefined || pr.deletions !== undefined) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 11 }}>
                            {pr.additions !== undefined && pr.additions > 0 && (
                              <span style={{ color: 'var(--mac-green)', fontFamily: 'monospace' }}>+{pr.additions}</span>
                            )}
                            {pr.deletions !== undefined && pr.deletions > 0 && (
                              <span style={{ color: 'var(--mac-red)', fontFamily: 'monospace' }}>-{pr.deletions}</span>
                            )}
                            {pr.changed_files !== undefined && (
                              <span style={{ color: 'var(--mac-text-secondary)' }}>
                                {pr.changed_files} 个文件变更
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreatePRModal
          repoName={repoName}
          branches={branches}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
