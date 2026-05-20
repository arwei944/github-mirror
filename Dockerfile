# ── Stage 1: 前端构建 ──
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --prefer-offline 2>/dev/null || npm install
COPY frontend/ .
RUN npm run build

# ── Stage 2: 生产镜像 ──
FROM python:3.11-slim

LABEL maintainer="arwei944"
LABEL version="7.6.0"
LABEL description="GitHub Mirror - Complete GitHub Mirror Platform with MCP"

# 安装运行时依赖（不安装构建工具）
RUN apt-get update && \
    apt-get install -y --no-install-recommends git curl rsync tini && \
    rm -rf /var/lib/apt/lists/*

# 创建非 root 用户
RUN groupadd -r appuser && useradd -r -g appuser -d /app -m appuser

WORKDIR /app

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY backend/ ./backend/
COPY --from=frontend-builder /static ./static

# 创建数据目录并设置权限
RUN mkdir -p /app/data && chown -R appuser:appuser /app

# 切换到非 root 用户
USER appuser

EXPOSE 7860

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:7860/health || exit 1

# 使用 tini 作为 init 进程（正确处理信号）
ENTRYPOINT ["tini", "--"]
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]
