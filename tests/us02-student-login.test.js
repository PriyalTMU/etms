// US02 - Student login (T14)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, loginStudent, STUDENT, request } = require('./helpers');

describe('US02 Student login', () => {
  const { app } = makeTestApp();

  test('AC1: student can enter account credentials', async () => {
    const page = await request(app).get('/login').expect(200);
    assert.match(page.text, /id="email"/);
    assert.match(page.text, /id="password"/);
    assert.match(page.text, /type="submit"/);
  });

  test('AC2: valid credentials allow attendee access', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/students/login').send(STUDENT).expect(200);
    assert.equal(res.body.user.role, 'student');
    assert.ok(res.headers['set-cookie'].some((c) => c.startsWith('etms.sid=')));
  });

  test('AC3: logged-in student is recognised while using attendee features', async () => {
    const agent = await loginStudent(app);
    const me = (await agent.get('/api/auth/me').expect(200)).body.user;
    assert.equal(me.role, 'student');
    assert.equal(me.email, STUDENT.email);
    assert.equal(me.name, 'Demo Student');
    // still recognised after moving around the attendee pages
    await agent.get('/events').expect(200);
    const events = (await agent.get('/api/events').expect(200)).body.events;
    await agent.get(`/events/${events[0].id}`).expect(200);
    assert.equal((await agent.get('/api/auth/me')).body.user.role, 'student');
  });

  test('AC4: login leads to the attendee area (event list)', async () => {
    const res = await request(app).post('/api/students/login').send(STUDENT).expect(200);
    assert.equal(res.body.redirect, '/events');
    const agent = await loginStudent(app);
    const page = await agent.get('/login').expect(302);
    assert.equal(page.headers.location, '/events', 'logged-in student opening /login goes to the event list');
  });

  test('email is not case-sensitive', async () => {
    await request(app).post('/api/students/login').send({ ...STUDENT, email: 'Student@ETMS.test' }).expect(200);
  });

  test('a newly created account can log in straight away', async () => {
    await request(app).post('/api/students/signup')
      .send({ name: 'New Student', email: 'new@torontomu.ca', password: 'Welcome123', confirmPassword: 'Welcome123' })
      .expect(201);
    await request(app).post('/api/students/login').send({ email: 'new@torontomu.ca', password: 'Welcome123' }).expect(200);
  });

  test('organizer accounts are pointed to the organizer login', async () => {
    const res = await request(app).post('/api/students/login').send({ email: 'organizer@etms.test', password: 'Organizer123!' }).expect(403);
    assert.match(res.body.error, /organizer login/);
  });

  test('student session cannot reach organizer functions (ties in with US06)', async () => {
    const agent = await loginStudent(app);
    await agent.get('/organizer').expect(403);
    await agent.get('/api/organizer/events').expect(403);
  });

  test('logout ends the student session', async () => {
    const agent = await loginStudent(app);
    await agent.post('/api/auth/logout').expect(200);
    assert.equal((await agent.get('/api/auth/me')).body.user, null);
  });
});
