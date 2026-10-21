// T41 / US23: unique ticket identifiers.
// Format: ETMS-XXXX-XXXX-XXXX - 12 random characters from a 31-character alphabet with no
// look-alike characters (no 0/O, 1/I/L), so codes are easy to read out at the door.
// 31^12 ≈ 7.9 × 10^17 possible codes, so a valid code can't be guessed. The database
// also has a UNIQUE rule on ticket_code, and the model retries if a code ever repeats.
const crypto = require('node:crypto');

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const GROUPS = 3;
const GROUP_LEN = 4;
const CODE_PATTERN = new RegExp(`^ETMS(-[${ALPHABET}]{${GROUP_LEN}}){${GROUPS}}$`);

/** Random ticket code using the crypto random generator (not Math.random). */
function generateTicketCode() {
  const chars = [];
  // Rejection sampling keeps every character equally likely (248 = 31 × 8).
  while (chars.length < GROUPS * GROUP_LEN) {
    for (const byte of crypto.randomBytes(16)) {
      if (byte < 248 && chars.length < GROUPS * GROUP_LEN) chars.push(ALPHABET[byte % ALPHABET.length]);
    }
  }
  const groups = [];
  for (let i = 0; i < GROUPS; i++) groups.push(chars.slice(i * GROUP_LEN, (i + 1) * GROUP_LEN).join(''));
  return `ETMS-${groups.join('-')}`;
}

/** True if a string looks like a ticket code (used before any database lookup). */
function isTicketCode(value) {
  return typeof value === 'string' && CODE_PATTERN.test(value);
}

module.exports = { generateTicketCode, isTicketCode, ALPHABET };
