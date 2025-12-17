/**
 * Playground Routes - AI-driven automation
 *
 * Endpoints:
 * POST /api/playground/run - Run playground task
 * GET  /api/playground/jobs - Get playground jobs
 * GET  /api/playground/jobs/:id - Get job status
 */

const express = require('express');
const router = express.Router();
const { verifyApiToken } = require('../middleware/auth.middleware');
const queueService = require('../services/queue.service');
const logger = require('../utils/logger');

/**
 * POST /api/playground/run
 * Run AI-driven automation task
 *
 * Body:
 * {
 *   "url": "https://instagram.com/...",
 *   "instructions": "Click profile, read followers",
 *   "cookies": {...}, // optional
 *   "accountId": "account1", // optional
 *   "showBrowser": false // optional, VNC
 * }
 */
router.post('/run', verifyApiToken, async (req, res) => {
  try {
    const { url, instructions, cookies, accountId, showBrowser } = req.body;

    // Validation
    if (!url || !instructions) {
      return res.status(400).json({
        error: 'url and instructions are required'
      });
    }

    // Add to playground queue
    const job = await queueService.addPlaygroundTask({
      url,
      instructions,
      cookies: cookies || null,
      accountId: accountId || null,
      showBrowser: showBrowser || false,
      createdAt: new Date().toISOString()
    });

    logger.info('[Playground] Task added to queue', {
      jobId: job.id,
      url,
      accountId
    });

    res.json({
      success: true,
      jobId: job.id,
      message: 'Playground task queued',
      status: 'pending'
    });

  } catch (error) {
    logger.error('[Playground] Error running task', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/playground/jobs
 * Get playground jobs list
 */
router.get('/jobs', async (req, res) => {
  try {
    const { status = 'completed', limit = 10 } = req.query;

    const jobs = await queueService.getJobs('playground', status, 0, parseInt(limit));

    res.json({
      jobs: jobs.map(job => ({
        id: job.id,
        data: job.data,
        status: await job.getState(),
        progress: job.progress(),
        result: job.returnvalue,
        failedReason: job.failedReason,
        createdAt: job.timestamp,
        processedAt: job.processedOn,
        finishedAt: job.finishedOn
      })),
      total: jobs.length
    });

  } catch (error) {
    logger.error('[Playground] Error getting jobs', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/playground/jobs/:id
 * Get job status and result
 */
router.get('/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const job = await queueService.getJob('playground', id);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found'
      });
    }

    const state = await job.getState();

    res.json({
      job: {
        id: job.id,
        data: job.data,
        status: state,
        progress: job.progress(),
        result: job.returnvalue,
        failedReason: job.failedReason,
        stacktrace: job.stacktrace,
        createdAt: job.timestamp,
        processedAt: job.processedOn,
        finishedAt: job.finishedOn
      }
    });

  } catch (error) {
    logger.error('[Playground] Error getting job', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
