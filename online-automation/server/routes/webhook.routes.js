/**
 * Webhook Routes - n8n Integration
 *
 * Endpoints:
 * POST /api/webhooks/n8n - Receive CSV data from n8n
 */

const express = require('express');
const router = express.Router();
const { verifyApiToken } = require('../middleware/auth.middleware');
const queueService = require('../services/queue.service');
const websocketService = require('../services/websocket.service');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * POST /api/webhooks/n8n
 *
 * Receive posts from n8n webhook
 *
 * Body:
 * {
 *   "posts": [
 *     {
 *       "groupUrl": "https://facebook.com/groups/xxx",
 *       "message": "Post content",
 *       "accountId": "account1" // optional
 *     }
 *   ],
 *   "sessionId": "optional-session-id" // optional
 * }
 */
router.post('/n8n', verifyApiToken, async (req, res) => {
  try {
    const { posts, sessionId } = req.body;

    // Validation
    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'posts array is required and must not be empty'
      });
    }

    // Validate each post
    const invalidPosts = posts.filter(post => !post.groupUrl || !post.message);
    if (invalidPosts.length > 0) {
      return res.status(400).json({
        error: 'Invalid posts',
        message: 'Each post must have groupUrl and message',
        invalidPosts: invalidPosts.map((p, i) => posts.indexOf(p))
      });
    }

    // Generate session ID if not provided
    const finalSessionId = sessionId || `session_${Date.now()}_${uuidv4().substr(0, 8)}`;

    logger.info(`[Webhook] Received ${posts.length} posts from n8n`, {
      sessionId: finalSessionId,
      postCount: posts.length
    });

    // Add posts to queue
    const jobs = await queueService.addPostsBulk(
      posts.map(post => ({
        ...post,
        sessionId: finalSessionId,
        id: uuidv4(),
        createdAt: new Date().toISOString()
      }))
    );

    // Emit to websocket
    websocketService.emitLog('info', `Received ${posts.length} posts from n8n webhook`, {
      sessionId: finalSessionId,
      postCount: posts.length
    });

    // Response
    res.json({
      success: true,
      sessionId: finalSessionId,
      postsQueued: posts.length,
      jobs: jobs.map(job => ({
        id: job.id,
        postId: job.data.id
      }))
    });

  } catch (error) {
    logger.error('[Webhook] Error processing n8n webhook', { error: error.message });

    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/webhooks/test
 *
 * Test endpoint (no auth required in dev mode)
 */
router.post('/test', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      error: 'Test endpoint disabled in production'
    });
  }

  res.json({
    success: true,
    message: 'Webhook test endpoint',
    received: req.body,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
