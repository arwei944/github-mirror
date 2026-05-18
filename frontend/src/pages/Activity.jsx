import { useState, useEffect, useMemo } from 'react'
import { Icon } from '../App'
import api from '../api'
import { timeAgo } from '../utils/timeAgo'

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
  { key: 'McpToolCallEvent', label: 'MCP 工具' },
  { key: 'McpShellEvent', label: 'Shell 命令' },
  { key: 'McpProxyEvent', label: 'HTTP 代理' },
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
  McpToolCallEvent: { bg: 'rgba(175,82,222,0.1)', color: '#af52de' },
  McpShellEvent: { bg: 'rgba(255,149,0,0.1)', color: 'var(--mac-orange)' },
  McpProxyEvent: { bg: 'rgba(0,199,190,0.1)', color: '#00c7be' },
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
    case 'McpToolCallEvent':
      return <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
    case 'McpShellEvent':
      return <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
    case 'McpProxyEvent':
      return <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
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
      api.get('/api/github/activity/aggregated').then(data => {
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
