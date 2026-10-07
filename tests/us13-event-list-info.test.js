// US13 - Show basic event information in the list (T22 display list, T23 basic info)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTestApp, loginOrganizer, validEvent, request } = require('./helpers');

const listJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'event-list.js'), 'utf8');

describe('US13 Event list information', () => {
  const { app } = makeTestApp();

  test('T22: the list page displays the events (one card per event)', async () => {
    const page = await request(app).get('/events').expect(200);
    assert.match(page.text, /<ul class="event-list" id="event-list"/);
    assert.match(page.text, /src="\/js\/event-list.js"/);
    assert.match(listJs, /data\.events\.forEach/);
    assert.match(listJs, /list\.appendChild\(li\)/);
  });

  test('AC1: every listed event has a title, date/time and location', async () => {
    const events = (await request(app).get('/api/events').expect(200)).body.events;
    assert.ok(events.length > 0);
    for (const ev of events) {
      assert.ok(ev.title && ev.date && ev.time && ev.location, `event ${ev.id} has the basics`);
    }
  });

  test('AC1: each list card renders the title, date/time and location', () => {
    assert.match(listJs, /el\('h3', null, ev\.title\)/, 'title');
    assert.match(listJs, /ETMS\.formatShort\(ev\.date, ev\.time\)/, 'date and time');
    assert.match(listJs, /el\('span', 'meta-where', ev\.location\)/, 'location');
    assert.match(listJs, /textContent|el\(/, 'uses text (not HTML) so event text cannot break the page');
  });

  test('AC2: the information belongs to the correct event', async () => {
    const events = (await request(app).get('/api/events').expect(200)).body.events;
    for (const ev of events) {
      const saved = (await request(app).get(`/api/events/${ev.id}`).expect(200)).body.event;
      assert.equal(ev.title, saved.title);
      assert.equal(ev.date, saved.date);
      assert.equal(ev.time, saved.time);
      assert.equal(ev.location, saved.location);
    }
    assert.match(listJs, /li\.dataset\.eventId = ev\.id/, 'each card is tagged with its own event id');
    assert.match(listJs, /'\/events\/' \+ encodeURIComponent\(ev\.id\)/, 'and links to that same id');
  });

  test('AC2: a new event shows its own details in the list, not another event\'s', async () => {
    const agent = await loginOrganizer(app);
    const input = validEvent({ title: 'Unique List Title', location: 'Unique Room 42', time: '13:15' });
    const { id } = (await agent.post('/api/events').send(input).expect(201)).body.event;
    const listed = (await request(app).get('/api/events')).body.events.find((e) => e.id === id);
    assert.equal(listed.title, 'Unique List Title');
    assert.equal(listed.location, 'Unique Room 42');
    assert.equal(listed.time, '13:15');
    const others = (await request(app).get('/api/events')).body.events.filter((e) => e.id !== id);
    assert.ok(others.every((e) => e.title !== 'Unique List Title'));
  });
});
