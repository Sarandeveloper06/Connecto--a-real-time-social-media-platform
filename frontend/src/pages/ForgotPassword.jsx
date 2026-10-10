import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useTranslation } from 'react-i18next';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post('/auth/forgot-password', { identifier });
      setMessage(res.data.message);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h1>{t('forgot.title')}</h1>
        <p className="muted">{t('forgot.onceDailyNotice')}</p>
        {error && <p className="error-text">{error}</p>}
        {message && <p className="success-text">{message}</p>}
        <label>
          {t('forgot.identifierLabel')}
          <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required placeholder="you@example.com or +919876543210" />
        </label>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? '...' : t('forgot.submitButton')}
        </button>
        <p className="muted">
          <Link to="/login">‹ {t('forgot.backToLogin')}</Link>
        </p>
      </form>
    </div>
  );
}
