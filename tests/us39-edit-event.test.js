// US39 - Edit an existing event (T77, T78)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, loginOrganizer, createEvent, newStudent, validEvent, daysFromNow, ORGANIZER_2, request } = require('./helpers');

describe('US39 Edit an existing event', () => {
  const { app } = makeTestApp();

  test('AC1: organizer can open an event they manage and choose Edit', async () => {
    const ev = await createEvent(app, { title: 'Editable Event' });
    const org = await loginOrganizer(app);
    const page = await org.get(`/organizer/events/${ev.id}/edit`).expect(200);
    assert.match(page.text, /<h1>Edit event<\/h1>/);
    assert.match(page.text, /data-mode="edit"/);
    const manage = await org.get(`/organizer/events/${ev.id}`).expect(200);
    assert.match(manage.text, /id="edit-event"/);
  });

  test('AC2: the existing event information is loaded into the edit form', async () => {
    const ev = await createEvent(app, { title: 'Prefill Me', location: 'TRS 1-067', capacity: '45', category: 'career' });
    const org = await loginOrganizer(app);
    const res = await org.get(`/api/organizer/events/${ev.id}`).expect(200);
    assert.equal(res.body.event.title, 'Prefill Me');
    assert.equal(res.body.event.location, 'TRS 1-067');
    assert.equal(res.body.event.capacity, 45);
    assert.equal(res.body.event.category, 'career');
    const js = (await request(app).get('/js/create-event.js')).text;
    assert.match(js, /form\.title\.value = ev\.title/);
  });

  test('AC3/AC5: organizer can update the event and valid changes are saved', async () => {
    const ev = await createEvent(app, { title: 'Before Edit' });
    const org = await loginOrganizer(app);
    const changes = validEvent({ title: 'After Edit', description: 'New details.', date: daysFromNow(9), time: '19:15', location: 'New Room', capacity: '90', category: 'social' });
    const res = await org.put(`/api/organizer/events/${ev.id}`).send(changes).expect(200);
    assert.match(res.body.message, /changes were saved/);
    const saved = (await request(app).get(`/api/events/${ev.id}`)).body.event;
    assert.deepEqual(
      [saved.title, saved.description, saved.date, saved.time, saved.location, saved.capacity, saved.category],
      ['After Edit', 'New details.', daysFromNow(9), '19:15', 'New Room', 90, 'social']
    );
    assert.ok(saved.updatedAt, 'update time recorded');
  });

  test('AC4: invalid or incomplete changes are rejected and nothing changes', async () => {
    const ev = await createEvent(app, { title: 'Keep Me' });
    const org = await loginOrganizer(app);
    for (const bad of [{ title: '' }, { capacity: '0' }, { date: daysFromNow(-1) }, { time: '25:00' }, { category: 'party' }]) {
      const res = await org.put(`/api/organizer/events/${ev.id}`).send(validEvent(bad)).expect(400);
      assert.match(res.body.error, /not saved/);
      assert.ok(Object.keys(res.body.errors).length >= 1);
    }
    assert.equal((await request(app).get(`/api/events/${ev.id}`)).body.event.title, 'Keep Me');
  });

  test('AC4: capacity cannot be lowered below the tickets already issued', async () => {
    const ev = await createEvent(app, { capacity: '10' });
    for (let i = 0; i < 3; i++) {
      const s = await newStudent(app);
      await s.agent.post(`/api/events/${ev.id}/register`).send({}).expect(201);
    }
    const org = await loginOrganizer(app);
    const res = await org.put(`/api/organizer/events/${ev.id}`).send(validEvent({ capacity: '2' })).expect(400);
    assert.match(res.body.errors.capacity, /cannot be lower than the 3 tickets already issued/);
    await org.put(`/api/organizer/events/${ev.id}`).send(validEvent({ capacity: '3' })).expect(200);
  });

  test("AC6: organizer cannot edit another organizer's event", async () => {
    const ev = await createEvent(app, { title: 'Not Yours' });
    const other = await loginOrganizer(app, ORGANIZER_2);
    await other.get(`/api/organizer/events/${ev.id}`).expect(404);
    await other.put(`/api/organizer/events/${ev.id}`).send(validEvent({ title: 'Hijacked' })).expect(404);
    assert.equal((await request(app).get(`/api/events/${ev.id}`)).body.event.title, 'Not Yours');
  });

  test('students and logged-out visitors cannot edit events', async () => {
    const ev = await createEvent(app);
    const s = await newStudent(app);
    await s.agent.put(`/api/organizer/events/${ev.id}`).send(validEvent()).expect(403);
    await request(app).put(`/api/organizer/events/${ev.id}`).send(validEvent()).expect(401);
    await s.agent.get(`/organizer/events/${ev.id}/edit`).expect(403);
  });

  test('a cancelled event can no longer be edited', async () => {
    const ev = await createEvent(app);
    const org = await loginOrganizer(app);
    await org.post(`/api/organizer/events/${ev.id}/cancel`).send({}).expect(200);
    const res = await org.put(`/api/organizer/events/${ev.id}`).send(validEvent()).expect(409);
    assert.equal(res.body.code, 'EVENT_CANCELLED');
  });
});
