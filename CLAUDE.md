# bivr-checker — Hướng dẫn cho Claude Code

## Mục đích
Kiểm tra file `.bivr` (Brekeke IVR) và tạo báo cáo Markdown tiếng Việt.

## Cách chạy khi user yêu cầu check file

Khi user cung cấp đường dẫn file `.bivr` và `.properties`, chạy lệnh:

```bash
python main.py "<path/to/file.bivr>" "<path/to/ivr.properties>" <master|demo> [--compare "<path/to/prod.bivr>"]
```

**Môi trường:**
- `master` = 本番（本番環境）
- `demo` = デモ（デモ環境）

## Sau khi chạy xong

1. Đọc file báo cáo `report_*.md` vừa được tạo
2. Hiển thị nội dung báo cáo cho user

## Lưu ý

- File `.bivr` là ZIP binary — không đọc trực tiếp bằng Read tool
- File `.properties` là text — có thể đọc bằng Read tool nếu cần debug
- Dependency: `pip install -r requirements.txt` nếu chưa cài
- Encoding Windows: lệnh đã được xử lý UTF-8 trong `main.py`
