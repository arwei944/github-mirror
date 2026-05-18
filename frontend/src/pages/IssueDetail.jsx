import { useState, useEffect, useCallback } from 'react'
import { Icon } from '../App'
import api from '../api'
import { timeAgo } from '../utils/timeAgo'

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

const LOCK_REASONS = [
  { value: 'resolved', label: '已解决' },
  { value: 'off-topic', label: '偏离主题' },
  { value: 'too heated', label: '过于激烈' },
  { value: 'spam', label: '垃圾信息' },
]

const TIMELINE_EVENT_MAP = {
  closed: { icon: 'x', label: '关闭了此 Issue' },
  reopened: { icon: 'refresh', label: '重新打开了此 Issue' },
  subscribed: { icon: 'watch', label: '订阅了此 Issue' },
  merged: { icon: 'gitBranch', label: '合并了' },
  referenced: { icon: 'code', label: '引用了此 Issue' },
  mentioned: { icon: 'users', label: '提到了此 Issue' },
  assigned: { icon: 'users', label: '被指派' },
  unassigned: { icon: 'users', label: '取消指派' },
  labeled: { icon: 'tag', label: '添加了标签' },
  unlabeled: { icon: 'tag', label: '移除了标签' },
  milestoned: { icon: 'tag', label: '设置了里程碑' },
  demilestoned: { icon: 'tag', label: '移除了里程碑' },
  renamed: { icon: 'code', label: '重命名了此 Issue' },
  locked: { icon: 'lock', label: '锁定了此 Issue' },
  unlocked: { icon: 'lock', label: '解锁了此 Issue' },
  head_ref_deleted: { icon: 'delete', label: '删除了分支' },
  head_ref_restored: { icon: 'refresh', label: '恢复了分支' },
  review_requested: { icon: 'users', label: '请求审查' },
  review_request_removed: { icon: 'users', label: '取消审查请求' },
  'cross-referenced': { icon: 'code', label: '交叉引用了此 Issue' },
  committed: { icon: 'commit', label: '提交了' },
  commented: { icon: 'create', label: '发表了评论' },
  reviewed: { icon: 'users', label: '审查了' },
  line_commented: { icon: 'create', label: '发表了行评论' },
}

export default function IssueDetail({ repoName, issueNumber, onBack }) {
  const [issue, setIssue] = useState(null)
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [togglingState, setTogglingState] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [lockReason, setLockReason] = useState('resolved')
  const [locking, setLocking] = useState(false)
  const [activeTab, setActiveTab] = useState('comments')
  const [timeline, setTimeline] = useState([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editBody, setEditBody] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState(null)
  const [reactions, setReactions] = useState([])
  const [reactionsLoading, setReactionsLoading] = useState(false)
  const [togglingReaction, setTogglingReaction] = useState({})

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

  const loadReactions = useCallback(() => {
    setReactionsLoading(true)
    api.get(`/api/github/repos/${repoName}/issues/${issueNumber}/reactions`)
      .then(data => { setReactions(Array.isArray(data) ? data : []); setReactionsLoading(false) })
      .catch(() => { setReactions([]); setReactionsLoading(false) })
  }, [repoName, issueNumber])

  useEffect(() => { loadReactions() }, [loadReactions])

  const REACTION_EMOJIS = ['+1', '-1', 'laugh', 'rocket', 'heart', 'eyes']
  const REACTION_DISPLAY = { '+1': '\u{1F44D}', '-1': '\u{1F44E}', laugh: '\u{1F389}', rocket: '\u{1F680}', heart: '\u2764\uFE0F', eyes: '\u{1F440}' }

  const getReactionCounts = () => {
    const counts = {}
    const userReactions = new Set()
    reactions.forEach(r => {
      counts[r.content] = (counts[r.content] || 0) + 1
      if (r.user?.login) {
        // Track which reactions the current user has (we'll check via a simple heuristic)
        // Since we don't have current user info, we highlight all reactions
      }
    })
    return { counts, userReactions }
  }

  const handleToggleReaction = async (content) => {
    setTogglingReaction(prev => ({ ...prev, [content]: true }))
    try {
      const existing = reactions.find(r => r.content === content)
      if (existing) {
        await api.del(`/api/github/repos/${repoName}/issues/${issueNumber}/reactions/${existing.id}`)
        setReactions(prev => prev.filter(r => !(r.content === content && r.id === existing.id)))
      } else {
        await api.post(`/api/github/repos/${repoName}/issues/${issueNumber}/reactions`, { content })
        loadReactions()
      }
    } catch (err) {
      // ignore
    } finally {
      setTogglingReaction(prev => ({ ...prev, [content]: false }))
    }
  }

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

  const handleToggleLock = async () => {
    if (!issue) return
    setLocking(true)
    try {
      if (isLocked) {
        await api.del(`/api/github/repos/${repoName}/issues/${issueNumber}/lock`)
        setIsLocked(false)
      } else {
        await api.put(`/api/github/repos/${repoName}/issues/${issueNumber}/lock`, { lock_reason: lockReason })
        setIsLocked(true)
      }
    } catch (err) {
      // ignore
    } finally {
      setLocking(false)
    }
  }

  const handleEditComment = (comment) => {
    setEditingCommentId(comment.id)
    setEditBody(comment.body || '')
  }

  const handleSaveEdit = async (commentId) => {
    if (!editBody.trim()) return
    setSavingEdit(true)
    try {
      await api.patch(`/api/github/repos/${repoName}/issues/comments/${commentId}`, { body: editBody.trim() })
      setEditingCommentId(null)
      setEditBody('')
      const cmts = await api.get(`/api/github/repos/${repoName}/issues/${issueNumber}/comments`)
      setComments(cmts || [])
    } catch (err) {
      // ignore
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('确定要删除这条评论吗？此操作不可撤销。')) return
    setDeletingCommentId(commentId)
    try {
      await api.del(`/api/github/repos/${repoName}/issues/comments/${commentId}`)
      setComments(prev => prev.filter(c => c.id !== commentId))
    } catch (err) {
      // ignore
    } finally {
      setDeletingCommentId(null)
    }
  }

  const loadTimeline = useCallback(() => {
    setTimelineLoading(true)
    api.get(`/api/github/repos/${repoName}/issues/${issueNumber}/timeline`)
      .then(data => {
        setTimeline(data || [])
        setTimelineLoading(false)
      })
      .catch(() => {
        setTimeline([])
        setTimelineLoading(false)
      })
  }, [repoName, issueNumber])

  useEffect(() => {
    if (activeTab === 'timeline' && timeline.length === 0 && !timelineLoading) {
      loadTimeline()
    }
  }, [activeTab, timeline.length, timelineLoading, loadTimeline])

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
          {!isLocked && (
            <select
              value={lockReason}
              onChange={e => setLockReason(e.target.value)}
              style={{
                padding: '4px 8px', borderRadius: 6, border: '1px solid var(--mac-border)',
                background: 'var(--mac-bg)', fontSize: 11, color: 'var(--mac-text)',
                outline: 'none', cursor: 'pointer',
              }}
            >
              {LOCK_REASONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          )}
          <button
            className="btn-secondary"
            onClick={handleToggleLock}
            disabled={locking}
            style={{
              display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '4px 12px',
              color: isLocked ? 'var(--mac-green)' : 'var(--mac-orange)',
            }}
          >
            {Icon.lock(12)} {locking ? '处理中...' : (isLocked ? '解锁' : '锁定')}
          </button>
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

        {/* Reactions Bar */}
        <div className="glass" style={{ padding: '10px 16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {REACTION_EMOJIS.map(content => {
              const { counts } = getReactionCounts()
              const count = counts[content] || 0
              const hasReaction = reactions.some(r => r.content === content)
              return (
                <button
                  key={content}
                  onClick={() => handleToggleReaction(content)}
                  disabled={togglingReaction[content]}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', borderRadius: 12, border: '1px solid',
                    borderColor: hasReaction ? 'var(--mac-accent)' : 'var(--mac-border)',
                    background: hasReaction ? 'rgba(0,113,227,0.08)' : 'transparent',
                    cursor: 'pointer', fontSize: 13, lineHeight: 1,
                    transition: 'all 0.15s',
                  }}
                  title={content}
                >
                  <span>{REACTION_DISPLAY[content]}</span>
                  {count > 0 && (
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: hasReaction ? 'var(--mac-accent)' : 'var(--mac-text-secondary)',
                    }}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 0 }}>
          <button
            className={`detail-tab ${activeTab === 'comments' ? 'active' : ''}`}
            onClick={() => setActiveTab('comments')}
          >
            评论 ({comments.length})
          </button>
          <button
            className={`detail-tab ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            时间线
          </button>
        </div>

        <div className="glass detail-tab-content">
          {/* Comments tab */}
          {activeTab === 'comments' && (
            <div>
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
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                          {editingCommentId !== comment.id && (
                            <>
                              <button
                                className="btn-icon"
                                onClick={() => handleEditComment(comment)}
                                title="编辑"
                                style={{ fontSize: 11, padding: '2px 6px' }}
                              >
                                {Icon.code(12)}
                              </button>
                              <button
                                className="btn-icon"
                                onClick={() => handleDeleteComment(comment.id)}
                                disabled={deletingCommentId === comment.id}
                                title="删除"
                                style={{ fontSize: 11, padding: '2px 6px', color: 'var(--mac-red)' }}
                              >
                                {deletingCommentId === comment.id ? '...' : Icon.trash(12)}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {editingCommentId === comment.id ? (
                        <div>
                          <textarea
                            value={editBody}
                            onChange={e => setEditBody(e.target.value)}
                            rows={4}
                            style={{
                              width: '100%', padding: '8px 12px', borderRadius: 8,
                              border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
                              fontSize: 13, color: 'var(--mac-text)', outline: 'none',
                              resize: 'vertical', fontFamily: 'inherit', marginBottom: 8,
                            }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                            <button
                              className="btn-secondary"
                              onClick={() => { setEditingCommentId(null); setEditBody('') }}
                              style={{ fontSize: 11, padding: '3px 10px' }}
                            >
                              取消
                            </button>
                            <button
                              className="btn-primary"
                              onClick={() => handleSaveEdit(comment.id)}
                              disabled={savingEdit || !editBody.trim()}
                              style={{ fontSize: 11, padding: '3px 10px' }}
                            >
                              {savingEdit ? '保存中...' : '保存'}
                            </button>
                          </div>
                        </div>
                      ) : comment.body_html ? (
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
          )}

          {/* Timeline tab */}
          {activeTab === 'timeline' && (
            timelineLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, color: 'var(--mac-text-secondary)', gap: 8 }}>
                <span style={{ animation: 'pulse-dot 1s infinite' }}>&#9679;</span> 加载时间线中...
              </div>
            ) : timeline.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--mac-text-secondary)' }}>暂无时间线事件</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {timeline.map((event, idx) => {
                  const evtType = event.event || 'unknown'
                  const evtInfo = TIMELINE_EVENT_MAP[evtType] || { icon: 'activity', label: evtType }
                  const iconSize = 14
                  const iconEl = (Icon[evtInfo.icon] || Icon.activity)(iconSize)
                  return (
                    <div key={event.id || idx} className="glass" style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {event.actor && event.actor.avatar_url && (
                          <img src={event.actor.avatar_url} alt="" style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0 }} />
                        )}
                        <span style={{ color: 'var(--mac-text-secondary)', flexShrink: 0 }}>{iconEl}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                          {event.actor?.login || '未知用户'}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--mac-text)', flex: 1 }}>
                          {evtInfo.label}
                          {event.commit_id && (
                            <code style={{ fontSize: 11, marginLeft: 4, padding: '1px 5px', borderRadius: 4, background: 'var(--mac-gray)' }}>
                              {event.commit_id.slice(0, 7)}
                            </code>
                          )}
                          {event.label && (
                            <span style={{ fontSize: 11, marginLeft: 4, padding: '1px 6px', borderRadius: 10, background: 'var(--mac-gray)', color: 'var(--mac-text-secondary)' }}>
                              {event.label.name || event.label}
                            </span>
                          )}
                          {event.source && event.source.issue && (
                            <span style={{ fontSize: 11, marginLeft: 4, color: 'var(--mac-accent)' }}>
                              #{event.source.issue.number}
                            </span>
                          )}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)', flexShrink: 0 }}>
                          {timeAgo(event.created_at)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
