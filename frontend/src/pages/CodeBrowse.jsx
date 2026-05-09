import { useState, useEffect } from 'react'
import { Icon } from '../App'
import api from '../api'

function FolderIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} fill="var(--mac-accent)" viewBox="0 0 24 24">
      <path d="M2 6a2 2 0 012-2h5l2 2h9a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
  )
}

function FileIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="var(--mac-text-secondary)" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function FileViewer({ content, filename, path, onBack }) {
  const lines = content ? content.split('\n') : []

  return (
    <div className="glass animate-fade-in" style={{ padding: 0, overflow: 'hidden' }}>
      {/* File header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
        borderBottom: '1px solid var(--mac-border)', background: 'var(--mac-surface-hover)',
      }}>
        <button className="btn-icon" onClick={onBack} title="返回目录">
          {Icon.back(14)}
        </button>
        <span style={{ color: 'var(--mac-text-secondary)' }}>{FileIcon(14)}</span>
        <code style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 500 }}>{filename}</code>
        <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)', marginLeft: 'auto' }}>
          {lines.length} 行
        </span>
      </div>

      {/* Code content */}
      <div style={{
        maxHeight: 'calc(100vh - 300px)', overflow: 'auto', padding: 0,
      }}>
        {lines.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--mac-text-secondary)', fontSize: 13 }}>
            文件内容为空
          </div>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} style={{
                  fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
                  fontSize: 12, lineHeight: '20px',
                }}>
                  <td style={{
                    padding: '0 12px', textAlign: 'right', color: 'var(--mac-text-secondary)',
                    userSelect: 'none', width: 50, verticalAlign: 'top',
                    borderRight: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
                    fontSize: 11,
                  }}>
                    {i + 1}
                  </td>
                  <td style={{
                    padding: '0 16px', whiteSpace: 'pre', color: 'var(--mac-text)',
                    verticalAlign: 'top',
                  }}>
                    {line || ' '}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default function CodeBrowse({ githubRepos }) {
  const [selectedRepo, setSelectedRepo] = useState('')
  const [branch, setBranch] = useState('')
  const [branches, setBranches] = useState([])
  const [path, setPath] = useState([])
  const [contents, setContents] = useState([])
  const [loading, setLoading] = useState(false)
  const [viewFile, setViewFile] = useState(null) // { name, path, content }
  const [loadingFile, setLoadingFile] = useState(false)

  const repoName = selectedRepo || (githubRepos.length > 0 ? githubRepos[0].name : '')

  // Load branches when repo changes
  useEffect(() => {
    if (!repoName) return
    api.get(`/api/github/repos/${repoName}/branches`).then(data => {
      const brList = data || []
      setBranches(brList)
      if (brList.length > 0 && !branch) {
        const defaultBr = brList.find(b => b.default) || brList[0]
        setBranch(defaultBr.name)
      }
    }).catch(() => {})
  }, [repoName])

  // Load contents when path or branch changes
  useEffect(() => {
    if (!repoName || !branch) return
    setLoading(true)
    setViewFile(null)
    const currentPath = path.join('/')
    api.get(`/api/github/repos/${repoName}/contents/${currentPath}?ref=${branch}`)
      .then(data => {
        setContents(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => {
        setContents([])
        setLoading(false)
      })
  }, [repoName, branch, path.join('/')])

  const handleRepoChange = (newRepo) => {
    setSelectedRepo(newRepo)
    setPath([])
    setBranch('')
    setViewFile(null)
  }

  const handleBranchChange = (newBranch) => {
    setBranch(newBranch)
    setPath([])
    setViewFile(null)
  }

  const handleDirClick = (item) => {
    setPath(prev => [...prev, item.name])
    setViewFile(null)
  }

  const handleBreadcrumbClick = (index) => {
    setPath(prev => prev.slice(0, index))
    setViewFile(null)
  }

  const handleFileClick = async (item) => {
    if (item.type !== 'file') return
    setLoadingFile(true)
    try {
      const filePath = [...path, item.name].join('/')
      const data = await api.get(`/api/github/repos/${repoName}/contents/${filePath}?ref=${branch}`)
      let fileContent = ''
      if (data && data.content) {
        fileContent = decodeURIComponent(escape(atob(data.content)))
      }
      setViewFile({ name: item.name, path: filePath, content: fileContent })
    } catch (err) {
      setViewFile({ name: item.name, path: [...path, item.name].join('/'), content: '无法加载文件内容' })
    } finally {
      setLoadingFile(false)
    }
  }

  const sortedContents = [...contents].sort((a, b) => {
    if (a.type === 'dir' && b.type !== 'dir') return -1
    if (a.type !== 'dir' && b.type === 'dir') return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div>
      {/* Sort & Filter Bar */}
      <div className="sort-bar">
        {/* Repo selector */}
        <select
          value={repoName}
          onChange={e => handleRepoChange(e.target.value)}
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

        {/* Branch selector */}
        {branches.length > 0 && (
          <select
            value={branch}
            onChange={e => handleBranchChange(e.target.value)}
            style={{
              padding: '4px 8px', borderRadius: 6, border: '1px solid var(--mac-border)',
              background: 'var(--mac-bg)', fontSize: 12, color: 'var(--mac-text)',
              outline: 'none', cursor: 'pointer',
            }}
          >
            {branches.map(b => (
              <option key={b.name} value={b.name}>{b.name}</option>
            ))}
          </select>
        )}

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>
          {Icon.code(12)} 代码浏览
        </span>
      </div>

      {/* Breadcrumb */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '8px 24px',
        borderBottom: '1px solid var(--mac-border)', background: 'var(--mac-surface)',
        fontSize: 12, flexWrap: 'wrap',
      }}>
        <span
          onClick={() => handleBreadcrumbClick(0)}
          style={{
            color: 'var(--mac-accent)', cursor: 'pointer', fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 3,
          }}
        >
          {Icon.github(13)} {repoName}
        </span>
        {path.map((segment, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'var(--mac-text-secondary)' }}>/</span>
            <span
              onClick={() => handleBreadcrumbClick(i + 1)}
              style={{
                color: i === path.length - 1 ? 'var(--mac-text)' : 'var(--mac-accent)',
                cursor: 'pointer', fontWeight: i === path.length - 1 ? 600 : 400,
              }}
            >
              {segment}
            </span>
          </span>
        ))}
      </div>

      {/* Content */}
      <div className="card-grid-scroll">
        <div style={{ padding: '16px 24px 48px' }}>
          {loadingFile ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--mac-text-secondary)', gap: 8 }}>
              <span style={{ animation: 'pulse-dot 1s infinite' }}>&#9679;</span> 加载文件中...
            </div>
          ) : viewFile ? (
            <FileViewer
              content={viewFile.content}
              filename={viewFile.name}
              path={viewFile.path}
              onBack={() => setViewFile(null)}
            />
          ) : loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--mac-text-secondary)', gap: 8 }}>
              <span style={{ animation: 'pulse-dot 1s infinite' }}>&#9679;</span> 加载中...
            </div>
          ) : sortedContents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 64, color: 'var(--mac-text-secondary)' }}>
              <div style={{ fontSize: 36, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{Icon.code(36)}</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>此目录为空</div>
            </div>
          ) : (
            <div className="glass" style={{ overflow: 'hidden' }}>
              {sortedContents.map((item, idx) => (
                <div
                  key={item.name}
                  className="detail-row"
                  style={{
                    cursor: item.type === 'dir' ? 'pointer' : 'pointer',
                    borderRadius: idx === 0 ? 'var(--mac-radius) var(--mac-radius) 0 0' : idx === sortedContents.length - 1 ? '0 0 var(--mac-radius) var(--mac-radius)' : 0,
                  }}
                  onClick={() => item.type === 'dir' ? handleDirClick(item) : handleFileClick(item)}
                >
                  {item.type === 'dir' ? (
                    <span style={{ color: 'var(--mac-accent)' }}>{FolderIcon(16)}</span>
                  ) : (
                    <span>{FileIcon(16)}</span>
                  )}
                  <span style={{
                    flex: 1, fontSize: 13, fontWeight: item.type === 'dir' ? 500 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.name}
                  </span>
                  {item.type === 'file' && item.size !== undefined && (
                    <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)', flexShrink: 0 }}>
                      {item.size < 1024 ? `${item.size} B` : item.size < 1048576 ? `${(item.size / 1024).toFixed(1)} KB` : `${(item.size / 1048576).toFixed(1)} MB`}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
