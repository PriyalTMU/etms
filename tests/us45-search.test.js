// US45 - Search events by keyword (T85, T86)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { makeTestApp, createEvent, request } = require('./helpers');

describe('US45 Search events by keyword', () => {
  const { app } = makeTestApp();
  const titles = async (qs) => (await request(app).get('/api/events' + qs).expect(200)).body.events.map((e) => e.title);

  test('AC1: the list page has a keyword search box', async () => {
    const page = (await request(app).get('/events').expect(200)).text;
    assert.match(page, /<input id="q" name="q" type="search"/);
    assert.match(page, /id="search-btn"/);
  });

  test('AC2/AC3: matching events are shown and others are hidden', async () => {
    await createEvent(app, { title: 'Pottery Basics', description: 'Clay and wheels.' });
    await createEvent(app, { title: 'Chess Club Night', description: 'Bring a board.' });
    assert.deepEqual(await titles('?q=pottery'), ['Pottery Basics']);
    assert.deepEqual(await titles('?q=CHESS'), ['Chess Club Night'], 'not case-sensitive');
    assert.deepEqual(await titles('?q=board'), ['Chess Club Night'], 'searches the description');
    assert.ok((await titles('?q=robotics')).includes('Robotics Club Open House'), 'searches title and club name');
  });

  test('every word must match (multi-word search)', async () => {
    await createEvent(app, { title: 'Jazz Night', location: 'Kerr Hall' });
    await createEvent(app, { title: 'Jazz Brunch', location: 'SLC' });
    assert.deepEqual(await titles('?q=jazz%20kerr'), ['Jazz Night']);
  });

  test('AC4: a search with no results returns an empty list the page can explain', async () => {
    const res = await request(app).get('/api/events?q=zzznothing').expect(200);
    assert.deepEqual(res.body.events, []);
    assert.equal(res.body.filtered, true);
    assert.ok(res.body.total > 0, 'the page knows events exist, so it shows "no match" (not "no events")');
    const page = (await request(app).get('/events')).text;
    assert.match(page, /id="no-results"/);
    assert.match((await request(app).get('/js/event-list.js')).text, /No events match/);
  });

  test('AC5: search does not break the event list (symbols, SQL text, long input, blank search)', async () => {
    for (const q of ["%", "_", "' OR 1=1 --", '"; DROP TABLE events; --', '\\', '😀']) {
      await request(app).get('/api/events?q=' + encodeURIComponent(q)).expect(200);
    }
    const tooLong = await request(app).get('/api/events?q=' + 'a'.repeat(101)).expect(400);
    assert.match(tooLong.body.error, /100 characters/);
    const all = (await request(app).get('/api/events')).body;
    const blank = (await request(app).get('/api/events?q=%20%20')).body;
    assert.equal(blank.events.length, all.events.length);
    assert.equal(blank.filtered, false);
    assert.equal((await request(app).get('/api/events?q=%25')).body.events.length, 0, '% is matched literally, not as a wildcard');
  });
});
