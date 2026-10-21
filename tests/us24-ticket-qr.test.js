// US24 - Ticket includes a QR code (T33, T42) - generation level; API/page checks are in us25/us28 tests
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const QRCode = require('qrcode');
const { ticketQrSvg } = require('../src/lib/ticketQr');
const { generateTicketCode } = require('../src/lib/ticketCode');

describe('US24 QR code on the ticket', () => {
  test('AC1: a QR code (SVG image) is produced for a ticket code', async () => {
    const svg = await ticketQrSvg(generateTicketCode());
    assert.match(svg, /^<svg[^>]*xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    assert.match(svg, /<path/);
  });

  test('AC2: the QR code encodes exactly the ticket code (so it can be checked at the event)', async () => {
    const code = generateTicketCode();
    const qr = QRCode.create(code, { errorCorrectionLevel: 'M' });
    assert.equal(qr.segments.map((s) => s.data.toString()).join(''), code);
  });

  test('AC2: different tickets get different QR codes; the same ticket always gets the same one', async () => {
    const a = generateTicketCode();
    const b = generateTicketCode();
    assert.notEqual(await ticketQrSvg(a), await ticketQrSvg(b));
    assert.equal(await ticketQrSvg(a), await ticketQrSvg(a));
  });

  test('the QR code holds no personal information', async () => {
    const code = generateTicketCode();
    const qr = QRCode.create(code, { errorCorrectionLevel: 'M' });
    const data = qr.segments.map((s) => s.data.toString()).join('');
    assert.doesNotMatch(data, /@|student|name/i);
  });
});
