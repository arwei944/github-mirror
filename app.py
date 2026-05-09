"""
Deploy Service - Multi-project auto deployment platform

GitHub Webhook → Auto deploy to HF Space
RESTful API + macOS-style frontend panel
"""

import os
import json
import hashlib
import hmac
import threading
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Request, HTTPException, Query
from fastapi.responses import JSONResponse, PlainTextResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

__version__ = "1.0.0"

app = FastAPI(title="Deploy Service", version=__version__)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ============ Config ============
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
GITHUB_USER = os.environ.get("GITHUB_USER", "arwei944")
HF_TOKEN = os.environ.get("HF_TOKEN", "")
HF_USER = os.environ.get("HF_USER", "arwei944")
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")
DATA_DIR = Path(os.environ.get("DATA_DIR", "/app/data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
PROJECTS_FILE = DATA_DIR / "projects.json"
DEPLOYS_DIR = DATA_DIR / "deploys"
DEPLOYS_DIR.mkdir(parents=True, exist_ok=True)

# ============ Data Layer ============

def load_projects() -> dict:
    if PROJECTS_FILE.exists():
        return json.loads(PROJECTS_FILE.read_text())
    return {}

def save_projects(projects: dict):
    PROJECTS_FILE.write_text(json.dumps(projects, indent=2, ensure_ascii=False))

def save_deploy_log(repo_name: str, deploy_id: str, log_data: dict):
    dir_path = DEPLOYS_DIR / repo_name
    dir_path.mkdir(parents=True, exist_ok=True)
    (dir_path / f"{deploy_id}.json").write_text(json.dumps(log_data, indent=2, ensure_ascii=False))

def list_deploy_logs(repo_name: str, limit: int = 20) -> list:
    dir_path = DEPLOYS_DIR / repo_name
    if not dir_path.exists():
        return []
    logs = []
    for f in sorted(dir_path.glob("*.json"), reverse=True)[:limit]:
        try:
            logs.append(json.loads(f.read_text()))
        except:
            pass
    return logs

# ============ Deploy Engine ============

deploy_locks: dict[str, threading.Lock] = {}
deploy_locks_lock = threading.Lock()

def get_deploy_lock(repo_name: str) -> threading.Lock:
    with deploy_locks_lock:
        if repo_name not in deploy_locks:
            deploy_locks[repo_name] = threading.Lock()
        return deploy_locks[repo_name]

def run_cmd(cmd: str, cwd: str = None, timeout: int = 300) -> tuple[bool, str]:
    try:
        result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        return (result.returncode == 0, result.stdout + result.stderr)
    except subprocess.TimeoutExpired:
        return (False, f"Command timed out after {timeout}s")
    except Exception as e:
        return (False, str(e))

def do_deploy(repo_name: str, branch: str = "main", trigger: str = "manual") -> dict:
    lock = get_deploy_lock(repo_name)
    if not lock.acquire(blocking=False):
        return {"status": "already_deploying", "message": f"{repo_name} is deploying"}

    deploy_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    log_data = {
        "deploy_id": deploy_id, "repo_name": repo_name, "branch": branch, "trigger": trigger,
        "started_at": datetime.now(timezone.utc).isoformat(), "status": "running",
        "steps": [], "error": None, "finished_at": None,
    }

    def add_step(name: str, success: bool, message: str = ""):
        log_data["steps"].append({"name": name, "success": success, "message": message[:500], "time": datetime.now(timezone.utc).isoformat()})
        save_deploy_log(repo_name, deploy_id, log_data)
        print(f"[{repo_name}] {'✅' if success else '❌'} {name}: {message[:100]}")

    try:
        work_dir = f"/tmp/deploy-{repo_name}-{deploy_id}"
        add_step("Clean work dir", *run_cmd(f"rm -rf {work_dir} && mkdir -p {work_dir}"))

        github_url = f"https://{GITHUB_TOKEN}@github.com/{GITHUB_USER}/{repo_name}.git"
        ok, out = run_cmd(f"git clone --depth 1 --branch {branch} {github_url} {work_dir}/src", timeout=120)
        add_step(f"Clone GitHub ({branch})", ok, out[:300] if not ok else "OK")
        if not ok:
            raise Exception(f"Git clone failed: {out[:200]}")

        hf_space = f"{HF_USER}/{repo_name}"
        hf_url = f"https://{HF_USER}:{HF_TOKEN}@huggingface.co/spaces/{hf_space}"
        ok, _ = run_cmd(f"git ls-remote {hf_url} HEAD", timeout=30)

        if ok:
            add_step("Clone HF Space", *run_cmd(f"git clone {hf_url} {work_dir}/hf-space", timeout=120))
        else:
            add_step("HF Space not found, will create", True, f"Creating {hf_space}")
            run_cmd(f"git clone {hf_url} {work_dir}/hf-space", timeout=30)

        hf_dir, src_dir = f"{work_dir}/hf-space", f"{work_dir}/src"

        if os.path.exists(hf_dir) and os.path.isdir(f"{hf_dir}/.git"):
            run_cmd(f"cd {hf_dir} && find . -maxdepth 1 ! -name '.git' ! -name '.' -exec rm -rf {{}} +")
        else:
            run_cmd(f"mkdir -p {hf_dir} && cd {hf_dir} && git init")

        ok, out = run_cmd(f"cd {src_dir} && rsync -a --exclude='.git' --exclude='node_modules' --exclude='.venv' --exclude='__pycache__' --exclude='.next' --exclude='dist' --exclude='.env' ./ {hf_dir}/", timeout=60)
        add_step("Sync files", ok, out[:300] if not ok else "OK")

        run_cmd(f"cd {hf_dir} && git config user.name 'deployer' && git config user.email 'deployer@service.dev'")
        run_cmd(f"cd {hf_dir} && git add -A")

        if run_cmd(f"cd {hf_dir} && git diff --cached --quiet")[0]:
            add_step("No changes", True, "Skipped")
            log_data["status"] = "skipped"
            log_data["finished_at"] = datetime.now(timezone.utc).isoformat()
            save_deploy_log(repo_name, deploy_id, log_data)
            lock.release()
            return {"status": "skipped", "deploy_id": deploy_id, "message": "No changes"}

        ok, out = run_cmd(f"cd {hf_dir} && git commit -m 'deploy: {trigger} @ {deploy_id}'")
        add_step("Git commit", ok, out[:300] if not ok else "OK")
        if not ok:
            raise Exception(f"Git commit failed: {out[:200]}")

        ok, out = run_cmd(f"cd {hf_dir} && git push -u origin main", timeout=120)
        add_step("Push to HF Space", ok, out[:300] if not ok else "OK")
        if not ok:
            ok2, _ = run_cmd(f"cd {hf_dir} && git push -f origin main", timeout=120)
            if not ok2:
                raise Exception(f"Git push failed: {out[:200]}")
            add_step("Force push (first time)", True, "OK")

        run_cmd(f"rm -rf {work_dir}")
        log_data.update({"status": "success", "finished_at": datetime.now(timezone.utc).isoformat(), "hf_space": hf_space})
        save_deploy_log(repo_name, deploy_id, log_data)
        lock.release()
        return {"status": "success", "deploy_id": deploy_id, "message": "Deployed", "hf_space": hf_space}

    except Exception as e:
        log_data.update({"status": "error", "error": str(e), "finished_at": datetime.now(timezone.utc).isoformat()})
        save_deploy_log(repo_name, deploy_id, log_data)
        run_cmd(f"rm -rf /tmp/deploy-{repo_name}-{deploy_id}")
        lock.release()
        return {"status": "error", "deploy_id": deploy_id, "message": str(e)}

# ============ GitHub Webhook ============

def verify_github_signature(payload: bytes, signature: str) -> bool:
    if not WEBHOOK_SECRET:
        return True
    if not signature:
        return False
    sha_name, sig = signature.split("=", 1)
    if sha_name != "sha256":
        return False
    return hmac.compare_digest(hmac.new(WEBHOOK_SECRET.encode(), payload, hashlib.sha256).hexdigest(), sig)

@app.post("/api/webhook/github")
async def github_webhook(request: Request):
    body = await request.body()
    if not verify_github_signature(body, request.headers.get("X-Hub-Signature-256", "")):
        raise HTTPException(401, "Invalid signature")
    try:
        data = json.loads(body)
    except:
        raise HTTPException(400, "Invalid JSON")

    repo_full = data.get("repository", {}).get("full_name", "")
    if not repo_full.startswith(f"{GITHUB_USER}/"):
        return JSONResponse({"status": "ignored", "message": f"Not our repo: {repo_full}"})

    repo_name = repo_full.split("/")[1]
    branch = data.get("ref", "").replace("refs/heads/", "")
    projects = load_projects()
    config = projects.get(repo_name, {})

    if not config.get("auto_deploy", False):
        return JSONResponse({"status": "ignored", "message": f"{repo_name} auto-deploy disabled"})
    if branch != config.get("branch", "main"):
        return JSONResponse({"status": "ignored", "message": f"Branch mismatch"})

    commits = data.get("commits", [])
    pusher = data.get("pusher", {}).get("name", "unknown")
    threading.Thread(target=do_deploy, kwargs={"repo_name": repo_name, "branch": branch, "trigger": f"webhook by {pusher}: {commits[0]['message'][:100] if commits else 'unknown'}"}).start()
    return JSONResponse({"status": "triggered", "repo": repo_name, "branch": branch})

# ============ REST API ============

class ProjectConfig(BaseModel):
    auto_deploy: bool = False
    branch: str = "main"
    hf_space: str = ""
    description: str = ""

@app.get("/api/projects")
async def list_projects():
    projects = load_projects()
    return [{"name": n, "config": c, "last_deploy": list_deploy_logs(n, 1)[0] if list_deploy_logs(n, 1) else None, "hf_space": c.get("hf_space") or f"{HF_USER}/{n}"} for n, c in projects.items()]

@app.post("/api/projects/{repo_name}")
async def add_project(repo_name: str, config: ProjectConfig):
    projects = load_projects()
    projects[repo_name] = config.model_dump()
    save_projects(projects)
    return {"status": "ok", "repo": repo_name}

@app.delete("/api/projects/{repo_name}")
async def remove_project(repo_name: str):
    projects = load_projects()
    projects.pop(repo_name, None)
    save_projects(projects)
    return {"status": "ok"}

@app.post("/api/projects/{repo_name}/deploy")
async def trigger_deploy(repo_name: str, branch: str = Query(default="main")):
    if repo_name not in load_projects():
        raise HTTPException(404, f"Project {repo_name} not configured")
    return do_deploy(repo_name, branch=branch, trigger="manual")

@app.get("/api/projects/{repo_name}/deploys")
async def get_deploy_history(repo_name: str, limit: int = Query(default=20)):
    return list_deploy_logs(repo_name, limit)

@app.get("/api/projects/{repo_name}/deploys/{deploy_id}")
async def get_deploy_detail(repo_name: str, deploy_id: str):
    path = DEPLOYS_DIR / repo_name / f"{deploy_id}.json"
    if not path.exists():
        raise HTTPException(404, "Not found")
    return json.loads(path.read_text())

@app.get("/api/github/repos")
async def list_github_repos():
    import urllib.request
    req = urllib.request.Request(f"https://api.github.com/user/repos?per_page=100&sort=updated", headers={"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"})
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        return [{"name": r["name"], "full_name": r["full_name"], "description": r.get("description", "") or "", "language": r.get("language", ""), "visibility": r["visibility"], "default_branch": r.get("default_branch", "main"), "updated_at": r["updated_at"], "html_url": r["html_url"]} for r in sorted(json.loads(resp.read()), key=lambda x: x["updated_at"], reverse=True)]
    except Exception as e:
        raise HTTPException(502, f"GitHub API error: {e}")

@app.get("/api/hf/spaces")
async def list_hf_spaces():
    import urllib.request
    req = urllib.request.Request(f"https://huggingface.co/api/spaces?author={HF_USER}", headers={"Authorization": f"Bearer {HF_TOKEN}"})
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        return [{"id": s["id"], "name": s["id"].split("/")[-1], "sdk": s.get("sdk", ""), "stage": s.get("runtime", {}).get("stage", "") if s.get("runtime") else "", "host": s.get("host", "")} for s in json.loads(resp.read())]
    except:
        return []

@app.get("/api/stats")
async def get_stats():
    projects = load_projects()
    total = sum(len(list_deploy_logs(n, 100)) for n in projects)
    return {"total_projects": len(projects), "auto_deploy_enabled": sum(1 for p in projects.values() if p.get("auto_deploy")), "total_deploys": total}

@app.get("/health")
async def health():
    return {"status": "ok", "version": __version__}

# ============ Static Files ============

STATIC_DIR = Path("/app/static")
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = STATIC_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(STATIC_DIR / "index.html"))
else:
    @app.get("/")
    async def index():
        return PlainTextResponse(f"Deploy Service v{__version__} - Frontend not built")
