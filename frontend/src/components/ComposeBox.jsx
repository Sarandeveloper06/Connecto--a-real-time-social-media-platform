import { useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';

export default function ComposeBox({ onPosted }) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!content.trim()) return;
    setPosting(true);
    setError('');
    try {
      await api.post('/posts', { content });
      setContent('');
      if (onPosted) onPosted();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to post');
    } finally {
      setPosting(false);
    }
  }

  return (
    <form className="compose-box" onSubmit={submit}>
      <Avatar displayName={user.displayName} color={user.avatarColor} />
      <div className="compose-fields">
        <textarea
          placeholder="What's happening?"
          value={content}
          maxLength={500}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
        />
        <div className="compose-footer">
          {error && <span className="error-text">{error}</span>}
          <span className="char-count">{content.length}/500</span>
          <button className="btn btn-primary" type="submit" disabled={posting || !content.trim()}>
            {posting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>
    </form>
  );
}
