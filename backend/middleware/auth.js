const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing authorization token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // The account may no longer exist (e.g. the database was reset on a
    // redeploy) — treat that like an expired login instead of crashing later.
    const exists = require('../db').prepare('SELECT 1 FROM users WHERE id = ?').get(payload.id);
    if (!exists) return res.status(401).json({ error: 'Your session expired. Please log in again.' });
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: `This action requires a ${role} account` });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, JWT_SECRET };
