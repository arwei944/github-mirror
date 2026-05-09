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

export default function IssueDetail({ repoName, issueNumber, onBack }) {
  const [issue, setIssue] = useState(null)
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [togglingState, setTogglingState] = useState(false)

  const loadIssue = () => {
    setLoading(true)
    Promise.all([
      api.get(`/api/github/repos/${repoName}/issues/${issueNumber}`),
      api.get(`/api/github/repos/${repoName}/issues/${issueNumber}/comments`),
    ]).then(([iss, cmts]) => {
      setIssue(iss)
      setComments(cmts || [])
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }

  useEffect(() => { loadIssue() }, [repoName, issueNumber])

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return
    setSubmittingComment(true)
    try {
      await api.post(`/api/github/repos/${repoName}/issues/${issueNumber}/comments`, {
        body: newComment.trim(),
      })
      setNewComment('')
      const cmts = await api.get(`/api/github/repos/${repoName}/issues/${issueNumber}/comments`)
      setComments(cmts || [])
    } catch (err) {
      // ignore
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleToggleState = async () => {
    if (!issue) return
    setTogglingState(true)
    try {
      const newState = issue.state === 'open' ? 'closed' : 'open'
      await api.patch(`/api/github/repos/${repoName}/issues/${issueNumber}`, { state: newState })
      const updated = await api.get(`/api/github/repos/${repoName}/issues/${issueNumber}`)
      if (updated) setIssue(updated)
    } catch (err) {
      // ignore
    } finally {
      setTogglingState(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--mac-text-secondary)', gap: 8 }}>
        <span style={{ animation: 'pulse-dot 1s infinite' }}>&#9679;</span> 加载中...
      </div>
    )
  }

  if (!issue) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--mac-text-secondary)' }}>
        Issue 不存在或加载失败
      </div>
    )
  }

  const isOpen = issue.state === 'open'

  return (
    <div className="detail-content animate-fade-in">
      {/* Header */}
      <div className="detail-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <button onClick={onBack} className="btn-icon" title="返回" style={{ flexShrink: 0 }}>
            {Icon.back(18)}
          </button>
          <span style={{ color: 'var(--mac-text-secondary)', flexShrink: 0 }}>{Icon.issue(18)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
                {issue.title}
              </h1>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                background: isOpen ? 'rgba(52,199,89,0.12)' : 'rgba(255,59,48,0.12)',
                color: isOpen ? 'var(--mac-green)' : 'var(--mac-red)',
              }}>
                {isOpen ? '待处理' : '已关闭'}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--mac-text-secondary)', margin: '4px 0 0' }}>
              #{issue.number} &middot; {timeAgo(issue.created_at)}
              {issue.user && ` 由 ${issue.user.login} 创建`}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            className="btn-secondary"
            onClick={handleToggleState}
            disabled={togglingState}
            style={{
              display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '4px 12px',
              color: isOpen ? 'var(--mac-red)' : 'var(--mac-green)',
            }}
          >
            {togglingState ? '处理中...' : (isOpen ? '关闭 Issue' : '重新打开')}
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="detail-scroll">
        {/* Labels, Milestone, Assignees */}
        <div className="glass" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12 }}>
            {/* Labels */}
            {issue.labels && issue.labels.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--mac-text-secondary)', fontWeight: 500 }}>标签</span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {issue.labels.map(l => <LabelBadge key={l.name} label={l} />)}
                </div>
              </div>
            )}

            {/* Milestone */}
            {issue.milestone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--mac-text-secondary)', fontWeight: 500 }}>里程碑</span>
                <span style={{
                  padding: '1px 8px', borderRadius: 6, fontSize: 11,
                  background: 'var(--mac-gray)', color: 'var(--mac-text)',
                }}>
                  {issue.milestone.title}
                </span>
              </div>
            )}

            {/* Assignees */}
            {issue.assignees && issue.assignees.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--mac-text-secondary)', fontWeight: 500 }}>负责人</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {issue.assignees.map(a => (
                    <img
                      key={a.login}
                      src={a.avatar_url}
                      alt={a.login}
                      title={a.login}
                      style={{ width: 22, height: 22, borderRadius: '50%' }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Issue body */}
        {issue.body_html ? (
          <div className="glass" style={{ padding: 20, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              {issue.user && issue.user.avatar_url && (
                <img src={issue.user.avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />
              )}
              <span style={{ fontSize: 13, fontWeight: 600 }}>{issue.user?.login || '未知用户'}</span>
              <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>{timeAgo(issue.created_at)}</span>
            </div>
            <div className="readme-body" dangerouslySetInnerHTML={{ __html: issue.body_html }} />
          </div>
        ) : issue.body ? (
          <div className="glass" style={{ padding: 20, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              {issue.user && issue.user.avatar_url && (
                <img src={issue.user.avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />
              )}
              <span style={{ fontSize: 13, fontWeight: 600 }}>{issue.user?.login || '未知用户'}</span>
              <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>{timeAgo(issue.created_at)}</span>
            </div>
            <div className="readme-body" style={{ whiteSpace: 'pre-wrap' }}>{issue.body}</div>
          </div>
        ) : null}

        {/* Comments */}
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--mac-text)' }}>
          评论 ({comments.length})
        </div>

        {comments.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {comments.map(comment => (
              <div key={comment.id} className="glass" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  {comment.user && comment.user.avatar_url && (
                    <img src={comment.user.avatar_url} alt="" style={{ width: 22, height: 22, borderRadius: '50%' }} />
                  )}
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{comment.user?.login || '未知用户'}</span>
                  <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>{timeAgo(comment.created_at)}</span>
                </div>
                {comment.body_html ? (
                  <div className="readme-body" dangerouslySetInnerHTML={{ __html: comment.body_html }} />
                ) : (
                  <div className="readme-body" style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{comment.body}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* New comment form */}
        <div className="glass" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)', marginBottom: 8 }}>
            添加评论
          </div>
          <textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="写下你的评论..."
            rows={4}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8,
              border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
              fontSize: 13, color: 'var(--mac-text)', outline: 'none',
              resize: 'vertical', fontFamily: 'inherit', marginBottom: 10,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn-primary"
              onClick={handleSubmitComment}
              disabled={!newComment.trim() || submittingComment}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {submittingComment ? '提交中...' : '提交评论'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
