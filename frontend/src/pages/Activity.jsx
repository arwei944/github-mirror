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

const EVENT_TYPES = [
  { key: 'all', label: '全部' },
  { key: 'PushEvent', label: '推送' },
  { key: 'IssuesEvent', label: 'Issue' },
  { key: 'PullRequestEvent', label: 'PR' },
  { key: 'ReleaseEvent', label: '发布' },
  { key: 'WatchEvent', label: 'Star' },
  { key: 'ForkEvent', label: 'Fork' },
  { key: 'CreateEvent', label: '创建' },
  { key: 'DeleteEvent', label: '删除' },
  { key: 'PublicEvent', label: '公开' },
]

const EVENT_COLORS = {
  PushEvent: { bg: 'rgba(0,113,227,0.1)', color: 'var(--mac-accent)' },
  IssuesEvent: { bg: 'rgba(255,59,48,0.1)', color: 'var(--mac-red)' },
  PullRequestEvent: { bg: 'rgba(0,113,227,0.1)', color: 'var(--mac-accent)' },
  ReleaseEvent: { bg: 'rgba(52,199,89,0.1)', color: 'var(--mac-green)' },
  WatchEvent: { bg: 'rgba(255,149,0,0.1)', color: 'var(--mac-orange)' },
  ForkEvent: { bg: 'rgba(142,142,147,0.1)', color: 'var(--mac-text-secondary)' },
  CreateEvent: { bg: 'rgba(52,199,89,0.1)', color: 'var(--mac-green)' },
  DeleteEvent: { bg: 'rgba(255,59,48,0.1)', color: 'var(--mac-red)' },
  PublicEvent: { bg: 'rgba(52,199,89,0.1)', color: 'var(--mac-green)' },
}

function getEventIcon(type) {
  switch (type) {
    case 'PushEvent': return Icon.commit(16)
    case 'IssuesEvent': return Icon.issue(16)
    case 'PullRequestEvent': return Icon.pr(16)
    case 'ReleaseEvent': return Icon.release(16)
    case 'WatchEvent': return Icon.star(16)
    case 'ForkEvent': return Icon.fork(16)
    case 'CreateEvent': return Icon.create(16)
    case 'DeleteEvent': return Icon.delete(16)
    case 'PublicEvent': return Icon.public(16)
    default: return Icon.activity(16)
  }
}

function formatEventDesc(event) {
  const { type, payload } = event
  switch (type) {
    case 'PushEvent':
      return `推送了 ${payload?.size || payload?.commits?.length || '?'} 个提交到 ${payload?.ref?.replace('refs/heads/', '') || '未知分支'}`
    case 'IssuesEvent':
      return `${payload?.action === 'closed' ? '关闭了' : '打开了'} Issue #${payload?.issue?.number || '?'}`
    case 'PullRequestEvent':
      return `${payload?.action === 'closed' ? '关闭了' : '打开了'} PR #${payload?.pull_request?.number || '?'}`
    case 'ReleaseEvent':
      return `发布了 ${payload?.release?.tag_name || '?'}`
    case 'WatchEvent':
      return `Star 了 ${event.repo?.name || '?'}`
    case 'ForkEvent':
      return `Fork 了 ${event.repo?.name || '?'}`
    case 'CreateEvent':
      return `创建了 ${payload?.ref_type || '?'} ${payload?.ref || ''}`
    case 'DeleteEvent':
      return `删除了 ${payload?.ref_type || '?'} ${payload?.ref || ''}`
    case 'PublicEvent':
      return `将 ${event.repo?.name || '?'} 设为公开`
    default:
      return `执行了 ${type} 操作`
  }
}

function TimelineItem({ event, onSelectRepo }) {
  const colors = EVENT_COLORS[event.type] || { bg: 'var(--mac-gray)', color: 'var(--mac-text-secondary)' }
  const desc = event.detail || event.type_label || event.type

  return (
    <div className="timeline-item">
      <div className="timeline-icon" style={{ background: colors.bg, color: colors.color }}>
        {getEventIcon(event.type)}
      </div>
      <div className="timeline-body">
        <div className="timeline-desc">
          {desc}
        </div>
        {event.repo_name && (
          <div className="timeline-repo" onClick={() => onSelectRepo(event.repo_name)}>
            {event.repo_name}
          </div>
        )}
        <div className="timeline-time">
          {timeAgo(event.created_at)}
        </div>
      </div>
    </div>
  )
}

export default function Activity({ activities, onSelectRepo }) {
  const [filterType, setFilterType] = useState('all')
  const [localActivities, setLocalActivities] = useState(activities)

  // Auto-refresh every 30s
  useEffect(() => {
    setLocalActivities(activities)
  }, [activities])

  useEffect(() => {
    const t = setInterval(() => {
      api.get('/api/github/events').then(data => {
        if (data) setLocalActivities(data)
      }).catch(() => {})
    }, 30000)
    return () => clearInterval(t)
  }, [])

  const filtered = useMemo(() => {
    if (filterType === 'all') return localActivities
    return localActivities.filter(e => e.type === filterType)
  }, [localActivities, filterType])

  return (
    <div>
      {/* Filter bar */}
      <div className="sort-bar">
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)', fontWeight: 500, marginRight: 2 }}>事件类型</span>
          {EVENT_TYPES.map(et => (
            <button
              key={et.key}
              className={`sort-btn ${filterType === et.key ? 'active' : ''}`}
              onClick={() => setFilterType(et.key)}
            >
              {et.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>
          共 {filtered.length} 条记录
        </span>
      </div>

      {/* Timeline */}
      <div className="timeline-container">
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 64, color: 'var(--mac-text-secondary)' }}>
            <div style={{ fontSize: 36, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{Icon.activity(36)}</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>暂无活动记录</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>GitHub 活动将在这里显示</div>
          </div>
        ) : (
          filtered.map((event, idx) => (
            <TimelineItem key={`${event.id || idx}`} event={event} onSelectRepo={onSelectRepo} />
          ))
        )}
      </div>
    </div>
  )
}
