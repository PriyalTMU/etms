// US46 - Filter by category (T87) · US47 - Filter by date (T88) · US48 - Clear search/filters (T89)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, createEvent, daysFromNow, request } = require('./helpers');

describe('US46 / US47 / US48 Filters', () => {
  const { app } = makeTestApp();
  const get = async (qs) => (await request(app).get('/api/events' + qs).expect(200)).body;
  let sports, career, later;

  test('setup', async () => {
    sports = await createEvent(app, { title: 'Soccer Pickup', category: 'sports', date: daysFromNow(2) });
    career = await createEvent(app, { title: 'Career Panel', category: 'career', date: daysFromNow(5) });
    later = await createEvent(app, { title: 'Spring Sports Fair', category: 'sports', date: daysFromNow(40) });
  });

  test('US46 AC1: student can choose from the available categories', async () => {
    const body = await get('');
    assert.deepEqual(body.categories.map((c) => c.value), ['academic', 'arts', 'career', 'social', 'sports', 'tech', 'other']);
    assert.match((await request(app).get('/events')).text, /<select id="category" name="category">/);
  });

  test('US46 AC2/AC3: only events in that category are shown, from the current list', async () => {
    const body = await get('?category=sports');
    assert.deepEqual(body.events.map((e) => e.title), ['Soccer Pickup', 'Spring Sports Fair']);
    assert.ok(body.events.every((e) => e.category === 'sports'));
    assert.equal((await request(app).get('/api/events?category=parties').expect(400)).body.error, 'Choose a category from the list.');
  });

  test('US47 AC1/AC2: a date range shows only events on those dates', async () => {
    const body = await get(`?from=${daysFromNow(1)}&to=${daysFromNow(6)}`);
    const t = body.events.map((e) => e.title);
    assert.ok(t.includes('Soccer Pickup') && t.includes('Career Panel'));
    assert.ok(!t.includes('Spring Sports Fair'));
    assert.ok(body.events.every((e) => e.date >= daysFromNow(1) && e.date <= daysFromNow(6)));
  });

  test('US47 AC3: dates are handled correctly (same day, from-only, to-only, bad and reversed dates)', async () => {
    assert.deepEqual((await get(`?from=${daysFromNow(5)}&to=${daysFromNow(5)}`)).events.map((e) => e.title), ['Career Panel']);
    assert.ok((await get(`?from=${daysFromNow(30)}`)).events.every((e) => e.date >= daysFromNow(30)));
    assert.ok((await get(`?to=${daysFromNow(2)}`)).events.every((e) => e.date <= daysFromNow(2)));
    assert.match((await request(app).get('/api/events?from=2026-02-30').expect(400)).body.error, /not a real date/);
    assert.match((await request(app).get(`/api/events?from=${daysFromNow(9)}&to=${daysFromNow(1)}`).expect(400)).body.error, /on or before/);
    assert.equal((await get(`?to=${daysFromNow(-3)}`)).events.length, 0, 'past dates show nothing (only upcoming events)');
  });

  test('filters combine with each other and with keyword search', async () => {
    assert.deepEqual((await get(`?category=sports&to=${daysFromNow(10)}`)).events.map((e) => e.title), ['Soccer Pickup']);
    assert.deepEqual((await get('?q=fair&category=sports')).events.map((e) => e.title), ['Spring Sports Fair']);
    assert.deepEqual((await get('?q=fair&category=career')).events, []);
  });

  test('US48 AC1-AC3: clearing returns the full list and resets the controls', async () => {
    const full = await get('');
    assert.equal(full.filtered, false);
    assert.equal(full.events.length, full.total);
    assert.ok([sports, career, later].every((e) => full.events.some((x) => x.id === e.id)));
    const page = (await request(app).get('/events')).text;
    assert.match(page, /id="clear-filters"/);
    const js = (await request(app).get('/js/event-list.js')).text;
    assert.match(js, /function clearAll\(\)[\s\S]*form\.reset\(\)/);
  });
});
