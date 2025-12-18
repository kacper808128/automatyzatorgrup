/**
 * VNC Service - Virtual Display Management
 *
 * Manages Xvfb (virtual framebuffer) and x11vnc for remote browser viewing
 */

const { spawn } = require('child_process');
const logger = require('../utils/logger');

class VNCService {
  constructor() {
    this.sessions = new Map(); // accountId -> { xvfb, x11vnc, display, port }
    this.baseDisplay = parseInt(process.env.VNC_BASE_DISPLAY || '99');
    this.basePort = parseInt(process.env.VNC_BASE_PORT || '5900');
    this.noVNCPort = parseInt(process.env.NOVNC_PORT || '6080');
  }

  /**
   * Start VNC session for account
   */
  async startSession(accountId) {
    if (this.sessions.has(accountId)) {
      logger.info(`VNC session already exists for account ${accountId}`);
      return this.sessions.get(accountId);
    }

    // Assign display and port
    const display = this.baseDisplay + this.sessions.size;
    const vncPort = this.basePort + this.sessions.size;
    const noVNCWebPort = this.noVNCPort + this.sessions.size;

    logger.info(`Starting VNC session for account ${accountId}`, {
      display,
      vncPort,
      noVNCWebPort
    });

    try {
      // Start Xvfb (virtual framebuffer)
      const xvfb = spawn('Xvfb', [
        `:${display}`,
        '-screen', '0', '1366x768x24',
        '-ac',
        '-nolisten', 'tcp',
        '-dpi', '96',
        '+extension', 'RANDR'
      ]);

      xvfb.on('error', (err) => {
        logger.error(`Xvfb error for account ${accountId}:`, err);
      });

      xvfb.stdout.on('data', (data) => {
        logger.debug(`Xvfb [${accountId}]: ${data.toString().trim()}`);
      });

      xvfb.stderr.on('data', (data) => {
        logger.debug(`Xvfb [${accountId}]: ${data.toString().trim()}`);
      });

      // Wait for Xvfb to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Start x11vnc (VNC server)
      const x11vnc = spawn('x11vnc', [
        '-display', `:${display}`,
        '-rfbport', vncPort.toString(),
        '-shared',
        '-forever',
        '-nopw',
        '-quiet',
        '-bg'
      ]);

      x11vnc.on('error', (err) => {
        logger.error(`x11vnc error for account ${accountId}:`, err);
      });

      x11vnc.stdout.on('data', (data) => {
        logger.debug(`x11vnc [${accountId}]: ${data.toString().trim()}`);
      });

      x11vnc.stderr.on('data', (data) => {
        logger.debug(`x11vnc [${accountId}]: ${data.toString().trim()}`);
      });

      // Store session
      const session = {
        accountId,
        xvfb,
        x11vnc,
        display,
        vncPort,
        noVNCWebPort,
        startedAt: new Date()
      };

      this.sessions.set(accountId, session);

      logger.info(`VNC session started for account ${accountId}`, {
        display: `:${display}`,
        vncPort,
        noVNCWebPort
      });

      return session;

    } catch (error) {
      logger.error(`Failed to start VNC session for account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Stop VNC session for account
   */
  async stopSession(accountId) {
    const session = this.sessions.get(accountId);

    if (!session) {
      logger.warn(`No VNC session found for account ${accountId}`);
      return;
    }

    logger.info(`Stopping VNC session for account ${accountId}`);

    try {
      // Kill x11vnc
      if (session.x11vnc) {
        session.x11vnc.kill('SIGTERM');
      }

      // Kill Xvfb
      if (session.xvfb) {
        session.xvfb.kill('SIGTERM');
      }

      this.sessions.delete(accountId);

      logger.info(`VNC session stopped for account ${accountId}`);
    } catch (error) {
      logger.error(`Failed to stop VNC session for account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Get session info
   */
  getSession(accountId) {
    return this.sessions.get(accountId);
  }

  /**
   * Get all sessions
   */
  getAllSessions() {
    return Array.from(this.sessions.values()).map(session => ({
      accountId: session.accountId,
      display: session.display,
      vncPort: session.vncPort,
      noVNCWebPort: session.noVNCWebPort,
      startedAt: session.startedAt
    }));
  }

  /**
   * Get display for account (for Playwright)
   */
  getDisplay(accountId) {
    const session = this.sessions.get(accountId);
    return session ? `:${session.display}` : null;
  }

  /**
   * Cleanup all sessions
   */
  async cleanup() {
    logger.info('Cleaning up all VNC sessions...');

    for (const accountId of this.sessions.keys()) {
      await this.stopSession(accountId);
    }

    logger.info('All VNC sessions cleaned up');
  }
}

module.exports = new VNCService();
