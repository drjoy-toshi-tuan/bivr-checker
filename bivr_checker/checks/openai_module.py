"""
(FLOW) Kiểm tra module generate_by_OpenAI (drjoy^External Integration$generate_by_OpenAI).

  - params.module (module input để OpenAI lấy output xử lý):
      + rỗng, hoặc đúng literal "module", hoặc không tồn tại trong cùng flow → ERROR
  - Hai module OpenAI trong cùng flow cùng trỏ về một module input giống nhau → WARNING
  - Trong condition jump của module OpenAI: nếu thiếu regex catch-all (^.*$ hoặc ^.+$)
    để fallback khi OpenAI trả sai output → WARNING
"""
from typing import List, Dict
from .common import GENERATE_BY_OPENAI, flow_module_names

_CATCH_ALL = {"^.*$", "^.+$"}


def check_openai_module(flows: dict) -> List[Dict]:
    issues: List[Dict] = []

    for flow_name, flow_data in flows.items():
        mod_names = flow_module_names(flow_data)
        # Gom các giá trị module input hợp lệ để phát hiện trùng trong cùng flow
        module_ref_count: Dict[str, int] = {}
        openai_mods = []

        for mod_name, module in (flow_data.get("modules") or {}).items():
            if module.get("type") != GENERATE_BY_OPENAI:
                continue
            params = module.get("params", {}) or {}
            mref = (params.get("module") or "").strip()
            openai_mods.append((mod_name, module, mref))

            # module input không hợp lệ
            if mref == "" or mref == "module" or mref not in mod_names:
                if mref == "":
                    reason = "empty"
                elif mref == "module":
                    reason = "literal"
                else:
                    reason = "not_found"
                issues.append({
                    "type": "openai_module_invalid",
                    "severity": "ERROR",
                    "flow": flow_name,
                    "module": mod_name,
                    "ref": mref,
                    "reason": reason,
                })
            else:
                module_ref_count[mref] = module_ref_count.get(mref, 0) + 1

            # thiếu catch-all trong condition jump
            conds = {(n.get("condition") or "") for n in (module.get("next") or [])}
            if not (conds & _CATCH_ALL):
                issues.append({
                    "type": "openai_no_catchall",
                    "severity": "WARNING",
                    "flow": flow_name,
                    "module": mod_name,
                })

        # cảnh báo trùng module input
        dup = {ref for ref, c in module_ref_count.items() if c >= 2}
        for mod_name, module, mref in openai_mods:
            if mref in dup:
                issues.append({
                    "type": "openai_dup_module",
                    "severity": "WARNING",
                    "flow": flow_name,
                    "module": mod_name,
                    "ref": mref,
                })

    return issues
