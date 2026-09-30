"""Structured logging. Never log founder text: ids, counts and codes only."""
import json
import logging
import sys

_logger = logging.getLogger("agent")
if not _logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    _logger.addHandler(handler)
    _logger.setLevel(logging.INFO)


def log(event: str, level: int = logging.INFO, **fields) -> None:
    _logger.log(level, "%s %s", event, json.dumps(fields, default=str, separators=(",", ":")))


def warn(event: str, **fields) -> None:
    log(event, logging.WARNING, **fields)


def error(event: str, **fields) -> None:
    log(event, logging.ERROR, **fields)
