import React, { useState, useEffect, useCallback } from 'react'
import api from '../api'

function renderDiffLines(patch) {
  if (!patch) return []
  const lines = patch.split('\n')
  return lines.map((line, i) => {
    let bgColor = 'transparent'
    let color = 'var(--mac-text)'
    let prefix = ''
    if (line.startsWith('@@')) {
      bgColor = 'rgba(0, 122, 255, 0.1)'
      color = 'var(--mac-accent)'
    } else if (line.startsWith('+')) {
      bgColor = 'rgba(63, 185, 80, 0.15)'
      color = '#3fb950'
      prefix = '+'
    } else if (line.startsWith('-')) {
      bgColor = 'rgba(248, 81, 73, 0.15)'
      color = '#f85149'
      prefix = '-'
    }
    return { line, bgColor, color, prefix, key: i }
  })
}

export default function DiffViewer({ repoName, pullNumber }) {
  const [files, setFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [diffLines, setDiffLines] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ additions: 0, deletions: 0, changes: 0 })

  useEffect(() => {
    if (!repoName || !pullNumber) return
    setLoading(true)
    api.get(`/api/github/repos/${repoName}/pulls/${pullNumber}/files`)
      .then(data => {
        const fileList = Array.isArray(data) ? data : []
        setFiles(fileList)
        setStats({
          additions: fileList.reduce((s, f) => s + (f.additions || 0), 0),
          deletions: fileList.reduce((s, f) => s + (f.deletions || 0), 0),
          changes: fileList.length,
        })
        if (fileList.length > 0) {
          setSelectedFile(fileList[0])
          setDiffLines(renderDiffLines(fileList[0].patch || ''))
        }
      })
      .catch(() => { setFiles([]); setDiffLines([]) })
      .finally(() => setLoading(false))
  }, [repoName, pullNumber])

  const handleFileClick = useCallback((file) => {
    setSelectedFile(file)
    setDiffLines(renderDiffLines(file.patch || ''))
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--mac-text-secondary)', fontSize: 13 }}>
        加载差异中...
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--mac-text-secondary)', fontSize: 13 }}>
        没有文件变更
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      {/* Stats bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '8px 12px',
        background: 'var(--mac-surface)', borderRadius: 8, border: '1px solid var(--mac-border)',
        fontSize: 12, flexShrink: 0,
      }}>
        <span style={{ color: '#3fb950', fontWeight: 600 }}>+{stats.additions}</span>
        <span style={{ color: '#f85149', fontWeight: 600 }}>-{stats.deletions}</span>
        <span style={{ color: 'var(--mac-text-secondary)' }}>{stats.changes} 个文件变更</span>
      </div>

      {/* File list + Diff content */}
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        {/* File list */}
        <div style={{
          width: 200, flexShrink: 0, overflow: 'auto', background: 'var(--mac-surface)',
          borderRadius: 8, border: '1px solid var(--mac-border)',
        }}>
          {files.map((file, idx) => (
            <div
              key={idx}
              onClick={() => handleFileClick(file)}
              style={{
                padding: '6px 10px', cursor: 'pointer', fontSize: 11,
                borderBottom: '1px solid var(--mac-border)',
                background: selectedFile?.filename === file.filename ? 'rgba(0,122,255,0.1)' : 'transparent',
                color: 'var(--mac-text)',
              }}
            >
              <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.filename?.split('/').pop()}
              </div>
              <div style={{ color: 'var(--mac-text-secondary)', fontSize: 10, marginTop: 2 }}>
                {file.status} <span style={{ color: '#3fb950' }}>+{file.additions}</span>{' '}
                <span style={{ color: '#f85149' }}>-{file.deletions}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Diff content */}
        <div style={{ flex: 1, overflow: 'auto', borderRadius: 8, border: '1px solid var(--mac-border)', background: 'var(--mac-bg)' }}>
          {selectedFile ? (
            <pre style={{ margin: 0, padding: 12, fontSize: 12, fontFamily: 'SF Mono, Monaco, Menlo, Consolas, monospace', lineHeight: 1.6 }}>
              {diffLines.map(({ line, bgColor, color, key }) => (
                <div key={key} style={{ background: bgColor, color, padding: '0 8px', whiteSpace: 'pre' }}>
                  {line || ' '}
                </div>
              ))}
            </pre>
          ) : (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--mac-text-secondary)', fontSize: 12 }}>
              选择文件查看差异
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
