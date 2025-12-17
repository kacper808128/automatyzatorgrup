/**
 * Posting Routes - Control automation
 *
 * Endpoints:
 * POST /api/posts/start - Start automation
 * POST /api/posts/stop - Stop automation
 * POST /api/posts/pause - Pause automation
 * POST /api/posts/resume - Resume automation
 * GET  /api/posts/status - Get automation status
 * GET  /api/posts - Get posts list
 * POST /api/posts - Add single post
 * DELETE /api/posts/:id - Delete post
 */

const express = require('express');
const router = express.Router();
const { verifyApiToken } = require('../middleware/auth.middleware');
const queueService = require('../services/queue.service');
const websocketService = require('../services/websocket.service');
const logger = require('../utils/logger');
const Post = require('../models/Post');
const Session = require('../models/Session');
const { v4: uuidv4 } = require('uuid');

// Automation state (in-memory for now, TODO: move to Redis)
let automationState = {
  isRunning: false,
  isPaused: false,
  currentSessionId: null,
  startedAt: null,
  pausedAt: null
};

/**
 * GET /api/posts/status
 * Get current automation status
 */
router.get('/status', async (req, res) => {
  try {
    const queueStats = await queueService.getQueueStats('facebookPost');

    const currentSession = automationState.currentSessionId
      ? await Session.findOne({ id: automationState.currentSessionId })
      : null;

    res.json({
      automation: {
        isRunning: automationState.isRunning,
        isPaused: automationState.isPaused,
        sessionId: automationState.currentSessionId,
        startedAt: automationState.startedAt,
        pausedAt: automationState.pausedAt
      },
      queue: queueStats,
      session: currentSession ? {
        id: currentSession.id,
        status: currentSession.status,
        stats: currentSession.stats,
        startTime: currentSession.startTime,
        duration: currentSession.duration
      } : null
    });
  } catch (error) {
    logger.error('[Posting] Error getting status', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/posts/start
 * Start automation processing
 */
router.post('/start', verifyApiToken, async (req, res) => {
  try {
    if (automationState.isRunning && !automationState.isPaused) {
      return res.status(400).json({
        error: 'Automation already running',
        sessionId: automationState.currentSessionId
      });
    }

    // Resume if paused
    if (automationState.isPaused) {
      automationState.isPaused = false;
      automationState.pausedAt = null;

      await queueService.resumeQueue('facebookPost');

      logger.info('[Posting] Automation resumed', {
        sessionId: automationState.currentSessionId
      });

      websocketService.emitStatus({
        isRunning: true,
        isPaused: false,
        sessionId: automationState.currentSessionId
      });

      return res.json({
        success: true,
        message: 'Automation resumed',
        sessionId: automationState.currentSessionId
      });
    }

    // Start new session
    const sessionId = req.body.sessionId || `session_${Date.now()}_${uuidv4().substr(0, 8)}`;

    const session = new Session({
      id: sessionId,
      status: 'running',
      startTime: new Date(),
      config: {
        maxConcurrentAccounts: parseInt(process.env.MAX_CONCURRENT_ACCOUNTS || '5'),
        maxPostsPerAccount: parseInt(process.env.MAX_POSTS_PER_ACCOUNT || '10'),
        delayMinMinutes: parseInt(process.env.DELAY_MIN_MINUTES || '4'),
        delayMaxMinutes: parseInt(process.env.DELAY_MAX_MINUTES || '18')
      }
    });

    await session.save();

    automationState = {
      isRunning: true,
      isPaused: false,
      currentSessionId: sessionId,
      startedAt: new Date().toISOString(),
      pausedAt: null
    };

    // Resume queue processing (will process existing jobs)
    await queueService.resumeQueue('facebookPost');

    logger.info('[Posting] Automation started', { sessionId });

    websocketService.emitStatus({
      isRunning: true,
      isPaused: false,
      sessionId
    });

    res.json({
      success: true,
      message: 'Automation started',
      sessionId,
      session: session.toObject()
    });

  } catch (error) {
    logger.error('[Posting] Error starting automation', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/posts/pause
 * Pause automation
 */
router.post('/pause', verifyApiToken, async (req, res) => {
  try {
    if (!automationState.isRunning) {
      return res.status(400).json({
        error: 'Automation not running'
      });
    }

    if (automationState.isPaused) {
      return res.status(400).json({
        error: 'Automation already paused'
      });
    }

    automationState.isPaused = true;
    automationState.pausedAt = new Date().toISOString();

    await queueService.pauseQueue('facebookPost');

    // Update session
    if (automationState.currentSessionId) {
      await Session.findOneAndUpdate(
        { id: automationState.currentSessionId },
        { status: 'paused' }
      );
    }

    logger.info('[Posting] Automation paused', {
      sessionId: automationState.currentSessionId
    });

    websocketService.emitStatus({
      isRunning: true,
      isPaused: true,
      sessionId: automationState.currentSessionId
    });

    res.json({
      success: true,
      message: 'Automation paused',
      sessionId: automationState.currentSessionId
    });

  } catch (error) {
    logger.error('[Posting] Error pausing automation', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/posts/stop
 * Stop automation completely
 */
router.post('/stop', verifyApiToken, async (req, res) => {
  try {
    const sessionId = automationState.currentSessionId;

    automationState = {
      isRunning: false,
      isPaused: false,
      currentSessionId: null,
      startedAt: null,
      pausedAt: null
    };

    // Pause queue (don't empty it)
    await queueService.pauseQueue('facebookPost');

    // Update session
    if (sessionId) {
      const session = await Session.findOne({ id: sessionId });
      if (session) {
        session.status = 'completed';
        session.endTime = new Date();
        session.duration = session.endTime - session.startTime;
        await session.save();
      }
    }

    logger.info('[Posting] Automation stopped', { sessionId });

    websocketService.emitStatus({
      isRunning: false,
      isPaused: false,
      sessionId: null
    });

    res.json({
      success: true,
      message: 'Automation stopped',
      sessionId
    });

  } catch (error) {
    logger.error('[Posting] Error stopping automation', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/posts
 * Get posts list
 */
router.get('/', async (req, res) => {
  try {
    const {
      status,
      sessionId,
      accountId,
      limit = 50,
      skip = 0
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (sessionId) filter.sessionId = sessionId;
    if (accountId) filter.accountId = accountId;

    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await Post.countDocuments(filter);

    res.json({
      posts,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });

  } catch (error) {
    logger.error('[Posting] Error getting posts', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/posts
 * Add single post manually
 */
router.post('/', verifyApiToken, async (req, res) => {
  try {
    const { groupUrl, message, accountId } = req.body;

    if (!groupUrl || !message) {
      return res.status(400).json({
        error: 'groupUrl and message are required'
      });
    }

    const postId = uuidv4();
    const sessionId = automationState.currentSessionId || `manual_${Date.now()}`;

    const job = await queueService.addPost({
      id: postId,
      groupUrl,
      message,
      accountId,
      sessionId,
      createdAt: new Date().toISOString()
    });

    logger.info('[Posting] Manual post added', { postId, jobId: job.id });

    res.json({
      success: true,
      postId,
      jobId: job.id
    });

  } catch (error) {
    logger.error('[Posting] Error adding post', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/posts/:id
 * Delete post (if not started)
 */
router.delete('/:id', verifyApiToken, async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findOne({ id });

    if (!post) {
      return res.status(404).json({
        error: 'Post not found'
      });
    }

    if (post.status !== 'pending') {
      return res.status(400).json({
        error: 'Cannot delete post that is already processing or completed'
      });
    }

    await Post.deleteOne({ id });

    logger.info('[Posting] Post deleted', { postId: id });

    res.json({
      success: true,
      message: 'Post deleted'
    });

  } catch (error) {
    logger.error('[Posting] Error deleting post', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
