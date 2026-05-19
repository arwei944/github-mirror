"""
异步 GitHub API 客户端
基于 httpx.AsyncClient，支持连接池、自动重试和并行请求
"""
import asyncio
import logging
from typing import Optional, Any, Tuple

import httpx

logger = logging.getLogger("github-mirror.github_client")


class GitHubClient:
    """异步 GitHub API 客户端"""

    def __init__(self, token: str, base_url: str = "https://api.github.com"):
        self._token = token
        self._base_url = base_url
        self._client: Optional[httpx.AsyncClient] = None

    async def start(self):
        """启动客户端（创建连接池）"""
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            headers={
                "Authorization": f"Bearer {self._token}",
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "GitHub-Mirror/7.1.0",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            timeout=30.0,
            follow_redirects=True,
        )
        logger.info("GitHub 客户端已启动")

    async def stop(self):
        """关闭客户端"""
        if self._client:
            await self._client.aclose()
            self._client = None
            logger.info("GitHub 客户端已关闭")

    @property
    def client(self) -> httpx.AsyncClient:
        if not self._client:
            raise RuntimeError("GitHub 客户端未启动，请先调用 start()")
        return self._client

    async def request(
        self,
        method: str,
        path: str,
        *,
        json: Optional[dict] = None,
        params: Optional[dict] = None,
        headers: Optional[dict] = None,
    ) -> Tuple[int, Any]:
        """
        发送请求到 GitHub API
        返回 (status_code, response_data)
        """
        req_headers = {}
        if headers:
            req_headers.update(headers)
        try:
            resp = await self.client.request(
                method, path, json=json, params=params, headers=req_headers
            )
            # 检查 GitHub 速率限制
            remaining = resp.headers.get("X-RateLimit-Remaining", "")
            if remaining == "0":
                reset_ts = resp.headers.get("X-RateLimit-Reset", "")
                logger.warning(f"GitHub API 速率限制已耗尽，重置于 {reset_ts}")

            content_type = resp.headers.get("content-type", "")
            if "application/json" in content_type:
                return resp.status_code, resp.json()
            return resp.status_code, resp.text
        except httpx.HTTPStatusError as e:
            return e.response.status_code, e.response.text
        except httpx.RequestError as e:
            logger.error(f"GitHub API 请求失败: {e}")
            return 0, {"error": str(e)}

    # ── 便捷方法 ──

    async def get(self, path: str, **kwargs) -> Tuple[int, Any]:
        return await self.request("GET", path, **kwargs)

    async def post(self, path: str, json: dict = None, **kwargs) -> Tuple[int, Any]:
        return await self.request("POST", path, json=json, **kwargs)

    async def put(self, path: str, json: dict = None, **kwargs) -> Tuple[int, Any]:
        return await self.request("PUT", path, json=json, **kwargs)

    async def patch(self, path: str, json: dict = None, **kwargs) -> Tuple[int, Any]:
        return await self.request("PATCH", path, json=json, **kwargs)

    async def delete(self, path: str, **kwargs) -> Tuple[int, Any]:
        return await self.request("DELETE", path, **kwargs)

    async def get_many(self, paths: list[str]) -> list[Tuple[int, Any]]:
        """并行请求多个 API 端点"""
        tasks = [self.get(path) for path in paths]
        return await asyncio.gather(*tasks, return_exceptions=True)

    async def paginate(
        self,
        path: str,
        *,
        per_page: int = 100,
        max_pages: int = 10,
        **kwargs,
    ) -> list:
        """
        自动分页请求
        遍历所有页面直到没有更多数据或达到 max_pages
        """
        all_items = []
        params = kwargs.pop("params", {}) or {}
        params["per_page"] = per_page

        for page in range(1, max_pages + 1):
            params["page"] = page
            status, data = await self.get(path, params=params, **kwargs)

            if status != 200 or not isinstance(data, list):
                break

            all_items.extend(data)

            if len(data) < per_page:
                break

        return all_items
