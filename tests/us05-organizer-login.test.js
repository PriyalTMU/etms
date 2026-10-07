// US05 - Organizer login (T16)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, ORGANIZER, STUDENT, request } = require('./helpers');

describe('US05 Organizer login', () => {
  const { app } = makeTestApp();

  test('AC1: organizer can enter credentials on the organizer login page', async () => {
    const res = await request(app).get('/organizer/login').expect(200);
    assert.match(res.text, /id="email"/);
    assert.match(res.text, /id="password"/);
    assert.match(res.text, /type="submit"/);
  });

  test('AC2: valid organizer credentials provide organizer access', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/organizer/login').send(ORGANIZER).expect(200);
    assert.equal(res.body.redirect, '/organizer');
    assert.ok(res.headers['set-cookie'].some((c) => c.startsWith('etms.sid=')), 'session cookie is set');
    // Access to the organizer area is now granted
    await agent.get('/organizer').expect(200);
  });

  test('AC3: organizer is recognized with the correct role', async () => {
    const agent = request.agent(app);
    await agent.post('/api/organizer/login').send(ORGANIZER).expect(200);
    const me = await agent.get('/api/auth/me').expect(200);
    assert.equal(me.body.user.role, 'organizer');
    assert.equal(me.body.user.email, ORGANIZER.email);
    assert.equal(me.body.user.clubName, 'Computer Science Club');
    assert.equal(me.body.user.password_hash, undefined, 'password hash is never sent to the browser');
  });

  test('email is not case-sensitive', async () => {
    await request(app).post('/api/organizer/login').send({ ...ORGANIZER, email: 'Organizer@ETMS.test' }).expect(200);
  });

  test('wrong password is rejected and no session is created', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/organizer/login').send({ ...ORGANIZER, password: 'wrong' }).expect(401);
    assert.equal(res.body.error, 'Incorrect email or password.');
    const me = await agent.get('/api/auth/me');
    assert.equal(me.body.user, null);
  });

  test('unknown email gets the same message as wrong password', async () => {
    const res = await request(app).post('/api/organizer/login').send({ email: 'nobody@etms.test', password: 'x' }).expect(401);
    assert.equal(res.body.error, 'Incorrect email or password.');
  });

  test('missing fields are rejected with a clear message', async () => {
    const res = await request(app).post('/api/organizer/login').send({ email: '' }).expect(400);
    assert.match(res.body.error, /email and password/);
  });

  test('a student account cannot log in through organizer login', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/organizer/login').send(STUDENT).expect(403);
    assert.match(res.body.error, /not an organizer account/);
    const me = await agent.get('/api/auth/me');
    assert.equal(me.body.user, null);
  });

  test('logout ends the organizer session', async () => {
    const agent = request.agent(app);
    await agent.post('/api/organizer/login').send(ORGANIZER).expect(200);
    await agent.post('/api/auth/logout').expect(200);
    await agent.get('/api/organizer/events').expect(401);
  });

  test('passwords are stored hashed, not in plain text', () => {
    const { db } = makeTestApp();
    const row = db.prepare('SELECT password_hash FROM users WHERE email = ?').get(ORGANIZER.email);
    assert.notEqual(row.password_hash, ORGANIZER.password);
    assert.match(row.password_hash, /^\$2[aby]\$/);
  });
});
