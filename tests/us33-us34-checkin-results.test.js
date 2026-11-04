// US33 - Valid-ticket result (T61)   US34 - Invalid tickets rejected (T62)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, checkinSetup, request } = require('./helpers');

describe('US33 Show valid-ticket result', () => {
  test('AC1/AC3: a valid ticket for this event returns a success result for that ticket and event', async () => {
    const { app } = makeTestApp();
    const { ev, ticket, volunteer } = await checkinSetup(app);
    const r = (await volunteer.agent.post(`/api/checkin/events/${ev.id}/scan`).send({ code: ticket.code })).body;
    assert.equal(r.result, 'VALID');
    assert.equal(r.valid, true);
    assert.equal(r.ticket.code, ticket.code);
    assert.equal(r.ticket.holderName, 'Ticket Holder');
    assert.equal(r.ticket.eventId, ev.id);
    assert.equal(r.message, 'Valid ticket – checked in. Let them in.');
  });

  test('AC2/AC4: the page shows a big, clear "LET THEM IN" result', async () => {
    const { app } = makeTestApp();
    const js = (await request(app).get('/js/checkin-result.js')).text;
    assert.match(js, /VALID – LET THEM IN/);
    const css = (await request(app).get('/css/styles.css')).text;
    assert.match(css, /\.scan-result\.ok \{/);
    const { ev, volunteer } = await checkinSetup(app);
    const page = (await volunteer.agent.get(`/checkin/events/${ev.id}`)).text;
    assert.match(page, /id="scan-result"[^>]*aria-live="assertive"/);
    assert.match(page, /checkin-result\.js/);
  });
});

describe('US34 Reject invalid ticket', () => {
  test('AC1: an unknown ticket code is rejected', async () => {
    const { app } = makeTestApp();
    const { ev, volunteer } = await checkinSetup(app);
    const r = (await volunteer.agent.post(`/api/checkin/events/${ev.id}/scan`).send({ code: 'ETMS-2222-3333-4444' })).body;
    assert.equal(r.result, 'INVALID');
    assert.equal(r.valid, false);
  });

  test('AC2: a ticket belonging to another event is rejected and names that event', async () => {
    const { app } = makeTestApp();
    const a = await checkinSetup(app, { title: 'Event A' });
    const b = await checkinSetup(app, { title: 'Event B' });
    const r = (await a.volunteer.agent.post(`/api/checkin/events/${a.ev.id}/scan`).send({ code: b.ticket.code })).body;
    assert.equal(r.result, 'WRONG_EVENT');
    assert.equal(r.ticket.eventTitle, 'Event B');
    assert.equal(r.message, 'Invalid ticket – this ticket is for a different event.');
  });

  test('AC3: invalid input does not create a check-in record', async () => {
    const { app, db } = makeTestApp();
    const a = await checkinSetup(app);
    const b = await checkinSetup(app);
    await a.volunteer.agent.post(`/api/checkin/events/${a.ev.id}/scan`).send({ code: 'ETMS-2222-3333-4444' });
    await a.volunteer.agent.post(`/api/checkin/events/${a.ev.id}/scan`).send({ code: b.ticket.code });
    await a.volunteer.agent.post(`/api/checkin/events/${a.ev.id}/scan`).send({ code: 'nonsense' });
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM checkins').get().n, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE status = 'checked_in'").get().n, 0);
  });

  test('AC4: clear invalid messages, and a cancelled ticket is rejected too', async () => {
    const { app, db } = makeTestApp();
    const { ev, ticket, volunteer } = await checkinSetup(app);
    const r = (await volunteer.agent.post(`/api/checkin/events/${ev.id}/scan`).send({ code: 'ETMS-2222-3333-4444' })).body;
    assert.equal(r.message, 'Invalid ticket – this code does not match any ticket. Do not let them in.');
    db.prepare("UPDATE tickets SET status = 'cancelled' WHERE ticket_code = ?").run(ticket.code);
    const c = (await volunteer.agent.post(`/api/checkin/events/${ev.id}/scan`).send({ code: ticket.code })).body;
    assert.equal(c.result, 'CANCELLED');
    const js = (await request(app).get('/js/checkin-result.js')).text;
    for (const t of ['INVALID TICKET – DO NOT LET IN', 'WRONG EVENT – DO NOT LET IN', 'ALREADY USED – DO NOT LET IN']) assert.ok(js.includes(t), t);
  });
});
