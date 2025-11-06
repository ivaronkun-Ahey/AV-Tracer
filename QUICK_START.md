# 🚀 AVTrainer Pro - Quick Start

## Мгновенный запуск (5 минут)

### Вариант 1: Docker (Проще)

```bash
# 1. Перейдите в папку проекта
cd avtrainer-mvp

# 2. Запустите все сервисы
docker-compose up -d

# 3. Откройте браузер
open http://localhost:3000
```

**Готово!** 🎉

---

### Вариант 2: Без Docker

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend (в новом терминале):**
```bash
cd frontend
npm install
npm run dev
```

**Откройте:** http://localhost:3000

---

## Первые шаги

1. **Добавьте устройство:**
   - Перетащите микрофон из левой панели на canvas

2. **Добавьте еще устройства:**
   - Добавьте микшер
   - Добавьте усилитель
   - Добавьте колонку

3. **Соедините их:**
   - Кликните на нижний кружок микрофона (output)
   - Кликните на верхний кружок микшера (input)
   - Повторите для других устройств

4. **Изучите свойства:**
   - Кликните на любое устройство
   - Посмотрите свойства справа
   - Измените параметры (gain, volume)

5. **Попробуйте кнопки:**
   - "Очистить" - удалит все
   - "Сохранить" - в разработке
   - "Запустить симуляцию" - в разработке

---

## Что дальше?

📚 **Изучите документацию:**
- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Подробная инструкция
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Что готово
- [AVTrainer_MVP_Development_Guide.md](../AVTrainer_MVP_Development_Guide.md) - Полная спецификация

💻 **Начните разработку:**
1. Откройте код в `/frontend/src`
2. Изучите компоненты
3. Добавьте новую функцию
4. Посмотрите как работает Redux

🔧 **Настройте окружение:**
- Установите Redux DevTools
- Установите React DevTools
- Настройте VSCode/IDE

---

## Проблемы?

**Порт занят?**
```bash
# Остановите существующие процессы
docker-compose down
lsof -ti:3000 | xargs kill -9
lsof -ti:8000 | xargs kill -9
```

**Docker не запускается?**
```bash
# Проверьте статус
docker-compose ps

# Посмотрите логи
docker-compose logs
```

**Не устанавливаются зависимости?**
```bash
# Frontend
rm -rf node_modules package-lock.json
npm install

# Backend
pip install --upgrade pip
pip install -r requirements.txt
```

---

## Ссылки

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs
- PostgreSQL: localhost:5432
- MongoDB: localhost:27017
- Redis: localhost:6379

---

## Полезные команды

```bash
# Просмотр логов
docker-compose logs -f

# Перезапуск
docker-compose restart

# Остановка
docker-compose down

# Полная очистка
docker-compose down -v

# Статус
docker-compose ps
```

---

**Готовы к разработке!** 🎯

*Для более детальных инструкций см. SETUP_GUIDE.md*
