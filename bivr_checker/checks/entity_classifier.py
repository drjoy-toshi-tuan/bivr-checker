"""
(FLOW) Kiểm tra module External Integration / Entity Classifier (drjoy).

  - nodeName: phải là tên module tồn tại trong cùng flow. Rỗng / không tồn tại → ERROR.
  - categoryWords: rỗng → ERROR.

(Phần đối chiếu categoryWords với list エンティティ trên admin API + độ phủ
 conditional jump cần truy cập API ngoài — xử lý riêng, chưa gồm ở đây.)
"""
from typing import List, Dict
from .common import flow_module_names

ENTITY_CLASSIFIER = "drjoy^External Integration$Entity Classifier"


def check_entity_classifier(flows: dict) -> List[Dict]:
    issues: List[Dict] = []
    for flow_name, flow_data in flows.items():
        mod_names = flow_module_names(flow_data)
        for mod_name, module in (flow_data.get("modules") or {}).items():
            if module.get("type") != ENTITY_CLASSIFIER:
                continue
            params = module.get("params", {}) or {}

            node = (params.get("nodeName") or "").strip()
            if not node:
                issues.append({
                    "type": "entity_nodename_empty",
                    "severity": "ERROR",
                    "flow": flow_name,
                    "module": mod_name,
                })
            elif node not in mod_names:
                issues.append({
                    "type": "entity_nodename_missing",
                    "severity": "ERROR",
                    "flow": flow_name,
                    "module": mod_name,
                    "node": node,
                })

            cw = (params.get("categoryWords") or "").strip()
            if not cw:
                issues.append({
                    "type": "entity_categorywords_empty",
                    "severity": "ERROR",
                    "flow": flow_name,
                    "module": mod_name,
                })

    return issues
