"""
(MIX) Kiểm tra prompt / announce (TTS) — đối chiếu IVR Property ↔ Flow.

Quy tắc:
  - Trong IVR Property, mỗi dòng `<tên module>.prompt={tts_g:...}` hoặc `{tts_ai:...}`:
      + Sai cú pháp → ERROR
      + Tên module không khớp module nào trong flow → WARNING
  - Với các module TTS trong flow (Text to speech, Re-confirmation node data,
    DTMF Custom, DTMF AmiVoice STT Input, Phone Normalization, DOB Re-confirmation):
      + Nếu prompt trong module rỗng → phải có `<tên module>.prompt` trong Property,
        nếu không có → ERROR (prompt chưa được set ở đâu cả)
      + Nếu prompt trong module có giá trị → phải đúng cú pháp, sai → ERROR
  - Speech Retry Counter dùng prompt_true / prompt_false: chỉ kiểm tra cú pháp
    cho prompt nào có nội dung (≥1 ký tự); rỗng cả hai thì bỏ qua.
"""
from typing import List, Dict
from .common import (
    PROMPT_SINGLE_MODULES,
    DTMF_MODULES,
    TTS_RETRY_COUNTER,
    all_module_names,
    validate_tts_syntax,
)

_PROMPT_SUFFIX = ".prompt"


def check_prompt_tts(flows: dict, ivr_props: dict) -> List[Dict]:
    issues: List[Dict] = []
    ivr_props = ivr_props or {}
    module_names = all_module_names(flows)

    # A. Kiểm tra các dòng .prompt trong IVR Property
    for key, value in ivr_props.items():
        if not key.endswith(_PROMPT_SUFFIX):
            continue
        mod_name = key[: -len(_PROMPT_SUFFIX)]
        if not validate_tts_syntax(value):
            issues.append({
                "type": "prop_prompt_syntax",
                "severity": "ERROR",
                "field": key,
                "value": value,
            })
        if mod_name not in module_names:
            issues.append({
                "type": "prop_prompt_no_module",
                "severity": "WARNING",
                "field": mod_name,
            })

    # B. Kiểm tra prompt trong từng module TTS của flow
    for flow_name, flow_data in flows.items():
        for mod_name, module in (flow_data.get("modules") or {}).items():
            mtype = module.get("type", "")
            params = module.get("params", {}) or {}

            if mtype in PROMPT_SINGLE_MODULES:
                val = (params.get("prompt") or "").strip()
                if val:
                    if not validate_tts_syntax(val):
                        issues.append({
                            "type": "flow_prompt_syntax",
                            "severity": "ERROR",
                            "flow": flow_name,
                            "module": mod_name,
                            "value": val,
                        })
                else:
                    # prompt rỗng → phải có trong property
                    prop_key = mod_name + _PROMPT_SUFFIX
                    if prop_key not in ivr_props:
                        issues.append({
                            "type": "prompt_not_set",
                            "severity": "ERROR",
                            "flow": flow_name,
                            "module": mod_name,
                        })

            elif mtype == TTS_RETRY_COUNTER:
                for fld in ("prompt_true", "prompt_false"):
                    val = (params.get(fld) or "").strip()
                    if val and not validate_tts_syntax(val):
                        issues.append({
                            "type": "flow_prompt_syntax",
                            "severity": "ERROR",
                            "flow": flow_name,
                            "module": mod_name,
                            "field": fld,
                            "value": val,
                        })

            elif mtype in DTMF_MODULES:
                # params["prompt"] = "{recstart}" (bỏ qua); chỉ validate prompt_retry nếu có
                val = (params.get("prompt_retry") or "").strip()
                if val and not validate_tts_syntax(val):
                    issues.append({
                        "type": "flow_prompt_syntax",
                        "severity": "ERROR",
                        "flow": flow_name,
                        "module": mod_name,
                        "field": "prompt_retry",
                        "value": val,
                    })

    return issues
