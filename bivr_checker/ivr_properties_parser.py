"""Parser cho file IVR Properties (định dạng key=value)"""


def parse_ivr_properties(path: str) -> dict:
    """
    Parse file IVR Properties thành dict.
    Bỏ qua dòng comment (#) và dòng trống.
    Xử lý trường hợp value bị lặp key (vd: amivoice.uri=amivoice.uri=ws://...)
    """
    props = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip()
            # Xử lý trường hợp value bị lặp key (vd: amivoice.uri=amivoice.uri=ws://...)
            duplicate_prefix = key + "="
            if value.startswith(duplicate_prefix):
                value = value[len(duplicate_prefix):]
            props[key] = value
    return props
