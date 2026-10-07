// US10 - Save valid event (T20)
const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { makeTestApp, loginOrganizer, validEvent, request } = require('./helpers');

describe('US10 Save valid event', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'etms-us10-'));
  const dbFile = path.join(tmpDir, 'etms-test.db');
  after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  test('AC1: valid event data is stored in the database', async () => {
    const { app, db } = makeTestApp();
    const agent = await loginOrganizer(app);
    const res = await agent.post('/api/events').send(validEvent({ title: 'Stored Event' })).expect(201);
    const row = db.prepare('SELECT * FROM events WHERE id = ?').get(res.body.event.id);
    assert.ok(row, 'row exists in the events table');
    assert.equal(row.title, 'Stored Event');
  });

  test('AC2: event remains available after navigating away and coming back', async () => {
    const { app } = makeTestApp();
    const agent = await loginOrganizer(app);
    const { id } = (await agent.post('/api/events').send(validEvent({ title: 'Still Here' })).expect(201)).body.event;
    await agent.get('/organizer').expect(200); // navigate elsewhere
    const mine = (await agent.get('/api/organizer/events').expect(200)).body.events;
    assert.ok(mine.some((e) => e.id === id), 'still in the organizer list');
    const pub = (await request(app).get('/api/events').expect(200)).body.events;
    assert.ok(pub.some((e) => e.id === id), 'still in the student list');
  });

  test('AC2: event survives a server restart (reload) because it is saved to the database file', async () => {
    const first = makeTestApp({ dbPath: dbFile });
    const agent = await loginOrganizer(first.app);
    const created = (await agent.post('/api/events').send(validEvent({ title: 'Survives Restart' })).expect(201)).body.event;
    first.db.close();

    // "Restart": brand new connection + app on the same file, no re-seeding
    const second = makeTestApp({ dbPath: dbFile, seed: false });
    const res = await request(second.app).get(`/api/events/${created.id}`).expect(200);
    assert.equal(res.body.event.title, 'Survives Restart');
    second.db.close();
  });

  test('AC3: stored information matches what was submitted', async () => {
    const { app } = makeTestApp();
    const agent = await loginOrganizer(app);
    const input = validEvent({
      title: 'Exact Match Night',
      description: 'Line one.\nLine two with symbols: & < > " \' é',
      time: '09:05',
      location: 'Student Learning Centre, Room 601',
      capacity: '250',
    });
    const { id } = (await agent.post('/api/events').send(input).expect(201)).body.event;
    const saved = (await request(app).get(`/api/events/${id}`).expect(200)).body.event;
    assert.equal(saved.title, input.title);
    assert.equal(saved.description, input.description);
    assert.equal(saved.date, input.date);
    assert.equal(saved.time, input.time);
    assert.equal(saved.location, input.location);
    assert.equal(saved.capacity, 250);
  });

  test('invalid events are never saved', async () => {
    const { app, db } = makeTestApp();
    const before = db.prepare('SELECT COUNT(*) AS n FROM events').get().n;
    const agent = await loginOrganizer(app);
    await agent.post('/api/events').send(validEvent({ capacity: '0' })).expect(400);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM events').get().n, before);
  });

  test('database itself refuses impossible values (second line of defence)', () => {
    const { db } = makeTestApp();
    assert.throws(() =>
      db.prepare(`INSERT INTO events (organizer_id, title, description, event_date, event_time, location, capacity)
                  VALUES (1, 'x', 'y', '2030-01-01', '10:00', 'z', 0)`).run()
    );
  });
});
