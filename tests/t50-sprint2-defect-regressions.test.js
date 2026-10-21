// T50 - regression checks for the defects found in Sprint 2 integration testing (D7-D9)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, request } = require('./helpers');

describe('T50 Sprint 2 defect regressions', () => {
  const { app } = makeTestApp();

  test('D7: ticket code on My Tickets has space before "Open ticket"', async () => {
    const css = (await request(app).get('/css/styles.css')).text;
    assert.match(css, /\.ticket-code \{[^}]*margin-right: 16px/);
  });

  test('D8: QR code and ticket code are centred on their own lines on the ticket page', async () => {
    const css = (await request(app).get('/css/styles.css')).text;
    assert.match(css, /\.qr-wrap img \{[^}]*display: block; margin: 0 auto/);
    assert.match(css, /\.qr-wrap \.ticket-code \{[^}]*display: block/);
  });

  test('D9: the disabled "Event full" button does not show the busy cursor', async () => {
    const css = (await request(app).get('/css/styles.css')).text;
    assert.match(css, /\.btn:disabled\.is-full \{[^}]*cursor: not-allowed/);
    const js = (await request(app).get('/js/event-details.js')).text;
    assert.match(js, /'btn big is-full', 'Event full'/);
  });
});
