// US32 - Enter or scan a ticket identifier (T58, T59, T60)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const QRCode = require('qrcode');
const { makeTestApp, checkinSetup, request } = require('./helpers');
const { normalizeTicketInput } = require('../src/lib/ticketInput');

describe('US32 Enter or scan a ticket identifier', () => {
  test('AC1: a volunteer can type a ticket code and it is validated', async () => {
    const { app } = makeTestApp();
    const { ev, ticket, volunteer } = await checkinSetup(app);
    const res = await volunteer.agent.post(`/api/checkin/events/${ev.id}/scan`).send({ code: ticket.code }).expect(200);
    assert.equal(res.body.result, 'VALID');
    assert.equal(res.body.code, ticket.code);
  });

  test('AC1: typing is forgiving - lower case, spaces and missing dashes still work', async () => {
    assert.equal(normalizeTicketInput('  etms-7kq2-m9xd-4hpa '), 'ETMS-7KQ2-M9XD-4HPA');
    assert.equal(normalizeTicketInput('ETMS 7KQ2 M9XD 4HPA'), 'ETMS-7KQ2-M9XD-4HPA');
    assert.equal(normalizeTicketInput('etms7kq2m9xd4hpa'), 'ETMS-7KQ2-M9XD-4HPA');
    const { app } = makeTestApp();
    const { ev, ticket, volunteer } = await checkinSetup(app);
    const messy = ticket.code.toLowerCase().replace(/-/g, ' ');
    assert.equal((await volunteer.agent.post(`/api/checkin/events/${ev.id}/scan`).send({ code: messy })).body.result, 'VALID');
  });

  test('AC2: the identifier stored in the QR code is exactly what the scanner sends', async () => {
    const { app } = makeTestApp();
    const { ev, ticket, volunteer } = await checkinSetup(app);
    const qr = QRCode.create(ticket.code, { errorCorrectionLevel: 'M' });
    const payload = qr.segments.map((s) => s.data.toString()).join('');
    assert.equal((await volunteer.agent.post(`/api/checkin/events/${ev.id}/scan`).send({ code: payload })).body.result, 'VALID');
    // the page loads the local QR decoder and has camera + photo options
    const page = (await volunteer.agent.get(`/checkin/events/${ev.id}`)).text;
    assert.match(page, /\/vendor\/jsQR\.js/);
    assert.match(page, /id="camera-btn"/);
    assert.match(page, /capture="environment"/);
    await request(app).get('/vendor/jsQR.js').expect(200).expect('Content-Type', /javascript/);
  });

  test('AC4: unreadable or junk input is handled without crashing and creates nothing', async () => {
    const { app, db } = makeTestApp();
    const { ev, volunteer } = await checkinSetup(app);
    for (const code of ['', '   ', 'hello', 'ETMS-0000', "1' OR '1'='1", 12345, null, { a: 1 }, 'x'.repeat(5000)]) {
      const res = await volunteer.agent.post(`/api/checkin/events/${ev.id}/scan`).send({ code }).expect(200);
      assert.equal(res.body.result, 'UNREADABLE', JSON.stringify(code).slice(0, 30));
      assert.equal(res.body.valid, false);
    }
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM checkins').get().n, 0);
  });

  test('AC5: the ticket is checked against the event being managed', async () => {
    const { app } = makeTestApp();
    const a = await checkinSetup(app, { title: 'Event A' });
    const b = await checkinSetup(app, { title: 'Event B' });
    // A's volunteer scans B's ticket on A's check-in page
    const res = await a.volunteer.agent.post(`/api/checkin/events/${a.ev.id}/scan`).send({ code: b.ticket.code }).expect(200);
    assert.equal(res.body.result, 'WRONG_EVENT');
  });

  test('only people with check-in access can scan', async () => {
    const { app } = makeTestApp();
    const { ev, ticket, holder } = await checkinSetup(app);
    await request(app).post(`/api/checkin/events/${ev.id}/scan`).send({ code: ticket.code }).expect(401);
    await holder.agent.post(`/api/checkin/events/${ev.id}/scan`).send({ code: ticket.code }).expect(403);
  });
});
