"""
(FLOW) Kiểm tra module ContextMatchRouter (drjoy^Context Logic$ContextMatchRouter).

module1Name / module2Name:
  - Nếu là object <%object_name%> → object đó phải được tạo ở đâu đó trong toàn bộ
    flow (main + sub). Chưa tạo → ERROR.
  - Nếu là tên module thường → phải là tên module hợp lệ trong cùng flow. Không có → ERROR.
"""
import re
from typing import List, Dict
from .common import CONTEXT_MATCH_ROUTER, collect_created_objects, flow_module_names

_OBJECT_ONLY_RE = re.compile(r"^<%\s*([^%>]+?)\s*%>$")


def check_context_router(flows: dict) -> List[Dict]:
    issues: List[Dict] = []
    objects = collect_created_objects(flows)

    for flow_name, flow_data in flows.items():
        mod_names = flow_module_names(flow_data)
        for mod_name, module in (flow_data.get("modules") or {}).items():
            if module.get("type") != CONTEXT_MATCH_ROUTER:
                continue
            params = module.get("params", {}) or {}
            for slot in ("module1Name", "module2Name"):
                raw = (params.get(slot) or "").strip()
                if not raw:
                    continue
                m = _OBJECT_ONLY_RE.match(raw)
                if m:
                    obj = m.group(1).strip()
                    if obj not in objects:
                        issues.append({
                            "type": "ctxrouter_object_missing",
                            "severity": "ERROR",
                            "flow": flow_name,
                            "module": mod_name,
                            "slot": slot,
                            "object": obj,
                        })
                else:
                    if raw not in mod_names:
                        issues.append({
                            "type": "ctxrouter_module_missing",
                            "severity": "ERROR",
                            "flow": flow_name,
                            "module": mod_name,
                            "slot": slot,
                            "ref": raw,
                        })

    return issues
