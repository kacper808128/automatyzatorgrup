/**
 * Dashboard Routes - Stats & overview
 *
 * Endpoints:
 * GET /api/dashboard/stats - Get overall stats
 * GET /api/dashboard/overview - Get dashboard overview
 */

const express = require('express');
const router = express.Router();
const Account = require('../models/Account');
const Post = require('../models/Post');
const Session = require('../models/Session');
const queueService = require('../services/queue.service');
const logger = require('../utils/logger');

/**
 * GET /api/dashboard/stats
 * Get overall statistics
 */
router.get('/stats', async (req, res) => {
  try {
    // Get counts
    const [
      totalAccounts,
      activeAccounts,
      totalPosts,
      completedPosts,
      failedPosts,
      totalSessions,
      queueStats
    ] = await Promise.all([
      Account.countDocuments(),
      Account.countDocuments({ status: 'active' }),
      Post.countDocuments(),
      Post.countDocuments({ status: 'completed' }),
      Post.countDocuments({ status: 'failed' }),
      Session.countDocuments(),
      queueService.getAllQueuesStats()
    ]);

    // Calculate success rate
    const successRate = totalPosts > 0
      ? ((completedPosts / totalPosts) * 100).toFixed(2)
      : 0;

    res.json({
      accounts: {
        total: totalAccounts,
        active: activeAccounts,
        inactive: totalAccounts - activeAccounts
      },
      posts: {
        total: totalPosts,
        completed: completedPosts,
        failed: failedPosts,
        pending: totalPosts - completedPosts - failedPosts,
        successRate: parseFloat(successRate)
      },
      sessions: {
        total: totalSessions
      },
      queues: queueStats
    });

  } catch (error) {
    logger.error('[Dashboard] Error getting stats', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard/overview
 * Get dashboard overview with recent activity
 */
router.get('/overview', async (req, res) => {
  try {
    // Get recent activity
    const [
      recentPosts,
      recentSessions,
      accounts,
      queueStats
    ] = await Promise.all([
      Post.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select('id groupUrl status accountId createdAt completedAt'),
      Session.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('id status startTime endTime stats'),
      Account.find()
        .select('id name email status stats cookiesValidation'),
      queueService.getAllQueuesStats()
    ]);

    res.json({
      recentPosts: recentPosts.map(p => ({
        id: p.id,
        groupUrl: p.groupUrl,
        status: p.status,
        accountId: p.accountId,
        createdAt: p.createdAt,
        completedAt: p.completedAt
      })),
      recentSessions: recentSessions.map(s => ({
        id: s.id,
        status: s.status,
        startTime: s.startTime,
        endTime: s.endTime,
        stats: s.stats
      })),
      accounts: accounts.map(a => ({
        id: a.id,
        name: a.name,
        email: a.email,
        status: a.status,
        stats: a.stats,
        cookiesValid: a.cookiesValidation?.isValid || false,
        cookiesNextRefresh: a.cookiesValidation?.nextRefreshDue
      })),
      queues: queueStats
    });

  } catch (error) {
    logger.error('[Dashboard] Error getting overview', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard/charts/posts-per-day
 * Get posts per day for charts (last 30 days)
 */
router.get('/charts/posts-per-day', async (req, res) => {
  try {
    const days = parseInt(req.query.days || '30');

    // Aggregate posts by day
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const postsPerDay = await Post.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json({
      data: postsPerDay.map(item => ({
        date: item._id,
        total: item.total,
        completed: item.completed,
        failed: item.failed,
        successRate: item.total > 0
          ? ((item.completed / item.total) * 100).toFixed(2)
          : 0
      }))
    });

  } catch (error) {
    logger.error('[Dashboard] Error getting chart data', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
