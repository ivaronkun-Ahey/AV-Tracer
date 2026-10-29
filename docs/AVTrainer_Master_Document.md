> **Исторический документ.** Это исходный план проекта; многое из описанного (база данных, учётные записи, обучение по сценариям) не реализовано. Актуальное состояние — [docs/STATUS.md](STATUS.md).

# AVTrainer Pro - Мастер-документ проекта

> **Статус:** Предпроектная стадия  
> **Дата создания:** 16 октября 2025  
> **Последнее обновление:** 16 октября 2025  
> **Версия:** 1.0

---

## 📋 EXECUTIVE SUMMARY

**AVTrainer Pro** - это интерактивный симулятор-тренажер для обучения проектированию, подключению и настройке профессиональных аудио-видео систем. Аналог Cisco Packet Tracer для AV-индустрии.

### Ключевые факты:
- **Проблема:** Нет доступных интерактивных инструментов для практического обучения AV-системам
- **Решение:** Веб-платформа с виртуальной лабораторией и интерактивными обучающими сценариями
- **Рынок:** $2.1B TAM, 200,000+ студентов ежегодно, 15,000 AV-компаний
- **Конкуренция:** Прямых конкурентов НЕТ
- **Монетизация:** Freemium SaaS ($0 / $9.99 / $29.99/мес + Enterprise)
- **MVP срок:** 6-8 месяцев
- **Команда:** 8 человек на старте
- **Финансирование:** $500K seed round

---

## 🎯 КОНЦЕПЦИЯ ПРОДУКТА

### Что это такое?

Веб-приложение, где пользователь может:

1. **Проектировать** - перетаскивать виртуальные AV-устройства на canvas
2. **Подключать** - соединять их кабелями (XLR, HDMI, SDI, Cat6)
3. **Настраивать** - менять параметры каждого устройства
4. **Симулировать** - запускать систему и видеть прохождение сигналов
5. **Учиться** - проходить пошаговые обучающие сценарии
6. **Диагностировать** - находить и исправлять ошибки

### Визуальный концепт интерфейса:

```
┌─────────────────────────────────────────────────────────────────┐
│ [AVTrainer Pro]  [Файл] [Правка] [Симуляция] [Обучение]  👤User│
├──────────────┬──────────────────────────────────────┬───────────┤
│  Библиотека  │                                      │ Свойства  │
│              │         Рабочая область              │           │
│ 🔍[Поиск]    │                                      │ Device    │
│              │    [Canvas с устройствами]           │ Settings  │
│ 🎤 Аудио     │                                      │           │
│ 📹 Видео     │    [Соединительные кабели]           │ Gain:     │
│ 🔌 Кабели    │                                      │ [─●───]   │
│ 🌐 Сеть      │    [Drag & Drop интерфейс]           │           │
├──────────────┴──────────────────────────────────────┴───────────┤
│ Status: Ready  |  5 devices  |  4 connections  |  [▶ Run]     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ АРХИТЕКТУРА СИСТЕМЫ

### Tech Stack:

**Frontend:**
- React 18 + TypeScript
- Konva.js (Canvas manipulation)
- Redux Toolkit (State management)
- Material-UI или Ant Design
- Vite (Build tool)

**Backend:**
- Python FastAPI
- PostgreSQL (Users, progress)
- MongoDB (Projects, equipment)
- Redis (Cache)

**Infrastructure:**
- Docker + Docker Compose
- AWS / Google Cloud
- CI/CD: GitHub Actions

### Основные компоненты:

```
AVTrainer
├── Canvas Engine (Drag & Drop, визуализация)
├── Simulation Engine (Расчёт сигналов, валидация)
├── Learning Management System (Сценарии, оценка)
├── Equipment Library (База устройств)
├── User Management (Аутентификация, прогресс)
└── API Layer (REST + WebSocket)
```

---

## 📚 FEATURE SET

### MVP Features (Минимум для запуска):

✅ **Редактор топологий**
- Drag & Drop устройств
- Создание соединений
- Базовая валидация

✅ **Библиотека оборудования (15 устройств)**
- Аудио: 3 микрофона, 2 микшера, 2 колонки, 1 усилитель
- Видео: 2 камеры, 2 дисплея, 1 коммутатор
- Кабели: XLR, HDMI, Cat6

✅ **Симуляция (упрощённая)**
- Трассировка аудио сигнала
- Трассировка видео сигнала
- Базовая валидация ошибок

✅ **Обучающие сценарии (5 шт.)**
1. Базовая PA система (микрофон → микшер → усилитель → колонка)
2. Простая видеопрезентация (ноутбук → проектор)
3. Конференц-система (микрофоны + камера + дисплей)
4. Домашний кинотеатр 5.1
5. Небольшая студия

✅ **User Management**
- Регистрация/вход
- Сохранение проектов
- Отслеживание прогресса

### Post-MVP Features (v1.5-2.0):

🔲 Расширение библиотеки до 50+ устройств
🔲 Продвинутая симуляция (Dante, NDI, AES67)
🔲 Инструменты диагностики
🔲 Геймификация (достижения, рейтинги)
🔲 Инструменты для преподавателей
🔲 Мобильное приложение
🔲 VR/AR режим (будущее)

---

## 📊 БИЗНЕС-МОДЕЛЬ

### Монетизация:

| Tier | Цена | Возможности | Target |
|------|------|-------------|--------|
| **Free** | $0 | 15 устройств, 5 сценариев, 3 проекта | Lead gen |
| **Premium** | $9.99/мес | Полный доступ, unlimited проекты | Индивидуалы |
| **Pro** | $29.99/мес | + Teacher tools, API | Преподаватели |
| **Enterprise** | Custom | Групповые лицензии, SSO, брендинг | Организации |

### Финансовые цели:

**Год 1:** 1,000 users, $85K revenue, -$365K net (нужна инвестиция)
**Год 2:** 25,000 users, $750K revenue, -$50K net (близко к breakeven)
**Год 3:** 50,000 users, $2.1M revenue, +$900K net (прибыльность)

---

## 🗓️ ROADMAP

### Phase 1: MVP Development (Месяцы 1-8)

**M1-2: Setup & Prototyping**
- [ ] Формирование команды
- [ ] Technical stack setup
- [ ] UI/UX прототипы в Figma
- [ ] Architecture design

**M3-5: Core Development**
- [ ] Canvas Engine (drag & drop)
- [ ] Базовая библиотека (15 устройств)
- [ ] Connection system
- [ ] Simple audio simulator

**M6-8: MVP Completion**
- [ ] 5 обучающих сценариев
- [ ] User management
- [ ] Basic video simulation
- [ ] Testing & bugfixes
- [ ] **Закрытая бета**

### Phase 2: Public Launch (Месяцы 9-12)

- [ ] Публичный релиз
- [ ] 10 пилотных школ
- [ ] Маркетинговая кампания
- [ ] Content creation (15 новых сценариев)
- [ ] **Цель: 1,000 active users**

### Phase 3: Growth (Месяцы 13-18)

- [ ] Premium tier
- [ ] Teacher tools
- [ ] Расширение библиотеки (50+ devices)
- [ ] Mobile app (read-only)
- [ ] **Цель: 10,000 users**

---

## 👥 КОМАНДА (Требуется)

### Core Team (8 человек):

1. **Project Manager** - координация, планирование
2. **Frontend Developer** ×2 - React, Canvas, UI
3. **Backend Developer** ×2 - Python, API, databases
4. **Simulation Engineer** - физика сигналов, алгоритмы
5. **UI/UX Designer** - интерфейс, user flows
6. **AV Content Creator** (part-time) - сценарии, методология
7. **QA Engineer** - тестирование

### Advisors (Желательно):

- AV industry expert (CTS certified)
- EdTech entrepreneur
- University professor (AV department)

---

## 💰 ФИНАНСИРОВАНИЕ

### Seed Round: $500,000

**Использование:**
- Team salaries (18 мес): $300K (60%)
- Product development: $80K (16%)
- Infrastructure: $40K (8%)
- Marketing: $50K (10%)
- Legal/Admin: $20K (4%)
- Reserve: $10K (2%)

**Runway:** 18 месяцев до достижения revenue milestones

---

## 📈 КЛЮЧЕВЫЕ МЕТРИКИ

### Product Metrics:
- DAU/MAU ratio
- Scenario completion rate
- Time in app per session
- Feature adoption rate

### Business Metrics:
- MRR/ARR growth
- CAC (Customer Acquisition Cost)
- LTV (Lifetime Value)
- Churn rate (target <5%)
- Free-to-paid conversion (target 8-12%)

### Learning Metrics:
- Pass rate по сценариям
- Average completion time
- Student satisfaction score

---

## 🎯 GTM (Go-to-Market) СТРАТЕГИЯ

### Year 1: Education Focus

**Partnerships:**
- 10 пилотных университетов (FREE)
- AVIXA, InfoComm affiliations
- Curriculum integration

**Content Marketing:**
- YouTube tutorials
- Blog (AV best practices)
- Case studies

**Community:**
- Discord server
- Reddit presence
- Forum engagement

### Year 2: Corporate Expansion

**B2B Sales:**
- Direct sales to AV integrators
- Trade shows (InfoComm, ISE)
- Distributor partnerships

**Product:**
- Marketplace launch
- Mobile app
- Advanced features

### Year 3: International

**Localization:**
- 5 languages
- Regional content
- Local partnerships

---

## ⚠️ РИСКИ И МИТИГАЦИЯ

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Низкий спрос | Средняя | Высокое | Валидация через пилоты |
| Сложность симуляции | Высокая | Высокое | Упрощённая модель на старте |
| Нехватка контента | Средняя | Среднее | Партнёрства с преподавателями |
| Конкуренция | Низкая | Среднее | First mover advantage |
| Технические проблемы | Средняя | Высокое | Опытная команда, testing |

---

## 🔄 ТЕКУЩИЙ СТАТУС ПРОЕКТА

### ✅ Что сделано:

- [x] Market research
- [x] Competitor analysis
- [x] Concept development
- [x] Technical architecture
- [x] UI/UX design concepts
- [x] Business model
- [x] Financial projections
- [x] Pitch deck

### 🔲 Следующие шаги:

**Immediate (0-1 месяц):**
1. [ ] Создать интерактивный прототип (Figma или HTML)
2. [ ] User validation (опросы, интервью)
3. [ ] Найти 3-5 пилотных партнёров (университеты)
4. [ ] Pitch deck финализация
5. [ ] Начать поиск инвесторов / co-founders

**Short-term (1-3 месяца):**
6. [ ] Сформировать core team
7. [ ] Technical specs детализация
8. [ ] MVP development start
9. [ ] First equipment models
10. [ ] First scenario prototype

**Medium-term (3-6 месяцев):**
11. [ ] MVP completion
12. [ ] Closed beta (50-100 users)
13. [ ] Iterate based on feedback
14. [ ] Marketing materials
15. [ ] Public launch prep

---

## 📂 КЛЮЧЕВЫЕ РЕШЕНИЯ ДИЗАЙНА

### Equipment Library Structure:

Каждое устройство описывается:
```json
{
  "id": "shure_sm58",
  "category": "audio",
  "subcategory": "microphone",
  "manufacturer": "Shure",
  "model": "SM58",
  "specs": {
    "type": "dynamic",
    "pattern": "cardioid",
    "frequency_response": "50Hz-15kHz"
  },
  "ports": [
    {
      "id": "xlr_out",
      "type": "xlr",
      "direction": "output",
      "signal_type": "analog_audio"
    }
  ],
  "properties": {
    "requires_phantom": false,
    "sensitivity_db": -54.5
  },
  "icon": "url_to_icon.svg",
  "price_tier": "budget"
}
```

### Simulation Algorithm (Simplified):

```python
def simulate_audio_chain(devices, connections):
    # 1. Найти источники (микрофоны)
    sources = find_sources(devices)
    
    # 2. Для каждого источника
    for source in sources:
        signal_level = -60  # Mic level in dBu
        path = [source]
        
        # 3. Трассировка пути
        current = source
        while has_output_connection(current):
            next_device = get_connected_device(current, connections)
            
            # 4. Обработка сигнала устройством
            signal_level = process_signal(next_device, signal_level)
            path.append(next_device)
            current = next_device
        
        # 5. Проверка результата
        if is_valid_signal(signal_level):
            return {"status": "ok", "path": path, "level": signal_level}
        else:
            return {"status": "error", "message": "Signal out of range"}
```

### Connection Validation Rules:

1. **Direction check**: Output → Input
2. **Signal type match**: Analog audio → Analog audio
3. **Cable compatibility**: XLR cable → XLR ports
4. **No loops**: Prevent feedback loops
5. **Power requirements**: Phantom power for condenser mics

---

## 🎨 ДИЗАЙН-СИСТЕМА

### Цвета:

- **Primary**: #0066CC (Blue)
- **Audio**: #FF6B00 (Orange)
- **Video**: #00B8D4 (Cyan)
- **Network**: #00C853 (Green)
- **Control**: #9C27B0 (Purple)
- **Success**: #4CAF50
- **Warning**: #FFC107
- **Error**: #F44336

### Типографика:

- **Headings**: Inter, 700 weight
- **Body**: Inter, 400 weight
- **Code**: Fira Code, monospace

### Icons:

- Library: Lucide Icons / Heroicons
- Size: 16/24/32px
- Style: 2px stroke, linear

---

## 📖 LEARNING SCENARIOS (Examples)

### Scenario 1: Basic PA System

**Difficulty:** Beginner  
**Time:** 30 min  
**Objectives:**
- Place a microphone
- Connect to mixer via XLR
- Add amplifier
- Connect speaker
- Configure gain levels

**Steps:**
1. Place Shure SM58 microphone
2. Place mixer (4-channel)
3. Connect mic → mixer with XLR cable
4. Place amplifier
5. Connect mixer output → amp with TRS cable
6. Place speaker
7. Connect amp → speaker
8. Set gain to 0dB
9. Run simulation
10. Verify audio path

**Grading:**
- Connection accuracy: 40%
- Signal levels: 30%
- Efficiency (device count): 20%
- Time bonus: 10%

---

### Scenario 2: Video Conference System

**Difficulty:** Intermediate  
**Time:** 60 min  
**Objectives:**
- Setup 2 cameras
- Configure codec
- Connect display
- Setup microphone array
- Verify EDID compatibility

**Steps:**
1. Place 2 PTZ cameras
2. Place video codec (Cisco/Poly)
3. Connect cameras via HDMI
4. Place 85" display
5. Connect codec → display
6. Configure resolution 1920x1080@60
7. Place 4 ceiling microphones
8. Setup Dante network
9. Connect mics to codec
10. Run full system test

**Grading:**
- Video setup: 30%
- Audio setup: 30%
- Network config: 20%
- System integration: 20%

---

## 🎮 GAMIFICATION

### Level System:
- **Level 1:** Trainee (0-1000 XP)
- **Level 2:** Junior Tech (1000-3000 XP)
- **Level 3:** Technician (3000-7000 XP)
- **Level 4:** Engineer (7000-15000 XP)
- **Level 5:** Senior Engineer (15000-30000 XP)
- **Level 6:** Expert (30000-50000 XP)
- **Level 7:** Master (50000+ XP)

### Achievements:
- 🎓 First Steps - Complete first scenario
- 💯 Perfectionist - 100% score on any scenario
- 🏃 Speedrunner - Complete in half the time
- 🔍 Detective - Find all errors in 5 challenges
- 🏗️ Architect - Create 10 projects
- ⭐ Star - Get 100 likes on projects

---

## 📞 КОНТАКТЫ И РЕСУРСЫ

### Project Links:
- GitHub: (to be created)
- Figma: (to be created)
- Trello/Jira: (to be created)

### Learning Resources:
- AVIXA standards
- InfoComm training materials
- Manufacturer datasheets
- AV forums (AVS Forum, r/CommercialAV)

### Potential Partners:
- Universities with AV programs
- AVIXA (Audiovisual and Integrated Experience Association)
- InfoComm International
- Equipment manufacturers (Shure, Crestron, Extron, etc.)

---

## 🔧 ПРОТОТИПИРОВАНИЕ

### Что нужно для первого прототипа:

**Option 1: Figma Prototype (Quick)**
- Interactive mockup
- User flow demonstration
- 2-3 days to create
- Good for validation

**Option 2: HTML/JS Demo (Functional)**
- Basic drag & drop
- Simple connection system
- 1-2 weeks to create
- Better for technical validation

**Option 3: React MVP (Full)**
- Production-ready architecture
- All core features
- 6-8 weeks to create
- Ready for beta users

### Рекомендация:
Начать с **Option 2** (HTML/JS Demo) для быстрой технической валидации концепции.

---

## 📝 NEXT SESSION PROMPTS

При загрузке этого документа в новый чат, используйте эти промпты:

### Для продолжения разработки:
```
"Я работаю над проектом AVTrainer Pro (симулятор для обучения AV-системам). 
Прочитай приложенный мастер-документ и помоги мне с [конкретная задача].
Контекст проекта в документе AVTrainer_Master_Document.md"
```

### Для создания прототипа:
```
"На основе документа AVTrainer_Master_Document.md создай функциональный 
прототип [конкретного компонента]. Используй HTML/CSS/JavaScript."
```

### Для технических вопросов:
```
"Согласно архитектуре проекта AVTrainer (см. документ), как лучше 
реализовать [конкретную функцию]?"
```

### Для бизнес-планирования:
```
"Помоги развить бизнес-стратегию проекта AVTrainer Pro. Контекст в 
документе. Сфокусируйся на [конкретный аспект]."
```

---

## 💡 ВАЖНЫЕ ЗАМЕТКИ

### Ключевые преимущества проекта:
1. ✅ **First Mover** - прямых конкурентов нет
2. ✅ **Proven Model** - Cisco PT показал, что это работает
3. ✅ **Real Pain Point** - индустрия нуждается в решении
4. ✅ **Scalable** - cloud-native, SaaS модель
5. ✅ **Growing Market** - AV индустрия растёт 7%/год

### Критические факторы успеха:
1. **Quality Content** - обучающие сценарии должны быть отличными
2. **Accurate Simulation** - достаточно реалистичная симуляция
3. **User Experience** - интуитивный, приятный интерфейс
4. **Community** - активное комьюнити пользователей
5. **Partnerships** - связи с образовательными учреждениями

### Потенциальные подводные камни:
1. ⚠️ Сложность симуляции - может быть недооценена
2. ⚠️ Создание контента - требует экспертизы
3. ⚠️ User acquisition - нужна правильная стратегия
4. ⚠️ Scaling costs - инфраструктура может дорожать
5. ⚠️ Competition - могут появиться конкуренты

---

## 🎯 VISION STATEMENT

> "Сделать профессиональное AV-образование доступным для каждого, 
> устранив барьер дорогого оборудования. Дать возможность миллионам 
> людей научиться проектировать и настраивать AV-системы через 
> интерактивный практический опыт."

**Mission:** Democratize AV education through technology.

**Values:**
- 🎓 Education First
- 🚀 Innovation
- 🤝 Community
- 💎 Quality
- 🌍 Accessibility

---

## 📊 ПРИЛОЖЕНИЯ

### Appendix A: Market Research Summary
- Competitor landscape
- User interviews (to be conducted)
- Market size calculations

### Appendix B: Technical Specs
- API documentation (to be written)
- Database schemas
- Architecture diagrams

### Appendix C: Financial Models
- Detailed 5-year projections
- Unit economics
- CAC/LTV analysis

### Appendix D: Legal
- Terms of Service (to be drafted)
- Privacy Policy (to be drafted)
- Licensing agreements

---

## 🔄 VERSION HISTORY

**v1.0** (Oct 16, 2025)
- Initial master document created
- All research compiled
- Ready for next phase

**Future versions:**
- v1.1 - After user validation
- v1.2 - After MVP completion
- v2.0 - Post-launch updates

---

## ✅ CHECKLIST ДЛЯ СТАРТА

### Pre-Development:
- [ ] Провести 10+ user interviews
- [ ] Создать Figma прототип
- [ ] Валидировать с 3-5 преподавателями
- [ ] Финализировать tech stack
- [ ] Найти co-founders / early team

### MVP Development:
- [ ] Setup dev environment
- [ ] Create Canvas Engine
- [ ] Build first 5 devices
- [ ] Implement connection system
- [ ] Create first scenario
- [ ] User authentication
- [ ] Deploy to staging

### Launch Prep:
- [ ] Beta testing with 50 users
- [ ] Bug fixes
- [ ] Marketing materials
- [ ] Pricing finalization
- [ ] Legal documents
- [ ] Public launch! 🚀

---

**Этот документ - ваш единый источник истины для проекта AVTrainer Pro.**
**Загружайте его в новые чаты для продолжения работы.**

**Version 1.0 - Ready to build! 💪**
