// T58 / T59 / US32: turn whatever the volunteer typed or the QR code contained into a ticket code.
// Accepts the exact code, lower case, extra spaces, missing dashes ("etms 7kq2 m9xd 4hpa"),
// and a QR payload with stray whitespace. Anything else is reported as unreadable.
const { isTicketCode } = require('./ticketCode');

function normalizeTicketInput(raw) {
  if (typeof raw !== 'string') return null;
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^ETMS[A-Z0-9]{12}$/.test(compact)) return null;
  const code = `ETMS-${compact.slice(4, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}`;
  return isTicketCode(code) ? code : null;
}

module.exports = { normalizeTicketInput };
