#!/bin/sh

set -eu

celery -A app.tasks.celery_app.celery_app worker -l info --concurrency=2 &
celery_pid=$!

cleanup() {
  kill "$celery_pid" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
