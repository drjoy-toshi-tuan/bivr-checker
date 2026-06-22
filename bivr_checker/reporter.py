"""Tạo báo cáo Markdown bằng tiếng Việt (固有名詞のみ日本語)"""
from datetime import datetime
from typing import List, Dict, Optional

_EMOJI = {"ERROR": "🔴", "WARNING": "🟡", "INFO": "🔵", "OK": "🟢"}
_LABEL = {"ERROR": "LỖI", "WARNING": "CẢNH BÁO", "INFO": "THÔNG TIN"}

# Ký hiệu ngăn giữa tên group và flow khi hiển thị
_FLOW_SEP = " ／ "


def _fmt_flow(name: Optional[str]) -> str:
    """Hiển thị tên flow: thay dấu '$' ngăn group/flow bằng ' ／ '."""
    if not name:
        return ""
    return name.replace("$", _FLOW_SEP)

_TYPE_VI = {
    # api_url
    "missing_field": "Field bị thiếu trong IVR Properties",
    "value_mismatch": "Giá trị không khớp với môi trường",
    # phone_number
    "transfer_number": "Số điện thoại chuyển tiếp",
    "test_number_in_transfer": "Số test được dùng làm số chuyển tiếp (転送先)",
    "test_number_in_prompt": "Số test xuất hiện trong TTS prompt",
    # jump_to_flow
    "jump_module": "Module Jump To Flow",
    "empty_jump_target": "Jump To Flow chưa cài đặt đích (flowname rỗng)",
    "invalid_jump_target": "Jump To Flow trỏ đến flow không tồn tại",
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


# 備考 (Ghi chú) cho từng trạng thái module Jump To Flow
_JUMP_NOTE = {
    "ok": "🟢 Hợp lệ",
    "invalid": "🔴 Flow đích không tồn tại",
    "empty": "🔴 Chưa cài đặt flow đích",
    "empty_subflow": "🟡 Subflow — chưa đặt đích (có chủ đích)",
}


def _count(issues: List[Dict], severity: str) -> int:
    return sum(1 for i in issues if i.get("severity") == severity)


def _section_header(title: str) -> List[str]:
    return [f"## {title}", ""]


def _render_api_issues(issues: List[Dict], env_label: str) -> List[str]:
    lines = _section_header("Kiểm tra API URL — IVR Properties")
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
    # 「転送」モジュール検証 — Kiểm tra module [Nối Máy]
    lines = _section_header("「転送」モジュール検証 — Kiểm tra module [Nối Máy]")

    transfer_numbers = [i for i in issues if i.get("type") == "transfer_number"]
    warnings = [i for i in issues if i.get("severity") == "WARNING"]

    # Bảng tất cả số điện thoại chuyển tiếp
    if transfer_numbers:
        lines += ["### Danh sách số điện thoại chuyển tiếp trong BIVR", ""]
        lines += ["| Flow | Module | Số điện thoại (転送先) | 備考 (Ghi chú) |", "|---|---|---|---|"]
        for i in transfer_numbers:
            note = "⚠️ Số test" if i.get("is_test") else ""
            lines.append(f"| `{_fmt_flow(i['flow'])}` | `{i['module']}` | `{i['number']}` | {note} |")
        lines.append("")
    else:
        lines += ["🟢 Không tồn tại module 「転送」 (Nối Máy) trong BIVR.", ""]

    # Cảnh báo số test
    if not warnings:
        lines += ["🟢 Không phát hiện số test nào trong cài đặt chuyển tiếp.", ""]
    else:
        for i in warnings:
            e = _EMOJI.get(i["severity"], "⚪")
            lbl = _LABEL.get(i["severity"], "")
            lines += [
                f"### {e} {lbl} — Flow: `{_fmt_flow(i['flow'])}`",
                "",
                f"- **Module**: `{i['module']}`",
                f"- **Số điện thoại**: `{i['number']}`",
                f"- **Mô tả**: {_TYPE_VI.get(i['type'], i['type'])}",
                "",
            ]
    return lines


def _render_jump_issues(issues: List[Dict]) -> List[str]:
    # 「Jump To Flow」モジュール検証 — Kiểm tra module [Jump To Flow]
    lines = _section_header("「Jump To Flow」モジュール検証 — Kiểm tra module [Jump To Flow]")

    jump_modules = [i for i in issues if i.get("type") == "jump_module"]
    problems = [i for i in issues if i.get("type") in ("empty_jump_target", "invalid_jump_target")]

    # Bảng tất cả module Jump To Flow
    if jump_modules:
        lines += ["### Danh sách module Jump To Flow trong BIVR", ""]
        lines += ["| Flow | Module | ジャンプ先 (Flow đích) | 備考 (Ghi chú) |", "|---|---|---|---|"]
        for i in jump_modules:
            target = f"`{_fmt_flow(i['target'])}`" if i.get("target") else "(chưa cài đặt)"
            note = _JUMP_NOTE.get(i.get("status"), "")
            lines.append(f"| `{_fmt_flow(i['flow'])}` | `{i['module']}` | {target} | {note} |")
        lines.append("")
    else:
        lines += ["🟢 Không tồn tại module 「Jump To Flow」 trong BIVR.", ""]

    # Chi tiết lỗi / cảnh báo
    if not problems:
        lines += ["🟢 Tất cả cài đặt Jump To Flow đều hợp lệ.", ""]
    else:
        for i in problems:
            e = _EMOJI.get(i["severity"], "⚪")
            lbl = _LABEL.get(i["severity"], "")
            detail = f" → Flow đích: `{_fmt_flow(i['target'])}`" if i.get("target") else ""
            lines += [
                f"### {e} {lbl} — Flow: `{_fmt_flow(i['flow'])}`",
                "",
                f"- **Module**: `{i['module']}`",
                f"- **Mô tả**: {_TYPE_VI.get(i['type'], i['type'])}{detail}",
                "",
            ]
    return lines


def _render_diff_issues(issues: List[Dict], base_path: str) -> List[str]:
    lines = _section_header("So sánh với bản hiện hành (差分)")
    lines += [f"**File so sánh**: `{base_path}`", ""]
    if not issues:
        lines += ["🟢 Không có sự khác biệt nào.", ""]
        return lines

    by_flow: Dict[str, List[Dict]] = {}
    for i in issues:
        by_flow.setdefault(i["flow"], []).append(i)

    for flow, flow_issues in by_flow.items():
        lines += [f"### Flow: `{_fmt_flow(flow)}`", ""]
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
    api_issues: Optional[List[Dict]],
    phone_issues: Optional[List[Dict]],
    jump_issues: Optional[List[Dict]],
    diff_issues: Optional[List[Dict]] = None,
    base_bivr_path: Optional[str] = None,
) -> str:
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    env_label = "本番 (Master)" if environment.lower() == "master" else "デモ (Demo)"

    # Tính tổng lỗi/cảnh báo (không tính INFO)
    all_issues = (api_issues or []) + (phone_issues or []) + (jump_issues or []) + (diff_issues or [])
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

    sections = []
    if api_issues is not None:
        sections.append(_render_api_issues(api_issues, env_label))
    if phone_issues is not None:
        sections.append(_render_phone_issues(phone_issues))
    if jump_issues is not None:
        sections.append(_render_jump_issues(jump_issues))
    if diff_issues is not None and base_bivr_path:
        sections.append(_render_diff_issues(diff_issues, base_bivr_path))

    for idx, section in enumerate(sections):
        lines += section
        if idx < len(sections) - 1:
            lines += ["---", ""]

    return "\n".join(lines)
