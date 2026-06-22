"""
(FLOW) Kiểm tra sub-module (subs) của các module STT/DTMF:
  - AmiVoice / Speech to Text
  - External Integration / DTMF Custom
  - External Integration / DTMF AmiVoice STT Input
  - Soniox / Speech to Text

Với mỗi sub đã cấu hình (có label):
  - label phải đúng cú pháp: bắt đầu bằng "save-" (lưu transcribe) hoặc "rag-" (dùng rag).
    Sai cú pháp → ERROR.
  - moduleName (module được nối) rỗng → WARNING (chưa được nối).
"""
from typing import List, Dict

STT_DTMF_MODULES = {
    "drjoy^AmiVoice$Speech to Text",
    "drjoy^External Integration$DTMF Custom",
    "drjoy^External Integration$DTMF AmiVoice STT Input",
    "drjoy^Soniox$Speech to Text",
}

_VALID_PREFIXES = ("save-", "rag-")


def check_sub_module(flows: dict) -> List[Dict]:
    issues: List[Dict] = []
    for flow_name, flow_data in flows.items():
        for mod_name, module in (flow_data.get("modules") or {}).items():
            if module.get("type") not in STT_DTMF_MODULES:
                continue
            for sub in module.get("subs", []) or []:
                label = (sub.get("label") or "").strip()
                target = (sub.get("moduleName") or "").strip()
                if not label:
                    continue  # sub chưa cấu hình → bỏ qua
                if not label.startswith(_VALID_PREFIXES):
                    issues.append({
                        "type": "sub_label_syntax",
                        "severity": "ERROR",
                        "flow": flow_name,
                        "module": mod_name,
                        "label": label,
                    })
                if not target:
                    issues.append({
                        "type": "sub_not_connected",
                        "severity": "WARNING",
                        "flow": flow_name,
                        "module": mod_name,
                        "label": label,
                    })
    return issues
