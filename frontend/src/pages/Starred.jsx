import React, { useState, useEffect, useCallback } from 'react'
import api from '../api'

export default function Starred({ onSelectRepo }) {
  const [repos, setRepos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('updated')

  const loadStarred = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get(`/api/github/user/starred?sort=${sort}&per_page=50`)
      setRepos(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load starred:', err)
      setRepos([])
    } finally {
      setLoading(false)
    }
  }, [sort])

  useEffect(() => { loadStarred() }, [loadStarred])

  const filtered = repos.filter(r =>
    !search || (r.full_name || r.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.description || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="animate-fade-in" style={{ padding: 20, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--mac-text)', margin: 0 }}>⭐ 星标项目</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索星标..."
            style={{
              background: 'var(--mac-bg)', border: '1px solid var(--mac-border)',
              borderRadius: 8, padding: '5px 10px', color: 'var(--mac-text)',
              fontSize: 12, outline: 'none', width: 160,
            }}
          />
          <select value={sort} onChange={e => setSort(e.target.value)} style={{
            background: 'var(--mac-surface)', border: '1px solid var(--mac-border)',
            borderRadius: 8, padding: '5px 8px', color: 'var(--mac-text)', fontSize: 12, outline: 'none',
          }}>
            <option value="updated">最近更新</option>
            <option value="created">最近创建</option>
            <option value="pushed">最近推送</option>
            <option value="full_name">名称排序</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--mac-text-secondary)', fontSize: 13 }}>加载中...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--mac-text-secondary)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⭐</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--mac-text)', marginBottom: 6 }}>还没有星标项目</div>
          <div style={{ fontSize: 12 }}>去 GitHub 上发现感兴趣的项目吧</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {filtered.map((repo, i) => (
            <div
              key={i}
              onClick={() => onSelectRepo?.(repo.name)}
              style={{
                background: 'var(--mac-surface)', backdropFilter: 'var(--mac-blur)',
                border: '1px solid var(--mac-border)', borderRadius: 12,
                padding: 14, cursor: 'pointer',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--mac-shadow-lg)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <img src={repo.owner?.avatar_url} alt="" style={{ width: 20, height: 20, borderRadius: '50%' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mac-accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {repo.full_name || repo.name}
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--mac-text-secondary)', margin: '0 0 10px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {repo.description || '暂无描述'}
              </p>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                {repo.language && <span>🔵 {repo.language}</span>}
                <span>⭐ {repo.stargazers_count || 0}</span>
                <span>🍴 {repo.forks_count || 0}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
