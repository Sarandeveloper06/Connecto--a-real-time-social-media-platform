import { useEffect, useState, useCallback } from 'react';
import api from '../api';
import socket from '../socket';
import { useAuth } from '../context/AuthContext';
import ComposeBox from '../components/ComposeBox';
import PostCard from '../components/PostCard';

export default function Home() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadFeed = useCallback(async () => {
    const res = await api.get('/posts');
    setPosts(res.data.posts);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    function onNewPost(post) {
      setPosts((prev) => {
        if (prev.some((p) => p.id === post.id)) return prev;
        return [post, ...prev];
      });
    }
    function onDeleted({ id }) {
      setPosts((prev) => prev.filter((p) => p.id !== id));
    }
    socket.on('new_post', onNewPost);
    socket.on('post_deleted', onDeleted);
    return () => {
      socket.off('new_post', onNewPost);
      socket.off('post_deleted', onDeleted);
    };
  }, []);

  function handleDeleted(id) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="feed">
      <h1 className="feed-title">Home</h1>
      {user && <ComposeBox onPosted={loadFeed} />}
      {loading && <p className="muted">Loading feed...</p>}
      {!loading && posts.length === 0 && <p className="muted">No posts yet. Be the first to post!</p>}
      {posts.map((post) => (
        <PostCard key={post.id} post={post} onDeleted={handleDeleted} />
      ))}
    </div>
  );
}
