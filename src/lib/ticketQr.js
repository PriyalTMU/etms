// T33 / T42 / US24: QR code for each ticket.
// The QR code holds only the ticket code (e.g. ETMS-7KQ2-M9XD-4HPA) - no personal data -
// so a volunteer's scanner in Sprint 3 can read it and look the ticket up.
// Generated on the server as an SVG, so it works offline and needs no outside service.
const QRCode = require('qrcode');

const QR_OPTIONS = Object.freeze({
  type: 'svg',
  errorCorrectionLevel: 'M', // still scans if part of the code is scratched / glared
  margin: 2,
  width: 240,
  color: { dark: '#111111', light: '#ffffff' },
});

/** SVG markup for a ticket's QR code. */
function ticketQrSvg(ticketCode) {
  return QRCode.toString(ticketCode, QR_OPTIONS);
}

module.exports = { ticketQrSvg, QR_OPTIONS };
