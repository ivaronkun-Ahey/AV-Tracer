"""Проверка, что заготовка API поднимается и отвечает."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    assert client.get('/health').json() == {'status': 'healthy'}


def test_simulation_moved_to_browser():
    # Симуляция считается во frontend; серверного эндпоинта больше нет
    assert client.post('/api/simulate', json={'devices': [], 'connections': []}).status_code == 404
