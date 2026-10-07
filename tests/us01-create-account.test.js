// US01 - Create attendee account (T13)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, validSignup, request } = require('./helpers');
const { validateSignup } = require('../src/shared/accountValidation');

describe('US01 Create attendee account', () => {
  test('AC1: student can enter the required account information', async () => {
    const { app } = makeTestApp();
    const page = await request(app).get('/signup').expect(200);
    for (const f of ['name', 'email', 'password', 'confirmPassword']) {
      assert.match(page.text, new RegExp(`name="${f}"`), `form has ${f}`);
    }
    const home = await request(app).get('/').expect(200);
    assert.match(home.text, /href="\/signup"/, 'home page links to sign-up');
  });

  for (const field of ['name', 'email', 'password', 'confirmPassword']) {
    test(`AC2: ${field} is required`, async () => {
      const { app, db } = makeTestApp();
      const before = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
      const res = await request(app).post('/api/students/signup').send(validSignup({ [field]: '' })).expect(400);
      assert.ok(res.body.errors[field], `error for ${field}`);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, before, 'nothing stored');
    });
  }

  const invalid = [
    ['email', { email: 'not-an-email' }, /valid email/],
    ['email', { email: 'a@b' }, /valid email/],
    ['name', { name: 'J' }, /at least 2/],
    ['password', { password: 'short1', confirmPassword: 'short1' }, /at least 8/],
    ['password', { password: 'onlyletters', confirmPassword: 'onlyletters' }, /letter and one number/],
    ['password', { password: '12345678', confirmPassword: '12345678' }, /letter and one number/],
    ['confirmPassword', { confirmPassword: 'Different99' }, /do not match/],
  ];
  for (const [field, overrides, msg] of invalid) {
    test(`AC2: rejects invalid ${field} (${JSON.stringify(Object.values(overrides)[0])})`, async () => {
      const { app } = makeTestApp();
      const res = await request(app).post('/api/students/signup').send(validSignup(overrides)).expect(400);
      assert.match(res.body.errors[field], msg);
    });
  }

  test('AC3: a valid account can be created', async () => {
    const { app } = makeTestApp();
    const res = await request(app).post('/api/students/signup').send(validSignup()).expect(201);
    assert.equal(res.body.user.role, 'student');
    assert.equal(res.body.user.email, 'jordan.lee@torontomu.ca');
    assert.equal(res.body.user.name, 'Jordan Lee');
    assert.equal(res.body.redirect, '/login?created=1');
    assert.equal(res.body.user.password_hash, undefined);
  });

  test('AC4: account information is stored (password hashed, role student)', async () => {
    const { app, db } = makeTestApp();
    await request(app).post('/api/students/signup').send(validSignup({ email: '  Jordan.Lee@TorontoMU.ca ' })).expect(201);
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get('jordan.lee@torontomu.ca');
    assert.ok(row, 'stored with a trimmed, lower-case email');
    assert.equal(row.name, 'Jordan Lee');
    assert.equal(row.role, 'student');
    assert.notEqual(row.password_hash, 'Campus2026');
    assert.match(row.password_hash, /^\$2[aby]\$/);
    // and the new account can log in
    await request(app).post('/api/students/login').send({ email: 'jordan.lee@torontomu.ca', password: 'Campus2026' }).expect(200);
  });

  test('AC4: only the information needed is stored (NFR3)', async () => {
    const { app, db } = makeTestApp();
    await request(app).post('/api/students/signup').send(validSignup({ phone: '416-555-0100', studentNumber: '500123456' })).expect(201);
    const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
    assert.ok(!cols.includes('phone') && !cols.includes('student_number'));
  });

  test('AC5: duplicate email is rejected (any capitalisation)', async () => {
    const { app, db } = makeTestApp();
    await request(app).post('/api/students/signup').send(validSignup()).expect(201);
    const res = await request(app).post('/api/students/signup').send(validSignup({ email: 'JORDAN.LEE@torontomu.ca', name: 'Someone Else' })).expect(409);
    assert.match(res.body.errors.email, /already exists/);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users WHERE email = 'jordan.lee@torontomu.ca'").get().n, 1);
  });

  test('AC5: cannot sign up with an existing organizer email either', async () => {
    const { app } = makeTestApp();
    await request(app).post('/api/students/signup').send(validSignup({ email: 'organizer@etms.test' })).expect(409);
  });

  test('sign-up cannot be used to make an organizer account', async () => {
    const { app } = makeTestApp();
    const res = await request(app).post('/api/students/signup').send(validSignup({ role: 'organizer' })).expect(201);
    assert.equal(res.body.user.role, 'student');
  });

  test('shared validator: error messages are full, readable sentences', () => {
    const r = validateSignup({ name: '', email: 'x', password: 'abc', confirmPassword: '' });
    for (const msg of Object.values(r.errors)) assert.match(msg, /^[A-Z].*\.$/);
  });
});
