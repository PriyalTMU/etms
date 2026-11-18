// T100 - regression tests for defects found in Sprint 4 integration/browser testing (D13-D15)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, request } = require('./helpers');

describe('T100 Sprint 4 defect regressions', () => {
  const { app } = makeTestApp();

  test('D13: the category list is built before the first search, so ?category= survives a refresh', async () => {
    const page = (await request(app).get('/events')).text;
    assert.ok(page.indexOf('/shared/eventValidation.js') < page.indexOf('/js/event-list.js'), 'shared list loads first');
    const js = (await request(app).get('/js/event-list.js')).text;
    const fill = js.indexOf('EventValidation.CATEGORIES.forEach');
    const start = js.indexOf("var start = new URLSearchParams(location.search)");
    assert.ok(fill > 0 && fill < start, 'options exist before the address-bar values are applied');
  });

  test('D14: on phones the filter panel stays compact (dates side by side)', async () => {
    const css = (await request(app).get('/css/styles.css')).text;
    assert.match(css, /D14 fix/);
    assert.doesNotMatch(css, /@media \(max-width: 420px\) \{ \.filter-grid \{ grid-template-columns: 1fr; \} \}/);
  });

  test('D15: a cancelled event hides "Open check-in" and the volunteer form', async () => {
    const js = (await request(app).get('/js/cancel-event.js')).text;
    assert.match(js, /\['edit-event', 'open-checkin', 'volunteer-form'\]/);
  });
});
