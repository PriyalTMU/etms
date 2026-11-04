// US31 - Unauthorized users are blocked from check-in (T57)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, loginOrganizer, newStudent, createEvent, addVolunteer, ORGANIZER_2, request } = require('./helpers');

describe('US31 Block unauthorized check-in access', () => {
  test('AC1: logged-out users are sent to login (pages) or refused (API)', async () => {
    const { app } = makeTestApp();
    const ev = await createEvent(app);
    const page = await request(app).get(`/checkin/events/${ev.id}`).expect(302);
    assert.equal(page.headers.location, `/login?next=%2Fcheckin%2Fevents%2F${ev.id}`);
    await request(app).get('/checkin').expect(302);
    await request(app).get(`/api/checkin/events/${ev.id}`).expect(401);
    await request(app).get('/api/checkin/events').expect(401);
  });

  test('AC2: normal students (not volunteers) cannot use check-in', async () => {
    const { app } = makeTestApp();
    const ev = await createEvent(app);
    const student = await newStudent(app);
    const res = await student.agent.get(`/checkin/events/${ev.id}`).expect(403);
    assert.match(res.text, /do not have check-in access/);
    assert.deepEqual((await student.agent.get('/api/checkin/events')).body.events, []);
    const api = await student.agent.get(`/api/checkin/events/${ev.id}`).expect(403);
    assert.equal(api.body.error, 'You do not have check-in access for this event.');
  });

  test("AC3: volunteers and organizers cannot reach other events' check-in", async () => {
    const { app } = makeTestApp();
    const mine = await createEvent(app);
    const theirs = await createEvent(app);
    const vol = await newStudent(app);
    await addVolunteer(app, mine.id, vol.email);
    await vol.agent.get(`/api/checkin/events/${theirs.id}`).expect(403);
    const otherOrganizer = await loginOrganizer(app, ORGANIZER_2);
    await otherOrganizer.get(`/checkin/events/${mine.id}`).expect(403);
  });

  test('AC4: unknown events and bad ids get the same clear message', async () => {
    const { app } = makeTestApp();
    const student = await newStudent(app);
    for (const id of ['99999', 'abc']) {
      await student.agent.get(`/checkin/events/${id}`).expect(403);
    }
    await student.agent.get('/api/checkin/events/99999').expect(403);
  });
});
