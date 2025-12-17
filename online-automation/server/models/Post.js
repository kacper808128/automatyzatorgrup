const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  groupUrl: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  accountId: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  error: {
    message: String,
    stack: String,
    screenshot: String
  },
  attempts: {
    type: Number,
    default: 0
  },
  maxAttempts: {
    type: Number,
    default: 3
  },
  scheduledFor: Date,
  startedAt: Date,
  completedAt: Date,
  duration: Number, // milliseconds
}, {
  timestamps: true
});

// Indexes for queries
postSchema.index({ sessionId: 1, status: 1 });
postSchema.index({ accountId: 1, createdAt: -1 });
postSchema.index({ status: 1, scheduledFor: 1 });

// Mark as processing
postSchema.methods.markProcessing = function() {
  this.status = 'processing';
  this.startedAt = new Date();
  this.attempts += 1;
  return this.save();
};

// Mark as completed
postSchema.methods.markCompleted = function() {
  this.status = 'completed';
  this.completedAt = new Date();
  this.duration = this.completedAt - this.startedAt;
  return this.save();
};

// Mark as failed
postSchema.methods.markFailed = function(error) {
  this.status = 'failed';
  this.error = {
    message: error.message,
    stack: error.stack
  };
  this.completedAt = new Date();
  this.duration = this.completedAt - this.startedAt;
  return this.save();
};

// Check if can retry
postSchema.methods.canRetry = function() {
  return this.attempts < this.maxAttempts && this.status === 'failed';
};

const Post = mongoose.model('Post', postSchema);

module.exports = Post;
