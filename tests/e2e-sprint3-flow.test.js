// T71 - End-to-end Sprint 3 flow (Sprint Goal), including a server restart, plus Sprint 1-2 regression
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { makeTestApp, loginOrganizer, newStudent, validEvent, request, loginStudent } = require('./helpers');

describe('E2E Sprint 3: volunteer access → scan → validate → check in → attendance', () => {
  test('full Sprint 3 flow works end to end and survives a restart', async () => {
    const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'etms-e2e3-')), 'etms.db');
    const { app, db } = makeTestApp({ dbPath: dbFile });

    // Organizer creates an event; two students register; a third student will volunteer
    const org = await loginOrganizer(app);
    const ev = (await org.post('/api/events').send(validEvent({ title: 'Games Night', capacity: '10' })).expect(201)).body.event;
    const amira = await newStudent(app, 'Amira Khan');
    const ben = await newStudent(app, 'Ben Osei');
    const ta = (await amira.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    const tb = (await ben.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    const vol = await newStudent(app, 'Val Volunteer');

    // Before access, the volunteer is blocked; organizer gives access to this event only
    await vol.agent.get(`/api/checkin/events/${ev.id}`).expect(403);
    await org.post(`/api/organizer/events/${ev.id}/volunteers`).send({ email: vol.email }).expect(201);
    await vol.agent.get(`/checkin/events/${ev.id}`).expect(200);

    // Scan results
    const scan = (code) => vol.agent.post(`/api/checkin/events/${ev.id}/scan`).send({ code }).then((r) => r.body);
    assert.equal((await scan(ta.code)).result, 'VALID');
    assert.equal((await scan(ta.code)).result, 'ALREADY_USED');
    assert.equal((await scan('ETMS-2222-3333-4444')).result, 'INVALID');
    assert.equal((await scan('garbage')).result, 'UNREADABLE');
    const seeded = (await request(app).get('/api/events')).body.events.find((e) => e.id !== ev.id);
    const other = await newStudent(app, 'Dana Other');
    const td = (await other.agent.post(`/api/events/${seeded.id}/register`).send({}).expect(201)).body.ticket;
    assert.equal((await scan(td.code)).result, 'WRONG_EVENT');
    assert.equal((await scan(tb.code.toLowerCase())).result, 'VALID');

    // Organizer attendance
    const att = (await org.get(`/api/organizer/events/${ev.id}/tickets`).expect(200)).body;
    assert.deepEqual(att.summary, { issued: 2, checkedIn: 2, notCheckedIn: 0 });
    assert.ok(att.tickets.every((t) => t.checkedInBy === 'Val Volunteer'));
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM checkins').get().n, 2);
    db.close();

    // Restart: check-ins kept, tickets still used
    const restarted = makeTestApp({ dbPath: dbFile, seed: false });
    const org2 = await loginOrganizer(restarted.app);
    assert.equal((await org2.get(`/api/organizer/events/${ev.id}/tickets`)).body.summary.checkedIn, 2);
    assert.equal((await org2.post(`/api/checkin/events/${ev.id}/scan`).send({ code: ta.code })).body.result, 'ALREADY_USED');
    restarted.db.close();
  });

  test('Sprint 1 and 2 flows still work with the Sprint 3 changes (regression)', async () => {
    const { app } = makeTestApp();
    const org = await loginOrganizer(app);
    const ev = (await org.post('/api/events').send(validEvent({ title: 'Regression Check', capacity: '1' })).expect(201)).body.event;
    const s = await loginStudent(app);
    const t = (await s.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    assert.equal((await s.get('/api/my/tickets')).body.tickets[0].code, t.code);
    const late = await newStudent(app);
    assert.equal((await late.agent.post(`/api/events/${ev.id}/register`).send({})).body.code, 'EVENT_FULL');
  });
});
