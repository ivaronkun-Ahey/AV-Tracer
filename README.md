# 🎬 AV-Tracer - Professional Audio-Video System Simulator

**Like Cisco Packet Tracer, but for Audio-Video Systems**

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Status](https://img.shields.io/badge/status-working-green.svg)

## 🎯 Overview

AV-Tracer is a professional-grade, web-based simulator for designing, connecting, and testing audio-video systems. Build complete AV installations virtually - no expensive hardware needed!

### ✨ Key Features

- ✅ **30+ Professional Devices** - Microphones, mixers, amps, speakers, cameras, displays, switchers, network gear
- ✅ **Visual Canvas** - Drag-and-drop interface with grid background
- ✅ **Smart Connections** - Color-coded cables with automatic signal type detection
- ✅ **Device Configuration** - Detailed properties panel for each device
- ✅ **Signal Flow Simulation** - Real-time audio/video path analysis
- ✅ **Error Detection** - Automatic validation and warnings
- ✅ **Save/Load Projects** - Export/import system designs
- ✅ **Professional UI** - Dark theme with Material-UI

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.8+

### Installation & Running

**1. Install Backend:**
```bash
cd backend
pip install -r requirements.txt
python3 -m uvicorn app.main:app --reload --port 8000
```

**2. Install Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**3. Access:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## 📚 Equipment Library (30+ Devices)

### 🎤 Audio Equipment
**Microphones:** Shure SM58, Beta 87A, AKG C414, Sennheiser e835
**Mixers:** Allen & Heath SQ-5, Yamaha MG12XU, Behringer X32
**Amplifiers:** Crown XLS 2502, QSC GX5
**Speakers:** JBL PRX815W, EV ZLX-12P, QSC K12.2, Yorkville YX15P
**Network Audio:** Shure MXA910 (Dante), QSC Core 110f

### 📹 Video Equipment
**Cameras:** Sony SRG-300H, Panasonic AW-UE150, PTZOptics 20X-SDI
**Displays:** Samsung QM85R, LG 75UP8000
**Projectors:** Epson EB-L1755U, Barco F90-4K13
**Switchers:** Extron IN1608, Blackmagic ATEM Mini Pro, Roland V-60HD, Kramer VP-558

### 🌐 Network & Control
**Switches:** Cisco SG350-28, Netgear GS728TP
**Controllers:** Crestron CP3, Extron IPCP Pro 550

## 🎨 How to Use

1. **Browse Equipment** - Search or filter devices in left panel
2. **Drag to Canvas** - Drop devices onto the workspace
3. **Make Connections** - Click output port → input port to cable
4. **Configure** - Select device, adjust properties on right
5. **Simulate** - Click "Simulate" to analyze signal paths
6. **Save** - Export your design as JSON

## 🧪 Simulation Engine

Analyzes your system and provides:
- ✅ Audio signal flow tracing (mic to speaker)
- ✅ Video signal flow tracing (camera to display)
- ✅ Signal level calculation (dBu)
- ✅ Error detection (missing connections, incompatible signals)
- ✅ Warnings (phantom power, impedance issues)

## 📖 Example: Basic PA System

1. Add: Shure SM58 mic
2. Add: Allen & Heath SQ-5 mixer
3. Add: Crown XLS 2502 amp
4. Add: JBL PRX815W speaker
5. Connect: Mic →(XLR)→ Mixer →(XLR)→ Amp →(Speakon)→ Speaker
6. Configure gain levels
7. Run simulation ✅

## 🛠 Tech Stack

**Frontend:** React 18 + TypeScript + Vite + Redux Toolkit + Konva.js + Material-UI
**Backend:** FastAPI + Python + Pydantic + Uvicorn

## 📁 Project Structure
```
AV-Tracer/
├── frontend/          # React + TypeScript UI
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── features/    # Redux slices
│   │   ├── data/        # Equipment library (30+ devices)
│   │   └── types/       # TypeScript types
├── backend/           # FastAPI backend
│   ├── app/
│   │   ├── services/    # Simulation engine
│   │   └── main.py      # API endpoints
└── README.md
```

## 🎓 Use Cases

- 🎓 **Education** - Learn AV without expensive hardware
- 📜 **Certification** - Practice for AVIXA CTS exam
- 🏫 **Training** - Teach audio/video concepts
- 📐 **Planning** - Design before installation
- 🔧 **Troubleshooting** - Practice problem-solving

## 🔮 Roadmap

**v1.1:** 50+ devices, templates, advanced analysis
**v2.0:** Learning scenarios, gamification, mobile app
**v3.0:** 3D visualization, VR/AR mode, marketplace

## 📝 License

MIT License - Use freely!

## 🙏 Credits

Inspired by Cisco Packet Tracer | Built for the AV industry

---

**⭐ Star this project if you find it useful!**

*Last Updated: November 2025 | Version 1.0.0*
