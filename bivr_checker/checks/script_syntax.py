"""
(FLOW) Kiểm tra cú pháp JavaScript trong module General / Script (@General$Script).

Dùng `node --check` (bọc trong function để khớp ngữ nghĩa với Brekeke Rhino —
cho phép `return` ở top-level). Nếu không có Node.js trên máy → WARNING (bỏ qua).
"""
import os
import shutil
import subprocess
import tempfile
from typing import List, Dict, Optional

SCRIPT_TYPE = "@General$Script"
_NODE = shutil.which("node")


def _node_check(script: str) -> Optional[str]:
    """Trả về thông báo lỗi cú pháp nếu có, None nếu hợp lệ."""
    wrapped = "(function(){\n" + script + "\n});"
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
        f.write(wrapped)
        path = f.name
    try:
        r = subprocess.run([_NODE, "--check", path], capture_output=True, text=True, timeout=15)
        if r.returncode == 0:
            return None
        for line in r.stderr.splitlines():
            if "SyntaxError" in line:
                return line.strip()
        lines = [ln for ln in r.stderr.splitlines() if ln.strip()]
        return lines[-1].strip() if lines else "SyntaxError"
    except Exception:
        return None
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


def check_script_syntax(flows: dict) -> List[Dict]:
    issues: List[Dict] = []
    node_missing_noted = False
    for flow_name, flow_data in flows.items():
        for mod_name, module in (flow_data.get("modules") or {}).items():
            if module.get("type") != SCRIPT_TYPE:
                continue
            script = (module.get("params") or {}).get("script", "") or ""
            if not script.strip():
                continue
            if not _NODE:
                if not node_missing_noted:
                    issues.append({
                        "type": "script_node_missing",
                        "severity": "WARNING",
                        "flow": flow_name,
                        "module": mod_name,
                    })
                    node_missing_noted = True
                continue
            err = _node_check(script)
            if err:
                issues.append({
                    "type": "script_syntax",
                    "severity": "ERROR",
                    "flow": flow_name,
                    "module": mod_name,
                    "value": err,
                })
    return issues
