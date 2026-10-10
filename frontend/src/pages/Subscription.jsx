import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

export default function Subscription() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState('');
  const [loadingPlan, setLoadingPlan] = useState(null);

  useEffect(() => {
    api.get('/subscriptions/plans').then((res) => setPlans(res.data.plans));
  }, []);

  async function choosePlan(key) {
    setError('');
    setLoadingPlan(key);
    try {
      const res = await api.post('/subscriptions/checkout', { plan: key });
      window.location.href = res.data.checkoutUrl;
    } catch (err) {
      setError(err.response?.data?.error || 'Checkout failed');
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div className="feed">
      <h1 className="feed-title">{t('subscription.title')}</h1>
      <div style={{ padding: '12px 16px' }}>
        {searchParams.get('success') && <p className="success-text">Payment received! Your plan will update shortly.</p>}
        {searchParams.get('canceled') && <p className="muted">Checkout canceled.</p>}
        <p className="muted">{t('subscription.paymentWindowNotice')}</p>
        {error && <p className="error-text">{error}</p>}
        <p>
          {t('subscription.currentPlan')}: <strong>{user?.plan?.toUpperCase() || 'FREE'}</strong>
        </p>

        <div className="plan-grid">
          {plans.map((p) => (
            <div key={p.key} className={`plan-card ${user?.plan === p.key ? 'plan-card-active' : ''}`}>
              <h3>{p.label}</h3>
              <p className="plan-price">{p.priceInr === 0 ? 'Free' : `₹${p.priceInr}/mo`}</p>
              <p className="muted">{p.tweetLimit === 'unlimited' ? t('subscription.unlimited') : `${p.tweetLimit} ${t('subscription.tweetsPerDay')}`}</p>
              {p.key !== 'free' && (
                <button className="btn btn-primary" disabled={loadingPlan === p.key} onClick={() => choosePlan(p.key)}>
                  {loadingPlan === p.key ? '...' : t('subscription.choosePlan')}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
