# 🖥️ Wymagania Serwerowe - FB Automation Online

## 📋 QUICK CHECKLIST dla IT

```
☐ Serwer: 4 vCPU, 8 GB RAM, 50 GB SSD
☐ OS: Ubuntu 22.04 LTS
☐ Porty: 3000, 6379, 27017, 6080-6099, 5900-5999
☐ Sudo access dla użytkownika aplikacji
☐ Zainstalowane: Node.js 18+, Redis, MongoDB, Chromium, Xvfb, x11vnc
☐ Docker + Docker Compose (opcjonalne, ale zalecane)
☐ Reverse proxy: Nginx z SSL (opcjonalne)
```

---

## 1. SPECYFIKACJA SERWERA

### Minimalne wymagania (1-3 konta FB):
- **CPU**: 2 vCPU
- **RAM**: 4 GB
- **Storage**: 20 GB SSD
- **Network**: 100 Mbps

### **Rekomendowane (5-10 kont FB):**
- **CPU**: 4 vCPU
- **RAM**: 8 GB
- **Storage**: 50 GB SSD
- **Network**: 500 Mbps
- **Bandwidth**: Min 500 GB/miesiąc

### Enterprise (10+ kont):
- **CPU**: 8 vCPU
- **RAM**: 16 GB
- **Storage**: 100 GB SSD
- **Network**: 1 Gbps

---

## 2. SYSTEM OPERACYJNY

**Zalecany:** Ubuntu 22.04 LTS Server

**Alternatywy:**
- Ubuntu 20.04 LTS
- Debian 11/12
- CentOS 8 Stream (z drobnymi modyfikacjami)

**WAŻNE:**
- Pełny dostęp root/sudo
- Zaktualizowany system (`apt update && apt upgrade`)

---

## 3. PORTY DO OTWARCIA

### Wymagane (firewall):

```bash
# Aplikacja główna
3000/tcp    # Express API + Dashboard

# Bazy danych (tylko localhost, NIE external!)
6379/tcp    # Redis (localhost only)
27017/tcp   # MongoDB (localhost only)

# VNC (opcjonalnie external, zalecane tylko VPN)
5900-5999/tcp   # x11vnc servers (per browser session)
6080-6099/tcp   # noVNC WebSocket proxy (web VNC client)

# Optional - dla reverse proxy
80/tcp      # HTTP (redirect to HTTPS)
443/tcp     # HTTPS
```

### Konfiguracja UFW (Ubuntu Firewall):

```bash
# Podstawowa konfiguracja
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw allow 3000/tcp    # API (lub tylko przez nginx)

# VNC tylko z określonych IP (zalecane)
sudo ufw allow from TWOJE_IP to any port 5900:5999 proto tcp
sudo ufw allow from TWOJE_IP to any port 6080:6099 proto tcp

# Blokuj external access do baz danych
sudo ufw deny 6379/tcp     # Redis
sudo ufw deny 27017/tcp    # MongoDB

sudo ufw enable
```

---

## 4. SYSTEM PACKAGES

### Metoda 1: Instalacja manualna

```bash
# Aktualizacja systemu
sudo apt update && sudo apt upgrade -y

# Node.js 18.x LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version    # Should be v18.x.x
npm --version     # Should be v9.x.x

# Redis
sudo apt install -y redis-server

# MongoDB (Community Edition 6.0)
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
sudo apt install -y mongodb-org

# Chromium + dependencies (dla Playwright)
sudo apt install -y \
  chromium-browser \
  xvfb \
  x11vnc \
  fluxbox \
  websockify \
  fonts-liberation \
  fonts-noto-color-emoji \
  libnss3 \
  libxss1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libatspi2.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libpango-1.0-0 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2

# noVNC (web-based VNC client)
sudo apt install -y novnc

# Optional: PM2 (process manager)
sudo npm install -g pm2

# Optional: Nginx (reverse proxy)
sudo apt install -y nginx certbot python3-certbot-nginx

# Optional: Docker + Docker Compose
sudo apt install -y docker.io docker-compose
sudo systemctl enable docker
sudo systemctl start docker
```

### Metoda 2: Docker (zalecane)

Jeśli używamy Dockera, potrzebne tylko:

```bash
# Docker
sudo apt update
sudo apt install -y docker.io docker-compose

# Add user to docker group (bez sudo)
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker-compose --version
```

**UWAGA:** W Dockerze wszystkie dependencies (Node, Redis, MongoDB, Chromium) będą w kontenerze.

---

## 5. KONFIGURACJA SERWISÓW

### Redis

```bash
# Start i enable
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verify
redis-cli ping
# Response: PONG

# Security: Bind tylko do localhost
sudo nano /etc/redis/redis.conf
# Znajdź i ustaw:
bind 127.0.0.1 ::1

# Restart
sudo systemctl restart redis-server
```

### MongoDB

```bash
# Start i enable
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify
mongosh --eval 'db.runCommand({ connectionStatus: 1 })'

# Security: Create admin user
mongosh <<EOF
use admin
db.createUser({
  user: "admin",
  pwd: "STRONG_PASSWORD_HERE",
  roles: [ { role: "userAdminAnyDatabase", db: "admin" }, "readWriteAnyDatabase" ]
})
exit
EOF

# Enable authentication
sudo nano /etc/mongod.conf
# Dodaj:
security:
  authorization: enabled

# Bind tylko do localhost
net:
  bindIp: 127.0.0.1

# Restart
sudo systemctl restart mongod
```

### Nginx (Optional - Reverse Proxy)

```bash
# Podstawowa konfiguracja
sudo nano /etc/nginx/sites-available/fb-automation

# Wklej:
server {
    listen 80;
    server_name twoja-domena.pl;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name twoja-domena.pl;

    # SSL certificates (certbot automatycznie doda)
    # ssl_certificate /etc/letsencrypt/live/twoja-domena.pl/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/twoja-domena.pl/privkey.pem;

    # API proxy
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Dashboard
    location / {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket dla Socket.io
    location /socket.io/ {
        proxy_pass http://localhost:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }

    # VNC noVNC static files
    location /vnc/ {
        proxy_pass http://localhost:6080/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }

    # Static files (screenshots, videos)
    location /storage/ {
        alias /path/to/app/storage/;
        autoindex off;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Max upload size (dla CSV files)
    client_max_body_size 10M;
}

# Enable site
sudo ln -s /etc/nginx/sites-available/fb-automation /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# SSL certificate (Let's Encrypt)
sudo certbot --nginx -d twoja-domena.pl
```

---

## 6. USER & PERMISSIONS

### Tworzenie dedykowanego usera

```bash
# Create user
sudo adduser fbautomation
sudo usermod -aG sudo fbautomation  # jeśli potrzebuje sudo

# Optional: no password sudo (dla deployment scripts)
sudo visudo
# Dodaj na końcu:
fbautomation ALL=(ALL) NOPASSWD:ALL

# Switch to user
sudo su - fbautomation
```

### Uprawnienia do katalogów

```bash
# Application directory
sudo mkdir -p /var/www/fb-automation
sudo chown -R fbautomation:fbautomation /var/www/fb-automation

# Storage directory
sudo mkdir -p /var/www/fb-automation/storage/{cookies,screenshots,videos,logs}
sudo chmod -R 755 /var/www/fb-automation/storage

# Logs directory
sudo mkdir -p /var/log/fb-automation
sudo chown -R fbautomation:fbautomation /var/log/fb-automation
```

---

## 7. PLAYWRIGHT BROWSER SETUP

Po zainstalowaniu aplikacji (jako user `fbautomation`):

```bash
cd /var/www/fb-automation
npm install

# Install Playwright browsers
npx playwright install chromium

# Install system dependencies dla Playwright
npx playwright install-deps

# Verify
npx playwright --version
```

**UWAGA:** To trzeba zrobić PO wrzuceniu kodu aplikacji na serwer.

---

## 8. ENVIRONMENT VARIABLES

Przygotuj plik `.env` (przekażę go jako osobny plik):

```bash
# Lokalizacja
/var/www/fb-automation/.env

# Permissions
chmod 600 .env  # tylko owner może czytać
chown fbautomation:fbautomation .env
```

**Wartości które IT musi dostarczyć:**

1. **MongoDB connection string** (z hasłem admina)
2. **Redis URL** (jeśli ma hasło)
3. **JWT_SECRET** (generate: `openssl rand -base64 32`)
4. **Domain/IP serwera** (dla CORS)
5. **SSL certificates path** (jeśli używają Nginx)

---

## 9. NETWORK REQUIREMENTS

### Outbound (wychodzące):

```
✓ HTTPS (443) → facebook.com, instagram.com
✓ HTTPS (443) → generativelanguage.googleapis.com (Gemini API)
✓ HTTPS (443) → Twój n8n instance (webhooks)
✓ HTTP/HTTPS → Proxy servers (jeśli używasz proxy)
```

### Inbound (przychodzące):

```
✓ Port 3000 → API requests z n8n
✓ Port 443/80 → Dashboard access (przez Nginx)
✓ Port 6080-6099 → VNC web access (opcjonalnie tylko VPN)
```

### DNS (jeśli używasz domeny):

```
Typ A record:
automation.twoja-domena.pl → IP_SERWERA
```

---

## 10. MONITORING & LOGS

### System logs

```bash
# Application logs
/var/log/fb-automation/app.log
/var/log/fb-automation/error.log

# PM2 logs (jeśli używamy PM2)
~/.pm2/logs/

# Nginx logs
/var/log/nginx/access.log
/var/log/nginx/error.log

# MongoDB logs
/var/log/mongodb/mongod.log

# Redis logs
/var/log/redis/redis-server.log
```

### Logrotate (rotacja logów)

```bash
sudo nano /etc/logrotate.d/fb-automation

# Wklej:
/var/log/fb-automation/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 fbautomation fbautomation
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### Monitoring narzędzia (opcjonalne)

```bash
# htop - monitoring zasobów
sudo apt install htop

# netdata - dashboard monitoringu
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
# Dashboard: http://server-ip:19999

# Prometheus + Grafana (advanced)
# docker-compose z Prometheus, Grafana, Node Exporter
```

---

## 11. BACKUP STRATEGY

### Co należy backupować:

```bash
# 1. MongoDB database
mongodump --out=/backup/mongodb/$(date +%Y%m%d)

# 2. Redis data (opcjonalne, cache jest ephemeral)
redis-cli SAVE
cp /var/lib/redis/dump.rdb /backup/redis/

# 3. Application files
/var/www/fb-automation/

# 4. Storage (cookies, screenshots, logs)
/var/www/fb-automation/storage/

# 5. Environment variables
/var/www/fb-automation/.env

# 6. Nginx config
/etc/nginx/sites-available/fb-automation
```

### Automatyczny backup (cron):

```bash
crontab -e

# Daily backup at 3 AM
0 3 * * * /var/www/fb-automation/scripts/backup.sh
```

---

## 12. SECURITY CHECKLIST

```bash
☐ Firewall enabled (ufw)
☐ SSH key-based auth (disable password login)
☐ MongoDB authentication enabled
☐ Redis bind to localhost only
☐ Strong passwords/secrets
☐ SSL/TLS enabled (HTTPS)
☐ Regular system updates
☐ Fail2ban installed (optional)
☐ Application runs as non-root user
☐ File permissions correct (644 files, 755 dirs)
☐ .env file permissions 600
☐ Backup strategy in place
```

### Fail2ban (optional - ochrona przed brute force):

```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## 13. DEPLOYMENT CHECKLIST

### Pre-deployment:

```
☐ Serwer gotowy (wszystkie packages zainstalowane)
☐ Porty otwarte
☐ MongoDB + Redis działają
☐ User `fbautomation` utworzony
☐ Katalogi utworzone z odpowiednimi permissions
☐ .env file przygotowany
☐ (Optional) Nginx + SSL skonfigurowane
☐ (Optional) Domain wskazuje na serwer
```

### Deployment:

```bash
# 1. Sklonuj repo (lub wgraj kod)
cd /var/www/fb-automation
git clone <repo-url> .

# 2. Install dependencies
npm install
npx playwright install chromium
npx playwright install-deps

# 3. Setup .env
cp .env.example .env
nano .env  # Wypełnij wartości

# 4. Start services
# Opcja A: PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # auto-start on reboot

# Opcja B: Docker
docker-compose up -d

# 5. Verify
curl http://localhost:3000/health
# Should return: {"status":"ok"}

# 6. Check logs
pm2 logs
# lub
docker-compose logs -f
```

### Post-deployment:

```
☐ Aplikacja działa (health check OK)
☐ Dashboard dostępny (http://server-ip:3000)
☐ MongoDB connection OK
☐ Redis connection OK
☐ VNC test (open browser viewer)
☐ Webhook test (n8n → server)
☐ SSL certificate valid (jeśli Nginx)
☐ Logs flowing correctly
☐ Monitoring setup (optional)
```

---

## 14. TROUBLESHOOTING

### "Cannot connect to MongoDB"

```bash
# Check if running
sudo systemctl status mongod

# Check logs
sudo tail -f /var/log/mongodb/mongod.log

# Check connection
mongosh --host 127.0.0.1:27017
```

### "Cannot connect to Redis"

```bash
# Check if running
sudo systemctl status redis-server

# Test connection
redis-cli ping

# Check config
cat /etc/redis/redis.conf | grep bind
```

### "Playwright browser not found"

```bash
# Reinstall
npx playwright install chromium --with-deps

# Check path
which chromium
```

### "VNC not working"

```bash
# Check if Xvfb running
ps aux | grep Xvfb

# Check x11vnc
ps aux | grep x11vnc

# Test manually
Xvfb :99 -screen 0 1280x720x24 &
x11vnc -display :99 -forever -shared
```

### "Permission denied errors"

```bash
# Fix ownership
sudo chown -R fbautomation:fbautomation /var/www/fb-automation

# Fix permissions
chmod -R 755 /var/www/fb-automation
chmod 600 /var/www/fb-automation/.env
```

---

## 15. KONTAKT & SUPPORT

Po przygotowaniu serwera wg tej instrukcji, będę potrzebował:

1. **SSH access** (IP, port, user, klucz SSH)
2. **MongoDB credentials** (connection string)
3. **Redis URL** (jeśli ma hasło)
4. **Domain/IP** dla dashboardu
5. **SSL certificate details** (jeśli Nginx)

Następnie zrobię:
- Deploy aplikacji
- Konfigurację .env
- Initial testing
- Integrację z n8n

---

## 📞 QUICK REFERENCE

### Sprawdzanie statusu serwisów:

```bash
sudo systemctl status mongod
sudo systemctl status redis-server
sudo systemctl status nginx
pm2 status
docker-compose ps
```

### Restart aplikacji:

```bash
# PM2
pm2 restart all

# Docker
docker-compose restart

# Nginx
sudo systemctl restart nginx
```

### Checking logs:

```bash
pm2 logs
docker-compose logs -f
tail -f /var/log/fb-automation/app.log
```

### Resource usage:

```bash
htop
df -h                    # Disk usage
free -h                  # RAM usage
```

---

**Dokument przygotowany:** 2024-12-17
**Aplikacja:** FB Automation Online
**Tech Stack:** Node.js + Express + React + Playwright + VNC
