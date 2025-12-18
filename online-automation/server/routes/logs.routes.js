/**
 * Logs Routes
 *
 * Endpoints:
 * GET  /api/logs - Get logs
 * GET  /api/logs/:sessionId - Get session logs
 * POST /api/logs/send - Send logs to external endpoint
 */

const express = require('express');
const router = express.Router();
const { verifyApiToken } = require('../middleware/auth.middleware');
const Session = require('../models/Session');
const logger = require('../utils/logger');
const { SessionLogger } = require('../utils/logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * GET /api/logs
 * Get logs list
 */
router.get('/', async (req, res) => {
  try {
    const { sessionId, limit = 100 } = req.query;

    const filter = {};
    if (sessionId) filter.id = sessionId;

    const sessions = await Session.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('id startTime endTime status stats logs');

    res.json({
      sessions: sessions.map(s => ({
        id: s.id,
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status,
        stats: s.stats,
        logsCount: s.logs ? s.logs.length : 0
      })),
      total: sessions.length
    });

  } catch (error) {
    logger.error('[Logs] Error getting logs', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/logs/:sessionId
 * Get detailed logs for session
 */
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findOne({ id: sessionId });

    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    // Try to read from file if available
    const logFilePath = path.join(
      process.env.LOGS_DIR || '../storage/logs',
      `session-${sessionId}.log`
    );

    let fileLogs = [];
    if (fs.existsSync(logFilePath)) {
      const content = fs.readFileSync(logFilePath, 'utf-8');
      fileLogs = content
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return { message: line };
          }
        });
    }

    res.json({
      session: {
        id: session.id,
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
        stats: session.stats
      },
      logs: session.logs || [],
      fileLogs: fileLogs,
      logFilePath: session.logFilePath
    });

  } catch (error) {
    logger.error('[Logs] Error getting session logs', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/logs/send
 * Send logs to external endpoint (n8n webhook)
 */
router.post('/send', verifyApiToken, async (req, res) => {
  try {
    const { sessionId, endpoint } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: 'sessionId is required'
      });
    }

    const session = await Session.findOne({ id: sessionId });

    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    // Prepare report
    const report = {
      sessionId: session.id,
      status: session.status,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.duration,
      stats: session.stats,
      accounts: session.accounts,
      logs: session.logs,
      config: session.config
    };

    // Send to endpoint
    const targetEndpoint = endpoint || process.env.LOG_ENDPOINT_URL;

    if (!targetEndpoint) {
      return res.status(400).json({
        error: 'No endpoint specified and LOG_ENDPOINT_URL not set'
      });
    }

    const response = await axios.post(targetEndpoint, report, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    // Mark as sent
    session.webhookSent = true;
    session.webhookSentAt = new Date();
    await session.save();

    logger.info('[Logs] Logs sent to webhook', {
      sessionId,
      endpoint: targetEndpoint,
      status: response.status
    });

    res.json({
      success: true,
      message: 'Logs sent successfully',
      endpoint: targetEndpoint,
      responseStatus: response.status
    });

  } catch (error) {
    logger.error('[Logs] Error sending logs', { error: error.message });
    res.status(500).json({
      error: error.message,
      details: error.response?.data
    });
  }
});

module.exports = router;
