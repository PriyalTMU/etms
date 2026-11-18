// US53 - Complete simulated checkout (T94) · US54 - Issue ticket after successful demo checkout (T95)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, createEvent, newStudent, request } = require('./helpers');

async function startCheckout(app, eventOver = {}) {
  const ev = await createEvent(app, { title: 'Gala Night', paymentType: 'demo_paid', price: '15', capacity: '10', ...eventOver });
  const s = await newStudent(app);
  const res = await s.agent.post(`/api/events/${ev.id}/checkout`).send({}).expect(201);
  return { ev, s, token: res.body.checkout.token, redirect: res.body.redirect };
}

describe('US53 Complete simulated checkout', () => {
  const { app, db } = makeTestApp();
  const ticketsFor = (eventId) => db.prepare('SELECT COUNT(*) AS n FROM tickets WHERE event_id = ?').get(eventId).n;

  test('AC1: demo-paid events open a simulated checkout', async () => {
    const { s, token, redirect } = await startCheckout(app);
    assert.equal(redirect, `/checkout/${token}`);
    await s.agent.get(redirect).expect(200);
    const c = (await s.agent.get(`/api/checkout/${token}`).expect(200)).body.checkout;
    assert.equal(c.amountCents, 1500);
    assert.equal(c.status, 'pending');
    assert.equal(c.event.title, 'Gala Night');
  });

  test('AC2: the checkout clearly states that no real payment is processed (and asks for no card details)', async () => {
    const { s, token } = await startCheckout(app);
    const page = (await s.agent.get(`/checkout/${token}`)).text;
    assert.match(page, /DEMO CHECKOUT – no real payment/);
    assert.doesNotMatch(page, /card number|cvv|cvc|expiry/i, 'no card fields at all (NFR1)');
    const cols = db.prepare('PRAGMA table_info(checkouts)').all().map((c) => c.name);
    assert.ok(!cols.some((c) => /card|cvv|pan/i.test(c)));
    assert.match((await s.agent.get(`/api/checkout/${token}`)).body.demoNotice, /no real payment/);
  });

  test('AC3: student can complete or cancel the checkout', async () => {
    const a = await startCheckout(app);
    const done = await a.s.agent.post(`/api/checkout/${a.token}/complete`).send({}).expect(201);
    assert.match(done.body.redirect, /^\/tickets\/ETMS-.*\?new=1&paid=1$/);
    const b = await startCheckout(app);
    const cancelled = await b.s.agent.post(`/api/checkout/${b.token}/cancel`).send({}).expect(200);
    assert.equal(cancelled.body.checkout.status, 'cancelled');
    assert.match(cancelled.body.message, /No ticket was issued/);
  });

  test('AC4: a declined or cancelled checkout does not issue a ticket', async () => {
    const d = await startCheckout(app);
    await d.s.agent.post(`/api/checkout/${d.token}/decline`).send({}).expect(200);
    assert.equal(ticketsFor(d.ev.id), 0);
    const late = await d.s.agent.post(`/api/checkout/${d.token}/complete`).send({}).expect(409);
    assert.equal(late.body.code, 'CHECKOUT_CLOSED');
    assert.equal(ticketsFor(d.ev.id), 0, 'completing a declined checkout still issues nothing');

    const c = await startCheckout(app);
    await c.s.agent.post(`/api/checkout/${c.token}/cancel`).send({}).expect(200);
    await c.s.agent.post(`/api/checkout/${c.token}/complete`).send({}).expect(409);
    assert.equal(ticketsFor(c.ev.id), 0);
  });

  test('AC5: repeated submission does not create duplicate tickets', async () => {
    const { ev, s, token } = await startCheckout(app);
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => s.agent.post(`/api/checkout/${token}/complete`).send({})));
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [200, 200, 200, 200, 201], 'one creates the ticket, the rest return the same ticket');
    assert.equal(new Set(results.map((r) => r.body.ticketCode)).size, 1);
    assert.equal(ticketsFor(ev.id), 1);
  });

  test("a student cannot open or complete someone else's checkout", async () => {
    const { token } = await startCheckout(app);
    const other = await newStudent(app, 'Nosy Student');
    await other.agent.get(`/api/checkout/${token}`).expect(404);
    await other.agent.post(`/api/checkout/${token}/complete`).send({}).expect(404);
    await request(app).get(`/api/checkout/${token}`).expect(401);
  });

  test('starting checkout twice reuses the open checkout; free events have no checkout', async () => {
    const ev = await createEvent(app, { paymentType: 'demo_paid', price: '2' });
    const s = await newStudent(app);
    const one = (await s.agent.post(`/api/events/${ev.id}/checkout`).send({}).expect(201)).body.checkout.token;
    const two = (await s.agent.post(`/api/events/${ev.id}/checkout`).send({}).expect(201)).body.checkout.token;
    assert.equal(one, two);
    const free = await createEvent(app);
    const res = await s.agent.post(`/api/events/${free.id}/checkout`).send({}).expect(409);
    assert.equal(res.body.code, 'NOT_PAID');
  });
});

describe('US54 Issue ticket after successful demo checkout', () => {
  const { app } = makeTestApp();

  test('AC1/AC2/AC3: one valid ticket for the right student and event, with a unique code and QR code', async () => {
    const { ev, s, token } = await startCheckout(app, { title: 'Paid Concert' });
    const done = (await s.agent.post(`/api/checkout/${token}/complete`).send({}).expect(201)).body;
    const t = (await s.agent.get(`/api/tickets/${done.ticketCode}`).expect(200)).body;
    assert.equal(t.ticket.status, 'active');
    assert.equal(t.ticket.event.id, ev.id);
    assert.equal(t.ticket.event.title, 'Paid Concert');
    assert.match(t.ticket.code, /^ETMS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    assert.match(t.qrSvg, /^<svg/);
    const me = (await s.agent.get('/api/auth/me')).body.user;
    assert.equal(t.ticket.studentId, me.id);
  });

  test('AC4: availability updates correctly', async () => {
    const { ev, s, token } = await startCheckout(app, { capacity: '3' });
    assert.equal((await request(app).get(`/api/events/${ev.id}`)).body.event.ticketsRemaining, 3, 'an open checkout does not hold a spot');
    await s.agent.post(`/api/checkout/${token}/complete`).send({}).expect(201);
    assert.equal((await request(app).get(`/api/events/${ev.id}`)).body.event.ticketsRemaining, 2);
  });

  test('AC5: the student can open the ticket from My Tickets', async () => {
    const { s, token } = await startCheckout(app);
    const code = (await s.agent.post(`/api/checkout/${token}/complete`).send({}).expect(201)).body.ticketCode;
    const mine = (await s.agent.get('/api/my/tickets').expect(200)).body.tickets;
    assert.ok(mine.some((t) => t.code === code));
    await s.agent.get(`/tickets/${code}`).expect(200);
  });

  test('if the event fills up during checkout, no ticket is issued and the reason is shown', async () => {
    const { ev, s, token } = await startCheckout(app, { capacity: '1' });
    const other = await newStudent(app, 'Faster Student');
    const t2 = (await other.agent.post(`/api/events/${ev.id}/checkout`).send({}).expect(201)).body.checkout.token;
    await other.agent.post(`/api/checkout/${t2}/complete`).send({}).expect(201);
    const res = await s.agent.post(`/api/checkout/${token}/complete`).send({}).expect(409);
    assert.equal(res.body.code, 'EVENT_FULL');
    assert.match(res.body.error, /No ticket was issued and nothing was charged/);
    assert.equal((await request(app).get(`/api/events/${ev.id}`)).body.event.ticketsIssued, 1);
  });

  test('if the event is cancelled during checkout, no ticket is issued', async () => {
    const { ev, s, token } = await startCheckout(app);
    const { loginOrganizer } = require('./helpers');
    const org = await loginOrganizer(app);
    await org.post(`/api/organizer/events/${ev.id}/cancel`).send({}).expect(200);
    const res = await s.agent.post(`/api/checkout/${token}/complete`).send({}).expect(409);
    assert.equal(res.body.code, 'EVENT_CANCELLED');
    assert.equal((await request(app).get(`/api/events/${ev.id}`)).body.event.ticketsIssued, 0);
  });
});
