"""
部署服务
GitHub 仓库 → HF Space 自动部署
支持单仓库部署、批量部署、部署历史、Space 状态监控
"""
import asyncio
import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("github-mirror.deploy")

# 二进制文件扩展名
_BINARY_EXTS = (
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
    '.mp4', '.mp3', '.woff', '.woff2', '.ttf', '.eot',
    '.zip', '.tar', '.gz', '.7z', '.exe', '.dll',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
)

# 部署历史文件
_HISTORY_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "data", "deploy_history.json")


# ═══════════════════════════════════════════════════════════
#  部署历史管理
# ═══════════════════════════════════════════════════════════

class DeployHistory:
    """部署历史 - 线程安全"""

    def __init__(self):
        self._entries: List[Dict] = []
        self._lock = threading.Lock()
        self._load()

    def _load(self):
        if os.path.isfile(_HISTORY_FILE):
            try:
                with open(_HISTORY_FILE, "r", encoding="utf-8") as f:
                    self._entries = json.load(f)
            except Exception:
                self._entries = []

    def _save(self):
        Path(_HISTORY_FILE).parent.mkdir(parents=True, exist_ok=True)
        try:
            with open(_HISTORY_FILE, "w", encoding="utf-8") as f:
                json.dump(self._entries, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"保存部署历史失败: {e}")

    def add(self, repo: str, hf_user: str, space: str,
            status: str, hf_url: str = "", error: str = ""):
        entry = {
            "repo": repo,
            "hf_user": hf_user,
            "space": space,
            "status": status,
            "hf_url": hf_url,
            "error": error[:200] if error else "",
            "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
        with self._lock:
            self._entries.insert(0, entry)
            if len(self._entries) > 100:
                self._entries = self._entries[:100]
            self._save()

    def list(self, limit: int = 50) -> List[Dict]:
        with self._lock:
            return self._entries[:limit]

    def clear(self):
        with self._lock:
            self._entries.clear()
            self._save()


# 全局历史实例
deploy_history = DeployHistory()


# ═══════════════════════════════════════════════════════════
#  部署状态管理
# ═══════════════════════════════════════════════════════════

class DeployState:
    """单个仓库的部署状态"""

    def __init__(self, repo_name: str = "", space_name: str = "",
                 hf_url: str = "", repo_url: str = ""):
        self.status = "idle"
        self.step = ""
        self.progress = 0
        self.message = ""
        self.logs: List[str] = []
        self.version = ""
        self.repo_name = repo_name
        self.space_name = space_name
        self.hf_url = hf_url
        self.repo_url = repo_url

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "step": self.step,
            "progress": self.progress,
            "message": self.message,
            "logs": self.logs[-200:],
            "version": self.version,
            "repo_name": self.repo_name,
            "space_name": self.space_name,
            "hf_url": self.hf_url,
            "repo_url": self.repo_url,
        }

    def _log(self, msg: str):
        self.logs.append(msg)
        if len(self.logs) > 500:
            self.logs = self.logs[-500:]
        logger.info(f"[{self.repo_name}] {msg}")

    def _set(self, status: str, step: str, progress: int, msg: str = ""):
        self.status = status
        self.step = step
        self.progress = progress
        self.message = msg


# 活跃部署任务
_active_deploys: Dict[str, DeployState] = {}
_deploys_lock = threading.Lock()


def get_deploy_state(repo_name: str) -> Optional[Dict]:
    with _deploys_lock:
        state = _active_deploys.get(repo_name)
        return state.to_dict() if state else None


def get_all_active_deploys() -> List[Dict]:
    with _deploys_lock:
        return [s.to_dict() for s in _active_deploys.values()]


# ═══════════════════════════════════════════════════════════
#  部署核心逻辑
# ═══════════════════════════════════════════════════════════

def _detect_sdk(work_dir: str) -> str:
    """检测 Space SDK 类型"""
    if os.path.exists(os.path.join(work_dir, "app.py")):
        return "gradio"
    if os.path.exists(os.path.join(work_dir, "main.py")):
        return "gradio"
    if os.path.exists(os.path.join(work_dir, "index.html")):
        return "static"
    return "docker"


def _remove_binaries(work_dir: str) -> int:
    """删除二进制文件，返回删除数量"""
    count = 0
    for root, dirs, files in os.walk(work_dir):
        for f in files:
            if os.path.splitext(f)[1].lower() in _BINARY_EXTS:
                os.remove(os.path.join(root, f))
                count += 1
    return count


def _check_hf_space_status(hf_user: str, space_name: str,
                            hf_token: str = "", proxy: str = "") -> Dict:
    """检查 HF Space 运行状态"""
    env = os.environ.copy()
    if proxy:
        env["http_proxy"] = proxy
        env["https_proxy"] = proxy

    try:
        cmd = ["curl", "-sf",
               f"https://huggingface.co/api/spaces/{hf_user}/{space_name}"]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=15, env=env)
        if r.returncode == 0:
            data = json.loads(r.stdout)
            runtime = data.get("runtime", {})
            return {
                "stage": runtime.get("stage", "UNKNOWN"),
                "hardware": runtime.get("hardware", {}).get("current", "?"),
                "sha": runtime.get("sha", "")[:7],
                "last_update": data.get("lastModified", ""),
                "sdk": data.get("sdk", ""),
            }
    except Exception:
        pass
    return {"stage": "UNKNOWN", "hardware": "?", "sha": "", "last_update": "", "sdk": ""}


def deploy_repo(config: Dict[str, str], repo_name: str, space_name: str) -> str:
    """
    部署单个仓库到 HF Space（同步执行，应在后台线程中调用）
    返回 repo_name
    """
    gh_user = config.get("github_user", "")
    hf_user = config.get("hf_user", "")
    gh_token = config.get("github_token", "")
    hf_token = config.get("hf_token", "")
    proxy = config.get("proxy", "").strip()

    state = DeployState(
        repo_name=repo_name,
        space_name=space_name,
        hf_url=f"https://{hf_user}-{space_name}.hf.space",
        repo_url=f"https://github.com/{gh_user}/{repo_name}",
    )

    with _deploys_lock:
        _active_deploys[repo_name] = state

    gh_repo = f"https://{gh_user}:{gh_token}@github.com/{gh_user}/{repo_name}.git"
    hf_repo_id = f"{hf_user}/{space_name}"
    work_dir = os.path.join(tempfile.gettempdir(), f"deploy-{space_name}-{os.getpid()}")

    env = os.environ.copy()
    if proxy:
        env["http_proxy"] = proxy
        env["https_proxy"] = proxy
        env["HTTP_PROXY"] = proxy
        env["HTTPS_PROXY"] = proxy

    try:
        # Step 1: 克隆
        state._set("cloning", "Step 1/4: 克隆 GitHub 仓库", 5)
        state._log(f"━━━ Step 1/4: 克隆 GitHub 仓库 ━━━")
        state._log(f"  仓库: https://github.com/{gh_user}/{repo_name}")

        if os.path.exists(work_dir):
            shutil.rmtree(work_dir, ignore_errors=True)

        r = subprocess.run(
            ["git", "clone", "--depth", "1", gh_repo, work_dir],
            capture_output=True, text=True, timeout=300, env=env,
        )
        if r.returncode != 0:
            raise Exception(f"git clone 失败: {r.stderr[:300]}")

        file_count = sum(1 for _, _, files in os.walk(work_dir) for f in files)
        state._log(f"  克隆完成: {file_count} 个文件")

        # 获取版本号
        try:
            r2 = subprocess.run(
                ["git", "log", "-1", "--format=%h %s %ci"],
                cwd=work_dir, capture_output=True, text=True, timeout=10, env=env,
            )
            if r2.returncode == 0:
                ver = re.search(r'v[\d.]+', r2.stdout.strip())
                state.version = ver.group(0) if ver else ""
                if state.version:
                    state._log(f"  版本号: {state.version}")
        except Exception:
            pass

        state._set("cloning", "Step 1/4: 克隆完成 ✓", 25)
        state._log("[成功] Step 1 完成 ✓")

        # Step 2: 上传到 HF Space
        state._set("pushing", "Step 2/4: 上传到 HF Space", 30)
        state._log("━━━ Step 2/4: 上传到 HF Space ━━━")
        state._log(f"  目标: https://huggingface.co/spaces/{hf_repo_id}")

        git_dir = os.path.join(work_dir, ".git")
        if os.path.exists(git_dir):
            shutil.rmtree(git_dir, ignore_errors=True)

        removed = _remove_binaries(work_dir)
        if removed:
            state._log(f"  已删除 {removed} 个二进制文件")

        sdk = _detect_sdk(work_dir)
        state._log(f"  检测到 SDK: {sdk}")

        from huggingface_hub import HfApi
        hf_api = HfApi(token=hf_token)

        try:
            hf_api.create_repo(
                repo_id=hf_repo_id, repo_type="space",
                space_sdk=sdk, exist_ok=True, private=False,
            )
            state._log("  HF Space repo 就绪")
        except Exception as e:
            state._log(f"  创建 repo 跳过: {str(e)[:80]}")

        state._log("  正在上传文件 ...")
        hf_api.upload_folder(
            folder_path=work_dir,
            repo_id=hf_repo_id,
            repo_type="space",
            ignore_patterns=[".git/*", "node_modules/*", "__pycache__/*", "*.pyc", ".env"],
            commit_message=f"Deploy {repo_name} from GitHub {state.version}",
        )
        state._log("  文件上传完成")

        state._set("pushing", "Step 2/4: 上传完成 ✓", 50)
        state._log("[成功] Step 2 完成 ✓")

        # Step 3: 等待构建
        state._set("building", "Step 3/4: 等待 HF Space 构建", 55)
        state._log("━━━ Step 3/4: 等待 HF Space 构建 ━━━")

        build_success = False
        last_stage = ""
        for i in range(120):
            import time
            time.sleep(5)
            elapsed = (i + 1) * 5
            try:
                r4 = subprocess.run(
                    ["curl", "-sf", f"https://huggingface.co/api/spaces/{hf_repo_id}"],
                    capture_output=True, text=True, timeout=15, env=env,
                )
                if r4.returncode == 0:
                    data = json.loads(r4.stdout)
                    stage = data.get("runtime", {}).get("stage", "UNKNOWN")
                    hardware = data.get("runtime", {}).get("hardware", {}).get("current", "?")
                    if stage != last_stage:
                        state._log(f"  [{elapsed:3d}s] 状态: {stage} | 硬件: {hardware}")
                        last_stage = stage
                    if stage == "RUNNING":
                        state._log("  ✅ HF Space 构建成功！")
                        build_success = True
                        break
                    elif stage == "BUILD_ERROR":
                        state._log("  ❌ HF Space 构建失败！")
                        raise Exception("HF Space 构建失败（BUILD_ERROR）")
                    elif stage == "NO_APP_FILE":
                        raise Exception("HF Space 未找到应用入口文件（NO_APP_FILE）")
            except Exception as e:
                if "构建失败" in str(e) or "NO_APP_FILE" in str(e):
                    raise
                state._log(f"  [{elapsed:3d}s] {str(e)[:80]}")
            state._set("building", f"Step 3/4: 构建中... ({elapsed}s)", 55 + min(i, 40))

        if not build_success:
            state._log("  ⚠ 超时，构建可能仍在进行中")

        state._set("building", "Step 3/4: 构建完成 ✓", 95)
        state._log("[成功] Step 3 完成 ✓")

        # Step 4: 验证
        state._set("building", "Step 4/4: 验证部署", 96)
        state._log("━━━ Step 4/4: 验证部署 ━━━")
        import time
        time.sleep(3)
        try:
            r5 = subprocess.run(
                ["curl", "-sf", f"https://{hf_user}-{space_name}.hf.space/api/self-update/status"],
                capture_output=True, text=True, timeout=15, env=env,
            )
            if r5.returncode == 0:
                v_data = json.loads(r5.stdout)
                state._log(f"  版本: {v_data.get('version', '?')}")
                state._log("  Space 已就绪 ✓")
            else:
                state._log("  Space 可能还在构建中")
        except Exception:
            state._log("  验证超时（Space 可能还在构建中）")

        shutil.rmtree(work_dir, ignore_errors=True)
        state._set("done", "部署完成 ✅", 100)
        state._log(f"  🎉 {repo_name} 部署完成！")
        state._log(f"  🌐 https://{hf_user}-{space_name}.hf.space")

        deploy_history.add(repo_name, hf_user, space_name, "success",
                           f"https://{hf_user}-{space_name}.hf.space")

        # 发射事件
        try:
            from ..core.events import event_bus, Event, EventType
            import asyncio
            event = Event(
                type=EventType.DEPLOY_COMPLETE,
                data={"repo": repo_name, "space": space_name, "hf_url": state.hf_url},
                source="deploy_service",
            )
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.ensure_future(event_bus.publish(event))
        except Exception:
            pass

    except Exception as e:
        state._set("error", f"部署失败: {e}", state.progress)
        state._log(f"[失败] {e}")
        shutil.rmtree(work_dir, ignore_errors=True)
        deploy_history.add(repo_name, hf_user, space_name, "error", error=str(e)[:200])
    finally:
        with _deploys_lock:
            _active_deploys.pop(repo_name, None)

    return repo_name


def batch_deploy(config: Dict[str, str], repos: List[Dict]) -> List[Dict]:
    """
    批量部署多个仓库（同步串行执行，应在后台线程中调用）
    repos: [{"repo": "name", "space": "space_name"}, ...]
    """
    results = []
    total = len(repos)

    for i, repo_info in enumerate(repos):
        repo_name = repo_info["repo"]
        space_name = repo_info.get("space", repo_name)
        logger.info(f"批量部署 [{i+1}/{total}]: {repo_name} → {space_name}")

        try:
            deploy_repo(config, repo_name, space_name)
            results.append({"repo": repo_name, "status": "success"})
        except Exception as e:
            results.append({"repo": repo_name, "status": "error", "error": str(e)[:100]})

    return results


def start_deploy_thread(config: Dict, repo_name: str, space_name: str):
    """在后台线程中启动单个仓库部署"""
    t = threading.Thread(
        target=deploy_repo,
        args=(config, repo_name, space_name),
        daemon=True,
    )
    t.start()
    return t


def start_batch_deploy_thread(config: Dict, repos: List[Dict]):
    """在后台线程中启动批量部署"""
    t = threading.Thread(
        target=batch_deploy,
        args=(config, repos),
        daemon=True,
    )
    t.start()
    return t


def check_space_status(hf_user: str, space_name: str,
                       hf_token: str = "", proxy: str = "") -> Dict:
    """检查 HF Space 状态（公开接口）"""
    status = _check_hf_space_status(hf_user, space_name, hf_token, proxy)
    status["hf_user"] = hf_user
    status["space"] = space_name
    return status


def get_deployed_spaces(hf_token: str = "", proxy: str = "") -> List[Dict]:
    """从历史记录获取已部署的 Space 并检查状态"""
    history = deploy_history.list()
    deployed = {}
    for h in history:
        if h["status"] == "success" and h.get("hf_url"):
            space_name = h["space"]
            if space_name not in deployed:
                deployed[space_name] = {"hf_user": h["hf_user"], "space": space_name}

    results = []
    for space_name, info in deployed.items():
        status = check_space_status(info["hf_user"], space_name, hf_token, proxy)
        results.append(status)
    return results
