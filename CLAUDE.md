# bivr-checker — Hướng dẫn cho Claude Code

## Mục đích
Kiểm tra file `.bivr` (Brekeke IVR) và tạo báo cáo Markdown tiếng Việt.

## Cách chạy khi user yêu cầu check file

### Check tổng thể (tất cả phần)
```bash
python main.py "<path/to/file.bivr>" <master|demo> --props "<path/to/ivr.properties>"
```

### Check tổng thể + so sánh diff
```bash
python main.py "<path/to/file.bivr>" <master|demo> --props "<path/to/ivr.properties>" --compare "<path/to/prod.bivr>"
```

### Chỉ check một phần cụ thể

Chỉ check số điện thoại chuyển tiếp:
```bash
python main.py "<path/to/file.bivr>" <master|demo> --only phone
```

Chỉ check Jump to Flow:
```bash
python main.py "<path/to/file.bivr>" <master|demo> --only jump
```

Chỉ check API URL (cần --props):
```bash
python main.py "<path/to/file.bivr>" <master|demo> --props "<path/to/ivr.properties>" --only api
```

Kết hợp nhiều phần:
```bash
python main.py "<path/to/file.bivr>" <master|demo> --props "<path/to/ivr.properties>" --only api phone jump
```

**Tùy chọn --only:** `api`, `phone`, `jump`, `diff`, `prompt`, `ctxrouter`, `regex`, `openai`, `reconfirm`, `flag`
- `api`: Kiểm tra API URL trong IVR Properties (cần `--props`)
- `phone`: Kiểm tra số điện thoại chuyển tiếp (liệt kê tất cả số, cảnh báo số test)
- `jump`: Kiểm tra Jump to Flow (tên flow đích có tồn tại không)
- `diff`: So sánh với bản hiện hành (cần `--compare`)
- `prompt`: **(MIX — cần `--props`)** Kiểm tra prompt/announce TTS, đối chiếu Property ↔ Flow. Cú pháp hợp lệ `{tts_g:...}` / `{tts_ai:...}` / `{tts_ai_prop:...}{tts_ai:...}`. Module rỗng prompt phải có `<tên module>.prompt` trong Property.
- `ctxrouter`: Kiểm tra ContextMatchRouter — object `<%...%>` dùng ở module1Name/module2Name đã được tạo chưa; tên module thường có hợp lệ không.
- `regex`: Kiểm tra regex condition jump (`next[].condition`) dính dấu cách 半角/全角 (làm flow dừng).
- `openai`: Kiểm tra generate_by_OpenAI — `module` input hợp lệ (không rỗng/`module`/không tồn tại), cảnh báo trùng module input, cảnh báo thiếu catch-all `^.*$`/`^.+$`.
- `reconfirm`: Kiểm tra Re-confirmation node data — object `<%...%>` đã tạo chưa; `#data#` thì `nodeName` phải tồn tại trong flow.
- `flag`: Kiểm tra saveCompletionFlag2db — `status`/`smsFlag` bị để trống (WARNING).

**Phân loại:** `prompt` là loại **hỗn hợp (mix)** cần cả Property + Flow; `ctxrouter`/`regex`/`openai`/`reconfirm`/`flag` chỉ cần Flow.

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
- Subflow (tên có S｜, サブ｜, Sub...): flowname rỗng trong Jump to Flow là có chủ đích → WARNING, không phải ERROR
