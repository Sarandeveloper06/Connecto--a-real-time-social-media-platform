const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { createAndSendOtp, verifyOtp } = require('../utils/otp');
const { generatePassword } = require('../utils/passwordGenerator');
const { getDeviceInfo } = require('../utils/deviceInfo');
const { isWithinIstWindow } = require('../utils/timeWindow');
const { sendEmail } = require('../utils/mailer');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9]{7,15}$/;

function toPublicUser(u) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    bio: u.bio,
    avatarColor: u.avatar_color,
    email: u.email,
    phone: u.phone,
    plan: u.plan,
    language: u.language,
    notificationsEnabled: !!u.notifications_enabled,
    createdAt: u.created_at,
  };
}

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

router.post('/register', (req, res) => {
  const { username, password, displayName, email, phone } = req.body || {};

  if (!username || !password || !displayName || !email) {
    return res.status(400).json({ error: 'username, password, displayName and email are required' });
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: 'username must be 3-20 chars, letters/numbers/underscore only' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'a valid email is required (used for login verification codes)' });
  }
  if (phone && !PHONE_RE.test(phone)) {
    return res.status(400).json({ error: 'phone must be digits only, optionally starting with +' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.toLowerCase());
  if (existing) return res.status(409).json({ error: 'username already taken' });

  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);
  const colors = ['#1d9bf0', '#00ba7c', '#f91880', '#ffad1f', '#7856ff'];
  const avatarColor = colors[Math.floor(Math.random() * colors.length)];
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO users (id, username, display_name, password_hash, avatar_color, email, phone, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, username.toLowerCase(), displayName, passwordHash, avatarColor, email.toLowerCase(), phone || null, createdAt);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  const token = signToken(user);
  res.status(201).json({ token, user: toPublicUser(user) });
});

// --- Login: step 1 — verify password, then always send an email OTP. ---
// SECURITY NOTE: the original spec asked to skip this step for "Microsoft
// browsers" based on User-Agent. That header is self-reported by the client
// and can be edited freely, so it can't be trusted as an auth signal — we
// apply the OTP requirement to every login instead, and only use browser/OS
// for the login-history display below.
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'invalid username or password' });
  }
  if (!user.email) {
    return res.status(400).json({ error: 'this account has no email on file for verification codes' });
  }

  await createAndSendOtp({
    purpose: 'login',
    channel: 'email',
    identifier: user.email,
    userId: user.id,
    subject: 'Your Connecto login code',
  });

  res.json({ otpRequired: true, channel: 'email', destinationHint: maskEmail(user.email) });
});

// --- Login: step 2 — verify the emailed code, apply the mobile time-window rule, log in. ---
router.post('/login/verify-otp', (req, res) => {
  const { username, code } = req.body || {};
  if (!username || !code) return res.status(400).json({ error: 'username and code are required' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.toLowerCase());
  if (!user) return res.status(404).json({ error: 'user not found' });

  const result = verifyOtp({ purpose: 'login', identifier: user.email, code });
  if (!result.valid) {
    return res.status(401).json({ error: 'invalid or expired code' });
  }

  const device = getDeviceInfo(req);

  // Business rule: logins from mobile devices are only allowed 10:00-13:00 IST.
  if (device.deviceType === 'mobile' && !isWithinIstWindow(10, 0, 13, 0)) {
    return res.status(403).json({ error: 'mobile login is only allowed between 10:00 AM and 1:00 PM IST' });
  }

  db.prepare(
    `INSERT INTO login_history (id, user_id, browser, os, device_type, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(uuidv4(), user.id, device.browser, device.os, device.deviceType, device.ip, new Date().toISOString());

  const token = signToken(user);
  res.json({ token, user: toPublicUser(user) });
});

router.get('/login-history', require('../middleware/auth').requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT * FROM login_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(req.user.id);
  res.json({
    history: rows.map((r) => ({
      id: r.id,
      browser: r.browser,
      os: r.os,
      deviceType: r.device_type,
      ip: r.ip_address,
      at: r.created_at,
    })),
  });
});

// --- Forgot password: reset via email or phone, once per calendar day. ---
router.post('/forgot-password', async (req, res) => {
  const { identifier } = req.body || {};
  if (!identifier) return res.status(400).json({ error: 'email or phone is required' });

  const isEmail = EMAIL_RE.test(identifier);
  const isPhone = PHONE_RE.test(identifier);
  if (!isEmail && !isPhone) {
    return res.status(400).json({ error: 'enter a valid email address or phone number' });
  }

  const user = isEmail
    ? db.prepare('SELECT * FROM users WHERE email = ?').get(identifier.toLowerCase())
    : db.prepare('SELECT * FROM users WHERE phone = ?').get(identifier);

  // Don't reveal whether the account exists.
  if (!user) return res.json({ ok: true, message: 'If that account exists, a new password has been sent.' });

  const today = new Date().toISOString().slice(0, 10);
  if (user.last_password_reset_date === today) {
    return res.status(429).json({ error: 'You can use this option only one time per day.' });
  }

  const newPassword = generatePassword(10);
  const passwordHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, last_password_reset_date = ? WHERE id = ?').run(
    passwordHash,
    today,
    user.id
  );

  const text = `Your Connecto password has been reset. Your new temporary password is: ${newPassword}\n\nPlease log in and change it from your profile.`;
  if (isEmail) {
    await sendEmail({ to: user.email, subject: 'Your new Connecto password', text });
  } else {
    const { sendSms } = require('../utils/sms');
    await sendSms({ to: user.phone, body: text });
  }

  res.json({ ok: true, message: 'If that account exists, a new password has been sent.' });
});

router.get('/me', require('../middleware/auth').requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'user not found' });
  res.json({ user: toPublicUser(user) });
});

function maskEmail(email) {
  const [name, domain] = email.split('@');
  if (name.length <= 2) return `${name[0]}***@${domain}`;
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(name.length - 2, 3))}@${domain}`;
}

module.exports = router;
