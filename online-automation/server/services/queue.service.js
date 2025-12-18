/**
 * Queue Service - Bull + Redis
 *
 * Manages job queues for:
 * - Facebook posting
 * - Playground tasks
 * - Instagram checks
 * - Log reporting
 */

const Bull = require('bull');
const logger = require('../utils/logger');
const websocketService = require('./websocket.service');

class QueueService {
  constructor() {
    this.queues = {};
    this.redisConfig = {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined
      }
    };
  }

  /**
   * Initialize all queues
   */
  initialize() {
    // Facebook posting queue
    this.queues.facebookPost = new Bull('facebook-post', this.redisConfig);

    // Playground queue
    this.queues.playground = new Bull('playground', this.redisConfig);

    // Instagram checker queue
    this.queues.instagram = new Bull('instagram', this.redisConfig);

    // Log reporter queue
    this.queues.logReporter = new Bull('log-reporter', this.redisConfig);

    // Setup queue event handlers
    this.setupQueueEvents();

    logger.info('Queue service initialized');
  }

  /**
   * Setup event handlers for all queues
   */
  setupQueueEvents() {
    Object.entries(this.queues).forEach(([name, queue]) => {
      queue.on('active', (job) => {
        logger.info(`[Queue:${name}] Job ${job.id} started`, { jobData: job.data });
        websocketService.emitLog('info', `Job ${job.id} started in queue ${name}`);
      });

      queue.on('completed', (job, result) => {
        logger.info(`[Queue:${name}] Job ${job.id} completed`, { result });
        websocketService.emitLog('success', `Job ${job.id} completed`, { result });
      });

      queue.on('failed', (job, err) => {
        logger.error(`[Queue:${name}] Job ${job.id} failed`, { error: err.message });
        websocketService.emitLog('error', `Job ${job.id} failed: ${err.message}`);
      });

      queue.on('progress', (job, progress) => {
        logger.debug(`[Queue:${name}] Job ${job.id} progress: ${progress}%`);
        websocketService.emitProgress(job.data.sessionId, { progress, jobId: job.id });
      });

      queue.on('stalled', (job) => {
        logger.warn(`[Queue:${name}] Job ${job.id} stalled`);
      });
    });
  }

  /**
   * Add Facebook post to queue
   */
  async addPost(postData, options = {}) {
    const job = await this.queues.facebookPost.add(postData, {
      attempts: options.attempts || 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: false,
      removeOnFail: false,
      ...options
    });

    logger.info(`Post job added to queue`, { jobId: job.id, postData });
    return job;
  }

  /**
   * Add multiple posts to queue (bulk)
   */
  async addPostsBulk(posts, options = {}) {
    const jobs = await Promise.all(
      posts.map(post => this.addPost(post, options))
    );

    logger.info(`${jobs.length} posts added to queue`);
    return jobs;
  }

  /**
   * Add playground task to queue
   */
  async addPlaygroundTask(taskData, options = {}) {
    const job = await this.queues.playground.add(taskData, {
      attempts: options.attempts || 1, // Playground usually no retry
      timeout: options.timeout || 300000, // 5 minutes default
      removeOnComplete: false,
      ...options
    });

    logger.info(`Playground task added to queue`, { jobId: job.id });
    return job;
  }

  /**
   * Add Instagram check to queue
   */
  async addInstagramCheck(checkData, options = {}) {
    const job = await this.queues.instagram.add(checkData, {
      attempts: options.attempts || 2,
      timeout: options.timeout || 120000, // 2 minutes
      ...options
    });

    logger.info(`Instagram check added to queue`, { jobId: job.id });
    return job;
  }

  /**
   * Add log report task
   */
  async addLogReport(reportData, options = {}) {
    const job = await this.queues.logReporter.add(reportData, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      ...options
    });

    logger.info(`Log report task added to queue`, { jobId: job.id });
    return job;
  }

  /**
   * Get queue stats
   */
  async getQueueStats(queueName) {
    const queue = this.queues[queueName];
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount()
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed
    };
  }

  /**
   * Get all queues stats
   */
  async getAllQueuesStats() {
    const stats = {};

    for (const [name, queue] of Object.entries(this.queues)) {
      stats[name] = await this.getQueueStats(name);
    }

    return stats;
  }

  /**
   * Get job by ID
   */
  async getJob(queueName, jobId) {
    const queue = this.queues[queueName];
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    return await queue.getJob(jobId);
  }

  /**
   * Get jobs by status
   */
  async getJobs(queueName, status, start = 0, end = 10) {
    const queue = this.queues[queueName];
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const validStatuses = ['waiting', 'active', 'completed', 'failed', 'delayed'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    return await queue.getJobs([status], start, end);
  }

  /**
   * Pause queue
   */
  async pauseQueue(queueName) {
    const queue = this.queues[queueName];
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.pause();
    logger.info(`Queue ${queueName} paused`);
  }

  /**
   * Resume queue
   */
  async resumeQueue(queueName) {
    const queue = this.queues[queueName];
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.resume();
    logger.info(`Queue ${queueName} resumed`);
  }

  /**
   * Clean queue (remove old jobs)
   */
  async cleanQueue(queueName, grace = 86400000) {
    const queue = this.queues[queueName];
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    // Clean completed jobs older than grace period (default 24h)
    const completedRemoved = await queue.clean(grace, 'completed');
    const failedRemoved = await queue.clean(grace, 'failed');

    logger.info(`Queue ${queueName} cleaned`, {
      completedRemoved,
      failedRemoved
    });

    return { completedRemoved, failedRemoved };
  }

  /**
   * Retry failed job
   */
  async retryJob(queueName, jobId) {
    const job = await this.getJob(queueName, jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found in queue ${queueName}`);
    }

    await job.retry();
    logger.info(`Job ${jobId} retried in queue ${queueName}`);
  }

  /**
   * Remove job
   */
  async removeJob(queueName, jobId) {
    const job = await this.getJob(queueName, jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found in queue ${queueName}`);
    }

    await job.remove();
    logger.info(`Job ${jobId} removed from queue ${queueName}`);
  }

  /**
   * Empty queue (remove all jobs)
   */
  async emptyQueue(queueName) {
    const queue = this.queues[queueName];
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.empty();
    logger.warn(`Queue ${queueName} emptied`);
  }

  /**
   * Close all queues
   */
  async close() {
    for (const [name, queue] of Object.entries(this.queues)) {
      await queue.close();
      logger.info(`Queue ${name} closed`);
    }
  }
}

// Singleton instance
const queueService = new QueueService();

module.exports = queueService;
