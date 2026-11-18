// US51 - Organizer marks event free/demo-paid (T92) · US52 - Student sees free/demo-paid status (T93)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, loginOrganizer, createEvent, newStudent, validEvent, request } = require('./helpers');

describe('US51 Mark event free or demo-paid', () => {
  const { app } = makeTestApp();

  test('AC1: organizer can choose free or demo-paid when creating and editing', async () => {
    const org = await loginOrganizer(app);
    const form = (await org.get('/organizer/events/new').expect(200)).text;
    assert.match(form, /name="paymentType" id="pay-free" value="free"/);
    assert.match(form, /name="paymentType" id="pay-demo" value="demo_paid"/);
    const ev = await createEvent(app, { paymentType: 'free' });
    await org.put(`/api/organizer/events/${ev.id}`).send(validEvent({ paymentType: 'demo_paid', price: '7.50' })).expect(200);
    const saved = (await request(app).get(`/api/events/${ev.id}`)).body.event;
    assert.equal(saved.paymentType, 'demo_paid');
    assert.equal(saved.priceCents, 750);
  });

  test('AC2: the selected value is saved (and free events have no price)', async () => {
    const paid = await createEvent(app, { paymentType: 'demo_paid', price: '12' });
    const free = await createEvent(app, { paymentType: 'free', price: '99' });
    assert.equal((await request(app).get(`/api/events/${paid.id}`)).body.event.priceCents, 1200);
    const f = (await request(app).get(`/api/events/${free.id}`)).body.event;
    assert.equal(f.paymentType, 'free');
    assert.equal(f.priceCents, 0);
  });

  test('AC3: invalid values are rejected', async () => {
    const org = await loginOrganizer(app);
    const cases = [
      [{ paymentType: 'bitcoin' }, 'paymentType'],
      [{ paymentType: 'demo_paid' }, 'price'],
      [{ paymentType: 'demo_paid', price: 'abc' }, 'price'],
      [{ paymentType: 'demo_paid', price: '0.10' }, 'price'],
      [{ paymentType: 'demo_paid', price: '1000' }, 'price'],
      [{ paymentType: 'demo_paid', price: '-5' }, 'price'],
    ];
    for (const [over, field] of cases) {
      const res = await org.post('/api/events').send(validEvent(over)).expect(400);
      assert.ok(res.body.errors[field], `${JSON.stringify(over)} -> error on ${field}`);
    }
  });

  test('AC4: the payment type belongs to the correct event', async () => {
    const a = await createEvent(app, { title: 'Paid One', paymentType: 'demo_paid', price: '3' });
    const b = await createEvent(app, { title: 'Free One' });
    const list = (await request(app).get('/api/events')).body.events;
    assert.equal(list.find((e) => e.id === a.id).paymentType, 'demo_paid');
    assert.equal(list.find((e) => e.id === b.id).paymentType, 'free');
  });

  test('events created by older clients without a payment type are free', async () => {
    const org = await loginOrganizer(app);
    const body = validEvent();
    delete body.paymentType;
    const ev = (await org.post('/api/events').send(body).expect(201)).body.event;
    assert.equal(ev.paymentType, 'free');
  });
});

describe('US52 Student sees free or demo-paid status', () => {
  const { app } = makeTestApp();

  test('AC1/AC2: list and details show the status the organizer set', async () => {
    const paid = await createEvent(app, { paymentType: 'demo_paid', price: '5' });
    const ev = (await request(app).get(`/api/events/${paid.id}`)).body.event;
    assert.equal(ev.paymentType, 'demo_paid');
    assert.equal(ev.priceCents, 500);
    const listJs = (await request(app).get('/js/event-list.js')).text;
    assert.match(listJs, /ETMS\.paymentText\(ev\)/);
    const detailsHtml = (await request(app).get(`/events/${paid.id}`)).text;
    assert.match(detailsHtml, /id="ev-price"/);
    const site = (await request(app).get('/js/site-common.js')).text;
    assert.match(site, /'Demo-paid · '/);
  });

  test('AC3: free events continue through the normal registration flow', async () => {
    const free = await createEvent(app, { paymentType: 'free' });
    const s = await newStudent(app);
    await s.agent.post(`/api/events/${free.id}/register`).send({}).expect(201);
  });

  test('AC4: demo-paid events send the student to the simulated checkout', async () => {
    const paid = await createEvent(app, { paymentType: 'demo_paid', price: '5' });
    const s = await newStudent(app);
    const direct = await s.agent.post(`/api/events/${paid.id}/register`).send({}).expect(409);
    assert.equal(direct.body.code, 'PAYMENT_REQUIRED');
    const state = (await s.agent.get(`/api/events/${paid.id}/registration`)).body;
    assert.equal(state.paymentType, 'demo_paid');
    const start = await s.agent.post(`/api/events/${paid.id}/checkout`).send({}).expect(201);
    assert.match(start.body.redirect, /^\/checkout\//);
    const js = (await request(app).get('/js/event-details.js')).text;
    assert.match(js, /Continue to demo checkout/);
  });
});
