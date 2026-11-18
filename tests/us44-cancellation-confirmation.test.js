// US44 - Cancellation confirmation (T84)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, createEvent, newStudent, checkinSetup, request } = require('./helpers');

describe('US44 Cancellation confirmation', () => {
  const { app } = makeTestApp();

  test('AC1: a successful cancellation shows a clear confirmation naming the event', async () => {
    const ev = await createEvent(app, { title: 'Confirmation Night' });
    const s = await newStudent(app);
    const ticket = (await s.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    const res = await s.agent.post(`/api/tickets/${ticket.code}/cancel`).send({}).expect(200);
    assert.equal(res.body.message, 'Your ticket for "Confirmation Night" has been cancelled. Your spot has been released for another student.');
    const page = (await s.agent.get(`/tickets/${ticket.code}`).expect(200)).text;
    assert.match(page, /id="cancel-done"/);
    assert.match(page, /Yes, cancel my ticket/);
  });

  test('AC2: the cancelled ticket is clearly marked (ticket page and My Tickets)', async () => {
    const ev = await createEvent(app);
    const s = await newStudent(app);
    const ticket = (await s.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    await s.agent.post(`/api/tickets/${ticket.code}/cancel`).send({}).expect(200);
    const mine = (await s.agent.get('/api/my/tickets')).body.tickets.find((t) => t.code === ticket.code);
    assert.equal(mine.status, 'cancelled');
    const js = (await request(app).get('/js/ticket.js')).text;
    assert.match(js, /Cancelled – not valid for entry/);
    const myJs = (await request(app).get('/js/my-tickets.js')).text;
    assert.match(myJs, /'Cancelled'/);
  });

  test('AC3: a failed cancellation shows an understandable reason', async () => {
    const ev = await createEvent(app);
    const s = await newStudent(app);
    const ticket = (await s.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    await s.agent.post(`/api/tickets/${ticket.code}/cancel`).send({}).expect(200);
    const twice = await s.agent.post(`/api/tickets/${ticket.code}/cancel`).send({}).expect(409);
    assert.equal(twice.body.error, 'This ticket is already cancelled.');

    const { ev: ev2, ticket: t2, holder, volunteer } = await checkinSetup(app);
    await volunteer.agent.post(`/api/checkin/events/${ev2.id}/scan`).send({ code: t2.code }).expect(200);
    const used = await holder.agent.post(`/api/tickets/${t2.code}/cancel`).send({}).expect(409);
    assert.match(used.body.error, /already been used to check in/);

    const missing = await s.agent.post('/api/tickets/ETMS-0000-0000-0000/cancel').send({}).expect(404);
    assert.equal(missing.body.error, 'Ticket not found.');
  });
});
