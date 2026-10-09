const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { sendEmail } = require('./mailer');
const { sendSms } = require('./sms');

const OTP_TTL_MINUTES = 10;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

// purpose: a string namespace like 'login', 'password_reset', 'audio_upload', 'language_switch'
// channel: 'email' | 'sms'
// identifier: the email address or phone number the code was sent to
async function createAndSendOtp({ purpose, channel, identifier, userId = null, metadata = null, subject, message }) {
  const code = generateCode();
  const codeHash = bcrypt.hashSync(code, 8);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60000).toISOString();

  db.prepare(
    `INSERT INTO otp_codes (id, purpose, identifier, code_hash, user_id, metadata, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(uuidv4(), purpose, identifier, codeHash, userId, metadata ? JSON.stringify(metadata) : null, expiresAt, new Date().toISOString());

  const text = message || `Your Connecto verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`;

  if (channel === 'email') {
    await sendEmail({ to: identifier, subject: subject || 'Your Connecto verification code', text });
  } else if (channel === 'sms') {
    await sendSms({ to: identifier, body: text });
  } else {
    throw new Error(`Unknown OTP channel: ${channel}`);
  }

  return { expiresAt };
}

// Verifies the most recent unconsumed OTP for this purpose+identifier.
// Returns { valid: boolean, metadata } and marks it consumed on success.
function verifyOtp({ purpose, identifier, code }) {
  const row = db
    .prepare(
      `SELECT * FROM otp_codes
       WHERE purpose = ? AND identifier = ? AND consumed_at IS NULL
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(purpose, identifier);

  if (!row) return { valid: false, reason: 'no_pending_code' };
  if (new Date(row.expires_at).getTime() < Date.now()) return { valid: false, reason: 'expired' };
  if (!bcrypt.compareSync(code, row.code_hash)) return { valid: false, reason: 'incorrect_code' };

  db.prepare('UPDATE otp_codes SET consumed_at = ? WHERE id = ?').run(new Date().toISOString(), row.id);
  return { valid: true, metadata: row.metadata ? JSON.parse(row.metadata) : null, userId: row.user_id };
}

module.exports = { createAndSendOtp, verifyOtp, OTP_TTL_MINUTES };
