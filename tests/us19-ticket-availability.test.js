// US19 - Ticket availability updates after registration (T37)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, loginOrganizer, validEvent, request } = require('./helpers');

async function newEvent(app, capacity) {
  const agent = await loginOrganizer(app);
  return (await agent.post('/api/events').send(validEvent({ title: `Availability ${capacity}`, capacity: String(capacity) })).expect(201)).body.event;
}

function studentIds(db, n) {
  const ids = [];
  for (let i = 0; i < n; i++) {
    ids.push(Number(db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, 'x', 'student')").run(`S${i}`, `avail${i}.${Date.now()}@torontomu.ca`).lastInsertRowid));
  }
  return ids;
}

describe('US19 Ticket availability', () => {
  test('AC1: event details and the event list show how many tickets are left', async () => {
    const { app } = makeTestApp();
    const ev = await newEvent(app, 5);
    const details = (await request(app).get(`/api/events/${ev.id}`).expect(200)).body.event;
    assert.equal(details.ticketsIssued, 0);
    assert.equal(details.ticketsRemaining, 5);
    assert.equal(details.isFull, false);
    const listed = (await request(app).get('/api/events')).body.events.find((e) => e.id === ev.id);
    assert.equal(listed.ticketsRemaining, 5);
  });

  test('AC2: tickets left goes down by one after each registration', async () => {
    const { app, db } = makeTestApp();
    const { tickets } = app.locals.models;
    const ev = await newEvent(app, 3);
    const [a, b] = studentIds(db, 2);
    tickets.register(ev.id, a, ev.capacity);
    assert.equal((await request(app).get(`/api/events/${ev.id}`)).body.event.ticketsRemaining, 2);
    tickets.register(ev.id, b, ev.capacity);
    const after = (await request(app).get(`/api/events/${ev.id}`)).body.event;
    assert.equal(after.ticketsRemaining, 1);
    assert.equal(after.ticketsIssued, 2);
  });

  test('AC2: when the last ticket is taken the event shows as full with 0 left', async () => {
    const { app, db } = makeTestApp();
    const ev = await newEvent(app, 1);
    app.locals.models.tickets.register(ev.id, studentIds(db, 1)[0], 1);
    const after = (await request(app).get(`/api/events/${ev.id}`)).body.event;
    assert.equal(after.ticketsRemaining, 0);
    assert.equal(after.isFull, true);
  });

  test('cancelled tickets do not count against availability (ready for Sprint 4)', async () => {
    const { app, db } = makeTestApp();
    const ev = await newEvent(app, 2);
    const r = app.locals.models.tickets.register(ev.id, studentIds(db, 1)[0], 2);
    db.prepare("UPDATE tickets SET status = 'cancelled' WHERE id = ?").run(r.ticket.id);
    assert.equal((await request(app).get(`/api/events/${ev.id}`)).body.event.ticketsRemaining, 2);
  });

  test('pages have a place to show availability', async () => {
    const { app } = makeTestApp();
    const ev = await newEvent(app, 4);
    const page = await request(app).get(`/events/${ev.id}`).expect(200);
    assert.match(page.text, /id="ev-availability"/);
    const js = await request(app).get('/js/site-common.js').expect(200);
    assert.match(js.text, /availabilityText/);
  });
});
