// US40 - Event changes appear to students (T79)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, loginOrganizer, createEvent, newStudent, validEvent, request } = require('./helpers');

describe('US40 Event changes appear to students', () => {
  const { app } = makeTestApp();

  test('AC1/AC2: saved changes appear on the student list and details for the right event', async () => {
    const ev = await createEvent(app, { title: 'Old Title', location: 'Old Room' });
    const other = await createEvent(app, { title: 'Untouched Event', location: 'Other Room' });
    const org = await loginOrganizer(app);
    await org.put(`/api/organizer/events/${ev.id}`).send(validEvent({ title: 'New Title', location: 'New Room', time: '20:00' })).expect(200);

    const list = (await request(app).get('/api/events')).body.events;
    const changed = list.find((e) => e.id === ev.id);
    assert.equal(changed.title, 'New Title');
    assert.equal(changed.location, 'New Room');
    assert.equal(changed.time, '20:00');
    assert.equal(list.find((e) => e.id === other.id).title, 'Untouched Event', 'other events are not changed');

    const details = (await request(app).get(`/api/events/${ev.id}`)).body.event;
    assert.equal(details.title, 'New Title');
  });

  test('AC3: old information is not shown after refreshing (no caching of event data)', async () => {
    const ev = await createEvent(app, { title: 'Cache Test' });
    const first = await request(app).get(`/api/events/${ev.id}`).expect(200);
    assert.match(first.headers['cache-control'], /no-store/);
    const org = await loginOrganizer(app);
    await org.put(`/api/organizer/events/${ev.id}`).send(validEvent({ title: 'Cache Test Updated' })).expect(200);
    const again = await request(app).get(`/api/events/${ev.id}`).expect(200);
    assert.equal(again.body.event.title, 'Cache Test Updated');
    assert.match((await request(app).get('/api/events')).headers['cache-control'], /no-store/);
  });

  test("changes also reach a student's existing ticket and My Tickets", async () => {
    const ev = await createEvent(app, { title: 'Ticket Before' });
    const s = await newStudent(app);
    const ticket = (await s.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201)).body.ticket;
    const org = await loginOrganizer(app);
    await org.put(`/api/organizer/events/${ev.id}`).send(validEvent({ title: 'Ticket After', location: 'Moved Room' })).expect(200);
    const t = (await s.agent.get(`/api/tickets/${ticket.code}`).expect(200)).body.ticket;
    assert.equal(t.event.title, 'Ticket After');
    assert.equal(t.event.location, 'Moved Room');
    const mine = (await s.agent.get('/api/my/tickets').expect(200)).body.tickets;
    assert.equal(mine.find((x) => x.code === ticket.code).event.title, 'Ticket After');
  });
});
