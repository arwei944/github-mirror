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

function FileViewer({ content, filename, path, onBack, onEdit, onDelete, repoName, branch, sha }) {
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(content || '')
  const [commitMsg, setCommitMsg] = useState('更新 ' + filename)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const lines = content ? content.split('\n') : []

  const handleSave = async () => {
    if (!commitMsg.trim()) return
    setSaving(true)
    setMessage('')
    try {
      // Backend handles base64 encoding, send raw content
      await api.put('/api/github/repos/' + repoName + '/contents/' + path, {
        message: commitMsg,
        content: editContent,
        sha: sha,
        branch: branch,
      })
      setMessage('保存成功')
      setEditing(false)
      if (onEdit) onEdit(editContent)
    } catch (err) {
      setMessage('保存失败: ' + (err.message || '未知错误'))
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditing(false)
    setEditContent(content || '')
    setMessage('')
  }

  const handleDelete = async () => {
    if (!window.confirm('确定要删除文件 "' + filename + '" 吗？此操作不可撤销。')) return
    try {
      await api.del('/api/github/repos/' + repoName + '/contents/' + path + '?message=删除 ' + filename + '&sha=' + sha + '&branch=' + branch)
      setMessage('删除成功')
      setTimeout(() => onBack(), 500)
    } catch (err) {
      setMessage('删除失败: ' + (err.message || '未知错误'))
    }
  }

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
        <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)', marginLeft: 4 }}>
          {lines.length} 行
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {!editing && (
            <>
              <button
                className="btn-secondary"
                onClick={() => { setEditing(true); setEditContent(content || ''); setCommitMsg('更新 ' + filename); setMessage('') }}
                style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '3px 10px' }}
              >
                {Icon.code(11)} 编辑
              </button>
              <button
                className="btn-secondary"
                onClick={handleDelete}
                style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '3px 10px', color: 'var(--mac-red)' }}
              >
                {Icon.trash(11)} 删除文件
              </button>
            </>
          )}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          fontSize: 12, padding: '6px 16px',
          background: message.includes('失败') ? 'rgba(255,59,48,0.1)' : 'rgba(52,199,89,0.1)',
          color: message.includes('失败') ? 'var(--mac-red)' : 'var(--mac-green)',
        }}>
          {message}
        </div>
      )}

      {/* Edit mode */}
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--mac-border)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--mac-text-secondary)', flexShrink: 0 }}>提交信息:</span>
            <input
              type="text"
              value={commitMsg}
              onChange={e => setCommitMsg(e.target.value)}
              style={{
                flex: 1, padding: '4px 10px', borderRadius: 'var(--mac-radius)',
                border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
                color: 'var(--mac-text)', fontSize: 12, outline: 'none',
              }}
            />
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={saving || !commitMsg.trim()}
              style={{ fontSize: 12, padding: '4px 14px' }}
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              className="btn-secondary"
              onClick={handleCancel}
              style={{ fontSize: 12, padding: '4px 14px' }}
            >
              取消
            </button>
          </div>
          <textarea
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%', minHeight: 400, maxHeight: 'calc(100vh - 380px)',
              padding: '12px 16px', border: 'none', outline: 'none',
              background: 'var(--mac-bg)', color: 'var(--mac-text)',
              fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
              fontSize: 12, lineHeight: '20px', resize: 'vertical', tabSize: 2,
            }}
          />
        </div>
      ) : (
        /* Read-only code content */
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
      )}
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
  const [viewFile, setViewFile] = useState(null) // { name, path, content, sha }
  const [loadingFile, setLoadingFile] = useState(false)
  const [showNewFileModal, setShowNewFileModal] = useState(false)
  const [newFileForm, setNewFileForm] = useState({ path: '', content: '', message: '' })
  const [creatingFile, setCreatingFile] = useState(false)
  const [newFileMessage, setNewFileMessage] = useState('')
  const [showBranchModal, setShowBranchModal] = useState(false)
  const [branchAction, setBranchAction] = useState('create') // create, delete, rename
  const [branchForm, setBranchForm] = useState({ name: '', from: '', new_name: '' })
  const [branchSubmitting, setBranchSubmitting] = useState(false)
  const [branchMessage, setBranchMessage] = useState('')

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
        // Backend already decodes base64, use content directly
        fileContent = data.content
      }
      setViewFile({ name: item.name, path: filePath, content: fileContent, sha: data?.sha || '' })
    } catch (err) {
      setViewFile({ name: item.name, path: [...path, item.name].join('/'), content: '无法加载文件内容', sha: '' })
    } finally {
      setLoadingFile(false)
    }
  }

  const handleCreateFile = async () => {
    if (!newFileForm.path.trim() || !newFileForm.message.trim()) return
    setCreatingFile(true)
    setNewFileMessage('')
    try {
      // Backend handles base64 encoding, send raw content
      await api.put('/api/github/repos/' + repoName + '/contents/' + newFileForm.path, {
        message: newFileForm.message,
        content: newFileForm.content,
        branch: branch,
      })
      setNewFileMessage('文件创建成功')
      setShowNewFileModal(false)
      setNewFileForm({ path: '', content: '', message: '' })
      // Refresh current directory
      const currentPath = path.join('/')
      const data = await api.get(`/api/github/repos/${repoName}/contents/${currentPath}?ref=${branch}`)
      setContents(Array.isArray(data) ? data : [])
    } catch (err) {
      setNewFileMessage('创建失败: ' + (err.message || '未知错误'))
    } finally {
      setCreatingFile(false)
    }
  }

  const defaultBranch = branches.find(b => b.default)?.name || branches[0]?.name || ''

  const openBranchModal = (action) => {
    setBranchAction(action)
    setBranchMessage('')
    if (action === 'create') {
      setBranchForm({ name: '', from: branch, new_name: '' })
    } else if (action === 'delete') {
      setBranchForm({ name: branch, from: '', new_name: '' })
    } else if (action === 'rename') {
      setBranchForm({ name: branch, from: '', new_name: '' })
    }
    setShowBranchModal(true)
  }

  const handleBranchAction = async () => {
    setBranchSubmitting(true)
    setBranchMessage('')
    try {
      if (branchAction === 'create') {
        if (!branchForm.name.trim() || !branchForm.from.trim()) return
        await api.post(`/api/github/repos/${repoName}/branches`, {
          name: branchForm.name.trim(),
          from: branchForm.from.trim(),
        })
        setBranchMessage('分支创建成功')
        const brList = await api.get(`/api/github/repos/${repoName}/branches`)
        setBranches(brList || [])
      } else if (branchAction === 'delete') {
        if (branchForm.name === defaultBranch) {
          setBranchMessage('无法删除默认分支')
          setBranchSubmitting(false)
          return
        }
        if (!window.confirm(`确定要删除分支 "${branchForm.name}" 吗？此操作不可撤销。`)) {
          setBranchSubmitting(false)
          return
        }
        await api.del(`/api/github/repos/${repoName}/branches/${branchForm.name}`)
        setBranchMessage('分支删除成功')
        const brList = await api.get(`/api/github/repos/${repoName}/branches`)
        setBranches(brList || [])
        if (branch === branchForm.name) {
          setBranch(defaultBranch)
        }
      } else if (branchAction === 'rename') {
        if (!branchForm.name.trim() || !branchForm.new_name.trim()) return
        await api.post(`/api/github/repos/${repoName}/branches/${branchForm.name}/rename`, {
          new_name: branchForm.new_name.trim(),
        })
        setBranchMessage('分支重命名成功')
        const brList = await api.get(`/api/github/repos/${repoName}/branches`)
        setBranches(brList || [])
        if (branch === branchForm.name) {
          setBranch(branchForm.new_name.trim())
        }
      }
    } catch (err) {
      setBranchMessage('操作失败: ' + (err.message || '未知错误'))
    } finally {
      setBranchSubmitting(false)
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

        {/* New file button */}
        <button
          className="btn-secondary"
          onClick={() => {
            const prefix = path.length > 0 ? path.join('/') + '/' : ''
            setNewFileForm({ path: prefix, content: '', message: '新建文件' })
            setNewFileMessage('')
            setShowNewFileModal(true)
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 10px', whiteSpace: 'nowrap' }}
        >
          {Icon.plus(12)} 新建文件
        </button>

        {/* Branch management buttons */}
        <button
          className="btn-secondary"
          onClick={() => openBranchModal('create')}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 10px', whiteSpace: 'nowrap' }}
        >
          {Icon.gitBranch(12)} 新建分支
        </button>
        <button
          className="btn-secondary"
          onClick={() => openBranchModal('delete')}
          disabled={branch === defaultBranch}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 10px', whiteSpace: 'nowrap', color: branch === defaultBranch ? 'var(--mac-text-secondary)' : 'var(--mac-red)' }}
        >
          {Icon.trash(12)} 删除分支
        </button>
        <button
          className="btn-secondary"
          onClick={() => openBranchModal('rename')}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 10px', whiteSpace: 'nowrap' }}
        >
          {Icon.code(12)} 重命名分支
        </button>

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
              onEdit={(newContent) => setViewFile(prev => ({ ...prev, content: newContent }))}
              repoName={repoName}
              branch={branch}
              sha={viewFile.sha}
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

      {/* New file modal */}
      {showNewFileModal && (
        <div
          className="animate-fade-in"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            backdropFilter: 'blur(8px)',
          }}
          onClick={() => setShowNewFileModal(false)}
        >
          <div
            className="glass"
            style={{
              width: 560, maxHeight: '80vh', overflow: 'auto',
              padding: 24, display: 'flex', flexDirection: 'column', gap: 14,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>新建文件</span>
              <button className="btn-icon" onClick={() => setShowNewFileModal(false)}>{Icon.back(14)}</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)' }}>文件路径 *</label>
              <input
                type="text"
                value={newFileForm.path}
                onChange={e => setNewFileForm({ ...newFileForm, path: e.target.value })}
                placeholder="path/to/new-file.txt"
                style={{
                  padding: '6px 12px', borderRadius: 'var(--mac-radius)', border: '1px solid var(--mac-border)',
                  background: 'var(--mac-bg)', color: 'var(--mac-text)', fontSize: 13, outline: 'none',
                  fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)' }}>提交信息 *</label>
              <input
                type="text"
                value={newFileForm.message}
                onChange={e => setNewFileForm({ ...newFileForm, message: e.target.value })}
                placeholder="创建新文件"
                style={{
                  padding: '6px 12px', borderRadius: 'var(--mac-radius)', border: '1px solid var(--mac-border)',
                  background: 'var(--mac-bg)', color: 'var(--mac-text)', fontSize: 13, outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)' }}>文件内容</label>
              <textarea
                value={newFileForm.content}
                onChange={e => setNewFileForm({ ...newFileForm, content: e.target.value })}
                placeholder="输入文件内容..."
                rows={10}
                spellCheck={false}
                style={{
                  padding: '10px 12px', borderRadius: 'var(--mac-radius)', border: '1px solid var(--mac-border)',
                  background: 'var(--mac-bg)', color: 'var(--mac-text)', fontSize: 12, outline: 'none',
                  resize: 'vertical', fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
                  lineHeight: '20px', tabSize: 2,
                }}
              />
            </div>

            {newFileMessage && (
              <div style={{
                fontSize: 12, padding: '6px 12px', borderRadius: 'var(--mac-radius)',
                background: newFileMessage.includes('失败') ? 'rgba(255,59,48,0.1)' : 'rgba(52,199,89,0.1)',
                color: newFileMessage.includes('失败') ? 'var(--mac-red)' : 'var(--mac-green)',
              }}>
                {newFileMessage}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="btn-secondary"
                onClick={() => { setShowNewFileModal(false); setNewFileMessage('') }}
                style={{ fontSize: 13, padding: '6px 16px' }}
              >
                取消
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateFile}
                disabled={creatingFile || !newFileForm.path.trim() || !newFileForm.message.trim()}
                style={{ fontSize: 13, padding: '6px 16px' }}
              >
                {creatingFile ? '创建中...' : '创建文件'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branch management modal */}
      {showBranchModal && (
        <div
          className="animate-fade-in"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            backdropFilter: 'blur(8px)',
          }}
          onClick={() => setShowBranchModal(false)}
        >
          <div
            className="glass"
            style={{
              width: 440, maxHeight: '80vh', overflow: 'auto',
              padding: 24, display: 'flex', flexDirection: 'column', gap: 14,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>
                {branchAction === 'create' ? '新建分支' : branchAction === 'delete' ? '删除分支' : '重命名分支'}
              </span>
              <button className="btn-icon" onClick={() => setShowBranchModal(false)}>{Icon.back(14)}</button>
            </div>

            {branchAction === 'create' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)' }}>新分支名称 *</label>
                  <input
                    type="text"
                    value={branchForm.name}
                    onChange={e => setBranchForm({ ...branchForm, name: e.target.value })}
                    placeholder="new-branch-name"
                    style={{
                      padding: '6px 12px', borderRadius: 'var(--mac-radius)', border: '1px solid var(--mac-border)',
                      background: 'var(--mac-bg)', color: 'var(--mac-text)', fontSize: 13, outline: 'none',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)' }}>来源分支 *</label>
                  <select
                    value={branchForm.from}
                    onChange={e => setBranchForm({ ...branchForm, from: e.target.value })}
                    style={{
                      padding: '6px 12px', borderRadius: 'var(--mac-radius)', border: '1px solid var(--mac-border)',
                      background: 'var(--mac-bg)', color: 'var(--mac-text)', fontSize: 13, outline: 'none',
                    }}
                  >
                    {branches.map(b => (
                      <option key={b.name} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {branchAction === 'delete' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)' }}>要删除的分支</label>
                <select
                  value={branchForm.name}
                  onChange={e => setBranchForm({ ...branchForm, name: e.target.value })}
                  disabled
                  style={{
                    padding: '6px 12px', borderRadius: 'var(--mac-radius)', border: '1px solid var(--mac-border)',
                    background: 'var(--mac-bg)', color: 'var(--mac-text)', fontSize: 13, outline: 'none',
                  }}
                >
                  {branches.filter(b => b.name !== defaultBranch).map(b => (
                    <option key={b.name} value={b.name}>{b.name}</option>
                  ))}
                </select>
                <span style={{ fontSize: 11, color: 'var(--mac-red)' }}>此操作不可撤销</span>
              </div>
            )}

            {branchAction === 'rename' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)' }}>当前分支</label>
                  <input
                    type="text"
                    value={branchForm.name}
                    disabled
                    style={{
                      padding: '6px 12px', borderRadius: 'var(--mac-radius)', border: '1px solid var(--mac-border)',
                      background: 'var(--mac-bg)', color: 'var(--mac-text)', fontSize: 13, outline: 'none',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)' }}>新名称 *</label>
                  <input
                    type="text"
                    value={branchForm.new_name}
                    onChange={e => setBranchForm({ ...branchForm, new_name: e.target.value })}
                    placeholder="new-branch-name"
                    style={{
                      padding: '6px 12px', borderRadius: 'var(--mac-radius)', border: '1px solid var(--mac-border)',
                      background: 'var(--mac-bg)', color: 'var(--mac-text)', fontSize: 13, outline: 'none',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
              </>
            )}

            {branchMessage && (
              <div style={{
                fontSize: 12, padding: '6px 12px', borderRadius: 'var(--mac-radius)',
                background: branchMessage.includes('失败') || branchMessage.includes('无法') ? 'rgba(255,59,48,0.1)' : 'rgba(52,199,89,0.1)',
                color: branchMessage.includes('失败') || branchMessage.includes('无法') ? 'var(--mac-red)' : 'var(--mac-green)',
              }}>
                {branchMessage}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="btn-secondary"
                onClick={() => setShowBranchModal(false)}
                style={{ fontSize: 13, padding: '6px 16px' }}
              >
                取消
              </button>
              <button
                className="btn-primary"
                onClick={handleBranchAction}
                disabled={
                  branchSubmitting ||
                  (branchAction === 'create' && (!branchForm.name.trim() || !branchForm.from.trim())) ||
                  (branchAction === 'rename' && (!branchForm.name.trim() || !branchForm.new_name.trim()))
                }
                style={{
                  fontSize: 13, padding: '6px 16px',
                  color: branchAction === 'delete' ? 'white' : undefined,
                  background: branchAction === 'delete' ? 'var(--mac-red)' : undefined,
                }}
              >
                {branchSubmitting ? '处理中...' : (branchAction === 'create' ? '创建' : branchAction === 'delete' ? '删除' : '重命名')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
