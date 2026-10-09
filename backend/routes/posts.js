const express = require('express');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { getPlan } = require('../utils/plans');
const { verifyOtp, createAndSendOtp } = require('../utils/otp');
const { isWithinIstWindow } = require('../utils/timeWindow');

const router = express.Router();

const AUDIO_MAX_BYTES = 100 * 1024 * 1024; // 100 MB
const AUDIO_MAX_SECONDS = 5 * 60; // 5 minutes

const audioStorage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads', 'audio'),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname) || '.webm'}`),
});
const uploadAudio = multer({ storage: audioStorage, limits: { fileSize: AUDIO_MAX_BYTES } });

// Enforces each plan's daily tweet limit, resetting the counter once the
// calendar day (server local date) changes. Returns null if allowed, or an
// error message string if the user is over their plan's limit.
function checkAndConsumeTweetQuota(user) {
  const plan = getPlan(user.plan);
  const today = new Date().toISOString().slice(0, 10);
  const alreadyToday = user.tweets_posted_date === today ? user.tweets_posted_count : 0;

  if (alreadyToday >= plan.tweetLimit) {
    return `Your ${plan.label} plan allows ${plan.tweetLimit === Infinity ? 'unlimited' : plan.tweetLimit} tweet(s) per day. Upgrade your plan to post more.`;
  }

  db.prepare('UPDATE users SET tweets_posted_date = ?, tweets_posted_count = ? WHERE id = ?').run(
    today,
    alreadyToday + 1,
    user.id
  );
  return null;
}

function serializePost(row, currentUserId) {
  const likeCount = db.prepare('SELECT COUNT(*) c FROM likes WHERE post_id = ?').get(row.id).c;
  const commentCount = db.prepare('SELECT COUNT(*) c FROM comments WHERE post_id = ?').get(row.id).c;
  const likedByMe = currentUserId
    ? !!db.prepare('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?').get(row.id, currentUserId)
    : false;
  return {
    id: row.id,
    content: row.content,
    type: row.type || 'text',
    audioUrl: row.audio_path ? `/uploads/audio/${row.audio_path}` : null,
    audioSeconds: row.audio_seconds || null,
    createdAt: row.created_at,
    author: {
      id: row.user_id,
      username: row.username,
      displayName: row.display_name,
      avatarColor: row.avatar_color,
    },
    likeCount,
    commentCount,
    likedByMe,
  };
}

const feedQuery = `
  SELECT posts.*, users.username, users.display_name, users.avatar_color
  FROM posts JOIN users ON users.id = posts.user_id
`;

router.get('/', optionalAuth, (req, res) => {
  const rows = db.prepare(`${feedQuery} ORDER BY posts.created_at DESC LIMIT 100`).all();
  res.json({ posts: rows.map((r) => serializePost(r, req.user && req.user.id)) });
});

router.post('/', requireAuth, (req, res) => {
  const { content } = req.body || {};
  if (!content || !content.trim()) return res.status(400).json({ error: 'content is required' });
  if (content.length > 500) return res.status(400).json({ error: 'content must be 500 characters or fewer' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const quotaError = checkAndConsumeTweetQuota(user);
  if (quotaError) return res.status(403).json({ error: quotaError, upgradeRequired: true });

  const id = uuidv4();
  const createdAt = new Date().toISOString();
  db.prepare('INSERT INTO posts (id, user_id, content, created_at) VALUES (?, ?, ?, ?)').run(
    id,
    req.user.id,
    content.trim(),
    createdAt
  );

  const row = db.prepare(`${feedQuery} WHERE posts.id = ?`).get(id);
  const post = serializePost(row, req.user.id);

  req.app.get('io').emit('new_post', post);
  res.status(201).json({ post });
});

router.delete('/:id', requireAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'post not found' });
  if (post.user_id !== req.user.id) return res.status(403).json({ error: 'not your post' });
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  req.app.get('io').emit('post_deleted', { id: req.params.id });
  res.json({ ok: true });
});

router.post('/:id/like', requireAuth, (req, res) => {
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'post not found' });

  const existing = db.prepare('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?').get(
    req.params.id,
    req.user.id
  );

  let liked;
  if (existing) {
    db.prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?').run(req.params.id, req.user.id);
    liked = false;
  } else {
    db.prepare('INSERT INTO likes (post_id, user_id) VALUES (?, ?)').run(req.params.id, req.user.id);
    liked = true;
  }

  const likeCount = db.prepare('SELECT COUNT(*) c FROM likes WHERE post_id = ?').get(req.params.id).c;
  const payload = { postId: req.params.id, likeCount, userId: req.user.id, liked };
  req.app.get('io').emit('post_liked', payload);
  res.json(payload);
});

router.get('/:id/comments', (req, res) => {
  const rows = db
    .prepare(
      `SELECT comments.*, users.username, users.display_name, users.avatar_color
       FROM comments JOIN users ON users.id = comments.user_id
       WHERE post_id = ? ORDER BY comments.created_at ASC`
    )
    .all(req.params.id);

  res.json({
    comments: rows.map((r) => ({
      id: r.id,
      content: r.content,
      createdAt: r.created_at,
      author: { id: r.user_id, username: r.username, displayName: r.display_name, avatarColor: r.avatar_color },
    })),
  });
});

router.post('/:id/comments', requireAuth, (req, res) => {
  const { content } = req.body || {};
  if (!content || !content.trim()) return res.status(400).json({ error: 'content is required' });

  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'post not found' });

  const id = uuidv4();
  const createdAt = new Date().toISOString();
  db.prepare('INSERT INTO comments (id, post_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id,
    req.params.id,
    req.user.id,
    content.trim(),
    createdAt
  );

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const comment = {
    id,
    content: content.trim(),
    createdAt,
    author: { id: user.id, username: user.username, displayName: user.display_name, avatarColor: user.avatar_color },
  };

  const commentCount = db.prepare('SELECT COUNT(*) c FROM comments WHERE post_id = ?').get(req.params.id).c;
  req.app.get('io').emit('new_comment', { postId: req.params.id, comment, commentCount });
  res.status(201).json({ comment, commentCount });
});

// --- Audio tweets: step 1 — email OTP required before any upload is accepted. ---
router.post('/audio/request-otp', requireAuth, async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user.email) return res.status(400).json({ error: 'no email on file for verification' });

  await createAndSendOtp({
    purpose: 'audio_upload',
    channel: 'email',
    identifier: user.email,
    userId: user.id,
    subject: 'Your Connecto audio-tweet verification code',
  });
  res.json({ otpRequired: true, channel: 'email' });
});

// --- Audio tweets: step 2 — verify the code, enforce the 2-7 PM IST window,
// duration (<=5 min) and size (<=100 MB) limits, then save the post. ---
router.post('/audio', requireAuth, uploadAudio.single('audio'), async (req, res) => {
  try {
    const { code, durationSeconds, content } = req.body || {};
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    if (!req.file) return res.status(400).json({ error: 'audio file is required' });
    if (!code) return res.status(400).json({ error: 'verification code is required' });

    const otpResult = verifyOtp({ purpose: 'audio_upload', identifier: user.email, code });
    if (!otpResult.valid) return res.status(401).json({ error: 'invalid or expired verification code' });

    if (!isWithinIstWindow(14, 0, 19, 0)) {
      return res.status(403).json({ error: 'Audio tweets can only be posted between 2:00 PM and 7:00 PM IST' });
    }

    const seconds = Number(durationSeconds || 0);
    if (!seconds || seconds > AUDIO_MAX_SECONDS) {
      return res.status(400).json({ error: 'Audio must be longer than 0 seconds and no more than 5 minutes' });
    }
    // multer's limits.fileSize already rejects anything over AUDIO_MAX_BYTES before this point.

    const quotaError = checkAndConsumeTweetQuota(user);
    if (quotaError) return res.status(403).json({ error: quotaError, upgradeRequired: true });

    const id = uuidv4();
    const createdAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO posts (id, user_id, content, type, audio_path, audio_seconds, created_at)
       VALUES (?, ?, ?, 'audio', ?, ?, ?)`
    ).run(id, user.id, content || '', req.file.filename, Math.round(seconds), createdAt);

    const row = db.prepare(`${feedQuery} WHERE posts.id = ?`).get(id);
    const post = serializePost(row, user.id);
    req.app.get('io').emit('new_post', post);
    res.status(201).json({ post });
  } catch (err) {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Audio file exceeds the 100 MB limit' });
    }
    console.error(err);
    res.status(500).json({ error: 'failed to upload audio tweet' });
  }
});

module.exports = router;
