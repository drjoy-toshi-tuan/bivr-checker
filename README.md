# bivr-checker

Công cụ kiểm tra file `.bivr` của hệ thống Brekeke IVR (DrJOY).  
Đọc file cấu hình flow và IVR Properties, phát hiện lỗi cấu hình, sau đó xuất báo cáo Markdown bằng tiếng Việt.

---

## Mục lục

1. [File .bivr là gì?](#1-file-bivr-là-gì)
2. [Cài đặt](#2-cài-đặt)
3. [Cách dùng](#3-cách-dùng)
4. [Nội dung kiểm tra](#4-nội-dung-kiểm-tra)
5. [Cấu trúc project](#5-cấu-trúc-project)
6. [File cấu hình](#6-file-cấu-hình)
7. [Báo cáo output](#7-báo-cáo-output)

---

## 1. File .bivr là gì?

File `.bivr` là file cấu hình IVR của Brekeke PBX.  
Bên trong thực chất là một file **ZIP** chứa nhiều file JSON, mỗi file là một **flow** (luồng xử lý cuộc gọi).

```
hospital.bivr  (ZIP)
└── flows/
    ├── @flow_病院名$M｜診療.txt       ← Flow chính (Main)
    ├── @flow_病院名$S｜患者.txt        ← Sub-flow bệnh nhân
    ├── @flow_病院名$S｜用件.txt        ← Sub-flow mục đích gọi
    └── ...
```

Mỗi flow JSON có cấu trúc:
```json
{
  "name": "病院名$M｜診療",
  "start": "受付時間判定",
  "modules": {
    "受付時間判定": {
      "type": "drjoy^External Integration$acceptance_times",
      "params": { ... },
      "next": [ { "condition": "...", "nextModuleName": "..." } ]
    },
    "ジャンプ_患者": {
      "type": "drjoy^Custom Module$Custom Jump to Flow",
      "params": { "flowname": "drjoy^病院名$S｜患者" }
    },
    "転送": {
      "type": "drjoy^Call Transfer$call-transfer",
      "params": { "number": "0312345678" }
    }
  }
}
```

---

## 2. Cài đặt

Yêu cầu: **Python 3.8+**

```bash
# Clone repo
git clone https://github.com/<your-username>/bivr-checker.git
cd bivr-checker

# Cài dependency
pip install -r requirements.txt
```

---

## 3. Cách dùng

```
python main.py <file.bivr> <ivr.properties> <master|demo> [tuỳ chọn]
```

| Tham số | Bắt buộc | Mô tả |
|---|---|---|
| `file.bivr` | ✅ | File `.bivr` cần kiểm tra |
| `ivr.properties` | ✅ | File IVR Properties của môi trường đang dùng |
| `master` hoặc `demo` | ✅ | Môi trường: `master` = 本番, `demo` = デモ |
| `--compare prod.bivr` | ❌ | File `.bivr` bản hiện hành để so sánh diff |
| `--output report.md` | ❌ | Tên file báo cáo (mặc định: `report_YYYYMMDD_HHMMSS.md`) |

**Ví dụ thực tế:**

```bash
# Kiểm tra file mới trước khi deploy lên 本番
python main.py hospital_new.bivr master.properties master

# Kiểm tra file デモ + so sánh với bản đang chạy trên 本番
python main.py hospital_new.bivr demo.properties demo \
  --compare hospital_prod.bivr \
  --output report_hospital_20260615.md
```

---

## 4. Nội dung kiểm tra

### (a) IVR Properties — Kiểm tra API URL theo môi trường

So sánh từng field trong file IVR Properties với giá trị kỳ vọng của môi trường.

**Các field được kiểm tra** (phải khớp chính xác):

| Field | 本番 (Master) | デモ (Demo) |
|---|---|---|
| `amivoice.uri` | `ws://speech.internal.assistant.com:8000/ws` | `ws://10.0.20.11:8000/ws` |
| `context.settings.url` | `https://reserve.drjoy.jp/...` | `https://demo-reserve.famishare.jp/...` |
| `acceptance_times.url` | `https://reserve.drjoy.jp/...` | `https://demo-reserve.famishare.jp/...` |
| `speech.rag.url` | `http://speech.internal.assistant.com:8000/...` | `http://10.0.20.11:8000/...` |
| *(các URL khác)* | `reserve.drjoy.jp` | `demo-reserve.famishare.jp` |

**Các field bỏ qua** (optional — user được phép thay đổi):
- `announce`, `office_id`, `amivoice.silent_detection_ms`, `amivoice.timeout_ms`

---

### (b) Số điện thoại chuyển tiếp — Cảnh báo nếu là số test

Tìm tất cả module loại `drjoy^Call Transfer$call-transfer` trong các flow,  
kiểm tra xem số điện thoại có nằm trong danh sách số test của DrJOY không.

**Danh sách số test hiện tại** (xem [`config/test_phone_numbers.yaml`](config/test_phone_numbers.yaml)):
```
05017074509 / 05017066071 / 05017405708 / 05017070320
```

Nếu trùng → **CẢNH BÁO** (số test không được dùng trong môi trường thực tế).

---

### (c) Jump to Flow — Tên subflow có tồn tại không

Tìm tất cả module loại `drjoy^Custom Module$Custom Jump to Flow`,  
kiểm tra xem `flowname` có trỏ đến một flow thực sự tồn tại trong file `.bivr` không.

```json
"ジャンプ_患者": {
  "type": "drjoy^Custom Module$Custom Jump to Flow",
  "params": { "flowname": "drjoy^病院名$S｜患者" }  ← flow này phải tồn tại
}
```

Nếu flow đích không tồn tại → **LỖI**.

---

### (d) Jump to Flow — Module chưa cài đặt đích

Cũng tìm module `Custom Jump to Flow`, kiểm tra xem `flowname` có bị để trống không.

```json
"params": { "flowname": "" }  ← LỖI: chưa cài đặt đích
```

---

### (e) So sánh với bản hiện hành (差分)

So sánh file `.bivr` mới với file `.bivr` đang chạy trên production.  
Phát hiện các thay đổi:

| Mức độ | Loại thay đổi |
|---|---|
| 🔴 LỖI | Loại module (type) thay đổi |
| 🟡 CẢNH BÁO | Flow bị xóa, module bị xóa, params thay đổi, next thay đổi |
| 🔵 THÔNG TIN | Flow mới được thêm, module mới được thêm |

---

## 5. Cấu trúc project

```
bivr-checker/
│
├── main.py                          # Entry point — chạy tất cả check và tạo báo cáo
│
├── bivr_checker/
│   ├── parser.py                    # Giải nén .bivr (ZIP) → dict flows
│   ├── ivr_properties_parser.py     # Parse file IVR Properties (key=value)
│   ├── reporter.py                  # Tạo báo cáo Markdown tiếng Việt
│   └── checks/
│       ├── api_url.py               # Check (a): IVR Properties URL
│       ├── phone_number.py          # Check (b): Số điện thoại test
│       ├── jump_to_flow.py          # Check (c)(d): Jump to Flow
│       └── diff.py                  # Check (e): So sánh 2 file BIVR
│
├── config/
│   ├── environments.yaml            # Giá trị kỳ vọng theo môi trường 本番/デモ
│   └── test_phone_numbers.yaml      # Danh sách số điện thoại test DrJOY
│
└── requirements.txt                 # PyYAML
```

---

## 6. File cấu hình

### `config/environments.yaml`

Định nghĩa giá trị kỳ vọng cho từng môi trường.  
Khi thêm môi trường mới hoặc đổi URL → chỉ cần sửa file này, không cần đụng vào code.

```yaml
master:
  amivoice.uri: "ws://speech.internal.assistant.com:8000/ws"
  acceptance_times.url: "https://reserve.drjoy.jp/..."
  # ...

demo:
  amivoice.uri: "ws://10.0.20.11:8000/ws"
  acceptance_times.url: "https://demo-reserve.famishare.jp/..."
  # ...

optional_fields:   # Các field bỏ qua khi check
  - announce
  - office_id
  - amivoice.silent_detection_ms
  - amivoice.timeout_ms
```

### `config/test_phone_numbers.yaml`

Danh sách số điện thoại test. Khi thêm/xóa số → sửa file này.

```yaml
test_numbers:
  - "05017074509"
  - "05017066071"
  - "05017405708"
  - "05017070320"
```

---

## 7. Báo cáo output

Sau khi chạy, tool tạo một file `.md` với cấu trúc:

```
# Báo cáo kiểm tra BIVR

| File BIVR    | hospital.bivr     |
| Môi trường   | 本番 (Master)      |
| Thời gian    | 2026-06-15 10:00  |
| Kết quả      | ✅ PASS / ❌ FAIL  |

## Tổng quan
| 🔴 Lỗi     | 2 |
| 🟡 Cảnh báo | 1 |

## (a) Kiểm tra API URL
🔴 LỖI — `amivoice.uri`
  Giá trị hiện tại: ws://10.0.20.11:8000/ws
  Giá trị kỳ vọng:  ws://speech.internal.assistant.com:8000/ws

## (b) Kiểm tra số điện thoại
🟡 CẢNH BÁO — Flow: 病院名$S｜医療機関
  Module: 転送 | Số: 05017066071

## (c)(d) Jump to Flow
🟢 Tất cả hợp lệ.

## (e) So sánh với bản hiện hành
🟡 Module `転送` — params thay đổi
```
