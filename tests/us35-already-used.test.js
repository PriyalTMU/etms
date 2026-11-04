// US35 - Already-used tickets are rejected (T63)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, checkinSetup, loginOrganizer } = require('./helpers');

describe('US35 Reject already-used ticket', () => {
  test('AC1/AC2: a ticket that was already checked in is rejected the second time', async () => {
    const { app } = makeTestApp();
    const { ev, ticket, volunteer } = await checkinSetup(app);
    const scan = () => volunteer.agent.post(`/api/checkin/events/${ev.id}/scan`).send({ code: ticket.code }).expect(200);
    assert.equal((await scan()).body.result, 'VALID');
    const again = (await scan()).body;
    assert.equal(again.result, 'ALREADY_USED');
    assert.equal(again.valid, false);
  });

  test('AC3: no second check-in record is created', async () => {
    const { app, db } = makeTestApp();
    const { ev, ticket, volunteer } = await checkinSetup(app);
    for (let i = 0; i < 3; i++) await volunteer.agent.post(`/api/checkin/events/${ev.id}/scan`).send({ code: ticket.code });
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM checkins').get().n, 1);
  });

  test('AC3: two volunteers scanning the same ticket at the same moment admit it only once', async () => {
    const { app, db } = makeTestApp();
    const { ev, ticket, volunteer } = await checkinSetup(app);
    const org = await loginOrganizer(app); // the organizer is a second person on the door
    const [a, b] = await Promise.all([
      volunteer.agent.post(`/api/checkin/events/${ev.id}/scan`).send({ code: ticket.code }),
      org.post(`/api/checkin/events/${ev.id}/scan`).send({ code: ticket.code }),
    ]);
    assert.deepEqual([a.body.result, b.body.result].sort(), ['ALREADY_USED', 'VALID']);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM checkins').get().n, 1);
  });

  test('AC4: the already-used message says when and by whom it was checked in', async () => {
    const { app } = makeTestApp();
    const { ev, ticket, volunteer } = await checkinSetup(app);
    const first = (await volunteer.agent.post(`/api/checkin/events/${ev.id}/scan`).send({ code: ticket.code })).body;
    const again = (await volunteer.agent.post(`/api/checkin/events/${ev.id}/scan`).send({ code: ticket.code })).body;
    assert.equal(again.message, 'Already used – this ticket was already checked in.');
    assert.equal(again.checkedInAt, first.checkedInAt);
    assert.equal(again.checkedInBy, 'Val Volunteer');
  });
});
