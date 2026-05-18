import { useState } from 'react'
import { Icon } from '../App'

const versions = [
  {
    version: 'v6.0.0',
    date: '2026-05-18',
    changes: [
      'MCP 服务端（SSE 传输协议，30 个工具）',
      'Shell 命令执行工具（安全限制 + 超时控制）',
      'HTTP 代理工具（URL 黑名单防护）',
      'MCP 服务展示页面（工具列表 + 调用历史）',
      'MCP 工具调用活动流集成',
      '侧边栏分组 Tab 页导航重构',
      '关于页面（项目介绍 + 版本变更）',
      '环境变量管理页面',
      '活动流自动刷新修复',
    ],
  },
  {
    version: 'v5.5.0',
    date: '2026-05-18',
    changes: [
      '新增 MCP 服务端（SSE 传输协议）',
      '新增 Shell 命令执行工具',
      '新增 HTTP 代理工具',
      '侧边栏分组优化',
      '新增关于页面',
    ],
  },
  {
    version: 'v5.4.5',
    date: '2026-05-10',
    changes: [
      '多仓库活动聚合 API',
      'HF Space 部署状态 API',
      'Webhook 接收器',
      'GitHub/HF Webhook 支持',
    ],
  },
  {
    version: 'v5.4.4',
    date: '2026-05-10',
    changes: [
      '修复最近活动显示问题',
      '修复提交记录显示问题',
    ],
  },
  {
    version: 'v5.4.3',
    date: '2026-05-10',
    changes: [
      '修复 API 返回值顺序错误',
      '修复 params 参数错误',
    ],
  },
  {
    version: 'v5.4.2',
    date: '2026-05-09',
    changes: [
      '优化仪表盘显示',
      '修复收藏项目显示',
    ],
  },
  {
    version: 'v5.4.0',
    date: '2026-05-09',
    changes: [
      '全新 UI 设计',
      'Mac 风格界面',
      '暗色/亮色主题',
    ],
  },
  {
    version: 'v5.3.0',
    date: '2026-05-08',
    changes: [
      '新增 HuggingFace Spaces 管理',
      '新增项目部署功能',
      '新增 Webhook 事件接收',
      '优化 API 缓存策略',
    ],
  },
  {
    version: 'v5.2.0',
    date: '2026-05-05',
    changes: [
      '新增 SSE 事件流端点',
      '新增 Dependabot 告警管理',
      '新增代码扫描告警',
      '优化 WebSocket 连接稳定性',
    ],
  },
  {
    version: 'v5.1.0',
    date: '2026-05-01',
    changes: [
      '新增 GitHub Actions 管理',
      '新增分支保护规则',
      '新增仓库环境管理',
      '新增 GitHub Pages 管理',
    ],
  },
  {
    version: 'v5.0.0',
    date: '2026-04-25',
    changes: [
      '全新架构重构',
      'FastAPI 后端 + React 前端',
      '支持 Docker 部署',
      '支持 HuggingFace Spaces 部署',
    ],
  },
  {
    version: 'v4.0.0',
    date: '2026-04-15',
    changes: [
      '新增 Pull Request 管理',
      '新增代码审查功能',
      '新增合并冲突检测',
      '新增自动合并功能',
    ],
  },
  {
    version: 'v3.0.0',
    date: '2026-04-01',
    changes: [
      '新增 Issue 管理功能',
      '新增标签和里程碑',
      '新增评论和表情反应',
      '新增 Issue 时间线',
    ],
  },
  {
    version: 'v2.0.0',
    date: '2026-03-15',
    changes: [
      '新增仓库搜索功能',
      '新增代码搜索',
      '新增用户搜索',
      '新增讨论区',
    ],
  },
  {
    version: 'v1.0.0',
    date: '2026-03-01',
    changes: [
      '项目初始化',
      'GitHub API 代理',
      '仓库列表和详情',
      '基础文件浏览',
      '用户认证',
    ],
  },
]

const techStack = [
  { label: '后端', value: 'Python 3.11 + FastAPI + Uvicorn', color: '#3572A5' },
  { label: '前端', value: 'React 18 + Vite + Tailwind CSS', color: '#61DAFB' },
  { label: '部署', value: 'Docker + HuggingFace Spaces', color: '#FF9500' },
  { label: '协议', value: 'MCP (Model Context Protocol)', color: '#34C759' },
]

const features = [
  { icon: Icon.github(14), text: 'GitHub API 完整代理（227+ 端点）' },
  { icon: Icon.zap(14), text: 'MCP 服务端（SSE 传输）' },
  { icon: Icon.code(14), text: 'Shell 命令执行工具' },
  { icon: Icon.external(14), text: 'HTTP 代理工具' },
  { icon: Icon.activity(14), text: '实时活动流（WebSocket + SSE）' },
  { icon: Icon.deploy(14), text: 'HuggingFace Space 管理' },
  { icon: Icon.moon(14), text: '暗色/亮色主题切换' },
  { icon: Icon.search(14), text: '响应式设计' },
]

export default function About() {
  const [activeTab, setActiveTab] = useState('about')

  return (
    <div className="detail-content">
      <div className="detail-header">
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>关于</h2>
        <div style={{ display: 'flex', gap: 0, marginLeft: 24 }}>
          <button
            className={`detail-tab ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => setActiveTab('about')}
          >
            关于
          </button>
          <button
            className={`detail-tab ${activeTab === 'changelog' ? 'active' : ''}`}
            onClick={() => setActiveTab('changelog')}
          >
            版本变更
          </button>
        </div>
      </div>

      <div className="detail-scroll">
        {activeTab === 'about' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
            {/* Project Info Card */}
            <div className="glass" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ color: 'var(--mac-accent)' }}>{Icon.github(28)}</span>
                <div>
                  <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>GitHub Mirror</h1>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 8,
                    background: 'var(--mac-accent)', color: 'white', fontWeight: 500,
                  }}>
                    v6.0.0
                  </span>
                </div>
              </div>
              <p style={{ fontSize: 14, color: 'var(--mac-text-secondary)', lineHeight: 1.6 }}>
                完整的 GitHub 镜像平台，支持 MCP 协议
              </p>
            </div>

            {/* Tech Stack */}
            <div className="glass" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: 'var(--mac-text)' }}>技术栈</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                {techStack.map(item => (
                  <div key={item.label} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 8,
                    background: 'var(--mac-bg)', border: '1px solid var(--mac-border)',
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: item.color, flexShrink: 0,
                    }} />
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--mac-text-secondary)', fontWeight: 500 }}>{item.label}</div>
                      <div style={{ fontSize: 13, color: 'var(--mac-text)', fontWeight: 500 }}>{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Features */}
            <div className="glass" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: 'var(--mac-text)' }}>功能特性</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                {features.map((f, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 8,
                    background: 'var(--mac-bg)', border: '1px solid var(--mac-border)',
                    fontSize: 13, color: 'var(--mac-text)',
                  }}>
                    <span style={{ color: 'var(--mac-accent)', flexShrink: 0, display: 'flex' }}>{f.icon}</span>
                    {f.text}
                  </div>
                ))}
              </div>
            </div>

            {/* Author & Link */}
            <div className="glass" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: 'var(--mac-text)' }}>作者信息</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: 'var(--mac-text)' }}>{Icon.github(20)}</span>
                <a
                  href="https://github.com/arwei944/github-mirror"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 13, color: 'var(--mac-accent)', textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  arwei944/github-mirror
                  <span style={{ display: 'flex' }}>{Icon.external(12)}</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'changelog' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 720 }}>
            {versions.map(v => (
              <div key={v.version} className="glass" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{
                    fontSize: 14, fontWeight: 600, color: 'var(--mac-accent)',
                  }}>
                    {v.version}
                  </span>
                  <span style={{
                    fontSize: 11, color: 'var(--mac-text-secondary)',
                    padding: '2px 8px', borderRadius: 6,
                    background: 'var(--mac-bg)', border: '1px solid var(--mac-border)',
                  }}>
                    {v.date}
                  </span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {v.changes.map((c, i) => (
                    <li key={i} style={{
                      fontSize: 13, color: 'var(--mac-text)', paddingLeft: 16,
                      position: 'relative', lineHeight: 1.5,
                    }}>
                      <span style={{
                        position: 'absolute', left: 0, top: 7,
                        width: 5, height: 5, borderRadius: '50%',
                        background: 'var(--mac-accent)',
                      }} />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
