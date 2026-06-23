"""Đọc cấu hình từ file .env (và biến môi trường hệ thống) — không cần dependency."""
import os
from pathlib import Path


def load_env(path: str = None) -> dict:
    """
    Trả về dict cấu hình: ưu tiên biến môi trường hệ thống, bổ sung từ .env.
    Dòng comment (#) và dòng trống được bỏ qua.
    """
    env = dict(os.environ)
    p = Path(path) if path else Path(".env")
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            # bỏ comment cuối dòng + nháy bao quanh
            value = value.split(" #")[0].strip().strip('"').strip("'")
            env.setdefault(key, value)
    return env
