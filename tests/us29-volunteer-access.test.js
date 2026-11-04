// US29 - Organizer gives a volunteer check-in access (T54, T55)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, loginOrganizer, newStudent, createEvent, addVolunteer, ORGANIZER_2, request } = require('./helpers');

describe('US29 Give volunteer check-in access', () => {
  test('AC1: organizer chooses an event and gives a student volunteer check-in access', async () => {
    const { app } = makeTestApp();
    const ev = await createEvent(app, { title: 'Volunteer Night' });
    const vol = await newStudent(app, 'Val Volunteer');
    const res = await addVolunteer(app, ev.id, vol.email);
    assert.equal(res.status, 201);
    assert.equal(res.body.volunteer.name, 'Val Volunteer');
    assert.match(res.body.message, /can now check in attendees for Volunteer Night/);
    const org = await loginOrganizer(app);
    const list = (await org.get(`/api/organizer/events/${ev.id}/volunteers`).expect(200)).body.volunteers;
    assert.deepEqual(list.map((v) => v.email), [vol.email]);
  });

  test('AC2/AC3: the access is connected to that event and the volunteer can open its check-in', async () => {
    const { app } = makeTestApp();
    const ev = await createEvent(app);
    const vol = await newStudent(app);
    await addVolunteer(app, ev.id, vol.email);
    const mine = (await vol.agent.get('/api/checkin/events').expect(200)).body.events;
    assert.deepEqual(mine.map((e) => e.id), [ev.id]);
    await vol.agent.get(`/api/checkin/events/${ev.id}`).expect(200);
    await vol.agent.get(`/checkin/events/${ev.id}`).expect(200);
  });

  test('AC4: the volunteer is not given access to other events', async () => {
    const { app } = makeTestApp();
    const a = await createEvent(app, { title: 'Assigned' });
    const b = await createEvent(app, { title: 'Not assigned' });
    const vol = await newStudent(app);
    await addVolunteer(app, a.id, vol.email);
    await vol.agent.get(`/api/checkin/events/${b.id}`).expect(403);
    await vol.agent.get(`/checkin/events/${b.id}`).expect(403);
  });

  test('AC5: invalid assignments are rejected with clear messages', async () => {
    const { app } = makeTestApp();
    const ev = await createEvent(app);
    const vol = await newStudent(app);
    const org = await loginOrganizer(app);
    const send = (email) => org.post(`/api/organizer/events/${ev.id}/volunteers`).send({ email });
    assert.match((await send('').expect(400)).body.error, /Enter the volunteer's email/);
    assert.match((await send('not-an-email').expect(400)).body.error, /valid email/);
    assert.match((await send('nobody@torontomu.ca').expect(404)).body.error, /No student account uses that email/);
    assert.match((await send('robotics@etms.test').expect(400)).body.error, /organizer account/);
    await send(vol.email).expect(201);
    assert.match((await send(vol.email.toUpperCase()).expect(409)).body.error, /already has check-in access/);
  });

  test('AC5: organizers cannot add volunteers to another club\'s event; students cannot add volunteers at all', async () => {
    const { app } = makeTestApp();
    const ev = await createEvent(app); // Computer Science Club event
    const vol = await newStudent(app);
    const other = await addVolunteer(app, ev.id, vol.email, ORGANIZER_2);
    assert.equal(other.status, 404);
    await vol.agent.post(`/api/organizer/events/${ev.id}/volunteers`).send({ email: vol.email }).expect(403);
    await request(app).post(`/api/organizer/events/${ev.id}/volunteers`).send({ email: vol.email }).expect(401);
  });

  test('the organizer manage page has the volunteer form', async () => {
    const { app } = makeTestApp();
    const ev = await createEvent(app);
    const org = await loginOrganizer(app);
    const page = await org.get(`/organizer/events/${ev.id}`).expect(200);
    assert.match(page.text, /id="volunteer-form"/);
    assert.match(page.text, /Check-in volunteers/);
  });
});
