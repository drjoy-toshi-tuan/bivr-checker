"""
(c) Kiểm tra tính nhất quán của Jump to Flow — tên subflow có tồn tại không
(d) Kiểm tra module Jump to Flow chưa được cài đặt đích (flowname rỗng)
"""
from typing import List, Dict

JUMP_TYPE = "drjoy^Custom Module$Custom Jump to Flow"


def check_jump_to_flow(flows: dict) -> List[Dict]:
    issues = []
    flow_names = set(flows.keys())

    for flow_name, flow_data in flows.items():
        for mod_name, module in flow_data.get("modules", {}).items():
            if module.get("type") != JUMP_TYPE:
                continue

            flowname = module.get("params", {}).get("flowname", "")

            # (d) flowname rỗng
            if not flowname:
                issues.append({
                    "type": "empty_jump_target",
                    "severity": "ERROR",
                    "flow": flow_name,
                    "module": mod_name,
                    "target": None,
                })
                continue

            # (c) flowname có dạng "drjoy^<tên flow thực>"
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
