const { UAParser } = require('ua-parser-js');

// Reads browser, OS, and device type from the request's User-Agent header,
// and the client IP. IMPORTANT: these values are self-reported by the
// visitor's own browser and can be trivially changed by anyone, so they
// must never be used to grant or skip authentication (see README security
// notes). Here they're used only for display in the user's login history.
function getDeviceInfo(req) {
  const uaString = req.headers['user-agent'] || '';
  const parser = new UAParser(uaString);
  const result = parser.getResult();

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown';

  return {
    browser: result.browser.name || 'Unknown',
    os: result.os.name || 'Unknown',
    deviceType: result.device.type || 'desktop', // ua-parser leaves this undefined for desktop
    ip,
  };
}

module.exports = { getDeviceInfo };
