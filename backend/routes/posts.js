const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

function serializePost(row, currentUserId) {
  const likeCount = db.prepare('SELECT COUNT(*) c FROM likes WHERE post_id = ?').get(row.id).c;
  const commentCount = db.prepare('SELECT COUNT(*) c FROM comments WHERE post_id = ?').get(row.id).c;
  const likedByMe = currentUserId
    ? !!db.prepare('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?').get(row.id, currentUserId)
    : false;
  return {
    id: row.id,
    content: row.content,
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

module.exports = router;
