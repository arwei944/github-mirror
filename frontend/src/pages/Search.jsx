import { useState, useCallback } from 'react'
import { Icon } from '../App'
import api from '../api'

const SEARCH_TYPES = [
  { key: 'repos', label: '仓库' },
  { key: 'code', label: '代码' },
  { key: 'issues', label: 'Issues' },
  { key: 'commits', label: '提交' },
  { key: 'users', label: '用户' },
]

function highlightMatch(text, query) {
  if (!query || !text) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <span>
      {text.slice(0, idx)}
      <span style={{ background: 'rgba(255,204,0,0.3)', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </span>
  )
}

function RepoResult({ repo, query, onSelectRepo }) {
  return (
    <div
      className="glass animate-fade-in"
      style={{
        padding: '14px 16px', cursor: 'pointer',
        transition: 'box-shadow 0.15s, transform 0.15s',
      }}
      onClick={() => onSelectRepo && onSelectRepo(repo.name)}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--mac-shadow-lg)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--mac-shadow)'; e.currentTarget.style.transform = 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ color: 'var(--mac-text-secondary)', flexShrink: 0, marginTop: 2 }}>{Icon.github(18)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {highlightMatch(repo.name, query)}
            </span>
            {repo.visibility === 'private' && (
              <span style={{ color: 'var(--mac-text-secondary)', fontSize: 11 }}>{Icon.lock(10)}</span>
            )}
          </div>
          {repo.description && (
            <div style={{
              fontSize: 12, color: 'var(--mac-text-secondary)', marginTop: 4,
              lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {highlightMatch(repo.description, query)}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, fontSize: 11, color: 'var(--mac-text-secondary)' }}>
            {repo.language && <span>{repo.language}</span>}
            {repo.stargazers_count > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>{Icon.star(11)} {repo.stargazers_count}</span>
            )}
            {repo.forks_count > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>{Icon.fork(11)} {repo.forks_count}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CodeResult({ item, query }) {
  return (
    <div className="glass animate-fade-in" style={{ padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ color: 'var(--mac-text-secondary)', flexShrink: 0, marginTop: 2 }}>{Icon.code(16)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>
              {highlightMatch(item.name, query)}
            </span>
            <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>
              in {item.repo_name || item.repository?.full_name || ''}
            </span>
          </div>
          {item.path && (
            <div style={{ fontSize: 11, color: 'var(--mac-text-secondary)', marginTop: 2, fontFamily: 'monospace' }}>
              {item.path}
            </div>
          )}
          {item.text_matches && item.text_matches.length > 0 && (
            <div style={{
              marginTop: 6, padding: '6px 10px', borderRadius: 6,
              background: 'var(--mac-bg)', fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
              fontSize: 11, lineHeight: 1.5, overflow: 'hidden',
              maxHeight: 60, overflowY: 'auto',
            }}>
              {item.text_matches.slice(0, 2).map((match, i) => (
                <div key={i} style={{ marginBottom: i < 1 ? 4 : 0 }}>
                  {highlightMatch(match.fragment, query)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function IssueResult({ item, query }) {
  const isOpen = item.state === 'open'
  return (
    <div className="glass animate-fade-in" style={{ padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ color: isOpen ? 'var(--mac-green)' : 'var(--mac-red)', flexShrink: 0, marginTop: 2 }}>{Icon.issue(16)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {highlightMatch(item.title, query)}
            </span>
            <span style={{
              fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 600,
              background: isOpen ? 'rgba(52,199,89,0.12)' : 'rgba(255,59,48,0.12)',
              color: isOpen ? 'var(--mac-green)' : 'var(--mac-red)',
            }}>
              {isOpen ? '待处理' : '已关闭'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--mac-text-secondary)', marginTop: 2 }}>
            <span>#{item.number}</span>
            {item.repository_url && (
              <span style={{ marginLeft: 8 }}>
                in {item.repository_url.split('/').slice(-2).join('/')}
              </span>
            )}
          </div>
          {item.body && (
            <div style={{
              fontSize: 12, color: 'var(--mac-text-secondary)', marginTop: 4,
              lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {item.body.slice(0, 200)}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 11, color: 'var(--mac-text-secondary)' }}>
            {item.user && <span>{item.user.login}</span>}
            {item.comments !== undefined && <span>{item.comments} 条评论</span>}
            {item.updated_at && <span>更新于 {new Date(item.updated_at).toLocaleDateString('zh-CN')}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

function CommitResult({ item, query }) {
  return (
    <div className="glass animate-fade-in" style={{ padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ color: 'var(--mac-text-secondary)', flexShrink: 0, marginTop: 2 }}>{Icon.commit(16)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <code style={{
              fontSize: 12, fontFamily: 'monospace', padding: '1px 6px', borderRadius: 4,
              background: 'var(--mac-gray)', color: 'var(--mac-accent)', flexShrink: 0,
            }}>
              {item.sha ? item.sha.slice(0, 7) : '?'}
            </code>
            <span style={{ fontSize: 12, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {highlightMatch(item.commit?.message || item.message || '', query)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 11, color: 'var(--mac-text-secondary)' }}>
            {item.commit?.author?.name && <span>{item.commit.author.name}</span>}
            {item.html_url && (
              <span>
                in {item.html_url.split('/').slice(-3, -1).join('/')}
              </span>
            )}
            {item.commit?.author?.date && (
              <span>{new Date(item.commit.author.date).toLocaleDateString('zh-CN')}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function UserResult({ item, query }) {
  return (
    <div className="glass animate-fade-in" style={{ padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {item.avatar_url && (
          <img src={item.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {highlightMatch(item.login, query)}
            </span>
            {item.type && (
              <span style={{
                fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 600,
                background: 'var(--mac-gray)', color: 'var(--mac-text-secondary)',
              }}>
                {item.type}
              </span>
            )}
            {item.score !== undefined && (
              <span style={{ fontSize: 10, color: 'var(--mac-text-secondary)' }}>
                评分: {typeof item.score === 'number' ? item.score.toFixed(2) : item.score}
              </span>
            )}
          </div>
          {item.html_url && (
            <a href={item.html_url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, color: 'var(--mac-accent)', textDecoration: 'none', marginTop: 2, display: 'inline-block' }}>
              {item.html_url}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Search({ githubRepos, onSelectRepo }) {
  const [query, setQuery] = useState('')
  const [searchType, setSearchType] = useState('repos')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setSearching(true)
    setSearched(true)
    try {
      if (searchType === 'repos') {
        // Local search in githubRepos
        const q = query.toLowerCase()
        const filtered = githubRepos.filter(r =>
          r.name.toLowerCase().includes(q) ||
          (r.description || '').toLowerCase().includes(q) ||
          (r.language || '').toLowerCase().includes(q)
        )
        setResults(filtered)
      } else if (searchType === 'issues') {
        const data = await api.get(`/api/github/search/issues?q=${encodeURIComponent(query)}`).catch(() => [])
        setResults(data?.items || data || [])
      } else if (searchType === 'commits') {
        const data = await api.get(`/api/github/search/commits?q=${encodeURIComponent(query)}`).catch(() => [])
        // 后端返回 { total_count, items: [{ sha, sha_full, message, author, date, html_url }] }
        // 前端 CommitResult 期望 { sha, commit: { message, author: { name, date } }, html_url }
        const items = data?.items || data || []
        setResults(items.map(i => ({
          sha: i.sha_full || i.sha,
          commit: {
            message: i.message || '',
            author: {
              name: i.author || '',
              date: i.date || '',
            },
          },
          html_url: i.html_url,
        })))
      } else if (searchType === 'users') {
        const data = await api.get(`/api/github/search/users?q=${encodeURIComponent(query)}`).catch(() => [])
        setResults(data?.items || data || [])
      } else {
        // API search for code
        const data = await api.get(`/api/github/search/code?q=${encodeURIComponent(query)}`).catch(() => [])
        setResults(data?.items || data || [])
      }
    } catch (err) {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [query, searchType, githubRepos])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Search header */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 80, paddingBottom: 32, gap: 16,
        background: 'var(--mac-surface)',
        borderBottom: '1px solid var(--mac-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--mac-text-secondary)' }}>
          {Icon.search(20)}
          <span style={{ fontSize: 14, fontWeight: 500 }}>全局搜索</span>
        </div>

        {/* Search type selector */}
        <div style={{ display: 'flex', gap: 4 }}>
          {SEARCH_TYPES.map(t => (
            <button
              key={t.key}
              className={`sort-btn ${searchType === t.key ? 'active' : ''}`}
              onClick={() => { setSearchType(t.key); setSearched(false); setResults([]) }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', width: 480, maxWidth: '90vw' }}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={searchType === 'repos' ? '搜索仓库...' : searchType === 'issues' ? '搜索 Issues...' : searchType === 'commits' ? '搜索提交...' : searchType === 'users' ? '搜索用户...' : '搜索代码...'}
            autoFocus
            style={{
              width: '100%', padding: '12px 16px 12px 40px', borderRadius: 12,
              border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
              fontSize: 15, color: 'var(--mac-text)', outline: 'none',
              boxShadow: 'var(--mac-shadow-lg)',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--mac-accent)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--mac-border)'}
          />
          <span style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--mac-text-secondary)',
          }}>
            {Icon.search(18)}
          </span>
          <button
            className="btn-primary"
            onClick={handleSearch}
            disabled={!query.trim() || searching}
            style={{
              position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
              padding: '6px 14px', fontSize: 12,
            }}
          >
            {searching ? '搜索中...' : '搜索'}
          </button>
        </div>
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 48px' }}>
        {!searched ? (
          <div style={{ textAlign: 'center', padding: 64, color: 'var(--mac-text-secondary)' }}>
            <div style={{ fontSize: 48, marginBottom: 12, display: 'flex', justifyContent: 'center', opacity: 0.3 }}>
              {Icon.search(48)}
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--mac-text)' }}>搜索 GitHub 镜像仓库</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>输入关键词搜索仓库或代码</div>
          </div>
        ) : searching ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--mac-text-secondary)', gap: 8 }}>
            <span style={{ animation: 'pulse-dot 1s infinite' }}>&#9679;</span> 搜索中...
          </div>
        ) : results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 64, color: 'var(--mac-text-secondary)' }}>
            <div style={{ fontSize: 36, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{Icon.search(36)}</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>没有找到匹配结果</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>试试其他关键词</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12, color: 'var(--mac-text-secondary)', marginBottom: 12 }}>
              找到 {results.length} 个结果
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {searchType === 'repos' ? (
                results.map(repo => (
                  <RepoResult key={repo.name} repo={repo} query={query} onSelectRepo={onSelectRepo} />
                ))
              ) : searchType === 'issues' ? (
                results.map((item, idx) => (
                  <IssueResult key={item.id || idx} item={item} query={query} />
                ))
              ) : searchType === 'commits' ? (
                results.map((item, idx) => (
                  <CommitResult key={item.sha || idx} item={item} query={query} />
                ))
              ) : searchType === 'users' ? (
                results.map((item, idx) => (
                  <UserResult key={item.id || idx} item={item} query={query} />
                ))
              ) : (
                results.map((item, idx) => (
                  <CodeResult key={item.id || idx} item={item} query={query} />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
