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

## Repository Structure

```
home-assistant/
├── apps/
│   ├── backend/          # Node.js + Fastify API
│   │   ├── src/
│   │   │   ├── routes/   # REST endpoints
│   │   │   ├── services/ # Tuya, MQTT integrations
│   │   │   └── db/       # Drizzle ORM schema + migrations
│   │   └── Dockerfile
│   └── mobile/           # React Native + Expo app
│       ├── app/          # Expo Router screens
│       ├── components/   # Reusable UI
│       └── services/     # API + WebSocket clients
├── packages/
│   └── shared/           # TypeScript types shared by both apps
├── infra/                # Docker Compose, Nginx, Frigate, Mosquitto
├── ai/                   # Python AI/ML scripts (future)
└── README.md
```

---

## Security Model

- Remote access via **Tailscale VPN** — no ports exposed to the open internet
- JWT-based authentication with refresh token rotation
- Camera streams never leave the home network unencrypted
- All data stored locally — no third-party cloud required

---

## Getting Started

### Prerequisites

| Requirement | Notes |
|---|---|
| **Node.js 20+** | Use nvm: `nvm install 20 && nvm use 20` |
| **pnpm 8+** | `npm install -g pnpm@8` |
| **PostgreSQL** | Local install or Docker |
| **Redis** | `docker run -d --name casa_redis -p 127.0.0.1:6379:6379 redis:7-alpine` |
| **Tailscale account** | Free at [tailscale.com](https://tailscale.com) — needed for remote access |
| **Expo Go** | Install on your phone from the App Store / Play Store |

---

### 1. Install dependencies

```bash
nvm use 20
pnpm install
```

---

### 2. Set up the database

If using Docker for Postgres:
```bash
docker run -d --name casa_postgres \
  -e POSTGRES_USER=casa \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=casa_db \
  -p 127.0.0.1:5432:5432 \
  postgres:16-alpine
```

If using a local Postgres installation, create the role and database manually:
```bash
psql -U your_user -d postgres -c "CREATE ROLE casa WITH LOGIN PASSWORD 'yourpassword';"
psql -U your_user -d postgres -c "CREATE DATABASE casa_db OWNER casa;"
```

---

### 3. Configure the backend

```bash
cp apps/backend/.env.example apps/backend/.env
```

Edit `apps/backend/.env` and set at minimum:

```env
DATABASE_URL=postgresql://casa:yourpassword@127.0.0.1:5432/casa_db
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=<run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

Run database migrations:
```bash
pnpm --filter @casa/backend db:generate
pnpm --filter @casa/backend db:migrate
```

Create the first admin user:
```bash
# Generate a SHA-256 hash of your password
node -e "const c=require('crypto'); console.log(c.createHash('sha256').update('YourPassword').digest('hex'))"

# Insert the user
psql -U casa -d casa_db -c "INSERT INTO users (id, email, name, password_hash, role) VALUES (gen_random_uuid(), 'you@email.com', 'Your Name', '<hash>', 'admin');"
```

---

### 4. Set up Tailscale (required for phone access)

Tailscale allows your phone to reach the home server from **any network** — home WiFi, mobile data, abroad — without opening any ports.

**On your server/Mac:**
```bash
# macOS
brew install tailscale
sudo tailscale up

# Ubuntu server
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Get your server's Tailscale IP (you will need this)
tailscale ip -4
```

**On your phone:** Install **Tailscale** from the App Store or Play Store and sign in with the **same account**.

Once both devices appear in the Tailscale dashboard, they can reach each other from any network.

---

### 5. Configure the mobile app

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Edit `apps/mobile/.env`:
```env
# Replace with your server's Tailscale IP from step 4
EXPO_PUBLIC_API_URL=http://100.x.x.x:3000
```

> The `EXPO_PUBLIC_API_URL` hostname is also used automatically as the Metro bundler address — no extra config needed.

---

### 6. Start the backend

```bash
nvm use 20
pnpm backend
```

Verify it's running:
```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

---

### 7. Start the mobile app

```bash
nvm use 20
pnpm mobile
```

This automatically starts Metro with your Tailscale IP as the packager host. A QR code will appear in the terminal.

**On your phone:**
1. Make sure **Tailscale** is connected (VPN toggle is on)
2. Open **Expo Go**
3. Tap **Scan QR code** and scan the code in your terminal

The app will load and connect to your backend through Tailscale — regardless of which network your phone is on.

> **Troubleshooting:** If the QR code says `exp://192.168.x.x:...` instead of your Tailscale IP, make sure `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` has your Tailscale IP, then restart Metro.

---

### 8. Connect SmartLife / Tuya devices (optional)

To control SmartLife lights from the floor plan:

1. Register at [developer.tuya.com](https://developer.tuya.com) (free)
2. Create a Cloud Project → link your SmartLife app account under **Devices → Link App Account**
3. Copy your credentials into `apps/backend/.env`:

```env
TUYA_CLIENT_ID=your_client_id
TUYA_CLIENT_SECRET=your_client_secret
TUYA_REGION=us   # us / eu / cn — match where you registered
```

4. Restart the backend. In the app, go to **Home → Edit Layout**, tap on the floor plan to place a light, and the device picker will show all your SmartLife devices.

---

## Daily Usage

| Task | Command |
|---|---|
| Start backend | `pnpm backend` |
| Start mobile app | `pnpm mobile` |
| Run DB migrations after schema changes | `pnpm --filter @casa/backend db:generate && pnpm --filter @casa/backend db:migrate` |
| Start all infra (Docker) | `cd infra && docker compose up -d` |

---

## Project Phases

### Phase 1 — Foundation ✅
- [x] Monorepo with shared TypeScript types
- [x] Node.js/Fastify API with JWT authentication
- [x] PostgreSQL + Redis
- [x] Tailscale for secure remote access
- [x] React Native mobile app with login, floor plan, light control

### Phase 2 — Camera System
- [ ] Integrate IP cameras via RTSP/ONVIF
- [ ] Deploy Frigate NVR for recording and clip storage
- [ ] Live camera feeds in mobile app (WebRTC/HLS)
- [ ] Camera timeline — browse recordings by date

### Phase 3 — AI Security
- [ ] Enable Frigate object detection (people, vehicles, animals)
- [ ] Configure detection zones per camera
- [ ] Push notifications with snapshot when person detected
- [ ] Security event log with annotated video clips

### Phase 4 — Smart Home Control
- [ ] MQTT broker + Zigbee2MQTT for Zigbee devices
- [ ] Device discovery and dashboard
- [ ] Smart lock integration
- [ ] Real-time device state via WebSocket

### Phase 5 — Automations & Intelligence
- [ ] Automation rule builder (if X then Y)
- [ ] Time-based schedules
- [ ] Presence-based automations
- [ ] Daily digest notifications

---

## Contributing / Roadmap Notes

This is a personal home project. All data stays in the home — cloud services are used only for VPN coordination (Tailscale) and optionally push notifications (Firebase). No camera footage or device data ever leaves the network.
