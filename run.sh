#!/usr/bin/env bash
#
# AV-Tracer — запуск без Docker.
# Использование:  ./run.sh                 — интерфейс (симуляция работает в браузере)
#                 ./run.sh --with-backend  — плюс заготовка API на http://localhost:8000
# Затем открыть:   http://localhost:3000
#
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
echo "▶  AV-Tracer: запуск..."

# --- Backend (FastAPI) — необязательная заготовка API ---
if [ "${1:-}" = "--with-backend" ]; then
  cd "$ROOT/backend"
  if [ ! -d ".venv" ]; then
    echo "•  Создаю виртуальное окружение Python..."
    python3 -m venv .venv
  fi
  # shellcheck disable=SC1091
  source .venv/bin/activate
  echo "•  Устанавливаю зависимости backend..."
  pip install -q -r requirements.txt
  echo "•  Запускаю backend на http://localhost:8000"
  uvicorn app.main:app --host 127.0.0.1 --port 8000 &
  BACKEND_PID=$!
  # Останавливаем backend при выходе
  trap 'echo; echo "⏹  Остановка..."; kill $BACKEND_PID 2>/dev/null || true' EXIT INT TERM
fi

# --- Frontend (Vite) ---
cd "$ROOT/frontend"
if [ ! -d "node_modules" ]; then
  echo "•  Устанавливаю зависимости frontend..."
  npm ci
fi
echo "•  Запускаю frontend на http://localhost:3000"
echo "✅ Готово. Откройте http://localhost:3000"
npm run dev
