/**
 * Authentication Middleware
 *
 * Supports:
 * - Bearer token authentication
 * - API token from n8n webhooks
 */

const jwt = require('jsonwebtoken');

/**
 * Verify Bearer token (JWT)
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({
      error: 'No authorization header provided'
    });
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : authHeader;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      error: 'Invalid or expired token',
      details: error.message
    });
  }
}

/**
 * Verify API token (simpler, for n8n webhooks)
 */
function verifyApiToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const apiToken = process.env.API_TOKEN;

  if (!apiToken) {
    // If no API_TOKEN set, allow all (development mode)
    if (process.env.NODE_ENV === 'development') {
      return next();
    }
    return res.status(500).json({
      error: 'API_TOKEN not configured on server'
    });
  }

  if (!authHeader) {
    return res.status(401).json({
      error: 'No authorization header provided'
    });
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : authHeader;

  if (token !== apiToken) {
    return res.status(403).json({
      error: 'Invalid API token'
    });
  }

  next();
}

/**
 * Optional authentication - doesn't fail if no token
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    req.user = null;
    return next();
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : authHeader;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch (error) {
    req.user = null;
  }

  next();
}

/**
 * Generate JWT token (for login)
 */
function generateToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

module.exports = {
  verifyToken,
  verifyApiToken,
  optionalAuth,
  generateToken
};
