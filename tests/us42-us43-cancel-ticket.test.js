// US42 - Student cancels an active ticket (T82) · US43 - Restore availability after cancellation (T83)
const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { makeTestApp, createEvent, newStudent, checkinSetup, request } = require('./helpers');

describe('US42 Student cancels an active ticket', () => {
  const { app } = makeTestApp();

  test('AC1/AC3: student can cancel their own active ticket and its status becomes cancelled', async () => {
    const ev = await createEvent(app, { title: 'Cancel My Ticket' });
    const s = await newStudent(app);
    const ticket = (await s.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    const res = await s.agent.post(`/api/tickets/${ticket.code}/cancel`).send({}).expect(200);
    assert.equal(res.body.ticket.status, 'cancelled');
    assert.ok(res.body.ticket.cancelledAt);
    const t = (await s.agent.get(`/api/tickets/${ticket.code}`)).body.ticket;
    assert.equal(t.status, 'cancelled');
  });

  test("AC2: student cannot cancel another student's ticket", async () => {
    const ev = await createEvent(app);
    const owner = await newStudent(app, 'Owner');
    const ticket = (await owner.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    const other = await newStudent(app, 'Someone Else');
    const res = await other.agent.post(`/api/tickets/${ticket.code}/cancel`).send({}).expect(404);
    assert.equal(res.body.error, 'Ticket not found.');
    assert.equal((await owner.agent.get(`/api/tickets/${ticket.code}`)).body.ticket.status, 'active');
    await request(app).post(`/api/tickets/${ticket.code}/cancel`).send({}).expect(401);
  });

  test('AC4: an already-used (checked-in) ticket cannot be cancelled', async () => {
    const { ev, ticket, holder, volunteer } = await checkinSetup(app);
    await volunteer.agent.post(`/api/checkin/events/${ev.id}/scan`).send({ code: ticket.code }).expect(200);
    const res = await holder.agent.post(`/api/tickets/${ticket.code}/cancel`).send({}).expect(409);
    assert.equal(res.body.code, 'ALREADY_USED');
    assert.match(res.body.error, /already been used/);
    assert.equal((await holder.agent.get(`/api/tickets/${ticket.code}`)).body.ticket.status, 'checked_in');
  });

  test('a ticket for an event that already started cannot be cancelled', async () => {
    const fixedNow = new Date();
    const { app: lateApp } = makeTestApp({ now: () => fixedNow });
    const ev = await createEvent(lateApp, { title: 'Starting Soon' });
    const s = await newStudent(lateApp);
    const ticket = (await s.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    fixedNow.setDate(fixedNow.getDate() + 30); // jump past the event
    const res = await s.agent.post(`/api/tickets/${ticket.code}/cancel`).send({}).expect(409);
    assert.equal(res.body.code, 'EVENT_STARTED');
  });

  test('AC5: the cancellation remains after refresh and after a restart', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'etms-us42-'));
    after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const file = path.join(dir, 'db.sqlite');
    const first = makeTestApp({ dbPath: file });
    const ev = await createEvent(first.app);
    const s = await newStudent(first.app);
    const ticket = (await s.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    await s.agent.post(`/api/tickets/${ticket.code}/cancel`).send({}).expect(200);
    first.db.close();
    const second = makeTestApp({ dbPath: file, seed: false });
    const row = second.db.prepare('SELECT status, cancelled_at FROM tickets WHERE ticket_code = ?').get(ticket.code);
    assert.equal(row.status, 'cancelled');
    assert.ok(row.cancelled_at);
    assert.equal((await request(second.app).get(`/api/events/${ev.id}`)).body.event.ticketsIssued, 0);
    second.db.close();
  });
});

describe('US43 Restore availability after cancellation', () => {
  const { app } = makeTestApp();

  test('AC1: cancelling an active ticket increases availability by one', async () => {
    const ev = await createEvent(app, { capacity: '4' });
    const s = await newStudent(app);
    const ticket = (await s.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    assert.equal((await request(app).get(`/api/events/${ev.id}`)).body.event.ticketsRemaining, 3);
    const res = await s.agent.post(`/api/tickets/${ticket.code}/cancel`).send({}).expect(200);
    assert.equal(res.body.event.ticketsRemaining, 4);
    assert.equal((await request(app).get(`/api/events/${ev.id}`)).body.event.ticketsRemaining, 4);
  });

  test('AC2: the event never shows more available spots than its capacity', async () => {
    const ev = await createEvent(app, { capacity: '2' });
    const s = await newStudent(app);
    const ticket = (await s.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    await s.agent.post(`/api/tickets/${ticket.code}/cancel`).send({}).expect(200);
    await s.agent.post(`/api/tickets/${ticket.code}/cancel`).send({}).expect(409); // second cancel changes nothing
    const e = (await request(app).get(`/api/events/${ev.id}`)).body.event;
    assert.equal(e.ticketsRemaining, 2);
    assert.ok(e.ticketsRemaining <= e.capacity);
  });

  test('AC3: another student can use the restored spot of a full event', async () => {
    const ev = await createEvent(app, { capacity: '1' });
    const first = await newStudent(app, 'First');
    const ticket = (await first.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    const second = await newStudent(app, 'Second');
    await second.agent.post(`/api/events/${ev.id}/register`).send({}).expect(409); // full
    await first.agent.post(`/api/tickets/${ticket.code}/cancel`).send({}).expect(200);
    await second.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201);
    assert.equal((await request(app).get(`/api/events/${ev.id}`)).body.event.isFull, true);
  });

  test('the student who cancelled can register again later', async () => {
    const ev = await createEvent(app, { capacity: '5' });
    const s = await newStudent(app);
    const ticket = (await s.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    await s.agent.post(`/api/tickets/${ticket.code}/cancel`).send({}).expect(200);
    const again = (await s.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    assert.notEqual(again.code, ticket.code, 'a new ticket with a new code');
  });
});
