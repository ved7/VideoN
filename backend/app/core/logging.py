from __future__ import annotations

import logging
from logging.config import dictConfig


def configure_logging(level: str = "INFO") -> None:
    normalized_level = level.upper()
    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": "%(asctime)s %(levelname)s [%(name)s] %(message)s",
                }
            },
            "handlers": {
                "default": {
                    "class": "logging.StreamHandler",
                    "formatter": "default",
                }
            },
            "root": {
                "handlers": ["default"],
                "level": normalized_level,
            },
            "loggers": {
                "uvicorn": {"level": normalized_level},
                "uvicorn.error": {"level": normalized_level},
                "uvicorn.access": {"level": normalized_level},
            },
        }
    )
    logging.captureWarnings(True)
