# 🤖 Facebook Automation Online

Wersja online automatyzacji grup Facebook z web dashboardem i VNC support.

## 🚀 Quick Start

### Wymagania

Zobacz: [IT-REQUIREMENTS.md](../IT-REQUIREMENTS.md)

### Instalacja

```bash
# 1. Sklonuj repo
git clone <repo-url>
cd online-automation

# 2. Install wszystkich dependencies
npm run install:all

# 3. Konfiguracja
cp .env.example .env
nano .env  # Wypełnij wymagane wartości

# 4. Start z Docker
npm run docker:up

# LUB bez Dockera
npm run dev
```

### Dostęp

- **API**: http://localhost:3000/api
- **Dashboard**: http://localhost:3000
- **Health**: http://localhost:3000/health

## 📁 Struktura Projektu

```
online-automation/
├── server/              # Backend (Express + Socket.io)
│   ├── routes/          # API endpoints
│   ├── services/        # Business logic
│   ├── utils/           # Utilities (z migracji)
│   ├── middleware/      # Express middleware
│   ├── config/          # Configuration
│   └── models/          # Database models
├── dashboard/           # Frontend (React + Vite)
│   └── src/
│       ├── components/  # React components
│       ├── pages/       # Pages
│       └── services/    # API client, Socket.io
├── storage/             # Runtime data
│   ├── cookies/         # Account cookies
│   ├── screenshots/     # Error screenshots
│   ├── videos/          # Session recordings
│   └── logs/            # Session logs
└── scripts/             # Deployment, backup
```

## 🔌 API Endpoints

### Webhook (n8n integration)

```bash
POST /api/webhooks/n8n
Authorization: Bearer YOUR_API_TOKEN
Content-Type: application/json

{
  "posts": [
    {
      "groupUrl": "https://facebook.com/groups/xxx",
      "message": "Your post content",
      "accountId": "account1"  // optional
    }
  ]
}
```

### Control

```bash
# Start automation
POST /api/start

# Stop automation
POST /api/stop

# Get status
GET /api/status
```

### VNC

```bash
# Enable VNC for account
POST /api/vnc/:accountId/enable

# Disable VNC
POST /api/vnc/:accountId/disable

# Get VNC status
GET /api/vnc/:accountId/status
```

### Logs

```bash
# Get logs
GET /api/logs?sessionId=xxx&limit=100

# Send logs to webhook
POST /api/logs/send
```

## 🎮 Dashboard Features

- ✅ Real-time status monitoring
- ✅ Live logs streaming (WebSocket)
- ✅ Account management (CRUD)
- ✅ VNC browser viewer (on-demand)
- ✅ Screenshot gallery
- ✅ Session history
- ✅ Playground UI (AI automation)
- ✅ Statistics & charts

## 🖥️ VNC Access

### Enable VNC dla konta:

```bash
curl -X POST http://localhost:3000/api/vnc/account1/enable
```

Response:
```json
{
  "success": true,
  "session": {
    "accountId": "account1",
    "display": 99,
    "vncUrl": "vnc://localhost:5999",
    "webUrl": "/vnc?display=99",
    "wsPort": 6179
  }
}
```

### Dostęp przez przeglądarkę:

```
http://localhost:6179/vnc.html
```

Lub przez dashboard: kliknij "View Browser" przy koncie.

## 🐳 Docker

### Start wszystkiego:

```bash
docker-compose up -d
```

### Sprawdź status:

```bash
docker-compose ps
```

### Logi:

```bash
docker-compose logs -f
```

### Stop:

```bash
docker-compose down
```

## 🔧 Konfiguracja

Wszystkie ustawienia w `.env`:

- `MAX_CONCURRENT_ACCOUNTS` - ile kont równolegle (domyślnie 5)
- `MAX_POSTS_PER_ACCOUNT` - limit postów na konto (domyślnie 10)
- `DELAY_MIN_MINUTES` / `DELAY_MAX_MINUTES` - opóźnienia między postami (4-18 min)
- `HEADLESS_MODE` - tryb headless (true/false)
- `VNC_ENABLED` - włącz VNC support (true/false)

## 📊 Monitoring

### PM2 (production):

```bash
pm2 start ecosystem.config.js
pm2 status
pm2 logs
pm2 monit
```

### Logs:

```bash
tail -f storage/logs/app.log
```

## 🔐 Security

- Wszystkie endpointy wymagają autentykacji (Bearer token)
- MongoDB i Redis tylko localhost
- Cookies zaszyfrowane (AES-256-GCM)
- SSL/TLS przez Nginx (recommended)
- Firewall rules (zobacz IT-REQUIREMENTS.md)

## 🛠️ Development

### Backend dev:

```bash
cd server
npm run dev  # nodemon auto-reload
```

### Dashboard dev:

```bash
cd dashboard
npm run dev  # Vite hot reload
```

### Both parallel:

```bash
npm run dev  # concurrently
```

## 📝 License

MIT
