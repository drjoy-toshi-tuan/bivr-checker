"""Tạo báo cáo Markdown bằng tiếng Việt (固有名詞のみ日本語)"""
from datetime import datetime
from typing import List, Dict, Optional

_EMOJI = {"ERROR": "🔴", "WARNING": "🟡", "INFO": "🔵", "OK": "🟢"}
_LABEL = {"ERROR": "LỖI", "WARNING": "CẢNH BÁO", "INFO": "THÔNG TIN"}

_TYPE_VI = {
    # api_url
    "missing_field": "Field bị thiếu trong IVR Properties",
    "value_mismatch": "Giá trị không khớp với môi trường",
    # phone_number
    "test_number_in_transfer": "Số test được dùng làm số chuyển tiếp (転送先)",
    "test_number_in_prompt": "Số test xuất hiện trong TTS prompt",
    # jump_to_flow
    "empty_jump_target": "Jump to Flow chưa cài đặt đích (flowname rỗng)",
    "invalid_jump_target": "Jump to Flow trỏ đến flow không tồn tại",
    # diff
    "flow_removed": "Flow bị xóa so với bản hiện hành",
    "flow_added": "Flow mới được thêm",
    "start_changed": "Module bắt đầu (start) thay đổi",
    "module_removed": "Module bị xóa",
    "module_added": "Module được thêm mới",
    "module_type_changed": "Loại module (type) thay đổi",
    "module_params_changed": "Tham số module (params) thay đổi",
    "module_transitions_changed": "Cài đặt chuyển tiếp (next) thay đổi",
}


def _count(issues: List[Dict], severity: str) -> int:
    return sum(1 for i in issues if i.get("severity") == severity)


def _section_header(title: str) -> List[str]:
    return [f"## {title}", ""]


def _render_api_issues(issues: List[Dict], env_label: str) -> List[str]:
    lines = _section_header(f"(a) Kiểm tra API URL — IVR Properties")
    if not issues:
        lines += [f"🟢 Tất cả URL đều đúng với môi trường **{env_label}**.", ""]
        return lines
    for i in issues:
        e = _EMOJI.get(i["severity"], "⚪")
        lbl = _LABEL.get(i["severity"], "")
        lines += [
            f"### {e} {lbl} — `{i['field']}`",
            "",
            f"- **Mô tả**: {_TYPE_VI.get(i['type'], i['type'])}",
            f"- **Giá trị hiện tại**: `{i.get('actual') or '(không có)'}`",
            f"- **Giá trị kỳ vọng**: `{i.get('expected', '')}`",
            "",
        ]
    return lines


def _render_phone_issues(issues: List[Dict]) -> List[str]:
    lines = _section_header("(b) Kiểm tra số điện thoại chuyển tiếp (転送先番号)")
    if not issues:
        lines += ["🟢 Không phát hiện số test nào trong cài đặt chuyển tiếp.", ""]
        return lines
    for i in issues:
        e = _EMOJI.get(i["severity"], "⚪")
        lbl = _LABEL.get(i["severity"], "")
        lines += [
            f"### {e} {lbl} — Flow: `{i['flow']}`",
            "",
            f"- **Module**: `{i['module']}`",
            f"- **Số điện thoại**: `{i['number']}`",
            f"- **Mô tả**: {_TYPE_VI.get(i['type'], i['type'])}",
            "",
        ]
    return lines


def _render_jump_issues(issues: List[Dict]) -> List[str]:
    lines = _section_header("(c)(d) Kiểm tra Jump to Flow")
    if not issues:
        lines += ["🟢 Tất cả cài đặt Jump to Flow đều hợp lệ.", ""]
        return lines
    for i in issues:
        e = _EMOJI.get(i["severity"], "⚪")
        lbl = _LABEL.get(i["severity"], "")
        detail = f" → Flow đích: `{i['target']}`" if i.get("target") else ""
        lines += [
            f"### {e} {lbl} — Flow: `{i['flow']}`",
            "",
            f"- **Module**: `{i['module']}`",
            f"- **Mô tả**: {_TYPE_VI.get(i['type'], i['type'])}{detail}",
            "",
        ]
    return lines


def _render_diff_issues(issues: List[Dict], base_path: str) -> List[str]:
    lines = _section_header("(e) So sánh với bản hiện hành (差分)")
    lines += [f"**File so sánh**: `{base_path}`", ""]
    if not issues:
        lines += ["🟢 Không có sự khác biệt nào.", ""]
        return lines

    by_flow: Dict[str, List[Dict]] = {}
    for i in issues:
        by_flow.setdefault(i["flow"], []).append(i)

    for flow, flow_issues in by_flow.items():
        lines += [f"### Flow: `{flow}`", ""]
        for i in flow_issues:
            e = _EMOJI.get(i["severity"], "⚪")
            desc = _TYPE_VI.get(i["type"], i["type"])
            detail = f" — {i['detail']}" if i.get("detail") else ""
            lines.append(f"- {e} **{desc}**{detail}")
        lines.append("")
    return lines


def generate_report(
    bivr_path: str,
    environment: str,
    api_issues: List[Dict],
    phone_issues: List[Dict],
    jump_issues: List[Dict],
    diff_issues: Optional[List[Dict]] = None,
    base_bivr_path: Optional[str] = None,
) -> str:
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    env_label = "本番 (Master)" if environment.lower() == "master" else "デモ (Demo)"

    all_issues = api_issues + phone_issues + jump_issues + (diff_issues or [])
    total_errors = _count(all_issues, "ERROR")
    total_warnings = _count(all_issues, "WARNING")

    verdict = "✅ PASS" if total_errors == 0 else "❌ FAIL"

    lines = [
        "# Báo cáo kiểm tra BIVR",
        "",
        f"| | |",
        f"|---|---|",
        f"| **File BIVR** | `{bivr_path}` |",
        f"| **Môi trường** | {env_label} |",
        f"| **Thời gian** | {now} |",
        f"| **Kết quả tổng thể** | {verdict} |",
        "",
        "---",
        "",
        "## Tổng quan",
        "",
        "| Mức độ | Số lượng |",
        "|---|---|",
        f"| 🔴 Lỗi (Error) | **{total_errors}** |",
        f"| 🟡 Cảnh báo (Warning) | **{total_warnings}** |",
        "",
        "---",
        "",
    ]

    lines += _render_api_issues(api_issues, env_label)
    lines += ["---", ""]
    lines += _render_phone_issues(phone_issues)
    lines += ["---", ""]
    lines += _render_jump_issues(jump_issues)

    if diff_issues is not None and base_bivr_path:
        lines += ["---", ""]
        lines += _render_diff_issues(diff_issues, base_bivr_path)

    return "\n".join(lines)
