import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import socket from '../socket';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function PostCard({ post, onDeleted }) {
  const { user } = useAuth();
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [likedByMe, setLikedByMe] = useState(post.likedByMe);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  useEffect(() => {
    function onLiked(payload) {
      if (payload.postId === post.id) {
        setLikeCount(payload.likeCount);
        if (payload.userId === user?.id) setLikedByMe(payload.liked);
      }
    }
    function onComment(payload) {
      if (payload.postId === post.id) {
        setCommentCount(payload.commentCount);
        setComments((prev) => (showComments ? [...prev, payload.comment] : prev));
      }
    }
    socket.on('post_liked', onLiked);
    socket.on('new_comment', onComment);
    return () => {
      socket.off('post_liked', onLiked);
      socket.off('new_comment', onComment);
    };
  }, [post.id, user, showComments]);

  async function toggleLike() {
    setLikedByMe((v) => !v);
    setLikeCount((c) => (likedByMe ? c - 1 : c + 1));
    try {
      await api.post(`/posts/${post.id}/like`);
    } catch {
      setLikedByMe((v) => !v);
      setLikeCount((c) => (likedByMe ? c + 1 : c - 1));
    }
  }

  async function loadComments() {
    setShowComments((v) => !v);
    if (!showComments && comments.length === 0) {
      setLoadingComments(true);
      try {
        const res = await api.get(`/posts/${post.id}/comments`);
        setComments(res.data.comments);
      } finally {
        setLoadingComments(false);
      }
    }
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    const text = commentText;
    setCommentText('');
    await api.post(`/posts/${post.id}/comments`, { content: text });
  }

  async function deletePost() {
    if (!confirm('Delete this post?')) return;
    await api.delete(`/posts/${post.id}`);
    if (onDeleted) onDeleted(post.id);
  }

  return (
    <article className="post-card">
      <Link to={`/profile/${post.author.username}`}>
        <Avatar displayName={post.author.displayName} color={post.author.avatarColor} />
      </Link>
      <div className="post-body">
        <div className="post-header">
          <Link to={`/profile/${post.author.username}`} className="post-author">
            {post.author.displayName}
          </Link>
          <span className="post-username">@{post.author.username}</span>
          <span className="post-dot">·</span>
          <span className="post-time">{timeAgo(post.createdAt)}</span>
          {user?.username === post.author.username && (
            <button className="post-delete" onClick={deletePost} title="Delete post">
              ✕
            </button>
          )}
        </div>
        <p className="post-content">{post.content}</p>
        <div className="post-actions">
          <button className={`action-btn ${showComments ? 'active' : ''}`} onClick={loadComments}>
            💬 {commentCount}
          </button>
          <button className={`action-btn ${likedByMe ? 'liked' : ''}`} onClick={toggleLike}>
            {likedByMe ? '❤️' : '🤍'} {likeCount}
          </button>
        </div>

        {showComments && (
          <div className="comments">
            {loadingComments && <p className="muted">Loading comments...</p>}
            {comments.map((c) => (
              <div key={c.id} className="comment">
                <Avatar displayName={c.author.displayName} color={c.author.avatarColor} size={28} />
                <div>
                  <span className="comment-author">{c.author.displayName}</span>{' '}
                  <span className="post-username">@{c.author.username}</span>
                  <p className="comment-content">{c.content}</p>
                </div>
              </div>
            ))}
            {user && (
              <form className="comment-form" onSubmit={submitComment}>
                <input
                  placeholder="Post your reply"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <button className="btn btn-primary" type="submit" disabled={!commentText.trim()}>
                  Reply
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
