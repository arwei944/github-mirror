"""
GitHub Mirror - Async GitHub API Client
Replicates the exact behavior of the original github_request() function
using httpx.AsyncClient for async operation.
"""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional, Tuple

import httpx

from backend.config import settings

logger = logging.getLogger("github-mirror.github_client")


class GitHubClient:
    """
    Async GitHub API client.
    Replicates the exact same behavior as the original synchronous
    github_request() function in app.py (lines 227-293), including:
    - Same headers (Authorization, Accept, User-Agent, X-GitHub-Api-Version)
    - Same return format: Tuple[int, Any] - (status_code, response_data)
    - Same error handling: catch HTTPError and return (error_code, error_body)
    """

    def __init__(self) -> None:
        self._client: Optional[httpx.AsyncClient] = None
        self._base_url: str = settings.github_api_base
        self._token: str = settings.github_token

    def _build_headers(self, extra_headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self._token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "GitHub-Mirror/7.0.0",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if extra_headers:
            headers.update(extra_headers)
        return headers

    async def start(self) -> None:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                headers=self._build_headers(),
                timeout=30.0,
            )
            logger.info("GitHub API client started")

    async def stop(self) -> None:
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
            logger.info("GitHub API client stopped")
        self._client = None

    async def request(
        self,
        path: str,
        method: str = "GET",
        data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        accept: str = "application/vnd.github.v3+json",
    ) -> Tuple[int, Any]:
        if self._client is None:
            await self.start()
        assert self._client is not None
        url = path
        req_headers = self._build_headers(headers)
        req_headers["Accept"] = accept
        try:
            response = await self._client.request(
                method=method, url=url, json=data, headers=req_headers,
            )
            content_type = response.headers.get("Content-Type", "")
            if "application/json" in content_type:
                return response.status_code, response.json()
            return response.status_code, response.content
        except httpx.HTTPStatusError as e:
            raw = e.response.content
            try:
                body = json.loads(raw)
            except (json.JSONDecodeError, ValueError):
                body = raw.decode("utf-8", errors="replace")
            return e.response.status_code, body
        except httpx.HTTPError as e:
            error_code = getattr(e, "status_code", 502)
            if error_code is None:
                error_code = 502
            return error_code, {"error": str(e)}

    async def get(self, path: str, headers: Optional[Dict[str, str]] = None, **kwargs: Any) -> Tuple[int, Any]:
        return await self.request(path, method="GET", headers=headers, **kwargs)

    async def post(self, path: str, data: Optional[Dict[str, Any]] = None, headers: Optional[Dict[str, str]] = None, **kwargs: Any) -> Tuple[int, Any]:
        return await self.request(path, method="POST", data=data, headers=headers, **kwargs)

    async def put(self, path: str, data: Optional[Dict[str, Any]] = None, headers: Optional[Dict[str, str]] = None, **kwargs: Any) -> Tuple[int, Any]:
        return await self.request(path, method="PUT", data=data, headers=headers, **kwargs)

    async def patch(self, path: str, data: Optional[Dict[str, Any]] = None, headers: Optional[Dict[str, str]] = None, **kwargs: Any) -> Tuple[int, Any]:
        return await self.request(path, method="PATCH", data=data, headers=headers, **kwargs)

    async def delete(self, path: str, headers: Optional[Dict[str, str]] = None, **kwargs: Any) -> Tuple[int, Any]:
        return await self.request(path, method="DELETE", headers=headers, **kwargs)

    async def get_many(self, paths: List[str], headers: Optional[Dict[str, str]] = None) -> List[Tuple[int, Any]]:
        tasks = [self.get(path, headers=headers) for path in paths]
        return await asyncio.gather(*tasks)

    @staticmethod
    def filter_repo_fields(data: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "name": data.get("name", ""),
            "full_name": data.get("full_name", ""),
            "description": data.get("description", ""),
            "language": data.get("language", ""),
            "stargazers_count": data.get("stargazers_count", 0),
            "forks_count": data.get("forks_count", 0),
            "open_issues_count": data.get("open_issues_count", 0),
            "html_url": data.get("html_url", ""),
            "owner": {
                "login": data.get("owner", {}).get("login", ""),
                "avatar_url": data.get("owner", {}).get("avatar_url", ""),
            },
            "pushed_at": data.get("pushed_at", ""),
        }
