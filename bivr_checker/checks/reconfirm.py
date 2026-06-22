"""
(FLOW) Kiểm tra module Re-confirmation node data (drjoy^Text To Speech$Re-confirmation node data).

  - Nếu prompt dùng object <%...%> → object phải được tạo ở đâu đó trong toàn bộ flow.
    Chưa tạo → ERROR.
  - Nếu prompt dùng #data# → nodeName phải được set và phải là tên module tồn tại trong
    cùng flow. Rỗng hoặc không tồn tại → ERROR.
"""
from typing import List, Dict
from .common import (
    TTS_RECONFIRM,
    collect_created_objects,
    flow_module_names,
    find_objects,
)

_DATA_MARKER = "#data#"


def check_reconfirm(flows: dict) -> List[Dict]:
    issues: List[Dict] = []
    objects = collect_created_objects(flows)

    for flow_name, flow_data in flows.items():
        mod_names = flow_module_names(flow_data)
        for mod_name, module in (flow_data.get("modules") or {}).items():
            if module.get("type") != TTS_RECONFIRM:
                continue
            params = module.get("params", {}) or {}
            prompt = params.get("prompt", "") or ""

            for obj in find_objects(prompt):
                if obj not in objects:
                    issues.append({
                        "type": "reconfirm_object_missing",
                        "severity": "ERROR",
                        "flow": flow_name,
                        "module": mod_name,
                        "object": obj,
                    })

            if _DATA_MARKER in prompt:
                node = (params.get("nodeName") or "").strip()
                if not node:
                    issues.append({
                        "type": "reconfirm_nodename_empty",
                        "severity": "ERROR",
                        "flow": flow_name,
                        "module": mod_name,
                    })
                elif node not in mod_names:
                    issues.append({
                        "type": "reconfirm_nodename_missing",
                        "severity": "ERROR",
                        "flow": flow_name,
                        "module": mod_name,
                        "node": node,
                    })

    return issues
