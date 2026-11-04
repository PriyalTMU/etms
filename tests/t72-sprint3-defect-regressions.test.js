// T72 - regression checks for the defects found in Sprint 3 integration testing (D10-D12)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, request } = require('./helpers');

describe('T72 Sprint 3 defect regressions', () => {
  const { app } = makeTestApp();

  test('D10: a QR code that stays in front of the camera is not re-scanned as "already used"', async () => {
    const js = (await request(app).get('/js/checkin-scan.js')).text;
    assert.match(js, /CAMERA_REPEAT_MS = 60000/);
    assert.match(js, /cameraSeen\[text\] && nowMs - cameraSeen\[text\] < CAMERA_REPEAT_MS/);
  });

  test('D11: the ticket-code box has a short placeholder with the format explained underneath', async () => {
    const page = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'src', 'pages', 'checkin', 'scan.html'), 'utf8');
    assert.match(page, /placeholder="Type ticket code"/);
    assert.match(page, /id="code-hint"/);
  });

  test('D12: the attendance table fits a phone (Registered column hidden under 560px)', async () => {
    const css = (await request(app).get('/css/styles.css')).text;
    assert.match(css, /\.data-table th:nth-child\(3\), \.data-table td:nth-child\(3\) \{ display: none; \}/);
  });
});
