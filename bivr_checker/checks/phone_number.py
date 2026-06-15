"""(b) Kiểm tra số điện thoại chuyển tiếp — cảnh báo nếu là số test"""
import re
from pathlib import Path
from typing import List, Dict
import yaml

CONFIG_PATH = Path(__file__).parent.parent.parent / "config" / "test_phone_numbers.yaml"

TRANSFER_TYPE = "drjoy^Call Transfer$call-transfer"
TTS_TYPE = "drjoy^Text To Speech$Text to speech"


def _normalize(phone: str) -> str:
    return re.sub(r"[-\s]", "", phone)


def _extract_from_prompt(prompt: str) -> List[str]:
    """Trích xuất số điện thoại từ TTS prompt (SSML)"""
    found = re.findall(
        r'<say-as[^>]*interpret-as=["\']telephone["\'][^>]*>([\d\-\s]+)</say-as>',
        prompt,
    )
    # Thêm số điện thoại dạng thường (0X0-XXXX-XXXX)
    found += re.findall(r"\b(0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4})\b", prompt)
    return [_normalize(p) for p in found]


def check_phone_numbers(flows: dict) -> List[Dict]:
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    test_numbers = {_normalize(n) for n in config.get("test_numbers", [])}
    issues = []

    for flow_name, flow_data in flows.items():
        for mod_name, module in flow_data.get("modules", {}).items():
            mod_type = module.get("type", "")
            params = module.get("params", {})

            if mod_type == TRANSFER_TYPE:
                raw = params.get("number", "")
                if raw and _normalize(raw) in test_numbers:
                    issues.append({
                        "type": "test_number_in_transfer",
                        "severity": "WARNING",
                        "flow": flow_name,
                        "module": mod_name,
                        "number": raw,
                    })

            elif mod_type == TTS_TYPE:
                prompt = params.get("prompt", "")
                if prompt:
                    for phone in _extract_from_prompt(prompt):
                        if phone in test_numbers:
                            issues.append({
                                "type": "test_number_in_prompt",
                                "severity": "WARNING",
                                "flow": flow_name,
                                "module": mod_name,
                                "number": phone,
                            })

    return issues
