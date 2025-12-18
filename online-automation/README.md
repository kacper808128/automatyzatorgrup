# Facebook Group Automation - Online Version

**Automated multi-account Facebook group posting system with web dashboard, real-time monitoring, and VNC browser viewing.**

---

## 📋 Overview

This is the **online version** of the Facebook automation system, migrated from the Electron desktop app to a full-stack web application. It enables automated posting to Facebook groups using multiple accounts with advanced anti-ban features, cookie management, and real-time monitoring.

### Key Features

✅ **Multi-Account Posting** - Up to 5 concurrent accounts with reserve system
✅ **Anti-Ban Protection** - Fingerprint spoofing, human behavior simulation, activity limits
✅ **Cookie Management** - Offline + online validation, auto-refresh, encrypted storage
✅ **Real-time Dashboard** - React UI with WebSocket live updates
✅ **VNC Browser Viewing** - Remote browser viewing via Xvfb + x11vnc
✅ **Queue System** - Bull + Redis for reliable job processing
✅ **n8n Integration** - CSV webhook input, log reporting endpoint
✅ **Manual Login Recovery** - Browser waits for manual login, auto-saves cookies
✅ **Facebook Ban Detection** - Automatic spam/restriction detection

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         n8n Workflow                         │
│  (sends CSV posts → receives logs after completion)          │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
         POST /api/webhooks/n8n
                   │
┌──────────────────┴──────────────────────────────────────────┐
│                     Express API Server                        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Routes:                                               │  │
│  │  • /api/webhooks     - n8n integration                │  │
│  │  • /api/posts        - posting control                │  │
│  │  • /api/accounts     - account management             │  │
│  │  • /api/sessions     - session history                │  │
│  │  • /api/logs         - log retrieval                  │  │
│  │  • /api/vnc          - VNC management                 │  │
│  │  • /api/dashboard    - stats & overview               │  │
│  └────────────────────────────────────────────────────────┘  │
└────────────┬──────────────────┬─────────────────┬───────────┘
             │                  │                 │
             ▼                  ▼                 ▼
      ┌─────────────┐   ┌─────────────┐   ┌──────────┐
      │   MongoDB   │   │    Redis    │   │ Socket.io│
      │  (storage)  │   │  (queues)   │   │  (live)  │
      └─────────────┘   └──────┬──────┘   └────┬─────┘
                               │                │
                               ▼                ▼
                    ┌─────────────────────────────────┐
                    │   Bull Queue Processor          │
                    │   (posting.worker.js)           │
                    └──────────┬──────────────────────┘
                               │
                               ▼
                    ┌─────────────────────────────────┐
                    │   Automation Service            │
                    │   • Cookie validation           │
                    │   • Multi-account orchestration │
                    │   • Playwright browser control  │
                    │   • Anti-ban features           │
                    │   • VNC display management      │
                    └─────────────────────────────────┘
```

### Tech Stack

**Backend:**
- Node.js + Express
- Bull + Redis (job queues)
- MongoDB (data persistence)
- Socket.io (real-time updates)
- Playwright (browser automation)
- Xvfb + x11vnc (VNC)

**Frontend:**
- React 18
- Vite
- TailwindCSS
- Socket.io-client
- React Router
- Axios

---

## 🚀 Installation

### Prerequisites

- Node.js 18+
- Docker & Docker Compose (recommended)
- MongoDB 6+
- Redis 7+
- Chromium/Chrome browser
- Xvfb, x11vnc (for VNC)

### Quick Start with Docker

```bash
# 1. Clone repository
git clone <repo-url>
cd online-automation

# 2. Copy and configure environment
cp .env.example .env
nano .env  # Edit MongoDB URI, Redis URL, encryption keys, etc.

# 3. Start services with Docker Compose
docker-compose up -d

# 4. Check logs
docker-compose logs -f app

# 5. Access Dashboard
open http://localhost:3000
```

### Manual Installation

```bash
# 1. Install server dependencies
cd server
npm install

# 2. Install dashboard dependencies
cd ../dashboard
npm install

# 3. Setup MongoDB
mongod --dbpath /data/db

# 4. Setup Redis
redis-server

# 5. Start server
cd ../server
npm run dev

# 6. Start dashboard (in another terminal)
cd ../dashboard
npm run dev
```

---

## ⚙️ Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Server
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database
MONGODB_URI=mongodb://localhost:27017/fb-automation
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your-jwt-secret-here
ENCRYPTION_KEY=your-encryption-key-here
API_TOKEN=your-api-token-for-n8n

# Automation
MAX_CONCURRENT_ACCOUNTS=5
MAX_POSTS_PER_ACCOUNT=10
HEADLESS=true

# VNC
VNC_ENABLED=true
VNC_BASE_DISPLAY=99
VNC_BASE_PORT=5900
NOVNC_PORT=6080

# Logging
LOG_LEVEL=info
LOG_ENDPOINT_URL=https://your-n8n-webhook-url
```

---

## 📖 Usage

### 1. Add Accounts

**Via Dashboard:**
1. Navigate to **Accounts** page
2. Click **Add Account**
3. Enter account details and paste cookies JSON

**Via API:**
```bash
POST /api/accounts
{
  "id": "account1",
  "name": "John Doe",
  "email": "john@example.com",
  "cookiesEncrypted": "..." # AES-256 encrypted cookies JSON
}
```

### 2. Start Automation

**Via Dashboard:**
1. Navigate to **Start Automation**
2. Select accounts
3. Paste CSV posts:
   ```
   https://facebook.com/groups/123, Hello World!, Group 1
   https://facebook.com/groups/456, Test post, Group 2
   ```
4. Click **Start Automation**

**Via n8n Webhook:**
```bash
POST /api/webhooks/n8n
Authorization: Bearer YOUR_API_TOKEN
{
  "posts": [
    {
      "groupLink": "https://facebook.com/groups/123",
      "postCopy": "Hello World!",
      "groupName": "Group 1"
    }
  ],
  "sessionId": "session123"
}
```

### 3. Monitor Progress

**Real-time Logs:**
- Dashboard → **Logs** page
- WebSocket connection shows live logs

**Session Status:**
- Dashboard → **Sessions** page
- View stats: successful posts, failed posts, duration

**VNC Browser View:**
```bash
POST /api/vnc/:accountId/enable
# Returns VNC URL: vnc://localhost:5900
# Or web URL: http://localhost:6080/vnc.html
```

---

## 🔌 API Reference

### Webhooks

#### **POST** `/api/webhooks/n8n`
Receive posts from n8n workflow
```javascript
Headers: { Authorization: 'Bearer YOUR_API_TOKEN' }
Body: {
  posts: [{ groupLink, postCopy, groupName }],
  sessionId: 'optional-session-id'
}
Response: { sessionId, jobIds }
```

### Posting

#### **POST** `/api/posts/start`
Start automation manually
```javascript
Body: {
  posts: [{ groupLink, postCopy, groupName }],
  accountIds: ['account1', 'account2'],
  validateCookiesOnline: false
}
Response: { sessionId, message }
```

#### **GET** `/api/posts/status`
Get current automation status

### Accounts

#### **GET** `/api/accounts`
List all accounts

#### **POST** `/api/accounts`
Create new account

#### **PUT** `/api/accounts/:id/cookies`
Update account cookies

#### **DELETE** `/api/accounts/:id`
Delete account

### VNC

#### **POST** `/api/vnc/:accountId/enable`
Enable VNC for account

#### **POST** `/api/vnc/:accountId/disable`
Disable VNC

#### **GET** `/api/vnc/:accountId/status`
Get VNC status

---

## 🛡️ Anti-Ban Features

### 1. Cookie Management
- **Offline validation** - Check cookie structure & expiry
- **Online validation** - Test session with Facebook
- **Auto-refresh** - Update cookies after each session
- **Encrypted storage** - AES-256 encryption in MongoDB

### 2. Fingerprint Spoofing
- **100+ real User Agents** (2024-2025)
- **WebGL vendor/renderer** - 50+ real GPU configs
- **Canvas noise injection**
- **Audio fingerprint** spoofing
- **Chrome.runtime** spoofing (critical for FB 2025)

### 3. Human Behavior
- **Bezier curve mouse** - Natural movement
- **Human typing** - 120-380ms delays, random typos
- **Smooth scrolling** - Gaussian distribution
- **Random errors** - Occasional "mistakes"

### 4. Activity Limits
- **Daily limits** - Max 12 posts/day, 40 actions/day
- **Warming mode** - 7-14 days, no posts allowed
- **Gaussian delays** - 4-18 min between groups
- **Auto-pause** - When >2 accounts banned in 1 hour

### 5. Reserve System
- **Max 5 concurrent** accounts active
- **Auto-activation** - Reserve accounts take over on failure
- **Load balancing** - Distribute posts across accounts

---

## 📁 Project Structure

```
online-automation/
├── server/                      # Backend (Node.js + Express)
│   ├── config/                  # Configuration
│   │   ├── database.js          # MongoDB connection
│   │   └── redis.js             # Redis connection
│   ├── models/                  # Mongoose models
│   │   ├── Account.js           # Account schema
│   │   ├── Post.js              # Post schema
│   │   └── Session.js           # Session schema
│   ├── routes/                  # API routes (7 files)
│   ├── services/                # Business logic
│   │   ├── automation.service.js   # Core automation (1623 lines)
│   │   ├── queue.service.js        # Bull queue management
│   │   ├── websocket.service.js    # Socket.io service
│   │   └── vnc.service.js          # VNC management (198 lines)
│   ├── workers/                 # Queue processors
│   │   └── posting.worker.js    # Facebook posting worker
│   ├── utils/                   # Utilities (migrated from desktop)
│   │   ├── human-behavior.js    # Anti-ban behaviors (546 lines)
│   │   ├── fingerprint-manager.js  # Browser fingerprinting (577 lines)
│   │   ├── activity-limiter.js  # Activity limits (345 lines)
│   │   └── proxy-manager.js     # Proxy management (246 lines)
│   ├── middleware/              # Express middleware
│   ├── server.js                # Entry point
│   └── package.json
│
├── dashboard/                   # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/          # Layout component
│   │   ├── pages/               # 6 pages (Dashboard, Accounts, Sessions, etc.)
│   │   ├── App.jsx              # Router setup
│   │   └── main.jsx             # Entry point
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── storage/                     # Runtime storage
│   ├── cookies/                 # Saved cookies & storage states
│   ├── screenshots/             # Error screenshots
│   ├── videos/                  # Session recordings (future)
│   └── logs/                    # Log files
│
├── docker-compose.yml           # Docker Compose setup
├── Dockerfile                   # Docker image
├── .env.example                 # Environment template
├── IT-REQUIREMENTS.md           # IT setup guide
└── README.md                    # This file
```

---

## 🐛 Troubleshooting

### MongoDB Connection Failed
```bash
# Check MongoDB is running
sudo systemctl status mongodb
```

### Redis Connection Failed
```bash
# Check Redis is running
redis-cli ping  # Should return: PONG
```

### Chromium Not Found
```bash
# Install Chromium
sudo apt-get install chromium-browser
```

### VNC Not Working
```bash
# Install Xvfb and x11vnc
sudo apt-get install xvfb x11vnc
```

### Cookies Invalid
- Ensure cookies are fresh (<7 days old)
- Use online validation: `validateCookiesOnline: true`
- Check cookie format (must have c_user, xs, datr)

---

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3000/health
```

### WebSocket Connection
```javascript
import { io } from 'socket.io-client';
const socket = io('http://localhost:3000');

socket.on('log', (log) => {
  console.log(`[${log.timestamp}] ${log.message}`);
});
```

---

## 🔒 Security

### Cookie Encryption
All cookies are encrypted with AES-256 before storage:
```javascript
const encrypted = CryptoJS.AES.encrypt(cookiesJson, ENCRYPTION_KEY);
```

### API Authentication
- **JWT tokens** for dashboard access
- **API tokens** for n8n webhooks
- **Token verification** middleware on protected routes

### Proxy Support
- **Per-account proxy** assignment
- **Sticky sessions** (60 min)
- **Credentials** encrypted

---

## 📝 License

Proprietary - All rights reserved

---

## 🤝 Support

For issues, questions, or feature requests:
- Check `IT-REQUIREMENTS.md` for server setup
- Review logs: `docker-compose logs -f`
- Check health endpoint: `/health`

---

**Built with ❤️ for automated social media management**
