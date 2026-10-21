// US25 - View my QR e-ticket (T43)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, newStudent, createEvent, loginOrganizer, request } = require('./helpers');
const { ticketQrSvg } = require('../src/lib/ticketQr');

describe('US25 View QR e-ticket', () => {
  const { app } = makeTestApp();

  test('AC1: after registering, the student is sent to their e-ticket page', async () => {
    const ev = await createEvent(app);
    const { agent } = await newStudent(app);
    const res = await agent.post(`/api/events/${ev.id}/register`).send({}).expect(201);
    const page = await agent.get(res.body.redirect.split('?')[0]).expect(200);
    assert.match(page.text, /id="tk-qr"/);
    assert.match(page.text, /You're registered!/);
  });

  test('AC2: the e-ticket includes the QR code for that ticket', async () => {
    const ev = await createEvent(app);
    const { agent } = await newStudent(app);
    const t = (await agent.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    const res = await agent.get(`/api/tickets/${t.code}`).expect(200);
    assert.equal(res.body.ticket.code, t.code);
    assert.equal(res.body.qrSvg, await ticketQrSvg(t.code), 'QR is the one generated from this ticket code');
  });

  test('AC3: only the ticket owner can view it', async () => {
    const ev = await createEvent(app);
    const owner = await newStudent(app);
    const t = (await owner.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    const other = await newStudent(app);
    const res = await other.agent.get(`/api/tickets/${t.code}`).expect(404);
    assert.equal(res.body.error, 'Ticket not found.');
    await request(app).get(`/api/tickets/${t.code}`).expect(401);
    const org = await loginOrganizer(app);
    await org.get(`/api/tickets/${t.code}`).expect(403);
  });

  test('ticket pages need a student login', async () => {
    const res = await request(app).get('/tickets/ETMS-2222-3333-4444').expect(302);
    assert.match(res.headers.location, /^\/login\?next=/);
    const org = await loginOrganizer(app);
    await org.get('/tickets/ETMS-2222-3333-4444').expect(403);
  });
});
