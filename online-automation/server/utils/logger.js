const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = process.env.LOGS_DIR || path.join(__dirname, '../../storage/logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `[${timestamp}] ${level.toUpperCase()}: ${message}`;

    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }

    return log;
  })
);

// Create logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      )
    }),

    // File output - all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),

    // File output - errors only
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    })
  ],

  // Handle exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log')
    })
  ],

  // Handle rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log')
    })
  ]
});

// Session logger class (dla specific session)
class SessionLogger {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.logs = [];
    this.filePath = path.join(logsDir, `session-${sessionId}.log`);

    // Create file
    fs.writeFileSync(this.filePath, `Session started: ${new Date().toISOString()}\n`);
  }

  log(level, message, data = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };

    this.logs.push(entry);

    // Write to file
    const logLine = `[${entry.timestamp}] ${level.toUpperCase()}: ${message} ${JSON.stringify(data)}\n`;
    fs.appendFileSync(this.filePath, logLine);

    // Also log to main logger
    logger.log(level, `[${this.sessionId}] ${message}`, data);

    return entry;
  }

  info(message, data) {
    return this.log('info', message, data);
  }

  warn(message, data) {
    return this.log('warn', message, data);
  }

  error(message, data) {
    return this.log('error', message, data);
  }

  debug(message, data) {
    return this.log('debug', message, data);
  }

  success(message, data) {
    return this.log('info', `✓ ${message}`, data);
  }

  getLogs() {
    return this.logs;
  }

  getFilePath() {
    return this.filePath;
  }

  getSummary() {
    return {
      sessionId: this.sessionId,
      startTime: this.logs[0]?.timestamp,
      endTime: this.logs[this.logs.length - 1]?.timestamp,
      totalLogs: this.logs.length,
      errors: this.logs.filter(l => l.level === 'error').length,
      warnings: this.logs.filter(l => l.level === 'warn').length,
      logs: this.logs
    };
  }
}

module.exports = logger;
module.exports.SessionLogger = SessionLogger;
