# bivr-checker

Công cụ kiểm tra file BIVR (Brekeke IVR). Output báo cáo Markdown bằng tiếng Việt.

## Cài đặt

```bash
pip install -r requirements.txt
```

## Cách dùng

```bash
python main.py <file.bivr> <ivr.properties> <master|demo> [--compare <prod.bivr>] [--output report.md]
```

**Ví dụ:**
```bash
# Kiểm tra môi trường 本番
python main.py hospital.bivr master.properties master

# Kiểm tra môi trường デモ + so sánh với bản hiện hành
python main.py hospital.bivr demo.properties demo --compare prod.bivr --output report.md
```

## Nội dung kiểm tra

| Mục | Nội dung |
|---|---|
| **(a)** | IVR Properties — URL/設定 đúng theo môi trường (本番/デモ) |
| **(b)** | Số điện thoại chuyển tiếp — cảnh báo nếu là số test |
| **(c)** | Jump to Flow — tên subflow có tồn tại trong file BIVR không |
| **(d)** | Jump to Flow — module chưa cài đặt đích (flowname rỗng) |
| **(e)** | So sánh với bản hiện hành (差分) |

## Cấu trúc project

```
bivr-checker/
├── config/
│   ├── environments.yaml        # URL kỳ vọng theo môi trường 本番/デモ
│   └── test_phone_numbers.yaml  # Danh sách số điện thoại test
├── bivr_checker/
│   ├── parser.py                # Parse file .bivr (ZIP → JSON flows)
│   ├── ivr_properties_parser.py # Parse file IVR Properties
│   ├── checks/
│   │   ├── api_url.py           # Check (a)
│   │   ├── phone_number.py      # Check (b)
│   │   ├── jump_to_flow.py      # Check (c)(d)
│   │   └── diff.py              # Check (e)
│   └── reporter.py              # Tạo báo cáo Markdown
└── main.py                      # Entry point
```

## Môi trường

| | 本番 (Master) | デモ (Demo) |
|---|---|---|
| Base URL | `reserve.drjoy.jp` | `demo-reserve.famishare.jp` |
| AmiVoice | `speech.internal.assistant.com` | `10.0.20.11` |
