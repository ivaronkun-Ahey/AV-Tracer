# 🎚️ AVTrainer Pro - MVP Implementation

> Interactive AV Systems Learning Platform - Working Prototype

## 📦 What's Included

This is a **working implementation** of AVTrainer Pro MVP with:

✅ **Frontend (React + TypeScript)**
- Canvas editor with Drag & Drop
- 9 professional AV devices
- Connection system
- Properties panel
- Redux state management
- Material-UI design

✅ **Backend (FastAPI + Python)**
- REST API structure
- Simulation engine skeleton
- Configuration management
- Docker setup

✅ **Infrastructure**
- Docker Compose orchestration
- PostgreSQL, MongoDB, Redis
- Hot reload for development
- Environment configuration

---

## 🚀 Quick Start

### Option 1: Docker (Recommended)

```bash
cd avtrainer-mvp
docker-compose up -d
open http://localhost:3000
```

### Option 2: Manual

**Terminal 1 - Backend:**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install && npm run dev
```

**Open:** http://localhost:3000

---

## 📖 Documentation

- **[QUICK_START.md](./QUICK_START.md)** - 5-minute setup guide
- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Detailed installation
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - What's built
- **[AVTrainer_MVP_Development_Guide.md](../AVTrainer_MVP_Development_Guide.md)** - Full specs

---

## 🎯 Current Features

### Working:
- ✅ Drag & Drop devices from library
- ✅ Place devices on canvas
- ✅ Connect devices via ports
- ✅ Move devices around
- ✅ View/edit device properties
- ✅ 9 devices (mic, mixer, amp, speaker, camera, display, projector, switcher)
- ✅ Redux state management
- ✅ Responsive UI

### In Progress:
- ⏳ Backend API endpoints
- ⏳ Simulation engine
- ⏳ Save/load projects
- ⏳ Authentication
- ⏳ Learning scenarios

---

## 🏗️ Project Structure

```
avtrainer-mvp/
├── frontend/              # React + TypeScript
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── features/      # Redux slices
│   │   ├── store/         # Redux store
│   │   └── types/         # TypeScript types
│   └── package.json
│
├── backend/               # FastAPI + Python
│   ├── app/
│   │   ├── core/         # Config
│   │   ├── api/          # Endpoints
│   │   ├── simulation/   # Engine
│   │   └── main.py
│   └── requirements.txt
│
├── docker-compose.yml     # Orchestration
├── QUICK_START.md         # 5-min guide
├── SETUP_GUIDE.md         # Full guide
└── IMPLEMENTATION_SUMMARY.md  # Status
```

---

## 🛠️ Tech Stack

**Frontend:**
- React 18 + TypeScript
- Redux Toolkit
- Konva.js (Canvas)
- Material-UI
- Vite

**Backend:**
- FastAPI
- Python 3.11
- Pydantic
- PostgreSQL
- MongoDB
- Redis

**DevOps:**
- Docker & Docker Compose
- Hot reload
- Environment variables

---

## 🎨 Screenshots

**Main Interface:**
```
┌────────────────────────────────────────────────────────────┐
│ AVTrainer Pro    [Clear] [Save] [▶ Run Simulation]        │
├──────────────┬───────────────────────────────┬─────────────┤
│  Library     │        Canvas                 │ Properties  │
│              │                               │             │
│ 🎤 Audio     │    [Devices & Connections]   │ Device:     │
│ 📹 Video     │                               │ Shure SM58  │
│              │                               │             │
│ [Devices]    │                               │ Gain: 0dB   │
│              │                               │ Ports: 1    │
├──────────────┴───────────────────────────────┴─────────────┤
│ Devices: 3 | Connections: 2 | Status: Ready               │
└────────────────────────────────────────────────────────────┘
```

---

## 📊 Implementation Status

| Component | Status | Progress |
|-----------|--------|----------|
| Frontend UI | ✅ Complete | 100% |
| Canvas Engine | ✅ Complete | 100% |
| Redux State | ✅ Complete | 100% |
| Equipment Library | ✅ Complete | 100% |
| Backend API | ⏳ In Progress | 30% |
| Simulation | ⏳ In Progress | 40% |
| Database | ⏳ Planned | 0% |
| Auth | ⏳ Planned | 0% |
| Scenarios | ⏳ Planned | 0% |

**Overall MVP Progress: 50%**

---

## 🎯 Next Steps

**Sprint 4-5 (Backend API):**
- [ ] Implement authentication
- [ ] Implement projects CRUD
- [ ] Implement simulation endpoint
- [ ] Connect frontend to API

**Sprint 6-7 (Simulation):**
- [ ] Complete audio signal flow
- [ ] Complete video signal flow
- [ ] Add validation logic
- [ ] Show results in UI

**Sprint 8-9 (Persistence):**
- [ ] Database models
- [ ] Save/load projects
- [ ] User progress tracking

**Sprint 10-11 (Learning):**
- [ ] Create 5 scenarios
- [ ] Scenario player UI
- [ ] Step validation
- [ ] Grading system

---

## 🔧 Development

**Start development:**
```bash
# With hot reload
docker-compose up -d

# Or manually
cd backend && uvicorn app.main:app --reload
cd frontend && npm run dev
```

**View logs:**
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

**Run tests:**
```bash
cd backend && pytest
cd frontend && npm test
```

---

## 🌐 URLs

- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs
- **PostgreSQL:** localhost:5432
- **MongoDB:** localhost:27017
- **Redis:** localhost:6379

---

## 🐛 Troubleshooting

**Port conflicts:**
```bash
docker-compose down
lsof -ti:3000 | xargs kill -9
lsof -ti:8000 | xargs kill -9
```

**Database issues:**
```bash
docker-compose down -v
docker-compose up -d
```

**Full reset:**
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

---

## 📚 Learning Resources

**For Developers:**
- Redux Toolkit: https://redux-toolkit.js.org/
- Konva.js: https://konvajs.org/
- FastAPI: https://fastapi.tiangolo.com/
- Material-UI: https://mui.com/

**For Users:**
- User Guide: `/docs/user-guide.md` (coming soon)
- Video Tutorials: (coming soon)
- FAQs: `/docs/faq.md` (coming soon)

---

## 🤝 Contributing

**Want to contribute?**

1. Fork the repository
2. Create feature branch
3. Make your changes
4. Submit pull request

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## 📝 License

Proprietary - All rights reserved

---

## 🎉 Credits

**Built with:**
- React, TypeScript, Konva.js
- FastAPI, Python, Pydantic
- Docker, PostgreSQL, MongoDB

**Inspired by:**
- Cisco Packet Tracer
- Professional AV industry needs
- Modern EdTech platforms

---

## 📞 Support

**Issues?**
- Check [SETUP_GUIDE.md](./SETUP_GUIDE.md)
- Read [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
- Review API docs: http://localhost:8000/docs

**Questions?**
- Check documentation
- Review code comments
- Ask the community

---

## 🚀 Ready to Build!

**Current Status:** MVP in active development (50% complete)

**Next Milestone:** Backend API completion (Sprint 4-5)

**Estimated Timeline:** 
- MVP completion: 8-10 weeks
- Beta launch: 12-14 weeks
- Public launch: 16-20 weeks

---

**Let's build the future of AV education! 🎓**

*Last Updated: 30 October 2025*
*Version: 0.1.0*
