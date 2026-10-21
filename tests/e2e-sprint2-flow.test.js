// T49 - End-to-end Sprint 2 flow (Sprint Goal), including a server restart
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { makeTestApp, loginOrganizer, loginStudent, newStudent, validEvent, request } = require('./helpers');
const { ticketQrSvg } = require('../src/lib/ticketQr');

describe('E2E Sprint 2: register → ticket with QR → My Tickets, with capacity and duplicate rules', () => {
  test('full Sprint 2 flow works end to end and survives a restart', async () => {
    const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'etms-e2e2-')), 'etms.db');
    const { app, db } = makeTestApp({ dbPath: dbFile });

    // Organizer creates a 2-spot event
    const org = await loginOrganizer(app);
    const ev = (await org.post('/api/events').send(validEvent({ title: 'Board Game Night', capacity: '2' })).expect(201)).body.event;
    assert.equal((await request(app).get(`/api/events/${ev.id}`)).body.event.ticketsRemaining, 2);

    // Student 1 registers -> ticket with unique code + QR, saved to account
    const s1 = await loginStudent(app);
    const reg = await s1.post(`/api/events/${ev.id}/register`).send({}).expect(201);
    const code = reg.body.ticket.code;
    assert.match(code, /^ETMS(-[2-9A-HJKMNP-Z]{4}){3}$/);
    assert.equal(reg.body.event.ticketsRemaining, 1, 'availability updated');
    await s1.post(`/api/events/${ev.id}/register`).send({}).expect(409); // duplicate refused

    const mine = (await s1.get('/api/my/tickets').expect(200)).body.tickets;
    assert.equal(mine.length, 1);
    assert.equal(mine[0].event.title, 'Board Game Night');
    const one = (await s1.get(`/api/tickets/${code}`).expect(200)).body;
    assert.equal(one.qrSvg, await ticketQrSvg(code));
    await s1.get(`/tickets/${code}`).expect(200);
    await s1.get('/my-tickets').expect(200);

    // Student 2 takes the last spot, student 3 is refused because the event is full
    await (await newStudent(app)).agent.post(`/api/events/${ev.id}/register`).send({}).expect(201);
    const s3 = (await newStudent(app)).agent;
    const full = await s3.post(`/api/events/${ev.id}/register`).send({}).expect(409);
    assert.equal(full.body.code, 'EVENT_FULL');
    assert.equal((await s3.get('/api/my/tickets')).body.tickets.length, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tickets WHERE event_id = ?').get(ev.id).n, 2);
    db.close();

    // Restart: tickets are still there
    const restarted = makeTestApp({ dbPath: dbFile, seed: false });
    const again = await loginStudent(restarted.app);
    const after = (await again.get('/api/my/tickets')).body.tickets;
    assert.equal(after[0].code, code);
    assert.equal((await request(restarted.app).get(`/api/events/${ev.id}`)).body.event.isFull, true);
    restarted.db.close();
  });

  test('Sprint 1 flow still works with the Sprint 2 changes (regression)', async () => {
    const { app } = makeTestApp();
    const org = await loginOrganizer(app);
    const ev = (await org.post('/api/events').send(validEvent({ title: 'Regression Check' })).expect(201)).body.event;
    const list = (await request(app).get('/api/events')).body.events;
    assert.ok(list.some((e) => e.id === ev.id));
    const details = (await request(app).get(`/api/events/${ev.id}`)).body.event;
    assert.equal(details.title, 'Regression Check');
  });
});
