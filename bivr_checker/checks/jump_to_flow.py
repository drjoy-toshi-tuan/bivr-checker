"""
Kiểm tra tính nhất quán của Jump to Flow — tên flow đích có tồn tại không,
và module Jump to Flow chưa được cài đặt đích (flowname rỗng).
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
                severity = "WARNING" if _is_subflow(flow_name) else "ERROR"
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
            if target not in flow_names:
                issues.append({
                    "type": "invalid_jump_target",
                    "severity": "ERROR",
                    "flow": flow_name,
                    "module": mod_name,
                    "target": target,
                })

    return issues
