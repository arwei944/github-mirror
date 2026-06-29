import React, { useState, useEffect, useCallback, useRef } from 'react'
import api from '../api'

const MAX_NOTIFICATIONS = 5
const MAX_DISPLAY = 3

const EVENT_TYPE_LABELS = {
  PushEvent: '推送',
  IssuesEvent: 'Issue',
  PullRequestEvent: 'PR',
  ReleaseEvent: '发布',
  WatchEvent: 'Star',
  ForkEvent: 'Fork',
  CreateEvent: '创建',
  DeleteEvent: '删除',
  PublicEvent: '公开',
  McpToolCallEvent: 'MCP 工具',
  McpShellEvent: 'Shell 命令',
  McpProxyEvent: 'HTTP 代理',
}

function formatEventText(event) {
  const label = EVENT_TYPE_LABELS[event.type] || event.type || '事件'
  const repo = event.repo_name || event.repo?.name || ''
  const detail = event.detail || event.type_label || ''

  if (detail) {
    return repo ? `${label}: ${detail} (${repo})` : `${label}: ${detail}`
  }
  if (repo) return `${repo} 有新的${label}活动`
  return `新的${label}活动`
}

export default function RealTimeNotifications() {
  const [notifications, setNotifications] = useState([])
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const unreadRef = useRef(0)
  const prevCountRef = useRef(0)

  useEffect(() => {
    let eventSource = null
    try {
      eventSource = new EventSource('/api/events/stream')
      eventSource.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'event') {
            const text = formatEventText(msg)
            const notification = {
              id: Date.now() + Math.random(),
              text,
              time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            }

            setNotifications(prev => {
              const next = [notification, ...prev]
              if (next.length > MAX_NOTIFICATIONS) return next.slice(0, MAX_NOTIFICATIONS)
              return next
            })

            unreadRef.current += 1
          }
        } catch (e) {
          // ignore parse errors
        }
      }
      eventSource.onerror = () => {
        if (eventSource) eventSource.close()
        setTimeout(() => {
          if (!eventSource || eventSource.readyState === EventSource.CLOSED) {
            eventSource = new EventSource('/api/events/stream')
          }
        }, 5000)
      }
    } catch (e) {
      // SSE not supported
    }

    return () => {
      if (eventSource) eventSource.close()
    }
  }, [])

  const handleTogglePanel = useCallback(() => {
    setIsPanelOpen(prev => {
      const next = !prev
      if (next) {
        unreadRef.current = 0
        prevCountRef.current = 0
      }
      return next
    })
  }, [])

  const handleDismiss = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const handleClearAll = useCallback(() => {
    setNotifications([])
    unreadRef.current = 0
    prevCountRef.current = 0
  }, [])

  // Determine badge count
  const visibleCount = notifications.length
  const unreadCount = unreadRef.current
  const shouldShowBadge = unreadCount > 0 && !isPanelOpen

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      zIndex: 99998,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 10,
      pointerEvents: 'none',
    }}>
      {/* Notification panel */}
      {isPanelOpen && (
        <div style={{
          width: 360,
          maxHeight: 480,
          background: 'var(--mac-glass, rgba(255, 255, 255, 0.85))',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
          border: '1px solid var(--mac-border, rgba(0, 0, 0, 0.08))',
          overflow: 'hidden',
          pointerEvents: 'auto',
          animation: 'toast-slide-in 0.25s ease forwards',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: '1px solid var(--mac-border, rgba(0, 0, 0, 0.06))',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mac-text)' }}>实时通知</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  style={{
                    fontSize: 11,
                    color: 'var(--mac-text-secondary)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  清空
                </button>
              )}
              <button
                onClick={() => setIsPanelOpen(false)}
                style={{
                  fontSize: 11,
                  color: 'var(--mac-text-secondary)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
              >
                ✕
              </button>
            </div>
          </div>

          <div style={{
            maxHeight: 420,
            overflowY: 'auto',
            padding: '6px 0',
          }}>
            {notifications.length === 0 ? (
              <div style={{
                padding: '24px 16px',
                textAlign: 'center',
                color: 'var(--mac-text-secondary)',
                fontSize: 12,
              }}>
                暂无实时通知
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--mac-border, rgba(0, 0, 0, 0.04))',
                    transition: 'background 0.15s',
                    cursor: 'default',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.03)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--mac-accent)',
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12,
                      color: 'var(--mac-text)',
                      lineHeight: 1.4,
                      wordBreak: 'break-word',
                    }}>
                      {notification.text}
                    </div>
                    <div style={{
                      fontSize: 10,
                      color: 'var(--mac-text-secondary)',
                      marginTop: 2,
                    }}>
                      {notification.time}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDismiss(notification.id)}
                    style={{
                      flexShrink: 0,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--mac-text-secondary)',
                      fontSize: 12,
                      padding: '2px 4px',
                      borderRadius: 4,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Floating bell button */}
      <button
        onClick={handleTogglePanel}
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'var(--mac-glass, rgba(255, 255, 255, 0.85))',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--mac-border, rgba(0, 0, 0, 0.08))',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--mac-text)',
          position: 'relative',
          pointerEvents: 'auto',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.08)'
          e.currentTarget.style.boxShadow = '0 6px 24px rgba(0, 0, 0, 0.18)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12)'
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {shouldShowBadge && unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            background: '#ff3b30',
            color: '#fff',
            fontSize: 10,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 5px',
            lineHeight: 1,
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  )
}
