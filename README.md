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

完整的 GitHub 镜像平台，支持 MCP 协议，提供 227+ API 端点。

## ✨ 功能特性

- **GitHub API 完整代理** — 仓库、Issues、PRs、Actions、Search 等 227+ 端点
- **MCP 服务端** — SSE 传输协议，30 个工具（GitHub/HF/Shell/Proxy/项目/配置）
- **Shell 命令执行** — 白名单安全限制 + 超时控制
- **HTTP 代理工具** — URL 黑名单 + DNS Rebinding 防护
- **实时活动流** — WebSocket + SSE 双通道
- **HuggingFace Space 管理** — 列表、状态、日志
- **暗色/亮色主题** — 自动检测 + 手动切换
- **响应式设计** — 桌面端 + 移动端适配

## 🚀 快速开始

### 环境要求

- Python 3.11+
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
uvicorn app:app --host 0.0.0.0 --port 7860
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

SSE 端点：`GET /mcp/sse`
消息端点：`POST /mcp/message`

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
├── app.py              # FastAPI 后端（227+ API 端点）
├── requirements.txt    # Python 依赖
├── Dockerfile          # Docker 多阶段构建
├── frontend/           # React 前端
│   ├── src/
│   │   ├── App.jsx         # 主应用（路由 + 状态）
│   │   ├── api.js          # API 层（去重 + 重试）
│   │   ├── pages/          # 22 个页面组件
│   │   ├── components/     # 通用组件
│   │   └── utils/          # 工具函数
│   └── package.json
├── static/             # 前端构建产物
└── data/               # 运行时数据
```

## 📄 License

MIT
