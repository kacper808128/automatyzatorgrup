/**
 * VNC Routes - Browser viewing
 *
 * Endpoints:
 * POST /api/vnc/:accountId/enable - Enable VNC for account
 * POST /api/vnc/:accountId/disable - Disable VNC
 * GET  /api/vnc/:accountId/status - Get VNC status
 */

const express = require('express');
const router = express.Router();
const { verifyApiToken } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');
const vncService = require('../services/vnc.service');

/**
 * POST /api/vnc/:accountId/enable
 * Enable VNC for account (view browser)
 */
router.post('/:accountId/enable', verifyApiToken, async (req, res) => {
  try {
    const { accountId } = req.params;

    logger.info('[VNC] Enable requested for account', { accountId });

    const session = await vncService.startSession(accountId);

    res.json({
      success: true,
      message: 'VNC enabled successfully',
      accountId,
      session: {
        display: session.display,
        vncPort: session.vncPort,
        noVNCWebPort: session.noVNCWebPort,
        vncUrl: `vnc://localhost:${session.vncPort}`,
        webUrl: `http://localhost:${session.noVNCWebPort}/vnc.html`,
        startedAt: session.startedAt
      }
    });

  } catch (error) {
    logger.error('[VNC] Error enabling VNC', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/vnc/:accountId/disable
 * Disable VNC for account
 */
router.post('/:accountId/disable', verifyApiToken, async (req, res) => {
  try {
    const { accountId } = req.params;

    logger.info('[VNC] Disable requested for account', { accountId });

    await vncService.stopSession(accountId);

    res.json({
      success: true,
      message: 'VNC disabled',
      accountId
    });

  } catch (error) {
    logger.error('[VNC] Error disabling VNC', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/vnc/:accountId/status
 * Get VNC status for account
 */
router.get('/:accountId/status', async (req, res) => {
  try {
    const { accountId } = req.params;

    const session = vncService.getSession(accountId);

    res.json({
      accountId,
      active: !!session,
      session: session ? {
        display: session.display,
        vncPort: session.vncPort,
        noVNCWebPort: session.noVNCWebPort,
        vncUrl: `vnc://localhost:${session.vncPort}`,
        webUrl: `http://localhost:${session.noVNCWebPort}/vnc.html`,
        startedAt: session.startedAt
      } : null
    });

  } catch (error) {
    logger.error('[VNC] Error getting VNC status', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/vnc/sessions
 * Get all active VNC sessions
 */
router.get('/sessions', async (req, res) => {
  try {
    const sessions = vncService.getAllSessions();

    res.json({
      success: true,
      count: sessions.length,
      sessions
    });

  } catch (error) {
    logger.error('[VNC] Error getting VNC sessions', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
