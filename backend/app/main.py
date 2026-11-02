from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

# Симуляция считается в браузере (frontend/src/sim/engine.ts) — это единственный
# движок. Сервер оставлен как основа для будущих функций: хранение проектов,
# учётные записи, ИИ-ассистент. Прежний Python-движок и эндпоинт /api/simulate
# перенесены в archive/ (см. archive/README.md).

app = FastAPI(
    title="AV-Tracer API",
    description="API for AV-Tracer - Audio-Video System Simulator",
    version="1.0.0",
)

# CORS: в dev-режиме фронтенд ходит через прокси Vite, прямые запросы —
# только с адресов из настроек. Cookie/авторизация не используются.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# Routes
@app.get("/")
def root():
    return {
        "message": "AV-Tracer API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}
