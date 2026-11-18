// US41 - Cancel an event (T80, T81)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, loginOrganizer, createEvent, newStudent, addVolunteer, ORGANIZER_2, request } = require('./helpers');

describe('US41 Cancel an event', () => {
  const { app, db } = makeTestApp();

  test('AC1: organizer can cancel an event they manage', async () => {
    const ev = await createEvent(app, { title: 'To Be Cancelled' });
    const org = await loginOrganizer(app);
    const res = await org.post(`/api/organizer/events/${ev.id}/cancel`).send({ reason: 'Room unavailable' }).expect(200);
    assert.match(res.body.message, /has been cancelled/);
    assert.equal(res.body.event.status, 'cancelled');
    assert.equal(res.body.event.cancelReason, 'Room unavailable');
    const page = await org.get(`/organizer/events/${ev.id}`).expect(200);
    assert.match(page.text, /Yes, cancel this event/);
  });

  test('AC2: the event is marked cancelled, not deleted', async () => {
    const ev = await createEvent(app, { title: 'Kept After Cancel' });
    const org = await loginOrganizer(app);
    await org.post(`/api/organizer/events/${ev.id}/cancel`).send({}).expect(200);
    const row = db.prepare('SELECT status, cancelled_at FROM events WHERE id = ?').get(ev.id);
    assert.equal(row.status, 'cancelled');
    assert.ok(row.cancelled_at);
    assert.equal((await request(app).get(`/api/events/${ev.id}`).expect(200)).body.event.title, 'Kept After Cancel');
  });

  test('AC3: students can clearly see the event is cancelled (list, details, their ticket)', async () => {
    const ev = await createEvent(app, { title: 'Visible Cancel' });
    const s = await newStudent(app);
    const ticket = (await s.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    const org = await loginOrganizer(app);
    await org.post(`/api/organizer/events/${ev.id}/cancel`).send({ reason: 'Speaker is ill' }).expect(200);

    const listed = (await request(app).get('/api/events')).body.events.find((e) => e.id === ev.id);
    assert.equal(listed.isCancelled, true);
    const details = (await request(app).get(`/api/events/${ev.id}`)).body.event;
    assert.equal(details.isCancelled, true);
    assert.equal(details.cancelReason, 'Speaker is ill');
    const t = (await s.agent.get(`/api/tickets/${ticket.code}`)).body.ticket;
    assert.equal(t.event.isCancelled, true);
    const listJs = (await request(app).get('/js/event-list.js')).text;
    assert.match(listJs, /'Cancelled'/);
    const detailsHtml = (await request(app).get(`/events/${ev.id}`)).text;
    assert.match(detailsHtml, /id="ev-cancelled"/);
  });

  test('AC4: registration is no longer allowed for a cancelled event', async () => {
    const ev = await createEvent(app, { capacity: '5' });
    const org = await loginOrganizer(app);
    await org.post(`/api/organizer/events/${ev.id}/cancel`).send({}).expect(200);
    const s = await newStudent(app);
    const res = await s.agent.post(`/api/events/${ev.id}/register`).send({}).expect(409);
    assert.equal(res.body.code, 'EVENT_CANCELLED');
    assert.match(res.body.error, /cancelled by the organizer/);
    assert.equal((await request(app).get(`/api/events/${ev.id}`)).body.event.ticketsIssued, 0);
    const state = (await s.agent.get(`/api/events/${ev.id}/registration`)).body;
    assert.equal(state.cancelled, true);
  });

  test("AC5: organizer cannot cancel another organizer's event", async () => {
    const ev = await createEvent(app);
    const other = await loginOrganizer(app, ORGANIZER_2);
    await other.post(`/api/organizer/events/${ev.id}/cancel`).send({}).expect(404);
    assert.equal((await request(app).get(`/api/events/${ev.id}`)).body.event.status, 'scheduled');
    const s = await newStudent(app);
    await s.agent.post(`/api/organizer/events/${ev.id}/cancel`).send({}).expect(403);
  });

  test('check-in refuses tickets for a cancelled event', async () => {
    const ev = await createEvent(app, { title: 'Cancelled Door' });
    const s = await newStudent(app);
    const ticket = (await s.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    const vol = await newStudent(app, 'Door Volunteer');
    await addVolunteer(app, ev.id, vol.email);
    const org = await loginOrganizer(app);
    await org.post(`/api/organizer/events/${ev.id}/cancel`).send({}).expect(200);
    const scan = (await vol.agent.post(`/api/checkin/events/${ev.id}/scan`).send({ code: ticket.code }).expect(200)).body;
    assert.equal(scan.result, 'EVENT_CANCELLED');
    assert.equal(scan.valid, false);
  });

  test('a reason over 300 characters is refused', async () => {
    const ev = await createEvent(app);
    const org = await loginOrganizer(app);
    await org.post(`/api/organizer/events/${ev.id}/cancel`).send({ reason: 'x'.repeat(301) }).expect(400);
    assert.equal((await request(app).get(`/api/events/${ev.id}`)).body.event.status, 'scheduled');
  });
});
