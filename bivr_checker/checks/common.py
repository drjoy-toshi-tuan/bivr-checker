"""Helper dùng chung cho các check hỗn hợp (Property + Flow)."""
import re
from typing import Dict, List, Set

# ── Hằng số loại module (type = "drjoy^<Category>$<Name>") ────────────────────--
TTS_TEXT = "drjoy^Text To Speech$Text to speech"
TTS_RECONFIRM = "drjoy^Text To Speech$Re-confirmation node data"
TTS_RETRY_COUNTER = "drjoy^Text To Speech$Speech Retry Counter"
DTMF_CUSTOM = "drjoy^External Integration$DTMF Custom"
DTMF_AMIVOICE = "drjoy^External Integration$DTMF AmiVoice STT Input"
PHONE_NORMALIZATION = "drjoy^TS Custom Module$Phone Normalization"
DOB_RECONFIRM = "drjoy^TS Custom Module$DOB Re-confirmation"

CONTEXT_MATCH_ROUTER = "drjoy^Context Logic$ContextMatchRouter"
GENERATE_BY_OPENAI = "drjoy^External Integration$generate_by_OpenAI"
SAVE_COMPLETION_FLAG = "drjoy^Persistence$saveCompletionFlag2db"

SAVE2DB = "drjoy^Persistence$save2db"
SAVE_CONTEXT2DB = "drjoy^Persistence$saveContext2DB"
MODULE_RESULT_BINDER = "drjoy^TS Custom Module$Module Result Binder"
SCRIPT = "@General$Script"

# Các module dùng 1 prompt TTS duy nhất (params["prompt"] = {tts_g/tts_ai:...})
PROMPT_SINGLE_MODULES = {
    TTS_TEXT,
    TTS_RECONFIRM,
    PHONE_NORMALIZATION,
    DOB_RECONFIRM,
}

# Module DTMF: params["prompt"] = "{recstart}" (marker ghi âm, KHÔNG phải TTS);
# TTS thật (nếu có) nằm ở params["prompt_retry"].
DTMF_MODULES = {
    DTMF_CUSTOM,
    DTMF_AMIVOICE,
}

# Object hệ thống (built-in) — luôn coi như đã được tạo
BUILTIN_OBJECTS = {"incoming_phone"}

# Regex tìm object dạng <%object_name%>
_OBJECT_RE = re.compile(r"<%\s*([^%>]+?)\s*%>")
# Regex tìm $runner.setObject("name", ...) — chỉ lấy tên là chuỗi literal
_SETOBJECT_RE = re.compile(r"setObject\s*\(\s*[\"']([^\"']+)[\"']")


def fmt_flow(name: str) -> str:
    return name or ""


def find_objects(text: str) -> List[str]:
    """Trích tất cả tên object <%...%> trong một chuỗi."""
    if not text:
        return []
    return [m.strip() for m in _OBJECT_RE.findall(text)]


def collect_created_objects(flows: dict) -> Set[str]:
    """
    Quét toàn bộ flow (main + sub), trả về tập tên object đã được tạo ở đâu đó.

    Nguồn tạo object:
      - save2db / saveContext2DB / generate_by_OpenAI : params.contextName
      - Module Result Binder                          : params.variable + params.contextName
      - @General$Script                               : $runner.setObject("name", ...)
    """
    objs: Set[str] = set(BUILTIN_OBJECTS)
    for flow in flows.values():
        for module in flow.get("modules", {}).values():
            mtype = module.get("type", "")
            params = module.get("params", {}) or {}
            if mtype in (SAVE2DB, SAVE_CONTEXT2DB, GENERATE_BY_OPENAI):
                _add(objs, params.get("contextName"))
            elif mtype == MODULE_RESULT_BINDER:
                _add(objs, params.get("contextName"))
                _add(objs, params.get("variable"))
            elif mtype == SCRIPT:
                for name in _SETOBJECT_RE.findall(params.get("script", "") or ""):
                    _add(objs, name)
    objs.discard("")
    return objs


def _add(s: Set[str], value) -> None:
    if value and str(value).strip():
        s.add(str(value).strip())


def flow_module_names(flow: dict) -> Set[str]:
    """Tập tên các module trong một flow."""
    return set((flow.get("modules") or {}).keys())


def all_module_names(flows: dict) -> Set[str]:
    """Tập tên tất cả module trong toàn bộ flow."""
    names: Set[str] = set()
    for flow in flows.values():
        names |= flow_module_names(flow)
    return names


# ── Kiểm tra cú pháp prompt TTS ──────────────────────────────────────────────--
# Hợp lệ:
#   {tts_g:...}
#   {tts_ai:...}
#   {tts_ai_prop:X-Aitalkd-Api-Key=...,body_2={...}}{tts_ai:...}
_TTS_G_RE = re.compile(r"^\{tts_g:.*\}$", re.S)
_TTS_AI_RE = re.compile(r"^\{tts_ai:.*\}$", re.S)
_TTS_AI_PROP_RE = re.compile(
    r"^\{tts_ai_prop:X-Aitalkd-Api-Key=.+,body_2=\{.*\}\}\{tts_ai:.*\}$", re.S
)


def validate_tts_syntax(value: str) -> bool:
    """True nếu prompt đúng cú pháp {tts_g:...} / {tts_ai:...} / {tts_ai_prop:...}{tts_ai:...}."""
    if value is None:
        return False
    v = value.strip()
    if not v:
        return False
    if _TTS_G_RE.match(v) or _TTS_AI_RE.match(v):
        return True
    if v.startswith("{tts_ai_prop:"):
        return bool(_TTS_AI_PROP_RE.match(v))
    return False
