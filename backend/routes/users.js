const express = require('express');
const db = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/:username', optionalAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(req.params.username.toLowerCase());
  if (!user) return res.status(404).json({ error: 'user not found' });

  const posts = db
    .prepare(
      `SELECT posts.*, users.username, users.display_name, users.avatar_color
       FROM posts JOIN users ON users.id = posts.user_id
       WHERE posts.user_id = ? ORDER BY posts.created_at DESC`
    )
    .all(user.id)
    .map((row) => {
      const likeCount = db.prepare('SELECT COUNT(*) c FROM likes WHERE post_id = ?').get(row.id).c;
      const commentCount = db.prepare('SELECT COUNT(*) c FROM comments WHERE post_id = ?').get(row.id).c;
      const likedByMe = req.user
        ? !!db.prepare('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?').get(row.id, req.user.id)
        : false;
      return {
        id: row.id,
        content: row.content,
        createdAt: row.created_at,
        author: { id: row.user_id, username: row.username, displayName: row.display_name, avatarColor: row.avatar_color },
        likeCount,
        commentCount,
        likedByMe,
      };
    });

  const followerCount = db.prepare('SELECT COUNT(*) c FROM follows WHERE following_id = ?').get(user.id).c;
  const followingCount = db.prepare('SELECT COUNT(*) c FROM follows WHERE follower_id = ?').get(user.id).c;
  const followedByMe = req.user
    ? !!db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').get(req.user.id, user.id)
    : false;

  res.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      bio: user.bio,
      avatarColor: user.avatar_color,
      createdAt: user.created_at,
      followerCount,
      followingCount,
      followedByMe,
    },
    posts,
  });
});

router.post('/:username/follow', requireAuth, (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE username = ?').get(req.params.username.toLowerCase());
  if (!target) return res.status(404).json({ error: 'user not found' });
  if (target.id === req.user.id) return res.status(400).json({ error: "you can't follow yourself" });

  const existing = db
    .prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?')
    .get(req.user.id, target.id);

  let following;
  if (existing) {
    db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(req.user.id, target.id);
    following = false;
  } else {
    db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').run(req.user.id, target.id);
    following = true;
  }

  const followerCount = db.prepare('SELECT COUNT(*) c FROM follows WHERE following_id = ?').get(target.id).c;
  const payload = { username: target.username, following, followerCount };
  req.app.get('io').emit('follow_changed', payload);
  res.json(payload);
});

module.exports = router;
