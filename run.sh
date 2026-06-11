#!/usr/bin/env bash
#
# AV-Tracer — запуск backend + frontend одной командой (без Docker).
# Использование:  ./run.sh
# Затем открыть:   http://localhost:3000
#
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
echo "▶  AV-Tracer: запуск..."

# --- Backend (FastAPI) ---
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
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Останавливаем backend при выходе
trap 'echo; echo "⏹  Остановка..."; kill $BACKEND_PID 2>/dev/null || true' EXIT INT TERM

# --- Frontend (Vite) ---
cd "$ROOT/frontend"
if [ ! -d "node_modules" ]; then
  echo "•  Устанавливаю зависимости frontend..."
  npm install
fi
echo "•  Запускаю frontend на http://localhost:3000"
echo "✅ Готово. Откройте http://localhost:3000"
npm run dev
