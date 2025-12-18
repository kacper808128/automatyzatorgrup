/**
 * WebSocket Service
 *
 * Real-time communication z dashboard przez Socket.io
 * Emituje:
 * - Logi
 * - Status updates
 * - Account updates
 * - Progress updates
 */

class WebSocketService {
  constructor() {
    this.io = null;
  }

  /**
   * Initialize Socket.io with HTTP server
   */
  initialize(io) {
    this.io = io;

    this.io.on('connection', (socket) => {
      console.log(`[WebSocket] Client connected: ${socket.id}`);

      // Send initial status on connection
      this.emitStatus({
        connected: true,
        timestamp: new Date().toISOString()
      });

      socket.on('disconnect', () => {
        console.log(`[WebSocket] Client disconnected: ${socket.id}`);
      });

      // Handle client requests
      socket.on('request:status', () => {
        this.handleStatusRequest(socket);
      });
    });
  }

  /**
   * Emit log entry to all connected clients
   */
  emitLog(level, message, data = {}) {
    if (!this.io) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };

    this.io.emit('log', logEntry);
  }

  /**
   * Emit status update
   */
  emitStatus(status) {
    if (!this.io) return;

    this.io.emit('status', {
      ...status,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit account-specific update
   */
  emitAccountUpdate(accountId, update) {
    if (!this.io) return;

    this.io.emit('account:update', {
      accountId,
      ...update,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit session progress
   */
  emitProgress(sessionId, progress) {
    if (!this.io) return;

    this.io.emit('session:progress', {
      sessionId,
      ...progress,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit post completion
   */
  emitPostComplete(postId, result) {
    if (!this.io) return;

    this.io.emit('post:complete', {
      postId,
      ...result,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit post failure
   */
  emitPostFailed(postId, error) {
    if (!this.io) return;

    this.io.emit('post:failed', {
      postId,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit VNC session update
   */
  emitVNCUpdate(accountId, vncStatus) {
    if (!this.io) return;

    this.io.emit('vnc:update', {
      accountId,
      ...vncStatus,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit error/alert
   */
  emitError(error, context = {}) {
    if (!this.io) return;

    this.io.emit('error', {
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit warning/alert
   */
  emitWarning(message, data = {}) {
    if (!this.io) return;

    this.io.emit('warning', {
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit success notification
   */
  emitSuccess(message, data = {}) {
    if (!this.io) return;

    this.io.emit('success', {
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle status request from client
   */
  async handleStatusRequest(socket) {
    // TODO: Get actual status from automation service
    const status = {
      isRunning: false,
      activeJobs: 0,
      queueLength: 0,
      accounts: []
    };

    socket.emit('status', status);
  }

  /**
   * Broadcast to all clients
   */
  broadcast(event, data) {
    if (!this.io) return;
    this.io.emit(event, data);
  }

  /**
   * Send to specific socket
   */
  sendToSocket(socketId, event, data) {
    if (!this.io) return;
    this.io.to(socketId).emit(event, data);
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount() {
    if (!this.io) return 0;
    return this.io.sockets.sockets.size;
  }
}

// Singleton instance
const websocketService = new WebSocketService();

module.exports = websocketService;
