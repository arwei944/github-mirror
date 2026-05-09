---
title: Deploy Service
emoji: ⚙️
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
---

# ⚙️ Deploy Service

Multi-project auto deployment platform — GitHub → HF Space

## Features

- **GitHub Webhook** auto-deploy on push
- **Multi-project** management with per-project config
- **macOS-style** frontend panel
- **Deploy logs** with step-by-step detail
- **Real-time sync** (15s auto-refresh)

## Live

**HF Space**: https://arwei944-deploy-service.hf.space

## Env Vars

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_TOKEN` | GitHub PAT | ✅ |
| `HF_TOKEN` | HuggingFace Token | ✅ |
| `GITHUB_USER` | GitHub username (default: arwei944) | |
| `HF_USER` | HF username (default: arwei944) | |
| `WEBHOOK_SECRET` | Webhook signing secret | |

## Local Dev

```bash
pip install fastapi uvicorn huggingface_hub pydantic
GITHUB_TOKEN=xxx HF_TOKEN=xxx uvicorn app:app --reload --port 7860
cd frontend && npm install --legacy-peer-deps && npm run dev
```

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects` | GET | List configured projects |
| `/api/projects/{name}` | POST | Add/update project |
| `/api/projects/{name}` | DELETE | Remove project |
| `/api/projects/{name}/deploy` | POST | Trigger deploy |
| `/api/projects/{name}/deploys` | GET | Deploy history |
| `/api/github/repos` | GET | List all GitHub repos |
| `/api/hf/spaces` | GET | List HF Spaces |
| `/api/webhook/github` | POST | GitHub Webhook |
| `/health` | GET | Health check |
