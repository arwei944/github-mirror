import { useState, useEffect } from 'react'
import { Icon } from '../App'
import api from '../api'

const DEFAULT_ENV_VARS = [
  {
    key: 'GITHUB_TOKEN',
    label: 'GitHub Token',
    desc: '用于访问 GitHub API 的个人访问令牌',
    icon: Icon.github,
    color: '#1d1d1f',
    value: '',
  },
  {
    key: 'HF_TOKEN',
    label: 'HuggingFace Token',
    desc: '用于访问 HuggingFace Hub API 的访问令牌',
    icon: () => <span style={{ fontSize: 18 }}>🤗</span>,
    color: '#FF9D00',
    value: '',
  },
]

function maskValue(val) {
  if (!val || val.length <= 8) return '••••••••'
  return val.slice(0, 4) + '••••••••' + val.slice(-4)
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {
    // fallback
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  })
}

function EnvVarCard({ envVar, index }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editableValue, setEditableValue] = useState(envVar.value)
  const [editing, setEditing] = useState(false)

  const handleCopy = () => {
    copyToClipboard(editableValue)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = () => {
    setEditing(false)
    envVar.value = editableValue
  }

  const handleCancel = () => {
    setEditing(false)
    setEditableValue(envVar.value)
  }

  return (
    <div
      className="glass animate-fade-in"
      style={{
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        animationDelay: `${index * 80}ms`,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${envVar.color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: envVar.color,
        }}>
          {envVar.icon(20)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--mac-text)' }}>
            {envVar.label}
          </div>
          <div style={{ fontSize: 11, color: 'var(--mac-text-secondary)', marginTop: 1 }}>
            {envVar.desc}
          </div>
        </div>
        <span style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 6,
          background: editableValue ? 'rgba(52,199,89,0.12)' : 'rgba(255,149,0,0.12)',
          color: editableValue ? 'var(--mac-green)' : 'var(--mac-orange)',
          fontWeight: 500,
        }}>
          {editableValue ? '已配置' : '未配置'}
        </span>
      </div>

      {/* Key */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--mac-text-secondary)', letterSpacing: '0.05em' }}>
          环境变量名
        </label>
        <div style={{
          padding: '8px 12px', borderRadius: 8,
          background: 'var(--mac-bg)', border: '1px solid var(--mac-border)',
          fontFamily: 'monospace', fontSize: 13, color: 'var(--mac-accent)',
          fontWeight: 500,
        }}>
          {envVar.key}
        </div>
      </div>

      {/* Value */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--mac-text-secondary)' }}>
          值
        </label>
        {editing ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              value={editableValue}
              onChange={e => setEditableValue(e.target.value)}
              autoFocus
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8,
                background: 'var(--mac-bg)', border: '1px solid var(--mac-accent)',
                color: 'var(--mac-text)', fontSize: 12, fontFamily: 'monospace',
                outline: 'none',
              }}
            />
            <button className="btn-primary" onClick={handleSave} style={{ fontSize: 11, padding: '6px 14px', whiteSpace: 'nowrap' }}>
              保存
            </button>
            <button className="btn-secondary" onClick={handleCancel} style={{ fontSize: 11, padding: '6px 14px', whiteSpace: 'nowrap' }}>
              取消
            </button>
          </div>
        ) : (
          <div style={{
            padding: '8px 12px', borderRadius: 8,
            background: 'var(--mac-bg)', border: '1px solid var(--mac-border)',
            fontFamily: 'monospace', fontSize: 12, color: 'var(--mac-text)',
            display: 'flex', alignItems: 'center', gap: 8,
            wordBreak: 'break-all',
          }}>
            <span style={{ flex: 1, userSelect: revealed ? 'text' : 'none' }}>
              {revealed ? editableValue : maskValue(editableValue)}
            </span>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button
                onClick={() => setRevealed(!revealed)}
                title={revealed ? '隐藏' : '显示'}
                style={{
                  padding: '4px 8px', borderRadius: 6, border: 'none',
                  background: 'var(--mac-surface)', color: 'var(--mac-text-secondary)',
                  cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                {revealed ? Icon.eyeOff(14) : Icon.eye(14)}
                {revealed ? '隐藏' : '显示'}
              </button>
              <button
                onClick={handleCopy}
                title="复制"
                style={{
                  padding: '4px 8px', borderRadius: 6, border: 'none',
                  background: copied ? 'rgba(52,199,89,0.15)' : 'var(--mac-surface)',
                  color: copied ? 'var(--mac-green)' : 'var(--mac-text-secondary)',
                  cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                {copied ? '✓ 已复制' : '复制'}
              </button>
              <button
                onClick={() => setEditing(true)}
                title="编辑"
                style={{
                  padding: '4px 8px', borderRadius: 6, border: 'none',
                  background: 'var(--mac-surface)', color: 'var(--mac-text-secondary)',
                  cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                编辑
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Add eye/eyeOff icons to Icon if not present
if (!Icon.eye) {
  Icon.eye = (s = 14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}
if (!Icon.eyeOff) {
  Icon.eyeOff = (s = 14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

export default function EnvVars() {
  const [envVars, setEnvVars] = useState(DEFAULT_ENV_VARS)
  const [serverConfig, setServerConfig] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadServerConfig()
  }, [])

  const loadServerConfig = async () => {
    setLoading(true)
    try {
      const data = await api.get('/api/config')
      if (data) {
        setServerConfig(data)
      }
    } catch (err) {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="sort-bar">
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mac-text)' }}>
          🔑 环境变量
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>
          管理应用密钥与令牌
        </span>
      </div>

      {/* Content */}
      <div className="card-grid-scroll">
        <div style={{ padding: '20px 24px 48px', maxWidth: 700 }}>
          {/* Server status */}
          {serverConfig && (
            <div className="glass animate-fade-in" style={{
              padding: 14, marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(52,199,89,0.06)',
              border: '1px solid rgba(52,199,89,0.15)',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--mac-green)',
                boxShadow: '0 0 6px var(--mac-green)',
              }} />
              <span style={{ fontSize: 12, color: 'var(--mac-green)' }}>
                后端服务已连接
              </span>
              <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)', marginLeft: 'auto' }}>
                GitHub Token: {serverConfig.github_token_set ? '✅ 已配置' : '⚠️ 未配置'}
                &nbsp;&nbsp;|&nbsp;&nbsp;
                HF Token: {serverConfig.hf_token_set ? '✅ 已配置' : '⚠️ 未配置'}
              </span>
            </div>
          )}

          {/* Env var cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {envVars.map((envVar, i) => (
              <EnvVarCard key={envVar.key} envVar={envVar} index={i} />
            ))}
          </div>

          {/* Tips */}
          <div className="glass" style={{
            marginTop: 20, padding: 16,
            background: 'rgba(0,122,255,0.05)',
            border: '1px solid rgba(0,122,255,0.12)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--mac-accent)', marginBottom: 8 }}>
              💡 安全提示
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                Token 仅存储在浏览器本地，不会上传到任何第三方服务
              </li>
              <li style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                建议定期更换 Token，使用完成后及时撤销
              </li>
              <li style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                请勿在公共场合分享你的 Token
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
