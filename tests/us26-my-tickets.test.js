// US26 - My Tickets page (T44)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, newStudent, createEvent, daysFromNow, loginOrganizer, request } = require('./helpers');

describe('US26 My Tickets page', () => {
  test('AC1: a logged-in student can open the My Tickets page', async () => {
    const { app } = makeTestApp();
    const { agent } = await newStudent(app);
    const page = await agent.get('/my-tickets').expect(200);
    assert.match(page.text, /<h1>My tickets<\/h1>/);
    assert.match(page.text, /id="ticket-list"/);
  });

  test('AC2: all of the student\'s registrations are listed, soonest event first', async () => {
    const { app } = makeTestApp();
    const later = await createEvent(app, { title: 'Later Event', date: daysFromNow(20) });
    const sooner = await createEvent(app, { title: 'Sooner Event', date: daysFromNow(4) });
    const middle = await createEvent(app, { title: 'Middle Event', date: daysFromNow(9) });
    const { agent } = await newStudent(app);
    for (const ev of [later, sooner, middle]) await agent.post(`/api/events/${ev.id}/register`).send({}).expect(201);
    const list = (await agent.get('/api/my/tickets').expect(200)).body.tickets;
    assert.deepEqual(list.map((t) => t.event.title), ['Sooner Event', 'Middle Event', 'Later Event']);
    assert.ok(list.every((t) => t.upcoming === true));
  });

  test('AC3: students only see their own tickets', async () => {
    const { app } = makeTestApp();
    const ev = await createEvent(app);
    const a = await newStudent(app);
    const b = await newStudent(app);
    await a.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201);
    assert.equal((await a.agent.get('/api/my/tickets')).body.tickets.length, 1);
    assert.equal((await b.agent.get('/api/my/tickets')).body.tickets.length, 0);
  });

  test('AC4: a student with no tickets gets an empty list and the page has an empty-state message', async () => {
    const { app } = makeTestApp();
    const { agent } = await newStudent(app);
    assert.deepEqual((await agent.get('/api/my/tickets')).body.tickets, []);
    assert.match((await agent.get('/my-tickets')).text, /You don't have any tickets yet\./);
  });

  test('logged-out visitors are sent to login and come back; organizers are refused', async () => {
    const { app } = makeTestApp();
    const res = await request(app).get('/my-tickets').expect(302);
    assert.equal(res.headers.location, '/login?next=%2Fmy-tickets');
    await request(app).get('/api/my/tickets').expect(401);
    const org = await loginOrganizer(app);
    await org.get('/my-tickets').expect(403);
    await org.get('/api/my/tickets').expect(403);
  });
});
