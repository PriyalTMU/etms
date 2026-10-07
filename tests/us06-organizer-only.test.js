// US06 - Organizer-only functions (T17)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, loginOrganizer, loginStudent, validEvent, request } = require('./helpers');

describe('US06 Organizer-only functions', () => {
  const { app } = makeTestApp();

  test('AC1: logged-in organizer can reach event-management pages and API', async () => {
    const agent = await loginOrganizer(app);
    const dash = await agent.get('/organizer').expect(200);
    assert.match(dash.text, /Event management/);
    assert.match(dash.text, /href="\/organizer\/events\/new"/);
    const form = await agent.get('/organizer/events/new').expect(200);
    assert.match(form.text, /Create a new event/);
    const list = await agent.get('/api/organizer/events').expect(200);
    assert.ok(Array.isArray(list.body.events));
  });

  test('AC2: attendee (student) cannot open organizer pages', async () => {
    const student = await loginStudent(app);
    const res1 = await student.get('/organizer').expect(403);
    assert.match(res1.text, /Access denied/);
    await student.get('/organizer/events/new').expect(403);
  });

  test('AC2: attendee (student) cannot use organizer API functions', async () => {
    const student = await loginStudent(app);
    const create = await student.post('/api/events').send(validEvent()).expect(403);
    assert.match(create.body.error, /Only organizer accounts/);
    await student.get('/api/organizer/events').expect(403);
  });

  test('AC2: a blocked student request does not create an event', async () => {
    const { app: freshApp, db } = makeTestApp();
    const before = db.prepare('SELECT COUNT(*) AS n FROM events').get().n;
    const student = await loginStudent(freshApp);
    await student.post('/api/events').send(validEvent({ title: 'Sneaky student event' })).expect(403);
    const after = db.prepare('SELECT COUNT(*) AS n FROM events').get().n;
    assert.equal(after, before);
  });

  test('logged-out visitors are sent to organizer login', async () => {
    const res = await request(app).get('/organizer/events/new').expect(302);
    assert.equal(res.headers.location, '/organizer/login?next=%2Forganizer%2Fevents%2Fnew');
    await request(app).post('/api/events').send(validEvent()).expect(401);
    await request(app).get('/api/organizer/events').expect(401);
  });

  test('organizer pages are not reachable as static files', async () => {
    await request(app).get('/pages/organizer/dashboard.html').expect(404);
    await request(app).get('/organizer/dashboard.html').expect(404);
  });

  test('organizer only sees their own events', async () => {
    const cs = await loginOrganizer(app);
    const res = await cs.get('/api/organizer/events').expect(200);
    assert.ok(res.body.events.length > 0);
    assert.ok(res.body.events.every((e) => !/Robotics/.test(e.title)));
  });
});
