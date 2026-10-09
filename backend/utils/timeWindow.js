// India Standard Time is a fixed UTC+5:30 offset (no daylight saving),
// so we can compute it directly from the UTC clock without a timezone
// database or extra dependency.
function getIstParts(date = new Date()) {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
  const istMs = utcMs + 5.5 * 60 * 60000;
  const ist = new Date(istMs);
  return { hour: ist.getHours(), minute: ist.getMinutes() };
}

// Returns true if the current IST time falls within [startHour:startMin, endHour:endMin).
function isWithinIstWindow(startHour, startMin, endHour, endMin, date = new Date()) {
  const { hour, minute } = getIstParts(date);
  const nowMinutes = hour * 60 + minute;
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  return nowMinutes >= startMinutes && nowMinutes < endMinutes;
}

function formatIstNow(date = new Date()) {
  const { hour, minute } = getIstParts(date);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} IST`;
}

module.exports = { isWithinIstWindow, formatIstNow, getIstParts };
