/**
 * Accounts Routes - Facebook accounts CRUD
 *
 * Endpoints:
 * GET    /api/accounts - List all accounts
 * GET    /api/accounts/:id - Get account by ID
 * POST   /api/accounts - Create new account
 * PUT    /api/accounts/:id - Update account
 * DELETE /api/accounts/:id - Delete account
 * PUT    /api/accounts/:id/cookies - Update cookies
 * POST   /api/accounts/:id/validate - Validate cookies
 */

const express = require('express');
const router = express.Router();
const { verifyApiToken } = require('../middleware/auth.middleware');
const Account = require('../models/Account');
const logger = require('../utils/logger');
const CryptoJS = require('crypto-js');

/**
 * Encrypt cookies
 */
function encryptCookies(cookies) {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY not set');
  }

  const cookiesJson = JSON.stringify(cookies);
  return CryptoJS.AES.encrypt(cookiesJson, encryptionKey).toString();
}

/**
 * Decrypt cookies
 */
function decryptCookies(encryptedCookies) {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY not set');
  }

  const bytes = CryptoJS.AES.decrypt(encryptedCookies, encryptionKey);
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
}

/**
 * GET /api/accounts
 * List all accounts
 */
router.get('/', async (req, res) => {
  try {
    const accounts = await Account.find().select('-cookiesEncrypted');

    res.json({
      accounts: accounts.map(acc => ({
        id: acc.id,
        name: acc.name,
        email: acc.email,
        proxy: acc.proxy,
        stats: acc.stats,
        status: acc.status,
        isReserve: acc.isReserve,
        cookiesValidation: acc.cookiesValidation,
        createdAt: acc.createdAt,
        updatedAt: acc.updatedAt
      })),
      total: accounts.length
    });

  } catch (error) {
    logger.error('[Accounts] Error listing accounts', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/accounts/:id
 * Get single account
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const account = await Account.findOne({ id });

    if (!account) {
      return res.status(404).json({
        error: 'Account not found'
      });
    }

    res.json({
      account: {
        id: account.id,
        name: account.name,
        email: account.email,
        proxy: account.proxy,
        stats: account.stats,
        status: account.status,
        isReserve: account.isReserve,
        cookiesValidation: account.cookiesValidation,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt
      }
    });

  } catch (error) {
    logger.error('[Accounts] Error getting account', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/accounts
 * Create new account
 */
router.post('/', verifyApiToken, async (req, res) => {
  try {
    const { id, name, email, cookies, proxy, isReserve } = req.body;

    // Validation
    if (!id || !name || !email || !cookies) {
      return res.status(400).json({
        error: 'id, name, email, and cookies are required'
      });
    }

    // Check if account already exists
    const existing = await Account.findOne({ id });
    if (existing) {
      return res.status(400).json({
        error: 'Account with this ID already exists'
      });
    }

    // Encrypt cookies
    const cookiesEncrypted = encryptCookies(cookies);

    const account = new Account({
      id,
      name,
      email,
      cookiesEncrypted,
      proxy: proxy || null,
      isReserve: isReserve || false,
      cookiesValidation: {
        lastValidated: null,
        isValid: false,
        lastRefreshed: null,
        nextRefreshDue: null
      },
      status: 'active'
    });

    await account.save();

    logger.info('[Accounts] Account created', { accountId: id, name });

    res.json({
      success: true,
      message: 'Account created',
      account: {
        id: account.id,
        name: account.name,
        email: account.email,
        proxy: account.proxy,
        status: account.status,
        isReserve: account.isReserve
      }
    });

  } catch (error) {
    logger.error('[Accounts] Error creating account', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/accounts/:id
 * Update account
 */
router.put('/:id', verifyApiToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, proxy, status, isReserve } = req.body;

    const account = await Account.findOne({ id });

    if (!account) {
      return res.status(404).json({
        error: 'Account not found'
      });
    }

    // Update fields
    if (name) account.name = name;
    if (email) account.email = email;
    if (proxy !== undefined) account.proxy = proxy;
    if (status) account.status = status;
    if (isReserve !== undefined) account.isReserve = isReserve;

    await account.save();

    logger.info('[Accounts] Account updated', { accountId: id });

    res.json({
      success: true,
      message: 'Account updated',
      account: {
        id: account.id,
        name: account.name,
        email: account.email,
        proxy: account.proxy,
        status: account.status,
        isReserve: account.isReserve
      }
    });

  } catch (error) {
    logger.error('[Accounts] Error updating account', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/accounts/:id/cookies
 * Update account cookies
 */
router.put('/:id/cookies', verifyApiToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { cookies } = req.body;

    if (!cookies) {
      return res.status(400).json({
        error: 'cookies are required'
      });
    }

    const account = await Account.findOne({ id });

    if (!account) {
      return res.status(404).json({
        error: 'Account not found'
      });
    }

    // Encrypt and update cookies
    account.cookiesEncrypted = encryptCookies(cookies);
    account.cookiesValidation.lastRefreshed = new Date();
    account.cookiesValidation.isValid = true;

    // Set next refresh due (3-7 days)
    const daysUntilRefresh = 3 + Math.floor(Math.random() * 5);
    account.cookiesValidation.nextRefreshDue = new Date(Date.now() + daysUntilRefresh * 24 * 60 * 60 * 1000);

    await account.save();

    logger.info('[Accounts] Cookies updated', { accountId: id });

    res.json({
      success: true,
      message: 'Cookies updated',
      cookiesValidation: account.cookiesValidation
    });

  } catch (error) {
    logger.error('[Accounts] Error updating cookies', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/accounts/:id/validate
 * Validate cookies (TODO: implement actual validation)
 */
router.post('/:id/validate', verifyApiToken, async (req, res) => {
  try {
    const { id } = req.params;

    const account = await Account.findOne({ id });

    if (!account) {
      return res.status(404).json({
        error: 'Account not found'
      });
    }

    // TODO: Implement actual cookie validation
    // For now, just mark as validated
    account.cookiesValidation.lastValidated = new Date();
    account.cookiesValidation.isValid = true;

    await account.save();

    logger.info('[Accounts] Cookies validated', { accountId: id });

    res.json({
      success: true,
      message: 'Cookies validated',
      isValid: true,
      lastValidated: account.cookiesValidation.lastValidated
    });

  } catch (error) {
    logger.error('[Accounts] Error validating cookies', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/accounts/:id
 * Delete account
 */
router.delete('/:id', verifyApiToken, async (req, res) => {
  try {
    const { id } = req.params;

    const account = await Account.findOne({ id });

    if (!account) {
      return res.status(404).json({
        error: 'Account not found'
      });
    }

    await Account.deleteOne({ id });

    logger.info('[Accounts] Account deleted', { accountId: id });

    res.json({
      success: true,
      message: 'Account deleted'
    });

  } catch (error) {
    logger.error('[Accounts] Error deleting account', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/accounts/:id/cookies
 * Get decrypted cookies (admin only, careful!)
 */
router.get('/:id/cookies', verifyApiToken, async (req, res) => {
  try {
    const { id } = req.params;

    const account = await Account.findOne({ id });

    if (!account) {
      return res.status(404).json({
        error: 'Account not found'
      });
    }

    // Decrypt cookies
    const cookies = decryptCookies(account.cookiesEncrypted);

    res.json({
      accountId: id,
      cookies
    });

  } catch (error) {
    logger.error('[Accounts] Error getting cookies', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
