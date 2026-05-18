import { useState, useEffect, useCallback } from 'react'
import { Icon } from '../App'
import api from '../api'

// ============ 工具定义 ============

const TOOL_GROUPS = [
  {
    key: 'github',
    label: 'GitHub 工具',
    icon: Icon.github(16),
    color: 'var(--mac-accent)',
    tools: [
      { name: 'list_repos', desc: '列出 GitHub 仓库' },
      { name: 'get_repo_detail', desc: '获取仓库详情' },
      { name: 'create_repo', desc: '创建新仓库' },
      { name: 'delete_repo', desc: '删除仓库' },
      { name: 'list_issues', desc: '列出 Issues' },
      { name: 'create_issue', desc: '创建 Issue' },
      { name: 'list_pulls', desc: '列出 Pull Requests' },
      { name: 'create_pr', desc: '创建 Pull Request' },
      { name: 'merge_pr', desc: '合并 Pull Request' },
      { name: 'search_code', desc: '搜索代码' },
      { name: 'search_repos', desc: '搜索仓库' },
      { name: 'get_activity', desc: '获取活动记录' },
      { name: 'get_user', desc: '获取用户信息' },
      { name: 'get_notifications', desc: '获取通知列表' },
      { name: 'get_repo_contents', desc: '获取仓库文件内容' },
      { name: 'get_commits', desc: '获取提交记录' },
      { name: 'get_repo_tags', desc: '获取仓库标签' },
      { name: 'get_repo_branches', desc: '获取仓库分支' },
      { name: 'get_repo_releases', desc: '获取仓库发布版本' },
      { name: 'get_repo_stargazers', desc: '获取 Star 用户列表' },
      { name: 'fork_repo', desc: 'Fork 仓库' },
    ],
  },
  {
    key: 'huggingface',
    label: 'HuggingFace 工具',
    icon: <span style={{ fontSize: 16 }}>&#129302;</span>,
    color: '#ff9500',
    tools: [
      { name: 'list_spaces', desc: '列出 HuggingFace Spaces' },
      { name: 'get_space_status', desc: '获取 Space 运行状态' },
      { name: 'get_space_logs', desc: '获取 Space 日志' },
    ],
  },
  {
    key: 'shell',
    label: 'Shell 工具',
    icon: (
      <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
    color: 'var(--mac-green)',
    tools: [
      { name: 'execute_shell', desc: '执行 Shell 命令（带安全限制和超时控制）' },
    ],
  },
  {
    key: 'proxy',
    label: '代理工具',
    icon: (
      <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
    ),
    color: '#00c7be',
    tools: [
      { name: 'proxy_request', desc: '代理 HTTP 请求（支持 GET/POST/PUT/DELETE）' },
    ],
  },
  {
    key: 'project',
    label: '项目工具',
    icon: Icon.deploy(16),
    color: '#af52de',
    tools: [
      { name: 'list_projects', desc: '列出项目列表' },
      { name: 'deploy_project', desc: '部署项目' },
    ],
  },
  {
    key: 'config',
    label: '配置工具',
    icon: Icon.settings(16),
    color: 'var(--mac-text-secondary)',
    tools: [
      { name: 'get_config', desc: '获取配置信息' },
      { name: 'update_config', desc: '更新配置' },
    ],
  },
]

const TOTAL_TOOLS = TOOL_GROUPS.reduce((sum, g) => sum + g.tools.length, 0)

// ============ 辅助函数 ============

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

function truncate(str, len = 80) {
  if (!str) return '-'
  if (str.length <= len) return str
  return str.slice(0, len) + '...'
}

// ============ Glass Card 样式 ============

const cardStyle = {
  background: 'var(--mac-surface)',
  backdropFilter: 'var(--mac-blur)',
  border: '1px solid var(--mac-border)',
  borderRadius: 12,
  padding: 16,
}

const sectionTitleStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--mac-text)',
  marginBottom: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

// ============ 子组件 ============

function StatusCard() {
  return (
    <div style={cardStyle}>
      <div style={sectionTitleStyle}>
        <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
        </svg>
        MCP 服务状态
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--mac-green)',
            boxShadow: '0 0 6px var(--mac-green)',
          }} />
          <span style={{ fontSize: 13, color: 'var(--mac-text)', fontWeight: 500 }}>MCP 服务运行中</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: 'var(--mac-text-secondary)' }}>SSE 端点</span>
          <code style={{
            fontSize: 12, color: 'var(--mac-accent)',
            background: 'var(--mac-bg)', padding: '2px 8px', borderRadius: 4,
          }}>/mcp/sse</code>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: 'var(--mac-text-secondary)' }}>Message 端点</span>
          <code style={{
            fontSize: 12, color: 'var(--mac-accent)',
            background: 'var(--mac-bg)', padding: '2px 8px', borderRadius: 4,
          }}>/mcp/message</code>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: 'var(--mac-text-secondary)' }}>协议版本</span>
          <code style={{
            fontSize: 12, color: 'var(--mac-text)',
            background: 'var(--mac-bg)', padding: '2px 8px', borderRadius: 4,
          }}>2024-11-05</code>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: 'var(--mac-text-secondary)' }}>已注册工具</span>
          <span style={{
            fontSize: 16, color: 'var(--mac-accent)', fontWeight: 700,
          }}>{TOTAL_TOOLS}</span>
        </div>
      </div>
    </div>
  )
}

function ToolGroupCard({ group }) {
  return (
    <div style={cardStyle}>
      <div style={{
        ...sectionTitleStyle,
        color: group.color,
      }}>
        {group.icon}
        {group.label}
        <span style={{
          fontSize: 10, fontWeight: 400, color: 'var(--mac-text-secondary)',
          background: 'var(--mac-bg)', padding: '1px 6px', borderRadius: 8,
        }}>{group.tools.length} 个工具</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {group.tools.map(tool => (
          <div key={tool.name} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 10px', borderRadius: 8,
            background: 'var(--mac-bg)',
            border: '1px solid transparent',
            transition: 'border-color 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--mac-border)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{
                fontSize: 12, fontWeight: 500, color: 'var(--mac-text)',
                fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
              }}>{tool.name}</code>
              <span style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>{tool.desc}</span>
            </div>
            <span style={{
              fontSize: 9, padding: '1px 6px', borderRadius: 6,
              background: `${group.color}15`, color: group.color,
              fontWeight: 500, whiteSpace: 'nowrap',
            }}>{group.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ToolCallHistory() {
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchCalls = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get('/api/mcp/tool-calls').catch(() => [])
      setCalls(Array.isArray(data) ? data : [])
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCalls()
    const t = setInterval(fetchCalls, 10000)
    return () => clearInterval(t)
  }, [fetchCalls])

  return (
    <div style={cardStyle}>
      <div style={{
        ...sectionTitleStyle,
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {Icon.activity(16)}
          最近工具调用
          {loading && (
            <span style={{ fontSize: 10, color: 'var(--mac-text-secondary)' }}>刷新中...</span>
          )}
        </div>
        <button
          onClick={fetchCalls}
          style={{
            background: 'none', border: '1px solid var(--mac-border)',
            borderRadius: 6, padding: '2px 8px', cursor: 'pointer',
            color: 'var(--mac-text-secondary)', fontSize: 11,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          {Icon.refresh(12)}
          刷新
        </button>
      </div>
      {calls.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--mac-text-secondary)' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>{Icon.activity(28)}</div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>暂无工具调用记录</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>MCP 工具调用将在这里显示</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 360, overflow: 'auto' }}>
          {calls.map((call, idx) => (
            <div key={call.id || idx} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '8px 10px', borderRadius: 8,
              background: 'var(--mac-bg)',
              border: '1px solid transparent',
              transition: 'border-color 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--mac-border)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: call.success !== false ? 'rgba(52,199,89,0.15)' : 'rgba(255,59,48,0.15)',
                color: call.success !== false ? 'var(--mac-green)' : 'var(--mac-red)',
                fontSize: 11, fontWeight: 700, marginTop: 1,
              }}>
                {call.success !== false ? '\u2713' : '\u2717'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <code style={{
                    fontSize: 12, fontWeight: 500, color: 'var(--mac-text)',
                    fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
                  }}>{call.tool_name || call.name || '-'}</code>
                  <span style={{ fontSize: 10, color: 'var(--mac-text-secondary)' }}>
                    {timeAgo(call.created_at || call.timestamp)}
                  </span>
                </div>
                {call.arguments && (
                  <div style={{ fontSize: 11, color: 'var(--mac-text-secondary)', marginBottom: 2 }}>
                    参数: {truncate(typeof call.arguments === 'string' ? call.arguments : JSON.stringify(call.arguments), 100)}
                  </div>
                )}
                {call.result != null && (
                  <div style={{ fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                    结果: {truncate(typeof call.result === 'string' ? call.result : JSON.stringify(call.result), 100)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function UsageGuide() {
  const configExample = `{
  "mcpServers": {
    "github-mirror": {
      "url": "http://<host>:7860/mcp/sse",
      "transport": "sse"
    }
  }
}`

  return (
    <div style={cardStyle}>
      <div style={sectionTitleStyle}>
        {Icon.info(16)}
        使用说明
      </div>
      <p style={{ fontSize: 12, color: 'var(--mac-text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
        MCP (Model Context Protocol) 服务允许 AI 客户端通过 SSE 连接调用本平台提供的工具。
        在你的 MCP 客户端配置文件中添加以下配置即可连接：
      </p>
      <pre style={{
        background: 'var(--mac-bg)',
        border: '1px solid var(--mac-border)',
        borderRadius: 8,
        padding: 12,
        fontSize: 12,
        color: 'var(--mac-text)',
        fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
        overflow: 'auto',
        lineHeight: 1.5,
      }}>
        {configExample}
      </pre>
    </div>
  )
}

// ============ 主页面 ============

export default function McpService() {
  return (
    <div className="animate-fade-in" style={{ padding: 20, height: '100%', overflow: 'auto' }}>
      {/* 顶部状态卡片 */}
      <div style={{ marginBottom: 16 }}>
        <StatusCard />
      </div>

      {/* 工具列表 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 15, fontWeight: 600, color: 'var(--mac-text)',
          marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {Icon.zap(16)}
          已注册工具
          <span style={{
            fontSize: 10, fontWeight: 400, color: 'var(--mac-text-secondary)',
            background: 'var(--mac-bg)', padding: '1px 6px', borderRadius: 8,
          }}>{TOTAL_TOOLS} 个</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: 16 }}>
          {TOOL_GROUPS.map(group => (
            <ToolGroupCard key={group.key} group={group} />
          ))}
        </div>
      </div>

      {/* 最近工具调用 */}
      <div style={{ marginBottom: 16 }}>
        <ToolCallHistory />
      </div>

      {/* 使用说明 */}
      <div style={{ marginBottom: 16 }}>
        <UsageGuide />
      </div>
    </div>
  )
}
