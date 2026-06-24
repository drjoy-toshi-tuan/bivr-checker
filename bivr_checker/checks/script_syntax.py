"""
(FLOW) Kiểm tra cú pháp JavaScript trong module General / Script (@General$Script).

Dùng `node --check` (bọc trong function để khớp ngữ nghĩa với Brekeke Rhino —
cho phép `return` ở top-level). Nếu không có Node.js trên máy → WARNING (bỏ qua).
"""
import os
import re
import shutil
import subprocess
import tempfile
from typing import List, Dict, Optional

SCRIPT_TYPE = "@General$Script"
_NODE = shutil.which("node")

# Số dòng wrapper chèn trước script ("(function(){") để dịch ngược về dòng thật
_WRAP_OFFSET = 1


def _node_check(script: str) -> Optional[Dict]:
    """
    Trả về dict {line, code, message} mô tả lỗi cú pháp, hoặc None nếu hợp lệ.
      - line   : số dòng thật trong script (đã trừ dòng wrapper)
      - code   : nội dung dòng đó
      - message: thông báo lỗi (SyntaxError: ...)
    """
    wrapped = "(function(){\n" + script + "\n});"
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
        f.write(wrapped)
        path = f.name
    try:
        r = subprocess.run([_NODE, "--check", path], capture_output=True, text=True, timeout=15)
        if r.returncode == 0:
            return None
        return _parse_node_error(r.stderr, script)
    except Exception:
        return None
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


def _parse_node_error(stderr: str, script: str) -> Dict:
    """Bóc tách số dòng + thông báo lỗi từ stderr của `node --check`."""
    err_lines = stderr.splitlines()

    # Thông báo lỗi: dòng chứa 'SyntaxError' (nếu không có thì lấy dòng cuối)
    message = next((ln.strip() for ln in err_lines if "SyntaxError" in ln), None)
    if not message:
        nonempty = [ln.strip() for ln in err_lines if ln.strip()]
        message = nonempty[-1] if nonempty else "SyntaxError"

    # Số dòng: dòng đầu dạng "<path>.js:<line>"
    wrapped_line = None
    for ln in err_lines:
        m = re.search(r":(\d+)\s*$", ln.strip())
        if m:
            wrapped_line = int(m.group(1))
            break

    line_no = None
    code = None
    if wrapped_line is not None:
        line_no = max(1, wrapped_line - _WRAP_OFFSET)
        src_lines = script.splitlines()
        if 1 <= line_no <= len(src_lines):
            code = src_lines[line_no - 1].strip()
    return {"line": line_no, "code": code, "message": message}


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
            info = _node_check(script)
            if info:
                issues.append({
                    "type": "script_syntax",
                    "severity": "ERROR",
                    "flow": flow_name,
                    "module": mod_name,
                    "line": info.get("line"),
                    "code": info.get("code"),
                    "message": info.get("message"),
                    "value": info.get("message"),  # tương thích ngược
                })
    return issues
