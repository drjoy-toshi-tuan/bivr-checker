"""
(FLOW) Kiểm tra module saveCompletionFlag2db (drjoy^Persistence$saveCompletionFlag2db).

Nếu property `status` hoặc `smsFlag` bị để trống → WARNING.
"""
from typing import List, Dict
from .common import SAVE_COMPLETION_FLAG


def check_completion_flag(flows: dict) -> List[Dict]:
    issues: List[Dict] = []
    for flow_name, flow_data in flows.items():
        for mod_name, module in (flow_data.get("modules") or {}).items():
            if module.get("type") != SAVE_COMPLETION_FLAG:
                continue
            params = module.get("params", {}) or {}
            for fld, itype in (("status", "flag_status_empty"), ("smsFlag", "flag_sms_empty")):
                if not (params.get(fld) or "").strip():
                    issues.append({
                        "type": itype,
                        "severity": "WARNING",
                        "flow": flow_name,
                        "module": mod_name,
                        "field": fld,
                    })
    return issues
