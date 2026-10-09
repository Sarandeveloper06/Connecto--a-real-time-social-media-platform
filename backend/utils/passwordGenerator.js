// Generates a random password. The original spec asked for letters only
// (no numbers/symbols); per your choice we use the safer variant: letters
// + numbers, which meaningfully increases the guessing space while staying
// simple to read and retype.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz'; // no ambiguous I/l/O/o
const DIGITS = '23456789'; // no ambiguous 0/1

function generatePassword(length = 10) {
  const pool = LETTERS + DIGITS;
  let out = '';
  // Guarantee at least one letter and one digit for predictable strength.
  out += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  out += DIGITS[Math.floor(Math.random() * DIGITS.length)];
  for (let i = 2; i < length; i++) {
    out += pool[Math.floor(Math.random() * pool.length)];
  }
  // Shuffle so the guaranteed characters aren't always in the same position.
  return out
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

module.exports = { generatePassword };
