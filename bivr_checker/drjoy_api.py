"""
Client gọi admin API DrJOY để lấy danh sách エンティティ (entity).

Luồng (theo HAR):
  POST {oauth}/uaa/oauth/token  (form: grant_type=password, product=3, username,
        password, save_login=true)  → { access_token }
  POST {admin}/api/am/ha/brekeke/entity-category-names  {page,size}
        → { total, categories:[{id,name}] }
  POST {admin}/api/am/ha/brekeke/{categoryId}/entities  {keyword,page,size,sort}
        → { total, entities:[{entity,synonyms}] }

Admin API được uỷ quyền bằng header Authorization: Bearer <access_token>.
"""
import base64
import json
import ssl
import urllib.error
import urllib.parse
import urllib.request

ENV_HOSTS = {
    "master": {"oauth": "https://oauth.drjoy.jp", "admin": "https://admin.drjoy.jp"},
    "demo":   {"oauth": "https://demo-oauth.famishare.jp", "admin": "https://demo-admin.famishare.jp"},
}

# OAuth client (Basic auth) cho endpoint cấp token /uaa/oauth/token.
# Frontend admin DrJOY dùng chung client "demo:demo" cho cả master lẫn demo.
# THIẾU header này → endpoint trả 401 Unauthorized ngay (chưa kiểm tới user/pass).
# Có thể override bằng env DRJOY_CLIENT_BASIC (dạng "client_id:client_secret").
DEFAULT_CLIENT_BASIC = "demo:demo"

_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36")


class DrjoyApiError(Exception):
    pass


class DrjoyClient:
    def __init__(self, env: str, username: str, password: str, timeout: int = 20,
                 client_basic: str = None):
        if env not in ENV_HOSTS:
            raise DrjoyApiError(f"môi trường không hợp lệ: {env}")
        self.hosts = ENV_HOSTS[env]
        self.username = username
        self.password = password
        self.timeout = timeout
        self.client_basic = client_basic or DEFAULT_CLIENT_BASIC
        self.token = None
        self._ctx = ssl.create_default_context()

    def _headers(self, json_body: bool):
        h = {
            "Accept": "application/json, text/plain, */*",
            "Origin": self.hosts["admin"],
            "Referer": self.hosts["admin"] + "/",
            "User-Agent": _UA,
        }
        if json_body:
            h["Content-Type"] = "application/json"
            if self.token:
                h["Authorization"] = "Bearer " + self.token
        else:
            h["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8"
        return h

    def login(self) -> str:
        data = {
            "grant_type": "password",
            "product": "3",
            "username": self.username,
            "password": self.password,
            "save_login": "true",
        }
        headers = self._headers(json_body=False)
        # Xác thực OAuth client bằng Basic auth (bắt buộc, nếu không sẽ 401).
        headers["Authorization"] = "Basic " + base64.b64encode(
            self.client_basic.encode("utf-8")).decode("ascii")
        req = urllib.request.Request(
            self.hosts["oauth"] + "/uaa/oauth/token",
            data=urllib.parse.urlencode(data).encode("utf-8"),
            method="POST",
            headers=headers,
        )
        try:
            resp = urllib.request.urlopen(req, timeout=self.timeout, context=self._ctx)
            body = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            raise DrjoyApiError(f"đăng nhập thất bại: HTTP {e.code}")
        except Exception as e:
            raise DrjoyApiError(f"đăng nhập lỗi: {e}")
        token = body.get("access_token")
        if not token:
            raise DrjoyApiError("đăng nhập: không nhận được access_token")
        self.token = token
        return token

    def _post_json(self, path: str, obj: dict) -> dict:
        req = urllib.request.Request(
            self.hosts["admin"] + path,
            data=json.dumps(obj).encode("utf-8"),
            method="POST",
            headers=self._headers(json_body=True),
        )
        try:
            resp = urllib.request.urlopen(req, timeout=self.timeout, context=self._ctx)
            return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            raise DrjoyApiError(f"API {path} lỗi: HTTP {e.code}")
        except Exception as e:
            raise DrjoyApiError(f"API {path} lỗi: {e}")

    def category_names(self) -> dict:
        """Trả về { name: id } cho toàn bộ category (phân trang)."""
        out, page, size = {}, 0, 100
        while True:
            d = self._post_json("/api/am/ha/brekeke/entity-category-names",
                                 {"page": page, "size": size})
            cats = d.get("categories", []) or []
            for c in cats:
                if c.get("name"):
                    out[c["name"]] = c.get("id")
            total = d.get("total", 0)
            if not cats or (page + 1) * size >= total:
                break
            page += 1
        return out

    def entity_names(self, category_id: str) -> list:
        """Trả về danh sách tên entity (output) của một category (phân trang)."""
        names, page, size = [], 0, 100
        while True:
            d = self._post_json("/api/am/ha/brekeke/" + category_id + "/entities",
                                 {"keyword": "", "page": page, "size": size, "sort": "updated_down"})
            ents = d.get("entities", []) or []
            for x in ents:
                if x.get("entity"):
                    names.append(x["entity"])
            total = d.get("total", 0)
            if not ents or (page + 1) * size >= total:
                break
            page += 1
        return names
