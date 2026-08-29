# KUKA Industrial 6-Axis Robot Controller & 3D Simulation Interface

This package provides a standalone Python desktop application (PySide6) simulating an industrial client-side KUKA robot joint control panel, backed by a high-performance FastAPI/WebSocket middleware that drives the React + Three.js 3D Digital Twin simulator in real time.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│  Python Desktop Application (robot_controller/app.py)   │
│  - PySide6 Industrial Dark Theme HMI                   │
│  - 6-Axis Joint Position Sliders & Spinboxes           │
│  - Live Packet Streaming Mode (100–500 ms cycle)       │
│  - Random Pose Generator & Calibration Presets         │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP POST /api/robot/joints
                            ▼
┌────────────────────────────────────────────────────────┐
│  FastAPI Backend (robot_controller/server/main.py)     │
│  - Port: 8000                                          │
│  - Pydantic Schema Validation & Joint Limit Clamping  │
│  - REST Endpoints (/health, /joints)                   │
│  - Multi-client WebSocket Manager (/ws/robot)          │
└───────────────────────────┬────────────────────────────┘
                            │ WebSocket Broadcast (JSON)
                            ▼
┌────────────────────────────────────────────────────────┐
│  React + Three.js 3D Simulator (src/App.jsx)           │
│  - Closed-form Forward Kinematics                      │
│  - Smooth 60 FPS Angle Slerp/Lerp Interpolation        │
│  - KUKA KR CYBERTECH 3D Digital Twin Visualizer        │
└────────────────────────────────────────────────────────┘
```

---

## Folder Structure

```
robot_controller/
├── app.py                     # Desktop GUI launcher (PySide6)
├── config.py                  # Host, Port, Limits, Defaults, Speeds
├── models.py                  # Pydantic validation schemas
├── api_client.py              # HTTP client with resilient error handling
├── requirements.txt           # Python dependencies
├── README.md                  # System documentation & usage guide
│
├── gui/
│   ├── __init__.py
│   ├── main_window.py         # Main GUI window with telemetry, controls, and streaming
│   ├── joint_panel.py         # Synchronized Slider + SpinBox axis widget (0.1° resolution)
│   └── styles.py              # KUKA industrial dark theme stylesheet
│
└── server/
    ├── __init__.py
    ├── main.py                # FastAPI app with CORS middleware and logging
    ├── routes.py              # REST endpoints and WebSocket /ws/robot route
    └── websocket_manager.py   # Multi-client broadcast and disconnect management
```

---

## 6-Axis Joint Limits & Calibration Defaults

Configured in `config.py`:

| Axis | Robot Articulation | Minimum | Maximum | Calibration Default |
| :--- | :--- | :--- | :--- | :--- |
| **A1** | Base Turntable | -185.0° | +185.0° | `0.0°` |
| **A2** | Shoulder Pitch | -155.0° | +35.0° | `-30.6°` |
| **A3** | Elbow Pitch | -130.0° | +154.0° | `+29.4°` |
| **A4** | Forearm Roll | -350.0° | +350.0° | `0.0°` |
| **A5** | Wrist Pitch | -130.0° | +130.0° | `+43.8°` |
| **A6** | Flange Roll | -350.0° | +350.0° | `-112.5°` |

---

## Installation

Ensure Python 3.12+ is installed:

```bash
cd robot_controller
pip install -r requirements.txt
```

---

## Running the System

To run the complete system, open three separate terminals:

### Terminal 1: Start FastAPI Server
```bash
cd /Users/manojsarya/Documents/ATS_Projects/Kuka-welding-simultor/robot_controller
uvicorn server.main:app --host 127.0.0.1 --port 8000 --reload
```

### Terminal 2: Start Python GUI
```bash
cd /Users/manojsarya/Documents/ATS_Projects/Kuka-welding-simultor/robot_controller
python app.py
```

### Terminal 3: Start Existing React Simulator
```bash
cd /Users/manojsarya/Documents/ATS_Projects/Kuka-welding-simultor
npm run dev
```

---

## REST API Specification

### 1. Health Check
- **Endpoint**: `GET http://127.0.0.1:8000/api/health`
- **Response**:
```json
{
  "status": "ok"
}
```

### 2. Read Current Joint Angles
- **Endpoint**: `GET http://127.0.0.1:8000/api/robot/joints`
- **Response**:
```json
{
  "a1": 0.0,
  "a2": -30.6,
  "a3": 29.4,
  "a4": 0.0,
  "a5": 43.8,
  "a6": -112.5
}
```

### 3. Send Joint Angles (Broadcast to 3D Simulator)
- **Endpoint**: `POST http://127.0.0.1:8000/api/robot/joints`
- **Header**: `Content-Type: application/json`
- **Body**:
```json
{
  "a1": 20.0,
  "a2": -40.0,
  "a3": 50.0,
  "a4": 10.0,
  "a5": 60.0,
  "a6": -100.0
}
```
- **Response**:
```json
{
  "success": true,
  "joints": {
    "a1": 20.0,
    "a2": -40.0,
    "a3": 50.0,
    "a4": 10.0,
    "a5": 60.0,
    "a6": -100.0
  }
}
```

#### Example cURL:
```bash
curl -X POST http://127.0.0.1:8000/api/robot/joints \
  -H "Content-Type: application/json" \
  -d '{
    "a1": 0.0,
    "a2": -30.6,
    "a3": 29.4,
    "a4": 0.0,
    "a5": 43.8,
    "a6": -112.5
  }'
```

---

## WebSocket Specification

- **Endpoint**: `ws://127.0.0.1:8000/ws/robot`
- **Protocol**: JSON
- **Event Format**:
```json
{
  "type": "joint_update",
  "timestamp": "2026-08-29T18:05:00.123456Z",
  "joints": {
    "a1": 0.0,
    "a2": -30.6,
    "a3": 29.4,
    "a4": 0.0,
    "a5": 43.8,
    "a6": -112.5
  }
}
```

---

## Features & Usage

1. **Synchronized Controls**: Moving an axis slider instantly updates its numeric display and spinbox, and typing a value into a spinbox immediately moves its slider.
2. **Limit Enforcement**: Numeric inputs and sliders are bound by industrial software limits. Any out-of-bound value is rejected and highlighted.
3. **Send to Simulator**: Clicking `[ SEND TO SIMULATOR ]` sends the 6 angles via HTTP POST to FastAPI, which broadcasts them over WebSocket to the React app. The React Three.js robot smoothly interpolates its joints to match.
4. **Random Test**: Generates a valid randomized joint pose within working limits. Clicking `[ SEND TO SIMULATOR ]` executes the motion.
5. **Real-Time Data Streaming**: Clicking `[ START STREAM ]` runs a real-time kinematic test cycle transmitting continuous joint updates every 200 ms with an active packet counter.
6. **Resilient Communication**: If the FastAPI server or React simulator is disconnected or restarted, the Python GUI and server handle it gracefully without crashing.
