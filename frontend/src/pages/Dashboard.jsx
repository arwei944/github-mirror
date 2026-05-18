import React, { useState, useEffect, useCallback } from 'react'
import api from '../api'

// ============ SVG Icons (sidebar-consistent style) ============
const Icon = {
  dashboard: (s = 16, c = 'currentColor') => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth={1.5}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  repo: (s = 14, c = 'currentColor') => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth={1.5}>
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  ),
  star: (s = 14, c = 'currentColor') => (
    <svg width={s} height={s} fill={c} viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
  ),
  issue: (s = 14, c = 'currentColor') => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth={1.5}>
      <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
    </svg>
  ),
  pr: (s = 14, c = 'currentColor') => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth={1.5}>
      <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M6 21V9a9 9 0 009 9" />
    </svg>
  ),
  push: (s = 14, c = 'currentColor') => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth={1.5}>
      <circle cx="12" cy="12" r="4" /><line x1="1.05" y1="12" x2="7" y2="12" /><line x1="17.01" y1="12" x2="22.96" y2="12" />
    </svg>
  ),
  fork: (s = 14, c = 'currentColor') => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth={1.5}>
      <circle cx="12" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><circle cx="18" cy="6" r="3" />
      <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9" />
    </svg>
  ),
  release: (s = 14, c = 'currentColor') => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth={1.5}>
      <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
    </svg>
  ),
  watch: (s = 14, c = 'currentColor') => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth={1.5}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  create: (s = 14, c = 'currentColor') => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth={1.5}>
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
  delete: (s = 14, c = 'currentColor') => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth={1.5}>
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  ),
  activity: (s = 14, c = 'currentColor') => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth={1.5}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  refresh: (s = 14, c = 'currentColor') => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  arrowRight: (s = 12, c = 'currentColor') => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  ),
}

function getEventIcon(type, color) {
  const c = color || 'var(--mac-text-secondary)'
  const s = 14
  switch (type) {
    case 'PushEvent': return Icon.push(s, c)
    case 'PullRequestEvent': return Icon.pr(s, c)
    case 'PullRequestReviewEvent': return Icon.pr(s, c)
    case 'IssuesEvent': return Icon.issue(s, c)
    case 'IssueCommentEvent': return Icon.issue(s, c)
    case 'StarEvent': return Icon.star(s, '#d29922')
    case 'CreateEvent': return Icon.create(s, '#3fb950')
    case 'DeleteEvent': return Icon.delete(s, '#f85149')
    case 'ForkEvent': return Icon.fork(s, c)
    case 'ReleaseEvent': return Icon.release(s, '#8b5cf6')
    case 'WatchEvent': return Icon.watch(s, c)
    default: return Icon.activity(s, c)
  }
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

function getEventText(event) {
  // 优先使用后端提供的 detail 字段
  if (event.detail) {
    return event.detail
  }
  // 回退到原始逻辑
  const t = event.type || ''
  const p = event.payload || {}
  const repo = event.full_repo_name || event.repo_name || (event.repo || {}).name || ''
  
  switch (t) {
    case 'PushEvent':
      const commitCount = event.commit_count || p.size || p.commits?.length || 0
      const ref = (event.ref || p.ref || '').replace('refs/heads/', '')
      return `推送了 ${commitCount} 个提交到 ${ref}`
    case 'PullRequestEvent':
      const prNum = event.pr_number || p.pull_request?.number
      const prTitle = event.pr_title || p.pull_request?.title
      return `PR #${prNum}: ${prTitle || ''}`
    case 'IssuesEvent':
      const issueNum = event.issue_number || p.issue?.number
      const issueTitle = event.issue_title || p.issue?.title
      return `Issue #${issueNum}: ${issueTitle || ''}`
    case 'IssueCommentEvent':
      return `评论了 Issue #${event.issue_number || p.issue?.number || ''}`
    case 'StarEvent':
      return `星标了 ${repo}`
    case 'ForkEvent':
      return `复刻了 ${repo}`
    case 'WatchEvent':
      return `关注了 ${repo}`
    case 'CreateEvent':
      return `创建了 ${p.ref_type || ''} ${(p.ref || '').replace('refs/heads/', '')}`
    case 'DeleteEvent':
      return `删除了 ${p.ref_type || ''}`
    case 'ReleaseEvent':
      return `发布了 ${p.release?.name || p.release?.tag_name || ''}`
    default:
      return repo || event.type_label || t.replace('Event', '')
  }
}

const cardStyle = {
  background: 'var(--mac-surface)',
  backdropFilter: 'var(--mac-blur)',
  border: '1px solid var(--mac-border)',
  borderRadius: 12,
  padding: 16,
}

export default function Dashboard({ githubRepos, onSelectRepo, onNavigate }) {
  const [activities, setActivities] = useState([])
  const [starred, setStarred] = useState([])
  const [trending, setTrending] = useState([])
  const [stats, setStats] = useState({ repos: 0, stars: 0, issues: 0, prs: 0, forks: 0 })
  const [loading, setLoading] = useState(true)

  const repos = Array.isArray(githubRepos) ? githubRepos : []

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [act, star, trend, webhookEvents] = await Promise.all([
        api.get('/api/github/activity/aggregated').catch(() => []),
        api.get('/api/github/user/starred?sort=updated&per_page=5').catch(() => []),
        api.get('/api/github/trending?since=daily').catch(() => []),
        api.get('/api/webhooks/events?per_page=10').catch(() => []),
      ])
      setActivities(Array.isArray(act) ? act.slice(0, 15) : [])
      setStarred(Array.isArray(star) ? star : [])
      setTrending(Array.isArray(trend) ? trend : [])

      // Calculate stats from repos
      const totalStars = repos.reduce((s, r) => s + (r.stargazers_count || 0), 0)
      const totalForks = repos.reduce((s, r) => s + (r.forks_count || 0), 0)
      const totalIssues = repos.reduce((s, r) => s + (r.open_issues_count || 0), 0)
      setStats({
        repos: repos.length,
        stars: totalStars,
        issues: totalIssues,
        prs: totalIssues, // open_issues includes PRs in GitHub API
        forks: totalForks,
      })
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [])

  // 当 repos 数据到达时更新统计
  useEffect(() => {
    if (repos.length > 0) {
      const totalStars = repos.reduce((s, r) => s + (r.stargazers_count || 0), 0)
      const totalForks = repos.reduce((s, r) => s + (r.forks_count || 0), 0)
      const totalIssues = repos.reduce((s, r) => s + (r.open_issues_count || 0), 0)
      setStats({ repos: repos.length, stars: totalStars, issues: totalIssues, forks: totalForks })
    }
  }, [repos.length])

  const statCards = [
    { label: '仓库', value: stats.repos, icon: Icon.repo(18, '#0066cc'), color: '#0066cc' },
    { label: '星标', value: stats.stars, icon: Icon.star(18, '#d29922'), color: '#d29922' },
    { label: 'Issues', value: stats.issues, icon: Icon.issue(18, '#f85149'), color: '#f85149' },
    { label: 'Forks', value: stats.forks, icon: Icon.fork(18, '#8b5cf6'), color: '#8b5cf6' },
  ]

  return (
    <div className="animate-fade-in" style={{ padding: 20, height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--mac-text)', margin: 0 }}>仪表盘</h2>
          <p style={{ fontSize: 12, color: 'var(--mac-text-secondary)', margin: '4px 0 0' }}>项目概览与实时动态</p>
        </div>
        <button onClick={loadData} disabled={loading} style={{
          background: 'var(--mac-accent)', color: 'white', border: 'none',
          borderRadius: 8, padding: '6px 14px', cursor: loading ? 'wait' : 'pointer',
          fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ display: 'inline-flex', opacity: loading ? 0.5 : 1 }}>
            {Icon.refresh(12, 'white')}
          </span>
          {loading ? '加载中...' : '刷新'}
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {statCards.map((s, i) => (
          <div key={i} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: `${s.color}12`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--mac-text)', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Two column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
        {/* Recent activity */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--mac-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {Icon.activity(16, 'var(--mac-accent)')} 最近活动
            </span>
            {onNavigate && (
              <button onClick={() => onNavigate('activity')} style={{
                background: 'none', border: 'none', color: 'var(--mac-accent)',
                cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 2,
              }}>查看全部 {Icon.arrowRight(10)}</button>
            )}
          </div>
          {activities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--mac-text-secondary)', fontSize: 12 }}>
              {Icon.activity(24)} <div style={{ marginTop: 8 }}>暂无活动记录</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {activities.map((event, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px',
                  borderBottom: i < activities.length - 1 ? '1px solid var(--mac-border)' : 'none',
                  cursor: event.repo?.name ? 'pointer' : 'default',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--mac-surface-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => event.repo?.name && onSelectRepo?.(event.repo.name.split('/')[1] || event.repo.name)}
                >
                  <span style={{ flexShrink: 0, display: 'inline-flex' }}>{getEventIcon(event.type)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--mac-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {getEventText(event)}
                      {(event.repo?.name || event.full_repo_name) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const repoFullName = event.full_repo_name || event.repo?.name
                            navigator.clipboard.writeText(repoFullName).then(() => {
                              e.target.textContent = '✓'
                              setTimeout(() => { e.target.textContent = '📋' }, 1500)
                            })
                          }}
                          title="复制项目名"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '0 2px', fontSize: 10, opacity: 0.4,
                            borderRadius: 4, flexShrink: 0,
                          }}
                          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                          onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}
                        >📋</button>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--mac-text-secondary)', flexShrink: 0 }}>
                    {timeAgo(event.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Trending repos */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--mac-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {Icon.activity(16, '#3fb950')} GitHub 热门项目
              </span>
            </div>
            {trending.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--mac-text-secondary)', fontSize: 12 }}>加载中...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {trending.map((repo, i) => (
                  <div key={i} onClick={() => window.open(repo.html_url, '_blank')} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px',
                    borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--mac-surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <img src={repo.owner?.avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {repo.full_name || repo.name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--mac-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {repo.description?.slice(0, 50) || repo.language || ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                      {Icon.star(10, '#d29922')}<span>{repo.stargazers_count || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent starred */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--mac-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {Icon.star(14, '#d29922')} 收藏的项目
              </span>
              {onNavigate && (
                <button onClick={() => onNavigate('starred')} style={{
                  background: 'none', border: 'none', color: 'var(--mac-accent)',
                  cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 2,
                }}>查看全部 {Icon.arrowRight(10)}</button>
              )}
            </div>
            {starred.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--mac-text-secondary)', fontSize: 12 }}>
                {Icon.star(20)} <div style={{ marginTop: 6 }}>暂无收藏的项目</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {starred.map((repo, i) => (
                  <div key={i} onClick={() => onSelectRepo?.(repo.name)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px',
                    borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--mac-surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <img src={repo.owner?.avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {repo.full_name || repo.name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--mac-text-secondary)' }}>{repo.description?.slice(0, 40) || ''}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                      {Icon.star(10, '#d29922')}<span>{repo.stargazers_count || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
