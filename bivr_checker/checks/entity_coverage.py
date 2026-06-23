"""
(API) Đối chiếu Entity Classifier với list エンティティ trên admin DrJOY.

Với mỗi module Entity Classifier có categoryWords:
  - categoryWords phải khớp tên một category trên admin → không có → ERROR.
  - Conditional jump (next[].condition) phải phủ ĐỦ tên entity (output) đăng ký
    trong category đó. Thiếu entity nào → ERROR (liệt kê entity chưa được phủ).

`client` là một DrjoyClient đã login (hoặc bất kỳ object có category_names() và
entity_names(id) — để test offline bằng fixture).
"""
import re
from typing import List, Dict

ENTITY_CLASSIFIER = "drjoy^External Integration$Entity Classifier"
_CATCH_ALL = {"^.*$", "^.+$"}


def _is_covered(entity_name: str, conditions: List[str]) -> bool:
    """True nếu có một condition (không phải catch-all) khớp tên entity."""
    for c in conditions:
        c = (c or "").strip()
        if not c or c in _CATCH_ALL:
            continue
        try:
            if re.search(c, entity_name):
                return True
        except re.error:
            # regex hỏng → so khớp literal (bỏ neo ^$)
            if c.strip("^$") == entity_name:
                return True
    return False


def check_entity_coverage(flows: dict, client) -> List[Dict]:
    issues: List[Dict] = []
    categories = client.category_names()  # { name: id }
    entity_cache: Dict[str, list] = {}

    for flow_name, flow_data in flows.items():
        for mod_name, module in (flow_data.get("modules") or {}).items():
            if module.get("type") != ENTITY_CLASSIFIER:
                continue
            cw = ((module.get("params") or {}).get("categoryWords") or "").strip()
            if not cw:
                continue  # rỗng đã được check offline

            if cw not in categories:
                issues.append({
                    "type": "entity_category_not_found",
                    "severity": "ERROR",
                    "flow": flow_name,
                    "module": mod_name,
                    "ref": cw,
                })
                continue

            if cw not in entity_cache:
                entity_cache[cw] = client.entity_names(categories[cw])
            names = entity_cache[cw]

            conds = [n.get("condition", "") for n in (module.get("next") or [])]
            missing = [e for e in names if not _is_covered(e, conds)]
            if missing:
                issues.append({
                    "type": "entity_not_covered",
                    "severity": "ERROR",
                    "flow": flow_name,
                    "module": mod_name,
                    "ref": cw,
                    "value": ", ".join(missing),
                })

    return issues
