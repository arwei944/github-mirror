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

function Toggle({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 13, color: 'var(--mac-text)', minWidth: 80 }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
          background: value ? 'var(--mac-green)' : 'var(--mac-gray)',
          position: 'relative', transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2,
          left: value ? 18 : 2,
          width: 16, height: 16, borderRadius: 8,
          background: 'white', transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
      <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>{value ? '开启' : '关闭'}</span>
    </div>
  )
}

function BasicInfoTab({ repoName, onSaved }) {
  const [form, setForm] = useState({
    description: '',
    homepage: '',
    private: false,
    has_issues: true,
    has_wiki: true,
    has_projects: true,
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!repoName) return
    setLoading(true)
    api.get(`/api/github/repos/${repoName}`).then(data => {
      if (data) {
        setForm({
          description: data.description || '',
          homepage: data.homepage || '',
          private: data.visibility === 'private',
          has_issues: data.has_issues !== false,
          has_wiki: data.has_wiki !== false,
          has_projects: data.has_projects !== false,
        })
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [repoName])

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      await api.patch(`/api/github/repos/${repoName}`, {
        description: form.description,
        homepage: form.homepage,
        private: form.private,
        has_issues: form.has_issues,
        has_wiki: form.has_wiki,
        has_projects: form.has_projects,
      })
      setMessage('保存成功')
      if (onSaved) onSaved()
    } catch (err) {
      setMessage('保存失败: ' + (err.message || '未知错误'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--mac-text-secondary)', gap: 8 }}>
        <span style={{ animation: 'pulse-dot 1s infinite' }}>&#9679;</span> 加载中...
      </div>
    )
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)' }}>描述</label>
        <textarea
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          placeholder="仓库描述..."
          rows={3}
          style={{
            padding: '8px 12px', borderRadius: 'var(--mac-radius)', border: '1px solid var(--mac-border)',
            background: 'var(--mac-bg)', color: 'var(--mac-text)', fontSize: 13, outline: 'none',
            resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5,
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)' }}>主页</label>
        <input
          type="text"
          value={form.homepage}
          onChange={e => setForm({ ...form, homepage: e.target.value })}
          placeholder="https://example.com"
          style={{
            padding: '6px 12px', borderRadius: 'var(--mac-radius)', border: '1px solid var(--mac-border)',
            background: 'var(--mac-bg)', color: 'var(--mac-text)', fontSize: 13, outline: 'none',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 0' }}>
        <Toggle
          label="私有仓库"
          value={form.private}
          onChange={v => setForm({ ...form, private: v })}
        />
        <Toggle
          label="Issues"
          value={form.has_issues}
          onChange={v => setForm({ ...form, has_issues: v })}
        />
        <Toggle
          label="Wiki"
          value={form.has_wiki}
          onChange={v => setForm({ ...form, has_wiki: v })}
        />
        <Toggle
          label="Projects"
          value={form.has_projects}
          onChange={v => setForm({ ...form, has_projects: v })}
        />
      </div>

      {message && (
        <div style={{
          fontSize: 12, padding: '6px 12px', borderRadius: 'var(--mac-radius)',
          background: message.includes('失败') ? 'rgba(255,59,48,0.1)' : 'rgba(52,199,89,0.1)',
          color: message.includes('失败') ? 'var(--mac-red)' : 'var(--mac-green)',
        }}>
          {message}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 20px', fontSize: 13 }}
        >
          {saving ? '保存中...' : '保存设置'}
        </button>
      </div>
    </div>
  )
}

function TopicsTab({ repoName, onSaved }) {
  const [topics, setTopics] = useState([])
  const [newTopic, setNewTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!repoName) return
    setLoading(true)
    api.get(`/api/github/repos/${repoName}/topics`).then(data => {
      if (data && data.names) {
        setTopics(data.names)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [repoName])

  const handleRemove = (topic) => {
    setTopics(prev => prev.filter(t => t !== topic))
  }

  const handleAdd = () => {
    const trimmed = newTopic.trim().toLowerCase().replace(/[^a-z0-9\-_]/g, '-')
    if (trimmed && !topics.includes(trimmed)) {
      setTopics(prev => [...prev, trimmed])
      setNewTopic('')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      await api.put(`/api/github/repos/${repoName}/topics`, { names: topics })
      setMessage('保存成功')
      if (onSaved) onSaved()
    } catch (err) {
      setMessage('保存失败: ' + (err.message || '未知错误'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--mac-text-secondary)', gap: 8 }}>
        <span style={{ animation: 'pulse-dot 1s infinite' }}>&#9679;</span> 加载中...
      </div>
    )
  }

  const TOPIC_COLORS = [
    'var(--mac-accent)', 'var(--mac-green)', 'var(--mac-orange)', '#8B5CF6', '#EC4899',
    '#06B6D4', '#F59E0B', '#10B981', '#6366F1', '#EF4444',
  ]

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)' }}>当前 Topics</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 32 }}>
          {topics.length === 0 ? (
            <span style={{ fontSize: 12, color: 'var(--mac-text-secondary)' }}>暂无 Topics</span>
          ) : (
            topics.map((topic, i) => (
              <span
                key={topic}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 10px', borderRadius: 12,
                  background: TOPIC_COLORS[i % TOPIC_COLORS.length],
                  color: 'white', fontSize: 12, fontWeight: 500,
                }}
              >
                {topic}
                <button
                  onClick={() => handleRemove(topic)}
                  style={{
                    background: 'rgba(255,255,255,0.3)', border: 'none', borderRadius: '50%',
                    width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'white', fontSize: 10, lineHeight: 1, padding: 0,
                  }}
                >
                  &times;
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)' }}>添加 Topic</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={newTopic}
            onChange={e => setNewTopic(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入 topic 名称..."
            style={{
              flex: 1, padding: '6px 12px', borderRadius: 'var(--mac-radius)',
              border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
              color: 'var(--mac-text)', fontSize: 13, outline: 'none',
            }}
          />
          <button
            className="btn-secondary"
            onClick={handleAdd}
            disabled={!newTopic.trim()}
            style={{ padding: '6px 14px', fontSize: 12 }}
          >
            添加
          </button>
        </div>
        <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>仅支持小写字母、数字、连字符和下划线</span>
      </div>

      {message && (
        <div style={{
          fontSize: 12, padding: '6px 12px', borderRadius: 'var(--mac-radius)',
          background: message.includes('失败') ? 'rgba(255,59,48,0.1)' : 'rgba(52,199,89,0.1)',
          color: message.includes('失败') ? 'var(--mac-red)' : 'var(--mac-green)',
        }}>
          {message}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 20px', fontSize: 13 }}
        >
          {saving ? '保存中...' : '保存 Topics'}
        </button>
      </div>
    </div>
  )
}

const WEBHOOK_EVENTS = [
  'push', 'pull_request', 'issues', 'issue_comment', 'release',
  'fork', 'watch', 'delete', 'create', 'page_build', 'status',
]

function WebhooksTab({ repoName }) {
  const [webhooks, setWebhooks] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    url: '',
    secret: '',
    events: ['push'],
    content_type: 'json',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const loadWebhooks = () => {
    if (!repoName) return
    setLoading(true)
    api.get(`/api/github/repos/${repoName}/hooks`).then(data => {
      setWebhooks(Array.isArray(data) ? data : [])
      setLoading(false)
    }).catch(() => {
      setWebhooks([])
      setLoading(false)
    })
  }

  useEffect(() => { loadWebhooks() }, [repoName])

  const handleCreate = async () => {
    if (!form.url.trim()) return
    setSaving(true)
    setMessage('')
    try {
      await api.post(`/api/github/repos/${repoName}/hooks`, {
        name: 'web',
        config: { url: form.url, content_type: form.content_type, secret: form.secret },
        events: form.events,
        active: true,
      })
      setMessage('创建成功')
      setShowForm(false)
      setForm({ url: '', secret: '', events: ['push'], content_type: 'json' })
      loadWebhooks()
    } catch (err) {
      setMessage('创建失败: ' + (err.message || '未知错误'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (hookId) => {
    if (!window.confirm('确定要删除此 Webhook 吗？')) return
    try {
      await api.del(`/api/github/repos/${repoName}/hooks/${hookId}`)
      loadWebhooks()
    } catch (err) {
      setMessage('删除失败')
    }
  }

  const handlePing = async (hookId) => {
    try {
      await api.post(`/api/github/repos/${repoName}/hooks/${hookId}/pings`, {})
      setMessage('Ping 已发送')
    } catch (err) {
      setMessage('Ping 失败')
    }
  }

  const toggleEvent = (event) => {
    setForm(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event],
    }))
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--mac-text-secondary)', gap: 8 }}>
        <span style={{ animation: 'pulse-dot 1s infinite' }}>&#9679;</span> 加载中...
      </div>
    )
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Webhook list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {webhooks.length === 0 && !showForm && (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--mac-text-secondary)' }}>
            <div style={{ fontSize: 13 }}>暂无 Webhook</div>
          </div>
        )}
        {webhooks.map(hook => (
          <div
            key={hook.id}
            className="glass"
            style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: hook.active ? 'var(--mac-green)' : 'var(--mac-gray)',
              }} />
              <code style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {hook.config?.url || hook.url}
              </code>
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 6,
                background: 'var(--mac-surface-hover)', color: 'var(--mac-text-secondary)',
              }}>
                {hook.config?.content_type || 'json'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {(hook.events || []).slice(0, 5).map(ev => (
                <span key={ev} style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 6,
                  background: 'var(--mac-accent)', color: 'white',
                }}>{ev}</span>
              ))}
              {(hook.events || []).length > 5 && (
                <span style={{ fontSize: 10, color: 'var(--mac-text-secondary)' }}>
                  +{hook.events.length - 5} 更多
                </span>
              )}
              <span style={{ fontSize: 10, color: 'var(--mac-text-secondary)', marginLeft: 'auto' }}>
                {timeAgo(hook.created_at)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button
                className="btn-secondary"
                onClick={() => handlePing(hook.id)}
                style={{ fontSize: 11, padding: '2px 10px' }}
              >
                {Icon.zap(11)} Ping
              </button>
              <button
                className="btn-secondary"
                onClick={() => handleDelete(hook.id)}
                style={{ fontSize: 11, padding: '2px 10px', color: 'var(--mac-red)' }}
              >
                {Icon.trash(11)} 删除
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* New webhook form */}
      {showForm ? (
        <div className="glass animate-fade-in" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>新建 Webhook</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)' }}>URL *</label>
            <input
              type="text"
              value={form.url}
              onChange={e => setForm({ ...form, url: e.target.value })}
              placeholder="https://example.com/webhook"
              style={{
                padding: '6px 12px', borderRadius: 'var(--mac-radius)', border: '1px solid var(--mac-border)',
                background: 'var(--mac-bg)', color: 'var(--mac-text)', fontSize: 13, outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)' }}>Secret</label>
            <input
              type="password"
              value={form.secret}
              onChange={e => setForm({ ...form, secret: e.target.value })}
              placeholder="Webhook Secret（可选）"
              style={{
                padding: '6px 12px', borderRadius: 'var(--mac-radius)', border: '1px solid var(--mac-border)',
                background: 'var(--mac-bg)', color: 'var(--mac-text)', fontSize: 13, outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)' }}>Content Type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['json', 'form'].map(ct => (
                <button
                  key={ct}
                  className={`sort-btn ${form.content_type === ct ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, content_type: ct })}
                  style={{ fontSize: 11 }}
                >
                  {ct === 'json' ? 'application/json' : 'application/x-www-form-urlencoded'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)' }}>触发事件</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {WEBHOOK_EVENTS.map(ev => (
                <button
                  key={ev}
                  className={`sort-btn ${form.events.includes(ev) ? 'active' : ''}`}
                  onClick={() => toggleEvent(ev)}
                  style={{ fontSize: 11 }}
                >
                  {ev}
                </button>
              ))}
            </div>
          </div>

          {message && (
            <div style={{
              fontSize: 12, padding: '6px 12px', borderRadius: 'var(--mac-radius)',
              background: message.includes('失败') ? 'rgba(255,59,48,0.1)' : 'rgba(52,199,89,0.1)',
              color: message.includes('失败') ? 'var(--mac-red)' : 'var(--mac-green)',
            }}>
              {message}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              className="btn-secondary"
              onClick={() => { setShowForm(false); setMessage('') }}
              style={{ fontSize: 12, padding: '5px 14px' }}
            >
              取消
            </button>
            <button
              className="btn-primary"
              onClick={handleCreate}
              disabled={saving || !form.url.trim()}
              style={{ fontSize: 12, padding: '5px 14px' }}
            >
              {saving ? '创建中...' : '创建 Webhook'}
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn-secondary"
          onClick={() => setShowForm(true)}
          style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 14px' }}
        >
          {Icon.plus(13)} 新建 Webhook
        </button>
      )}
    </div>
  )
}

export default function Settings({ githubRepos }) {
  const [selectedRepo, setSelectedRepo] = useState('')
  const [activeTab, setActiveTab] = useState('basic')

  const repoName = selectedRepo || (githubRepos.length > 0 ? githubRepos[0].name : '')

  const TABS = [
    { key: 'basic', label: '基本信息' },
    { key: 'topics', label: 'Topics' },
    { key: 'webhooks', label: 'Webhooks' },
  ]

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

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>
          {Icon.tag(12)} 仓库设置
        </span>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0, padding: '0 24px',
        borderBottom: '1px solid var(--mac-border)', background: 'var(--mac-surface)',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`detail-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="card-grid-scroll">
        <div style={{ padding: '20px 24px 48px', maxWidth: 640 }}>
          {activeTab === 'basic' && (
            <BasicInfoTab repoName={repoName} />
          )}
          {activeTab === 'topics' && (
            <TopicsTab repoName={repoName} />
          )}
          {activeTab === 'webhooks' && (
            <WebhooksTab repoName={repoName} />
          )}
        </div>
      </div>
    </div>
  )
}
