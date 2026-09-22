import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import socket from '../socket';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import PostCard from '../components/PostCard';

export default function Profile() {
  const { username } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/users/${username}`);
      setProfile(res.data.user);
      setPosts(res.data.posts);
    } catch (err) {
      setError(err.response?.data?.error || 'User not found');
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function onFollowChanged(payload) {
      if (payload.username === username) {
        setProfile((p) => (p ? { ...p, followerCount: payload.followerCount } : p));
      }
    }
    socket.on('follow_changed', onFollowChanged);
    return () => socket.off('follow_changed', onFollowChanged);
  }, [username]);

  async function toggleFollow() {
    const res = await api.post(`/users/${username}/follow`);
    setProfile((p) => ({ ...p, followedByMe: res.data.following, followerCount: res.data.followerCount }));
  }

  function handleDeleted(id) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  if (loading) return <p className="muted feed">Loading profile...</p>;
  if (error) return <p className="error-text feed">{error}</p>;

  return (
    <div className="feed">
      <div className="profile-header">
        <Avatar displayName={profile.displayName} color={profile.avatarColor} size={72} />
        <div>
          <h1>{profile.displayName}</h1>
          <p className="post-username">@{profile.username}</p>
        </div>
        {user && user.username !== profile.username && (
          <button className={`btn ${profile.followedByMe ? 'btn-ghost' : 'btn-primary'}`} onClick={toggleFollow}>
            {profile.followedByMe ? 'Following' : 'Follow'}
          </button>
        )}
      </div>
      {profile.bio && <p className="profile-bio">{profile.bio}</p>}
      <div className="profile-stats">
        <span>
          <strong>{profile.followingCount}</strong> Following
        </span>
        <span>
          <strong>{profile.followerCount}</strong> Followers
        </span>
      </div>
      <hr className="divider" />
      {posts.length === 0 && <p className="muted">No posts yet.</p>}
      {posts.map((post) => (
        <PostCard key={post.id} post={post} onDeleted={handleDeleted} />
      ))}
    </div>
  );
}
