# Архив

Здесь лежат файлы, которые больше не используются приложением, но сохранены
вместо удаления. Пути внутри `archive/` повторяют исходные пути в проекте.
Прежние инструкции и документы лежат отдельно — в `docs/archive/`.

## Python-движок симуляции (перенесён 23.10.2026)

| Файл в архиве | Где был |
|---|---|
| `backend/app/services/engine.py` | `backend/app/services/engine.py` |
| `backend/tests/test_sim_fixtures.py` | `backend/tests/test_sim_fixtures.py` |

**Почему.** Движок симуляции был написан дважды — на TypeScript (браузер) и на
Python (сервер), — и их совпадение держалось на общих эталонных схемах. Решено
оставить один движок, `frontend/src/sim/engine.ts`: каждое правило пишется один
раз, проверка работает мгновенно и без сервера. Если понадобится проверка на
сервере, тот же TS-модуль запускается в Node.

На момент переноса Python-движок полностью совпадал с TypeScript-движком на
всех эталонах `shared/sim-fixtures` (фазы 1–2), но дальше не обновляется.

Вместе с движком из `backend/app/main.py` убран эндпоинт `POST /api/simulate`
(а интерфейс больше не обращается к серверу за расчётом). Чтобы вернуть его,
перенесите `engine.py` обратно в `backend/app/services/` и добавьте в `main.py`:

```python
from typing import Any, Dict, List
from pydantic import BaseModel
from app.services.engine import SimulationEngine

class SimulationRequest(BaseModel):
    devices: List[Dict[str, Any]]
    connections: List[Dict[str, Any]]

@app.post("/api/simulate")
async def simulate_system(request: SimulationRequest):
    engine = SimulationEngine()
    engine.load_topology(request.devices, request.connections)
    return engine.run_simulation()
```

Полная история изменений этих файлов сохранена в git (`git log --follow`).
