// T96 - Repeated-action and edge-case testing (Sprint 3 retrospective improvement)
// "What happens if the user repeats the action?" - double clicks, repeat submissions, refreshes.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, loginOrganizer, createEvent, newStudent, validEvent, request } = require('./helpers');

describe('T96 Repeated actions', () => {
  const { app, db } = makeTestApp();

  test('double-clicking "cancel my ticket" cancels once and restores exactly one spot', async () => {
    const ev = await createEvent(app, { capacity: '5' });
    const s = await newStudent(app);
    const t = (await s.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    const results = await Promise.all([1, 2, 3].map(() => s.agent.post(`/api/tickets/${t.code}/cancel`).send({})));
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409, 409]);
    assert.equal((await request(app).get(`/api/events/${ev.id}`)).body.event.ticketsRemaining, 5);
  });

  test('cancelling an event twice: the second request changes nothing', async () => {
    const ev = await createEvent(app);
    const org = await loginOrganizer(app);
    const first = await org.post(`/api/organizer/events/${ev.id}/cancel`).send({ reason: 'First reason' }).expect(200);
    const second = await org.post(`/api/organizer/events/${ev.id}/cancel`).send({ reason: 'Second reason' }).expect(409);
    assert.equal(second.body.code, 'ALREADY_CANCELLED');
    const row = db.prepare('SELECT cancel_reason, cancelled_at FROM events WHERE id = ?').get(ev.id);
    assert.equal(row.cancel_reason, 'First reason');
    assert.equal(row.cancelled_at, first.body.event.cancelledAt);
  });

  test('saving the same edit twice gives the same result', async () => {
    const ev = await createEvent(app);
    const org = await loginOrganizer(app);
    const body = validEvent({ title: 'Saved Twice' });
    await org.put(`/api/organizer/events/${ev.id}`).send(body).expect(200);
    await org.put(`/api/organizer/events/${ev.id}`).send(body).expect(200);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM events WHERE title = ?').get('Saved Twice').n, 1);
  });

  test('register -> cancel -> register -> cancel keeps capacity right', async () => {
    const ev = await createEvent(app, { capacity: '2' });
    const s = await newStudent(app);
    for (let i = 0; i < 3; i++) {
      const t = (await s.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
      assert.equal((await request(app).get(`/api/events/${ev.id}`)).body.event.ticketsRemaining, 1);
      await s.agent.post(`/api/tickets/${t.code}/cancel`).send({}).expect(200);
      assert.equal((await request(app).get(`/api/events/${ev.id}`)).body.event.ticketsRemaining, 2);
    }
    const active = db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE event_id = ? AND status <> 'cancelled'").get(ev.id).n;
    assert.equal(active, 0);
  });

  test('double-clicking Register still gives one ticket', async () => {
    const ev = await createEvent(app, { capacity: '9' });
    const s = await newStudent(app);
    const r = await Promise.all([1, 2].map(() => s.agent.post(`/api/events/${ev.id}/register`).send({})));
    assert.deepEqual(r.map((x) => x.status).sort(), [201, 409]);
    assert.equal((await request(app).get(`/api/events/${ev.id}`)).body.event.ticketsIssued, 1);
  });

  test('after a paid ticket is cancelled, the student can buy again; the old checkout cannot be reused', async () => {
    const ev = await createEvent(app, { paymentType: 'demo_paid', price: '5', capacity: '4' });
    const s = await newStudent(app);
    const token = (await s.agent.post(`/api/events/${ev.id}/checkout`).send({}).expect(201)).body.checkout.token;
    const code = (await s.agent.post(`/api/checkout/${token}/complete`).send({}).expect(201)).body.ticketCode;
    await s.agent.post(`/api/tickets/${code}/cancel`).send({}).expect(200);
    const again = await s.agent.post(`/api/checkout/${token}/complete`).send({}).expect(200);
    assert.equal(again.body.ticketCode, code, 'the old checkout only points at its own (now cancelled) ticket');
    assert.equal((await request(app).get(`/api/events/${ev.id}`)).body.event.ticketsIssued, 0, 'and does not issue a new one');
    const token2 = (await s.agent.post(`/api/events/${ev.id}/checkout`).send({}).expect(201)).body.checkout.token;
    assert.notEqual(token2, token);
    await s.agent.post(`/api/checkout/${token2}/complete`).send({}).expect(201);
    assert.equal((await request(app).get(`/api/events/${ev.id}`)).body.event.ticketsIssued, 1);
  });

  test('the forms disable their buttons while a request is on its way', async () => {
    for (const f of ['create-event.js', 'cancel-event.js', 'ticket.js', 'checkout.js']) {
      const js = (await request(app).get(`/js/${f}`)).text;
      assert.match(js, /disabled = true|setBusy\(true/, f);
    }
  });
});
