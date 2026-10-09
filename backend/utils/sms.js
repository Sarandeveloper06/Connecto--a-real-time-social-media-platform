// Same dev-mode pattern as mailer.js: if Twilio credentials are present we
// send a real SMS, otherwise we print it to the server console so OTP flows
// are fully testable before you connect a real SMS provider.
function isConfigured() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

let client = null;
function getClient() {
  if (!client && isConfigured()) {
    const twilio = require('twilio');
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return client;
}

async function sendSms({ to, body }) {
  if (!to) throw new Error('sendSms: "to" phone number is required');

  if (!isConfigured()) {
    console.log('\n===== [DEV MODE] SMS NOT ACTUALLY SENT (no Twilio configured) =====');
    console.log('To:', to);
    console.log(body);
    console.log('=====================================================================\n');
    return { devMode: true, sent: false };
  }

  const message = await getClient().messages.create({
    to,
    from: process.env.TWILIO_FROM_NUMBER,
    body,
  });
  return { devMode: false, sent: true, sid: message.sid };
}

module.exports = { sendSms, isConfigured };
