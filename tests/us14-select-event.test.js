// US14 - Select an event (T24)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTestApp, request } = require('./helpers');

describe('US14 Select an event', () => {
  const { app } = makeTestApp();

  test('AC1: each listed event links to its own page', () => {
    // The list page builds one link per event pointing at /events/<id>
    const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'event-list.js'), 'utf8');
    assert.match(js, /a\.href = '\/events\/' \+ encodeURIComponent\(ev\.id\)/);
  });

  test('AC1: selecting an event opens its details page', async () => {
    const list = (await request(app).get('/api/events').expect(200)).body.events;
    const page = await request(app).get(`/events/${list[0].id}`).expect(200);
    assert.match(page.text, /id="event-details"/);
  });

  test('AC2: the correct selected event is opened', async () => {
    const list = (await request(app).get('/api/events').expect(200)).body.events;
    for (const ev of list) {
      const detail = (await request(app).get(`/api/events/${ev.id}`).expect(200)).body.event;
      assert.equal(detail.id, ev.id);
      assert.equal(detail.title, ev.title);
    }
  });

  test("AC3: selecting one event does not show another event's information", async () => {
    const list = (await request(app).get('/api/events').expect(200)).body.events;
    assert.ok(list.length >= 2);
    const a = (await request(app).get(`/api/events/${list[0].id}`)).body.event;
    const b = (await request(app).get(`/api/events/${list[1].id}`)).body.event;
    assert.notEqual(a.id, b.id);
    assert.notEqual(a.title, b.title);
    assert.notEqual(a.description, b.description);
  });

  test('an event that does not exist gives a clear "not found"', async () => {
    const res = await request(app).get('/api/events/99999').expect(404);
    assert.equal(res.body.error, 'Event not found.');
  });

  test('nonsense ids are rejected instead of picking some other event', async () => {
    for (const bad of ['abc', '0', '-1', '1.5', '1abc']) {
      await request(app).get(`/api/events/${bad}`).expect(404);
    }
  });
});
