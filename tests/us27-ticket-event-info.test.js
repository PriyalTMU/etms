// US27 - Ticket shows the event information (T45)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, newStudent, createEvent, request } = require('./helpers');

describe('US27 Ticket shows its event', () => {
  test('AC1: each ticket includes the event title, date, time, location and club', async () => {
    const { app } = makeTestApp();
    const ev = await createEvent(app, { title: 'Resume Clinic', time: '16:30', location: 'POD 250' });
    const { agent } = await newStudent(app);
    await agent.post(`/api/events/${ev.id}/register`).send({}).expect(201);
    const t = (await agent.get('/api/my/tickets')).body.tickets[0];
    assert.deepEqual(
      { title: t.event.title, date: t.event.date, time: t.event.time, location: t.event.location, club: t.event.clubName },
      { title: 'Resume Clinic', date: ev.date, time: '16:30', location: 'POD 250', club: 'Computer Science Club' }
    );
  });

  test('AC2: the information belongs to the right event when a student has several tickets', async () => {
    const { app } = makeTestApp();
    const events = (await request(app).get('/api/events')).body.events; // the 3 sample events
    const { agent } = await newStudent(app);
    for (const ev of events) await agent.post(`/api/events/${ev.id}/register`).send({}).expect(201);
    const tickets = (await agent.get('/api/my/tickets')).body.tickets;
    for (const t of tickets) {
      const real = (await request(app).get(`/api/events/${t.eventId}`)).body.event;
      assert.equal(t.event.id, real.id);
      assert.equal(t.event.title, real.title);
      assert.equal(t.event.location, real.location);
      const one = (await agent.get(`/api/tickets/${t.code}`)).body.ticket;
      assert.equal(one.event.title, real.title);
    }
  });

  test('the My Tickets and ticket pages have places for the event information', async () => {
    const { app } = makeTestApp();
    const js = (await request(app).get('/js/my-tickets.js')).text;
    for (const part of ['t.event.title', 't.event.location', 'formatShort']) assert.ok(js.includes(part), part);
    const { agent } = await newStudent(app);
    const page = (await agent.get('/tickets/ETMS-2222-3333-4444')).text;
    for (const id of ['tk-title', 'tk-date', 'tk-time', 'tk-location', 'tk-club']) assert.match(page, new RegExp(`id="${id}"`));
  });
});
