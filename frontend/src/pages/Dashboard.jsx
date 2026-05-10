import React, { useState, useEffect, useCallback } from 'react'
import api from '../api'

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const now = new Date()
  const date = new Date(dateStr)
  const diff = Math.floor((now - date) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`
  return date.toLocaleDateString('zh-CN')
}

function getEventIcon(type) {
  const icons = {
    push: '📝', pull_request: '🔀', issues: '❗', create: '✨', delete: '🗑️',
    fork: '🍴', star: '⭐', release: '📦', member: '👤', public: '🌍',
    WatchEvent: '👀', ForkEvent: '🍴', IssuesEvent: '❗', PullRequestEvent: '🔀',
    PushEvent: '📝', CreateEvent: '✨', DeleteEvent: '🗑️', ReleaseEvent: '📦',
    StarEvent: '⭐',
  }
  return icons[type] || '📌'
}

function getEventText(event) {
  const t = event.type || ''
  const p = event.payload || {}
  const repo = (event.repo || {}).name || ''
  const repoShort = repo.split('/').pop() || repo

  switch (t) {
    case 'PushEvent':
      return `${repoShort} · ${p.commits?.length || 0} 个提交推送到 ${(p.ref || '').replace('refs/heads/', '')}`
    case 'PullRequestEvent':
      const pr = p.pull_request || {}
      return `${repoShort} · PR #${pr.number} ${p.action || ''}`
    case 'IssuesEvent':
      const issue = p.issue || {}
      return `${repoShort} · Issue #${issue.number} ${p.action || ''}`
    case 'StarEvent':
      return `${repoShort} · 被星标`
    case 'CreateEvent':
      return `${repoShort} · 创建了 ${p.ref_type || ''} ${(p.ref || '').replace('refs/heads/', '')}`
    case 'DeleteEvent':
      return `${repoShort} · 删除了 ${p.ref_type || ''}`
    case 'ForkEvent':
      return `${repoShort} · 被复刻`
    case 'ReleaseEvent':
      const rel = p.release || {}
      return `${repoShort} · 发布了 ${rel.name || rel.tag_name || ''}`
    case 'WatchEvent':
      return `${repoShort} · 被关注`
    default:
      return `${repoShort} · ${t.replace('Event', '')}`
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
  const [stats, setStats] = useState({ repos: 0, stars: 0, issues: 0, prs: 0 })
  const [loading, setLoading] = useState(true)

  const repos = Array.isArray(githubRepos) ? githubRepos : []

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [act, star] = await Promise.all([
        api.get('/api/github/activity').catch(() => []),
        api.get('/api/github/user/starred').catch(() => []),
      ])
      setActivities(Array.isArray(act) ? act.slice(0, 15) : [])
      setStarred(Array.isArray(star) ? star.slice(0, 5) : [])

      // Calculate stats
      const totalStars = repos.reduce((s, r) => s + (r.stargazers_count || 0), 0)
      setStats({
        repos: repos.length,
        stars: totalStars,
        issues: repos.reduce((s, r) => s + (r.open_issues_count || 0), 0),
        prs: '-', // Would need per-repo query
      })
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }, [repos])

  useEffect(() => { loadData() }, [loadData])

  const statCards = [
    { label: '仓库', value: stats.repos, icon: '📦', color: '#0066cc' },
    { label: '星标', value: stats.stars, icon: '⭐', color: '#d29922' },
    { label: 'Issues', value: stats.issues, icon: '❗', color: '#f85149' },
    { label: 'PRs', value: stats.prs, icon: '🔀', color: '#8b5cf6' },
  ]

  const topRepos = [...repos].sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0)).slice(0, 5)

  return (
    <div className="animate-fade-in" style={{ padding: 20, height: '100%', overflow: 'auto' }}>
      {/* Welcome header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--mac-text)', margin: 0 }}>仪表盘</h2>
          <p style={{ fontSize: 12, color: 'var(--mac-text-secondary)', margin: '4px 0 0' }}>项目概览与实时动态</p>
        </div>
        <button onClick={loadData} disabled={loading} style={{
          background: 'var(--mac-accent)', color: 'white', border: 'none',
          borderRadius: 8, padding: '6px 14px', cursor: loading ? 'wait' : 'pointer', fontSize: 12,
        }}>
          {loading ? '刷新中...' : '🔄 刷新'}
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {statCards.map((s, i) => (
          <div key={i} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: `${s.color}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
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
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--mac-text)' }}>📊 最近活动</span>
            {onNavigate && (
              <button onClick={() => onNavigate('activity')} style={{
                background: 'none', border: 'none', color: 'var(--mac-accent)',
                cursor: 'pointer', fontSize: 11,
              }}>查看全部 →</button>
            )}
          </div>
          {activities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--mac-text-secondary)', fontSize: 12 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
              暂无活动记录
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {activities.map((event, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px',
                  borderBottom: i < activities.length - 1 ? '1px solid var(--mac-border)' : 'none',
                  cursor: event.repo?.name ? 'pointer' : 'default',
                }}
                  onClick={() => event.repo?.name && onSelectRepo?.(event.repo.name.split('/')[1] || event.repo.name)}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{getEventIcon(event.type)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--mac-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getEventText(event)}
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
          {/* Top repos */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--mac-text)' }}>🔥 热门仓库</span>
              {onNavigate && (
                <button onClick={() => onNavigate('repos')} style={{
                  background: 'none', border: 'none', color: 'var(--mac-accent)',
                  cursor: 'pointer', fontSize: 11,
                }}>查看全部 →</button>
              )}
            </div>
            {topRepos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--mac-text-secondary)', fontSize: 12 }}>暂无仓库</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {topRepos.map((repo, i) => (
                  <div key={i} onClick={() => onSelectRepo?.(repo.name)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px',
                    borderRadius: 8, cursor: 'pointer',
                    background: 'transparent',
                    transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--mac-surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <img src={repo.owner?.avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {repo.name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--mac-text-secondary)' }}>{repo.language || 'Unknown'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                      <span>⭐</span><span>{repo.stargazers_count || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent starred */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--mac-text)' }}>⭐ 最近星标</span>
              {onNavigate && (
                <button onClick={() => onNavigate('starred')} style={{
                  background: 'none', border: 'none', color: 'var(--mac-accent)',
                  cursor: 'pointer', fontSize: 11,
                }}>查看全部 →</button>
              )}
            </div>
            {starred.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--mac-text-secondary)', fontSize: 12 }}>暂无星标</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {starred.map((repo, i) => (
                  <div key={i} onClick={() => onSelectRepo?.(repo.name)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px',
                    borderRadius: 8, cursor: 'pointer',
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
