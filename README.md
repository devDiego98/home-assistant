# Casa — Personal Home Assistant

A self-hosted, AI-powered home management system controllable entirely from your phone. Manage smart devices, monitor all cameras, and get intelligent security alerts — all running on hardware you own, with no cloud subscriptions.

---

## Vision

| Capability | Description |
|---|---|
| **Phone Control** | Control every smart device in your house from a mobile app — lights, locks, thermostat, outlets, and more |
| **Camera System** | Live-stream all cameras, review recordings, and get motion clips sent to your phone |
| **AI Security** | Real-time object detection (people, vehicles, packages) with smart alerts — no false alarms from leaves or shadows |
| **Automations** | Set rules like "lock all doors at 10pm" or "turn on porch lights when a person is detected" |
| **Notifications** | Instant push notifications with snapshot images when something important happens |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Your Home Network                      │
│                                                           │
│  IP Cameras (RTSP/ONVIF)                                 │
│       │                                                   │
│       ▼                                                   │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐  │
│  │  Frigate NVR │    │  Home Server │    │ MQTT Broker │  │
│  │  (AI + DVR) │◄──►│  (API + DB)  │◄──►│ (Mosquitto) │  │
│  └─────────────┘    └──────────────┘    └─────────────┘  │
│                             │                    ▲        │
│                             │             Smart Devices   │
│                             │           (Zigbee/Z-Wave)   │
└─────────────────────────────┼────────────────────────────┘
                              │ (Tailscale VPN / HTTPS)
                              ▼
                    ┌──────────────────┐
                    │   Mobile App     │
                    │  (React Native)  │
                    └──────────────────┘
```

---

## Technology Stack

### Hardware
All hardware listed below is available on **MercadoLibre Argentina**. Search terms are included for each item.

| Component | Recommended Products | MercadoLibre Search |
|---|---|---|
| **Home Server** | Any PC/laptop with i5+ CPU and 8GB RAM minimum (repurpose an old machine), or a Beelink Mini PC | `"mini pc intel"` / `"mini pc 8gb"` |
| **Indoor Cameras** | TP-Link Tapo C200, C210, C220 — full RTSP support, good night vision | `"tapo c200"` / `"tapo c210"` |
| **Outdoor Cameras** | TP-Link Tapo C500, C510W — weatherproof, colour night vision | `"tapo c500"` / `"camara exterior tapo"` |
| **Alternative Cameras** | Ezviz C3W Pro, Ezviz C6N — also RTSP-compatible | `"ezviz c3w"` / `"ezviz c6n"` |
| **Zigbee Coordinator** | Sonoff Zigbee 3.0 USB Dongle Plus (ZBDONGLE-P) | `"sonoff zigbee dongle"` |
| **Smart Switches** | Sonoff Mini R2 / Mini R4 (fit inside wall boxes) | `"sonoff mini r2"` / `"sonoff mini r4"` |
| **Smart Plugs** | TP-Link Tapo P100 / P105, or Nexxt Solutions smart plugs | `"tapo p100"` / `"enchufe wifi"` |
| **Smart Bulbs** | Nexxt Dimmable WiFi bulbs, or generic Tuya-compatible bulbs | `"foco wifi"` / `"nexxt foco"` |
| **Smart Lock** | Tuya-compatible smart door lock (fingerprint + app) | `"cerradura inteligente tuya"` |
| **Motion/Door Sensors** | Sonoff SNZB-03 (motion), SNZB-04 (door/window) — Zigbee | `"sonoff snzb"` |

> **Server note:** A Raspberry Pi works but is expensive in Argentina due to import costs — an old laptop or desktop (i5, 8GB RAM+) running Ubuntu Server is a better value and handles AI detection more comfortably.

### Backend & Infrastructure
| Technology | Purpose |
|---|---|
| **Docker + Docker Compose** | Containerizes all services — easy to run and update |
| **Node.js + Fastify** | Main API server — handles auth, devices, events, automations |
| **Python** | AI/ML processing scripts, camera analysis |
| **PostgreSQL** | Primary database — stores events, users, devices, automations |
| **Redis** | Real-time pub/sub, caching, session storage |
| **Nginx** | Reverse proxy — routes traffic to all services |

### Camera & Security
| Technology | Purpose |
|---|---|
| **Frigate NVR** | Open-source NVR with built-in AI object detection (YOLOv8) |
| **RTSP / ONVIF** | Universal camera streaming protocol |
| **WebRTC / HLS** | Low-latency live stream delivery to the mobile app |
| **YOLOv8** | Real-time detection of people, vehicles, animals, packages |
| **OpenCV** | Motion detection, video processing utilities |

### Smart Home
| Technology | Purpose |
|---|---|
| **MQTT (Mosquitto)** | Lightweight messaging bus for all IoT devices |
| **Zigbee2MQTT** | Connects Zigbee smart devices (bulbs, plugs, sensors, locks) to MQTT |
| **Home Assistant** (optional) | Additional device integrations and automation engine |

### Mobile App
| Technology | Purpose |
|---|---|
| **React Native + Expo** | Cross-platform mobile app (iOS + Android) |
| **WebRTC** | Live camera feed in the app with sub-second latency |
| **Firebase Cloud Messaging** | Push notifications with snapshot images |
| **Tailscale** | Secure remote access — connects your phone to your home network via VPN |

---

## Project Phases

### Phase 1 — Foundation
- [ ] Set up home server with Docker Compose
- [ ] Deploy Nginx reverse proxy with HTTPS (Let's Encrypt)
- [ ] Build core API (Node.js/Fastify) with JWT authentication
- [ ] Set up PostgreSQL + Redis
- [ ] Configure Tailscale for secure remote access
- [ ] Basic mobile app shell with login screen

### Phase 2 — Camera System
- [ ] Integrate IP cameras via RTSP/ONVIF
- [ ] Deploy Frigate NVR for recording and clip storage
- [ ] Live camera feeds in mobile app (WebRTC/HLS)
- [ ] Camera timeline — browse recordings by date
- [ ] Manual snapshot and clip download

### Phase 3 — AI Security
- [ ] Enable Frigate object detection (people, vehicles, animals)
- [ ] Configure detection zones per camera
- [ ] Push notifications with snapshot when person detected
- [ ] AI-powered alert filtering — suppress false positives
- [ ] Security event log with annotated video clips
- [ ] Facial recognition for known vs unknown persons (optional)

### Phase 4 — Smart Home Control
- [ ] MQTT broker + Zigbee2MQTT setup
- [ ] Device discovery and dashboard
- [ ] Control lights, plugs, switches from mobile app
- [ ] Thermostat integration
- [ ] Smart lock integration (lock/unlock from app)
- [ ] Real-time device state updates via WebSocket

### Phase 5 — Automations & Intelligence
- [ ] Automation rule builder (if X then Y)
- [ ] Time-based schedules (e.g. turn off all lights at midnight)
- [ ] Presence-based automations (arrive home → unlock door, turn on lights)
- [ ] Cross-system automations (camera detects person → turn on lights + notify)
- [ ] Daily digest notification — summary of what happened while you were away

---

## Repository Structure (planned)

```
home-assistant/
├── server/               # Node.js API backend
│   ├── src/
│   │   ├── routes/       # API endpoints
│   │   ├── services/     # Business logic
│   │   └── db/           # Database models & migrations
│   └── Dockerfile
├── ai/                   # Python AI/ML services
│   ├── detector/         # Object detection processing
│   └── Dockerfile
├── mobile/               # React Native Expo app
│   ├── app/              # Screens
│   ├── components/       # Reusable UI components
│   └── services/         # API + WebSocket clients
├── infra/                # Infrastructure config
│   ├── docker-compose.yml
│   ├── nginx/
│   └── frigate/          # Frigate NVR config
└── README.md
```

---

## Security Model

- All traffic encrypted via HTTPS (TLS)
- Remote access via **Tailscale VPN** — no ports exposed to the open internet
- JWT-based authentication with refresh token rotation
- Camera streams never leave the home network unencrypted
- All data stored locally — no third-party cloud required

---

## Getting Started

> Setup instructions will be added as each phase is completed. Each phase will have its own `SETUP.md` in the relevant folder.

**Prerequisites:**
- A PC, laptop, or mini PC running Ubuntu Server (i5+ CPU, 8GB RAM minimum, 16GB recommended for AI detection) — see hardware guide above
- Docker and Docker Compose installed on the home server
- At least one RTSP-capable IP camera (e.g. TP-Link Tapo C200 or Ezviz C3W)
- A smartphone (iOS or Android)
- Tailscale account (free tier is sufficient)

---

## Contributing / Roadmap Notes

This is a personal home project. The goal is a fully self-hosted, privacy-first system where all data stays in the home. Cloud services are used only for push notifications (Firebase) and VPN coordination (Tailscale) — neither receives camera footage or device data.
