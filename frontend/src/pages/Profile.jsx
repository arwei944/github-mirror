import { useState, useEffect } from 'react'
import { Icon } from '../App'
import api from '../api'

function ProgressBar({ label, remaining, total, color }) {
  const pct = total > 0 ? Math.min((remaining / total) * 100, 100) : 0
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: 'var(--mac-text)' }}>{label}</span>
        <span style={{ color: 'var(--mac-text-secondary)' }}>{remaining} / {total}</span>
      </div>
      <div style={{
        width: '100%', height: 6, borderRadius: 3,
        background: 'var(--mac-gray)', overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 3,
          background: color || 'var(--mac-accent)',
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  )
}

function formatResetTime(resetAt) {
  if (!resetAt) return ''
  const d = new Date(resetAt * 1000)
  return d.toLocaleString('zh-CN')
}

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [rateLimit, setRateLimit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: '',
    bio: '',
    company: '',
    location: '',
    blog: '',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  // SSH keys
  const [sshKeys, setSshKeys] = useState([])
  const [sshLoading, setSshLoading] = useState(false)
  const [showAddSsh, setShowAddSsh] = useState(false)
  const [sshTitle, setSshTitle] = useState('')
  const [sshKey, setSshKey] = useState('')
  const [sshSaving, setSshSaving] = useState(false)

  // GPG keys
  const [gpgKeys, setGpgKeys] = useState([])
  const [gpgLoading, setGpgLoading] = useState(false)
  const [showAddGpg, setShowAddGpg] = useState(false)
  const [gpgArmoredKey, setGpgArmoredKey] = useState('')
  const [gpgSaving, setGpgSaving] = useState(false)

  const loadSshKeys = () => {
    setSshLoading(true)
    api.get('/api/github/user/keys').then(data => {
      setSshKeys(Array.isArray(data) ? data : [])
      setSshLoading(false)
    }).catch(() => {
      setSshKeys([])
      setSshLoading(false)
    })
  }

  const loadGpgKeys = () => {
    setGpgLoading(true)
    api.get('/api/github/user/gpg_keys').then(data => {
      setGpgKeys(Array.isArray(data) ? data : [])
      setGpgLoading(false)
    }).catch(() => {
      setGpgKeys([])
      setGpgLoading(false)
    })
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get('/api/github/user').catch(() => null),
      api.get('/api/github/rate_limit').catch(() => null),
    ]).then(([profileData, rateData]) => {
      setProfile(profileData)
      setRateLimit(rateData)
      if (profileData) {
        setForm({
          name: profileData.name || '',
          bio: profileData.bio || '',
          company: profileData.company || '',
          location: profileData.location || '',
          blog: profileData.blog || '',
        })
      }
      setLoading(false)
    })
    loadSshKeys()
    loadGpgKeys()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      const updated = await api.patch('/api/github/user', {
        name: form.name,
        bio: form.bio,
        company: form.company,
        location: form.location,
        blog: form.blog,
      })
      setProfile(updated)
      setEditing(false)
      setMessage('保存成功')
    } catch (err) {
      setMessage('保存失败: ' + (err.message || '未知错误'))
    } finally {
      setSaving(false)
    }
  }

  const handleAddSsh = async () => {
    if (!sshTitle.trim() || !sshKey.trim()) return
    setSshSaving(true)
    try {
      await api.post('/api/github/user/keys', { title: sshTitle, key: sshKey })
      setSshTitle('')
      setSshKey('')
      setShowAddSsh(false)
      loadSshKeys()
    } catch (err) {
      setMessage('添加 SSH 密钥失败: ' + (err.message || '未知错误'))
    } finally {
      setSshSaving(false)
    }
  }

  const handleDeleteSsh = async (id) => {
    if (!window.confirm('确定要删除此 SSH 密钥吗？')) return
    try {
      await api.del(`/api/github/user/keys/${id}`)
      loadSshKeys()
    } catch (err) {
      setMessage('删除 SSH 密钥失败: ' + (err.message || '未知错误'))
    }
  }

  const handleAddGpg = async () => {
    if (!gpgArmoredKey.trim()) return
    setGpgSaving(true)
    try {
      await api.post('/api/github/user/gpg_keys', { armored_public_key: gpgArmoredKey })
      setGpgArmoredKey('')
      setShowAddGpg(false)
      loadGpgKeys()
    } catch (err) {
      setMessage('添加 GPG 密钥失败: ' + (err.message || '未知错误'))
    } finally {
      setGpgSaving(false)
    }
  }

  const handleDeleteGpg = async (id) => {
    if (!window.confirm('确定要删除此 GPG 密钥吗？')) return
    try {
      await api.del(`/api/github/user/gpg_keys/${id}`)
      loadGpgKeys()
    } catch (err) {
      setMessage('删除 GPG 密钥失败: ' + (err.message || '未知错误'))
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--mac-text-secondary)', gap: 8 }}>
        <span style={{ animation: 'pulse-dot 1s infinite' }}>&#9679;</span> 加载中...
      </div>
    )
  }

  if (!profile) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--mac-text-secondary)' }}>
        无法加载用户信息
      </div>
    )
  }

  const coreRate = rateLimit?.resources?.core || {}
  const searchRate = rateLimit?.resources?.search || {}

  return (
    <div className="animate-fade-in" style={{ padding: '24px 24px 48px', maxWidth: 640 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, color: 'var(--mac-text-secondary)' }}>
        {Icon.users(20)}
        <span style={{ fontSize: 14, fontWeight: 500 }}>个人中心</span>
      </div>

      {/* Profile Card */}
      <div className="glass" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {profile.avatar_url && (
            <img src={profile.avatar_url} alt="" style={{
              width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
              border: '2px solid var(--mac-border)',
            }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
                {profile.name || profile.login}
              </h2>
              {profile.type && (
                <span style={{
                  fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 600,
                  background: 'var(--mac-gray)', color: 'var(--mac-text-secondary)',
                }}>
                  {profile.type}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--mac-text-secondary)', marginTop: 2 }}>
              @{profile.login}
            </div>
            {profile.bio && (
              <div style={{ fontSize: 13, color: 'var(--mac-text)', marginTop: 6, lineHeight: 1.5 }}>
                {profile.bio}
              </div>
            )}
          </div>
        </div>

        {/* Info fields */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px',
          marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--mac-border)',
        }}>
          {profile.company && (
            <div style={{ fontSize: 12, color: 'var(--mac-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ flexShrink: 0 }}>{Icon.public(13)}</span>
              {profile.company}
            </div>
          )}
          {profile.location && (
            <div style={{ fontSize: 12, color: 'var(--mac-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ flexShrink: 0 }}>{Icon.watch(13)}</span>
              {profile.location}
            </div>
          )}
          {profile.blog && (
            <div style={{ fontSize: 12, color: 'var(--mac-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ flexShrink: 0 }}>{Icon.external(13)}</span>
              <a href={profile.blog.startsWith('http') ? profile.blog : `https://${profile.blog}`}
                target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--mac-accent)', textDecoration: 'none' }}>
                {profile.blog}
              </a>
            </div>
          )}
          {profile.created_at && (
            <div style={{ fontSize: 12, color: 'var(--mac-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ flexShrink: 0 }}>{Icon.activity(13)}</span>
              加入于 {new Date(profile.created_at).toLocaleDateString('zh-CN')}
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{
          display: 'flex', gap: 16, marginTop: 16, paddingTop: 16,
          borderTop: '1px solid var(--mac-border)',
        }}>
          {[
            { label: '公开仓库', value: profile.public_repos },
            { label: '公开 Gists', value: profile.public_gists },
            { label: '关注者', value: profile.followers },
            { label: '关注中', value: profile.following },
          ].map(stat => (
            <div key={stat.label} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--mac-text)' }}>
                {stat.value ?? 0}
              </div>
              <div style={{ fontSize: 11, color: 'var(--mac-text-secondary)', marginTop: 2 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Form */}
      <div className="glass" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>编辑资料</span>
          {!editing ? (
            <button
              className="btn-secondary"
              onClick={() => setEditing(true)}
              style={{ fontSize: 12, padding: '4px 12px' }}
            >
              {Icon.code(12)} 编辑
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  setEditing(false)
                  setForm({
                    name: profile.name || '',
                    bio: profile.bio || '',
                    company: profile.company || '',
                    location: profile.location || '',
                    blog: profile.blog || '',
                  })
                  setMessage('')
                }}
                style={{ fontSize: 12, padding: '4px 12px' }}
              >
                取消
              </button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={saving}
                style={{ fontSize: 12, padding: '4px 12px' }}
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { key: 'name', label: '名称', placeholder: '你的名称' },
              { key: 'bio', label: '简介', placeholder: '简单介绍一下自己', multiline: true },
              { key: 'company', label: '公司', placeholder: '你所在的公司' },
              { key: 'location', label: '位置', placeholder: '你所在的位置' },
              { key: 'blog', label: '博客', placeholder: 'https://example.com' },
            ].map(field => (
              <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)' }}>
                  {field.label}
                </label>
                {field.multiline ? (
                  <textarea
                    value={form[field.key]}
                    onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    rows={3}
                    style={{
                      padding: '8px 12px', borderRadius: 'var(--mac-radius)',
                      border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
                      color: 'var(--mac-text)', fontSize: 13, outline: 'none',
                      resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5,
                    }}
                  />
                ) : (
                  <input
                    type="text"
                    value={form[field.key]}
                    onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    style={{
                      padding: '6px 12px', borderRadius: 'var(--mac-radius)',
                      border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
                      color: 'var(--mac-text)', fontSize: 13, outline: 'none',
                    }}
                  />
                )}
              </div>
            ))}

            {message && (
              <div style={{
                fontSize: 12, padding: '6px 12px', borderRadius: 'var(--mac-radius)',
                background: message.includes('失败') ? 'rgba(255,59,48,0.1)' : 'rgba(52,199,89,0.1)',
                color: message.includes('失败') ? 'var(--mac-red)' : 'var(--mac-green)',
              }}>
                {message}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
            {[
              { label: '名称', value: profile.name },
              { label: '简介', value: profile.bio },
              { label: '公司', value: profile.company },
              { label: '位置', value: profile.location },
              { label: '博客', value: profile.blog },
            ].map(field => (
              <div key={field.label}>
                <div style={{ fontSize: 11, color: 'var(--mac-text-secondary)', marginBottom: 2 }}>{field.label}</div>
                <div style={{ fontSize: 13, color: 'var(--mac-text)', wordBreak: 'break-all' }}>
                  {field.value || <span style={{ color: 'var(--mac-text-secondary)' }}>未设置</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Rate Limit */}
      <div className="glass" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          {Icon.zap(16)}
          <span style={{ fontSize: 14, fontWeight: 600 }}>API 速率限制</span>
        </div>

        {rateLimit ? (
          <div>
            <ProgressBar
              label="Core 请求"
              remaining={coreRate.remaining}
              total={coreRate.limit}
              color={coreRate.remaining > 100 ? 'var(--mac-green)' : coreRate.remaining > 20 ? 'var(--mac-orange)' : 'var(--mac-red)'}
            />
            {coreRate.reset && (
              <div style={{ fontSize: 11, color: 'var(--mac-text-secondary)', marginBottom: 12 }}>
                重置时间: {formatResetTime(coreRate.reset)}
              </div>
            )}

            <ProgressBar
              label="Search 请求"
              remaining={searchRate.remaining}
              total={searchRate.limit}
              color={searchRate.remaining > 10 ? 'var(--mac-green)' : searchRate.remaining > 3 ? 'var(--mac-orange)' : 'var(--mac-red)'}
            />
            {searchRate.reset && (
              <div style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                重置时间: {formatResetTime(searchRate.reset)}
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--mac-text-secondary)', fontSize: 13 }}>
            无法加载速率限制信息
          </div>
        )}
      </div>

      {/* SSH Keys */}
      <div className="glass" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {Icon.lock(16)}
            <span style={{ fontSize: 14, fontWeight: 600 }}>SSH 密钥</span>
          </div>
          <button
            className="btn-secondary"
            onClick={() => setShowAddSsh(!showAddSsh)}
            style={{ fontSize: 12, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {Icon.plus(12)} 添加
          </button>
        </div>

        {showAddSsh && (
          <div className="animate-fade-in" style={{
            marginBottom: 12, padding: 12, borderRadius: 'var(--mac-radius)',
            background: 'var(--mac-bg)', border: '1px solid var(--mac-border)',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)' }}>标题</label>
              <input
                type="text"
                value={sshTitle}
                onChange={e => setSshTitle(e.target.value)}
                placeholder="例如: My MacBook"
                style={{
                  padding: '6px 12px', borderRadius: 'var(--mac-radius)',
                  border: '1px solid var(--mac-border)', background: 'var(--mac-surface)',
                  color: 'var(--mac-text)', fontSize: 13, outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)' }}>公钥</label>
              <textarea
                value={sshKey}
                onChange={e => setSshKey(e.target.value)}
                placeholder="ssh-rsa AAAA..."
                rows={4}
                style={{
                  padding: '8px 12px', borderRadius: 'var(--mac-radius)',
                  border: '1px solid var(--mac-border)', background: 'var(--mac-surface)',
                  color: 'var(--mac-text)', fontSize: 12, outline: 'none',
                  resize: 'vertical', fontFamily: 'monospace', lineHeight: 1.5,
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="btn-secondary"
                onClick={() => { setShowAddSsh(false); setSshTitle(''); setSshKey('') }}
                style={{ fontSize: 12, padding: '4px 12px' }}
              >
                取消
              </button>
              <button
                className="btn-primary"
                onClick={handleAddSsh}
                disabled={sshSaving || !sshTitle.trim() || !sshKey.trim()}
                style={{ fontSize: 12, padding: '4px 12px' }}
              >
                {sshSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        )}

        {sshLoading ? (
          <div style={{ textAlign: 'center', padding: 16, color: 'var(--mac-text-secondary)', fontSize: 13 }}>
            <span style={{ animation: 'pulse-dot 1s infinite' }}>&#9679;</span> 加载中...
          </div>
        ) : sshKeys.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 16, color: 'var(--mac-text-secondary)', fontSize: 13 }}>
            暂无 SSH 密钥
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sshKeys.map(k => (
              <div key={k.id} style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'var(--mac-bg)', border: '1px solid var(--mac-border)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--mac-text)', marginBottom: 2 }}>
                    {k.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--mac-text-secondary)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {k.key ? (k.key.length > 40 ? k.key.substring(0, 40) + '...' : k.key) : ''}
                  </div>
                  {k.created_at && (
                    <div style={{ fontSize: 10, color: 'var(--mac-text-secondary)', marginTop: 2 }}>
                      添加于 {new Date(k.created_at).toLocaleDateString('zh-CN')}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteSsh(k.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--mac-text-secondary)', display: 'flex', alignItems: 'center', padding: 4,
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--mac-red)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--mac-text-secondary)'}
                  title="删除"
                >
                  {Icon.trash(14)}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* GPG Keys */}
      <div className="glass" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {Icon.lock(16)}
            <span style={{ fontSize: 14, fontWeight: 600 }}>GPG 密钥</span>
          </div>
          <button
            className="btn-secondary"
            onClick={() => setShowAddGpg(!showAddGpg)}
            style={{ fontSize: 12, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {Icon.plus(12)} 添加
          </button>
        </div>

        {showAddGpg && (
          <div className="animate-fade-in" style={{
            marginBottom: 12, padding: 12, borderRadius: 'var(--mac-radius)',
            background: 'var(--mac-bg)', border: '1px solid var(--mac-border)',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)' }}>GPG 公钥 (Armored)</label>
              <textarea
                value={gpgArmoredKey}
                onChange={e => setGpgArmoredKey(e.target.value)}
                placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----&#10;...&#10;-----END PGP PUBLIC KEY BLOCK-----"
                rows={6}
                style={{
                  padding: '8px 12px', borderRadius: 'var(--mac-radius)',
                  border: '1px solid var(--mac-border)', background: 'var(--mac-surface)',
                  color: 'var(--mac-text)', fontSize: 12, outline: 'none',
                  resize: 'vertical', fontFamily: 'monospace', lineHeight: 1.5,
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="btn-secondary"
                onClick={() => { setShowAddGpg(false); setGpgArmoredKey('') }}
                style={{ fontSize: 12, padding: '4px 12px' }}
              >
                取消
              </button>
              <button
                className="btn-primary"
                onClick={handleAddGpg}
                disabled={gpgSaving || !gpgArmoredKey.trim()}
                style={{ fontSize: 12, padding: '4px 12px' }}
              >
                {gpgSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        )}

        {gpgLoading ? (
          <div style={{ textAlign: 'center', padding: 16, color: 'var(--mac-text-secondary)', fontSize: 13 }}>
            <span style={{ animation: 'pulse-dot 1s infinite' }}>&#9679;</span> 加载中...
          </div>
        ) : gpgKeys.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 16, color: 'var(--mac-text-secondary)', fontSize: 13 }}>
            暂无 GPG 密钥
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {gpgKeys.map(k => (
              <div key={k.id} style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'var(--mac-bg)', border: '1px solid var(--mac-border)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <code style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--mac-accent)' }}>
                      {k.key_id ? (k.key_id.length > 16 ? k.key_id.substring(0, 16) + '...' : k.key_id) : 'N/A'}
                    </code>
                    {k.can_sign && (
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 6, background: 'rgba(52,199,89,0.12)', color: 'var(--mac-green)', fontWeight: 500 }}>
                        可签名
                      </span>
                    )}
                    {k.can_encrypt_comms && (
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 6, background: 'rgba(0,122,255,0.12)', color: 'var(--mac-accent)', fontWeight: 500 }}>
                        可加密
                      </span>
                    )}
                  </div>
                  {k.emails && Array.isArray(k.emails) && k.emails.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                      {k.emails.map(e => e.email).join(', ')}
                    </div>
                  )}
                  {k.created_at && (
                    <div style={{ fontSize: 10, color: 'var(--mac-text-secondary)', marginTop: 2 }}>
                      添加于 {new Date(k.created_at).toLocaleDateString('zh-CN')}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteGpg(k.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--mac-text-secondary)', display: 'flex', alignItems: 'center', padding: 4,
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--mac-red)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--mac-text-secondary)'}
                  title="删除"
                >
                  {Icon.trash(14)}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
