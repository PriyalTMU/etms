// T26 / T28 - End-to-end Sprint 1 flow, exactly as written in the Sprint Goal:
// Organizer logs in -> creates an event -> event is saved -> student logs in ->
// views upcoming events -> selects the event -> views the event details.
const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { makeTestApp, validEvent, request } = require('./helpers');

describe('E2E Sprint 1 demo flow', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'etms-e2e-'));
  after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const dbFile = path.join(tmp, 'e2e.db');

  test('full organizer -> student flow works across all 12 committed stories', async () => {
    const { app, db } = makeTestApp({ dbPath: dbFile });

    // US05 organizer logs in
    const organizer = request.agent(app);
    await organizer.post('/api/organizer/login').send({ email: 'organizer@etms.test', password: 'Organizer123!' }).expect(200);
    // US06 organizer reaches event management
    await organizer.get('/organizer/events/new').expect(200);
    // US09 an incomplete event is rejected first
    await organizer.post('/api/events').send(validEvent({ title: '', capacity: '0' })).expect(400);
    // US08 + US10 valid event is created and saved
    const input = validEvent({ title: 'CPS714 Demo Night', location: 'ENG 103', capacity: '80', time: '18:30' });
    const created = (await organizer.post('/api/events').send(input).expect(201)).body.event;
    await organizer.post('/api/auth/logout').expect(200);

    // US01 a new student creates an account
    const student = request.agent(app);
    await student.post('/api/students/signup')
      .send({ name: 'Jordan Lee', email: 'jordan@torontomu.ca', password: 'Campus2026', confirmPassword: 'Campus2026' })
      .expect(201);
    // US03 wrong password is rejected and they stay logged out
    await student.post('/api/students/login').send({ email: 'jordan@torontomu.ca', password: 'nope1234' }).expect(401);
    assert.equal((await student.get('/api/auth/me')).body.user, null);
    // US02 correct login -> attendee area
    const login = await student.post('/api/students/login').send({ email: 'jordan@torontomu.ca', password: 'Campus2026' }).expect(200);
    assert.equal(login.body.redirect, '/events');
    // US06 student is blocked from organizer functions
    await student.get('/organizer').expect(403);
    await student.post('/api/events').send(validEvent()).expect(403);

    // US12 + US13 upcoming list includes the new event with its basic info
    await student.get('/events').expect(200);
    const listed = (await student.get('/api/events').expect(200)).body.events.find((e) => e.id === created.id);
    assert.ok(listed, 'new event is in the student list');
    assert.equal(listed.title, 'CPS714 Demo Night');
    assert.equal(listed.location, 'ENG 103');
    assert.equal(listed.time, '18:30');

    // US14 select it -> US15 full details match what the organizer entered
    await student.get(`/events/${created.id}`).expect(200);
    const details = (await student.get(`/api/events/${created.id}`).expect(200)).body.event;
    assert.deepEqual(
      { title: details.title, description: details.description, date: details.date, time: details.time, location: details.location, capacity: details.capacity },
      { title: input.title, description: input.description, date: input.date, time: input.time, location: input.location, capacity: 80 }
    );
    db.close();

    // US10 / NFR7: still all there after a server restart
    const restarted = makeTestApp({ dbPath: dbFile, seed: false });
    const again = (await request(restarted.app).get(`/api/events/${created.id}`).expect(200)).body.event;
    assert.equal(again.title, 'CPS714 Demo Night');
    await request(restarted.app).post('/api/students/login').send({ email: 'jordan@torontomu.ca', password: 'Campus2026' }).expect(200);
    restarted.db.close();
  });

  test('NFR4: common pages respond well within 3 seconds', async () => {
    const { app } = makeTestApp();
    for (const url of ['/', '/events', '/api/events', '/login', '/signup', '/organizer/login']) {
      const t0 = Date.now();
      await request(app).get(url).expect(200);
      assert.ok(Date.now() - t0 < 3000, `${url} took too long`);
    }
  });
});
