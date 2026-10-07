// US12 - View upcoming event list (T21)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, loginOrganizer, loginStudent, validEvent, request } = require('./helpers');

describe('US12 Upcoming event list', () => {
  test('AC1: student can access the event-list page (logged in or just browsing)', async () => {
    const { app } = makeTestApp();
    const page = await request(app).get('/events').expect(200);
    assert.match(page.text, /Upcoming campus events/);
    assert.match(page.text, /id="event-list"/);
    const student = await loginStudent(app);
    await student.get('/events').expect(200);
    const home = await request(app).get('/').expect(200);
    assert.match(home.text, /href="\/events"/, 'home page links to the event list');
  });

  test('AC2: upcoming events are retrieved, soonest first', async () => {
    const { app } = makeTestApp();
    const res = await request(app).get('/api/events').expect(200);
    assert.equal(res.body.events.length, 3, 'the 3 sample events');
    const keys = res.body.events.map((e) => `${e.date} ${e.time}`);
    assert.deepEqual(keys, [...keys].sort(), 'sorted by date and time');
  });

  test('AC2: past events and events earlier today are not shown; later today is', async () => {
    const fixedNow = new Date(2026, 9, 7, 14, 0); // Oct 7 2026, 2:00 PM
    const { app, db } = makeTestApp({ seed: true, now: () => fixedNow });
    db.exec('DELETE FROM events');
    const insert = db.prepare(
      `INSERT INTO events (organizer_id, title, description, event_date, event_time, location, capacity)
       VALUES (1, ?, 'd', ?, ?, 'L', 10)`
    );
    insert.run('Yesterday', '2026-10-06', '18:00');
    insert.run('This morning', '2026-10-07', '09:00');
    insert.run('Right now', '2026-10-07', '14:00');
    insert.run('Tonight', '2026-10-07', '19:00');
    insert.run('Next week', '2026-10-14', '12:00');
    const titles = (await request(app).get('/api/events').expect(200)).body.events.map((e) => e.title);
    assert.deepEqual(titles, ['Tonight', 'Next week']);
  });

  test('AC3: a newly saved event appears in the list', async () => {
    const { app } = makeTestApp();
    const agent = await loginOrganizer(app);
    const { id } = (await agent.post('/api/events').send(validEvent({ title: 'Brand New Event' })).expect(201)).body.event;
    const list = (await request(app).get('/api/events').expect(200)).body.events;
    const found = list.find((e) => e.id === id);
    assert.ok(found, 'new event is in the list');
    assert.equal(found.title, 'Brand New Event');
    assert.equal(found.clubName, 'Computer Science Club');
  });

  test('events from every club are listed (not only one organizer)', async () => {
    const { app } = makeTestApp();
    const clubs = new Set((await request(app).get('/api/events')).body.events.map((e) => e.clubName));
    assert.ok(clubs.has('Computer Science Club'));
    assert.ok(clubs.has('Robotics Club'));
  });

  test('empty list is returned cleanly when there are no upcoming events', async () => {
    const { app, db } = makeTestApp();
    db.exec('DELETE FROM events');
    const res = await request(app).get('/api/events').expect(200);
    assert.deepEqual(res.body.events, []);
  });

  test('list does not expose private organizer data', async () => {
    const { app } = makeTestApp();
    const ev = (await request(app).get('/api/events')).body.events[0];
    assert.equal(ev.password_hash, undefined);
    assert.equal(ev.email, undefined);
  });
});
