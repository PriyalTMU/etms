// US18 - Successful registration is saved to the student's account (T32, T36)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { makeTestApp, loginStudent, createEvent, STUDENT } = require('./helpers');

describe('US18 Registration saved to the account', () => {
  test('AC1: the ticket is stored with the student and the event', async () => {
    const { app, db } = makeTestApp();
    const ev = await createEvent(app);
    const student = await loginStudent(app);
    const me = (await student.get('/api/auth/me')).body.user;
    const t = (await student.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    const row = db.prepare('SELECT * FROM tickets WHERE ticket_code = ?').get(t.code);
    assert.equal(row.student_id, me.id);
    assert.equal(row.event_id, ev.id);
    assert.equal(row.status, 'active');
  });

  test('AC2: the ticket is still on the account after logging out and back in', async () => {
    const { app } = makeTestApp();
    const ev = await createEvent(app);
    const first = await loginStudent(app);
    const t = (await first.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    await first.post('/api/auth/logout').expect(200);
    const again = await loginStudent(app, STUDENT);
    const reg = (await again.get(`/api/events/${ev.id}/registration`)).body;
    assert.equal(reg.ticketCode, t.code);
  });

  test('AC2: the ticket is still saved after the server restarts', async () => {
    const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'etms-us18-')), 'etms.db');
    const first = makeTestApp({ dbPath: dbFile });
    const ev = await createEvent(first.app);
    const student = await loginStudent(first.app);
    const t = (await student.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    first.db.close();

    const second = makeTestApp({ dbPath: dbFile, seed: false });
    const again = await loginStudent(second.app);
    assert.equal((await again.get(`/api/events/${ev.id}/registration`)).body.ticketCode, t.code);
    second.db.close();
  });

  test('a failed registration saves nothing', async () => {
    const { app, db } = makeTestApp();
    const student = await loginStudent(app);
    await student.post('/api/events/424242/register').send({}).expect(404);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tickets').get().n, 0);
  });
});
