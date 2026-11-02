"""Python-движок должен давать тот же результат, что и TypeScript-движок.

Эталоны лежат в shared/sim-fixtures/*.json (поле expected) и пересчитываются
командой `npm run fixtures:update` во frontend.
"""
import json
from pathlib import Path

import pytest

from app.services.engine import SimulationEngine

FIXTURES = sorted((Path(__file__).resolve().parents[2] / 'shared' / 'sim-fixtures').glob('*.json'))


def test_fixtures_exist():
    assert FIXTURES, 'не найдены shared/sim-fixtures/*.json'


@pytest.mark.parametrize('path', FIXTURES, ids=lambda p: p.stem)
def test_matches_typescript_engine(path: Path):
    fixture = json.loads(path.read_text(encoding='utf-8'))
    engine = SimulationEngine()
    engine.load_topology(fixture['devices'], fixture['connections'])
    assert engine.run_simulation() == fixture['expected']
