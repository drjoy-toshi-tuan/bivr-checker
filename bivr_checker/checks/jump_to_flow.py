"""
Kiểm tra module 「Jump To Flow」 — liệt kê tất cả module Jump to Flow trong mọi flow,
và kiểm tra tên flow đích (ジャンプ先) có tồn tại không.
Subflow (tên chứa S｜, サブ｜, サブ, Sub...) được phép có flowname rỗng → WARNING, không phải ERROR.
"""
from typing import List, Dict

JUMP_TYPE = "drjoy^Custom Module$Custom Jump to Flow"
SUBFLOW_MARKERS = ("S｜", "サブ｜", "サブ", "Sub｜", "Sub", "sub｜", "sub")


def _is_subflow(flow_name: str) -> bool:
    part = flow_name.split("$", 1)[1] if "$" in flow_name else flow_name
    return any(part.startswith(m) for m in SUBFLOW_MARKERS)


def check_jump_to_flow(flows: dict) -> List[Dict]:
    issues = []
    flow_names = set(flows.keys())

    for flow_name, flow_data in flows.items():
        for mod_name, module in flow_data.get("modules", {}).items():
            if module.get("type") != JUMP_TYPE:
                continue

            flowname = module.get("params", {}).get("flowname", "")

            if not flowname:
                # Subflow không có đích jump là có chủ đích → WARNING
                is_sub = _is_subflow(flow_name)
                severity = "WARNING" if is_sub else "ERROR"
                status = "empty_subflow" if is_sub else "empty"
                # Luôn ghi nhận module Jump to Flow (INFO)
                issues.append({
                    "type": "jump_module",
                    "severity": "INFO",
                    "flow": flow_name,
                    "module": mod_name,
                    "target": None,
                    "status": status,
                })
                issues.append({
                    "type": "empty_jump_target",
                    "severity": severity,
                    "flow": flow_name,
                    "module": mod_name,
                    "target": None,
                })
                continue

            # flowname có dạng "drjoy^<tên flow thực>"
            target = flowname[len("drjoy^"):] if flowname.startswith("drjoy^") else flowname
            valid = target in flow_names
            # Luôn ghi nhận module Jump to Flow (INFO)
            issues.append({
                "type": "jump_module",
                "severity": "INFO",
                "flow": flow_name,
                "module": mod_name,
                "target": target,
                "status": "ok" if valid else "invalid",
            })
            if not valid:
                issues.append({
                    "type": "invalid_jump_target",
                    "severity": "ERROR",
                    "flow": flow_name,
                    "module": mod_name,
                    "target": target,
                })

    return issues
