// US30 - Volunteer opens check-in for their assigned event (T56)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, loginOrganizer, newStudent, createEvent, addVolunteer } = require('./helpers');

describe('US30 Volunteer accesses assigned check-in', () => {
  test('AC1/AC2: assigned volunteer opens the check-in page and it shows which event is managed', async () => {
    const { app } = makeTestApp();
    const ev = await createEvent(app, { title: 'Games Night', location: 'SCC 115' });
    const vol = await newStudent(app);
    await addVolunteer(app, ev.id, vol.email);
    const page = await vol.agent.get(`/checkin/events/${ev.id}`).expect(200);
    assert.match(page.text, /id="ci-title"/);
    const info = (await vol.agent.get(`/api/checkin/events/${ev.id}`).expect(200)).body;
    assert.equal(info.event.title, 'Games Night');
    assert.equal(info.event.location, 'SCC 115');
    assert.equal(info.role, 'student');
  });

  test('AC1: the volunteer sees their check-in events listed at /checkin', async () => {
    const { app } = makeTestApp();
    const ev = await createEvent(app, { title: 'Listed Event' });
    const vol = await newStudent(app);
    await addVolunteer(app, ev.id, vol.email);
    await vol.agent.get('/checkin').expect(200);
    const list = (await vol.agent.get('/api/checkin/events')).body.events;
    assert.equal(list[0].title, 'Listed Event');
  });

  test('AC4: a volunteer cannot open check-in for an event they were not assigned to', async () => {
    const { app } = makeTestApp();
    const assigned = await createEvent(app);
    const other = await createEvent(app);
    const vol = await newStudent(app);
    await addVolunteer(app, assigned.id, vol.email);
    const res = await vol.agent.get(`/checkin/events/${other.id}`).expect(403);
    assert.match(res.text, /No check-in access/);
  });

  test("the event's own organizer can also run check-in", async () => {
    const { app } = makeTestApp();
    const ev = await createEvent(app);
    const org = await loginOrganizer(app);
    await org.get(`/checkin/events/${ev.id}`).expect(200);
    assert.equal((await org.get(`/api/checkin/events/${ev.id}`).expect(200)).body.role, 'organizer');
  });
});
