# AVTrainer Pro - MVP Development Guide

> **Цель:** Этот документ содержит ВСЁ необходимое для разработки MVP проекта AVTrainer Pro  
> **Для кого:** Разработчики, tech lead, yourself в следующем чате  
> **Версия:** 1.0 MVP Specs  
> **Дата:** 16 октября 2025

---

## 📋 EXECUTIVE SUMMARY

### Что мы строим (MVP):
Веб-приложение для интерактивного обучения проектированию AV-систем с:
- 15 виртуальными устройствами
- Drag & drop редактором
- Базовой симуляцией сигналов
- 5 обучающими сценариями
- Системой сохранения проектов

### Технологии:
- **Frontend:** React 18 + TypeScript + Konva.js
- **Backend:** Python FastAPI
- **Database:** PostgreSQL + MongoDB
- **Deployment:** Docker + AWS/GCP

### Сроки MVP:
**6-8 месяцев** (команда 8 человек) или **12-16 месяцев** (команда 3-4 человека)

---

## 🎯 MVP FEATURE SET

### ✅ Must Have (Core):

**1. Canvas Editor**
- Drag & Drop устройств из библиотеки
- Перемещение устройств по workspace
- Zoom и pan canvas
- Grid snapping (optional)

**2. Equipment Library (15 устройств)**

**Аудио (8):**
- Shure SM58 (Dynamic Mic)
- Shure Beta 87A (Condenser Mic)
- Allen & Heath SQ-5 (Digital Mixer)
- Behringer X32 (Digital Mixer)
- Crown XLS 2502 (Power Amplifier)
- QSC GX5 (Power Amplifier)
- JBL PRX815W (Powered Speaker)
- EV ZLX-12P (Powered Speaker)

**Видео (5):**
- Sony SRG-300H (PTZ Camera)
- Panasonic AW-UE70 (PTZ Camera)
- Samsung QM85R (85" Display)
- Epson EB-L1755U (Projector)
- Extron IN1608 (Video Switcher)

**Кабели (2):**
- XLR Cable (audio)
- HDMI Cable (video)

**3. Connection System**
- Клик по портам для создания соединения
- Визуализация кабелей (линии между устройствами)
- Валидация типов соединений
- Удаление соединений

**4. Properties Panel**
- Просмотр свойств выбранного устройства
- Редактирование параметров (gain, volume, etc.)
- Real-time обновление

**5. Basic Simulation**
- Трассировка аудио сигнального пути
- Трассировка видео сигнального пути
- Проверка валидности конфигурации
- Список ошибок и предупреждений

**6. Learning Scenarios (5 шт.)**
1. Basic PA System (Beginner, 30 min)
2. Simple Video Presentation (Beginner, 20 min)
3. Conference Room System (Intermediate, 45 min)
4. Home Theater 5.1 (Intermediate, 60 min)
5. Small Production Studio (Advanced, 90 min)

**7. User Management**
- Регистрация / Вход
- JWT authentication
- User profiles
- Progress tracking

**8. Project Management**
- Создание проекта
- Сохранение проекта
- Загрузка проекта
- Список проектов пользователя

### ❌ Not in MVP (Post-MVP):

- Продвинутая симуляция (Dante, NDI)
- Геймификация (achievements, leaderboards)
- Teacher tools
- Multiplayer / collaboration
- Mobile app
- 3D visualization
- Export to PDF/CAD
- Marketplace

---

## 🏗️ ARCHITECTURE

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              React Application (SPA)                  │  │
│  │  ┌────────────┐  ┌──────────┐  ┌─────────────────┐  │  │
│  │  │  Canvas    │  │  Redux   │  │  Components     │  │  │
│  │  │  (Konva)   │  │  Store   │  │  (Material-UI)  │  │  │
│  │  └────────────┘  └──────────┘  └─────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API / WebSocket
┌──────────────────────────┼──────────────────────────────────┐
│                   FastAPI Backend                           │
│  ┌────────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   API Routes   │  │ Simulation  │  │   Learning      │  │
│  │   (REST)       │  │   Engine    │  │   Management    │  │
│  └────────────────┘  └─────────────┘  └─────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Business Logic Layer                       │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────┬─────────────────┬────────────────────────────┘
               │                 │
    ┌──────────▼─────┐   ┌───────▼────────┐
    │   PostgreSQL   │   │    MongoDB     │
    │  (Users, Auth, │   │  (Projects,    │
    │   Progress)    │   │   Equipment)   │
    └────────────────┘   └────────────────┘
```

### Technology Stack Details

**Frontend:**
```javascript
{
  "react": "^18.2.0",
  "typescript": "^5.0.0",
  "konva": "^9.2.0",
  "react-konva": "^18.2.0",
  "redux-toolkit": "^1.9.0",
  "react-router-dom": "^6.20.0",
  "@mui/material": "^5.14.0",
  "axios": "^1.6.0",
  "react-hook-form": "^7.48.0",
  "zod": "^3.22.0"
}
```

**Backend:**
```python
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
sqlalchemy==2.0.23
alembic==1.12.1
psycopg2-binary==2.9.9
pymongo==4.6.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
pytest==7.4.3
```

---

## 📁 PROJECT STRUCTURE

### Complete Directory Tree

```
avtrainer-mvp/
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   └── favicon.ico
│   ├── src/
│   │   ├── components/
│   │   │   ├── Canvas/
│   │   │   │   ├── CanvasWorkspace.tsx
│   │   │   │   ├── DeviceNode.tsx
│   │   │   │   ├── ConnectionLine.tsx
│   │   │   │   └── PortConnector.tsx
│   │   │   ├── Library/
│   │   │   │   ├── EquipmentLibrary.tsx
│   │   │   │   ├── DeviceCard.tsx
│   │   │   │   └── CategoryFilter.tsx
│   │   │   ├── Properties/
│   │   │   │   ├── PropertiesPanel.tsx
│   │   │   │   └── PropertyEditor.tsx
│   │   │   ├── Simulation/
│   │   │   │   ├── SimulationControls.tsx
│   │   │   │   ├── SimulationResults.tsx
│   │   │   │   └── SignalFlowVisualization.tsx
│   │   │   ├── Learning/
│   │   │   │   ├── ScenarioPlayer.tsx
│   │   │   │   ├── ScenarioList.tsx
│   │   │   │   ├── StepInstruction.tsx
│   │   │   │   └── ProgressTracker.tsx
│   │   │   ├── Layout/
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── StatusBar.tsx
│   │   │   │   └── MainLayout.tsx
│   │   │   ├── Auth/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   └── RegisterForm.tsx
│   │   │   └── Common/
│   │   │       ├── Button.tsx
│   │   │       ├── Modal.tsx
│   │   │       └── Loading.tsx
│   │   ├── features/
│   │   │   ├── canvas/
│   │   │   │   ├── canvasSlice.ts
│   │   │   │   ├── canvasTypes.ts
│   │   │   │   └── canvasUtils.ts
│   │   │   ├── simulation/
│   │   │   │   ├── simulationSlice.ts
│   │   │   │   └── simulationTypes.ts
│   │   │   ├── learning/
│   │   │   │   ├── learningSlice.ts
│   │   │   │   └── learningTypes.ts
│   │   │   └── auth/
│   │   │       ├── authSlice.ts
│   │   │       └── authTypes.ts
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   ├── websocket.ts
│   │   │   └── storage.ts
│   │   ├── hooks/
│   │   │   ├── useCanvas.ts
│   │   │   ├── useSimulation.ts
│   │   │   └── useAuth.ts
│   │   ├── utils/
│   │   │   ├── validation.ts
│   │   │   ├── calculations.ts
│   │   │   └── constants.ts
│   │   ├── types/
│   │   │   ├── device.types.ts
│   │   │   ├── connection.types.ts
│   │   │   └── scenario.types.ts
│   │   ├── store/
│   │   │   └── store.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── routes.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── auth.py
│   │   │   │   ├── projects.py
│   │   │   │   ├── simulation.py
│   │   │   │   ├── equipment.py
│   │   │   │   ├── scenarios.py
│   │   │   │   └── users.py
│   │   │   ├── deps.py
│   │   │   └── router.py
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   └── database.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── project.py
│   │   │   └── progress.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── project.py
│   │   │   ├── device.py
│   │   │   ├── simulation.py
│   │   │   └── scenario.py
│   │   ├── simulation/
│   │   │   ├── __init__.py
│   │   │   ├── engine.py
│   │   │   ├── audio/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── signal_processor.py
│   │   │   │   ├── audio_devices.py
│   │   │   │   └── calculations.py
│   │   │   ├── video/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── video_processor.py
│   │   │   │   ├── video_devices.py
│   │   │   │   └── edid_handler.py
│   │   │   └── validators.py
│   │   ├── learning/
│   │   │   ├── __init__.py
│   │   │   ├── scenario_manager.py
│   │   │   ├── grading.py
│   │   │   └── progress_tracker.py
│   │   ├── crud/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   └── project.py
│   │   ├── utils/
│   │   │   ├── __init__.py
│   │   │   └── helpers.py
│   │   └── main.py
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_api/
│   │   ├── test_simulation/
│   │   └── conftest.py
│   ├── alembic/
│   │   ├── versions/
│   │   └── env.py
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── Dockerfile
│   └── pytest.ini
│
├── data/
│   ├── equipment/
│   │   ├── audio_devices.json
│   │   ├── video_devices.json
│   │   └── cables.json
│   └── scenarios/
│       ├── scenario_01_basic_pa.json
│       ├── scenario_02_video_presentation.json
│       ├── scenario_03_conference_room.json
│       ├── scenario_04_home_theater.json
│       └── scenario_05_production_studio.json
│
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## 💾 DATABASE SCHEMAS

### PostgreSQL Schema

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    subscription_tier VARCHAR(20) DEFAULT 'free',
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Projects metadata (just references, actual data in MongoDB)
CREATE TABLE projects_meta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    mongodb_id VARCHAR(24) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Learning progress
CREATE TABLE learning_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    scenario_id VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'not_started',
    score INTEGER,
    attempts INTEGER DEFAULT 0,
    current_step INTEGER DEFAULT 0,
    time_spent INTEGER DEFAULT 0,
    completed_at TIMESTAMP,
    started_at TIMESTAMP,
    UNIQUE(user_id, scenario_id)
);

-- Achievements (for gamification - post-MVP)
CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    achievement_type VARCHAR(100) NOT NULL,
    earned_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, achievement_type)
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_projects_user ON projects_meta(user_id);
CREATE INDEX idx_progress_user ON learning_progress(user_id);
CREATE INDEX idx_progress_scenario ON learning_progress(scenario_id);
```

### MongoDB Collections

**projects collection:**
```javascript
{
  "_id": ObjectId("..."),
  "userId": "uuid-from-postgres",
  "name": "Conference Room A",
  "description": "AV system for 20-person meeting room",
  "created_at": ISODate("2025-10-16T..."),
  "updated_at": ISODate("2025-10-16T..."),
  "topology": {
    "devices": [
      {
        "id": "dev_001",
        "type": "microphone",
        "manufacturer": "Shure",
        "model": "SM58",
        "position": {
          "x": 100,
          "y": 200
        },
        "properties": {
          "gain": 0,
          "phantom_power": false,
          "pattern": "cardioid",
          "sensitivity_db": -54.5
        }
      }
    ],
    "connections": [
      {
        "id": "conn_001",
        "from": {
          "device": "dev_001",
          "port": "xlr_out"
        },
        "to": {
          "device": "dev_002",
          "port": "xlr_in_1"
        },
        "cable_type": "xlr",
        "cable_length": 10
      }
    ]
  },
  "simulation_results": {
    "last_run": ISODate("2025-10-16T..."),
    "valid": true,
    "warnings": [],
    "errors": [],
    "signal_flows": []
  },
  "tags": ["conference", "audio"],
  "is_public": false
}
```

**equipment collection:**
```javascript
{
  "_id": ObjectId("..."),
  "category": "audio",
  "subcategory": "microphone",
  "manufacturer": "Shure",
  "model": "SM58",
  "full_name": "Shure SM58 Dynamic Microphone",
  "specs": {
    "type": "dynamic",
    "pattern": "cardioid",
    "frequency_response": "50Hz-15kHz",
    "impedance": 150,
    "sensitivity_db": -54.5,
    "max_spl": 94,
    "requires_phantom": false
  },
  "ports": [
    {
      "id": "xlr_out",
      "type": "xlr",
      "direction": "output",
      "signal_type": "analog_audio"
    }
  ],
  "default_properties": {
    "gain": 0,
    "phantom_power": false
  },
  "icon_url": "/assets/icons/shure-sm58.svg",
  "image_url": "/assets/images/shure-sm58.png",
  "model_3d_url": null,
  "price_tier": "budget",
  "documentation_url": "https://www.shure.com/sm58",
  "is_active": true
}
```

**scenarios collection:**
```javascript
{
  "_id": ObjectId("..."),
  "scenario_id": "basic_pa_system",
  "title": "Basic PA System",
  "description": "Learn to build a simple public address system",
  "difficulty": "beginner",
  "estimated_time_minutes": 30,
  "category": "audio",
  "objectives": [
    "Connect a microphone to a mixer",
    "Configure signal levels",
    "Connect speakers",
    "Run successful simulation"
  ],
  "required_equipment": [
    "microphone",
    "mixer",
    "amplifier",
    "speaker"
  ],
  "steps": [
    {
      "step_number": 1,
      "instruction": "Place a microphone on the canvas",
      "hint": "Drag the Shure SM58 from the library to the workspace",
      "validation": {
        "type": "device_placed",
        "device_type": "microphone",
        "count": 1
      },
      "points": 10
    },
    {
      "step_number": 2,
      "instruction": "Connect the microphone to the mixer using XLR cable",
      "hint": "Click on the output port of the mic, then click the input port on the mixer",
      "validation": {
        "type": "connection_made",
        "from_device_type": "microphone",
        "to_device_type": "mixer",
        "cable_type": "xlr"
      },
      "points": 20
    }
  ],
  "grading_criteria": {
    "perfect_score": 100,
    "passing_score": 70,
    "connection_accuracy": 40,
    "signal_levels": 30,
    "efficiency": 20,
    "time_bonus": 10
  },
  "solution_topology": {
    // Optional reference solution
  }
}
```

---

## 🔌 API SPECIFICATION

### REST API Endpoints

**Base URL:** `http://localhost:8000/api/v1`

#### Authentication

```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
GET    /auth/me
POST   /auth/logout
```

#### Users

```
GET    /users/me
PUT    /users/me
GET    /users/{user_id}/progress
```

#### Projects

```
GET    /projects
POST   /projects
GET    /projects/{project_id}
PUT    /projects/{project_id}
DELETE /projects/{project_id}
```

#### Equipment

```
GET    /equipment
GET    /equipment/{equipment_id}
GET    /equipment/categories
```

#### Simulation

```
POST   /simulation/run
POST   /simulation/validate-connection
GET    /simulation/results/{project_id}
```

#### Scenarios

```
GET    /scenarios
GET    /scenarios/{scenario_id}
POST   /scenarios/{scenario_id}/start
POST   /scenarios/{scenario_id}/validate-step
POST   /scenarios/{scenario_id}/complete
GET    /scenarios/{scenario_id}/progress
```

### API Request/Response Examples

**POST /auth/register**
```json
// Request
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "SecurePass123!",
  "full_name": "John Doe"
}

// Response (201 Created)
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "johndoe",
  "full_name": "John Doe",
  "subscription_tier": "free",
  "created_at": "2025-10-16T10:00:00Z"
}
```

**POST /auth/login**
```json
// Request
{
  "username": "johndoe",
  "password": "SecurePass123!"
}

// Response (200 OK)
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

**POST /projects**
```json
// Request
{
  "name": "My Conference Room",
  "description": "Testing conference setup",
  "topology": {
    "devices": [...],
    "connections": [...]
  }
}

// Response (201 Created)
{
  "id": "project-uuid",
  "mongodb_id": "mongodb-objectid",
  "name": "My Conference Room",
  "description": "Testing conference setup",
  "created_at": "2025-10-16T10:00:00Z",
  "updated_at": "2025-10-16T10:00:00Z"
}
```

**POST /simulation/run**
```json
// Request
{
  "project_id": "project-uuid",
  "topology": {
    "devices": [...],
    "connections": [...]
  }
}

// Response (200 OK)
{
  "status": "success",
  "valid": true,
  "signal_flows": [
    {
      "type": "audio",
      "source": "dev_001",
      "path": ["dev_001", "dev_002", "dev_003"],
      "final_level_db": -6.5,
      "status": "ok"
    }
  ],
  "warnings": [
    {
      "type": "cable_length",
      "message": "HDMI cable exceeds recommended length",
      "severity": "medium"
    }
  ],
  "errors": []
}
```

---

## 🎨 FRONTEND IMPLEMENTATION

### Key React Components

**CanvasWorkspace.tsx**
```typescript
import React, { useEffect, useRef } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import { useAppSelector, useAppDispatch } from '../../hooks/redux';
import DeviceNode from './DeviceNode';
import ConnectionLine from './ConnectionLine';

interface CanvasWorkspaceProps {
  width: number;
  height: number;
}

const CanvasWorkspace: React.FC<CanvasWorkspaceProps> = ({ width, height }) => {
  const devices = useAppSelector(state => state.canvas.devices);
  const connections = useAppSelector(state => state.canvas.connections);
  const dispatch = useAppDispatch();
  const stageRef = useRef(null);

  const handleDrop = (e: any) => {
    e.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    stage.setPointersPositions(e);
    const position = stage.getPointerPosition();

    const deviceType = e.dataTransfer.getData('deviceType');
    dispatch(addDevice({
      type: deviceType,
      position: {
        x: position.x,
        y: position.y
      }
    }));
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      style={{ width: '100%', height: '100%' }}
    >
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        draggable
      >
        <Layer>
          {/* Grid background */}
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="#1E1E1E"
            strokeEnabled={false}
          />

          {/* Connections (render first, below devices) */}
          {connections.map(connection => (
            <ConnectionLine
              key={connection.id}
              connection={connection}
            />
          ))}

          {/* Devices */}
          {devices.map(device => (
            <DeviceNode
              key={device.id}
              device={device}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
};

export default CanvasWorkspace;
```

**DeviceNode.tsx**
```typescript
import React from 'react';
import { Group, Rect, Text, Circle, Image } from 'react-konva';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { selectDevice, updateDevicePosition } from '../../features/canvas/canvasSlice';
import useImage from 'use-image';

interface DeviceNodeProps {
  device: Device;
}

const DeviceNode: React.FC<DeviceNodeProps> = ({ device }) => {
  const dispatch = useAppDispatch();
  const selectedDeviceId = useAppSelector(state => state.canvas.selectedDeviceId);
  const isSelected = selectedDeviceId === device.id;

  const [image] = useImage(device.icon_url);

  const handleDragEnd = (e: any) => {
    dispatch(updateDevicePosition({
      id: device.id,
      position: {
        x: e.target.x(),
        y: e.target.y()
      }
    }));
  };

  const handleClick = () => {
    dispatch(selectDevice(device.id));
  };

  return (
    <Group
      x={device.position.x}
      y={device.position.y}
      draggable
      onDragEnd={handleDragEnd}
      onClick={handleClick}
    >
      {/* Background */}
      <Rect
        width={120}
        height={100}
        fill="#3A3A3A"
        stroke={isSelected ? '#00C853' : '#0066CC'}
        strokeWidth={2}
        cornerRadius={8}
        shadowColor="black"
        shadowBlur={10}
        shadowOpacity={0.3}
      />

      {/* Icon */}
      {image && (
        <Image
          image={image}
          x={35}
          y={15}
          width={50}
          height={50}
        />
      )}

      {/* Label */}
      <Text
        text={device.model}
        x={0}
        y={70}
        width={120}
        align="center"
        fontSize={12}
        fill="#FFFFFF"
      />

      {/* Input Port */}
      {device.ports.filter(p => p.direction === 'input').map((port, idx) => (
        <Circle
          key={`input-${idx}`}
          x={60}
          y={-6}
          radius={6}
          fill="#0066CC"
          stroke="#FFFFFF"
          strokeWidth={2}
          onClick={(e) => {
            e.cancelBubble = true;
            // Handle port click
          }}
        />
      ))}

      {/* Output Port */}
      {device.ports.filter(p => p.direction === 'output').map((port, idx) => (
        <Circle
          key={`output-${idx}`}
          x={60}
          y={106}
          radius={6}
          fill="#0066CC"
          stroke="#FFFFFF"
          strokeWidth={2}
          onClick={(e) => {
            e.cancelBubble = true;
            // Handle port click
          }}
        />
      ))}
    </Group>
  );
};

export default DeviceNode;
```

### Redux Store Setup

**store.ts**
```typescript
import { configureStore } from '@reduxjs/toolkit';
import canvasReducer from '../features/canvas/canvasSlice';
import simulationReducer from '../features/simulation/simulationSlice';
import learningReducer from '../features/learning/learningSlice';
import authReducer from '../features/auth/authSlice';

export const store = configureStore({
  reducer: {
    canvas: canvasReducer,
    simulation: simulationReducer,
    learning: learningReducer,
    auth: authReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

**canvasSlice.ts**
```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Device, Connection } from '../../types/device.types';

interface CanvasState {
  devices: Device[];
  connections: Connection[];
  selectedDeviceId: string | null;
  connectionInProgress: {
    fromDeviceId: string;
    fromPortId: string;
  } | null;
}

const initialState: CanvasState = {
  devices: [],
  connections: [],
  selectedDeviceId: null,
  connectionInProgress: null,
};

const canvasSlice = createSlice({
  name: 'canvas',
  initialState,
  reducers: {
    addDevice: (state, action: PayloadAction<Partial<Device>>) => {
      const newDevice: Device = {
        id: `device_${Date.now()}`,
        type: action.payload.type!,
        manufacturer: '', // To be filled from equipment data
        model: '',
        position: action.payload.position!,
        properties: {},
        ports: [],
      };
      state.devices.push(newDevice);
    },

    removeDevice: (state, action: PayloadAction<string>) => {
      state.devices = state.devices.filter(d => d.id !== action.payload);
      // Also remove connections involving this device
      state.connections = state.connections.filter(
        c => c.from.device !== action.payload && c.to.device !== action.payload
      );
    },

    updateDevicePosition: (state, action: PayloadAction<{
      id: string;
      position: { x: number; y: number };
    }>) => {
      const device = state.devices.find(d => d.id === action.payload.id);
      if (device) {
        device.position = action.payload.position;
      }
    },

    updateDeviceProperty: (state, action: PayloadAction<{
      id: string;
      property: string;
      value: any;
    }>) => {
      const device = state.devices.find(d => d.id === action.payload.id);
      if (device) {
        device.properties[action.payload.property] = action.payload.value;
      }
    },

    selectDevice: (state, action: PayloadAction<string>) => {
      state.selectedDeviceId = action.payload;
    },

    deselectDevice: (state) => {
      state.selectedDeviceId = null;
    },

    startConnection: (state, action: PayloadAction<{
      deviceId: string;
      portId: string;
    }>) => {
      state.connectionInProgress = {
        fromDeviceId: action.payload.deviceId,
        fromPortId: action.payload.portId,
      };
    },

    completeConnection: (state, action: PayloadAction<{
      toDeviceId: string;
      toPortId: string;
      cableType: string;
    }>) => {
      if (state.connectionInProgress) {
        const newConnection: Connection = {
          id: `conn_${Date.now()}`,
          from: {
            device: state.connectionInProgress.fromDeviceId,
            port: state.connectionInProgress.fromPortId,
          },
          to: {
            device: action.payload.toDeviceId,
            port: action.payload.toPortId,
          },
          cable_type: action.payload.cableType,
          cable_length: 10, // default
        };
        state.connections.push(newConnection);
        state.connectionInProgress = null;
      }
    },

    cancelConnection: (state) => {
      state.connectionInProgress = null;
    },

    removeConnection: (state, action: PayloadAction<string>) => {
      state.connections = state.connections.filter(c => c.id !== action.payload);
    },

    clearCanvas: (state) => {
      state.devices = [];
      state.connections = [];
      state.selectedDeviceId = null;
      state.connectionInProgress = null;
    },

    loadProject: (state, action: PayloadAction<{
      devices: Device[];
      connections: Connection[];
    }>) => {
      state.devices = action.payload.devices;
      state.connections = action.payload.connections;
      state.selectedDeviceId = null;
    },
  },
});

export const {
  addDevice,
  removeDevice,
  updateDevicePosition,
  updateDeviceProperty,
  selectDevice,
  deselectDevice,
  startConnection,
  completeConnection,
  cancelConnection,
  removeConnection,
  clearCanvas,
  loadProject,
} = canvasSlice.actions;

export default canvasSlice.reducer;
```

---

## 🐍 BACKEND IMPLEMENTATION

### FastAPI Main App

**main.py**
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import api_router
from app.core.config import settings

app = FastAPI(
    title="AVTrainer Pro API",
    description="API for AVTrainer Pro - AV Systems Learning Platform",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
def root():
    return {"message": "AVTrainer Pro API", "version": "1.0.0"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
```

### Simulation Engine Core

**simulation/engine.py**
```python
from typing import List, Dict, Optional
from app.schemas.device import Device, Connection
from app.schemas.simulation import SimulationResult, SignalFlow, Warning, Error

class SimulationEngine:
    """Core simulation engine for AVTrainer"""
    
    def __init__(self):
        self.devices: Dict[str, Device] = {}
        self.connections: List[Connection] = []
        
    def load_topology(self, devices: List[Device], connections: List[Connection]):
        """Load devices and connections into the engine"""
        self.devices = {d.id: d for d in devices}
        self.connections = connections
        
    def run_simulation(self) -> SimulationResult:
        """Run full system simulation"""
        
        # Build signal graph
        graph = self._build_signal_graph()
        
        # Simulate audio chains
        audio_flows = self._simulate_audio_chains(graph)
        
        # Simulate video chains
        video_flows = self._simulate_video_chains(graph)
        
        # Check for issues
        warnings = self._check_warnings()
        errors = self._check_errors()
        
        return SimulationResult(
            valid=len(errors) == 0,
            signal_flows=audio_flows + video_flows,
            warnings=warnings,
            errors=errors
        )
    
    def _build_signal_graph(self) -> Dict[str, List[Dict]]:
        """Build directed graph of signal flow"""
        graph = {}
        
        for conn in self.connections:
            if conn.from_device not in graph:
                graph[conn.from_device] = []
            
            graph[conn.from_device].append({
                'to': conn.to_device,
                'from_port': conn.from_port,
                'to_port': conn.to_port,
                'cable_type': conn.cable_type,
                'connection_id': conn.id
            })
        
        return graph
    
    def _simulate_audio_chains(self, graph: Dict) -> List[SignalFlow]:
        """Simulate audio signal paths"""
        flows = []
        
        # Find audio sources (microphones)
        sources = [
            dev_id for dev_id, dev in self.devices.items()
            if dev.type == 'microphone'
        ]
        
        for source_id in sources:
            signal_level = -60.0  # Mic level in dBu
            path = [source_id]
            
            # Trace signal path
            current = source_id
            visited = set()
            
            while current and current not in visited:
                visited.add(current)
                
                if current not in graph:
                    break
                
                # Get next device
                next_hops = graph[current]
                if not next_hops:
                    break
                
                next_hop = next_hops[0]  # Simplified: take first connection
                next_device_id = next_hop['to']
                
                # Process signal through device
                device = self.devices[next_device_id]
                signal_level = self._process_audio_signal(device, signal_level)
                
                path.append(next_device_id)
                current = next_device_id
            
            # Determine status
            status = 'ok' if -10 <= signal_level <= 10 else 'warning'
            
            flows.append(SignalFlow(
                type='audio',
                source=source_id,
                path=path,
                final_level_db=signal_level,
                status=status
            ))
        
        return flows
    
    def _process_audio_signal(self, device: Device, input_level: float) -> float:
        """Process audio signal through a device"""
        output_level = input_level
        
        if device.type == 'mixer':
            gain = device.properties.get('gain', 0)
            output_level += gain
            
        elif device.type == 'amplifier':
            gain = device.properties.get('gain', 20)
            output_level += gain
            
        elif device.type == 'speaker':
            # Speaker doesn't change signal level (it converts to acoustic)
            pass
        
        return output_level
    
    def _simulate_video_chains(self, graph: Dict) -> List[SignalFlow]:
        """Simulate video signal paths"""
        flows = []
        
        # Find video sources
        sources = [
            dev_id for dev_id, dev in self.devices.items()
            if dev.type in ['camera', 'media_player']
        ]
        
        for source_id in sources:
            source_device = self.devices[source_id]
            resolution = source_device.properties.get('resolution', '1920x1080')
            
            path = self._trace_path(source_id, graph, 'video')
            
            # Check compatibility
            compatible = self._check_video_compatibility(path, resolution)
            
            flows.append(SignalFlow(
                type='video',
                source=source_id,
                path=path,
                resolution=resolution,
                status='ok' if compatible else 'error'
            ))
        
        return flows
    
    def _trace_path(
        self, 
        start: str, 
        graph: Dict, 
        signal_type: str
    ) -> List[str]:
        """Trace signal path of specific type"""
        path = [start]
        current = start
        visited = set()
        
        while current and current not in visited:
            visited.add(current)
            
            if current not in graph:
                break
            
            # Filter connections by signal type
            connections = [
                hop for hop in graph[current]
                if self._is_signal_type(current, hop, signal_type)
            ]
            
            if not connections:
                break
            
            next_hop = connections[0]
            current = next_hop['to']
            path.append(current)
        
        return path
    
    def _is_signal_type(self, from_device_id: str, hop: Dict, signal_type: str) -> bool:
        """Check if connection carries specific signal type"""
        device = self.devices[from_device_id]
        # Check if port carries audio or video
        # Simplified logic
        return True
    
    def _check_video_compatibility(self, path: List[str], resolution: str) -> bool:
        """Check if all devices support the resolution"""
        for device_id in path:
            device = self.devices[device_id]
            supported = device.properties.get('supported_resolutions', [])
            
            if supported and resolution not in supported:
                return False
        
        return True
    
    def _check_warnings(self) -> List[Warning]:
        """Check for configuration warnings"""
        warnings = []
        
        # Check phantom power for condenser mics
        for device_id, device in self.devices.items():
            if device.type == 'microphone':
                if device.properties.get('requires_phantom', False):
                    # Find connected mixer
                    mixer = self._find_connected_device(device_id, 'mixer')
                    if mixer:
                        mixer_device = self.devices[mixer]
                        if not mixer_device.properties.get('phantom_power', False):
                            warnings.append(Warning(
                                type='phantom_power',
                                device=device_id,
                                message='Condenser microphone requires phantom power',
                                severity='medium'
                            ))
        
        # Check cable lengths
        for conn in self.connections:
            if conn.cable_type == 'hdmi':
                length = getattr(conn, 'cable_length', 0)
                if length > 15:
                    warnings.append(Warning(
                        type='cable_length',
                        connection=conn.id,
                        message=f'HDMI cable ({length}m) exceeds recommended maximum (15m)',
                        severity='medium'
                    ))
        
        return warnings
    
    def _check_errors(self) -> List[Error]:
        """Check for critical errors"""
        errors = []
        
        # Check for devices without input
        for device_id, device in self.devices.items():
            if device.type in ['speaker', 'display', 'projector']:
                if not self._has_input_connection(device_id):
                    errors.append(Error(
                        type='no_input',
                        device=device_id,
                        message=f'{device.type} has no input connection'
                    ))
        
        return errors
    
    def _find_connected_device(self, device_id: str, target_type: str) -> Optional[str]:
        """Find connected device of specific type"""
        for conn in self.connections:
            if conn.from_device == device_id:
                target = self.devices.get(conn.to_device)
                if target and target.type == target_type:
                    return conn.to_device
        return None
    
    def _has_input_connection(self, device_id: str) -> bool:
        """Check if device has input connection"""
        return any(conn.to_device == device_id for conn in self.connections)
    
    def validate_connection(self, connection: Connection) -> Dict:
        """Validate a single connection"""
        from_device = self.devices.get(connection.from_device)
        to_device = self.devices.get(connection.to_device)
        
        if not from_device or not to_device:
            return {'valid': False, 'error': 'Device not found'}
        
        # Find ports
        from_port = next(
            (p for p in from_device.ports if p.id == connection.from_port),
            None
        )
        to_port = next(
            (p for p in to_device.ports if p.id == connection.to_port),
            None
        )
        
        if not from_port or not to_port:
            return {'valid': False, 'error': 'Port not found'}
        
        # Check direction
        if from_port.direction != 'output' or to_port.direction != 'input':
            return {'valid': False, 'error': 'Invalid connection direction'}
        
        # Check signal type compatibility
        if from_port.signal_type != to_port.signal_type:
            return {
                'valid': False,
                'error': f'Signal type mismatch: {from_port.signal_type} -> {to_port.signal_type}'
            }
        
        # Check cable compatibility
        if not self._is_cable_compatible(
            connection.cable_type,
            from_port.type,
            to_port.type
        ):
            return {
                'valid': False,
                'error': f'Cable type {connection.cable_type} incompatible'
            }
        
        return {'valid': True}
    
    def _is_cable_compatible(self, cable: str, port1: str, port2: str) -> bool:
        """Check cable-port compatibility"""
        compatibility = {
            'xlr': ['xlr'],
            'hdmi': ['hdmi'],
            'sdi': ['bnc'],
            'cat6': ['rj45', 'ethercon'],
        }
        
        allowed = compatibility.get(cable, [])
        return port1 in allowed and port2 in allowed
```

### API Endpoints

**api/v1/simulation.py**
```python
from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.schemas.simulation import (
    SimulationRequest,
    SimulationResult,
    ConnectionValidationRequest
)
from app.simulation.engine import SimulationEngine
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/run", response_model=SimulationResult)
async def run_simulation(
    request: SimulationRequest,
    current_user = Depends(get_current_user)
):
    """Run simulation for a project"""
    
    engine = SimulationEngine()
    engine.load_topology(request.devices, request.connections)
    
    try:
        result = engine.run_simulation()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/validate-connection")
async def validate_connection(
    request: ConnectionValidationRequest,
    current_user = Depends(get_current_user)
):
    """Validate a single connection"""
    
    engine = SimulationEngine()
    # Load devices for context
    engine.load_topology(request.devices, [])
    
    result = engine.validate_connection(request.connection)
    return result
```

---

## 🚀 DEPLOYMENT

### Docker Setup

**docker-compose.yml**
```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    environment:
      - REACT_APP_API_URL=http://localhost:8000
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://avtrainer:password@postgres:5432/avtrainer
      - MONGODB_URL=mongodb://mongo:27017/avtrainer
      - SECRET_KEY=${SECRET_KEY}
      - ALLOWED_ORIGINS=http://localhost:3000
    depends_on:
      - postgres
      - mongo
    volumes:
      - ./backend:/app

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_USER=avtrainer
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=avtrainer
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  mongo:
    image: mongo:6
    volumes:
      - mongo_data:/data/db
    ports:
      - "27017:27017"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
  mongo_data:
```

**backend/Dockerfile**
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Run migrations (in production, do this separately)
# RUN alembic upgrade head

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

**frontend/Dockerfile**
```dockerfile
FROM node:18 as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## 📝 DEVELOPMENT WORKFLOW

### Sprint 1 (Weeks 1-2): Project Setup

**Tasks:**
- [ ] Initialize Git repository
- [ ] Setup frontend (React + TypeScript + Vite)
- [ ] Setup backend (FastAPI + PostgreSQL + MongoDB)
- [ ] Docker Compose configuration
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Development environment documentation

**Deliverables:**
- Running dev environment
- Basic "Hello World" app
- Database migrations setup

---

### Sprint 2 (Weeks 3-4): Canvas Editor Core

**Tasks:**
- [ ] Implement CanvasWorkspace component
- [ ] Drag & Drop from library
- [ ] Device placement on canvas
- [ ] Device movement
- [ ] Redux state management
- [ ] Basic styling

**Deliverables:**
- Working canvas with 3-5 device types
- Devices can be placed and moved

---

### Sprint 3 (Weeks 5-6): Connection System

**Tasks:**
- [ ] Port visualization on devices
- [ ] Click-to-connect functionality
- [ ] Connection line rendering
- [ ] Connection validation (client-side)
- [ ] Connection deletion

**Deliverables:**
- Devices can be connected
- Visual feedback for connections

---

### Sprint 4 (Weeks 7-8): Backend API

**Tasks:**
- [ ] User authentication (register, login)
- [ ] Project CRUD endpoints
- [ ] Equipment library endpoint
- [ ] Basic simulation endpoint
- [ ] Database models and migrations

**Deliverables:**
- Complete API for MVP features
- API documentation (Swagger)

---

### Sprint 5 (Weeks 9-10): Simulation Engine

**Tasks:**
- [ ] Audio signal tracing algorithm
- [ ] Video signal tracing algorithm
- [ ] Connection validation logic
- [ ] Warning/error detection
- [ ] Integration with API

**Deliverables:**
- Working simulation engine
- Accurate signal flow analysis

---

### Sprint 6 (Weeks 11-12): Properties Panel

**Tasks:**
- [ ] Properties panel UI
- [ ] Property editing
- [ ] Real-time updates
- [ ] Validation
- [ ] Backend property persistence

**Deliverables:**
- Users can view and edit device properties

---

### Sprint 7 (Weeks 13-14): Equipment Library

**Tasks:**
- [ ] Populate equipment database (15 devices)
- [ ] Equipment browser UI
- [ ] Search and filter
- [ ] Device details view
- [ ] Icon/image assets

**Deliverables:**
- Complete 15-device library
- Professional icons/images

---

### Sprint 8 (Weeks 15-16): Learning System

**Tasks:**
- [ ] Scenario data structure
- [ ] ScenarioPlayer component
- [ ] Step validation logic
- [ ] Progress tracking
- [ ] Create 5 scenarios

**Deliverables:**
- 5 working learning scenarios
- Progress tracking functional

---

### Sprint 9 (Weeks 17-18): Project Management

**Tasks:**
- [ ] Save project to database
- [ ] Load project from database
- [ ] Project list view
- [ ] Project metadata (name, description, tags)
- [ ] Delete project

**Deliverables:**
- Full project CRUD functionality

---

### Sprint 10 (Weeks 19-20): Polish & Testing

**Tasks:**
- [ ] UI/UX improvements
- [ ] Responsive design
- [ ] Unit tests
- [ ] Integration tests
- [ ] Bug fixes
- [ ] Performance optimization

**Deliverables:**
- Production-ready MVP

---

### Sprint 11 (Weeks 21-22): Deployment & Documentation

**Tasks:**
- [ ] Production deployment
- [ ] User documentation
- [ ] Video tutorials
- [ ] Marketing materials
- [ ] Beta tester recruitment

**Deliverables:**
- Live MVP
- Documentation site

---

## 🧪 TESTING STRATEGY

### Unit Tests

**Frontend:**
```typescript
// Example: DeviceNode.test.tsx
import { render, fireEvent } from '@testing-library/react';
import DeviceNode from './DeviceNode';

describe('DeviceNode', () => {
  it('renders device with correct model name', () => {
    const device = {
      id: 'test-1',
      type: 'microphone',
      model: 'Shure SM58',
      position: { x: 0, y: 0 },
      // ...
    };
    
    const { getByText } = render(<DeviceNode device={device} />);
    expect(getByText('Shure SM58')).toBeInTheDocument();
  });

  it('calls onDragEnd when device is moved', () => {
    const onDragEnd = jest.fn();
    // ... test logic
  });
});
```

**Backend:**
```python
# Example: test_simulation.py
import pytest
from app.simulation.engine import SimulationEngine

def test_audio_signal_flow():
    engine = SimulationEngine()
    
    # Setup test topology
    devices = [
        # ... test devices
    ]
    connections = [
        # ... test connections
    ]
    
    engine.load_topology(devices, connections)
    result = engine.run_simulation()
    
    assert result.valid == True
    assert len(result.signal_flows) > 0
    assert result.signal_flows[0].type == 'audio'
```

### Integration Tests

Test full user workflows:
1. User registers and logs in
2. Creates a project
3. Adds devices to canvas
4. Connects devices
5. Runs simulation
6. Saves project

### E2E Tests

Use Cypress or Playwright for browser testing.

---

## 📊 PERFORMANCE CONSIDERATIONS

### Frontend Optimization

1. **Canvas Performance:**
   - Use Konva's `cache()` for static elements
   - Implement virtualization for large topologies
   - Debounce drag events

2. **State Management:**
   - Use selectors to prevent unnecessary re-renders
   - Memoize expensive computations

3. **Bundle Size:**
   - Code splitting by route
   - Lazy load scenarios
   - Optimize images

### Backend Optimization

1. **Database:**
   - Index frequently queried fields
   - Use connection pooling
   - Cache equipment library

2. **API:**
   - Rate limiting
   - Response compression
   - Pagination for lists

3. **Simulation:**
   - Cache simulation results
   - Run heavy computations async

---

## 🔒 SECURITY CONSIDERATIONS

### Authentication
- JWT tokens with refresh mechanism
- Password hashing with bcrypt
- HTTPS only in production

### Authorization
- User can only access their own projects
- Role-based access (future: teacher role)

### Input Validation
- Validate all API inputs with Pydantic
- Sanitize user-provided text
- File upload validation (future)

### Data Protection
- No sensitive data in logs
- Secure database credentials
- Regular security audits

---

## 📈 MONITORING & ANALYTICS

### Application Monitoring
- Sentry for error tracking
- LogRocket for session replay
- DataDog for infrastructure

### Analytics
- Mixpanel for user behavior
- Track key events:
  - User registration
  - Project creation
  - Scenario completion
  - Simulation runs

### KPIs to Track
- DAU/MAU
- Scenario completion rate
- Average session time
- Conversion rate (free → paid)

---

## 💬 SUPPORT FOR NEXT CHAT

### How to Use This Document

**Load this document in Claude and say:**

```
"Я начинаю разработку MVP для AVTrainer Pro. Загружаю development guide.
Помоги мне с [конкретная задача]:
- Написать компонент [X]
- Реализовать функцию [Y]
- Создать API endpoint для [Z]
- Настроить [что-то]"
```

### Example Prompts

**For Frontend:**
```
"На основе AVTrainer MVP Development Guide, помоги создать компонент
EquipmentLibrary.tsx со всеми нужными функциями."
```

**For Backend:**
```
"Согласно specs в документе, помоги реализовать API endpoint для
сохранения проекта в MongoDB."
```

**For Database:**
```
"Создай Alembic migration для создания таблиц, описанных в документе."
```

**For Testing:**
```
"Напиши unit tests для SimulationEngine согласно документации."
```

---

## ✅ MVP COMPLETION CHECKLIST

### Must Have Before Launch:

**Core Features:**
- [ ] Canvas editor (drag, drop, move)
- [ ] 15 devices in library
- [ ] Connection system working
- [ ] Basic simulation (audio + video)
- [ ] 5 learning scenarios
- [ ] User auth (register, login)
- [ ] Project save/load
- [ ] Properties panel

**Quality:**
- [ ] No critical bugs
- [ ] Responsive design (desktop + tablet)
- [ ] Loading states everywhere
- [ ] Error handling
- [ ] Help/documentation

**Performance:**
- [ ] Page load < 3 seconds
- [ ] Smooth canvas interactions (60fps)
- [ ] API response < 500ms

**Security:**
- [ ] All inputs validated
- [ ] JWT authentication
- [ ] HTTPS in production
- [ ] Rate limiting

**Documentation:**
- [ ] User guide
- [ ] API docs
- [ ] Developer setup guide
- [ ] Deployment guide

---

## 🎯 SUCCESS METRICS FOR MVP

### Technical Metrics:
- 0 critical bugs
- 95%+ uptime
- < 3s load time
- < 500ms API response

### User Metrics:
- 100 beta users
- 70%+ scenario completion rate
- 30+ min average session time
- 4.0+ satisfaction rating

### Business Metrics:
- 10 pilot university partnerships
- 5% free-to-paid conversion
- $0 CAC (organic only)

---

## 🚀 READY TO CODE!

**You now have:**
✅ Complete technical specification
✅ Database schemas
✅ API definitions
✅ Code examples
✅ Development workflow
✅ Testing strategy
✅ Deployment config

**Next steps:**
1. Load this document in Claude
2. Start with Sprint 1 (Project Setup)
3. Build incrementally
4. Test continuously
5. Deploy MVP in 6-8 months!

**Good luck building AVTrainer Pro! 💪**

---

*AVTrainer MVP Development Guide v1.0*
*Last Updated: October 16, 2025*
*Ready for implementation*
