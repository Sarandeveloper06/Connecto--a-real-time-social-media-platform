const nodemailer = require('nodemailer');

// If real SMTP credentials are configured, we send real email.
// If not, we fall back to printing the email to the server console.
// This is a standard local-dev pattern (not fake data) so you can fully
// test OTP/invoice flows before wiring up a real email provider like
// SendGrid, Mailgun, or Gmail SMTP.
function isConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter = null;
function getTransporter() {
  if (!transporter && isConfigured()) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

async function sendEmail({ to, subject, text, html }) {
  if (!to) throw new Error('sendEmail: "to" address is required');

  if (!isConfigured()) {
    console.log('\n===== [DEV MODE] EMAIL NOT ACTUALLY SENT (no SMTP configured) =====');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log(text || html);
    console.log('====================================================================\n');
    return { devMode: true, sent: false };
  }

  const info = await getTransporter().sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
  return { devMode: false, sent: true, messageId: info.messageId };
}

module.exports = { sendEmail, isConfigured };
