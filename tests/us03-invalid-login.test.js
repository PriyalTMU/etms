// US03 - Invalid student login rejected (T15)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, STUDENT, request } = require('./helpers');

describe('US03 Invalid student login', () => {
  const { app } = makeTestApp();
  const MESSAGE = 'Incorrect email or password. Please try again.';

  const badAttempts = [
    ['wrong password', { email: STUDENT.email, password: 'WrongPass1' }],
    ['password with different case', { email: STUDENT.email, password: 'student123!' }],
    ['unknown email', { email: 'nobody@torontomu.ca', password: 'Student123!' }],
  ];

  for (const [label, creds] of badAttempts) {
    test(`AC1: ${label} does not allow access`, async () => {
      const agent = request.agent(app);
      await agent.post('/api/students/login').send(creds).expect(401);
      assert.equal((await agent.get('/api/auth/me')).body.user, null);
    });
  }

  test('AC2: an understandable error message is shown (same for wrong email or password)', async () => {
    const a = await request(app).post('/api/students/login').send(badAttempts[0][1]).expect(401);
    const b = await request(app).post('/api/students/login').send(badAttempts[2][1]).expect(401);
    assert.equal(a.body.error, MESSAGE);
    assert.equal(b.body.error, MESSAGE, "doesn't reveal which emails have accounts");
  });

  test('AC2: empty fields get their own clear message', async () => {
    const res = await request(app).post('/api/students/login').send({ email: STUDENT.email, password: '' }).expect(400);
    assert.equal(res.body.error, 'Enter both your email and password.');
  });

  test('AC3: the user remains logged out and gets no session cookie', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/students/login').send(badAttempts[0][1]).expect(401);
    assert.equal(res.headers['set-cookie'], undefined, 'no session cookie issued');
    assert.equal((await agent.get('/api/auth/me')).body.user, null);
  });

  test('AC3: after a failed attempt the correct password still works (not locked out by mistake)', async () => {
    const agent = request.agent(app);
    await agent.post('/api/students/login').send(badAttempts[0][1]).expect(401);
    await agent.post('/api/students/login').send(STUDENT).expect(200);
  });

  test('odd input types are rejected safely', async () => {
    await request(app).post('/api/students/login').send({ email: ['x'], password: { $ne: '' } }).expect(400);
  });
});
