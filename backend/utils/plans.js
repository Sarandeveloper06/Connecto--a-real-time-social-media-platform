// Central definition of subscription plans: tweet limits, price, and the
// Stripe Price ID each plan maps to (set these in .env once you create
// matching Prices in your Stripe Dashboard).
const PLANS = {
  free:   { label: 'Free',   tweetLimit: 1,        priceInr: 0,    stripePriceEnv: null },
  bronze: { label: 'Bronze', tweetLimit: 3,        priceInr: 100,  stripePriceEnv: 'STRIPE_PRICE_BRONZE' },
  silver: { label: 'Silver', tweetLimit: 5,        priceInr: 300,  stripePriceEnv: 'STRIPE_PRICE_SILVER' },
  gold:   { label: 'Gold',   tweetLimit: Infinity, priceInr: 1000, stripePriceEnv: 'STRIPE_PRICE_GOLD' },
};

function getPlan(key) {
  return PLANS[key] || PLANS.free;
}

module.exports = { PLANS, getPlan };
