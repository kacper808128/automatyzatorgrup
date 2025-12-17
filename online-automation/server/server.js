require('dotenv').config({ path: '../.env' });
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Import configurations
const { connectDB } = require('./config/database');
const { connectRedis } = require('./config/redis');
const logger = require('./utils/logger');
const websocketService = require('./services/websocket.service');

// Import routes
const webhookRoutes = require('./routes/webhook.routes');
const postingRoutes = require('./routes/posting.routes');
const vncRoutes = require('./routes/vnc.routes');
const logsRoutes = require('./routes/logs.routes');
const accountsRoutes = require('./routes/accounts.routes');
const playgroundRoutes = require('./routes/playground.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

// Initialize Express
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = socketIO(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    methods: ['GET', 'POST']
  }
});

// =====================
// MIDDLEWARE
// =====================

// Security
app.use(helmet({
  contentSecurityPolicy: false // Disable dla development
}));

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// =====================
// ROUTES
// =====================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV
  });
});

// API routes
app.use('/api/webhooks', webhookRoutes);
app.use('/api/posts', postingRoutes);
app.use('/api/vnc', vncRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/playground', playgroundRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Static files (screenshots, videos)
app.use('/storage', express.static(process.env.STORAGE_PATH || '../storage'));

// Serve dashboard (production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('../dashboard/dist'));
  app.get('*', (req, res) => {
    res.sendFile('index.html', { root: '../dashboard/dist' });
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Server error:', err);

  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// =====================
// INITIALIZE SERVICES
// =====================

async function startServer() {
  try {
    // Connect to databases
    logger.info('Connecting to MongoDB...');
    await connectDB();
    logger.info('✓ MongoDB connected');

    logger.info('Connecting to Redis...');
    await connectRedis();
    logger.info('✓ Redis connected');

    // Initialize WebSocket service
    logger.info('Initializing WebSocket...');
    websocketService.initialize(io);
    logger.info('✓ WebSocket initialized');

    // Start server
    const PORT = process.env.PORT || 3000;
    const HOST = process.env.HOST || '0.0.0.0';

    server.listen(PORT, HOST, () => {
      logger.info(`
╔═══════════════════════════════════════════╗
║   FB Automation Online - Server Started   ║
╠═══════════════════════════════════════════╣
║  Port: ${PORT.toString().padEnd(36)} ║
║  Host: ${HOST.padEnd(36)} ║
║  Env:  ${(process.env.NODE_ENV || 'development').padEnd(36)} ║
║  VNC:  ${(process.env.VNC_ENABLED === 'true' ? 'Enabled' : 'Disabled').padEnd(36)} ║
╚═══════════════════════════════════════════╝
      `);

      logger.info('🚀 Server is ready to accept requests');
      logger.info(`📊 Dashboard: http://${HOST}:${PORT}`);
      logger.info(`🔌 API: http://${HOST}:${PORT}/api`);
      logger.info(`💚 Health: http://${HOST}:${PORT}/health`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// =====================
// GRACEFUL SHUTDOWN
// =====================

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
  logger.info('Received shutdown signal, closing server gracefully...');

  server.close(() => {
    logger.info('HTTP server closed');

    // Close database connections
    // TODO: Add cleanup logic

    logger.info('Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

// Start the server
startServer();

module.exports = { app, server, io };
