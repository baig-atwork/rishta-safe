"""Entrypoint of the single-container image (infra/docker/combined.Dockerfile).

Runs the API on loopback and the Next.js server on the platform's PORT, and stops both if either one dies.

Why one container: free container hosts give one service and put it to sleep after idle time, so a two-service layout pays two
cold starts and needs a private network the free tiers do not offer. Here the web server reaches the API at 127.0.0.1, the
API is not reachable from outside the container, and the hosting platform sees one service with one health check.

Standard library only; it is a supervisor, not application code.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
import urllib.request
from types import FrameType

API_PORT = "8000"
API_HEALTH = f"http://127.0.0.1:{API_PORT}/healthz"
API_START_TIMEOUT_SECONDS = 60
STOP_GRACE_SECONDS = 10


def _wait_for_api(api: subprocess.Popen[bytes]) -> bool:
    deadline = time.monotonic() + API_START_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        if api.poll() is not None:
            return False
        try:
            with urllib.request.urlopen(API_HEALTH, timeout=2) as response:
                if response.status == 200:
                    return True
        except OSError:
            time.sleep(0.3)
    return False


def _stop(processes: list[subprocess.Popen[bytes]]) -> None:
    for process in processes:
        if process.poll() is None:
            process.terminate()
    deadline = time.monotonic() + STOP_GRACE_SECONDS
    for process in processes:
        try:
            process.wait(timeout=max(0.1, deadline - time.monotonic()))
        except subprocess.TimeoutExpired:
            process.kill()


def main() -> int:
    web_port = os.environ.get("PORT", "3000")

    # The only peer of the API is the web server on loopback, so trusting its forwarded headers is safe (the same reasoning
    # as the stand-alone API image, where the platform ingress is the only peer).
    api = subprocess.Popen(
        [
            "uvicorn",
            "bayan.api.app:create_app",
            "--factory",
            "--host",
            "127.0.0.1",
            "--port",
            API_PORT,
            "--proxy-headers",
            "--forwarded-allow-ips",
            "*",
        ]
    )
    if not _wait_for_api(api):
        print("entrypoint: the API did not become healthy; exiting", file=sys.stderr, flush=True)
        _stop([api])
        return 1

    web_env = {**os.environ, "PORT": web_port, "HOSTNAME": "0.0.0.0", "BAYAN_API_URL": f"http://127.0.0.1:{API_PORT}"}
    web = subprocess.Popen(["node", "server.js"], cwd="/srv/web", env=web_env)
    processes = [api, web]

    def on_signal(signum: int, _frame: FrameType | None) -> None:
        _stop(processes)
        sys.exit(128 + signum)

    signal.signal(signal.SIGTERM, on_signal)
    signal.signal(signal.SIGINT, on_signal)

    while True:
        for process in processes:
            code = process.poll()
            if code is not None:
                print(f"entrypoint: a child process exited with code {code}; stopping the other", file=sys.stderr, flush=True)
                _stop(processes)
                return code or 1
        time.sleep(0.5)


if __name__ == "__main__":
    sys.exit(main())
