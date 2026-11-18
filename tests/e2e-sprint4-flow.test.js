// T97 / T99 - End-to-end Sprint 4 flow, as written in the Sprint 4 Goal:
// Organizer creates or edits an event -> changes appear to students -> student searches/filters ->
// selects the event -> free/demo-paid status shown -> registers or completes simulated checkout ->
// result shown -> ticket issued -> student cancels the ticket -> availability restored.
// Plus regression: a database from Sprint 3 is upgraded in place and keeps its data.
const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { makeTestApp, loginOrganizer, newStudent, addVolunteer, validEvent, daysFromNow, request } = require('./helpers');

describe('E2E Sprint 4 flow', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'etms-e2e4-'));
  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('organizer -> student, free and demo-paid, cancel and restore, all stories together', async () => {
    const file = path.join(dir, 'e2e.db');
    const { app, db } = makeTestApp({ dbPath: file });
    const org = await loginOrganizer(app);

    // US39 + US51: create a free event, then edit it into a demo-paid gala
    const ev = (await org.post('/api/events').send(validEvent({ title: 'Winter Gala Draft', category: 'social', capacity: '2' })).expect(201)).body.event;
    await org.put(`/api/organizer/events/${ev.id}`).send(validEvent({ title: 'Winter Formal Gala', category: 'social', capacity: '2', paymentType: 'demo_paid', price: '15', date: daysFromNow(12) })).expect(200);
    const free = (await org.post('/api/events').send(validEvent({ title: 'Free Study Jam', category: 'academic' })).expect(201)).body.event;

    // US40 + US45 + US46 + US47: the student finds the edited event by keyword, category and date
    const s = await newStudent(app, 'Jordan Lee');
    const found = (await s.agent.get(`/api/events?q=gala&category=social&from=${daysFromNow(11)}&to=${daysFromNow(13)}`).expect(200)).body.events;
    assert.deepEqual(found.map((e) => e.title), ['Winter Formal Gala']);
    // US48: clearing shows everything again
    assert.ok((await s.agent.get('/api/events').expect(200)).body.events.length >= 5);

    // US14/US52: details show demo-paid; direct registration is refused (US50)
    const details = (await s.agent.get(`/api/events/${ev.id}`)).body.event;
    assert.equal(details.paymentType, 'demo_paid');
    assert.equal((await s.agent.post(`/api/events/${ev.id}/register`).send({}).expect(409)).body.code, 'PAYMENT_REQUIRED');

    // US53: a declined demo payment issues nothing; US54: a completed one issues one ticket
    const t1 = (await s.agent.post(`/api/events/${ev.id}/checkout`).send({}).expect(201)).body.checkout.token;
    await s.agent.post(`/api/checkout/${t1}/decline`).send({}).expect(200);
    assert.equal((await s.agent.get(`/api/events/${ev.id}`)).body.event.ticketsIssued, 0);
    const t2 = (await s.agent.post(`/api/events/${ev.id}/checkout`).send({}).expect(201)).body.checkout.token;
    const paid = (await s.agent.post(`/api/checkout/${t2}/complete`).send({}).expect(201)).body;
    assert.match(paid.redirect, /\?new=1&paid=1$/);   // US49: confirmation page for the new ticket
    const ticket = (await s.agent.get(`/api/tickets/${paid.ticketCode}`).expect(200)).body.ticket;
    assert.equal(ticket.event.title, 'Winter Formal Gala');

    // Free events still register normally (US52 AC3)
    const freeTicket = (await s.agent.post(`/api/events/${free.id}/register`).send({}).expect(201)).body.ticket;

    // Another student fills the last spot; a third is told the event is full (US50)
    const s2 = await newStudent(app, 'Sam Patel');
    const t3 = (await s2.agent.post(`/api/events/${ev.id}/checkout`).send({}).expect(201)).body.checkout.token;
    await s2.agent.post(`/api/checkout/${t3}/complete`).send({}).expect(201);
    const s3 = await newStudent(app, 'Alex Chen');
    assert.equal((await s3.agent.post(`/api/events/${ev.id}/checkout`).send({}).expect(409)).body.code, 'EVENT_FULL');

    // US42 + US43 + US44: Jordan cancels; the spot goes back; Alex can now get it
    const cancel = (await s.agent.post(`/api/tickets/${paid.ticketCode}/cancel`).send({}).expect(200)).body;
    assert.match(cancel.message, /has been cancelled/);
    assert.equal(cancel.event.ticketsRemaining, 1);
    const t4 = (await s3.agent.post(`/api/events/${ev.id}/checkout`).send({}).expect(201)).body.checkout.token;
    await s3.agent.post(`/api/checkout/${t4}/complete`).send({}).expect(201);

    // Sprint 3 still works: a volunteer checks Alex in; a cancelled ticket is refused at the door
    const vol = await newStudent(app, 'Door Volunteer');
    await addVolunteer(app, ev.id, vol.email);
    const alexTicket = (await s3.agent.get('/api/my/tickets')).body.tickets.find((t) => t.eventId === ev.id);
    assert.equal((await vol.agent.post(`/api/checkin/events/${ev.id}/scan`).send({ code: alexTicket.code })).body.result, 'VALID');
    assert.equal((await vol.agent.post(`/api/checkin/events/${ev.id}/scan`).send({ code: paid.ticketCode })).body.result, 'CANCELLED');

    // US41: the organizer cancels the free event; Jordan's free ticket shows it; registration stops
    await org.post(`/api/organizer/events/${free.id}/cancel`).send({ reason: 'Room double-booked' }).expect(200);
    assert.equal((await s.agent.get(`/api/tickets/${freeTicket.code}`)).body.ticket.event.isCancelled, true);
    assert.equal((await s2.agent.post(`/api/events/${free.id}/register`).send({}).expect(409)).body.code, 'EVENT_CANCELLED');
    db.close();

    // Everything is still there after a restart
    const again = makeTestApp({ dbPath: file, seed: false });
    const e = (await request(again.app).get(`/api/events/${ev.id}`)).body.event;
    assert.equal(e.ticketsIssued, 2);
    assert.equal((await request(again.app).get(`/api/events/${free.id}`)).body.event.isCancelled, true);
    again.db.close();
  });

  test('a database created in Sprint 3 is upgraded in place and keeps its events and tickets', async () => {
    const file = path.join(dir, 'sprint3.db');
    // Build a Sprint 3-shaped database by hand (no Sprint 4 columns)
    const old = new DatabaseSync(file);
    old.exec(`
      CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL, role TEXT NOT NULL, club_name TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE events (id INTEGER PRIMARY KEY AUTOINCREMENT, organizer_id INTEGER NOT NULL, title TEXT NOT NULL,
        description TEXT NOT NULL, event_date TEXT NOT NULL, event_time TEXT NOT NULL, location TEXT NOT NULL,
        capacity INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_code TEXT NOT NULL UNIQUE, event_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT (datetime('now')));
      INSERT INTO users (name, email, password_hash, role, club_name) VALUES ('Old Org', 'old@etms.test', 'x', 'organizer', 'Old Club');
      INSERT INTO users (name, email, password_hash, role) VALUES ('Old Student', 'olds@etms.test', 'x', 'student');
      INSERT INTO events (organizer_id, title, description, event_date, event_time, location, capacity)
        VALUES (1, 'Sprint 3 Event', 'Made before Sprint 4', '${daysFromNow(3)}', '18:00', 'ENG 103', 10);
      INSERT INTO tickets (ticket_code, event_id, student_id) VALUES ('ETMS-AAAA-BBBB-CCCC', 1, 2);
    `);
    old.close();

    const { app, db } = makeTestApp({ dbPath: file, seed: false });
    const e = (await request(app).get('/api/events/1').expect(200)).body.event;
    assert.equal(e.title, 'Sprint 3 Event');
    assert.equal(e.paymentType, 'free');
    assert.equal(e.category, 'other');
    assert.equal(e.status, 'scheduled');
    assert.equal(e.ticketsIssued, 1);
    assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'checkouts'").get());
    db.close();
  });
});
