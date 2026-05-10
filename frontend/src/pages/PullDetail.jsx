import { useState, useEffect, useCallback } from 'react'
import { Icon } from '../App'
import api from '../api'
import DiffViewer from '../components/DiffViewer'

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

function getStateLabel(pr) {
  if (pr.state === 'open') return { text: '待处理', color: 'var(--mac-green)', bg: 'rgba(52,199,89,0.12)' }
  if (pr.merged_at) return { text: '已合并', color: 'var(--mac-accent)', bg: 'rgba(0,113,227,0.12)' }
  return { text: '已关闭', color: 'var(--mac-red)', bg: 'rgba(255,59,48,0.12)' }
}

function ChangedFile({ file }) {
  const [expanded, setExpanded] = useState(false)
  const additions = file.additions || 0
  const deletions = file.deletions || 0
  const changes = file.changes || 0

  return (
    <div style={{ marginBottom: 4 }}>
      <div
        className="detail-row"
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer' }}
      >
        <span style={{
          padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
          background: file.status === 'added' ? 'rgba(52,199,89,0.12)' : file.status === 'removed' ? 'rgba(255,59,48,0.12)' : 'rgba(0,113,227,0.12)',
          color: file.status === 'added' ? 'var(--mac-green)' : file.status === 'removed' ? 'var(--mac-red)' : 'var(--mac-accent)',
          flexShrink: 0,
        }}>
          {file.status === 'added' ? '新增' : file.status === 'removed' ? '删除' : file.status === 'modified' ? '修改' : file.status === 'renamed' ? '重命名' : file.status}
        </span>
        <span style={{ flex: 1, fontSize: 12, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file.filename}
        </span>
        <span style={{ fontSize: 10, color: 'var(--mac-green)', fontFamily: 'monospace', flexShrink: 0 }}>+{additions}</span>
        <span style={{ fontSize: 10, color: 'var(--mac-red)', fontFamily: 'monospace', flexShrink: 0 }}>-{deletions}</span>
      </div>

      {expanded && file.patch && (
        <div style={{
          background: 'var(--mac-bg)', borderRadius: 8, padding: '10px 14px',
          fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
          fontSize: 11, lineHeight: 1.6, overflowX: 'auto', maxHeight: 300,
          overflowY: 'auto', marginTop: 2, marginBottom: 4,
        }}>
          {file.patch.split('\n').map((line, i) => {
            let bgColor = 'transparent'
            let color = 'var(--mac-text)'
            if (line.startsWith('+')) { bgColor = 'rgba(52,199,89,0.1)'; color = 'var(--mac-green)' }
            else if (line.startsWith('-')) { bgColor = 'rgba(255,59,48,0.1)'; color = 'var(--mac-red)' }
            else if (line.startsWith('@@')) { color = 'var(--mac-accent)' }
            return (
              <div key={i} style={{ background: bgColor, color, whiteSpace: 'pre', paddingLeft: 4 }}>
                {line}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function PullDetail({ repoName, pullNumber, onBack }) {
  const [pr, setPr] = useState(null)
  const [comments, setComments] = useState([])
  const [reviews, setReviews] = useState([])
  const [changedFiles, setChangedFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [merging, setMerging] = useState(false)
  const [mergeMethod, setMergeMethod] = useState('merge')
  const [tab, setTab] = useState('details')
  const [commits, setCommits] = useState([])
  const [commitsLoading, setCommitsLoading] = useState(false)
  const [reviewComments, setReviewComments] = useState([])
  const [reviewCommentsLoading, setReviewCommentsLoading] = useState(false)
  const [newReviewComment, setNewReviewComment] = useState('')
  const [newReviewPath, setNewReviewPath] = useState('')
  const [submittingReviewComment, setSubmittingReviewComment] = useState(false)
  const [editingReviewId, setEditingReviewId] = useState(null)
  const [editReviewBody, setEditReviewBody] = useState('')
  const [savingReviewEdit, setSavingReviewEdit] = useState(false)
  const [updatingBranch, setUpdatingBranch] = useState(false)
  const [autoMerge, setAutoMerge] = useState(null)
  const [autoMergeLoading, setAutoMergeLoading] = useState(false)
  const [reactions, setReactions] = useState([])
  const [reactionsLoading, setReactionsLoading] = useState(false)
  const [togglingReaction, setTogglingReaction] = useState({})

  const loadPR = () => {
    setLoading(true)
    Promise.all([
      api.get(`/api/github/repos/${repoName}/pulls/${pullNumber}`),
      api.get(`/api/github/repos/${repoName}/pulls/${pullNumber}/comments`),
      api.get(`/api/github/repos/${repoName}/pulls/${pullNumber}/reviews`),
      api.get(`/api/github/repos/${repoName}/pulls/${pullNumber}/files`),
    ]).then(([pullData, cmts, revs, files]) => {
      setPr(pullData)
      setComments(cmts || [])
      setReviews(revs || [])
      setChangedFiles(files || [])
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }

  useEffect(() => { loadPR() }, [repoName, pullNumber])

  const loadReactions = useCallback(() => {
    setReactionsLoading(true)
    api.get(`/api/github/repos/${repoName}/issues/${pullNumber}/reactions`)
      .then(data => { setReactions(Array.isArray(data) ? data : []); setReactionsLoading(false) })
      .catch(() => { setReactions([]); setReactionsLoading(false) })
  }, [repoName, pullNumber])

  useEffect(() => { loadReactions() }, [loadReactions])

  const REACTION_EMOJIS = ['+1', '-1', 'laugh', 'rocket', 'heart', 'eyes']
  const REACTION_DISPLAY = { '+1': '\u{1F44D}', '-1': '\u{1F44E}', laugh: '\u{1F389}', rocket: '\u{1F680}', heart: '\u2764\uFE0F', eyes: '\u{1F440}' }

  const getReactionCounts = () => {
    const counts = {}
    reactions.forEach(r => {
      counts[r.content] = (counts[r.content] || 0) + 1
    })
    return counts
  }

  const handleToggleReaction = async (content) => {
    setTogglingReaction(prev => ({ ...prev, [content]: true }))
    try {
      const existing = reactions.find(r => r.content === content)
      if (existing) {
        await api.del(`/api/github/repos/${repoName}/issues/${pullNumber}/reactions/${existing.id}`)
        setReactions(prev => prev.filter(r => !(r.content === content && r.id === existing.id)))
      } else {
        await api.post(`/api/github/repos/${repoName}/issues/${pullNumber}/reactions`, { content })
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
      await api.post(`/api/github/repos/${repoName}/issues/${pullNumber}/comments`, {
        body: newComment.trim(),
      })
      setNewComment('')
      const cmts = await api.get(`/api/github/repos/${repoName}/pulls/${pullNumber}/comments`)
      setComments(cmts || [])
    } catch (err) {
      // ignore
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleMerge = async () => {
    if (!pr) return
    setMerging(true)
    try {
      await api.put(`/api/github/repos/${repoName}/pulls/${pullNumber}/merge?method=${mergeMethod}`)
      const updated = await api.get(`/api/github/repos/${repoName}/pulls/${pullNumber}`)
      if (updated) setPr(updated)
    } catch (err) {
      // ignore
    } finally {
      setMerging(false)
    }
  }

  const loadCommits = useCallback(() => {
    setCommitsLoading(true)
    api.get(`/api/github/repos/${repoName}/pulls/${pullNumber}/commits`)
      .then(data => { setCommits(data || []); setCommitsLoading(false) })
      .catch(() => { setCommits([]); setCommitsLoading(false) })
  }, [repoName, pullNumber])

  const loadReviewComments = useCallback(() => {
    setReviewCommentsLoading(true)
    api.get(`/api/github/repos/${repoName}/pulls/${pullNumber}/comments`)
      .then(data => { setReviewComments(data || []); setReviewCommentsLoading(false) })
      .catch(() => { setReviewComments([]); setReviewCommentsLoading(false) })
  }, [repoName, pullNumber])

  useEffect(() => {
    if (tab === 'commits' && commits.length === 0 && !commitsLoading) loadCommits()
  }, [tab, commits.length, commitsLoading, loadCommits])

  useEffect(() => {
    if (tab === 'review-comments' && reviewComments.length === 0 && !reviewCommentsLoading) loadReviewComments()
  }, [tab, reviewComments.length, reviewCommentsLoading, loadReviewComments])

  const handleSubmitReviewComment = async () => {
    if (!newReviewComment.trim() || !newReviewPath.trim()) return
    setSubmittingReviewComment(true)
    try {
      await api.post(`/api/github/repos/${repoName}/pulls/${pullNumber}/comments`, {
        body: newReviewComment.trim(),
        path: newReviewPath.trim(),
        position: 1,
      })
      setNewReviewComment('')
      setNewReviewPath('')
      loadReviewComments()
    } catch (err) {
      // ignore
    } finally {
      setSubmittingReviewComment(false)
    }
  }

  const handleEditReviewComment = (rc) => {
    setEditingReviewId(rc.id)
    setEditReviewBody(rc.body || '')
  }

  const handleSaveReviewEdit = async (commentId) => {
    if (!editReviewBody.trim()) return
    setSavingReviewEdit(true)
    try {
      await api.patch(`/api/github/repos/${repoName}/pulls/${pullNumber}/comments/${commentId}`, { body: editReviewBody.trim() })
      setEditingReviewId(null)
      setEditReviewBody('')
      loadReviewComments()
    } catch (err) {
      // ignore
    } finally {
      setSavingReviewEdit(false)
    }
  }

  const handleDeleteReviewComment = async (commentId) => {
    if (!window.confirm('确定要删除这条审查评论吗？此操作不可撤销。')) return
    try {
      await api.del(`/api/github/repos/${repoName}/pulls/${pullNumber}/comments/${commentId}`)
      setReviewComments(prev => prev.filter(c => c.id !== commentId))
    } catch (err) {
      // ignore
    }
  }

  const handleUpdateBranch = async () => {
    if (!pr) return
    setUpdatingBranch(true)
    try {
      await api.put(`/api/github/repos/${repoName}/pulls/${pullNumber}/update-branch`)
      const updated = await api.get(`/api/github/repos/${repoName}/pulls/${pullNumber}`)
      if (updated) setPr(updated)
    } catch (err) {
      // ignore
    } finally {
      setUpdatingBranch(false)
    }
  }

  const loadAutoMerge = useCallback(() => {
    setAutoMergeLoading(true)
    api.get(`/api/github/repos/${repoName}/pulls/${pullNumber}/auto-merge`)
      .then(data => { setAutoMerge(data || null); setAutoMergeLoading(false) })
      .catch(() => { setAutoMerge(null); setAutoMergeLoading(false) })
  }, [repoName, pullNumber])

  useEffect(() => {
    if (tab === 'auto-merge') loadAutoMerge()
  }, [tab, loadAutoMerge])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--mac-text-secondary)', gap: 8 }}>
        <span style={{ animation: 'pulse-dot 1s infinite' }}>&#9679;</span> 加载中...
      </div>
    )
  }

  if (!pr) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--mac-text-secondary)' }}>
        Pull Request 不存在或加载失败
      </div>
    )
  }

  const stateInfo = getStateLabel(pr)
  const isOpen = pr.state === 'open'

  const tabs = [
    { key: 'details', label: '详情' },
    { key: 'files', label: `文件变更 (${changedFiles.length})` },
    { key: 'diff', label: '差异' },
    { key: 'commits', label: '提交' },
    { key: 'reviews', label: `审查 (${reviews.length})` },
    { key: 'review-comments', label: '审查评论' },
    { key: 'conversation', label: `评论 (${comments.length})` },
    { key: 'auto-merge', label: '自动合并' },
  ]

  return (
    <div className="detail-content animate-fade-in">
      {/* Header */}
      <div className="detail-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <button onClick={onBack} className="btn-icon" title="返回" style={{ flexShrink: 0 }}>
            {Icon.back(18)}
          </button>
          <span style={{ color: 'var(--mac-text-secondary)', flexShrink: 0 }}>{Icon.pr(18)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
                {pr.title}
              </h1>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                background: stateInfo.bg, color: stateInfo.color,
              }}>
                {stateInfo.text}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--mac-text-secondary)', margin: '4px 0 0' }}>
              #{pr.number} &middot; {timeAgo(pr.created_at)}
              {pr.user && ` 由 ${pr.user.login} 创建`}
            </p>
          </div>
        </div>

        {/* Merge controls */}
        {isOpen && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button
              className="btn-secondary"
              onClick={handleUpdateBranch}
              disabled={updatingBranch}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 12px' }}
            >
              {Icon.refresh(12)} {updatingBranch ? '更新中...' : '更新分支'}
            </button>
            <select
              value={mergeMethod}
              onChange={e => setMergeMethod(e.target.value)}
              style={{
                padding: '4px 8px', borderRadius: 6, border: '1px solid var(--mac-border)',
                background: 'var(--mac-bg)', fontSize: 11, color: 'var(--mac-text)',
                outline: 'none', cursor: 'pointer',
              }}
            >
              <option value="merge">合并</option>
              <option value="squash">压缩合并</option>
              <option value="rebase">变基合并</option>
            </select>
            <button
              className="btn-primary"
              onClick={handleMerge}
              disabled={merging}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 12px' }}
            >
              {Icon.gitBranch(13)} {merging ? '合并中...' : '合并 PR'}
            </button>
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="detail-scroll">
        {/* Branch info & Stats */}
        <div className="glass" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
            {/* Branch info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--mac-text-secondary)', fontSize: 12 }}>分支</span>
              <code style={{
                fontFamily: 'monospace', fontSize: 12, padding: '2px 8px',
                borderRadius: 6, background: 'var(--mac-gray)',
              }}>
                {pr.head?.ref || '?'}
              </code>
              <span style={{ color: 'var(--mac-text-secondary)' }}>&rarr;</span>
              <code style={{
                fontFamily: 'monospace', fontSize: 12, padding: '2px 8px',
                borderRadius: 6, background: 'var(--mac-gray)',
              }}>
                {pr.base?.ref || '?'}
              </code>
            </div>

            <div style={{ width: 1, height: 20, background: 'var(--mac-border)' }} />

            {/* Stats */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
              {pr.additions !== undefined && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--mac-green)' }}>
                  <span style={{ fontFamily: 'monospace' }}>+{pr.additions}</span> 新增
                </span>
              )}
              {pr.deletions !== undefined && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--mac-red)' }}>
                  <span style={{ fontFamily: 'monospace' }}>-{pr.deletions}</span> 删除
                </span>
              )}
              {pr.changed_files !== undefined && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--mac-text-secondary)' }}>
                  {pr.changed_files} 个文件
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Reactions Bar */}
        <div className="glass" style={{ padding: '10px 16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {REACTION_EMOJIS.map(content => {
              const counts = getReactionCounts()
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
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`detail-tab ${tab === t.key ? 'active' : ''}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="glass detail-tab-content">
          {/* Details tab */}
          {tab === 'details' && (
            pr.body_html ? (
              <div className="readme-body" dangerouslySetInnerHTML={{ __html: pr.body_html }} />
            ) : pr.body ? (
              <div className="readme-body" style={{ whiteSpace: 'pre-wrap' }}>{pr.body}</div>
            ) : (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--mac-text-secondary)' }}>暂无描述</div>
            )
          )}

          {/* Files tab */}
          {tab === 'files' && (
            changedFiles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--mac-text-secondary)' }}>暂无文件变更</div>
            ) : (
              <div>
                {changedFiles.map(file => (
                  <ChangedFile key={file.filename} file={file} />
                ))}
              </div>
            )
          )}

          {/* Diff tab */}
          {tab === 'diff' && (
            <div style={{ height: 500 }}>
              <DiffViewer repoName={repoName} pullNumber={pullNumber} />
            </div>
          )}

          {/* Reviews tab */}
          {tab === 'reviews' && (
            reviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--mac-text-secondary)' }}>暂无审查记录</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {reviews.map(review => {
                  const reviewStateMap = {
                    approved: { text: '已批准', color: 'var(--mac-green)', bg: 'rgba(52,199,89,0.12)' },
                    changes_requested: { text: '需要修改', color: 'var(--mac-red)', bg: 'rgba(255,59,48,0.12)' },
                    commented: { text: '已评论', color: 'var(--mac-text-secondary)', bg: 'var(--mac-gray)' },
                    pending: { text: '待审查', color: 'var(--mac-orange)', bg: 'rgba(255,149,0,0.12)' },
                  }
                  const rs = reviewStateMap[review.state] || reviewStateMap.commented
                  return (
                    <div key={review.id} className="glass" style={{ padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        {review.user && review.user.avatar_url && (
                          <img src={review.user.avatar_url} alt="" style={{ width: 22, height: 22, borderRadius: '50%' }} />
                        )}
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{review.user?.login || '未知用户'}</span>
                        <span style={{
                          fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 600,
                          background: rs.bg, color: rs.color,
                        }}>
                          {rs.text}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)', marginLeft: 'auto' }}>
                          {timeAgo(review.submitted_at)}
                        </span>
                      </div>
                      {review.body && (
                        <div style={{ fontSize: 12, color: 'var(--mac-text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {review.body}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          )}

          {/* Commits tab */}
          {tab === 'commits' && (
            commitsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, color: 'var(--mac-text-secondary)', gap: 8 }}>
                <span style={{ animation: 'pulse-dot 1s infinite' }}>&#9679;</span> 加载提交中...
              </div>
            ) : commits.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--mac-text-secondary)' }}>暂无提交记录</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {commits.map(commit => (
                  <div key={commit.sha} className="glass" style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--mac-text-secondary)', flexShrink: 0 }}>{Icon.commit(14)}</span>
                      <code style={{
                        fontSize: 12, fontFamily: 'monospace', padding: '1px 6px', borderRadius: 4,
                        background: 'var(--mac-gray)', color: 'var(--mac-accent)', flexShrink: 0,
                      }}>
                        {commit.sha ? commit.sha.slice(0, 7) : '?'}
                      </code>
                      <span style={{ fontSize: 12, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {commit.commit?.message || commit.message || '无提交信息'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)', flexShrink: 0 }}>
                        {timeAgo(commit.commit?.author?.date || commit.commit?.committer?.date)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, marginLeft: 22, fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                      {commit.author && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          {commit.author.avatar_url && <img src={commit.author.avatar_url} alt="" style={{ width: 14, height: 14, borderRadius: '50%' }} />}
                          {commit.author.login || commit.commit?.author?.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Review Comments tab */}
          {tab === 'review-comments' && (
            reviewCommentsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, color: 'var(--mac-text-secondary)', gap: 8 }}>
                <span style={{ animation: 'pulse-dot 1s infinite' }}>&#9679;</span> 加载审查评论中...
              </div>
            ) : (
              <div>
                {reviewComments.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    {reviewComments.map(rc => (
                      <div key={rc.id} className="glass" style={{ padding: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          {rc.user && rc.user.avatar_url && (
                            <img src={rc.user.avatar_url} alt="" style={{ width: 20, height: 20, borderRadius: '50%' }} />
                          )}
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{rc.user?.login || '未知用户'}</span>
                          {rc.path && (
                            <code style={{ fontSize: 11, fontFamily: 'monospace', padding: '1px 5px', borderRadius: 4, background: 'var(--mac-gray)', color: 'var(--mac-text-secondary)' }}>
                              {rc.path}
                            </code>
                          )}
                          {rc.position !== undefined && (
                            <span style={{ fontSize: 10, color: 'var(--mac-text-secondary)' }}>行 {rc.position}</span>
                          )}
                          <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)', marginLeft: 'auto' }}>{timeAgo(rc.created_at)}</span>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {editingReviewId !== rc.id && (
                              <>
                                <button className="btn-icon" onClick={() => handleEditReviewComment(rc)} title="编辑" style={{ fontSize: 11, padding: '2px 6px' }}>
                                  {Icon.code(12)}
                                </button>
                                <button className="btn-icon" onClick={() => handleDeleteReviewComment(rc.id)} title="删除" style={{ fontSize: 11, padding: '2px 6px', color: 'var(--mac-red)' }}>
                                  {Icon.trash(12)}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {editingReviewId === rc.id ? (
                          <div>
                            <textarea
                              value={editReviewBody}
                              onChange={e => setEditReviewBody(e.target.value)}
                              rows={3}
                              style={{
                                width: '100%', padding: '8px 12px', borderRadius: 8,
                                border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
                                fontSize: 13, color: 'var(--mac-text)', outline: 'none',
                                resize: 'vertical', fontFamily: 'inherit', marginBottom: 8,
                              }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                              <button className="btn-secondary" onClick={() => { setEditingReviewId(null); setEditReviewBody('') }} style={{ fontSize: 11, padding: '3px 10px' }}>取消</button>
                              <button className="btn-primary" onClick={() => handleSaveReviewEdit(rc.id)} disabled={savingReviewEdit || !editReviewBody.trim()} style={{ fontSize: 11, padding: '3px 10px' }}>
                                {savingReviewEdit ? '保存中...' : '保存'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: 'var(--mac-text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                            {rc.body}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add review comment form */}
                <div className="glass" style={{ padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)', marginBottom: 8 }}>添加审查评论</div>
                  <input
                    type="text"
                    value={newReviewPath}
                    onChange={e => setNewReviewPath(e.target.value)}
                    placeholder="文件路径 (例如: src/index.js)"
                    style={{
                      width: '100%', padding: '6px 12px', borderRadius: 8,
                      border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
                      fontSize: 12, color: 'var(--mac-text)', outline: 'none',
                      fontFamily: 'monospace', marginBottom: 8,
                    }}
                  />
                  <textarea
                    value={newReviewComment}
                    onChange={e => setNewReviewComment(e.target.value)}
                    placeholder="写下你的审查评论..."
                    rows={3}
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
                      onClick={handleSubmitReviewComment}
                      disabled={!newReviewComment.trim() || !newReviewPath.trim() || submittingReviewComment}
                      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      {submittingReviewComment ? '提交中...' : '提交评论'}
                    </button>
                  </div>
                </div>
              </div>
            )
          )}

          {/* Conversation tab */}
          {tab === 'conversation' && (
            <div>
              {comments.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {comments.map(comment => (
                    <div key={comment.id} className="glass" style={{ padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        {comment.user && comment.user.avatar_url && (
                          <img src={comment.user.avatar_url} alt="" style={{ width: 22, height: 22, borderRadius: '50%' }} />
                        )}
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{comment.user?.login || '未知用户'}</span>
                        <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>{timeAgo(comment.created_at)}</span>
                      </div>
                      {comment.body ? (
                        <div style={{ fontSize: 12, color: 'var(--mac-text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {comment.body}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {/* New comment form */}
              <div className="glass" style={{ padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)', marginBottom: 8 }}>
                  添加评论
                </div>
                <textarea
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="写下你的评论..."
                  rows={3}
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

          {/* Auto-merge tab */}
          {tab === 'auto-merge' && (
            <div>
              {autoMergeLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, color: 'var(--mac-text-secondary)', gap: 8 }}>
                  <span style={{ animation: 'pulse-dot 1s infinite' }}>&#9679;</span> 加载中...
                </div>
              ) : autoMerge && autoMerge.enabled ? (
                <div className="glass" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{
                      fontSize: 12, padding: '2px 10px', borderRadius: 10, fontWeight: 600,
                      background: 'rgba(52,199,89,0.12)', color: 'var(--mac-green)',
                    }}>
                      已启用
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--mac-text)' }}>
                      合并方式: {autoMerge.merge_method || 'merge'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="btn-secondary"
                      onClick={async () => {
                        if (!window.confirm('确定要禁用自动合并吗？')) return
                        try {
                          await api.del(`/api/github/repos/${repoName}/pulls/${pullNumber}/auto-merge`)
                          setAutoMerge(null)
                        } catch (err) {
                          // ignore
                        }
                      }}
                      style={{ fontSize: 12, padding: '4px 12px', color: 'var(--mac-red)' }}
                    >
                      {Icon.delete(13)} 禁用
                    </button>
                  </div>
                </div>
              ) : (
                <div className="glass" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{
                      fontSize: 12, padding: '2px 10px', borderRadius: 10, fontWeight: 600,
                      background: 'var(--mac-gray)', color: 'var(--mac-text-secondary)',
                    }}>
                      未启用
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--mac-text)' }}>
                      自动合并尚未启用
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                    <select
                      id="auto-merge-method"
                      defaultValue="merge"
                      style={{
                        padding: '4px 8px', borderRadius: 6, border: '1px solid var(--mac-border)',
                        background: 'var(--mac-bg)', fontSize: 12, color: 'var(--mac-text)',
                        outline: 'none', cursor: 'pointer',
                      }}
                    >
                      <option value="merge">合并</option>
                      <option value="squash">压缩合并</option>
                      <option value="rebase">变基合并</option>
                    </select>
                    <button
                      className="btn-primary"
                      onClick={async () => {
                        const method = document.getElementById('auto-merge-method').value
                        try {
                          await api.put(`/api/github/repos/${repoName}/pulls/${pullNumber}/auto-merge`, { merge_method: method })
                          loadAutoMerge()
                        } catch (err) {
                          // ignore
                        }
                      }}
                      style={{ fontSize: 12, padding: '4px 12px' }}
                    >
                      {Icon.gitBranch(13)} 启用
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
