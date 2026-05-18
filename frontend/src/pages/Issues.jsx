import { useState, useEffect, useMemo } from 'react'
import { Icon } from '../App'
import api from '../api'
import { timeAgo } from '../utils/timeAgo'

const STATE_OPTIONS = [
  { key: 'open', label: '待处理' },
  { key: 'closed', label: '已关闭' },
  { key: 'all', label: '全部' },
]

function LabelBadge({ label }) {
  if (!label) return null
  const color = label.color || '86868b'
  const isDark = parseInt(color, 16) > 0xffffff / 2
  const textColor = isDark ? '#000' : '#fff'
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 7px',
        borderRadius: 10,
        fontSize: 10,
        fontWeight: 500,
        background: `#${color}`,
        color: textColor,
        lineHeight: '18px',
      }}
    >
      {label.name}
    </span>
  )
}

function CreateIssueModal({ repoName, labels, milestones, onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [selectedLabels, setSelectedLabels] = useState([])
  const [milestone, setMilestone] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim()) return
    setSubmitting(true)
    try {
      const payload = { title: title.trim(), body: body.trim() }
      if (selectedLabels.length > 0) {
        payload.labels = selectedLabels
      }
      if (milestone) {
        payload.milestone = parseInt(milestone, 10)
      }
      await api.post(`/api/github/repos/${repoName}/issues`, payload)
      onCreated()
    } catch (err) {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }

  const toggleLabel = (name) => {
    setSelectedLabels(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
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
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>新建 Issue</h2>
          <button className="btn-icon" onClick={onClose}>{Icon.back(16)}</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)', display: 'block', marginBottom: 4 }}>标题</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Issue 标题"
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
                fontSize: 13, color: 'var(--mac-text)', outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)', display: 'block', marginBottom: 4 }}>内容</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="描述 Issue 的详细内容..."
              rows={6}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
                fontSize: 13, color: 'var(--mac-text)', outline: 'none',
                resize: 'vertical', fontFamily: 'inherit',
              }}
            />
          </div>

          {labels && labels.length > 0 && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)', display: 'block', marginBottom: 4 }}>标签</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {labels.map(l => (
                  <span
                    key={l.name}
                    onClick={() => toggleLabel(l.name)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      padding: '2px 8px', borderRadius: 10, fontSize: 10,
                      fontWeight: 500, cursor: 'pointer', transition: 'opacity 0.15s',
                      background: `#${l.color}`,
                      color: parseInt(l.color, 16) > 0xffffff / 2 ? '#000' : '#fff',
                      opacity: selectedLabels.includes(l.name) ? 1 : 0.4,
                      border: selectedLabels.includes(l.name) ? '2px solid var(--mac-accent)' : '2px solid transparent',
                    }}
                  >
                    {l.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {milestones && milestones.length > 0 && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)', display: 'block', marginBottom: 4 }}>里程碑</label>
              <select
                value={milestone}
                onChange={e => setMilestone(e.target.value)}
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 8,
                  border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
                  fontSize: 12, color: 'var(--mac-text)', outline: 'none',
                }}
              >
                <option value="">无</option>
                {milestones.map(m => (
                  <option key={m.number} value={m.number}>{m.title}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button className="btn-secondary" onClick={onClose}>取消</button>
            <button className="btn-primary" onClick={handleSubmit} disabled={!title.trim() || submitting}>
              {submitting ? '创建中...' : '创建 Issue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Issues({ githubRepos, onSelectIssue }) {
  const [selectedRepo, setSelectedRepo] = useState('')
  const [stateFilter, setStateFilter] = useState('open')
  const [search, setSearch] = useState('')
  const [issues, setIssues] = useState([])
  const [labels, setLabels] = useState([])
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const repoName = selectedRepo || (githubRepos.length > 0 ? githubRepos[0].name : '')

  useEffect(() => {
    if (!repoName) return
    setLoading(true)
    Promise.all([
      api.get(`/api/github/repos/${repoName}/issues?state=${stateFilter}`).catch(() => []),
      api.get(`/api/github/repos/${repoName}/labels`).catch(() => []),
      api.get(`/api/github/repos/${repoName}/milestones`).catch(() => []),
    ]).then(([iss, lbl, ms]) => {
      setIssues(iss || [])
      setLabels(lbl || [])
      setMilestones(ms || [])
      setLoading(false)
    })
  }, [repoName, stateFilter])

  const filtered = useMemo(() => {
    if (!search) return issues
    const q = search.toLowerCase()
    return issues.filter(i =>
      i.title.toLowerCase().includes(q) ||
      (`#${i.number}`).includes(q)
    )
  }, [issues, search])

  const handleCreated = () => {
    setShowCreate(false)
    api.get(`/api/github/repos/${repoName}/issues?state=${stateFilter}`).then(data => {
      setIssues(data || [])
    })
  }

  return (
    <div>
      {/* Sort & Filter Bar */}
      <div className="sort-bar">
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

        <div style={{ width: 1, height: 16, background: 'var(--mac-border)' }} />

        {/* State filter */}
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

        {/* Search */}
        <div style={{ position: 'relative', marginRight: 8 }}>
          <input
            type="text"
            className="search-input"
            placeholder="搜索 Issue..."
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
          {Icon.plus(13)} 新建 Issue
        </button>
      </div>

      {/* Issue List */}
      <div className="card-grid-scroll">
        <div style={{ padding: '16px 24px 48px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--mac-text-secondary)', gap: 8 }}>
              <span style={{ animation: 'pulse-dot 1s infinite' }}>&#9679;</span> 加载中...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 64, color: 'var(--mac-text-secondary)' }}>
              <div style={{ fontSize: 36, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{Icon.issue(36)}</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>暂无 Issue</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>点击「新建 Issue」创建第一个</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filtered.map(issue => (
                <div
                  key={issue.number}
                  className="glass animate-fade-in"
                  style={{
                    padding: '12px 16px', cursor: 'pointer',
                    transition: 'box-shadow 0.15s, transform 0.15s',
                  }}
                  onClick={() => onSelectIssue && onSelectIssue(repoName, issue.number)}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--mac-shadow-lg)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--mac-shadow)'; e.currentTarget.style.transform = 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {/* State icon */}
                    <span style={{ flexShrink: 0, marginTop: 2, color: issue.state === 'open' ? 'var(--mac-green)' : 'var(--mac-red)' }}>
                      {Icon.issue(16)}
                    </span>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Title row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--mac-text)' }}>
                          {issue.title}
                        </span>
                        {issue.labels && issue.labels.map(l => (
                          <LabelBadge key={l.name} label={l} />
                        ))}
                      </div>

                      {/* Meta row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                        <span style={{ fontWeight: 500 }}>#{issue.number}</span>
                        {issue.user && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            {issue.user.avatar_url && (
                              <img src={issue.user.avatar_url} alt="" style={{ width: 16, height: 16, borderRadius: '50%' }} />
                            )}
                            {issue.user.login}
                          </span>
                        )}
                        <span>{timeAgo(issue.created_at)}</span>
                        {issue.comments > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            {Icon.activity(11)} {issue.comments}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreateIssueModal
          repoName={repoName}
          labels={labels}
          milestones={milestones}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
