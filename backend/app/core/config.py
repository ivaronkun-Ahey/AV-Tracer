"""Минимальные настройки приложения.

Тяжёлая конфигурация БД/авторизации убрана: текущий backend выполняет
единственную задачу — расчёт симуляции AV-системы по REST API.
"""


class Settings:
    PROJECT_NAME: str = "AV-Tracer API"
    API_VERSION: str = "1.0.0"

    # Разрешённые источники для CORS (фронтенд в dev-режиме).
    ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]


settings = Settings()
