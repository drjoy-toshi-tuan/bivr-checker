"""
(FLOW) Kiểm tra biểu thức regex ở condition jump (next[].condition) của mọi module.

Nếu regex chứa dấu cách thật — " " (半角 U+0020) hoặc "　" (全角 U+3000) — thì
regex sẽ không khớp và làm flow dừng ngay lập tức → ERROR.
Lưu ý: "\\s" (backslash-s) là hợp lệ, không bị bắt.
"""
from typing import List, Dict

_HALF_SPACE = " "
_FULL_SPACE = "　"


def check_regex_space(flows: dict) -> List[Dict]:
    issues: List[Dict] = []
    for flow_name, flow_data in flows.items():
        for mod_name, module in (flow_data.get("modules") or {}).items():
            for nxt in module.get("next", []) or []:
                cond = nxt.get("condition", "")
                if not cond:
                    continue
                if _HALF_SPACE in cond or _FULL_SPACE in cond:
                    kind = "全角" if _FULL_SPACE in cond else "半角"
                    issues.append({
                        "type": "regex_space",
                        "severity": "ERROR",
                        "flow": flow_name,
                        "module": mod_name,
                        "label": nxt.get("label", ""),
                        "condition": cond,
                        "space_kind": kind,
                    })
    return issues
