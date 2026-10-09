const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { createAndSendOtp, verifyOtp } = require('../utils/otp');

const router = express.Router();

const SUPPORTED = ['en', 'es', 'hi', 'pt', 'zh', 'fr'];

// French requires an emailed code; every other supported language requires
// a code texted to the user's phone, per the spec.
function channelFor(lang) {
  return lang === 'fr' ? 'email' : 'sms';
}

router.post('/request-otp', requireAuth, async (req, res) => {
  const { language } = req.body || {};
  if (!SUPPORTED.includes(language)) return res.status(400).json({ error: 'unsupported language' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const channel = channelFor(language);
  const identifier = channel === 'email' ? user.email : user.phone;

  if (!identifier) {
    return res.status(400).json({
      error: channel === 'email' ? 'no email on file' : 'no phone number on file — add one in your profile first',
    });
  }

  await createAndSendOtp({
    purpose: 'language_switch',
    channel,
    identifier,
    userId: user.id,
    metadata: { language },
    subject: 'Your Connecto language-change verification code',
  });

  res.json({ otpRequired: true, channel });
});

router.post('/verify-otp', requireAuth, (req, res) => {
  const { language, code } = req.body || {};
  if (!SUPPORTED.includes(language)) return res.status(400).json({ error: 'unsupported language' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const channel = channelFor(language);
  const identifier = channel === 'email' ? user.email : user.phone;

  const result = verifyOtp({ purpose: 'language_switch', identifier, code });
  if (!result.valid) return res.status(401).json({ error: 'invalid or expired code' });

  db.prepare('UPDATE users SET language = ? WHERE id = ?').run(language, user.id);
  res.json({ ok: true, language });
});

module.exports = router;
