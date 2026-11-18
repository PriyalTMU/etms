// US49 - Successful registration confirmation (T90) · US50 - Registration failure reason (T91)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, loginOrganizer, createEvent, newStudent, request } = require('./helpers');

describe('US49 Successful registration confirmation', () => {
  const { app } = makeTestApp();

  test('AC1/AC2: success leads to the new ticket with a confirmation', async () => {
    const ev = await createEvent(app, { title: 'Welcome Mixer' });
    const s = await newStudent(app);
    const res = await s.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201);
    assert.equal(res.body.redirect, `/tickets/${res.body.ticket.code}?new=1`);
    const page = (await s.agent.get(res.body.redirect).expect(200)).text;
    assert.match(page, /id="new-msg"/);
    const mine = (await s.agent.get('/api/my/tickets')).body.tickets;
    assert.ok(mine.some((t) => t.code === res.body.ticket.code), 'student can reach the new ticket');
  });

  test('AC3: the confirmation names the correct event', async () => {
    const ev = await createEvent(app, { title: 'Exactly This Event' });
    const s = await newStudent(app);
    const res = await s.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201);
    assert.equal(res.body.ticket.event.title, 'Exactly This Event');
    assert.equal(res.body.event.id, ev.id);
    const js = (await request(app).get('/js/ticket.js')).text;
    assert.match(js, /You're registered for \\"" \+ ev\.title/);
  });
});

describe('US50 Registration failure reason', () => {
  const { app, db } = makeTestApp();
  const count = () => db.prepare('SELECT COUNT(*) AS n FROM tickets').get().n;

  test('AC1/AC2: full, duplicate, cancelled, paid, not-logged-in and organizer cases each give a reason', async () => {
    const full = await createEvent(app, { capacity: '1' });
    const a = await newStudent(app);
    await a.agent.post(`/api/events/${full.id}/register`).send({}).expect(201);

    const b = await newStudent(app);
    const before = count();
    const cases = [
      [await b.agent.post(`/api/events/${full.id}/register`).send({}), 409, 'EVENT_FULL', /event is full/],
      [await a.agent.post(`/api/events/${full.id}/register`).send({}), 409, 'ALREADY_REGISTERED', /already have a ticket/],
    ];
    const cancelled = await createEvent(app);
    const org = await loginOrganizer(app);
    await org.post(`/api/organizer/events/${cancelled.id}/cancel`).send({}).expect(200);
    cases.push([await b.agent.post(`/api/events/${cancelled.id}/register`).send({}), 409, 'EVENT_CANCELLED', /cancelled by the organizer/]);
    const paid = await createEvent(app, { paymentType: 'demo_paid', price: '4' });
    cases.push([await b.agent.post(`/api/events/${paid.id}/register`).send({}), 409, 'PAYMENT_REQUIRED', /demo checkout/]);
    cases.push([await request(app).post(`/api/events/${full.id}/register`).send({}), 401, undefined, /log in/i]);
    cases.push([await org.post(`/api/events/${full.id}/register`).send({}), 403, undefined, /Only student accounts/]);
    cases.push([await b.agent.post('/api/events/999999/register').send({}), 404, undefined, /not found/i]);

    for (const [res, status, code, msg] of cases) {
      assert.equal(res.status, status, `${code || status}`);
      if (code) assert.equal(res.body.code, code);
      assert.match(res.body.error, msg);
    }
    assert.equal(count(), before, 'AC3: no failed registration created a ticket');
  });

  test('the details page shows each reason to the student', async () => {
    const js = (await request(app).get('/js/event-details.js')).text;
    assert.match(js, /function showFailure/);
    assert.match(js, /EVENT_CANCELLED/);
    assert.match(js, /message\(body\.error \|\| 'Registration failed\. Please try again\.', 'error'\)/);
  });
});
