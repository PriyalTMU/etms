// US20 - Registration stops when an event reaches capacity (T38)
// US21 - Registration is rejected with a clear message when the event is full (T39)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, newStudent, createEvent, request } = require('./helpers');

describe('US20 Stop registration at capacity', () => {
  test('AC1: exactly <capacity> tickets can be issued, the next one is refused', async () => {
    const { app } = makeTestApp();
    const ev = await createEvent(app, { capacity: '3' });
    for (let i = 0; i < 3; i++) {
      const { agent } = await newStudent(app);
      await agent.post(`/api/events/${ev.id}/register`).send({}).expect(201);
    }
    const { agent: fourth } = await newStudent(app);
    await fourth.post(`/api/events/${ev.id}/register`).send({}).expect(409);
    const after = (await request(app).get(`/api/events/${ev.id}`)).body.event;
    assert.equal(after.ticketsIssued, 3);
  });

  test('AC2: many students registering at the same time never overbook the event', async () => {
    const { app, db } = makeTestApp();
    const ev = await createEvent(app, { capacity: '5' });
    const students = [];
    for (let i = 0; i < 12; i++) students.push((await newStudent(app)).agent);
    const results = await Promise.all(students.map((a) => a.post(`/api/events/${ev.id}/register`).send({})));
    const ok = results.filter((r) => r.status === 201).length;
    const full = results.filter((r) => r.status === 409 && r.body.code === 'EVENT_FULL').length;
    assert.equal(ok, 5);
    assert.equal(full, 7);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE event_id = ? AND status <> 'cancelled'").get(ev.id).n, 5);
  });

  test('AC2: a capacity-1 event can be filled by exactly one student', async () => {
    const { app } = makeTestApp();
    const ev = await createEvent(app, { capacity: '1' });
    const [a, b] = [(await newStudent(app)).agent, (await newStudent(app)).agent];
    const [ra, rb] = await Promise.all([a.post(`/api/events/${ev.id}/register`).send({}), b.post(`/api/events/${ev.id}/register`).send({})]);
    assert.deepEqual([ra.status, rb.status].sort(), [201, 409]);
  });
});

describe('US21 Full event rejection', () => {
  test('AC1: registering for a full event is rejected with an understandable message', async () => {
    const { app } = makeTestApp();
    const ev = await createEvent(app, { capacity: '1' });
    await (await newStudent(app)).agent.post(`/api/events/${ev.id}/register`).send({}).expect(201);
    const res = await (await newStudent(app)).agent.post(`/api/events/${ev.id}/register`).send({}).expect(409);
    assert.equal(res.body.code, 'EVENT_FULL');
    assert.equal(res.body.error, 'Sorry, this event is full. No more tickets can be issued.');
  });

  test('AC2: no ticket is created for the rejected student', async () => {
    const { app, db } = makeTestApp();
    const ev = await createEvent(app, { capacity: '1' });
    await (await newStudent(app)).agent.post(`/api/events/${ev.id}/register`).send({}).expect(201);
    const late = await newStudent(app);
    await late.agent.post(`/api/events/${ev.id}/register`).send({}).expect(409);
    const me = (await late.agent.get('/api/auth/me')).body.user;
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tickets WHERE student_id = ?').get(me.id).n, 0);
  });

  test('AC3: the page knows the event is full, so it shows "Event full" instead of a Register button', async () => {
    const { app } = makeTestApp();
    const ev = await createEvent(app, { capacity: '1' });
    await (await newStudent(app)).agent.post(`/api/events/${ev.id}/register`).send({}).expect(201);
    const { agent } = await newStudent(app);
    const state = (await agent.get(`/api/events/${ev.id}/registration`)).body;
    assert.equal(state.isFull, true);
    assert.equal(state.ticketsRemaining, 0);
    const js = (await request(app).get('/js/event-details.js')).text;
    assert.match(js, /Event full/);
  });
});
