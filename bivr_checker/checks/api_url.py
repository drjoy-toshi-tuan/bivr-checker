"""(a) Kiểm tra API URL trong IVR Properties theo môi trường"""
from pathlib import Path
from typing import List, Dict
import yaml

CONFIG_PATH = Path(__file__).parent.parent.parent / "config" / "environments.yaml"


def check_api_urls(ivr_props: dict, environment: str) -> List[Dict]:
    """
    So sánh IVR Properties với giá trị kỳ vọng của môi trường.
    Bỏ qua các field optional.
    """
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    expected = config.get(environment.lower(), {})
    optional = set(config.get("optional_fields", []))
    issues = []

    for key, expected_value in expected.items():
        if key in optional:
            continue
        actual_value = ivr_props.get(key)
        if actual_value is None:
            issues.append({
                "type": "missing_field",
                "severity": "ERROR",
                "field": key,
                "expected": str(expected_value),
                "actual": None,
            })
        elif str(actual_value) != str(expected_value):
            issues.append({
                "type": "value_mismatch",
                "severity": "ERROR",
                "field": key,
                "expected": str(expected_value),
                "actual": str(actual_value),
            })

    return issues
