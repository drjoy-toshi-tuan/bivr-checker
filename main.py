#!/usr/bin/env python3
"""
bivr-checker: Công cụ kiểm tra file BIVR (Brekeke IVR)
Output: Báo cáo Markdown bằng tiếng Việt (固有名詞のみ日本語)

Cách dùng:
  python main.py <file.bivr> <master|demo> [--props <ivr.properties>] [--compare <prod.bivr>]
                 [--only api phone jump diff] [--output report.md]

Ví dụ chỉ check số điện thoại:
  python main.py file.bivr master --only phone
"""
import argparse
import sys
import io
from datetime import datetime

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from bivr_checker.parser import parse_bivr
from bivr_checker.ivr_properties_parser import parse_ivr_properties
from bivr_checker.checks.api_url import check_api_urls
from bivr_checker.checks.phone_number import check_phone_numbers
from bivr_checker.checks.jump_to_flow import check_jump_to_flow
from bivr_checker.checks.diff import diff_flows
from bivr_checker.checks.prompt_tts import check_prompt_tts
from bivr_checker.checks.context_router import check_context_router
from bivr_checker.checks.regex_space import check_regex_space
from bivr_checker.checks.openai_module import check_openai_module
from bivr_checker.checks.reconfirm import check_reconfirm
from bivr_checker.checks.completion_flag import check_completion_flag
from bivr_checker.checks.sub_module import check_sub_module
from bivr_checker.checks.script_syntax import check_script_syntax
from bivr_checker.checks.entity_classifier import check_entity_classifier
from bivr_checker.reporter import generate_report

ALL_CHECKS = {
    "api", "phone", "jump",
    "prompt", "ctxrouter", "regex", "openai", "reconfirm", "flag", "submod",
    "script", "entity",
}
# Các check cần file IVR Properties
PROPS_CHECKS = {"api", "prompt"}


def main():
    parser = argparse.ArgumentParser(
        description="Công cụ kiểm tra file BIVR (Brekeke IVR)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Các phần check:\n"
            "  api       — Kiểm tra API URL trong IVR Properties\n"
            "  phone     — Kiểm tra số điện thoại chuyển tiếp\n"
            "  jump      — Kiểm tra Jump to Flow\n"
            "  diff      — So sánh với bản hiện hành (cần --compare)\n"
            "  prompt    — (MIX) Kiểm tra prompt/announce TTS, đối chiếu Property ↔ Flow (cần --props)\n"
            "  ctxrouter — Kiểm tra ContextMatchRouter: object đã được tạo chưa\n"
            "  regex     — Kiểm tra regex condition jump dính dấu cách\n"
            "  openai    — Kiểm tra generate_by_OpenAI (module input + catch-all fallback)\n"
            "  reconfirm — Kiểm tra Re-confirmation node data (object / #data# / nodeName)\n"
            "  flag      — Kiểm tra saveCompletionFlag2db (status / smsFlag rỗng)\n"
            "  submod    — Kiểm tra sub-module STT/DTMF (label save-/rag-, đã nối chưa)\n"
            "  script    — Kiểm tra cú pháp JS của module General/Script (cần Node.js)\n"
            "  entity    — Kiểm tra Entity Classifier (nodeName, categoryWords)\n"
            "\nVí dụ:\n"
            "  python main.py file.bivr master --props ivr.properties\n"
            "  python main.py file.bivr master --only phone\n"
            "  python main.py file.bivr master --only phone jump\n"
            "  python main.py file.bivr master --props ivr.properties --compare prod.bivr --only diff\n"
        ),
    )
    parser.add_argument("bivr", help="Đường dẫn đến file .bivr cần kiểm tra")
    parser.add_argument(
        "environment",
        choices=["master", "demo"],
        help="Môi trường: master (本番) hoặc demo (デモ)",
    )
    parser.add_argument(
        "--props",
        metavar="IVR.PROPERTIES",
        help="Đường dẫn đến file IVR Properties (bắt buộc khi check api)",
        default=None,
    )
    parser.add_argument(
        "--compare",
        metavar="PROD_BIVR",
        help="File .bivr bản hiện hành để so sánh diff (bắt buộc khi check diff)",
        default=None,
    )
    parser.add_argument(
        "--only",
        nargs="+",
        choices=[
            "api", "phone", "jump", "diff",
            "prompt", "ctxrouter", "regex", "openai", "reconfirm", "flag", "submod",
            "script", "entity",
        ],
        metavar="CHECK",
        help=(
            "Chỉ chạy check được chỉ định: api, phone, jump, diff, "
            "prompt, ctxrouter, regex, openai, reconfirm, flag, submod, script, entity "
            "(mặc định: tất cả)"
        ),
        default=None,
    )
    parser.add_argument(
        "--output",
        metavar="REPORT.md",
        help="Đường dẫn file báo cáo output (mặc định: report_YYYYMMDD_HHMMSS.md)",
        default=None,
    )
    args = parser.parse_args()

    # Xác định các phần cần check
    selected = set(args.only) if args.only else ALL_CHECKS | ({"diff"} if args.compare else set())

    # Validate
    needs_props = selected & PROPS_CHECKS
    if needs_props and not args.props:
        print(f"Lỗi: Check {sorted(needs_props)} cần file IVR Properties. Dùng --props <file>.")
        sys.exit(1)
    if "diff" in selected and not args.compare:
        print("Lỗi: Check 'diff' cần file so sánh. Dùng --compare <prod.bivr>.")
        sys.exit(1)

    print(f"[1/{3 + (1 if args.compare else 0)}] Đang đọc file BIVR: {args.bivr}")
    flows = parse_bivr(args.bivr)
    flow_list = ", ".join(flows.keys())
    print(f"      → {len(flows)} flow(s): {flow_list}")

    ivr_props = None
    if selected & PROPS_CHECKS:
        print(f"[2/...] Đang đọc IVR Properties: {args.props}")
        ivr_props = parse_ivr_properties(args.props)
        print(f"        → {len(ivr_props)} field(s)")

    env_label = "master (本番)" if args.environment == "master" else "demo (デモ)"
    print(f"[Kiểm tra] Môi trường: {env_label} | Phần check: {', '.join(sorted(selected))}")

    # Chạy từng phần check
    api_issues = None
    if "api" in selected:
        api_issues = check_api_urls(ivr_props, args.environment)
        errors = sum(1 for i in api_issues if i.get("severity") == "ERROR")
        print(f"  API URL       : {errors} lỗi")

    phone_issues = None
    if "phone" in selected:
        phone_issues = check_phone_numbers(flows)
        transfers = sum(1 for i in phone_issues if i.get("type") == "transfer_number")
        warnings = sum(1 for i in phone_issues if i.get("severity") == "WARNING")
        print(f"  Số điện thoại : {transfers} số tìm thấy, {warnings} cảnh báo")

    jump_issues = None
    if "jump" in selected:
        jump_issues = check_jump_to_flow(flows)
        modules = sum(1 for i in jump_issues if i.get("type") == "jump_module")
        errors = sum(1 for i in jump_issues if i.get("severity") == "ERROR")
        warnings = sum(1 for i in jump_issues if i.get("severity") == "WARNING")
        print(f"  Jump to Flow  : {modules} module tìm thấy, {errors} lỗi, {warnings} cảnh báo")

    diff_issues = None
    if "diff" in selected and args.compare:
        print(f"  So sánh với  : {args.compare}")
        flows_prod = parse_bivr(args.compare)
        diff_issues = diff_flows(flows_prod, flows)
        print(f"               → {len(diff_issues)} khác biệt")

    def _ew(issues):
        e = sum(1 for i in issues if i.get("severity") == "ERROR")
        w = sum(1 for i in issues if i.get("severity") == "WARNING")
        return e, w

    prompt_issues = None
    if "prompt" in selected:
        prompt_issues = check_prompt_tts(flows, ivr_props)
        e, w = _ew(prompt_issues)
        print(f"  Prompt/TTS    : {e} lỗi, {w} cảnh báo")

    ctxrouter_issues = None
    if "ctxrouter" in selected:
        ctxrouter_issues = check_context_router(flows)
        e, w = _ew(ctxrouter_issues)
        print(f"  ContextRouter : {e} lỗi, {w} cảnh báo")

    regex_issues = None
    if "regex" in selected:
        regex_issues = check_regex_space(flows)
        e, w = _ew(regex_issues)
        print(f"  Regex jump    : {e} lỗi, {w} cảnh báo")

    openai_issues = None
    if "openai" in selected:
        openai_issues = check_openai_module(flows)
        e, w = _ew(openai_issues)
        print(f"  OpenAI        : {e} lỗi, {w} cảnh báo")

    reconfirm_issues = None
    if "reconfirm" in selected:
        reconfirm_issues = check_reconfirm(flows)
        e, w = _ew(reconfirm_issues)
        print(f"  Re-confirm    : {e} lỗi, {w} cảnh báo")

    flag_issues = None
    if "flag" in selected:
        flag_issues = check_completion_flag(flows)
        e, w = _ew(flag_issues)
        print(f"  CompletionFlag: {e} lỗi, {w} cảnh báo")

    submod_issues = None
    if "submod" in selected:
        submod_issues = check_sub_module(flows)
        e, w = _ew(submod_issues)
        print(f"  Sub-module    : {e} lỗi, {w} cảnh báo")

    script_issues = None
    if "script" in selected:
        script_issues = check_script_syntax(flows)
        e, w = _ew(script_issues)
        print(f"  Script JS     : {e} lỗi, {w} cảnh báo")

    entity_issues = None
    if "entity" in selected:
        entity_issues = check_entity_classifier(flows)
        e, w = _ew(entity_issues)
        print(f"  Entity Class. : {e} lỗi, {w} cảnh báo")

    print("Đang tạo báo cáo Markdown...")
    report = generate_report(
        bivr_path=args.bivr,
        environment=args.environment,
        api_issues=api_issues,
        phone_issues=phone_issues,
        jump_issues=jump_issues,
        diff_issues=diff_issues,
        prompt_issues=prompt_issues,
        ctxrouter_issues=ctxrouter_issues,
        regex_issues=regex_issues,
        openai_issues=openai_issues,
        reconfirm_issues=reconfirm_issues,
        flag_issues=flag_issues,
        submod_issues=submod_issues,
        script_issues=script_issues,
        entity_issues=entity_issues,
        base_bivr_path=args.compare,
    )

    output_path = args.output or f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(report)

    all_issues = (
        (api_issues or []) + (phone_issues or []) + (jump_issues or []) + (diff_issues or [])
        + (prompt_issues or []) + (ctxrouter_issues or []) + (regex_issues or [])
        + (openai_issues or []) + (reconfirm_issues or []) + (flag_issues or [])
        + (submod_issues or []) + (script_issues or []) + (entity_issues or [])
    )
    total_errors = sum(1 for i in all_issues if i.get("severity") == "ERROR")
    total_warnings = sum(1 for i in all_issues if i.get("severity") == "WARNING")

    print(f"\n{'✅ PASS' if total_errors == 0 else '❌ FAIL'} — Báo cáo: {output_path}")
    print(f"   🔴 Lỗi: {total_errors}   🟡 Cảnh báo: {total_warnings}")

    return 1 if total_errors > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
