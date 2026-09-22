const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

function toPublicUser(u) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    bio: u.bio,
    avatarColor: u.avatar_color,
    createdAt: u.created_at,
  };
}

router.post('/register', (req, res) => {
  const { username, password, displayName } = req.body || {};

  if (!username || !password || !displayName) {
    return res.status(400).json({ error: 'username, password and displayName are required' });
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: 'username must be 3-20 chars, letters/numbers/underscore only' });
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
    'INSERT INTO users (id, username, display_name, password_hash, avatar_color, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, username.toLowerCase(), displayName, passwordHash, avatarColor, createdAt);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user: toPublicUser(user) });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'invalid username or password' });
  }
  const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: toPublicUser(user) });
});

router.get('/me', require('../middleware/auth').requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'user not found' });
  res.json({ user: toPublicUser(user) });
});

module.exports = router;
