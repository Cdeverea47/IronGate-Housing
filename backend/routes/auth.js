const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../db');
const { JWT_SECRET, requireAuth } = require('../middleware/auth');
const { linkRecordsToUser } = require('../lib/tenantLink');
const { sendEmail } = require('../emailClient');

// Profile pictures are stored inline as base64 data URLs (rather than as
// files on disk) so they can be rendered straight into an <img src="...">
// without needing an authenticated file-serving route. Memory storage + a
// 3MB cap keeps that reasonable for a profile photo.
const avatarUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 } });

const router = express.Router();
const APP_URL = process.env.PUBLIC_APP_URL || 'http://localhost:5173';
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const TWO_FACTOR_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function generateSixDigitCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

router.post('/register', (req, res) => {
  const { name, email, password, role, accept_terms } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (!accept_terms) {
    return res.status(400).json({ error: 'You must agree to the Terms of Service and Privacy Policy' });
  }
  const resolvedRole = role === 'tenant' ? 'tenant' : 'landlord';
  const existing = db
    .prepare('SELECT id FROM users WHERE email = ? AND role = ?')
    .get(email.toLowerCase(), resolvedRole);
  if (existing) {
    return res.status(409).json({ error: `A ${resolvedRole} account with that email already exists` });
  }

  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (name, email, password_hash, role, terms_accepted_at) VALUES (?, ?, ?, ?, ?)')
    .run(name, email.toLowerCase(), hash, resolvedRole, new Date().toISOString());

  if (resolvedRole === 'tenant') {
    linkRecordsToUser(info.lastInsertRowid, email.toLowerCase());
  }

  const user = { id: info.lastInsertRowid, name, email: email.toLowerCase(), role: resolvedRole };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user });
});

router.post('/login', (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  const normalizedEmail = email.toLowerCase();

  // A person can have both a landlord and a tenant account under the same
  // email, so look up every account with that email (optionally narrowed to
  // a specific role if the client already knows which one it wants) and
  // check the password against each.
  const candidates = role
    ? db.prepare('SELECT * FROM users WHERE email = ? AND role = ?').all(normalizedEmail, role)
    : db.prepare('SELECT * FROM users WHERE email = ?').all(normalizedEmail);
  const matches = candidates.filter((row) => bcrypt.compareSync(password, row.password_hash));

  if (matches.length === 0) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (matches.length > 1) {
    // Same email + same password on both a landlord and tenant account —
    // ask which one to sign into instead of guessing.
    return res.json({ needsRoleSelection: true, roles: matches.map((m) => m.role) });
  }

  const row = matches[0];
  if (row.role === 'tenant') {
    // Catches the case where a landlord added this person as a tenant record
    // after they'd already created their tenant login.
    linkRecordsToUser(row.id, row.email);
  }

  if (row.two_factor_enabled) {
    const code = generateSixDigitCode();
    const expires = new Date(Date.now() + TWO_FACTOR_CODE_TTL_MS).toISOString();
    db.prepare('UPDATE users SET two_factor_login_code_hash = ?, two_factor_login_expires = ? WHERE id = ?').run(
      hashToken(code),
      expires,
      row.id
    );
    sendEmail({
      to: row.email,
      subject: 'Your IronGate Housing verification code',
      html: `<p>Your sign-in verification code is:</p><p style="font-size:24px;font-weight:600;">${code}</p>
        <p>This code expires in 10 minutes. If you didn't try to sign in, you can ignore this email.</p>`,
    }).catch(() => {});
    return res.json({ needsTwoFactor: true, email: row.email, role: row.role });
  }

  const user = { id: row.id, name: row.name, email: row.email, role: row.role };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user });
});

router.post('/login/verify-2fa', (req, res) => {
  const { email, role, code } = req.body;
  if (!email || !role || !code) return res.status(400).json({ error: 'email, role and code are required' });
  const normalizedEmail = email.toLowerCase();

  const row = db.prepare('SELECT * FROM users WHERE email = ? AND role = ?').get(normalizedEmail, role);
  if (
    !row ||
    !row.two_factor_login_code_hash ||
    !row.two_factor_login_expires ||
    row.two_factor_login_expires < new Date().toISOString() ||
    row.two_factor_login_code_hash !== hashToken(String(code).trim())
  ) {
    return res.status(400).json({ error: 'That code is invalid or has expired' });
  }

  db.prepare('UPDATE users SET two_factor_login_code_hash = NULL, two_factor_login_expires = NULL WHERE id = ?').run(
    row.id
  );

  const user = { id: row.id, name: row.name, email: row.email, role: row.role };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user });
});

router.post('/forgot-password', (req, res) => {
  const { email, role } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });
  const resolvedRole = role === 'tenant' ? 'tenant' : 'landlord';
  const normalizedEmail = email.toLowerCase();

  // Always respond the same way whether or not an account exists, so this
  // endpoint can't be used to check which emails are registered.
  const genericResponse = {
    message: "If an account exists for that email, we've sent password reset instructions.",
  };

  const user = db.prepare('SELECT id FROM users WHERE email = ? AND role = ?').get(normalizedEmail, resolvedRole);
  if (!user) return res.json(genericResponse);

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
  db.prepare('UPDATE users SET reset_token_hash = ?, reset_token_expires = ? WHERE id = ?').run(
    hashToken(token),
    expires,
    user.id
  );

  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  sendEmail({
    to: normalizedEmail,
    subject: 'Reset your IronGate Housing password',
    html: `<p>We received a request to reset the password on your ${resolvedRole} account.</p>
      <p><a href="${resetUrl}">Click here to choose a new password</a>. This link expires in 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>`,
  }).catch(() => {});

  res.json(genericResponse);
});

router.post('/reset-password', (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'token and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const user = db
    .prepare('SELECT * FROM users WHERE reset_token_hash = ? AND reset_token_expires > ?')
    .get(hashToken(token), new Date().toISOString());
  if (!user) return res.status(400).json({ error: 'This reset link is invalid or has expired' });

  const hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = ?').run(
    hash,
    user.id
  );
  res.json({ message: 'Password updated — you can now sign in.' });
});

const PROFILE_FIELDS = `id, name, email, role, zelle_contact, avatar_data_url, payment_method, installment_plan,
  terms_accepted_at, two_factor_enabled, email_notifications_enabled, bank_name, bank_account_name,
  bank_account_last4`;

function normalizeProfile(row) {
  return {
    ...row,
    two_factor_enabled: !!row.two_factor_enabled,
    email_notifications_enabled: !!row.email_notifications_enabled,
  };
}

router.get('/me', requireAuth, (req, res) => {
  const row = db.prepare(`SELECT ${PROFILE_FIELDS} FROM users WHERE id = ?`).get(req.user.id);
  if (!row) return res.status(404).json({ error: 'User not found' });
  res.json(normalizeProfile(row));
});

router.patch('/me', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const {
    name,
    zelle_contact,
    payment_method,
    installment_plan,
    email_notifications_enabled,
    bank_name,
    bank_account_name,
    bank_account_number,
  } = req.body;

  const validPaymentMethods = ['card', 'bank_transfer', 'zelle'];
  const validPlans = ['full', 'split2', 'split4'];

  // The full account number is never persisted — only the last 4 digits are
  // kept, purely for the tenant to recognize which account they've saved.
  // Real money movement should go through Stripe/Plaid-style tokenization,
  // not a raw account number sitting in the database.
  const last4 =
    bank_account_number !== undefined
      ? bank_account_number
        ? String(bank_account_number).replace(/\D/g, '').slice(-4) || null
        : null
      : existing.bank_account_last4;

  db.prepare(
    `UPDATE users SET
       name = ?, zelle_contact = ?, payment_method = ?, installment_plan = ?,
       email_notifications_enabled = ?, bank_name = ?, bank_account_name = ?, bank_account_last4 = ?
     WHERE id = ?`
  ).run(
    name !== undefined && name.trim() ? name.trim() : existing.name,
    zelle_contact !== undefined ? zelle_contact || null : existing.zelle_contact,
    payment_method !== undefined
      ? validPaymentMethods.includes(payment_method)
        ? payment_method
        : null
      : existing.payment_method,
    installment_plan !== undefined
      ? validPlans.includes(installment_plan)
        ? installment_plan
        : null
      : existing.installment_plan,
    email_notifications_enabled !== undefined ? (email_notifications_enabled ? 1 : 0) : existing.email_notifications_enabled,
    bank_name !== undefined ? bank_name || null : existing.bank_name,
    bank_account_name !== undefined ? bank_account_name || null : existing.bank_account_name,
    last4,
    req.user.id
  );

  const row = db.prepare(`SELECT ${PROFILE_FIELDS} FROM users WHERE id = ?`).get(req.user.id);
  res.json(normalizeProfile(row));
});

// Changing email re-issues the JWT since the email is part of its payload —
// the response includes a fresh token the frontend must swap in immediately.
router.patch('/me/email', requireAuth, (req, res) => {
  const { new_email, password } = req.body;
  if (!new_email || !password) return res.status(400).json({ error: 'new_email and password are required' });

  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(password, existing.password_hash)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  const normalizedEmail = new_email.toLowerCase().trim();
  const conflict = db
    .prepare('SELECT id FROM users WHERE email = ? AND role = ? AND id != ?')
    .get(normalizedEmail, existing.role, existing.id);
  if (conflict) {
    return res.status(409).json({ error: `A ${existing.role} account with that email already exists` });
  }

  db.prepare('UPDATE users SET email = ? WHERE id = ?').run(normalizedEmail, existing.id);

  const user = { id: existing.id, name: existing.name, email: normalizedEmail, role: existing.role };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
  const row = db.prepare(`SELECT ${PROFILE_FIELDS} FROM users WHERE id = ?`).get(existing.id);
  res.json({ token, user: normalizeProfile(row) });
});

router.patch('/me/password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'current_password and new_password are required' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current_password, existing.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ message: 'Password updated' });
});

// Email-based two-factor authentication: enabling sends a code to confirm the
// email is reachable before turning it on, so nobody locks themselves out.
router.post('/me/2fa/enable', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const code = generateSixDigitCode();
  const expires = new Date(Date.now() + TWO_FACTOR_CODE_TTL_MS).toISOString();
  db.prepare('UPDATE users SET two_factor_pending_code_hash = ?, two_factor_pending_expires = ? WHERE id = ?').run(
    hashToken(code),
    expires,
    req.user.id
  );
  sendEmail({
    to: existing.email,
    subject: 'Confirm two-factor authentication',
    html: `<p>Enter this code to turn on two-factor authentication for your IronGate Housing account:</p>
      <p style="font-size:24px;font-weight:600;">${code}</p>
      <p>This code expires in 10 minutes.</p>`,
  }).catch(() => {});
  res.json({ message: 'Verification code sent to your email' });
});

router.post('/me/2fa/confirm', requireAuth, (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code is required' });
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  if (
    !existing.two_factor_pending_code_hash ||
    !existing.two_factor_pending_expires ||
    existing.two_factor_pending_expires < new Date().toISOString() ||
    existing.two_factor_pending_code_hash !== hashToken(String(code).trim())
  ) {
    return res.status(400).json({ error: 'That code is invalid or has expired' });
  }

  db.prepare(
    `UPDATE users SET two_factor_enabled = 1, two_factor_pending_code_hash = NULL, two_factor_pending_expires = NULL
     WHERE id = ?`
  ).run(req.user.id);
  const row = db.prepare(`SELECT ${PROFILE_FIELDS} FROM users WHERE id = ?`).get(req.user.id);
  res.json(normalizeProfile(row));
});

router.post('/me/2fa/disable', requireAuth, (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'password is required' });
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(password, existing.password_hash)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }
  db.prepare(
    `UPDATE users SET two_factor_enabled = 0, two_factor_pending_code_hash = NULL, two_factor_pending_expires = NULL,
       two_factor_login_code_hash = NULL, two_factor_login_expires = NULL
     WHERE id = ?`
  ).run(req.user.id);
  const row = db.prepare(`SELECT ${PROFILE_FIELDS} FROM users WHERE id = ?`).get(req.user.id);
  res.json(normalizeProfile(row));
});

router.post('/me/avatar', requireAuth, avatarUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required' });
  if (!req.file.mimetype.startsWith('image/')) {
    return res.status(400).json({ error: 'Only image files are supported' });
  }
  const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  db.prepare('UPDATE users SET avatar_data_url = ? WHERE id = ?').run(dataUrl, req.user.id);
  const row = db.prepare(`SELECT ${PROFILE_FIELDS} FROM users WHERE id = ?`).get(req.user.id);
  res.json(normalizeProfile(row));
});

module.exports = router;
