import { useEffect, useState } from 'react';
import api from '../api';
import i18n from '../i18n';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import OtpModal from '../components/OtpModal';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'pt', label: 'Português' },
  { code: 'zh', label: '中文' },
  { code: 'fr', label: 'Français' },
];

export default function Settings() {
  const { user, updateUser } = useAuth();
  const { t } = useTranslation();

  const [phone, setPhone] = useState(user?.phone || '');
  const [notificationsEnabled, setNotificationsEnabled] = useState(user?.notificationsEnabled ?? true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [history, setHistory] = useState([]);

  const [pendingLanguage, setPendingLanguage] = useState(null);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpChannel, setOtpChannel] = useState('');

  useEffect(() => {
    api.get('/auth/login-history').then((res) => setHistory(res.data.history));
  }, []);

  async function saveSettings(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const res = await api.patch('/users/me/settings', { phone, notificationsEnabled });
      updateUser(res.data.user);
      setMessage('Saved.');
      if (notificationsEnabled && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function requestLanguageChange(code) {
    if (code === i18n.language) return;
    setError('');
    try {
      const res = await api.post('/language/request-otp', { language: code });
      setPendingLanguage(code);
      setOtpChannel(res.data.channel);
      setOtpOpen(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not start language change');
    }
  }

  async function verifyLanguageOtp(code) {
    const res = await api.post('/language/verify-otp', { language: pendingLanguage, code });
    i18n.changeLanguage(res.data.language);
    localStorage.setItem('language', res.data.language);
    updateUser({ language: res.data.language });
    setOtpOpen(false);
  }

  return (
    <div className="feed">
      <h1 className="feed-title">{t('settings.title')}</h1>
      <form className="settings-form" onSubmit={saveSettings}>
        {message && <p className="success-text">{message}</p>}
        {error && <p className="error-text">{error}</p>}

        <label>
          {t('settings.phone')}
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+919876543210" />
        </label>

        <label className="checkbox-row">
          <input type="checkbox" checked={notificationsEnabled} onChange={(e) => setNotificationsEnabled(e.target.checked)} />
          {t('settings.notifications')}
        </label>

        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? '...' : t('settings.save')}
        </button>
      </form>

      <h2 className="section-heading">{t('settings.language')}</h2>
      <p className="muted">French requires an emailed code; other languages require a code texted to your phone.</p>
      <div className="language-grid">
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            className={`lang-btn ${i18n.language === l.code ? 'lang-btn-active' : ''}`}
            onClick={() => requestLanguageChange(l.code)}
            type="button"
          >
            {l.label}
          </button>
        ))}
      </div>

      <h2 className="section-heading">{t('profile.loginHistory')}</h2>
      <div className="login-history">
        {history.length === 0 && <p className="muted">No logins recorded yet.</p>}
        {history.map((h) => (
          <div key={h.id} className="login-history-row">
            <span>{h.browser} · {h.os} · {h.deviceType}</span>
            <span className="muted">{h.ip}</span>
            <span className="muted">{new Date(h.at).toLocaleString()}</span>
          </div>
        ))}
      </div>

      <OtpModal
        open={otpOpen}
        title="Verify language change"
        subtitle={`We sent a code via ${otpChannel === 'email' ? 'email' : 'SMS'}.`}
        onVerify={verifyLanguageOtp}
        onClose={() => setOtpOpen(false)}
      />
    </div>
  );
}
