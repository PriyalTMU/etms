// US09 - Reject invalid / incomplete events (T19)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, loginOrganizer, validEvent, daysFromNow } = require('./helpers');
const { validateEvent, localDateString } = require('../src/shared/eventValidation');

const REQUIRED = ['title', 'description', 'date', 'time', 'location', 'capacity'];

describe('US09 Event validation - API', () => {
  const { app, db } = makeTestApp();
  const count = () => db.prepare('SELECT COUNT(*) AS n FROM events').get().n;

  for (const field of REQUIRED) {
    test(`AC1: ${field} cannot be left empty`, async () => {
      const agent = await loginOrganizer(app);
      const before = count();
      const res = await agent.post('/api/events').send(validEvent({ [field]: '' })).expect(400);
      assert.ok(res.body.errors[field], `error returned for ${field}`);
      assert.match(res.body.errors[field], /is required/);
      assert.equal(count(), before, 'nothing was saved');
    });
  }

  test('AC1: whitespace-only values count as empty', async () => {
    const agent = await loginOrganizer(app);
    const res = await agent.post('/api/events').send(validEvent({ title: '    ', location: '\t' })).expect(400);
    assert.ok(res.body.errors.title);
    assert.ok(res.body.errors.location);
  });

  test('AC1: completely empty submission lists every missing field', async () => {
    const agent = await loginOrganizer(app);
    const res = await agent.post('/api/events').send({}).expect(400);
    assert.deepEqual(Object.keys(res.body.errors).sort(), [...REQUIRED].sort());
  });

  const invalidCases = [
    ['capacity', '0', /at least 1/],
    ['capacity', '-5', /whole number/],
    ['capacity', '12.5', /whole number/],
    ['capacity', 'fifty', /whole number/],
    ['capacity', '999999', /cannot be more than 5000/],
    ['date', '2026-02-30', /real date/],
    ['date', '10/20/2026', /real date/],
    ['date', daysFromNow(-1), /cannot be in the past/],
    ['time', '25:00', /valid time/],
    ['time', '6pm', /valid time/],
    ['title', 'ab', /at least 3/],
    ['title', 'x'.repeat(101), /100 characters or fewer/],
    ['description', 'x'.repeat(2001), /2000 characters or fewer/],
    ['location', 'x'.repeat(151), /150 characters or fewer/],
  ];

  for (const [field, value, message] of invalidCases) {
    test(`AC2: rejects ${field} = ${JSON.stringify(value.length > 20 ? value.slice(0, 12) + '...' : value)}`, async () => {
      const agent = await loginOrganizer(app);
      const before = count();
      const res = await agent.post('/api/events').send(validEvent({ [field]: value })).expect(400);
      assert.match(res.body.errors[field], message);
      assert.equal(count(), before, 'nothing was saved');
    });
  }

  test('AC3: response has a clear overall message plus one message per field', async () => {
    const agent = await loginOrganizer(app);
    const res = await agent.post('/api/events').send(validEvent({ capacity: '0', date: '' })).expect(400);
    assert.equal(res.body.error, 'The event was not created. Please fix the highlighted fields.');
    assert.equal(typeof res.body.errors.capacity, 'string');
    assert.equal(typeof res.body.errors.date, 'string');
    assert.equal(res.body.errors.title, undefined, 'valid fields have no error');
  });

  test('invalid JSON body gets a readable error', async () => {
    const agent = await loginOrganizer(app);
    const res = await agent.post('/api/events').set('Content-Type', 'application/json').send('{bad json').expect(400);
    assert.match(res.body.error, /not valid JSON/);
  });

  test('non-JSON submissions are refused', async () => {
    const agent = await loginOrganizer(app);
    await agent.post('/api/events').type('form').send('title=Hello').expect(415);
  });
});

describe('US09 Event validation - shared rules (same file the browser uses)', () => {
  const now = new Date(2026, 9, 6, 14, 30); // Oct 6 2026, 2:30 PM

  test('a complete, sensible event is valid', () => {
    const r = validateEvent(
      { title: 'Club Meetup', description: 'Monthly meetup.', date: '2026-10-20', time: '18:00', location: 'ENG 103', capacity: '50' },
      now
    );
    assert.equal(r.valid, true);
    assert.deepEqual(r.errors, {});
    assert.equal(r.values.capacity, 50);
  });

  test('today is fine if the time is still ahead', () => {
    const r = validateEvent(
      { title: 'Later Today', description: 'x', date: localDateString(now), time: '16:00', location: 'A', capacity: '1' },
      now
    );
    assert.equal(r.valid, true);
  });

  test('today with a time that already passed is rejected', () => {
    const r = validateEvent(
      { title: 'Too Late', description: 'x', date: localDateString(now), time: '09:00', location: 'A', capacity: '1' },
      now
    );
    assert.match(r.errors.time, /already passed/);
  });

  test('leap day is accepted only in leap years', () => {
    const base = { title: 'Leap', description: 'x', time: '10:00', location: 'A', capacity: '5' };
    assert.equal(validateEvent({ ...base, date: '2028-02-29' }, now).valid, true);
    assert.match(validateEvent({ ...base, date: '2027-02-29' }, now).errors.date, /real date/);
  });

  test('capacity boundaries 1 and 5000 are accepted', () => {
    const base = { title: 'Bounds', description: 'x', date: '2026-12-01', time: '10:00', location: 'A' };
    assert.equal(validateEvent({ ...base, capacity: '1' }, now).valid, true);
    assert.equal(validateEvent({ ...base, capacity: '5000' }, now).valid, true);
    assert.equal(validateEvent({ ...base, capacity: '5001' }, now).valid, false);
  });

  test('every error message is a full sentence a user can understand', () => {
    const r = validateEvent({ capacity: 'abc', date: 'soon', time: 'noon' }, now);
    for (const msg of Object.values(r.errors)) {
      assert.match(msg, /^[A-Z].*\.$/, `"${msg}" reads as a sentence`);
      assert.doesNotMatch(msg, /undefined|null|NaN|regex|constraint/i);
    }
  });
});
