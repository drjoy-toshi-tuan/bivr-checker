"""(e) So sánh sự khác biệt giữa 2 file BIVR"""
from typing import List, Dict


def diff_flows(flows_base: dict, flows_new: dict) -> List[Dict]:
    """
    So sánh flows_base (bản hiện hành) với flows_new (bản mới kiểm tra).
    """
    issues = []
    base_names = set(flows_base.keys())
    new_names = set(flows_new.keys())

    for name in sorted(base_names - new_names):
        issues.append({
            "type": "flow_removed",
            "severity": "WARNING",
            "flow": name,
            "detail": None,
        })

    for name in sorted(new_names - base_names):
        issues.append({
            "type": "flow_added",
            "severity": "INFO",
            "flow": name,
            "detail": None,
        })

    for name in sorted(base_names & new_names):
        base = flows_base[name]
        new = flows_new[name]

        if base.get("start") != new.get("start"):
            issues.append({
                "type": "start_changed",
                "severity": "WARNING",
                "flow": name,
                "detail": f"`{base.get('start')}` → `{new.get('start')}`",
            })

        base_mods = base.get("modules", {})
        new_mods = new.get("modules", {})
        base_mod_names = set(base_mods.keys())
        new_mod_names = set(new_mods.keys())

        for mod in sorted(base_mod_names - new_mod_names):
            issues.append({
                "type": "module_removed",
                "severity": "WARNING",
                "flow": name,
                "detail": f"Module `{mod}` đã bị xóa",
            })

        for mod in sorted(new_mod_names - base_mod_names):
            issues.append({
                "type": "module_added",
                "severity": "INFO",
                "flow": name,
                "detail": f"Module `{mod}` được thêm mới",
            })

        for mod in sorted(base_mod_names & new_mod_names):
            bm = base_mods[mod]
            nm = new_mods[mod]

            if bm.get("type") != nm.get("type"):
                issues.append({
                    "type": "module_type_changed",
                    "severity": "ERROR",
                    "flow": name,
                    "detail": f"Module `{mod}`: type `{bm.get('type')}` → `{nm.get('type')}`",
                })

            if bm.get("params") != nm.get("params"):
                issues.append({
                    "type": "module_params_changed",
                    "severity": "WARNING",
                    "flow": name,
                    "detail": f"Module `{mod}`: params thay đổi",
                })

            if bm.get("next") != nm.get("next"):
                issues.append({
                    "type": "module_transitions_changed",
                    "severity": "WARNING",
                    "flow": name,
                    "detail": f"Module `{mod}`: cài đặt chuyển tiếp (next) thay đổi",
                })

    return issues
