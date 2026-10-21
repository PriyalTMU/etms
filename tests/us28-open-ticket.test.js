// US28 - Open a ticket and view its details and QR code (T46)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, newStudent, createEvent, request } = require('./helpers');

describe('US28 Open a ticket', () => {
  test('AC1: each ticket on My Tickets links to its own ticket page', async () => {
    const { app } = makeTestApp();
    const js = (await request(app).get('/js/my-tickets.js')).text;
    assert.match(js, /'\/tickets\/' \+ encodeURIComponent\(t\.code\)/);
    const ev = await createEvent(app);
    const { agent } = await newStudent(app);
    const t = (await agent.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    await agent.get(`/tickets/${t.code}`).expect(200);
  });

  test('AC2: opening a ticket shows that ticket\'s details and QR code - not another ticket', async () => {
    const { app } = makeTestApp();
    const a = await createEvent(app, { title: 'Ticket A Event' });
    const b = await createEvent(app, { title: 'Ticket B Event' });
    const { agent } = await newStudent(app);
    const ta = (await agent.post(`/api/events/${a.id}/register`).send({}).expect(201)).body.ticket;
    const tb = (await agent.post(`/api/events/${b.id}/register`).send({}).expect(201)).body.ticket;
    const ra = (await agent.get(`/api/tickets/${ta.code}`).expect(200)).body;
    const rb = (await agent.get(`/api/tickets/${tb.code}`).expect(200)).body;
    assert.equal(ra.ticket.event.title, 'Ticket A Event');
    assert.equal(rb.ticket.event.title, 'Ticket B Event');
    assert.notEqual(ra.qrSvg, rb.qrSvg);
    assert.equal(ra.ticket.status, 'active');
  });

  test('AC3: unknown or badly formed ticket codes show "Ticket not found."', async () => {
    const { app } = makeTestApp();
    const { agent } = await newStudent(app);
    for (const code of ['ETMS-2222-3333-4444', 'not-a-code', "1' OR '1'='1"]) {
      const res = await agent.get(`/api/tickets/${encodeURIComponent(code)}`).expect(404);
      assert.equal(res.body.error, 'Ticket not found.');
    }
  });
});
