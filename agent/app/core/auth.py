"""Service-to-service key check. Constant-time over SHA-256 digests, so key length leaks nothing.
The previous key is accepted too, so keys can be rotated without downtime."""
import hashlib
import hmac


def _digest(value: str) -> bytes:
    return hashlib.sha256(value.encode()).digest()


def key_matches(presented: str | None, current: str, previous: str = "") -> bool:
    if not presented or not current:
        return False
    got = _digest(presented)
    ok = hmac.compare_digest(got, _digest(current))
    if previous:
        ok = hmac.compare_digest(got, _digest(previous)) or ok
    return ok
