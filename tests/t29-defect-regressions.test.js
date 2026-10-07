// T29 - regression tests for defects found during integration testing (Oct 7)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTestApp, loginOrganizer, request } = require('./helpers');
const { nodeVersionOk } = require('../src/db/database');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

describe('T29 defect regressions', () => {
  const { app } = makeTestApp();

  test('D1: long unbroken words wrap instead of overflowing on phones', () => {
    assert.match(read('public/css/styles.css'), /overflow-wrap: anywhere/);
  });

  test('D2: organizer pages and API data are never cached by the browser', async () => {
    const agent = await loginOrganizer(app);
    for (const url of ['/organizer', '/organizer/events/new', '/api/organizer/events', '/api/auth/me']) {
      const res = await agent.get(url).expect(200);
      assert.match(res.headers['cache-control'], /no-store/, `${url} has no-store`);
    }
    assert.match(read('public/js/organizer-common.js'), /pageshow[\s\S]*persisted[\s\S]*reload/);
  });

  test('D2: after logout, reloading an organizer page goes to login', async () => {
    const agent = await loginOrganizer(app);
    await agent.post('/api/auth/logout').expect(200);
    const res = await agent.get('/organizer').expect(302);
    assert.match(res.headers.location, /^\/organizer\/login/);
  });

  test('D3: home page shows who is logged in', async () => {
    const res = await request(app).get('/').expect(200);
    assert.match(res.text, /id="site-who"/);
    assert.match(res.text, /src="\/js\/site-common.js"/);
  });

  test('D4: organizer dashboard links each event to the student view', () => {
    assert.match(read('public/js/organizer-dashboard.js'), /'\/events\/' \+ encodeURIComponent\(ev\.id\)/);
  });

  test('D5: unknown pages get a styled, helpful 404 page', async () => {
    const res = await request(app).get('/no-such-page').expect(404);
    assert.match(res.text, /Page not found/);
    assert.match(res.text, /href="\/events"/);
    const api = await request(app).get('/api/no-such-thing').expect(404);
    assert.equal(api.body.error, 'Not found.');
  });

  test('D6: old Node versions are detected so a clear message can be shown', () => {
    assert.equal(nodeVersionOk('22.12.0'), false);
    assert.equal(nodeVersionOk('20.18.1'), false);
    assert.equal(nodeVersionOk('22.13.0'), true);
    assert.equal(nodeVersionOk('22.23.2'), true);
    assert.equal(nodeVersionOk('24.1.0'), true);
  });
});
