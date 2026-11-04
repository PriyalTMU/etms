// US36 - Valid ticket is marked as checked in (T64, T65)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { makeTestApp, checkinSetup, loginStudent, loginOrganizer, createEvent, addVolunteer, newStudent } = require('./helpers');

describe('US36 Mark valid ticket as checked in', () => {
  test('AC1/AC2: a valid active ticket is checked in and its status changes to checked in', async () => {
    const { app, db } = makeTestApp();
    const { ev, ticket, volunteer, holder } = await checkinSetup(app);
    const fixed = new Date();
    const res = await volunteer.agent.post(`/api/checkin/events/${ev.id}/scan`).send({ code: ticket.code }).expect(200);
    assert.equal(res.body.result, 'VALID');
    assert.ok(Math.abs(new Date(res.body.checkedInAt) - fixed) < 60000, 'check-in time recorded');
    assert.equal(db.prepare('SELECT status FROM tickets WHERE ticket_code = ?').get(ticket.code).status, 'checked_in');
    const row = db.prepare('SELECT * FROM checkins').get();
    assert.equal(row.event_id, ev.id);
    // the student's own ticket now shows Checked in
    assert.equal((await holder.agent.get(`/api/tickets/${ticket.code}`)).body.ticket.status, 'checked_in');
  });

  test('AC3: the check-in is still saved after a server restart', async () => {
    const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'etms-us36-')), 'etms.db');
    const first = makeTestApp({ dbPath: dbFile });
    const ev = await createEvent(first.app);
    const student = await loginStudent(first.app);
    const ticket = (await student.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    const org = await loginOrganizer(first.app);
    assert.equal((await org.post(`/api/checkin/events/${ev.id}/scan`).send({ code: ticket.code })).body.result, 'VALID');
    first.db.close();

    const second = makeTestApp({ dbPath: dbFile, seed: false });
    const org2 = await loginOrganizer(second.app);
    assert.equal((await org2.post(`/api/checkin/events/${ev.id}/scan`).send({ code: ticket.code })).body.result, 'ALREADY_USED');
    assert.equal(second.db.prepare('SELECT status FROM tickets WHERE ticket_code = ?').get(ticket.code).status, 'checked_in');
    second.db.close();
  });

  test('AC4: the same ticket cannot be checked in again', async () => {
    const { app } = makeTestApp();
    const { ev, ticket, volunteer } = await checkinSetup(app);
    await volunteer.agent.post(`/api/checkin/events/${ev.id}/scan`).send({ code: ticket.code });
    assert.equal((await volunteer.agent.post(`/api/checkin/events/${ev.id}/scan`).send({ code: ticket.code })).body.result, 'ALREADY_USED');
  });

  test('AC5: attendance numbers update after a check-in', async () => {
    const { app } = makeTestApp();
    const { ev, ticket, volunteer } = await checkinSetup(app);
    const before = (await volunteer.agent.get(`/api/checkin/events/${ev.id}/stats`).expect(200)).body;
    assert.deepEqual(before, { issued: 1, checkedIn: 0, notCheckedIn: 1 });
    const res = (await volunteer.agent.post(`/api/checkin/events/${ev.id}/scan`).send({ code: ticket.code })).body;
    assert.deepEqual(res.stats, { issued: 1, checkedIn: 1, notCheckedIn: 0 });
  });

  test('invalid scans never change a ticket or create a check-in', async () => {
    const { app, db } = makeTestApp();
    const a = await checkinSetup(app);
    const otherEvent = await createEvent(app);
    const vol2 = await newStudent(app);
    await addVolunteer(app, otherEvent.id, vol2.email);
    await vol2.agent.post(`/api/checkin/events/${otherEvent.id}/scan`).send({ code: a.ticket.code }); // wrong event
    assert.equal(db.prepare('SELECT status FROM tickets WHERE ticket_code = ?').get(a.ticket.code).status, 'active');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM checkins').get().n, 0);
  });
});
