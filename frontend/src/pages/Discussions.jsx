import { useState, useEffect } from 'react'
import api from '../api'
import { useToast } from '../components/Toast'

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

const CATEGORY_COLORS = {
  'General': { bg: 'rgba(0, 122, 255, 0.15)', color: '#007aff' },
  'Ideas': { bg: 'rgba(175, 82, 222, 0.15)', color: '#af52de' },
  'Q&A': { bg: 'rgba(52, 199, 89, 0.15)', color: '#34c759' },
  'Show and Tell': { bg: 'rgba(255, 149, 0, 0.15)', color: '#ff9500' },
  'Announcements': { bg: 'rgba(255, 59, 48, 0.15)', color: '#ff3b30' },
}

function getCategoryStyle(name) {
  if (CATEGORY_COLORS[name]) return CATEGORY_COLORS[name]
  const colors = [
    { bg: 'rgba(0, 122, 255, 0.15)', color: '#007aff' },
    { bg: 'rgba(175, 82, 222, 0.15)', color: '#af52de' },
    { bg: 'rgba(52, 199, 89, 0.15)', color: '#34c759' },
    { bg: 'rgba(255, 149, 0, 0.15)', color: '#ff9500' },
    { bg: 'rgba(255, 59, 48, 0.15)', color: '#ff3b30' },
  ]
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function CategoryBadge({ name }) {
  if (!name) return null
  const style = getCategoryStyle(name)
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 8px',
        borderRadius: 10,
        fontSize: 10,
        fontWeight: 500,
        background: style.bg,
        color: style.color,
        lineHeight: '18px',
      }}
    >
      {name}
    </span>
  )
}

export default function Discussions({ githubRepos }) {
  const repos = githubRepos || []
  const toast = useToast()

  const [selectedRepo, setSelectedRepo] = useState(repos.length > 0 ? repos[0].name : '')
  const [discussions, setDiscussions] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedDiscussion, setSelectedDiscussion] = useState(null)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [showNewDiscussion, setShowNewDiscussion] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [newCategory, setNewCategory] = useState('')

  const fetchDiscussions = async (repo) => {
    if (!repo) return
    setLoading(true)
    try {
      const data = await api.get(`/api/github/repos/${repo}/discussions`)
      setDiscussions(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch discussions:', err)
      setDiscussions([])
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async (repo) => {
    if (!repo) return
    try {
      const data = await api.get(`/api/github/repos/${repo}/discussions/categories`)
      setCategories(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch categories:', err)
      setCategories([])
    }
  }

  const fetchComments = async (repo, number) => {
    try {
      const data = await api.get(`/api/github/repos/${repo}/discussions/${number}/comments`)
      setComments(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch comments:', err)
      setComments([])
    }
  }

  useEffect(() => {
    if (repos.length > 0 && !selectedRepo) {
      setSelectedRepo(repos[0].name)
    }
  }, [repos])

  useEffect(() => {
    if (selectedRepo) {
      fetchDiscussions(selectedRepo)
      fetchCategories(selectedRepo)
      setSelectedDiscussion(null)
      setComments([])
    }
  }, [selectedRepo])

  const handleRepoChange = (e) => {
    setSelectedRepo(e.target.value)
  }

  const handleDiscussionClick = (discussion) => {
    setSelectedDiscussion(discussion)
    fetchComments(selectedRepo, discussion.number)
  }

  const handleBack = () => {
    setSelectedDiscussion(null)
    setComments([])
    setNewComment('')
  }

  const handleSendComment = async () => {
    if (!newComment.trim() || !selectedDiscussion) return
    try {
      await api.post(`/api/github/repos/${selectedRepo}/discussions/${selectedDiscussion.id}/comments`, {
        body: newComment.trim(),
      })
      setNewComment('')
      toast.success('评论发送成功')
      fetchComments(selectedRepo, selectedDiscussion.number)
    } catch (err) {
      console.error('Failed to send comment:', err)
      toast.error('发送评论失败')
    }
  }

  const handleCreateDiscussion = async () => {
    if (!newTitle.trim() || !newBody.trim()) {
      toast.warning('请填写标题和内容')
      return
    }
    try {
      const payload = {
        title: newTitle.trim(),
        body: newBody.trim(),
      }
      if (newCategory) {
        payload.category_id = newCategory
      }
      await api.post(`/api/github/repos/${selectedRepo}/discussions`, payload)
      toast.success('讨论创建成功')
      setShowNewDiscussion(false)
      setNewTitle('')
      setNewBody('')
      setNewCategory('')
      fetchDiscussions(selectedRepo)
    } catch (err) {
      console.error('Failed to create discussion:', err)
      toast.error('创建讨论失败')
    }
  }

  const filteredDiscussions = discussions.filter((d) => {
    if (selectedCategory !== 'all') {
      const cat = categories.find((c) => String(c.id) === String(selectedCategory))
      if (cat && d.category?.name !== cat.name) return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (d.title || '').toLowerCase().includes(q)
    }
    return true
  })

  const inputStyle = {
    background: 'var(--mac-bg)',
    border: '1px solid var(--mac-border)',
    borderRadius: 8,
    padding: '8px 12px',
    color: 'var(--mac-text)',
    outline: 'none',
    fontSize: 13,
  }

  const buttonStyle = {
    background: 'var(--mac-accent)',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    padding: '6px 14px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  }

  const glassCard = {
    background: 'var(--mac-surface)',
    backdropFilter: 'var(--mac-blur)',
    border: '1px solid var(--mac-border)',
    borderRadius: 12,
  }

  // Detail view
  if (selectedDiscussion) {
    return (
      <div className="animate-fade-in" style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
        <button
          onClick={handleBack}
          style={{
            ...buttonStyle,
            background: 'var(--mac-surface)',
            color: 'var(--mac-text)',
            border: '1px solid var(--mac-border)',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{ fontSize: 14 }}>&#8592;</span> 返回列表
        </button>

        <div style={{ ...glassCard, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--mac-text)' }}>
              {selectedDiscussion.title}
            </h2>
            {selectedDiscussion.category && (
              <CategoryBadge name={selectedDiscussion.category.name} />
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            {selectedDiscussion.author?.avatar_url && (
              <img
                src={selectedDiscussion.author.avatar_url}
                alt=""
                style={{ width: 20, height: 20, borderRadius: '50%' }}
              />
            )}
            <span style={{ fontSize: 12, color: 'var(--mac-text-secondary)' }}>
              {selectedDiscussion.author?.login || 'unknown'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>
              {timeAgo(selectedDiscussion.created_at)}
            </span>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--mac-text)', whiteSpace: 'pre-wrap' }}>
            {selectedDiscussion.body || '暂无内容'}
          </div>
        </div>

        {/* Comments */}
        <div style={{ ...glassCard, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 16px 0', color: 'var(--mac-text)' }}>
            评论 ({comments.length})
          </h3>

          {comments.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--mac-text-secondary)', fontSize: 13 }}>
              暂无评论
            </div>
          )}

          {comments.map((comment, idx) => (
            <div
              key={comment.id || idx}
              style={{
                padding: '12px 0',
                borderTop: idx > 0 ? '1px solid var(--mac-border)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                {comment.author?.avatar_url && (
                  <img
                    src={comment.author.avatar_url}
                    alt=""
                    style={{ width: 18, height: 18, borderRadius: '50%' }}
                  />
                )}
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text)' }}>
                  {comment.author?.login || 'unknown'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                  {timeAgo(comment.created_at)}
                </span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--mac-text)', whiteSpace: 'pre-wrap' }}>
                {comment.body}
              </div>
            </div>
          ))}

          {/* Reply input */}
          <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="写下你的评论..."
              rows={2}
              style={{
                ...inputStyle,
                flex: 1,
                resize: 'vertical',
                minHeight: 60,
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={handleSendComment}
              disabled={!newComment.trim()}
              style={{
                ...buttonStyle,
                opacity: newComment.trim() ? 1 : 0.5,
                height: 36,
              }}
            >
              发送
            </button>
          </div>
        </div>
      </div>
    )
  }

  // List view
  return (
    <div className="animate-fade-in" style={{ padding: 20 }}>
      {/* Top bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={selectedRepo}
          onChange={handleRepoChange}
          style={{ ...inputStyle, minWidth: 160 }}
        >
          {repos.map((r) => (
            <option key={r.name} value={r.name}>{r.name}</option>
          ))}
        </select>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{ ...inputStyle, minWidth: 120 }}
        >
          <option value="all">全部分类</option>
          {categories.map((c) => (
            <option key={c.id} value={String(c.id)}>{c.name}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="搜索讨论..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 150 }}
        />

        <button
          onClick={() => setShowNewDiscussion(true)}
          style={buttonStyle}
        >
          + 新建讨论
        </button>
      </div>

      {/* Discussion list */}
      {loading ? (
        <div style={{ ...glassCard, padding: 40, textAlign: 'center', color: 'var(--mac-text-secondary)', fontSize: 13 }}>
          加载中...
        </div>
      ) : filteredDiscussions.length === 0 ? (
        <div style={{ ...glassCard, padding: 40, textAlign: 'center', color: 'var(--mac-text-secondary)', fontSize: 13 }}>
          {searchQuery || selectedCategory !== 'all' ? '没有匹配的讨论' : (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--mac-text-secondary)' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>&#128172;</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--mac-text)', marginBottom: 6 }}>还没有讨论</div>
              <div style={{ fontSize: 12, marginBottom: 16 }}>成为第一个发起讨论的人，与团队分享想法</div>
              <button onClick={() => setShowNewDiscussion(true)} style={{ background: 'var(--mac-accent)', color: 'white', border: 'none', borderRadius: 8, padding: '6px 16px', cursor: 'pointer', fontSize: 12 }}>
                + 新建讨论
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredDiscussions.map((d) => (
            <div
              key={d.id || d.number}
              onClick={() => handleDiscussionClick(d)}
              style={{
                ...glassCard,
                padding: '14px 16px',
                cursor: 'pointer',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--mac-text)', flex: 1 }}>
                  {d.title}
                </span>
                {d.category && <CategoryBadge name={d.category.name} />}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {d.author?.avatar_url && (
                  <img
                    src={d.author.avatar_url}
                    alt=""
                    style={{ width: 16, height: 16, borderRadius: '50%' }}
                  />
                )}
                <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                  {d.author?.login || 'unknown'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                  {timeAgo(d.created_at)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)', marginLeft: 'auto' }}>
                  {d.comments || 0} 条评论
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Discussion Modal */}
      {showNewDiscussion && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNewDiscussion(false)
          }}
        >
          <div
            style={{
              ...glassCard,
              padding: 24,
              width: 480,
              maxWidth: '90vw',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px 0', color: 'var(--mac-text)' }}>
              新建讨论
            </h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)', marginBottom: 4 }}>
                标题
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="讨论标题"
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)', marginBottom: 4 }}>
                分类
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
              >
                <option value="">选择分类（可选）</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)', marginBottom: 4 }}>
                内容
              </label>
              <textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="讨论内容..."
                rows={6}
                style={{
                  ...inputStyle,
                  width: '100%',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  minHeight: 120,
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setShowNewDiscussion(false)}
                style={{
                  ...buttonStyle,
                  background: 'var(--mac-surface)',
                  color: 'var(--mac-text)',
                  border: '1px solid var(--mac-border)',
                }}
              >
                取消
              </button>
              <button
                onClick={handleCreateDiscussion}
                disabled={!newTitle.trim() || !newBody.trim()}
                style={{
                  ...buttonStyle,
                  opacity: newTitle.trim() && newBody.trim() ? 1 : 0.5,
                }}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
