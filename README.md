---
title: GitHub Mirror
emoji: 🪞
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# 🪞 GitHub Mirror

完整的 GitHub 镜像平台，支持 MCP 协议，提供 195+ API 端点。

## ✨ 功能特性

- **GitHub API 完整代理** — 仓库、Issues、PRs、Actions、Search 等 195+ 端点
- **MCP 服务端** — SSE + Streamable HTTP 双传输协议，30 个工具（GitHub/HF/Shell/Proxy/项目/配置）
- **模块化架构** — 10 个独立路由模块，完全解耦
- **Shell 命令执行** — 白名单安全限制 + 超时控制
- **HTTP 代理工具** — URL 黑名单 + DNS Rebinding 防护
- **实时活动流** — WebSocket + SSE 双通道
- **HuggingFace Space 管理** — 列表、状态、日志
- **暗色/亮色主题** — 自动检测 + 手动切换
- **响应式设计** — 桌面端 + 移动端适配

## 🚀 快速开始

### 环境要求

- Python 3.10+
- Node.js 20+（前端构建）
- Docker（可选）

### 本地运行

```bash
# 1. 克隆仓库
git clone https://github.com/arwei944/github-mirror.git
cd github-mirror

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的 Token

# 3. 安装 Python 依赖
pip install -r requirements.txt

# 4. 构建前端
cd frontend && npm install && npm run build && cd ..

# 5. 启动服务
uvicorn backend.main:app --host 0.0.0.0 --port 7860
```

### Docker 部署

```bash
docker build -t github-mirror .
docker run -d -p 7860:7860 \
  -e GITHUB_TOKEN=ghp_xxx \
  -e GITHUB_USER=your-username \
  -e API_KEY=your-secret \
  github-mirror
```

### HuggingFace Spaces

本项目可直接部署到 HuggingFace Spaces（Docker SDK）。设置以下 Space Variables：

| 变量 | 说明 | 必填 |
|------|------|------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | ✅ |
| `GITHUB_USER` | GitHub 用户名 | ✅ |
| `HF_TOKEN` | HuggingFace Token | ❌ |
| `HF_USER` | HuggingFace 用户名 | ❌ |
| `API_KEY` | API 访问密钥（空则不启用认证） | ❌ |
| `CORS_ORIGINS` | 允许的跨域来源（逗号分隔，* 为全部） | ❌ |
| `WEBHOOK_SECRET` | Webhook 签名密钥 | ❌ |

## 🔧 API 安全

### 认证

设置 `API_KEY` 环境变量后，所有 API 请求需要携带 `X-API-Key` header：

```bash
curl -H "X-API-Key: your-secret" http://localhost:7860/api/github/repos
```

### 速率限制

默认每 IP 每分钟 120 次请求。通过环境变量调整：

- `RATE_LIMIT_ENABLED=true|false` — 启用/禁用
- `RATE_LIMIT_MAX=120` — 每分钟最大请求数

### MCP 服务端

支持两种传输协议：

**Streamable HTTP（推荐，兼容 SOLO、Claude Desktop 等新版客户端）：**

端点：`POST /mcp`

```json
{
  "mcpServers": {
    "github-mirror": {
      "url": "http://localhost:7860/mcp"
    }
  }
}
```

**SSE（兼容旧版客户端）：**

SSE 端点：`GET /mcp/sse`
消息端点：`POST /mcp/sse/message`

```json
{
  "mcpServers": {
    "github-mirror": {
      "url": "http://localhost:7860/mcp/sse",
      "transport": "sse"
    }
  }
}
```

## 📁 项目结构

```
├── backend/                 # 模块化后端
│   ├── main.py              # FastAPI 入口
│   ├── config.py            # Pydantic Settings
│   ├── routers/             # 路由模块
│   │   ├── github_repos.py  # 仓库 API (178 handlers)
│   │   ├── github_actions.py# Actions API (20 handlers)
│   │   ├── github_misc.py   # 杂项 API (9 handlers)
│   │   ├── github_proxy.py  # Catch-all 代理
│   │   ├── mcp.py           # MCP 协议
│   │   ├── webhooks.py      # Webhook 接收
│   │   ├── sync.py          # 数据同步
│   │   ├── system.py        # 系统管理
│   │   └── deploy.py        # HF 部署
│   ├── core/                # 核心模块
│   │   ├── events.py        # 事件总线
│   │   ├── cache_v2.py      # LRU 缓存
│   │   ├── audit.py         # 审计日志
│   │   └── shared_state.py  # 共享状态
│   ├── mcp_tools/           # MCP 工具集
│   │   ├── base.py          # BaseTool + Registry
│   │   ├── github_tools.py  # 21 GitHub 工具
│   │   ├── hf_tools.py      # 3 HF 工具
│   │   ├── shell_tools.py   # Shell 工具
│   │   └── ...
│   └── clients/             # HTTP 客户端
│       └── github_client.py # Async httpx 客户端
├── frontend/                # React 前端
│   ├── src/
│   │   ├── App.jsx          # 主应用
│   │   ├── api.js           # API 层
│   │   ├── pages/           # 22 个页面组件
│   │   └── hooks/           # 自定义 Hooks
│   └── package.json
├── static/                  # 前端构建产物
├── tests/                   # 单元测试 (88 tests)
└── data/                    # 运行时数据
```

## 🧪 测试

```bash
# 运行所有测试
python -m pytest tests/ -v

# 运行特定测试
python -m pytest tests/unit/test_routes.py -v
```

## 📄 License

MIT
