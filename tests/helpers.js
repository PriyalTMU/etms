const request = require('supertest');
const { openDatabase } = require('../src/db/database');
const { createApp } = require('../src/app');
const { seedIfEmpty } = require('../src/db/seed');
const { localDateString } = require('../src/shared/eventValidation');

const ORGANIZER = { email: 'organizer@etms.test', password: 'Organizer123!' };
const ORGANIZER_2 = { email: 'robotics@etms.test', password: 'Organizer123!' };
const STUDENT = { email: 'student@etms.test', password: 'Student123!' };

/** Fresh app + in-memory database (or a file DB) for a test. */
function makeTestApp({ dbPath = ':memory:', seed = true, now } = {}) {
  const db = openDatabase(dbPath);
  if (seed) seedIfEmpty(db);
  const app = createApp({
    db,
    now,
    sessionSecret: 'test-secret',
  });
  return { app, db };
}

async function loginOrganizer(app, creds = ORGANIZER) {
  const agent = request.agent(app);
  const res = await agent.post('/api/organizer/login').send(creds);
  if (res.status !== 200) throw new Error(`organizer login failed: ${res.status}`);
  return agent;
}

/** Logs in through the real student login (US02). */
async function loginStudent(app, creds = STUDENT) {
  const agent = request.agent(app);
  await agent.post('/api/students/login').send(creds).expect(200);
  return agent;
}

function validSignup(overrides = {}) {
  return {
    name: 'Jordan Lee',
    email: 'jordan.lee@torontomu.ca',
    password: 'Campus2026',
    confirmPassword: 'Campus2026',
    ...overrides,
  };
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localDateString(d);
}

function validEvent(overrides = {}) {
  return {
    title: 'Sprint 1 Demo Night',
    description: 'Come see what Team 03 built this sprint.',
    date: daysFromNow(7),
    time: '18:00',
    location: 'ENG 103',
    capacity: '75',
    ...overrides,
  };
}

module.exports = { makeTestApp, loginOrganizer, loginStudent, validEvent, validSignup, daysFromNow, ORGANIZER, ORGANIZER_2, STUDENT, request };
