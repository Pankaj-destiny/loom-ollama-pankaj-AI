const express = require('express');
const router = express.Router();
const { getAdminStats, db } = require('../db');

const ADMIN_KEY = process.env.ADMIN_KEY || 'changeme';

router.get('/admin/stats', (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Invalid admin key. Set ?key=YOUR_ADMIN_KEY (see .env ADMIN_KEY).' });
  }
  res.json(getAdminStats());
});

router.get('/me', (req, res) => {
  const user = db.prepare('SELECT id, credits, plan, referral_code FROM users WHERE id = ?').get(req.userId);
  res.json(user);
});

// Stripe subscription checkout — INACTIVE until you add STRIPE_SECRET_KEY to .env
router.post('/create-checkout-session', async (req, res) => {
  const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_KEY) {
    return res.status(501).json({
      error: 'Payments are not configured. Add STRIPE_SECRET_KEY and STRIPE_PRICE_ID to your .env to enable subscriptions.'
    });
  }
  try {
    const stripe = require('stripe')(STRIPE_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${req.protocol}://${req.get('host')}/?checkout=success`,
      cancel_url: `${req.protocol}://${req.get('host')}/pricing.html?checkout=cancelled`,
      client_reference_id: req.userId
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Stripe error: ' + err.message });
  }
});

// Referral: visiting /r/:code sets a cookie and grants bonus credits once
router.get('/referral/:code', (req, res) => {
  const code = req.params.code;
  const referrer = db.prepare('SELECT * FROM users WHERE referral_code = ?').get(code);
  if (referrer) {
    db.prepare('UPDATE users SET credits = credits + 10 WHERE id = ?').run(req.userId);
    db.prepare('UPDATE users SET referred_by = ? WHERE id = ? AND referred_by IS NULL').run(code, req.userId);
    return res.json({ message: 'Referral applied! +10 credits.' });
  }
  res.status(404).json({ error: 'Invalid referral code' });
});

module.exports = router;
