// US15 - View full event details (T25)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, loginOrganizer, validEvent, request } = require('./helpers');

describe('US15 Event details', () => {
  const { app } = makeTestApp();

  test('AC1: details include title, description, date, time, location and capacity', async () => {
    const list = (await request(app).get('/api/events')).body.events;
    const ev = (await request(app).get(`/api/events/${list[0].id}`).expect(200)).body.event;
    for (const field of ['title', 'description', 'date', 'time', 'location', 'capacity']) {
      assert.notEqual(ev[field], undefined, `${field} is present`);
      assert.notEqual(ev[field], '', `${field} is not empty`);
    }
  });

  test('AC1: details page has a place for every field', async () => {
    const list = (await request(app).get('/api/events')).body.events;
    const page = await request(app).get(`/events/${list[0].id}`).expect(200);
    for (const id of ['ev-title', 'ev-description', 'ev-date', 'ev-time', 'ev-location', 'ev-capacity']) {
      assert.match(page.text, new RegExp(`id="${id}"`), `page shows ${id}`);
    }
  });

  test('AC2: displayed information matches the saved event', async () => {
    const agent = await loginOrganizer(app);
    const input = validEvent({
      title: 'Details Match Test',
      description: 'Everything here should come back exactly.',
      time: '17:45',
      location: 'Kerr Hall East, Lab 2',
      capacity: '33',
    });
    const created = (await agent.post('/api/events').send(input).expect(201)).body.event;
    const shown = (await request(app).get(`/api/events/${created.id}`).expect(200)).body.event;
    assert.equal(shown.title, input.title);
    assert.equal(shown.description, input.description);
    assert.equal(shown.date, input.date);
    assert.equal(shown.time, input.time);
    assert.equal(shown.location, input.location);
    assert.equal(shown.capacity, 33);
    assert.equal(shown.clubName, 'Computer Science Club');
  });

  test('details page for a missing event still loads and shows "not found" from the API', async () => {
    await request(app).get('/events/99999').expect(200);
    await request(app).get('/api/events/99999').expect(404);
  });
});
