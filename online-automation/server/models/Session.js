const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'paused', 'completed', 'failed'],
    default: 'pending'
  },
  startTime: Date,
  endTime: Date,
  duration: Number, // milliseconds
  stats: {
    totalPosts: {
      type: Number,
      default: 0
    },
    successful: {
      type: Number,
      default: 0
    },
    failed: {
      type: Number,
      default: 0
    },
    pending: {
      type: Number,
      default: 0
    }
  },
  accounts: [{
    accountId: String,
    posts: Number,
    successful: Number,
    failed: Number,
    errors: [String]
  }],
  config: {
    maxConcurrentAccounts: Number,
    maxPostsPerAccount: Number,
    delayMinMinutes: Number,
    delayMaxMinutes: Number
  },
  logs: [{
    timestamp: Date,
    level: String,
    message: String,
    data: mongoose.Schema.Types.Mixed
  }],
  logFilePath: String,
  webhookSent: {
    type: Boolean,
    default: false
  },
  webhookSentAt: Date
}, {
  timestamps: true
});

// Indexes
sessionSchema.index({ status: 1, createdAt: -1 });
sessionSchema.index({ 'stats.successful': -1 });

// Start session
sessionSchema.methods.start = function() {
  this.status = 'running';
  this.startTime = new Date();
  return this.save();
};

// Pause session
sessionSchema.methods.pause = function() {
  this.status = 'paused';
  return this.save();
};

// Resume session
sessionSchema.methods.resume = function() {
  this.status = 'running';
  return this.save();
};

// Complete session
sessionSchema.methods.complete = function() {
  this.status = 'completed';
  this.endTime = new Date();
  this.duration = this.endTime - this.startTime;
  return this.save();
};

// Update stats
sessionSchema.methods.updateStats = async function() {
  const Post = mongoose.model('Post');

  const results = await Post.aggregate([
    { $match: { sessionId: this.id } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  this.stats.totalPosts = 0;
  this.stats.successful = 0;
  this.stats.failed = 0;
  this.stats.pending = 0;

  results.forEach(r => {
    this.stats.totalPosts += r.count;

    switch (r._id) {
      case 'completed':
        this.stats.successful = r.count;
        break;
      case 'failed':
        this.stats.failed = r.count;
        break;
      case 'pending':
      case 'processing':
        this.stats.pending += r.count;
        break;
    }
  });

  return this.save();
};

// Add log entry
sessionSchema.methods.addLog = function(level, message, data = {}) {
  this.logs.push({
    timestamp: new Date(),
    level,
    message,
    data
  });

  // Keep only last 1000 logs in DB (rest w pliku)
  if (this.logs.length > 1000) {
    this.logs = this.logs.slice(-1000);
  }

  return this.save();
};

// Get summary for webhook
sessionSchema.methods.getSummary = function() {
  return {
    sessionId: this.id,
    status: this.status,
    startTime: this.startTime,
    endTime: this.endTime,
    duration: this.duration,
    stats: this.stats,
    accounts: this.accounts,
    webhookSent: this.webhookSent
  };
};

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
