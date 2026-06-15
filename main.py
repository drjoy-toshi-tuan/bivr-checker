#!/usr/bin/env python3
"""
bivr-checker: Công cụ kiểm tra file BIVR (Brekeke IVR)
Output: Báo cáo Markdown bằng tiếng Việt (固有名詞のみ日本語)

Cách dùng:
  python main.py <file.bivr> <ivr.properties> <master|demo> [--compare <prod.bivr>] [--output report.md]
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
from bivr_checker.reporter import generate_report


def main():
    parser = argparse.ArgumentParser(
        description="Công cụ kiểm tra file BIVR (Brekeke IVR)"
    )
    parser.add_argument("bivr", help="Đường dẫn đến file .bivr cần kiểm tra")
    parser.add_argument("ivr_props", help="Đường dẫn đến file IVR Properties")
    parser.add_argument(
        "environment",
        choices=["master", "demo"],
        help="Môi trường: master (本番) hoặc demo (デモ)",
    )
    parser.add_argument(
        "--compare",
        metavar="PROD_BIVR",
        help="File .bivr bản hiện hành để so sánh diff (e)",
        default=None,
    )
    parser.add_argument(
        "--output",
        metavar="REPORT.md",
        help="Đường dẫn file báo cáo output (mặc định: report_YYYYMMDD_HHMMSS.md)",
        default=None,
    )
    args = parser.parse_args()

    print(f"[1/4] Đang đọc file BIVR: {args.bivr}")
    flows = parse_bivr(args.bivr)
    flow_list = ", ".join(flows.keys())
    print(f"      → {len(flows)} flow(s): {flow_list}")

    print(f"[2/4] Đang đọc IVR Properties: {args.ivr_props}")
    ivr_props = parse_ivr_properties(args.ivr_props)
    print(f"      → {len(ivr_props)} field(s)")

    print(f"[3/4] Đang kiểm tra (môi trường: {args.environment})...")
    api_issues = check_api_urls(ivr_props, args.environment)
    print(f"      (a) API URL       : {len(api_issues)} vấn đề")

    phone_issues = check_phone_numbers(flows)
    print(f"      (b) Số điện thoại : {len(phone_issues)} vấn đề")

    jump_issues = check_jump_to_flow(flows)
    print(f"      (c)(d) Jump Flow  : {len(jump_issues)} vấn đề")

    diff_issues = None
    if args.compare:
        print(f"      (e) So sánh với  : {args.compare}")
        flows_prod = parse_bivr(args.compare)
        diff_issues = diff_flows(flows_prod, flows)
        print(f"           → {len(diff_issues)} khác biệt")

    print("[4/4] Đang tạo báo cáo Markdown...")
    report = generate_report(
        bivr_path=args.bivr,
        environment=args.environment,
        api_issues=api_issues,
        phone_issues=phone_issues,
        jump_issues=jump_issues,
        diff_issues=diff_issues,
        base_bivr_path=args.compare,
    )

    output_path = args.output or f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(report)

    total_errors = sum(1 for i in (api_issues + phone_issues + jump_issues + (diff_issues or [])) if i.get("severity") == "ERROR")
    total_warnings = sum(1 for i in (api_issues + phone_issues + jump_issues + (diff_issues or [])) if i.get("severity") == "WARNING")

    print(f"\n{'✅ PASS' if total_errors == 0 else '❌ FAIL'} — Báo cáo: {output_path}")
    print(f"   🔴 Lỗi: {total_errors}   🟡 Cảnh báo: {total_warnings}")

    return 1 if total_errors > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
