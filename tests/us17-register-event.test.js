// US17 - Register for an event to reserve a ticket (T34, T35)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, loginStudent, loginOrganizer, newStudent, createEvent, daysFromNow, request } = require('./helpers');

describe('US17 Register for an event', () => {
  const { app } = makeTestApp();

  test('AC1: a logged-in student can register for an upcoming event and gets a ticket', async () => {
    const ev = await createEvent(app, { title: 'Register Me', capacity: '10' });
    const student = await loginStudent(app);
    const res = await student.post(`/api/events/${ev.id}/register`).send({}).expect(201);
    assert.equal(res.body.ticket.eventId, ev.id);
    assert.equal(res.body.ticket.status, 'active');
    assert.match(res.body.ticket.code, /^ETMS-/);
    assert.equal(res.body.redirect, `/tickets/${res.body.ticket.code}?new=1`);
  });

  test('AC2: the event details page shows a register area', async () => {
    const ev = await createEvent(app);
    const page = await request(app).get(`/events/${ev.id}`).expect(200);
    assert.match(page.text, /id="register-box"/);
    const js = (await request(app).get('/js/event-details.js')).text;
    assert.match(js, /Register for this event/);
  });

  test('AC3: a logged-out visitor is asked to log in and no ticket is created', async () => {
    const ev = await createEvent(app);
    const res = await request(app).post(`/api/events/${ev.id}/register`).send({}).expect(401);
    assert.match(res.body.error, /log in/i);
    assert.equal((await request(app).get(`/api/events/${ev.id}`)).body.event.ticketsIssued, 0);
  });

  test('AC3: organizer accounts cannot register', async () => {
    const ev = await createEvent(app);
    const org = await loginOrganizer(app);
    const res = await org.post(`/api/events/${ev.id}/register`).send({}).expect(403);
    assert.match(res.body.error, /Only student accounts/);
  });

  test('registration status endpoint tells the page what to show', async () => {
    const ev = await createEvent(app);
    const anon = (await request(app).get(`/api/events/${ev.id}/registration`).expect(200)).body;
    assert.equal(anon.role, null);
    assert.equal(anon.ticketCode, null);
    const { agent } = await newStudent(app);
    const before = (await agent.get(`/api/events/${ev.id}/registration`)).body;
    assert.equal(before.role, 'student');
    assert.equal(before.ticketCode, null);
    const t = (await agent.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    assert.equal((await agent.get(`/api/events/${ev.id}/registration`)).body.ticketCode, t.code);
  });

  test('unknown events cannot be registered for', async () => {
    const student = await loginStudent(app);
    await student.post('/api/events/99999/register').send({}).expect(404);
    await student.post('/api/events/abc/register').send({}).expect(404);
  });

  test('an event that has already started cannot be registered for', async () => {
    // Event tomorrow at 09:00, clock set to tomorrow at 10:00
    const clock = new Date();
    clock.setDate(clock.getDate() + 1);
    clock.setHours(10, 0, 0, 0);
    const { app: lateApp } = makeTestApp({ now: () => clock });
    const started = lateApp.locals.models.events.create(1, {
      title: 'Already Started', description: 'Started an hour ago.', date: daysFromNow(1), time: '09:00', location: 'ENG 103', capacity: 5,
    });
    const student = await loginStudent(lateApp);
    const res = await student.post(`/api/events/${started.id}/register`).send({}).expect(400);
    assert.equal(res.body.code, 'EVENT_STARTED');
    assert.equal((await student.get(`/api/events/${started.id}/registration`)).body.started, true);
  });
});
