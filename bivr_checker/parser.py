"""Parser cho file .bivr (ZIP chứa các flow JSON)"""
import re
import zipfile
import json


def parse_bivr(bivr_path: str) -> dict:
    """
    Giải nén file .bivr và trả về dict các flow.
    Return: {flow_name: flow_data_dict}
    """
    flows = {}
    with zipfile.ZipFile(bivr_path, "r") as zf:
        for entry in zf.namelist():
            if entry.startswith("flows/") and entry.endswith(".txt"):
                with zf.open(entry) as f:
                    content = f.read().decode("utf-8")
                    data = json.loads(content)
                    flows[data["name"]] = data
    return flows


def detect_environment(flows: dict):
    """
    Đọc môi trường (master/demo) ngay trong file flow.
    Mỗi flow có trường `desc` dạng "[env=demo]" / "[env=master]".
    Trả về 'master' / 'demo', hoặc None nếu không tìm thấy.
    """
    for data in (flows or {}).values():
        desc = data.get("desc") or ""
        m = re.search(r"env\s*=\s*(master|demo)", desc, re.IGNORECASE)
        if m:
            return m.group(1).lower()
    return None

