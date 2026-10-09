const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { PLANS, getPlan } = require('../utils/plans');
const { isWithinIstWindow } = require('../utils/timeWindow');
const { sendEmail } = require('../utils/mailer');

const router = express.Router();

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

router.get('/plans', (req, res) => {
  res.json({
    plans: Object.entries(PLANS).map(([key, p]) => ({
      key,
      label: p.label,
      priceInr: p.priceInr,
      tweetLimit: p.tweetLimit === Infinity ? 'unlimited' : p.tweetLimit,
    })),
  });
});

// Business rule: payments are only accepted between 10:00 and 11:00 AM IST.
router.post('/checkout', requireAuth, async (req, res) => {
  const { plan } = req.body || {};
  if (!plan || !PLANS[plan] || plan === 'free') {
    return res.status(400).json({ error: 'a valid paid plan (bronze, silver, gold) is required' });
  }

  if (!isWithinIstWindow(10, 0, 11, 0)) {
    return res.status(403).json({ error: 'Payments are only accepted between 10:00 AM and 11:00 AM IST. Please try again then.' });
  }

  const stripe = getStripe();
  const planConfig = getPlan(plan);
  const priceId = planConfig.stripePriceEnv ? process.env[planConfig.stripePriceEnv] : null;

  if (!stripe || !priceId) {
    return res.status(503).json({
      error: 'Payments are not configured yet. Add STRIPE_SECRET_KEY and the plan price IDs to the backend .env file.',
    });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: user.email || undefined,
    success_url: `${clientOrigin}/subscription?success=1`,
    cancel_url: `${clientOrigin}/subscription?canceled=1`,
    metadata: { userId: user.id, plan },
  });

  db.prepare(
    `INSERT INTO subscription_payments (id, user_id, plan, amount_inr, stripe_session_id, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`
  ).run(uuidv4(), user.id, plan, planConfig.priceInr, session.id, new Date().toISOString());

  res.json({ checkoutUrl: session.url });
});

// Stripe calls this URL directly once a payment succeeds. It must receive
// the RAW request body (see server.js), not JSON-parsed, so Stripe's
// signature check can verify the request really came from Stripe.
async function webhookHandler(req, res) {
  const stripe = getStripe();
  if (!stripe) return res.status(503).send('Stripe not configured');

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, plan } = session.metadata || {};
    if (userId && plan && PLANS[plan]) {
      const renewsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      db.prepare('UPDATE users SET plan = ?, plan_renews_at = ? WHERE id = ?').run(plan, renewsAt, userId);
      db.prepare(`UPDATE subscription_payments SET status = 'paid' WHERE stripe_session_id = ?`).run(session.id);

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      const planConfig = getPlan(plan);
      if (user?.email) {
        await sendEmail({
          to: user.email,
          subject: `Connecto invoice — ${planConfig.label} plan`,
          text:
            `Thanks for subscribing to Connecto!\n\n` +
            `Plan: ${planConfig.label}\n` +
            `Amount: Rs. ${planConfig.priceInr} / month\n` +
            `Daily tweet limit: ${planConfig.tweetLimit === Infinity ? 'Unlimited' : planConfig.tweetLimit}\n` +
            `Stripe session: ${session.id}\n\n` +
            `This is your invoice for this payment.`,
        });
      }
    }
  }

  res.json({ received: true });
}

module.exports = { router, webhookHandler };
