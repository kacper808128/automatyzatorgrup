/**
 * Automation Service - Facebook Group Posting (Online Version)
 *
 * Migrated from desktop automation-manager.js to work with:
 * - Bull queues for job processing
 * - MongoDB for data persistence
 * - WebSocket for real-time updates
 * - Headless mode with optional VNC
 *
 * Key features:
 * - Multi-account with shared queue (max 5 concurrent)
 * - Cookie validation (offline + online)
 * - Storage state persistence
 * - Reserve account system
 * - Anti-ban features (fingerprinting, delays, activity limits)
 * - Facebook ban/spam detection
 * - Screenshot on errors
 */

const { chromium } = require('playwright');
const CryptoJS = require('crypto-js');
const fs = require('fs');
const path = require('path');
const os = require('os');

const websocketService = require('./websocket.service');
const Account = require('../models/Account');
const Post = require('../models/Post');
const Session = require('../models/Session');
const logger = require('../utils/logger');

// Anti-ban utilities
const {
  randomDelay,
  randomTyping,
  getRandomUserAgent,
  HumanMouse,
  HumanTyping,
  HumanScroll,
  boundedGaussian,
  engageWithGroup,
  postPublishEngagement,
  performHumanError,
} = require('../utils/human-behavior');

const { ProxyManager } = require('../utils/proxy-manager');
const { FingerprintManager } = require('../utils/fingerprint-manager');
const { ActivityLimiter, LIMITS } = require('../utils/activity-limiter');

class AutomationService {
  constructor() {
    // Anti-Ban Stack
    this.fingerprintManager = new FingerprintManager();
    this.activityLimiter = new ActivityLimiter(); // Online version without store
    this.proxyManager = new ProxyManager();

    // Paths
    this.storageDir = path.join(__dirname, '../../storage');
    this.cookiesDir = path.join(this.storageDir, 'cookies');
    this.screenshotsDir = path.join(this.storageDir, 'screenshots');
    this.ensureDirs();

    // Concurrent accounts limit
    this.maxConcurrentAccounts = parseInt(process.env.MAX_CONCURRENT_ACCOUNTS || '5');
    this.maxPostsPerAccount = parseInt(process.env.MAX_POSTS_PER_ACCOUNT || '10');

    // Encryption key for cookies
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'fb-automation-secret-key-2025';

    // State tracking
    this.isRunning = false;
    this.currentSessionId = null;
  }

  /**
   * Ensure required directories exist
   */
  ensureDirs() {
    [this.storageDir, this.cookiesDir, this.screenshotsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Add log with WebSocket emit
   */
  addLog(message, level = 'info', sessionId = null) {
    logger.log(level, message, { sessionId: sessionId || this.currentSessionId });

    if (sessionId || this.currentSessionId) {
      websocketService.emitLog({
        sessionId: sessionId || this.currentSessionId,
        message,
        level,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Capture error screenshot
   */
  async captureErrorScreenshot(page, errorType, accountId = 'unknown') {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `error_${errorType}_${accountId}_${timestamp}.png`;
      const filepath = path.join(this.screenshotsDir, filename);

      await page.screenshot({ path: filepath, fullPage: true });
      this.addLog(`📸 Screenshot saved: ${filename}`, 'info');
      return filepath;
    } catch (err) {
      this.addLog(`⚠️ Screenshot failed: ${err.message}`, 'warning');
      return null;
    }
  }

  // =============================================
  // COOKIE VALIDATION
  // =============================================

  /**
   * Validate cookies offline (check structure and expiry)
   */
  validateCookies(cookies) {
    try {
      const cookieArray = typeof cookies === 'string' ? JSON.parse(cookies) : cookies;

      if (!cookieArray || !Array.isArray(cookieArray) || cookieArray.length === 0) {
        return { valid: false, reason: 'Missing cookies' };
      }

      // Required Facebook cookies
      const requiredCookies = {
        'c_user': null,  // User ID
        'xs': null,      // Session token
        'datr': null,    // Device token
      };

      const now = Date.now() / 1000;
      let earliestExpiry = Infinity;

      for (const cookie of cookieArray) {
        if (requiredCookies.hasOwnProperty(cookie.name)) {
          requiredCookies[cookie.name] = cookie;

          const expiry = cookie.expirationDate || cookie.expires;
          if (expiry && expiry < earliestExpiry) {
            earliestExpiry = expiry;
          }
        }
      }

      if (!requiredCookies['c_user'] || !requiredCookies['c_user'].value) {
        return { valid: false, reason: 'Missing c_user cookie' };
      }

      if (!requiredCookies['xs'] || !requiredCookies['xs'].value) {
        return { valid: false, reason: 'Missing xs session token' };
      }

      if (earliestExpiry !== Infinity && earliestExpiry < now) {
        return { valid: false, reason: 'Cookies expired' };
      }

      let expiresInDays = null;
      if (earliestExpiry !== Infinity) {
        expiresInDays = Math.floor((earliestExpiry - now) / 86400);
      }

      if (expiresInDays !== null && expiresInDays < 7) {
        return {
          valid: true,
          reason: `Cookies valid but expire in ${expiresInDays} days`,
          expiresIn: expiresInDays,
          warning: true
        };
      }

      return {
        valid: true,
        reason: 'Cookies valid',
        expiresIn: expiresInDays,
        userId: requiredCookies['c_user'].value
      };

    } catch (error) {
      return { valid: false, reason: `Cookie parse error: ${error.message}` };
    }
  }

  /**
   * Validate cookies online (check if session is active)
   */
  async validateCookiesOnline(cookies, accountId = null) {
    // First offline check
    const offlineCheck = this.validateCookies(cookies);
    if (!offlineCheck.valid) {
      return offlineCheck;
    }

    let browser = null;
    let context = null;

    try {
      browser = await chromium.launch({ headless: true });
      context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });

      const cookieArray = typeof cookies === 'string' ? JSON.parse(cookies) : cookies;
      const normalizedCookies = cookieArray.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path || '/',
        secure: cookie.secure || false,
        httpOnly: cookie.httpOnly || false,
        sameSite: cookie.sameSite === 'no_restriction' ? 'None' :
                 cookie.sameSite === 'lax' ? 'Lax' :
                 cookie.sameSite === 'strict' ? 'Strict' : 'None',
        expires: cookie.expirationDate ? cookie.expirationDate : undefined
      }));

      await context.addCookies(normalizedCookies);
      const page = await context.newPage();

      await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      const currentUrl = page.url();

      const isLoggedIn = !currentUrl.includes('login') &&
                        !currentUrl.includes('checkpoint') &&
                        currentUrl.includes('facebook.com');

      if (isLoggedIn && accountId) {
        // Auto-refresh cookies after successful validation
        try {
          const freshCookies = await context.cookies();
          const cookiesJson = JSON.stringify(freshCookies);

          const account = await Account.findOne({ id: accountId });
          if (account) {
            account.cookiesEncrypted = this.encryptCookies(cookiesJson);
            account.cookiesValidation.lastValidated = new Date();
            account.cookiesValidation.isValid = true;
            await account.save();
          }
        } catch (cookieError) {
          // Ignore save errors - validation is OK
        }
      }

      await context.close();
      await browser.close();

      if (isLoggedIn) {
        return { valid: true, reason: 'Session active', ...offlineCheck };
      } else {
        return { valid: false, reason: 'Session expired' };
      }

    } catch (error) {
      if (context) await context.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
      return { valid: false, reason: `Online validation error: ${error.message}` };
    }
  }

  /**
   * Filter accounts - return only those with valid cookies
   */
  async filterValidAccounts(accounts, checkOnline = false) {
    const validAccounts = [];
    const invalidAccounts = [];

    for (const account of accounts) {
      if (!account.cookiesEncrypted) {
        this.addLog(`⚠️ ${account.name || account.email}: No cookies (will require manual login)`, 'warning');
        validAccounts.push({
          ...account.toObject(),
          cookieValidation: { valid: false, reason: 'No cookies', requiresManualLogin: true }
        });
        invalidAccounts.push({
          ...account.toObject(),
          validationError: 'No cookies'
        });
        continue;
      }

      let validation;
      const decryptedCookies = this.decryptCookies(account.cookiesEncrypted);

      if (checkOnline) {
        this.addLog(`🔍 Checking online: ${account.name || account.email}...`, 'info');
        validation = await this.validateCookiesOnline(decryptedCookies, account.id);
      } else {
        validation = this.validateCookies(decryptedCookies);
      }

      if (validation.valid) {
        if (validation.warning) {
          this.addLog(`⚠️ ${account.name || account.email}: ${validation.reason}`, 'warning');
        }
        validAccounts.push({
          ...account.toObject(),
          cookieValidation: validation,
          cookies: decryptedCookies // Decrypted for use
        });
      } else {
        this.addLog(`⚠️ ${account.name || account.email}: ${validation.reason} (manual login required)`, 'warning');
        validAccounts.push({
          ...account.toObject(),
          cookieValidation: { ...validation, requiresManualLogin: true },
          cookies: decryptedCookies
        });
        invalidAccounts.push({
          ...account.toObject(),
          validationError: validation.reason
        });
      }
    }

    return { validAccounts, invalidAccounts };
  }

  // =============================================
  // STORAGE STATE MANAGEMENT
  // =============================================

  /**
   * Save storage state (cookies + localStorage + sessionStorage)
   */
  async saveStorageState(context, accountId) {
    const statePath = path.join(this.cookiesDir, `account_${accountId}_state.json`);

    await context.storageState({ path: statePath });

    // Save metadata
    const metaPath = path.join(this.cookiesDir, `account_${accountId}_meta.json`);
    const meta = {
      accountId,
      lastSaved: new Date().toISOString(),
      lastRefresh: new Date().toISOString(),
      statePath
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

    // Auto-refresh cookies in database
    try {
      const freshCookies = await context.cookies();
      const cookiesJson = JSON.stringify(freshCookies);

      const account = await Account.findOne({ id: accountId });
      if (account) {
        account.cookiesEncrypted = this.encryptCookies(cookiesJson);
        account.cookiesValidation.isValid = true;
        account.cookiesValidation.lastValidated = new Date();
        await account.save();

        this.addLog(`💾 Storage state + cookies saved for ${accountId}`, 'success');
      } else {
        this.addLog(`💾 Storage state saved for ${accountId}`, 'success');
      }
    } catch (cookieError) {
      this.addLog(`💾 Storage state saved for ${accountId} (cookies not updated)`, 'warning');
    }

    return statePath;
  }

  /**
   * Get storage state path
   */
  getStorageStatePath(accountId) {
    const statePath = path.join(this.cookiesDir, `account_${accountId}_state.json`);
    return fs.existsSync(statePath) ? statePath : null;
  }

  /**
   * Create context with saved storage state
   */
  async createContextWithStorageState(browser, accountId, options = {}) {
    const statePath = this.getStorageStatePath(accountId);

    const contextOptions = { ...options };

    if (statePath) {
      contextOptions.storageState = statePath;
      this.addLog(`📂 Loading storage state for ${accountId}`, 'info');
    }

    return await browser.newContext(contextOptions);
  }

  // =============================================
  // COOKIE ENCRYPTION
  // =============================================

  encryptCookies(cookies) {
    const cookiesJson = typeof cookies === 'string' ? cookies : JSON.stringify(cookies);
    return CryptoJS.AES.encrypt(cookiesJson, this.encryptionKey).toString();
  }

  decryptCookies(encryptedCookies) {
    const bytes = CryptoJS.AES.decrypt(encryptedCookies, this.encryptionKey);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decrypted);
  }

  // =============================================
  // MULTI-ACCOUNT POSTING (Main Logic)
  // =============================================

  /**
   * Start multi-account posting with shared queue
   *
   * @param {Object} config - { posts: [], accounts: [], validateCookiesOnline: false, sessionId: '' }
   */
  async startPostingMultiAccount(config) {
    const { posts, accounts, validateCookiesOnline = false, sessionId } = config;

    this.isRunning = true;
    this.currentSessionId = sessionId;

    this.addLog(`🚀 Starting multi-account posting`, 'info', sessionId);
    this.addLog(`📊 Accounts to check: ${accounts.length}`, 'info', sessionId);
    this.addLog(`📝 Posts: ${posts.length}`, 'info', sessionId);
    this.addLog(`⚙️ Max concurrent accounts: ${this.maxConcurrentAccounts}`, 'info', sessionId);

    // =============================================
    // COOKIE VALIDATION
    // =============================================
    this.addLog(`\n🔍 Validating cookies...`, 'info', sessionId);

    const { validAccounts, invalidAccounts } = await this.filterValidAccounts(
      accounts,
      validateCookiesOnline
    );

    const accountsWithValidCookies = validAccounts.filter(a => !a.cookieValidation?.requiresManualLogin).length;
    const accountsRequiringLogin = invalidAccounts.length;

    if (accountsRequiringLogin > 0) {
      this.addLog(`\n⚠️ Accounts with invalid cookies (will require manual login):`, 'warning', sessionId);
      for (const acc of invalidAccounts) {
        this.addLog(`   ⚠️ ${acc.name || acc.email}: ${acc.validationError}`, 'warning', sessionId);
      }
      this.addLog(`   💡 These accounts will start, wait for manual login, and auto-save cookies`, 'info', sessionId);
    }

    if (validAccounts.length === 0) {
      throw new Error('No accounts to run! Add accounts with cookies.');
    }

    this.addLog(`\n✅ Accounts ready: ${validAccounts.length}/${accounts.length}`, 'success', sessionId);
    this.addLog(`   • Valid cookies: ${accountsWithValidCookies}`, 'success', sessionId);
    if (accountsRequiringLogin > 0) {
      this.addLog(`   • Requiring login: ${accountsRequiringLogin}`, 'warning', sessionId);
    }

    // =============================================
    // SHARED QUEUE
    // =============================================
    this.addLog(`\n📋 Creating shared queue...`, 'info', sessionId);

    const postQueue = [...posts];
    const stoppedAccounts = new Set();
    let globalStopFlag = false;

    const getNextPost = () => {
      if (globalStopFlag || postQueue.length === 0) return null;
      return postQueue.shift();
    };

    const returnPostToQueue = (post) => {
      postQueue.unshift(post);
    };

    const getQueueLength = () => postQueue.length;

    let stopAccount;

    const accountTasks = [];
    for (let i = 0; i < validAccounts.length; i++) {
      const account = validAccounts[i];

      const accountProxy = account.proxy ? {
        id: account.proxy.id,
        host: account.proxy.host,
        port: account.proxy.port,
        username: account.proxy.username,
        password: account.proxy.password
      } : null;

      accountTasks.push({
        accountIndex: i + 1,
        accountId: account.id,
        accountName: account.name || account.email || `Account #${account.id}`,
        cookies: account.cookies,
        posts: null,
        proxy: accountProxy,
        cookieValidation: account.cookieValidation,
        getNextPost,
        returnPostToQueue,
        stopAccount: (id, name, reason) => stopAccount(id, name, reason),
        activateReserveOnLimit: (completedAccountName) => activateReserveOnLimit(completedAccountName),
        stoppedAccounts,
        getGlobalStopFlag: () => globalStopFlag,
        getQueueLength,
        sessionId
      });

      const proxyInfo = accountProxy ? `🌐 ${accountProxy.host}:${accountProxy.port}` : '🔓 no proxy';
      this.addLog(`🔹 ${account.name || `Account #${i + 1}`}: ready | ${proxyInfo}`, 'info', sessionId);
    }

    this.addLog(`\n✅ Queue created with ${posts.length} posts, launching ${accountTasks.length} instances...`, 'success', sessionId);

    if (this.maxPostsPerAccount > 0) {
      this.addLog(`📊 Post limit per account: ${this.maxPostsPerAccount} (reserve activates on limit)`, 'info', sessionId);
    }

    // =============================================
    // RESERVE SYSTEM
    // =============================================
    const activeTasks = accountTasks.slice(0, this.maxConcurrentAccounts);
    const reserveTasks = accountTasks.slice(this.maxConcurrentAccounts);

    if (reserveTasks.length > 0) {
      this.addLog(`\n🔄 Reserve system: ${activeTasks.length} active, ${reserveTasks.length} in reserve`, 'info', sessionId);
    }

    const results = [];
    const accountsStats = [];
    const executing = new Set();

    // Activate reserve account
    const activateReserveAccount = () => {
      if (reserveTasks.length === 0) return null;

      const reserveTask = reserveTasks.shift();
      this.addLog(`\n🔄 ACTIVATING RESERVE: ${reserveTask.accountName}`, 'info', sessionId);

      const taskPromise = (async () => {
        try {
          this.addLog(`▶️ Starting reserve account: ${reserveTask.accountName}`, 'info', sessionId);
          const stats = await this.runAccountTaskIsolated(reserveTask);
          accountsStats.push(stats);

          const hasError = stats.criticalError || stats.failedPosts.length > 0;
          results.push({
            accountId: reserveTask.accountId,
            success: !hasError,
            stats: stats
          });
        } catch (error) {
          this.addLog(`❌ Reserve account error ${reserveTask.accountName}: ${error.message}`, 'error', sessionId);
          accountsStats.push({
            accountId: reserveTask.accountId,
            accountName: reserveTask.accountName,
            successfulPosts: [],
            failedPosts: [],
            totalAttempted: 0,
            criticalError: error.message
          });
        }
      })().finally(() => {
        executing.delete(taskPromise);
      });

      executing.add(taskPromise);
      return reserveTask.accountName;
    };

    // Stop account function (defined after activateReserveAccount)
    stopAccount = (accountId, accountName, reason) => {
      if (stoppedAccounts.has(accountId)) return;

      stoppedAccounts.add(accountId);
      this.addLog(`❌ ACCOUNT STOPPED: ${accountName} - ${reason}`, 'error', sessionId);

      const activatedAccount = activateReserveAccount();
      if (activatedAccount) {
        this.addLog(`✅ Activated reserve: ${activatedAccount}`, 'success', sessionId);
      }
    };

    // Activate reserve on limit
    const activateReserveOnLimit = (completedAccountName) => {
      const activatedAccount = activateReserveAccount();
      if (activatedAccount) {
        this.addLog(`🔄 Activated reserve: ${activatedAccount} (limit reached by: ${completedAccountName})`, 'success', sessionId);
      } else {
        this.addLog(`⚠️ No reserve accounts - ${completedAccountName} completed`, 'warning', sessionId);
      }
    };

    // Run with concurrency limit
    const runWithConcurrencyLimit = async (tasks, maxConcurrent) => {
      for (const task of tasks) {
        if (!this.isRunning) {
          this.addLog(`⏹️ Automation stopped - not starting more accounts`, 'warning', sessionId);
          break;
        }

        while (executing.size >= maxConcurrent && this.isRunning) {
          await Promise.race(executing);
        }

        if (!this.isRunning) {
          this.addLog(`⏹️ Automation stopped`, 'warning', sessionId);
          break;
        }

        const taskPromise = (async () => {
          try {
            this.addLog(`▶️ Starting account ${task.accountName} (${executing.size + 1}/${maxConcurrent} active)`, 'info', sessionId);
            const stats = await this.runAccountTaskIsolated(task);
            accountsStats.push(stats);

            const hasError = stats.criticalError || stats.failedPosts.length > 0;
            results.push({
              accountId: task.accountId,
              success: !hasError,
              stats: stats
            });
          } catch (error) {
            this.addLog(`❌ Account error ${task.accountName}: ${error.message}`, 'error', sessionId);
            accountsStats.push({
              accountId: task.accountId,
              accountName: task.accountName,
              successfulPosts: [],
              failedPosts: [],
              totalAttempted: 0,
              criticalError: error.message
            });
          }
        })().finally(() => {
          executing.delete(taskPromise);
        });

        executing.add(taskPromise);

        // Delay between starting accounts (30-60s)
        const remainingTasks = tasks.indexOf(task) < tasks.length - 1;
        if (remainingTasks && this.isRunning) {
          const delayMs = 30000 + Math.random() * 30000;
          const delaySec = Math.round(delayMs / 1000);
          this.addLog(`⏳ Waiting ${delaySec}s before next account...`, 'info', sessionId);

          const waitStart = Date.now();
          while (Date.now() - waitStart < delayMs && this.isRunning) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      if (executing.size > 0) {
        this.addLog(`⏳ Waiting for ${executing.size} active accounts...`, 'info', sessionId);
        await Promise.all(executing);
      }
    };

    try {
      await runWithConcurrencyLimit(activeTasks, this.maxConcurrentAccounts);

      if (executing.size > 0) {
        this.addLog(`⏳ Waiting for ${executing.size} accounts (including reserve)...`, 'info', sessionId);
        await Promise.all(executing);
      }

      const successCount = results.filter(r => r.success).length;
      const failedAccounts = results.filter(r => !r.success).length;

      let totalSuccessfulPosts = 0;
      let totalFailedPosts = 0;
      const groupStats = new Map();

      for (const stats of accountsStats) {
        totalSuccessfulPosts += stats.successfulPosts.length;
        totalFailedPosts += stats.failedPosts.length;

        for (const post of stats.successfulPosts) {
          const groupKey = post.groupLink;
          groupStats.set(groupKey, (groupStats.get(groupKey) || 0) + 1);
        }
      }

      // ========================================
      // FINAL SUMMARY
      // ========================================
      this.addLog(`\n${'='.repeat(60)}`, 'info', sessionId);
      this.addLog(`📊 AUTOMATION SUMMARY`, 'info', sessionId);
      this.addLog(`${'='.repeat(60)}`, 'info', sessionId);

      if (this.isRunning) {
        this.addLog(`\n✅ Status: Completed successfully`, 'success', sessionId);
      } else {
        this.addLog(`\n⏹️ Status: Stopped by user`, 'warning', sessionId);
      }

      this.addLog(`\n👥 ACCOUNTS:`, 'info', sessionId);
      this.addLog(`   • Total: ${accountTasks.length}`, 'info', sessionId);
      this.addLog(`   • Active on start: ${activeTasks.length}`, 'info', sessionId);
      if (accountTasks.length > activeTasks.length) {
        const reserveUsed = activeTasks.length + (accountTasks.length - activeTasks.length - reserveTasks.length);
        this.addLog(`   • Reserve used: ${reserveUsed}/${accountTasks.length - activeTasks.length}`, 'info', sessionId);
      }
      this.addLog(`   • Successful: ${successCount}`, 'success', sessionId);
      this.addLog(`   • With errors: ${failedAccounts}`, failedAccounts > 0 ? 'warning' : 'info', sessionId);
      this.addLog(`   • Stopped: ${stoppedAccounts.size}`, stoppedAccounts.size > 0 ? 'error' : 'info', sessionId);

      this.addLog(`\n📝 POSTS:`, 'info', sessionId);
      this.addLog(`   • Published successfully: ${totalSuccessfulPosts}`, 'success', sessionId);
      this.addLog(`   • Failed: ${totalFailedPosts}`, totalFailedPosts > 0 ? 'warning' : 'info', sessionId);
      this.addLog(`   • Remaining in queue: ${postQueue.length}`, postQueue.length > 0 ? 'warning' : 'info', sessionId);
      this.addLog(`   • Total attempts: ${totalSuccessfulPosts + totalFailedPosts}`, 'info', sessionId);
      if (totalSuccessfulPosts + totalFailedPosts > 0) {
        const successRate = ((totalSuccessfulPosts / (totalSuccessfulPosts + totalFailedPosts)) * 100).toFixed(1);
        this.addLog(`   • Success rate: ${successRate}%`, 'info', sessionId);
      }

      this.addLog(`\n👤 POSTS PER ACCOUNT:`, 'info', sessionId);
      for (const stats of accountsStats) {
        const status = stats.criticalError ? '❌' : stats.failedPosts.length > 0 ? '⚠️' : '✅';
        const postsInfo = `${stats.successfulPosts.length} success, ${stats.failedPosts.length} failed`;
        this.addLog(`   ${status} ${stats.accountName}: ${postsInfo}`, stats.criticalError ? 'error' : 'info', sessionId);

        if (stats.criticalError) {
          this.addLog(`      └─ Critical error: ${stats.criticalError}`, 'error', sessionId);
        }
      }

      this.addLog(`\n${'='.repeat(60)}\n`, 'info', sessionId);

      return {
        success: failedAccounts === 0 && totalFailedPosts === 0,
        totalAccounts: accountTasks.length,
        successfulAccounts: successCount,
        failedAccounts: failedAccounts,
        validAccounts: validAccounts.length,
        invalidAccounts: invalidAccounts.length,
        totalSuccessfulPosts: totalSuccessfulPosts,
        totalFailedPosts: totalFailedPosts,
        groupStats: Object.fromEntries(groupStats),
        accountsStats: accountsStats,
        skippedAccounts: invalidAccounts.map(a => ({
          name: a.name || a.email,
          reason: a.validationError
        })),
        stoppedByUser: !this.isRunning
      };
    } catch (error) {
      this.addLog(`\n❌ Critical error: ${error.message}`, 'error', sessionId);
      throw error;
    } finally {
      this.isRunning = false;
      this.currentSessionId = null;
    }
  }

  /**
   * Run isolated account task (each account in separate browser)
   */
  async runAccountTaskIsolated(task) {
    const { accountIndex, accountName, cookies, proxy, sessionId } = task;

    if (!this.isRunning) {
      this.addLog(`[${accountName}] ⏹️ Automation stopped - skipping`, 'warning', sessionId);
      return {
        accountId: task.accountId,
        accountName: accountName,
        successfulPosts: [],
        failedPosts: [],
        totalAttempted: 0
      };
    }

    const logPrefix = `[${accountName}]`;
    this.addLog(`\n${logPrefix} Initializing Playwright browser...`, 'info', sessionId);

    // Find Chrome executable
    const executablePath = this.findChromePath();

    // Generate fingerprint for this account
    const fingerprint = this.fingerprintManager.generateFingerprint(accountIndex);

    // Playwright launch options with proxy per account
    const launchOptions = {
      headless: process.env.HEADLESS !== 'false', // Default headless
      executablePath: executablePath || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled',
        '--start-maximized',
        '--disable-infobars',
        '--disable-dev-shm-usage',
        '--no-first-run'
      ]
    };

    // Add proxy if assigned to account
    if (proxy && proxy.host && proxy.port) {
      launchOptions.proxy = {
        server: `http://${proxy.host}:${proxy.port}`,
        username: proxy.username || undefined,
        password: proxy.password || undefined
      };
      this.addLog(`${logPrefix} 🌐 Using proxy: ${proxy.host}:${proxy.port}`, 'info', sessionId);
    } else {
      this.addLog(`${logPrefix} 🔓 No proxy`, 'info', sessionId);
    }

    let browser = null;
    let context = null;
    let page = null;

    try {
      // Launch separate browser instance for this account
      browser = await chromium.launch(launchOptions);

      // Create context with fingerprint settings
      context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        userAgent: fingerprint.userAgent,
        locale: fingerprint.locale,
        timezoneId: fingerprint.timezone
      });

      // Inject stealth scripts
      const stealthScripts = this.fingerprintManager.getStealthScripts(fingerprint);
      for (const script of stealthScripts) {
        await context.addInitScript(script);
      }

      page = await context.newPage();

      // Load cookies if available
      if (cookies && cookies !== '') {
        try {
          const parsedCookies = typeof cookies === 'string' ? JSON.parse(cookies) : cookies;
          const normalizedCookies = parsedCookies.map(cookie => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path || '/',
            secure: cookie.secure !== undefined ? cookie.secure : false,
            httpOnly: cookie.httpOnly !== undefined ? cookie.httpOnly : false,
            sameSite: cookie.sameSite === 'no_restriction' ? 'None' :
                     cookie.sameSite === 'lax' ? 'Lax' :
                     cookie.sameSite === 'strict' ? 'Strict' : 'None',
            expires: cookie.expirationDate ? cookie.expirationDate : undefined
          }));

          await context.addCookies(normalizedCookies);
          this.addLog(`${logPrefix} ✅ Cookies loaded (${normalizedCookies.length})`, 'success', sessionId);
        } catch (cookieError) {
          this.addLog(`${logPrefix} ⚠️ Failed to load cookies: ${cookieError.message}`, 'warning', sessionId);
          this.addLog(`${logPrefix} Continuing - manual login required`, 'info', sessionId);
        }
      } else {
        this.addLog(`${logPrefix} ⚠️ No cookies - manual login required`, 'warning', sessionId);
      }

      // Navigate to Facebook
      this.addLog(`${logPrefix} Opening Facebook...`, 'info', sessionId);

      try {
        await page.goto('https://www.facebook.com/', {
          waitUntil: 'domcontentloaded',
          timeout: 45000
        });
        await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
      } catch (navError) {
        this.addLog(`${logPrefix} ⚠️ Navigation timeout: ${navError.message}`, 'warning', sessionId);
      }

      await randomDelay(3000, 5000);

      if (!this.isRunning) {
        this.addLog(`${logPrefix} ⏹️ Automation stopped`, 'warning', sessionId);
        await browser.close();
        return {
          accountId: task.accountId,
          accountName: accountName,
          successfulPosts: [],
          failedPosts: [],
          totalAttempted: 0
        };
      }

      // Check if logged in
      const currentUrl = page.url();
      const isOnLoginPage = currentUrl.includes('login') ||
                           currentUrl.includes('checkpoint') ||
                           currentUrl.includes('/recover');

      const isLoggedIn = await page.evaluate(() => {
        const hasNavigation = document.querySelector('[role="navigation"]') !== null;
        const hasLoginForm = document.querySelector('#email') !== null &&
                            document.querySelector('#pass') !== null;
        return hasNavigation && !hasLoginForm;
      }).catch(() => false);

      if (isOnLoginPage || !isLoggedIn) {
        this.addLog(`${logPrefix} ❌ NOT LOGGED IN - cookies invalid!`, 'error', sessionId);
        this.addLog(`${logPrefix} URL: ${currentUrl}`, 'info', sessionId);

        await this.captureErrorScreenshot(page, 'login_failed', task.accountId);

        // Allow manual login (wait 5 minutes)
        this.addLog(`${logPrefix} 🔄 BROWSER STAYS OPEN - Login manually!`, 'warning', sessionId);
        this.addLog(`${logPrefix} ⏳ Waiting max 5 minutes for login...`, 'info', sessionId);
        this.addLog(`${logPrefix} 📌 After login, browser will continue and save new cookies`, 'info', sessionId);

        const loginTimeout = 5 * 60 * 1000;
        const startTime = Date.now();
        let userLoggedIn = false;

        while (Date.now() - startTime < loginTimeout) {
          await randomDelay(5000, 7000);

          try {
            const checkUrl = page.url();
            const stillOnLogin = checkUrl.includes('login') ||
                                checkUrl.includes('checkpoint') ||
                                checkUrl.includes('/recover');

            const nowLoggedIn = await page.evaluate(() => {
              const hasNavigation = document.querySelector('[role="navigation"]') !== null;
              const hasLoginForm = document.querySelector('#email') !== null &&
                                  document.querySelector('#pass') !== null;
              return hasNavigation && !hasLoginForm;
            }).catch(() => false);

            if (!stillOnLogin && nowLoggedIn) {
              userLoggedIn = true;
              break;
            }

            const elapsed = Math.round((Date.now() - startTime) / 1000);
            if (elapsed % 30 === 0) {
              this.addLog(`${logPrefix} ⏳ Still waiting... (${elapsed}s)`, 'info', sessionId);
            }
          } catch (checkError) {
            // Ignore check errors
          }
        }

        if (!userLoggedIn) {
          this.addLog(`${logPrefix} ⏱️ Timeout - not logged in within 5 minutes`, 'error', sessionId);
          throw new Error(`Login timeout for ${accountName}`);
        }

        this.addLog(`${logPrefix} ✅ Login detected! Saving new cookies...`, 'success', sessionId);

        // Save fresh cookies to database
        try {
          const newCookies = await context.cookies();
          const cookiesJson = JSON.stringify(newCookies);

          const account = await Account.findOne({ id: task.accountId });
          if (account) {
            account.cookiesEncrypted = this.encryptCookies(cookiesJson);
            account.cookiesValidation.isValid = true;
            account.cookiesValidation.lastValidated = new Date();
            await account.save();

            this.addLog(`${logPrefix} 💾 New cookies saved for ${accountName}!`, 'success', sessionId);
            this.addLog(`${logPrefix} ✅ Continuing with new session...`, 'success', sessionId);
          } else {
            this.addLog(`${logPrefix} ⚠️ Account not found in DB - continuing without save`, 'warning', sessionId);
          }
        } catch (cookieError) {
          this.addLog(`${logPrefix} ⚠️ Cookie save error: ${cookieError.message}`, 'warning', sessionId);
          this.addLog(`${logPrefix} Continuing despite save error...`, 'info', sessionId);
        }
      } else {
        this.addLog(`${logPrefix} ✅ Logged in successfully!`, 'success', sessionId);

        // Auto-refresh cookies
        this.addLog(`${logPrefix} 🔄 Refreshing cookies...`, 'info', sessionId);
        try {
          const freshCookies = await context.cookies();
          const cookiesJson = JSON.stringify(freshCookies);

          const account = await Account.findOne({ id: task.accountId });
          if (account) {
            account.cookiesEncrypted = this.encryptCookies(cookiesJson);
            account.cookiesValidation.isValid = true;
            account.cookiesValidation.lastValidated = new Date();
            await account.save();

            this.addLog(`${logPrefix} 💾 Cookies refreshed and saved!`, 'success', sessionId);
          }
        } catch (cookieError) {
          this.addLog(`${logPrefix} ⚠️ Cookie refresh failed: ${cookieError.message}`, 'warning', sessionId);
        }
      }

      // Account stats
      const accountStats = {
        accountId: task.accountId,
        accountName: accountName,
        successfulPosts: [],
        failedPosts: [],
        totalAttempted: 0
      };

      // =============================================
      // QUEUE SYSTEM: Get posts from shared queue
      // =============================================
      let postIndex = 0;

      while (true) {
        if (!this.isRunning) {
          this.addLog(`${logPrefix} ⏹️ Automation stopped - breaking posting loop`, 'warning', sessionId);
          break;
        }

        if (task.stoppedAccounts.has(task.accountId)) {
          this.addLog(`${logPrefix} ⏹️ Account stopped - breaking`, 'warning', sessionId);
          break;
        }

        if (task.getGlobalStopFlag()) {
          this.addLog(`${logPrefix} 🛑 Global stop - breaking`, 'error', sessionId);
          break;
        }

        // Check post limit per account
        if (this.maxPostsPerAccount > 0 && accountStats.successfulPosts.length >= this.maxPostsPerAccount) {
          const remainingInQueue = task.getQueueLength();
          this.addLog(`${logPrefix} ✅ Post limit reached (${accountStats.successfulPosts.length}/${this.maxPostsPerAccount}) - finishing`, 'success', sessionId);

          if (remainingInQueue > 0) {
            this.addLog(`${logPrefix} 📋 ${remainingInQueue} posts remaining in queue`, 'info', sessionId);
            if (task.activateReserveOnLimit) {
              task.activateReserveOnLimit(accountName);
            }
          }
          break;
        }

        // Get next post from queue
        const post = task.getNextPost();
        if (!post) {
          this.addLog(`${logPrefix} ✅ Queue empty - finished posting`, 'success', sessionId);
          break;
        }

        postIndex++;
        accountStats.totalAttempted++;
        this.addLog(`${logPrefix} [Post #${postIndex}] Posting to: ${post.groupLink}`, 'info', sessionId);

        try {
          await this.postToGroupInline(page, post.groupLink, post.postCopy, accountName, sessionId);
          accountStats.successfulPosts.push({
            groupLink: post.groupLink,
            groupName: post.groupName || post.groupLink
          });
          const remainingPosts = task.getQueueLength();
          this.addLog(`${logPrefix} ✅ Post published successfully | Remaining: ${remainingPosts}`, 'success', sessionId);
        } catch (postError) {
          this.addLog(`${logPrefix} ❌ Publishing error: ${postError.message}`, 'error', sessionId);

          // Return post to queue
          task.returnPostToQueue(post);
          this.addLog(`${logPrefix} 🔄 Post returned to queue`, 'info', sessionId);

          // Stop this account
          task.stopAccount(task.accountId, accountName, postError.message);

          accountStats.failedPosts.push({
            groupLink: post.groupLink,
            groupName: post.groupName || post.groupLink,
            error: postError.message
          });

          break;
        }

        // Delay between posts
        if (this.isRunning && !task.getGlobalStopFlag()) {
          const delayMs = this.activityLimiter.getDelayBetweenGroups();
          const delayMin = Math.round(delayMs / 60000 * 10) / 10;
          this.addLog(`${logPrefix} ⏳ Waiting ${delayMin} min before next post...`, 'info', sessionId);
          await randomDelay(delayMs * 0.95, delayMs * 1.05);
        }
      }

      this.addLog(`${logPrefix} ✅ Posting finished (success: ${accountStats.successfulPosts.length}, errors: ${accountStats.failedPosts.length})`, 'success', sessionId);

      // Save storage state after successful posting
      try {
        await this.saveStorageState(context, task.accountId);
      } catch (e) {
        // Ignore save errors
      }

      return accountStats;

    } catch (error) {
      this.addLog(`${logPrefix} ❌ Critical error: ${error.message}`, 'error', sessionId);

      if (page) {
        await this.captureErrorScreenshot(page, 'task_error', task.accountId).catch(() => {});
      }

      if (task.stopAccount) {
        task.stopAccount(task.accountId, accountName, `Critical error: ${error.message}`);
      }

      return {
        accountId: task.accountId,
        accountName: accountName,
        successfulPosts: [],
        failedPosts: [],
        totalAttempted: 0,
        criticalError: error.message
      };
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }

  /**
   * Post to group inline (uses passed page, not this.page)
   */
  async postToGroupInline(page, groupUrl, message, accountName, sessionId) {
    const logPrefix = `[${accountName}]`;

    try {
      this.addLog(`${logPrefix} Posting to group: ${groupUrl}`, 'info', sessionId);

      // Navigate
      try {
        await page.goto(groupUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 45000
        });
        await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
      } catch (navError) {
        this.addLog(`${logPrefix} ⚠️ Slow page load: ${navError.message}`, 'warning', sessionId);
      }

      await randomDelay(5000, 7000);

      const currentUrl = page.url();
      if (!currentUrl.includes('facebook.com/groups')) {
        throw new Error('Failed to navigate to group');
      }

      // Scroll to top
      await page.evaluate(() => window.scrollTo(0, 0));
      await randomDelay(2000, 3000);

      this.addLog(`${logPrefix} Looking for create post button...`, 'info', sessionId);

      // Find "Write something..." button
      const createPostButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('div[role="button"]'));

        for (const button of buttons) {
          const text = button.innerText || '';
          const ariaLabel = button.getAttribute('aria-label') || '';

          const hasCreateText =
            text.toLowerCase().includes('napisz coś') ||
            text.toLowerCase().includes('write something') ||
            text.toLowerCase().includes('what\'s on your mind') ||
            text.toLowerCase().includes('co słychać') ||
            ariaLabel.toLowerCase().includes('napisz') ||
            ariaLabel.toLowerCase().includes('write');

          const isNotComment =
            !text.toLowerCase().includes('komentarz') &&
            !text.toLowerCase().includes('comment') &&
            !ariaLabel.toLowerCase().includes('komentarz') &&
            !ariaLabel.toLowerCase().includes('comment');

          if (hasCreateText && isNotComment) {
            const rect = button.getBoundingClientRect();
            if (rect.top < window.innerHeight / 2) {
              button.setAttribute('data-post-create-button', 'true');
              return true;
            }
          }
        }
        return false;
      });

      if (createPostButton) {
        await page.evaluate(() => {
          const button = document.querySelector('[data-post-create-button="true"]');
          if (button) button.click();
        });
        this.addLog(`${logPrefix} ✅ Clicked create post button`, 'success', sessionId);
      } else {
        this.addLog(`${logPrefix} Trying alternative method (XPath)...`, 'info', sessionId);

        const clicked = await page.evaluate(() => {
          const getElementByXpath = (xpath) => {
            return document.evaluate(
              xpath,
              document,
              null,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null
            ).singleNodeValue;
          };

          const xpaths = [
            "//span[contains(text(), 'Napisz coś')]",
            "//span[contains(text(), 'Write something')]",
            "//div[contains(text(), 'Napisz coś')]",
            "//div[contains(text(), 'Write something')]"
          ];

          for (const xpath of xpaths) {
            const element = getElementByXpath(xpath);
            if (element) {
              let parent = element.parentElement;
              let depth = 0;
              while (parent && depth < 10) {
                if (parent.getAttribute('role') === 'button') {
                  parent.click();
                  return true;
                }
                parent = parent.parentElement;
                depth++;
              }
            }
          }
          return false;
        });

        if (clicked) {
          this.addLog(`${logPrefix} ✅ Clicked button (XPath)`, 'success', sessionId);
        } else {
          this.addLog(`${logPrefix} Button not found, trying keyboard...`, 'warning', sessionId);
          await page.keyboard.press('Tab');
          await randomDelay(500, 1000);
          await page.keyboard.press('Enter');
        }
      }

      // Wait for modal
      this.addLog(`${logPrefix} Waiting for modal...`, 'info', sessionId);
      await randomDelay(5000, 7000);

      // Find textarea in modal
      this.addLog(`${logPrefix} Looking for textarea in modal...`, 'info', sessionId);

      let textAreaFound = { found: false };
      let attempts = 0;
      const maxAttempts = 15;

      while (!textAreaFound.found && attempts < maxAttempts) {
        await randomDelay(1000, 1200);
        attempts++;

        textAreaFound = await page.evaluate((attemptNum) => {
          const modals = Array.from(document.querySelectorAll('[role="dialog"]'));

          if (modals.length === 0) {
            return { found: false, reason: 'No modals' };
          }

          for (let modalIndex = 0; modalIndex < modals.length; modalIndex++) {
            const modal = modals[modalIndex];

            const modalRect = modal.getBoundingClientRect();
            const isModalVisible = modalRect.width > 0 && modalRect.height > 0;

            if (!isModalVisible) continue;

            const textAreas = Array.from(modal.querySelectorAll('div[contenteditable="true"][role="textbox"]'));

            for (let i = 0; i < textAreas.length; i++) {
              const area = textAreas[i];
              const rect = area.getBoundingClientRect();
              const isVisible = rect.width > 0 && rect.height > 0 &&
                              rect.top >= 0 && rect.top < window.innerHeight;

              const ariaLabel = area.getAttribute('aria-label') || '';
              const placeholder = area.getAttribute('aria-placeholder') || '';
              const isCommentField = ariaLabel.toLowerCase().includes('komentarz') ||
                                    ariaLabel.toLowerCase().includes('comment') ||
                                    placeholder.toLowerCase().includes('komentarz') ||
                                    placeholder.toLowerCase().includes('comment');

              if (isVisible && !isCommentField) {
                area.setAttribute('data-post-textarea', 'true');
                return { found: true, modalIndex: modalIndex };
              }
            }
          }

          return { found: false, reason: `Checked ${modals.length} modals - no textarea found` };
        }, attempts).catch(err => {
          return { found: false, reason: `Evaluate error: ${err.message}` };
        });

        if (textAreaFound.found) {
          this.addLog(`${logPrefix} ✅ Textarea found after ${attempts} attempts (modal #${textAreaFound.modalIndex || 0})`, 'success', sessionId);
          break;
        }
      }

      if (!textAreaFound.found) {
        await this.captureErrorScreenshot(page, 'modal_textarea_not_found', accountName).catch(() => {});
        this.addLog(`${logPrefix} ❌ Debug: ${textAreaFound.reason} (after ${attempts} attempts)`, 'error', sessionId);
        throw new Error(`Textarea not found in modal: ${textAreaFound.reason}`);
      }

      // Activate textarea
      this.addLog(`${logPrefix} Activating textarea...`, 'info', sessionId);

      let activationAttempts = 0;
      let fieldActivated = null;

      while (activationAttempts < 3) {
        fieldActivated = await page.evaluate(() => {
          const area = document.querySelector('[data-post-textarea="true"]');
          if (!area) return { success: false };

          area.scrollIntoView({ behavior: 'smooth', block: 'center' });
          area.click();
          area.focus();

          return new Promise(resolve => {
            setTimeout(() => {
              const rect = area.getBoundingClientRect();
              const isFocused = document.activeElement === area;
              const isEditable = area.getAttribute('contenteditable') === 'true';

              resolve({
                success: isFocused && isEditable,
                visible: rect.width > 0 && rect.height > 0,
                focused: isFocused,
                editable: isEditable
              });
            }, 500);
          });
        });

        if (fieldActivated.success) {
          this.addLog(`${logPrefix} ✅ Field active: visible=${fieldActivated.visible}, focus=${fieldActivated.focused}, editable=${fieldActivated.editable}`, 'success', sessionId);
          break;
        }

        activationAttempts++;
        this.addLog(`${logPrefix} ⚠️ Activation attempt ${activationAttempts}/3...`, 'warning', sessionId);
        await randomDelay(1000, 1500);
      }

      if (!fieldActivated || !fieldActivated.success) {
        throw new Error('Failed to activate textarea after 3 attempts');
      }

      await randomDelay(1000, 1500);

      this.addLog(`${logPrefix} Typing post content...`, 'info', sessionId);

      // Type message using keyboard
      try {
        await page.evaluate(() => {
          const area = document.querySelector('[data-post-textarea="true"]');
          if (area) {
            area.focus();
            area.click();
          }
        });

        await randomDelay(500, 1000);

        // Type line by line
        const lines = message.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          if (line.length > 0) {
            await page.keyboard.type(line, { delay: 50 });
          }

          if (i < lines.length - 1) {
            await page.keyboard.down('Shift');
            await page.keyboard.press('Enter');
            await page.keyboard.up('Shift');
            await randomDelay(100, 200);
          }
        }

        this.addLog(`${logPrefix} ✅ Typed ${message.length} characters`, 'success', sessionId);

        // Verify text
        await randomDelay(1000, 1500);

        const verifyText = await page.evaluate(() => {
          const area = document.querySelector('[data-post-textarea="true"]');
          if (!area) return '';
          return (area.textContent || area.innerText || '').trim();
        });

        if (verifyText.length < 10) {
          throw new Error(`Text not in field - only ${verifyText.length} characters`);
        }

        this.addLog(`${logPrefix} ✅ Verification OK: ${verifyText.length} characters in field`, 'success', sessionId);

      } catch (error) {
        this.addLog(`${logPrefix} ❌ Typing error: ${error.message}`, 'error', sessionId);
        throw new Error(`Failed to type content: ${error.message}`);
      }

      // Wait 10 seconds
      this.addLog(`${logPrefix} Waiting 10 seconds...`, 'info', sessionId);
      await randomDelay(10000, 10500);

      // Find publish button
      this.addLog(`${logPrefix} Looking for publish button...`, 'info', sessionId);

      const publishClicked = await page.evaluate(() => {
        const getElementByXpath = (xpath) => {
          return document.evaluate(
            xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          ).singleNodeValue;
        };

        // Try XPath first
        const xpaths = [
          "//span[text()='Opublikuj']",
          "//span[text()='Post']",
          "//div[text()='Opublikuj']",
          "//div[text()='Post']"
        ];

        for (const xpath of xpaths) {
          const element = getElementByXpath(xpath);
          if (element) {
            let parent = element.parentElement;
            let depth = 0;
            while (parent && depth < 10) {
              if (parent.getAttribute('role') === 'button') {
                parent.click();
                return true;
              }
              parent = parent.parentElement;
              depth++;
            }
          }
        }

        // Fallback - find button in modal
        const modal = document.querySelector('[role="dialog"]');
        if (modal) {
          const buttons = Array.from(modal.querySelectorAll('div[role="button"]'));
          for (const btn of buttons) {
            const text = btn.innerText || '';
            const ariaLabel = btn.getAttribute('aria-label') || '';

            if (text.includes('Opublikuj') || text.includes('Post') ||
                ariaLabel.includes('Opublikuj') || ariaLabel.includes('Post')) {
              btn.click();
              return true;
            }
          }
        }

        return false;
      });

      if (!publishClicked) {
        throw new Error('Publish button not found');
      }

      this.addLog(`${logPrefix} ✅ Clicked publish`, 'success', sessionId);

      // Wait for publishing and check for errors
      this.addLog(`${logPrefix} ⏳ Waiting for confirmation or error...`, 'info', sessionId);
      await randomDelay(15000, 20000);

      // Check for Facebook restrictions
      const restriction = await page.evaluate(() => {
        const restrictionKeywords = [
          'ograniczeni',
          'ograniczamy liczbę',
          'liczbę publikowanych',
          'chronić społeczność',
          'temporarily blocked',
          'tymczasowo zablokowa',
          'can\'t post',
          'nie możesz publikować',
          'nie można opublikować',
          'something went wrong',
          'coś poszło nie tak',
          'try again later',
          'spróbuj później',
          'action blocked',
          'akcja zablokowana',
          'spam',
          'limit'
        ];

        const modals = Array.from(document.querySelectorAll('[role="dialog"]'));

        for (let i = 0; i < modals.length; i++) {
          const modal = modals[i];
          const rect = modal.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0;

          if (!isVisible) continue;

          const text = modal.textContent || modal.innerText || '';
          const lowerText = text.toLowerCase();

          for (const keyword of restrictionKeywords) {
            if (lowerText.includes(keyword)) {
              const errorDiv = modal.querySelector('[role="heading"]') ||
                              modal.querySelector('h2') ||
                              modal.querySelector('h3');

              const message = errorDiv ? errorDiv.textContent : text.substring(0, 300);

              return {
                detected: true,
                message: message.trim(),
                keyword: keyword
              };
            }
          }
        }

        return { detected: false };
      });

      if (restriction.detected) {
        this.addLog(`${logPrefix} 🚫 FACEBOOK RESTRICTION DETECTED!`, 'error', sessionId);
        this.addLog(`${logPrefix} 🔑 Keyword: "${restriction.keyword}"`, 'error', sessionId);
        this.addLog(`${logPrefix} 📄 Message: ${restriction.message}`, 'error', sessionId);

        await this.captureErrorScreenshot(page, 'facebook_restriction', accountName).catch(() => {});

        this.activityLimiter.markAsBanned();

        throw new Error(`Facebook restricted posting: ${restriction.message}`);
      }

      this.addLog(`${logPrefix} ✅ Post published successfully!`, 'success', sessionId);

    } catch (error) {
      this.addLog(`${logPrefix} ❌ Posting error: ${error.message}`, 'error', sessionId);

      await this.captureErrorScreenshot(page, 'posting_error', accountName).catch(() => {});

      throw error;
    }
  }

  /**
   * Find Chrome executable path
   */
  findChromePath() {
    const possiblePaths = [];

    if (os.platform() === 'darwin') {
      possiblePaths.push(
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium'
      );
    } else if (os.platform() === 'win32') {
      const programFiles = process.env['PROGRAMFILES'];
      const programFilesX86 = process.env['PROGRAMFILES(X86)'];
      const localAppData = process.env['LOCALAPPDATA'];

      possiblePaths.push(
        `${programFiles}\\Google\\Chrome\\Application\\chrome.exe`,
        `${programFilesX86}\\Google\\Chrome\\Application\\chrome.exe`,
        `${localAppData}\\Google\\Chrome\\Application\\chrome.exe`
      );
    } else {
      possiblePaths.push(
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/snap/bin/chromium'
      );
    }

    for (const chromePath of possiblePaths) {
      if (fs.existsSync(chromePath)) {
        return chromePath;
      }
    }

    return undefined;
  }

  /**
   * Stop automation
   */
  stop() {
    this.isRunning = false;
    this.currentSessionId = null;
    this.addLog('Automation stopped', 'warning');
  }
}

module.exports = new AutomationService();
