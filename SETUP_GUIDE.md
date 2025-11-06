# AVTrainer Pro - Setup Guide

> Полная инструкция по запуску MVP проекта

## 📦 Что включено в проект

```
avtrainer-mvp/
├── frontend/              # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/    # React компоненты
│   │   ├── features/      # Redux slices
│   │   ├── store/         # Redux store
│   │   ├── types/         # TypeScript типы
│   │   └── hooks/         # Custom hooks
│   ├── package.json
│   └── vite.config.ts
│
├── backend/               # FastAPI + Python
│   ├── app/
│   │   ├── core/         # Config, security
│   │   ├── api/          # API endpoints
│   │   ├── simulation/   # Simulation engine
│   │   └── main.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── docker-compose.yml     # Docker orchestration
└── README.md
```

---

## 🚀 Способ 1: Запуск с Docker (Рекомендуется)

### Требования:
- Docker Desktop 4.0+
- Docker Compose 2.0+

### Шаги:

1. **Клонируйте проект:**
```bash
cd avtrainer-mvp
```

2. **Создайте .env файл:**
```bash
cp .env.example .env
# Отредактируйте .env при необходимости
```

3. **Запустите все сервисы:**
```bash
docker-compose up -d
```

Это запустит:
- PostgreSQL (порт 5432)
- MongoDB (порт 27017)
- Redis (порт 6379)
- Backend API (порт 8000)
- Frontend (порт 3000)

4. **Проверьте статус:**
```bash
docker-compose ps
```

5. **Откройте приложение:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

6. **Просмотр логов:**
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

7. **Остановка:**
```bash
docker-compose down
```

---

## 🔧 Способ 2: Локальный запуск (Development)

### Требования:
- Node.js 18+
- Python 3.11+
- PostgreSQL 15+
- MongoDB 6+
- Redis 7+

### Backend Setup:

1. **Создайте виртуальное окружение:**
```bash
cd backend
python -m venv venv

# Linux/Mac:
source venv/bin/activate

# Windows:
venv\Scripts\activate
```

2. **Установите зависимости:**
```bash
pip install -r requirements.txt
```

3. **Настройте базы данных:**

PostgreSQL:
```bash
# Установите PostgreSQL
# Linux:
sudo apt-get install postgresql

# Mac:
brew install postgresql

# Создайте базу данных
psql -U postgres
CREATE DATABASE avtrainer;
CREATE USER avtrainer WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE avtrainer TO avtrainer;
\q
```

MongoDB:
```bash
# Установите MongoDB
# Linux:
sudo apt-get install mongodb

# Mac:
brew install mongodb-community

# Запустите
mongod --dbpath ~/data/db
```

Redis:
```bash
# Установите Redis
# Linux:
sudo apt-get install redis-server

# Mac:
brew install redis

# Запустите
redis-server
```

4. **Запустите Backend:**
```bash
# В папке backend/
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend будет доступен на http://localhost:8000

### Frontend Setup:

1. **Установите зависимости:**
```bash
cd frontend
npm install
```

2. **Запустите dev server:**
```bash
npm run dev
```

Frontend будет доступен на http://localhost:3000

---

## 📝 Первый запуск

После запуска приложения:

1. **Откройте http://localhost:3000**

2. **Попробуйте основные функции:**
   - Перетащите устройство из библиотеки (слева)
   - Разместите на canvas (центр)
   - Кликните по устройству - увидите свойства (справа)
   - Добавьте несколько устройств
   - Соединяйте устройства кликая по портам (кружочки)
   - Попробуйте кнопку "Запустить симуляцию"

3. **Проверьте API:**
   - Откройте http://localhost:8000/docs
   - Увидите Swagger UI с документацией API

---

## 🧪 Тестирование

### Backend Tests:
```bash
cd backend
pytest
```

### Frontend Tests:
```bash
cd frontend
npm test
```

---

## 🛠️ Development Workflow

### Hot Reload

И Backend, и Frontend настроены на hot reload:
- Изменения в Python коде автоматически перезагружают FastAPI
- Изменения в React коде автоматически обновляют браузер

### Debugging

**Backend:**
- Используйте print() или logging
- Или настройте debugger в VSCode/PyCharm

**Frontend:**
- Используйте React DevTools (Chrome extension)
- Redux DevTools (Chrome extension)
- Browser console (F12)

---

## 🗄️ База данных

### PostgreSQL

Подключение:
```bash
psql -U avtrainer -d avtrainer
```

Таблицы (будут созданы через Alembic migrations):
- users
- projects_meta
- learning_progress
- achievements

### MongoDB

Подключение:
```bash
mongosh
use avtrainer
```

Коллекции:
- projects
- equipment
- scenarios

---

## 🔑 API Endpoints

Основные endpoints (см. полную документацию на /docs):

**Authentication:**
- POST /api/v1/auth/register
- POST /api/v1/auth/login
- GET /api/v1/auth/me

**Projects:**
- GET /api/v1/projects
- POST /api/v1/projects
- GET /api/v1/projects/{id}
- PUT /api/v1/projects/{id}
- DELETE /api/v1/projects/{id}

**Simulation:**
- POST /api/v1/simulation/run
- POST /api/v1/simulation/validate-connection

**Equipment:**
- GET /api/v1/equipment
- GET /api/v1/equipment/{id}

---

## 🐛 Troubleshooting

### Port уже занят

**Backend (8000):**
```bash
# Linux/Mac:
lsof -ti:8000 | xargs kill -9

# Windows:
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

**Frontend (3000):**
```bash
# Linux/Mac:
lsof -ti:3000 | xargs kill -9

# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### PostgreSQL connection failed

Проверьте:
```bash
pg_isready -U avtrainer
```

Если не запущен:
```bash
# Linux:
sudo service postgresql start

# Mac:
brew services start postgresql

# Docker:
docker-compose up -d postgres
```

### MongoDB connection failed

Проверьте:
```bash
mongosh --eval "db.adminCommand('ping')"
```

### Redis connection failed

Проверьте:
```bash
redis-cli ping
# Должно вернуть: PONG
```

### Docker issues

Очистка и перезапуск:
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### CORS errors

Убедитесь, что в backend `.env`:
```
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

---

## 📚 Дальнейшие шаги

### 1. Добавьте больше устройств

Отредактируйте `/frontend/src/components/Library/EquipmentLibrary.tsx`:
```typescript
const MOCK_EQUIPMENT = [
  // Добавьте новые устройства здесь
];
```

### 2. Реализуйте сохранение проектов

См. `/backend/app/api/v1/projects.py`

### 3. Улучшите симуляцию

См. `/backend/app/simulation/engine.py`

### 4. Добавьте аутентификацию

См. `/backend/app/api/v1/auth.py`

### 5. Создайте обучающие сценарии

Добавьте JSON файлы в `/data/scenarios/`

---

## 🎓 Полезные команды

```bash
# Просмотр логов Docker
docker-compose logs -f

# Перезапуск сервиса
docker-compose restart backend
docker-compose restart frontend

# Подключение к базе данных
docker exec -it avtrainer-postgres psql -U avtrainer -d avtrainer
docker exec -it avtrainer-mongo mongosh

# Очистка Docker volumes
docker-compose down -v

# Rebuild без cache
docker-compose build --no-cache

# Проверка health check
docker-compose ps
```

---

## 📞 Получение помощи

1. **Проверьте логи:**
   ```bash
   docker-compose logs backend
   docker-compose logs frontend
   ```

2. **API Documentation:**
   http://localhost:8000/docs

3. **Browser Console:**
   F12 -> Console tab

4. **Redux DevTools:**
   Используйте Redux DevTools extension

---

## ✅ Checklist первого запуска

- [ ] Docker Desktop запущен
- [ ] Выполнен `docker-compose up -d`
- [ ] Все сервисы "healthy" в `docker-compose ps`
- [ ] Frontend открывается на http://localhost:3000
- [ ] Backend API работает на http://localhost:8000
- [ ] API docs доступна на http://localhost:8000/docs
- [ ] Можно добавить устройство на canvas
- [ ] Можно перемещать устройства
- [ ] Видны свойства выбранного устройства

---

## 🎉 Готово!

Ваш MVP AVTrainer Pro запущен и работает!

**Следующие шаги:**
1. Изучите код в `/frontend/src` и `/backend/app`
2. Попробуйте добавить новую функцию
3. Прочитайте полную документацию в `/docs`
4. Следуйте Development Guide для дальнейшей разработки

**Happy Coding! 🚀**
