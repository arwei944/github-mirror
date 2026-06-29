import React, { useState, useEffect, useCallback } from 'react'
import api from '../api'

// Simple in-memory + localStorage cache for descriptions
const TRANSLATE_CACHE_KEY = 'github-mirror-starred-translations'

function getTranslations() {
  try {
    const raw = localStorage.getItem(TRANSLATE_CACHE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function setTranslations(obj) {
  try {
    localStorage.setItem(TRANSLATE_CACHE_KEY, JSON.stringify(obj))
  } catch {}
}

async function translateToZh(text) {
  if (!text || text.trim().length === 0) return text
  const cache = getTranslations()
  const key = text.trim().toLowerCase()
  if (cache[key]) return cache[key]

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-CN`
    const res = await fetch(url)
    const data = await res.json()
    const translated = data?.responseData?.translatedText || text
    if (translated && translated !== text) {
      cache[key] = translated
      setTranslations(cache)
      return translated
    }
  } catch (e) {
    // ignore translation failures
  }
  return text
}

const LANG_OPTIONS = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'ru', label: 'Русский' },
]

export default function Starred({ onSelectRepo }) {
  const [repos, setRepos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('updated')
  const [page, setPage] = useState(1)
  const [targetLang, setTargetLang] = useState(() => localStorage.getItem('github-mirror-starred-lang') || 'zh-CN')
  const [translating, setTranslating] = useState(false)
  const [translations, setTranslationsLocal] = useState(() => getTranslations())

  const PER_PAGE = 20

  const loadStarred = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get(`/api/github/user/starred?sort=${sort}&per_page=100`)
      setRepos(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load starred:', err)
      setRepos([])
    } finally {
      setLoading(false)
    }
  }, [sort])

  useEffect(() => { loadStarred() }, [loadStarred])

  useEffect(() => {
    localStorage.setItem('github-mirror-starred-lang', targetLang)
  }, [targetLang])

  // Translate descriptions when repos change
  useEffect(() => {
    let cancelled = false
    const cache = getTranslations()
    const missing = repos.filter(r => {
      const desc = r.description || ''
      if (!desc) return false
      const key = desc.trim().toLowerCase()
      const cached = cache[key]
      // 兼容旧版字符串缓存，非当前目标语言时重新翻译
      if (!cached) return true
      if (typeof cached === 'string') return targetLang !== 'zh-CN'
      if (typeof cached === 'object' && cached.lang === targetLang) return false
      return true
    })

    if (missing.length === 0) {
      setTranslationsLocal(cache)
      return
    }

    ;(async () => {
      setTranslating(true)
      const updated = { ...cache }
      const batchSize = 5
      const delayMs = 600

      for (let i = 0; i < missing.length; i += batchSize) {
        if (cancelled) return
        const batch = missing.slice(i, i + batchSize)

        await Promise.all(batch.map(async (repo) => {
          const desc = repo.description || ''
          const key = desc.trim().toLowerCase()
          if (updated[key] && typeof updated[key] === 'object' && updated[key].lang === targetLang) return

          try {
            const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(desc)}&langpair=en|${targetLang}`
            const res = await fetch(url)
            const data = await res.json()
            const translated = data?.responseData?.translatedText || desc
            updated[key] = { lang: targetLang, text: translated }
          } catch (e) {
            updated[key] = { lang: targetLang, text: desc }
          }
        }))

        if (i + batchSize < missing.length && !cancelled) {
          await new Promise(r => setTimeout(r, delayMs))
        }
      }

      if (!cancelled) {
        setTranslations(updated)
        setTranslationsLocal(updated)
      }
      setTranslating(false)
    })()

    return () => { cancelled = true }
  }, [repos, targetLang])

  const filtered = repos.filter(r => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    const desc = r.description || ''
    const descKey = desc.toLowerCase()
    const translatedDesc = getTranslatedText(desc) || descKey
    return (
      (r.full_name || r.name || '').toLowerCase().includes(q) ||
      descKey.includes(q) ||
      translatedDesc.toLowerCase().includes(q)
    )
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PER_PAGE
  const pageItems = filtered.slice(start, start + PER_PAGE)

  useEffect(() => {
    if (page !== safePage) setPage(safePage)
  }, [safePage, page])

  useEffect(() => { setPage(1) }, [search, sort, targetLang])

  const getTranslatedText = (desc) => {
    if (!desc) return ''
    const key = desc.trim().toLowerCase()
    const cached = translations[key]
    if (!cached) return ''
    if (typeof cached === 'string') return cached
    if (typeof cached === 'object' && cached.text) return cached.text
    return ''
  }

  const getDisplayDescription = (repo) => {
    const desc = repo.description || '暂无描述'
    if (!repo.description) return desc
    return getTranslatedText(desc) || desc
  }

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
          <select value={targetLang} onChange={e => setTargetLang(e.target.value)} style={{
            background: 'var(--mac-surface)', border: '1px solid var(--mac-border)',
            borderRadius: 8, padding: '5px 8px', color: 'var(--mac-text)', fontSize: 12, outline: 'none',
          }}>
            {LANG_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {translating && (
            <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>翻译中...</span>
          )}
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
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {pageItems.map((repo, i) => (
              <div
                key={repo.id || i}
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
                  {getDisplayDescription(repo)}
                </p>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                  {repo.language && <span>🔵 {repo.language}</span>}
                  <span>⭐ {repo.stargazers_count || 0}</span>
                  <span>🍴 {repo.forks_count || 0}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, marginTop: 18, paddingBottom: 8,
          }}>
            <button
              disabled={safePage <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 12,
                border: '1px solid var(--mac-border)',
                background: safePage <= 1 ? 'var(--mac-bg)' : 'var(--mac-surface)',
                color: safePage <= 1 ? 'var(--mac-text-secondary)' : 'var(--mac-text)',
                cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              上一页
            </button>
            <span style={{ fontSize: 12, color: 'var(--mac-text-secondary)' }}>
              {safePage} / {totalPages}
            </span>
            <button
              disabled={safePage >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 12,
                border: '1px solid var(--mac-border)',
                background: safePage >= totalPages ? 'var(--mac-bg)' : 'var(--mac-surface)',
                color: safePage >= totalPages ? 'var(--mac-text-secondary)' : 'var(--mac-text)',
                cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              下一页
            </button>
          </div>
        </>
      )}
    </div>
  )
}
