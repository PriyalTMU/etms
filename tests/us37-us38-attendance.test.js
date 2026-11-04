// US37 - Organizer views issued tickets (T66)   US38 - Organizer views checked-in attendees (T67)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, checkinSetup, newStudent, loginOrganizer, ORGANIZER_2, request } = require('./helpers');

describe('US37 Organizer views issued tickets', () => {
  test('AC1/AC3: organizer opens the ticket list for their event with each ticket\'s status', async () => {
    const { app } = makeTestApp();
    const { ev, ticket } = await checkinSetup(app);
    const second = await newStudent(app, 'Second Student');
    await second.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201);
    const org = await loginOrganizer(app);
    const res = (await org.get(`/api/organizer/events/${ev.id}/tickets`).expect(200)).body;
    assert.equal(res.tickets.length, 2);
    const mine = res.tickets.find((t) => t.code === ticket.code);
    assert.equal(mine.holderName, 'Ticket Holder');
    assert.equal(mine.status, 'active');
    assert.equal(mine.checkedInAt, null);
    assert.ok(mine.registeredAt);
    const page = await org.get(`/organizer/events/${ev.id}`).expect(200);
    assert.match(page.text, /Tickets &amp; attendance/);
    assert.match(page.text, /id="attendance-table"/);
  });

  test('AC2: only tickets for that event are listed', async () => {
    const { app } = makeTestApp();
    const a = await checkinSetup(app, { title: 'Event A' });
    const b = await checkinSetup(app, { title: 'Event B' });
    const org = await loginOrganizer(app);
    const codes = (await org.get(`/api/organizer/events/${a.ev.id}/tickets`)).body.tickets.map((t) => t.code);
    assert.deepEqual(codes, [a.ticket.code]);
    assert.ok(!codes.includes(b.ticket.code));
  });

  test("AC4: organizers cannot see another organizer's event tickets; students cannot see any", async () => {
    const { app } = makeTestApp();
    const { ev, holder } = await checkinSetup(app);
    const other = await loginOrganizer(app, ORGANIZER_2);
    await other.get(`/api/organizer/events/${ev.id}/tickets`).expect(404);
    await holder.agent.get(`/api/organizer/events/${ev.id}/tickets`).expect(403);
    await request(app).get(`/api/organizer/events/${ev.id}/tickets`).expect(401);
  });

  test('only the information needed is shared (no student emails)', async () => {
    const { app } = makeTestApp();
    const { ev } = await checkinSetup(app);
    const org = await loginOrganizer(app);
    const body = JSON.stringify((await org.get(`/api/organizer/events/${ev.id}/tickets`)).body.tickets);
    assert.doesNotMatch(body, /@/);
  });
});

describe('US38 Organizer views checked-in attendees', () => {
  test('AC1/AC2/AC3: after a valid check-in the attendance view shows who checked in, for that event', async () => {
    const { app } = makeTestApp();
    const { ev, ticket, volunteer } = await checkinSetup(app);
    const org = await loginOrganizer(app);
    const before = (await org.get(`/api/organizer/events/${ev.id}/tickets`)).body;
    assert.deepEqual(before.summary, { issued: 1, checkedIn: 0, notCheckedIn: 1 });
    await volunteer.agent.post(`/api/checkin/events/${ev.id}/scan`).send({ code: ticket.code }).expect(200);
    const after = (await org.get(`/api/organizer/events/${ev.id}/tickets`)).body;
    assert.deepEqual(after.summary, { issued: 1, checkedIn: 1, notCheckedIn: 0 });
    assert.equal(after.tickets[0].status, 'checked_in');
    assert.ok(after.tickets[0].checkedInAt);
    assert.equal(after.tickets[0].checkedInBy, 'Val Volunteer');
  });

  test('AC4: registered and checked-in attendees are clearly separated', async () => {
    const { app } = makeTestApp();
    const { ev, ticket, volunteer } = await checkinSetup(app);
    const s2 = await newStudent(app, 'Not Here Yet');
    await s2.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201);
    await volunteer.agent.post(`/api/checkin/events/${ev.id}/scan`).send({ code: ticket.code });
    const org = await loginOrganizer(app);
    const t = (await org.get(`/api/organizer/events/${ev.id}/tickets`)).body.tickets;
    assert.deepEqual(t.filter((x) => x.checkedInAt).map((x) => x.holderName), ['Ticket Holder']);
    assert.deepEqual(t.filter((x) => !x.checkedInAt).map((x) => x.holderName), ['Not Here Yet']);
    const js = (await request(app).get('/js/attendance.js')).text;
    assert.match(js, /'Checked in'/);
    assert.match(js, /setInterval\(load, 15000\)/, 'view refreshes by itself');
    const page = (await org.get(`/organizer/events/${ev.id}`)).text;
    for (const f of ['all', 'checked', 'waiting']) assert.match(page, new RegExp(`data-filter="${f}"`));
  });
});
