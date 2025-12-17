FROM node:18-bullseye

# Install system dependencies for Chromium + VNC
RUN apt-get update && apt-get install -y \
    # Chromium browser
    chromium \
    chromium-driver \
    # VNC & Display
    xvfb \
    x11vnc \
    fluxbox \
    websockify \
    novnc \
    # Fonts
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-noto-cjk \
    # Chromium dependencies
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
    libxrandr2 \
    libgconf-2-4 \
    # Utils
    procps \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install Node dependencies
RUN npm install
RUN cd server && npm install

# Install Playwright & browsers
RUN npx playwright install chromium
RUN npx playwright install-deps

# Copy application code
COPY . .

# Create storage directories
RUN mkdir -p storage/cookies storage/screenshots storage/videos storage/logs

# Set permissions
RUN chmod -R 755 storage

# Expose ports
EXPOSE 3000
EXPOSE 5900-5999
EXPOSE 6080-6099

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application with Xvfb wrapper
CMD ["sh", "-c", "Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset & export DISPLAY=:99 && node server/server.js"]
