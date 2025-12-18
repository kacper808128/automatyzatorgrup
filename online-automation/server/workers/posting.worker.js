/**
 * Posting Worker - Bull queue processor for Facebook posting
 *
 * This worker processes jobs from the 'facebookPost' queue
 * and executes the automation using AutomationService.
 */

const queueService = require('../services/queue.service');
const automationService = require('../services/automation.service');
const websocketService = require('../services/websocket.service');
const Account = require('../models/Account');
const Post = require('../models/Post');
const Session = require('../models/Session');
const logger = require('../utils/logger');

/**
 * Process Facebook posting job
 */
async function processFacebookPostJob(job) {
  const { sessionId, posts, accountIds, validateCookiesOnline } = job.data;

  logger.info(`[Posting Worker] Processing job ${job.id}`, {
    sessionId,
    postsCount: posts.length,
    accountsCount: accountIds.length
  });

  try {
    // Update session status
    const session = await Session.findOne({ id: sessionId });
    if (session) {
      session.status = 'running';
      await session.save();
    }

    // Fetch accounts from database
    const accounts = await Account.find({ id: { $in: accountIds } });

    if (accounts.length === 0) {
      throw new Error('No accounts found');
    }

    logger.info(`[Posting Worker] Found ${accounts.length} accounts`, { sessionId });

    // Report progress
    job.progress(10);

    // Start multi-account posting
    const result = await automationService.startPostingMultiAccount({
      posts,
      accounts,
      validateCookiesOnline: validateCookiesOnline || false,
      sessionId
    });

    // Report progress
    job.progress(90);

    // Update session with results
    if (session) {
      session.status = result.stoppedByUser ? 'stopped' : 'completed';
      session.endTime = new Date();
      session.duration = session.endTime - session.startTime;
      session.stats = {
        total: result.totalSuccessfulPosts + result.totalFailedPosts,
        successful: result.totalSuccessfulPosts,
        failed: result.totalFailedPosts,
        accounts: {
          total: result.totalAccounts,
          successful: result.successfulAccounts,
          failed: result.failedAccounts
        }
      };
      await session.save();
    }

    // Update posts in database
    for (const accountStats of result.accountsStats) {
      // Mark successful posts
      for (const post of accountStats.successfulPosts) {
        await Post.findOneAndUpdate(
          { groupLink: post.groupLink, sessionId },
          {
            status: 'completed',
            accountId: accountStats.accountId,
            completedAt: new Date()
          }
        );
      }

      // Mark failed posts
      for (const post of accountStats.failedPosts) {
        await Post.findOneAndUpdate(
          { groupLink: post.groupLink, sessionId },
          {
            status: 'failed',
            accountId: accountStats.accountId,
            failedAt: new Date(),
            error: post.error
          }
        );
      }
    }

    // Report completion
    job.progress(100);

    websocketService.emitStatus({
      sessionId,
      status: result.stoppedByUser ? 'stopped' : 'completed',
      stats: session ? session.stats : null
    });

    logger.info(`[Posting Worker] Job ${job.id} completed`, {
      sessionId,
      success: result.success,
      successfulPosts: result.totalSuccessfulPosts,
      failedPosts: result.totalFailedPosts
    });

    return {
      success: true,
      result
    };

  } catch (error) {
    logger.error(`[Posting Worker] Job ${job.id} failed`, {
      sessionId,
      error: error.message,
      stack: error.stack
    });

    // Update session status
    const session = await Session.findOne({ id: sessionId });
    if (session) {
      session.status = 'failed';
      session.endTime = new Date();
      session.duration = session.endTime - session.startTime;
      await session.save();
    }

    websocketService.emitStatus({
      sessionId,
      status: 'failed',
      error: error.message
    });

    throw error;
  }
}

/**
 * Initialize worker
 */
async function initializeWorker() {
  logger.info('[Posting Worker] Initializing...');

  // Get facebook post queue
  const queue = queueService.getQueue('facebookPost');

  if (!queue) {
    throw new Error('facebookPost queue not found');
  }

  // Process jobs
  queue.process(async (job) => {
    return await processFacebookPostJob(job);
  });

  // Event handlers
  queue.on('completed', (job, result) => {
    logger.info(`[Posting Worker] Job ${job.id} completed`, {
      sessionId: job.data.sessionId,
      success: result.success
    });
  });

  queue.on('failed', (job, err) => {
    logger.error(`[Posting Worker] Job ${job.id} failed`, {
      sessionId: job.data.sessionId,
      error: err.message
    });
  });

  queue.on('active', (job) => {
    logger.info(`[Posting Worker] Job ${job.id} started`, {
      sessionId: job.data.sessionId
    });
  });

  logger.info('[Posting Worker] Initialized successfully');
}

module.exports = {
  initializeWorker,
  processFacebookPostJob
};
