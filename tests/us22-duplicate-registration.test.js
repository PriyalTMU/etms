// US22 - Duplicate active registrations are prevented (T40)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, newStudent, createEvent } = require('./helpers');

describe('US22 No duplicate registrations', () => {
  test('AC1: registering twice for the same event is rejected and points to the existing ticket', async () => {
    const { app } = makeTestApp();
    const ev = await createEvent(app, { capacity: '10' });
    const { agent } = await newStudent(app);
    const first = (await agent.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    const second = await agent.post(`/api/events/${ev.id}/register`).send({}).expect(409);
    assert.equal(second.body.code, 'ALREADY_REGISTERED');
    assert.equal(second.body.error, 'You already have a ticket for this event.');
    assert.equal(second.body.ticketCode, first.code);
  });

  test('AC2: only one ticket exists and only one spot is used', async () => {
    const { app, db } = makeTestApp();
    const ev = await createEvent(app, { capacity: '10' });
    const { agent } = await newStudent(app);
    await Promise.all([1, 2, 3].map(() => agent.post(`/api/events/${ev.id}/register`).send({})));
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tickets WHERE event_id = ?').get(ev.id).n, 1);
  });

  test('AC2: the database itself refuses a second active ticket for the same student and event', async () => {
    const { app, db } = makeTestApp();
    const ev = await createEvent(app);
    const { agent } = await newStudent(app);
    await agent.post(`/api/events/${ev.id}/register`).send({}).expect(201);
    const row = db.prepare('SELECT student_id FROM tickets WHERE event_id = ?').get(ev.id);
    assert.throws(
      () => db.prepare("INSERT INTO tickets (ticket_code, event_id, student_id) VALUES ('ETMS-ZZZZ-ZZZZ-ZZZZ', ?, ?)").run(ev.id, row.student_id),
      /UNIQUE/
    );
  });

  test('the same student can still register for different events', async () => {
    const { app } = makeTestApp();
    const a = await createEvent(app, { title: 'Event A' });
    const b = await createEvent(app, { title: 'Event B' });
    const { agent } = await newStudent(app);
    await agent.post(`/api/events/${a.id}/register`).send({}).expect(201);
    await agent.post(`/api/events/${b.id}/register`).send({}).expect(201);
  });

  test('a cancelled ticket does not block registering again (ready for Sprint 4)', async () => {
    const { app, db } = makeTestApp();
    const ev = await createEvent(app);
    const { agent } = await newStudent(app);
    const t = (await agent.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    db.prepare("UPDATE tickets SET status = 'cancelled' WHERE id = ?").run(t.id);
    await agent.post(`/api/events/${ev.id}/register`).send({}).expect(201);
  });
});
