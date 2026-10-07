// US08 - Create event (T18)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, loginOrganizer, validEvent } = require('./helpers');

describe('US08 Create event', () => {
  const { app, db } = makeTestApp();

  test('AC1: form lets the organizer provide title, description, date, time, location and maximum capacity', async () => {
    const agent = await loginOrganizer(app);
    const res = await agent.get('/organizer/events/new').expect(200);
    for (const field of ['title', 'description', 'date', 'time', 'location', 'capacity']) {
      assert.match(res.text, new RegExp(`name="${field}"`), `form has a ${field} field`);
    }
    assert.match(res.text, /type="date"/);
    assert.match(res.text, /type="time"/);
    assert.match(res.text, /name="capacity" type="number"/);
  });

  test('AC2: organizer can submit the information and the event is created', async () => {
    const agent = await loginOrganizer(app);
    const input = validEvent();
    const res = await agent.post('/api/events').send(input).expect(201);
    const ev = res.body.event;
    assert.ok(ev.id);
    assert.equal(ev.title, input.title);
    assert.equal(ev.description, input.description);
    assert.equal(ev.date, input.date);
    assert.equal(ev.time, input.time);
    assert.equal(ev.location, input.location);
    assert.equal(ev.capacity, 75);
    assert.equal(ev.clubName, 'Computer Science Club');

    const row = db.prepare('SELECT * FROM events WHERE id = ?').get(ev.id);
    assert.equal(row.title, input.title);
    assert.equal(row.capacity, 75);
  });

  test('created event is linked to the organizer who created it', async () => {
    const agent = await loginOrganizer(app);
    const me = (await agent.get('/api/auth/me')).body.user;
    const res = await agent.post('/api/events').send(validEvent({ title: 'Ownership check' })).expect(201);
    assert.equal(res.body.event.organizerId, me.id);
    const mine = (await agent.get('/api/organizer/events')).body.events;
    assert.ok(mine.some((e) => e.id === res.body.event.id));
  });

  test('extra spaces are trimmed before saving', async () => {
    const agent = await loginOrganizer(app);
    const res = await agent
      .post('/api/events')
      .send(validEvent({ title: '   Trim Test   ', location: '  ENG 103 ' }))
      .expect(201);
    assert.equal(res.body.event.title, 'Trim Test');
    assert.equal(res.body.event.location, 'ENG 103');
  });

  test('capacity sent as a number (not a string) also works', async () => {
    const agent = await loginOrganizer(app);
    const res = await agent.post('/api/events').send(validEvent({ capacity: 30 })).expect(201);
    assert.equal(res.body.event.capacity, 30);
  });

  test('event HTML-like text is stored as plain text', async () => {
    const agent = await loginOrganizer(app);
    const res = await agent.post('/api/events').send(validEvent({ title: '<b>Bold</b> night' })).expect(201);
    assert.equal(res.body.event.title, '<b>Bold</b> night');
  });
});
