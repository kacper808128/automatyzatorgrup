const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  cookiesEncrypted: {
    type: String,  // Encrypted JSON
    required: true
  },
  proxy: {
    id: String,
    host: String,
    port: Number,
    username: String,
    password: String
  },
  stats: {
    postsToday: {
      type: Number,
      default: 0
    },
    postsTotal: {
      type: Number,
      default: 0
    },
    lastPostAt: Date,
    successRate: {
      type: Number,
      default: 100
    },
    totalErrors: {
      type: Number,
      default: 0
    }
  },
  cookiesValidation: {
    lastValidated: Date,
    isValid: {
      type: Boolean,
      default: false
    },
    lastRefreshed: Date,
    nextRefreshDue: Date
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'blocked', 'cookies_expired'],
    default: 'active'
  },
  isReserve: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Reset daily stats (run via cron)
accountSchema.methods.resetDailyStats = function() {
  this.stats.postsToday = 0;
  return this.save();
};

// Check if account can post
accountSchema.methods.canPost = function() {
  const maxPostsPerAccount = parseInt(process.env.MAX_POSTS_PER_ACCOUNT || '10');

  if (this.status !== 'active') {
    return false;
  }

  if (this.stats.postsToday >= maxPostsPerAccount) {
    return false;
  }

  if (!this.cookiesValidation.isValid) {
    return false;
  }

  return true;
};

// Update stats after post
accountSchema.methods.recordPost = function(success = true) {
  this.stats.postsToday += 1;
  this.stats.postsTotal += 1;
  this.stats.lastPostAt = new Date();

  if (!success) {
    this.stats.totalErrors += 1;
  }

  // Calculate success rate
  const totalAttempts = this.stats.postsTotal + this.stats.totalErrors;
  this.stats.successRate = (this.stats.postsTotal / totalAttempts) * 100;

  return this.save();
};

const Account = mongoose.model('Account', accountSchema);

module.exports = Account;
